import crypto from "node:crypto";
import { SARDINIA_BBOX } from "./config.js";

const FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

export function normalizeConfidence(rawValue) {
  const value = String(rawValue ?? "").trim().toLowerCase();

  if (value === "h" || value === "high") return { label: "high", score: 90 };
  if (value === "n" || value === "nominal" || value === "medium") {
    return { label: "nominal", score: 60 };
  }
  if (value === "l" || value === "low") return { label: "low", score: 30 };

  const numeric = Number.parseFloat(value);
  if (Number.isFinite(numeric)) {
    if (numeric >= 80) return { label: "high", score: numeric };
    if (numeric >= 50) return { label: "nominal", score: numeric };
    return { label: "low", score: numeric };
  }

  return { label: "unknown", score: 0 };
}

export function toObservationDate(acqDate, acqTime) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(acqDate ?? ""))) return null;
  const time = String(acqTime ?? "").padStart(4, "0").slice(-4);
  if (!/^\d{4}$/.test(time)) return null;

  const hours = Number.parseInt(time.slice(0, 2), 10);
  const minutes = Number.parseInt(time.slice(2, 4), 10);
  if (hours > 23 || minutes > 59) return null;

  const date = new Date(`${acqDate}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function classifySeverity(confidence, frp) {
  const power = Number.isFinite(frp) ? frp : 0;
  if ((confidence.label === "high" && power >= 50) || power >= 100) return "critical";
  if (confidence.label === "high" || power >= 25) return "high";
  if (confidence.label === "nominal" || confidence.score >= 50 || power >= 10) return "medium";
  return "low";
}

function numberOrNull(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isInsideSardiniaBox(latitude, longitude) {
  return (
    latitude >= SARDINIA_BBOX.south &&
    latitude <= SARDINIA_BBOX.north &&
    longitude >= SARDINIA_BBOX.west &&
    longitude <= SARDINIA_BBOX.east
  );
}

export function normalizeFireRow(row, source, now = new Date()) {
  const latitude = numberOrNull(row.latitude);
  const longitude = numberOrNull(row.longitude);
  if (latitude === null || longitude === null || !isInsideSardiniaBox(latitude, longitude)) {
    return null;
  }

  const observed = toObservationDate(row.acq_date, row.acq_time);
  if (!observed) return null;

  const confidence = normalizeConfidence(row.confidence);
  const frp = numberOrNull(row.frp);
  const severity = classifySeverity(confidence, frp);
  const fingerprint = [
    source,
    latitude.toFixed(5),
    longitude.toFixed(5),
    observed.toISOString(),
    row.satellite ?? "",
  ].join("|");

  return {
    id: crypto.createHash("sha1").update(fingerprint).digest("hex").slice(0, 16),
    latitude,
    longitude,
    observedAt: observed.toISOString(),
    ageMinutes: Math.max(0, Math.round((now.getTime() - observed.getTime()) / 60_000)),
    confidence: confidence.label,
    confidenceScore: Math.round(confidence.score),
    severity,
    frp,
    satellite: row.satellite || source.replace("_NRT", ""),
    instrument: row.instrument || (source.startsWith("MODIS") ? "MODIS" : "VIIRS"),
    source,
    dayNight: row.daynight || null,
    brightness: numberOrNull(row.bright_ti4 ?? row.brightness),
    scan: numberOrNull(row.scan),
    track: numberOrNull(row.track),
  };
}

function deduplicateFires(fires) {
  const seen = new Set();
  const output = [];

  for (const fire of fires) {
    const bucket = `${fire.latitude.toFixed(3)}|${fire.longitude.toFixed(3)}|${fire.observedAt.slice(0, 13)}|${fire.instrument}`;
    if (seen.has(bucket)) continue;
    seen.add(bucket);
    output.push(fire);
  }

  return output;
}

export function buildFireStats(fires) {
  const highConfidence = fires.filter((fire) => fire.confidence === "high").length;
  const urgent = fires.filter((fire) => fire.severity === "critical" || fire.severity === "high").length;
  const frpValues = fires.map((fire) => fire.frp).filter(Number.isFinite);
  const latestObservation = fires[0]?.observedAt ?? null;

  return {
    total: fires.length,
    highConfidence,
    urgent,
    maxFrp: frpValues.length ? Math.max(...frpValues) : null,
    averageFrp: frpValues.length
      ? Math.round((frpValues.reduce((sum, value) => sum + value, 0) / frpValues.length) * 10) / 10
      : null,
    latestObservation,
  };
}

async function fetchSource({ mapKey, source, days, fetchImpl }) {
  const bbox = [SARDINIA_BBOX.west, SARDINIA_BBOX.south, SARDINIA_BBOX.east, SARDINIA_BBOX.north].join(",");
  const url = `${FIRMS_BASE_URL}/${encodeURIComponent(mapKey)}/${encodeURIComponent(source)}/${bbox}/${days}`;
  const response = await fetchImpl(url, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(20_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`FIRMS ${source}: HTTP ${response.status}`);
  }
  if (/invalid\s+map[_ ]?key|error/i.test(body.slice(0, 250)) && !body.includes("latitude")) {
    throw new Error(`FIRMS ${source}: chiave non valida o servizio non disponibile`);
  }

  const rows = parseCsv(body);
  const now = new Date();
  const fires = rows.map((row) => normalizeFireRow(row, source, now)).filter(Boolean);
  return { source, fires };
}

export async function fetchFirmsFires({
  mapKey,
  sources,
  days = 1,
  fetchImpl = fetch,
}) {
  const results = await Promise.allSettled(
    sources.map((source) => fetchSource({ mapKey, source, days, fetchImpl })),
  );

  const fires = [];
  const sourceStatus = [];

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const source = sources[index];
    if (result.status === "fulfilled") {
      fires.push(...result.value.fires);
      sourceStatus.push({ source, ok: true, detections: result.value.fires.length });
    } else {
      sourceStatus.push({ source, ok: false, detections: 0, error: result.reason?.message ?? "Errore sconosciuto" });
    }
  }

  const normalized = deduplicateFires(fires).sort(
    (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime(),
  );

  if (!sourceStatus.some((status) => status.ok)) {
    const details = sourceStatus.map((status) => status.error).filter(Boolean).join("; ");
    throw new Error(details || "Nessuna sorgente FIRMS disponibile");
  }

  return {
    fires: normalized,
    stats: buildFireStats(normalized),
    sourceStatus,
  };
}

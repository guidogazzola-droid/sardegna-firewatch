const HISTORICAL_FORECAST_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export const WIND_LEVELS = Object.freeze({
  surface: Object.freeze({
    key: "surface",
    label: "Vicino al suolo · 10 m",
    shortLabel: "10 m",
    approximateAltitude: "10 m sopra il suolo",
    speedVariable: "wind_speed_10m",
    directionVariable: "wind_direction_10m",
  }),
  low: Object.freeze({
    key: "low",
    label: "Bassa quota · 925 hPa",
    shortLabel: "925 hPa",
    approximateAltitude: "circa 800 m sul livello del mare",
    speedVariable: "wind_speed_925hPa",
    directionVariable: "wind_direction_925hPa",
  }),
  mid: Object.freeze({
    key: "mid",
    label: "Quota intermedia · 850 hPa",
    shortLabel: "850 hPa",
    approximateAltitude: "circa 1,5 km sul livello del mare",
    speedVariable: "wind_speed_850hPa",
    directionVariable: "wind_direction_850hPa",
  }),
  high: Object.freeze({
    key: "high",
    label: "Fumo elevato · 700 hPa",
    shortLabel: "700 hPa",
    approximateAltitude: "circa 3 km sul livello del mare",
    speedVariable: "wind_speed_700hPa",
    directionVariable: "wind_direction_700hPa",
  }),
});

export function normalizeWindLevels(value) {
  const requested = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const unique = [...new Set(requested.filter((key) => Object.hasOwn(WIND_LEVELS, key)))];
  return unique.length ? unique : Object.keys(WIND_LEVELS);
}

export function normalizeLocalDateTime(value, fieldName = "data") {
  const text = String(value || "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::\d{2})?)?$/.exec(text);
  if (!match) throw new Error(`${fieldName} non valida. Usa il formato ISO YYYY-MM-DDTHH:mm.`);
  const hour = match[2] ?? "00";
  const minute = match[3] ?? "00";
  const normalized = `${match[1]}T${hour}:${minute}`;
  const probe = new Date(`${normalized}:00Z`);
  if (Number.isNaN(probe.getTime())) throw new Error(`${fieldName} non valida.`);
  return normalized;
}

export function inclusiveDayCount(start, end) {
  const startDate = new Date(`${String(start).slice(0, 10)}T00:00:00Z`);
  const endDate = new Date(`${String(end).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return NaN;
  return Math.floor((endDate - startDate) / 86_400_000) + 1;
}

export function smokeDirectionFromWind(directionFrom) {
  if (directionFrom === null || directionFrom === undefined || directionFrom === "") return null;
  const numeric = Number(directionFrom);
  if (!Number.isFinite(numeric)) return null;
  return ((numeric % 360) + 540) % 360;
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

function clampDate(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function buildHourlyVariables(levelKeys) {
  return levelKeys.flatMap((key) => {
    const level = WIND_LEVELS[key];
    return [level.speedVariable, level.directionVariable];
  });
}

async function requestOpenMeteo(baseUrl, params, sourceId) {
  const url = `${baseUrl}?${params}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "FireWatch/1.1" },
    signal: AbortSignal.timeout(18_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.hourly?.time) {
    const reason = payload?.reason || payload?.error || `HTTP ${response.status}`;
    throw new Error(`${sourceId}: ${reason}`);
  }
  return { ...payload, sourceId };
}

function rowsFromDataset(dataset, levelKeys) {
  const times = dataset.hourly?.time || [];
  const units = dataset.hourly_units || {};
  return times.map((time, index) => {
    const levels = {};
    for (const key of levelKeys) {
      const definition = WIND_LEVELS[key];
      const speedRaw = dataset.hourly?.[definition.speedVariable]?.[index];
      const directionRaw = dataset.hourly?.[definition.directionVariable]?.[index];
      const speed = speedRaw === null || speedRaw === undefined || speedRaw === "" ? NaN : Number(speedRaw);
      const directionFrom =
        directionRaw === null || directionRaw === undefined || directionRaw === "" ? NaN : Number(directionRaw);
      levels[key] = {
        speed: Number.isFinite(speed) ? speed : null,
        speedUnit: units[definition.speedVariable] || "km/h",
        directionFrom: Number.isFinite(directionFrom) ? directionFrom : null,
        smokeDirectionTo: smokeDirectionFromWind(directionFrom),
      };
    }
    return { time, source: dataset.sourceId, levels };
  });
}

function hasAnyLevel(row) {
  return Object.values(row.levels).some(
    (level) => Number.isFinite(level.speed) && Number.isFinite(level.directionFrom),
  );
}

/**
 * Retrieve a continuous local-time hourly series. Operational forecasts cover the
 * most recent days; older hours come from Open-Meteo's archived forecast runs.
 */
export async function fetchWindHistory({
  latitude,
  longitude,
  start,
  end,
  levels,
  timezone = "auto",
  now = new Date(),
}) {
  const levelKeys = normalizeWindLevels(levels);
  const startLocal = normalizeLocalDateTime(start, "Data iniziale");
  const endLocal = normalizeLocalDateTime(end, "Data finale");
  if (endLocal < startLocal) throw new Error("La data finale precede la data iniziale.");

  const startDate = startLocal.slice(0, 10);
  const endDate = endLocal.slice(0, 10);
  const today = dateOnly(now);
  const recentBoundary = addUtcDays(today, -5);
  const variables = buildHourlyVariables(levelKeys).join(",");
  const requests = [];
  const warnings = [];

  const makeParams = (rangeStart, rangeEnd) =>
    new URLSearchParams({
      latitude: Number(latitude).toFixed(5),
      longitude: Number(longitude).toFixed(5),
      start_date: rangeStart,
      end_date: rangeEnd,
      hourly: variables,
      timezone,
      wind_speed_unit: "kmh",
      cell_selection: "land",
    });

  if (startDate < recentBoundary) {
    const archiveEnd = clampDate(endDate, startDate, addUtcDays(recentBoundary, -1));
    requests.push(
      requestOpenMeteo(
        HISTORICAL_FORECAST_URL,
        makeParams(startDate, archiveEnd),
        "open-meteo-historical-forecast",
      ).catch((error) => {
        warnings.push(error.message);
        return null;
      }),
    );
  }

  if (endDate >= recentBoundary) {
    const recentStart = clampDate(startDate, recentBoundary, endDate);
    requests.push(
      requestOpenMeteo(FORECAST_URL, makeParams(recentStart, endDate), "open-meteo-best-match").catch(
        (error) => {
          warnings.push(error.message);
          return null;
        },
      ),
    );
  }

  if (!requests.length) {
    requests.push(
      requestOpenMeteo(
        HISTORICAL_FORECAST_URL,
        makeParams(startDate, endDate),
        "open-meteo-historical-forecast",
      ).catch((error) => {
        warnings.push(error.message);
        return null;
      }),
    );
  }

  let datasets = (await Promise.all(requests)).filter(Boolean);

  if (!datasets.length) {
    try {
      datasets = [
        await requestOpenMeteo(
          HISTORICAL_FORECAST_URL,
          makeParams(startDate, endDate),
          "open-meteo-historical-forecast",
        ),
      ];
    } catch (error) {
      warnings.push(error.message);
    }
  }

  if (!datasets.length) {
    throw new Error(`Dati vento non disponibili. ${warnings.join(" · ")}`.trim());
  }

  const merged = new Map();
  for (const dataset of datasets) {
    for (const row of rowsFromDataset(dataset, levelKeys)) merged.set(row.time, row);
  }

  const hours = [...merged.values()]
    .filter((row) => row.time >= startLocal && row.time <= endLocal && hasAnyLevel(row))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (!hours.length) {
    throw new Error("La sorgente non ha restituito ore valide per l'intervallo richiesto.");
  }

  const primary = datasets.at(-1);
  return {
    latitude: primary.latitude ?? Number(latitude),
    longitude: primary.longitude ?? Number(longitude),
    elevation: primary.elevation ?? null,
    timezone: primary.timezone || timezone,
    timezoneAbbreviation: primary.timezone_abbreviation || null,
    utcOffsetSeconds: primary.utc_offset_seconds ?? null,
    start: startLocal,
    end: endLocal,
    levels: Object.fromEntries(levelKeys.map((key) => [key, WIND_LEVELS[key]])),
    hours,
    sources: [...new Set(hours.map((row) => row.source))],
    warnings,
    methodology: {
      nature: "Campi di vento modellati e assimilati da osservazioni, incluse osservazioni satellitari.",
      smokeDirection: "Direzione di trasporto calcolata come opposta alla direzione meteorologica di provenienza del vento.",
      limitation:
        "Ricostruzione indicativa a punto singolo: non simula innalzamento della colonna, turbolenza, topografia fine, chimica o dispersione del fumo.",
    },
  };
}

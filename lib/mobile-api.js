import { DEFAULT_REFRESH_SECONDS, SARDINIA_BBOX } from "./config.js";

const VALID_SOURCE_GROUPS = new Set(["viirs", "modis", "all"]);
const VALID_CONFIDENCE = new Set(["high", "nominal", "low", "unknown"]);
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export class ApiInputError extends Error {
  constructor(message, { code = "invalid_request", field = null } = {}) {
    super(message);
    this.name = "ApiInputError";
    this.code = code;
    this.field = field;
  }
}

export function buildRegionConfig({ firmsConfigured = false } = {}) {
  return {
    api_version: "1.0",
    region_id: "sardinia",
    name: "Sardegna",
    primary_language: "it",
    timezone: "Europe/Rome",
    center: {
      latitude: 40.02,
      longitude: 9.05,
      zoom: 7,
    },
    bounds: {
      west: SARDINIA_BBOX.west,
      south: SARDINIA_BBOX.south,
      east: SARDINIA_BBOX.east,
      north: SARDINIA_BBOX.north,
    },
    refresh_seconds: DEFAULT_REFRESH_SECONDS,
    capabilities: {
      thermal_detections: firmsConfigured,
      wind_layer: true,
      cloud_layer: true,
      smoke_context: false,
      device_registration: false,
      background_push: false,
      historical_playback: false,
    },
    sources: [
      {
        id: "nasa-firms",
        name: "NASA FIRMS",
        role: "Rilevazioni termiche satellitari quasi in tempo reale",
        nature: "observed",
        enabled: firmsConfigured,
        attribution: "NASA FIRMS",
        information_url: "https://firms.modaps.eosdis.nasa.gov/",
      },
      {
        id: "open-meteo",
        name: "Open-Meteo",
        role: "Vento e copertura nuvolosa modellati",
        nature: "modelled",
        enabled: true,
        attribution: "Open-Meteo",
        information_url: "https://open-meteo.com/",
      },
      {
        id: "copernicus-effis",
        name: "Copernicus EFFIS",
        role: "Layer cartografici contestuali",
        nature: "mixed",
        enabled: true,
        attribution: "Copernicus EFFIS / European Commission",
        information_url: "https://forest-fire.emergency.copernicus.eu/",
      },
    ],
    service_notice:
      "Le rilevazioni termiche non equivalgono automaticamente a incendi confermati. I dati possono essere incompleti, ritardati o modellati e non sostituiscono le indicazioni delle autorita competenti.",
  };
}

function parseInteger(value, { field, minimum, maximum, fallback }) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiInputError(`${field} deve essere compreso tra ${minimum} e ${maximum}.`, {
      field,
    });
  }
  return parsed;
}

function parseBbox(value) {
  if (value === undefined || value === null || value === "") return null;
  const parts = String(value)
    .split(",")
    .map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 4 || !parts.every(Number.isFinite)) {
    throw new ApiInputError("bbox deve avere il formato west,south,east,north.", {
      field: "bbox",
    });
  }

  const [west, south, east, north] = parts;
  if (east <= west || north <= south) {
    throw new ApiInputError("bbox contiene limiti geografici non validi.", { field: "bbox" });
  }

  const clamped = {
    west: Math.max(west, SARDINIA_BBOX.west),
    south: Math.max(south, SARDINIA_BBOX.south),
    east: Math.min(east, SARDINIA_BBOX.east),
    north: Math.min(north, SARDINIA_BBOX.north),
  };

  if (clamped.east <= clamped.west || clamped.north <= clamped.south) {
    throw new ApiInputError("bbox non interseca l'area supportata.", { field: "bbox" });
  }
  return clamped;
}

function parseConfidence(value) {
  if (value === undefined || value === null || value === "") {
    return new Set(VALID_CONFIDENCE);
  }
  const values = String(value)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (!values.length || values.some((entry) => !VALID_CONFIDENCE.has(entry))) {
    throw new ApiInputError(
      "confidence accetta high, nominal, low e unknown separati da virgola.",
      { field: "confidence" },
    );
  }
  return new Set(values);
}

export function decodeCursor(value) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (
      decoded?.v !== 1 ||
      typeof decoded?.observed_at !== "string" ||
      Number.isNaN(new Date(decoded.observed_at).getTime()) ||
      typeof decoded?.id !== "string" ||
      !decoded.id
    ) {
      throw new Error("invalid cursor payload");
    }
    return decoded;
  } catch {
    throw new ApiInputError("cursor non valido.", { field: "cursor" });
  }
}

export function encodeCursor(event) {
  return Buffer.from(
    JSON.stringify({ v: 1, observed_at: event.observed_at, id: event.id }),
    "utf8",
  ).toString("base64url");
}

export function parseEventsQuery(query = {}) {
  const sourceGroup = String(query.sources || "viirs").toLowerCase();
  if (!VALID_SOURCE_GROUPS.has(sourceGroup)) {
    throw new ApiInputError("sources accetta viirs, modis oppure all.", { field: "sources" });
  }

  return {
    days: parseInteger(query.days, { field: "days", minimum: 1, maximum: 5, fallback: 1 }),
    sourceGroup,
    limit: parseInteger(query.limit, {
      field: "limit",
      minimum: 1,
      maximum: MAX_LIMIT,
      fallback: DEFAULT_LIMIT,
    }),
    bbox: parseBbox(query.bbox),
    confidence: parseConfidence(query.confidence),
    cursor: decodeCursor(query.cursor),
  };
}

function isInBounds(event, bounds) {
  if (!bounds) return true;
  const [longitude, latitude] = event.geometry.coordinates;
  return (
    longitude >= bounds.west &&
    longitude <= bounds.east &&
    latitude >= bounds.south &&
    latitude <= bounds.north
  );
}

function isAfterCursor(event, cursor) {
  if (!cursor) return true;
  const eventTime = new Date(event.observed_at).getTime();
  const cursorTime = new Date(cursor.observed_at).getTime();
  if (eventTime < cursorTime) return true;
  if (eventTime > cursorTime) return false;
  return event.id < cursor.id;
}

function compareEvents(first, second) {
  const timeDifference =
    new Date(second.observed_at).getTime() - new Date(first.observed_at).getTime();
  if (timeDifference !== 0) return timeDifference;
  return second.id.localeCompare(first.id);
}

function nullableNumber(value) {
  return Number.isFinite(value) ? value : null;
}

export function toMobileEvent(fire, generatedAt = new Date().toISOString()) {
  const ingestedAt = fire.ingestedAt || generatedAt;
  const confidenceScore = fire.confidence === "unknown" ? null : nullableNumber(fire.confidenceScore);

  return {
    id: `firms-${fire.id}`,
    region_id: "sardinia",
    type: "thermal_detection",
    status: "detection",
    nature: "observed",
    geometry: {
      type: "Point",
      coordinates: [fire.longitude, fire.latitude],
    },
    observed_at: fire.observedAt,
    ingested_at: ingestedAt,
    updated_at: fire.updatedAt || fire.observedAt,
    age_minutes: nullableNumber(fire.ageMinutes),
    confidence: {
      level: fire.confidence || "unknown",
      score: confidenceScore,
      method: "Valore della sorgente normalizzato per la visualizzazione.",
    },
    source: {
      provider: "NASA FIRMS",
      product: fire.source,
      satellite: fire.satellite || null,
      instrument: fire.instrument || null,
      information_url: "https://firms.modaps.eosdis.nasa.gov/",
    },
    measurements: {
      fire_radiative_power_mw: nullableNumber(fire.frp),
      brightness_temperature_k: nullableNumber(fire.brightness),
      scan_km: nullableNumber(fire.scan),
      track_km: nullableNumber(fire.track),
      day_night: fire.dayNight || null,
    },
    trust: {
      official_confirmation: false,
      history_persisted: false,
      statement:
        "Rilevazione termica satellitare; non equivale automaticamente a un incendio confermato.",
    },
    attribution: "NASA FIRMS",
    links: {
      detail: `/v1/events/firms-${fire.id}`,
    },
  };
}

export function listMobileEvents({ fires, generatedAt, query = {} }) {
  const parsed = parseEventsQuery(query);
  const events = fires
    .map((fire) => toMobileEvent(fire, generatedAt))
    .filter((event) => parsed.confidence.has(event.confidence.level))
    .filter((event) => isInBounds(event, parsed.bbox))
    .sort(compareEvents)
    .filter((event) => isAfterCursor(event, parsed.cursor));

  const page = events.slice(0, parsed.limit);
  const hasMore = events.length > page.length;
  const nextCursor = hasMore && page.length ? encodeCursor(page.at(-1)) : null;

  return {
    api_version: "1.0",
    region_id: "sardinia",
    generated_at: generatedAt,
    query: {
      days: parsed.days,
      sources: parsed.sourceGroup,
      confidence: [...parsed.confidence],
      bbox: parsed.bbox,
      limit: parsed.limit,
    },
    data: page,
    pagination: {
      count: page.length,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  };
}

export function findMobileEvent({ fires, id, generatedAt }) {
  const normalizedId = String(id || "");
  const fireId = normalizedId.startsWith("firms-") ? normalizedId.slice(6) : normalizedId;
  const fire = fires.find((candidate) => candidate.id === fireId);
  return fire ? toMobileEvent(fire, generatedAt) : null;
}

export function apiErrorBody(error) {
  if (error instanceof ApiInputError) {
    return {
      status: 400,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: {
        code: "internal_error",
        message: "Errore interno del servizio.",
      },
    },
  };
}

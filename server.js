import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { TtlCache } from "./lib/cache.js";
import {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_REFRESH_SECONDS,
  FIRMS_SOURCES,
  SARDINIA_BBOX,
} from "./lib/config.js";
import { fetchFirmsFires } from "./lib/firms.js";
import { fetchWindHistory } from "./lib/wind.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const app = express();
const cache = new TtlCache();
const port = Number.parseInt(process.env.PORT || "3000", 10);
const cacheTtlMs = Number.parseInt(process.env.CACHE_TTL_MS || String(DEFAULT_CACHE_TTL_MS), 10);
const firmsMapKey = String(process.env.FIRMS_MAP_KEY || "").trim();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, now: new Date().toISOString() });
});

app.get("/api/status", (_request, response) => {
  response.set("Cache-Control", "no-store");
  response.json({
    ok: true,
    mode: firmsMapKey ? "full" : "effis-only",
    firmsConfigured: Boolean(firmsMapKey),
    refreshSeconds: DEFAULT_REFRESH_SECONDS,
    bbox: SARDINIA_BBOX,
    sources: {
      effis: true,
      firms: Boolean(firmsMapKey),
      weather: true,
      windHistory: true,
    },
  });
});

app.get("/api/fires", async (request, response) => {
  response.set("Cache-Control", "no-store");

  const requestedDays = Number.parseInt(String(request.query.days || "1"), 10);
  const days = Number.isInteger(requestedDays) ? Math.min(5, Math.max(1, requestedDays)) : 1;
  const sourceGroup = String(request.query.sources || "viirs").toLowerCase();
  const sources = FIRMS_SOURCES[sourceGroup] || FIRMS_SOURCES.viirs;

  if (!firmsMapKey) {
    return response.json({
      ok: true,
      mode: "effis-only",
      configured: false,
      generatedAt: new Date().toISOString(),
      refreshSeconds: DEFAULT_REFRESH_SECONDS,
      fires: [],
      stats: {
        total: 0,
        highConfidence: 0,
        urgent: 0,
        maxFrp: null,
        averageFrp: null,
        latestObservation: null,
      },
      sourceStatus: [],
      message:
        "La mappa EFFIS e i layer di rischio sono attivi. Configura FIRMS_MAP_KEY per punti interattivi, conteggi e notifiche di prossimita.",
    });
  }

  const cacheKey = `fires:${sourceGroup}:${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return response.json({ ...cached, cached: true });

  try {
    const result = await fetchFirmsFires({ mapKey: firmsMapKey, sources, days });
    const payload = {
      ok: true,
      mode: "full",
      configured: true,
      generatedAt: new Date().toISOString(),
      refreshSeconds: DEFAULT_REFRESH_SECONDS,
      query: { days, sourceGroup, sources },
      ...result,
    };
    cache.set(cacheKey, payload, cacheTtlMs);
    return response.json({ ...payload, cached: false });
  } catch (error) {
    console.error("FIRMS request failed:", error);
    return response.status(502).json({
      ok: false,
      configured: true,
      error: "Impossibile aggiornare il feed NASA FIRMS in questo momento.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

app.get("/api/weather", async (request, response) => {
  const latitude = Number.parseFloat(String(request.query.lat || ""));
  const longitude = Number.parseFloat(String(request.query.lon || ""));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return response.status(400).json({ ok: false, error: "Coordinate non valide." });
  }

  const insideExtendedBox =
    latitude >= SARDINIA_BBOX.south - 0.5 &&
    latitude <= SARDINIA_BBOX.north + 0.5 &&
    longitude >= SARDINIA_BBOX.west - 0.5 &&
    longitude <= SARDINIA_BBOX.east + 0.5;
  if (!insideExtendedBox) {
    return response.status(400).json({ ok: false, error: "Coordinate fuori dall'area supportata." });
  }

  const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached) return response.json({ ...cached, cached: true });

  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current:
      "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code",
    daily: "temperature_2m_max,relative_humidity_2m_min,wind_gusts_10m_max",
    forecast_days: "2",
    timezone: "Europe/Rome",
  });

  try {
    const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) throw new Error(`Open-Meteo HTTP ${upstream.status}`);
    const data = await upstream.json();
    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      current: data.current ?? null,
      currentUnits: data.current_units ?? null,
      daily: data.daily ?? null,
      dailyUnits: data.daily_units ?? null,
    };
    cache.set(cacheKey, payload, 10 * 60_000);
    return response.json({ ...payload, cached: false });
  } catch (error) {
    console.error("Weather request failed:", error);
    return response.status(502).json({ ok: false, error: "Meteo locale temporaneamente non disponibile." });
  }
});

app.get("/api/wind-history", async (request, response) => {
  response.set("Cache-Control", "no-store");
  const latitude = Number.parseFloat(String(request.query.lat || ""));
  const longitude = Number.parseFloat(String(request.query.lon || ""));
  const startAt = String(request.query.start || "").trim();

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Number.isNaN(new Date(startAt).getTime())) {
    return response.status(400).json({ ok: false, error: "Coordinate o data iniziale non valide." });
  }

  const insideExtendedBox =
    latitude >= SARDINIA_BBOX.south - 0.5 &&
    latitude <= SARDINIA_BBOX.north + 0.5 &&
    longitude >= SARDINIA_BBOX.west - 0.5 &&
    longitude <= SARDINIA_BBOX.east + 0.5;
  if (!insideExtendedBox) {
    return response.status(400).json({ ok: false, error: "Coordinate fuori dall'area supportata." });
  }

  const cacheKey = `wind:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${startAt.slice(0, 13)}`;
  const cached = cache.get(cacheKey);
  if (cached) return response.json({ ...cached, cached: true });

  try {
    const wind = await fetchWindHistory({ latitude, longitude, startAt });
    const payload = { ok: true, generatedAt: new Date().toISOString(), ...wind };
    cache.set(cacheKey, payload, 20 * 60_000);
    return response.json({ ...payload, cached: false });
  } catch (error) {
    console.error("Wind history request failed:", error);
    return response.status(502).json({
      ok: false,
      error: "Storico del vento temporaneamente non disponibile.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

app.use(
  express.static(publicDir, {
    etag: true,
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    setHeaders(response, filePath) {
      if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
        response.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

app.get("/{*splat}", (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Sardegna FireWatch disponibile su http://localhost:${port}`);
  console.log(`Modalita feed: ${firmsMapKey ? "EFFIS + NASA FIRMS" : "EFFIS (FIRMS_MAP_KEY non configurata)"}`);
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { AlertMonitor } from "./lib/alert-monitor.js";
import { AlertStore } from "./lib/alert-store.js";
import { isExpoPushToken, parseWatchArea } from "./lib/alerts.js";
import { TtlCache } from "./lib/cache.js";
import {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_REFRESH_SECONDS,
  FIRMS_SOURCES,
  SARDINIA_BBOX,
} from "./lib/config.js";
import { fetchFirmsFires } from "./lib/firms.js";
import { fetchCloudForecast } from "./lib/cloud.js";
import { sendExpoPushNotifications } from "./lib/expo-push.js";
import {
  buildOpenMeteoForecastUrl,
  publicOpenMeteoStatus,
} from "./lib/open-meteo.js";
import {
  buildWindGridPoints,
  fetchCurrentWindGrid,
  fetchWindHistory,
} from "./lib/wind.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const app = express();
const cache = new TtlCache();
const port = Number.parseInt(process.env.PORT || "3000", 10);
const cacheTtlMs = Number.parseInt(process.env.CACHE_TTL_MS || String(DEFAULT_CACHE_TTL_MS), 10);
const firmsMapKey = String(process.env.FIRMS_MAP_KEY || "").trim();
const weatherService = publicOpenMeteoStatus();
const weatherConfigured = !weatherService.commercialRequired || weatherService.commercialReady;
const alertStorePath =
  process.env.ALERT_STORE_PATH || path.join(__dirname, ".data", "alerts.json");
const expoAccessToken = String(process.env.EXPO_ACCESS_TOKEN || "").trim();
const alertMonitorIntervalMs = Math.max(
  60_000,
  Number.parseInt(process.env.ALERT_MONITOR_INTERVAL_MS || "300000", 10) || 300_000,
);
const alertStore = new AlertStore({ filePath: alertStorePath });
const alertMonitor = new AlertMonitor({
  store: alertStore,
  accessToken: expoAccessToken,
  intervalMs: alertMonitorIntervalMs,
  fetchFires: async () => {
    if (!firmsMapKey) return [];
    const result = await fetchFirmsFires({
      mapKey: firmsMapKey,
      sources: FIRMS_SOURCES.viirs,
      days: 1,
    });
    return result.fires;
  },
});
const alertMutationWindows = new Map();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: false,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use((_request, response, next) => {
  response.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://sabetta-works.onrender.com https://sabetta-works.area-di-lavo-7588.chatgpt.site",
  );
  next();
});

function alertMutationRateLimit(request, response, next) {
  const now = Date.now();
  const key = request.ip || "unknown";
  const current = (alertMutationWindows.get(key) || []).filter(
    (timestamp) => now - timestamp < 60_000,
  );
  if (current.length >= 20) {
    response.set("Retry-After", "60");
    return response.status(429).json({
      ok: false,
      error: "Troppe richieste. Attendi un minuto e riprova.",
    });
  }
  current.push(now);
  alertMutationWindows.set(key, current);
  return next();
}

function bearerSecret(request) {
  const authorization = String(request.get("authorization") || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function alertServiceUnavailable(response) {
  return response.status(503).json({
    ok: false,
    error: "Il servizio di notifiche non e ancora disponibile.",
  });
}

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
    weatherService,
    alerts: {
      available: Boolean(firmsMapKey),
      checkIntervalSeconds: Math.round(alertMonitorIntervalMs / 1000),
      persistentStorageConfigured: Boolean(process.env.ALERT_STORE_PATH),
    },
    sources: {
      effis: true,
      firms: Boolean(firmsMapKey),
      weather: weatherConfigured,
      windMap: weatherConfigured,
      windHistory: weatherConfigured,
      cloudForecast: weatherConfigured,
      alerts: Boolean(firmsMapKey),
    },
  });
});

app.post(
  "/api/alerts/subscriptions",
  alertMutationRateLimit,
  async (request, response) => {
    if (!firmsMapKey) return alertServiceUnavailable(response);
    const expoPushToken = String(request.body?.expoPushToken || "").trim();
    const watchArea = parseWatchArea(request.body?.watchArea);
    if (!isExpoPushToken(expoPushToken) || !watchArea) {
      return response.status(400).json({
        ok: false,
        error: "Token di notifica o zona monitorata non validi.",
      });
    }
    const created = await alertStore.createSubscription({ expoPushToken, watchArea });
    response.set("Cache-Control", "no-store");
    return response.status(201).json({ ok: true, ...created });
  },
);

app.patch(
  "/api/alerts/subscriptions/:subscriptionId",
  alertMutationRateLimit,
  async (request, response) => {
    const secret = bearerSecret(request);
    const expoPushToken = request.body?.expoPushToken
      ? String(request.body.expoPushToken).trim()
      : null;
    const watchArea = request.body?.watchArea
      ? parseWatchArea(request.body.watchArea)
      : null;
    if (!secret || (expoPushToken && !isExpoPushToken(expoPushToken)) || (!expoPushToken && !watchArea)) {
      return response.status(400).json({ ok: false, error: "Aggiornamento non valido." });
    }
    const subscription = await alertStore.updateSubscription(
      request.params.subscriptionId,
      secret,
      { expoPushToken, watchArea },
    );
    if (!subscription) {
      return response.status(404).json({ ok: false, error: "Registrazione non trovata." });
    }
    response.set("Cache-Control", "no-store");
    return response.json({ ok: true, subscription });
  },
);

app.delete(
  "/api/alerts/subscriptions/:subscriptionId",
  alertMutationRateLimit,
  async (request, response) => {
    const secret = bearerSecret(request);
    if (!secret) {
      return response.status(400).json({ ok: false, error: "Autorizzazione mancante." });
    }
    const deleted = await alertStore.deleteSubscription(
      request.params.subscriptionId,
      secret,
    );
    if (!deleted) {
      return response.status(404).json({ ok: false, error: "Registrazione non trovata." });
    }
    return response.status(204).end();
  },
);

app.post(
  "/api/alerts/subscriptions/:subscriptionId/test",
  alertMutationRateLimit,
  async (request, response) => {
    if (!firmsMapKey) return alertServiceUnavailable(response);
    const subscription = await alertStore.getAuthorizedSubscription(
      request.params.subscriptionId,
      bearerSecret(request),
    );
    if (!subscription) {
      return response.status(404).json({ ok: false, error: "Registrazione non trovata." });
    }
    if (
      subscription.lastTestAt &&
      Date.now() - new Date(subscription.lastTestAt).getTime() < 60_000
    ) {
      response.set("Retry-After", "60");
      return response.status(429).json({
        ok: false,
        error: "Attendi un minuto prima di inviare un'altra prova.",
      });
    }
    const [ticket] = await sendExpoPushNotifications(
      [
        {
          to: subscription.expoPushToken,
          sound: "default",
          title: "Sabetta Piro — notifiche attive",
          body: "La zona monitorata e collegata correttamente. Riceverai avvisi per nuove rilevazioni satellitari compatibili.",
          data: { type: "alert-test" },
          priority: "high",
          ttl: 600,
        },
      ],
      { accessToken: expoAccessToken },
    );
    if (ticket?.status !== "ok") {
      if (ticket?.details?.error === "DeviceNotRegistered") {
        await alertStore.deactivateSubscription(subscription.id);
      }
      return response.status(502).json({
        ok: false,
        error: "Expo non ha accettato la notifica di prova.",
      });
    }
    await alertStore.recordTest(subscription.id, new Date().toISOString());
    return response.json({ ok: true });
  },
);

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
    const upstream = await fetch(buildOpenMeteoForecastUrl(params), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) throw new Error(`Open-Meteo HTTP ${upstream.status}`);
    const data = await upstream.json();
    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      source: "Open-Meteo",
      sourceMode: weatherService.mode,
      current: data.current ?? null,
      currentUnits: data.current_units ?? null,
      daily: data.daily ?? null,
      dailyUnits: data.daily_units ?? null,
    };
    cache.set(cacheKey, payload, 10 * 60_000);
    return response.json({ ...payload, cached: false });
  } catch (error) {
    console.error("Weather request failed:", error);
    return response.status(502).json({
      ok: false,
      error: "Meteo locale temporaneamente non disponibile.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

app.get("/api/wind-grid", async (request, response) => {
  response.set("Cache-Control", "no-store");
  const requestedBounds = {
    south: Number.parseFloat(String(request.query.south || "")),
    west: Number.parseFloat(String(request.query.west || "")),
    north: Number.parseFloat(String(request.query.north || "")),
    east: Number.parseFloat(String(request.query.east || "")),
  };
  if (
    !Object.values(requestedBounds).every(Number.isFinite) ||
    requestedBounds.north <= requestedBounds.south ||
    requestedBounds.east <= requestedBounds.west
  ) {
    return response.status(400).json({ ok: false, error: "Limiti della mappa non validi." });
  }

  const bounds = {
    south: Math.max(requestedBounds.south, SARDINIA_BBOX.south),
    west: Math.max(requestedBounds.west, SARDINIA_BBOX.west),
    north: Math.min(requestedBounds.north, SARDINIA_BBOX.north),
    east: Math.min(requestedBounds.east, SARDINIA_BBOX.east),
  };
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
    return response.json({ ok: true, generatedAt: new Date().toISOString(), samples: [] });
  }

  const rows = Math.min(5, Math.max(2, Number.parseInt(String(request.query.rows || "4"), 10) || 4));
  const columns = Math.min(6, Math.max(2, Number.parseInt(String(request.query.columns || "5"), 10) || 5));
  const cacheKey = `wind-grid:${Object.values(bounds).map((value) => value.toFixed(2)).join(":")}:${rows}:${columns}`;
  const cached = cache.get(cacheKey);
  if (cached) return response.json({ ...cached, cached: true });

  try {
    const points = buildWindGridPoints(bounds, rows, columns);
    const samples = await fetchCurrentWindGrid({ points });
    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      source: "Open-Meteo",
      sourceMode: weatherService.mode,
      units: { speed: "km/h", direction: "°" },
      bounds,
      samples,
    };
    cache.set(cacheKey, payload, 10 * 60_000);
    return response.json({ ...payload, cached: false });
  } catch (error) {
    console.error("Wind grid request failed:", error);
    return response.status(502).json({
      ok: false,
      error: "Mappa del vento temporaneamente non disponibile.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

app.get("/api/cloud-forecast", async (_request, response) => {
  response.set("Cache-Control", "no-store");
  const cacheKey = "cloud-forecast:sardinia:5x5:25h";
  const cached = cache.get(cacheKey);
  if (cached) return response.json({ ...cached, cached: true });

  try {
    const points = buildWindGridPoints(SARDINIA_BBOX, 5, 5);
    const frames = await fetchCloudForecast({ points, hours: 25 });
    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      source: "Open-Meteo",
      sourceMode: weatherService.mode,
      methodology: "Copertura nuvolosa oraria modellata; non e un'immagine satellitare osservata.",
      bounds: SARDINIA_BBOX,
      frames,
    };
    cache.set(cacheKey, payload, 20 * 60_000);
    return response.json({ ...payload, cached: false });
  } catch (error) {
    console.error("Cloud forecast request failed:", error);
    return response.status(502).json({
      ok: false,
      error: "Previsione della nuvolosita temporaneamente non disponibile.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
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
    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      sourceMode: weatherService.mode,
      ...wind,
    };
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

async function startServer() {
  await alertStore.initialize();
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Sardegna FireWatch disponibile su http://localhost:${port}`);
    console.log(
      `Modalita feed: ${
        firmsMapKey ? "EFFIS + NASA FIRMS" : "EFFIS (FIRMS_MAP_KEY non configurata)"
      }`,
    );
    console.log(
      `Modalita meteo: ${weatherService.mode}${
        weatherConfigured ? "" : " (configurazione commerciale mancante)"
      }`,
    );
    console.log(
      `Notifiche: ${
        firmsMapKey ? `controllo ogni ${Math.round(alertMonitorIntervalMs / 1000)}s` : "non attive"
      }`,
    );
  });
  alertMonitor.start();

  const stop = () => {
    alertMonitor.stop();
    server.close(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

startServer().catch((error) => {
  console.error("Avvio server fallito:", error);
  process.exitCode = 1;
});

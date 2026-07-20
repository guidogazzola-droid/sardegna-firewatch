import express from "express";
import { fetchCloudForecast } from "./cloud.js";
import {
  DEFAULT_REFRESH_SECONDS,
  FIRMS_SOURCES,
  SARDINIA_BBOX,
} from "./config.js";
import { fetchFirmsFires } from "./firms.js";
import {
  apiErrorBody,
  buildRegionConfig,
  findMobileEvent,
  listMobileEvents,
  parseEventsQuery,
} from "./mobile-api.js";
import {
  buildWindGridPoints,
  fetchCurrentWindGrid,
} from "./wind.js";

function sourceUnavailable(response) {
  return response.status(503).json({
    ok: false,
    error: {
      code: "source_not_configured",
      message: "Il feed puntuale NASA FIRMS non e configurato sul server.",
    },
  });
}

function upstreamError(response, message) {
  return response.status(502).json({
    ok: false,
    error: {
      code: "upstream_unavailable",
      message,
    },
  });
}

function parseLayerBounds(query) {
  const requested = {
    south: Number.parseFloat(String(query.south || SARDINIA_BBOX.south)),
    west: Number.parseFloat(String(query.west || SARDINIA_BBOX.west)),
    north: Number.parseFloat(String(query.north || SARDINIA_BBOX.north)),
    east: Number.parseFloat(String(query.east || SARDINIA_BBOX.east)),
  };

  if (
    !Object.values(requested).every(Number.isFinite) ||
    requested.north <= requested.south ||
    requested.east <= requested.west
  ) {
    return null;
  }

  const bounds = {
    south: Math.max(requested.south, SARDINIA_BBOX.south),
    west: Math.max(requested.west, SARDINIA_BBOX.west),
    north: Math.min(requested.north, SARDINIA_BBOX.north),
    east: Math.min(requested.east, SARDINIA_BBOX.east),
  };

  return bounds.north > bounds.south && bounds.east > bounds.west ? bounds : null;
}

export function createMobileRouter({ cache, firmsMapKey, cacheTtlMs }) {
  const router = express.Router();

  async function getFireFeed({ sourceGroup, days }) {
    const cacheKey = `fires:${sourceGroup}:${days}`;
    const cached = cache.get(cacheKey);
    if (cached) return { ...cached, cached: true };

    const result = await fetchFirmsFires({
      mapKey: firmsMapKey,
      sources: FIRMS_SOURCES[sourceGroup],
      days,
    });
    const payload = {
      ok: true,
      mode: "full",
      configured: true,
      generatedAt: new Date().toISOString(),
      refreshSeconds: DEFAULT_REFRESH_SECONDS,
      query: { days, sourceGroup, sources: FIRMS_SOURCES[sourceGroup] },
      ...result,
    };
    cache.set(cacheKey, payload, cacheTtlMs);
    return { ...payload, cached: false };
  }

  router.get("/health", (_request, response) => {
    response.set("Cache-Control", "no-store");
    response.json({
      ok: true,
      api_version: "1.0",
      now: new Date().toISOString(),
    });
  });

  router.get("/regions/sardinia/config", (_request, response) => {
    response.set("Cache-Control", "public, max-age=300");
    response.json({
      ok: true,
      data: buildRegionConfig({ firmsConfigured: Boolean(firmsMapKey) }),
    });
  });

  router.get("/events", async (request, response) => {
    response.set("Cache-Control", "no-store");

    try {
      const parsed = parseEventsQuery(request.query);
      if (!firmsMapKey) {
        const generatedAt = new Date().toISOString();
        return response.json({
          ok: true,
          availability: {
            thermal_detections: false,
            reason: "FIRMS_MAP_KEY non configurata.",
          },
          ...listMobileEvents({ fires: [], generatedAt, query: request.query }),
          source_status: [],
        });
      }

      const feed = await getFireFeed({
        sourceGroup: parsed.sourceGroup,
        days: parsed.days,
      });
      return response.json({
        ok: true,
        availability: {
          thermal_detections: true,
        },
        ...listMobileEvents({
          fires: feed.fires,
          generatedAt: feed.generatedAt,
          query: request.query,
        }),
        source_status: feed.sourceStatus,
        cached: feed.cached,
        refresh_seconds: feed.refreshSeconds,
      });
    } catch (error) {
      if (error?.name === "ApiInputError") {
        const apiError = apiErrorBody(error);
        return response.status(apiError.status).json(apiError.body);
      }
      console.error("Mobile events request failed:", error);
      return upstreamError(response, "Rilevazioni termiche temporaneamente non disponibili.");
    }
  });

  router.get("/events/:id", async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (!firmsMapKey) return sourceUnavailable(response);

    try {
      const feed = await getFireFeed({ sourceGroup: "all", days: 5 });
      const event = findMobileEvent({
        fires: feed.fires,
        id: request.params.id,
        generatedAt: feed.generatedAt,
      });
      if (!event) {
        return response.status(404).json({
          ok: false,
          error: {
            code: "event_not_found",
            message: "La rilevazione non e disponibile nell'intervallo corrente.",
          },
        });
      }
      return response.json({
        ok: true,
        api_version: "1.0",
        generated_at: feed.generatedAt,
        data: event,
        source_status: feed.sourceStatus,
        cached: feed.cached,
      });
    } catch (error) {
      console.error("Mobile event detail failed:", error);
      return upstreamError(response, "Dettaglio della rilevazione temporaneamente non disponibile.");
    }
  });

  router.get("/layers/wind", async (request, response) => {
    response.set("Cache-Control", "no-store");
    const bounds = parseLayerBounds(request.query);
    if (!bounds) {
      return response.status(400).json({
        ok: false,
        error: {
          code: "invalid_bounds",
          message: "Limiti geografici non validi o fuori dall'area supportata.",
        },
      });
    }

    const rows = Math.min(5, Math.max(2, Number.parseInt(String(request.query.rows || "4"), 10) || 4));
    const columns = Math.min(6, Math.max(2, Number.parseInt(String(request.query.columns || "5"), 10) || 5));
    const cacheKey = `wind-grid:${Object.values(bounds).map((value) => value.toFixed(2)).join(":")}:${rows}:${columns}`;
    const cached = cache.get(cacheKey);

    try {
      const payload = cached;
      let samples;
      let generatedAt;
      if (payload) {
        samples = payload.samples;
        generatedAt = payload.generatedAt;
      } else {
        const points = buildWindGridPoints(bounds, rows, columns);
        samples = await fetchCurrentWindGrid({ points });
        generatedAt = new Date().toISOString();
        cache.set(
          cacheKey,
          {
            ok: true,
            generatedAt,
            source: "Open-Meteo",
            units: { speed: "km/h", direction: "deg" },
            bounds,
            samples,
          },
          10 * 60_000,
        );
      }

      return response.json({
        ok: true,
        api_version: "1.0",
        region_id: "sardinia",
        generated_at: generatedAt,
        nature: "modelled",
        source: {
          provider: "Open-Meteo",
          attribution: "Open-Meteo",
          information_url: "https://open-meteo.com/",
        },
        methodology:
          "Campo del vento a 10 m fornito da modelli meteorologici; non e una misura diretta in ogni punto.",
        units: { speed: "km/h", direction: "degrees" },
        bounds,
        data: samples.map((sample) => ({
          latitude: sample.latitude,
          longitude: sample.longitude,
          speed: sample.speed,
          gust: sample.gust,
          direction_from: sample.directionFrom,
          direction_to: sample.directionTo,
          valid_at: sample.observedAt,
        })),
        cached: Boolean(cached),
      });
    } catch (error) {
      console.error("Mobile wind layer failed:", error);
      return upstreamError(response, "Livello del vento temporaneamente non disponibile.");
    }
  });

  router.get("/layers/clouds", async (_request, response) => {
    response.set("Cache-Control", "no-store");
    const cacheKey = "cloud-forecast:sardinia:5x5:25h";
    const cached = cache.get(cacheKey);

    try {
      let frames;
      let generatedAt;
      if (cached) {
        frames = cached.frames;
        generatedAt = cached.generatedAt;
      } else {
        const points = buildWindGridPoints(SARDINIA_BBOX, 5, 5);
        frames = await fetchCloudForecast({ points, hours: 25 });
        generatedAt = new Date().toISOString();
        cache.set(
          cacheKey,
          {
            ok: true,
            generatedAt,
            source: "Open-Meteo",
            methodology: "Copertura nuvolosa oraria modellata; non e un'immagine satellitare osservata.",
            bounds: SARDINIA_BBOX,
            frames,
          },
          20 * 60_000,
        );
      }

      return response.json({
        ok: true,
        api_version: "1.0",
        region_id: "sardinia",
        generated_at: generatedAt,
        nature: "modelled",
        source: {
          provider: "Open-Meteo",
          attribution: "Open-Meteo",
          information_url: "https://open-meteo.com/",
        },
        methodology: "Copertura nuvolosa oraria modellata; non e un'immagine satellitare osservata.",
        bounds: SARDINIA_BBOX,
        data: frames.map((frame) => ({
          valid_at: frame.time,
          average_cover_percent: frame.averageCover,
          samples: frame.samples.map((sample) => ({
            latitude: sample.latitude,
            longitude: sample.longitude,
            cover_percent: sample.cover,
            low_percent: sample.low,
            mid_percent: sample.mid,
            high_percent: sample.high,
          })),
        })),
        cached: Boolean(cached),
      });
    } catch (error) {
      console.error("Mobile cloud layer failed:", error);
      return upstreamError(response, "Livello della nuvolosita temporaneamente non disponibile.");
    }
  });

  return router;
}

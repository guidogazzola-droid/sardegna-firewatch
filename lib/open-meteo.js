const DEFAULT_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const CUSTOMER_HOST = "customer-api.open-meteo.com";

function cleanText(value) {
  return String(value ?? "").trim();
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(cleanText(value).toLowerCase());
}

export function openMeteoConfiguration(env = process.env) {
  const forecastUrl = cleanText(env.OPEN_METEO_FORECAST_URL) || DEFAULT_FORECAST_URL;
  const apiKey = cleanText(env.OPEN_METEO_API_KEY);
  const requireCommercial = truthy(env.OPEN_METEO_REQUIRE_COMMERCIAL);

  let parsed;
  try {
    parsed = new URL(forecastUrl);
  } catch {
    throw new Error("OPEN_METEO_FORECAST_URL non e un URL valido.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("OPEN_METEO_FORECAST_URL deve usare HTTPS.");
  }

  const customerEndpoint = parsed.hostname === CUSTOMER_HOST;
  const commercialReady = customerEndpoint && Boolean(apiKey);

  return {
    forecastUrl: parsed.toString(),
    apiKey,
    requireCommercial,
    customerEndpoint,
    commercialReady,
    mode: commercialReady ? "commercial" : "evaluation",
  };
}

export function buildOpenMeteoForecastUrl(params, env = process.env) {
  const configuration = openMeteoConfiguration(env);
  if (configuration.requireCommercial && !configuration.commercialReady) {
    throw new Error(
      "Open-Meteo commerciale non configurato: usa customer-api.open-meteo.com e OPEN_METEO_API_KEY.",
    );
  }

  const url = new URL(configuration.forecastUrl);
  const searchParams = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  for (const [key, value] of searchParams.entries()) {
    url.searchParams.set(key, value);
  }
  if (configuration.apiKey) url.searchParams.set("apikey", configuration.apiKey);
  return url;
}

export function publicOpenMeteoStatus(env = process.env) {
  const configuration = openMeteoConfiguration(env);
  return {
    provider: "Open-Meteo",
    mode: configuration.mode,
    commercialReady: configuration.commercialReady,
    commercialRequired: configuration.requireCommercial,
  };
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenMeteoForecastUrl,
  openMeteoConfiguration,
  publicOpenMeteoStatus,
} from "../lib/open-meteo.js";

test("Open-Meteo defaults to evaluation mode without exposing a key", () => {
  const configuration = openMeteoConfiguration({});
  assert.equal(configuration.mode, "evaluation");
  assert.equal(configuration.commercialReady, false);

  const url = buildOpenMeteoForecastUrl(
    new URLSearchParams({ latitude: "40", longitude: "9" }),
    {},
  );
  assert.equal(url.hostname, "api.open-meteo.com");
  assert.equal(url.searchParams.get("apikey"), null);
});

test("customer endpoint and API key enable commercial mode", () => {
  const env = {
    OPEN_METEO_FORECAST_URL: "https://customer-api.open-meteo.com/v1/forecast",
    OPEN_METEO_API_KEY: "example-key",
    OPEN_METEO_REQUIRE_COMMERCIAL: "true",
  };
  const configuration = openMeteoConfiguration(env);
  assert.equal(configuration.commercialReady, true);
  assert.equal(configuration.mode, "commercial");

  const url = buildOpenMeteoForecastUrl({ latitude: "40", longitude: "9" }, env);
  assert.equal(url.hostname, "customer-api.open-meteo.com");
  assert.equal(url.searchParams.get("apikey"), "example-key");
  assert.equal(publicOpenMeteoStatus(env).commercialReady, true);
});

test("commercial release guard rejects the public evaluation endpoint", () => {
  assert.throws(
    () =>
      buildOpenMeteoForecastUrl(
        { latitude: "40", longitude: "9" },
        {
          OPEN_METEO_FORECAST_URL: "https://api.open-meteo.com/v1/forecast",
          OPEN_METEO_REQUIRE_COMMERCIAL: "true",
        },
      ),
    /commerciale non configurato/,
  );
});

test("Open-Meteo endpoint must use HTTPS", () => {
  assert.throws(
    () =>
      openMeteoConfiguration({
        OPEN_METEO_FORECAST_URL: "http://customer-api.open-meteo.com/v1/forecast",
        OPEN_METEO_API_KEY: "example-key",
      }),
    /HTTPS/,
  );
});

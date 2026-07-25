import assert from "node:assert/strict";
import test from "node:test";
import {
  localizedMessage,
  localizedTerritoryName,
  normalizeLanguage,
} from "../lib/i18n.js";

test("supported languages are normalized from app and HTTP locales", () => {
  assert.equal(normalizeLanguage("fr-CH"), "fr");
  assert.equal(normalizeLanguage("es-ES, de;q=0.8"), "de");
  assert.equal(normalizeLanguage("unknown"), "it");
});

test("notification messages are localized and interpolate values", () => {
  assert.equal(localizedMessage("en", "manyDetections", { count: 3 }), "3 new detections");
  assert.match(
    localizedMessage("fr", "detectionBody", {
      countText: "Une nouvelle détection",
      distance: 7,
    }),
    /7 km/,
  );
  assert.match(localizedMessage("de", "testTitle"), /Benachrichtigungen aktiv/);
});

test("territory names are localized from their country codes", () => {
  assert.equal(
    localizedTerritoryName("fr", {
      id: "switzerland",
      countryCode: "CH",
      name: "Svizzera",
    }),
    "Suisse",
  );
  assert.equal(
    localizedTerritoryName("de", {
      id: "sardinia",
      countryCode: "IT-SAR",
      name: "Sardegna",
    }),
    "Sardinien",
  );
});

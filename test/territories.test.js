import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifyTerritoryEntitlement } from "../lib/app-store.js";
import { normalizeFireRow } from "../lib/firms.js";
import {
  getTerritory,
  isPointInTerritory,
  listTerritories,
} from "../lib/territories.js";

test("the catalog contains Sardinia plus 47 European country products", () => {
  const territories = listTerritories();
  assert.equal(territories.length, 48);
  assert.equal(territories.filter((territory) => territory.free).length, 1);
  assert.equal(
    new Set(
      territories
        .filter((territory) => territory.productId)
        .map((territory) => territory.productId),
    ).size,
    47,
  );
});

test("every country product has four App Store localizations within Apple limits", () => {
  const lines = readFileSync(
    new URL("../data/app-store-product-localizations.csv", import.meta.url),
    "utf8",
  )
    .trim()
    .split("\n");
  assert.equal(lines.length, 1 + 47 * 4);
  const localeCounts = new Map();
  for (const line of lines.slice(1)) {
    const [, locale] = line.split(",", 3);
    localeCounts.set(locale, (localeCounts.get(locale) || 0) + 1);
    const description = line.match(/,"([^"]*)"$/)?.[1];
    assert.ok(description);
    assert.ok(description.length <= 45);
  }
  assert.deepEqual(
    Object.fromEntries(localeCounts),
    { it: 47, "en-US": 47, "fr-FR": 47, "de-DE": 47 },
  );
});

test("territory boundaries distinguish Sardinia from mainland Italy", () => {
  const sardinia = getTerritory("sardinia");
  const italy = getTerritory("italy");
  assert.equal(isPointInTerritory(sardinia, 40.12, 9.01), true);
  assert.equal(isPointInTerritory(sardinia, 41.9, 12.5), false);
  assert.equal(isPointInTerritory(italy, 41.9, 12.5), true);
});

test("FIRMS normalization uses the selected country boundary", () => {
  const row = {
    latitude: "41.9",
    longitude: "12.5",
    acq_date: "2026-07-25",
    acq_time: "1200",
    confidence: "h",
    frp: "20",
  };
  assert.equal(
    normalizeFireRow(
      row,
      "VIIRS_SNPP_NRT",
      new Date("2026-07-25T13:00:00Z"),
      getTerritory("sardinia"),
    ),
    null,
  );
  assert.equal(
    normalizeFireRow(
      row,
      "VIIRS_SNPP_NRT",
      new Date("2026-07-25T13:00:00Z"),
      getTerritory("italy"),
    ).latitude,
    41.9,
  );
});

test("free territory needs no receipt and paid territories reject a missing token", async () => {
  assert.equal(
    (
      await verifyTerritoryEntitlement({
        territory: getTerritory("sardinia"),
        purchaseToken: null,
      })
    ).valid,
    true,
  );
  assert.equal(
    (
      await verifyTerritoryEntitlement({
        territory: getTerritory("switzerland"),
        purchaseToken: null,
      })
    ).valid,
    false,
  );
});

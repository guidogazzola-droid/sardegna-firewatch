import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(relativePath) {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  );
}

test("the iOS build pins the expo-iap release with the fixed Apple request bridge", () => {
  const packageJson = readJson("../mobile/package.json");
  const packageLock = readJson("../mobile/package-lock.json");

  assert.equal(packageJson.dependencies["expo-iap"], "4.7.1");
  assert.equal(
    packageLock.packages["node_modules/expo-iap"].version,
    "4.7.1",
  );
});

test("the mobile StoreKit catalog requests every configured country product", () => {
  const territorySource = readFileSync(
    new URL("../mobile/src/lib/territories.ts", import.meta.url),
    "utf8",
  );
  const contextSource = readFileSync(
    new URL("../mobile/src/context/territory.tsx", import.meta.url),
    "utf8",
  );
  const screenSource = readFileSync(
    new URL("../mobile/app/(tabs)/territories.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    territorySource,
    /CONFIGURED_COUNTRY_PRODUCT_IDS\s*=\s*COUNTRY_PRODUCT_IDS/,
  );
  assert.match(
    contextSource,
    /skus:\s*\[\.\.\.CONFIGURED_COUNTRY_PRODUCT_IDS\]/,
  );
  assert.doesNotMatch(
    contextSource,
    /skus:\s*COUNTRY_PRODUCT_IDS/,
  );
  assert.match(
    contextSource,
    /CONFIGURED_PRODUCT_ID_SET\.has\(territory\.productId\)/,
  );
  assert.match(screenSource, /t\("territories\.retry"\)/);
  assert.match(screenSource, /StoreDiagnosticCard/);
});

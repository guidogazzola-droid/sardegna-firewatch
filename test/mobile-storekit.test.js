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

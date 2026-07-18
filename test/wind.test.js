import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSmokeTrack,
  compassLabel,
  parseWindPayload,
  summarizeWind,
} from "../lib/wind.js";

test("compass labels normalize bearings", () => {
  assert.equal(compassLabel(0), "N");
  assert.equal(compassLabel(90), "E");
  assert.equal(compassLabel(225), "SO");
  assert.equal(compassLabel(360), "N");
});

test("wind summary converts wind-from into downwind smoke direction", () => {
  const summary = summarizeWind([
    { speed: 20, direction: 270, gust: 35 },
    { speed: 10, direction: 270, gust: 22 },
  ]);
  assert.equal(summary.windFromLabel, "O");
  assert.equal(summary.smokeToLabel, "E");
  assert.equal(summary.averageSpeed, 15);
  assert.equal(summary.maxGust, 35);
});

test("smoke track moves downwind", () => {
  const track = buildSmokeTrack(40, 9, [
    { time: "2026-07-18T10:00:00.000Z", speed: 20, direction: 270 },
    { time: "2026-07-18T11:00:00.000Z", speed: 20, direction: 270 },
  ]);
  assert.ok(track.at(-1)[1] > 9);
  assert.ok(Math.abs(track.at(-1)[0] - 40) < 0.02);
});

test("wind payload is filtered to the requested event interval", () => {
  const samples = parseWindPayload(
    {
      hourly: {
        time: ["2026-07-18T09:00", "2026-07-18T10:00", "2026-07-18T11:00"],
        wind_speed_10m: [8, 12, 16],
        wind_direction_10m: [90, 100, 110],
        wind_gusts_10m: [12, 18, 25],
      },
    },
    "2026-07-18T10:00:00Z",
    new Date("2026-07-18T10:30:00Z"),
  );
  assert.equal(samples.length, 1);
  assert.equal(samples[0].speed, 12);
});

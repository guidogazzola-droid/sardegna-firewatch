import test from "node:test";
import assert from "node:assert/strict";
import { buildCloudFrames } from "../lib/cloud.js";

test("cloud payload is converted into synchronized map frames", () => {
  const frames = buildCloudFrames(
    [
      {
        hourly: {
          time: ["2026-07-18T18:00", "2026-07-18T19:00"],
          cloud_cover: [20, 60],
          cloud_cover_low: [10, 30],
          cloud_cover_mid: [5, 20],
          cloud_cover_high: [8, 25],
        },
      },
      {
        hourly: {
          time: ["2026-07-18T18:00", "2026-07-18T19:00"],
          cloud_cover: [40, 80],
          cloud_cover_low: [20, 45],
          cloud_cover_mid: [10, 25],
          cloud_cover_high: [12, 35],
        },
      },
    ],
    [
      { latitude: 40, longitude: 9 },
      { latitude: 40.5, longitude: 9.5 },
    ],
  );

  assert.equal(frames.length, 2);
  assert.equal(frames[0].time, "2026-07-18T18:00:00.000Z");
  assert.equal(frames[0].averageCover, 30);
  assert.equal(frames[1].samples[1].cover, 80);
  assert.equal(frames[1].samples[1].high, 35);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  annotateEstimatedStarts,
  buildFireStats,
  classifySeverity,
  normalizeConfidence,
  normalizeFireRow,
  parseCsv,
  toObservationDate,
} from "../lib/firms.js";

test("parseCsv handles simple and quoted fields", () => {
  const rows = parseCsv('latitude,longitude,note\n40.1,9.2,"a,b"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].note, "a,b");
});

test("confidence normalization supports VIIRS and numeric values", () => {
  assert.deepEqual(normalizeConfidence("h"), { label: "high", score: 90 });
  assert.equal(normalizeConfidence("73").label, "nominal");
  assert.equal(normalizeConfidence("22").label, "low");
});

test("observation time is interpreted as UTC", () => {
  assert.equal(toObservationDate("2026-07-14", "935").toISOString(), "2026-07-14T09:35:00.000Z");
});

test("severity combines confidence and radiative power", () => {
  assert.equal(classifySeverity({ label: "high", score: 90 }, 60), "critical");
  assert.equal(classifySeverity({ label: "nominal", score: 60 }, 8), "medium");
});

test("row normalization rejects points outside Sardinia bounding box", () => {
  const outside = normalizeFireRow(
    {
      latitude: "45.0",
      longitude: "9.0",
      acq_date: "2026-07-14",
      acq_time: "1200",
      confidence: "h",
      frp: "20",
    },
    "VIIRS_SNPP_NRT",
    new Date("2026-07-14T13:00:00Z"),
  );
  assert.equal(outside, null);
});

test("fire stats aggregate normalized detections", () => {
  const stats = buildFireStats([
    { confidence: "high", severity: "critical", frp: 50, observedAt: "2026-07-14T12:00:00Z" },
    { confidence: "nominal", severity: "medium", frp: 10, observedAt: "2026-07-14T11:00:00Z" },
  ]);
  assert.equal(stats.total, 2);
  assert.equal(stats.highConfidence, 1);
  assert.equal(stats.maxFrp, 50);
});

test("event start is estimated from nearby satellite detections", () => {
  const fires = annotateEstimatedStarts([
    { latitude: 40, longitude: 9, observedAt: "2026-07-18T12:00:00Z" },
    { latitude: 40.01, longitude: 9.01, observedAt: "2026-07-18T09:00:00Z" },
    { latitude: 41, longitude: 10, observedAt: "2026-07-18T07:00:00Z" },
  ]);
  assert.equal(fires[0].estimatedStartAt, "2026-07-18T09:00:00.000Z");
  assert.equal(fires[2].estimatedStartAt, "2026-07-18T07:00:00.000Z");
});

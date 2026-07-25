import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AlertMonitor } from "../lib/alert-monitor.js";
import { AlertStore } from "../lib/alert-store.js";
import {
  distanceKm,
  eligibleFiresForSubscription,
  isExpoPushToken,
  parseWatchArea,
} from "../lib/alerts.js";

const WATCH_AREA = {
  id: "primary",
  name: "La mia posizione",
  latitude: 40.92,
  longitude: 9.5,
  radiusKm: 25,
  createdAt: "2026-07-24T18:00:00.000Z",
  updatedAt: "2026-07-24T18:00:00.000Z",
};

async function temporaryStore(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sabetta-alerts-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new AlertStore({ filePath: path.join(directory, "alerts.json") });
  await store.initialize();
  return store;
}

test("watch areas and Expo push tokens are validated", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[abc_123-XYZ]"), true);
  assert.equal(isExpoPushToken("not-a-token"), false);
  assert.equal(parseWatchArea(WATCH_AREA).radiusKm, 25);
  assert.equal(parseWatchArea({ ...WATCH_AREA, latitude: 45 }), null);
  assert.ok(distanceKm(WATCH_AREA, { latitude: 40.93, longitude: 9.5 }) < 2);
});

test("alert store requires the device secret and deletes all registration data", async (t) => {
  const store = await temporaryStore(t);
  const created = await store.createSubscription({
    expoPushToken: "ExponentPushToken[abc]",
    watchArea: WATCH_AREA,
  });
  assert.equal((await store.listActiveSubscriptions()).length, 1);
  assert.equal(
    await store.getAuthorizedSubscription(created.subscription.id, "wrong"),
    null,
  );
  assert.equal(
    (
      await store.getAuthorizedSubscription(
        created.subscription.id,
        created.secret,
      )
    ).watchArea.radiusKm,
    25,
  );
  assert.equal(
    (
      await store.getAuthorizedSubscription(
        created.subscription.id,
        created.secret,
      )
    ).language,
    "it",
  );
  assert.equal(
    await store.deleteSubscription(created.subscription.id, created.secret),
    true,
  );
  assert.equal((await store.listActiveSubscriptions()).length, 0);
});

test("inactive device registrations are purged after the retention period", async (t) => {
  const store = await temporaryStore(t);
  const created = await store.createSubscription({
    expoPushToken: "ExponentPushToken[abc]",
    watchArea: WATCH_AREA,
  });
  await store.deactivateSubscription(created.subscription.id);
  const removed = await store.purgeInactiveSubscriptions(
    new Date(Date.now() + 31 * 24 * 60 * 60_000).toISOString(),
  );
  assert.equal(removed, 1);
  assert.equal((await store.listActiveSubscriptions()).length, 0);
});

test("eligible detections exclude old, low-confidence, distant, and seen events", () => {
  const now = new Date("2026-07-24T19:00:00.000Z");
  const subscription = {
    createdAt: "2026-07-24T18:00:00.000Z",
    watchArea: WATCH_AREA,
    seenFireIds: ["seen"],
  };
  const base = {
    latitude: 40.93,
    longitude: 9.5,
    observedAt: "2026-07-24T18:30:00.000Z",
    confidence: "nominal",
    severity: "medium",
    frp: 12,
  };
  const eligible = eligibleFiresForSubscription(
    subscription,
    [
      { ...base, id: "new" },
      { ...base, id: "seen" },
      { ...base, id: "low", confidence: "low" },
      { ...base, id: "far", latitude: 39.5 },
      { ...base, id: "old", observedAt: "2026-07-24T12:00:00.000Z" },
    ],
    now,
  );
  assert.deepEqual(eligible.map((fire) => fire.id), ["new"]);
});

test("monitor sends one summary and records its Expo receipt", async (t) => {
  const store = await temporaryStore(t);
  await store.createSubscription({
    expoPushToken: "ExponentPushToken[abc]",
    watchArea: WATCH_AREA,
  });
  const messages = [];
  const now = new Date();
  const monitor = new AlertMonitor({
    store,
    fetchFires: async () => [
      {
        id: "fire-1",
        latitude: 40.93,
        longitude: 9.5,
        observedAt: now.toISOString(),
        confidence: "high",
        severity: "critical",
        frp: 80,
      },
    ],
    sendPush: async (nextMessages) => {
      messages.push(...nextMessages);
      return [{ status: "ok", id: "receipt-1" }];
    },
    fetchReceipts: async () => ({}),
    logger: { error() {}, warn() {} },
  });

  await monitor.runOnce(now);
  assert.equal(messages.length, 1);
  assert.match(messages[0].title, /rilevazione satellitare/);
  const subscriptions = await store.listActiveSubscriptions();
  assert.deepEqual(subscriptions[0].seenFireIds, ["fire-1"]);
  const due = await store.listDueReceipts({
    olderThan: new Date(now.getTime() + 16 * 60_000).toISOString(),
  });
  assert.deepEqual(due.map((receipt) => receipt.id), ["receipt-1"]);
});

test("monitor sends alerts in the subscription language", async (t) => {
  const store = await temporaryStore(t);
  await store.createSubscription({
    expoPushToken: "ExponentPushToken[abc]",
    watchArea: WATCH_AREA,
    language: "de",
  });
  const messages = [];
  const now = new Date();
  const monitor = new AlertMonitor({
    store,
    fetchFires: async () => [
      {
        id: "fire-de",
        latitude: 40.93,
        longitude: 9.5,
        observedAt: now.toISOString(),
        confidence: "high",
        severity: "critical",
        frp: 80,
      },
    ],
    sendPush: async (nextMessages) => {
      messages.push(...nextMessages);
      return [{ status: "ok", id: "receipt-de" }];
    },
    fetchReceipts: async () => ({}),
    logger: { error() {}, warn() {} },
  });

  await monitor.runOnce(now);
  assert.equal(messages.length, 1);
  assert.match(messages[0].title, /Satellitenerfassung/);
  assert.match(messages[0].body, /Überwachungsgebiet/);
});

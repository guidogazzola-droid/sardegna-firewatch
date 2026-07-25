import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const SCHEMA_VERSION = 1;
const MAX_SEEN_FIRE_IDS = 500;

function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    subscriptions: [],
    pendingReceipts: [],
  };
}

function clone(value) {
  return structuredClone(value);
}

function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function secretsMatch(secret, expectedHash) {
  const actual = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function publicSubscription(subscription) {
  return {
    id: subscription.id,
    watchArea: clone(subscription.watchArea),
    active: subscription.active,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    lastNotificationAt: subscription.lastNotificationAt,
  };
}

function normalizeState(value) {
  if (!value || typeof value !== "object") return emptyState();
  return {
    schemaVersion: SCHEMA_VERSION,
    subscriptions: Array.isArray(value.subscriptions) ? value.subscriptions : [],
    pendingReceipts: Array.isArray(value.pendingReceipts) ? value.pendingReceipts : [],
  };
}

export class AlertStore {
  constructor({ filePath }) {
    this.filePath = filePath;
    this.state = emptyState();
    this.queue = Promise.resolve();
  }

  async initialize() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const contents = await readFile(this.filePath, "utf8");
      this.state = normalizeState(JSON.parse(contents));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await this.#persist();
    }
  }

  async createSubscription({ expoPushToken, watchArea }) {
    return this.#mutate(async () => {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const secret = crypto.randomBytes(32).toString("base64url");
      const subscription = {
        id,
        secretHash: hashSecret(secret),
        expoPushToken,
        watchArea: clone(watchArea),
        active: true,
        createdAt: now,
        updatedAt: now,
        lastNotificationAt: null,
        lastTestAt: null,
        seenFireIds: [],
      };
      this.state.subscriptions.push(subscription);
      return {
        subscription: publicSubscription(subscription),
        secret,
      };
    });
  }

  async getAuthorizedSubscription(id, secret) {
    await this.queue;
    const subscription = this.state.subscriptions.find((candidate) => candidate.id === id);
    if (!subscription || !secretsMatch(secret, subscription.secretHash)) return null;
    return clone(subscription);
  }

  async updateSubscription(id, secret, { expoPushToken, watchArea }) {
    return this.#mutate(async () => {
      const subscription = this.state.subscriptions.find((candidate) => candidate.id === id);
      if (!subscription || !secretsMatch(secret, subscription.secretHash)) return null;
      if (expoPushToken) subscription.expoPushToken = expoPushToken;
      if (watchArea) subscription.watchArea = clone(watchArea);
      subscription.active = true;
      subscription.updatedAt = new Date().toISOString();
      return publicSubscription(subscription);
    });
  }

  async deleteSubscription(id, secret) {
    return this.#mutate(async () => {
      const index = this.state.subscriptions.findIndex((candidate) => candidate.id === id);
      if (index < 0 || !secretsMatch(secret, this.state.subscriptions[index].secretHash)) {
        return false;
      }
      this.state.subscriptions.splice(index, 1);
      this.state.pendingReceipts = this.state.pendingReceipts.filter(
        (receipt) => receipt.subscriptionId !== id,
      );
      return true;
    });
  }

  async listActiveSubscriptions() {
    await this.queue;
    return clone(this.state.subscriptions.filter((subscription) => subscription.active));
  }

  async recordDelivery(subscriptionId, { fireIds, receiptId = null, deliveredAt }) {
    return this.#mutate(async () => {
      const subscription = this.state.subscriptions.find(
        (candidate) => candidate.id === subscriptionId,
      );
      if (!subscription) return false;
      subscription.seenFireIds = [
        ...new Set([...subscription.seenFireIds, ...fireIds]),
      ].slice(-MAX_SEEN_FIRE_IDS);
      subscription.lastNotificationAt = deliveredAt;
      subscription.updatedAt = deliveredAt;
      if (receiptId) {
        this.state.pendingReceipts.push({
          id: receiptId,
          subscriptionId,
          createdAt: deliveredAt,
        });
      }
      return true;
    });
  }

  async recordTest(subscriptionId, testedAt) {
    return this.#mutate(async () => {
      const subscription = this.state.subscriptions.find(
        (candidate) => candidate.id === subscriptionId,
      );
      if (!subscription) return false;
      subscription.lastTestAt = testedAt;
      return true;
    });
  }

  async deactivateSubscription(subscriptionId) {
    return this.#mutate(async () => {
      const subscription = this.state.subscriptions.find(
        (candidate) => candidate.id === subscriptionId,
      );
      if (!subscription) return false;
      subscription.active = false;
      subscription.updatedAt = new Date().toISOString();
      return true;
    });
  }

  async listDueReceipts({ olderThan, limit = 1000 }) {
    await this.queue;
    const cutoff = new Date(olderThan).getTime();
    return clone(
      this.state.pendingReceipts
        .filter((receipt) => new Date(receipt.createdAt).getTime() <= cutoff)
        .slice(0, limit),
    );
  }

  async removeReceipts(receiptIds) {
    const ids = new Set(receiptIds);
    return this.#mutate(async () => {
      const before = this.state.pendingReceipts.length;
      this.state.pendingReceipts = this.state.pendingReceipts.filter(
        (receipt) => !ids.has(receipt.id),
      );
      return before - this.state.pendingReceipts.length;
    });
  }

  async purgeInactiveSubscriptions(olderThan) {
    const cutoff = new Date(olderThan).getTime();
    return this.#mutate(async () => {
      const removedIds = new Set(
        this.state.subscriptions
          .filter(
            (subscription) =>
              !subscription.active &&
              new Date(subscription.updatedAt).getTime() <= cutoff,
          )
          .map((subscription) => subscription.id),
      );
      if (!removedIds.size) return 0;
      this.state.subscriptions = this.state.subscriptions.filter(
        (subscription) => !removedIds.has(subscription.id),
      );
      this.state.pendingReceipts = this.state.pendingReceipts.filter(
        (receipt) => !removedIds.has(receipt.subscriptionId),
      );
      return removedIds.size;
    });
  }

  async #mutate(operation) {
    const next = this.queue.then(async () => {
      const result = await operation();
      await this.#persist();
      return result;
    });
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async #persist() {
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }
}

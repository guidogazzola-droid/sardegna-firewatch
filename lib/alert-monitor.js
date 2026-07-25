import { eligibleFiresForSubscription, distanceKm } from "./alerts.js";
import { fetchExpoPushReceipts, sendExpoPushNotifications } from "./expo-push.js";
import { localizedMessage } from "./i18n.js";

const DEFAULT_COOLDOWN_MS = 30 * 60_000;
const RECEIPT_DELAY_MS = 15 * 60_000;
const INACTIVE_RETENTION_MS = 30 * 24 * 60 * 60_000;

function roundedDistance(subscription, fire) {
  return Math.max(1, Math.round(distanceKm(subscription.watchArea, fire)));
}

function notificationMessage(subscription, fires) {
  const primary = fires[0];
  const language = subscription.language || "it";
  const countText =
    fires.length > 1
      ? localizedMessage(language, "manyDetections", { count: fires.length })
      : localizedMessage(language, "oneDetection");
  return {
    to: subscription.expoPushToken,
    sound: "default",
    title: localizedMessage(language, "detectionTitle"),
    body: localizedMessage(language, "detectionBody", {
      countText,
      distance: roundedDistance(subscription, primary),
    }),
    data: {
      type: "fire-detection",
      fireId: primary.id,
      observedAt: primary.observedAt,
    },
    priority: "high",
    ttl: 3600,
  };
}

function isDeviceNotRegistered(result) {
  return result?.details?.error === "DeviceNotRegistered";
}

export class AlertMonitor {
  constructor({
    store,
    fetchFires,
    accessToken = "",
    intervalMs = 5 * 60_000,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    sendPush = sendExpoPushNotifications,
    fetchReceipts = fetchExpoPushReceipts,
    logger = console,
  }) {
    this.store = store;
    this.fetchFires = fetchFires;
    this.accessToken = accessToken;
    this.intervalMs = intervalMs;
    this.cooldownMs = cooldownMs;
    this.sendPush = sendPush;
    this.fetchReceipts = fetchReceipts;
    this.logger = logger;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref?.();
    setTimeout(() => void this.runOnce(), 5_000).unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.store.purgeInactiveSubscriptions(
        new Date(now.getTime() - INACTIVE_RETENTION_MS).toISOString(),
      );
      await this.#checkReceipts(now);
      const subscriptions = await this.store.listActiveSubscriptions();
      if (!subscriptions.length) return;
      const fires = await this.fetchFires(subscriptions);
      const outgoing = [];

      for (const subscription of subscriptions) {
        const lastNotificationAt = subscription.lastNotificationAt
          ? new Date(subscription.lastNotificationAt).getTime()
          : 0;
        if (now.getTime() - lastNotificationAt < this.cooldownMs) continue;
        const eligible = eligibleFiresForSubscription(subscription, fires, now);
        if (!eligible.length) continue;
        outgoing.push({
          subscription,
          fires: eligible,
          message: notificationMessage(subscription, eligible),
        });
      }

      if (!outgoing.length) return;
      const tickets = await this.sendPush(
        outgoing.map((item) => item.message),
        { accessToken: this.accessToken },
      );
      for (let index = 0; index < outgoing.length; index += 1) {
        const item = outgoing[index];
        const ticket = tickets[index];
        if (ticket?.status === "ok") {
          await this.store.recordDelivery(item.subscription.id, {
            fireIds: item.fires.map((fire) => fire.id),
            receiptId: ticket.id || null,
            deliveredAt: now.toISOString(),
          });
        } else if (isDeviceNotRegistered(ticket)) {
          await this.store.deactivateSubscription(item.subscription.id);
        } else {
          this.logger.warn("Expo Push ha rifiutato un avviso", ticket);
        }
      }
    } catch (error) {
      this.logger.error("Controllo notifiche fallito:", error);
    } finally {
      this.running = false;
    }
  }

  async #checkReceipts(now) {
    const olderThan = new Date(now.getTime() - RECEIPT_DELAY_MS).toISOString();
    const pending = await this.store.listDueReceipts({ olderThan, limit: 1000 });
    if (!pending.length) return;
    const receipts = await this.fetchReceipts(
      pending.map((receipt) => receipt.id),
      { accessToken: this.accessToken },
    );
    const completed = [];
    for (const pendingReceipt of pending) {
      const receipt = receipts[pendingReceipt.id];
      if (!receipt) continue;
      completed.push(pendingReceipt.id);
      if (receipt.status === "error" && isDeviceNotRegistered(receipt)) {
        await this.store.deactivateSubscription(pendingReceipt.subscriptionId);
      } else if (receipt.status === "error") {
        this.logger.warn("Errore ricevuta Expo Push", receipt);
      }
    }
    if (completed.length) await this.store.removeReceipts(completed);
  }
}

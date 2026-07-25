import {
  DEFAULT_TERRITORY_ID,
  getTerritory,
  isPointInTerritory,
} from "./territories.js";

const TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isExpoPushToken(value) {
  return TOKEN_PATTERN.test(String(value || "").trim());
}

export function parseWatchArea(value) {
  if (!value || typeof value !== "object") return null;
  const territoryId = String(
    value.territoryId || DEFAULT_TERRITORY_ID,
  ).trim();
  const territory = getTerritory(territoryId);
  const latitude = finiteNumber(value.latitude);
  const longitude = finiteNumber(value.longitude);
  const radiusKm = finiteNumber(value.radiusKm);
  if (
    !territory ||
    latitude === null ||
    longitude === null ||
    radiusKm === null
  ) {
    return null;
  }
  if (
    !isPointInTerritory(territory, latitude, longitude) ||
    radiusKm < 5 ||
    radiusKm > 100
  ) {
    return null;
  }
  return {
    id: "primary",
    territoryId,
    name:
      typeof value.name === "string" && value.name.trim()
        ? value.name.trim().slice(0, 80)
        : "La mia posizione",
    latitude: Math.round(latitude * 100_000) / 100_000,
    longitude: Math.round(longitude * 100_000) / 100_000,
    radiusKm: Math.round(radiusKm),
    createdAt:
      typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt))
        ? value.createdAt
        : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function distanceKm(first, second) {
  const radius = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function eligibleFiresForSubscription(subscription, fires, now = new Date()) {
  const createdAt = new Date(subscription.createdAt).getTime();
  const sixHoursAgo = now.getTime() - 6 * 60 * 60_000;
  const earliest = Math.max(createdAt - 5 * 60_000, sixHoursAgo);
  const seen = new Set(subscription.seenFireIds || []);
  return fires
    .filter((fire) => {
      const observedAt = new Date(fire.observedAt).getTime();
      return (
        Number.isFinite(observedAt) &&
        observedAt >= earliest &&
        fire.confidence !== "low" &&
        fire.confidence !== "unknown" &&
        !seen.has(fire.id) &&
        distanceKm(subscription.watchArea, fire) <= subscription.watchArea.radiusKm
      );
    })
    .sort((first, second) => {
      const severity = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDelta = severity[second.severity] - severity[first.severity];
      if (severityDelta !== 0) return severityDelta;
      return (second.frp || 0) - (first.frp || 0);
    });
}

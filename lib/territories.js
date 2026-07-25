import { readFileSync } from "node:fs";

const TERRITORIES = Object.freeze(
  JSON.parse(
    readFileSync(new URL("../data/territories.json", import.meta.url), "utf8"),
  ).map((territory) => Object.freeze(territory)),
);

const TERRITORY_BY_ID = new Map(
  TERRITORIES.map((territory) => [territory.id, territory]),
);

const TERRITORY_BY_PRODUCT_ID = new Map(
  TERRITORIES.filter((territory) => territory.productId).map((territory) => [
    territory.productId,
    territory,
  ]),
);

export const DEFAULT_TERRITORY_ID = "sardinia";

export function listTerritories() {
  return TERRITORIES;
}

export function getTerritory(value = DEFAULT_TERRITORY_ID) {
  return TERRITORY_BY_ID.get(String(value || "").trim()) ?? null;
}

export function getTerritoryByProductId(value) {
  return TERRITORY_BY_PRODUCT_ID.get(String(value || "").trim()) ?? null;
}

export function publicTerritory(territory, { includeGeometry = false } = {}) {
  if (!territory) return null;
  const publicValue = {
    id: territory.id,
    countryCode: territory.countryCode,
    name: territory.name,
    free: territory.free,
    productId: territory.productId,
    bounds: territory.bounds,
    center: territory.center,
  };
  return includeGeometry
    ? { ...publicValue, geometry: territory.geometry }
    : publicValue;
}

export function isPointInTerritory(territory, latitude, longitude) {
  if (
    !territory ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < territory.queryBounds.south ||
    latitude > territory.queryBounds.north ||
    longitude < territory.queryBounds.west ||
    longitude > territory.queryBounds.east
  ) {
    return false;
  }

  const point = [longitude, latitude];
  const polygons =
    territory.geometry.type === "Polygon"
      ? [territory.geometry.coordinates]
      : territory.geometry.coordinates;
  return polygons.some((polygon) => isPointInPolygon(point, polygon));
}

function isPointInPolygon(point, polygon) {
  const [outerRing, ...holes] = polygon;
  return (
    isPointInRing(point, outerRing) &&
    !holes.some((hole) => isPointInRing(point, hole))
  );
}

function isPointInRing([longitude, latitude], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    const crosses =
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude || Number.EPSILON) +
          currentLongitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

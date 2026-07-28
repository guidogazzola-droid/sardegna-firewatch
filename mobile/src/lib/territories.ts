import territoryData from "../data/territories.json";
import type { GeoBounds } from "./types";

export interface TerritoryGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][][] | number[][][];
}

export interface Territory {
  id: string;
  countryCode: string;
  name: string;
  free: boolean;
  productId: string | null;
  bounds: GeoBounds;
  queryBounds: GeoBounds;
  center: {
    latitude: number;
    longitude: number;
  };
  geometry: TerritoryGeometry;
}

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export const TERRITORIES = territoryData as Territory[];
export const DEFAULT_TERRITORY =
  TERRITORIES.find((territory) => territory.free) ?? TERRITORIES[0];

const TERRITORY_BY_ID = new Map(
  TERRITORIES.map((territory) => [territory.id, territory]),
);
const TERRITORY_BY_PRODUCT_ID = new Map(
  TERRITORIES.filter(
    (territory): territory is Territory & { productId: string } =>
      Boolean(territory.productId),
  ).map((territory) => [territory.productId, territory]),
);

export const COUNTRY_PRODUCT_IDS = TERRITORIES.flatMap((territory) =>
  territory.productId ? [territory.productId] : [],
);

// Every paid-territory product is configured in App Store Connect.
// StoreKit still returns only products available in the current storefront.
export const CONFIGURED_COUNTRY_PRODUCT_IDS = COUNTRY_PRODUCT_IDS;

export function getTerritory(territoryId: string): Territory | null {
  return TERRITORY_BY_ID.get(territoryId) ?? null;
}

export function getTerritoryByProductId(productId: string): Territory | null {
  return TERRITORY_BY_PRODUCT_ID.get(productId) ?? null;
}

export function territoryRegion(territory: Territory) {
  const latitudeDelta = Math.max(
    0.08,
    (territory.queryBounds.north - territory.queryBounds.south) * 1.16,
  );
  const longitudeDelta = Math.max(
    0.08,
    (territory.queryBounds.east - territory.queryBounds.west) * 1.16,
  );
  return {
    latitude:
      (territory.queryBounds.south + territory.queryBounds.north) / 2,
    longitude:
      (territory.queryBounds.west + territory.queryBounds.east) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

export function territoryPolygonOutlines(
  territory: Territory,
): MapCoordinate[][] {
  const polygons =
    territory.geometry.type === "Polygon"
      ? [territory.geometry.coordinates as number[][][]]
      : (territory.geometry.coordinates as number[][][][]);
  return polygons
    .map((polygon) => polygon[0] ?? [])
    .filter((ring) => ring.length >= 3)
    .map((ring) =>
      ring.map(([longitude, latitude]) => ({ latitude, longitude })),
    );
}

export function isPointInTerritory(
  territory: Territory,
  latitude: number,
  longitude: number,
): boolean {
  if (
    latitude < territory.queryBounds.south ||
    latitude > territory.queryBounds.north ||
    longitude < territory.queryBounds.west ||
    longitude > territory.queryBounds.east
  ) {
    return false;
  }
  const point: [number, number] = [longitude, latitude];
  const polygons =
    territory.geometry.type === "Polygon"
      ? [territory.geometry.coordinates as number[][][]]
      : (territory.geometry.coordinates as number[][][][]);
  return polygons.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    return (
      isPointInRing(point, outerRing) &&
      !holes.some((hole) => isPointInRing(point, hole))
    );
  });
}

function isPointInRing(
  [longitude, latitude]: [number, number],
  ring: number[][],
): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    const crosses =
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) *
          (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude || Number.EPSILON) +
          currentLongitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

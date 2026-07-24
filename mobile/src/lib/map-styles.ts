import type { StyleSpecification } from "@maplibre/maplibre-react-native";

export type BaseMapId = "satellite" | "topographic" | "street";
export type MapStyleValue = string | StyleSpecification;

export interface BaseMapDefinition {
  id: BaseMapId;
  label: string;
  shortLabel: string;
  style: MapStyleValue;
  validationUrl: string | null;
  attribution: string;
  available: boolean;
}

const arcgisAccessToken = String(
  process.env.EXPO_PUBLIC_ARCGIS_ACCESS_TOKEN ?? "",
).trim();

export const ARCGIS_BASEMAPS_CONFIGURED = arcgisAccessToken.length > 0;

// OpenFreeMap explicitly supports MapLibre Native/mobile applications and
// commercial usage with attribution. It is used only when the ArcGIS basemap
// cannot be authorized or loaded.
export const FALLBACK_MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_FALLBACK_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

const STATIC_BASEMAP_ROOT =
  "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1";

function arcgisStaticUrls(stylePath: string): {
  tileUrl: string;
  validationUrl: string;
} {
  const tokenQuery = new URLSearchParams({ token: arcgisAccessToken }).toString();
  return {
    tileUrl: `${STATIC_BASEMAP_ROOT}/${stylePath}/static/tile/{z}/{y}/{x}?${tokenQuery}`,
    validationUrl: `${STATIC_BASEMAP_ROOT}/${stylePath}/static?f=json&${tokenQuery}`,
  };
}

function rasterStyle(
  stylePath: string,
  attribution: string,
): { style: StyleSpecification; validationUrl: string } {
  const urls = arcgisStaticUrls(stylePath);
  return {
    validationUrl: urls.validationUrl,
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: [urls.tileUrl],
          tileSize: 512,
          minzoom: 0,
          maxzoom: 22,
          attribution,
        },
      },
      layers: [
        {
          id: "basemap-background",
          type: "background",
          paint: { "background-color": "#1e2d36" },
        },
        {
          id: "basemap-raster",
          type: "raster",
          source: "basemap",
          paint: {
            "raster-opacity": 1,
            "raster-fade-duration": 0,
          },
        },
      ],
    },
  };
}

const satellite = rasterStyle(
  "open/hybrid/detail",
  "Map data © OpenStreetMap contributors, Microsoft, Esri Community Maps contributors · Map layer by Esri",
);
const topographic = rasterStyle(
  "arcgis/outdoor",
  "Powered by Esri · Esri and contributing data providers",
);
const street = rasterStyle(
  "arcgis/streets",
  "Powered by Esri · Esri and contributing data providers",
);

export const BASE_MAPS: Record<BaseMapId, BaseMapDefinition> = {
  satellite: {
    id: "satellite",
    label: "Satellite",
    shortLabel: "SAT",
    style: satellite.style,
    validationUrl: ARCGIS_BASEMAPS_CONFIGURED ? satellite.validationUrl : null,
    attribution:
      "Map data © OpenStreetMap contributors, Microsoft, Esri Community Maps contributors · Map layer by Esri",
    available: ARCGIS_BASEMAPS_CONFIGURED,
  },
  topographic: {
    id: "topographic",
    label: "Topografica",
    shortLabel: "TOPO",
    style: topographic.style,
    validationUrl: ARCGIS_BASEMAPS_CONFIGURED ? topographic.validationUrl : null,
    attribution: "Powered by Esri · Esri and contributing data providers",
    available: ARCGIS_BASEMAPS_CONFIGURED,
  },
  street: {
    id: "street",
    label: "Stradale",
    shortLabel: "STR",
    style: street.style,
    validationUrl: ARCGIS_BASEMAPS_CONFIGURED ? street.validationUrl : null,
    attribution: "Powered by Esri · Esri and contributing data providers",
    available: ARCGIS_BASEMAPS_CONFIGURED,
  },
};

export const DEFAULT_BASE_MAP_ID: BaseMapId = "satellite";
export const FALLBACK_MAP_ATTRIBUTION =
  "OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors";

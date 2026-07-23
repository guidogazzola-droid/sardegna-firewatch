import { MAP_STYLE_URL } from "./config";

export type BaseMapId = "satellite" | "topographic" | "street";

export interface BaseMapDefinition {
  id: BaseMapId;
  label: string;
  shortLabel: string;
  style: string;
  attribution: string;
  available: boolean;
}

const arcgisAccessToken = String(
  process.env.EXPO_PUBLIC_ARCGIS_ACCESS_TOKEN ?? "",
).trim();

export const ARCGIS_BASEMAPS_CONFIGURED = arcgisAccessToken.length > 0;

// OpenFreeMap explicitly supports MapLibre Native/mobile applications and
// commercial usage with attribution. It is used only when the ArcGIS style
// cannot be authorized or loaded, so the user never receives a blank map.
export const FALLBACK_MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_FALLBACK_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

function arcgisStyle(styleName: string): string {
  if (!ARCGIS_BASEMAPS_CONFIGURED) return MAP_STYLE_URL;
  const query = new URLSearchParams({
    f: "json",
    language: "it",
    places: "none",
    echoToken: "true",
    token: arcgisAccessToken,
  });
  return `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/${styleName}?${query.toString()}`;
}

export const BASE_MAPS: Record<BaseMapId, BaseMapDefinition> = {
  satellite: {
    id: "satellite",
    label: "Satellite",
    shortLabel: "SAT",
    style: arcgisStyle("imagery"),
    attribution: "Powered by Esri · fonti dati indicate nella mappa",
    available: ARCGIS_BASEMAPS_CONFIGURED,
  },
  topographic: {
    id: "topographic",
    label: "Topografica",
    shortLabel: "TOPO",
    style: arcgisStyle("topographic"),
    attribution: "Powered by Esri · fonti dati indicate nella mappa",
    available: ARCGIS_BASEMAPS_CONFIGURED,
  },
  street: {
    id: "street",
    label: "Stradale",
    shortLabel: "STR",
    style: arcgisStyle("streets"),
    attribution: "Powered by Esri · fonti dati indicate nella mappa",
    available: ARCGIS_BASEMAPS_CONFIGURED,
  },
};

export const DEFAULT_BASE_MAP_ID: BaseMapId = "satellite";
export const FALLBACK_MAP_ATTRIBUTION =
  "OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors";

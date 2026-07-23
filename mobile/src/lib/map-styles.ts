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

function arcgisStyle(styleName: string): string {
  if (!ARCGIS_BASEMAPS_CONFIGURED) return MAP_STYLE_URL;
  const query = new URLSearchParams({
    language: "it",
    places: "attributed",
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
export const FALLBACK_MAP_ATTRIBUTION = "Mappa demo MapLibre · non destinata al rilascio commerciale";

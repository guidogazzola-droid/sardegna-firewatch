import type { MapType } from "react-native-maps";

export type BaseMapId = "satellite" | "topographic" | "street";

export interface BaseMapDefinition {
  id: BaseMapId;
  label: string;
  shortLabel: string;
  mapType: MapType;
}

/**
 * iOS renders these basemaps through Apple MapKit. No remote style document,
 * sprite, glyph request, third-party tile token, or JavaScript-side fallback
 * is required.
 */
export const BASE_MAPS: Record<BaseMapId, BaseMapDefinition> = {
  satellite: {
    id: "satellite",
    label: "Satellite",
    shortLabel: "SAT",
    mapType: "hybrid",
  },
  topographic: {
    id: "topographic",
    label: "Topografica",
    shortLabel: "TOPO",
    mapType: "standard",
  },
  street: {
    id: "street",
    label: "Stradale",
    shortLabel: "STR",
    mapType: "mutedStandard",
  },
};

export const DEFAULT_BASE_MAP_ID: BaseMapId = "satellite";

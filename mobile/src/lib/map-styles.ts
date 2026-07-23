import type { StyleSpecification } from "@maplibre/maplibre-react-native";

export type BaseMapId = "satellite" | "topographic" | "street";

export interface BaseMapDefinition {
  id: BaseMapId;
  label: string;
  shortLabel: string;
  style: StyleSpecification;
}

function rasterStyle(options: {
  id: string;
  tileUrl: string;
  attribution: string;
  maxzoom?: number;
}): StyleSpecification {
  return {
    version: 8,
    name: options.id,
    sources: {
      [options.id]: {
        type: "raster",
        tiles: [options.tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: options.maxzoom ?? 18,
        attribution: options.attribution,
      },
    },
    layers: [
      {
        id: `${options.id}-background`,
        type: "background",
        paint: {
          "background-color": "#dfe7eb",
        },
      },
      {
        id: `${options.id}-tiles`,
        type: "raster",
        source: options.id,
        minzoom: 0,
        maxzoom: options.maxzoom ?? 18,
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 180,
        },
      },
    ],
  };
}

export const BASE_MAPS: Record<BaseMapId, BaseMapDefinition> = {
  satellite: {
    id: "satellite",
    label: "Satellite",
    shortLabel: "SAT",
    style: rasterStyle({
      id: "esri-world-imagery",
      tileUrl:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxzoom: 19,
    }),
  },
  topographic: {
    id: "topographic",
    label: "Topografica",
    shortLabel: "TOPO",
    style: rasterStyle({
      id: "esri-world-topographic",
      tileUrl:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles © Esri and contributors",
      maxzoom: 18,
    }),
  },
  street: {
    id: "street",
    label: "Stradale",
    shortLabel: "STR",
    style: rasterStyle({
      id: "esri-world-street",
      tileUrl:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles © Esri and contributors",
      maxzoom: 19,
    }),
  },
};

export const DEFAULT_BASE_MAP_ID: BaseMapId = "satellite";

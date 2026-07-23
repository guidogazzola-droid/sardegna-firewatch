function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function configuredText(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export const APP_DISPLAY_NAME = configuredText(
  process.env.EXPO_PUBLIC_APP_DISPLAY_NAME,
  "Sabetta Piro \u2014 Wildfire Alerts",
);

export const APP_VERSION = "0.2.0";

export const API_BASE_URL = withoutTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sardegna-firewatch.onrender.com",
);

export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? "https://demotiles.maplibre.org/style.json";

export const SARDINIA_CENTER: [number, number] = [9.05, 40.02];
export const SARDINIA_INITIAL_ZOOM = 7;
export const SARDINIA_BOUNDS = {
  west: 7.7,
  south: 38.7,
  east: 10.2,
  north: 41.4,
} as const;
export const DEFAULT_REFRESH_SECONDS = 300;

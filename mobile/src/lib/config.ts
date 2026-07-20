function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const API_BASE_URL = withoutTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sardegna-firewatch.onrender.com",
);

export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? "https://demotiles.maplibre.org/style.json";

export const SARDINIA_CENTER: [number, number] = [9.05, 40.02];
export const SARDINIA_INITIAL_ZOOM = 7;
export const DEFAULT_REFRESH_SECONDS = 300;

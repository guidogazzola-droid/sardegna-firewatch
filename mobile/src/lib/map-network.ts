import { TransformRequestManager } from "@maplibre/maplibre-react-native";

const arcgisAccessToken = String(
  process.env.EXPO_PUBLIC_ARCGIS_ACCESS_TOKEN ?? "",
).trim();

const ARCGIS_AUTH_HEADER_ID = "sabetta-piro-arcgis-auth";
const ARCGIS_RESOURCE_MATCH =
  "(?i)^https://(?:[^/]+\\.)?(?:arcgis\\.com|arcgisonline\\.com)/";

let configuredToken: string | null = null;

/**
 * ArcGIS returns a valid MapLibre style before the native renderer starts
 * requesting tiles, glyphs and sprites. Those subsequent requests are made by
 * MapLibre Native, not by JavaScript, so they need their own authentication
 * header. Keeping the match restricted to Esri domains prevents the token from
 * being sent to fallback or third-party map providers.
 */
export function configureArcGisMapRequests(): void {
  if (!arcgisAccessToken || configuredToken === arcgisAccessToken) return;

  TransformRequestManager.addHeader({
    id: ARCGIS_AUTH_HEADER_ID,
    match: ARCGIS_RESOURCE_MATCH,
    name: "X-Esri-Authorization",
    value: `Bearer ${arcgisAccessToken}`,
  });

  configuredToken = arcgisAccessToken;
}

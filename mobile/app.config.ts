import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

interface EasProjectMetadata {
  projectId: string | null;
}

function configuredText(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

const easProject = JSON.parse(
  readFileSync(resolve(process.cwd(), "eas-project.json"), "utf8"),
) as EasProjectMetadata;
const EAS_PROJECT_ID = easProject.projectId;
const APP_DISPLAY_NAME = configuredText(
  process.env.EXPO_PUBLIC_APP_DISPLAY_NAME,
  "Sabetta Piro \u2014 Wildfire Alerts",
);
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sardegna-firewatch.onrender.com";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_DISPLAY_NAME,
  slug: "sardinia-firewatch",
  owner: "camerun",
  scheme: "sardiniafirewatch",
  version: "0.2.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.guidogazzola.sardiniafirewatch",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.guidogazzola.sardiniafirewatch",
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          `${APP_DISPLAY_NAME} usa la tua posizione solo mentre usi l'app, per mostrarti le rilevazioni vicine e creare zone monitorate.`,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    "expo-notifications",
    "@maplibre/maplibre-react-native",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl: API_BASE_URL,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});

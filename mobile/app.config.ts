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
  "SabettaPiro \u2014 Wildfire Alerts",
);
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sardegna-firewatch.onrender.com";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_DISPLAY_NAME,
  slug: "sardinia-firewatch",
  owner: "camerun",
  scheme: "sardiniafirewatch",
  version: "0.3.0",
  icon: "./assets/images/icon.png",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.guidogazzola.sardiniafirewatch",
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
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
      "expo-localization",
      {
        supportedLocales: {
          ios: ["it", "en", "fr", "de"],
          android: ["it", "en", "fr", "de"],
        },
        supportsRTL: false,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          `${APP_DISPLAY_NAME} uses your location only while you use the app, to show nearby detections and create monitored areas.`,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    "expo-notifications",
    "expo-iap",
  ],
  experiments: {
    typedRoutes: true,
  },
  locales: {
    it: "./locales/it.json",
    en: "./locales/en.json",
    fr: "./locales/fr.json",
    de: "./locales/de.json",
  },
  extra: {
    apiBaseUrl: API_BASE_URL,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});

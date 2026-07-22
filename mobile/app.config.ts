import type { ConfigContext, ExpoConfig } from "expo/config";
import easProject from "./eas-project.json";

const EAS_PROJECT_ID = easProject.projectId;
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sardegna-firewatch.onrender.com";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Sardinia FireWatch",
  slug: "sardinia-firewatch",
  owner: "camerun",
  scheme: "sardiniafirewatch",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.guidogazzola.sardiniafirewatch",
    buildNumber: "1",
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
          "Sardinia FireWatch usa la tua posizione solo mentre usi l'app, per mostrarti le rilevazioni vicine e creare zone monitorate.",
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

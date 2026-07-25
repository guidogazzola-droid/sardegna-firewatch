import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { translate } from "../i18n";

export async function getPushNotificationToken(): Promise<string> {
  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === "granted"
      ? existing
      : await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
  if (permission.status !== "granted") {
    throw new Error(
      translate("push.denied"),
    );
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId || typeof projectId !== "string") {
    throw new Error(translate("push.projectMissing"));
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

import "react-native-gesture-handler";

import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FireDataProvider } from "../src/context/fire-data";
import { TerritoryProvider } from "../src/context/territory";
import { useAppTheme } from "../src/theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const theme = useAppTheme();
  const statusBarStyle = theme.background === "#0e1418" ? "light" : "dark";

  return (
    <SafeAreaProvider>
      <TerritoryProvider>
        <FireDataProvider>
          <StatusBar style={statusBarStyle} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          />
        </FireDataProvider>
      </TerritoryProvider>
    </SafeAreaProvider>
  );
}

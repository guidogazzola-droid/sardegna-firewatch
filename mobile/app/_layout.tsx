import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FireDataProvider } from "../src/context/fire-data";
import { useAppTheme } from "../src/theme";

export default function RootLayout() {
  const theme = useAppTheme();
  const statusBarStyle = theme.background === "#0e1418" ? "light" : "dark";

  return (
    <SafeAreaProvider>
      <FireDataProvider>
        <StatusBar style={statusBarStyle} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        />
      </FireDataProvider>
    </SafeAreaProvider>
  );
}

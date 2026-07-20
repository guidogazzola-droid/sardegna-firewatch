import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useAppTheme } from "../../src/theme";

function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{symbol}</Text>;
}

export default function TabsLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Mappa",
          tabBarIcon: ({ color }) => <TabIcon symbol="⌖" color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Eventi",
          tabBarIcon: ({ color }) => <TabIcon symbol="●" color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Avvisi",
          tabBarIcon: ({ color }) => <TabIcon symbol="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Info",
          tabBarIcon: ({ color }) => <TabIcon symbol="i" color={color} />,
        }}
      />
    </Tabs>
  );
}

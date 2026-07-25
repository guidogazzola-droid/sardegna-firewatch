import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useI18n } from "../../src/i18n";
import { useAppTheme } from "../../src/theme";

function TabIcon({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{symbol}</Text>;
}

export default function TabsLayout() {
  const theme = useAppTheme();
  const { t } = useI18n();

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
          title: t("tabs.map"),
          tabBarIcon: ({ color }) => <TabIcon symbol="⌖" color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t("tabs.events"),
          tabBarIcon: ({ color }) => <TabIcon symbol="●" color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t("tabs.alerts"),
          tabBarIcon: ({ color }) => <TabIcon symbol="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="territories"
        options={{
          title: t("tabs.territories"),
          tabBarIcon: ({ color }) => <TabIcon symbol="◇" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.info"),
          tabBarIcon: ({ color }) => <TabIcon symbol="i" color={color} />,
        }}
      />
    </Tabs>
  );
}

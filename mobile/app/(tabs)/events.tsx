import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EventCard } from "../../src/components/EventCard";
import { useFireData } from "../../src/context/fire-data";
import { spacing, useAppTheme } from "../../src/theme";

export default function EventsScreen() {
  const theme = useAppTheme();
  const { feed, fires, isLoading, isRefreshing, error, refresh } = useFireData();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Rilevazioni</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Anomalie termiche satellitari, dalla piu recente.</Text>
      </View>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.stateTitle, { color: theme.text }]}>Caricamento delle rilevazioni</Text>
        </View>
      ) : (
        <FlatList
          data={fires}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EventCard fire={item} />}
          refreshing={isRefreshing}
          onRefresh={() => void refresh()}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {error ? (
                <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
              ) : null}
              <View style={[styles.counter, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Counter label="Nel periodo" value={feed?.stats.total ?? 0} />
                <Counter label="Alta affidabilita" value={feed?.stats.highConfidence ?? 0} />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.stateTitle, { color: theme.text }]}>Nessuna rilevazione disponibile</Text>
              <Text style={[styles.stateText, { color: theme.textMuted }]}>Il feed potrebbe non essere configurato oppure non avere osservazioni recenti.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  const theme = useAppTheme();
  return (
    <View style={styles.counterItem}>
      <Text style={[styles.counterValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.counterLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: 4 },
  title: { fontSize: 29, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  listHeader: { gap: spacing.md, paddingBottom: spacing.lg },
  counter: { flexDirection: "row", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg },
  counterItem: { flex: 1, gap: 3 },
  counterValue: { fontSize: 25, fontWeight: "800" },
  counterLabel: { fontSize: 12 },
  error: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  separator: { height: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  empty: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", gap: spacing.sm, padding: spacing.xl },
  stateTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
});

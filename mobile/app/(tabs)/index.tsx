import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFireData } from "../../src/context/fire-data";
import { formatObservation } from "../../src/lib/format";
import { MAP_STYLE_URL, SARDINIA_CENTER, SARDINIA_INITIAL_ZOOM } from "../../src/lib/config";
import { severityColors, spacing, useAppTheme } from "../../src/theme";

export default function MapScreen() {
  const theme = useAppTheme();
  const {
    feed,
    fires,
    error,
    isLoading,
    isRefreshing,
    isLimitedMode,
    lastSuccessfulAt,
    refresh,
  } = useFireData();
  const visibleFires = fires.slice(0, 100);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>SARDEGNA</Text>
          <Text style={[styles.title, { color: theme.text }]}>Sardinia FireWatch</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Rilevazioni termiche quasi in tempo reale</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aggiorna i dati"
          disabled={isRefreshing}
          onPress={() => void refresh()}
          style={({ pressed }) => [
            styles.refreshButton,
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {isRefreshing ? <ActivityIndicator color={theme.accent} /> : <Text style={[styles.refreshText, { color: theme.accent }]}>↻</Text>}
        </Pressable>
      </View>

      {error ? (
        <StatusBanner text={error} tone="error" />
      ) : isLimitedMode ? (
        <StatusBanner text="Feed puntuale NASA FIRMS non configurato: restano disponibili i livelli cartografici e meteorologici." tone="warning" />
      ) : (
        <StatusBanner
          text={lastSuccessfulAt ? `Dati aggiornati ${formatObservation(lastSuccessfulAt)}` : "Connessione alle fonti in corso"}
          tone="ok"
        />
      )}

      <View style={[styles.mapFrame, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
        <Map style={styles.map} mapStyle={MAP_STYLE_URL}>
          <Camera initialViewState={{ center: SARDINIA_CENTER, zoom: SARDINIA_INITIAL_ZOOM }} />
          {visibleFires.map((fire) => (
            <Marker key={fire.id} id={fire.id} lngLat={[fire.longitude, fire.latitude]}>
              <View
                collapsable={false}
                style={[
                  styles.marker,
                  {
                    backgroundColor: severityColors[fire.severity],
                    borderColor: theme.surface,
                  },
                ]}
              />
            </Marker>
          ))}
        </Map>
        {isLoading ? (
          <View style={[styles.loadingOverlay, { backgroundColor: `${theme.background}d9` }]}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.text }]}>Caricamento della mappa...</Text>
          </View>
        ) : null}
        <View style={[styles.legend, { backgroundColor: `${theme.surface}ee`, borderColor: theme.border }]}>
          <View style={[styles.legendDot, { backgroundColor: severityColors.high }]} />
          <Text style={[styles.legendText, { color: theme.text }]}>Rilevazioni recenti</Text>
        </View>
      </View>

      <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SummaryMetric label="Rilevazioni" value={String(feed?.stats.total ?? 0)} />
        <SummaryMetric label="Alta affidabilita" value={String(feed?.stats.highConfidence ?? 0)} />
        <SummaryMetric label="Ultima osservazione" value={formatObservation(feed?.stats.latestObservation)} wide />
      </View>
    </SafeAreaView>
  );
}

function StatusBanner({ text, tone }: { text: string; tone: "ok" | "warning" | "error" }) {
  const theme = useAppTheme();
  const toneColor = tone === "error" ? theme.danger : tone === "warning" ? theme.warning : theme.success;
  return (
    <View style={[styles.statusBanner, { backgroundColor: `${toneColor}18`, borderColor: `${toneColor}55` }]}>
      <View style={[styles.statusDot, { backgroundColor: toneColor }]} />
      <Text style={[styles.statusText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function SummaryMetric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.summaryMetric, wide && styles.summaryMetricWide]}>
      <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: {
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "600",
  },
  statusBanner: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  mapFrame: {
    flex: 1,
    minHeight: 300,
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 3,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  legend: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "700",
  },
  summary: {
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryMetric: {
    flex: 0.8,
    gap: 3,
  },
  summaryMetricWide: {
    flex: 1.5,
  },
  summaryLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "800",
  },
});
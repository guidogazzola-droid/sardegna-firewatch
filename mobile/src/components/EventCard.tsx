import { StyleSheet, Text, View } from "react-native";
import { confidenceLabel, formatAge, formatObservation, severityLabel } from "../lib/format";
import type { FireDetection } from "../lib/types";
import { severityColors, spacing, useAppTheme } from "../theme";

export function EventCard({ fire, compact = false }: { fire: FireDetection; compact?: boolean }) {
  const theme = useAppTheme();
  const severityColor = severityColors[fire.severity];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.dot, { backgroundColor: severityColor }]} />
        <View style={styles.titleColumn}>
          <Text style={[styles.title, { color: theme.text }]}>Rilevazione termica</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {formatObservation(fire.observedAt)} · {formatAge(fire.ageMinutes)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${severityColor}1f` }]}>
          <Text style={[styles.badgeText, { color: severityColor }]}>{severityLabel(fire.severity)}</Text>
        </View>
      </View>

      {!compact ? (
        <>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.metricsRow}>
            <Metric label="Affidabilita" value={confidenceLabel(fire.confidence)} />
            <Metric label="Sensore" value={fire.instrument || "n.d."} />
            <Metric label="FRP" value={fire.frp === null ? "n.d." : `${fire.frp.toFixed(1)} MW`} />
          </View>
          <Text style={[styles.notice, { color: theme.textMuted }]}>
            Anomalia osservata da satellite; non equivale automaticamente a un incendio confermato.
          </Text>
        </>
      ) : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 5,
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  badge: {
    maxWidth: 108,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
    gap: 3,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  notice: {
    fontSize: 12,
    lineHeight: 17,
  },
});

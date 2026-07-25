import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFireData } from "../../src/context/fire-data";
import { useTerritory } from "../../src/context/territory";
import {
  API_BASE_URL,
  APP_DISPLAY_NAME,
  APP_VERSION,
  PRIVACY_URL,
  SUPPORT_URL,
} from "../../src/lib/config";
import { useI18n } from "../../src/i18n";
import { spacing, useAppTheme } from "../../src/theme";

export default function SettingsScreen() {
  const theme = useAppTheme();
  const { t, territoryName } = useI18n();
  const { activeTerritory, unlockedTerritoryIds } = useTerritory();
  const { status } = useFireData();
  const weatherCommercial = status?.weatherService?.commercialReady === true;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            {t("settings.title")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {t("settings.subtitle")}
          </Text>
        </View>

        <Section title={t("settings.serviceStatus")}>
          <MetaRow
            label={t("settings.activeTerritory")}
            value={territoryName(activeTerritory)}
          />
          <MetaRow
            label={t("settings.availableTerritories")}
            value={t("settings.unlockedCount", {
              total: status?.territories?.available ?? 48,
              count: unlockedTerritoryIds.size,
            })}
          />
          <InfoRow label="NASA FIRMS" enabled={status?.sources.firms ?? false} />
          <InfoRow label="Copernicus EFFIS" enabled={status?.sources.effis ?? true} />
          <InfoRow
            label={t("settings.windSource")}
            enabled={status?.sources.windMap ?? false}
          />
          <InfoRow
            label={t("settings.cloudSource")}
            enabled={status?.sources.cloudForecast ?? false}
          />
          <InfoRow
            label={t("settings.proximityAlerts")}
            enabled={status?.alerts?.available ?? false}
          />
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {t("settings.refreshEvery", {
              seconds: status?.refreshSeconds ?? 300,
            })}
          </Text>
        </Section>

        <Section title={t("settings.sourceCompliance")}>
          <MetaRow
            label={t("settings.weatherService")}
            value={status?.weatherService?.provider ?? "Open-Meteo"}
          />
          <MetaRow
            label={t("settings.weatherMode")}
            value={
              weatherCommercial
                ? t("settings.commercialActive")
                : t("settings.evaluation")
            }
          />
          <View
            style={[
              styles.complianceNotice,
              {
                backgroundColor: weatherCommercial ? `${theme.success}12` : `${theme.warning}14`,
                borderColor: weatherCommercial ? `${theme.success}45` : `${theme.warning}50`,
              },
            ]}
          >
            <Text style={[styles.complianceTitle, { color: weatherCommercial ? theme.success : theme.warning }]}>
              {weatherCommercial
                ? t("settings.commercialVerified")
                : t("settings.paidDisabled")}
            </Text>
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {weatherCommercial
                ? t("settings.commercialBody")
                : t("settings.evaluationBody")}
            </Text>
          </View>
        </Section>

        <Section title={t("settings.correctUse")}>
          <Text style={[styles.body, { color: theme.text }]}>
            {t("settings.informationalTool", { app: APP_DISPLAY_NAME })}
          </Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            {t("settings.dataDisclaimer")}
          </Text>
          <View style={[styles.emergency, { backgroundColor: `${theme.danger}15`, borderColor: `${theme.danger}50` }]}>
            <Text style={[styles.emergencyTitle, { color: theme.danger }]}>
              {t("settings.smokeOrFlames")}
            </Text>
            <Text style={[styles.body, { color: theme.text }]}>
              {t("settings.emergencyBody")}
            </Text>
          </View>
        </Section>

        <Section title={t("settings.sources")}>
          <ExternalLink label="NASA FIRMS" url="https://firms.modaps.eosdis.nasa.gov/" />
          <ExternalLink label="Copernicus EFFIS" url="https://forest-fire.emergency.copernicus.eu/" />
          <ExternalLink label="Open-Meteo" url="https://open-meteo.com/" />
          <ExternalLink label="Apple Maps" url="https://www.apple.com/legal/internet-services/maps/" />
          <ExternalLink
            label={t("settings.sardiniaBulletin")}
            url="https://www.sardegnaambiente.it/index.php?c=7093&s=20&v=9&xsl=2273"
          />
        </Section>

        <Section title={t("settings.privacySupport")}>
          <ExternalLink label={t("settings.privacy")} url={PRIVACY_URL} />
          <ExternalLink label={t("settings.support")} url={SUPPORT_URL} />
        </Section>

        <Section title={t("settings.purchases")}>
          <Text style={[styles.body, { color: theme.text }]}>
            {t("settings.purchaseBody")}
          </Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {t("settings.purchaseMeta")}
          </Text>
        </Section>

        <Section title={t("settings.technicalVersion")}>
          <MetaRow label={t("settings.publicName")} value={APP_DISPLAY_NAME} />
          <MetaRow label="App" value={APP_VERSION} />
          <MetaRow label="Bundle ID" value="com.guidogazzola.sardiniafirewatch" />
          <MetaRow label="Backend" value={API_BASE_URL} />
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {t("settings.noAccount")}
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, enabled }: { label: string; enabled: boolean }) {
  const theme = useAppTheme();
  const { t } = useI18n();
  const color = enabled ? theme.success : theme.warning;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={[styles.statusPill, { backgroundColor: `${color}18` }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusLabel, { color }]}>
          {enabled ? t("common.active") : t("common.limited")}
        </Text>
      </View>
    </View>
  );
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={styles.linkRow}>
      <Text style={[styles.linkLabel, { color: theme.accent }]}>{label}</Text>
      <Text style={[styles.linkArrow, { color: theme.accent }]}>↗</Text>
    </Pressable>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: theme.text }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: 4 },
  title: { fontSize: 29, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  section: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  row: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: "800" },
  body: { fontSize: 13, lineHeight: 19 },
  emergency: { borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: 4 },
  emergencyTitle: { fontSize: 14, fontWeight: "800" },
  complianceNotice: { borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: 4 },
  complianceTitle: { fontSize: 13, fontWeight: "800" },
  linkRow: { minHeight: 38, flexDirection: "row", alignItems: "center" },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  linkArrow: { fontSize: 17, fontWeight: "700" },
  metaRow: { gap: 3 },
  metaLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  metaValue: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 17 },
});

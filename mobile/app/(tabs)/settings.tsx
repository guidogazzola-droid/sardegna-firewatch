import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFireData } from "../../src/context/fire-data";
import { API_BASE_URL } from "../../src/lib/config";
import { spacing, useAppTheme } from "../../src/theme";

export default function SettingsScreen() {
  const theme = useAppTheme();
  const { status } = useFireData();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Informazioni</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Fonti, stato del servizio e limiti operativi.</Text>
        </View>

        <Section title="Stato del servizio">
          <InfoRow label="NASA FIRMS" enabled={status?.sources.firms ?? false} />
          <InfoRow label="Copernicus EFFIS" enabled={status?.sources.effis ?? true} />
          <InfoRow label="Vento Open-Meteo" enabled={status?.sources.windMap ?? false} />
          <InfoRow label="Nuvolosita Open-Meteo" enabled={status?.sources.cloudForecast ?? false} />
          <Text style={[styles.meta, { color: theme.textMuted }]}>Aggiornamento previsto ogni {status?.refreshSeconds ?? 300} secondi.</Text>
        </Section>

        <Section title="Uso corretto dei dati">
          <Text style={[styles.body, { color: theme.text }]}>Sardinia FireWatch e uno strumento informativo, non un sistema ufficiale di emergenza.</Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>Una rilevazione termica satellitare puo essere incompleta, ritardata o dovuta a una sorgente di calore diversa da un incendio. Vento, nuvole e traiettorie sono dati modellati o stime e non sostituiscono le comunicazioni delle autorita competenti.</Text>
          <View style={[styles.emergency, { backgroundColor: `${theme.danger}15`, borderColor: `${theme.danger}50` }]}>
            <Text style={[styles.emergencyTitle, { color: theme.danger }]}>In presenza di fumo o fiamme</Text>
            <Text style={[styles.body, { color: theme.text }]}>Contatta immediatamente il 112 o il 1515 e fornisci posizione e riferimenti visibili.</Text>
          </View>
        </Section>

        <Section title="Fonti e attribuzioni">
          <ExternalLink label="NASA FIRMS" url="https://firms.modaps.eosdis.nasa.gov/" />
          <ExternalLink label="Copernicus EFFIS" url="https://forest-fire.emergency.copernicus.eu/" />
          <ExternalLink label="Open-Meteo" url="https://open-meteo.com/" />
          <ExternalLink label="Bollettino Regione Sardegna" url="https://www.sardegnaambiente.it/index.php?c=7093&s=20&v=9&xsl=2273" />
        </Section>

        <Section title="Versione tecnica">
          <MetaRow label="App" value="0.1.0" />
          <MetaRow label="Bundle ID" value="com.guidogazzola.sardiniafirewatch" />
          <MetaRow label="Backend" value={API_BASE_URL} />
          <Text style={[styles.meta, { color: theme.textMuted }]}>Le preferenze della zona monitorata restano sul dispositivo; in questa fase non e richiesto alcun account.</Text>
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
  const color = enabled ? theme.success : theme.warning;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={[styles.statusPill, { backgroundColor: `${color}18` }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusLabel, { color }]}>{enabled ? "Attivo" : "Limitato"}</Text>
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
  linkRow: { minHeight: 38, flexDirection: "row", alignItems: "center" },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  linkArrow: { fontSize: 17, fontWeight: "700" },
  metaRow: { gap: 3 },
  metaLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  metaValue: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 17 },
});

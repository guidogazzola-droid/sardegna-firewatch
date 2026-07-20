import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFireData } from "../../src/context/fire-data";
import type { WatchArea } from "../../src/lib/types";
import { spacing, useAppTheme } from "../../src/theme";

const STORAGE_KEY = "sardinia-firewatch-watch-area-v1";

export default function AlertsScreen() {
  const theme = useAppTheme();
  const { fires } = useFireData();
  const [watchArea, setWatchArea] = useState<WatchArea | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        setWatchArea(JSON.parse(stored) as WatchArea);
      } catch {
        void AsyncStorage.removeItem(STORAGE_KEY);
      }
    });
  }, []);

  const nearbyCount = useMemo(() => {
    if (!watchArea) return 0;
    return fires.filter(
      (fire) =>
        distanceKm(watchArea.latitude, watchArea.longitude, fire.latitude, fire.longitude) <=
        watchArea.radiusKm,
    ).length;
  }, [fires, watchArea]);

  async function useCurrentPosition() {
    setIsLocating(true);
    setMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setMessage("Permesso di localizzazione non concesso. Puoi abilitarlo dalle impostazioni di iOS.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const now = new Date().toISOString();
      const next: WatchArea = {
        id: "primary",
        name: "La mia posizione",
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radiusKm: watchArea?.radiusKm ?? 25,
        createdAt: watchArea?.createdAt ?? now,
        updatedAt: now,
      };
      setWatchArea(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setMessage("Non e stato possibile determinare la posizione. Riprova all'aperto o verifica i servizi di localizzazione.");
    } finally {
      setIsLocating(false);
    }
  }

  async function changeRadius(delta: number) {
    if (!watchArea) return;
    const next = {
      ...watchArea,
      radiusKm: Math.min(100, Math.max(5, watchArea.radiusKm + delta)),
      updatedAt: new Date().toISOString(),
    };
    setWatchArea(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function clearWatchArea() {
    setWatchArea(null);
    setMessage(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Avvisi</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Monitora una zona senza creare un account.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Zona monitorata</Text>
          {watchArea ? (
            <>
              <Text style={[styles.zoneName, { color: theme.text }]}>{watchArea.name}</Text>
              <Text style={[styles.coordinates, { color: theme.textMuted }]}>
                {watchArea.latitude.toFixed(4)}, {watchArea.longitude.toFixed(4)}
              </Text>
              <View style={styles.radiusRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Riduci il raggio"
                  onPress={() => void changeRadius(-5)}
                  style={[styles.circleButton, { backgroundColor: theme.surfaceMuted }]}
                >
                  <Text style={[styles.circleButtonText, { color: theme.text }]}>−</Text>
                </Pressable>
                <View style={styles.radiusValue}>
                  <Text style={[styles.radiusNumber, { color: theme.text }]}>{watchArea.radiusKm} km</Text>
                  <Text style={[styles.radiusLabel, { color: theme.textMuted }]}>raggio di controllo</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aumenta il raggio"
                  onPress={() => void changeRadius(5)}
                  style={[styles.circleButton, { backgroundColor: theme.surfaceMuted }]}
                >
                  <Text style={[styles.circleButtonText, { color: theme.text }]}>+</Text>
                </Pressable>
              </View>
              <View style={[styles.result, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.resultNumber, { color: theme.accent }]}>{nearbyCount}</Text>
                <Text style={[styles.resultText, { color: theme.text }]}>rilevazioni recenti entro il raggio scelto</Text>
              </View>
              <View style={styles.buttonRow}>
                <ActionButton label="Aggiorna posizione" onPress={() => void useCurrentPosition()} busy={isLocating} />
                <ActionButton label="Rimuovi" onPress={() => void clearWatchArea()} secondary />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.body, { color: theme.textMuted }]}>
                La posizione viene richiesta solo quando premi il pulsante e resta memorizzata sul dispositivo.
              </Text>
              <ActionButton label="Usa la mia posizione" onPress={() => void useCurrentPosition()} busy={isLocating} />
            </>
          )}
          {message ? <Text style={[styles.message, { color: theme.danger }]}>{message}</Text> : null}
        </View>

        <View style={[styles.infoCard, { backgroundColor: `${theme.warning}14`, borderColor: `${theme.warning}45` }]}>
          <Text style={[styles.infoTitle, { color: theme.text }]}>Notifiche push: fase successiva</Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            Questa prima base calcola gia le rilevazioni vicine. L'invio in background verra attivato dopo il registro dispositivi sul backend e i test TestFlight.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress,
  busy = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: secondary ? theme.surfaceMuted : theme.accent,
          opacity: pressed || busy ? 0.7 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? theme.text : "#ffffff"} />
      ) : (
        <Text style={[styles.actionButtonText, { color: secondary ? theme.text : "#ffffff" }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lon2 - lon1);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: 4 },
  title: { fontSize: 29, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md },
  cardTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  zoneName: { fontSize: 23, fontWeight: "800" },
  coordinates: { fontSize: 13 },
  radiusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingVertical: spacing.md },
  circleButton: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  circleButtonText: { fontSize: 27, lineHeight: 29, fontWeight: "600" },
  radiusValue: { minWidth: 120, alignItems: "center" },
  radiusNumber: { fontSize: 24, fontWeight: "800" },
  radiusLabel: { fontSize: 11 },
  result: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: 16, padding: spacing.md },
  resultNumber: { fontSize: 29, fontWeight: "900" },
  resultText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  actionButton: { minHeight: 48, flex: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  actionButtonText: { fontSize: 14, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 13, lineHeight: 19 },
  message: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  infoCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm },
  infoTitle: { fontSize: 16, fontWeight: "800" },
});

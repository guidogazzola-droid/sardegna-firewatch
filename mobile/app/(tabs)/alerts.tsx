import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFireData } from "../../src/context/fire-data";
import {
  createAlertSubscription,
  deleteAlertSubscription,
  sendAlertTest,
  updateAlertSubscription,
} from "../../src/lib/api";
import { PRIVACY_URL } from "../../src/lib/config";
import { getPushNotificationToken } from "../../src/lib/push-notifications";
import type { StoredAlertRegistration, WatchArea } from "../../src/lib/types";
import { spacing, useAppTheme } from "../../src/theme";

const WATCH_AREA_STORAGE_KEY = "sardinia-firewatch-watch-area-v1";
const REGISTRATION_STORAGE_KEY = "sardinia-firewatch-push-registration-v1";

type MessageKind = "success" | "error" | "info";

export default function AlertsScreen() {
  const theme = useAppTheme();
  const { fires, status } = useFireData();
  const [watchArea, setWatchArea] = useState<WatchArea | null>(null);
  const [registration, setRegistration] =
    useState<StoredAlertRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<MessageKind>("info");

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(WATCH_AREA_STORAGE_KEY),
      AsyncStorage.getItem(REGISTRATION_STORAGE_KEY),
    ]).then(([storedArea, storedRegistration]) => {
      if (storedArea) {
        try {
          setWatchArea(JSON.parse(storedArea) as WatchArea);
        } catch {
          void AsyncStorage.removeItem(WATCH_AREA_STORAGE_KEY);
        }
      }
      if (storedRegistration) {
        try {
          setRegistration(
            JSON.parse(storedRegistration) as StoredAlertRegistration,
          );
        } catch {
          void AsyncStorage.removeItem(REGISTRATION_STORAGE_KEY);
        }
      }
      setIsLoading(false);
    });
  }, []);

  const nearbyCount = useMemo(() => {
    if (!watchArea) return 0;
    return fires.filter(
      (fire) =>
        distanceKm(
          watchArea.latitude,
          watchArea.longitude,
          fire.latitude,
          fire.longitude,
        ) <= watchArea.radiusKm,
    ).length;
  }, [fires, watchArea]);

  function showMessage(text: string, kind: MessageKind) {
    setMessage(text);
    setMessageKind(kind);
  }

  async function persistWatchArea(next: WatchArea) {
    setWatchArea(next);
    await AsyncStorage.setItem(WATCH_AREA_STORAGE_KEY, JSON.stringify(next));
    if (!registration) return;
    try {
      await updateAlertSubscription({
        ...registration,
        watchArea: next,
      });
      showMessage("Zona aggiornata anche per le notifiche.", "success");
    } catch (error) {
      showMessage(
        `${errorMessage(error)} La modifica resta salvata sul telefono; riprova prima di affidarti agli avvisi.`,
        "error",
      );
    }
  }

  async function useCurrentPosition() {
    setIsLocating(true);
    setMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        showMessage(
          "Permesso di localizzazione non concesso. Puoi abilitarlo dalle impostazioni di iOS.",
          "error",
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const now = new Date().toISOString();
      await persistWatchArea({
        id: "primary",
        name: "La mia posizione",
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radiusKm: watchArea?.radiusKm ?? 25,
        createdAt: watchArea?.createdAt ?? now,
        updatedAt: now,
      });
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Non e stato possibile determinare la posizione.",
        "error",
      );
    } finally {
      setIsLocating(false);
    }
  }

  async function changeRadius(delta: number) {
    if (!watchArea || isSaving) return;
    setIsSaving(true);
    try {
      await persistWatchArea({
        ...watchArea,
        radiusKm: Math.min(100, Math.max(5, watchArea.radiusKm + delta)),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function enableNotifications() {
    if (!watchArea || isSaving) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const expoPushToken = await getPushNotificationToken();
      let nextRegistration = registration;
      if (registration) {
        await updateAlertSubscription({
          ...registration,
          expoPushToken,
          watchArea,
        });
      } else {
        const created = await createAlertSubscription({
          expoPushToken,
          watchArea,
        });
        nextRegistration = {
          id: created.subscription.id,
          secret: created.secret,
        };
        await AsyncStorage.setItem(
          REGISTRATION_STORAGE_KEY,
          JSON.stringify(nextRegistration),
        );
        setRegistration(nextRegistration);
      }
      if (!nextRegistration) {
        throw new Error("Registrazione notifiche non disponibile.");
      }
      await sendAlertTest(nextRegistration);
      showMessage(
        "Notifiche attive. Abbiamo inviato un avviso di prova.",
        "success",
      );
    } catch (error) {
      showMessage(errorMessage(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function testNotifications() {
    if (!registration || isSaving) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await sendAlertTest(registration);
      showMessage("Notifica di prova inviata.", "success");
    } catch (error) {
      showMessage(errorMessage(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function disableNotifications() {
    if (!registration || isSaving) return false;
    setIsSaving(true);
    setMessage(null);
    try {
      await deleteAlertSubscription(registration);
      await AsyncStorage.removeItem(REGISTRATION_STORAGE_KEY);
      setRegistration(null);
      showMessage(
        "Notifiche disattivate e zona cancellata dal servizio.",
        "success",
      );
      return true;
    } catch (error) {
      showMessage(
        `${errorMessage(error)} La registrazione remota non e stata cancellata: riprova con una connessione attiva.`,
        "error",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function clearWatchArea() {
    if (isSaving) return;
    if (registration && !(await disableNotifications())) return;
    setWatchArea(null);
    await AsyncStorage.removeItem(WATCH_AREA_STORAGE_KEY);
    showMessage("Zona monitorata rimossa.", "success");
  }

  const pushAvailable = status?.alerts?.available ?? status?.sources.alerts ?? false;
  const messageColor =
    messageKind === "success"
      ? theme.success
      : messageKind === "error"
        ? theme.danger
        : theme.textMuted;

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Avvisi</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Monitora una zona senza creare un account.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Zona monitorata
          </Text>
          {isLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : watchArea ? (
            <>
              <Text style={[styles.zoneName, { color: theme.text }]}>
                {watchArea.name}
              </Text>
              <Text style={[styles.coordinates, { color: theme.textMuted }]}>
                {watchArea.latitude.toFixed(4)}, {watchArea.longitude.toFixed(4)}
              </Text>
              <View style={styles.radiusRow}>
                <CircleButton
                  label="−"
                  accessibilityLabel="Riduci il raggio"
                  disabled={isSaving}
                  onPress={() => void changeRadius(-5)}
                />
                <View style={styles.radiusValue}>
                  <Text style={[styles.radiusNumber, { color: theme.text }]}>
                    {watchArea.radiusKm} km
                  </Text>
                  <Text
                    style={[styles.radiusLabel, { color: theme.textMuted }]}
                  >
                    raggio di controllo
                  </Text>
                </View>
                <CircleButton
                  label="+"
                  accessibilityLabel="Aumenta il raggio"
                  disabled={isSaving}
                  onPress={() => void changeRadius(5)}
                />
              </View>
              <View
                style={[styles.result, { backgroundColor: theme.accentSoft }]}
              >
                <Text style={[styles.resultNumber, { color: theme.accent }]}>
                  {nearbyCount}
                </Text>
                <Text style={[styles.resultText, { color: theme.text }]}>
                  rilevazioni recenti entro il raggio scelto
                </Text>
              </View>
              <View style={styles.buttonRow}>
                <ActionButton
                  label="Aggiorna posizione"
                  onPress={() => void useCurrentPosition()}
                  busy={isLocating}
                />
                <ActionButton
                  label="Rimuovi zona"
                  onPress={() => void clearWatchArea()}
                  secondary
                  disabled={isSaving}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.body, { color: theme.textMuted }]}>
                La posizione viene richiesta solo quando premi il pulsante. Le
                notifiche si attivano separatamente.
              </Text>
              <ActionButton
                label="Usa la mia posizione"
                onPress={() => void useCurrentPosition()}
                busy={isLocating}
              />
            </>
          )}
          {message ? (
            <Text style={[styles.message, { color: messageColor }]}>
              {message}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: registration
                ? `${theme.success}12`
                : `${theme.warning}14`,
              borderColor: registration
                ? `${theme.success}45`
                : `${theme.warning}45`,
            },
          ]}
        >
          <Text style={[styles.infoTitle, { color: theme.text }]}>
            {registration ? "Notifiche push attive" : "Notifiche push"}
          </Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            {registration
              ? "Il server controlla le nuove rilevazioni satellitari anche quando l'app e chiusa. Gli avvisi sono informativi e non sostituiscono le autorita."
              : "Attivandole, token del dispositivo, coordinate e raggio vengono conservati dal servizio finche non li cancelli."}
          </Text>
          {watchArea ? (
            <View style={styles.buttonRow}>
              <ActionButton
                label={
                  registration
                    ? "Invia prova"
                    : pushAvailable
                      ? "Attiva notifiche"
                      : "Servizio non disponibile"
                }
                onPress={() =>
                  void (registration
                    ? testNotifications()
                    : enableNotifications())
                }
                busy={isSaving}
                disabled={!registration && !pushAvailable}
              />
              {registration ? (
                <ActionButton
                  label="Disattiva"
                  onPress={() => void disableNotifications()}
                  secondary
                  disabled={isSaving}
                />
              ) : null}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
          >
            <Text style={[styles.privacyLink, { color: theme.accent }]}>
              Come trattiamo i dati delle notifiche ↗
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Operazione non riuscita. Riprova.";
}

function ActionButton({
  label,
  onPress,
  busy = false,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: secondary ? theme.surfaceMuted : theme.accent,
          opacity: pressed || busy || disabled ? 0.55 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? theme.text : "#ffffff"} />
      ) : (
        <Text
          style={[
            styles.actionButtonText,
            { color: secondary ? theme.text : "#ffffff" },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function CircleButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.circleButton,
        { backgroundColor: theme.surfaceMuted, opacity: disabled ? 0.55 : 1 },
      ]}
    >
      <Text style={[styles.circleButtonText, { color: theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radius = 6371;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lon2 - lon1);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: { gap: 4 },
  title: { fontSize: 29, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  zoneName: { fontSize: 23, fontWeight: "800" },
  coordinates: { fontSize: 13 },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  circleButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  circleButtonText: { fontSize: 27, lineHeight: 29, fontWeight: "600" },
  radiusValue: { minWidth: 120, alignItems: "center" },
  radiusNumber: { fontSize: 24, fontWeight: "800" },
  radiusLabel: { fontSize: 11 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 16,
    padding: spacing.md,
  },
  resultNumber: { fontSize: 29, fontWeight: "900" },
  resultText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  actionButton: {
    minHeight: 48,
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  body: { fontSize: 13, lineHeight: 19 },
  message: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  infoCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoTitle: { fontSize: 16, fontWeight: "800" },
  privacyLink: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
});

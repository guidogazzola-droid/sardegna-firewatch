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
import { useTerritory } from "../../src/context/territory";
import {
  createAlertSubscription,
  deleteAlertSubscription,
  sendAlertTest,
  updateAlertSubscription,
} from "../../src/lib/api";
import { PRIVACY_URL } from "../../src/lib/config";
import { useI18n } from "../../src/i18n";
import { getPushNotificationToken } from "../../src/lib/push-notifications";
import { formatCoordinate } from "../../src/lib/format";
import {
  DEFAULT_TERRITORY,
  getTerritory,
  isPointInTerritory,
} from "../../src/lib/territories";
import type { StoredAlertRegistration, WatchArea } from "../../src/lib/types";
import { spacing, useAppTheme } from "../../src/theme";

const WATCH_AREA_STORAGE_KEY = "sardinia-firewatch-watch-area-v1";
const REGISTRATION_STORAGE_KEY = "sardinia-firewatch-push-registration-v1";

type MessageKind = "success" | "error" | "info";

export default function AlertsScreen() {
  const theme = useAppTheme();
  const { language, t, territoryName } = useI18n();
  const { fires, status } = useFireData();
  const { activeTerritory, purchaseToken } = useTerritory();
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
          const parsed = JSON.parse(storedArea) as WatchArea;
          setWatchArea({
            ...parsed,
            territoryId: parsed.territoryId || DEFAULT_TERRITORY.id,
          });
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

  useEffect(() => {
    if (
      isLoading ||
      !registration ||
      registration.language === language
    ) {
      return;
    }
    let cancelled = false;
    void updateAlertSubscription({
      ...registration,
      language,
    })
      .then(async () => {
        if (cancelled) return;
        const next = { ...registration, language };
        setRegistration(next);
        await AsyncStorage.setItem(
          REGISTRATION_STORAGE_KEY,
          JSON.stringify(next),
        );
      })
      .catch(() => {
        // The next explicit alert action retries the language update.
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, language, registration]);

  const nearbyCount = useMemo(() => {
    if (!watchArea || watchArea.territoryId !== activeTerritory.id) return 0;
    return fires.filter(
      (fire) =>
        distanceKm(
          watchArea.latitude,
          watchArea.longitude,
          fire.latitude,
          fire.longitude,
        ) <= watchArea.radiusKm,
    ).length;
  }, [activeTerritory.id, fires, watchArea]);

  function showMessage(text: string, kind: MessageKind) {
    setMessage(text);
    setMessageKind(kind);
  }

  async function persistWatchArea(next: WatchArea) {
    setWatchArea(next);
    await AsyncStorage.setItem(WATCH_AREA_STORAGE_KEY, JSON.stringify(next));
    if (!registration) return;
    const territory = getTerritory(next.territoryId);
    try {
      await updateAlertSubscription({
        ...registration,
        watchArea: next,
        language,
        entitlementToken: territory ? purchaseToken(territory) : null,
      });
      showMessage(t("alerts.areaUpdated"), "success");
    } catch (error) {
      showMessage(
        t("alerts.updateRemoteFailed", {
          error: errorMessage(error, t("alerts.operationFailed")),
        }),
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
          t("alerts.locationDenied"),
          "error",
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (
        !isPointInTerritory(
          activeTerritory,
          location.coords.latitude,
          location.coords.longitude,
        )
      ) {
        showMessage(
          t("alerts.outsideTerritory", {
            territory: territoryName(activeTerritory),
          }),
          "error",
        );
        return;
      }
      const now = new Date().toISOString();
      await persistWatchArea({
        id: "primary",
        territoryId: activeTerritory.id,
        name: t("alerts.myPosition", {
          territory: territoryName(activeTerritory),
        }),
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
          : t("alerts.locationFailed"),
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
          language,
          entitlementToken: purchaseToken(
            getTerritory(watchArea.territoryId) ?? DEFAULT_TERRITORY,
          ),
        });
        nextRegistration = { ...registration, language };
        await AsyncStorage.setItem(
          REGISTRATION_STORAGE_KEY,
          JSON.stringify(nextRegistration),
        );
        setRegistration(nextRegistration);
      } else {
        const created = await createAlertSubscription({
          expoPushToken,
          watchArea,
          language,
          entitlementToken: purchaseToken(
            getTerritory(watchArea.territoryId) ?? DEFAULT_TERRITORY,
          ),
        });
        nextRegistration = {
          id: created.subscription.id,
          secret: created.secret,
          language,
        };
        await AsyncStorage.setItem(
          REGISTRATION_STORAGE_KEY,
          JSON.stringify(nextRegistration),
        );
        setRegistration(nextRegistration);
      }
      if (!nextRegistration) {
        throw new Error(t("alerts.registrationUnavailable"));
      }
      await sendAlertTest(nextRegistration);
      showMessage(
        t("alerts.enabled"),
        "success",
      );
    } catch (error) {
      showMessage(errorMessage(error, t("alerts.operationFailed")), "error");
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
      showMessage(t("alerts.testSent"), "success");
    } catch (error) {
      showMessage(errorMessage(error, t("alerts.operationFailed")), "error");
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
        t("alerts.disabled"),
        "success",
      );
      return true;
    } catch (error) {
      showMessage(
        t("alerts.remoteDeleteFailed", {
          error: errorMessage(error, t("alerts.operationFailed")),
        }),
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
    showMessage(t("alerts.areaRemoved"), "success");
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
          <Text style={[styles.title, { color: theme.text }]}>
            {t("alerts.title")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {t("alerts.subtitle", {
              territory: territoryName(activeTerritory),
            })}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {t("alerts.monitoredArea")}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : watchArea ? (
            <>
              <Text style={[styles.zoneName, { color: theme.text }]}>
                {t("alerts.myPosition", {
                  territory: territoryName(
                    getTerritory(watchArea.territoryId) ?? activeTerritory,
                  ),
                })}
              </Text>
              <Text style={[styles.coordinates, { color: theme.textMuted }]}>
                {formatCoordinate(watchArea.latitude, language)};{" "}
                {formatCoordinate(watchArea.longitude, language)}
              </Text>
              {watchArea.territoryId !== activeTerritory.id ? (
                <Text style={[styles.message, { color: theme.warning }]}>
                  {t("alerts.otherTerritory", {
                    territory: getTerritory(watchArea.territoryId)
                      ? territoryName(getTerritory(watchArea.territoryId)!)
                      : t("alerts.otherTerritoryFallback"),
                    activeTerritory: territoryName(activeTerritory),
                  })}
                </Text>
              ) : null}
              <View style={styles.radiusRow}>
                <CircleButton
                  label="−"
                  accessibilityLabel={t("alerts.reduceRadius")}
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
                    {t("alerts.radius")}
                  </Text>
                </View>
                <CircleButton
                  label="+"
                  accessibilityLabel={t("alerts.increaseRadius")}
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
                  {t(
                    nearbyCount === 1
                      ? "alerts.nearbyOne"
                      : "alerts.nearbyCount",
                  )}
                </Text>
              </View>
              <View style={styles.buttonRow}>
                <ActionButton
                  label={t("alerts.updatePosition")}
                  onPress={() => void useCurrentPosition()}
                  busy={isLocating}
                />
                <ActionButton
                  label={t("alerts.removeArea")}
                  onPress={() => void clearWatchArea()}
                  secondary
                  disabled={isSaving}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.body, { color: theme.textMuted }]}>
                {t("alerts.locationPrivacy")}
              </Text>
              <ActionButton
                label={t("alerts.usePosition")}
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
            {registration ? t("alerts.pushActive") : t("alerts.push")}
          </Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            {registration
              ? t("alerts.activeBody")
              : t("alerts.inactiveBody")}
          </Text>
          {watchArea ? (
            <View style={styles.buttonRow}>
              <ActionButton
                label={
                  registration
                    ? t("alerts.sendTest")
                    : pushAvailable
                      ? t("alerts.enable")
                      : t("alerts.serviceUnavailable")
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
                  label={t("alerts.disable")}
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
              {t("alerts.privacy")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
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

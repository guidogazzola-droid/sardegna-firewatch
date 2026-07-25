import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTerritory } from "../../src/context/territory";
import type { Territory } from "../../src/lib/territories";
import { spacing, useAppTheme } from "../../src/theme";

export default function TerritoriesScreen() {
  const theme = useAppTheme();
  const {
    territories,
    activeTerritory,
    connected,
    isLoading,
    isPurchasing,
    storeError,
    storeMessage,
    isUnlocked,
    displayPrice,
    selectTerritory,
    purchaseTerritory,
    restoreCountryPurchases,
  } = useTerritory();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <FlatList
        data={territories}
        keyExtractor={(territory) => territory.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>
                Territori
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                La Sardegna è inclusa. Ogni Paese si acquista una sola volta e
                resta disponibile sul tuo Apple ID.
              </Text>
            </View>
            <View
              style={[
                styles.modelCard,
                {
                  backgroundColor: theme.accentSoft,
                  borderColor: `${theme.accent}44`,
                },
              ]}
            >
              <Text style={[styles.modelTitle, { color: theme.accent }]}>
                Sardegna gratis · Paesi da CHF 5
              </Text>
              <Text style={[styles.modelText, { color: theme.textMuted }]}>
                Il prezzo effettivo è quello mostrato da App Store nella valuta
                del Paese dell’utente. Gli acquisti non sono abbonamenti.
              </Text>
            </View>
            {isLoading ? (
              <View style={styles.storeStatus}>
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.storeStatusText, { color: theme.textMuted }]}>
                  Collegamento ad App Store…
                </Text>
              </View>
            ) : null}
            {storeError ? (
              <Text style={[styles.message, { color: theme.danger }]}>
                {storeError}
              </Text>
            ) : null}
            {storeMessage ? (
              <Text style={[styles.message, { color: theme.success }]}>
                {storeMessage}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TerritoryRow
            territory={item}
            selected={activeTerritory.id === item.id}
            unlocked={isUnlocked(item)}
            price={displayPrice(item)}
            busy={isPurchasing}
            connected={connected}
            onPress={() =>
              void (isUnlocked(item)
                ? selectTerritory(item)
                : purchaseTerritory(item))
            }
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={!connected || isPurchasing}
              onPress={() => void restoreCountryPurchases()}
              style={[
                styles.restoreButton,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  opacity: !connected || isPurchasing ? 0.55 : 1,
                },
              ]}
            >
              {isPurchasing ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <Text style={[styles.restoreText, { color: theme.accent }]}>
                  Ripristina acquisti
                </Text>
              )}
            </Pressable>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Gli sblocchi sono acquisti in‑app non consumabili gestiti da
              Apple. Non richiediamo un account Sabetta Piro.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function TerritoryRow({
  territory,
  selected,
  unlocked,
  price,
  busy,
  connected,
  onPress,
}: {
  territory: Territory;
  selected: boolean;
  unlocked: boolean;
  price: string;
  busy: boolean;
  connected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const actionLabel = selected
    ? "In uso"
    : unlocked
      ? "Apri"
      : price;
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? `${theme.accent}88` : theme.border,
        },
      ]}
    >
      <View
        style={[
          styles.countryCode,
          { backgroundColor: unlocked ? theme.accentSoft : theme.surfaceMuted },
        ]}
      >
        <Text
          style={[
            styles.countryCodeText,
            { color: unlocked ? theme.accent : theme.textMuted },
          ]}
        >
          {territory.countryCode === "IT-SAR"
            ? "SAR"
            : territory.countryCode}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.countryName, { color: theme.text }]}>
          {territory.name}
        </Text>
        <Text style={[styles.countryMeta, { color: theme.textMuted }]}>
          {territory.free
            ? "Inclusa gratuitamente"
            : unlocked
              ? "Acquistata · accesso permanente"
              : "Mappa, rilevazioni, meteo e avvisi"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${territory.name}`}
        disabled={selected || busy || (!unlocked && !connected)}
        onPress={onPress}
        style={[
          styles.action,
          {
            backgroundColor:
              selected || unlocked ? theme.accentSoft : theme.accent,
            opacity:
              selected || busy || (!unlocked && !connected) ? 0.58 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.actionText,
            { color: selected || unlocked ? theme.accent : "#ffffff" },
          ]}
        >
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerArea: { gap: spacing.md, paddingBottom: spacing.lg },
  header: { gap: 4, paddingTop: spacing.sm },
  title: { fontSize: 29, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  modelCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: 5,
  },
  modelTitle: { fontSize: 15, fontWeight: "900" },
  modelText: { fontSize: 12, lineHeight: 18 },
  storeStatus: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  storeStatusText: { fontSize: 12, fontWeight: "600" },
  message: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
  separator: { height: spacing.sm },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  countryCode: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  countryCodeText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  rowText: { flex: 1, gap: 2 },
  countryName: { fontSize: 15, fontWeight: "800" },
  countryMeta: { fontSize: 10, lineHeight: 14 },
  action: {
    minWidth: 66,
    minHeight: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  actionText: { fontSize: 11, fontWeight: "900" },
  footer: { gap: spacing.md, paddingTop: spacing.xl },
  restoreButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: { fontSize: 14, fontWeight: "800" },
  footerText: { fontSize: 11, lineHeight: 16, textAlign: "center" },
});

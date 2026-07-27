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
import { useI18n } from "../../src/i18n";
import type { Territory } from "../../src/lib/territories";
import { spacing, useAppTheme } from "../../src/theme";

export default function TerritoriesScreen() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const {
    territories,
    activeTerritory,
    connected,
    isLoading,
    isPurchasing,
    storeError,
    storeMessage,
    storeDiagnostics,
    configuredProductMissing,
    isUnlocked,
    isPurchasable,
    displayPrice,
    selectTerritory,
    purchaseTerritory,
    refreshStoreCatalog,
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
                {t("territories.title")}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                {t("territories.subtitle")}
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
                {t("territories.modelTitle")}
              </Text>
              <Text style={[styles.modelText, { color: theme.textMuted }]}>
                {t("territories.modelBody")}
              </Text>
            </View>
            {isLoading ? (
              <View style={styles.storeStatus}>
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.storeStatusText, { color: theme.textMuted }]}>
                  {t("territories.connecting")}
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
            {configuredProductMissing ? (
              <StoreDiagnosticCard
                connected={connected}
                busy={isLoading || isPurchasing}
                storefront={storeDiagnostics.storefront}
                productIds={storeDiagnostics.requestedProductIds}
                returnedCount={storeDiagnostics.returnedProductIds.length}
                errorCode={storeDiagnostics.errorCode}
                errorMessage={storeDiagnostics.errorMessage}
                onRetry={() => void refreshStoreCatalog()}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TerritoryRow
            territory={item}
            selected={activeTerritory.id === item.id}
            unlocked={isUnlocked(item)}
            purchasable={isPurchasable(item)}
            price={displayPrice(item)}
            busy={isLoading || isPurchasing}
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
                  {t("territories.restore")}
                </Text>
              )}
            </Pressable>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              {t("territories.footer")}
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
  purchasable,
  price,
  busy,
  connected,
  onPress,
}: {
  territory: Territory;
  selected: boolean;
  unlocked: boolean;
  purchasable: boolean;
  price: string;
  busy: boolean;
  connected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const { t, territoryName } = useI18n();
  const name = territoryName(territory);
  const actionLabel = selected
    ? t("territories.inUse")
    : unlocked
      ? t("territories.open")
      : purchasable
        ? price
        : t("territories.retry");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${actionLabel} ${name}`}
      accessibilityHint={
        unlocked
          ? t("territories.selectHint", { territory: name })
          : purchasable
            ? t("territories.purchaseHint", { territory: name })
            : t("territories.retryHint", { territory: name })
      }
      disabled={selected || busy || (!unlocked && !connected)}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? `${theme.accent}88` : theme.border,
          opacity: busy ? 0.72 : 1,
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
          {name}
        </Text>
        <Text style={[styles.countryMeta, { color: theme.textMuted }]}>
          {territory.free
            ? t("territories.included")
            : unlocked
              ? t("territories.purchased")
              : purchasable
                ? t("territories.features")
                : t("territories.storePending")}
        </Text>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.action,
          {
            backgroundColor:
              selected || unlocked ? theme.accentSoft : theme.accent,
            opacity:
              selected ||
              busy ||
              (!unlocked && !connected)
                ? 0.58
                : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.actionText,
            {
              color:
                selected || unlocked
                  ? theme.accent
                  : "#ffffff",
            },
          ]}
        >
          {actionLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function StoreDiagnosticCard({
  connected,
  busy,
  storefront,
  productIds,
  returnedCount,
  errorCode,
  errorMessage,
  onRetry,
}: {
  connected: boolean;
  busy: boolean;
  storefront: string | null;
  productIds: readonly string[];
  returnedCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useI18n();
  const error =
    [errorCode, errorMessage].filter(Boolean).join(" · ") ||
    t("territories.diagnosticNoError");
  return (
    <View
      style={[
        styles.diagnosticCard,
        {
          backgroundColor: theme.surface,
          borderColor: `${theme.danger}66`,
        },
      ]}
    >
      <Text style={[styles.diagnosticTitle, { color: theme.danger }]}>
        {t("territories.diagnosticTitle")}
      </Text>
      <Text style={[styles.diagnosticBody, { color: theme.textMuted }]}>
        {t("territories.diagnosticBody")}
      </Text>
      <View style={styles.diagnosticDetails}>
        <Text style={[styles.diagnosticLine, { color: theme.textMuted }]}>
          {t("territories.diagnosticConnection", {
            status: connected
              ? t("territories.diagnosticConnected")
              : t("territories.diagnosticDisconnected"),
          })}
        </Text>
        <Text style={[styles.diagnosticLine, { color: theme.textMuted }]}>
          {t("territories.diagnosticStorefront", {
            storefront:
              storefront ?? t("territories.diagnosticUnknown"),
          })}
        </Text>
        <Text
          selectable
          style={[styles.diagnosticLine, { color: theme.textMuted }]}
        >
          {t("territories.diagnosticProduct", {
            productId: productIds.join(", "),
          })}
        </Text>
        <Text style={[styles.diagnosticLine, { color: theme.textMuted }]}>
          {t("territories.diagnosticResponse", {
            count: returnedCount,
          })}
        </Text>
        <Text style={[styles.diagnosticLine, { color: theme.textMuted }]}>
          {t("territories.diagnosticError", { error })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!connected || busy}
        onPress={onRetry}
        style={[
          styles.retryButton,
          {
            backgroundColor: theme.accent,
            opacity: !connected || busy ? 0.55 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.retryText}>
            {t("territories.retry")}
          </Text>
        )}
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
  diagnosticCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  diagnosticTitle: { fontSize: 14, fontWeight: "900" },
  diagnosticBody: { fontSize: 11, lineHeight: 16 },
  diagnosticDetails: { gap: 3 },
  diagnosticLine: { fontSize: 10, lineHeight: 15 },
  retryButton: {
    minHeight: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  retryText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
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

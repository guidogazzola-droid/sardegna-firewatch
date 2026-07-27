import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchProducts as fetchStoreProducts,
  finishTransaction,
  getStorefront,
  isTransactionVerifiedIOS,
  type Product,
  type Purchase,
  useIAP,
} from "expo-iap";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import { translate, useI18n, type AppLanguage } from "../i18n";
import {
  CONFIGURED_COUNTRY_PRODUCT_IDS,
  DEFAULT_TERRITORY,
  getTerritory,
  getTerritoryByProductId,
  TERRITORIES,
  type Territory,
} from "../lib/territories";

const ACTIVE_TERRITORY_KEY = "sabetta-piro-active-territory-v1";
const ENTITLEMENTS_KEY = "sabetta-piro-country-entitlements-v1";
const CONFIGURED_PRODUCT_ID_SET = new Set<string>(
  CONFIGURED_COUNTRY_PRODUCT_IDS,
);

export interface StoreDiagnostics {
  storefront: string | null;
  requestedProductIds: readonly string[];
  returnedProductIds: readonly string[];
  errorCode: string | null;
  errorMessage: string | null;
  checkedAt: number | null;
}

interface TerritoryContextValue {
  territories: Territory[];
  activeTerritory: Territory;
  unlockedTerritoryIds: ReadonlySet<string>;
  connected: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  storeError: string | null;
  storeMessage: string | null;
  storeDiagnostics: StoreDiagnostics;
  configuredProductMissing: boolean;
  isUnlocked: (territory: Territory) => boolean;
  isPurchasable: (territory: Territory) => boolean;
  displayPrice: (territory: Territory) => string;
  purchaseToken: (territory: Territory) => string | null;
  selectTerritory: (territory: Territory) => Promise<boolean>;
  purchaseTerritory: (territory: Territory) => Promise<void>;
  refreshStoreCatalog: () => Promise<void>;
  restoreCountryPurchases: () => Promise<void>;
}

const TerritoryContext = createContext<TerritoryContextValue | null>(null);

function purchaseIsUsable(purchase: Purchase): boolean {
  return (
    purchase.purchaseState !== "pending" &&
    !("revocationDateIOS" in purchase && purchase.revocationDateIOS)
  );
}

function isUserCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code).includes("user-cancelled")
  );
}

function readableStoreError(
  error: unknown,
  language: AppLanguage,
): string {
  if (isUserCancelled(error)) return translate("store.cancelled", {}, language);
  return error instanceof Error && error.message
    ? error.message
    : translate("store.unavailable", {}, language);
}

function storeErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code
  ) {
    return String(error.code);
  }
  return null;
}

export function TerritoryProvider({ children }: { children: ReactNode }) {
  const { language, t, territoryName } = useI18n();
  const [activeTerritoryId, setActiveTerritoryId] = useState(
    DEFAULT_TERRITORY.id,
  );
  const [cachedEntitlements, setCachedEntitlements] = useState<string[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [storeLoaded, setStoreLoaded] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([]);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [storeDiagnostics, setStoreDiagnostics] = useState<StoreDiagnostics>({
    storefront: null,
    requestedProductIds: CONFIGURED_COUNTRY_PRODUCT_IDS,
    returnedProductIds: [],
    errorCode: null,
    errorMessage: null,
    checkedAt: null,
  });

  const handlePurchaseSuccess = useCallback(async (purchase: Purchase) => {
    const territory = getTerritoryByProductId(purchase.productId);
    if (!territory) return;
    try {
      const verified =
        Platform.OS !== "ios" ||
        (await isTransactionVerifiedIOS(purchase.productId));
      if (!verified) throw new Error(t("store.unverified"));
      await finishTransaction({ purchase, isConsumable: false });
      setCachedEntitlements((current) => [
        ...new Set([...current, territory.id]),
      ]);
      setRecentPurchases((current) => [
        ...current.filter((item) => item.productId !== purchase.productId),
        purchase,
      ]);
      setActiveTerritoryId(territory.id);
      setStoreError(null);
      setStoreMessage(
        t("store.available", { territory: territoryName(territory) }),
      );
    } catch (error) {
      const message = readableStoreError(error, language);
      setStoreError(message);
      Alert.alert(t("store.completedTitle"), message);
    } finally {
      setIsPurchasing(false);
    }
  }, [language, t, territoryName]);

  const handlePurchaseError = useCallback((error: unknown) => {
    const message = readableStoreError(error, language);
    setIsPurchasing(false);
    setStoreError(message);
    if (!isUserCancelled(error)) {
      Alert.alert(t("store.completedTitle"), message);
    }
  }, [language, t]);

  const {
    connected,
    availablePurchases,
    getAvailablePurchases,
    requestPurchase,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: (purchase) => void handlePurchaseSuccess(purchase),
    onPurchaseError: handlePurchaseError,
    onError: (error) => setStoreError(readableStoreError(error, language)),
  });

  const fetchConfiguredProducts = useCallback(async () => {
    let storefront: string | null = null;
    let storefrontError: unknown = null;
    if (Platform.OS === "ios") {
      try {
        storefront = await getStorefront();
      } catch (error) {
        storefrontError = error;
      }
    }

    try {
      const fetched = ((await fetchStoreProducts({
        skus: [...CONFIGURED_COUNTRY_PRODUCT_IDS],
        type: "in-app",
      })) ?? []) as Product[];
      setStoreProducts(fetched);
      setStoreDiagnostics({
        storefront,
        requestedProductIds: CONFIGURED_COUNTRY_PRODUCT_IDS,
        returnedProductIds: fetched.map((product) => product.id),
        errorCode: storefrontError ? storeErrorCode(storefrontError) : null,
        errorMessage: storefrontError
          ? readableStoreError(storefrontError, language)
          : null,
        checkedAt: Date.now(),
      });
      return fetched;
    } catch (error) {
      setStoreProducts([]);
      setStoreDiagnostics({
        storefront,
        requestedProductIds: CONFIGURED_COUNTRY_PRODUCT_IDS,
        returnedProductIds: [],
        errorCode: storeErrorCode(error),
        errorMessage: readableStoreError(error, language),
        checkedAt: Date.now(),
      });
      throw error;
    }
  }, [language]);

  const refreshStoreCatalog = useCallback(async () => {
    if (!connected) {
      const message = t("store.notConnectedShort");
      setStoreError(message);
      setStoreDiagnostics((current) => ({
        ...current,
        errorCode: "not-connected",
        errorMessage: message,
        checkedAt: Date.now(),
      }));
      return;
    }
    setStoreLoaded(false);
    setStoreError(null);
    try {
      await fetchConfiguredProducts();
    } catch (error) {
      setStoreError(readableStoreError(error, language));
    } finally {
      setStoreLoaded(true);
    }
  }, [connected, fetchConfiguredProducts, language, t]);

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(ACTIVE_TERRITORY_KEY),
      AsyncStorage.getItem(ENTITLEMENTS_KEY),
    ]).then(([storedTerritory, storedEntitlements]) => {
      let restoredEntitlements: string[] = [];
      if (storedEntitlements) {
        try {
          const parsed = JSON.parse(storedEntitlements);
          if (Array.isArray(parsed)) {
            restoredEntitlements = parsed.filter(
              (value): value is string =>
                typeof value === "string" && Boolean(getTerritory(value)),
            );
            setCachedEntitlements(restoredEntitlements);
          }
        } catch {
          void AsyncStorage.removeItem(ENTITLEMENTS_KEY);
        }
      }
      if (
        storedTerritory &&
        getTerritory(storedTerritory) &&
        (storedTerritory === DEFAULT_TERRITORY.id ||
          restoredEntitlements.includes(storedTerritory))
      ) {
        setActiveTerritoryId(storedTerritory);
      }
      setStorageLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!connected) return;
    void Promise.all([refreshStoreCatalog(), getAvailablePurchases()])
      .catch((error) => setStoreError(readableStoreError(error, language)))
      .finally(() => setStoreLoaded(true));
  }, [
    connected,
    getAvailablePurchases,
    language,
    refreshStoreCatalog,
  ]);

  const storeEntitlements = useMemo(
    () =>
      availablePurchases.flatMap((purchase) => {
        if (!purchaseIsUsable(purchase)) return [];
        const territory = getTerritoryByProductId(purchase.productId);
        return territory ? [territory.id] : [];
      }),
    [availablePurchases],
  );

  const unlockedTerritoryIds = useMemo(
    () =>
      new Set([
        DEFAULT_TERRITORY.id,
        ...cachedEntitlements,
        ...storeEntitlements,
      ]),
    [cachedEntitlements, storeEntitlements],
  );

  useEffect(() => {
    if (!storageLoaded) return;
    void AsyncStorage.setItem(
      ENTITLEMENTS_KEY,
      JSON.stringify([...unlockedTerritoryIds].filter((id) => id !== DEFAULT_TERRITORY.id)),
    );
  }, [storageLoaded, unlockedTerritoryIds]);

  useEffect(() => {
    if (!storageLoaded || !unlockedTerritoryIds.has(activeTerritoryId)) return;
    void AsyncStorage.setItem(ACTIVE_TERRITORY_KEY, activeTerritoryId);
  }, [activeTerritoryId, storageLoaded, unlockedTerritoryIds]);

  const activeTerritory =
    getTerritory(activeTerritoryId) ?? DEFAULT_TERRITORY;
  const productById = useMemo(
    () =>
      new Map(
        storeProducts.map((product) => [product.id, product]),
      ),
    [storeProducts],
  );
  const purchaseByProductId = useMemo(
    () =>
      new Map(
        availablePurchases
          .concat(recentPurchases)
          .filter(purchaseIsUsable)
          .map((purchase) => [purchase.productId, purchase]),
      ),
    [availablePurchases, recentPurchases],
  );

  const isUnlocked = useCallback(
    (territory: Territory) => unlockedTerritoryIds.has(territory.id),
    [unlockedTerritoryIds],
  );

  const isPurchasable = useCallback(
    (territory: Territory) =>
      Boolean(
        !territory.free &&
          territory.productId &&
          productById.has(territory.productId),
      ),
    [productById],
  );

  const visibleTerritories = useMemo(
    () =>
      TERRITORIES.filter(
        (territory) =>
          territory.free ||
          unlockedTerritoryIds.has(territory.id) ||
          Boolean(
            territory.productId &&
              CONFIGURED_PRODUCT_ID_SET.has(territory.productId),
          ),
      ),
    [unlockedTerritoryIds],
  );

  const configuredProductMissing =
    storeLoaded &&
    CONFIGURED_COUNTRY_PRODUCT_IDS.some(
      (productId) => !productById.has(productId),
    );

  const displayPrice = useCallback(
    (territory: Territory) => {
      if (territory.free) return t("store.free");
      return (
        productById.get(territory.productId ?? "")?.displayPrice ??
        t("territories.comingSoon")
      );
    },
    [productById, t],
  );

  const purchaseToken = useCallback(
    (territory: Territory) =>
      purchaseByProductId.get(territory.productId ?? "")?.purchaseToken ?? null,
    [purchaseByProductId],
  );

  const selectTerritory = useCallback(
    async (territory: Territory) => {
      if (!unlockedTerritoryIds.has(territory.id)) return false;
      setActiveTerritoryId(territory.id);
      setStoreMessage(
        t("store.selected", { territory: territoryName(territory) }),
      );
      setStoreError(null);
      return true;
    },
    [t, territoryName, unlockedTerritoryIds],
  );

  const purchaseTerritory = useCallback(
    async (territory: Territory) => {
      if (territory.free || !territory.productId || isPurchasing) return;
      if (!connected) {
        const message = t("store.notConnected");
        setStoreError(message);
        Alert.alert(t("store.unavailableTitle"), message);
        return;
      }
      setIsPurchasing(true);
      setStoreError(null);
      const localizedName = territoryName(territory);
      setStoreMessage(
        t("store.checking", { territory: localizedName }),
      );
      try {
        let product = productById.get(territory.productId);
        if (!product) {
          const fetched = await fetchConfiguredProducts();
          const fetchedProduct = fetched.find(
            (item) => item.id === territory.productId,
          );
          product = fetchedProduct;
        }
        if (!product) {
          const message = t("store.productPending", {
            territory: localizedName,
          });
          setIsPurchasing(false);
          setStoreMessage(message);
          setStoreError(null);
          return;
        }
        setStoreMessage(null);
        await requestPurchase({
          request: {
            apple: { sku: territory.productId },
            google: { skus: [territory.productId] },
          },
          type: "in-app",
        });
      } catch (error) {
        const message = readableStoreError(error, language);
        setIsPurchasing(false);
        setStoreMessage(null);
        setStoreError(message);
        if (!isUserCancelled(error)) {
          Alert.alert(t("store.completedTitle"), message);
        }
      }
    },
    [
      connected,
      fetchConfiguredProducts,
      isPurchasing,
      language,
      productById,
      requestPurchase,
      t,
      territoryName,
    ],
  );

  const restoreCountryPurchases = useCallback(async () => {
    if (!connected) {
      setStoreError(t("store.notConnectedShort"));
      return;
    }
    setIsPurchasing(true);
    setStoreError(null);
    setStoreMessage(null);
    try {
      await restorePurchases();
      setStoreMessage(t("store.restored"));
    } catch (error) {
      setStoreError(readableStoreError(error, language));
    } finally {
      setIsPurchasing(false);
    }
  }, [connected, language, restorePurchases, t]);

  const value = useMemo<TerritoryContextValue>(
    () => ({
      territories: visibleTerritories,
      activeTerritory,
      unlockedTerritoryIds,
      connected,
      isLoading: !storageLoaded || (connected && !storeLoaded),
      isPurchasing,
      storeError,
      storeMessage,
      storeDiagnostics,
      configuredProductMissing,
      isUnlocked,
      isPurchasable,
      displayPrice,
      purchaseToken,
      selectTerritory,
      purchaseTerritory,
      refreshStoreCatalog,
      restoreCountryPurchases,
    }),
    [
      activeTerritory,
      connected,
      displayPrice,
      configuredProductMissing,
      isPurchasing,
      isPurchasable,
      isUnlocked,
      purchaseTerritory,
      purchaseToken,
      refreshStoreCatalog,
      restoreCountryPurchases,
      selectTerritory,
      storageLoaded,
      storeError,
      storeDiagnostics,
      storeLoaded,
      storeMessage,
      unlockedTerritoryIds,
      visibleTerritories,
    ],
  );

  return (
    <TerritoryContext.Provider value={value}>
      {children}
    </TerritoryContext.Provider>
  );
}

export function useTerritory(): TerritoryContextValue {
  const value = useContext(TerritoryContext);
  if (!value) {
    throw new Error("useTerritory deve essere usato dentro TerritoryProvider.");
  }
  return value;
}

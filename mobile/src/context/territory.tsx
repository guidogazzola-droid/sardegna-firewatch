import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchProducts as fetchStoreProducts,
  finishTransaction,
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
import {
  COUNTRY_PRODUCT_IDS,
  DEFAULT_TERRITORY,
  getTerritory,
  getTerritoryByProductId,
  TERRITORIES,
  type Territory,
} from "../lib/territories";

const ACTIVE_TERRITORY_KEY = "sabetta-piro-active-territory-v1";
const ENTITLEMENTS_KEY = "sabetta-piro-country-entitlements-v1";

interface TerritoryContextValue {
  territories: Territory[];
  activeTerritory: Territory;
  unlockedTerritoryIds: ReadonlySet<string>;
  connected: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  storeError: string | null;
  storeMessage: string | null;
  isUnlocked: (territory: Territory) => boolean;
  displayPrice: (territory: Territory) => string;
  purchaseToken: (territory: Territory) => string | null;
  selectTerritory: (territory: Territory) => Promise<boolean>;
  purchaseTerritory: (territory: Territory) => Promise<void>;
  restoreCountryPurchases: () => Promise<void>;
}

const TerritoryContext = createContext<TerritoryContextValue | null>(null);

function purchaseIsUsable(purchase: Purchase): boolean {
  return (
    purchase.purchaseState !== "pending" &&
    !("revocationDateIOS" in purchase && purchase.revocationDateIOS)
  );
}

function readableStoreError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code).includes("user-cancelled")
  ) {
    return "Acquisto annullato.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "App Store non disponibile. Riprova tra poco.";
}

export function TerritoryProvider({ children }: { children: ReactNode }) {
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
  const [productsFetchedOnDemand, setProductsFetchedOnDemand] = useState<
    Product[]
  >([]);

  const handlePurchaseSuccess = useCallback(async (purchase: Purchase) => {
    const territory = getTerritoryByProductId(purchase.productId);
    if (!territory) return;
    try {
      const verified =
        Platform.OS !== "ios" ||
        (await isTransactionVerifiedIOS(purchase.productId));
      if (!verified) throw new Error("Acquisto non verificato da App Store.");
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
      setStoreMessage(`${territory.name} è ora disponibile.`);
    } catch (error) {
      const message = readableStoreError(error);
      setStoreError(message);
      Alert.alert("Acquisto non completato", message);
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  const handlePurchaseError = useCallback((error: unknown) => {
    const message = readableStoreError(error);
    setIsPurchasing(false);
    setStoreError(message);
    if (message !== "Acquisto annullato.") {
      Alert.alert("Acquisto non completato", message);
    }
  }, []);

  const {
    connected,
    products,
    availablePurchases,
    fetchProducts: refreshProducts,
    getAvailablePurchases,
    requestPurchase,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: (purchase) => void handlePurchaseSuccess(purchase),
    onPurchaseError: handlePurchaseError,
    onError: (error) => setStoreError(readableStoreError(error)),
  });

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
    void Promise.all([
      refreshProducts({ skus: COUNTRY_PRODUCT_IDS, type: "in-app" }),
      getAvailablePurchases(),
    ])
      .catch((error) => setStoreError(readableStoreError(error)))
      .finally(() => setStoreLoaded(true));
  }, [connected, getAvailablePurchases, refreshProducts]);

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
        products
          .concat(productsFetchedOnDemand)
          .map((product) => [product.id, product]),
      ),
    [products, productsFetchedOnDemand],
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

  const displayPrice = useCallback(
    (territory: Territory) => {
      if (territory.free) return "Gratis";
      return productById.get(territory.productId ?? "")?.displayPrice ?? "CHF 5";
    },
    [productById],
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
      setStoreMessage(`${territory.name} selezionata.`);
      setStoreError(null);
      return true;
    },
    [unlockedTerritoryIds],
  );

  const purchaseTerritory = useCallback(
    async (territory: Territory) => {
      if (territory.free || !territory.productId || isPurchasing) return;
      if (!connected) {
        const message =
          "App Store non è collegato. Controlla la connessione e riprova.";
        setStoreError(message);
        Alert.alert("Acquisto non disponibile", message);
        return;
      }
      setIsPurchasing(true);
      setStoreError(null);
      setStoreMessage(`Verifica disponibilità di ${territory.name}…`);
      try {
        let product = productById.get(territory.productId);
        if (!product) {
          const fetched = ((await fetchStoreProducts({
            skus: [territory.productId],
            type: "in-app",
          })) ?? []) as Product[];
          const fetchedProduct = fetched.find(
            (item) => item.id === territory.productId,
          );
          product = fetchedProduct;
          if (fetchedProduct) {
            setProductsFetchedOnDemand((current) => [
              ...current.filter((item) => item.id !== fetchedProduct.id),
              fetchedProduct,
            ]);
          }
        }
        if (!product) {
          const message =
            `${territory.name} non è ancora disponibile su App Store. ` +
            "La configurazione del prodotto potrebbe essere ancora in elaborazione.";
          setIsPurchasing(false);
          setStoreMessage(null);
          setStoreError(message);
          Alert.alert("Acquisto non disponibile", message);
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
        const message = readableStoreError(error);
        setIsPurchasing(false);
        setStoreMessage(null);
        setStoreError(message);
        if (message !== "Acquisto annullato.") {
          Alert.alert("Acquisto non completato", message);
        }
      }
    },
    [connected, isPurchasing, productById, requestPurchase],
  );

  const restoreCountryPurchases = useCallback(async () => {
    if (!connected) {
      setStoreError("App Store non è ancora collegato.");
      return;
    }
    setIsPurchasing(true);
    setStoreError(null);
    setStoreMessage(null);
    try {
      await restorePurchases();
      setStoreMessage("Acquisti ripristinati.");
    } catch (error) {
      setStoreError(readableStoreError(error));
    } finally {
      setIsPurchasing(false);
    }
  }, [connected, restorePurchases]);

  const value = useMemo<TerritoryContextValue>(
    () => ({
      territories: TERRITORIES,
      activeTerritory,
      unlockedTerritoryIds,
      connected,
      isLoading: !storageLoaded || (connected && !storeLoaded),
      isPurchasing,
      storeError,
      storeMessage,
      isUnlocked,
      displayPrice,
      purchaseToken,
      selectTerritory,
      purchaseTerritory,
      restoreCountryPurchases,
    }),
    [
      activeTerritory,
      connected,
      displayPrice,
      isPurchasing,
      isUnlocked,
      purchaseTerritory,
      purchaseToken,
      restoreCountryPurchases,
      selectTerritory,
      storageLoaded,
      storeError,
      storeLoaded,
      storeMessage,
      unlockedTerritoryIds,
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

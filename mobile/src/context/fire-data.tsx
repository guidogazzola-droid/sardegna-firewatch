import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_REFRESH_SECONDS } from "../lib/config";
import { fetchFireFeed, fetchSystemStatus } from "../lib/api";
import type { FireDetection, FireFeedResponse, SystemStatusResponse } from "../lib/types";

interface RefreshOptions {
  initial?: boolean;
}

interface FireDataContextValue {
  status: SystemStatusResponse | null;
  feed: FireFeedResponse | null;
  fires: FireDetection[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLimitedMode: boolean;
  error: string | null;
  lastSuccessfulAt: string | null;
  refresh: () => Promise<void>;
}

const FireDataContext = createContext<FireDataContextValue | null>(null);

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Aggiornamento non riuscito. Riprova tra poco.";
}

export function FireDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [feed, setFeed] = useState<FireFeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<string | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const hasLoaded = useRef(false);

  const load = useCallback(async ({ initial = false }: RefreshOptions = {}) => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;

    if (initial || !hasLoaded.current) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [nextStatus, nextFeed] = await Promise.all([
        fetchSystemStatus(controller.signal),
        fetchFireFeed({ days: 1, sources: "viirs", signal: controller.signal }),
      ]);

      if (activeController.current !== controller) return;
      setStatus(nextStatus);
      setFeed(nextFeed);
      setError(null);
      setLastSuccessfulAt(new Date().toISOString());
      hasLoaded.current = true;
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      if (activeController.current !== controller) return;
      setError(errorMessage(loadError));
    } finally {
      if (activeController.current === controller) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load({ initial: true });
    const interval = setInterval(() => {
      void load();
    }, DEFAULT_REFRESH_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      activeController.current?.abort();
    };
  }, [load]);

  const value = useMemo<FireDataContextValue>(
    () => ({
      status,
      feed,
      fires: feed?.fires ?? [],
      isLoading,
      isRefreshing,
      isLimitedMode: status?.firmsConfigured === false || feed?.configured === false,
      error,
      lastSuccessfulAt,
      refresh: () => load(),
    }),
    [error, feed, isLoading, isRefreshing, lastSuccessfulAt, load, status],
  );

  return <FireDataContext.Provider value={value}>{children}</FireDataContext.Provider>;
}

export function useFireData(): FireDataContextValue {
  const value = useContext(FireDataContext);
  if (!value) throw new Error("useFireData deve essere usato dentro FireDataProvider.");
  return value;
}

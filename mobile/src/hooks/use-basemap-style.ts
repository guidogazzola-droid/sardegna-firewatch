import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { FALLBACK_MAP_STYLE_URL } from "../lib/map-styles";

type MapStyleValue = string | StyleSpecification;

interface ArcGisErrorPayload {
  error?: {
    code?: number;
    message?: string;
    details?: string[];
  };
}

export interface BasemapStyleState {
  mapStyle: MapStyleValue;
  loading: boolean;
  usingFallback: boolean;
  error: string | null;
  reload: () => void;
  handleNativeFailure: () => void;
}

function safeArcGisError(payload: unknown, status: number): string {
  const candidate = payload as ArcGisErrorPayload;
  const code = candidate?.error?.code ?? status;
  if (code === 498 || code === 499 || status === 401 || status === 403) {
    return "ArcGIS non ha autorizzato la mappa. Verifica che la chiave sia quella generata, che disponga del privilegio Basemap styles service e che sia stata rigenerata dopo eventuali modifiche ai privilegi.";
  }
  if (candidate?.error?.message) {
    return `ArcGIS non ha caricato la mappa (codice ${code}).`;
  }
  return `Servizio cartografico non disponibile (HTTP ${status}).`;
}

function isStyleSpecification(payload: unknown): payload is StyleSpecification {
  if (!payload || typeof payload !== "object") return false;
  const style = payload as Partial<StyleSpecification>;
  return style.version === 8 && Array.isArray(style.layers) && Boolean(style.sources);
}

export function useBasemapStyle(
  arcgisStyleUrl: string,
  arcgisConfigured: boolean,
): BasemapStyleState {
  const [mapStyle, setMapStyle] = useState<MapStyleValue>(FALLBACK_MAP_STYLE_URL);
  const [loading, setLoading] = useState(arcgisConfigured);
  const [usingFallback, setUsingFallback] = useState(!arcgisConfigured);
  const [error, setError] = useState<string | null>(
    arcgisConfigured ? null : "Chiave ArcGIS non configurata: viene usata la mappa OpenFreeMap.",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const requestSequence = useRef(0);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  const handleNativeFailure = useCallback(() => {
    if (usingFallback) return;
    setMapStyle(FALLBACK_MAP_STYLE_URL);
    setUsingFallback(true);
    setLoading(false);
    setError(
      "Lo stile ArcGIS è stato ricevuto, ma il motore cartografico non è riuscito a visualizzarlo. È stata attivata automaticamente la mappa OpenFreeMap.",
    );
  }, [usingFallback]);

  useEffect(() => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;

    if (!arcgisConfigured) {
      setMapStyle(FALLBACK_MAP_STYLE_URL);
      setUsingFallback(true);
      setLoading(false);
      setError("Chiave ArcGIS non configurata: viene usata la mappa OpenFreeMap.");
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(arcgisStyleUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload = (await response.json()) as unknown;
        if (!response.ok || (payload as ArcGisErrorPayload)?.error) {
          throw new Error(safeArcGisError(payload, response.status));
        }
        if (!isStyleSpecification(payload)) {
          throw new Error("ArcGIS ha restituito uno stile cartografico non valido.");
        }
        if (requestSequence.current !== sequence) return;
        setMapStyle(payload);
        setUsingFallback(false);
        setError(null);
      } catch (loadError) {
        if (requestSequence.current !== sequence) return;
        const message =
          loadError instanceof Error && loadError.name === "AbortError"
            ? "ArcGIS non ha risposto entro 15 secondi. È stata attivata la mappa OpenFreeMap."
            : loadError instanceof Error
              ? loadError.message
              : "ArcGIS non ha caricato la mappa.";
        setMapStyle(FALLBACK_MAP_STYLE_URL);
        setUsingFallback(true);
        setError(message);
      } finally {
        clearTimeout(timeout);
        if (requestSequence.current === sequence) setLoading(false);
      }
    })();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [arcgisConfigured, arcgisStyleUrl, reloadKey]);

  return {
    mapStyle,
    loading,
    usingFallback,
    error,
    reload,
    handleNativeFailure,
  };
}

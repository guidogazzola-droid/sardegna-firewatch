import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCloudForecast, fetchWindGrid } from "../lib/api";
import { SARDINIA_BOUNDS } from "../lib/config";
import type { CloudFrame, GeoBounds, WindSample } from "../lib/types";

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export interface WeatherLayersState {
  windSamples: WindSample[];
  cloudFrames: CloudFrame[];
  cloudFrameIndex: number;
  activeCloudFrame: CloudFrame | null;
  isWindLoading: boolean;
  isCloudLoading: boolean;
  windError: string | null;
  cloudError: string | null;
  isCloudPlaying: boolean;
  loadWind: (bounds?: GeoBounds) => Promise<void>;
  loadClouds: (options?: { preserveFrame?: boolean }) => Promise<void>;
  setCloudFrameIndex: (index: number) => void;
  toggleCloudPlayback: () => void;
  stopCloudPlayback: () => void;
}

export function useWeatherLayers(): WeatherLayersState {
  const [windSamples, setWindSamples] = useState<WindSample[]>([]);
  const [cloudFrames, setCloudFrames] = useState<CloudFrame[]>([]);
  const [cloudFrameIndex, setCloudFrameIndexState] = useState(0);
  const [isWindLoading, setIsWindLoading] = useState(true);
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [windError, setWindError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isCloudPlaying, setIsCloudPlaying] = useState(false);
  const windController = useRef<AbortController | null>(null);
  const cloudController = useRef<AbortController | null>(null);

  const loadWind = useCallback(async (bounds: GeoBounds = SARDINIA_BOUNDS) => {
    windController.current?.abort();
    const controller = new AbortController();
    windController.current = controller;
    setIsWindLoading(true);

    try {
      const payload = await fetchWindGrid({
        bounds,
        rows: 4,
        columns: 5,
        signal: controller.signal,
      });
      if (windController.current !== controller) return;
      setWindSamples(Array.isArray(payload.samples) ? payload.samples : []);
      setWindError(null);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (windController.current !== controller) return;
      setWindError(readableError(error, "Vento temporaneamente non disponibile."));
    } finally {
      if (windController.current === controller) setIsWindLoading(false);
    }
  }, []);

  const loadClouds = useCallback(
    async ({ preserveFrame = false }: { preserveFrame?: boolean } = {}) => {
      cloudController.current?.abort();
      const controller = new AbortController();
      cloudController.current = controller;
      setIsCloudLoading(true);

      try {
        const payload = await fetchCloudForecast(controller.signal);
        if (cloudController.current !== controller) return;
        const nextFrames = Array.isArray(payload.frames) ? payload.frames : [];
        setCloudFrames(nextFrames);
        setCloudError(null);
        setCloudFrameIndexState((current) => {
          if (!preserveFrame || !nextFrames.length) return 0;
          return Math.min(current, nextFrames.length - 1);
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (cloudController.current !== controller) return;
        setCloudError(readableError(error, "Nuvolosita temporaneamente non disponibile."));
      } finally {
        if (cloudController.current === controller) setIsCloudLoading(false);
      }
    },
    [],
  );

  const setCloudFrameIndex = useCallback(
    (index: number) => {
      setIsCloudPlaying(false);
      setCloudFrameIndexState(() => {
        if (!cloudFrames.length) return 0;
        return Math.min(cloudFrames.length - 1, Math.max(0, Math.round(index)));
      });
    },
    [cloudFrames.length],
  );

  const toggleCloudPlayback = useCallback(() => {
    if (cloudFrames.length < 2) return;
    setIsCloudPlaying((value) => !value);
  }, [cloudFrames.length]);

  const stopCloudPlayback = useCallback(() => setIsCloudPlaying(false), []);

  useEffect(() => {
    void loadWind();
    void loadClouds();
    return () => {
      windController.current?.abort();
      cloudController.current?.abort();
    };
  }, [loadClouds, loadWind]);

  useEffect(() => {
    if (!isCloudPlaying || cloudFrames.length < 2) return undefined;
    const timer = setInterval(() => {
      setCloudFrameIndexState((current) => (current + 1) % cloudFrames.length);
    }, 900);
    return () => clearInterval(timer);
  }, [cloudFrames.length, isCloudPlaying]);

  return {
    windSamples,
    cloudFrames,
    cloudFrameIndex,
    activeCloudFrame: cloudFrames[cloudFrameIndex] ?? null,
    isWindLoading,
    isCloudLoading,
    windError,
    cloudError,
    isCloudPlaying,
    loadWind,
    loadClouds,
    setCloudFrameIndex,
    toggleCloudPlayback,
    stopCloudPlayback,
  };
}

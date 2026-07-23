import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFireData } from "../../src/context/fire-data";
import { useWeatherLayers } from "../../src/hooks/use-weather-layers";
import { fetchWindHistory } from "../../src/lib/api";
import {
  SARDINIA_BOUNDS,
  SARDINIA_CENTER,
  SARDINIA_INITIAL_ZOOM,
} from "../../src/lib/config";
import {
  confidenceLabel,
  formatAge,
  formatCoordinate,
  formatObservation,
  severityLabel,
} from "../../src/lib/format";
import {
  ARCGIS_BASEMAPS_CONFIGURED,
  BASE_MAPS,
  DEFAULT_BASE_MAP_ID,
  FALLBACK_MAP_ATTRIBUTION,
  type BaseMapId,
} from "../../src/lib/map-styles";
import type {
  FireDetection,
  GeoBounds,
  WindHistoryResponse,
} from "../../src/lib/types";
import { severityColors, spacing, useAppTheme } from "../../src/theme";

const BASE_MAP_ORDER: BaseMapId[] = ["satellite", "topographic", "street"];

function clampBounds(bounds: [number, number, number, number]): GeoBounds | null {
  const [west, south, east, north] = bounds;
  const clipped = {
    west: Math.max(west, SARDINIA_BOUNDS.west),
    south: Math.max(south, SARDINIA_BOUNDS.south),
    east: Math.min(east, SARDINIA_BOUNDS.east),
    north: Math.min(north, SARDINIA_BOUNDS.north),
  };
  return clipped.east > clipped.west && clipped.north > clipped.south ? clipped : null;
}

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export default function MapScreen() {
  const theme = useAppTheme();
  const mapRef = useRef<MapRef | null>(null);
  const windRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyController = useRef<AbortController | null>(null);
  const [baseMapId, setBaseMapId] = useState<BaseMapId>(DEFAULT_BASE_MAP_ID);
  const [windEnabled, setWindEnabled] = useState(true);
  const [cloudEnabled, setCloudEnabled] = useState(true);
  const [selectedFire, setSelectedFire] = useState<FireDetection | null>(null);
  const [history, setHistory] = useState<WindHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const {
    feed,
    fires,
    error,
    isLoading,
    isRefreshing,
    isLimitedMode,
    lastSuccessfulAt,
    refresh,
  } = useFireData();

  const {
    windSamples,
    cloudFrames,
    cloudFrameIndex,
    activeCloudFrame,
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
  } = useWeatherLayers();

  const visibleFires = fires.slice(0, 100);
  const baseMap = BASE_MAPS[baseMapId];

  const cloudGeoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features:
        cloudEnabled && activeCloudFrame
          ? activeCloudFrame.samples
              .filter((sample) => Number.isFinite(sample.cover) && sample.cover >= 8)
              .map((sample, index) => ({
                type: "Feature" as const,
                id: `cloud-${index}`,
                properties: {
                  cover: sample.cover,
                  low: sample.low ?? 0,
                  mid: sample.mid ?? 0,
                  high: sample.high ?? 0,
                },
                geometry: {
                  type: "Point" as const,
                  coordinates: [sample.longitude, sample.latitude],
                },
              }))
          : [],
    }),
    [activeCloudFrame, cloudEnabled],
  );

  const smokeGeoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => {
    if (!history?.smokeTrack?.length) return emptyFeatureCollection() as GeoJSON.FeatureCollection<GeoJSON.LineString>;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: history.smokeTrack.map(([latitude, longitude]) => [longitude, latitude]),
          },
        },
      ],
    };
  }, [history]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refresh(),
      loadWind(),
      loadClouds({ preserveFrame: true }),
    ]);
  }, [loadClouds, loadWind, refresh]);

  const scheduleWindRefresh = useCallback(
    (rawBounds: [number, number, number, number]) => {
      if (!windEnabled) return;
      const bounds = clampBounds(rawBounds);
      if (!bounds) return;
      if (windRefreshTimer.current) clearTimeout(windRefreshTimer.current);
      windRefreshTimer.current = setTimeout(() => {
        void loadWind(bounds);
      }, 450);
    },
    [loadWind, windEnabled],
  );

  const selectBaseMap = useCallback((id: BaseMapId) => {
    if (!ARCGIS_BASEMAPS_CONFIGURED) return;
    setBaseMapId(id);
  }, []);

  const selectFire = useCallback((fire: FireDetection) => {
    historyController.current?.abort();
    setSelectedFire(fire);
    setHistory(null);
    setHistoryError(null);
    setHistoryLoading(false);
  }, []);

  const closeFire = useCallback(() => {
    historyController.current?.abort();
    setSelectedFire(null);
    setHistory(null);
    setHistoryError(null);
    setHistoryLoading(false);
  }, []);

  const analyzeSelectedFire = useCallback(async () => {
    if (!selectedFire || historyLoading) return;
    historyController.current?.abort();
    const controller = new AbortController();
    historyController.current = controller;
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const result = await fetchWindHistory({
        latitude: selectedFire.latitude,
        longitude: selectedFire.longitude,
        startAt: selectedFire.estimatedStartAt || selectedFire.observedAt,
        signal: controller.signal,
      });
      if (historyController.current !== controller) return;
      setHistory(result);
    } catch (analysisError) {
      if (analysisError instanceof Error && analysisError.name === "AbortError") return;
      if (historyController.current !== controller) return;
      setHistoryError(
        analysisError instanceof Error
          ? analysisError.message
          : "Analisi del vento temporaneamente non disponibile.",
      );
    } finally {
      if (historyController.current === controller) setHistoryLoading(false);
    }
  }, [historyLoading, selectedFire]);

  useEffect(
    () => () => {
      if (windRefreshTimer.current) clearTimeout(windRefreshTimer.current);
      historyController.current?.abort();
    },
    [],
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>SARDEGNA</Text>
          <Text style={[styles.title, { color: theme.text }]}>Sardinia FireWatch</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Incendi, vento e nuvolosita in un'unica vista</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aggiorna tutti i dati"
          disabled={isRefreshing || isWindLoading || isCloudLoading}
          onPress={() => void refreshAll()}
          style={({ pressed }) => [
            styles.refreshButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {isRefreshing || isWindLoading || isCloudLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <Text style={[styles.refreshText, { color: theme.accent }]}>↻</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <StatusBanner text={error} tone="error" />
      ) : isLimitedMode ? (
        <StatusBanner
          text="Feed puntuale NASA FIRMS limitato; vento e nuvolosita restano consultabili."
          tone="warning"
        />
      ) : (
        <StatusBanner
          text={
            lastSuccessfulAt
              ? `Dati aggiornati ${formatObservation(lastSuccessfulAt)}`
              : "Connessione alle fonti in corso"
          }
          tone="ok"
        />
      )}

      <View style={styles.layerToolbar}>
        <View style={[styles.segmentedControl, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {BASE_MAP_ORDER.map((id) => {
            const definition = BASE_MAPS[id];
            const active = id === baseMapId;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !definition.available }}
                disabled={!definition.available}
                onPress={() => selectBaseMap(id)}
                style={[
                  styles.segment,
                  active && { backgroundColor: theme.accentSoft },
                  !definition.available && styles.disabledControl,
                ]}
              >
                <Text style={[styles.segmentLabel, { color: active ? theme.accent : theme.textMuted }]}>
                  {definition.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <LayerToggle
          label="Vento"
          symbol="↗"
          active={windEnabled}
          busy={isWindLoading}
          onPress={() => setWindEnabled((value) => !value)}
        />
        <LayerToggle
          label="Nuvole"
          symbol="☁"
          active={cloudEnabled}
          busy={isCloudLoading}
          onPress={() => {
            setCloudEnabled((value) => {
              if (value) stopCloudPlayback();
              return !value;
            });
          }}
        />
      </View>

      {!ARCGIS_BASEMAPS_CONFIGURED ? (
        <Text style={[styles.configurationNotice, { color: theme.warning }]}>
          Basemap professionali non ancora configurate: la build di sviluppo usa la mappa di riserva.
        </Text>
      ) : null}

      <View style={[styles.mapFrame, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
        <Map
          key={baseMapId}
          ref={mapRef}
          style={styles.map}
          mapStyle={baseMap.style}
          attribution
          attributionPosition={{ bottom: 8, right: 8 }}
          compass
          compassPosition={{ top: 10, right: 10 }}
          scaleBar
          scaleBarPosition={{ bottom: 10, left: 10 }}
          onRegionDidChange={(event) => scheduleWindRefresh(event.nativeEvent.bounds)}
        >
          <Camera
            initialViewState={{
              center: SARDINIA_CENTER,
              zoom: SARDINIA_INITIAL_ZOOM,
            }}
          />

          {cloudEnabled && cloudGeoJson.features.length ? (
            <GeoJSONSource id="cloud-cover" data={cloudGeoJson}>
              <Layer
                id="cloud-cover-circles"
                type="circle"
                paint={{
                  "circle-color": "#eef5f8",
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["get", "cover"],
                    8,
                    16,
                    100,
                    48,
                  ],
                  "circle-opacity": [
                    "interpolate",
                    ["linear"],
                    ["get", "cover"],
                    8,
                    0.08,
                    100,
                    0.58,
                  ],
                  "circle-blur": 0.75,
                  "circle-stroke-width": 0,
                }}
              />
            </GeoJSONSource>
          ) : null}

          {history?.smokeTrack?.length ? (
            <GeoJSONSource id="smoke-track" data={smokeGeoJson}>
              <Layer
                id="smoke-track-line"
                type="line"
                paint={{
                  "line-color": "#7e6bc4",
                  "line-width": 5,
                  "line-opacity": 0.9,
                  "line-dasharray": [1.5, 1.2],
                }}
              />
            </GeoJSONSource>
          ) : null}

          {windEnabled
            ? windSamples.map((sample, index) => (
                <Marker
                  key={`wind-${index}`}
                  id={`wind-${index}`}
                  lngLat={[sample.longitude, sample.latitude]}
                  anchor="center"
                >
                  <View collapsable={false} style={styles.windMarker}>
                    <View
                      style={[
                        styles.windArrowContainer,
                        {
                          backgroundColor:
                            sample.speed >= 65
                              ? "#971f1fdd"
                              : sample.speed >= 40
                                ? "#c35c1bdd"
                                : "#123c52dd",
                          transform: [{ rotate: `${sample.directionTo}deg` }],
                        },
                      ]}
                    >
                      <Text style={styles.windArrow}>↑</Text>
                    </View>
                    <Text style={styles.windSpeed}>{Math.round(sample.speed)}</Text>
                  </View>
                </Marker>
              ))
            : null}

          {visibleFires.map((fire) => (
            <Marker
              key={fire.id}
              id={fire.id}
              lngLat={[fire.longitude, fire.latitude]}
              onPress={() => selectFire(fire)}
            >
              <View
                collapsable={false}
                style={[
                  styles.marker,
                  {
                    backgroundColor: severityColors[fire.severity],
                    borderColor: theme.surface,
                  },
                  selectedFire?.id === fire.id && styles.selectedMarker,
                ]}
              />
            </Marker>
          ))}
        </Map>

        {isLoading ? (
          <View style={[styles.loadingOverlay, { backgroundColor: `${theme.background}d9` }]}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.text }]}>Caricamento della mappa...</Text>
          </View>
        ) : null}

        <View style={[styles.mapAttribution, { backgroundColor: `${theme.surface}df` }]}>
          <Text style={[styles.mapAttributionText, { color: theme.textMuted }]} numberOfLines={1}>
            {ARCGIS_BASEMAPS_CONFIGURED ? baseMap.attribution : FALLBACK_MAP_ATTRIBUTION}
          </Text>
        </View>

        <View style={[styles.legend, { backgroundColor: `${theme.surface}ee`, borderColor: theme.border }]}>
          <View style={[styles.legendDot, { backgroundColor: severityColors.high }]} />
          <Text style={[styles.legendText, { color: theme.text }]}>Rilevazioni</Text>
          {windEnabled ? <Text style={[styles.legendText, { color: theme.text }]}>↗ vento km/h</Text> : null}
          {cloudEnabled ? <Text style={[styles.legendText, { color: theme.text }]}>☁ previsione</Text> : null}
        </View>

        {selectedFire ? (
          <FirePanel
            fire={selectedFire}
            history={history}
            loading={historyLoading}
            error={historyError}
            onAnalyze={() => void analyzeSelectedFire()}
            onClose={closeFire}
          />
        ) : null}
      </View>

      {cloudEnabled ? (
        <CloudTimeline
          frameCount={cloudFrames.length}
          frameIndex={cloudFrameIndex}
          frameTime={activeCloudFrame?.time ?? null}
          averageCover={activeCloudFrame?.averageCover ?? null}
          playing={isCloudPlaying}
          loading={isCloudLoading}
          error={cloudError}
          onPrevious={() => setCloudFrameIndex(cloudFrameIndex - 1)}
          onNext={() => setCloudFrameIndex(cloudFrameIndex + 1)}
          onToggle={toggleCloudPlayback}
        />
      ) : null}

      {windError ? <Text style={[styles.inlineError, { color: theme.warning }]}>{windError}</Text> : null}

      <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SummaryMetric label="Rilevazioni" value={String(feed?.stats.total ?? 0)} />
        <SummaryMetric
          label="Vento"
          value={windSamples.length ? `${Math.round(windSamples[0]?.speed ?? 0)} km/h` : "n.d."}
        />
        <SummaryMetric
          label="Nuvole"
          value={activeCloudFrame ? `${activeCloudFrame.averageCover}%` : "n.d."}
        />
      </View>
    </SafeAreaView>
  );
}

function LayerToggle({
  label,
  symbol,
  active,
  busy,
  onPress,
}: {
  label: string;
  symbol: string;
  active: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[
        styles.layerToggle,
        {
          backgroundColor: active ? theme.accentSoft : theme.surface,
          borderColor: active ? `${theme.accent}66` : theme.border,
        },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={theme.accent} /> : <Text style={[styles.layerSymbol, { color: active ? theme.accent : theme.textMuted }]}>{symbol}</Text>}
      <Text style={[styles.layerLabel, { color: active ? theme.accent : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function CloudTimeline({
  frameCount,
  frameIndex,
  frameTime,
  averageCover,
  playing,
  loading,
  error,
  onPrevious,
  onNext,
  onToggle,
}: {
  frameCount: number;
  frameIndex: number;
  frameTime: string | null;
  averageCover: number | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.cloudTimeline, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fotogramma nuvole precedente"
        disabled={!frameCount || frameIndex <= 0}
        onPress={onPrevious}
        style={styles.timelineButton}
      >
        <Text style={[styles.timelineButtonText, { color: frameIndex > 0 ? theme.accent : theme.textMuted }]}>‹</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Metti in pausa le nuvole" : "Avvia animazione nuvole"}
        disabled={frameCount < 2}
        onPress={onToggle}
        style={[styles.playButton, { backgroundColor: theme.accentSoft }]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Text style={[styles.playText, { color: theme.accent }]}>{playing ? "Ⅱ" : "▶"}</Text>
        )}
      </Pressable>
      <View style={styles.timelineText}>
        <Text style={[styles.timelineTitle, { color: theme.text }]}>
          {frameTime ? formatObservation(frameTime) : "Nuvolosita non disponibile"}
        </Text>
        <Text style={[styles.timelineMeta, { color: error ? theme.warning : theme.textMuted }]} numberOfLines={1}>
          {error ?? (averageCover === null ? "Previsione modellata" : `Copertura media ${averageCover}% · ${frameIndex + 1}/${frameCount}`)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fotogramma nuvole successivo"
        disabled={!frameCount || frameIndex >= frameCount - 1}
        onPress={onNext}
        style={styles.timelineButton}
      >
        <Text style={[styles.timelineButtonText, { color: frameIndex < frameCount - 1 ? theme.accent : theme.textMuted }]}>›</Text>
      </Pressable>
    </View>
  );
}

function FirePanel({
  fire,
  history,
  loading,
  error,
  onAnalyze,
  onClose,
}: {
  fire: FireDetection;
  history: WindHistoryResponse | null;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.firePanel, { backgroundColor: `${theme.surface}f5`, borderColor: theme.border }]}>
      <View style={styles.firePanelHeader}>
        <View style={styles.firePanelTitleBlock}>
          <Text style={[styles.firePanelEyebrow, { color: severityColors[fire.severity] }]}>
            {severityLabel(fire.severity)}
          </Text>
          <Text style={[styles.firePanelTitle, { color: theme.text }]}>Rilevazione termica</Text>
          <Text style={[styles.firePanelMeta, { color: theme.textMuted }]}>
            {formatObservation(fire.observedAt)} · {formatAge(fire.ageMinutes)}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Chiudi dettaglio" onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeButtonText, { color: theme.textMuted }]}>×</Text>
        </Pressable>
      </View>
      <Text style={[styles.firePanelBody, { color: theme.textMuted }]}>
        {fire.instrument || fire.source} · affidabilita {confidenceLabel(fire.confidence)} · {formatCoordinate(fire.latitude)}, {formatCoordinate(fire.longitude)}
      </Text>
      {history ? (
        <View style={[styles.smokeSummary, { backgroundColor: `${theme.accent}12` }]}>
          <Text style={[styles.smokeSummaryTitle, { color: theme.text }]}>Deriva indicativa del fumo</Text>
          <Text style={[styles.smokeSummaryValue, { color: theme.accent }]}>verso {history.summary.smokeToLabel} · vento medio {history.summary.averageSpeed} km/h</Text>
          <Text style={[styles.smokeSummaryNote, { color: theme.textMuted }]}>
            Stima semplificata, non modello di dispersione e non previsione ufficiale.
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={onAnalyze}
          style={[styles.analyzeButton, { backgroundColor: theme.accent }]}
        >
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.analyzeButtonText}>Analizza vento e fumo</Text>}
        </Pressable>
      )}
      {error ? <Text style={[styles.firePanelError, { color: theme.warning }]}>{error}</Text> : null}
    </View>
  );
}

function StatusBanner({ text, tone }: { text: string; tone: "ok" | "warning" | "error" }) {
  const theme = useAppTheme();
  const toneColor = tone === "error" ? theme.danger : tone === "warning" ? theme.warning : theme.success;
  return (
    <View style={[styles.statusBanner, { backgroundColor: `${toneColor}18`, borderColor: `${toneColor}55` }]}>
      <View style={[styles.statusDot, { backgroundColor: toneColor }]} />
      <Text style={[styles.statusText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.summaryMetric}>
      <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", paddingTop: spacing.sm, gap: spacing.md },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 23, lineHeight: 28, fontWeight: "800" },
  subtitle: { fontSize: 12, lineHeight: 17 },
  refreshButton: { width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  refreshText: { fontSize: 26, lineHeight: 29, fontWeight: "600" },
  statusBanner: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 11, lineHeight: 16 },
  layerToolbar: { flexDirection: "row", gap: 7, alignItems: "center" },
  segmentedControl: { flex: 1, flexDirection: "row", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 3 },
  segment: { flex: 1, minHeight: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segmentLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  disabledControl: { opacity: 0.35 },
  layerToggle: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9 },
  layerSymbol: { fontSize: 15, fontWeight: "800" },
  layerLabel: { fontSize: 10, fontWeight: "800" },
  configurationNotice: { fontSize: 10, lineHeight: 14 },
  mapFrame: { flex: 1, minHeight: 285, overflow: "hidden", borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  map: { flex: 1 },
  marker: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  selectedMarker: { width: 25, height: 25, borderRadius: 13, borderWidth: 5 },
  windMarker: { alignItems: "center", justifyContent: "center" },
  windArrowContainer: { width: 29, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#ffffffcc" },
  windArrow: { color: "#ffffff", fontSize: 21, lineHeight: 23, fontWeight: "900" },
  windSpeed: { marginTop: -2, minWidth: 27, color: "#ffffff", backgroundColor: "#122b38dd", borderRadius: 7, overflow: "hidden", textAlign: "center", paddingHorizontal: 4, paddingVertical: 1, fontSize: 9, fontWeight: "800" },
  loadingOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingText: { fontSize: 14, fontWeight: "600" },
  mapAttribution: { position: "absolute", right: 8, bottom: 42, maxWidth: "70%", borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3 },
  mapAttributionText: { fontSize: 8, lineHeight: 10 },
  legend: { position: "absolute", left: 9, bottom: 9, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9, paddingVertical: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 9, fontWeight: "700" },
  cloudTimeline: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 7 },
  timelineButton: { width: 30, height: 38, alignItems: "center", justifyContent: "center" },
  timelineButtonText: { fontSize: 28, lineHeight: 30, fontWeight: "500" },
  playButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  playText: { fontSize: 15, fontWeight: "900" },
  timelineText: { flex: 1 },
  timelineTitle: { fontSize: 12, fontWeight: "800" },
  timelineMeta: { fontSize: 10, lineHeight: 14 },
  firePanel: { position: "absolute", left: 9, right: 9, top: 9, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  firePanelHeader: { flexDirection: "row", alignItems: "flex-start" },
  firePanelTitleBlock: { flex: 1 },
  firePanelEyebrow: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  firePanelTitle: { fontSize: 16, fontWeight: "800" },
  firePanelMeta: { fontSize: 10, lineHeight: 14 },
  firePanelBody: { fontSize: 10, lineHeight: 14 },
  closeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeButtonText: { fontSize: 25, lineHeight: 27 },
  analyzeButton: { minHeight: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  analyzeButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  firePanelError: { fontSize: 10, lineHeight: 14 },
  smokeSummary: { borderRadius: 12, padding: 9, gap: 2 },
  smokeSummaryTitle: { fontSize: 10, fontWeight: "800" },
  smokeSummaryValue: { fontSize: 12, fontWeight: "900" },
  smokeSummaryNote: { fontSize: 9, lineHeight: 13 },
  inlineError: { fontSize: 10, lineHeight: 14 },
  summary: { flexDirection: "row", gap: spacing.sm, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, marginBottom: spacing.xs },
  summaryMetric: { flex: 1, gap: 2 },
  summaryLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4 },
  summaryValue: { fontSize: 13, fontWeight: "800" },
});

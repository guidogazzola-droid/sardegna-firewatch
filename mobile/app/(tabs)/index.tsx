import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, {
  Circle,
  Marker,
  Polygon,
  Polyline,
  type Region,
} from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFireData } from "../../src/context/fire-data";
import { useTerritory } from "../../src/context/territory";
import { useWeatherLayers } from "../../src/hooks/use-weather-layers";
import { fetchWindHistory } from "../../src/lib/api";
import { APP_DISPLAY_NAME } from "../../src/lib/config";
import {
  localizedCompassLabel,
  useI18n,
} from "../../src/i18n";
import {
  confidenceLabel,
  formatAge,
  formatCoordinate,
  formatNumber,
  formatObservation,
  severityLabel,
} from "../../src/lib/format";
import { BASE_MAPS, DEFAULT_BASE_MAP_ID, type BaseMapId } from "../../src/lib/map-styles";
import {
  DEFAULT_TERRITORY,
  territoryPolygonOutlines,
  territoryRegion,
} from "../../src/lib/territories";
import type {
  FireDetection,
  GeoBounds,
  WindHistoryResponse,
} from "../../src/lib/types";
import { severityColors, spacing, useAppTheme } from "../../src/theme";

const BASE_MAP_ORDER: BaseMapId[] = ["satellite", "topographic", "street"];

const INITIAL_REGION: Region = territoryRegion(DEFAULT_TERRITORY);

function clampRegion(region: Region, territoryBounds: GeoBounds): GeoBounds | null {
  const west = region.longitude - region.longitudeDelta / 2;
  const south = region.latitude - region.latitudeDelta / 2;
  const east = region.longitude + region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  const clipped = {
    west: Math.max(west, territoryBounds.west),
    south: Math.max(south, territoryBounds.south),
    east: Math.min(east, territoryBounds.east),
    north: Math.min(north, territoryBounds.north),
  };
  return clipped.east > clipped.west && clipped.north > clipped.south ? clipped : null;
}

function cloudOpacity(cover: number): string {
  const alpha = Math.round(Math.min(0.5, Math.max(0.08, cover / 200)) * 255);
  return `#eef5f8${alpha.toString(16).padStart(2, "0")}`;
}

export default function MapScreen() {
  const theme = useAppTheme();
  const { language, t, territoryName } = useI18n();
  const router = useRouter();
  const { activeTerritory } = useTerritory();
  const mapRef = useRef<MapView | null>(null);
  const windRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyController = useRef<AbortController | null>(null);
  const [baseMapId, setBaseMapId] = useState<BaseMapId>(DEFAULT_BASE_MAP_ID);
  const [isMapReady, setIsMapReady] = useState(false);
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
  } = useWeatherLayers(activeTerritory);

  const territoryOutlines = useMemo(
    () => territoryPolygonOutlines(activeTerritory),
    [activeTerritory],
  );

  const visibleFires = fires.slice(0, 100);
  const baseMap = BASE_MAPS[baseMapId];
  const visibleClouds = useMemo(
    () =>
      cloudEnabled && activeCloudFrame
        ? activeCloudFrame.samples.filter(
            (sample) => Number.isFinite(sample.cover) && sample.cover >= 8,
          )
        : [],
    [activeCloudFrame, cloudEnabled],
  );

  const smokeCoordinates = useMemo(
    () =>
      (history?.smokeTrack ?? []).map(([latitude, longitude]) => ({
        latitude,
        longitude,
      })),
    [history],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refresh(),
      loadWind(),
      loadClouds({ preserveFrame: true }),
    ]);
  }, [loadClouds, loadWind, refresh]);

  const scheduleWindRefresh = useCallback(
    (region: Region) => {
      if (!windEnabled) return;
      const bounds = clampRegion(region, activeTerritory.queryBounds);
      if (!bounds) return;
      if (windRefreshTimer.current) clearTimeout(windRefreshTimer.current);
      windRefreshTimer.current = setTimeout(() => {
        void loadWind(bounds);
      }, 450);
    },
    [activeTerritory.queryBounds, loadWind, windEnabled],
  );

  const selectBaseMap = useCallback((id: BaseMapId) => {
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
        territoryId: activeTerritory.id,
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
          : t("map.windAnalysisUnavailable"),
      );
    } finally {
      if (historyController.current === controller) setHistoryLoading(false);
    }
  }, [activeTerritory.id, historyLoading, selectedFire, t]);

  useEffect(() => {
    historyController.current?.abort();
    setSelectedFire(null);
    setHistory(null);
    setHistoryError(null);
    mapRef.current?.animateToRegion(territoryRegion(activeTerritory), 550);
  }, [activeTerritory]);

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("map.chooseTerritory")}
            onPress={() => router.push("/(tabs)/territories")}
          >
            <Text style={[styles.eyebrow, { color: theme.accent }]}>
              {territoryName(activeTerritory).toLocaleUpperCase(language)} ▾
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>{APP_DISPLAY_NAME}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {t("map.subtitle")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("map.refresh")}
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
          text={t("map.limitedFeed")}
          tone="warning"
        />
      ) : (
        <StatusBanner
          text={
            lastSuccessfulAt
              ? t("map.updated", {
                  time: formatObservation(lastSuccessfulAt, language),
                })
              : t("map.connecting")
          }
          tone="ok"
        />
      )}

      <View style={styles.layerToolbar}>
        <View style={[styles.segmentedControl, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {BASE_MAP_ORDER.map((id) => {
            const active = id === baseMapId;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => selectBaseMap(id)}
                style={[
                  styles.segment,
                  active && { backgroundColor: theme.accentSoft },
                ]}
              >
                <Text style={[styles.segmentLabel, { color: active ? theme.accent : theme.textMuted }]}>
                  {t(
                    id === "satellite"
                      ? "map.baseSatellite"
                      : id === "topographic"
                        ? "map.baseTopographic"
                        : "map.baseStreet",
                  )}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <LayerToggle
          label={t("map.wind")}
          symbol="↗"
          active={windEnabled}
          busy={isWindLoading}
          onPress={() => setWindEnabled((value) => !value)}
        />
        <LayerToggle
          label={t("map.clouds")}
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

      <View style={[styles.mapFrame, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          mapType={baseMap.mapType}
          loadingEnabled
          loadingIndicatorColor={theme.accent}
          loadingBackgroundColor={theme.surfaceMuted}
          showsCompass
          showsScale
          showsBuildings
          showsPointsOfInterests
          onMapReady={() => setIsMapReady(true)}
          onRegionChangeComplete={scheduleWindRefresh}
        >
          {territoryOutlines.map((coordinates, index) => (
            <Polygon
              key={`territory-outline-${index}`}
              coordinates={coordinates}
              fillColor={`${theme.accent}08`}
              strokeColor={`${theme.accent}aa`}
              strokeWidth={2}
              lineDashPattern={[8, 5]}
              zIndex={2}
            />
          ))}

          {visibleClouds.map((sample, index) => (
            <Circle
              key={`cloud-${index}`}
              center={{
                latitude: sample.latitude,
                longitude: sample.longitude,
              }}
              radius={16_000 + sample.cover * 260}
              fillColor={cloudOpacity(sample.cover)}
              strokeColor="transparent"
              zIndex={1}
            />
          ))}

          {smokeCoordinates.length >= 2 ? (
            <Polyline
              coordinates={smokeCoordinates}
              strokeColor="#7e6bc4e6"
              strokeWidth={5}
              lineDashPattern={[9, 6]}
              lineCap="round"
              lineJoin="round"
              zIndex={4}
            />
          ) : null}

          {windEnabled
            ? windSamples.map((sample, index) => (
                <Marker
                  key={`wind-${index}`}
                  identifier={`wind-${index}`}
                  coordinate={{
                    latitude: sample.latitude,
                    longitude: sample.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                  zIndex={3}
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
              identifier={fire.id}
              coordinate={{
                latitude: fire.latitude,
                longitude: fire.longitude,
              }}
              onPress={() => selectFire(fire)}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={5}
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
        </MapView>

        {isLoading || !isMapReady ? (
          <View style={[styles.loadingOverlay, { backgroundColor: `${theme.background}d9` }]}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              {t("map.loading")}
            </Text>
          </View>
        ) : null}

        <View style={[styles.legend, { backgroundColor: `${theme.surface}ee`, borderColor: theme.border }]}>
          <View style={[styles.legendDot, { backgroundColor: severityColors.high }]} />
          <Text style={[styles.legendText, { color: theme.text }]}>
            {t("map.detections")}
          </Text>
          {windEnabled ? (
            <Text style={[styles.legendText, { color: theme.text }]}>
              {t("map.windLegend")}
            </Text>
          ) : null}
          {cloudEnabled ? (
            <Text style={[styles.legendText, { color: theme.text }]}>
              {t("map.forecastLegend")}
            </Text>
          ) : null}
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
        <SummaryMetric
          label={t("map.detections")}
          value={String(feed?.stats.total ?? 0)}
        />
        <SummaryMetric
          label={t("map.wind")}
          value={
            windSamples.length
              ? `${Math.round(windSamples[0]?.speed ?? 0)} km/h`
              : t("common.notAvailable")
          }
        />
        <SummaryMetric
          label={t("map.clouds")}
          value={
            activeCloudFrame
              ? `${activeCloudFrame.averageCover}%`
              : t("common.notAvailable")
          }
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
  const { language, t } = useI18n();
  return (
    <View style={[styles.cloudTimeline, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("map.cloudPrevious")}
        disabled={!frameCount || frameIndex <= 0}
        onPress={onPrevious}
        style={styles.timelineButton}
      >
        <Text style={[styles.timelineButtonText, { color: frameIndex > 0 ? theme.accent : theme.textMuted }]}>‹</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          playing ? t("map.cloudPause") : t("map.cloudPlay")
        }
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
          {frameTime
            ? formatObservation(frameTime, language)
            : t("map.cloudUnavailable")}
        </Text>
        <Text style={[styles.timelineMeta, { color: error ? theme.warning : theme.textMuted }]} numberOfLines={1}>
          {error ??
            (averageCover === null
              ? t("map.modeledForecast")
              : t("map.averageCover", {
                  cover: averageCover,
                  current: frameIndex + 1,
                  total: frameCount,
                }))}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("map.cloudNext")}
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
  const { language, t } = useI18n();
  return (
    <View style={[styles.firePanel, { backgroundColor: `${theme.surface}f5`, borderColor: theme.border }]}>
      <View style={styles.firePanelHeader}>
        <View style={styles.firePanelTitleBlock}>
          <Text style={[styles.firePanelEyebrow, { color: severityColors[fire.severity] }]}>
            {severityLabel(fire.severity, language)}
          </Text>
          <Text style={[styles.firePanelTitle, { color: theme.text }]}>
            {t("map.thermalDetection")}
          </Text>
          <Text style={[styles.firePanelMeta, { color: theme.textMuted }]}>
            {formatObservation(fire.observedAt, language)} ·{" "}
            {formatAge(fire.ageMinutes, language)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("map.closeDetail")}
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={[styles.closeButtonText, { color: theme.textMuted }]}>×</Text>
        </Pressable>
      </View>
      <Text style={[styles.firePanelBody, { color: theme.textMuted }]}>
        {fire.instrument || fire.source} ·{" "}
        {t("map.reliability", {
          value: confidenceLabel(fire.confidence, language),
        })}{" "}
        · {formatCoordinate(fire.latitude, language)};{" "}
        {formatCoordinate(fire.longitude, language)}
      </Text>
      {history ? (
        <View style={[styles.smokeSummary, { backgroundColor: `${theme.accent}12` }]}>
          <Text style={[styles.smokeSummaryTitle, { color: theme.text }]}>
            {t("map.smokeDrift")}
          </Text>
          <Text style={[styles.smokeSummaryValue, { color: theme.accent }]}>
            {t("map.smokeSummary", {
              direction: localizedCompassLabel(
                history.summary.smokeToDegrees,
                language,
              ),
              speed: formatNumber(
                history.summary.averageSpeed,
                1,
                language,
              ),
            })}
          </Text>
          <Text style={[styles.smokeSummaryNote, { color: theme.textMuted }]}>
            {t("map.smokeDisclaimer")}
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={onAnalyze}
          style={[styles.analyzeButton, { backgroundColor: theme.accent }]}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.analyzeButtonText}>
              {t("map.analyzeWind")}
            </Text>
          )}
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
  layerToggle: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9 },
  layerSymbol: { fontSize: 15, fontWeight: "800" },
  layerLabel: { fontSize: 10, fontWeight: "800" },
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
  legend: { position: "absolute", left: 9, top: 9, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9, paddingVertical: 6 },
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

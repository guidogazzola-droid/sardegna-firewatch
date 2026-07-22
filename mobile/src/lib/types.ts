export type ConfidenceLevel = "high" | "nominal" | "low" | "unknown";
export type SeverityLevel = "critical" | "high" | "medium" | "low";

export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface FireDetection {
  id: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  estimatedStartAt?: string;
  startEstimateRadiusKm?: number;
  ageMinutes: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  severity: SeverityLevel;
  frp: number | null;
  satellite: string;
  instrument: string;
  source: string;
  dayNight: string | null;
  brightness: number | null;
  scan: number | null;
  track: number | null;
}

export interface FireFeedStats {
  total: number;
  highConfidence: number;
  urgent: number;
  maxFrp: number | null;
  averageFrp: number | null;
  latestObservation: string | null;
}

export interface SourceStatus {
  source: string;
  ok: boolean;
  detections: number;
  error?: string;
}

export interface FireFeedResponse {
  ok: boolean;
  mode: string;
  configured: boolean;
  generatedAt: string;
  refreshSeconds: number;
  fires: FireDetection[];
  stats: FireFeedStats;
  sourceStatus: SourceStatus[];
  message?: string;
  cached?: boolean;
}

export interface WindSample {
  latitude: number;
  longitude: number;
  speed: number;
  gust: number | null;
  directionFrom: number;
  directionTo: number;
  observedAt: string | null;
}

export interface WindGridResponse {
  ok: boolean;
  generatedAt: string;
  source: string;
  units: {
    speed: string;
    direction: string;
  };
  bounds: GeoBounds;
  samples: WindSample[];
  cached?: boolean;
}

export interface CloudSample {
  latitude: number;
  longitude: number;
  cover: number;
  low: number | null;
  mid: number | null;
  high: number | null;
}

export interface CloudFrame {
  time: string;
  averageCover: number;
  samples: CloudSample[];
}

export interface CloudForecastResponse {
  ok: boolean;
  generatedAt: string;
  source: string;
  methodology: string;
  bounds: GeoBounds;
  frames: CloudFrame[];
  cached?: boolean;
}

export interface WindHistorySample {
  time: string;
  speed: number;
  direction: number;
  gust: number | null;
}

export interface WindHistorySummary {
  averageSpeed: number;
  maxSpeed: number;
  maxGust: number;
  windFromDegrees: number;
  windFromLabel: string;
  smokeToDegrees: number;
  smokeToLabel: string;
  sampleCount: number;
}

export interface WindHistoryResponse {
  ok: boolean;
  generatedAt: string;
  requestedStartAt: string;
  startAt: string;
  endAt: string;
  truncated: boolean;
  units: {
    speed: string;
    direction: string;
  };
  summary: WindHistorySummary;
  samples: WindHistorySample[];
  smokeTrack: [latitude: number, longitude: number][];
  methodology: {
    source: string;
    smokeDirection: string;
    track: string;
  };
  cached?: boolean;
}

export interface SystemStatusResponse {
  ok: boolean;
  mode: string;
  firmsConfigured: boolean;
  refreshSeconds: number;
  bbox: GeoBounds;
  sources: {
    effis: boolean;
    firms: boolean;
    weather: boolean;
    windMap: boolean;
    windHistory: boolean;
    cloudForecast: boolean;
  };
}

export interface WatchArea {
  id: "primary";
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  createdAt: string;
  updatedAt: string;
}

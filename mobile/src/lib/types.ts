export type ConfidenceLevel = "high" | "nominal" | "low" | "unknown";
export type SeverityLevel = "critical" | "high" | "medium" | "low";

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

export interface SystemStatusResponse {
  ok: boolean;
  mode: string;
  firmsConfigured: boolean;
  refreshSeconds: number;
  bbox: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
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

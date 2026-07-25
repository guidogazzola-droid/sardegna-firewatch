import { API_BASE_URL } from "./config";
import type {
  CloudForecastResponse,
  CreateAlertSubscriptionResponse,
  FireFeedResponse,
  GeoBounds,
  SystemStatusResponse,
  UpdateAlertSubscriptionResponse,
  WatchArea,
  WindGridResponse,
  WindHistoryResponse,
} from "./types";

export type FireSourceGroup = "viirs" | "modis" | "all";

export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Impossibile raggiungere Sardinia FireWatch. Controlla la connessione e riprova.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("Il servizio ha restituito una risposta non valida.", response.status);
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Il servizio non e temporaneamente disponibile.";
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

async function mutationJson<T>(
  path: string,
  options: {
    method: "POST" | "PATCH" | "DELETE";
    body?: object;
    secret?: string;
  },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.secret ? { Authorization: `Bearer ${options.secret}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new ApiError("Impossibile raggiungere il servizio notifiche.");
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new ApiError(
      payload?.error || "Il servizio notifiche non e temporaneamente disponibile.",
      response.status,
    );
  }
  return payload as T;
}

export function fetchSystemStatus(signal?: AbortSignal): Promise<SystemStatusResponse> {
  return requestJson<SystemStatusResponse>("/api/status", signal);
}

export function fetchFireFeed(
  options: {
    days?: number;
    sources?: FireSourceGroup;
    territoryId?: string;
    signal?: AbortSignal;
  } = {},
): Promise<FireFeedResponse> {
  const days = Math.min(5, Math.max(1, Math.round(options.days ?? 1)));
  const sources = options.sources ?? "viirs";
  const query = new URLSearchParams({
    days: String(days),
    sources,
    territory: options.territoryId ?? "sardinia",
  });

  return requestJson<FireFeedResponse>(`/api/fires?${query.toString()}`, options.signal);
}

export function fetchWindGrid(
  options: {
    bounds: GeoBounds;
    rows?: number;
    columns?: number;
    territoryId: string;
    signal?: AbortSignal;
  },
): Promise<WindGridResponse> {
  const rows = Math.min(5, Math.max(2, Math.round(options.rows ?? 4)));
  const columns = Math.min(6, Math.max(2, Math.round(options.columns ?? 5)));
  const query = new URLSearchParams({
    south: options.bounds.south.toFixed(4),
    west: options.bounds.west.toFixed(4),
    north: options.bounds.north.toFixed(4),
    east: options.bounds.east.toFixed(4),
    rows: String(rows),
    columns: String(columns),
    territory: options.territoryId,
  });

  return requestJson<WindGridResponse>(`/api/wind-grid?${query.toString()}`, options.signal);
}

export function fetchCloudForecast(
  territoryId: string,
  signal?: AbortSignal,
): Promise<CloudForecastResponse> {
  const query = new URLSearchParams({ territory: territoryId });
  return requestJson<CloudForecastResponse>(
    `/api/cloud-forecast?${query.toString()}`,
    signal,
  );
}

export function fetchWindHistory(
  options: {
    latitude: number;
    longitude: number;
    startAt: string;
    territoryId: string;
    signal?: AbortSignal;
  },
): Promise<WindHistoryResponse> {
  const query = new URLSearchParams({
    lat: String(options.latitude),
    lon: String(options.longitude),
    start: options.startAt,
    territory: options.territoryId,
  });

  return requestJson<WindHistoryResponse>(`/api/wind-history?${query.toString()}`, options.signal);
}

export function createAlertSubscription(options: {
  expoPushToken: string;
  watchArea: WatchArea;
  entitlementToken?: string | null;
}): Promise<CreateAlertSubscriptionResponse> {
  return mutationJson<CreateAlertSubscriptionResponse>("/api/alerts/subscriptions", {
    method: "POST",
    body: options,
  });
}

export function updateAlertSubscription(options: {
  id: string;
  secret: string;
  expoPushToken?: string;
  watchArea?: WatchArea;
  entitlementToken?: string | null;
}): Promise<UpdateAlertSubscriptionResponse> {
  return mutationJson<UpdateAlertSubscriptionResponse>(
    `/api/alerts/subscriptions/${encodeURIComponent(options.id)}`,
    {
      method: "PATCH",
      secret: options.secret,
      body: {
        ...(options.expoPushToken ? { expoPushToken: options.expoPushToken } : {}),
        ...(options.watchArea ? { watchArea: options.watchArea } : {}),
        ...(options.entitlementToken
          ? { entitlementToken: options.entitlementToken }
          : {}),
      },
    },
  );
}

export function deleteAlertSubscription(options: {
  id: string;
  secret: string;
}): Promise<void> {
  return mutationJson<void>(
    `/api/alerts/subscriptions/${encodeURIComponent(options.id)}`,
    {
      method: "DELETE",
      secret: options.secret,
    },
  );
}

export function sendAlertTest(options: {
  id: string;
  secret: string;
}): Promise<{ ok: true }> {
  return mutationJson<{ ok: true }>(
    `/api/alerts/subscriptions/${encodeURIComponent(options.id)}/test`,
    {
      method: "POST",
      secret: options.secret,
    },
  );
}

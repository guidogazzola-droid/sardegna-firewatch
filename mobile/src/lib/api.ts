import { API_BASE_URL } from "./config";
import type { FireFeedResponse, SystemStatusResponse } from "./types";

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

export function fetchSystemStatus(signal?: AbortSignal): Promise<SystemStatusResponse> {
  return requestJson<SystemStatusResponse>("/api/status", signal);
}

export function fetchFireFeed(
  options: {
    days?: number;
    sources?: FireSourceGroup;
    signal?: AbortSignal;
  } = {},
): Promise<FireFeedResponse> {
  const days = Math.min(5, Math.max(1, Math.round(options.days ?? 1)));
  const sources = options.sources ?? "viirs";
  const query = new URLSearchParams({
    days: String(days),
    sources,
  });

  return requestJson<FireFeedResponse>(`/api/fires?${query.toString()}`, options.signal);
}

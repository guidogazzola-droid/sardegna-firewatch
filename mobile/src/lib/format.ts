import type { ConfidenceLevel, SeverityLevel } from "./types";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

export function formatObservation(value: string | null | undefined): string {
  if (!value) return "Orario non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Orario non disponibile";
  return dateFormatter.format(date);
}

export function formatAge(minutes: number | null | undefined): string {
  if (!Number.isFinite(minutes)) return "Eta non disponibile";
  const safeMinutes = Math.max(0, Math.round(minutes ?? 0));
  if (safeMinutes < 60) return `${safeMinutes} min fa`;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (hours < 24) return remainingMinutes ? `${hours} h ${remainingMinutes} min fa` : `${hours} h fa`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "giorno" : "giorni"} fa`;
}

export function confidenceLabel(value: ConfidenceLevel): string {
  switch (value) {
    case "high":
      return "Alta";
    case "nominal":
      return "Nominale";
    case "low":
      return "Bassa";
    default:
      return "Non disponibile";
  }
}

export function severityLabel(value: SeverityLevel): string {
  switch (value) {
    case "critical":
      return "Priorita molto alta";
    case "high":
      return "Priorita alta";
    case "medium":
      return "Priorita media";
    default:
      return "Priorita bassa";
  }
}

export function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

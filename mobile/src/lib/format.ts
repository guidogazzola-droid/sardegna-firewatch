import type { ConfidenceLevel, SeverityLevel } from "./types";
import {
  currentLanguage,
  currentLocale,
  translate,
  type AppLanguage,
} from "../i18n";

function dateFormatter(language: AppLanguage) {
  const deviceLocale = currentLocale();
  const locale = deviceLocale.toLowerCase().startsWith(language)
    ? deviceLocale
    : language;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatObservation(
  value: string | null | undefined,
  language = currentLanguage(),
): string {
  if (!value) return translate("format.timeUnavailable", {}, language);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return translate("format.timeUnavailable", {}, language);
  }
  return dateFormatter(language).format(date);
}

export function formatAge(
  minutes: number | null | undefined,
  language = currentLanguage(),
): string {
  if (!Number.isFinite(minutes)) {
    return translate("format.ageUnavailable", {}, language);
  }
  const safeMinutes = Math.max(0, Math.round(minutes ?? 0));
  if (safeMinutes < 60) {
    return translate("format.minutesAgo", { count: safeMinutes }, language);
  }
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (hours < 24) {
    return translate(
      "format.hoursAgo",
      { hours, minutes: remainingMinutes },
      language,
    ).replace(/\s+0\s+(min|Min\.)/, "");
  }
  const days = Math.floor(hours / 24);
  return translate(
    "format.daysAgo",
    {
      count: days,
      unit: translate(days === 1 ? "format.day" : "format.days", {}, language),
    },
    language,
  );
}

export function confidenceLabel(
  value: ConfidenceLevel,
  language = currentLanguage(),
): string {
  switch (value) {
    case "high":
      return translate("confidence.high", {}, language);
    case "nominal":
      return translate("confidence.nominal", {}, language);
    case "low":
      return translate("confidence.low", {}, language);
    default:
      return translate("confidence.unknown", {}, language);
  }
}

export function severityLabel(
  value: SeverityLevel,
  language = currentLanguage(),
): string {
  switch (value) {
    case "critical":
      return translate("severity.critical", {}, language);
    case "high":
      return translate("severity.high", {}, language);
    case "medium":
      return translate("severity.medium", {}, language);
    default:
      return translate("severity.low", {}, language);
  }
}

export function formatCoordinate(
  value: number,
  language = currentLanguage(),
): string {
  const deviceLocale = currentLocale();
  const locale = deviceLocale.toLowerCase().startsWith(language)
    ? deviceLocale
    : language;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatNumber(
  value: number,
  maximumFractionDigits = 1,
  language = currentLanguage(),
): string {
  const deviceLocale = currentLocale();
  const locale = deviceLocale.toLowerCase().startsWith(language)
    ? deviceLocale
    : language;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(value);
}

export const SUPPORTED_LANGUAGES = Object.freeze(["it", "en", "fr", "de"]);

const messages = {
  it: {
    rateLimited: "Troppe richieste. Attendi un minuto e riprova.",
    alertsUnavailable: "Il servizio di notifiche non è ancora disponibile.",
    territoryUnsupported: "Territorio non supportato.",
    alertDataInvalid: "Token di notifica o zona monitorata non validi.",
    territoryLocked: "Il territorio selezionato non risulta acquistato.",
    updateInvalid: "Aggiornamento non valido.",
    registrationMissing: "Registrazione non trovata.",
    authorizationMissing: "Autorizzazione mancante.",
    testRateLimited: "Attendi un minuto prima di inviare un’altra prova.",
    testRejected: "Expo non ha accettato la notifica di prova.",
    firmsUnavailable:
      "Impossibile aggiornare il feed NASA FIRMS in questo momento.",
    coordinatesInvalid: "Coordinate non valide.",
    coordinatesOutside: "Coordinate fuori dall’area supportata.",
    weatherUnavailable: "Meteo locale temporaneamente non disponibile.",
    boundsInvalid: "Limiti della mappa non validi.",
    windMapUnavailable: "Mappa del vento temporaneamente non disponibile.",
    cloudsUnavailable:
      "Previsione della nuvolosità temporaneamente non disponibile.",
    windRequestInvalid: "Coordinate o data iniziale non valide.",
    windHistoryUnavailable:
      "Storico del vento temporaneamente non disponibile.",
    effisOnly:
      "La mappa EFFIS e i layer di rischio sono attivi. Configura FIRMS_MAP_KEY per punti interattivi, conteggi e notifiche di prossimità.",
    cloudMethodology:
      "Copertura nuvolosa oraria modellata; non è un’immagine satellitare osservata.",
    testTitle: "SabettaPiro — notifiche attive",
    testBody:
      "La zona monitorata è collegata correttamente. Riceverai avvisi per nuove rilevazioni satellitari compatibili.",
    detectionTitle: "SabettaPiro — rilevazione satellitare",
    oneDetection: "Una nuova rilevazione",
    manyDetections: "%{count} nuove rilevazioni",
    detectionBody:
      "%{countText} entro la zona monitorata; la più vicina è a circa %{distance} km. Verifica la mappa e le comunicazioni delle autorità.",
  },
  en: {
    rateLimited: "Too many requests. Wait one minute and try again.",
    alertsUnavailable: "The notification service is not available yet.",
    territoryUnsupported: "Unsupported territory.",
    alertDataInvalid: "Invalid notification token or monitored area.",
    territoryLocked: "The selected territory has not been purchased.",
    updateInvalid: "Invalid update.",
    registrationMissing: "Registration not found.",
    authorizationMissing: "Missing authorisation.",
    testRateLimited: "Wait one minute before sending another test.",
    testRejected: "Expo did not accept the test notification.",
    firmsUnavailable: "Unable to update the NASA FIRMS feed at this time.",
    coordinatesInvalid: "Invalid coordinates.",
    coordinatesOutside: "Coordinates outside the supported area.",
    weatherUnavailable: "Local weather is temporarily unavailable.",
    boundsInvalid: "Invalid map bounds.",
    windMapUnavailable: "The wind map is temporarily unavailable.",
    cloudsUnavailable: "The cloud forecast is temporarily unavailable.",
    windRequestInvalid: "Invalid coordinates or start date.",
    windHistoryUnavailable: "Wind history is temporarily unavailable.",
    effisOnly:
      "The EFFIS map and risk layers are active. Configure FIRMS_MAP_KEY for interactive points, counts and proximity alerts.",
    cloudMethodology:
      "Modelled hourly cloud cover; this is not an observed satellite image.",
    testTitle: "SabettaPiro — notifications active",
    testBody:
      "The monitored area is connected correctly. You will receive alerts for matching new satellite detections.",
    detectionTitle: "SabettaPiro — satellite detection",
    oneDetection: "One new detection",
    manyDetections: "%{count} new detections",
    detectionBody:
      "%{countText} within the monitored area; the nearest is about %{distance} km away. Check the map and official communications.",
  },
  fr: {
    rateLimited: "Trop de demandes. Attendez une minute et réessayez.",
    alertsUnavailable:
      "Le service de notification n’est pas encore disponible.",
    territoryUnsupported: "Territoire non pris en charge.",
    alertDataInvalid: "Jeton de notification ou zone surveillée non valide.",
    territoryLocked: "Le territoire sélectionné n’a pas été acheté.",
    updateInvalid: "Mise à jour non valide.",
    registrationMissing: "Enregistrement introuvable.",
    authorizationMissing: "Autorisation manquante.",
    testRateLimited: "Attendez une minute avant d’envoyer un autre test.",
    testRejected: "Expo n’a pas accepté la notification test.",
    firmsUnavailable:
      "Impossible d’actualiser le flux NASA FIRMS pour le moment.",
    coordinatesInvalid: "Coordonnées non valides.",
    coordinatesOutside: "Coordonnées hors de la zone prise en charge.",
    weatherUnavailable: "La météo locale est temporairement indisponible.",
    boundsInvalid: "Limites de carte non valides.",
    windMapUnavailable: "La carte du vent est temporairement indisponible.",
    cloudsUnavailable:
      "La prévision de nébulosité est temporairement indisponible.",
    windRequestInvalid: "Coordonnées ou date de début non valides.",
    windHistoryUnavailable:
      "L’historique du vent est temporairement indisponible.",
    effisOnly:
      "La carte EFFIS et les couches de risque sont actives. Configurez FIRMS_MAP_KEY pour les points interactifs, les comptages et les alertes de proximité.",
    cloudMethodology:
      "Nébulosité horaire modélisée ; il ne s’agit pas d’une image satellite observée.",
    testTitle: "SabettaPiro — notifications actives",
    testBody:
      "La zone surveillée est correctement connectée. Vous recevrez des alertes pour les nouvelles détections satellitaires correspondantes.",
    detectionTitle: "SabettaPiro — détection satellitaire",
    oneDetection: "Une nouvelle détection",
    manyDetections: "%{count} nouvelles détections",
    detectionBody:
      "%{countText} dans la zone surveillée ; la plus proche se trouve à environ %{distance} km. Consultez la carte et les communications officielles.",
  },
  de: {
    rateLimited: "Zu viele Anfragen. Warten Sie eine Minute und versuchen Sie es erneut.",
    alertsUnavailable:
      "Der Benachrichtigungsdienst ist noch nicht verfügbar.",
    territoryUnsupported: "Gebiet wird nicht unterstützt.",
    alertDataInvalid: "Ungültiger Benachrichtigungs-Token oder Überwachungsbereich.",
    territoryLocked: "Das ausgewählte Gebiet wurde nicht gekauft.",
    updateInvalid: "Ungültige Aktualisierung.",
    registrationMissing: "Registrierung nicht gefunden.",
    authorizationMissing: "Autorisierung fehlt.",
    testRateLimited:
      "Warten Sie eine Minute, bevor Sie einen weiteren Test senden.",
    testRejected: "Expo hat die Testbenachrichtigung nicht angenommen.",
    firmsUnavailable:
      "Der NASA-FIRMS-Feed kann derzeit nicht aktualisiert werden.",
    coordinatesInvalid: "Ungültige Koordinaten.",
    coordinatesOutside: "Koordinaten außerhalb des unterstützten Gebiets.",
    weatherUnavailable: "Lokale Wetterdaten sind vorübergehend nicht verfügbar.",
    boundsInvalid: "Ungültige Kartengrenzen.",
    windMapUnavailable: "Die Windkarte ist vorübergehend nicht verfügbar.",
    cloudsUnavailable: "Die Bewölkungsprognose ist vorübergehend nicht verfügbar.",
    windRequestInvalid: "Ungültige Koordinaten oder Startzeit.",
    windHistoryUnavailable: "Der Windverlauf ist vorübergehend nicht verfügbar.",
    effisOnly:
      "Die EFFIS-Karte und Risikokarten sind aktiv. Konfigurieren Sie FIRMS_MAP_KEY für interaktive Punkte, Zählungen und Umgebungswarnungen.",
    cloudMethodology:
      "Modellierte stündliche Bewölkung; dies ist kein beobachtetes Satellitenbild.",
    testTitle: "SabettaPiro — Benachrichtigungen aktiv",
    testBody:
      "Das Überwachungsgebiet ist korrekt verbunden. Sie erhalten Warnungen bei passenden neuen Satellitenerfassungen.",
    detectionTitle: "SabettaPiro — Satellitenerfassung",
    oneDetection: "Eine neue Erfassung",
    manyDetections: "%{count} neue Erfassungen",
    detectionBody:
      "%{countText} im Überwachungsgebiet; die nächste ist etwa %{distance} km entfernt. Prüfen Sie die Karte und amtliche Mitteilungen.",
  },
};

export function normalizeLanguage(value, fallback = "it") {
  const candidates = String(value || "")
    .split(",")
    .map((part) => part.trim().split(";")[0].split("-")[0].toLowerCase());
  return (
    candidates.find((candidate) => SUPPORTED_LANGUAGES.includes(candidate)) ||
    fallback
  );
}

export function requestLanguage(request) {
  return normalizeLanguage(
    request?.body?.language || request?.get?.("Accept-Language"),
  );
}

export function localizedMessage(language, key, params = {}) {
  const normalized = normalizeLanguage(language);
  const template = messages[normalized]?.[key] ?? messages.it[key] ?? key;
  return template.replace(/%\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}

export function localizedTerritoryName(language, territory) {
  const normalized = normalizeLanguage(language);
  if (territory?.id === "sardinia") {
    return {
      it: "Sardegna",
      en: "Sardinia",
      fr: "Sardaigne",
      de: "Sardinien",
    }[normalized];
  }
  try {
    return (
      new Intl.DisplayNames([normalized], { type: "region" }).of(
        territory?.countryCode,
      ) || territory?.name
    );
  } catch {
    return territory?.name;
  }
}

import { getLocales } from "expo-localization";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import type { Territory } from "../lib/territories";
import territoryNames from "../data/territory-names.json";

export const SUPPORTED_LANGUAGES = ["it", "en", "fr", "de"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type TranslationParams = Record<string, string | number>;

const it = {
  "tabs.map": "Mappa",
  "tabs.events": "Eventi",
  "tabs.alerts": "Avvisi",
  "tabs.territories": "Paesi",
  "tabs.info": "Info",
  "common.active": "Attivo",
  "common.limited": "Limitato",
  "common.notAvailable": "n.d.",
  "map.chooseTerritory": "Scegli territorio",
  "map.subtitle": "Incendi, vento e nuvolosità in un’unica vista",
  "map.refresh": "Aggiorna tutti i dati",
  "map.limitedFeed":
    "Feed puntuale NASA FIRMS limitato; vento e nuvolosità restano consultabili.",
  "map.updated": "Dati aggiornati %{time}",
  "map.connecting": "Connessione alle fonti in corso",
  "map.wind": "Vento",
  "map.clouds": "Nuvole",
  "map.baseSatellite": "SAT",
  "map.baseTopographic": "TOPO",
  "map.baseStreet": "STR",
  "map.loading": "Caricamento della mappa…",
  "map.detections": "Rilevazioni",
  "map.windLegend": "↗ vento km/h",
  "map.forecastLegend": "☁ previsione",
  "map.cloudPrevious": "Fotogramma nuvole precedente",
  "map.cloudPause": "Metti in pausa le nuvole",
  "map.cloudPlay": "Avvia animazione nuvole",
  "map.cloudUnavailable": "Nuvolosità non disponibile",
  "map.modeledForecast": "Previsione modellata",
  "map.averageCover": "Copertura media %{cover}% · %{current}/%{total}",
  "map.cloudNext": "Fotogramma nuvole successivo",
  "map.thermalDetection": "Rilevazione termica",
  "map.closeDetail": "Chiudi dettaglio",
  "map.reliability": "affidabilità %{value}",
  "map.smokeDrift": "Deriva indicativa del fumo",
  "map.smokeSummary": "verso %{direction} · vento medio %{speed} km/h",
  "map.smokeDisclaimer":
    "Stima semplificata, non modello di dispersione e non previsione ufficiale.",
  "map.analyzeWind": "Analizza vento e fumo",
  "map.windAnalysisUnavailable":
    "Analisi del vento temporaneamente non disponibile.",
  "events.title": "Rilevazioni",
  "events.subtitle":
    "%{territory} · anomalie termiche satellitari, dalla più recente.",
  "events.loading": "Caricamento delle rilevazioni",
  "events.inPeriod": "Nel periodo",
  "events.highConfidence": "Alta affidabilità",
  "events.emptyTitle": "Nessuna rilevazione disponibile",
  "events.emptyBody":
    "Il feed potrebbe non essere configurato oppure non avere osservazioni recenti.",
  "event.thermalDetection": "Rilevazione termica",
  "event.reliability": "Affidabilità",
  "event.sensor": "Sensore",
  "event.notice":
    "Anomalia osservata da satellite; non equivale automaticamente a un incendio confermato.",
  "settings.title": "Informazioni",
  "settings.subtitle": "Fonti, stato del servizio e limiti operativi.",
  "settings.serviceStatus": "Stato del servizio",
  "settings.activeTerritory": "Territorio attivo",
  "settings.availableTerritories": "Territori disponibili",
  "settings.unlockedCount": "%{total} · %{count} sbloccati",
  "settings.windSource": "Vento Open-Meteo",
  "settings.cloudSource": "Nuvolosità Open-Meteo",
  "settings.proximityAlerts": "Notifiche di prossimità",
  "settings.refreshEvery": "Aggiornamento previsto ogni %{seconds} secondi.",
  "settings.sourceCompliance": "Conformità delle fonti",
  "settings.weatherService": "Servizio meteo",
  "settings.weatherMode": "Modalità meteo",
  "settings.commercialActive": "Licenza commerciale attiva",
  "settings.evaluation": "Valutazione / test interno",
  "settings.commercialVerified": "Configurazione commerciale verificata",
  "settings.paidDisabled": "Rilascio a pagamento non ancora abilitato",
  "settings.commercialBody":
    "Il backend dichiara l’endpoint commerciale configurato. La verifica dei termini resta parte della checklist di rilascio.",
  "settings.evaluationBody":
    "Questa build usa i dati meteo in modalità di valutazione. Prima della vendita pubblica servono endpoint e chiave commerciali conformi.",
  "settings.correctUse": "Uso corretto dei dati",
  "settings.informationalTool":
    "%{app} è uno strumento informativo, non un sistema ufficiale di emergenza.",
  "settings.dataDisclaimer":
    "Una rilevazione termica satellitare può essere incompleta, ritardata o dovuta a una sorgente di calore diversa da un incendio. Vento, nuvole e traiettorie sono dati modellati o stime e non sostituiscono le comunicazioni delle autorità competenti.",
  "settings.smokeOrFlames": "In presenza di fumo o fiamme",
  "settings.emergencyBody":
    "Contatta immediatamente il 112 o il 1515 e fornisci posizione e riferimenti visibili.",
  "settings.sources": "Fonti e attribuzioni",
  "settings.sardiniaBulletin": "Bollettino Regione Sardegna",
  "settings.privacySupport": "Privacy e assistenza",
  "settings.privacy": "Informativa privacy",
  "settings.support": "Supporto SabettaPiro",
  "settings.purchases": "Acquisti nell’app",
  "settings.purchaseBody":
    "La Sardegna è gratuita. Ogni Paese aggiuntivo è un acquisto non consumabile separato, senza abbonamento.",
  "settings.purchaseMeta":
    "Gli acquisti sono gestiti da Apple e possono essere ripristinati dalla sezione Paesi.",
  "settings.technicalVersion": "Versione tecnica",
  "settings.publicName": "Nome pubblico",
  "settings.noAccount":
    "Non è richiesto alcun account. Se attivi le notifiche, token push, coordinate, lingua e raggio vengono conservati dal servizio fino alla disattivazione.",
  "territories.title": "Territori",
  "territories.subtitle":
    "La Sardegna è inclusa. Ogni Paese si acquista una sola volta e resta disponibile sul tuo Apple ID.",
  "territories.modelTitle": "Sardegna gratis · Paesi da CHF 5",
  "territories.modelBody":
    "L’elenco mostra solo i Paesi disponibili su App Store. Il prezzo effettivo è quello nella valuta dell’utente; gli acquisti non sono abbonamenti.",
  "territories.connecting": "Collegamento ad App Store…",
  "territories.restore": "Ripristina acquisti",
  "territories.footer":
    "Gli sblocchi sono acquisti in-app non consumabili gestiti da Apple. Non richiediamo un account SabettaPiro.",
  "territories.selected": "Selezionato",
  "territories.inUse": "In uso",
  "territories.open": "Apri",
  "territories.selectHint": "Seleziona %{territory} come territorio attivo",
  "territories.purchaseHint":
    "Acquista l’accesso permanente a %{territory}",
  "territories.retryHint":
    "Riprova a caricare il prodotto App Store per %{territory}",
  "territories.unavailableHint":
    "%{territory} sarà acquistabile quando il prodotto sarà disponibile su App Store",
  "territories.comingSoon": "In arrivo",
  "territories.retry": "Riprova",
  "territories.storePending": "Prodotto App Store non ancora caricato",
  "territories.diagnosticTitle": "Diagnostica App Store",
  "territories.diagnosticBody":
    "StoreKit non ha restituito il prodotto Svizzera. Questi dati identificano il punto esatto del problema.",
  "territories.diagnosticConnection": "Connessione: %{status}",
  "territories.diagnosticConnected": "attiva",
  "territories.diagnosticDisconnected": "non attiva",
  "territories.diagnosticStorefront": "Storefront: %{storefront}",
  "territories.diagnosticUnknown": "non disponibile",
  "territories.diagnosticProduct": "Product ID richiesto: %{productId}",
  "territories.diagnosticResponse": "Prodotti restituiti: %{count}",
  "territories.diagnosticError": "Errore: %{error}",
  "territories.diagnosticNoError": "nessun errore; risposta vuota",
  "territories.included": "Inclusa · accesso completo",
  "territories.purchased": "Acquistata · accesso permanente",
  "territories.features": "Mappa, rilevazioni, meteo e avvisi",
  "alerts.title": "Avvisi",
  "alerts.subtitle": "Monitora una zona in %{territory} senza creare un account.",
  "alerts.monitoredArea": "Zona monitorata",
  "alerts.otherTerritory":
    "Questa zona appartiene a %{territory}. Se usi la posizione attuale verrà sostituita con una zona in %{activeTerritory}.",
  "alerts.otherTerritoryFallback": "un altro territorio",
  "alerts.reduceRadius": "Riduci il raggio",
  "alerts.increaseRadius": "Aumenta il raggio",
  "alerts.radius": "raggio di controllo",
  "alerts.nearbyCount": "rilevazioni recenti entro il raggio scelto",
  "alerts.nearbyOne": "rilevazione recente entro il raggio scelto",
  "alerts.updatePosition": "Aggiorna posizione",
  "alerts.removeArea": "Rimuovi zona",
  "alerts.locationPrivacy":
    "La posizione viene richiesta solo quando premi il pulsante. Le notifiche si attivano separatamente.",
  "alerts.usePosition": "Usa la mia posizione",
  "alerts.pushActive": "Notifiche push attive",
  "alerts.push": "Notifiche push",
  "alerts.activeBody":
    "Il server controlla le nuove rilevazioni satellitari anche quando l’app è chiusa. Gli avvisi sono informativi e non sostituiscono le autorità.",
  "alerts.inactiveBody":
    "Attivandole, token del dispositivo, coordinate, lingua e raggio vengono conservati dal servizio finché non li cancelli.",
  "alerts.sendTest": "Invia prova",
  "alerts.enable": "Attiva notifiche",
  "alerts.serviceUnavailable": "Servizio non disponibile",
  "alerts.disable": "Disattiva",
  "alerts.privacy": "Come trattiamo i dati delle notifiche ↗",
  "alerts.areaUpdated": "Zona aggiornata anche per le notifiche.",
  "alerts.updateRemoteFailed":
    "%{error} La modifica resta salvata sul telefono; riprova prima di affidarti agli avvisi.",
  "alerts.locationDenied":
    "Permesso di localizzazione non concesso. Puoi abilitarlo dalle impostazioni di iOS.",
  "alerts.outsideTerritory":
    "La posizione attuale non si trova in %{territory}. Seleziona il territorio corretto prima di creare la zona.",
  "alerts.myPosition": "La mia posizione · %{territory}",
  "alerts.locationFailed": "Non è stato possibile determinare la posizione.",
  "alerts.registrationUnavailable": "Registrazione notifiche non disponibile.",
  "alerts.enabled": "Notifiche attive. Abbiamo inviato un avviso di prova.",
  "alerts.testSent": "Notifica di prova inviata.",
  "alerts.disabled": "Notifiche disattivate e zona cancellata dal servizio.",
  "alerts.remoteDeleteFailed":
    "%{error} La registrazione remota non è stata cancellata: riprova con una connessione attiva.",
  "alerts.areaRemoved": "Zona monitorata rimossa.",
  "alerts.operationFailed": "Operazione non riuscita. Riprova.",
  "push.denied":
    "Notifiche non autorizzate. Puoi abilitarle nelle impostazioni di iOS.",
  "push.projectMissing": "Identificativo EAS non disponibile in questa build.",
  "errors.unreachableApp":
    "Impossibile raggiungere SabettaPiro. Controlla la connessione e riprova.",
  "errors.invalidResponse": "Il servizio ha restituito una risposta non valida.",
  "errors.serviceUnavailable": "Il servizio è temporaneamente non disponibile.",
  "errors.notificationsUnreachable":
    "Impossibile raggiungere il servizio notifiche.",
  "errors.notificationsUnavailable":
    "Il servizio notifiche è temporaneamente non disponibile.",
  "errors.refreshFailed": "Aggiornamento non riuscito. Riprova tra poco.",
  "errors.windUnavailable": "Vento temporaneamente non disponibile.",
  "errors.cloudUnavailable": "Nuvolosità temporaneamente non disponibile.",
  "store.cancelled": "Acquisto annullato.",
  "store.unavailable": "App Store non disponibile. Riprova tra poco.",
  "store.unverified": "Acquisto non verificato da App Store.",
  "store.completedTitle": "Acquisto non completato",
  "store.available": "%{territory} è ora disponibile.",
  "store.selected": "%{territory} selezionata.",
  "store.notConnected":
    "App Store non è collegato. Controlla la connessione e riprova.",
  "store.unavailableTitle": "Acquisto non disponibile",
  "store.checking": "Verifica disponibilità di %{territory}…",
  "store.productPending":
    "%{territory} non è ancora disponibile su App Store. La configurazione del prodotto potrebbe essere ancora in elaborazione.",
  "store.notConnectedShort": "App Store non è ancora collegato.",
  "store.restored": "Acquisti ripristinati.",
  "store.free": "Gratis",
  "format.timeUnavailable": "Orario non disponibile",
  "format.ageUnavailable": "Età non disponibile",
  "format.minutesAgo": "%{count} min fa",
  "format.hoursAgo": "%{hours} h %{minutes} min fa",
  "format.daysAgo": "%{count} %{unit} fa",
  "format.day": "giorno",
  "format.days": "giorni",
  "confidence.high": "Alta",
  "confidence.nominal": "Nominale",
  "confidence.low": "Bassa",
  "confidence.unknown": "Non disponibile",
  "severity.critical": "Priorità molto alta",
  "severity.high": "Priorità alta",
  "severity.medium": "Priorità media",
  "severity.low": "Priorità bassa",
} as const;

type TranslationKey = keyof typeof it;

const en: Record<TranslationKey, string> = {
  "tabs.map": "Map",
  "tabs.events": "Events",
  "tabs.alerts": "Alerts",
  "tabs.territories": "Countries",
  "tabs.info": "Info",
  "common.active": "Active",
  "common.limited": "Limited",
  "common.notAvailable": "n/a",
  "map.chooseTerritory": "Choose country",
  "map.subtitle": "Wildfires, wind and cloud cover in one view",
  "map.refresh": "Refresh all data",
  "map.limitedFeed":
    "NASA FIRMS point feed is limited; wind and cloud cover remain available.",
  "map.updated": "Data updated %{time}",
  "map.connecting": "Connecting to data sources",
  "map.wind": "Wind",
  "map.clouds": "Clouds",
  "map.baseSatellite": "SAT",
  "map.baseTopographic": "TOPO",
  "map.baseStreet": "MAP",
  "map.loading": "Loading map…",
  "map.detections": "Detections",
  "map.windLegend": "↗ wind km/h",
  "map.forecastLegend": "☁ forecast",
  "map.cloudPrevious": "Previous cloud frame",
  "map.cloudPause": "Pause cloud animation",
  "map.cloudPlay": "Play cloud animation",
  "map.cloudUnavailable": "Cloud cover unavailable",
  "map.modeledForecast": "Model forecast",
  "map.averageCover": "Average cover %{cover}% · %{current}/%{total}",
  "map.cloudNext": "Next cloud frame",
  "map.thermalDetection": "Thermal detection",
  "map.closeDetail": "Close details",
  "map.reliability": "confidence %{value}",
  "map.smokeDrift": "Indicative smoke drift",
  "map.smokeSummary": "towards %{direction} · average wind %{speed} km/h",
  "map.smokeDisclaimer":
    "Simplified estimate, not a dispersion model or an official forecast.",
  "map.analyzeWind": "Analyse wind and smoke",
  "map.windAnalysisUnavailable": "Wind analysis is temporarily unavailable.",
  "events.title": "Detections",
  "events.subtitle":
    "%{territory} · satellite thermal anomalies, newest first.",
  "events.loading": "Loading detections",
  "events.inPeriod": "In period",
  "events.highConfidence": "High confidence",
  "events.emptyTitle": "No detections available",
  "events.emptyBody":
    "The feed may not be configured or may have no recent observations.",
  "event.thermalDetection": "Thermal detection",
  "event.reliability": "Confidence",
  "event.sensor": "Sensor",
  "event.notice":
    "Satellite-observed anomaly; it does not automatically indicate a confirmed wildfire.",
  "settings.title": "Information",
  "settings.subtitle": "Sources, service status and operating limits.",
  "settings.serviceStatus": "Service status",
  "settings.activeTerritory": "Active country",
  "settings.availableTerritories": "Available territories",
  "settings.unlockedCount": "%{total} · %{count} unlocked",
  "settings.windSource": "Open-Meteo wind",
  "settings.cloudSource": "Open-Meteo cloud cover",
  "settings.proximityAlerts": "Proximity alerts",
  "settings.refreshEvery": "Expected refresh every %{seconds} seconds.",
  "settings.sourceCompliance": "Source compliance",
  "settings.weatherService": "Weather service",
  "settings.weatherMode": "Weather mode",
  "settings.commercialActive": "Commercial licence active",
  "settings.evaluation": "Evaluation / internal testing",
  "settings.commercialVerified": "Commercial configuration verified",
  "settings.paidDisabled": "Paid release not yet enabled",
  "settings.commercialBody":
    "The backend reports that the commercial endpoint is configured. Terms verification remains part of the release checklist.",
  "settings.evaluationBody":
    "This build uses weather data in evaluation mode. Compliant commercial endpoints and credentials are required before public sale.",
  "settings.correctUse": "Proper use of data",
  "settings.informationalTool":
    "%{app} is an information tool, not an official emergency system.",
  "settings.dataDisclaimer":
    "A satellite thermal detection may be incomplete, delayed or caused by a heat source other than a wildfire. Wind, cloud and trajectory data are modelled or estimated and do not replace communications from the competent authorities.",
  "settings.smokeOrFlames": "If you see smoke or flames",
  "settings.emergencyBody":
    "Call 112 immediately and provide your location and visible landmarks.",
  "settings.sources": "Sources and attribution",
  "settings.sardiniaBulletin": "Sardinia Region bulletin",
  "settings.privacySupport": "Privacy and support",
  "settings.privacy": "Privacy policy",
  "settings.support": "SabettaPiro support",
  "settings.purchases": "In-app purchases",
  "settings.purchaseBody":
    "Sardinia is free. Each additional country is a separate non-consumable purchase with no subscription.",
  "settings.purchaseMeta":
    "Purchases are managed by Apple and can be restored from the Countries section.",
  "settings.technicalVersion": "Technical version",
  "settings.publicName": "Public name",
  "settings.noAccount":
    "No account is required. If you enable notifications, the service stores the push token, coordinates, language and radius until you disable them.",
  "territories.title": "Territories",
  "territories.subtitle":
    "Sardinia is included. Each country is purchased once and remains available with your Apple ID.",
  "territories.modelTitle": "Free Sardinia · Countries from CHF 5",
  "territories.modelBody":
    "Only countries available on the App Store are listed. The actual price uses the user’s store currency; purchases are not subscriptions.",
  "territories.connecting": "Connecting to the App Store…",
  "territories.restore": "Restore purchases",
  "territories.footer":
    "Unlocks are non-consumable in-app purchases managed by Apple. No SabettaPiro account is required.",
  "territories.selected": "Selected",
  "territories.inUse": "In use",
  "territories.open": "Open",
  "territories.selectHint": "Select %{territory} as the active territory",
  "territories.purchaseHint": "Purchase permanent access to %{territory}",
  "territories.retryHint":
    "Try loading the App Store product for %{territory} again",
  "territories.unavailableHint":
    "%{territory} can be purchased when the product becomes available on the App Store",
  "territories.comingSoon": "Coming soon",
  "territories.retry": "Try again",
  "territories.storePending": "App Store product not loaded yet",
  "territories.diagnosticTitle": "App Store diagnostics",
  "territories.diagnosticBody":
    "StoreKit did not return the Switzerland product. These details identify where the failure occurs.",
  "territories.diagnosticConnection": "Connection: %{status}",
  "territories.diagnosticConnected": "active",
  "territories.diagnosticDisconnected": "not active",
  "territories.diagnosticStorefront": "Storefront: %{storefront}",
  "territories.diagnosticUnknown": "unavailable",
  "territories.diagnosticProduct": "Requested product ID: %{productId}",
  "territories.diagnosticResponse": "Products returned: %{count}",
  "territories.diagnosticError": "Error: %{error}",
  "territories.diagnosticNoError": "no error; empty response",
  "territories.included": "Included · full access",
  "territories.purchased": "Purchased · permanent access",
  "territories.features": "Map, detections, weather and alerts",
  "alerts.title": "Alerts",
  "alerts.subtitle": "Monitor an area in %{territory} without creating an account.",
  "alerts.monitoredArea": "Monitored area",
  "alerts.otherTerritory":
    "This area belongs to %{territory}. Using your current location will replace it with an area in %{activeTerritory}.",
  "alerts.otherTerritoryFallback": "another territory",
  "alerts.reduceRadius": "Reduce radius",
  "alerts.increaseRadius": "Increase radius",
  "alerts.radius": "monitoring radius",
  "alerts.nearbyCount": "recent detections within the selected radius",
  "alerts.nearbyOne": "recent detection within the selected radius",
  "alerts.updatePosition": "Update location",
  "alerts.removeArea": "Remove area",
  "alerts.locationPrivacy":
    "Location is requested only when you press the button. Notifications are enabled separately.",
  "alerts.usePosition": "Use my location",
  "alerts.pushActive": "Push notifications active",
  "alerts.push": "Push notifications",
  "alerts.activeBody":
    "The server checks new satellite detections even when the app is closed. Alerts are informational and do not replace the authorities.",
  "alerts.inactiveBody":
    "When enabled, the service stores the device token, coordinates, language and radius until you delete them.",
  "alerts.sendTest": "Send test",
  "alerts.enable": "Enable notifications",
  "alerts.serviceUnavailable": "Service unavailable",
  "alerts.disable": "Disable",
  "alerts.privacy": "How we handle notification data ↗",
  "alerts.areaUpdated": "The notification area was also updated.",
  "alerts.updateRemoteFailed":
    "%{error} The change remains saved on this phone; try again before relying on alerts.",
  "alerts.locationDenied":
    "Location permission was not granted. You can enable it in iOS Settings.",
  "alerts.outsideTerritory":
    "Your current location is not in %{territory}. Select the correct country before creating the area.",
  "alerts.myPosition": "My location · %{territory}",
  "alerts.locationFailed": "Unable to determine your location.",
  "alerts.registrationUnavailable": "Notification registration is unavailable.",
  "alerts.enabled": "Notifications are active. We sent a test alert.",
  "alerts.testSent": "Test notification sent.",
  "alerts.disabled": "Notifications disabled and the area removed from the service.",
  "alerts.remoteDeleteFailed":
    "%{error} The remote registration was not deleted; try again with an active connection.",
  "alerts.areaRemoved": "Monitored area removed.",
  "alerts.operationFailed": "The operation failed. Try again.",
  "push.denied":
    "Notifications are not authorised. You can enable them in iOS Settings.",
  "push.projectMissing": "The EAS identifier is unavailable in this build.",
  "errors.unreachableApp":
    "Unable to reach SabettaPiro. Check your connection and try again.",
  "errors.invalidResponse": "The service returned an invalid response.",
  "errors.serviceUnavailable": "The service is temporarily unavailable.",
  "errors.notificationsUnreachable": "Unable to reach the notification service.",
  "errors.notificationsUnavailable":
    "The notification service is temporarily unavailable.",
  "errors.refreshFailed": "Refresh failed. Try again shortly.",
  "errors.windUnavailable": "Wind is temporarily unavailable.",
  "errors.cloudUnavailable": "Cloud cover is temporarily unavailable.",
  "store.cancelled": "Purchase cancelled.",
  "store.unavailable": "The App Store is unavailable. Try again shortly.",
  "store.unverified": "The purchase was not verified by the App Store.",
  "store.completedTitle": "Purchase not completed",
  "store.available": "%{territory} is now available.",
  "store.selected": "%{territory} selected.",
  "store.notConnected":
    "The App Store is not connected. Check your connection and try again.",
  "store.unavailableTitle": "Purchase unavailable",
  "store.checking": "Checking availability of %{territory}…",
  "store.productPending":
    "%{territory} is not yet available on the App Store. The product configuration may still be processing.",
  "store.notConnectedShort": "The App Store is not connected yet.",
  "store.restored": "Purchases restored.",
  "store.free": "Free",
  "format.timeUnavailable": "Time unavailable",
  "format.ageUnavailable": "Age unavailable",
  "format.minutesAgo": "%{count} min ago",
  "format.hoursAgo": "%{hours} h %{minutes} min ago",
  "format.daysAgo": "%{count} %{unit} ago",
  "format.day": "day",
  "format.days": "days",
  "confidence.high": "High",
  "confidence.nominal": "Nominal",
  "confidence.low": "Low",
  "confidence.unknown": "Unavailable",
  "severity.critical": "Very high priority",
  "severity.high": "High priority",
  "severity.medium": "Medium priority",
  "severity.low": "Low priority",
};

const fr: Record<TranslationKey, string> = {
  ...en,
  "tabs.map": "Carte",
  "tabs.events": "Événements",
  "tabs.alerts": "Alertes",
  "tabs.territories": "Pays",
  "tabs.info": "Infos",
  "common.active": "Actif",
  "common.limited": "Limité",
  "common.notAvailable": "n.d.",
  "map.chooseTerritory": "Choisir un pays",
  "map.subtitle": "Incendies, vent et nébulosité en une seule vue",
  "map.refresh": "Actualiser toutes les données",
  "map.limitedFeed":
    "Le flux ponctuel NASA FIRMS est limité ; le vent et la nébulosité restent disponibles.",
  "map.updated": "Données actualisées %{time}",
  "map.connecting": "Connexion aux sources en cours",
  "map.wind": "Vent",
  "map.clouds": "Nuages",
  "map.baseSatellite": "SAT",
  "map.baseTopographic": "TOPO",
  "map.baseStreet": "PLAN",
  "map.loading": "Chargement de la carte…",
  "map.detections": "Détections",
  "map.windLegend": "↗ vent km/h",
  "map.forecastLegend": "☁ prévision",
  "map.cloudPrevious": "Image nuageuse précédente",
  "map.cloudPause": "Mettre l’animation en pause",
  "map.cloudPlay": "Lancer l’animation des nuages",
  "map.cloudUnavailable": "Nébulosité indisponible",
  "map.modeledForecast": "Prévision modélisée",
  "map.averageCover": "Couverture moyenne %{cover}% · %{current}/%{total}",
  "map.cloudNext": "Image nuageuse suivante",
  "map.thermalDetection": "Détection thermique",
  "map.closeDetail": "Fermer le détail",
  "map.reliability": "fiabilité %{value}",
  "map.smokeDrift": "Dérive indicative de la fumée",
  "map.smokeSummary": "vers %{direction} · vent moyen %{speed} km/h",
  "map.smokeDisclaimer":
    "Estimation simplifiée, ni modèle de dispersion ni prévision officielle.",
  "map.analyzeWind": "Analyser le vent et la fumée",
  "map.windAnalysisUnavailable":
    "L’analyse du vent est temporairement indisponible.",
  "events.title": "Détections",
  "events.subtitle":
    "%{territory} · anomalies thermiques satellitaires, les plus récentes d’abord.",
  "events.loading": "Chargement des détections",
  "events.inPeriod": "Sur la période",
  "events.highConfidence": "Haute fiabilité",
  "events.emptyTitle": "Aucune détection disponible",
  "events.emptyBody":
    "Le flux peut ne pas être configuré ou ne contenir aucune observation récente.",
  "event.thermalDetection": "Détection thermique",
  "event.reliability": "Fiabilité",
  "event.sensor": "Capteur",
  "event.notice":
    "Anomalie observée par satellite ; elle ne correspond pas nécessairement à un incendie confirmé.",
  "settings.title": "Informations",
  "settings.subtitle": "Sources, état du service et limites opérationnelles.",
  "settings.serviceStatus": "État du service",
  "settings.activeTerritory": "Pays actif",
  "settings.availableTerritories": "Territoires disponibles",
  "settings.unlockedCount": "%{total} · %{count} débloqués",
  "settings.windSource": "Vent Open-Meteo",
  "settings.cloudSource": "Nébulosité Open-Meteo",
  "settings.proximityAlerts": "Alertes de proximité",
  "settings.refreshEvery": "Actualisation prévue toutes les %{seconds} secondes.",
  "settings.sourceCompliance": "Conformité des sources",
  "settings.weatherService": "Service météo",
  "settings.weatherMode": "Mode météo",
  "settings.commercialActive": "Licence commerciale active",
  "settings.evaluation": "Évaluation / test interne",
  "settings.commercialVerified": "Configuration commerciale vérifiée",
  "settings.paidDisabled": "Version payante pas encore activée",
  "settings.commercialBody":
    "Le backend indique que le point d’accès commercial est configuré. La vérification des conditions reste dans la liste de contrôle avant publication.",
  "settings.evaluationBody":
    "Cette version utilise les données météo en mode évaluation. Des accès commerciaux conformes sont requis avant toute vente publique.",
  "settings.correctUse": "Bonne utilisation des données",
  "settings.informationalTool":
    "%{app} est un outil d’information, pas un système d’urgence officiel.",
  "settings.dataDisclaimer":
    "Une détection thermique satellitaire peut être incomplète, retardée ou causée par une autre source de chaleur. Les données de vent, de nuages et de trajectoire sont modélisées ou estimées et ne remplacent pas les communications des autorités compétentes.",
  "settings.smokeOrFlames": "En présence de fumée ou de flammes",
  "settings.emergencyBody":
    "Appelez immédiatement le 112 et indiquez votre position et les repères visibles.",
  "settings.sources": "Sources et attributions",
  "settings.sardiniaBulletin": "Bulletin de la Région Sardaigne",
  "settings.privacySupport": "Confidentialité et assistance",
  "settings.privacy": "Politique de confidentialité",
  "settings.support": "Assistance SabettaPiro",
  "settings.purchases": "Achats intégrés",
  "settings.purchaseBody":
    "La Sardaigne est gratuite. Chaque pays supplémentaire est un achat non consommable distinct, sans abonnement.",
  "settings.purchaseMeta":
    "Les achats sont gérés par Apple et peuvent être restaurés depuis la section Pays.",
  "settings.technicalVersion": "Version technique",
  "settings.publicName": "Nom public",
  "settings.noAccount":
    "Aucun compte n’est requis. Si vous activez les notifications, le service conserve le jeton push, les coordonnées, la langue et le rayon jusqu’à leur désactivation.",
  "territories.title": "Territoires",
  "territories.subtitle":
    "La Sardaigne est incluse. Chaque pays s’achète une seule fois et reste disponible avec votre identifiant Apple.",
  "territories.modelTitle": "Sardaigne gratuite · Pays dès CHF 5",
  "territories.modelBody":
    "Seuls les pays disponibles sur l’App Store sont affichés. Le prix utilise la devise de l’utilisateur ; il ne s’agit pas d’abonnements.",
  "territories.connecting": "Connexion à l’App Store…",
  "territories.restore": "Restaurer les achats",
  "territories.footer":
    "Les déblocages sont des achats intégrés non consommables gérés par Apple. Aucun compte SabettaPiro n’est requis.",
  "territories.selected": "Sélectionné",
  "territories.inUse": "Actif",
  "territories.open": "Ouvrir",
  "territories.selectHint": "Sélectionner %{territory} comme territoire actif",
  "territories.purchaseHint": "Acheter l’accès permanent à %{territory}",
  "territories.retryHint":
    "Réessayer de charger le produit App Store pour %{territory}",
  "territories.unavailableHint":
    "%{territory} pourra être acheté lorsque le produit sera disponible sur l’App Store",
  "territories.comingSoon": "Bientôt disponible",
  "territories.retry": "Réessayer",
  "territories.storePending": "Produit App Store pas encore chargé",
  "territories.diagnosticTitle": "Diagnostic App Store",
  "territories.diagnosticBody":
    "StoreKit n’a pas renvoyé le produit Suisse. Ces données permettent d’identifier précisément le problème.",
  "territories.diagnosticConnection": "Connexion : %{status}",
  "territories.diagnosticConnected": "active",
  "territories.diagnosticDisconnected": "inactive",
  "territories.diagnosticStorefront": "Storefront : %{storefront}",
  "territories.diagnosticUnknown": "indisponible",
  "territories.diagnosticProduct": "Product ID demandé : %{productId}",
  "territories.diagnosticResponse": "Produits renvoyés : %{count}",
  "territories.diagnosticError": "Erreur : %{error}",
  "territories.diagnosticNoError": "aucune erreur ; réponse vide",
  "territories.included": "Incluse · accès complet",
  "territories.purchased": "Acheté · accès permanent",
  "territories.features": "Carte, détections, météo et alertes",
  "alerts.title": "Alertes",
  "alerts.subtitle": "Surveillez une zone en %{territory} sans créer de compte.",
  "alerts.monitoredArea": "Zone surveillée",
  "alerts.otherTerritory":
    "Cette zone appartient à %{territory}. L’utilisation de la position actuelle la remplacera par une zone en %{activeTerritory}.",
  "alerts.otherTerritoryFallback": "un autre territoire",
  "alerts.reduceRadius": "Réduire le rayon",
  "alerts.increaseRadius": "Augmenter le rayon",
  "alerts.radius": "rayon de surveillance",
  "alerts.nearbyCount": "détections récentes dans le rayon choisi",
  "alerts.nearbyOne": "détection récente dans le rayon choisi",
  "alerts.updatePosition": "Actualiser la position",
  "alerts.removeArea": "Supprimer la zone",
  "alerts.locationPrivacy":
    "La position n’est demandée que lorsque vous appuyez sur le bouton. Les notifications s’activent séparément.",
  "alerts.usePosition": "Utiliser ma position",
  "alerts.pushActive": "Notifications push actives",
  "alerts.push": "Notifications push",
  "alerts.activeBody":
    "Le serveur vérifie les nouvelles détections même lorsque l’app est fermée. Les alertes sont informatives et ne remplacent pas les autorités.",
  "alerts.inactiveBody":
    "Le service conserve le jeton de l’appareil, les coordonnées, la langue et le rayon jusqu’à leur suppression.",
  "alerts.sendTest": "Envoyer un test",
  "alerts.enable": "Activer les notifications",
  "alerts.serviceUnavailable": "Service indisponible",
  "alerts.disable": "Désactiver",
  "alerts.privacy": "Traitement des données de notification ↗",
  "alerts.areaUpdated": "La zone des notifications a aussi été actualisée.",
  "alerts.updateRemoteFailed":
    "%{error} La modification reste enregistrée sur ce téléphone ; réessayez avant de vous fier aux alertes.",
  "alerts.locationDenied":
    "L’accès à la position n’a pas été autorisé. Vous pouvez l’activer dans les réglages iOS.",
  "alerts.outsideTerritory":
    "Votre position actuelle n’est pas en %{territory}. Sélectionnez le bon pays avant de créer la zone.",
  "alerts.myPosition": "Ma position · %{territory}",
  "alerts.locationFailed": "Impossible de déterminer votre position.",
  "alerts.registrationUnavailable":
    "L’enregistrement des notifications est indisponible.",
  "alerts.enabled": "Les notifications sont actives. Une alerte test a été envoyée.",
  "alerts.testSent": "Notification test envoyée.",
  "alerts.disabled":
    "Notifications désactivées et zone supprimée du service.",
  "alerts.remoteDeleteFailed":
    "%{error} L’enregistrement distant n’a pas été supprimé ; réessayez avec une connexion active.",
  "alerts.areaRemoved": "Zone surveillée supprimée.",
  "alerts.operationFailed": "L’opération a échoué. Réessayez.",
  "push.denied":
    "Les notifications ne sont pas autorisées. Vous pouvez les activer dans les réglages iOS.",
  "push.projectMissing": "L’identifiant EAS est indisponible dans cette version.",
  "errors.unreachableApp":
    "Impossible de joindre SabettaPiro. Vérifiez votre connexion et réessayez.",
  "errors.invalidResponse": "Le service a renvoyé une réponse non valide.",
  "errors.serviceUnavailable": "Le service est temporairement indisponible.",
  "errors.notificationsUnreachable":
    "Impossible de joindre le service de notification.",
  "errors.notificationsUnavailable":
    "Le service de notification est temporairement indisponible.",
  "errors.refreshFailed": "Échec de l’actualisation. Réessayez bientôt.",
  "errors.windUnavailable": "Le vent est temporairement indisponible.",
  "errors.cloudUnavailable": "La nébulosité est temporairement indisponible.",
  "store.cancelled": "Achat annulé.",
  "store.unavailable": "L’App Store est indisponible. Réessayez bientôt.",
  "store.unverified": "L’achat n’a pas été vérifié par l’App Store.",
  "store.completedTitle": "Achat non finalisé",
  "store.available": "%{territory} est maintenant disponible.",
  "store.selected": "%{territory} sélectionnée.",
  "store.notConnected":
    "L’App Store n’est pas connecté. Vérifiez votre connexion et réessayez.",
  "store.unavailableTitle": "Achat indisponible",
  "store.checking": "Vérification de la disponibilité de %{territory}…",
  "store.productPending":
    "%{territory} n’est pas encore disponible sur l’App Store. La configuration du produit est peut-être encore en cours.",
  "store.notConnectedShort": "L’App Store n’est pas encore connecté.",
  "store.restored": "Achats restaurés.",
  "store.free": "Gratuit",
  "format.timeUnavailable": "Horaire indisponible",
  "format.ageUnavailable": "Âge indisponible",
  "format.minutesAgo": "il y a %{count} min",
  "format.hoursAgo": "il y a %{hours} h %{minutes} min",
  "format.daysAgo": "il y a %{count} %{unit}",
  "format.day": "jour",
  "format.days": "jours",
  "confidence.high": "Haute",
  "confidence.nominal": "Nominale",
  "confidence.low": "Basse",
  "confidence.unknown": "Indisponible",
  "severity.critical": "Priorité très élevée",
  "severity.high": "Priorité élevée",
  "severity.medium": "Priorité moyenne",
  "severity.low": "Priorité faible",
};

const de: Record<TranslationKey, string> = {
  ...en,
  "tabs.map": "Karte",
  "tabs.events": "Ereignisse",
  "tabs.alerts": "Warnungen",
  "tabs.territories": "Länder",
  "tabs.info": "Info",
  "common.active": "Aktiv",
  "common.limited": "Eingeschränkt",
  "common.notAvailable": "k. A.",
  "map.chooseTerritory": "Land auswählen",
  "map.subtitle": "Waldbrände, Wind und Bewölkung auf einen Blick",
  "map.refresh": "Alle Daten aktualisieren",
  "map.limitedFeed":
    "Der NASA-FIRMS-Punktfeed ist eingeschränkt; Wind und Bewölkung bleiben verfügbar.",
  "map.updated": "Daten aktualisiert %{time}",
  "map.connecting": "Verbindung zu den Datenquellen",
  "map.wind": "Wind",
  "map.clouds": "Wolken",
  "map.baseSatellite": "SAT",
  "map.baseTopographic": "TOPO",
  "map.baseStreet": "KARTE",
  "map.loading": "Karte wird geladen…",
  "map.detections": "Erfassungen",
  "map.windLegend": "↗ Wind km/h",
  "map.forecastLegend": "☁ Prognose",
  "map.cloudPrevious": "Vorheriges Wolkenbild",
  "map.cloudPause": "Wolkenanimation pausieren",
  "map.cloudPlay": "Wolkenanimation starten",
  "map.cloudUnavailable": "Bewölkung nicht verfügbar",
  "map.modeledForecast": "Modellprognose",
  "map.averageCover": "Mittlere Bedeckung %{cover}% · %{current}/%{total}",
  "map.cloudNext": "Nächstes Wolkenbild",
  "map.thermalDetection": "Thermische Erfassung",
  "map.closeDetail": "Details schließen",
  "map.reliability": "Zuverlässigkeit %{value}",
  "map.smokeDrift": "Geschätzte Rauchdrift",
  "map.smokeSummary": "Richtung %{direction} · Ø Wind %{speed} km/h",
  "map.smokeDisclaimer":
    "Vereinfachte Schätzung, kein Ausbreitungsmodell und keine amtliche Prognose.",
  "map.analyzeWind": "Wind und Rauch analysieren",
  "map.windAnalysisUnavailable":
    "Die Windanalyse ist vorübergehend nicht verfügbar.",
  "events.title": "Erfassungen",
  "events.subtitle":
    "%{territory} · thermische Satellitenanomalien, neueste zuerst.",
  "events.loading": "Erfassungen werden geladen",
  "events.inPeriod": "Im Zeitraum",
  "events.highConfidence": "Hohe Zuverlässigkeit",
  "events.emptyTitle": "Keine Erfassungen verfügbar",
  "events.emptyBody":
    "Der Feed ist möglicherweise nicht konfiguriert oder enthält keine aktuellen Beobachtungen.",
  "event.thermalDetection": "Thermische Erfassung",
  "event.reliability": "Zuverlässigkeit",
  "event.sensor": "Sensor",
  "event.notice":
    "Vom Satelliten beobachtete Anomalie; sie bedeutet nicht automatisch einen bestätigten Waldbrand.",
  "settings.title": "Informationen",
  "settings.subtitle": "Quellen, Dienststatus und Betriebsgrenzen.",
  "settings.serviceStatus": "Dienststatus",
  "settings.activeTerritory": "Aktives Land",
  "settings.availableTerritories": "Verfügbare Gebiete",
  "settings.unlockedCount": "%{total} · %{count} freigeschaltet",
  "settings.windSource": "Open-Meteo-Wind",
  "settings.cloudSource": "Open-Meteo-Bewölkung",
  "settings.proximityAlerts": "Umgebungswarnungen",
  "settings.refreshEvery": "Aktualisierung alle %{seconds} Sekunden vorgesehen.",
  "settings.sourceCompliance": "Quellenkonformität",
  "settings.weatherService": "Wetterdienst",
  "settings.weatherMode": "Wettermodus",
  "settings.commercialActive": "Kommerzielle Lizenz aktiv",
  "settings.evaluation": "Evaluierung / interner Test",
  "settings.commercialVerified": "Kommerzielle Konfiguration geprüft",
  "settings.paidDisabled": "Kostenpflichtige Veröffentlichung noch nicht aktiviert",
  "settings.commercialBody":
    "Das Backend meldet einen konfigurierten kommerziellen Endpunkt. Die Prüfung der Bedingungen bleibt Teil der Release-Checkliste.",
  "settings.evaluationBody":
    "Diese Version nutzt Wetterdaten im Evaluierungsmodus. Vor dem öffentlichen Verkauf sind konforme kommerzielle Zugänge erforderlich.",
  "settings.correctUse": "Sachgerechte Datennutzung",
  "settings.informationalTool":
    "%{app} ist ein Informationswerkzeug, kein amtliches Notfallsystem.",
  "settings.dataDisclaimer":
    "Eine thermische Satellitenerfassung kann unvollständig, verzögert oder durch eine andere Wärmequelle verursacht sein. Wind-, Wolken- und Trajektoriendaten sind modelliert oder geschätzt und ersetzen keine Mitteilungen der zuständigen Behörden.",
  "settings.smokeOrFlames": "Bei Rauch oder Flammen",
  "settings.emergencyBody":
    "Rufen Sie sofort 112 an und nennen Sie Ihren Standort und sichtbare Orientierungspunkte.",
  "settings.sources": "Quellen und Nachweise",
  "settings.sardiniaBulletin": "Bulletin der Region Sardinien",
  "settings.privacySupport": "Datenschutz und Hilfe",
  "settings.privacy": "Datenschutzerklärung",
  "settings.support": "SabettaPiro-Support",
  "settings.purchases": "In-App-Käufe",
  "settings.purchaseBody":
    "Sardinien ist kostenlos. Jedes zusätzliche Land ist ein separater, nicht verbrauchbarer Kauf ohne Abonnement.",
  "settings.purchaseMeta":
    "Käufe werden von Apple verwaltet und können im Bereich Länder wiederhergestellt werden.",
  "settings.technicalVersion": "Technische Version",
  "settings.publicName": "Öffentlicher Name",
  "settings.noAccount":
    "Es ist kein Konto erforderlich. Bei aktivierten Benachrichtigungen speichert der Dienst Push-Token, Koordinaten, Sprache und Radius bis zur Deaktivierung.",
  "territories.title": "Gebiete",
  "territories.subtitle":
    "Sardinien ist enthalten. Jedes Land wird einmal gekauft und bleibt mit Ihrer Apple-ID verfügbar.",
  "territories.modelTitle": "Sardinien kostenlos · Länder ab CHF 5",
  "territories.modelBody":
    "Es werden nur im App Store verfügbare Länder angezeigt. Der Preis nutzt die Store-Währung des Nutzers; die Käufe sind keine Abonnements.",
  "territories.connecting": "Verbindung zum App Store…",
  "territories.restore": "Käufe wiederherstellen",
  "territories.footer":
    "Freischaltungen sind nicht verbrauchbare In-App-Käufe von Apple. Ein SabettaPiro-Konto ist nicht erforderlich.",
  "territories.selected": "Ausgewählt",
  "territories.inUse": "Aktiv",
  "territories.open": "Öffnen",
  "territories.selectHint": "%{territory} als aktives Gebiet auswählen",
  "territories.purchaseHint": "Dauerhaften Zugriff auf %{territory} kaufen",
  "territories.retryHint":
    "App-Store-Produkt für %{territory} erneut laden",
  "territories.unavailableHint":
    "%{territory} kann gekauft werden, sobald das Produkt im App Store verfügbar ist",
  "territories.comingSoon": "Demnächst",
  "territories.retry": "Erneut versuchen",
  "territories.storePending": "App-Store-Produkt noch nicht geladen",
  "territories.diagnosticTitle": "App-Store-Diagnose",
  "territories.diagnosticBody":
    "StoreKit hat das Produkt Schweiz nicht zurückgegeben. Diese Angaben zeigen die genaue Fehlerstelle.",
  "territories.diagnosticConnection": "Verbindung: %{status}",
  "territories.diagnosticConnected": "aktiv",
  "territories.diagnosticDisconnected": "nicht aktiv",
  "territories.diagnosticStorefront": "Storefront: %{storefront}",
  "territories.diagnosticUnknown": "nicht verfügbar",
  "territories.diagnosticProduct": "Angeforderte Product ID: %{productId}",
  "territories.diagnosticResponse": "Zurückgegebene Produkte: %{count}",
  "territories.diagnosticError": "Fehler: %{error}",
  "territories.diagnosticNoError": "kein Fehler; leere Antwort",
  "territories.included": "Enthalten · vollständiger Zugriff",
  "territories.purchased": "Gekauft · dauerhafter Zugriff",
  "territories.features": "Karte, Erfassungen, Wetter und Warnungen",
  "alerts.title": "Warnungen",
  "alerts.subtitle": "Gebiet in %{territory} ohne Konto überwachen.",
  "alerts.monitoredArea": "Überwachtes Gebiet",
  "alerts.otherTerritory":
    "Dieses Gebiet gehört zu %{territory}. Bei Nutzung des aktuellen Standorts wird es durch ein Gebiet in %{activeTerritory} ersetzt.",
  "alerts.otherTerritoryFallback": "einem anderen Gebiet",
  "alerts.reduceRadius": "Radius verkleinern",
  "alerts.increaseRadius": "Radius vergrößern",
  "alerts.radius": "Überwachungsradius",
  "alerts.nearbyCount": "aktuelle Erfassungen im gewählten Radius",
  "alerts.nearbyOne": "aktuelle Erfassung im gewählten Radius",
  "alerts.updatePosition": "Standort aktualisieren",
  "alerts.removeArea": "Gebiet entfernen",
  "alerts.locationPrivacy":
    "Der Standort wird nur beim Drücken der Taste abgefragt. Benachrichtigungen werden separat aktiviert.",
  "alerts.usePosition": "Meinen Standort verwenden",
  "alerts.pushActive": "Push-Benachrichtigungen aktiv",
  "alerts.push": "Push-Benachrichtigungen",
  "alerts.activeBody":
    "Der Server prüft neue Satellitenerfassungen auch bei geschlossener App. Warnungen sind informativ und ersetzen nicht die Behörden.",
  "alerts.inactiveBody":
    "Der Dienst speichert Geräte-Token, Koordinaten, Sprache und Radius bis zur Löschung.",
  "alerts.sendTest": "Test senden",
  "alerts.enable": "Benachrichtigungen aktivieren",
  "alerts.serviceUnavailable": "Dienst nicht verfügbar",
  "alerts.disable": "Deaktivieren",
  "alerts.privacy": "Umgang mit Benachrichtigungsdaten ↗",
  "alerts.areaUpdated": "Das Benachrichtigungsgebiet wurde ebenfalls aktualisiert.",
  "alerts.updateRemoteFailed":
    "%{error} Die Änderung bleibt auf diesem Telefon gespeichert; versuchen Sie es erneut, bevor Sie sich auf Warnungen verlassen.",
  "alerts.locationDenied":
    "Der Standortzugriff wurde nicht erlaubt. Sie können ihn in den iOS-Einstellungen aktivieren.",
  "alerts.outsideTerritory":
    "Ihr aktueller Standort liegt nicht in %{territory}. Wählen Sie vor der Gebietserstellung das richtige Land.",
  "alerts.myPosition": "Mein Standort · %{territory}",
  "alerts.locationFailed": "Ihr Standort konnte nicht ermittelt werden.",
  "alerts.registrationUnavailable":
    "Die Benachrichtigungsregistrierung ist nicht verfügbar.",
  "alerts.enabled": "Benachrichtigungen sind aktiv. Eine Testwarnung wurde gesendet.",
  "alerts.testSent": "Testbenachrichtigung gesendet.",
  "alerts.disabled":
    "Benachrichtigungen deaktiviert und Gebiet vom Dienst gelöscht.",
  "alerts.remoteDeleteFailed":
    "%{error} Die Remote-Registrierung wurde nicht gelöscht; versuchen Sie es mit aktiver Verbindung erneut.",
  "alerts.areaRemoved": "Überwachtes Gebiet entfernt.",
  "alerts.operationFailed": "Vorgang fehlgeschlagen. Versuchen Sie es erneut.",
  "push.denied":
    "Benachrichtigungen sind nicht erlaubt. Sie können sie in den iOS-Einstellungen aktivieren.",
  "push.projectMissing": "Die EAS-Kennung ist in dieser Version nicht verfügbar.",
  "errors.unreachableApp":
    "SabettaPiro ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
  "errors.invalidResponse": "Der Dienst hat eine ungültige Antwort geliefert.",
  "errors.serviceUnavailable": "Der Dienst ist vorübergehend nicht verfügbar.",
  "errors.notificationsUnreachable":
    "Der Benachrichtigungsdienst ist nicht erreichbar.",
  "errors.notificationsUnavailable":
    "Der Benachrichtigungsdienst ist vorübergehend nicht verfügbar.",
  "errors.refreshFailed":
    "Aktualisierung fehlgeschlagen. Versuchen Sie es gleich erneut.",
  "errors.windUnavailable": "Winddaten sind vorübergehend nicht verfügbar.",
  "errors.cloudUnavailable": "Bewölkung ist vorübergehend nicht verfügbar.",
  "store.cancelled": "Kauf abgebrochen.",
  "store.unavailable": "Der App Store ist nicht verfügbar. Versuchen Sie es später.",
  "store.unverified": "Der Kauf wurde vom App Store nicht bestätigt.",
  "store.completedTitle": "Kauf nicht abgeschlossen",
  "store.available": "%{territory} ist jetzt verfügbar.",
  "store.selected": "%{territory} ausgewählt.",
  "store.notConnected":
    "Der App Store ist nicht verbunden. Prüfen Sie die Verbindung und versuchen Sie es erneut.",
  "store.unavailableTitle": "Kauf nicht verfügbar",
  "store.checking": "Verfügbarkeit von %{territory} wird geprüft…",
  "store.productPending":
    "%{territory} ist im App Store noch nicht verfügbar. Die Produktkonfiguration wird möglicherweise noch verarbeitet.",
  "store.notConnectedShort": "Der App Store ist noch nicht verbunden.",
  "store.restored": "Käufe wiederhergestellt.",
  "store.free": "Kostenlos",
  "format.timeUnavailable": "Zeit nicht verfügbar",
  "format.ageUnavailable": "Alter nicht verfügbar",
  "format.minutesAgo": "vor %{count} Min.",
  "format.hoursAgo": "vor %{hours} Std. %{minutes} Min.",
  "format.daysAgo": "vor %{count} %{unit}",
  "format.day": "Tag",
  "format.days": "Tagen",
  "confidence.high": "Hoch",
  "confidence.nominal": "Nominal",
  "confidence.low": "Niedrig",
  "confidence.unknown": "Nicht verfügbar",
  "severity.critical": "Sehr hohe Priorität",
  "severity.high": "Hohe Priorität",
  "severity.medium": "Mittlere Priorität",
  "severity.low": "Niedrige Priorität",
};

const translations: Record<
  AppLanguage,
  Record<TranslationKey, string>
> = { it, en, fr, de };

function resolveLocale() {
  const locales = getLocales();
  for (const locale of locales) {
    const language = locale.languageCode as AppLanguage | null;
    if (language && SUPPORTED_LANGUAGES.includes(language)) {
      return { language, locale: locale.languageTag || language };
    }
  }
  return { language: "en" as const, locale: "en" };
}

export function translate(
  key: TranslationKey,
  params: TranslationParams = {},
  language = resolveLocale().language,
): string {
  const template = translations[language]?.[key] ?? translations.en[key] ?? key;
  return template.replace(/%\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}

export function localizedTerritoryName(
  territory: Pick<Territory, "id" | "countryCode" | "name">,
  language = resolveLocale().language,
): string {
  const names = territoryNames as Record<
    string,
    Record<AppLanguage, string> | undefined
  >;
  return names[territory.id]?.[language] ?? territory.name;
}

export function localizedCompassLabel(
  degrees: number,
  language = resolveLocale().language,
): string {
  if (!Number.isFinite(degrees)) return translate("common.notAvailable", {}, language);
  const labels: Record<AppLanguage, string[]> = {
    it: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
    en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
    fr: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
    de: ["N", "NO", "O", "SO", "S", "SW", "W", "NW"],
  };
  const normalized = ((degrees % 360) + 360) % 360;
  return labels[language][Math.round(normalized / 45) % 8];
}

interface I18nContextValue {
  language: AppLanguage;
  locale: string;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  territoryName: (
    territory: Pick<Territory, "id" | "countryCode" | "name">,
  ) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [resolved, setResolved] = useState(resolveLocale);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const next = resolveLocale();
      setResolved((current) =>
        current.language === next.language && current.locale === next.locale
          ? current
          : next,
      );
    });
    return () => subscription.remove();
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      language: resolved.language,
      locale: resolved.locale,
      t: (key, params) => translate(key, params, resolved.language),
      territoryName: (territory) =>
        localizedTerritoryName(territory, resolved.language),
    }),
    [resolved.language, resolved.locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}

export function currentLanguage(): AppLanguage {
  return resolveLocale().language;
}

export function currentLocale(): string {
  return resolveLocale().locale;
}

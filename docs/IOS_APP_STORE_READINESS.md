# Sardinia FireWatch — preparazione App Store e TestFlight

Ultimo aggiornamento: 21 luglio 2026

## Stato tecnico

La base iOS e presente nella cartella `mobile/` ed e stata verificata con:

- TypeScript;
- Expo Doctor;
- risoluzione della configurazione pubblica Expo;
- creazione del bundle JavaScript per iOS.

La prima build firmata non e ancora stata creata.

## Identita dell'app

| Campo | Valore |
| --- | --- |
| Nome provvisorio App Store | Sardinia FireWatch |
| Sottotitolo proposto | Rilevazioni, vento e avvisi |
| Piattaforma | iOS / iPhone |
| Lingua principale | Italiano |
| Bundle ID | `com.guidogazzola.sardiniafirewatch` |
| SKU proposto | `SFW-IOS-001` |
| Versione app | `0.1.0` |
| Build iniziale | `1` |
| Account Apple | iscrizione individuale |

Il Bundle ID deve restare identico in Apple Developer, App Store Connect, Expo/EAS e nel progetto.

## Gate A — Apple Developer

Registrare un App ID esplicito:

- descrizione: `Sardinia FireWatch`;
- Bundle ID: `com.guidogazzola.sardiniafirewatch`;
- tipo: Explicit App ID.

Le capability devono essere abilitate solo quando utilizzate. Le notifiche push saranno attivate dopo la disponibilita del registro dispositivi sul backend.

## Gate B — App Store Connect

Creare una nuova scheda app con:

- piattaforma: iOS;
- nome: `Sardinia FireWatch`;
- lingua principale: Italiano;
- Bundle ID: `com.guidogazzola.sardiniafirewatch`;
- SKU: `SFW-IOS-001`;
- accesso utenti: completo.

Annotare l'Apple ID numerico assegnato alla scheda: servira come `ascAppId` per EAS Submit.

## Gate C — Expo ed EAS

1. Creare o usare un account Expo.
2. Dalla cartella `mobile/`, autenticarsi con EAS CLI.
3. Collegare il progetto a un progetto EAS con `eas init`.
4. Conservare il Project ID aggiunto alla configurazione Expo.
5. Configurare le credenziali iOS tramite EAS.

Comandi di riferimento:

```bash
cd mobile
npm install
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform ios --profile production
```

La build `production` e destinata ad App Store Connect/TestFlight. Una build `preview` con distribuzione interna richiede invece la registrazione dei dispositivi di prova.

## Gate D — pagine pubbliche

URL predisposti:

- Privacy Policy: `https://sardegna-firewatch.onrender.com/privacy.html`
- Supporto: `https://sardegna-firewatch.onrender.com/support.html`

Dopo il merge e il deploy su Render, verificare entrambi gli URL da una finestra anonima.

## Gate E — materiali App Store

Da completare prima dell'invio ad Apple:

- icona App Store 1024 × 1024 senza trasparenza;
- screenshot iPhone richiesti da App Store Connect;
- descrizione, parole chiave e testo promozionale;
- categoria primaria e secondaria;
- dichiarazioni App Privacy;
- classificazione per eta;
- informazioni per App Review;
- verifica finale delle attribuzioni delle mappe e delle fonti dati.

## Descrizione provvisoria

Sardinia FireWatch rende piu comprensibili le rilevazioni termiche satellitari e il contesto meteorologico della Sardegna. La mappa mostra dati recenti, fonte, orario e affidabilita; l'utente puo inoltre salvare sul dispositivo una zona da monitorare e controllare le rilevazioni entro un raggio selezionato.

L'app e uno strumento informativo. Le rilevazioni possono essere incomplete o ritardate e non equivalgono automaticamente a incendi confermati. In presenza di fumo o fiamme occorre contattare immediatamente il 112 o il 1515 e seguire le indicazioni delle autorita competenti.

## Note provvisorie per App Review

- Non e necessario creare un account.
- La posizione viene richiesta solo dopo un'azione esplicita dell'utente.
- Non viene usata la localizzazione in background.
- La zona monitorata resta sul dispositivo.
- Le notifiche push in background non sono ancora attive nella versione iniziale.
- Le anomalie termiche vengono descritte come rilevazioni e non come incendi confermati.

## Dati ancora necessari

Prima di avviare la build firmata occorrono:

- nome utente dell'account Expo;
- Project ID EAS;
- Apple ID numerico della scheda App Store Connect;
- conferma dell'App ID esplicito registrato;
- icona definitiva;
- canale pubblico di contatto per privacy e supporto.

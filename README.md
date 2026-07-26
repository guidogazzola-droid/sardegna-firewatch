# SabettaPiro / Sardegna FireWatch

Backend, dashboard web e applicazione iOS per osservare **hotspot
satellitari, vento, nuvolosita e avvisi di prossimita**. La Sardegna resta il
territorio gratuito; la versione iOS 0.3 introduce un catalogo di Paesi europei
sbloccabili singolarmente tramite acquisti in-app non consumabili.

Il progetto usa due livelli di servizio:

- **modalita immediata, senza credenziali:** layer cartografici WMS di Copernicus EFFIS;
- **modalita completa, con chiave gratuita NASA FIRMS:** punti interattivi, orario del passaggio satellitare, confidenza, FRP, filtri, cronologia e avvisi di prossimita.

> Il termine corretto e *quasi in tempo reale*. I satelliti osservano il territorio durante i passaggi orbitali e i prodotti possono arrivare con ritardo. Il sito non e una centrale operativa e non sostituisce gli avvisi della Protezione Civile, del Corpo Forestale o dei Vigili del Fuoco.

## Funzioni principali

- mappa della Sardegna con base stradale, satellitare e topografica;
- hotspot VIIRS e MODIS da Copernicus EFFIS;
- aree bruciate recenti e Fire Weather Index EFFIS;
- feed puntuale NASA FIRMS facoltativo, filtrabile per intervallo e affidabilita;
- classificazione visuale della priorita basata su confidenza e Fire Radiative Power;
- meteo locale per ogni rilevamento tramite Open-Meteo;
- storico orario del vento dal primo rilevamento satellitare disponibile fino alla consultazione;
- frecce del vento attuale visibili direttamente sulla mappa, con direzione di movimento e velocita in km/h;
- simulazione animata della copertura nuvolosa modellata per le successive 24 ore;
- direzione prevalente sottovento e traiettoria indicativa del fumo visualizzata sulla mappa;
- area personale con raggio da 5 a 100 km;
- notifiche browser per nuovi hotspot vicini, mentre la pagina web e aperta;
- registro anonimo delle zone iOS e notifiche push native anche ad app chiusa;
- Sardegna inclusa gratuitamente e 47 Paesi europei acquistabili separatamente;
- confini operativi di Stato, selezione persistente del territorio e
  ripristino degli acquisti Apple;
- verifica StoreKit 2 lato dispositivo e verifica delle transazioni firmate
  Apple per gli alert dei territori a pagamento;
- aggiornamento automatico, cache server e tolleranza al guasto di una singola sorgente;
- PWA installabile, interfaccia mobile e modalita a contrasto elevato;
- numeri di emergenza 1515 e 112 sempre visibili.

## Avvio rapido

Requisiti: Node.js 24 LTS.

```bash
cp .env.example .env
npm install
npm start
```

Aprire `http://localhost:3000`.

Senza altre impostazioni la mappa EFFIS e gia utilizzabile. Per attivare il feed puntuale:

1. richiedere gratuitamente una `MAP_KEY` su NASA FIRMS: <https://firms.modaps.eosdis.nasa.gov/api/map_key/>;
2. inserirla nel file `.env`:

```dotenv
FIRMS_MAP_KEY=la_tua_chiave
```

3. riavviare il server.

La chiave resta sul server: non viene mai inviata al browser.

## Configurazione

| Variabile | Predefinito | Descrizione |
| --- | ---: | --- |
| `PORT` | `3000` | Porta HTTP del server |
| `FIRMS_MAP_KEY` | vuota | Chiave NASA FIRMS; facoltativa |
| `CACHE_TTL_MS` | `300000` | Durata della cache del feed FIRMS |
| `ALERT_STORE_PATH` | `.data/alerts.json` | Registro notifiche; in produzione deve trovarsi su storage persistente |
| `ALERT_MONITOR_INTERVAL_MS` | `300000` | Frequenza del controllo push, minimo 60 secondi |
| `EXPO_ACCESS_TOKEN` | vuota | Token facoltativo se Expo Push Security e attiva |
| `OPEN_METEO_FORECAST_URL` | API pubblica | In produzione commerciale usare l'endpoint customer |
| `OPEN_METEO_API_KEY` | vuota | Chiave del piano Open-Meteo commerciale |
| `OPEN_METEO_REQUIRE_COMMERCIAL` | `false` | Impostare `true` nel servizio pubblico |
| `NODE_ENV` | `development` | Usare `production` in distribuzione |

## Docker

```bash
cp .env.example .env
docker compose up --build
```

L'applicazione sara disponibile su `http://localhost:3000`.

## Distribuzione

Il progetto funziona su qualsiasi hosting che esegua un servizio Node.js persistente, per esempio un VPS, Render, Railway, Fly.io o un container gestito. Impostare:

```text
Build command: npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
Start command: npm start
Health check: /api/health
```

Aggiungere `FIRMS_MAP_KEY` come variabile segreta nell'ambiente di hosting. Per geolocalizzazione, notifiche e PWA in produzione e necessario HTTPS.

## Endpoint interni

- `GET /api/health` — controllo di disponibilita;
- `GET /api/status` — modalita e sorgenti abilitate;
- `GET /api/territories` — catalogo territoriale senza geometrie;
- `GET /api/territories/:id` — metadati e confine del territorio;
- `GET /api/fires?territory=switzerland&days=1&sources=viirs` — rilevamenti normalizzati;
- `GET /api/weather?territory=italy&lat=41.9&lon=12.5` — meteo locale per un punto.
- `GET /api/wind-history?territory=italy&lat=41.9&lon=12.5&start=2026-07-18T10:00:00Z` — storico del vento e direzione indicativa del fumo.
- `GET /api/wind-grid?territory=sardinia&south=38.7&west=7.7&north=41.4&east=10.2&rows=4&columns=5` — griglia del vento attuale per l'area visibile.
- `GET /api/cloud-forecast?territory=sardinia` — sequenza oraria della copertura nuvolosa modellata.
- `POST /api/alerts/subscriptions` — registra anonimamente token push e zona monitorata.
- `PATCH /api/alerts/subscriptions/:id` — aggiorna la zona usando la chiave conservata sul dispositivo.
- `DELETE /api/alerts/subscriptions/:id` — cancella definitivamente la registrazione.
- `POST /api/alerts/subscriptions/:id/test` — invia una notifica di prova.

Valori ammessi per `sources`: `viirs`, `modis`, `all`. L'intervallo `days` e limitato a 1-5 giorni.

## Test

```bash
npm test
```

I test coprono parsing CSV, normalizzazione della confidenza, orari UTC,
classificazione della priorita, confini territoriali, catalogo prodotti,
verifica minima degli entitlement, stima dell'inizio evento, calcoli
vettoriali del vento, autenticazione del registro notifiche, filtri di
prossimita e deduplicazione.

## Struttura

```text
sardegna-firewatch/
├── lib/                  # client FIRMS, cache e configurazione
├── data/                 # catalogo/confini e manifest prodotti App Store
├── mobile/               # applicazione Expo iOS
├── public/               # interfaccia, PWA e librerie cartografiche
├── scripts/              # generazione riproducibile dei territori
├── test/                 # test automatici
├── server.js             # API proxy e server statico
├── Dockerfile
└── docker-compose.yml
```

## Fonti e attribuzioni

- Copernicus EFFIS, European Commission: <https://forest-fire.emergency.copernicus.eu/>
- NASA FIRMS: <https://firms.modaps.eosdis.nasa.gov/>
- Regione Autonoma della Sardegna, bollettino di pericolo incendio: <https://www.sardegnaambiente.it/index.php?c=7093&s=20&v=9&xsl=2273>
- Open-Meteo: <https://open-meteo.com/>
- OpenStreetMap: <https://www.openstreetmap.org/copyright>
- Esri World Imagery: attribuzione mostrata sulla mappa
- OpenTopoMap: <https://opentopomap.org/about>
- Leaflet e Leaflet.markercluster: licenze incluse in `public/vendor/`
- Natural Earth / world-atlas: confini territoriali semplificati

I confini sono semplificati per uso operativo e non costituiscono una
determinazione ufficiale o una presa di posizione su territori contesi. I
contenuti EFFIS sono soggetti alle condizioni e alle attribuzioni
Copernicus/Commissione europea. Verificare le condizioni dei singoli fornitori
prima di un uso commerciale o operativo.

## Acquisti territoriali iOS

La Sardegna e incorporata gratuitamente. I 47 prodotti elencati in
`data/app-store-products.csv` devono essere creati in App Store Connect come
**non-consumable**, mantenendo esattamente i product ID del manifest. Il prezzo
obiettivo nello storefront svizzero e CHF 5; l'app visualizza sempre il prezzo
localizzato restituito da StoreKit e offre il comando **Ripristina acquisti**.

## Limiti operativi

Un hotspot e un'anomalia termica, non la conferma definitiva di un incendio boschivo. Fonti industriali, superfici molto calde e altri fenomeni possono produrre falsi positivi. Nubi, fumo, risoluzione del sensore e orari dei passaggi possono nascondere un evento. L'inizio evento e stimato dal primo rilevamento disponibile entro 5 km; il fuoco potrebbe essere iniziato prima. Il vento a 10 m indica il settore probabilmente sottovento, ma non descrive la dispersione verticale, la turbolenza, l'orografia o la chimica del pennacchio. Per un sistema di allarme realmente operativo servono integrazione con sensori a terra, procedure di verifica, ridondanza, supervisione continua e collegamento con i canali istituzionali.

In presenza di fumo o fiamme, non attendere il satellite: chiamare **1515** o **112** e indicare posizione, direzione del fumo e riferimenti visibili.

## Pubblicazione rapida su Render

Il progetto include `render.yaml` e una procedura dettagliata in [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md). La configurazione predefinita usa un servizio Starter sempre attivo; per una semplice prova e possibile impostare temporaneamente `plan: free`.

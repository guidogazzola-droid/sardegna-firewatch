# Sardegna FireWatch

Dashboard web responsive per osservare **hotspot satellitari, aree bruciate recenti e pericolo meteorologico d'incendio in Sardegna**.

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
- notifiche browser per nuovi hotspot vicini, mentre la pagina e aperta;
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
- `GET /api/fires?days=1&sources=viirs` — rilevamenti normalizzati;
- `GET /api/weather?lat=40.0&lon=9.0` — meteo locale per un punto.
- `GET /api/wind-history?lat=40.0&lon=9.0&start=2026-07-18T10:00:00Z` — storico del vento e direzione indicativa del fumo.
- `GET /api/wind-grid?south=38.7&west=7.7&north=41.4&east=10.2&rows=4&columns=5` — griglia del vento attuale per l'area visibile.
- `GET /api/cloud-forecast` — sequenza oraria della copertura nuvolosa modellata sulla Sardegna.

Valori ammessi per `sources`: `viirs`, `modis`, `all`. L'intervallo `days` e limitato a 1-5 giorni.

## Test

```bash
npm test
```

I test coprono parsing CSV, normalizzazione della confidenza, orari UTC, classificazione della priorita, limiti geografici, stima dell'inizio evento e calcoli vettoriali del vento.

## Struttura

```text
sardegna-firewatch/
├── lib/                  # client FIRMS, cache e configurazione
├── public/               # interfaccia, PWA e librerie cartografiche
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

I contenuti EFFIS sono soggetti alle condizioni e alle attribuzioni Copernicus/Commissione europea. Verificare le condizioni dei singoli fornitori prima di un uso commerciale o operativo.

## Limiti operativi

Un hotspot e un'anomalia termica, non la conferma definitiva di un incendio boschivo. Fonti industriali, superfici molto calde e altri fenomeni possono produrre falsi positivi. Nubi, fumo, risoluzione del sensore e orari dei passaggi possono nascondere un evento. L'inizio evento e stimato dal primo rilevamento disponibile entro 5 km; il fuoco potrebbe essere iniziato prima. Il vento a 10 m indica il settore probabilmente sottovento, ma non descrive la dispersione verticale, la turbolenza, l'orografia o la chimica del pennacchio. Per un sistema di allarme realmente operativo servono integrazione con sensori a terra, procedure di verifica, ridondanza, supervisione continua e collegamento con i canali istituzionali.

In presenza di fumo o fiamme, non attendere il satellite: chiamare **1515** o **112** e indicare posizione, direzione del fumo e riferimenti visibili.

## Pubblicazione rapida su Render

Il progetto include `render.yaml` e una procedura dettagliata in [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md). La configurazione predefinita usa un servizio Starter sempre attivo; per una semplice prova e possibile impostare temporaneamente `plan: free`.

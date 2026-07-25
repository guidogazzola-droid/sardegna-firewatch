# Pubblicazione di Sardegna FireWatch su Render

Questa cartella include `render.yaml`, che configura il servizio web Node.js, il controllo di salute e le variabili d'ambiente.

## 1. Preparare GitHub

1. Crea un repository GitHub vuoto, per esempio `sardegna-firewatch`.
2. Carica **il contenuto di questa cartella** nella radice del repository. `package.json` e `render.yaml` devono risultare al primo livello.
3. Non caricare mai un file `.env`. La regola e gia presente in `.gitignore`.

## 2. Ottenere la chiave NASA FIRMS

Richiedi una MAP_KEY gratuita su:

https://firms.modaps.eosdis.nasa.gov/api/map_key/

Conservala come segreto: non inserirla nel codice o nel repository.

## 3. Creare il servizio su Render

1. Accedi a Render e collega l'account GitHub.
2. Seleziona **New > Blueprint**.
3. Collega il repository e usa `render.yaml` come Blueprint Path.
4. Quando viene richiesto `FIRMS_MAP_KEY`, incolla la chiave NASA.
5. Controlla il piano selezionato e avvia il deploy.

Il file usa `plan: starter`, adatto a un servizio sempre disponibile. Per una sola prova puoi cambiare temporaneamente la riga in `plan: free`; il servizio gratuito puo sospendersi dopo un periodo senza traffico.

### Persistenza necessaria per le notifiche iOS

Le registrazioni push non devono essere affidate al filesystem temporaneo del
servizio. Prima di abilitare le notifiche in una build pubblica:

1. aggiungi un disco persistente Render montato in `/var/data`;
2. configura `ALERT_STORE_PATH=/var/data/alerts.json`;
3. mantieni una sola istanza del servizio web;
4. verifica in `/api/status` che `alerts.persistentStorageConfigured` sia
   `true`.

Il codice funziona anche senza disco per test locali, ma un riavvio o un deploy
cancellerebbe le registrazioni. L'attivazione del disco e quindi un requisito di
rilascio, non un miglioramento facoltativo.

### Dati meteo commerciali

Per una distribuzione con acquisti in-app configura anche:

```text
OPEN_METEO_FORECAST_URL=https://customer-api.open-meteo.com/v1/forecast
OPEN_METEO_API_KEY=<segreto>
OPEN_METEO_REQUIRE_COMMERCIAL=true
```

La chiave deve restare esclusivamente nell'ambiente Render.

## 4. Verificare il deploy

Sostituisci `TUO-SERVIZIO.onrender.com` con il dominio assegnato:

- `https://TUO-SERVIZIO.onrender.com/api/health` deve restituire `"ok": true`;
- `https://TUO-SERVIZIO.onrender.com/api/status` deve mostrare `"mode": "full"` e `"firmsConfigured": true`;
- la stessa risposta deve mostrare `territories.available: 48`;
- `https://TUO-SERVIZIO.onrender.com/api/territories` deve restituire Sardegna e 47 Paesi;
- la pagina principale deve caricare la mappa.

Se `/api/status` mostra `effis-only`, la chiave FIRMS non e configurata o il servizio non e stato ridistribuito dopo averla aggiunta.

## 5. Collegare un dominio personale

Nel servizio Render apri **Settings > Custom Domains** e aggiungi, preferibilmente, un sottodominio come `incendi.example.it`.

Nel pannello DNS del tuo registrar crea un record CNAME:

- nome/host: `incendi`
- destinazione: il sottodominio Render, per esempio `sardegna-firewatch.onrender.com`

Torna su Render e premi **Verify**. Render emette e rinnova automaticamente il certificato HTTPS.

## 6. Aggiornamenti

Ogni nuova modifica inviata al ramo Git collegato puo generare automaticamente un nuovo deploy. Controlla sempre i log di Render dopo una modifica.

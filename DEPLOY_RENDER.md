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

## 4. Verificare il deploy

Sostituisci `TUO-SERVIZIO.onrender.com` con il dominio assegnato:

- `https://TUO-SERVIZIO.onrender.com/api/health` deve restituire `"ok": true`;
- `https://TUO-SERVIZIO.onrender.com/api/status` deve mostrare `"mode": "full"` e `"firmsConfigured": true`;
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

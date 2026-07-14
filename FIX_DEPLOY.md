# Correzione del deploy su Render

Questa versione corregge l'errore `npm error code ETIMEDOUT` mostrato dal primo deploy.
Il vecchio `package-lock.json` conteneva indirizzi di un registro npm interno non accessibile da Render.

## Cosa e stato corretto

- `package-lock.json` rigenerato con pacchetti risolti da `https://registry.npmjs.org/`;
- `.npmrc` aggiunto per forzare il registro npm pubblico;
- `render.yaml` aggiornato con un comando di build esplicito e riproducibile;
- dipendenze reinstallate da zero e test automatici eseguiti con successo.

## Procedura consigliata su GitHub

1. Estrai lo ZIP sul computer.
2. Apri il repository GitHub `sardegna-firewatch`.
3. Seleziona **Add file > Upload files**.
4. Trascina tutto il contenuto della cartella estratta, inclusi i file nascosti `.npmrc` e `.gitignore`.
5. GitHub mostrera i file esistenti come modificati: conferma con **Commit changes**.
6. Non caricare lo ZIP nel repository e non caricare la cartella `node_modules`.

Per una sostituzione minima sono indispensabili questi tre file nella radice del repository:

- `package-lock.json`
- `.npmrc`
- `render.yaml`

## Nuovo deploy su Render

Dopo il commit, Render dovrebbe avviare automaticamente un nuovo deploy. Se non parte:

1. apri il servizio `sardegna-firewatch`;
2. seleziona **Manual Deploy**;
3. scegli **Clear build cache & deploy**.

Nel nuovo log devono comparire riferimenti a:

```text
https://registry.npmjs.org/
```

seguiti da messaggi simili a:

```text
added ... packages
Build successful
Starting service
```

Al termine verifica:

```text
https://sardegna-firewatch.onrender.com/api/health
```

Il risultato atteso e:

```json
{"ok":true,"now":"..."}
```

Poi verifica:

```text
https://sardegna-firewatch.onrender.com/api/status
```

Con la chiave NASA configurata deve apparire `"mode":"full"`; senza chiave il sito resta comunque operativo in modalita `"effis-only"`.

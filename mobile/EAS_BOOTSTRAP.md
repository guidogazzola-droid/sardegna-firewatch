# Collegamento a Expo EAS

Il progetto mobile usa l'account Expo `Camerun`, ma il collegamento cloud richiede un'operazione autenticata eseguita dal proprietario dell'account.

## 1. Creare il token Expo

1. Accedere a Expo con l'account `Camerun`.
2. Aprire **Account settings > Access tokens**.
3. Creare un token personale dedicato a GitHub Actions.
4. Copiare il token una sola volta.

Il token non deve essere inserito nei file del repository, nelle issue, nelle pull request o nelle conversazioni.

## 2. Salvare il token come segreto GitHub

Nel repository `guidogazzola-droid/sardegna-firewatch` aprire:

**Settings > Secrets and variables > Actions > New repository secret**

Impostare:

```text
Name: EXPO_TOKEN
Secret: <token personale Expo>
```

## 3. Avviare il collegamento

Dopo che la pull request con il workflow di bootstrap e stata unita in `main`:

1. aprire la scheda **Actions** del repository;
2. scegliere **Bootstrap EAS project**;
3. premere **Run workflow** sul ramo `main`;
4. attendere il completamento.

Il workflow:

- verifica che il token appartenga all'account `Camerun`;
- crea oppure ritrova il progetto `@Camerun/sardinia-firewatch`;
- verifica il collegamento tramite EAS CLI;
- salva il `projectId` in una nuova branch;
- prova ad aprire automaticamente una pull request di revisione.

Il `projectId` non e un segreto. Il token Expo resta invece esclusivamente nei segreti GitHub.

## 4. Passaggio successivo

Dopo il merge della pull request contenente il `projectId`, il repository sara pronto per configurare le credenziali Apple e avviare la prima build iOS firmata. La prima configurazione delle credenziali Apple richiedera un passaggio autenticato con l'Apple Account titolare `guidogazzolach@icloud.com`.

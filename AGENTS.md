# StatisticaWeb: istruzioni per le sessioni successive

Leggi `CONTINUITA.md` e `README.md` prima di modificare l'app.

## Comunicazione e preferenze dell'utente

- Rispondi in italiano, con indicazioni concrete e brevi.
- Quando guidi nell'interfaccia, usa esclusivamente i comandi visibili nello screenshot corrente. Se non sono visibili, dichiara l'incertezza; non inventare menu o pulsanti.
- L'utente vuole provare le modifiche facilmente: esegui prima tu il debug nel browser. Evita ZIP e modifiche manuali sul suo computer: il download degli artefatti ha fallito ripetutamente.
- Il sito di prova dell'utente è https://rfabbri1964.github.io/StatisticaWeb/ . Il browser automatico locale dell'agente non è un'anteprima interattiva per l'utente. Distingui screenshot, test locali, push e pubblicazione effettiva.
- Non richiedere nuovamente approvazioni già date nel contesto della sessione. Questo file documenta il flusso scelto dall'utente; non concede da solo nuove autorizzazioni a pubblicare.

## Repository e sviluppo

- Ogni task cloud è già isolato. Usa il checkout disponibile; non creare worktree senza richiesta esplicita.
- All'avvio controlla `git status`, HEAD e `origin/main`. Il vecchio snapshot dell'ambiente può precedere gli ultimi commit: recupera la versione aggiornata senza perdere modifiche locali e senza reset distruttivi.
- L'app è statica: HTML, CSS e JavaScript, senza server applicativo o build. La radice del repository è la versione pubblicata da Pages (`main`, `/ (root)`).
- Esiste una seconda copia in `StatisticaWeb/`: mantieni sincronizzati `app.js`, `analysis-plots.js`, `index.html`, `style.css` e `vendor/` in entrambe le posizioni. Non rimuovere questa copia come pulizia collaterale.
- `analysis-plots.js` contiene i calcoli/grafici; `vendor/jstat.min.js` è jStat 1.9.6 con licenza MIT. Mantieni la licenza e non aggiungere dipendenze di rete necessarie al funzionamento.
- I dati dell'utente sono nel browser/progetti esportati, non su GitHub. Evita di cancellare localStorage, reimpostare progetti o perdere risultati come soluzione a difetti.
- Le impostazioni `plotOptions` non fanno parte dell'identità statistica dell'analisi. Mantieni la deduplicazione e la persistenza quando aggiungi comandi o grafici.
- Le funzioni I-MR conservate nel codice servono alla compatibilità con vecchi progetti: non ripristinare pulsanti o grafici I-MR nell'interfaccia senza richiesta.

## Verifica e pubblicazione

- Avvia `python3 -m http.server 8000 --bind 127.0.0.1` dalla radice in una sessione persistente; riusa solo un server verificato che serva lo stesso checkout.
- Calcoli: `node --test tests/statistical-plots.test.js`.
- Interfaccia grafici: con server attivo, `python3 tests/browser-statistical-plots.py` (Python Playwright e Chromium). Usa contesti browser isolati.
- Esegui verifiche pertinenti alla modifica: azione effettiva, effetti sui dati, persistenza, casi limite. Per cambi ai calcoli confronta con riferimenti indipendenti. Non dichiarare verificato ciò che non è stato eseguito.
- Dopo modifiche al frontend, cambia i parametri di versione degli asset nei due `index.html` per evitare JavaScript/CSS obsoleti nella cache.
- Quando il contesto autorizza il flusso di pubblicazione: commit delle sole modifiche pertinenti e normale push, senza force. Il branch locale delle task può chiamarsi `work`: `git push origin HEAD:main` è il comando già usato con successo; verifica prima che non ci siano nuovi commit remoti da integrare.
- Non chiedere token soltanto perché `gh` non risulta autenticato: HTTPS Git usa l'autenticazione iniettata dalla piattaforma. Non stampare credenziali.
- Dopo il push, Pages pubblica automaticamente; un push riuscito non dimostra che il sito sia già aggiornato. In questa sessione il controllo HTTPS diretto del sito/API ha restituito 403 dal proxy: riferisci il limite senza inventare un esito.
- Per provare il sito l'utente apre il link e preme Ctrl+F5. Non rinviarlo a procedure manuali su app.js.

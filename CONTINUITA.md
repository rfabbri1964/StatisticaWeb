# Riprendere StatisticaWeb in un'altra sessione

Aggiornato il 25 ottobre 2026.

## Dove si trova il lavoro

- Codice e cronologia: https://github.com/rfabbri1964/StatisticaWeb
- Branch pubblicato: `main`.
- Programma: https://rfabbri1964.github.io/StatisticaWeb/
- GitHub Pages: pubblicazione automatica dal branch `main`, cartella `/ (root)`.
- Ultimo commit applicativo prima di questa guida: `132dcb2` — scelta manuale del numero di bin.
- I commit successivi possono aggiungere miglioramenti: usa sempre l'ultimo `main`, non un checkout fermo al commit indicato.

## Come riprendere

Apri una nuova sessione Codex, seleziona `rfabbri1964/StatisticaWeb` sul branch `main` e scrivi:

> Riprendiamo StatisticaWeb. Leggi AGENTS.md e CONTINUITA.md nel repository, verifica di lavorare sull'ultimo main e conserva tutte le funzionalità già realizzate. Ti descriverò la prossima modifica. Esegui tu i test nel browser; per farmi provare il programma usiamo il sito GitHub Pages, senza ZIP né modifiche manuali ai file.

L'agente deve leggere le istruzioni, verificare lo stato locale e remoto e proseguire senza ricostruire l'app da zero. Il vecchio ambiente cloud non garantisce di avere già gli ultimi commit.

## Funzioni attualmente realizzate

- IC per cluster: checkbox `ciMean`, `ciMedian`, `ciSd` in `plotOptions.groups`, ciascuna attiva un unico confronto con intervalli distinti per cluster e tabella dei limiti. Livello `plotOptions.groups.confidence` 50–99,9% (default 95%), campo/cursore indipendenti dagli IC complessivi. L’opzione overlay riguarda soltanto istogrammi/Q-Q. Persiste selezione, livello e attivazione al ricalcolo/export/import; metodi già usati per gli IC complessivi, ma sugli snapshot dei cluster. Test `tests/group-confidence.test.js`, `tests/browser-group-confidence.py`.

- Grafici per cluster sotto la tabella delle categorie: checkbox indipendenti istogramma/Q-Q normale, menu a tendina con selezione multipla dei cluster, checkbox di sovrapposizione. Istogrammi sovrapposti con classi comuni e frequenze assolute; Q-Q con scale comuni, bande 95% e AD per cluster. Scelte in `plotOptions.groups`, chiavi stabili per categoria (distinte per valori mancanti), persistenza/esportazione e ricalcolo senza cambiare identità statistica o perdere le opzioni generali. Test dedicati `tests/group-plots.test.js` e `tests/browser-group-plots.py`.

- Esporta progetto/Ctrl+S: finestra nativa con nome e cartella tramite showSaveFilePicker (Chrome/Edge desktop); alternativa con nome modificabile e istruzioni cartella per altri browser. Annullamento/errori conservano lo stato non esportato; esportazione concorrente bloccata e modifiche durante il salvataggio conservate.

- Filtri per tipo: calendari per colonne Data (riconoscimento automatico italiano/ISO e scelta manuale nelle proprietà), confronti cronologici e intervallo inclusivo. Checkbox multiple per categorie nominali/ordinali, seleziona/deseleziona tutte, categorie alternative OR e filtri AND. Valori mancanti selezionabili, persistenza browser/progetto. Test dedicato: `tests/browser-filters.py`.

- Statistica descrittiva: scelta esplicita della colonna numerica e raggruppamento facoltativo per categoria.
- Gli 11 campi descrittivi generali compaiono anche nella tabella per categoria.
- Analisi identiche deduplicate, comprese quelle salvate in precedenza. Le scelte dei grafici non creano duplicati.
- Avviso `DA AGGIORNARE · Ricalcola` cliccabile, per aggiornare il riquadro senza aggiungerne un altro.
- Il comando e il grafico I-MR sono stati rimossi dall'interfaccia su richiesta.
- Aggiunta colonna confermabile anche con Invio; eliminazione confermata dalle proprietà della colonna.
- Menu del tasto destro su intestazioni, numeri di riga e celle: inserimento, eliminazione, copia, incolla anche di blocchi da Excel, svuotamento. Sono presenti controlli per riallineare filtri e dipendenze durante le operazioni strutturali.
- Filtri attivi elencati uno sotto l'altro in testata, con rimozione individuale; filtri su più colonne combinati in AND.
- Filtro dal tasto destro sull'intestazione; icona a imbuto nelle colonne filtrate e comando di rimozione dei filtri della singola colonna.
- Larghezza delle colonne modificabile col mouse, anche nei risultati per categoria; larghezze ricordate nel browser.
- Tabella ridimensionabile dall'angolo inferiore destro, ingrandibile/ripristinabile e riducibile alla barra del titolo. La modalità espansa conserva filtri, menu, modifica dati e comandi di aggiunta.
- Tre checkbox indipendenti per grafici sui dati complessivi: istogramma, normality plot e intervalli di confidenza.
- Istogramma: automatico Freedman–Diaconis (larghezza `2 × IQR / ∛n`, numero arrotondato per eccesso); ripiego Sturges con IQR nullo, un solo bin per dati costanti, massimo automatico 40. Numero manuale da 1 a 200 e comando Automatico, con aggiornamento immediato e scelta persistente.
- Normality plot Q-Q: banda puntuale 95%, punti fuori banda rossi e test Anderson–Darling con p-value approssimato Stephens per parametri normali stimati. Banda Monte Carlo deterministica per N ≤ 2000, asintotica per campioni maggiori. Le spiegazioni e i casi non calcolabili sono mostrati nel riquadro.
- IC di media (Student), mediana (binomiale esatto conservativo) e deviazione standard campionaria (chi-quadro). Livello iniziale 95%, modificabile da 50% a 99,9% via campo o cursore. Ipotesi e campioni insufficienti indicati esplicitamente.
- Grafici e livello IC vengono salvati nel browser/progetto e conservati al ricalcolo.

## Struttura e controlli

Leggi `AGENTS.md` per il flusso operativo. Le due copie dei file applicativi (radice e sottocartella `StatisticaWeb/`) vanno aggiornate insieme. I test numerici sono in `tests/statistical-plots.test.js`; il test browser in `tests/browser-statistical-plots.py`. I riferimenti numerici provengono da SciPy e dalle formule AD di statsmodels. Nessun pacchetto va installato per usare l'app: jStat è incluso localmente e funziona offline.

Le verifiche delle ultime modifiche hanno incluso 13 test numerici, prove browser su entrambe le copie, numero di bin manuale/automatico, persistenza, ricalcolo e assenza di errori JavaScript. Non considerare quei risultati come verifica automatica di modifiche future: esegui i controlli pertinenti dopo aver modificato il codice.

## Dati dell'utente e limiti

**GitHub conserva il programma, non i dati inseriti nel browser.** Per conservare un progetto, usare **Esporta progetto** e salvare il file `.statweb.json`. Nelle altre sessioni o su altri computer ripristinarlo con **Apri progetto**. Non fare affidamento sul solo salvataggio automatico del browser.

Non c'è un limite totale di righe esplicito. `＋ Righe` aggiunge al massimo 10000 righe per operazione; l'incolla dal menu destro accetta fino a 10000 righe per blocco e una destinazione entro 1000 colonne. Il CSV non ha un limite esplicito di righe. Il rendering crea tutte le celle e il salvataggio usa localStorage: prestazioni e spazio del browser restano limiti pratici. Non è stata misurata una capacità massima affidabile; virtualizzazione/paginazione e gestione di archivi più grandi non sono ancora implementate.

## Preferenze da conservare

L'utente richiede spiegazioni in italiano, concrete e, quando serve, un passaggio alla volta basato sulle schermate effettivamente visibili. Non vuole copiare codice o scaricare ZIP a ogni modifica. Preferisce che l'agente modifichi, provi e, quando autorizzato nel contesto, invii l'aggiornamento al repository che pubblica il sito. Una schermata del browser automatico è uno screenshot di test, non un'anteprima interattiva dell'utente.


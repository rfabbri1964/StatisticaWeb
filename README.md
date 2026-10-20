# Statistica Web

Per riprendere lo sviluppo in un’altra sessione Codex, leggere [la guida di continuità](CONTINUITA.md) e `AGENTS.md` nella radice del repository.

Versione browser del software desktop StatisticaWindows 0.3. La schermata usa solo HTML, CSS e JavaScript: non richiede installazione, server applicativo o librerie esterne. Apri `index.html` in un browser moderno. Le modifiche sono salvate automaticamente nel browser corrente; usa **Esporta progetto** per conservarne una copia e trasferirla su un altro dispositivo.

## Funzioni portate

- Importazione CSV UTF-8 delimitati da punto e virgola, virgola o tabulazione, e incolla di tabelle da Excel.
- Progetti con più fogli, modifica delle celle, aggiunta di righe e colonne e filtri combinati in AND.
- Rilevamento o selezione manuale del tipo di colonna numerico, nominale o ordinale.
- Statistica descrittiva (anche per categoria), con report testuale e grafici.
- Apertura dei progetti legacy `.statproj` creati dall'app Windows 0.2 e 0.3, oltre ai progetti JSON web.
- Esportazione dei dati in CSV. Ctrl+S esporta il progetto; Ctrl+O lo apre.


## Dimensioni della tabella

La tabella dati si ridimensiona trascinando l’angolo inferiore destro. I comandi nella barra del titolo permettono di ridurla alla sola intestazione (**—**) oppure ingrandirla nello spazio della schermata (**□**). Il comando di ripristino riporta alle dimensioni precedenti; anche un doppio clic sulla barra del titolo alterna dimensioni normali ed espanse. Nella vista espansa rimangono disponibili filtri, menu del tasto destro, aggiunta di righe/colonne e modifica delle celle. Ridurre la tabella non cancella dati o analisi.

## Grafici dei dati complessivi

Ogni riquadro di statistica descrittiva contiene tre checkbox indipendenti sotto i risultati generali. Si possono attivare uno o più grafici anche nelle analisi raggruppate: i grafici usano tutti i valori validi dello snapshot generale, rispettando i filtri applicati al calcolo, senza suddividerli per categoria.

- **Istogramma**: classi automatiche con regola di Freedman–Diaconis; ripiego su Sturges se l’intervallo interquartile è nullo. In automatico: massimo 40 bin. Il campo **Numero di bin** permette di scegliere manualmente un intero tra 1 e 200 con aggiornamento immediato; **Automatico** ripristina il calcolo iniziale. La scelta viene salvata con il risultato e mantenuta al ricalcolo.
- **Normality plot**: grafico Q-Q normale con retta di media e deviazione standard campionaria stimate, banda **puntuale al 95%** e dati fuori banda in rosso. Per N ≤ 2000 la banda viene simulata con 1200 campioni normali, ristimando media e deviazione standard in ciascuno; il seme è deterministico. Per campioni maggiori usa l’approssimazione asintotica per i quantili con parametri stimati. Non è una banda simultanea: un punto fuori banda non equivale da solo al rigetto della normalità. Il test Anderson–Darling usa tutti i valori validi, con correzione finita di Stephens e p-value approssimato come `statsmodels.stats.diagnostic.normal_ad`. Il test non è definito con meno di 3 valori o con varianza nulla; sotto 8 valori viene segnalata la cautela necessaria. Nei campioni grandi vengono diradati soltanto i punti interni alla banda, mantenendo tutti quelli esterni.
- **Intervalli di confidenza**: IC bilaterali individuali della media (t di Student), mediana (binomiale esatto e statistiche d’ordine, conservativo) e deviazione standard campionaria (chi-quadro). Il livello iniziale è 95%, modificabile con campo numerico o cursore tra 50% e 99,9%, con aggiornamento immediato. Ogni parametro ha una scala distinta e limiti numerici espliciti. Gli intervalli per media e deviazione standard assumono osservazioni indipendenti da una popolazione normale; quello della mediana non richiede normalità. Se il campione non permette un IC esatto finito per la mediana, viene mostrato l’intervallo non limitato con la spiegazione.

Le scelte dei grafici e il livello IC sono salvati nel progetto/browser e mantenuti quando si ricalcola il risultato. Attivare un grafico non modifica i dati, non rende il risultato da aggiornare e non crea analisi duplicate.

I calcoli e i grafici funzionano offline. Le distribuzioni statistiche usano la copia locale di **jStat 1.9.6**, licenza MIT in `vendor/jstat-LICENSE`, scaricata dal registro npm e verificata con l’integrità SHA-512 pubblicata. Fonte del p-value AD: [statsmodels v0.14.6](https://github.com/statsmodels/statsmodels/blob/v0.14.6/statsmodels/stats/_adnorm.py).

### Verifica dei calcoli

Dalla radice del repository: `node --test tests/statistical-plots.test.js`. I riferimenti numerici in `tests/fixtures/statistical-reference.json` provengono da SciPy (AD, quantili t/chi-quadro, binomiale) e dalle formule di Stephens verificate contro statsmodels. Non occorre installare pacchetti per eseguire questi test Node.

Per verificare anche l’interfaccia, avviare `python3 -m http.server 8000 --bind 127.0.0.1` nella radice, poi `python3 tests/browser-statistical-plots.py` in un secondo terminale con Python Playwright e `/usr/bin/chromium` disponibili. Il controllo usa contesti browser isolati per non modificare i dati dell’utente.

## Passaggio alla versione web

1. Apri questa cartella e avvia `index.html` nel browser.
2. Premi **Apri progetto** e seleziona il file `.statproj` esportato dalla versione Windows.
3. Controlla fogli, filtri e analisi ripristinati.
4. Usa **Esporta progetto**: viene scaricato un file `.statweb.json`, che potrai aprire da qualsiasi browser.

Il file `.statproj` originale non viene modificato. Dopo l'esportazione web, il file `.statweb.json` diventa la copia di lavoro portabile.

## Differenze e limiti

La versione web trasferisce le funzioni principali. Le definizioni dei collegamenti tra fogli vengono importate e conservate, ma la join non viene eseguita. I risultati delle analisi salvate sono mantenuti all'apertura; i nuovi calcoli seguono le formule descritte nella documentazione desktop. Non sono ancora portati tutti i comandi della tabella contestuale, la selezione multipla, il taglia/incolla avanzato, l'esportazione del grafico e tutte le verifiche di integrità del formato Windows. Il formato `.statweb.json` è specifico della versione web e non è apribile dall'app Windows.

L'elaborazione è locale nel browser: questa pagina non invia i dati a un server. Per dati sensibili, salva il progetto esportato in una posizione protetta e chiudi la scheda al termine.

## Origine

Basato sul progetto desktop `StatisticaWindows` 0.3, generato da Codex il 20 ottobre 2026. Il programma è un'anteprima e non dichiara conformità AIAG/VDA o equivalenza completa con MINITAB.

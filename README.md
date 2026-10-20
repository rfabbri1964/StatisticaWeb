# Statistica Web

Versione browser del software desktop StatisticaWindows 0.3. La schermata usa solo HTML, CSS e JavaScript: non richiede installazione, server applicativo o librerie esterne. Apri `index.html` in un browser moderno. Le modifiche sono salvate automaticamente nel browser corrente; usa **Esporta progetto** per conservarne una copia e trasferirla su un altro dispositivo.

## Funzioni portate

- Importazione CSV UTF-8 delimitati da punto e virgola, virgola o tabulazione, e incolla di tabelle da Excel.
- Progetti con più fogli, modifica delle celle, aggiunta di righe e colonne e filtri combinati in AND.
- Rilevamento o selezione manuale del tipo di colonna numerico, nominale o ordinale.
- Statistica descrittiva (anche per categoria), con report testuale e grafici.
- Apertura dei progetti legacy `.statproj` creati dall'app Windows 0.2 e 0.3, oltre ai progetti JSON web.
- Esportazione dei dati in CSV. Ctrl+S esporta il progetto; Ctrl+O lo apre.

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

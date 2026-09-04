# Esempio serverless con vis-network

Questo esempio disegna una topologia di nodi interconnessi usando `vis-network` e un file JSON locale.
La versione 10.1.1 di `vis-network` e' inclusa nel progetto, quindi la visualizzazione non richiede una connessione a Internet.

## File

- `index.html`: pagina statica
- `styles.css`: stile della UI
- `app.js`: caricamento JSON e rendering del grafo
- `data/topology.json`: topologia di esempio
- `data/topology.local.js`: copia usata solo con il protocollo `file://`
- `assets/icons/`: icone SVG personalizzate per i tipi di nodo
- `lib/vendor/vis-network/`: distribuzione locale di `vis-network` e relative licenze

## Avvio

L'app e' pensata per hosting statico/serverless, per esempio:

- GitHub Pages
- Netlify
- Vercel static
- qualunque web server statico

Puoi aprire direttamente `index.html` con doppio clic: il browser usera il
fallback locale, necessario per le restrizioni di sicurezza di `file://`.

Per sviluppo locale con il caricamento diretto del JSON, avvia un server statico:

```bash
npx serve .
```

Poi apri l'URL mostrato dal server.

Su GitHub Pages, Netlify, Vercel o un qualunque hosting statico, l'app legge
direttamente `data/topology.json` tramite `fetch()`.

## Personalizzazione

Aggiorna `data/topology.json` con i tuoi nodi e collegamenti. Ogni nodo puo' includere metadati aggiuntivi, che vengono mostrati nel pannello laterale quando selezioni il nodo.

## Icone

Le icone sono definite per gruppo in `GROUP_STYLES` dentro `app.js`. Per usare
un'icona aziendale, aggiungi il file SVG o PNG in `assets/icons/` e aggiorna la
proprieta' `image` del gruppo corrispondente.

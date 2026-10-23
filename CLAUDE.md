# Fingerprint Label Editor

Editor visivo standalone per layout **Intermec Direct Protocol v8 / Fingerprint** (stampanti termiche Intermec/Honeywell).
Estratto da `Sinteco.DataloggerPlc/FrontendDataLogger/src/views/Test/LabelEditorTab.vue`, dove verrà poi reintegrato:
mantieni lo stesso stack e lo stesso stile di codice per rendere facile il riporto.

## Stack e comandi
- Vue 3 Composition API (`<script setup>`), Vite 6, PrimeFlex, PrimeIcons, DevExtreme 24.2.5 (`DxButton`, `DxTextBox`).
- bwip-js caricato a runtime da CDN (`https://cdn.jsdelivr.net/npm/bwip-js@4/dist/bwip-js-min.js`) in `onMounted`, cache in `bwipjsLib`.
- Licenza DevExtreme: **non serve in questa cartella** (verrà dal progetto ospite al reintegro). Il banner "evaluation" e il warning W0019 in console sono attesi: ignorali. Il supporto opzionale via `.env.local` (`VITE_DEVEXTREME_LICENSE_KEY`) resta in `main.js`; non mettere mai la chiave nel sorgente.
- `npm install` · `npm run dev` (porta 5180, config `.claude/launch.json` → nome `dev`) · `npm run build`.

## Struttura
- `src/components/LabelEditorTab.vue` – tutto l'editor (parser inline + rendering canvas + UI).
- `src/assets/styles.css` – classi riutilizzabili globali (ex `<style scoped>` del componente).
- `src/App.vue` – solo wrapper a tutta altezza.
- `docs/fingerprint-reference.md` – riassunto dei comandi Fingerprint rilevanti + discrepanze col codice. **Leggilo prima di toccare parser o rendering.**
- `docs/intermec-direct-protocol-v8.txt` – testo estratto dal manuale (132 pagine, marcatori `=== PAGE n ===`). Cerca qui con Grep invece di aprire il PDF (pdftoppm non è installato, il PDF non si legge col Read).
- `docs/Intermec_Direct_Protokoll_Hndbuch.pdf` – manuale originale.
- `docs/samples/` – layout di esempio per provare l'anteprima.

## Stile
- Stile direttamente nell'html con classi PrimeFlex; dove non bastano, `style` inline.
- Niente `<style scoped>` nel componente: classi custom riutilizzabili in `src/assets/styles.css`.
- Codice compatto come quello esistente: helper brevi, commenti `// ── Sezione ──`, testi UI in italiano.

## Layout UI
- Sinistra: textarea sorgente Fingerprint (parse live, debounce 450 ms).
- Centro: canvas anteprima (scala automatica al contenitore, max 2×).
- Destra: variabili VAR1–VAR29 editabili + import immagini BMP.
- Toolbar: importa layout (`.lbl .txt .fp .fingerprint`), importa/esporta variabili JSON, dimensioni etichetta mm, DPI, "adatta altezza".

## Sistema di coordinate
- Origine Fingerprint = angolo **in basso a sinistra**, Y verso l'alto. Canvas ha Y verso il basso:
  ```js
  cx(x, scale) = x * scale
  cy(y, scale) = (labelDots.h - y) * scale
  ```
- Il canvas coincide con l'etichetta (nessun margine né bordo disegnato; il bordo visivo è il `box-shadow` del canvas). Quello che esce dall'etichetta viene tagliato, come in stampa. `labelDots.w/h = mm × dotsPerMm`.
- DPI: 203 → 8 dot/mm · 300 → 11.81 · 406 → 16. (Il default in `settings` è 11.87: probabile refuso di 11.81, non presente nella select.)

## Semantica DIR (verificata su stampa, 2026-10-21)
DIR = rotazione **oraria** di 90° per step attorno al PP, uguale per **tutti** gli oggetti, come da manuale.
Ogni oggetto si disegna nel riferimento DIR 1 (verso destra e verso l'alto dal PP) dopo `ctx.rotate(dirRad(el))`.

| DIR | Si estende dal PP | Linea (PL) | Box `PX h,w` (w lungo la direzione) |
|-----|-------------------|------------|-------------------------------------|
| 1   | destra, su        | destra     | orizzontale                         |
| 2   | destra, giù       | giù        | verticale                           |
| 3   | sinistra, giù     | sinistra   | orizzontale                         |
| 4   | sinistra, su      | su         | verticale                           |

Prove di stampa in `docs/samples/`: `test-dir-datamatrix.lbl` (barcode) e `test-dir-box.lbl` (box + testi T1–T4): l'anteprima coincide.
La vecchia tabella "empirica" (box non ruotati, DIR 3/4 scambiati, DataMatrix DIR 4 a destra-giù) era **sbagliata**.

- Barcode: lato-L del DataMatrix sul PP, `drawImage(off, 0, -bh)` dopo la rotazione.
- Box: bordo tutto dentro le dimensioni; se `2×spessore ≥ lato` → box pieno.
- Testo: ruotato come gli altri; AN via `textAlign/textBaseline`.
- Immagini PM: 1 px BMP = 1 dot, **non ruotate** (il BMP `.2` è già ruotato); quadranti come la tabella. Da verificare su stampa.
- AN sugli altri oggetti: `applyAlign(ctx, el, w, h)` con `w×h` nel riferimento DIR 1; l'offset ruota con DIR, AN 1 = nessuno spostamento. AN e DIR **persistono** fino a PF.
- **Box PX e AN** (verificato su stampa, `docs/samples/test-an-pxtesto.lbl`, 2026-10-23): il PP sta **sempre sul lato basso** del box,
  AN sceglie solo il punto orizzontale (sx/centro/dx, `boxAlign`); la riga di AN (basso/metà/alto) vale solo per il testo dentro (`drawTextBox`).
  Es. `AN 7:PX 72,…` → box **sopra** il PP con testo in alto a sx; `AN 5` → PP al centro del lato basso, testo centrato.
- AN su testo, barcode, linee e immagini: segue il manuale (9 punti), non ancora verificato su stampa.

## Barcode
- Stato parser: `barcodeNarrow` (default 1), `barcodeMag` (default 2), `barcodeHeight` (default 100). BARSET `[1]/[2]/[3]` e BR/BM/BH li impostano: **l'ultimo vince** (non si moltiplicano).
- `bwipScale = narrow × mag` = dot per modulo. bwip-js disegna DataMatrix/QR/Aztec a **2 px per modulo** (`BWIP_2PX`, l'immagine viene dimezzata), i lineari e PDF417 a 1 px. `padding: 0` (l'ancoraggio è il simbolo, non la quiet zone).
- Altezza lineari: `height` bwip in mm = `barcodeHeight / bwipScale × 25.4 / 72`; mai passarla ai 2D (`BWIP_2D`): bwip-js lancia un errore per valori < 0.01.
- Cache key `` `${bcid}|${bcText}|${bwipScale}|${barcodeHeight}` ``.
- `BCID_MAP`: DATAMATRIX, GS1DATAMATRIX, CODE128/A/B/C, CODE39, CODE93, EAN13, EAN8, EAN128/GS1-128, UPCA, UPCE, PDF417, MICROPDF417, AZTEC, QRCODE/QR, I2OF5/INT2OF5. Tipo sconosciuto → `code128`.
- Variabili barcode: `isBarcodeVar`, `maxChars` → stringa random in `previewValue`, usata da `resolveContent(content, true)`.

## Font
- Dimensione FT in punti: `sizePx = fontSize * (25.4/72) * dotsPerMm * scale`.
- `FT "<font>",<size>,<slant>,<width %>`: il 4° parametro è la **larghezza %** (`fontWidth`, `ctx.scale` orizzontale), non un angolo. Slant ≠ 0 → italic.
- Font non installati (`document.fonts.check`) → testo rosso + sottolineatura tratteggiata, fallback per categoria.

## Memoria di pagina (variabili, barcode, immagini)
- `varStore` (index → oggetto variabile) e `imageStore` (filename → `{dataUrl, img}`) tengono valore, etichetta, `maxChars`/`previewValue` e BMP caricati
  anche quando l'elemento sparisce dal layout: rimettendolo torna com'era. `variables`/`images` sono solo le voci presenti nel layout (stessi oggetti dello store).
- Import JSON scrive in `varStore` anche variabili non presenti nel layout; l'export include quelle del layout più quelle memorizzate con un valore.
- Solo in memoria: un reload della pagina azzera tutto.

## Variabili fisse (FIXED_VAR_LABELS)
VAR1 Bag Barcode · VAR2 Expiring Date · VAR3 Batch · VAR4 Production Date · VAR5 Datamatrix · VAR6 Drug Barcode ·
VAR7 Medication Code · VAR8 Brandname · VAR9 Active Principles · VAR10 Dosage · VAR11 Galenic Form · VAR12 List ·
VAR13 Legal Notice · VAR14 Drug Name · VAR15 Drug Description · VAR16 UserId · VAR17 Tasy Code · VAR18 Actual Time ·
VAR19 Plant Id · VAR20 Plant Name · VAR21 Logo1 · VAR22 Logo2 · VAR23 Custom Gs1 Field · VAR24 Bag Production Time ·
VAR25 Package Barcode · VAR26–28 Package Custom Field 1–3 · VAR29 Package Description.

## Parser (inline, nessuna dipendenza)
Gestiti: LAYOUT INPUT/END/RUN, CLL, NASC, CLIP, DIR, AN, PP/PRPOS, FT, PT, PB, PM, PL/PRLINE, PX/PRBOX, BARSET, BM/BARMAG, BH/BARHEIGHT, BR/BARRATIO, BF.
Statement separati da `:` (non dentro `"`, `splitOutQ`); contenuto PT/PB/PX separato da `;`; parametri PX dopo lo spessore separati da `,`; `VAR5$` → `{type:'var', index:5}`,
`"testo"` → `{type:'literal'}`, altro → `{type:'expr'}` (mostrato come `[expr]`). Comandi sconosciuti → `warnings`.

## Punti aperti
1. **Offset fisico stampante** (in sospeso): l'anteprima della stampante sposta X di ≈ +21 dot ed è più larga dell'etichetta reale, ma secondo l'utente l'editor senza offset è più fedele alla stampa reale (2026-10-23): per ora nessun offset. In generale 2–4 mm non stampabili a sinistra/in basso (dipende da X-Start e Feed adjust del setup, vedi manuale §3.2 "Origin"). Serve un offset configurabile (Xoff/Yoff in dot).
2. **Dimensione barcode**: corretta secondo il manuale (modulo = narrow × mag, l'ultimo tra BARSET e BM vince). Da confermare su una stampa reale, soprattutto la dimensione del modulo del DataMatrix.
3. **Logo BMP**: posizionamento dipende dal punto 1.
4. Altri scostamenti dal manuale elencati in `docs/fingerprint-reference.md` § "Discrepanze".

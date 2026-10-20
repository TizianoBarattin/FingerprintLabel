# Fingerprint Label Editor

Editor visivo standalone per layout **Intermec Direct Protocol v8 / Fingerprint** (stampanti termiche Intermec/Honeywell).
Estratto da `Sinteco.DataloggerPlc/FrontendDataLogger/src/views/Test/LabelEditorTab.vue`, dove verrà poi reintegrato:
mantieni lo stesso stack e lo stesso stile di codice per rendere facile il riporto.

## Stack e comandi
- Vue 3 Composition API (`<script setup>`), Vite 6, PrimeFlex, PrimeIcons, DevExtreme 24.2.5 (`DxButton`, `DxTextBox`).
- bwip-js caricato a runtime da CDN (`https://cdn.jsdelivr.net/npm/bwip-js@4/dist/bwip-js-min.js`) in `onMounted`, cache in `bwipjsLib`.
- Licenza DevExtreme in `.env.local` (`VITE_DEVEXTREME_LICENSE_KEY`, vedi `.env.local.example`); senza, compare il banner "evaluation". Non metterla nel sorgente.
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
  cx(x, scale) = (x + MARGIN_DOTS) * scale
  cy(y, scale) = (labelDots.h - y + MARGIN_DOTS) * scale
  ```
- `MARGIN_DOTS = 20`; `labelDots.w/h = mm × dotsPerMm`.
- DPI: 203 → 8 dot/mm · 300 → 11.81 · 406 → 16. (Il default in `settings` è 11.87: probabile refuso di 11.81, non presente nella select.)

## Semantica DIR implementata
| DIR | Linea (PL)         | Box (PX) dal PP     |
|-----|--------------------|---------------------|
| 1   | destra (+X)        | destra, su          |
| 2   | verso il basso (−Y)| destra, giù         |
| 3   | sinistra (−X)      | sinistra, su        |
| 4   | verso l'alto (+Y)  | sinistra, giù       |

Barcode (offscreen canvas bwip-js, lato-L del DataMatrix in basso a sinistra):
DIR 1 `drawImage(off, 0, -bh)` · DIR 2 rotate +90° · DIR 3 rotate 180° attorno al centro dell'area · DIR 4 rotate −90°.
Immagini PM: 1 px BMP = 1 dot, ancoraggio come i barcode.

Nota dal manuale: DIR ruota l'oggetto **in senso orario attorno al punto di ancoraggio** (DIR 2 = 90°, 3 = 180°, 4 = 270°).
La tabella sopra è quella verificata empiricamente sulle etichette reali: non cambiarla senza confronto con una stampa.

## Barcode
- `bwipScale = Math.max(1, Math.round((el.barcodeParams?.[2] || 1) * (el.barcodeMag || 1)))`, cache key `` `${bcid}|${bcText}|${bwipScale}` ``.
- `BCID_MAP`: DATAMATRIX, GS1DATAMATRIX, CODE128/A/B/C, CODE39, CODE93, EAN13, EAN8, EAN128/GS1-128, UPCA, UPCE, PDF417, MICROPDF417, AZTEC, QRCODE/QR, I2OF5/INT2OF5. Tipo sconosciuto → `code128`.
- Variabili barcode: `isBarcodeVar`, `maxChars` → stringa random in `previewValue`, usata da `resolveContent(content, true)`.

## Font
- Dimensione FT in punti: `sizePx = fontSize * (25.4/72) * dotsPerMm * scale`.
- Font non installati (`document.fonts.check`) → testo rosso + sottolineatura tratteggiata, fallback per categoria.

## Variabili fisse (FIXED_VAR_LABELS)
VAR1 Bag Barcode · VAR2 Expiring Date · VAR3 Batch · VAR4 Production Date · VAR5 Datamatrix · VAR6 Drug Barcode ·
VAR7 Medication Code · VAR8 Brandname · VAR9 Active Principles · VAR10 Dosage · VAR11 Galenic Form · VAR12 List ·
VAR13 Legal Notice · VAR14 Drug Name · VAR15 Drug Description · VAR16 UserId · VAR17 Tasy Code · VAR18 Actual Time ·
VAR19 Plant Id · VAR20 Plant Name · VAR21 Logo1 · VAR22 Logo2 · VAR23 Custom Gs1 Field · VAR24 Bag Production Time ·
VAR25 Package Barcode · VAR26–28 Package Custom Field 1–3 · VAR29 Package Description.

## Parser (inline, nessuna dipendenza)
Gestiti: LAYOUT INPUT/END/RUN, CLL, NASC, CLIP, DIR, AN, PP/PRPOS, FT, PT, PB, PM, PL/PRLINE, PX/PRBOX, BARSET, BM, BF.
Statement separati da `:` (non dentro `"`); contenuto PT/PB separato da `;`; `VAR5$` → `{type:'var', index:5}`,
`"testo"` → `{type:'literal'}`, altro → `{type:'expr'}` (mostrato come `[expr]`). Comandi sconosciuti → `warnings`.

## Punti aperti
1. **Offset fisico stampante**: 2–4 mm non stampabili a sinistra/in basso (dipende da X-Start e Feed adjust del setup, vedi manuale §3.2 "Origin"). Serve un offset configurabile (Xoff/Yoff in dot).
2. **Dimensione barcode**: secondo il manuale `BARSET "<nome>",<wide>,<narrow>,<mag>,<height>,...` → `barcodeParams[2]` è la **magnification**, non la larghezza della barra stretta; la barra stretta in dot = `narrow × mag`. Moltiplicare anche per BM conta la magnification due volte se BARSET e BM sono entrambi presenti (l'ultimo dovrebbe vincere). Da verificare su etichette reali.
3. **Logo BMP**: posizionamento dipende dal punto 1.
4. **Altezza barcode lineari**: è `barcodeParams[3]` (default 100 dot, o BH). Non ancora passata a bwip-js (`height` in mm = dot / dotsPerMm).
5. Altri scostamenti dal manuale elencati in `docs/fingerprint-reference.md` § "Discrepanze".

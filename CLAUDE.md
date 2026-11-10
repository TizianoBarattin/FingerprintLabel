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
- Immagini: solo BMP (input `accept=".bmp"` e controllo in `onImageFile`); PCX non gestito per scelta (2026-10-28).
- `docs/fingerprint-reference.md` – riassunto dei comandi Fingerprint rilevanti + discrepanze col codice. **Leggilo prima di toccare parser o rendering.**
- `docs/intermec-direct-protocol-v8.txt` – testo estratto dal manuale (132 pagine, marcatori `=== PAGE n ===`). Cerca qui con Grep invece di aprire il PDF (pdftoppm non è installato, il PDF non si legge col Read).
- `docs/Intermec_Direct_Protokoll_Hndbuch.pdf` – manuale originale.
- `docs/intermec-fingerprint-v8.txt` – testo del **Tutorial** Fingerprint v8 (217 pagine, `=== PAGE n ===`, estratto con `pdftotext` da Git). Non è il Programmer's Reference:
  per sintassi di CLIP BARCODE e sillabazione PX rimanda a quello; unico esempio di sillabazione a p.126 (`"&S - +"`).
- `docs/samples/` – layout di esempio per provare l'anteprima.

## Stile
- Stile direttamente nell'html con classi PrimeFlex; dove non bastano, `style` inline.
- Niente `<style scoped>` nel componente: classi custom riutilizzabili in `src/assets/styles.css`.
- Codice compatto come quello esistente: helper brevi, commenti `// ── Sezione ──`, testi UI in italiano.

## Layout UI
- Sinistra: textarea sorgente Fingerprint (parse live, debounce 450 ms), alta 20 righe (massimo PLC), numeri di riga a fianco (`source-gutter`, scorrono con la textarea, niente a capo automatico), avvisi parser e font mancanti subito sotto.
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
  **Finestra di stampa** (`test-clip-on.lbl` con CLIP ON, 2026-10-28): taglio a x = 0 e y = 0 come l'editor; il bordo alto **non è misurabile** dagli screenshot
  (l'anteprima della stampante si ferma poco sopra l'oggetto più alto e non mostra oltre ~584). `test-bordo-alto-584/590/594.lbl` (2026-10-28):
  barre senza CLIP fino a 584, 590 e 594 → **nessun errore**, nell'anteprima tutte tagliate a ~584 → il limite in alto è almeno 594 (= etichetta editor);
  a destra la finestra arriva a x ≈ 1030 (testina più larga dei 70 mm: oltre 831 non taglia,
  ma lì non c'è etichetta, quindi l'editor che taglia a 831 è fedele all'etichetta vera).
  **Errore 1003** (senza CLIP ON): conta l'**inchiostro**, non la cella del testo (`test-fuori-cella.lbl`: cella 6 dot sotto y 0, lettere dentro → stampato).
  `outsideWarnings` disegna ogni oggetto da solo a 1 px = 1 dot su un canvas con margine `OUT_M` e avvisa `Riga N: PT esce dall'etichetta (lato)`;
  a destra solo "in stampa tagliato". Stato parser `clip` (CLIP ON/OFF) e `line` sugli elementi.
  **Immagini PM** (`test-img-margine/fuori/clip.lbl`, 2026-11-04): fuori etichetta **non danno errore nemmeno senza CLIP**, vengono tagliate al bordo
  (verificato a sinistra senza CLIP, a sinistra e in basso con CLIP ON) → `outsideWarnings` le salta.
  **CLIP ON non vale per i barcode** (`test-clip-bc-on.lbl`, 2026-11-03: "Field out of label", stampante in errore): l'avviso sui PB resta anche con CLIP ON.
  Anche `CLIP BARCODE ON` da solo dà errore 1003 (`test-clip-bc-barcode.lbl`, 2026-11-04). **`CLIP BARCODE HEIGHT ON`** taglia le barre al bordo, senza errore
  (`test-clip-bc-height.lbl`, `test-clip-bc-tutto.lbl`, 2026-11-04). Stato parser `clipBc { height, information, x, y }`, `bcClipped(el, lato)`: HEIGHT = alto/basso
  (con DIR 2/4 sinistra/destra), INFORMATION = lungo il codice (verificato, `test-clip-bc-information.lbl`: CODE128 fuori a sinistra stampato senza errore,
  ma restano solo x 29–59, cioè circa il carattere di stop: toglie i caratteri interi che escono, l'editor invece taglia esatto a x 0, scarto lasciato), X/Y = assi etichetta (dal manuale, non verificati). Usa l'altezza dell'editor (594). Non riprodotto (non è il bordo alto né la cella: `test-cella-alto-540/535.lbl` stampati, 2026-11-03):
  (`test-font-1` a y 540, 10 pt, inchiostro fino a ~582: errore in stampa, nessun avviso nell'editor).
- DPI: 203 → 8 dot/mm · 300 → 11.81 · **11.87** (valore usato dall'applicazione ospite, default in `settings` e voce "300 DPI (11.87 app)" nella select) · 406 → 16. Non è un refuso: non cambiarlo.

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
- Nomi immagini: la stampante li salva in **maiuscolo** al caricamento; un PM con minuscole non la trova → avviso in `renderCanvas`.
- Immagini PM: 1 px BMP = 1 dot, **ruotate con DIR** come ogni altro oggetto (verificato su stampa, `test-cursore-immagini.lbl`, 2026-10-23).
- AN sugli altri oggetti: `applyAlign(ctx, el, w, h)` con `w×h` nel riferimento DIR 1; l'offset ruota con DIR, AN 1 = nessuno spostamento. AN e DIR **persistono** fino a PF.
- **Box PX e AN** (verificato su stampa, `docs/samples/test-an-pxtesto.lbl`, 2026-10-23): il PP sta **sempre sul lato basso** del box,
  AN sceglie solo il punto orizzontale (sx/centro/dx, `boxAlign`); la riga di AN (basso/metà/alto) vale solo per il testo dentro (`drawTextBox`).
  Es. `AN 7:PX 72,…` → box **sopra** il PP con testo in alto a sx; `AN 5` → PP al centro del lato basso, testo centrato.
- **AN su testo, barcode, linee, immagini** (verificato su stampa, `docs/samples/test-an-oggetti-bf.lbl`, 2026-10-23):
  - Barcode e immagini: AN completo a 9 punti sul rettangolo dell'oggetto.
  - Linee: come i box, PP sul lato basso (la linea sta **sopra** il PP), AN sceglie solo sx/centro/dx.
  - Testo: orizzontale sx/centro/dx; verticale AN 1-3 = **fondo cella**, 4-6 = **linea di base**, 7-9 = **cima cella**.
    Cella misurata: `CELL_ASC` 1.1 em sopra la base, `CELL_DESC` 0.25 em sotto (em = dimensione FT in dot × MAG), `textBaselineY`.
    `CELL_DESC` era 0.2: con MAG 5 la base in stampa usciva 9 dot più alta (`test-mag-errore.lbl`, 2026-10-28), con 0.25 coincide a MAG 1, 2 e 5.
- **BF ON / BARFONT**: testo leggibile = dato del barcode, allineato a sx sotto le barre; campo = barre + offset (default 6) + cella testo,
  AN vale per tutto il campo. Default barfont Swiss 721 BT 12 pt. Stato parser `barFont { on, name, size, slant, offset }`.
  Per tipo (verificato su stampa, `test-aperti.lbl`, 2026-10-27; `bfMode` nel rendering):
  - DataMatrix e QR (QR verificato su stampa, `test-addon-qr.lbl`, 2026-10-28): come i lineari, testo sotto il simbolo dentro il campo.
  - AZTEC (`test-aztec.lbl`, 2026-10-28; tipo assente dal manuale ma stampato): **BF ON ignorato** (nessun testo, cursore a fine simbolo).
    Formato compatto quando il dato ci sta ("ABC123" = 15×15, uguale a bwip-js `format: 'compact'`), altrimenti pieno.
    In stampa testo e simbolo stanno ~2 dot più in alto (scarto lasciato). Testo barfont largo come Arial: **niente `FONT_KX`** sul barfont.
  - PDF417: barre sul PP, testo **sotto il PP** (fuori dal campo); il cursore va a fine barre, non a fine testo.
  - PLESSEY: testo **sopra** le barre (barre sul PP); il cursore sale alla riga del testo (`rise`).
  - EAN13/EAN8/UPCA/UPCE: interpretazione standard (cifre spezzate, guardie allungate), font BF ignorato
    → `includetext` di bwip-js (`BWIP_INCLTEXT`), barre sul PP e cifre esterne che sporgono. Altezza uguale alla stampa.
  - ADDON2/5 (`test-addon-qr.lbl`, 2026-10-28, BM 2 e 3): barre alte esattamente BH (bwip-js le fa più alte → riportate a BH),
    cifre disegnate da `addonDigits`: allineate a sx sulle barre, passo 5·BM+3 dot, alte 5·BM+4, base a BH + 2·BM + 8, font BF ignorato.
    Coincide entro 1 dot (la "1" di Arial ~3 dot più a destra).
    EAN/UPC: sotto le cifre ~3.5 moduli di spazio fino al PP (`eanGap`).
  - EAN/UPC con **BF OFF**: simbolo alto BH, guardie (e barre lunghe UPC-A) fino al PP, le altre 6 moduli più corte (`eanGuards`).
  - **Cursore** (`test-cursore-ean.lbl`, 2026-10-27): EAN13/EAN8/UPCA/UPCE non avanzano mai lungo DIR; con BF ON salgono al fondo
    delle barre corte, con BF OFF restano sul PP. ADDON con BF ON: fine delle cifre (n × passo) a BH + 7 dot (uguale a BM 2 e 3);
    con BF OFF: fine barre come gli altri lineari.
  - SCCADDON: il testo include la cifra di controllo (`i25Check`).
- **Errore su una riga**: in stampa un comando che dà errore (es. `PB "0123456"` con `BT "UPCE"`, MAXICODE, PDF417 non stampabile) **interrompe la riga**:
  le istruzioni dopo, sulla stessa riga, non vengono eseguite (anche `BF OFF`, `BH`). Simulato: `renderCanvas` ri-esegue `parseLayout(src, barcodeFails)`;
  `barcodeFails` = tipo non stampabile o `barcodeImage` nullo (bwip-js in errore, PDF417 che non entra) → il parser salta il resto della riga
  e aggiunge l'avviso `Riga N: barcode non stampabile…`. Dati non noti (`[VARn]`, espressioni) = stampabile.
  Limite: conta solo ciò che rifiuta bwip-js o le regole aggiunte (es. UPCE ≠ 6 cifre).
- **Cursore dopo un oggetto** (verificato su stampa, `test-cursore-immagini.lbl`): dopo `PT`, `PB` e `PM` la stampante sposta il punto
  di inserimento sul **bordo finale dell'oggetto lungo DIR** (DIR 1: bordo destro, stessa Y; con AN 9 coincide col PP; con BF ON = fine del testo
  sotto le barre). Dopo `PL` e `PX` il punto **non si sposta**. Simulato: il parser marca `follow` gli oggetti senza `PP` dopo l'ultimo PT/PB/PM,
  `renderCanvas` tiene il cursore (`drawEl` ritorna l'avanzamento in dot, `DIR_VEC`).
- **Riga di `LAYOUT INPUT`**: un `FT` messo sulla stessa riga dopo `LAYOUT INPUT` è stato **ignorato** dalla stampante (testi usciti col font di default).
  L'editor ignora **tutte** le istruzioni dopo `LAYOUT INPUT` su quella riga e mostra `Ignorato (riga LAYOUT INPUT): …` negli avvisi,
  tranne quelle che non cambiano i default (`NASC`, `DIR 1`, `AN 1`, `CLIP OFF`, `BF OFF`), ignorate senza avviso. Gli avvisi parser sono elencati sotto la textarea.
- Font di default FT: **12 pt** (manuale e stampa).
- **Lunghezza delle righe** (`test-lunghezza-riga.lbl`, 2026-11-04): righe del PLC = `T_MaxString` (255 caratteri). Righe da 122, 144, 166 e 256 caratteri
  stampate intere (a 256 si perde solo l'ultimo carattere, lì la virgoletta di chiusura); la riga da 276 **non è uscita per niente**, e il testo della riga
  dopo è uscito a 12 pt invece che a 8 (stato del font perso? non simulato). Parser: oltre 255 avviso, oltre 256 riga saltata.
  **Limite di progetto 150 caratteri** (`ROW_MAX`, deciso con l'utente 2026-11-04): oltre, avviso "dividila su più righe" (la riga viene comunque disegnata).
- **PF / PRINTFEED dentro il layout** (`test-pf.lbl`, 2026-10-28): nessun effetto, non resetta parametri né PP (il PT dopo segue il cursore),
  tutto su un'etichetta. Il parser lo salta con avviso `Riga N: PF dentro il layout ignorato`.
- **FORMFEED n / FF n dentro il layout** (`test-formfeed.lbl`, foto dell'etichetta vera, 2026-10-28): la carta avanza di n dot prima di stampare,
  quindi sull'etichetta tutto sale di n dot (FORMFEED 120 → cornice ~10 mm più in alto, parte alta fuori etichetta). L'anteprima della stampante non lo mostra.
  Simulato: `result.feed` (somma), `renderCanvas` trasla tutto di −feed (anche `drawXor`); il controllo fuori etichetta (`outsideWarnings`) resta sulle coordinate
  non traslate (l'errore 1003 riguarda l'immagine di stampa). Senza numero → avviso "etichetta bianca", non simulato.
- **PX a capo** (`test-px-a-capo.lbl`, 2026-10-28): solo sugli spazi, il trattino non spezza (`wrapLines`). Righe: passo `PX_LINE` 1.28 em + vOff, base a `PX_ASC` 1.0 em
  dalla cima della cornice (8 pt: passo 47 dot, coincide entro 2 dot; prima era em + vOff, 9 dot in meno). Misure condivise in `pxText`.
  Ristampa di `test-an-pxtesto.lbl` (AN 7/1/9/5, riga singola) col nuovo modello: testo entro 3 dot dalla stampa.
  Ristampa di `test-mag.lbl` (PX MAG 2,2 su 2 righe): righe entro 4 dot; l'a capo non conta lo spazio dopo l'ultima parola (prima andava a capo una riga prima).
- **Sillabazione PX** (8° parametro, stringa di controllo es. `"&S - +"`): **non gestita, per scelta** (non serve, 2026-11-04). `test-px-sillabazione.lbl`:
  senza stringa `&S` è stampato com'è (come l'editor); con `"&S - +"` `&S` = punto di a capo con trattino, ma il primo `&S` del testo è rimasto stampato
  e la prima riga va a capo prima (spazio per il trattino?). Il PX grande (riga 5) è uscito senza "words.", senza hOff e senza NEWLINE: causa non chiarita
  (non è la lunghezza della riga, vedi sotto).
- **PX non stampabile** (`test-px-parola-lunga.lbl`, `test-px-troppo-testo.lbl`: etichetta bianca, 2026-10-28): parola più larga della cornice, oppure
  righe × cella intera (`CELL_ASC + CELL_DESC`, **senza MAG**: `test-mag.lbl` con MAG 2,2 è stampato) + vOff fra le righe > altezza cornice.
  `pxFails` → il parser toglie il PX e interrompe la riga (come i barcode, `Riga N: PX non stampabile (…)`). Verificato (`test-px-errore-righe.lbl`): salta il resto della riga, le righe dopo escono.
- `II`/`INVIMAGE` … `NI`/`NORIMAGE`: testo bianco su cella nera (stato `invert` su testi e PX con testo).
- Pulsante **"Nascondi variabili vuote"** (`hideEmpty`): variabile vuota → niente (come in stampa) invece di `[VARn]`;
  barcode con dato vuoto e logo variabile vuoto non disegnano il segnaposto. Un barcode con `previewValue` (Max chars) resta visibile.

- **MAG h,w** (1–4, verificato su stampa, `test-mag.lbl`, 2026-10-27): ingrandimento lineare di testo PT (cella e cursore compresi), testo dei PX
  (anche interlinea), barfont (MAG globale × mag h/w di BF, entrambi applicati) e immagini PM (verificato su stampa, `test-mag-img.lbl` 2,1 e 1,2 con `docs/samples/LOGOSINTECO3.BMP` 344×82:
  logo sul PP, ingrandito esatto, cursore a fine immagine × MAG; 2,2 e 3,1 in `test-mag-img2.lbl` esatti al dot, quindi oltre 2× funziona).
  Ristampa di `test-mag-img.lbl` con 1,1 a 480–562 dot: uscito (la prima stampa senza 1,1 era un errore di copia nel PLC); `test-img-alto.lbl` idem.
  **MAG 5 funziona** anche se il manuale dice 1–4 (`test-mag-errore.lbl`, 2026-10-28: `MAG 5,1` stampato alto 5×, nessun errore, vale anche per le righe dopo).
  Il limite vero (errore 1021 "Too large argument for MAG") non è noto: l'editor accetta tutto, oltre 5 avvisa senza fermarsi; MAG 0 interrompe la riga.
  Stato `magH/magW` sugli elementi.
- **Larghezza testo**: a parità di altezza (coincide entro 1–2 dot) i font della stampante hanno larghezze diverse dal sostituto del PC
  (`fontFallback`: Arial per Swiss/Zurich/Univers, Times New Roman per Dutch/Century/CG Times, Courier New per Monospace/Andale Mono/Letter Gothic/OCR) → `FONT_KX` / `fontKx(nome)`, solo se il font manca sul PC,
  applicato a PT, PX (anche a capo) e cursore; **non** al barfont (in stampa Swiss 721 BT è largo come Arial).
  Misurati su stampa (`test-font-1…4.lbl`, "ABCabc0123" a 10 pt, 2026-10-28, scarto ≤ 2 dot): Swiss 721 BT 0.96, Swiss 721 Bold BT 0.97,
  Swiss 721 Bold Condensed BT 0.82 (Arial bold), Zurich Extra Condensed BT 0.60, Dutch 801 Roman BT 1.03 (Times), Century Schoolbook Roman 1.08,
  Monospace 821 / Bold 1, Letter Gothic 0.84, OCR A 0.99, OCR B 1, Andale Mono / Bold 1, CG Times 1.03, CG Times Bold 0.98,
  CG Triumvirate Condensed Bold 0.81, Univers 1, Univers Bold 1.01, Univers Condensed Bold 0.82, Univers Extra Condensed 0.60.
  Univers Condensed Bold / Extra Condensed = stesse larghezze di Swiss 721 Bold Condensed BT / Zurich Extra Condensed BT (alias); Univers ≠ Swiss 721 BT. Altri font non misurati = 1.
- **Font residenti** (elenco "Resident" della pagina web della stampante, 2026-10-28): i nomi sono senza "BT" (Univers, CG Times, Andale Mono,
  Dutch 801 Roman, Monospace 821, Letter Gothic, OCR A/B, Century Schoolbook Roman, CG Triumvirate Condensed Bold, Univers Condensed Bold/Extra Condensed).
  Swiss 721 BT/Bold BT/Bold Condensed BT, Zurich Extra Condensed BT e Dutch 801 Roman BT stampano comunque (alias). Un nome non trovato blocca
  **tutta l'etichetta** (errore "font non trovato"; Dutch 801 Bold BT, Futura Light BT, Prestige 12 Pitch Bold BT o DingDings SWA in `test-font-2` originale).
- **XORMODE ON** (verificato su stampa, `test-xor.lbl`, 2026-10-27): `drawXor` disegna il campo su un livello a parte e lo unisce con `difference`
  → nero su nero diventa bianco. Testo/PX con **II** ignorano XORMODE (cella nera opaca, testo bianco). Stato `xor` sugli elementi.

## Barcode
- Stato parser: `barcodeType` (da `BARSET` o `BT`/`BARTYPE`), `barcodeNarrow` (default 1), `barcodeMag` (default 2), `barcodeHeight` (default 100).
  BARSET `[1]/[2]/[3]` e BR/BM/BH li impostano: **l'ultimo vince** (non si moltiplicano).
- `bwipScale = mag` = dot per modulo (**verificato su stampa** 2026-10-23: `BR 4,2` + `BM 4` → CODE128 a 4 dot/modulo, DataMatrix BM 4 → 4 dot/cella).
  BR/narrow è solo il rapporto barre larghe:strette, non moltiplica il modulo. bwip-js disegna DataMatrix/QR/Aztec a **2 px per modulo** (`BWIP_2PX`, l'immagine viene dimezzata), i lineari e PDF417 a 1 px. `padding: 0` (l'ancoraggio è il simbolo, non la quiet zone).
- Altezza lineari: `height` bwip in mm = `barcodeHeight / bwipScale × 25.4 / 72`; mai passarla ai 2D (`BWIP_2D`): bwip-js lancia un errore per valori < 0.01.
- Cache key `` `${bcid}|${bcText}|${bwipScale}|${barcodeHeight}` ``.
- `BCID_MAP` (tipo Fingerprint → bcid bwip-js, oppure `[bcid, opzioni, allargamento]`), letto da `getBwip(tipo)`:
  DATAMATRIX, CODE128/A/B/C, CODE39, CODE93, EAN13, EAN8, EAN128/GS1-128, UPCA, UPCE, PDF417, AZTEC, QRCODE/QR/QTCODE, I2OF5/INT2OF5
  più i tipi confrontati su stampa (`test-tipi-1d.lbl`, 2026-10-23, larghezze uguali entro 2–3 dot): CODABAR→rationalizedCodabar, CODE39A→code39ext,
  CODE39C→code39+check, C2OF5→code2of5, C2OF5IND→iata2of5, C2OF5INDC→iata2of5+check, C2OF5MAT→datalogic2of5+check, INT2OF5C→interleaved2of5+check,
  I2OF5A→interleaved2of5, DUN/UPCSCC→interleaved2of5+check con cornice (`BEARER`), UCC128→code128, ADDON2/5→ean2/ean5,
  MSI→msi allargato 4/3 (stampante: niente check, rapporto 3:1), POSTNET→postnet a misura fissa (scale = dotsPerMm/3, ignora BM/BH).
  SCCADDON→interleaved2of5+check (`test-aperti.lbl`, 2026-10-27). CODE11 e PLESSEY disegnati in proprio (`CUSTOM_BARS`, larghezze esatte in stampa):
  CODE11 larghe 2:1 fisse (BR ignorato), senza cifra di controllo; PLESSEY con larghe = rapporto BR, CRC-8, barre orizzontali piene
  sopra (spessa = barra larga) e sotto (= barra stretta). Stato parser `barcodeWide` (da BR/BARSET [0]) per il rapporto.
  UPCD1–5, MAXICODE, MICROPDF417 e GS1DATAMATRIX (`test-micropdf.lbl`, `test-gs1dm.lbl`, 2026-10-28): la stampante non li stampa (riga interrotta) → nessuna voce (segnaposto). UPCE: solo 6 cifre (sistema 0 e controllo aggiunti dalla stampante), altri formati → errore (`test-upce.lbl`).
- Senza tipo → INT2OF5 (default del manuale). Tipo non in mappa → segnaposto + avviso "Tipo barcode non gestito".
  `QTCODE` (nome del manuale) **non** stampa: è un refuso, il tipo giusto è `QRCODE`.
- 2D/impilati (verificati su stampa, `test-tipi-2d.lbl`, 2026-10-23):
  - **Un BARSET sovrascrive solo i parametri che scrive**: gli altri restano quelli del BARSET precedente, anche cambiando tipo
    (es. righe 32 di un DataMatrix finiscono nel PDF417 successivo). `BARSET #n,…`: i valori partono dal parametro n (1 = nome). Vedi `setBarParams`.
  - DataMatrix (`test-dm-parametri.lbl`): 7° parametro BARSET (`barcodeParams[5]`, dopo la sicurezza) = N ≥ 1 → **N-esimo formato quadrato**
    (1 = 10×10, 2 = 12×12 … 9 = 26×26, 10 = 32×32, 11 = 36×36, 12 = 40×40, `DM_SIZES`). Es. `0,12` → sempre 40×40.
    Se non è indicato: il più piccolo che contiene il dato; codeword = minimo tra ASCII e tutto in C40 o Text **senza ottimizzare la chiusura**
    (`dmCodewords`; "ABCDEFGHIJKLMNOP" = 18×18 con bwip da solo 16×16, 24 minuscole = 18×18, 31 cifre = 18×18).
    Formato forzato troppo piccolo: la stampante lo stampa comunque → l'editor tronca il dato per farlo entrare. Righe/colonne [7]/[8] ignorate.
  - PDF417: colonne [8] valide 1–30 altrimenti 1, righe [7] valide 3–90, sicurezza [4] default 2, altezza BARSET = altezza riga in dot.
    Righe/colonne fissate in cui il dato non entra → la stampante non stampa → segnaposto. Colonne fissate (1–30) senza righe → non stampa.
    Senza righe né colonne: 1 colonna, righe come bwip-js (verificato: "ABC123456" = 172×84, proporzioni [5]/[6] ignorate).
  - CODE16K / CODE49: larghezza come in stampa, ogni riga alta BH (`BWIP_STACKED`).
- Variabili barcode: `isBarcodeVar`, `maxChars` → stringa random in `previewValue`, usata da `resolveContent(content, true)`.

## Font
- Dimensione FT in punti: `sizePx = fontSize * (25.4/72) * dotsPerMm * scale`.
- `FT "<font>",<size>,<slant>,<width %>`: il 4° parametro è la **larghezza %** (`fontWidth`, `ctx.scale` orizzontale), non un angolo. Slant ≠ 0 → italic.
- Font non installati: `fontInstalled(nome)` confronta la larghezza di un testo col font richiesto e coi generici monospace/serif
  (`document.fonts.check` non serve: dà true anche per font di sistema assenti). Controlla FT e barfont.
  Mancante senza sostituto calibrato → testo rosso + sottolineatura tratteggiata, fallback per categoria (`fontRed`); vale anche per il testo barfont.
  Elenco dei font mancanti ("Font non installati sul PC") solo a sinistra, sotto la sorgente; i non calibrati hanno la riga rossa
  "non installato sul PC e non calibrato: anteprima con <sostituto>, larghezza indicativa". Nota "altezza in stampa: possibili leggere variazioni" (`fontHeightNote`)
  per i font non calibrati e per CG Triumvirate Condensed Bold (`FONT_TALL`, ~3 dot più alto a 10 pt: lasciato così).
  Mancante con sostituto calibrato (`FONT_KX`): testo nero, in lista come "→ <sostituto> (larghezza calibrata)" (`fontSubName`).

## Memoria di pagina (variabili, barcode, immagini)
- **Loghi variabili**: `PM VARn$` (tipicamente VAR21 Logo1, VAR22 Logo2) → il valore della variabile è il nome del file da caricare.
  `imageName(el)` risolve il nome; `images` è un `computed` (nomi fissi + valori correnti delle variabili logo), quindi scrivendo un nome
  in VAR21/22 compare subito un'immagine importabile con quel nome. Variabile vuota → segnaposto `[VAR21]`.
- `varStore` (index → oggetto variabile) e `imageStore` (`Map` filename → reactive `{dataUrl, img}`, via `storedImage`) tengono valore, etichetta, `maxChars`/`previewValue` e BMP caricati
  anche quando l'elemento sparisce dal layout: rimettendolo torna com'era. `variables`/`images` sono solo le voci presenti nel layout (stessi oggetti dello store).
- Import JSON scrive in `varStore` anche variabili non presenti nel layout; l'export include quelle del layout più quelle memorizzate con un valore.
- Solo in memoria: un reload della pagina azzera tutto. **Voluto** (deciso dall'utente, 2026-10-23): non aggiungere persistenza in localStorage.

## Variabili fisse (FIXED_VAR_LABELS)
VAR1 Bag Barcode · VAR2 Expiring Date · VAR3 Batch · VAR4 Production Date · VAR5 Datamatrix · VAR6 Drug Barcode ·
VAR7 Medication Code · VAR8 Brandname · VAR9 Active Principles · VAR10 Dosage · VAR11 Galenic Form · VAR12 List ·
VAR13 Legal Notice · VAR14 Drug Name · VAR15 Drug Description · VAR16 UserId · VAR17 Tasy Code · VAR18 Actual Time ·
VAR19 Plant Id · VAR20 Plant Name · VAR21 Logo1 · VAR22 Logo2 · VAR23 Custom Gs1 Field · VAR24 Bag Production Time ·
VAR25 Package Barcode · VAR26–28 Package Custom Field 1–3 · VAR29 Package Description.

## Parser (inline, nessuna dipendenza)
Gestiti: LAYOUT INPUT/END/RUN, CLL, NASC, CLIP, DIR, AN, II/NI, PP/PRPOS, FT, PT, PB, PM, PL/PRLINE, PX/PRBOX, BARSET, BT/BARTYPE, BM/BARMAG, BH/BARHEIGHT, BR/BARRATIO, BF/BARFONT, MAG, XORMODE,
FORMAT DATE$/TIME$, NAME DATE$/WEEKDAY$, COUNT& "START"/"WIDTH", DATE$ = / TIME$ = (impostazioni orologio in `result.clock`).
Statement separati da `:` (non dentro `"`, `splitOutQ`); contenuto PT/PB/PX separato da `;`; parametri PX dopo lo spessore separati da `,`; `VAR5$` → `{type:'var', index:5}`,
`"testo"` → `{type:'literal'}`, altro → `{type:'expr', clock}`, valutato da `evalExpr`:
DATE$[("F")], TIME$[("F")], WEEKDAY$(data), WEEKNUMBER(data) (ISO 8601), DATEADD$/TIMEADD$, CNTn$ (valore START con zeri fino a WIDTH, non definito = 1).
Data/ora = orologio del PC al disegno, o quelle di `DATE$ = "YYMMDD"` / `TIME$ = "HHMMSS"` nel sorgente. Espressione non riconosciuta → `[expr]`.
NAME DATE$: nome del mese tagliato a sinistra alla lunghezza del gruppo M, restano gli **ultimi** caratteri ("DICEMBRE" con MM → "RE").
Verificato su stampa (`test-data-ora.lbl`, 2026-10-27): tutti gli altri campi coincidono. CNT1$ con START 7 è uscito 0008 (contatore già avanzato da una stampa precedente, chiuso così con l'utente): l'editor mostra il valore START. Comandi sconosciuti → `warnings`.

## Punti aperti
1. **Offset fisico stampante** (in sospeso): l'anteprima della stampante sposta X di ≈ +21 dot ed è più larga dell'etichetta reale, ma secondo l'utente l'editor senza offset è più fedele alla stampa reale (2026-10-23): per ora nessun offset. In generale 2–4 mm non stampabili a sinistra/in basso (dipende da X-Start e Feed adjust del setup, vedi manuale §3.2 "Origin"). Serve un offset configurabile (Xoff/Yoff in dot).
2. ~~Dimensione barcode~~: verificata su stampa (modulo = BM, l'ultimo tra BARSET e BM vince).
3. **Logo BMP**: posizionamento dipende dal punto 1.
4. Altri scostamenti dal manuale elencati in `docs/fingerprint-reference.md` § "Discrepanze".

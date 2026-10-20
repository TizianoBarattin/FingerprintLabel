# Riferimento Intermec Direct Protocol v8 – comandi per il Label Editor

Riassunto dal manuale (`docs/intermec-direct-protocol-v8.txt`, pagine citate come `p.N` = marcatore `=== PAGE N ===`).

## Fondamenti (p.25–30)
- Unità: **dot** ovunque, tranne l'altezza dei font outline (in **punti**, 1 pt = 1/72").
- Densità: 8 dot/mm (203 dpi, dot 0.125 mm) · 11.81 dot/mm (300 dpi, dot 0.085 mm).
- Origine: punto del supporto sotto il primo dot attivo della testina; X dipende da **X-Start** del setup, Y da **Feed adjust** (+ eventuali FORMFEED). Asse X attraverso il percorso carta da sinistra a destra, Y lungo il percorso.
- `PRPOS | PP <x>,<y>` – punto di inserimento. Default 0,0, resettato da PRINTFEED.
- `ALIGN | AN <1-9>` – quale punto dell'oggetto coincide col punto di inserimento. Vale per **tutti** gli oggetti (testo, barcode, immagine, box, linea). 1 = basso-sx, 2 = basso-centro, 3 = basso-dx, 4–6 = metà, 7–9 = alto. Default 1.
- `DIR <1-4>` – rotazione oraria attorno al punto di ancoraggio: 1 = 0°, 2 = 90°, 3 = 180°, 4 = 270°. Default 1.
- `CLIP [BARCODE [HEIGHT|INFORMATION|X|Y]] ON|OFF` – campi parziali (senza CLIP, un campo fuori etichetta dà errore 1003).
- `XORMODE ON|OFF` – intersezioni bianche/nere.
- Tutti i parametri di formattazione tornano ai default dopo `PRINTFEED | PF`.

## Testo (p.31–33, 45)
- `FONT | FT "<nome>"[,<size pt>[,<slant °>[,<width %>]]]` – default `"Swiss 721 BT"`, 12, 0, 100. Nomi case-sensitive.
- Font standard Bitstream: Century Schoolbook BT, DingDings SWA, Dutch 801 Roman BT, Dutch 801 Bold BT, Futura Light BT, Letter Gothic 12 Pitch BT, Monospace 821 BT, Monospace 821 Bold BT, OCR-A BT, OCR-B 10 Pitch BT, Prestige 12 Pitch Bold BT, Swiss 721 BT, Swiss 721 Bold BT, Swiss 721 Bold Condensed BT, Zurich Extra Condensed BT.
- `MAG <h 1-4>,<w 1-4>` – ingrandimento (per font bitmap e immagini).
- `INVIMAGE | II` / `NORIMAGE | NI` – bianco su nero / normale.
- `PRTXT | PT <dato>[;<dato>...]` – riga singola. Dati: `"letterale"`, `VARn$`, `CNTn$`, `DATE$`, `DATE$("F")`, `TIME$`, `TIME$("F")`, `WEEKDAY$(...)`, `WEEKNUMBER(...)`, `DATEADD$([data,]giorni[,"F"])`, `TIMEADD$([ora,]sec[,"F"])`.
- `PRBOX | PX <h>,<w>,<spessore>,"<testo>"[,<off h>[,<off v>[,"<delimitatore riga>"[,"<controllo sillabazione>"]]]]` – **testo multi-riga** in un box (spessore 0 = box invisibile, max 20 righe × 300 caratteri). AN decide sia la posizione del box sia l'allineamento del testo dentro.

## Barcode (p.34–37, 86)
- `BARTYPE | BT "<nome>"` – default `"INT2OF5"`.
- `BARHEIGHT | BH <dot>` – default 100.
- `BARRATIO | BR <wide>,<narrow>` – default 3:1.
- `BARMAG | BM <n>` – default 2. Spessore barre = ratio × mag (es. 3:1 con BM 2 → larghe 6 dot, strette 2 dot).
- `BARSET [#<start>,]"<nome>",<wide>,<narrow>,<mag>,<height>,<security>,<aspect h>,<aspect w>,<righe>,<colonne>,<truncate>`
  default `"INT2OF5",3,1,2,100,2,1,2,0,0,0`. Equivale a BT+BR+BM+BH più i parametri dei codici 2D.
  Nel parser `barcodeParams` = parametri dopo il nome → `[0]` wide, `[1]` narrow, `[2]` mag, `[3]` height, `[4]` security, …
- `BARFONT | BF [#<start>,]"<font>"[,<h pt>[,<slant>[,<off v>[,<mag h>[,<mag w>[,<width %>]]]]]] [ON]` – interpretazione leggibile (default OFF); `BF ON` / `BF OFF`.
- `PRBAR | PB <dato>[;<dato>...]` – letterali alfanumerici tra virgolette, numeri senza.
- Nomi tipo barcode: CODABAR, CODE11, CODE16K, CODE39, CODE39A (full ASCII), CODE39C (checksum), CODE49, CODE93, CODE128, DUN, DATAMATRIX, EAN8, EAN13, EAN128, ADDON2, ADDON5, C2OF5, C2OF5IND, C2OF5INDC, C2OF5MAT, INT2OF5, INT2OF5C, I2OF5A, MAXICODE, MSI, PDF417, PLESSEY, POSTNET, QRCODE (nel PDF stampato "QTCODE", refuso), UCC128, SCCADDON, UPCA, UPCE, UPCD1–UPCD5, UPCSCC.

## Immagini (p.38–39, 47)
- `PRIMAGE | PM "<nome.ext>"` o `PM VARn$`. Convenzione estensione: `.1` per DIR 1/3, `.2` per DIR 2/4.
- Formato sorgente PCX (convertito in bitmap interna con `IMAGE LOAD`). `MAG` e `II/NI` applicabili.

## Box e linee (p.40–41)
- `PRBOX | PX <height>,<width>,<spessore>` – height perpendicolare alla direzione, width lungo la direzione.
- `PRLINE | PL <lunghezza>,<spessore>` – lungo la direzione DIR.

## Layout (p.42–45)
- `LAYOUT INPUT "tmp:<nome>"` … `LAYOUT END` – registra un layout (nome max 30 caratteri).
- `LAYOUT RUN "tmp:<nome>"` poi dati: `<STX>dato VAR1<CR>dato VAR2<CR>…<EOT>` (separatori modificabili con `FORMAT INPUT`). `LAYOUT RUN ""` cancella il layout attivo.
- `CLL` – pulisce il buffer di stampa; `PF [n]` – stampa.
- `NASC "<charset>"` – set caratteri (es. "UTF-8").

## Discrepanze tra codice attuale e manuale
1. **FT 4° parametro** = larghezza % (default 100), il parser lo usa come `fontAngle` e ruota il testo. Default size: manuale 12, parser 8.
2. **BARSET `[2]`** è la magnification, non la larghezza barra stretta; `BM` la sovrascrive (non va moltiplicata). Altezza = `[3]` / `BH`, non passata a bwip-js.
3. **AN** applicato solo al testo; il manuale lo prevede anche per barcode, immagini, box, linee.
4. **DIR sul testo** non ruota il testo (si usa solo `fontAngle`); il manuale prevede rotazione oraria di 90° per step.
5. Comandi non gestiti dal parser (finiscono in `warnings`): BT, BH, BR, MAG, II/NI, XORMODE, PF, FORMFEED, `BARSET #n`, `BF "<font>"... ON`, PX con testo multi-riga, dati `CNTn$`/`DATE$`/`TIME$` (mostrati come `[expr]`).
6. `BCID_MAP` manca di vari tipi del manuale (CODE39A/C, INT2OF5C, UCC128, CODABAR, MAXICODE, …); il default del protocollo è INT2OF5, il fallback del codice è code128.
7. `PM VARn$` (immagine da variabile) non riconosciuto: la regex PM richiede un nome tra virgolette.

<template>
  <div class="flex flex-column h-full gap-2" style="min-height: 0">

    <!-- TOOLBAR -->
    <div class="flex justify-content-start align-items-start gap-2 pt-2 pl-2">
      <DxButton
        text="Importa layout"
        icon="folder"
        styling-mode="outlined"
        @click="$refs.layoutInput.click()"
      />
      <DxButton
        text="Importa Variabili JSON"
        icon="import"
        styling-mode="outlined"
        @click="$refs.varsInput.click()"
      />
      <div class="ml-auto flex gap-2">
        <DxButton
          :text="hideEmpty ? 'Mostra variabili vuote' : 'Nascondi variabili vuote'"
          :icon="hideEmpty ? 'eyeopen' : 'eyeclose'"
          :styling-mode="hideEmpty ? 'contained' : 'outlined'"
          :disabled="!parsed"
          hint="Variabili vuote: niente al loro posto, come in stampa"
          @click="hideEmpty = !hideEmpty; renderCanvas()"
        />
        <DxButton
          text="Esporta Variabili JSON"
          icon="exportxlsx"
          styling-mode="inline"
          :disabled="!parsed"
          @click="exportVarsJson"
        />
      </div>
      <!-- Impostazioni dimensioni -->
      <div class="flex align-items-center gap-1 border-1 border-200 border-round px-2 py-1">
        <i class="pi pi-cog text-400" style="font-size:12px"></i>
        <input v-model.number="settings.widthMm" type="number" min="10" max="500" class="dim-input" title="Larghezza (mm)" @change="applySettings">
        <span class="text-400" style="font-size:11px">x</span>
        <input v-model.number="settings.heightMm" type="number" min="10" max="500" class="dim-input" title="Altezza (mm)" @change="applySettings">
        <span class="text-400" style="font-size:11px">mm</span>
        <select v-model.number="settings.dotsPerMm" class="dim-select" @change="applySettings">
          <option :value="8">203 DPI</option>
          <option :value="11.81">300 DPI</option>
          <option :value="11.87">300 DPI (11.87 app)</option>
          <option :value="16">406 DPI</option>
        </select>
        <button class="fit-btn" :disabled="!parsed" title="Adatta altezza al contenuto" @click="fitHeight">
          <i class="pi pi-arrows-v"></i>
        </button>
      </div>

      <input ref="layoutInput" type="file" accept=".lbl,.txt,.fp,.fingerprint" style="display:none" @change="onLayoutFile">
      <input ref="varsInput"   type="file" accept=".json"                       style="display:none" @change="onVarsFile">
    </div>

    <!-- BODY: 3 colonne -->
    <div class="flex flex-row flex-1 gap-2" style="min-height: 0; overflow: hidden">

      <!-- ── COLONNA SINISTRA: sorgente Fingerprint ── -->
      <div class="flex flex-column gap-1" style="width: 800px; min-width: 500px; overflow-y: auto">
        <div class="section-label">
          <i class="pi pi-code mr-1"></i>Sorgente
        </div>
        <div class="flex" style="flex: 0 0 auto">
          <div ref="gutter" class="source-gutter">
            <div v-for="n in sourceLines" :key="n">{{ n }}</div>
          </div>
          <textarea
            v-model="layoutSource"
            class="source-editor"
            placeholder="Incolla o importa un layout Fingerprint..."
            spellcheck="false"
            wrap="off"
            @input="onSourceInput"
            @scroll="e => gutter.scrollTop = e.target.scrollTop"
          />
        </div>
        <div v-if="parseWarnings.length" class="text-xs text-orange-500 mt-1 flex flex-column gap-1">
          <span><i class="pi pi-exclamation-triangle mr-1"></i>{{ parseWarnings.length }} avvisi parser</span>
          <span v-for="(w, i) in parseWarnings" :key="i" class="pl-3" style="font-family: monospace; word-break: break-all">{{ w }}</span>
        </div>
        <div v-if="missingFonts.size" class="missing-fonts-box mt-1">
          <div class="flex align-items-center gap-1 mb-1">
            <i class="pi pi-times-circle" style="color:#dc2626;font-size:11px"></i>
            <span style="color:#dc2626;font-weight:700;font-size:11px">Font non installati sul PC</span>
          </div>
          <div v-for="f in [...missingFonts]" :key="f" class="missing-font-row">
            {{ f }}<span v-if="!fontRed(f)" style="color:#6b7280"> → {{ fontSubName(f) }} (larghezza calibrata)</span>
            <div v-else class="pl-2" style="color:#dc2626">non installato sul PC e non calibrato: anteprima con {{ fontSubName(f) }}, larghezza indicativa</div>
            <div v-if="fontHeightNote(f)" class="pl-2" style="color:#6b7280">altezza in stampa: possibili leggere variazioni</div>
          </div>
        </div>
      </div>

      <!-- ── COLONNA CENTRALE: anteprima canvas ── -->
      <div
        ref="canvasContainer"
        class="flex-1 flex align-items-center justify-content-center border-round surface-50"
        style="min-height: 0; overflow: hidden; position: relative; width: 600px; min-width: 500px"
      >
        <div
          v-if="!parsed"
          class="flex flex-column align-items-center justify-content-center text-400 gap-2"
          style="pointer-events: none"
        >
          <i class="pi pi-file-import" style="font-size: 2.5rem"></i>
          <span style="font-size: 13px">Importa un layout per visualizzare l'anteprima</span>
        </div>

        <canvas
          ref="labelCanvas"
          v-show="parsed"
          style="box-shadow: 0 2px 12px rgba(0,0,0,.18); background: #fff"
        />
      </div>

      <!-- ── COLONNA DESTRA: variabili + immagini ── -->
      <div
        class="flex flex-column gap-3"
        style="width: 280px; min-width: 200px; overflow-y: auto; padding-right: 4px"
      >
        <!-- Variabili -->
        <div v-if="variables.length" class="flex flex-column gap-2">
          <div class="section-label">
            <i class="pi pi-sliders-h mr-1"></i>Variabili
          </div>

          <div v-for="v in variables" :key="v.index" class="flex flex-column gap-1">
            <div class="flex align-items-center gap-2">
              <span class="var-badge">VAR{{ v.index }}</span>
              <!-- Etichetta fissa: solo testo -->
              <span v-if="v.fixedLabel" class="var-fixed-label">{{ v.fixedLabel }}</span>
              <!-- Etichetta libera: editabile -->
              <DxTextBox
                v-else
                v-model:value="v.label"
                placeholder="Nome campo"
                styling-mode="underlined"
                :width="'100%'"
                :show-clear-button="false"
              />
            </div>
            <DxTextBox
              v-model:value="v.value"
              :placeholder="v.isImageVar ? 'Nome file logo (es. LOGO1.BMP)...' : v.label ? v.label + '...' : 'Valore...'"
              styling-mode="outlined"
              :width="'100%'"
              @value-changed="() => { barcodeCache.clear(); renderCanvas() }"
            />
            <!-- Barcode variable: tipo + max chars anteprima -->
            <div v-if="v.isBarcodeVar" class="flex align-items-center gap-2">
              <span class="bc-type-badge">{{ v.barcodeType || 'BC' }}</span>
              <span class="text-xs text-400" style="white-space:nowrap">Max chars:</span>
              <input
                v-model.number="v.maxChars"
                type="number" min="1" max="256"
                class="dim-input" style="width:54px"
                placeholder="–"
                title="Caratteri massimi per anteprima barcode"
                @change="onMaxCharsChange(v)"
              >
              <span v-if="v.previewValue" class="text-xs text-green-600" title="Valore preview generato">
                <i class="pi pi-check-circle"></i>
              </span>
            </div>
          </div>
        </div>

        <!-- Immagini -->
        <div v-if="images.length" class="flex flex-column gap-2">
          <div class="section-label">
            <i class="pi pi-image mr-1"></i>Immagini
          </div>

          <div
            v-for="img in images"
            :key="img.filename"
            class="flex align-items-center gap-2 border-1 border-200 border-round p-2"
          >
            <i class="pi pi-file-image text-400" style="flex-shrink:0"></i>
            <span class="flex-1 text-sm text-600" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
              {{ img.filename }}
            </span>
            <img
              v-if="img.dataUrl"
              :src="img.dataUrl"
              style="height:28px; border:1px solid #ddd; border-radius:3px; flex-shrink:0"
            >
            <DxButton
              :text="img.dataUrl ? 'Cambia' : 'Importa'"
              icon="upload"
              styling-mode="outlined"
              style="flex-shrink:0"
              @click="triggerImageInput(img.filename)"
            />
            <input
              :id="`img-input-${sanitizeId(img.filename)}`"
              type="file"
              accept=".bmp,image/bmp"
              style="display:none"
              @change="e => onImageFile(img.filename, e)"
            >
          </div>
        </div>

        <!-- Placeholder pannello vuoto -->
        <div v-if="!parsed" class="text-400 text-sm text-center" style="margin-top: 2rem">
          Nessun layout caricato
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted } from 'vue'
import DxButton  from 'devextreme-vue/button'
import DxTextBox from 'devextreme-vue/text-box'

// ── Etichette fisse per le variabili standard ──────────────────────────────

const FIXED_VAR_LABELS = {
   1: 'Bag Barcode',
   2: 'Expiring Date',
   3: 'Batch',
   4: 'Production Date',
   5: 'Datamatrix',
   6: 'Drug Barcode',
   7: 'Medication Code',
   8: 'Brandname',
   9: 'Active Principles',
  10: 'Dosage',
  11: 'Galenic Form',
  12: 'List',
  13: 'Legal Notice',
  14: 'Drug Name',
  15: 'Drug Description',
  16: 'UserId',
  17: 'Tasy Code',
  18: 'Actual Time',
  19: 'Plant Id',
  20: 'Plant Name',
  21: 'Logo1',
  22: 'Logo2',
  23: 'Custom Gs1 Field',
  24: 'Bag Production Time',
  25: 'Package Barcode',
  26: 'Package Custom Field 1',
  27: 'Package Custom Field 2',
  28: 'Package Custom Field 3',
  29: 'Package Description',
}

// ── Parser inline ──────────────────────────────────────────────────────────

// Divide su `sep` fuori dalle virgolette
function splitOutQ(str, sep) {
  const parts = []; let cur = '', inQ = false
  for (const ch of str) {
    if (ch === '"')             { inQ = !inQ; cur += ch }
    else if (ch === sep && !inQ) { parts.push(cur.trim()); cur = '' }
    else                          { cur += ch }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}
const splitStmt = line => splitOutQ(line, ':')
const splitSemi = str  => splitOutQ(str, ';')
const unquote   = s    => s?.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : null

// `clock` = impostazioni di data/ora/contatori del layout (FORMAT DATE$ ecc.), usate per valutare le espressioni
function parseContent(raw, clock = null) {
  return splitSemi(raw).filter(s => s !== '').map(s => {
    const vm = s.match(/^VAR(\d+)\$$/i)
    if (vm) return { type: 'var', index: parseInt(vm[1]) }
    if (s.startsWith('"') && s.endsWith('"')) return { type: 'literal', value: s.slice(1, -1) }
    return { type: 'expr', value: s, clock }
  })
}

// ── Orologio e contatori (manuale §3.9 p.41–43, §5.4 p.56–57, §5.6 p.58) ──
// Data/ora = orologio del PC al momento del disegno, oppure quelle fissate nel sorgente con DATE$ = "YYMMDD" / TIME$ = "HHMMSS".
const newClock = () => ({ dateFmt: 'YYMMDD', timeFmt: 'HHMMSS', months: {}, weekdays: {}, counters: {}, date: null, time: null })
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const rj = (v, n) => String(v).padStart(n, '0').slice(-n)   // cifre allineate a destra, una per lettera
const ymd = s => new Date(2000 + +s.slice(0, 2), +s.slice(2, 4) - 1, +s.slice(4, 6))
function clockNow(clock) {
  const d = clock.date ? ymd(clock.date) : new Date()
  const t = clock.time ?? null
  if (t) d.setHours(+t.slice(0, 2), +t.slice(2, 4), +t.slice(4, 6))
  else if (clock.date) { const n = new Date(); d.setHours(n.getHours(), n.getMinutes(), n.getSeconds()) }
  return d
}
// Formato per gruppi di lettere uguali: "YYYY.MM.DD", "hh:MM PP" …; altri caratteri copiati.
// NAME DATE$: nome del mese al posto del numero, tagliato a sinistra alla lunghezza del gruppo
// (verificato su stampa, test-data-ora.lbl, 2026-10-27: "DICEMBRE" con MM → "RE")
function fmtDate(d, f, months = {}) {
  return f.replace(/Y+|M+|D+/g, g => {
    const n = g.length
    if (g[0] === 'Y') return rj(d.getFullYear(), n)
    if (g[0] === 'D') return rj(d.getDate(), n)
    const name = months[d.getMonth() + 1]
    return name ? name.slice(-n) : rj(d.getMonth() + 1, n)
  })
}
function fmtTime(d, f) {
  const h = d.getHours(), ap = h < 12 ? 'AM' : 'PM'
  return f.replace(/H+|h+|M+|S+|P+|p+/g, g => {
    const n = g.length
    switch (g[0]) {
      case 'H': return rj(h, n)
      case 'h': return rj(h % 12 || 12, n)
      case 'M': return rj(d.getMinutes(), n)
      case 'S': return rj(d.getSeconds(), n)
      case 'P': return ap.slice(0, n)
      default:  return ap.toLowerCase().slice(0, n)
    }
  })
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7)
}
// Valuta DATE$, TIME$, WEEKDAY$, WEEKNUMBER, DATEADD$, TIMEADD$, CNTn$; null = espressione non riconosciuta
function evalExpr(expr, clock) {
  if (!clock) return null
  const s = expr.replace(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '')   // spazi fuori dalle virgolette
  const now = clockNow(clock)
  const date = a => /^DATE\$$/i.test(a) ? now : /^"\d{6}"$/.test(a) ? ymd(a.slice(1, -1)) : null
  let m
  if ((m = s.match(/^DATE\$(\("F"\))?$/i))) return m[1] ? fmtDate(now, clock.dateFmt, clock.months) : fmtDate(now, 'YYMMDD')
  if ((m = s.match(/^TIME\$(\("F"\))?$/i))) return fmtTime(now, m[1] ? clock.timeFmt : 'HHMMSS')
  if ((m = s.match(/^WEEKDAY\$\((.+)\)$/i)) && date(m[1])) {
    const wd = (date(m[1]).getDay() + 6) % 7 + 1     // 1 = lunedì … 7 = domenica
    return clock.weekdays[wd] ?? WEEKDAYS[wd - 1]
  }
  if ((m = s.match(/^WEEKNUMBER\(([^,]+)(?:,\d+)?\)$/i)) && date(m[1])) return String(isoWeek(date(m[1])))
  if ((m = s.match(/^DATEADD\$\((?:"(\d{6})",)?(-?\d+)(,"F")?\)$/i))) {
    const d = m[1] ? ymd(m[1]) : new Date(now)
    d.setDate(d.getDate() + +m[2])
    return m[3] ? fmtDate(d, clock.dateFmt, clock.months) : fmtDate(d, 'YYMMDD')
  }
  if ((m = s.match(/^TIMEADD\$\((?:"(\d{6})",)?(-?\d+)(,"F")?\)$/i))) {
    const d = new Date(now)
    if (m[1]) d.setHours(+m[1].slice(0, 2), +m[1].slice(2, 4), +m[1].slice(4, 6))
    d.setSeconds(d.getSeconds() + +m[2])
    return fmtTime(d, m[3] ? clock.timeFmt : 'HHMMSS')
  }
  // Contatore: valore iniziale (COUNT& "START") con zeri fino a COUNT& "WIDTH"; non definito = 1
  if ((m = s.match(/^CNT(\d+)\$$/i))) {
    const c = clock.counters[m[1]] ?? {}
    const v = c.start ?? '1'
    return /^-?\d+$/.test(v) ? (v[0] === '-' ? '-' : '') + v.replace('-', '').padStart(+(c.width || 1), '0') : v
  }
  return null
}

// `fails(el)` (opzionale) dice se un barcode va in errore in stampa: la stampante interrompe la riga e non esegue
// le istruzioni dopo, nemmeno i cambi di stato (verificato su stampa, test-aperti.lbl, 2026-10-27)
const ROW_MAX = 150   // caratteri per riga (limite di progetto)
function parseLayout(source, fails = null) {
  const result = { layoutName: null, charset: 'UTF-8', clip: false, feed: 0, elements: [], warnings: [], clock: newClock() }
  const st = { fontName: 'Swiss 721 BT', fontSize: 12, fontSlant: 0, fontWidth: 100,   // default manuale e stampa
               x: 0, y: 0, ppFresh: true, dir: 1, align: 1, invert: false, barcodeType: null, barcodeParams: [],
               barcodeWide: 3, barcodeNarrow: 1, barcodeMag: 2, barcodeHeight: 100,   // default manuale §3.4
               barFont: { on: false, name: 'Swiss 721 BT', size: 12, slant: 0, offset: 6, magH: 1, magW: 1 },
               magH: 1, magW: 1, xor: false, clip: false, clipBc: {} }
  let m
  const checkType = t => { if (!BCID_MAP[t.toUpperCase()]) result.warnings.push(`Tipo barcode non gestito (segnaposto): ${t}`) }
  // Parametri BARSET dalla posizione `pos` (2 = wide) → barcodeParams[pos-2]:
  // [0] wide, [1] narrow, [2] mag, [3] height, [4] security, [5] aspect h, [6] aspect w, [7] righe, [8] colonne, [9] truncate.
  // narrow/mag/height aggiornano lo stato: l'ultimo tra BARSET e BM/BR/BH vince.
  // I parametri non scritti restano quelli del BARSET precedente, anche cambiando tipo (verificato su stampa)
  function setBarParams(values, pos) {
    values.forEach((p, i) => { p = p.trim(); st.barcodeParams[pos - 2 + i] = isNaN(p) ? p : parseInt(p) })
    const [wide, narrow, mag, height] = st.barcodeParams
    const set = i => i >= pos - 2 && i < pos - 2 + values.length
    if (set(0) && Number.isInteger(wide))   st.barcodeWide   = wide
    if (set(1) && Number.isInteger(narrow)) st.barcodeNarrow = narrow
    if (set(2) && Number.isInteger(mag))    st.barcodeMag    = mag
    if (set(3) && Number.isInteger(height)) st.barcodeHeight = height
  }
  for (const [i, raw] of source.split('\n').entries()) {
    const lineNo = i + 1
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith("'")) continue
    // Righe del PLC = T_MaxString (255): una riga più lunga non esce per niente (test-lunghezza-riga.lbl: 256 ok, 276 persa, 2026-11-04)
    // Limite di progetto 150 (scelto con l'utente, 2026-11-04: oltre ~150 la stampa di test-px-sillabazione non era affidabile)
    const len = raw.replace(/\r$/, '').length
    if (len > 255) result.warnings.push(`Riga ${lineNo}: ${len} caratteri, oltre 255 (T_MaxString del PLC): ` +
      (len > 256 ? 'riga persa in stampa' : "l'ultimo carattere va perso"))
    else if (len > ROW_MAX) result.warnings.push(`Riga ${lineNo}: ${len} caratteri, oltre il limite di ${ROW_MAX}: dividila su più righe`)
    if (len > 256) continue
    let onInputLine = false
    for (const stmt of splitStmt(line)) {
      const s = stmt.trim(); if (!s) continue
      if ((m = s.match(/^LAYOUT\s+INPUT\s+"([^"]+)"/i))) { result.layoutName = m[1]; onInputLine = true; continue }
      // Dopo LAYOUT INPUT sulla stessa riga la stampante ignora le impostazioni (verificato su stampa con FT).
      // Avviso solo se l'istruzione cambierebbe qualcosa rispetto ai default.
      if (onInputLine && !/^LAYOUT\s+(END|RUN)/i.test(s)) {
        if (!/^(NASC\b|DIR\s*1$|AN\s*1$|CLIP\s+OFF$|BF\s+OFF$)/i.test(s)) result.warnings.push(`Ignorato (riga LAYOUT INPUT): ${s}`)
        continue
      }
      if (/^LAYOUT\s+(END|RUN)/i.test(s)) continue
      if (/^CLL$/i.test(s)) continue
      if ((m = s.match(/^NASC\s+"([^"]+)"/i)))    { result.charset = m[1]; continue }
      if ((m = s.match(/^CLIP\s+(ON|OFF)/i)))      { result.clip = st.clip = m[1].toUpperCase() === 'ON'; continue }
      // CLIP BARCODE [HEIGHT|INFORMATION|X|Y] ON|OFF: taglio dei barcode (CLIP ON e CLIP BARCODE ON da soli non bastano, test-clip-bc-*.lbl)
      if ((m = s.match(/^CLIP\s+BARCODE(?:\s+(HEIGHT|INFORMATION|X|Y))?\s+(ON|OFF)$/i))) {
        if (m[1]) st.clipBc = { ...st.clipBc, [m[1].toLowerCase()]: m[2].toUpperCase() === 'ON' }
        continue
      }
      // Orologio e contatori: impostazioni globali della stampante (di solito inviate prima del layout)
      const ck = result.clock
      if ((m = s.match(/^FORMAT\s+DATE\$\s*"([^"]*)"/i)))  { ck.dateFmt = m[1] || 'YYMMDD'; continue }
      if ((m = s.match(/^FORMAT\s+TIME\$\s*"([^"]*)"/i)))  { ck.timeFmt = m[1] || 'HHMMSS'; continue }
      if ((m = s.match(/^NAME\s+DATE\$\s*(\d+)\s*,\s*"([^"]*)"/i)))    { ck.months[+m[1]]   = m[2]; continue }
      if ((m = s.match(/^NAME\s+WEEKDAY\$\s*(\d+)\s*,\s*"([^"]*)"/i))) { ck.weekdays[+m[1]] = m[2]; continue }
      if ((m = s.match(/^DATE\$\s*=\s*"(\d{6})"/i)))       { ck.date = m[1]; continue }
      if ((m = s.match(/^TIME\$\s*=\s*"(\d{6})"/i)))       { ck.time = m[1]; continue }
      if ((m = s.match(/^COUNT&\s*"(\w+)"\s*,\s*(\d+)\s*,\s*"([^"]*)"/i))) {
        (ck.counters[m[2]] ??= {})[m[1].toLowerCase()] = m[3]; continue
      }
      if ((m = s.match(/^DIR\s*(\d)/i)))           { st.dir = parseInt(m[1]); continue }
      if ((m = s.match(/^AN\s*(\d)/i)))            { st.align = parseInt(m[1]); continue }
      if (/^(?:II|INVIMAGE)$/i.test(s))            { st.invert = true;  continue }   // testo bianco su nero
      if (/^(?:NI|NORIMAGE)$/i.test(s))            { st.invert = false; continue }
      // MAG <h>,<w>: ingrandisce testi e immagini (manuale p.26, 32: 1–4). In stampa anche 5 funziona (test-mag-errore.lbl, 2026-10-28);
      // il limite vero (errore 1021 "Too large argument for MAG") non è noto → oltre 5 solo avviso, 0 = errore → riga interrotta
      if ((m = s.match(/^MAG\s*(\d+)\s*,\s*(\d+)/i))) {
        const [h, w] = [+m[1], +m[2]]
        if (h < 1 || w < 1) { result.warnings.push(`Riga ${lineNo}: MAG 0 non valido, resto della riga ignorato`); break }
        if (h > 5 || w > 5) result.warnings.push(`Riga ${lineNo}: MAG oltre 5 non verificato su stampa (possibile errore 1021)`)
        st.magH = h; st.magW = w; continue
      }
      // XORMODE ON: le intersezioni tra campi escono bianche (manuale p.24)
      if ((m = s.match(/^XORMODE\s+(ON|OFF)$/i)))  { st.xor = m[1].toUpperCase() === 'ON'; continue }
      // PF dentro il layout: nessun effetto (niente reset dei parametri né del PP, tutto su un'etichetta; test-pf.lbl, 2026-10-28)
      if (/^(?:PF|PRINTFEED)\b/i.test(s)) { result.warnings.push(`Riga ${lineNo}: ${s} dentro il layout ignorato (come in stampa)`); continue }
      // FORMFEED n dentro il layout: la carta avanza di n dot prima della stampa → sull'etichetta tutto sale di n dot
      // (test-formfeed.lbl, 2026-10-28: FORMFEED 120 → cornice ~10 mm più in alto, parte alta fuori etichetta; anteprima stampante invariata)
      if ((m = s.match(/^(?:FORMFEED|FF)\b\s*(-?\d+)?$/i))) {
        if (m[1]) { result.feed += +m[1]; result.warnings.push(`Riga ${lineNo}: ${s} sposta tutta la stampa di ${m[1]} dot lungo la carta (simulato)`) }
        else result.warnings.push(`Riga ${lineNo}: ${s} senza lunghezza fa uscire un'etichetta bianca (non simulato)`)
        continue
      }
      if ((m = s.match(/^(?:PP|PRPOS)\s*(\d+)\s*,\s*(\d+)/i))) { st.x = parseInt(m[1]); st.y = parseInt(m[2]); st.ppFresh = true; continue }
      if ((m = s.match(/^FT\s*"([^"]+)"(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?/i))) {
        st.fontName = m[1]; st.fontSize = m[2] ? parseInt(m[2]) : 12
        // FT "<font>",<size pt>,<slant °>,<width %> (manuale p.25)
        st.fontSlant = m[3] ? parseInt(m[3]) : 0; st.fontWidth = m[4] ? parseInt(m[4]) : 100; continue
      }
      // AN e DIR restano validi fino a PF (manuale p.21): non si resettano dopo ogni oggetto
      const font = () => ({ fontName: st.fontName, fontSize: st.fontSize, fontSlant: st.fontSlant, fontWidth: st.fontWidth, invert: st.invert })
      // follow: nessun PP dopo l'ultimo PT/PB/PM → l'oggetto parte dal cursore lasciato da quello (calcolato al disegno)
      const at = () => ({ x: st.x, y: st.y, follow: !st.ppFresh, dir: st.dir, align: st.align, xor: st.xor, magH: st.magH, magW: st.magW,
                        clip: st.clip, clipBc: st.clipBc, line: lineNo })
      if ((m = s.match(/^PT\s*(.*)/i))) {
        result.elements.push({ type: 'text', ...at(), ...font(),
          content: parseContent(m[1].trim(), result.clock) }); st.ppFresh = false; continue
      }
      if ((m = s.match(/^PB\s*(.*)/i))) {
        result.elements.push({ type: 'barcode', ...at(),
          barcodeType: st.barcodeType, barcodeParams: [...st.barcodeParams],
          barcodeWide: st.barcodeWide, barcodeNarrow: st.barcodeNarrow, barcodeMag: st.barcodeMag, barcodeHeight: st.barcodeHeight,
          barFont: st.barFont.on ? { ...st.barFont } : null,
          content: parseContent(m[1].trim(), result.clock) }); st.ppFresh = false
        if (fails?.(result.elements.at(-1))) {
          result.warnings.push(`Riga ${lineNo}: barcode non stampabile, resto della riga ignorato come in stampa`)
          break
        }
        continue
      }
      // PM "<file>" oppure PM VARn$ (logo variabile: il valore della variabile è il nome del file)
      if ((m = s.match(/^(?:PM|PRIMAGE)\s*(.+)/i))) {
        result.elements.push({ type: 'image', ...at(),
          content: parseContent(m[1].trim(), result.clock) }); st.ppFresh = false; continue
      }
      if ((m = s.match(/^(?:PL|PRLINE)\s*(\d+)\s*,\s*(\d+)/i))) {
        result.elements.push({ type: 'line', ...at(),
          length: parseInt(m[1]), thickness: parseInt(m[2]) }); continue
      }
      // PX <h>,<w>,<spessore>[,<dato>[,<off h>[,<off v>[,"<delimitatore>"[,"<sillabazione>"]]]]]
      if ((m = s.match(/^(?:PX|PRBOX)\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(.+))?/i))) {
        const box = { type: 'box', ...at(),
          height: parseInt(m[1]), width: parseInt(m[2]), thickness: parseInt(m[3]) }
        if (m[4]) {
          const [data, hOff, vOff, delim] = splitOutQ(m[4], ',')
          Object.assign(box, font(), { content: parseContent(data, result.clock),
            hOff: parseInt(hOff) || 0, vOff: parseInt(vOff) || 0, delim: unquote(delim) })
        }
        result.elements.push(box)
        const why = box.content && fails?.(box)
        if (why) { result.elements.pop(); result.warnings.push(`Riga ${lineNo}: PX non stampabile (${why}), resto della riga ignorato come in stampa`); break }
        continue
      }
      if ((m = s.match(/^BARSET\s*"([^"]+)"(?:\s*,\s*(.+))?/i))) {
        st.barcodeType = m[1]; checkType(m[1])
        setBarParams(m[2] ? m[2].split(',') : [], 2); continue
      }
      // BARSET #n,… : i valori partono dal parametro n (1 = nome) e sovrascrivono solo quelli (verificato su stampa)
      if ((m = s.match(/^BARSET\s*#(\d+)\s*,\s*(.+)/i))) {
        const n = parseInt(m[1]), parts = splitOutQ(m[2], ',')
        if (n === 1) { st.barcodeType = unquote(parts[0]) ?? parts[0]; checkType(st.barcodeType); parts.shift() }
        setBarParams(parts, Math.max(n, 2)); continue
      }
      if ((m = s.match(/^(?:BT|BARTYPE)\s*"([^"]+)"/i))) { st.barcodeType = m[1]; checkType(m[1]); continue }
      if ((m = s.match(/^(?:BM|BARMAG)\s*(\d+)/i)))    { st.barcodeMag = parseInt(m[1]); continue }
      if ((m = s.match(/^(?:BH|BARHEIGHT)\s*(\d+)/i))) { st.barcodeHeight = parseInt(m[1]); continue }
      if ((m = s.match(/^(?:BR|BARRATIO)\s*(\d+)\s*,\s*(\d+)/i))) { st.barcodeWide = parseInt(m[1]); st.barcodeNarrow = parseInt(m[2]); continue }
      // BF ON|OFF · BF [#n,]"<font>"[,<size>[,<slant>[,<offset>…]]] [ON] – interpretazione sotto il barcode
      if ((m = s.match(/^(?:BF|BARFONT)\s+(ON|OFF)$/i))) { st.barFont.on = m[1].toUpperCase() === 'ON'; continue }
      if ((m = s.match(/^(?:BF|BARFONT)\s*(?:#\d+\s*,\s*)?"([^"]+)"(.*?)(\s+ON)?$/i))) {
        // BF "<font>",<size>,<slant>,<offset>,<mag h>,<mag w>
        const [size, slant, offset, magH, magW] = m[2].split(',').slice(1).map(p => parseInt(p))
        Object.assign(st.barFont, { name: m[1], size: size || 12, slant: slant || 0, offset: Number.isInteger(offset) ? offset : 6,
          magH: magH >= 1 && magH <= 4 ? magH : 1, magW: magW >= 1 && magW <= 4 ? magW : 1 })
        if (m[3]) st.barFont.on = true
        continue
      }
      result.warnings.push(s)
    }
  }
  return result
}

// ── Stato ──────────────────────────────────────────────────────────────────

const layoutInput     = ref(null)
const varsInput       = ref(null)
const canvasContainer = ref(null)
const labelCanvas     = ref(null)

const layoutSource  = ref('')
const sourceLines   = computed(() => layoutSource.value.split('\n').length)   // numeri di riga della sorgente
const gutter        = ref(null)
const parsed        = ref(null)
const parseWarnings = ref([])
const hideEmpty     = ref(false)   // variabili vuote: niente (come in stampa) invece di [VARn]
const variables     = ref([])   // { index, label, value } – solo quelle presenti nel layout
// Memoria di pagina: valori, impostazioni barcode e immagini restano anche se tolti dal layout
const varStore      = reactive({})  // index → oggetto variabile
const imageStore    = new Map()     // filename → reactive { filename, dataUrl, img }

const storedImage = f => imageStore.get(f) ?? imageStore.set(f, reactive({ filename: f, dataUrl: null, img: null })).get(f)
// Nome file di un PM: letterale o valore della variabile (null se la variabile è vuota)
function imageName(el) {
  const parts = el.content.map(p => p.type === 'literal' ? p.value
    : p.type === 'var' ? variables.value.find(v => v.index === p.index)?.value?.trim() || null : null)
  return parts.includes(null) ? null : parts.join('') || null
}
// Immagini del layout: nomi fissi + valori correnti delle variabili logo (VAR21/VAR22…)
const images = computed(() => [...new Set(
  (parsed.value?.elements ?? []).filter(e => e.type === 'image').map(imageName).filter(Boolean)
)].map(storedImage))

function storedVar(index, label = '') {
  return varStore[index] ??= { index, label, value: '', fixedLabel: FIXED_VAR_LABELS[index] ?? null,
    isBarcodeVar: false, barcodeType: null, maxChars: null, previewValue: null }
}

const settings     = reactive({ widthMm: 70, heightMm: 50, dotsPerMm: 11.87 })
const labelDots    = reactive({ w: 70 * 11.87, h: 50 * 11.87 })
const missingFonts = ref(new Set())
let bwipjsLib = null
const barcodeCache = new Map()  // key: bcid|text → offscreen canvas

async function loadBwipJs() {
  if (bwipjsLib) return bwipjsLib
  if (window.bwipjs) { bwipjsLib = window.bwipjs; return bwipjsLib }
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/bwip-js@4/dist/bwip-js-min.js'
    s.onload  = () => { bwipjsLib = window.bwipjs; resolve(bwipjsLib) }
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
}

const BCID_MAP = {
  'DATAMATRIX': 'datamatrix',   // GS1DATAMATRIX: la stampante non lo stampa (test-gs1dm.lbl, 2026-10-28) → nessuna voce
  'CODE128': 'code128', 'CODE128A': 'code128', 'CODE128B': 'code128', 'CODE128C': 'code128',
  'CODE39': 'code39', 'CODE93': 'code93',
  'EAN13': 'ean13', 'EAN8': 'ean8', 'EAN128': 'gs1-128',
  'GS1-128': 'gs1-128', 'GS1128': 'gs1-128',
  'UPCA': 'upca', 'UPCE': 'upce',
  'PDF417': 'pdf417',   // MICROPDF417: la stampante non lo stampa (test-micropdf.lbl, 2026-10-28) → nessuna voce
  'AZTEC': 'azteccode', 'QRCODE': 'qrcode', 'QR': 'qrcode',
  'I2OF5': 'interleaved2of5', 'INT2OF5': 'interleaved2of5',
  'CODE16K': 'code16k', 'CODE49': 'code49',
  // QTCODE (nome del QR nel manuale) non viene stampato: refuso, usare QRCODE (verificato su stampa)
  // Tipi del manuale confrontati su stampa (test-tipi-1d.lbl, 2026-10-23): larghezze uguali entro 2–3 dot
  'CODABAR': 'rationalizedCodabar', 'CODE39A': 'code39ext', 'CODE39C': ['code39', { includecheck: true }],
  'C2OF5': 'code2of5', 'C2OF5IND': 'iata2of5', 'C2OF5INDC': ['iata2of5', { includecheck: true }],
  'C2OF5MAT': ['datalogic2of5', { includecheck: true }],
  'INT2OF5C': ['interleaved2of5', { includecheck: true }], 'I2OF5A': 'interleaved2of5',
  'DUN': ['interleaved2of5', { includecheck: true }], 'UPCSCC': ['interleaved2of5', { includecheck: true }],   // + bordo, vedi BEARER
  'UCC128': 'code128', 'ADDON2': 'ean2', 'ADDON5': 'ean5', 'POSTNET': 'postnet',
  // MSI: stampante senza cifra di controllo e barre larghe 3:1 (bwip 2:1) → immagine allargata di 4/3 (3° elemento)
  'MSI': ['msi', {}, 4 / 3],
  // SCCADDON: in stampa è un 2/5 interleaved con cifra di controllo, mostrata anche nel testo BF (test-aperti.lbl, 2026-10-27)
  'SCCADDON': ['interleaved2of5', { includecheck: true }],
  // Disegnati in proprio (CUSTOM_BARS): bwip-js non ha lo stesso rapporto barre della stampante
  'CODE11': 'code11', 'PLESSEY': 'plessey',
}
// Tipi con cornice (bearer bar) attorno alle barre, come in stampa
const BEARER = new Set(['DUN', 'UPCSCC'])
// Tipo → { bcid, opts } di bwip-js; senza tipo = INT2OF5 (default del manuale); tipo non gestito = null (segnaposto).
// UPCD1–5 non vengono stampati dalla stampante: restano senza corrispondenza.
function getBwip(t) {
  const v = BCID_MAP[(t || 'INT2OF5').toUpperCase()]
  if (!v) return null
  const [bcid, opts = {}, sx = 1] = Array.isArray(v) ? v : [v]
  return { bcid, opts, sx }
}
// bwip-js disegna questi 2D a 2 px per modulo (a scale 1), i lineari e PDF417 a 1 px
const BWIP_2PX = new Set(['datamatrix', 'qrcode', 'azteccode'])
const BWIP_2D  = new Set([...BWIP_2PX, 'pdf417'])  // niente BH/height
const BWIP_STACKED = new Set(['code16k', 'code49'])                 // righe impilate: altezza riga = BH

// DataMatrix ECC200 quadrati: [lato, codeword dati]
const DM_SIZES = [[10,3],[12,5],[14,8],[16,12],[18,18],[20,22],[22,30],[24,36],[26,44],[32,62],[36,86],[40,114],
  [44,144],[48,174],[52,204],[64,280],[72,368],[80,456],[88,576],[96,696],[104,816],[120,1050],[132,1304],[144,1558]]
// Codeword come la stampante: il minimo tra ASCII (2 cifre = 1 codeword) e tutto il dato in C40 o in Text
// senza ottimizzazioni di chiusura (latch + 2 codeword ogni 3 valori + unlatch + resto in ASCII).
// Verificato su stampa: "ABCDEFGHIJKLMNOP" → 18×18 (bwip-js da solo 16×16), 24 minuscole → 18×18 (Text), 31 cifre → 18×18
function dmCodewords(text) {
  let cw = 0
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i]) && /\d/.test(text[i + 1] ?? '')) { cw++; i++ }
    else cw += text.charCodeAt(i) > 127 ? 2 : 1
  }
  // C40: maiuscole, cifre e spazio = 1 valore, altri ASCII = 2 (shift); Text: uguale con le minuscole
  const triplets = basic => {
    if ([...text].some(c => c.charCodeAt(0) > 127)) return Infinity
    const v = [...text].reduce((n, c) => n + (basic.test(c) ? 1 : 2), 0)
    return 1 + 2 * Math.floor(v / 3) + 1 + v % 3
  }
  return Math.min(cw, triplets(/[A-Z0-9 ]/), triplets(/[a-z0-9 ]/))
}
// ── Barre disegnate in proprio (verificate su stampa, test-aperti.lbl, 2026-10-27) ──
// Elementi [barra, spazio, barra, …] in unità di barra stretta (= BM dot).
// CODE11: larghe 2:1 fisse (BR ignorato), nessuna cifra di controllo
const C11_PAT = { '0': '00001', '1': '10001', '2': '01001', '3': '11000', '4': '00101', '5': '10100',
  '6': '01100', '7': '00011', '8': '10010', '9': '10000', '-': '00100', '*': '00110' }
function code11Elements(text) {
  return ['*', ...text.replace(/[^0-9-]/g, ''), '*'].flatMap((c, i) =>
    [...(i ? [1] : []), ...[...C11_PAT[c]].map(b => b === '1' ? 2 : 1)])
}
// PLESSEY: ogni bit = larga+stretta (1) o stretta+larga (0) con larga = BR; start 1101, cifre bit basso prima,
// CRC-8 (polinomio 0x1E9), chiusura di 5 celle. Larghezza = (4·cifre + 17) × BM × (1 + rapporto)
function plesseyElements(text, r) {
  const bits = [1, 1, 0, 1]
  for (const c of text.replace(/[^0-9A-F]/gi, '')) for (let i = 0; i < 4; i++) bits.push((parseInt(c, 16) >> i) & 1)
  const reg = [...bits.slice(4), 0, 0, 0, 0, 0, 0, 0, 0], poly = [1, 1, 1, 1, 0, 1, 0, 0, 1]
  for (let i = 0; i < reg.length - 8; i++) if (reg[i]) poly.forEach((p, j) => { reg[i + j] ^= p })
  bits.push(...reg.slice(-8))
  return [...bits.flatMap(b => b ? [r, 1] : [1, r]), 1 + r, r, 1, r, 1, 1, r, 1, r]
}
// Canvas a 1 px per dot; `bearer` = [alto, basso] barre orizzontali piene in dot (PLESSEY: larga sopra, stretta sotto)
function barsCanvas(els, n, h, bearer) {
  const c = document.createElement('canvas')
  c.width = Math.round(els.reduce((a, b) => a + b, 0) * n); c.height = h
  const g = c.getContext('2d'); g.fillStyle = '#000'
  let x = 0
  els.forEach((w, i) => { if (i % 2 === 0) g.fillRect(Math.round(x), 0, Math.round(x + w * n) - Math.round(x), h); x += w * n })
  if (bearer) { g.fillRect(0, 0, c.width, bearer[0]); g.fillRect(0, h - bearer[1], c.width, bearer[1]) }
  return c
}
const CUSTOM_BARS = {
  code11:  (t, el, n) => barsCanvas(code11Elements(t), n, el.barcodeHeight || 100),
  plessey: (t, el, n) => {
    const r = (el.barcodeWide || 3) / (el.barcodeNarrow || 1)
    return barsCanvas(plesseyElements(t, r), n, el.barcodeHeight || 100, [Math.round(n * r), n])
  },
}
// Cifra di controllo modulo 10 del 2/5 interleaved (pesi 3,1 da destra), mostrata nel testo BF di SCCADDON
const i25Check = t => String((10 - [...t].reverse().reduce((s, d, i) => s + (+d || 0) * (i % 2 ? 1 : 3), 0) % 10) % 10)
// BF ON su EAN/UPC e add-on: la stampante usa l'interpretazione standard (cifre spezzate sotto le barre,
// guardie allungate; add-on con cifre sopra) = includetext di bwip-js, stessa altezza in stampa
const BWIP_INCLTEXT = new Set(['ean13', 'ean8', 'upca', 'upce', 'ean2', 'ean5'])
// Cifre dell'add-on con BF ON (verificato su stampa, test-addon-qr.lbl, 2026-10-28, BM 2 e 3): barre alte BH,
// cifre allineate a sx sulle barre, passo 5·BM+3 dot, alte 5·BM+4, base a BH + 2·BM + 8 dal PP. Font BF ignorato.
// Disegna nel riferimento DIR 1 già ruotato; ritorna il passo in dot
function addonDigits(ctx, text, bh, bm, scale) {
  const pitch = 5 * bm + 3
  ctx.save()
  ctx.font = `${(5 * bm + 4) / 0.716 * scale}px Arial, Helvetica, sans-serif`   // 0.716 = altezza cifre Arial in em
  ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ;[...text].forEach((c, i) => ctx.fillText(c, i * pitch * scale, -(bh + 2 * bm + 8) * scale))
  ctx.restore()
  return pitch
}

// BF OFF su EAN/UPC (verificato su stampa, test-cursore-ean.lbl, 2026-10-27): simbolo alto BH, le barre lunghe
// (guardie, prima/ultima cifra UPC-A) arrivano in fondo, le altre si fermano `ext` dot prima (6 moduli).
// Si parte dall'immagine includetext di bwip-js: barre lunghe = quelle più lunghe del minimo.
function eanGuards(src, h, ext) {
  const W = src.width, d = src.getContext('2d').getImageData(0, 0, W, src.height).data
  const dark = (i, j) => d[(j * W + i) * 4 + 3] > 0 && d[(j * W + i) * 4] < 128
  const run  = i => { let j = 0; while (j < src.height && dark(i, j)) j++; return j }
  const cols = [...Array(W).keys()].filter(i => dark(i, 0))
  const mb = Math.min(...cols.map(run))
  const c = document.createElement('canvas'); c.width = cols.at(-1) - cols[0] + 1; c.height = h
  const g = c.getContext('2d'); g.fillStyle = '#000'
  for (const i of cols) g.fillRect(i - cols[0], 0, 1, run(i) > mb ? h : h - ext)
  return c
}

// Lato del DataMatrix: 7° parametro BARSET (barcodeParams[5]) = N ≥ 1 → N-esimo formato di DM_SIZES (1 = 10×10 … 12 = 40×40),
// altrimenti il più piccolo che contiene il dato in ASCII (verificato su stampa, test-dm-parametri.lbl)
function dmSize(text, sizeIndex) {
  if (Number.isInteger(sizeIndex) && sizeIndex >= 1) return DM_SIZES[Math.min(sizeIndex, DM_SIZES.length) - 1]
  const cw = dmCodewords(text)
  return DM_SIZES.find(([, cap]) => cap >= cw) ?? null
}

function applySettings() {
  labelDots.w = Math.round(settings.widthMm  * settings.dotsPerMm)
  labelDots.h = Math.round(settings.heightMm * settings.dotsPerMm)
  if (parsed.value) nextTick(renderCanvas)
}

function fitHeight() {
  if (!parsed.value) return
  let maxY = 0
  for (const el of parsed.value.elements) {
    let top = el.y
    if (el.type === 'line' && el.dir === 4) top = el.y + el.length  // DIR 4 = up = +Y
    if (el.type === 'box') top = el.y + el.height
    if (top > maxY) maxY = top
  }
  if (maxY < 10) return
  const margin = 10  // mm di margine
  settings.heightMm = Math.ceil(maxY / settings.dotsPerMm) + margin
  applySettings()
}

// ── Import layout da file ──────────────────────────────────────────────────

function onLayoutFile(e) {
  const file = e.target.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    layoutSource.value = ev.target.result
    loadLayout(ev.target.result)
    e.target.value = ''
  }
  reader.readAsText(file)
}

function loadLayout(source) {
  parsed.value = parseLayout(source)
  parseWarnings.value = parsed.value.warnings
  buildVariables()
  checkFonts().then(renderCanvas)
}

// ── Re-parse on source edit (debounced 450ms) ─────────────────────────────

let parseTimer = null
function onSourceInput() {
  clearTimeout(parseTimer)
  parseTimer = setTimeout(() => {
    const src = layoutSource.value.trim()
    if (src) {
      loadLayout(src)
    } else {
      parsed.value = null
      parseWarnings.value = []
      variables.value = []
      missingFonts.value = new Set()
    }
  }, 450)
}

// ── Verifica font installati ──────────────────────────────────────────────

async function checkFonts() {
  const names = [...new Set(
    parsed.value.elements
      .flatMap(e => [e.fontName, e.barFont?.name])   // testi, PX con testo e barfont
      .filter(Boolean)
  )]
  missingFonts.value = new Set(names.filter(n => !fontInstalled(n)))
}

// document.fonts.check dà true anche per i font di sistema assenti: si confronta la larghezza di un testo
// col font richiesto e con i font generici. Se non cambia rispetto a nessuno dei due, il font non c'è
const fontProbe = document.createElement('canvas').getContext('2d')
function fontInstalled(name) {
  const w = family => { fontProbe.font = `40px ${family}`; return fontProbe.measureText('mmmmmmmmmmlli WQ@#0123').width }
  return ['monospace', 'serif'].some(g => w(`"${name}",${g}`) !== w(g))
}

// ── Variabili ──────────────────────────────────────────────────────────────

function buildVariables() {
  const map = {}
  for (const el of parsed.value.elements) {
    if (!el.content) continue
    let lastLit = ''
    for (const p of el.content) {
      if (p.type === 'literal') { lastLit = p.value.replace(/:\s*$/, '').trim() }
      else if (p.type === 'var') {
        // Valore, etichetta e max chars vengono da varStore; tipo barcode ricalcolato a ogni parse
        if (!map[p.index]) map[p.index] = Object.assign(storedVar(p.index, lastLit), { isBarcodeVar: false, barcodeType: null, isImageVar: false })
        if (el.type === 'image') map[p.index].isImageVar = true   // logo variabile: valore = nome file
        if (el.type === 'barcode') {
          map[p.index].isBarcodeVar = true
          if (!map[p.index].barcodeType) map[p.index].barcodeType = el.barcodeType
        }
        lastLit = ''
      }
    }
  }
  variables.value = Object.values(map).sort((a, b) => a.index - b.index)
}

// ── Import variabili JSON ──────────────────────────────────────────────────

function onVarsFile(e) {
  const file = e.target.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result)
      // Salva tutto in varStore, anche le variabili non (ancora) presenti nel layout
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (!(item.index > 0)) return
          const v = storedVar(item.index); v.value = item.value ?? ''; if (item.label) v.label = item.label
        })
      } else {
        Object.entries(data).forEach(([k, val]) => {
          const idx = parseInt(k.replace(/^VAR/i, ''))
          if (idx > 0) storedVar(idx).value = String(val)
        })
      }
      nextTick(renderCanvas)
    } catch { alert('File JSON non valido') }
    e.target.value = ''
  }
  reader.readAsText(file)
}

// ── Export variabili JSON ──────────────────────────────────────────────────

function exportVarsJson() {
  // Esporta anche le variabili memorizzate ma ora assenti dal layout, purché abbiano un valore
  const shown = new Set(variables.value.map(v => v.index))
  const data = Object.values(varStore).filter(v => shown.has(v.index) || v.value)
    .sort((a, b) => a.index - b.index).map(v => ({ index: v.index, label: v.label, value: v.value }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: 'variabili.json'
  })
  a.click(); URL.revokeObjectURL(a.href)
}

// ── Import immagini ────────────────────────────────────────────────────────

function sanitizeId(name) { return name.replace(/[^a-z0-9]/gi, '_') }

function triggerImageInput(filename) {
  document.getElementById(`img-input-${sanitizeId(filename)}`)?.click()
}

function onImageFile(filename, e) {
  const file = e.target.files[0]; if (!file) return
  if (!/\.bmp$/i.test(file.name)) return   // solo BMP (PCX non gestito)
  const reader = new FileReader()
  reader.onload = ev => {
    const img = new Image()
    img.onload = () => {
      const entry = storedImage(filename)
      entry.dataUrl = ev.target.result; entry.img = img
      nextTick(renderCanvas)
    }
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

// ── Canvas rendering ───────────────────────────────────────────────────────

function getScale() {
  const c = canvasContainer.value; if (!c) return 1
  const maxW = c.clientWidth  - 20
  const maxH = c.clientHeight - 20
  return Math.min(maxW / labelDots.w, maxH / labelDots.h, 2)
}

// Canvas = sola etichetta: origine Fingerprint in basso a sinistra, Y verso l'alto
function cx(x, scale) { return x * scale }
function cy(y, scale) { return (labelDots.h - y) * scale }

const AN = {
  1: { a: 'left',   b: 'bottom' },
  2: { a: 'center', b: 'bottom' },
  3: { a: 'right',  b: 'bottom' },
  4: { a: 'left',   b: 'middle' },
  5: { a: 'center', b: 'middle' },
  6: { a: 'right',  b: 'middle' },
  7: { a: 'left',   b: 'top'    },
  8: { a: 'center', b: 'top'    },
  9: { a: 'right',  b: 'top'    },
}

// AN → frazione [fx, fy] dell'oggetto (da sinistra, dal basso) che coincide col PP
function anFrac(align) { const a = (AN[align] ? align : 1) - 1; return [(a % 3) / 2, Math.floor(a / 3) / 2] }
const dirRad = el => ((el.dir || 1) - 1) * Math.PI / 2   // DIR = rotazione oraria di 90° per step
// PX: il PP sta sempre sul lato basso del box, AN sceglie solo sx/centro/dx (verificato su stampa).
// La riga di AN (basso/metà/alto) vale solo per il testo dentro il box.
const boxAlign = el => ({ ...el, align: ((AN[el.align] ? el.align : 1) - 1) % 3 + 1 })

// Sposta l'origine così che il punto AN dell'oggetto w×h (riferimento DIR 1: verso destra e verso l'alto)
// cada sul PP; l'offset ruota con DIR. AN 1 → nessuno spostamento.
function applyAlign(ctx, el, w, h) {
  const [fx, fy] = anFrac(el.align), r = dirRad(el)
  const dx = -fx * w, dy = fy * h
  ctx.translate(dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r))
}

// Righe di un PX con testo: a capo su delimitatore/CR-LF, poi a parola sulla larghezza (max 20 righe).
// Solo sugli spazi: il trattino non spezza ("ALFA BETA-GAMMA" → "ALFA" / "BETA-GAMMA", test-px-a-capo.lbl, 2026-10-28)
function wrapLines(ctx, text, delim, maxW, kx) {
  const out = []
  for (const para of delim ? text.split(delim) : text.split(/\r?\n/)) {
    let line = ''
    for (const word of para.split(/(?<=\s)/)) {
      // lo spazio dopo l'ultima parola non conta (test-mag.lbl: "E PX MAG 2,2" sta in una riga)
      if (line && ctx.measureText((line + word).trimEnd()).width * kx > maxW) { out.push(line.trimEnd()); line = word.trimStart() }
      else line += word
    }
    out.push(line.trimEnd())
  }
  return out.slice(0, 20)
}

const PT_TO_MM = 25.4 / 72  // Fingerprint font size è in punti tipografici
// Larghezza dei font della stampante rispetto al sostituto del PC (fontFallback): a parità di altezza
// "ABCabc0123" a 10 pt misurato su stampa (test-font-1…4.lbl, 2026-10-28; Swiss 721 anche test-mag/test-xor)
const FONT_KX = { 'swiss 721 bt': 0.96, 'swiss 721 bold bt': 0.97, 'swiss 721 bold condensed bt': 0.82,
                  'zurich extra condensed bt': 0.60, 'dutch 801 roman bt': 1.03, 'century schoolbook roman': 1.08,
                  'monospace 821': 1, 'monospace 821 bold': 1, 'letter gothic': 0.84, 'ocr a': 0.99,
                  'ocr b': 1, 'andale mono': 1, 'andale mono bold': 1, 'cg times': 1.03, 'cg times bold': 0.98,
                  'cg triumvirate condensed bold': 0.81, 'univers': 1, 'univers bold': 1.01,
                  'univers condensed bold': 0.82, 'univers extra condensed': 0.60 }
// Vale solo se il font manca sul PC (si usa il sostituto)
const fontKx = name => missingFonts.value.has(name) ? FONT_KX[(name || '').toLowerCase()] ?? 1 : 1
// Font mancante senza sostituto calibrato → testo rosso in anteprima (es. Swiss 721 → Arial è calibrato: nero)
const fontRed = name => missingFonts.value.has(name) && !FONT_KX[(name || '').toLowerCase()]
// Altezza non garantita: font non calibrati e quelli con altezza diversa dal sostituto (CG Triumvirate ~3 dot più alto a 10 pt, test-font-4)
const FONT_TALL = new Set(['cg triumvirate condensed bold'])
const fontHeightNote = name => fontRed(name) || (missingFonts.value.has(name) && FONT_TALL.has((name || '').toLowerCase()))
// Sostituti per categoria
function fontFallback(n) {
  // OCR su Courier New fisso (non "OCR A Extended", presente solo su alcuni PC): FONT_KX è misurato su quello
  if (/ocr|courier|gothic|mono/.test(n)) return '"Courier New",Courier,monospace'
  if (/dutch|roman|rm bt|times|century|schoolbook/.test(n)) return '"Times New Roman",Times,serif'
  return 'Arial,Helvetica,sans-serif'   // Swiss 721 BT, Zurich, Univers, Helvetica Neue, ecc.
}
const fontSubName = name => fontFallback((name || '').toLowerCase()).split(',')[0].replace(/"/g, '')

// Cella del carattere misurata su stampa (Swiss 721, frazioni dell'em = dimensione FT):
// sopra la linea di base 1.1 em, sotto 0.25 em (0.2 fino al 2026-10-28: con MAG 5 la base in stampa era 9 dot più alta, test-mag-errore.lbl)
const CELL_ASC = 1.1, CELL_DESC = 0.25
// AN sul testo: 1-3 fondo cella · 4-6 linea di base · 7-9 cima cella → Y della linea di base (canvas, Y in giù)
function textBaselineY(align, em) {
  const row = Math.floor(((AN[align] ? align : 1) - 1) / 3)
  return row === 0 ? -CELL_DESC * em : row === 1 ? 0 : CELL_ASC * em
}

function fontCss(el, scale) {
  const sizePx = el.fontSize * PT_TO_MM * settings.dotsPerMm * scale
  const n = (el.fontName || '').toLowerCase()
  const name = el.fontName || 'Arial'

  // Peso: da nome font
  const weight = n.includes('black') ? '900'
               : n.includes('bold')  ? '700'
               : '400'

  // Stile: fontSlant != 0 → italic (protocollo Fingerprint)
  const style = el.fontSlant ? 'italic' : 'normal'

  // Fallback per categoria — il nome originale è sempre primo:
  // se il font è installato nel sistema, il browser lo usa direttamente.
  const fallback = fontFallback(n)
  const isMissing = missingFonts.value.has(name)
  const family = isMissing ? fallback : `"${name}",${fallback}`
  return { css: `${style} ${weight} ${sizePx}px ${family}`, sizePx, isMissing }
}

function randomPreviewString(n) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function resolveContent(content, forBarcode = false) {
  return content.map(p => {
    if (p.type === 'literal') return p.value
    if (p.type === 'var') {
      const v = variables.value.find(v => v.index === p.index)
      if (!v) return `[VAR${p.index}]`
      if (v.value) return v.value
      if (forBarcode && v.previewValue) return v.previewValue
      return hideEmpty.value ? '' : `[VAR${p.index}]`   // come la stampante: variabile vuota = niente
    }
    return evalExpr(p.value, p.clock) ?? `[${p.value}]`
  }).join('')
}

function onMaxCharsChange(v) {
  const n = parseInt(v.maxChars)
  if (n > 0) {
    v.previewValue = randomPreviewString(n)
  } else {
    v.maxChars = null
    v.previewValue = null
  }
  barcodeCache.clear()
  renderCanvas()
}

function renderCanvas() {
  const canvas = labelCanvas.value
  if (!canvas || !parsed.value) return

  const scale = getScale()
  const W = Math.round(labelDots.w * scale)
  const H = Math.round(labelDots.h * scale)

  // Ridimensiona solo se le dimensioni sono cambiate: evita il flash bianco
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width  = W
    canvas.height = H
  }

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  // Ri-parse con i barcode in errore: la riga si interrompe come in stampa (dipende dai valori delle variabili)
  const run = parseLayout(layoutSource.value, el => el.type === 'box' ? pxFails(el) : barcodeFails(el))
  // La stampante salva i nomi delle immagini in maiuscolo: un PM con minuscole non trova l'immagine
  const lower = [...new Set(run.elements.filter(e => e.type === 'image').map(imageName).filter(n => n && n !== n.toUpperCase()))]
  parseWarnings.value = [...run.warnings, ...lower.map(n => `Immagine "${n}": in stampante i nomi sono maiuscoli, usa "${n.toUpperCase()}"`)]
  let cur = null   // cursore runtime della stampante (dot)
  const drawn = []
  ctx.save(); ctx.translate(0, -run.feed * scale)   // FORMFEED n: tutta la stampa sale di n dot sull'etichetta
  for (const el of run.elements) {
    const pos = el.follow && cur ? cur : { x: el.x, y: el.y }
    const at  = el.follow && cur ? { ...el, ...cur } : el
    drawn.push(at)
    // II ignora XORMODE: cella nera e testo bianco coprono quello che c'è sotto (verificato su stampa, test-xor.lbl)
    const adv = el.xor && !el.invert ? drawXor(ctx, at, scale) : drawEl(ctx, at, scale)
    const [vx, vy] = DIR_VEC[el.dir] || DIR_VEC[1]
    // avanzamento lungo DIR + salita perpendicolare (verso l'alto in DIR 1, ruotata con DIR)
    cur = adv === null ? pos : { x: pos.x + vx * adv[0] - vy * adv[1], y: pos.y + vy * adv[0] + vx * adv[1] }
  }
  ctx.restore()
  parseWarnings.value.push(...outsideWarnings(drawn))
}

// ── Campi fuori etichetta ──
// Senza CLIP ON un campo che esce dalla finestra di stampa dà errore 1003 (manuale p.24). Conta l'inchiostro, non la cella
// del testo (test-fuori-cella.lbl: cella 6 dot sotto y 0, lettere dentro → stampato, 2026-10-28). Con CLIP ON la stampante
// taglia a x 0 e y 0 (test-clip-on.lbl); a destra la finestra è più larga dell'etichetta (non taglia, ma lì non c'è carta).
// Verifica: ogni oggetto disegnato da solo a 1 px = 1 dot su un canvas con margine, inchiostro nel margine = fuori.
const OUT_M = 150
const OUT_CMD = { text: 'PT', barcode: 'PB', image: 'PM', line: 'PL', box: 'PX' }
// Barcode tagliato su quel lato da CLIP BARCODE …: HEIGHT = altezza delle barre (verificato, test-clip-bc-height.lbl, 2026-11-04),
// INFORMATION = lungo il codice (verificato, test-clip-bc-information.lbl: toglie i caratteri interi, l'editor taglia esatto),
// X / Y = assi dell'etichetta (dal manuale, non verificati). Con DIR 2/4 altezza e lunghezza si scambiano
function bcClipped(el, side) {
  if (el.type !== 'barcode') return false
  const c = el.clipBc || {}, vert = side === 'alto' || side === 'basso', turned = el.dir === 2 || el.dir === 4
  return vert ? !!(c.y || (turned ? c.information : c.height)) : !!(c.x || (turned ? c.height : c.information))
}
function outsideWarnings(els) {
  const W = labelDots.w, H = labelDots.h
  const probe = Object.assign(document.createElement('canvas'), { width: W + 2 * OUT_M, height: H + 2 * OUT_M })
  const pc = probe.getContext('2d', { willReadFrequently: true })
  const inked = (x, y, w, h) => {
    const d = pc.getImageData(x, y, w, h).data
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i] + d[i + 1] + d[i + 2] < 600) return true
    return false
  }
  const out = []
  for (const el of els) {
    // CLIP ON non vale per i barcode (test-clip-bc-on.lbl: errore 1003, 2026-11-03)
    if (el.clip && el.type !== 'barcode') continue
    // Immagini: tagliate al bordo anche senza CLIP, nessun errore (test-img-fuori.lbl, a sinistra, 2026-11-04)
    if (el.type === 'image') continue
    pc.clearRect(0, 0, probe.width, probe.height)
    pc.save(); pc.translate(OUT_M, OUT_M); drawEl(pc, el, 1); pc.restore()
    const sides = [
      inked(0, 0, probe.width, OUT_M) && 'alto',
      inked(0, OUT_M + H, probe.width, OUT_M) && 'basso',
      inked(0, OUT_M, OUT_M, H) && 'sinistra',
      inked(OUT_M + W, OUT_M, OUT_M, H) && 'destra'].filter(s => s && !bcClipped(el, s))
    if (sides.length) out.push(`Riga ${el.line}: ${OUT_CMD[el.type] || el.type} esce dall'etichetta (${sides.join(', ')}): ` +
      (sides.every(s => s === 'destra') ? 'in stampa tagliato'
        : el.type === 'barcode' ? 'errore 1003 in stampa (per i barcode serve CLIP BARCODE HEIGHT/INFORMATION ON)' : 'senza CLIP ON errore 1003 in stampa'))
  }
  return [...new Set(out)]
}

// XORMODE ON: il campo si disegna su un livello bianco, si inverte (inchiostro = bianco) e si unisce con
// `difference`: dove c'era bianco esce nero, dove c'era già nero esce bianco (manuale p.24)
function drawXor(ctx, el, scale) {
  const layer = document.createElement('canvas')
  layer.width = ctx.canvas.width; layer.height = ctx.canvas.height
  const lc = layer.getContext('2d')
  lc.fillStyle = '#fff'; lc.fillRect(0, 0, layer.width, layer.height)
  lc.setTransform(ctx.getTransform())   // FORMFEED
  const adv = drawEl(lc, el, scale)
  lc.resetTransform()
  lc.globalCompositeOperation = 'difference'; lc.fillRect(0, 0, layer.width, layer.height)
  ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.drawImage(layer, 0, 0); ctx.restore()
  return adv
}

// PX con testo multi-riga: AN posiziona il box sul PP e allinea il testo dentro il box (manuale p.22, 40).
// Disegnato nel riferimento DIR 1 e poi ruotato con DIR.
function drawTextBox(ctx, el, scale) {
  const w = el.width * scale, h = el.height * scale, t = el.thickness * scale
  const [fx, fy] = anFrac(el.align)
  ctx.rotate(dirRad(el))
  ctx.translate(-fx * w, 0)                 // box: x 0…w, y −h…0 (PP sul lato basso, vedi boxAlign)
  if (t > 0) {
    ctx.strokeStyle = '#000'; ctx.lineWidth = t
    ctx.strokeRect(t / 2, -h + t / 2, w - t, h - t)
  }
  ctx.fillStyle = fontRed(el.fontName) ? '#dc2626' : '#000'
  ctx.textAlign = AN[el.align]?.a || 'left'; ctx.textBaseline = 'alphabetic'
  const { lines, kx, ky, em, lineH, gap, inH, inV, frameW, frameH, blockH } = pxText(ctx, el, scale)
  const x0 = inH + fx * frameW
  const y0 = -h + inV + (1 - fy) * (frameH - blockH)   // cima del blocco di righe
  lines.forEach((line, i) => {
    ctx.save()
    ctx.translate(x0, y0 + i * (lineH + gap) + PX_ASC * em); ctx.scale(kx, ky)
    ctx.fillText(line, 0, 0)
    ctx.restore()
  })
}

// Righe del testo di un PX (misure in px canvas). Riga alta PX_LINE em, base a PX_ASC em dalla cima, vOff fra le righe
// (test-px-a-capo.lbl, 8 pt: passo 47 dot = 1.28 em + 4, cima maiuscole 10 dot sotto la cornice, 2026-10-28)
const PX_LINE = 1.28, PX_ASC = 1.0
function pxText(ctx, el, scale) {
  const t = el.thickness * scale
  const { css, sizePx } = fontCss(el, scale)
  const kx = (el.fontWidth || 100) / 100 * (el.magW || 1) * fontKx(el.fontName), ky = el.magH || 1   // larghezza %, MAG, font
  const em = sizePx * ky, lineH = PX_LINE * em, gap = el.vOff * scale
  ctx.font = css
  // Cornice del testo: bordo interno + offset; vOff è anche lo spazio fra le righe
  const inH = t + el.hOff * scale, inV = t + el.vOff * scale
  const frameW = el.width * scale - 2 * inH, frameH = el.height * scale - 2 * inV
  const lines = wrapLines(ctx, resolveContent(el.content), el.delim, frameW, kx)
  const blockH = lines.length * lineH + (lines.length - 1) * gap
  return { lines, kx, ky, em, lineH, gap, inH, inV, frameW, frameH, blockH }
}

// PX con testo che in stampa non esce (errore, test-px-parola-lunga.lbl e test-px-troppo-testo.lbl, 2026-10-28):
// una parola più larga della cornice, oppure righe che non entrano in altezza contando la cella intera
// (CELL_ASC + CELL_DESC: 3 righe a 8 pt in PX 150 → errore, in PX 220 → ok). Dato non noto ([VARn], espressioni) = stampabile
function pxFails(el) {
  const text = resolveContent(el.content)
  if (!text || /\[(VAR\d+|expr)\]/.test(text)) return false
  const ctx = document.createElement('canvas').getContext('2d')
  const { lines, kx, ky, em, gap, frameW, frameH } = pxText(ctx, el, 1)
  if (lines.some(l => ctx.measureText(l).width * kx > frameW + 0.5)) return 'parola più larga del box'
  // Altezza senza MAG: test-mag.lbl (MAG 2,2, 3 righe da 6 pt in PX 170) è stampato anche se ingrandito non entra
  if (lines.length * (CELL_ASC + CELL_DESC) * em / ky + (lines.length - 1) * gap > frameH) return 'testo più alto del box'
  return false
}

// Disegna un oggetto; ritorna di quanti dot avanza il cursore lungo DIR (null = non avanza)
// Barcode che in stampa dà errore. Dato non ancora noto ([VARn], espressioni) o bwip-js non caricato: si assume stampabile
function barcodeFails(el) {
  const t = resolveContent(el.content, true)
  if (!t || t.startsWith('[')) return false
  if (!getBwip(el.barcodeType)) return true   // tipo che la stampante non stampa (MAXICODE, UPCD1–5, QTCODE, …)
  return !!bwipjsLib && !barcodeImage(el, t).offCanvas
}

// Immagine del barcode (dot, cache): null = non stampabile (tipo non gestito, dato non valido, PDF417 che non entra).
// Usata dal disegno e dal parser per simulare l'interruzione della riga dopo un errore
function barcodeImage(el, bcText) {
  const bw_   = getBwip(el.barcodeType)
  const bcid  = bw_?.bcid
  // Modulo (barra stretta / cella 2D) in dot = BM. BR/narrow è solo il rapporto larghe:strette
  // (verificato su stampa: BR 4,2 + BM 4 → CODE128 a 4 dot per modulo) → bwipScale = dot per modulo.
  // POSTNET ha misura fissa (22 barre/pollice, alte 1/8"): non dipende da BM né da BH
  const bwipScale = bcid === 'postnet' ? Math.max(1, Math.round(settings.dotsPerMm / 3))
                                      : Math.max(1, Math.round(el.barcodeMag || 1))
  const inclText = !!el.barFont && BWIP_INCLTEXT.has(bcid)
  const isAddon  = bcid === 'ean2' || bcid === 'ean5'
  const cacheKey = `${el.barcodeType}|${bcText}|${bwipScale}|${el.barcodeHeight}|${(el.barcodeParams || []).join(',')}` +
                   `|${el.barcodeWide}/${el.barcodeNarrow}|${inclText}`
  if (barcodeCache.has(cacheKey)) return { offCanvas: barcodeCache.get(cacheKey), bw_, bcid, bwipScale, inclText, isAddon }
  let offCanvas = null
  if (CUSTOM_BARS[bcid] && bcText && !bcText.startsWith('[')) {
    offCanvas = CUSTOM_BARS[bcid](bcText, el, bwipScale)
    barcodeCache.set(cacheKey, offCanvas)
  }
  if (!offCanvas && bcid && bwipjsLib && bcText && !bcText.startsWith('[')) {
    try {
      offCanvas = document.createElement('canvas')
      // height bwip-js in mm a 72 dpi × scale → altezza barre = barcodeHeight dot (solo lineari)
      const opts = { bcid, text: bcText, scale: bwipScale, padding: 0, ...bw_.opts }
      const p = el.barcodeParams || []
      if (bcid === 'pdf417') {
        // Stampante: colonne [8] valide 1–30 altrimenti 1, righe [7] valide 3–90, sicurezza [4] default 2,
        // altezza BARSET = altezza riga in dot (verificato su stampa: righe 32 + colonne 32 → 1 colonna, 173×191)
        Object.assign(opts, { columns: p[8] >= 1 && p[8] <= 30 ? p[8] : 1, eclevel: Number.isInteger(p[4]) ? p[4] : 2,
          rowmult: Math.max(1, Math.round((el.barcodeHeight || 6) / bwipScale)) })
        if (p[7] >= 3 && p[7] <= 90) opts.rows = p[7]
        // Colonne fissate senza righe: la stampante non stampa (verificato su stampa, colonne 3 righe 0)
        else if (p[8] >= 1 && p[8] <= 30) throw new Error('PDF417: colonne senza righe')
      } else if (bcid === 'upce') {
        // Stampante: solo le 6 cifre compresse, sistema 0 e cifra di controllo aggiunti da lei; 7, 8, 11, 12 cifre → errore
        // (verificato su stampa, test-upce.lbl, 2026-10-27: "425261" → 0 425261 4)
        if (!/^\d{6}$/.test(bcText)) throw new Error('UPCE: servono 6 cifre')
        opts.text = '0' + bcText
        opts.height = (el.barcodeHeight || 100) / bwipScale * 25.4 / 72
      } else if (bcid === 'datamatrix') {
        const [size, cap] = dmSize(bcText, p[5]) ?? []
        if (size) opts.rows = opts.columns = size
        // Dimensione forzata troppo piccola: la stampante stampa comunque quel formato (dato troncato)
        while (cap && opts.text.length > 1 && dmCodewords(opts.text) > cap) opts.text = opts.text.slice(0, -1)
      } else if (!BWIP_2D.has(bcid) && !BWIP_STACKED.has(bcid) && bcid !== 'postnet')
        opts.height = (el.barcodeHeight || 100) / bwipScale * 25.4 / 72
      const eanGuard = BWIP_INCLTEXT.has(bcid) && !isAddon && !inclText
      if ((inclText && !isAddon) || eanGuard) opts.includetext = true   // add-on: cifre disegnate a parte (addonDigits)
      // Aztec: la stampante usa il formato compatto se il dato ci sta (test-aztec.lbl, 2026-10-28: "ABC123" = 15×15
      // uguale a bwip-js compact), bwip-js da solo sceglie il pieno 19×19
      if (bcid === 'azteccode') opts.format = 'compact'
      try { bwipjsLib.toCanvas(offCanvas, opts) }
      catch (e) { if (bcid !== 'azteccode') throw e; delete opts.format; bwipjsLib.toCanvas(offCanvas, opts) }
      if (eanGuard) offCanvas = eanGuards(offCanvas, el.barcodeHeight || 100, 6 * bwipScale)
      if (isAddon) {   // bwip-js fa le barre di ean2/ean5 più alte di height: in stampa sono alte BH (test-addon-qr.lbl)
        const c = Object.assign(document.createElement('canvas'), { width: offCanvas.width, height: el.barcodeHeight || 100 })
        c.getContext('2d').drawImage(offCanvas, 0, offCanvas.height - 1, offCanvas.width, 1, 0, 0, c.width, c.height)
        offCanvas = c
      }
      // PDF417 con righe fissate in cui il dato non entra: bwip-js aggiunge righe, la stampante non stampa nulla
      if (bcid === 'pdf417' && opts.rows && offCanvas.height / (bwipScale * opts.rowmult) > opts.rows + 0.5)
        throw new Error('PDF417: dato troppo lungo per le righe indicate')
      barcodeCache.set(cacheKey, offCanvas)
    } catch { offCanvas = null; barcodeCache.set(cacheKey, null) }
  }
  return { offCanvas, bw_, bcid, bwipScale, inclText, isAddon }
}

function drawEl(ctx, el, scale) {
  let len = null   // lunghezza dell'oggetto lungo la direzione, in px canvas
  let rise = 0     // spostamento del cursore perpendicolare alla direzione (verso l'alto in DIR 1), in dot
  ctx.save()
  ctx.translate(cx(el.x, scale), cy(el.y, scale))

  if (el.type === 'text') {
    const { css, sizePx } = fontCss(el, scale)
    const anInfo   = AN[el.align] || AN[1]
    const isMissing = fontRed(el.fontName)
    ctx.font        = css
    ctx.fillStyle    = isMissing ? '#dc2626' : '#000'
    ctx.textAlign    = anInfo.a
    ctx.textBaseline = 'alphabetic'
    ctx.rotate(dirRad(el))   // DIR 2/3/4: testo ruotato in senso orario attorno al PP
    const kx = (el.magW || 1) * (el.fontWidth || 100) / 100 * fontKx(el.fontName)
    ctx.scale(kx, el.magH || 1)   // MAG, larghezza % e font stampante (la cella si ingrandisce con il testo)
    const yBase = textBaselineY(el.align, sizePx)
    const text  = resolveContent(el.content)
    len = ctx.measureText(text).width * kx
    if (el.invert && text) {   // II: cella del testo nera, testo bianco
      const w = ctx.measureText(text).width
      const x0 = anInfo.a === 'right' ? -w : anInfo.a === 'center' ? -w / 2 : 0
      ctx.fillStyle = '#000'
      ctx.fillRect(x0, yBase - CELL_ASC * sizePx, w, (CELL_ASC + CELL_DESC) * sizePx)
      ctx.fillStyle = '#fff'
    }
    ctx.fillText(text, 0, yBase)
    // Sottolineatura tratteggiata rossa per font mancanti
    if (isMissing) {
      const metrics = ctx.measureText(resolveContent(el.content))
      const w = metrics.width
      ctx.save()
      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth   = Math.max(1, scale * 0.6)
      ctx.setLineDash([3 * scale, 2 * scale])
      const yOff = yBase + 2
      const xOff = anInfo.a === 'right' ? -w : anInfo.a === 'center' ? -w / 2 : 0
      ctx.beginPath(); ctx.moveTo(xOff, yOff); ctx.lineTo(xOff + w, yOff); ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

  } else if (el.type === 'line') {
    ctx.fillStyle = '#000'
    const len   = el.length    * scale
    const thick = Math.max(1, el.thickness * scale)
    applyAlign(ctx, boxAlign(el), len, thick)   // come i box: PP sul lato basso (verificato su stampa)
    ctx.rotate(dirRad(el))   // DIR 1 destra · 2 giù · 3 sinistra · 4 su
    ctx.fillRect(0, -thick, len, thick)

  } else if (el.type === 'box' && el.content) {
    drawTextBox(ctx, el, scale)

  } else if (el.type === 'box') {
    ctx.strokeStyle = '#000'
    ctx.lineWidth   = Math.max(1, el.thickness * scale)
    const bxW = el.width * scale, bxH = el.height * scale
    applyAlign(ctx, boxAlign(el), bxW, bxH)
    // width lungo la direzione, height perpendicolare; rotazione oraria DIR (verificato su stampa)
    ctx.rotate(dirRad(el))
    const t = ctx.lineWidth   // bordo tutto dentro le dimensioni, come in drawTextBox
    if (2 * t >= Math.min(bxW, bxH)) { ctx.fillStyle = '#000'; ctx.fillRect(0, -bxH, bxW, bxH) }  // box pieno
    else ctx.strokeRect(t / 2, -bxH + t / 2, bxW - t, bxH - t)

  } else if (el.type === 'barcode') {
    const bcText = resolveContent(el.content, true)
    const { offCanvas, bw_, bcid, bwipScale, inclText, isAddon } = barcodeImage(el, bcText)
    if (offCanvas) {
      const k  = BWIP_2PX.has(bcid) ? 2 : 1
      // CODE16K/CODE49: bwip-js ha righe da almeno 8 moduli; in stampa ogni riga è alta BH dot
      const stackRows = BWIP_STACKED.has(bcid) ? Math.round((offCanvas.height / bwipScale - 1) / 9) : 0
      const bh = stackRows ? stackRows * (el.barcodeHeight || 8) * scale : offCanvas.height / k * scale
      const bw = offCanvas.width  / k * scale * bw_.sx
      // includetext (EAN/UPC): le barre stanno sul PP, le cifre fuori dalle barre sporgono a sx/dx
      let x0 = 0, barsW = bw
      if (inclText) {
        const row = offCanvas.getContext('2d').getImageData(0, isAddon ? offCanvas.height - 1 : 0, offCanvas.width, 1).data
        const dark = [...Array(offCanvas.width).keys()].filter(i => row[i * 4 + 3] > 0 && row[i * 4] < 128)
        if (dark.length) { x0 = dark[0] * scale; barsW = (dark.at(-1) - dark[0] + 1) * scale }
      }
      ctx.imageSmoothingEnabled = false
      // BF ON: testo = dato del barcode allineato a sx (verificato su stampa).
      // Lineari, DataMatrix/QR/Aztec: sotto il simbolo, campo = simbolo + offset + cella testo, AN vale per tutto il campo.
      // PLESSEY: testo sopra le barre (barre sul PP). PDF417: testo sotto il PP, fuori dal campo; cursore a fine barre.
      // EAN/UPC/add-on: interpretazione standard di bwip-js (inclText)
      // Aztec: BF ON non stampa testo, cursore a fine simbolo (test-aztec.lbl)
      const bf  = el.barFont && !inclText && bcid !== 'azteccode' ? el.barFont : null
      const bfMode = !bf ? null : bcid === 'plessey' ? 'above' : bcid === 'pdf417' ? 'pdf' : 'below'
      // Ingrandimento barfont: parametri mag di BF × MAG globale (manuale: MAG vale anche per il barfont)
      // Barfont senza FONT_KX: in stampa "ABC123" Swiss 721 BT 8 pt è largo come Arial (+2%), non il 5% più stretto dei PT (test-addon-qr.lbl)
      const bfMagH = bf ? (bf.magH || 1) * (el.magH || 1) : 1, bfMagW = bf ? (bf.magW || 1) * (el.magW || 1) : 1
      const bfEm = bf ? bf.size * PT_TO_MM * settings.dotsPerMm * scale * bfMagH : 0
      const bfCell = bf ? bf.offset * scale + (CELL_ASC + CELL_DESC) * bfEm : 0
      // EAN/UPC con BF ON: sotto le cifre resta uno spazio di ~3.5 moduli fino al PP (verificato su stampa)
      const eanGap = inclText && !isAddon ? Math.round(3.5 * bwipScale) * scale : 0
      const fieldH = bfMode === 'below' || bfMode === 'above' ? bh + bfCell : bh + eanGap
      applyAlign(ctx, el, barsW, fieldH)
      // Lato-L (angolo in basso a sx in DIR 1) sul PP, poi rotazione oraria DIR (verificato su stampa):
      // DIR 1 destra-su · 2 destra-giù · 3 sinistra-giù · 4 sinistra-su
      ctx.rotate(dirRad(el))
      const barsY = bfMode === 'below' ? -fieldH : -bh - eanGap
      ctx.drawImage(offCanvas, -x0, barsY, bw, bh)
      if (BEARER.has((el.barcodeType || '').toUpperCase())) {   // cornice spessa 2 moduli (DUN, UPCSCC)
        const t = 2 * bwipScale * scale
        ctx.strokeStyle = '#000'; ctx.lineWidth = t
        ctx.strokeRect(t / 2, barsY + t / 2, bw - t, bh - t)
      }
      len = barsW
      // Cursore (verificato su stampa, test-cursore-ean.lbl): EAN/UPC non avanzano mai lungo DIR;
      // con BF ON salgono al fondo delle barre corte (sopra le cifre). Add-on con BF ON: fine delle cifre,
      // riga del testo sopra le barre; con BF OFF fine barre come gli altri lineari
      if (BWIP_INCLTEXT.has(bcid) && !isAddon) {
        len = 0
        if (inclText) rise = eanGap / scale + offCanvas.height - (el.barcodeHeight || 100)
      } else if (inclText) {
        const pitch = addonDigits(ctx, bcText, el.barcodeHeight || 100, bwipScale, scale)
        len = bcText.length * pitch * scale
        rise = (el.barcodeHeight || 100) + 7
      }
      if (bf) {
        const bfText = (el.barcodeType || '').toUpperCase() === 'SCCADDON' ? bcText + i25Check(bcText) : bcText
        ctx.font = fontCss({ fontName: bf.name, fontSize: bf.size, fontSlant: bf.slant }, scale).css
        const bfMissing = fontRed(bf.name)   // font barfont mancante: rosso + tratteggio, come i PT
        ctx.fillStyle = bfMissing ? '#dc2626' : '#000'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
        const baseY = bfMode === 'above' ? -bh - bf.offset * scale - CELL_DESC * bfEm
                    : bfMode === 'pdf'   ? bf.offset * scale + CELL_ASC * bfEm : -CELL_DESC * bfEm
        ctx.save(); ctx.translate(0, baseY); ctx.scale(bfMagW, bfMagH)
        ctx.fillText(bfText, 0, 0)
        if (bfMissing) {
          ctx.strokeStyle = '#dc2626'; ctx.lineWidth = Math.max(1, scale * 0.6) / bfMagH
          ctx.setLineDash([3 * scale, 2 * scale])
          ctx.beginPath(); ctx.moveTo(0, 2 / bfMagH); ctx.lineTo(ctx.measureText(bfText).width, 2 / bfMagH); ctx.stroke()
        }
        ctx.restore()
        // con BF ON il cursore va a fine testo, anche in altezza (PLESSEY: riga del testo sopra le barre)
        if (bfMode !== 'pdf') len = ctx.measureText(bfText).width * bfMagW
        if (bfMode === 'above') rise = bh / scale + bf.offset
      }
    } else if (!(hideEmpty.value && !bcText)) {
      // Fallback placeholder (nascosto se il dato è vuoto e "Nascondi variabili vuote" è attivo)
      const mag = el.barcodeMag || 1
      const sz  = Math.max(30, 50 * mag * 0.15) * scale
      len = sz
      applyAlign(ctx, { ...el, dir: 1 }, sz, sz)   // il segnaposto non ruota
      ctx.fillStyle   = '#f7f7f7'
      ctx.strokeStyle = '#999'
      ctx.lineWidth   = 1
      ctx.fillRect(0, -sz, sz, sz)
      ctx.strokeRect(0, -sz, sz, sz)
      ctx.fillStyle = '#bbb'
      const cell = sz / 8
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if ((r + c) % 2 === 0) ctx.fillRect(c * cell, -sz + r * cell, cell, cell)
      ctx.fillStyle    = 'rgba(0,0,0,0.55)'
      ctx.font         = `bold ${Math.max(7, 8 * scale)}px Arial`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.barcodeType || 'BC', sz / 2, -sz / 2)
    }

  } else if (el.type === 'image') {
    const name  = imageName(el)
    const entry = name && imageStore.get(name)
    if (entry?.img) {
      // 1 pixel del BMP = 1 dot stampante (× MAG); convertiamo in canvas pixels
      const imgW = entry.img.naturalWidth  * (el.magW || 1) * scale
      const imgH = entry.img.naturalHeight * (el.magH || 1) * scale
      ctx.imageSmoothingEnabled = false
      // La stampante ruota il BMP con DIR come ogni altro oggetto (verificato su stampa)
      applyAlign(ctx, el, imgW, imgH)
      ctx.rotate(dirRad(el))
      ctx.drawImage(entry.img, 0, -imgH, imgW, imgH)
      len = imgW
    } else if (!(hideEmpty.value && !name)) {   // logo variabile vuoto: niente
      const w = 80 * scale, h = 28 * scale
      len = w
      applyAlign(ctx, { ...el, dir: 1 }, w, h)   // il segnaposto non ruota
      ctx.fillStyle   = '#f9f9f9'
      ctx.strokeStyle = '#bbb'
      ctx.setLineDash([3, 2])
      ctx.lineWidth   = 1
      ctx.fillRect(0, -h, w, h)
      ctx.strokeRect(0, -h, w, h)
      ctx.setLineDash([])
      ctx.fillStyle    = '#aaa'
      ctx.font         = `${Math.max(7, 7 * scale)}px Arial`
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(name ? name.replace(/\.[^.]+$/, '') : resolveContent(el.content), 3, -h / 2)   // es. [VAR21]
    }
  }

  ctx.restore()
  // Testo, barcode e immagini spostano il cursore sul loro bordo finale lungo DIR; linee e box no (verificato su stampa)
  return len === null ? null : [(1 - anFrac(el.align)[0]) * len / scale, rise]
}

// Vettore unitario della direzione di stampa in coordinate Fingerprint (Y in su)
const DIR_VEC = { 1: [1, 0], 2: [0, -1], 3: [-1, 0], 4: [0, 1] }

// ── Aggiornamento canvas ──────────────────────────────────────────────────
// Il canvas si ridisegna solo su:
//   1. Cambio sorgente (debounce 450ms in onSourceInput)
//   2. Cambio valore variabile (@value-changed="renderCanvas")
//   3. Import immagine
//   4. Ridimensionamento finestra browser (debounce 300ms)

let resizeTimer = null
function onWindowResize() {
  if (!parsed.value) return
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(renderCanvas, 300)
}

onMounted(() => {
  applySettings()
  window.addEventListener('resize', onWindowResize)
  loadBwipJs().then(() => { if (parsed.value) renderCanvas() })
})
onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  clearTimeout(parseTimer)
  clearTimeout(resizeTimer)
})
</script>

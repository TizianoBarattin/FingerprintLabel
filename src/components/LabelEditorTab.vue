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
      <div class="flex flex-column gap-1" style="width: 800px; min-width: 500px">
        <div class="section-label">
          <i class="pi pi-code mr-1"></i>Sorgente
        </div>
        <textarea
          v-model="layoutSource"
          class="source-editor"
          placeholder="Incolla o importa un layout Fingerprint..."
          spellcheck="false"
          @input="onSourceInput"
        />
        <div v-if="parseWarnings.length" class="text-xs text-orange-500 mt-1">
          <i class="pi pi-exclamation-triangle mr-1"></i>{{ parseWarnings.length }} avvisi parser
        </div>
        <div v-if="missingFonts.size" class="missing-fonts-box mt-1">
          <div class="flex align-items-center gap-1 mb-1">
            <i class="pi pi-times-circle" style="color:#dc2626;font-size:11px"></i>
            <span style="color:#dc2626;font-weight:700;font-size:11px">Font non installati</span>
          </div>
          <div v-for="f in [...missingFonts]" :key="f" class="missing-font-row">
            {{ f }}
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
        <!-- Font mancanti -->
        <div v-if="missingFonts.size" class="flex flex-column gap-1">
          <div class="section-label" style="color:#b91c1c">
            <i class="pi pi-exclamation-circle mr-1"></i>Font non installati
          </div>
          <div v-for="fn in [...missingFonts]" :key="fn" class="text-xs text-red-600">{{ fn }}</div>
        </div>

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
              :placeholder="v.label ? v.label + '...' : 'Valore...'"
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
              accept="image/*,.bmp,.BMP"
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
import { ref, reactive, nextTick, onMounted, onUnmounted } from 'vue'
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

function splitStmt(line) {
  const parts = []; let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"')             { inQ = !inQ; cur += ch }
    else if (ch === ':' && !inQ) { parts.push(cur.trim()); cur = '' }
    else                          { cur += ch }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function splitSemi(str) {
  const parts = []; let cur = '', inQ = false
  for (const ch of str) {
    if (ch === '"')             { inQ = !inQ; cur += ch }
    else if (ch === ';' && !inQ) { parts.push(cur.trim()); cur = '' }
    else                          { cur += ch }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function parseContent(raw) {
  return splitSemi(raw).filter(s => s !== '').map(s => {
    const vm = s.match(/^VAR(\d+)\$$/i)
    if (vm) return { type: 'var', index: parseInt(vm[1]) }
    if (s.startsWith('"') && s.endsWith('"')) return { type: 'literal', value: s.slice(1, -1) }
    return { type: 'expr', value: s }
  })
}

function parseLayout(source) {
  const result = { layoutName: null, charset: 'UTF-8', clip: false, elements: [], warnings: [] }
  const st = { fontName: 'Swiss 721 BT', fontSize: 8, fontSlant: 0, fontWidth: 100,
               x: 0, y: 0, dir: 1, align: 1, barcodeType: null, barcodeParams: [],
               barcodeNarrow: 1, barcodeMag: 2, barcodeHeight: 100 }  // default manuale §3.4
  let m
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith("'")) continue
    for (const stmt of splitStmt(line)) {
      const s = stmt.trim(); if (!s) continue
      if ((m = s.match(/^LAYOUT\s+INPUT\s+"([^"]+)"/i))) { result.layoutName = m[1]; continue }
      if (/^LAYOUT\s+(END|RUN)/i.test(s)) continue
      if (/^CLL$/i.test(s)) continue
      if ((m = s.match(/^NASC\s+"([^"]+)"/i)))    { result.charset = m[1]; continue }
      if ((m = s.match(/^CLIP\s+(ON|OFF)/i)))      { result.clip = m[1].toUpperCase() === 'ON'; continue }
      if ((m = s.match(/^DIR\s*(\d)/i)))           { st.dir = parseInt(m[1]); continue }
      if ((m = s.match(/^AN\s*(\d)/i)))            { st.align = parseInt(m[1]); continue }
      if ((m = s.match(/^(?:PP|PRPOS)\s*(\d+)\s*,\s*(\d+)/i))) { st.x = parseInt(m[1]); st.y = parseInt(m[2]); continue }
      if ((m = s.match(/^FT\s*"([^"]+)"(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?/i))) {
        st.fontName = m[1]; st.fontSize = m[2] ? parseInt(m[2]) : 8
        // FT "<font>",<size pt>,<slant °>,<width %> (manuale p.25)
        st.fontSlant = m[3] ? parseInt(m[3]) : 0; st.fontWidth = m[4] ? parseInt(m[4]) : 100; continue
      }
      if ((m = s.match(/^PT\s*(.*)/i))) {
        result.elements.push({ type: 'text', x: st.x, y: st.y, dir: st.dir, align: st.align,
          fontName: st.fontName, fontSize: st.fontSize, fontSlant: st.fontSlant, fontWidth: st.fontWidth,
          content: parseContent(m[1].trim()) }); st.align = 1; continue
      }
      if ((m = s.match(/^PB\s*(.*)/i))) {
        result.elements.push({ type: 'barcode', x: st.x, y: st.y, dir: st.dir, align: st.align,
          barcodeType: st.barcodeType, barcodeParams: [...st.barcodeParams],
          barcodeNarrow: st.barcodeNarrow, barcodeMag: st.barcodeMag, barcodeHeight: st.barcodeHeight,
          content: parseContent(m[1].trim()) }); st.align = 1; continue
      }
      if ((m = s.match(/^PM\s*"([^"]+)"/i))) {
        result.elements.push({ type: 'image', x: st.x, y: st.y, dir: st.dir, align: st.align, filename: m[1] }); st.align = 1; continue
      }
      if ((m = s.match(/^(?:PL|PRLINE)\s*(\d+)\s*,\s*(\d+)/i))) {
        result.elements.push({ type: 'line', x: st.x, y: st.y, dir: st.dir, align: st.align,
          length: parseInt(m[1]), thickness: parseInt(m[2]) }); st.align = 1; continue
      }
      if ((m = s.match(/^(?:PX|PRBOX)\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i))) {
        result.elements.push({ type: 'box', x: st.x, y: st.y, dir: st.dir, align: st.align,
          height: parseInt(m[1]), width: parseInt(m[2]), thickness: parseInt(m[3]) }); st.align = 1; continue
      }
      if ((m = s.match(/^BARSET\s*"([^"]+)"(?:\s*,\s*(.+))?/i))) {
        st.barcodeType = m[1]
        st.barcodeParams = m[2] ? m[2].split(',').map(p => { p = p.trim(); return isNaN(p) ? p : parseInt(p) }) : []
        // [0] wide, [1] narrow, [2] mag, [3] height: l'ultimo tra BARSET e BM/BR/BH vince
        const [, narrow, mag, height] = st.barcodeParams
        if (Number.isInteger(narrow)) st.barcodeNarrow = narrow
        if (Number.isInteger(mag))    st.barcodeMag    = mag
        if (Number.isInteger(height)) st.barcodeHeight = height
        continue
      }
      if ((m = s.match(/^(?:BM|BARMAG)\s*(\d+)/i)))    { st.barcodeMag = parseInt(m[1]); continue }
      if ((m = s.match(/^(?:BH|BARHEIGHT)\s*(\d+)/i))) { st.barcodeHeight = parseInt(m[1]); continue }
      if ((m = s.match(/^(?:BR|BARRATIO)\s*\d+\s*,\s*(\d+)/i))) { st.barcodeNarrow = parseInt(m[1]); continue }
      if (/^BF\s+(ON|OFF)/i.test(s)) continue
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
const parsed        = ref(null)
const parseWarnings = ref([])
const variables     = ref([])   // { index, label, value }
const images        = ref([])   // { filename, dataUrl, img }

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
  'DATAMATRIX': 'datamatrix', 'GS1DATAMATRIX': 'gs1datamatrix',
  'CODE128': 'code128', 'CODE128A': 'code128', 'CODE128B': 'code128', 'CODE128C': 'code128',
  'CODE39': 'code39', 'CODE93': 'code93',
  'EAN13': 'ean13', 'EAN8': 'ean8', 'EAN128': 'gs1-128',
  'GS1-128': 'gs1-128', 'GS1128': 'gs1-128',
  'UPCA': 'upca', 'UPCE': 'upce',
  'PDF417': 'pdf417', 'MICROPDF417': 'micropdf417',
  'AZTEC': 'azteccode', 'QRCODE': 'qrcode', 'QR': 'qrcode',
  'I2OF5': 'interleaved2of5', 'INT2OF5': 'interleaved2of5',
}
function getBcid(t) { return t ? (BCID_MAP[(t || '').toUpperCase()] || 'code128') : 'code128' }
// bwip-js disegna questi 2D a 2 px per modulo (a scale 1), i lineari e PDF417 a 1 px
const BWIP_2PX = new Set(['datamatrix', 'gs1datamatrix', 'qrcode', 'azteccode'])
const BWIP_2D  = new Set([...BWIP_2PX, 'pdf417', 'micropdf417'])  // niente BH/height

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
  buildImages()
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
      images.value = []
      missingFonts.value = new Set()
    }
  }, 450)
}

// ── Verifica font installati ──────────────────────────────────────────────

async function checkFonts() {
  const names = [...new Set(
    parsed.value.elements
      .filter(e => e.type === 'text')
      .map(e => e.fontName)
      .filter(Boolean)
  )]
  const missing = new Set()
  for (const name of names) {
    // document.fonts.check richiede dimensione + famiglia
    const available = document.fonts.check(`16px "${name}"`)
    if (!available) missing.add(name)
  }
  missingFonts.value = missing
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
        if (!map[p.index]) map[p.index] = {
          index: p.index, label: lastLit || '', value: '',
          fixedLabel: FIXED_VAR_LABELS[p.index] ?? null,
          isBarcodeVar: false, barcodeType: null, maxChars: null, previewValue: null
        }
        if (el.type === 'barcode') {
          map[p.index].isBarcodeVar = true
          if (!map[p.index].barcodeType) map[p.index].barcodeType = el.barcodeType
        }
        lastLit = ''
      }
    }
  }
  const prev = Object.fromEntries(variables.value.map(v => [v.index, v]))
  variables.value = Object.values(map).sort((a, b) => a.index - b.index).map(v => ({
    ...v,
    label: prev[v.index]?.label ?? v.label,
    value: prev[v.index]?.value ?? '',
    maxChars: prev[v.index]?.maxChars ?? null,
    previewValue: prev[v.index]?.previewValue ?? null,
  }))
}

// ── Immagini ───────────────────────────────────────────────────────────────

function buildImages() {
  const names = [...new Set(
    parsed.value.elements.filter(e => e.type === 'image').map(e => e.filename)
  )]
  const prev = Object.fromEntries(images.value.map(i => [i.filename, i]))
  images.value = names.map(f => prev[f] ?? { filename: f, dataUrl: null, img: null })
}

// ── Import variabili JSON ──────────────────────────────────────────────────

function onVarsFile(e) {
  const file = e.target.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result)
      if (Array.isArray(data)) {
        data.forEach(item => {
          const v = variables.value.find(v => v.index === item.index)
          if (v) { v.value = item.value ?? ''; if (item.label) v.label = item.label }
        })
      } else {
        Object.entries(data).forEach(([k, val]) => {
          const idx = parseInt(k.replace(/^VAR/i, ''))
          const v = variables.value.find(v => v.index === idx)
          if (v) v.value = String(val)
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
  const data = variables.value.map(v => ({ index: v.index, label: v.label, value: v.value }))
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
  const reader = new FileReader()
  reader.onload = ev => {
    const img = new Image()
    img.onload = () => {
      const entry = images.value.find(i => i.filename === filename)
      if (entry) { entry.dataUrl = ev.target.result; entry.img = img }
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

const PT_TO_MM = 25.4 / 72  // Fingerprint font size è in punti tipografici

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
  let fallback
  if (n.includes('ocr'))
    fallback = '"OCR A Extended","OCR B","Courier New",monospace'
  else if (n.includes('courier') || n.includes('letter gothic') || n.includes('gothic'))
    fallback = '"Courier New",Courier,monospace'
  else if (n.includes('dutch') || n.includes('roman') || n.includes('rm bt') || n.includes('times'))
    fallback = '"Times New Roman",Times,serif'
  else
    // Swiss 721 BT, Univers, Helvetica Neue, ecc. → sans-serif
    fallback = 'Helvetica,Arial,sans-serif'

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
      if (!forBarcode) return `[VAR${p.index}]`
      return `[VAR${p.index}]`
    }
    return `[${p.value}]`
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

  for (const el of parsed.value.elements) {
    drawEl(ctx, el, scale)
  }
}

function drawEl(ctx, el, scale) {
  ctx.save()
  ctx.translate(cx(el.x, scale), cy(el.y, scale))

  if (el.type === 'text') {
    const { css } = fontCss(el, scale)
    const anInfo   = AN[el.align] || AN[1]
    const isMissing = missingFonts.value.has(el.fontName)
    ctx.font         = css
    ctx.fillStyle    = isMissing ? '#dc2626' : '#000'
    ctx.textAlign    = anInfo.a
    ctx.textBaseline = anInfo.b
    if (el.fontWidth && el.fontWidth !== 100) ctx.scale(el.fontWidth / 100, 1)  // larghezza % orizzontale
    ctx.fillText(resolveContent(el.content), 0, 0)
    // Sottolineatura tratteggiata rossa per font mancanti
    if (isMissing) {
      const metrics = ctx.measureText(resolveContent(el.content))
      const w = metrics.width
      const h = parseFloat(css)   // approssimazione altezza
      ctx.save()
      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth   = Math.max(1, scale * 0.6)
      ctx.setLineDash([3 * scale, 2 * scale])
      const yOff = anInfo.b === 'top' ? h * 0.15 : anInfo.b === 'middle' ? h * 0.6 : 2
      const xOff = anInfo.a === 'right' ? -w : anInfo.a === 'center' ? -w / 2 : 0
      ctx.beginPath(); ctx.moveTo(xOff, yOff); ctx.lineTo(xOff + w, yOff); ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

  } else if (el.type === 'line') {
    ctx.fillStyle = '#000'
    const len   = el.length    * scale
    const thick = Math.max(1, el.thickness * scale)
    if      (el.dir === 1) ctx.fillRect(0,        -thick / 2, len,   thick)  // right
    else if (el.dir === 3) ctx.fillRect(-len,      -thick / 2, len,   thick)  // left
    else if (el.dir === 2) ctx.fillRect(-thick / 2,  0,       thick,  len)   // down (↓ = +canvas Y)
    else                   ctx.fillRect(-thick / 2, -len,     thick,  len)   // up   (↑ = -canvas Y)

  } else if (el.type === 'box') {
    ctx.strokeStyle = '#000'
    ctx.lineWidth   = Math.max(1, el.thickness * scale)
    const bxW = el.width * scale, bxH = el.height * scale
    const d = el.dir || 1
    if      (d === 3) ctx.strokeRect(-bxW, -bxH, bxW, bxH)  // left, up
    else if (d === 2) ctx.strokeRect(0,     0,    bxW, bxH)  // right, down
    else if (d === 4) ctx.strokeRect(-bxW,  0,    bxW, bxH)  // left, down
    else              ctx.strokeRect(0,    -bxH,  bxW, bxH)  // DIR1: right, up

  } else if (el.type === 'barcode') {
    const bcText = resolveContent(el.content, true)
    const bcid   = getBcid(el.barcodeType)
    // Barra stretta / modulo 2D in dot = narrow × mag (manuale §3.4) → bwipScale = dot per modulo
    const bwipScale = Math.max(1, Math.round((el.barcodeNarrow || 1) * (el.barcodeMag || 1)))
    const cacheKey = `${bcid}|${bcText}|${bwipScale}|${el.barcodeHeight}`
    let offCanvas = barcodeCache.get(cacheKey)
    if (!offCanvas && bwipjsLib && bcText && !bcText.startsWith('[')) {
      try {
        offCanvas = document.createElement('canvas')
        // height bwip-js in mm a 72 dpi × scale → altezza barre = barcodeHeight dot (solo lineari)
        const opts = { bcid, text: bcText, scale: bwipScale, padding: 0 }
        if (!BWIP_2D.has(bcid)) opts.height = (el.barcodeHeight || 100) / bwipScale * 25.4 / 72
        bwipjsLib.toCanvas(offCanvas, opts)
        barcodeCache.set(cacheKey, offCanvas)
      } catch { offCanvas = null; barcodeCache.set(cacheKey, null) }
    }
    if (offCanvas) {
      const k  = BWIP_2PX.has(bcid) ? 2 : 1
      const bh = offCanvas.height / k * scale
      const bw = offCanvas.width  / k * scale
      ctx.imageSmoothingEnabled = false
      const d  = el.dir || 1
      if (d === 3) {
        // anchor = L-corner (top-right): rotate 180° so L-corner meets anchor
        ctx.save()
        ctx.translate(-bw / 2, bh / 2)   // center of target area
        ctx.rotate(Math.PI)
        ctx.drawImage(offCanvas, -bw / 2, -bh / 2, bw, bh)
        ctx.restore()
      } else if (d === 2) {
        // anchor = top-left: rotated 90° CW, expands right and down
        ctx.save()
        ctx.rotate(Math.PI / 2)
        ctx.drawImage(offCanvas, 0, -bh, bw, bh)
        ctx.restore()
      } else if (d === 4) {
        // anchor = bottom-right: rotated 90° CCW, expands left and up
        ctx.save()
        ctx.rotate(-Math.PI / 2)
        ctx.drawImage(offCanvas, -bw, 0, bw, bh)
        ctx.restore()
      } else {
        // DIR 1 (default): anchor = bottom-left, expands right and up
        ctx.drawImage(offCanvas, 0, -bh, bw, bh)
      }
    } else {
      // Fallback placeholder
      const mag = el.barcodeMag || 1
      const sz  = Math.max(30, 50 * mag * 0.15) * scale
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
    const entry = images.value.find(i => i.filename === el.filename)
    if (entry?.img) {
      // 1 pixel del BMP = 1 dot stampante; convertiamo in canvas pixels
      const imgW = entry.img.naturalWidth  * scale
      const imgH = entry.img.naturalHeight * scale
      const d    = el.dir || 1
      if      (d === 3) ctx.drawImage(entry.img, -imgW,    0, imgW, imgH)
      else if (d === 2) ctx.drawImage(entry.img,     0,    0, imgW, imgH)
      else if (d === 4) ctx.drawImage(entry.img, -imgW, -imgH, imgW, imgH)
      else              ctx.drawImage(entry.img,     0, -imgH, imgW, imgH)
    } else {
      const w = 80 * scale, h = 28 * scale
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
      ctx.fillText(el.filename.replace(/\.[^.]+$/, ''), 3, -h / 2)
    }
  }

  ctx.restore()
}

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

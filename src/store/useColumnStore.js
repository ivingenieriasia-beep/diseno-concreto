import { create } from 'zustand'

// Lecho por defecto
const defaultLecho = () => ({ n: 2, num: '4' })

let uidSeq = 0
const nuevoUid = () => `c${Date.now().toString(36)}${(uidSeq++).toString(36)}`

const defaultColumn = (nombre = '') => ({
  uid: nuevoUid(),   // identidad estable: sobrevive a renombrar y a reordenar
  nombre,
  b: 30,          // base (cm) — dimensión en X
  h: 30,          // peralte (cm) — dimensión en Y
  r: 3,
  fc: 250,
  fy: 4200,
  E: 2000000,
  epsC: 0.003,
  nLechos: 2,
  lechos: [defaultLecho(), defaultLecho()], // lecho 1 = cara superior
  Pu: 0,
  MuX: 0,         // momento que trabaja el peralte h (hoja de Excel tal cual)
  MuY: 0,         // momento en la otra dirección
  estriboNum: '2.5',
  // Envolvente de elementos mecánicos (p. ej. reporte RAM) — opcional
  envelope: null, // { archivo, combo, mapping, points:[...] }
})

let counter = 0

const useColumnStore = create((set, get) => ({
  columns: [],
  selectedIdx: -1,
  form: defaultColumn(),

  setForm: (patch) => set((s) => {
    const newForm = { ...s.form, ...patch }
    // Ajustar arreglo de lechos cuando cambia nLechos
    if ('nLechos' in patch) {
      const n = Math.max(2, Math.min(8, Number(patch.nLechos) || 2))
      newForm.nLechos = n
      const lechos = [...(newForm.lechos || [])]
      while (lechos.length < n) lechos.push(defaultLecho())
      lechos.length = n
      newForm.lechos = lechos
    }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.columns.length) {
      const updated = [...s.columns]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, columns: updated }
    }
    return { form: newForm }
  }),

  setLecho: (idx, patch) => set((s) => {
    const lechos = (s.form.lechos || []).map((L, i) => (i === idx ? { ...L, ...patch } : L))
    const newForm = { ...s.form, lechos }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.columns.length) {
      const updated = [...s.columns]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, columns: updated }
    }
    return { form: newForm }
  }),

  // Adjunta / quita la envolvente de la columna activa
  setEnvelope: (env) => set((s) => {
    const newForm = { ...s.form, envelope: env }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.columns.length) {
      const updated = [...s.columns]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, columns: updated }
    }
    return { form: newForm }
  }),

  // Envolvente de cualquier columna por índice (pestaña Modelo y carga masiva)
  setEnvelopeAt: (idx, env) => set((s) => {
    if (idx < 0 || idx >= s.columns.length) return {}
    const updated = [...s.columns]
    updated[idx] = { ...updated[idx], envelope: env }
    const form = idx === s.selectedIdx ? { ...s.form, envelope: env } : s.form
    return { columns: updated, form }
  }),

  selectColumn: (idx) => {
    const col = get().columns[idx]
    if (!col) return
    set({ selectedIdx: idx, form: { ...defaultColumn(), ...col } })
  },

  /** Añade una columna ya rellenada (la crea el modelo de RAM, por ejemplo) */
  addColumn: (col) => {
    const nombre = (col?.nombre || '').trim() || `C-${++counter}`
    const nueva = { ...defaultColumn(nombre), ...col, nombre }
    const columns = [...get().columns, nueva]
    set({ columns, selectedIdx: columns.length - 1, form: { ...nueva } })
    return columns.length - 1
  },

  createColumn: () => {
    counter++
    const col = defaultColumn(`C-${counter}`)
    const columns = [...get().columns, col]
    const idx = columns.length - 1
    set({ columns, selectedIdx: idx, form: { ...col } })
  },

  /** Mueve una columna a otra posición (arrastrando su chip) */
  moveColumn: (from, to) => set((s) => {
    const n = s.columns.length
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return {}
    const columns = [...s.columns]
    const [it] = columns.splice(from, 1)
    columns.splice(to, 0, it)
    let selectedIdx = s.selectedIdx
    if (selectedIdx === from) selectedIdx = to
    else if (from < selectedIdx && to >= selectedIdx) selectedIdx -= 1
    else if (from > selectedIdx && to <= selectedIdx) selectedIdx += 1
    return { columns, selectedIdx }
  }),

  removeColumn: (idx) => set((s) => {
    const columns = s.columns.filter((_, i) => i !== idx)
    let selectedIdx = s.selectedIdx
    if (idx === selectedIdx) selectedIdx = Math.min(selectedIdx, columns.length - 1)
    else if (idx < selectedIdx) selectedIdx--
    const form = selectedIdx >= 0 && columns[selectedIdx]
      ? { ...defaultColumn(), ...columns[selectedIdx] }
      : defaultColumn()
    return { columns, selectedIdx, form }
  }),

  loadColumns: (columns) => {
    const fixed = (columns || []).map((c) => ({ ...defaultColumn(), ...c, uid: c.uid || nuevoUid() }))
    counter = fixed.reduce((m, c) => Math.max(m, +(/^C-(\d+)$/.exec(c.nombre || '')?.[1] || 0)), 0)
    set({
      columns: fixed,
      selectedIdx: fixed.length > 0 ? 0 : -1,
      form: fixed.length > 0 ? { ...fixed[0] } : defaultColumn(),
    })
  },
}))

// Mismo puente que el de trabes, para pruebas e integraciones (en Node no hay window)
if (typeof window !== 'undefined') window.__COL_STORE__ = useColumnStore

export default useColumnStore

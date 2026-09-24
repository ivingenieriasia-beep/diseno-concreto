import { create } from 'zustand'
import { crearCim } from '../core/cim'

// Cimentaciones del proyecto: los cimientos, el suelo de la obra (del estudio
// de mecánica de suelos) y los criterios. Cada cimiento puede sobrescribir el
// suelo en su propio `suelo`. Con deshacer: arrastrar el dibujo cambia mucho y
// rápido, y un paso atrás tiene que estar a un Ctrl+Z.

let seq = 0
const nuevoUid = () => `z${Date.now().toString(36)}${(seq++).toString(36)}`
const conUid = (z) => (z.uid ? z : { ...z, uid: nuevoUid() })
const HIST = 40

const useCimStore = create((set, get) => ({
  cimientos: [],
  selUid: null,
  suelo: {},          // lo capturado de la obra; lo que falte sale de SUELO
  criterios: {},      // lo cambiado de CRITERIOS
  linderos: {},       // lados de la planta que son colindancia: { 'x-min': true, … } (ejes de la zapata)
  hist: [],

  obra: () => ({ suelo: get().suelo, criterios: get().criterios }),

  _guardar: () => set((s) => ({ hist: [...s.hist.slice(-HIST + 1), s.cimientos] })),

  agregar: (tipo, extra = {}) => {
    const s = get()
    const z = conUid(crearCim(tipo, s.cimientos, s.obra(), extra))
    set({ hist: [...s.hist.slice(-HIST + 1), s.cimientos], cimientos: [...s.cimientos, z], selUid: z.uid })
    return z
  },

  /** Varios de golpe (desde RAM): ya vienen armados */
  agregarVarios: (lista) => {
    const s = get()
    const nuevos = lista.map(conUid)
    set({ hist: [...s.hist.slice(-HIST + 1), s.cimientos], cimientos: [...s.cimientos, ...nuevos], selUid: nuevos[0]?.uid ?? s.selUid })
    return nuevos
  },

  seleccionar: (uid) => set({ selUid: uid }),

  /** patch: objeto (se mezcla por nivel: geo, cargas, arm…) o función z → z */
  actualizar: (uid, patch, { historial = true } = {}) => set((s) => {
    const cimientos = s.cimientos.map((z) => {
      if (z.uid !== uid) return z
      if (typeof patch === 'function') return patch(z)
      const out = { ...z }
      for (const [k, v] of Object.entries(patch)) {
        out[k] = v && typeof v === 'object' && !Array.isArray(v) && z[k] && typeof z[k] === 'object' && !Array.isArray(z[k]) ? { ...z[k], ...v } : v
      }
      return out
    })
    return historial ? { cimientos, hist: [...s.hist.slice(-HIST + 1), s.cimientos] } : { cimientos }
  }),

  /** Al terminar un arrastre: el estado de antes queda en el historial una sola vez */
  marcar: (antes) => set((s) => ({ hist: [...s.hist.slice(-HIST + 1), antes] })),

  borrar: (uid) => set((s) => {
    const i = s.cimientos.findIndex((z) => z.uid === uid)
    const cimientos = s.cimientos.filter((z) => z.uid !== uid)
    const sig = cimientos[Math.min(i, cimientos.length - 1)]
    return { hist: [...s.hist.slice(-HIST + 1), s.cimientos], cimientos, selUid: s.selUid === uid ? sig?.uid ?? null : s.selUid }
  }),

  duplicar: (uid) => {
    const s = get()
    const z = s.cimientos.find((x) => x.uid === uid)
    if (!z) return null
    const base = z.nombre.replace(/-\d+$/, '')
    let n = 1
    while (s.cimientos.some((x) => x.nombre === `${base}-${n}`)) n++
    const copia = { ...structuredClone(z), uid: nuevoUid(), nombre: `${base}-${n}`, origen: null }
    const i = s.cimientos.findIndex((x) => x.uid === uid)
    const cimientos = [...s.cimientos.slice(0, i + 1), copia, ...s.cimientos.slice(i + 1)]
    set({ hist: [...s.hist.slice(-HIST + 1), s.cimientos], cimientos, selUid: copia.uid })
    return copia
  },

  mover: (desde, hasta) => set((s) => {
    if (desde === hasta || desde < 0 || hasta < 0 || desde >= s.cimientos.length || hasta >= s.cimientos.length) return {}
    const c = [...s.cimientos]
    const [z] = c.splice(desde, 1)
    c.splice(hasta, 0, z)
    return { cimientos: c }
  }),

  deshacer: () => set((s) => {
    if (!s.hist.length) return {}
    const prev = s.hist[s.hist.length - 1]
    const selUid = prev.some((z) => z.uid === s.selUid) ? s.selUid : prev[0]?.uid ?? null
    return { cimientos: prev, hist: s.hist.slice(0, -1), selUid }
  }),

  setSuelo: (patch) => set((s) => ({ suelo: { ...s.suelo, ...patch } })),
  setCriterios: (patch) => set((s) => ({ criterios: { ...s.criterios, ...patch } })),
  setLinderos: (patch) => set((s) => ({ linderos: { ...s.linderos, ...patch } })),

  /** Del .json del proyecto (o del autoguardado) */
  cargar: (data) => {
    const d = data || {}
    const cimientos = Array.isArray(d.cimientos) ? d.cimientos.map(conUid) : []
    set({ cimientos, suelo: d.suelo || {}, criterios: d.criterios || {}, linderos: d.linderos || {}, selUid: cimientos[0]?.uid ?? null, hist: [] })
  },

  empacar: () => {
    const { cimientos, suelo, criterios, linderos } = get()
    return { cimientos, suelo, criterios, linderos }
  },
}))

export default useCimStore

import { create } from 'zustand'

import {
  instanciarLosa, instanciarMuro, duplicarLosa, duplicarMuro,
  losaVacia, muroVacio, capaVacia, tableroVacio, nuevoId,
} from '../core/loadsLibrary'

// ══════════════════════════════════════════════════════════════
// Estado del módulo Pesos Unitarios dentro del proyecto abierto.
// Todo lo de aquí viaja en el .json del proyecto y en el autoguardado.
// ══════════════════════════════════════════════════════════════

const sinId = (x, pref) => (x.id ? x : { ...x, id: nuevoId(pref) })

/** Mueve un elemento del arreglo; fuera de rango no hace nada. */
function mover(arr, i, delta) {
  const j = i + delta
  if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) return arr
  const copia = [...arr]
  const [x] = copia.splice(i, 1)
  copia.splice(j, 0, x)
  return copia
}

const useLoadsStore = create((set, get) => ({
  losas: [],
  muros: [],
  tableros: [],
  losaSel: null,   // id de la losa abierta
  muroSel: null,
  unidad: 'kg',    // salida a RAM: 'kg' | 'ton'

  // ── Proyecto ───────────────────────────────────────────────
  loadCargas: (data = {}) => set({
    losas: (data.losas || []).map((l) => sinId(l, 'L')),
    muros: (data.muros || []).map((m) => sinId(m, 'M')),
    tableros: (data.tableros || []).map((t) => sinId(t, 'T')),
    unidad: data.unidad || 'kg',
    losaSel: (data.losas || [])[0]?.id || null,
    muroSel: (data.muros || [])[0]?.id || null,
  }),
  packCargas: () => {
    const { losas, muros, tableros, unidad } = get()
    return { losas, muros, tableros, unidad }
  },
  setUnidad: (unidad) => set({ unidad }),

  // ── Losas ──────────────────────────────────────────────────
  addLosa: (plantilla) => set((s) => {
    const nueva = plantilla ? instanciarLosa(plantilla) : losaVacia()
    return { losas: [...s.losas, nueva], losaSel: nueva.id }
  }),
  duplicarLosa: (id) => set((s) => {
    const l = s.losas.find((x) => x.id === id)
    if (!l) return s
    const copia = duplicarLosa(l)
    const i = s.losas.findIndex((x) => x.id === id)
    const losas = [...s.losas]
    losas.splice(i + 1, 0, copia)
    return { losas, losaSel: copia.id }
  }),
  removeLosa: (id) => set((s) => {
    const losas = s.losas.filter((l) => l.id !== id)
    return {
      losas,
      losaSel: s.losaSel === id ? (losas[0]?.id || null) : s.losaSel,
      // Un tablero sin losa no se borra: se queda esperando a que le asignes otra
      tableros: s.tableros.map((t) => (t.losaId === id ? { ...t, losaId: null } : t)),
    }
  }),
  selectLosa: (id) => set({ losaSel: id }),
  updateLosa: (id, patch) => set((s) => ({
    losas: s.losas.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  })),
  updateCV: (id, patch) => set((s) => ({
    losas: s.losas.map((l) => (l.id === id ? { ...l, cv: { ...l.cv, ...patch } } : l)),
  })),

  // ── Capas de una losa ──────────────────────────────────────
  addCapa: (losaId, capa) => set((s) => ({
    losas: s.losas.map((l) => (l.id === losaId
      ? { ...l, capas: [...l.capas, { ...capaVacia(capa?.modo || 'espesor'), ...capa, id: nuevoId('c') }] }
      : l)),
  })),
  updateCapa: (losaId, capaId, patch) => set((s) => ({
    losas: s.losas.map((l) => (l.id === losaId
      ? { ...l, capas: l.capas.map((c) => (c.id === capaId ? { ...c, ...patch } : c)) }
      : l)),
  })),
  removeCapa: (losaId, capaId) => set((s) => ({
    losas: s.losas.map((l) => (l.id === losaId ? { ...l, capas: l.capas.filter((c) => c.id !== capaId) } : l)),
  })),
  moverCapa: (losaId, capaId, delta) => set((s) => ({
    losas: s.losas.map((l) => (l.id === losaId
      ? { ...l, capas: mover(l.capas, l.capas.findIndex((c) => c.id === capaId), delta) }
      : l)),
  })),

  // ── Muros ──────────────────────────────────────────────────
  addMuro: (plantilla) => set((s) => {
    const nuevo = plantilla ? instanciarMuro(plantilla) : muroVacio()
    return { muros: [...s.muros, nuevo], muroSel: nuevo.id }
  }),
  duplicarMuro: (id) => set((s) => {
    const m = s.muros.find((x) => x.id === id)
    if (!m) return s
    const copia = duplicarMuro(m)
    const i = s.muros.findIndex((x) => x.id === id)
    const muros = [...s.muros]
    muros.splice(i + 1, 0, copia)
    return { muros, muroSel: copia.id }
  }),
  removeMuro: (id) => set((s) => {
    const muros = s.muros.filter((m) => m.id !== id)
    return {
      muros,
      muroSel: s.muroSel === id ? (muros[0]?.id || null) : s.muroSel,
      tableros: s.tableros.map((t) => (t.muroId === id ? { ...t, muroId: null } : t)),
    }
  }),
  selectMuro: (id) => set({ muroSel: id }),
  updateMuro: (id, patch) => set((s) => ({ muros: s.muros.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  addCapaMuro: (muroId, capa) => set((s) => ({
    muros: s.muros.map((m) => (m.id === muroId
      ? { ...m, capas: [...m.capas, { ...capaVacia(capa?.modo || 'directo'), ...capa, id: nuevoId('c') }] }
      : m)),
  })),
  updateCapaMuro: (muroId, capaId, patch) => set((s) => ({
    muros: s.muros.map((m) => (m.id === muroId
      ? { ...m, capas: m.capas.map((c) => (c.id === capaId ? { ...c, ...patch } : c)) }
      : m)),
  })),
  removeCapaMuro: (muroId, capaId) => set((s) => ({
    muros: s.muros.map((m) => (m.id === muroId ? { ...m, capas: m.capas.filter((c) => c.id !== capaId) } : m)),
  })),
  moverCapaMuro: (muroId, capaId, delta) => set((s) => ({
    muros: s.muros.map((m) => (m.id === muroId
      ? { ...m, capas: mover(m.capas, m.capas.findIndex((c) => c.id === capaId), delta) }
      : m)),
  })),
  addAltura: (muroId) => set((s) => ({
    muros: s.muros.map((m) => (m.id === muroId
      ? { ...m, alturas: [...m.alturas, { id: nuevoId('h'), nombre: `Altura ${m.alturas.length + 1}`, h: '' }] }
      : m)),
  })),
  updateAltura: (muroId, altId, patch) => set((s) => ({
    muros: s.muros.map((m) => (m.id === muroId
      ? { ...m, alturas: m.alturas.map((a) => (a.id === altId ? { ...a, ...patch } : a)) }
      : m)),
  })),
  removeAltura: (muroId, altId) => set((s) => ({
    muros: s.muros.map((m) => (m.id === muroId ? { ...m, alturas: m.alturas.filter((a) => a.id !== altId) } : m)),
  })),

  // ── Tableros ───────────────────────────────────────────────
  addTablero: (patch) => set((s) => {
    const t = { ...tableroVacio(`Tablero ${s.tableros.length + 1}`), losaId: s.losas[0]?.id || null, ...patch }
    return { tableros: [...s.tableros, t] }
  }),
  updateTablero: (id, patch) => set((s) => ({
    tableros: s.tableros.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  })),
  removeTablero: (id) => set((s) => ({ tableros: s.tableros.filter((t) => t.id !== id) })),
  duplicarTablero: (id) => set((s) => {
    const t = s.tableros.find((x) => x.id === id)
    if (!t) return s
    const i = s.tableros.findIndex((x) => x.id === id)
    const tableros = [...s.tableros]
    tableros.splice(i + 1, 0, { ...t, id: nuevoId('T'), nombre: `${t.nombre} (copia)` })
    return { tableros }
  }),
  moverTablero: (id, delta) => set((s) => ({
    tableros: mover(s.tableros, s.tableros.findIndex((t) => t.id === id), delta),
  })),

  limpiar: () => set({ losas: [], muros: [], tableros: [], losaSel: null, muroSel: null }),
}))

export default useLoadsStore

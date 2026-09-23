import { create } from 'zustand'

import { CAL_TO_NUM, NUM_TO_CAL } from '../core/constants'

const defaultCalc = () => ({
  fy: 4200,
  MuP: 0, MuN: 0,
  varPNum: 3, varPCount: 0,
  bastonPNum: 3, bastonPCount: 0,
  varNNum: 3, varNCount: 0,
  bastonNNum: 3, bastonNCount: 0,
  L: 0, VuTon: 0,
  varEstNum: 2, nramas: 2,
  SL4: null, SLresto: null,
  asManual: null,
  conCompresion: false, MuCorte: 0,
})

let uidSeq = 0
const nuevoUid = () => `s${Date.now().toString(36)}${(uidSeq++).toString(36)}`

const defaultSection = (nombre = '') => ({
  uid: nuevoUid(),   // identidad estable: sobrevive a renombrar y a reordenar
  nombre,
  peralte: 20,
  ancho: 15,
  recub: 3,
  calSup: '3',
  cantSup: 2,
  calInf: '3',
  cantInf: 2,
  fc: 250,
  // Bastones CORRIDOS: recorren la trabe, se dibujan en el corte y cuentan en el MR
  cantBastonSup: 0,
  calBastonSup: '3',
  cantBastonInf: 0,
  calBastonInf: '3',
  // Bastones PUNTUALES que el análisis longitudinal repartió: no van en el
  // corte (no existen en toda la longitud), se dibujan en el alzado
  cantBastonPuntSup: 0,
  cantBastonPuntInf: 0,
  calEst: '2.5',
  sepLcuarto: 8,
  sepRest: 16,
  mrPos: '',
  muPos: '',
  mrNeg: '',
  muNeg: '',
  vu: '',
  vr: '',
  calc: defaultCalc(),
  // Envolvente de elementos mecánicos (reporte RAM) — opcional
  envelope: null, // { archivo, combo, invertir, points:[...] }
  // Perfil por estaciones (reporte RAM "Envolvente de esfuerzos") — análisis longitudinal
  perfil: null,   // { archivo, combo, members:[{id, stations}], L, Lpor:{id:L}, invertir, minLen }
})

// Cada bastón se amarra a una varilla del lecho: nunca puede haber más
// bastones que varillas principales. Se respeta el valor tal cual mientras
// alguno de los dos campos esté vacío (el usuario sigue escribiendo).
const clampBastones = (nb, nv) => {
  const b = Number(nb), v = Number(nv)
  if (nb === '' || nv === '' || !Number.isFinite(b) || !Number.isFinite(v) || v <= 0) return nb
  return Math.max(0, Math.min(b, v))
}

// Cada campo del armado tiene un gemelo en `calc`, y la calculadora, los
// informes y el análisis longitudinal leen el de `calc`. Toda vía que escriba
// el armado tiene que pasar por aquí: si no, la trabe se dibuja con un #4 y se
// calcula con el #3 de antes.
function conCalcAlDia(newForm, patch) {
  // Un bastón por varilla como máximo (también al bajar la cantidad de varillas)
  if ('cantSup' in patch || 'cantBastonSup' in patch) {
    newForm.cantBastonSup = clampBastones(newForm.cantBastonSup, newForm.cantSup)
  }
  if ('cantInf' in patch || 'cantBastonInf' in patch) {
    newForm.cantBastonInf = clampBastones(newForm.cantBastonInf, newForm.cantInf)
  }
  const cp = {}
  if ('calSup' in patch) cp.varNNum = CAL_TO_NUM[patch.calSup] || 3
  if ('cantSup' in patch) cp.varNCount = Number(patch.cantSup) || 0
  if ('calInf' in patch) cp.varPNum = CAL_TO_NUM[patch.calInf] || 3
  if ('cantInf' in patch) cp.varPCount = Number(patch.cantInf) || 0
  if ('calBastonSup' in patch) cp.bastonNNum = CAL_TO_NUM[patch.calBastonSup] || 3
  if ('cantBastonSup' in patch || 'cantSup' in patch) cp.bastonNCount = Number(newForm.cantBastonSup) || 0
  if ('calBastonInf' in patch) cp.bastonPNum = CAL_TO_NUM[patch.calBastonInf] || 3
  if ('cantBastonInf' in patch || 'cantInf' in patch) cp.bastonPCount = Number(newForm.cantBastonInf) || 0
  if ('calEst' in patch) cp.varEstNum = CAL_TO_NUM[patch.calEst] || 2
  if ('sepLcuarto' in patch) cp.SL4 = Number(patch.sepLcuarto) || null
  if ('sepRest' in patch) cp.SLresto = Number(patch.sepRest) || null
  if ('muPos' in patch) cp.MuP = Number(patch.muPos) || 0
  if ('muNeg' in patch) cp.MuN = Number(patch.muNeg) || 0
  if ('vu' in patch) cp.VuTon = Number(patch.vu) || 0
  if (Object.keys(cp).length > 0) {
    newForm.calc = { ...(newForm.calc || defaultCalc()), ...cp }
  }
  return newForm
}

// El armado que propone la app queda marcado hasta que alguien lo toca: el
// catálogo de criterio sólo debe aprender de lo que un ingeniero decidió, no
// de sus propias propuestas.
const ARMADO = ['calInf', 'cantInf', 'calSup', 'cantSup', 'calBastonInf', 'cantBastonInf',
  'calBastonSup', 'cantBastonSup', 'cantBastonPuntInf', 'cantBastonPuntSup', 'calEst', 'sepLcuarto', 'sepRest']
const tocoArmado = (antes, despues) => ARMADO.some((k) => String(antes?.[k] ?? '') !== String(despues?.[k] ?? ''))

let counter = 0

const useBeamStore = create((set, get) => ({
  sections: [],
  selectedIdx: -1,
  model: null,    // { archivo, rows:[{member,nj,nk,seccion,…}], nodes:{id:{x,y,z}} }
  // Reacciones de los nudos con apoyo, del modelo de RAM. Todavía no las usa
  // nadie: son el insumo del módulo de cimentación.
  reacciones: [],
  // Carpeta de Windows de ESTE proyecto, donde el script de RAM deja el
  // modelo.json. Viaja con el proyecto, así que cambiar de obra la cambia.
  rutaRam: '',
  longFocus: null, // { member, fallan:[ids], ts } — «bastonear» desde la envolvente
  form: defaultSection(),
  calcAlert: false,
  dbStatus: null, // { status: 'db_match'|'db_partial'|'new_design', gid }

  setDbStatus: (v) => set({ dbStatus: v }),

  setCalcAlert: (v) => set({ calcAlert: v }),

  // Set form AND auto-save + sync form → calc
  setForm: (patch) => set((s) => {
    const newForm = conCalcAlDia({ ...s.form, ...patch }, patch)
    // quien edita el formulario es el ingeniero: el armado deja de ser propuesta
    if (newForm.armadoPropuesto && !('armadoPropuesto' in patch) && tocoArmado(s.form, newForm)) newForm.armadoPropuesto = false
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  // Set calc sub-object AND auto-save + sync calc → form
  setCalc: (patch) => set((s) => {
    const newCalc = { ...s.form.calc, ...patch }
    // Un bastón por varilla como máximo (varCount = 0 significa "automático")
    if ('bastonNCount' in patch || 'varNCount' in patch) {
      newCalc.bastonNCount = clampBastones(newCalc.bastonNCount, newCalc.varNCount)
    }
    if ('bastonPCount' in patch || 'varPCount' in patch) {
      newCalc.bastonPCount = clampBastones(newCalc.bastonPCount, newCalc.varPCount)
    }
    const newForm = { ...s.form, calc: newCalc }
    // Sync calc → form
    if ('varNNum' in patch) newForm.calSup = NUM_TO_CAL[patch.varNNum] || String(patch.varNNum)
    if ('varNCount' in patch && Number(patch.varNCount) > 0) newForm.cantSup = Number(patch.varNCount)
    if ('varPNum' in patch) newForm.calInf = NUM_TO_CAL[patch.varPNum] || String(patch.varPNum)
    if ('varPCount' in patch && Number(patch.varPCount) > 0) newForm.cantInf = Number(patch.varPCount)
    if ('bastonNNum' in patch) newForm.calBastonSup = NUM_TO_CAL[patch.bastonNNum] || String(patch.bastonNNum)
    if ('bastonNCount' in patch || 'varNCount' in patch) newForm.cantBastonSup = Number(newCalc.bastonNCount) || 0
    if ('bastonPNum' in patch) newForm.calBastonInf = NUM_TO_CAL[patch.bastonPNum] || String(patch.bastonPNum)
    if ('bastonPCount' in patch || 'varPCount' in patch) newForm.cantBastonInf = Number(newCalc.bastonPCount) || 0
    if ('varEstNum' in patch) newForm.calEst = NUM_TO_CAL[patch.varEstNum] || String(patch.varEstNum)
    if ('MuP' in patch) newForm.muPos = Number(patch.MuP) || ''
    if ('MuN' in patch) newForm.muNeg = Number(patch.MuN) || ''
    if ('VuTon' in patch) newForm.vu = Number(patch.VuTon) || ''
    if ('SL4' in patch && patch.SL4 !== null) newForm.sepLcuarto = Number(patch.SL4)
    if ('SLresto' in patch && patch.SLresto !== null) newForm.sepRest = Number(patch.SLresto)
    // La calculadora reimporta el armado al abrirse (mismos valores: no cuenta);
    // si de verdad lo cambia, es una decisión del ingeniero.
    if (newForm.armadoPropuesto && tocoArmado(s.form, newForm)) newForm.armadoPropuesto = false
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  // Adjunta / quita la envolvente de la sección activa
  setEnvelope: (env) => set((s) => {
    const newForm = { ...s.form, envelope: env }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  // Envolvente de cualquier sección por índice
  setEnvelopeAt: (idx, env) => set((s) => {
    if (idx < 0 || idx >= s.sections.length) return {}
    const updated = [...s.sections]
    updated[idx] = { ...updated[idx], envelope: env }
    const form = idx === s.selectedIdx ? { ...s.form, envelope: env } : s.form
    return { sections: updated, form }
  }),

  // Geometría del modelo de RAM (nudos + miembros): es del modelo, no de una
  // trabe, así que se carga una vez y la usan todas las secciones.
  setModel: (model) => set({ model }),
  setReacciones: (reacciones) => set({ reacciones: reacciones || [] }),
  setRutaRam: (rutaRam) => set({ rutaRam: rutaRam || '' }),

  // Pide abrir Longitudinal centrado en un miembro (lo dispara la envolvente)
  setLongFocus: (v) => set({ longFocus: v ? { ...v, ts: Date.now() } : null }),

  // Perfil de cualquier sección por índice (carga masiva de reportes)
  /** Cambia campos de una sección por índice (sin tener que seleccionarla) */
  patchSectionAt: (idx, patch) => set((s) => {
    if (idx < 0 || idx >= s.sections.length) return {}
    const sections = s.sections.map((x, i) => (i === idx ? conCalcAlDia({ ...x, ...patch }, patch) : x))
    return { sections, form: s.selectedIdx === idx ? { ...sections[idx] } : s.form }
  }),

  setPerfilAt: (idx, perfil) => set((s) => {
    if (idx < 0 || idx >= s.sections.length) return {}
    const updated = [...s.sections]
    updated[idx] = { ...updated[idx], perfil }
    const form = idx === s.selectedIdx ? { ...s.form, perfil } : s.form
    return { sections: updated, form }
  }),

  // Perfil por estaciones de la sección activa (análisis longitudinal)
  setPerfil: (perfil) => set((s) => {
    const newForm = { ...s.form, perfil }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  // Write calculator results back to the detailer fields
  syncCalcResults: (results) => set((s) => {
    const patch = {}
    if (results.mrPos !== undefined && results.mrPos !== null) patch.mrPos = results.mrPos
    if (results.mrNeg !== undefined && results.mrNeg !== null) patch.mrNeg = results.mrNeg
    if (results.vr !== undefined && results.vr !== null) patch.vr = results.vr
    if (results.vu !== undefined && results.vu !== null) patch.vu = results.vu
    if (results.muPos !== undefined && results.muPos !== null) patch.muPos = results.muPos
    if (results.muNeg !== undefined && results.muNeg !== null) patch.muNeg = results.muNeg
    if (results.sepLcuarto !== undefined && results.sepLcuarto !== null) patch.sepLcuarto = results.sepLcuarto
    if (results.sepRest !== undefined && results.sepRest !== null) patch.sepRest = results.sepRest
    if (Object.keys(patch).length === 0) return {}
    const newForm = { ...s.form, ...patch }
    if (s.selectedIdx >= 0 && s.selectedIdx < s.sections.length) {
      const updated = [...s.sections]
      updated[s.selectedIdx] = { ...newForm }
      return { form: newForm, sections: updated }
    }
    return { form: newForm }
  }),

  selectSection: (idx) => {
    const sec = get().sections[idx]
    if (!sec) return
    // Ensure calc block exists (backwards compat with old saved projects)
    const form = { ...sec, calc: sec.calc || defaultCalc() }
    set({ selectedIdx: idx, form })
  },

  // Añade una sección ya armada (p. ej. al separar los elementos críticos
  // de una trabe en otra) y la deja seleccionada.
  addSection: (sec) => {
    const nombre = (sec?.nombre || '').trim() || `T-${++counter}`
    const nueva = { ...defaultSection(nombre), ...sec, uid: nuevoUid(), nombre, calc: { ...defaultCalc(), ...(sec?.calc || {}) } }
    const sections = [...get().sections, nueva]
    set({ sections, selectedIdx: sections.length - 1, form: { ...nueva } })
    return sections.length - 1
  },

  createSection: () => {
    counter++
    const sec = defaultSection(`T-${counter}`)
    const sections = [...get().sections, sec]
    const idx = sections.length - 1
    set({ sections, selectedIdx: idx, form: { ...sec } })
  },

  loadProject: (sections, model = null) => {
    // Ensure all sections have calc block (y uid, que los proyectos viejos no traen)
    const fixed = sections.map((s) => ({ ...defaultSection(), ...s, uid: s.uid || nuevoUid(), calc: { ...defaultCalc(), ...(s.calc || {}) } }))
    const form = fixed.length > 0 ? { ...fixed[0] } : defaultSection()
    // Que "+ Nueva" siga numerando después de las existentes (T-7 tras T-6)
    counter = fixed.reduce((m, s) => Math.max(m, +(/^T-(\d+)$/.exec(s.nombre || '')?.[1] || 0)), 0)
    // Proyectos anteriores guardaban la geometría dentro de cada perfil
    const heredado = model || fixed.map((s) => s.perfil?.geom).find((g) => g?.rows?.length && g?.nodes) || null
    set({ sections: fixed, selectedIdx: fixed.length > 0 ? 0 : -1, form, model: heredado && { archivo: heredado.archivo || '', rows: heredado.rows, nodes: heredado.nodes } })
  },

  /**
   * Mueve una sección a otra posición (arrastrando su chip). La selección
   * sigue apuntando a la misma trabe, esté donde esté.
   */
  moveSection: (from, to) => set((s) => {
    const n = s.sections.length
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return {}
    const sections = [...s.sections]
    const [it] = sections.splice(from, 1)
    sections.splice(to, 0, it)
    let selectedIdx = s.selectedIdx
    if (selectedIdx === from) selectedIdx = to
    else if (from < selectedIdx && to >= selectedIdx) selectedIdx -= 1
    else if (from > selectedIdx && to <= selectedIdx) selectedIdx += 1
    return { sections, selectedIdx }
  }),

  removeSection: (idx) => set((s) => {
    const sections = s.sections.filter((_, i) => i !== idx)
    let selectedIdx = s.selectedIdx
    if (idx === selectedIdx) {
      selectedIdx = Math.min(selectedIdx, sections.length - 1)
    } else if (idx < selectedIdx) {
      selectedIdx--
    }
    const form = selectedIdx >= 0 && sections[selectedIdx]
      ? { ...sections[selectedIdx] }
      : defaultSection()
    return { sections, selectedIdx, form }
  }),
}))

// Expose for postMessage / BD patch integration (en pruebas no hay window)
if (typeof window !== 'undefined') window.__BEAM_STORE__ = useBeamStore

export default useBeamStore

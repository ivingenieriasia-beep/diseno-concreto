// ══════════════════════════════════════════════════════════════
// Aplicar el modelo.json de RAM al proyecto, y crear las secciones que el
// modelo trae y el proyecto no. Vivía dentro del Centro de carga; está aquí
// para que el botón «🔄 Sincronizar con RAM» y la consola hagan exactamente
// lo mismo, con los mismos stores y los mismos motores.
// ══════════════════════════════════════════════════════════════

import useBeamStore from '../store/useBeamStore'
import useColumnStore from '../store/useColumnStore'
import { parseModeloRam, resumenModeloRam, repartirModelo, seccionSugerida, SIN_NOMBRE } from './ramModel'
import { proponerTrabe, proponerColumna } from './propuesta'
import { guardarModelo, modeloGuardado } from './ramSync'

/**
 * Pone el modelo en el proyecto: geometría, reacciones, y el perfil y la
 * envolvente de cada chip que tiene grupo en el modelo.
 * @returns { R, discrepan, faltan, sinDescripcion, nota }
 */
export function aplicarModeloRam(texto, nombre) {
  const R = parseModeloRam(texto, nombre)
  if (!R.ok) return { nota: R.warnings[0], R, discrepan: [], faltan: [], sinDescripcion: 0 }
  const B = useBeamStore.getState()
  const C = useColumnStore.getState()
  const sections = B.sections
  const columns = C.columns
  B.setModel(R.model)
  B.setReacciones(R.reacciones)
  const { asignados, sinChip } = repartirModelo(R, { trabes: sections, columnas: columns })
  // Si el chip tiene otras medidas que la sección analizada en RAM, las
  // demandas que entran son de otra sección. Callarlo sería lo peor.
  const discrepan = []
  for (const a of asignados) {
    const su = seccionSugerida(a.grupo)
    if (!su.ancho) continue
    const chip = a.tipo === 'trabe' ? sections[a.idx] : columns[a.idx]
    const b = +(a.tipo === 'trabe' ? chip.ancho : chip.b) || 0
    const h = +(a.tipo === 'trabe' ? chip.peralte : chip.h) || 0
    if (b !== su.ancho || h !== su.peralte) {
      discrepan.push({ tipo: a.tipo, idx: a.idx, nombre: chip.nombre, b, h, ancho: su.ancho, peralte: su.peralte, seccion: su.seccion, contradice: su.contradice })
    }
  }
  for (const a of asignados) {
    if (a.tipo === 'trabe') {
      B.setPerfilAt(a.idx, a.grupo.perfil)
      B.setEnvelopeAt(a.idx, { archivo: nombre, combo: a.grupo.perfil.combo, unidades: R.modelo.unidades, invertir: false, points: a.grupo.points })
    } else {
      C.setEnvelopeAt(a.idx, { archivo: nombre, combo: a.grupo.perfil.combo, unidades: R.modelo.unidades, mapping: 'M33X', points: a.grupo.points })
    }
  }
  // Los miembros sin descripción no son una sección: son lo que falta agrupar
  const faltan = sinChip.filter((g) => g.nombre !== SIN_NOMBRE)
  const sinDescripcion = sinChip.filter((g) => g.nombre === SIN_NOMBRE).reduce((n, g) => n + g.n, 0)
  ultimo = { texto, R, archivo: nombre, at: Date.now() }
  guardarModelo(texto, nombre)          // en IndexedDB: no cabe en el autoguardado
  const enChip = asignados.map((a) => a.grupo.nombre).join(', ')
  return {
    R,
    discrepan,
    faltan,
    sinDescripcion,
    nota: `${resumenModeloRam(R)} · aplicado a ${asignados.length} chip(s)${enChip ? `: ${enChip}` : ''}`
      + (sinChip.length ? ` · ${sinChip.length} grupo(s) sin sección en el proyecto` : ''),
  }
}

// El último modelo aplicado, ya leído: así la consola no lo vuelve a leer en
// cada comando. Lo que manda es IndexedDB (Agrupación y Deflexiones leen de
// ahí); esto sólo evita leerlo dos veces, y sirve donde no hay IndexedDB.
let ultimo = null   // { texto, R, archivo, at }

/** El modelo que se sincronizó la última vez, ya leído (o null) */
export async function modeloActual() {
  const m = await modeloGuardado()
  if (m?.datos) {
    if (ultimo?.texto === m.datos) return ultimo
    const R = parseModeloRam(m.datos, m.archivo || 'modelo.json')
    if (!R.ok) return null
    ultimo = { texto: m.datos, R, archivo: m.archivo || 'modelo.json', at: m.at }
    return ultimo
  }
  return ultimo
}

/** Los grupos del modelo que todavía no tienen sección en el proyecto */
export function gruposSinSeccion(R) {
  const { sinChip } = repartirModelo(R, { trabes: useBeamStore.getState().sections, columnas: useColumnStore.getState().columns })
  return sinChip.filter((g) => g.nombre !== SIN_NOMBRE)
}

/**
 * Crea de golpe las secciones que el modelo trae y el proyecto no — y no
 * desnudas: cada una sale con un armado propuesto que cubre su envolvente,
 * verificado con los mismos motores que luego la revisan.
 * @param onAvance  (texto) => void, para pintar el avance entre grupos
 * @returns { hechos:[texto], props:[{ nombre, tipo, bh, n, estado, texto, motivos, avisos, kg }] }
 */
export async function crearSeccionesDesdeModelo(lista, { onAvance } = {}) {
  const hechos = []
  const props = []
  for (const g of lista) {
    const s = seccionSugerida(g)
    onAvance?.(`Proponiendo el armado de ${s.nombre}…`)
    await new Promise((r) => setTimeout(r, 0))     // que se pinte el avance entre grupos
    let p = null
    if (s.esColumna) {
      const C = useColumnStore.getState()
      const idx = C.addColumn({ nombre: s.nombre, ...(s.ancho ? { b: s.ancho, h: s.peralte } : {}) })
      C.setEnvelopeAt(idx, { archivo: g.perfil.archivo, combo: g.perfil.combo, mapping: 'M33X', points: g.points })
      // la altura (para la zona de estribos de los extremos): el tramo más largo del grupo
      const H = Math.max(0, ...g.perfil.members.map((m) => +m.Lreport || 0)) || null
      try { p = proponerColumna(useColumnStore.getState().columns[idx], { H }) } catch (e) { console.error(e) }
      if (p && Object.keys(p.patch).length) useColumnStore.getState().patchColumnAt(idx, p.patch)
    } else {
      const B0 = useBeamStore.getState()
      const idx = B0.addSection({ nombre: s.nombre, ...(s.ancho ? { ancho: s.ancho, peralte: s.peralte } : {}) })
      B0.setPerfilAt(idx, g.perfil)
      B0.setEnvelopeAt(idx, { archivo: g.perfil.archivo, combo: g.perfil.combo, invertir: false, points: g.points })
      const B = useBeamStore.getState()
      try { p = proponerTrabe(B.sections[idx], B.model) } catch (e) { console.error(e) }
      if (p && Object.keys(p.patch).length) B.patchSectionAt(idx, p.patch)
    }
    const bh = s.ancho ? `${s.ancho}×${s.peralte}` : ''
    hechos.push(`${s.nombre}${bh ? ` (${bh})` : ''}`)
    props.push({
      nombre: s.nombre, tipo: s.esColumna ? 'columna' : 'trabe', bh, n: g.n,
      estado: p?.estado || 'sin', texto: p?.texto || 'sin envolvente: no hay con qué proponer',
      motivos: p?.motivos || [], avisos: p?.avisos || [], kg: p?.kg || 0,
    })
  }
  return { hechos, props }
}

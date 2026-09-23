// ══════════════════════════════════════════════════════════════
// Armado propuesto para una sección recién llegada del modelo de RAM.
//
// Sin esto, «crear las secciones» las deja desnudas: 2#3 arriba y abajo y
// estribos de fábrica, sin mirar la demanda. Aquí se propone un armado base
// que ya cubre la envolvente, y se entrega con su veredicto.
//
// Dos reglas que no se negocian:
//   · se propone con los MISMOS motores que luego verifican — el optimizador
//     y el análisis del módulo Longitudinal, el diagrama de interacción del de
//     Columnas —, así que propuesta y verificación no pueden discrepar;
//   · lo que no pasa se entrega igual, pero marcado y con el motivo. Un
//     armado insuficiente no se esconde: suele querer decir que la SECCIÓN no
//     alcanza, y eso es justo lo que hay que saber antes de agrupar.
// ══════════════════════════════════════════════════════════════

import { analyzeGroup, optimizeBase, applyBase, perfilCompleto } from './longitudinal'
import { analyzeColumn, bdLookup, estribosColumna, estribosDe } from './columnCalculator'
import { evaluateEnvelope } from './ramParser'

// ── Criterio de obra ─────────────────────────────────────────
// El optimizador minimiza kilos, y el peso es proporcional al área: a solas
// siempre gana la varilla más chica en mayor número, porque desperdicia menos
// área. Así salían 7#3 + 7#3 en una trabe de 20 cm o 20#3 en una columna de
// 36 — verificables, pero nadie las arma. Estas reglas ponen el límite que un
// calculista pondría sin pensarlo. Son un punto de partida: el catálogo de
// criterio propio (fase 2) las irá sustituyendo por las tuyas.

/** Corridas por lecho que caben con holgura para colar y vibrar */
export const corridasMax = (b) => (b <= 25 ? 3 : b <= 35 ? 4 : 5)

/** Separación máxima centro a centro entre barras de una cara de columna, cm */
export const SEP_MAX_COLUMNA = 20

// ── Trabes ───────────────────────────────────────────────────

/** Calibres de estribo que se prueban, en orden de preferencia */
const ESTRIBOS = ['2.5', '3']

/**
 * Separaciones de estribos que cubren a todos los elementos del grupo.
 * Se analiza una vez con una separación holgada y se lee, por zona, la que
 * pide cada elemento (o la máxima del reglamento si no pide nada).
 * @returns {{ cal, sExt, sCen, insuficiente }} en cm, ya redondeadas hacia abajo
 */
function estribosPara(t, perfil, { sPreferida = 8, sMin = 6 } = {}) {
  let mejor = null
  for (const cal of ESTRIBOS) {
    const G = analyzeGroup({ ...t, calEst: cal, calc: { ...(t.calc || {}), varEstNum: null, SL4: null, SLresto: null }, sepLcuarto: 60, sepRest: 60 }, perfil)
    let sExt = Infinity, sCen = Infinity, insuficiente = false
    for (const r of G.results) {
      const pide = (z) => {
        if (z.insuficiente) { insuficiente = true; return sMin }
        return z.ok ? Math.min(z.s, z.sMax) : z.sReq
      }
      sExt = Math.min(sExt, pide(r.shear.extremos))
      sCen = Math.min(sCen, pide(r.shear.centro))
    }
    if (!isFinite(sExt)) sExt = sCen
    if (!isFinite(sCen)) sCen = sExt
    sExt = Math.floor(Math.min(sExt, sCen))       // los extremos nunca más holgados que el centro
    sCen = Math.floor(sCen)
    const cand = { cal, sExt, sCen, insuficiente }
    // el primer calibre que deja una separación cómoda se queda
    if (!insuficiente && sExt >= sPreferida) return cand
    // si no, el que más separación deje sin bajar del mínimo
    if (!mejor || (!insuficiente && (mejor.insuficiente || sExt > mejor.sExt))) mejor = cand
  }
  return mejor
}

/** Texto corto de un armado de trabe, como se diría en obra */
export function textoArmadoTrabe(t) {
  const lecho = (n, cal, kc, calB, kp) => {
    let s = `${n}#${cal}`
    if (+kc > 0) s += ` + ${kc}#${calB} bastón`
    if (+kp > 0) s += ` + ${kp}#${calB || cal} puntual`
    return s
  }
  return `inf ${lecho(t.cantInf, t.calInf, t.cantBastonInf, t.calBastonInf, t.cantBastonPuntInf)}`
    + ` · sup ${lecho(t.cantSup, t.calSup, t.cantBastonSup, t.calBastonSup, t.cantBastonPuntSup)}`
    + ` · E#${t.calEst} @${t.sepLcuarto}/${t.sepRest}`
}

/**
 * Propone el armado de una trabe a partir de su perfil de RAM.
 * @param t      la sección (con perfil y envolvente ya puestos)
 * @param model  geometría del modelo (une los tramos en elementos)
 * @returns {{ patch, estado:'ok'|'revisar', motivos:[string], kg, texto, n } | null}
 */
export function proponerTrabe(t, model, opts = {}) {
  const perfil = perfilCompleto(t, model)
  if (!perfil?.members?.length) return null
  const motivos = []       // por qué no pasa
  const avisos = []        // pasa, pero hay algo que mirar

  // 1) Acero longitudinal: el mismo optimizador del módulo Longitudinal, que
  //    busca el corrido más barato con los bastones puntuales encima — con
  //    el tope de corridas que admite el ancho.
  const opt = optimizeBase(t, perfil, { nMax: corridasMax(+t.ancho), ...opts })
  if (!opt) return null
  const elegir = (r) => r.best || [...r.all].sort((a, b) => a.nInsuf - b.nInsuf || a.kg - b.kg)[0] || null
  const best = { inf: elegir(opt.inf), sup: elegir(opt.sup) }
  if (!best.inf || !best.sup) {
    return {
      patch: {}, estado: 'revisar', n: 0, kg: 0, texto: '—', avisos,
      motivos: [`ni con 2 varillas cabe en ${t.ancho} cm de ancho: la sección es chica`],
    }
  }
  let tt = { ...t, ...applyBase(t, best) }

  // 2) Estribos, ya con el acero longitudinal puesto (el ρ entra en Vcr)
  const est = estribosPara(tt, perfil, opts)
  const patchEst = { calEst: est.cal, sepLcuarto: est.sExt, sepRest: est.sCen }
  tt = { ...tt, ...patchEst, calc: { ...(tt.calc || {}), varEstNum: null, SL4: null, SLresto: null } }

  // 3) Bastones puntuales y veredicto final, con el armado completo
  const G = analyzeGroup(tt, perfil)
  const patch = { ...applyBase(t, best, G.kMaxInf, G.kMaxSup), ...patchEst, armadoPropuesto: true }

  if (G.nInsuf) motivos.push(`${G.nInsuf} de ${G.n} elemento(s) no cubren la flexión ni con bastones: la sección no alcanza`)
  if (est.insuficiente) motivos.push('el cortante rebasa lo que admite la sección con cualquier estribo')
  else if (G.nShear) motivos.push(`${G.nShear} elemento(s) no pasan por cortante`)
  if (!G.caps.okBase) motivos.push('el corrido no cumple As mín / b mín')
  if (est.sExt < 8 && !est.insuficiente) avisos.push(`estribos muy juntos en los extremos (@${est.sExt} cm): conviene más peralte`)

  const final = { ...t, ...patch }
  return {
    patch, n: G.n, kg: G.acero.total,
    estado: G.allOk && G.caps.okBase && !est.insuficiente ? 'ok' : 'revisar',
    motivos, avisos,
    texto: textoArmadoTrabe(final),
  }
}

// ── Columnas ─────────────────────────────────────────────────

/**
 * Arreglos perimetrales simétricos: nb barras en las caras de ancho b (lechos
 * primero y último) y 2 en cada lecho intermedio, nh lechos en total.
 * Sólo los que caben con la separación libre mínima.
 */
function arreglosColumna(b, h, r, num) {
  const v = bdLookup(num)
  const libre = Math.max(1.5 * v.diam, 4)       // separación libre mínima entre barras, cm
  const caben = (lado) => Math.max(2, Math.floor((lado - 2 * r) / (libre + v.diam)) + 1)
  // y las necesarias para no pasar de SEP_MAX_COLUMNA centro a centro
  const hacenFalta = (lado) => Math.max(2, Math.ceil((lado - 2 * r) / SEP_MAX_COLUMNA) + 1)
  const out = []
  for (let nb = hacenFalta(b); nb <= caben(b); nb++) {
    for (let nh = hacenFalta(h); nh <= Math.min(8, caben(h)); nh++) {
      const lechos = Array.from({ length: nh }, (_, i) => ({ n: i === 0 || i === nh - 1 ? nb : 2, num }))
      const nBarras = lechos.reduce((s, L) => s + L.n, 0)
      out.push({ num, nb, nh, nBarras, As: nBarras * v.area, lechos })
    }
  }
  return out
}

/** Texto corto de un armado de columna */
export function textoArmadoColumna(col) {
  const porCal = new Map()
  for (const L of col.lechos || []) porCal.set(L.num, (porCal.get(L.num) || 0) + (+L.n || 0))
  const barras = [...porCal].map(([num, n]) => `${n}#${num}`).join(' + ')
  const As = (col.lechos || []).reduce((s, L) => s + (+L.n || 0) * bdLookup(L.num).area, 0)
  const rho = As / ((+col.b || 1) * (+col.h || 1))
  return `${barras} (ρ ${(rho * 100).toFixed(2)} %) · ${estribosDe(col).texto}`
}

/** Las separaciones por zona para un armado dado, listas para guardar en la columna */
function zonasDe(col, lechos, H) {
  const e = estribosColumna({ b: col.b, h: col.h, estriboNum: col.estriboNum || '2.5', lechos, fy: +col.fy || 4200, H })
  return { sepExt: e.sExt, sepCen: e.sCen, longExt: e.lExt, ...(H ? { altura: H } : {}) }
}

/**
 * La columna con MENOS barras que pasa la envolvente y, entre las que tienen
 * las mismas, la de menos acero. Menos barras antes que menos área: es lo que
 * se arma, se amarra y se revisa en obra.
 * @param rhoMin  cuantía mínima de la propuesta (1 % por omisión: el criterio
 *                conservador; el reglamento permite menos en marcos ordinarios)
 * @param H       altura de la columna, m — para la zona de extremo de estribos
 */
export function proponerColumna(col, { calibres, rhoMin = 0.01, rhoMax = 0.04, H = null } = {}) {
  const pts = col?.envelope?.points
  if (!pts?.length) return null
  const b = +col.b, h = +col.h, r = +col.r || 3
  const Ag = b * h
  // el #3 sólo en castillos: con lado de 20 cm o más, de #4 para arriba
  const cals = calibres || (Math.min(b, h) >= 20 ? ['4', '5', '6', '8'] : ['3', '4', '5', '6', '8'])
  const cands = cals.flatMap((num) => arreglosColumna(b, h, r, num))
    .filter((c) => c.As / Ag >= rhoMin - 1e-9 && c.As / Ag <= rhoMax + 1e-9)
    .sort((a, b2) => a.nBarras - b2.nBarras || a.As - b2.As)
  const mapping = col.envelope.mapping || 'M33X'
  const probar = (c) => {
    const an = analyzeColumn({ ...col, nLechos: c.nh, lechos: c.lechos })
    return evaluateEnvelope(pts, an.dirX, an.dirY, mapping)
  }
  for (const c of cands) {
    const ev = probar(c)
    if (!ev.allOk) continue
    const patch = { nLechos: c.nh, lechos: c.lechos, ...zonasDe(col, c.lechos, H), armadoPropuesto: true }
    return { patch, estado: 'ok', motivos: [], avisos: [], n: ev.total, texto: textoArmadoColumna({ ...col, ...patch }) }
  }
  // Nada pasa: se entrega el más fuerte que cabe, con el aviso de que es la sección
  const fuerte = cands.reduce((a, c) => (!a || c.As > a.As ? c : a), null)
  if (!fuerte) {
    return { patch: {}, estado: 'revisar', n: 0, texto: '—', avisos: [], motivos: [`en ${b}×${h} no cabe un armado entre ρ ${rhoMin * 100} % y ${rhoMax * 100} %`] }
  }
  const ev = probar(fuerte)
  const patch = { nLechos: fuerte.nh, lechos: fuerte.lechos, ...zonasDe(col, fuerte.lechos, H), armadoPropuesto: true }
  return {
    patch, estado: 'revisar', n: ev.total, avisos: [],
    motivos: [`ni con ρ ${(fuerte.As / Ag * 100).toFixed(1)} % pasa (${ev.failing} de ${ev.total} puntos fuera): la sección no alcanza`],
    texto: textoArmadoColumna({ ...col, ...patch }),
  }
}

// ══════════════════════════════════════════════════════════════
// Un mismo diseño en varios ejes
//
// Una corrida, una contratrabe o una liga puede repetirse en otros ejes
// (`z.ejes`): cada eje trae lo suyo (cargas, columnas, largo) y el diseño
// —sección y armado— es uno. Se revisa en cada eje; cada revisión informa el
// peor, las cantidades se suman y ⚡ Proponer lo hace cumplir en todos.
// ══════════════════════════════════════════════════════════════

/** El cimiento con lo de un eje: sus cargas o columnas, su largo, su condición */
export const APLICAR = {
  corrida: (z, e) => ({ ...z, ejes: [], cargas: e.cargas || z.cargas, geo: { ...z.geo, Lz: e.Lz ?? z.geo.Lz, pos: e.pos ?? z.geo.pos } }),
  contratrabe: (z, e) => ({ ...z, ejes: [], columnas: e.columnas || z.columnas, geo: { ...z.geo, L: e.L ?? z.geo.L } }),
  liga: (z, e) => ({ ...z, ejes: [], columnas: e.columnas || z.columnas }),
}
export const conEjes = (tipo) => !!APLICAR[tipo]

/** Etiqueta corta de un eje: sus nudos o su número */
export const etiquetaEje = (e, i) => (e?.nudos?.length ? `eje de ${e.nudos.length > 4 ? `${e.nudos.slice(0, 3).join(', ')}…` : e.nudos.join(', ')}` : `eje ${i + 2}`)

const sumaCant = (a = {}, b = {}) => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) if (Number.isFinite(v)) out[k] = (out[k] || 0) + v
  return out
}

/**
 * La revisión del diseño en todos sus ejes: cada revisión, la del peor eje;
 * la memoria es la del eje que rige, con una tabla de cómo queda cada uno.
 */
export function revisarEnEjes(revisar, z, obra) {
  const base = revisar({ ...z, ejes: [] }, obra)
  const ejes = z.ejes || []
  if (!ejes.length || !APLICAR[z.tipo] || base.error) return base
  const otros = ejes.map((e, i) => ({ e, i, R: revisar(APLICAR[z.tipo](z, e), obra) }))
  const u = (R) => Math.max(0, ...R.checks.filter((c) => Number.isFinite(c.u)).map((c) => c.u))
  const todos = [{ e: null, i: -1, R: base }, ...otros]
  const checks = base.checks.map((c) => {
    let peor = { c, e: null, i: -1 }
    for (const o of otros) {
      const k = o.R.checks.find((x) => x.id === c.id)
      if (k && ((peor.c.ok && !k.ok) || (peor.c.ok === k.ok && k.u > peor.c.u + 1e-12))) peor = { c: k, e: o.e, i: o.i }
    }
    return peor.e ? { ...peor.c, nota: `${peor.c.nota ? `${peor.c.nota} · ` : ''}${etiquetaEje(peor.e, peor.i)}` } : c
  })
  const gov = todos.reduce((a, b) => ((a.R.ok && !b.R.ok) || (a.R.ok === b.R.ok && u(b.R) > u(a.R)) ? b : a))
  const tabla = {
    titulo: `En sus ${todos.length} ejes`,
    pasos: todos.map((t) => ({ t: t.e ? etiquetaEje(t.e, t.i) : 'eje del diseño', f: 'aprovechamiento máximo', n: t.R.ok ? 'cumple' : `no cumple: ${t.R.checks.filter((c) => !c.ok).map((c) => c.titulo.toLowerCase()).join(', ')}`, v: u(t.R) * 100, u: '%', ok: t.R.ok })),
  }
  const secciones = [tabla, ...gov.R.secciones.map((s) => (gov.e ? { ...s, titulo: `${s.titulo} (${etiquetaEje(gov.e, gov.i)})` } : s))]
  return {
    ...base,
    ok: checks.every((c) => c.ok),
    checks, secciones,
    avisos: [...new Set(todos.flatMap((t) => t.R.avisos || []))],
    cant: todos.reduce((a, t) => sumaCant(a, t.R.cant), {}),
    porEje: todos.map((t) => ({ e: t.e, i: t.i, ok: t.R.ok, u: u(t.R) })),
    resumen: `${base.resumen} · en ${todos.length} ejes`,
  }
}

// lo mayor de dos armados: el de más acero (por varillas o por metro)
const acero = (a) => {
  if (!a || typeof a !== 'object') return 0
  const area = { 2.5: 0.49, 3: 0.71, 4: 1.27, 5: 1.98, 6: 2.85, 8: 5.07, 10: 7.92, 12: 11.4 }[a.num] || 1
  return a.n != null ? a.n * area : a.s ? (area * (a.ramas || 1)) / a.s : 0
}
function envolventeArm(lista) {
  const out = {}
  for (const arm of lista) {
    for (const [k, a] of Object.entries(arm || {})) {
      if (!a || typeof a !== 'object') continue
      if (!out[k] || acero(a) > acero(out[k]) + 1e-9) out[k] = { ...a }
      // bastones y demás interruptores: si alguno los pide, van
      if (a.on) out[k] = { ...out[k], on: true }
    }
  }
  return out
}

/**
 * ⚡ Proponer en todos los ejes: se propone para cada uno y se toma lo mayor
 * (medidas y armado) sobre el diseño; si aun así alguno no pasa, se sube el
 * peralte (o la base) hasta que pasan todos.
 */
export function proponerEnEjes(proponer, revisar, z, obra) {
  const ejes = z.ejes || []
  const p0 = proponer({ ...z, ejes: [] }, obra)
  if (!ejes.length || !APLICAR[z.tipo]) return p0
  const ps = [p0, ...ejes.map((e) => proponer(APLICAR[z.tipo]({ ...z, ...p0, geo: { ...z.geo, ...p0.geo } }, e), obra))]
  // medidas: lo mayor, salvo lo que es de cada eje (largo, posición)
  const propios = { corrida: ['Lz', 'pos'], contratrabe: ['L'], liga: [] }[z.tipo]
  const geo = { ...z.geo, ...p0.geo }
  for (const p of ps) for (const [k, v] of Object.entries(p.geo || {})) if (typeof v === 'number' && !propios.includes(k) && v > (geo[k] ?? -Infinity)) geo[k] = v
  let out = { ...p0, geo, arm: envolventeArm(ps.map((p) => p.arm)) }
  const sube = { corrida: ['h', 5], contratrabe: ['H', 5], liga: ['h', 5] }[z.tipo]
  for (let i = 0; i < 16; i++) {
    const R = revisarEnEjes(revisar, { ...z, ...out, geo: out.geo }, obra)
    if (R.ok) break
    const suelo = R.checks.find((c) => c.id === 'suelo')
    if (suelo && !suelo.ok && out.geo.B != null) out = { ...out, geo: { ...out.geo, B: Math.round((out.geo.B + 0.05) * 100) / 100 } }
    else out = { ...out, geo: { ...out.geo, [sube[0]]: out.geo[sube[0]] + sube[1] } }
  }
  return out
}

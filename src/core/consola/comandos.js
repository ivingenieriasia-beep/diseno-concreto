// ══════════════════════════════════════════════════════════════
// Comandos de la consola. Cada uno usa los mismos stores y los mismos
// motores que los botones de la app: la consola no calcula nada aparte, sólo
// opera la app sin clics y contesta corto (texto o JSON) para gastar pocos
// tokens.
//
// Cada comando devuelve { ok, texto, datos }:
//   texto  una o pocas líneas, para leer;
//   datos  lo mismo en objeto, para un script (auxiliarIV.json()).
//
// Lo que la consola NO hace, a propósito: no borra chips, no genera
// aplicar_agrupacion.py ni toca RAM, y no acepta diseños. Sí empieza un
// proyecto nuevo o abre uno («proyecto», autorizado por FB el 2026-11-09):
// lo de antes queda primero en Recientes, como con el botón. Aplicar una agrupación o una sección en RAM lo hace el Modelador
// con la aprobación de un ingeniero (ADR-009 de la Oficina IV).
// ══════════════════════════════════════════════════════════════

import useBeamStore from '../../store/useBeamStore'
import useColumnStore from '../../store/useColumnStore'
import { APP_VERSION, normName, REBAR_OPTIONS, STIRRUP_OPTIONS } from '../constants'
import { computeSectionCapacities, resistenciasConPuntual } from '../sectionResults'
import { evaluateBeamEnvelope } from '../ramParser'
import { analyzeColumn, estribosDe } from '../columnCalculator'
import { columnDemand } from '../columnDemand'
import { analyzeGroup, perfilCompleto, unitLabel } from '../longitudinal'
import { revisarModelo, rolesPorDefecto, formulaServicio } from '../deflexiones'
import { searchByMoments, getStats } from '../globalDB'
import { inventario, proponerAgrupacion, verificarGrupo } from '../agrupacion'
import { proponerColumnas, verificarColumnas } from '../agrupacionColumnas'
import { textoArmadoTrabe, textoArmadoColumna } from '../propuesta'
import { aplicarModeloRam, modeloActual, gruposSinSeccion, crearSeccionesDesdeModelo } from '../ramAplicar'
import { carpetaGuardada, permisoDe, modeloGuardado, hace } from '../ramSync'
import { setCarpetaActiva, respaldarModelo } from '../carpeta'
import { usarUI } from './puente'

// ── Formato corto ────────────────────────────────────────────
const f2 = (v) => (v == null || !isFinite(v) ? '—' : Number(v).toFixed(2))
const pct = (u) => (u == null ? '—' : !isFinite(u) ? '∞' : `${Math.round(u * 100)} %`)
const marca = (ok) => (ok ? '✓' : '✗')
const bien = (texto, datos = null) => ({ ok: true, texto, datos })
const mal = (texto, datos = null) => ({ ok: false, texto, datos })

/** Separa una línea en palabras; respeta "lo que va entre comillas" */
export function partir(linea) {
  const out = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m
  while ((m = re.exec(String(linea || '')))) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

/** Palabras sueltas, opciones clave=valor y banderas --algo */
export function leerArgs(palabras) {
  const pos = [], kv = {}, flags = new Set()
  for (const p of palabras) {
    if (p.startsWith('--')) { flags.add(p.slice(2).toLowerCase()); continue }
    const i = p.indexOf('=')
    if (i > 0) { kv[p.slice(0, i).toLowerCase()] = p.slice(i + 1); continue }
    pos.push(p)
  }
  return { pos, kv, flags }
}

// ── Chips ────────────────────────────────────────────────────
const B = () => useBeamStore.getState()
const C = () => useColumnStore.getState()

/** Busca un chip por nombre ('T-5', 't5' y 'T 5' son el mismo) */
export function buscarChip(nombre) {
  const k = normName(nombre)
  if (!k) return null
  const ti = B().sections.findIndex((s) => normName(s.nombre) === k)
  if (ti >= 0) return { tipo: 'trabe', idx: ti, chip: B().sections[ti] }
  const ci = C().columns.findIndex((c) => normName(c.nombre) === k)
  if (ci >= 0) return { tipo: 'columna', idx: ci, chip: C().columns[ci] }
  return null
}

function chipONada(nombre) {
  if (!nombre) return { error: mal('Falta el chip: por ejemplo «T-1» o «C-1». Usa «grupos» para verlos.') }
  const r = buscarChip(nombre)
  if (!r) return { error: mal(`No hay chip «${nombre}». Usa «grupos» para verlos.`) }
  return r
}

/** Lleva la pantalla a donde se ve el resultado (si no se pidió --quieto) */
function ver(ctx, destino, chip = null) {
  if (ctx.quieto) return
  const ui = usarUI()
  if (chip?.tipo === 'trabe') B().selectSection(chip.idx)
  if (chip?.tipo === 'columna') C().selectColumn(chip.idx)
  if (!destino) return
  if (['detalle', 'calculo', 'columnas'].includes(destino)) ui.irA?.(destino)
  else ui.abrirModulo?.(destino)
}

const miembrosDe = (t) => t.perfil?.members?.map((m) => String(m.id))
  || [...new Set((t.envelope?.points || []).map((p) => String(p.member)))]

const bh = (x, tipo) => (tipo === 'columna' ? `${x.b}×${x.h}` : `${x.ancho}×${x.peralte}`)

// ── Revisión de una trabe (lo mismo que Calculo y su envolvente) ──
export function revisarTrabe(t) {
  const R = computeSectionCapacities(t)
  const MRP = R.resP?.MRT ?? null, MRN = R.resN?.MRT ?? null, VR = R.resC?.Vr ?? null
  const flex = [R.resP, R.resN].filter(Boolean)
  const asMin = flex.every((x) => x.okMin), asMax = flex.every((x) => x.okMax), bMin = flex.every((x) => x.okBmin)
  const d = {
    chip: t.nombre, b: +t.ancho, h: +t.peralte, fc: +t.fc || 250, r: +t.recub || 3,
    armado: textoArmadoTrabe(t), propuesto: !!t.armadoPropuesto,
    MRP, MRN, Vr: VR, asMin, asMax, bMin,
  }
  if (t.envelope?.points?.length) {
    const ev = evaluateBeamEnvelope(t.envelope.points, R, !!t.envelope.invertir, resistenciasConPuntual(t))
    // Un miembro que pasa gracias a sus bastones puntuales (los de Longitudinal)
    // está cubierto: su D/C es contra la resistencia con esos bastones. La de
    // las corridas solas también se da, aparte.
    const efectiva = (r) => (r.conPuntual ? r.utilPunt : r.util)
    let c = null
    for (const r of ev.results) if (!c || efectiva(r) > efectiva(c)) c = r
    Object.assign(d, {
      fuente: 'envolvente', MuP: ev.globalMuP, MuN: ev.globalMuN, Vu: ev.globalVu,
      pasan: ev.passing, total: ev.total, conPuntual: ev.conPuntual || 0,
      dc: c ? efectiva(c) : null, critico: c ? String(c.member) : null,
      dcCorridas: ev.critical ? ev.critical.util : null,
      ok: ev.allOk && asMin && asMax && bMin,
    })
    // lo que manda en el crítico: flexión positiva, negativa o cortante
    if (c) {
      const rP = c.conPuntual ? c.ratioPPunt : c.ratioP, rN = c.conPuntual ? c.ratioNPunt : c.ratioN
      d.manda = c.ratioV >= rP && c.ratioV >= rN ? 'V' : rP >= rN ? 'M+' : 'M-'
    }
  } else {
    const rP = MRP ? R.MuP / MRP : 0, rN = MRN ? R.MuN / MRN : 0, rV = VR && R.VuTon ? R.VuTon / VR : 0
    Object.assign(d, {
      fuente: R.hasData ? 'capturado' : 'sin demanda', MuP: R.MuP, MuN: R.MuN, Vu: R.VuTon,
      dc: R.hasData ? Math.max(rP, rN, rV) : null, critico: null, ok: R.allOk,
    })
  }
  return d
}

const lineaTrabe = (d) => `${marca(d.ok)} ${d.chip} ${d.b}×${d.h} · `
  + `Mu+ ${f2(d.MuP)}/MR+ ${f2(d.MRP)} · Mu− ${f2(d.MuN)}/MR− ${f2(d.MRN)} · Vu ${f2(d.Vu)}/Vr ${f2(d.Vr)} t · `
  + `D/C ${pct(d.dc)}${d.manda ? ` (${d.manda}${d.critico ? ` en M-${d.critico}` : ''})` : ''}`
  + (d.conPuntual ? ` con puntuales (corridas solas ${pct(d.dcCorridas)})` : '')
  + (d.fuente === 'envolvente' ? ` · ${d.pasan}/${d.total} miembros${d.conPuntual ? ` (${d.conPuntual} con puntual)` : ''}` : ` · ${d.fuente}`)
  + (!d.asMin ? ' · As<As mín' : '') + (!d.asMax ? ' · As>As máx' : '') + (!d.bMin ? ' · b<b mín' : '')

// ── Revisión de una columna (lo mismo que la pestaña Columnas) ──
export function revisarColumna(col) {
  let an = null
  try { an = analyzeColumn(col) } catch { /* sección incompleta */ }
  const base = {
    chip: col.nombre, b: +col.b, h: +col.h, fc: +col.fc || 250, armado: textoArmadoColumna(col),
    estribos: estribosDe(col).corto, propuesto: !!col.armadoPropuesto,
  }
  if (!an) return { ...base, ok: false, fuente: 'sin análisis', dc: null }
  const D = columnDemand(col, an)
  const fr = { FRc: an.ntc.FRc, zunchos: an.ntc.fr.zunchos, transicionComoCompresion: an.ntc.fr.transicionComoCompresion, asimetrico: an.ntc.asimetrico, PR0: an.ntc.PR0 }
  if (D.fuente === 'envolvente') {
    const c = D.env.critical
    return {
      ...base, fuente: 'envolvente', ok: D.ok, pasan: D.env.passing, total: D.env.total,
      dc: c ? c.util : null, critico: c ? `${c.member} ${c.tipo || ''}`.trim() : null,
      Pu: c?.Pu ?? null, Mux: c?.Mux ?? null, Muy: c?.Muy ?? null,
      ...(c ? camposNTC(c.bi) : {}), fr,
    }
  }
  if (D.fuente === 'manual') {
    const m = D.manual
    return { ...base, fuente: 'capturado', ok: D.ok, dc: m.bi.dc, Pu: m.Pu, Mux: m.MuX, Muy: m.MuY, ...camposNTC(m.bi), fr }
  }
  return { ...base, fuente: 'sin demanda', ok: true, dc: null, fr }
}

/**
 * Lo que decide una columna según la NTC-Concreto 2023, en campos planos
 * (el mismo objeto de la pestaña Columnas: checkBiaxial).
 */
export function camposNTC(bi) {
  const r = (v, n = 4) => (v == null ? null : !isFinite(v) ? Infinity : +Number(v).toFixed(n))
  const p = bi.punto
  return {
    norma: bi.norma,
    gobierna: bi.gobierna,                       // 'general' | 'aproximado'
    ecuacion: bi.gobiernaEcuacion,               // de qué ecuación sale el D/C
    dcGeneral: r(bi.general.dc),                 // a) 5.4.1.1, eje neutro inclinado
    dc5412: r(bi.aproximado.dc),                 // b) 5.4.1.2
    ecuacion5412: bi.aproximado.ecuacion,        // '5.4.1.2.a' (Bresler) | '5.4.1.2.b' (lineal)
    PR: r(bi.aproximado.PR, 3), PRx: r(bi.aproximado.PRx, 3), PRy: r(bi.aproximado.PRy, 3), PR0: r(bi.aproximado.PR0, 3),
    PRsobrePR0: r(bi.aproximado.relacionPR),
    MRx: r(bi.checkX.MR), MRy: r(bi.checkY.MR), MRtheta: r(bi.general.MR), theta: r(bi.general.thetaGrados, 2),
    MuxDiseno: r(bi.MuxD), MuyDiseno: r(bi.MuyD), eminX: bi.eminX, eminY: bi.eminY,
    FR: p ? r(p.FR) : null, epsT: p ? r(p.epsT, 6) : null, clase: p ? p.clase : null, incisoFR: p ? p.inciso : null,
    FRx: bi.checkX.punto ? r(bi.checkX.punto.FR) : null, epsTx: bi.checkX.punto ? r(bi.checkX.punto.epsT, 6) : null,
    FRy: bi.checkY.punto ? r(bi.checkY.punto.FR) : null, epsTy: bi.checkY.punto ? r(bi.checkY.punto.epsT, 6) : null,
    FRgeneral: bi.general.punto ? r(bi.general.punto.FR) : null, epsTgeneral: bi.general.punto ? r(bi.general.punto.epsT, 6) : null,
  }
}

const lineaColumna = (d) => `${marca(d.ok)} ${d.chip} ${d.b}×${d.h} · ${d.armado} · `
  + (d.dc == null ? d.fuente : `D/C ${pct(d.dc)}${d.critico ? ` (miembro ${d.critico})` : ''} · Pu ${f2(d.Pu)} t · Mux ${f2(d.Mux)} · Muy ${f2(d.Muy)} t·m`)
  + (d.dc == null || d.dcGeneral == null ? '' : ` · NTC: general ${pct(d.dcGeneral)} · ${d.ecuacion5412} ${pct(d.dc5412)} · gobierna ${d.gobierna === 'general' ? 'general' : d.ecuacion5412}`
    + (d.FR != null ? ` · FR ${Number(d.FR).toFixed(2)} (${d.clase})` : ''))
  + (d.fuente === 'envolvente' ? ` · ${d.pasan}/${d.total} puntos` : '')

// ── Longitudinal (lo mismo que el módulo) ────────────────────
export function revisarLongitudinal(t) {
  const perfil = perfilCompleto(t, B().model)
  if (!perfil?.members?.length) return null
  const G = analyzeGroup(t, perfil)
  const malos = G.results.filter((r) => r.status === 'insuficiente' || r.shearFail)
  return {
    chip: t.nombre, n: G.n, ok: G.nOk, conBaston: G.nBast, insuficientes: G.nInsuf, cortante: G.nShear, alFilo: G.nFilo,
    corridoCumple: G.caps.okBase, kg: Math.round(G.acero.total), kgUniforme: G.acero.uniforme != null ? Math.round(G.acero.uniforme) : null,
    bastonesPuntuales: { inf: G.kMaxInf, sup: G.kMaxSup },
    fallan: malos.map((r) => ({ unidad: unitLabel(r), status: r.status, cortante: !!r.shearFail })),
    pasa: G.allOk && G.caps.okBase && !G.nFilo,
  }
}

// ── Cada comando ─────────────────────────────────────────────
// ctx = { quieto, datos }   datos: lo que el script pasa aparte (p. ej. el texto de un modelo.json)

function cEstado() {
  const ui = usarUI()
  const b = B(), c = C()
  return modeloActual().then((m) => {
    const d = {
      version: APP_VERSION, proyecto: ui.proyecto?.() || '', pestana: ui.pestana?.() || '',
      trabes: b.sections.length, columnas: c.columns.length,
      modelo: m ? { archivo: m.archivo, grupos: m.R.grupos.length, miembros: m.R.grupos.reduce((s, g) => s + g.n, 0), at: m.at } : null,
      rutaRam: b.rutaRam || '',
    }
    return carpetaGuardada(d.rutaRam).then(async (h) => {
      d.carpeta = h ? { nombre: h.name, permiso: await permisoDe(h, false, 'readwrite') } : null
      const t = `Auxiliar v${d.version} · proyecto «${d.proyecto || 'sin nombre'}» · ${d.trabes} trabe(s), ${d.columnas} columna(s) · pestaña ${d.pestana}\n`
        + `modelo: ${d.modelo ? `${d.modelo.archivo} · ${d.modelo.grupos} grupos · ${d.modelo.miembros} miembros · ${hace(d.modelo.at)}` : 'ninguno'}\n`
        + `carpeta: ${d.carpeta ? `${d.carpeta.nombre} (${d.carpeta.permiso === 'granted' ? 'lectura y edición' : 'falta el permiso: un clic en 🔄 Sincronizar'})` : 'sin carpeta recordada'}`
      return bien(t, d)
    })
  })
}

/** Aplica el texto de un modelo.json y arma el resumen */
function aplicarYResumir(texto, nombre, ctx) {
  const r = aplicarModeloRam(texto, nombre)
  if (!r.R.ok) return mal(r.nota || 'No se pudo leer el modelo.')
  const lineas = [r.nota]
  if (r.discrepan.length) {
    lineas.push('⚠ MEDIDAS DISTINTAS a las analizadas en RAM: '
      + r.discrepan.map((d) => `${d.nombre} es ${d.b}×${d.h} y en RAM ${d.ancho}×${d.peralte}${d.contradice?.invertida ? ' (invertida: el error está en RAM)' : ''}`).join(' · '))
  }
  if (r.faltan.length) lineas.push(`${r.faltan.length} grupo(s) sin sección en el proyecto: ${r.faltan.map((g) => g.nombre).join(', ')} → «ram crear»`)
  if (r.sinDescripcion) lineas.push(`${r.sinDescripcion} miembro(s) sin descripción: falta agrupar → «agrupar»`)
  for (const w of r.R.warnings || []) lineas.push(`aviso: ${w}`)
  const ok = !r.discrepan.length
  usarUI().toast?.(lineas[0], ok ? 'ok' : 'warn')
  ver(ctx, 'detalle')
  return { ok: true, texto: lineas.join('\n'), datos: {
    grupos: r.R.grupos.map((g) => ({ nombre: g.nombre, n: g.n, seccion: g.seccion })),
    discrepan: r.discrepan.map((d) => ({ chip: d.nombre, app: `${d.b}×${d.h}`, ram: `${d.ancho}×${d.peralte}`, invertida: !!d.contradice?.invertida })),
    faltan: r.faltan.map((g) => g.nombre), sinDescripcion: r.sinDescripcion, avisos: r.R.warnings || [],
  } }
}

/** ram sync | ram cargar <url> | ram faltan | ram crear */
async function cRam(args, ctx) {
  const [sub, url] = args.pos
  if (sub === 'sync' || sub === 'sincronizar') {
    const ruta = B().rutaRam || ''
    const h = await carpetaGuardada(ruta)
    if (!h) {
      return mal('No hay carpeta de la obra recordada. Un ingeniero la elige una vez en 📥 Reportes de RAM → 🔄 Elegir la carpeta y sincronizar… '
        + '(el navegador pide un clic real). Para practicar sin carpeta: «ram cargar <url del modelo.json>».')
    }
    const escribe = (await permisoDe(h, false, 'readwrite')) === 'granted'
    if (!escribe) {
      let p = await permisoDe(h, false, 'read')
      if (p !== 'granted') p = await permisoDe(h, true, 'read')   // sólo funciona si viene de una tecla
      if (p !== 'granted') return mal(`El navegador no deja leer «${h.name}» sin un clic: dale una vez a 🔄 Sincronizar con RAM en el Centro de carga.`)
    }
    let texto
    try { texto = await (await (await h.getFileHandle('modelo.json')).getFile()).text() } catch {
      return mal(`«${h.name}» no tiene modelo.json (o está sólo en la nube). Corre sincronizar.py en RAM; los reportes .txt se cargan en el Centro de carga.`)
    }
    const previo = await modeloGuardado()
    const r = aplicarYResumir(texto, 'modelo.json', ctx)
    if (r.ok && escribe) {
      setCarpetaActiva(h, ruta)
      // el modelo que se acaba de reemplazar, a 3 Respaldos (como el botón)
      if (previo?.datos && previo.datos !== texto) { try { await respaldarModelo(previo.datos, previo.at) } catch { /* nunca estorba */ } }
    }
    return r
  }
  if (sub === 'cargar') {
    let texto = ctx.datos?.texto
    let nombre = ctx.datos?.nombre || 'modelo.json'
    if (!texto) {
      if (!url) return mal('Uso: ram cargar <url> (de este mismo servidor), o desde un script: auxiliarIV.cmd("ram cargar", { texto })')
      const b = await bajarLocal(url)
      if (b.error) return mal(b.error)
      texto = b.texto
      nombre = b.nombre || nombre
    }
    return aplicarYResumir(texto, nombre, ctx)
  }
  if (sub === 'faltan' || sub === 'crear') {
    const m = await modeloActual()
    if (!m) return mal('No hay modelo sincronizado: «ram sync» o «ram cargar <url>».')
    const faltan = gruposSinSeccion(m.R)
    if (sub === 'faltan') {
      if (!faltan.length) return bien('Todos los grupos del modelo ya tienen sección.', { faltan: [] })
      return bien(`${faltan.length} grupo(s) sin sección: ${faltan.map((g) => `${g.nombre} (${g.n} miembros, ${g.seccion || 'sin sección'})`).join(', ')}`, { faltan: faltan.map((g) => g.nombre) })
    }
    if (!faltan.length) return bien('No hay nada que crear: todos los grupos ya tienen sección.', { props: [] })
    const { props } = await crearSeccionesDesdeModelo(faltan)
    const nOk = props.filter((p) => p.estado === 'ok').length
    const lineas = [`Creadas ${props.length} sección(es) con su armado PROPUESTO: ${nOk} pasan${nOk < props.length ? `, ${props.length - nOk} a revisar` : ''}`]
    for (const p of props) {
      lineas.push(`${p.estado === 'ok' ? '✓' : '✗'} ${p.nombre} ${p.bh} · ${p.n} miembros · ${p.texto}${p.kg ? ` · ${Math.round(p.kg)} kg` : ''}`
        + (p.motivos.length ? ` · ${p.motivos.join('; ')}` : '') + (p.avisos.length ? ` · ⚠ ${p.avisos.join('; ')}` : ''))
    }
    usarUI().toast?.(lineas[0], nOk === props.length ? 'ok' : 'warn')
    ver(ctx, 'detalle')
    return bien(lineas.join('\n'), { props })
  }
  return mal('Uso: ram sync · ram cargar <url> · ram faltan · ram crear')
}

function cGrupos(args) {
  const filtro = args.pos[0]?.toLowerCase()
  const lineas = []
  const datos = { trabes: [], columnas: [] }
  if (filtro !== 'columnas') {
    for (const t of B().sections) {
      const n = miembrosDe(t).length
      datos.trabes.push({ chip: t.nombre, b: +t.ancho, h: +t.peralte, fc: +t.fc || 250, armado: textoArmadoTrabe(t), miembros: n, propuesto: !!t.armadoPropuesto })
      lineas.push(`${t.nombre} ${t.ancho}×${t.peralte} f'c${t.fc || 250} · ${textoArmadoTrabe(t)} · ${n} miembros${t.armadoPropuesto ? ' · propuesto' : ''}`)
    }
  }
  if (filtro !== 'trabes') {
    for (const c of C().columns) {
      const n = [...new Set((c.envelope?.points || []).map((p) => String(p.member)))].length
      datos.columnas.push({ chip: c.nombre, b: +c.b, h: +c.h, fc: +c.fc || 250, armado: textoArmadoColumna(c), miembros: n, propuesto: !!c.armadoPropuesto })
      lineas.push(`${c.nombre} ${c.b}×${c.h} f'c${c.fc || 250} · ${textoArmadoColumna(c)} · ${n} miembros${c.armadoPropuesto ? ' · propuesto' : ''}`)
    }
  }
  if (!lineas.length) return bien('El proyecto no tiene chips. «ram sync» y «ram crear» los traen del modelo.', datos)
  return bien(lineas.join('\n'), datos)
}

function cMiembros(args) {
  const ch = chipONada(args.pos[0])
  if (ch.error) return ch.error
  const ids = ch.tipo === 'trabe' ? miembrosDe(ch.chip) : [...new Set((ch.chip.envelope?.points || []).map((p) => String(p.member)))]
  if (!ids.length) return bien(`${ch.chip.nombre}: sin miembros (no tiene demandas del modelo).`, { chip: ch.chip.nombre, miembros: [] })
  const Lpor = ch.chip.perfil?.Lpor || {}
  const L = (id) => {
    const m = ch.chip.perfil?.members?.find((x) => String(x.id) === id)
    return m?.Lreport || Lpor[id] || null
  }
  const lista = ids.map((id) => ({ id, L: L(id) }))
  return bien(`${ch.chip.nombre}: ${ids.length} miembros · ${lista.map((m) => (m.L ? `${m.id} (${f2(m.L)} m)` : m.id)).join(', ')}`, { chip: ch.chip.nombre, miembros: lista })
}

function cSel(args, ctx) {
  const ch = chipONada(args.pos[0])
  if (ch.error) return ch.error
  if (ch.tipo === 'trabe') B().selectSection(ch.idx)
  else C().selectColumn(ch.idx)
  if (!ctx.quieto) usarUI().irA?.(ch.tipo === 'trabe' ? 'detalle' : 'columnas')
  return bien(`${ch.chip.nombre} seleccionado (${ch.tipo}).`, { chip: ch.chip.nombre, tipo: ch.tipo })
}

// «3#4» → { n: 3, cal: '4' } · «0» → { n: 0 }
function leerBarras(v, opciones, que) {
  const s = String(v).trim().replace(/^#/, '')
  if (s === '0') return { n: 0 }
  const m = /^(\d+)\s*#\s*(\d+(?:\.5)?)$/.exec(s)
  if (!m) throw new Error(`${que}: escribe cantidad#calibre, por ejemplo 3#4`)
  if (!opciones.includes(m[2])) throw new Error(`${que}: el calibre #${m[2]} no está en la app (${opciones.map((x) => `#${x}`).join(', ')})`)
  return { n: +m[1], cal: m[2] }
}

const num = (v, que, { min = 0 } = {}) => {
  const x = Number(String(v).replace(',', '.'))
  if (!isFinite(x) || x <= min) throw new Error(`${que} inválido: ${v}`)
  return x
}

/**
 * fijar <chip> b= h= r= fc= inf= sup= binf= bsup= est=   (trabes)
 * fijar <chip> b= h= r= fc= lechos=3#5,2#5,3#5 est= sep=   (columnas)
 */
function cFijar(args, ctx) {
  const ch = chipONada(args.pos[0])
  if (ch.error) return ch.error
  const kv = args.kv
  if (!Object.keys(kv).length) return mal('Uso: fijar T-1 b=20 h=40 inf=3#4 sup=2#4 binf=1#4 bsup=0 est=2.5@8/16 (columnas: fijar C-1 b=30 h=30 lechos=3#5,2#5,3#5 est=3 sep=10/15)')
  const patch = {}
  let cambiaSeccion = false
  try {
    if (ch.tipo === 'trabe') {
      const conocidas = ['b', 'h', 'r', 'fc', 'inf', 'sup', 'binf', 'bsup', 'est']
      const otras = Object.keys(kv).filter((k) => !conocidas.includes(k))
      if (otras.length) throw new Error(`no conozco ${otras.join(', ')} (uso: ${conocidas.join(' ')})`)
      if (kv.b) { patch.ancho = num(kv.b, 'b'); cambiaSeccion = true }
      if (kv.h) { patch.peralte = num(kv.h, 'h'); cambiaSeccion = true }
      if (kv.r) patch.recub = num(kv.r, 'r')
      if (kv.fc) patch.fc = num(kv.fc, "f'c")
      if (kv.inf) { const x = leerBarras(kv.inf, REBAR_OPTIONS, 'inf'); if (!x.n) throw new Error('inf: el lecho inferior lleva al menos 2 varillas'); patch.cantInf = x.n; patch.calInf = x.cal }
      if (kv.sup) { const x = leerBarras(kv.sup, REBAR_OPTIONS, 'sup'); if (!x.n) throw new Error('sup: el lecho superior lleva al menos 2 varillas'); patch.cantSup = x.n; patch.calSup = x.cal }
      if (kv.binf) { const x = leerBarras(kv.binf, REBAR_OPTIONS, 'binf'); patch.cantBastonInf = x.n; if (x.cal) patch.calBastonInf = x.cal }
      if (kv.bsup) { const x = leerBarras(kv.bsup, REBAR_OPTIONS, 'bsup'); patch.cantBastonSup = x.n; if (x.cal) patch.calBastonSup = x.cal }
      if (kv.est) {
        const m = /^#?(\d+(?:\.5)?)?(?:@(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?)?$/.exec(kv.est.trim())
        if (!m || (!m[1] && !m[2])) throw new Error('est: escribe calibre@extremos/centro, por ejemplo 2.5@8/16')
        if (m[1]) { if (!STIRRUP_OPTIONS.includes(m[1])) throw new Error(`est: el estribo #${m[1]} no está en la app (${STIRRUP_OPTIONS.map((x) => `#${x}`).join(', ')})`); patch.calEst = m[1] }
        if (m[2]) patch.sepLcuarto = +m[2]
        if (m[3]) patch.sepRest = +m[3]
      }
    } else {
      const conocidas = ['b', 'h', 'r', 'fc', 'lechos', 'est', 'sep']
      const otras = Object.keys(kv).filter((k) => !conocidas.includes(k))
      if (otras.length) throw new Error(`no conozco ${otras.join(', ')} (uso: ${conocidas.join(' ')})`)
      if (kv.b) { patch.b = num(kv.b, 'b'); cambiaSeccion = true }
      if (kv.h) { patch.h = num(kv.h, 'h'); cambiaSeccion = true }
      if (kv.r) patch.r = num(kv.r, 'r')
      if (kv.fc) patch.fc = num(kv.fc, "f'c")
      if (kv.lechos) {
        const lechos = kv.lechos.split(',').map((x, i) => leerBarras(x, REBAR_OPTIONS, `lecho ${i + 1}`))
        if (lechos.length < 2 || lechos.length > 8) throw new Error('lechos: entre 2 y 8 lechos, de la cara superior a la inferior')
        if (lechos.some((L) => !L.n)) throw new Error('lechos: cada lecho lleva al menos una varilla')
        patch.nLechos = lechos.length
        patch.lechos = lechos.map((L) => ({ n: L.n, num: L.cal }))
      }
      if (kv.est) {
        const e = kv.est.replace(/^#/, '')
        if (!STIRRUP_OPTIONS.includes(e)) throw new Error(`est: el estribo #${e} no está en la app (${STIRRUP_OPTIONS.map((x) => `#${x}`).join(', ')})`)
        patch.estriboNum = e
      }
      if (kv.sep) {
        const m = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(kv.sep)
        if (!m) throw new Error('sep: escribe extremos/centro en cm, por ejemplo 10/15')
        patch.sepExt = +m[1]; patch.sepCen = +(m[2] || m[1])
      }
    }
  } catch (e) { return mal(e.message) }

  // Lo que fija la consola es un borrador: queda como «armado propuesto»
  // hasta que un ingeniero lo edita o lo acepta en la pantalla.
  patch.armadoPropuesto = true
  if (ch.tipo === 'trabe') B().patchSectionAt(ch.idx, patch)
  else C().patchColumnAt(ch.idx, patch)
  ver(ctx, ch.tipo === 'trabe' ? 'detalle' : 'columnas', ch)

  const nuevo = ch.tipo === 'trabe' ? B().sections[ch.idx] : C().columns[ch.idx]
  const d = ch.tipo === 'trabe' ? revisarTrabe(nuevo) : revisarColumna(nuevo)
  const lineas = [`${nuevo.nombre} fijado (propuesto): ${bh(nuevo, ch.tipo)} · ${d.armado}${ch.tipo === 'columna' ? ` · ${d.estribos}` : ''}`,
    ch.tipo === 'trabe' ? lineaTrabe(d) : lineaColumna(d)]
  if (cambiaSeccion) {
    lineas.push('⚠ Cambió la sección (b×h): las demandas son de RAM con la sección anterior. El cambio tiene que ir a RAM '
      + '(lo aplica el Modelador con aprobación de un ingeniero), reanalizar y sincronizar.')
  }
  return bien(lineas.join('\n'), { chip: nuevo.nombre, patch, revision: d })
}

function cCalculo(args, ctx) {
  const ch = chipONada(args.pos[0])
  if (ch.error) return ch.error
  if (ch.tipo === 'columna') return cColumnas(args, ctx)
  const d = revisarTrabe(ch.chip)
  ver(ctx, 'calculo', ch)
  return bien(`${lineaTrabe(d)}\n${d.armado}${d.propuesto ? ' · propuesto' : ''}`, d)
}

function cColumnas(args, ctx) {
  const nombre = args.pos[0]
  if (!nombre) {
    const ds = C().columns.map(revisarColumna)
    ver(ctx, 'columnas')
    if (!ds.length) return bien('El proyecto no tiene columnas.', [])
    return bien(ds.map(lineaColumna).join('\n'), ds)
  }
  const ch = chipONada(nombre)
  if (ch.error) return ch.error
  if (ch.tipo !== 'columna') return mal(`${ch.chip.nombre} es una trabe: usa «calculo ${ch.chip.nombre}».`)
  const d = revisarColumna(ch.chip)
  ver(ctx, 'columnas', ch)
  return bien(`${lineaColumna(d)}\n${d.estribos}${d.propuesto ? ' · propuesto' : ''}`, d)
}

function cLongitudinal(args, ctx) {
  const lista = args.pos[0] ? [chipONada(args.pos[0])] : B().sections.map((chip, idx) => ({ tipo: 'trabe', idx, chip }))
  if (lista[0]?.error) return lista[0].error
  const out = []
  const lineas = []
  for (const ch of lista) {
    if (ch.tipo !== 'trabe') return mal(`${ch.chip.nombre} es una columna: Longitudinal es de trabes.`)
    let r = null
    try { r = revisarLongitudinal(ch.chip) } catch (e) { lineas.push(`✗ ${ch.chip.nombre}: ${e.message}`); continue }
    if (!r) { lineas.push(`· ${ch.chip.nombre}: sin perfil por estaciones (sincroniza el modelo)`); continue }
    out.push(r)
    lineas.push(`${marca(r.pasa)} ${r.chip} · ${r.n} unidades: ${r.ok} con corridas, ${r.conBaston} con bastón`
      + (r.insuficientes ? `, ${r.insuficientes} insuficientes` : '') + (r.cortante ? `, ${r.cortante} por cortante` : '')
      + (r.alFilo ? `, ${r.alFilo} al filo` : '') + ` · acero ${r.kg} kg${r.kgUniforme != null ? ` (uniforme ${r.kgUniforme})` : ''}`
      + ` · puntuales inf ${r.bastonesPuntuales.inf} sup ${r.bastonesPuntuales.sup}`
      + (!r.corridoCumple ? ' · corrido no cumple As mín/b mín' : '')
      + (r.fallan.length ? ` · fallan: ${r.fallan.slice(0, 12).map((f) => f.unidad).join(', ')}${r.fallan.length > 12 ? '…' : ''}` : ''))
  }
  ver(ctx, 'longitudinal', args.pos[0] ? lista[0] : null)
  if (!lineas.length) return bien('El proyecto no tiene trabes.', [])
  return bien(lineas.join('\n'), args.pos[0] ? out[0] || null : out)
}

const DEF_GUARDADO = 'auxiv.deflexiones.config.v2'   // el mismo que usa el módulo Deflexiones

async function cDeflexiones(args, ctx) {
  const m = await modeloActual()
  if (!m) return mal('No hay modelo sincronizado: «ram sync» o «ram cargar <url>».')
  if (!m.R.flechas) return mal('El modelo no trae desplazamientos: genera otra vez sincronizar.py desde la app y córrelo en RAM.')
  let cfg = { fSost: 1, post: true, roles: null }
  try { cfg = { ...cfg, ...(JSON.parse(localStorage.getItem(DEF_GUARDADO) || 'null') || {}) } } catch { /* los de fábrica */ }
  const casos = m.R.flechas.casos || []
  const def = rolesPorDefecto(casos)
  const roles = Object.fromEntries(casos.map((c) => [c.id, cfg.roles?.[c.id] || def[c.id]]))
  let res = revisarModelo(m.R, B().sections, { roles, fSost: cfg.fSost, post: cfg.post })
  const filtro = args.pos[0] ? normName(args.pos[0]) : null
  if (filtro) res = res.filter((r) => normName(r.tramo.grupo) === filtro)
  const peor = (r) => (cfg.post ? Math.max(r.u.total, r.u.post) : r.u.total)
  res.sort((a, b) => peor(b) - peor(a))
  const no = res.filter((r) => r.estado === 'no'), sin = res.filter((r) => r.sinArmado)
  const lineas = [`${formulaServicio(roles)} · ${res.length} tramo(s) · ${no.length} no pasan · ${sin.length} sin armado`
    + (res[0] ? ` · peor ${res[0].tramo.grupo} tramo ${res[0].tramo.id}: ${pct(peor(res[0]))} del límite` : '')]
  const mostrar = args.flags.has('todos') ? res : res.filter((r) => r.estado !== 'ok').slice(0, 15)
  for (const r of mostrar) {
    lineas.push(`${r.estado === 'ok' ? '✓' : r.sinArmado ? '?' : '✗'} ${r.tramo.grupo} tramo ${r.tramo.id} L ${f2(r.tramo.L)} m${r.tramo.tipo === 'voladizo' ? ' voladizo' : ''} · `
      + `total ${f2(r.total)}/${f2(r.lim.total)} cm (${pct(r.u.total)})${cfg.post ? ` · posterior ${f2(r.post)}/${f2(r.lim.post)} cm (${pct(r.u.post)})` : ''}${r.sinArmado ? ' · sin armado' : ''}`)
  }
  ver(ctx, 'deflexiones')
  return bien(lineas.join('\n'), {
    formula: formulaServicio(roles), tramos: res.length, noPasan: no.length, sinArmado: sin.length,
    lista: mostrar.map((r) => ({ grupo: r.tramo.grupo, tramo: r.tramo.id, L: r.tramo.L, tipo: r.tramo.tipo, estado: r.estado, total: r.total, limTotal: r.lim.total, post: r.post, limPost: r.lim.post, u: r.u })),
  })
}

// ── BD Global ────────────────────────────────────────────────
let ultimaBusqueda = []

const textoViga = (d) => `${d.b}×${d.h} · inf ${d.nP}#${d.vP}${d.bP ? ` +${d.bP[0]}#${d.bP[1]} b` : ''} · sup ${d.nN}#${d.vN}${d.bN ? ` +${d.bN[0]}#${d.bN[1]} b` : ''}`
  + ` · MR+ ${f2(d.MRT_P)} MR− ${f2(d.MRT_N)} t·m · uso ${pct(d.ratio)}`

const lista = (v) => (v ? new Set(String(v).split(',').map(Number).filter((x) => x > 0)) : null)

function cBd(args, ctx) {
  const [a1, a2, a3] = args.pos
  if (!a1) {
    const s = getStats()
    return bien(`BD Global: ${s.total} trabes (${s.fabrica} de fábrica, ${s.usuario} del usuario). Uso: bd <Mu+> <Mu−> [b=15,20] [h=30,35] [n=5] · bd usar <n> <chip>`, s)
  }
  if (a1 === 'usar') {
    const i = +a2
    const d = ultimaBusqueda[i - 1]
    if (!d) return mal(ultimaBusqueda.length ? `No hay resultado ${a2}: van del 1 al ${ultimaBusqueda.length}.` : 'Primero busca: bd <Mu+> <Mu−>.')
    const ch = chipONada(a3)
    if (ch.error) return ch.error
    if (ch.tipo !== 'trabe') return mal('La BD Global es de trabes.')
    // el mismo cambio que el botón «Usar» de BD Global, marcado como propuesta
    const patch = {
      ancho: d.b, peralte: d.h, cantInf: d.nP, calInf: String(d.vP), cantSup: d.nN, calSup: String(d.vN),
      cantBastonInf: d.bP ? d.bP[0] : 0, calBastonInf: d.bP ? String(d.bP[1]) : '3',
      cantBastonSup: d.bN ? d.bN[0] : 0, calBastonSup: d.bN ? String(d.bN[1]) : '3',
      muPos: d.MuP || '', muNeg: d.MuN || '', armadoPropuesto: true,
    }
    const cambia = +ch.chip.ancho !== d.b || +ch.chip.peralte !== d.h
    B().patchSectionAt(ch.idx, patch)
    ver(ctx, 'detalle', ch)
    const r = revisarTrabe(B().sections[ch.idx])
    usarUI().toast?.(`Sección ${d.b}×${d.h} aplicada a ${ch.chip.nombre}`, 'ok')
    return bien(`${ch.chip.nombre} ← ${textoViga(d)} (propuesto)\n${lineaTrabe(r)}`
      + (cambia ? '\n⚠ Cambió la sección (b×h): el cambio tiene que ir a RAM (Modelador, con aprobación de un ingeniero), reanalizar y sincronizar.' : ''), { chip: ch.chip.nombre, patch, revision: r })
  }
  let MuP, MuN
  try { MuP = num(a1, 'Mu+', { min: -1 }); MuN = num(a2 ?? 0, 'Mu−', { min: -1 }) } catch (e) { return mal(`${e.message}. Uso: bd <Mu+> <Mu−> [b=15,20] [h=30,35] [n=5]`) }
  if (MuP <= 0 && MuN <= 0) return mal('Ingresa al menos un Mu (t·m).')
  const res = searchByMoments(MuP, MuN, { restrictB: lista(args.kv.b), restrictH: lista(args.kv.h), limit: +args.kv.n || 5 })
  ultimaBusqueda = res
  if (!res.length) return bien(`Ninguna sección de la BD cubre Mu+ ${MuP} / Mu− ${MuN} t·m con esas restricciones.`, [])
  return bien(`${res.length} sección(es) pasan Mu+ ${MuP} / Mu− ${MuN} t·m (de menos acero a más):\n`
    + res.map((d, i) => `${i + 1}) ${textoViga(d)}`).join('\n') + '\n→ «bd usar <n> <chip>» para aplicarla', res.map((d) => ({
    b: d.b, h: d.h, inf: `${d.nP}#${d.vP}`, sup: `${d.nN}#${d.vN}`, binf: d.bP ? `${d.bP[0]}#${d.bP[1]}` : null, bsup: d.bN ? `${d.bN[0]}#${d.bN[1]}` : null,
    MRP: d.MRT_P, MRN: d.MRT_N, uso: d.ratio,
  })))
}

// ── Agrupación (sólo propone) ────────────────────────────────
async function cAgrupar(args, ctx) {
  const m = await modeloActual()
  if (!m) return mal('No hay modelo sincronizado: «ram sync» o «ram cargar <url>».')
  const R = m.R
  const esCol = ['columnas', 'columna', 'c'].includes(args.pos[0]?.toLowerCase())
  const inv = inventario(R)
  const nombres = args.kv.grupos ? args.kv.grupos.split(',').map((s) => s.trim()).filter(Boolean)
    : inv.filter((g) => (esCol ? g.tipo === 'columna' : g.sugerido)).map((g) => g.nombre)
  if (!nombres.length) return mal(`El modelo no tiene grupos de ${esCol ? 'columnas' : 'trabes'} que agrupar.`)
  let P
  try {
    P = esCol ? proponerColumnas(R, nombres) : proponerAgrupacion(R, nombres, { anchos: [...(lista(args.kv.anchos) || [15, 20, 25])], ...(args.kv.peraltes ? { peraltes: [...lista(args.kv.peraltes)] } : {}) })
  } catch (e) { return mal(`No se pudo proponer: ${e.message}`) }
  const verificar = args.flags.has('verificar')
  const hoy = P.hoy.concreto
  const lineas = [`Agrupación de ${esCol ? 'columnas' : 'trabes'} (sólo propuesta) · grupos de RAM: ${nombres.join(', ')} · hoy ${P.hoy.grupos} grupo(s), ${f2(hoy)} m³`]
  const datos = { pieza: esCol ? 'columna' : 'trabe', grupos: nombres, hoy: P.hoy, propuestas: [] }
  for (const p of P.propuestas) {
    const dC = hoy > 0 ? Math.round(((p.concreto - hoy) / hoy) * 100) : null
    lineas.push(`■ ${p.nombre}: ${p.grupos.length} grupos · ${f2(p.concreto)} m³${dC != null ? ` (${dC >= 0 ? '+' : ''}${dC} % vs hoy)` : ''}${p.fuera ? ` · ${p.fuera} fuera de catálogo` : ''}`)
    const dp = { id: p.id, nombre: p.nombre, concreto: p.concreto, grupos: [] }
    for (const g of p.grupos) {
      let v = null
      if (verificar) { try { v = esCol ? verificarColumnas(R, g) : verificarGrupo(R, g) } catch { v = null } }
      dp.grupos.push({ nombre: g.nombre, seccion: g.sec ? `${g.sec.b}×${g.sec.h}` : null, elementos: g.elems.length, miembros: g.miembros.length, uMin: g.uMin, uMax: g.uMax, fuera: !!g.fuera, ...(v ? { estado: v.estado, kg: v.kg, motivos: v.motivos } : {}) })
      lineas.push(`  ${v ? (v.estado === 'ok' ? '✓' : '✗') : '·'} ${g.nombre} ${g.sec ? `${g.sec.b}×${g.sec.h}` : '—'}${g.fuera ? ' ⚠' : ''} · ${g.elems.length} ${esCol ? 'columnas' : 'trabes'} · ${g.miembros.length} miembros · aprov ${pct(g.uMin)}–${pct(g.uMax)}`
        + (v ? ` · ${v.kg ? `${Math.round(v.kg)} kg` : ''}${v.motivos?.length ? ` · ${v.motivos[0]}` : ''}` : ''))
    }
    datos.propuestas.push(dp)
  }
  lineas.push('La elige un ingeniero en Agrupación. aplicar_agrupacion.py lo genera la app ahí y lo corre el Modelador en RAM con su aprobación; la consola no lo hace.')
  ver(ctx, 'agrupacion')
  return bien(lineas.join('\n'), datos)
}

// ── Resultados: demanda/capacidad de todo ────────────────────
function cResultados() {
  const T = B().sections.map(revisarTrabe)
  const K = C().columns.map(revisarColumna)
  const orden = (a, b) => (b.dc ?? -1) - (a.dc ?? -1)
  const lineas = [`${T.length} trabe(s): ${T.filter((d) => d.ok).length} ✓, ${T.filter((d) => !d.ok).length} ✗ · `
    + `${K.length} columna(s): ${K.filter((d) => d.ok).length} ✓, ${K.filter((d) => !d.ok).length} ✗`]
  for (const d of [...T].sort(orden)) lineas.push(lineaTrabe(d))
  for (const d of [...K].sort(orden)) lineas.push(lineaColumna(d))
  return bien(lineas.join('\n'), { trabes: T, columnas: K })
}

// ── Exportar ─────────────────────────────────────────────────
const SALIDAS = {
  dxf: ['exportarDxf', 'DXF de cortes'],
  svg: ['exportarSvg', 'SVG de cortes'],
  pdf: ['verificarResumido', 'verificación Resumido (PDF)'],
  detallado: ['verificarDetallado', 'verificación Detallado (HTML, en ventana nueva)'],
  dcheck: ['exportarDcheck', 'Double Check (.dcheck)'],
}

async function cExportar(args) {
  const que = args.pos[0]?.toLowerCase()
  const s = SALIDAS[que]
  if (!s) return mal(`Uso: exportar ${Object.keys(SALIDAS).join('|')}`)
  if (!B().sections.length && !C().columns.length) return mal('El proyecto no tiene trabes ni columnas que exportar.')
  const fn = usarUI()[s[0]]
  if (!fn) return mal('La pantalla todavía no está lista.')
  const r = await fn()
  const donde = r?.donde === 'carpeta' ? `guardado en ${r.ruta}` : r?.donde === 'descarga' ? `descargado (${r.ruta})` : 'hecho'
  return bien(`${s[1]}: ${donde}`, { salida: que, ...(r || {}) })
}

async function cGuardar() {
  const fn = usarUI().guardar
  if (!fn) return mal('La pantalla todavía no está lista.')
  if (!B().sections.length && !C().columns.length) return mal('El proyecto está vacío.')
  const r = await fn()
  if (r?.cancelado) return mal('No se guardó: la carpeta tiene otro proyecto.')
  return bien(`Proyecto ${r?.donde === 'carpeta' ? `guardado en ${r.ruta}; el anterior quedó en 3 Respaldos` : `descargado (${r?.ruta || ''})`}`, r || {})
}

/** Baja un archivo de este mismo servidor (la consola no trae nada de internet) */
async function bajarLocal(url) {
  let u
  try { u = new URL(url, window.location.href) } catch { return { error: `URL inválida: ${url}` } }
  if (u.origin !== window.location.origin) return { error: 'Sólo se cargan archivos de este mismo servidor.' }
  const res = await fetch(u.href, { cache: 'no-store' })
  if (!res.ok) return { error: `No se pudo bajar ${u.pathname}: HTTP ${res.status}` }
  return { texto: await res.text(), nombre: decodeURIComponent(u.pathname.split('/').pop() || '') }
}

const SIN_RECIENTES = 'No se hizo nada: el navegador no dejó guardar lo actual en Recientes (¿sin espacio?). Guarda antes con «guardar».'

/** proyecto · proyecto nuevo [nombre] · proyecto abrir <url> (autorizado por FB, 2026-11-09) */
async function cProyecto(args, ctx) {
  const [sub, ...resto] = args.pos
  const ui = usarUI()
  if (!sub) {
    return bien(`Proyecto «${ui.proyecto?.() || 'sin nombre'}» · ${B().sections.length} trabe(s), ${C().columns.length} columna(s)`,
      { proyecto: ui.proyecto?.() || '', trabes: B().sections.length, columnas: C().columns.length })
  }
  if (sub === 'nuevo') {
    if (!ui.nuevoProyecto) return mal('La pantalla todavía no está lista.')
    const nombre = resto.join(' ').trim()
    const r = ui.nuevoProyecto(nombre)
    if (r?.sinRecientes) return mal(SIN_RECIENTES)
    ui.toast?.(`Proyecto nuevo «${nombre || 'sin nombre'}»${r?.aRecientes ? ` · «${r.aRecientes}» quedó en Recientes` : ''}`)
    ver(ctx, 'detalle')
    const m = await modeloActual()
    const d = { proyecto: nombre, trabes: B().sections.length, columnas: C().columns.length, aRecientes: r?.aRecientes || null, modeloSincronizado: m ? m.archivo : null }
    return bien(`Proyecto nuevo «${nombre || 'sin nombre'}» · ${d.trabes} trabes, ${d.columnas} columnas`
      + (d.aRecientes ? ` · el anterior («${d.aRecientes}») quedó en Recientes` : ' · no había nada que guardar')
      + (m ? `\nOjo: el modelo de RAM sincronizado sigue siendo el anterior (${m.archivo}): «ram cargar <url>» o «ram sync» antes de «ram crear».` : ''), d)
  }
  if (sub === 'abrir') {
    if (!ui.abrirProyecto) return mal('La pantalla todavía no está lista.')
    let texto = ctx.datos?.texto
    let nombre = ctx.datos?.nombre || 'proyecto.json'
    if (!texto) {
      if (!resto[0]) return mal('Uso: proyecto abrir <url> (de este mismo servidor), o desde un script: auxiliarIV.cmd("proyecto abrir", { texto })')
      const b = await bajarLocal(resto[0])
      if (b.error) return mal(b.error)
      texto = b.texto
      nombre = b.nombre || nombre
    }
    let data
    try { data = JSON.parse(texto) } catch { return mal(`${nombre} no es un JSON válido.`) }
    const r = ui.abrirProyecto(data, nombre)
    if (r?.invalido) return mal(`${nombre} no tiene secciones: no parece un proyecto de la app.`)
    if (r?.sinRecientes) return mal(SIN_RECIENTES)
    ver(ctx, 'detalle')
    const d = { proyecto: data.projectName || '', archivo: nombre, trabes: B().sections.length, columnas: C().columns.length, aRecientes: r?.aRecientes || null }
    return bien(`Abierto ${nombre}: proyecto «${d.proyecto || 'sin nombre'}» · ${d.trabes} trabes, ${d.columnas} columnas`
      + (d.aRecientes ? ` · el anterior («${d.aRecientes}») quedó en Recientes` : ''), d)
  }
  return mal('Uso: proyecto · proyecto nuevo [nombre] · proyecto abrir <url>')
}

const PESTANAS = {
  secciones: 'detalle', detalle: 'detalle', calculo: 'calculo', 'cálculo': 'calculo', columnas: 'columnas',
  longitudinal: 'longitudinal', agrupacion: 'agrupacion', 'agrupación': 'agrupacion', deflexiones: 'deflexiones',
  bd: 'bdglobal', bdglobal: 'bdglobal', pesos: 'pesos', cimentaciones: 'cimentaciones',
}

function cIr(args) {
  const p = args.pos[0]?.toLowerCase()
  const ui = usarUI()
  if (p === 'centro' || p === 'ram') { ui.abrirCentro?.(); return bien('Centro de carga abierto (📥 Reportes de RAM).') }
  const id = PESTANAS[p]
  if (!id) return mal(`Uso: ir ${[...new Set(Object.keys(PESTANAS).filter((k) => /^[a-z]+$/.test(k)))].join('|')}|centro`)
  if (['detalle', 'calculo', 'columnas'].includes(id)) ui.irA?.(id)
  else ui.abrirModulo?.(id)
  return bien(`Pestaña ${p}.`)
}

// ── La tabla de comandos ─────────────────────────────────────
export const COMANDOS = [
  { nombre: 'ayuda', uso: 'ayuda [comando]', que: 'esta lista, o el uso de un comando' },
  { nombre: 'estado', uso: 'estado', que: 'proyecto, chips, modelo sincronizado y carpeta', fn: cEstado },
  { nombre: 'proyecto', uso: 'proyecto | proyecto nuevo [nombre] | proyecto abrir <url>', que: 'empieza un proyecto vacío o abre un proyecto.json (lo de antes queda en Recientes)', fn: cProyecto },
  { nombre: 'ram', uso: 'ram sync | ram cargar <url> | ram faltan | ram crear', que: 'sincronizar con RAM (modelo.json de la carpeta o de una URL) y crear las secciones que faltan con su armado propuesto', fn: cRam },
  { nombre: 'grupos', uso: 'grupos [trabes|columnas]', que: 'los chips con su sección y su armado', fn: cGrupos },
  { nombre: 'miembros', uso: 'miembros <chip>', que: 'los miembros de RAM de un chip, con su longitud', fn: cMiembros },
  { nombre: 'sel', uso: 'sel <chip>', que: 'selecciona un chip y lo muestra', fn: cSel },
  { nombre: 'fijar', uso: 'fijar <chip> b= h= r= fc= inf=3#4 sup=2#4 binf=1#4 bsup=0 est=2.5@8/16 · columnas: lechos=3#5,2#5,3#5 est=3 sep=10/15', que: 'fija la sección y el armado de un chip (queda como propuesto)', fn: cFijar },
  { nombre: 'calculo', uso: 'calculo <chip>', que: 'MR, Mu, Vr, Vu y D/C de una trabe, como en Calculo', fn: cCalculo },
  { nombre: 'columnas', uso: 'columnas [chip]', que: 'flexocompresión biaxial NTC 2023 (con FR): D/C del método general y de 5.4.1.2, cuál gobierna, FR y εt', fn: cColumnas },
  { nombre: 'longitudinal', uso: 'longitudinal [chip]', que: 'bastones puntuales, insuficientes, cortante y kg, como en Longitudinal', fn: cLongitudinal },
  { nombre: 'deflexiones', uso: 'deflexiones [grupo] [--todos]', que: 'flechas por tramo contra L/240+0.5 y L/480+0.3', fn: cDeflexiones },
  { nombre: 'bd', uso: 'bd <Mu+> <Mu−> [b=15,20] [h=30,35] [n=5] | bd usar <n> <chip>', que: 'busca en la BD Global y aplica una sección (propuesta)', fn: cBd },
  { nombre: 'agrupar', uso: 'agrupar [trabes|columnas] [grupos=T1,T2] [anchos=15,20,25] [--verificar]', que: 'las tres propuestas de Agrupación (no aplica nada en RAM)', fn: cAgrupar },
  { nombre: 'resultados', uso: 'resultados', que: 'demanda/capacidad de todas las trabes y columnas, del peor al mejor', fn: cResultados, alias: ['dc'] },
  { nombre: 'exportar', uso: 'exportar dxf|svg|pdf|detallado|dcheck', que: 'las salidas de Verificar y Exportar DXF', fn: cExportar },
  { nombre: 'guardar', uso: 'guardar', que: 'guarda el proyecto.json (como el botón Guardar)', fn: cGuardar },
  { nombre: 'ir', uso: 'ir <pestaña>|centro', que: 'cambia de pestaña o abre el Centro de carga', fn: cIr },
  { nombre: 'limpiar', uso: 'limpiar', que: 'borra el registro de la consola (no toca el proyecto)' },
]

export function comando(nombre) {
  const k = String(nombre || '').toLowerCase()
  return COMANDOS.find((c) => c.nombre === k || c.alias?.includes(k)) || null
}

export function ayuda(nombre) {
  if (nombre) {
    const c = comando(nombre)
    return c ? bien(`${c.uso}\n${c.que}`, c) : mal(`No hay comando «${nombre}».`)
  }
  return bien(COMANDOS.map((c) => `${c.uso.split(' ')[0].padEnd(12)} ${c.que}`).join('\n')
    + '\nOpciones: --json (contesta en JSON) · --quieto (no cambia de pestaña). Chips por nombre: T-1, t1, C-2.',
  COMANDOS.map((c) => ({ nombre: c.nombre, uso: c.uso })))
}

import { useMemo, useRef, useState, useEffect } from 'react'
import useBeamStore from '../store/useBeamStore'
import { parseRamStations, looksLikeStations, analyzeGroup, optimizeBase, applyBase, unitLabel, bastonesDe, bastonesDeVarios, extraDe, compartidosCon, perfilCompleto } from '../core/longitudinal'
import { parseNodeXlsx, parseGeometryReport, attachGeometry, sectionMismatches } from '../core/geometry'
import { elevationSvg, diagramSvg, elevationsGridSvg } from '../core/longitudinalSvg'
import { svgToDxf } from '../core/svgToDxf'
import { parseRamEnvelope } from '../core/ramParser'
import { parseRamActions, looksLikeActions } from '../core/ramActions'
import ModelView from './ModelView'

const fmt = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d))
const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', fontSize: 11 }
const TH = { padding: '5px 8px', background: '#1a2040', color: '#fff', fontSize: 10, textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 }

function Pill({ tone, children, title }) {
  const st = {
    ok: { bg: '#e8f5e9', fg: '#15803d', bd: '#a5d6a7' },
    bad: { bg: '#fdecea', fg: '#c62828', bd: '#ef9a9a' },
    warn: { bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d' },
    info: { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' },
    muted: { bg: 'var(--color-panel)', fg: 'var(--color-tx3)', bd: 'var(--color-border)' },
  }[tone || 'muted']
  return <span title={title} style={{ fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 99, fontFamily: 'var(--font-mono)', background: st.bg, color: st.fg, border: `1px solid ${st.bd}`, whiteSpace: 'nowrap' }}>{children}</span>
}

const smaxWarn = (r) => (r.shear.extremos.okSmax === false || r.shear.centro.okSmax === false)

const barsTxt = (bars, cal) => bars.length ? bars.map((b) => `${b.k}#${cal} L=${fmt(b.len)} @${fmt(b.x0)}${b.ancla ? ` ⟂${b.ancla}` : ''}`).join(' · ') : '—'

/** Botón-ficha de un paso de carga: dice si ya está y qué se cargó */
function Paso({ n, titulo, listo, detalle, onClick, onQuitar, hint }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 8, fontSize: 11,
      background: listo ? '#e8f5e9' : 'var(--color-panel)', border: `1px solid ${listo ? '#a5d6a7' : 'var(--color-border)'}`,
    }} title={hint}>
      <span style={{ fontWeight: 800, color: listo ? '#15803d' : 'var(--color-tx3)' }}>{listo ? '✓' : n}</span>
      <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: 11, color: 'var(--color-tx1)', textAlign: 'left' }}>
        {titulo}
      </button>
      {detalle && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-tx3)' }}>{detalle}</span>}
      {listo && onQuitar && <button onClick={onQuitar} title="quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-tx3)', fontSize: 11, padding: 0 }}>✕</button>}
    </div>
  )
}

/**
 * Pestaña "Longitudinal": la trabe seleccionada contra el reporte por
 * estaciones de todos sus miembros. Bastones sólo donde y en quien hacen
 * falta, patrones para dibujar pocos detalles, y acero total vs uniforme.
 * La geometría del modelo (nudos + miembros) se carga una sola vez y la
 * comparten todas las trabes del proyecto.
 */
export default function LongitudinalView({ dxfScale = 1, projectName = '' }) {
  const form = useBeamStore((s) => s.form)
  const sections = useBeamStore((s) => s.sections)
  const selectedIdx = useBeamStore((s) => s.selectedIdx)
  const setPerfil = useBeamStore((s) => s.setPerfil)
  const setEnvelope = useBeamStore((s) => s.setEnvelope)
  const setForm = useBeamStore((s) => s.setForm)
  const model = useBeamStore((s) => s.model)
  const setModel = useBeamStore((s) => s.setModel)
  const addSection = useBeamStore((s) => s.addSection)
  const longFocus = useBeamStore((s) => s.longFocus)
  const hasSel = selectedIdx >= 0 && selectedIdx < sections.length

  const fileRef = useRef(null)
  const geomRef = useRef(null)
  const [msg, setMsg] = useState('')
  const [sel, setSel] = useState(null)      // miembro/elemento seleccionado (id)
  const [view, setView] = useState('tabla') // tabla | patrones | modelo
  const [showOpt, setShowOpt] = useState(false)
  const [ajustes, setAjustes] = useState(false)
  const [Ltxt, setLtxt] = useState('')
  const [zoom, setZoom] = useState('fit')   // fit | 1 | 2  (visor del alzado)
  const [drop, setDrop] = useState(false)
  const [filtro, setFiltro] = useState('todos')  // todos | criticos | baston
  const [foco, setFoco] = useState(null)         // miembro que llegó desde la envolvente

  const perfil = form.perfil
  useEffect(() => { setLtxt(perfil?.L ? String(perfil.L) : '') }, [perfil?.L, selectedIdx])

  // ── Geometría del modelo (compartida) → longitudes, secciones y elementos ──
  const nodes = useMemo(() => new Map(Object.entries(model?.nodes || {})), [model])
  // perfil + geometría + envolvente: lo que ven el análisis y la tabla
  const perfilFull = useMemo(() => perfilCompleto({ perfil, envelope: form.envelope }, model), [perfil, form.envelope, model])
  const chains = perfilFull?.geom?.chains || []

  const group = useMemo(() => {
    if (!hasSel || !perfilFull?.members?.length) return null
    try { return analyzeGroup(form, perfilFull) } catch (e) { console.error(e); return null }
  }, [hasSel, form, perfilFull])

  const opt = useMemo(() => {
    if (!showOpt || !group) return null
    try { return optimizeBase(form, perfilFull) } catch (e) { console.error(e); return null }
  }, [showOpt, group, form, perfilFull])

  const selected = useMemo(() => {
    if (!group) return null
    return group.results.find((r) => r.id === sel) || group.results.find((r) => r.status !== 'ok') || group.results[0]
  }, [group, sel])

  // El DISEÑO de la trabe (corridas + bastones CORRIDOS del corte) es la base
  // del análisis; lo que este módulo reparte encima son bastones PUNTUALES.
  const kCorr = group ? { inf: group.caps.kCorrInf, sup: group.caps.kCorrSup } : { inf: 0, sup: 0 }
  const criticos = useMemo(() => (group ? group.results.filter((r) => extraDe(r).pidePuntual) : []), [group])
  const insuficientes = useMemo(() => (group ? group.results.filter((r) => r.status === 'insuficiente' || r.shearFail) : []), [group])
  const filas = useMemo(() => {
    if (!group) return []
    if (filtro === 'criticos') return criticos
    if (filtro === 'baston') return insuficientes
    return group.results
  }, [group, filtro, criticos, insuficientes])

  // Estado de cada unidad frente al diseño de la trabe
  const pillDe = (r) => {
    if (r.status === 'insuficiente') return <Pill tone="bad">✗ insuficiente</Pill>
    if (r.shearFail) return <Pill tone="bad">✗ cortante</Pill>
    const { kInf, kSup } = extraDe(r)
    if (kInf || kSup) {
      return <Pill tone="info">+{[kInf && `${kInf} abajo`, kSup && `${kSup} arriba`].filter(Boolean).join(' / ')} puntual</Pill>
    }
    if (r.alFilo) {
      return <Pill tone="warn" title={`Pasa por poco: sobra ${(r.holgura.v * 100).toFixed(1)} % en ${r.holgura.que}, y el pico sale de las estaciones impresas del reporte (no del bloque de máximos), así que el real puede ser mayor.`}>
        ✓ al filo ({(r.holgura.v * 100).toFixed(r.holgura.v < 0.1 ? 1 : 0)} % en {r.holgura.que})
      </Pill>
    }
    return <Pill tone="ok">✓ con el diseño</Pill>
  }

  // ── La envolvente de la sección contra el reporte por estaciones ──
  // Pueden venir de archivos distintos (o de combinaciones distintas): si la
  // envolvente reporta más momento que el perfil, el diseño a lo largo se
  // quedaría corto y hay que decirlo.
  const desfase = useMemo(() => {
    const pts = form.envelope?.points
    if (!group || !pts?.length) return null
    const inv = !!form.envelope.invertir
    const porMiembro = new Map()
    for (const p of pts) {
      const k = String(p.member)
      const a = porMiembro.get(k) || { P: 0, N: 0 }
      const mx = inv ? -p.m33 : p.m33
      a.P = Math.max(a.P, mx); a.N = Math.max(a.N, -mx)
      porMiembro.set(k, a)
    }
    const casos = []
    for (const r of group.results) {
      const ids = r.isElement ? r.members.map((m) => String(m.id)) : [String(r.id)]
      let eP = 0, eN = 0, hay = false
      for (const id of ids) { const a = porMiembro.get(id); if (a) { hay = true; eP = Math.max(eP, a.P); eN = Math.max(eN, a.N) } }
      if (!hay) continue
      // se compara contra lo que dan las estaciones impresas: el perfil ya
      // viene elevado a la mayor de las dos fuentes, pero el desfase entre
      // reportes hay que decirlo igual
      const c = r.profile.crudo || r.profile
      const d = Math.max(eP - c.muPmax, eN - c.muNmax)
      if (d > 0.02) casos.push({ r, eP, eN, d, c })
    }
    if (!casos.length) return null
    casos.sort((a, b) => b.d - a.d)
    return { casos, peor: casos[0], env: form.envelope.archivo, perfil: perfilFull.archivo }
  }, [group, form.envelope, perfilFull])

  // ¿Esta trabe comparte miembros con otra? (una variante sacada de la familia
  // cuyo reporte original sigue trayéndolos: se diseñarían dos veces)
  const compartidos = useMemo(() => compartidosCon(sections, form.nombre), [sections, form.nombre])

  const mismatch = useMemo(() => {
    if (!perfilFull?.secPor) return null
    const ids = perfilFull.members.map((m) => m.id)
    return sectionMismatches(perfilFull.secPor, ids, form)
  }, [perfilFull, form.ancho, form.peralte]) // eslint-disable-line
  const excluidos = useMemo(() => new Set((perfil?.excluir || []).map(String)), [perfil?.excluir])

  useEffect(() => { if (longFocus?.ts) { setFoco({ member: String(longFocus.member), fallan: (longFocus.fallan || []).map(String) }); setFiltro('todos') } }, [longFocus?.ts]) // eslint-disable-line
  // al llegar enfocado, seleccionar la unidad (elemento o miembro) que lo contiene
  useEffect(() => {
    if (!foco || !group) return
    const u = group.results.find((r) => (r.isElement ? r.members.some((m) => String(m.id) === foco.member) : String(r.id) === foco.member))
    if (u) setSel(u.id)
  }, [foco, group])

  const patchPerfil = (p) => setPerfil({ ...perfil, ...p })

  // ── Carga de archivos: un solo camino, el contenido decide qué es cada uno ──
  async function cargarArchivos(files) {
    if (!files.length) return
    const notas = []
    let rows = null, nds = null, perfilNuevo = null
    const nombreGeom = []
    for (const f of files) {
      try {
        if (/\.xlsx$/i.test(f.name)) {
          nds = await parseNodeXlsx(await f.arrayBuffer())
          nombreGeom.push(f.name)
          notas.push(`${f.name}: ${nds.size} nudos`)
          continue
        }
        const text = await f.text()
        // el de acciones discriminadas manda: es el único que garantiza el pico
        if (looksLikeActions(text) || looksLikeStations(text)) {
          const e = cargarEstaciones(f.name, text)
          perfilNuevo = e.perfil; notas.push(e.nota)
          continue
        }
        const g = parseGeometryReport(text)
        if (g.rows.length || g.nodes.size) {
          if (g.rows.length) rows = g.rows
          if (g.nodes.size) nds = g.nodes
          nombreGeom.push(f.name)
          notas.push(`${f.name}: ${[g.rows.length && `${g.rows.length} miembros`, g.nodes.size && `${g.nodes.size} nudos`].filter(Boolean).join(' + ')}${g.warnings.length ? ` (${g.warnings.join(' ')})` : ''}`)
          continue
        }
        const env = parseRamEnvelope(text)
        if (env.points.length) {
          setEnvelope({ archivo: f.name, combo: env.combo, unidades: env.unidades, invertir: false, points: env.points })
          notas.push(`${f.name}: máximos por miembro (${new Set(env.points.map((p) => p.member)).size}) → envolvente de la sección, y el pico exacto para el análisis a lo largo (las estaciones impresas se quedan cortas)`)
          continue
        }
        notas.push(`${f.name}: no se reconoció (ni esfuerzos ni geometría)`)
      } catch (err) { notas.push(`${f.name}: ${err.message}`) }
    }
    // La geometría se guarda completa: es del modelo, no de esta trabe
    if (rows || nds) {
      const R = rows || model?.rows || []
      const N = nds || nodes
      if (!R.length) notas.push('falta el reporte de miembros (NJ/NK)')
      else if (!N.size) notas.push('faltan las coordenadas de los nudos')
      else {
        const nuevo = { archivo: nombreGeom.join(' + ') || model?.archivo || '', rows: R, nodes: Object.fromEntries(N) }
        setModel(nuevo)
        const p2 = attachGeometry(perfilNuevo || perfil, nuevo)
        if (p2?.geom) {
          const multi = p2.geom.chains.filter((c) => c.members.length > 1).length
          notas.push(`${Object.keys(p2.Lpor).length} longitudes calculadas · ${p2.geom.chains.length} elementos (${multi} formados por varios miembros colineales)`)
        }
      }
    }
    setMsg(notas.join(' · '))
  }

  function cargarEstaciones(nombre, text) {
    const acc = looksLikeActions(text) ? parseRamActions(text) : null
    const P = acc?.members?.length ? acc : parseRamStations(text)
    if (!P.members.length) return { perfil: null, nota: `${nombre}: ${P.warnings[0] || 'sin miembros'}` }
    const Lprev = perfil?.L || +(form.calc?.L) || 0
    const nuevo = {
      ...(perfil || {}),
      archivo: nombre, combo: P.combo, unidades: P.unidades,
      members: P.members, L: Lprev || 0, Lpor: perfil?.Lpor || {}, formato: P.formato || 'estaciones',
      invertir: !!perfil?.invertir, minLen: perfil?.minLen ?? 0.6,
      porElemento: perfil?.porElemento ?? true,
      conMaximos: P.conMaximos || 0,
    }
    setPerfil(nuevo)
    // La envolvente de sección sale del mismo reporte… salvo que ya haya una
    // cargada de un «Máximos esfuerzos en miembros»: ésa trae el pico exacto y
    // no se pisa con una muestra de estaciones.
    if (!form.envelope?.points?.length || form.envelope.fromStations) {
      setEnvelope({ archivo: nombre, combo: P.combo, unidades: P.unidades, invertir: !!perfil?.invertir, points: P.points, fromStations: true })
    }
    setSel(null)
    const enM = P.members.filter((m) => m.Lreport).length
    const tipo = P.formato === 'acciones' ? 'acciones discriminadas (puntos de inflexión)' : 'envolvente por estaciones'
    const max = P.conMaximos === P.members.length ? ' · con el bloque de máximos (picos exactos)'
      : P.conMaximos ? ` · sólo ${P.conMaximos} de ${P.members.length} traen el bloque de máximos`
        : ' · SIN el bloque de máximos: los picos salen de las estaciones impresas'
    return { perfil: nuevo, nota: `${nombre}: ${tipo} · ${P.members.length} miembros · ${P.members[0].stations.length} estaciones${P.combo ? ` · ${P.combo}` : ''}${enM ? ` · ${enM} con longitud en el reporte` : ''}${max}${P.warnings.length ? ` · ${P.warnings[0]}` : ''}` }
  }

  const onInput = (e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; cargarArchivos(fs) }
  const onDrop = (e) => {
    e.preventDefault(); setDrop(false)
    cargarArchivos([...(e.dataTransfer?.files || [])])
  }

  // ── DXF de alzados (aparte del DXF de secciones de la barra) ──
  function download(content, filename, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }
  function exportElevations(scope) {
    const list = scope === 'all' ? sections.filter((t) => t.perfil?.members?.length) : [form]
    let inner = '', W = 0, H = 0, n = 0
    for (const t of list) {
      let g = null
      try { g = analyzeGroup(t, t === form ? perfilFull : perfilCompleto(t, model)) } catch { continue }
      if (!g?.patterns?.length) continue
      const e = elevationsGridSvg(t, g, 14)
      inner += `<g transform="translate(0,${H.toFixed(1)})">${e.inner}</g>`
      H += e.H + 40; W = Math.max(W, e.W); n += g.patterns.length
    }
    if (!inner) { setMsg('No hay alzados que exportar: carga el reporte por estaciones y la longitud (o la geometría).'); return }
    const wCm = (W / 14).toFixed(4), hCm = (H / 14).toFixed(4)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${wCm}cm" height="${hCm}cm" data-real-width-cm="${wCm}" data-real-height-cm="${hCm}" style="font-family:'DM Mono',monospace">${inner}</svg>`
    const base = (projectName.trim() ? `alzados-${projectName.trim().replace(/\s+/g, '-')}` : 'alzados') + (scope === 'all' ? '' : `-${(form.nombre || 'trabe').replace(/\s+/g, '-')}`)
    download(svgToDxf(svg, { scaleFactor: dxfScale }), `${base}.dxf`, 'application/dxf')
    setMsg(`DXF de alzados generado: ${n} patrón(es) de ${list.length} trabe(s), a escala real (1 unidad = 1 cm${dxfScale !== 1 ? `, factor ${dxfScale}` : ''}).`)
  }

  // Anota en la trabe los bastones PUNTUALES que reparte el análisis. No van al
  // corte (no existen en toda la longitud): se dibujan en el alzado.
  const aplicarBastones = (unidades, nota) => {
    const { kInf, kSup } = bastonesDeVarios(unidades)
    setForm({ cantBastonPuntInf: kInf, cantBastonPuntSup: kSup })
    setMsg(`${nota}: ${kInf}/${kSup} bastón(es) puntual(es) #${form.calBastonInf}/#${form.calBastonSup}, que salen en el alzado (el corte no cambia).`)
  }

  const nombreLibre = (base) => {
    const usados = new Set(sections.map((x) => x.nombre))
    for (const suf of 'abcdefghijklmnopqrstuvwxyz') if (!usados.has(`${base}${suf}`)) return `${base}${suf}`
    return `${base}-${sections.length + 1}`
  }

  /**
   * Separa unas unidades (elementos o miembros) en una trabe nueva ya
   * bastoneada. La original deja de cargar con ellas —en el análisis y en su
   * envolvente—, así que cada detalle queda dibujado para lo que de verdad es.
   */
  function separar(unidades) {
    const ids = [...new Set(unidades.flatMap((r) => (r.isElement ? r.members.map((m) => String(m.id)) : [String(r.id)])))]
    if (!ids.length || !perfil?.members?.length) return
    const idSet = new Set(ids)
    const { kInf, kSup } = bastonesDeVarios(unidades)
    const env = form.envelope
    const nueva = {
      ...form,
      nombre: nombreLibre(form.nombre),
      cantBastonPuntInf: kInf, cantBastonPuntSup: kSup,
      perfil: { ...perfil, members: perfil.members.filter((m) => idSet.has(String(m.id))), excluir: [] },
      envelope: env?.points ? { ...env, points: env.points.filter((p) => idSet.has(String(p.member))) } : env,
    }
    // primero se descuentan de la trabe activa, que todavía es la seleccionada
    patchPerfil({ excluir: [...new Set([...(perfil.excluir || []), ...ids])] })
    if (env?.points) setEnvelope({ ...env, points: env.points.filter((p) => !idSet.has(String(p.member))) })
    const anterior = form.nombre
    addSection(nueva)
    setForm({ cantBastonInf: kInf, cantBastonSup: kSup })
    setSel(null); setFiltro('todos'); setFoco(null)
    const insuf = unidades.filter((r) => r.status === 'insuficiente').length
    setMsg(`${nueva.nombre}: ${unidades.length} elemento(s) (${ids.length} miembro(s)) con ${kInf}/${kSup} bastón(es). ${anterior} ya no los incluye.`
      + (insuf ? ` ${insuf} no alcanzan ni con un bastón por varilla: súbeles el armado corrido o la sección (⚙ Optimizar).` : ''))
  }

  const toggleExcluir = (id) => {
    const ex = new Set((perfil.excluir || []).map(String))
    ex.has(String(id)) ? ex.delete(String(id)) : ex.add(String(id))
    patchPerfil({ excluir: [...ex] })
  }
  const commitL = () => { const v = parseFloat(Ltxt); if (v > 0) patchPerfil({ L: v }) }
  const setLpor = (id, v) => {
    const Lpor = { ...(perfil.Lpor || {}) }
    const n = parseFloat(v)
    if (n > 0) Lpor[id] = n; else delete Lpor[id]
    patchPerfil({ Lpor })
  }

  if (!hasSel) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-tx3)' }}>Selecciona una trabe (o crea una con “+ Nueva”) para analizarla a lo largo</div>
  }

  const capsOk = group?.caps.okBase
  const L = perfil?.L || 0
  const needL = group && group.results.some((r) => !(r.L > 0))
  const kInfMismatch = group && group.kMaxInf !== (+form.cantBastonPuntInf || 0)
  const kSupMismatch = group && group.kMaxSup !== (+form.cantBastonPuntSup || 0)
  const puedeCorrer = group && (group.kMaxInf > 0 || group.kMaxSup > 0)
  const hayEsfuerzos = perfil?.members?.length > 0
  const hayModelo = model?.rows?.length > 0 && nodes.size > 0
  const vista = view === 'modelo' && !hayModelo ? 'tabla' : view
  const abrir = () => fileRef.current?.click()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}
      onDragOver={(e) => { e.preventDefault(); if (!drop) setDrop(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrop(false) }}
      onDrop={onDrop}>
      <input ref={fileRef} data-testid="perfil-file" type="file" multiple accept=".txt,.csv,.xlsx,text/plain" style={{ display: 'none' }} onChange={onInput} />
      <input ref={geomRef} data-testid="geom-files" type="file" multiple accept=".txt,.csv,.xlsx,text/plain" style={{ display: 'none' }} onChange={onInput} />

      {drop && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(91,197,174,0.10)', border: '3px dashed var(--color-accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '10px 18px', borderRadius: 8, border: '1px solid var(--color-accent)', fontSize: 13, fontWeight: 700 }}>Suelta aquí los reportes de RAM (.txt / .xlsx)</div>
        </div>
      )}

      {/* Barra superior */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-panel)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{form.nombre}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>
            {form.ancho}×{form.peralte} · corridas {form.cantInf}#{form.calInf} abajo / {form.cantSup}#{form.calSup} arriba · bastón #{form.calBastonInf}/#{form.calBastonSup} · E#{form.calEst}@{form.sepLcuarto}/{form.sepRest}
          </span>
          <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={abrir} data-testid="cargar-ram">
            📂 Cargar reportes de RAM
          </button>
          <Paso n="1" titulo="Esfuerzos por estaciones" listo={hayEsfuerzos} onClick={abrir}
            hint="RAM: Miembros → Acciones discriminadas y puntos de inflexión (o, en su defecto, Envolvente de esfuerzos por estaciones) de todos los miembros de este tipo de trabe"
            detalle={hayEsfuerzos ? `${perfil.archivo} · ${perfil.members.length} miembros${perfil.combo ? ` · ${perfil.combo}` : ''}` : '.txt de la envolvente por estaciones'}
            onQuitar={() => { setPerfil(null); if (form.envelope?.fromStations) setEnvelope(null); setMsg('') }} />
          <Paso n="2" titulo="Geometría del modelo" listo={hayModelo} onClick={abrir}
            hint="RAM: Datos de Geometría → Guardar como TXT (trae Nudos y Miembros en un solo archivo). Con esto la app calcula la longitud de cada miembro y une los tramos colineales en elementos completos."
            detalle={hayModelo ? `${model.archivo || ''} · ${model.rows.length} miembros · ${nodes.size} nudos${chains.length ? ` · ${chains.length} elementos` : ''}` : 'opcional · .txt «Datos de Geometría»'}
            onQuitar={() => { setModel(null); setMsg('') }} />
          {hayEsfuerzos && (
            <>
              {chains.length > 0 && (
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} title="Une los miembros colineales de RAM que comparten nudo y analiza el elemento completo">
                  <input type="checkbox" checked={perfilFull.porElemento !== false} onChange={(e) => patchPerfil({ porElemento: e.target.checked })} />
                  por elemento ({chains.length})
                </label>
              )}
              {(needL || !hayModelo) && (
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  L del grupo (m)
                  <input className="field-input" data-testid="perfil-L" style={{ width: 70, fontSize: 11 }} value={Ltxt} onChange={(e) => setLtxt(e.target.value)} onBlur={commitL} onKeyDown={(e) => e.key === 'Enter' && commitL()} placeholder="4.00" />
                </label>
              )}
              <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={() => setAjustes((v) => !v)}>⚙ Ajustes</button>
            </>
          )}
        </div>

        {ajustes && hayEsfuerzos && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} title="Longitud mínima práctica de un bastón (obra)">
              bastón mín (m)
              <input className="field-input" style={{ width: 60, fontSize: 11 }} type="number" step="0.05" min="0" value={perfil.minLen ?? 0.6} onChange={(e) => patchPerfil({ minLen: Math.max(0, +e.target.value || 0) })} />
            </label>
            <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={() => { patchPerfil({ invertir: !perfil.invertir }); setEnvelope({ ...(form.envelope || {}), invertir: !perfil.invertir }) }}
              title="Invierte el signo de M33 si en tu modelo el momento positivo va al revés">
              {perfil.invertir ? 'M33 invertido ⇄' : 'M33 normal ⇄'}
            </button>
            {hayModelo && (
              <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                L del grupo (m)
                <input className="field-input" style={{ width: 70, fontSize: 11 }} value={Ltxt} onChange={(e) => setLtxt(e.target.value)} onBlur={commitL} onKeyDown={(e) => e.key === 'Enter' && commitL()} placeholder="4.00" />
              </label>
            )}
            <span style={{ fontSize: 10, color: 'var(--color-tx3)' }}>Puedes soltar los .txt de RAM en cualquier parte de esta pestaña.</span>
          </div>
        )}

        {msg && <div data-testid="perfil-msg" style={{ fontSize: 10.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>{msg}</div>}

        {foco && (
          <div style={{ fontSize: 11, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>🎯 M-{foco.member}</b>
            {group ? (
              <>
                <span>llegó desde la envolvente para resolverlo con bastones.</span>
                {foco.fallan.length > 1 && criticos.length > 0 && (
                  <button className="btn btn-secondary" style={{ fontSize: 10 }} data-testid="foco-todos"
                    onClick={() => setFiltro('criticos')}
                    title="En la envolvente no pasan varios miembros; aquí se agrupan por elemento contra la sección tal como está detallada">
                    ¿Trasladar también los demás? — ver sólo los que piden puntual ({criticos.length})
                  </button>
                )}
              </>
            ) : (
              <span>carga aquí el reporte por estaciones de esta trabe (paso 1) para ponerle bastón sólo donde hace falta.</span>
            )}
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontSize: 11 }} onClick={() => setFoco(null)}>✕</button>
          </div>
        )}

        {group && (
          <>
            {needL && <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px' }}>Captura la longitud L del grupo (o por miembro en la tabla), o carga la geometría del modelo para calcularla sola.</div>}
            {compartidos.map((c) => {
              const enGrupo = group.results.filter((r) => {
                const ids = r.isElement ? r.members.map((m) => String(m.id)) : [String(r.id)]
                return ids.some((id) => c.ids.includes(id))
              })
              return (
                <div key={c.nombre} style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>
                    <b>{c.ids.length} miembro(s) de este reporte también están en {c.nombre}</b>
                    {enGrupo.length ? <> ({enGrupo.map((r) => unitLabel(r)).join(', ')})</> : null}: se están diseñando dos veces, con dos secciones distintas.
                    Si ya son de {c.nombre}, sácalos de {form.nombre}.
                  </span>
                  <button className="btn btn-secondary" style={{ fontSize: 10 }} data-testid={`excluir-compartidos-${c.nombre}`}
                    onClick={() => patchPerfil({ excluir: [...new Set([...(perfil.excluir || []), ...c.ids])] })}
                    title={`Quita esos miembros del grupo de ${form.nombre}; siguen analizándose en ${c.nombre}`}>
                    Excluirlos de {form.nombre}
                  </button>
                </div>
              )
            })}
            {mismatch?.distintos?.length > 0 && (
              <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>
                  {mismatch.distintos.filter((d) => !excluidos.has(String(d.member))).length} miembro(s) del reporte tienen otra sección que esta trabe ({form.ancho}×{form.peralte}):
                  {' '}{Object.entries(mismatch.resumen).map(([k, n]) => `${k} ×${n}`).join(' · ')}.
                </span>
                {mismatch.distintos.some((d) => !excluidos.has(String(d.member))) && (
                  <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={() => patchPerfil({ excluir: [...new Set([...(perfil.excluir || []), ...mismatch.distintos.map((d) => d.member)])] })}>
                    Excluir del grupo los de otra sección ({mismatch.distintos.length <= 8 ? mismatch.distintos.map((d) => `M-${d.member}`).join(', ') : `${mismatch.distintos.length} miembros`})
                  </button>
                )}
                {excluidos.size > 0 && <span style={{ color: 'var(--color-tx3)' }}>excluidos: {[...excluidos].join(', ')} <button style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'var(--color-tx3)' }} onClick={() => patchPerfil({ excluir: [] })}>restaurar</button></span>}
              </div>
            )}
            {(() => {
              const aj = group.results.filter((r) => r.profile.ajuste)
              if (!aj.length) return null
              const peor = aj.reduce((a, b) => {
                const f = (r) => Math.max(r.profile.ajuste.kP || 1, r.profile.ajuste.kN || 1)
                return f(b) > f(a) ? b : a
              })
              const k = Math.max(peor.profile.ajuste.kP || 1, peor.profile.ajuste.kN || 1)
              return (
                <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>
                    <b>{aj.length}</b> {aj.length === 1 ? 'elemento tiene' : 'elementos tienen'} el perfil ajustado a los máximos que reporta RAM:
                    las estaciones impresas del reporte se quedaban cortas (el mayor ajuste es ×{fmt(k)} en {unitLabel(peor)},
                    Mu− {fmt(peor.profile.ajuste.rep.muN)} reportado). Sin este ajuste los bastones se diseñarían con un momento menor que el real.
                  </span>
                  <button className="btn btn-secondary" style={{ fontSize: 10 }} data-testid="toggle-ajuste"
                    onClick={() => patchPerfil({ ajustarAMaximos: false })}
                    title="Usar sólo los valores de las estaciones impresas (no recomendado: subestima el momento)">
                    usar sólo las estaciones
                  </button>
                </div>
              )
            })()}
            {perfilFull.ajustarAMaximos === false && (
              <div style={{ fontSize: 11, color: '#c62828', background: '#fdecea', border: '1px solid #ef9a9a', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Se están usando <b>sólo las estaciones impresas</b>: donde RAM reporte un máximo mayor, el momento de diseño queda por debajo del real.</span>
                <button className="btn btn-secondary" style={{ fontSize: 10 }} data-testid="toggle-ajuste"
                  onClick={() => patchPerfil({ ajustarAMaximos: true })}>respetar los máximos del reporte</button>
              </div>
            )}
            {desfase && (
              <div style={{ fontSize: 11, color: '#c62828', background: '#fdecea', border: '1px solid #ef9a9a', borderRadius: 6, padding: '6px 10px' }}>
                <b>La envolvente de la sección pide más que este reporte</b> en {desfase.casos.length} elemento(s).
                El mayor: <b>{unitLabel(desfase.peor.r)}</b> — la envolvente reporta Mu+ {fmt(desfase.peor.eP)} · Mu− {fmt(desfase.peor.eN)} t·m
                y las estaciones de este reporte sólo llegan a Mu+ {fmt(desfase.peor.c.muPmax)} · Mu− {fmt(desfase.peor.c.muNmax)}.
                {desfase.env && desfase.perfil && desfase.env !== desfase.perfil
                  ? <> Vienen de archivos distintos (<b>{desfase.env}</b> vs <b>{desfase.perfil}</b>): revisa que sean la misma combinación de carga.</>
                  : <> Revisa que el reporte por estaciones cubra las mismas combinaciones que la envolvente.</>}
                {' '}El diseño <b>ya usa el mayor de los dos</b> (el perfil se escala), pero conviene reexportar el de estaciones para ver dónde cae ese pico.
              </div>
            )}
            {group.nFilo > 0 && (
              <div data-testid="aviso-filo" style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>
                  <b>{group.nFilo} elemento(s) pasan por muy poco</b> y su pico sale sólo de las estaciones impresas de <b>{perfil.archivo}</b>
                  {perfil.members[0]?.stations?.length ? ` (${perfil.members[0].stations.length} por miembro)` : ''}.
                  El pico real casi nunca cae en una estación: en un modelo real lo impreso se queda corto hasta un 12 %, así que un margen de
                  {' '}{(Math.min(...group.results.filter((r) => r.alFilo).map((r) => r.holgura.v)) * 100).toFixed(1)} % no verifica nada.
                  Carga del mismo grupo el reporte <b>«Máximos esfuerzos en miembros»</b>, que sí trae el pico exacto, o vuelve a correr el análisis con más estaciones.
                </span>
                <button className="btn btn-secondary" style={{ fontSize: 10 }} data-testid="cargar-maximos" onClick={abrir}>cargar «Máximos esfuerzos en miembros»</button>
              </div>
            )}
            {!capsOk && <div style={{ fontSize: 11, color: '#c62828', background: '#fdecea', border: '1px solid #ef9a9a', borderRadius: 6, padding: '6px 10px' }}>
              El armado corrido no cumple por sí solo (As mín, As máx o b mín): MR+ {fmt(group.caps.MRP)} · MR− {fmt(group.caps.MRN)} t·m. Sube el armado corrido antes de repartir bastones.
            </div>}
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
              background: group.allOk && capsOk ? '#e8f5e9' : group.nInsuf || group.nShear || !capsOk ? '#fdecea' : '#fffbeb',
              border: `1px solid ${group.allOk && capsOk ? '#a5d6a7' : group.nInsuf || group.nShear || !capsOk ? '#ef9a9a' : '#fcd34d'}`,
            }}>
              <b>{group.n} {group.results.some((r) => r.isElement) ? 'elementos' : 'miembros'}:</b>
              <span style={{ color: '#15803d' }} title="Les basta lo que la trabe lleva en toda su longitud (corridas + bastón corrido)">{group.nOk} cubiertos con el diseño</span>
              <span style={{ color: '#1d4ed8' }} title="Piden bastón puntual en algún tramo, además del armado del corte">{group.nBast} piden bastón puntual</span>
              {group.nInsuf > 0 && <span style={{ color: '#c62828' }}>{group.nInsuf} insuficientes</span>}
              {group.nShear > 0 && <span style={{ color: '#c62828' }}>{group.nShear} fallan por cortante</span>}
              {group.nFilo > 0 && <span style={{ color: '#92400e' }} data-testid="al-filo"
                title="Pasan por muy poco y el pico sale sólo de las estaciones impresas: el reporte no trae el bloque de máximos, así que el pico real puede ser mayor que el que se ve aquí">
                ⚠ {group.nFilo} al filo
              </span>}
              {group.results.some(smaxWarn) && <span style={{ color: '#92400e' }} title="La separación de estribos supera d/2 (o d/4 con cortante alto) en alguna zona; la NTC la limita cuando se requieren estribos">⚠ {group.results.filter(smaxWarn).length} con s &gt; s máx</span>}
              <span style={{ color: 'var(--color-tx3)' }}
                title={`Base del análisis: lo que la trabe lleva en TODA su longitud — ${form.cantInf}#${form.calInf}/${form.cantSup}#${form.calSup} corridas${(kCorr.inf || kCorr.sup) ? ` + ${kCorr.inf}/${kCorr.sup} bastón corrido` : ''}. Lo que se reparte encima son bastones puntuales.`}>
                base MR+ {fmt(group.caps.MRP)} · MR− {fmt(group.caps.MRN)} t·m
                {(kCorr.inf || kCorr.sup) ? ` (corridas + ${kCorr.inf}/${kCorr.sup} bastón corrido)` : ' (sólo corridas)'}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                acero: <b>{fmt(group.acero.total, 0)} kg</b> ({fmt(group.acero.base, 0)} corridas + {fmt(group.acero.bastones, 0)} bastones)
                {group.acero.uniforme != null && <> · uniforme {group.uniforme.inf.n}#{group.uniforme.inf.bar.num}/{group.uniforme.sup.n}#{group.uniforme.sup.bar.num}: {fmt(group.acero.uniforme, 0)} kg → <b style={{ color: group.acero.ahorro > 0 ? '#15803d' : '#92400e' }}>{group.acero.ahorro >= 0 ? 'ahorro' : 'exceso'} {fmt(Math.abs(group.acero.ahorro), 0)} kg ({fmt(100 * Math.abs(group.acero.ahorro) / group.acero.uniforme, 0)} %)</b></>}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: -2 }}>
              <b>Bastón corrido</b>: recorre la trabe, se dibuja en el corte y cuenta en el MR — es la base de este análisis.
              <b> Bastón puntual</b>: sólo existe donde el momento lo pide, no va en el corte y se dibuja en el alzado con su longitud.
              Base de {form.nombre}: {form.cantInf}#{form.calInf} abajo / {form.cantSup}#{form.calSup} arriba corridas
              {(kCorr.inf || kCorr.sup) ? ` + ${kCorr.inf}/${kCorr.sup} bastón corrido` : ' (sin bastón corrido)'}.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {puedeCorrer && (
                <button className="btn btn-secondary" style={{ fontSize: 10.5 }} data-testid="correr-baston"
                  onClick={() => setForm({
                    cantBastonInf: Math.min((+form.cantInf || 0), kCorr.inf + group.kMaxInf),
                    cantBastonSup: Math.min((+form.cantSup || 0), kCorr.sup + group.kMaxSup),
                    cantBastonPuntInf: 0, cantBastonPuntSup: 0,
                  })}
                  title="Convierte el bastón puntual en corrido: pasa a recorrer la trabe, se dibuja en el corte, sube el MR de la sección y el grupo deja de pedir puntuales (más acero, un detalle más simple)">
                  ⇢ Correr el bastón en la sección ({kCorr.inf}/{kCorr.sup} → {Math.min((+form.cantInf || 0), kCorr.inf + group.kMaxInf)}/{Math.min((+form.cantSup || 0), kCorr.sup + group.kMaxSup)})
                </button>
              )}
              {(kInfMismatch || kSupMismatch) && (
                <button className="btn btn-secondary" style={{ fontSize: 10.5, color: '#92400e', borderColor: '#fcd34d' }} data-testid="cubrir-grupo"
                  onClick={() => setForm({ cantBastonPuntInf: group.kMaxInf, cantBastonPuntSup: group.kMaxSup })}
                  title="Deja anotado en la trabe cuántos bastones puntuales reparte el análisis (no van al corte; salen en el alzado)">
                  ← Anotar {group.kMaxInf}/{group.kMaxSup} bastones puntuales en {form.nombre} (hoy {form.cantBastonPuntInf || 0}/{form.cantBastonPuntSup || 0})
                </button>
              )}
              {criticos.length > 0 && criticos.length < group.n && (
                <button className="btn btn-secondary" style={{ fontSize: 10.5 }} data-testid="separar-criticos"
                  onClick={() => separar(criticos)}
                  title="Crea otra trabe con los elementos que piden bastón puntual y los quita de ésta: así no se sobredimensiona toda la familia por unos cuantos">
                  ⧉ Separar los {criticos.length} que piden puntual en otra trabe
                </button>
              )}
              <button className="btn btn-secondary" style={{ fontSize: 10.5 }} onClick={() => setShowOpt((v) => !v)}>
                {showOpt ? 'Ocultar optimizador' : '⚙ Optimizar armado corrido (mínimo acero)'}
              </button>
              <button className="btn btn-export" style={{ fontSize: 10.5 }} onClick={() => exportElevations('one')} data-testid="dxf-long-one"
                title="DXF con los alzados por patrón de esta trabe (independiente del DXF de secciones de la barra)">
                ⬇ DXF alzados · {form.nombre}
              </button>
              <button className="btn btn-export" style={{ fontSize: 10.5 }} onClick={() => exportElevations('all')} data-testid="dxf-long-all"
                title="DXF con los alzados de todas las trabes que tengan cargado el reporte por estaciones">
                ⬇ DXF alzados · todas ({sections.filter((t) => t.perfil?.members?.length).length})
              </button>
              {vista === 'tabla' && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--color-tx3)' }}>ver</span>
                  {[['todos', `todos (${group.n})`], ['criticos', `piden puntual (${criticos.length})`], ['baston', `no alcanzan (${insuficientes.length})`]].map(([id, lbl]) => (
                    <button key={id} onClick={() => setFiltro(id)} data-testid={`filtro-${id}`} className="btn"
                      style={{ fontSize: 10, padding: '3px 9px', background: filtro === id ? 'var(--color-accent2)' : 'var(--color-panel)', color: filtro === id ? '#fff' : 'var(--color-tx2)', border: '1px solid var(--color-border)' }}>{lbl}</button>
                  ))}
                </div>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {[['tabla', 'Miembros'], ['patrones', `Patrones (${group.patterns.length})`], ...(hayModelo ? [['modelo', '🏗 Modelo']] : [])].map(([id, lbl]) => (
                  <button key={id} onClick={() => setView(id)} data-testid={`view-${id}`} className="btn" style={{ fontSize: 11, padding: '4px 12px', background: vista === id ? 'var(--color-accent)' : 'var(--color-panel)', color: vista === id ? '#fff' : 'var(--color-tx2)', border: '1px solid var(--color-border)' }}>{lbl}</button>
                ))}
              </div>
            </div>
            {showOpt && opt && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Armado corrido de mínimo acero (corridas + bastones, todos los miembros cubiertos, bastón del mismo calibre)</div>
                {[['inf', 'Lecho inferior (M+)'], ['sup', 'Lecho superior (M−)']].map(([k, lbl]) => (
                  <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                    <span style={{ minWidth: 150, color: 'var(--color-tx3)' }}>{lbl}:</span>
                    {opt[k].feasible.slice(0, 4).map((r, i) => (
                      <span key={r.cal + r.n} style={{ padding: '2px 8px', borderRadius: 5, background: i === 0 ? '#e8f5e9' : 'var(--color-panel)', border: `1px solid ${i === 0 ? '#a5d6a7' : 'var(--color-border)'}` }}>
                        <b>{r.n}#{r.cal}</b> {fmt(r.kg, 0)} kg · MR {fmt(r.MR)} · {r.nBast} c/bastón
                      </span>
                    ))}
                    {!opt[k].feasible.length && <span style={{ color: '#c62828' }}>ningún armado de #3–#6 cubre todos los miembros con esta sección</span>}
                  </div>
                ))}
                {(opt.best.inf || opt.best.sup) && (
                  <button className="btn btn-primary" style={{ fontSize: 11, marginTop: 8 }}
                    onClick={() => { const g2 = analyzeGroup({ ...form, ...applyBase(form, opt.best) }, perfilFull); setForm(applyBase(form, opt.best, g2.kMaxInf, g2.kMaxSup)); setShowOpt(false) }}>
                    ← Aplicar a la sección ({opt.best.inf ? `${opt.best.inf.n}#${opt.best.inf.cal}` : '—'} abajo / {opt.best.sup ? `${opt.best.sup.n}#${opt.best.sup.cal}` : '—'} arriba)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sin reporte de esfuerzos: cómo empezar (y el modelo, si ya está) */}
      {!group && (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: hayModelo ? '8px 16px' : 20, display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: hayModelo ? '100%' : 720, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: hayModelo ? '8px 14px' : '16px 20px', fontSize: 12.5, lineHeight: 1.65 }}>
              {hayModelo ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>Falta el paso 1:</b>
                  <span style={{ color: 'var(--color-tx2)' }}>en RAM, <i>Miembros → Envolvente de esfuerzos</i> (por estaciones) de los miembros de {form.nombre}, guardar como TXT y cargarlo aquí para diseñar los bastones.</span>
                  <button className="btn btn-primary" style={{ fontSize: 11.5 }} onClick={abrir}>📂 Elegir archivo…</button>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Analizar {form.nombre} a lo largo</div>
                  <div style={{ color: 'var(--color-tx2)' }}>
                    <div><b>1 · Esfuerzos.</b> En RAM: <i>Miembros → Acciones discriminadas y puntos de inflexión</i>, de todos los miembros de este tipo de trabe. Guardar como TXT. Es el mejor reporte: sus estaciones caen en los picos y los puntos de inflexión, trae la distancia en metros (la longitud sale sola) y una envolvente por combinación. También se acepta <i>Envolvente de esfuerzos</i> por estaciones, pero ésa es una rejilla fija y puede saltarse el pico.</div>
                    <div><b>2 · Geometría</b> (opcional, muy recomendable). En RAM: <i>Datos de Geometría → Guardar como TXT</i>. Un solo archivo trae Nudos y Miembros: con él la app saca la longitud de cada miembro, une los tramos colineales en elementos completos y dibuja el modelo.</div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={abrir}>📂 Elegir archivos…</button>
                    <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>o suéltalos aquí. Se pueden cargar los dos juntos; la app reconoce cada uno por su contenido.</span>
                  </div>
                </>
              )}
            </div>
          </div>
          {hayModelo && (
            <div style={{ flex: 1, minHeight: 380, borderTop: '1px solid var(--color-border)' }}>
              <ModelView nodes={nodes} rows={model.rows} archivo={model.archivo} trabe={form.nombre}
                results={null} chains={[]} excluidos={excluidos} porElemento={false} selectedId={null} onSelect={null} />
            </div>
          )}
        </div>
      )}

      {group && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Izquierda: tabla, patrones o modelo */}
          <div style={{ width: vista === 'modelo' ? '58%' : vista === 'tabla' ? 560 : 420, minWidth: 380, borderRight: '1px solid var(--color-border)', overflow: vista === 'modelo' ? 'hidden' : 'auto' }}>
            {vista === 'modelo' ? (
              <ModelView nodes={nodes} rows={model.rows} archivo={model.archivo} trabe={form.nombre}
                results={group.results} chains={chains} excluidos={excluidos}
                porElemento={perfilFull.porElemento !== false} selectedId={selected?.id} onSelect={(id) => setSel(id)} />
            ) : vista === 'tabla' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
                <thead><tr>
                  <th style={TH}>{group.results.some((r) => r.isElement) ? 'Elemento' : 'Miembro'}</th><th style={TH}>L (m)</th><th style={TH}>Mu+</th><th style={TH}>Mu−</th><th style={TH}>Vu</th>
                  <th style={TH} title="Acero local que se suma al armado corrido, sólo donde el momento lo pide">Bastón puntual inf.</th><th style={TH}>Bastón puntual sup.</th><th style={TH}>Estado</th>
                </tr></thead>
                <tbody>
                  {filas.map((r) => (
                    <tr key={r.id} onClick={() => setSel(r.id)} style={{ cursor: 'pointer', background: selected?.id === r.id ? 'rgba(91,197,174,0.12)' : r.status === 'insuficiente' || r.shearFail ? 'rgba(198,40,40,0.05)' : undefined }}>
                      <td style={{ ...TD, fontWeight: 700, whiteSpace: 'normal' }}>
                        {unitLabel(r)}
                        {r.isElement && <div style={{ fontSize: 9, color: 'var(--color-tx3)', fontWeight: 400 }}>{r.members.length} tramos: {r.members.map((m) => m.id).join(' · ')}{r.supports?.length > 2 ? ` · ${r.supports.length - 2} apoyo(s) int.` : ''}</div>}
                        {!r.isElement && perfilFull.secPor?.[r.id] && <div style={{ fontSize: 9, color: 'var(--color-tx3)', fontWeight: 400 }}>{perfilFull.secPor[r.id]}</div>}
                        {!r.isElement && <button onClick={(e) => { e.stopPropagation(); toggleExcluir(r.id) }} style={{ fontSize: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-tx3)', textDecoration: 'underline', padding: 0 }}>excluir</button>}
                      </td>
                      <td style={TD}>
                        {perfilFull.members.find((m) => m.id === r.id)?.Lreport || r.isElement || perfilFull.Lpor?.[r.id]
                          ? fmt(r.L)
                          : <input className="field-input" style={{ width: 56, fontSize: 10.5, padding: '1px 4px' }} placeholder={fmt(L)} value={perfil.Lpor?.[r.id] ?? ''} onChange={(e) => setLpor(r.id, e.target.value)} onClick={(e) => e.stopPropagation()} />}
                      </td>
                      <td style={{ ...TD, color: r.profile.muPmax > group.caps.MRP ? '#1d4ed8' : undefined }}>{fmt(r.profile.muPmax)}</td>
                      <td style={{ ...TD, color: r.profile.muNmax > group.caps.MRN ? '#c94f2a' : undefined }}>{fmt(r.profile.muNmax)}</td>
                      <td style={{ ...TD, color: r.shearFail ? '#c62828' : undefined }}>{fmt(r.profile.vuMax)}</td>
                      <td style={{ ...TD, color: '#2563a8', whiteSpace: 'normal' }}>{barsTxt(r.inf.bars, form.calBastonInf)}</td>
                      <td style={{ ...TD, color: '#c94f2a', whiteSpace: 'normal' }}>{barsTxt(r.sup.bars, form.calBastonSup)}</td>
                      <td style={TD}>{pillDe(r)}</td>
                    </tr>
                  ))}
                  {filtro !== 'todos' && (
                    <tr><td style={{ ...TD, color: 'var(--color-tx3)', fontSize: 10 }} colSpan={8}>
                      {filas.length} de {group.n} · <button style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'var(--color-tx3)' }} onClick={() => setFiltro('todos')}>ver todos</button>
                    </td></tr>
                  )}
                  {filtro === 'todos' && [...excluidos].map((id) => (
                    <tr key={'ex' + id} style={{ opacity: 0.55 }}>
                      <td style={{ ...TD, fontWeight: 700 }}>M-{id} <button onClick={() => toggleExcluir(id)} style={{ fontSize: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-tx3)', textDecoration: 'underline', padding: 0 }}>incluir</button></td>
                      <td style={TD} colSpan={7}><Pill tone="muted">excluido del grupo{perfilFull.secPor?.[id] ? ` · ${perfilFull.secPor[id]}` : ''}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.patterns.map((p) => (
                  <div key={p.signature} onClick={() => setSel(p.sample.id)} style={{ padding: '8px 10px', borderRadius: 7, cursor: 'pointer', background: selected?.signature === p.signature ? 'rgba(91,197,174,0.12)' : 'var(--color-bg)', border: `1px solid ${selected?.signature === p.signature ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800 }}>Patrón {p.label}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>{p.members.length} miembro{p.members.length !== 1 ? 's' : ''}</span>
                      <span style={{ marginLeft: 'auto' }}>{pillDe(p.sample)}</span>
                    </div>
                    <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                      <div style={{ color: '#2563a8' }}>inf: {barsTxt(p.sample.inf.bars, form.calBastonInf)}</div>
                      <div style={{ color: '#c94f2a' }}>sup: {barsTxt(p.sample.sup.bars, form.calBastonSup)}</div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 4, fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>{p.members.map((id) => (p.sample.isElement ? `E ${id}` : `M-${id}`)).join(', ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Derecha: diagramas + alzado del miembro/patrón seleccionado */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selected && (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
                  <b>{unitLabel(selected)}</b> {pillDe(selected)}
                  {smaxWarn(selected) && <Pill tone="warn">⚠ s máx {fmt(selected.shear.extremos.sMax, 1)} cm (NTC d/2 ó d/4)</Pill>}
                  {selected.profile.ajuste && (
                    <Pill tone="warn">
                      ⚠ perfil ajustado ×{fmt(Math.max(selected.profile.ajuste.kP || 1, selected.profile.ajuste.kN || 1))} a los máximos de RAM
                      (Mu+ {fmt(selected.profile.ajuste.rep.muP)} · Mu− {fmt(selected.profile.ajuste.rep.muN)})
                    </Pill>
                  )}
                  <span>Mu+ {fmt(selected.profile.muPmax)} / MR+ {fmt(group.caps.MRP)}</span>
                  <span>Mu− {fmt(selected.profile.muNmax)} / MR− {fmt(group.caps.MRN)}</span>
                  <span>Vu {fmt(selected.profile.vuMax)} / Vr L4 {fmt(selected.shear.extremos.Vr)} · centro {fmt(selected.shear.centro.Vr)}</span>
                  {selected.shear.extremos.ok === false && <Pill tone="bad">extremos: E@{selected.shear.extremos.sReq ?? '—'} necesario</Pill>}
                  {selected.shear.centro.ok === false && <Pill tone="bad">centro: E@{selected.shear.centro.sReq ?? '—'} necesario</Pill>}
                  <span style={{ color: 'var(--color-tx3)' }}>Ld bastón {fmt(group.caps.inf.Ld.Ld, 0)}/{fmt(group.caps.sup.Ld.Ld, 0)} cm · prolongación ≥ máx(d, 12db) = {fmt(group.caps.inf.ext, 0)} cm</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {(() => {
                    const k = bastonesDe(selected)
                    const anotado = k.kInf === (+form.cantBastonPuntInf || 0) && k.kSup === (+form.cantBastonPuntSup || 0)
                    const menosQueElGrupo = k.kInf < group.kMaxInf || k.kSup < group.kMaxSup
                    return (
                      <>
                        <button className="btn btn-primary" style={{ fontSize: 10.5 }} data-testid="aplicar-baston"
                          disabled={anotado}
                          onClick={() => aplicarBastones([selected], `${unitLabel(selected)}: bastón puntual anotado en ${form.nombre}`)}
                          title={menosQueElGrupo
                            ? `Ojo: otros elementos de ${form.nombre} piden hasta ${group.kMaxInf}/${group.kMaxSup} puntuales. Anótalo así si vas a separarlo en su propia trabe.`
                            : 'Anota en la trabe los bastones puntuales que pide este elemento (no van al corte: salen en el alzado)'}>
                          ← Anotar su bastón puntual ({k.kInf}/{k.kSup}){anotado ? ' · ya está' : ''}
                        </button>
                        {!anotado && menosQueElGrupo && <Pill tone="warn">el grupo pide hasta {group.kMaxInf}/{group.kMaxSup}</Pill>}
                        <button className="btn btn-secondary" style={{ fontSize: 10.5 }} data-testid="separar-uno"
                          onClick={() => separar([selected])}
                          title="Saca este elemento a una trabe aparte con su propio bastoneo, y lo quita de ésta">
                          ⧉ Separarlo en otra trabe
                        </button>
                        <span style={{ fontSize: 10, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
                          con {k.kInf}/{k.kSup} puntual(es): MR+ {fmt(group.caps.inf.withK(k.kInf)?.MRT || group.caps.MRP)} · MR− {fmt(group.caps.sup.withK(k.kSup)?.MRT || group.caps.MRN)} t·m
                          {' vs '}Mu+ {fmt(selected.profile.muPmax)} · Mu− {fmt(selected.profile.muNmax)}
                        </span>
                      </>
                    )
                  })()}
                </div>
                {selected.status === 'insuficiente' && (
                  <div style={{ fontSize: 11, color: '#c62828', background: '#fdecea', border: '1px solid #ef9a9a', borderRadius: 6, padding: '6px 10px' }}>
                    Ni con {group.caps.inf.kMax}/{group.caps.sup.kMax} bastón(es) puntual(es) más (uno por varilla libre) alcanza:
                    {selected.inf.need.map((n, i) => <span key={'i' + i}> M+ {fmt(n.peak)} en x={fmt(n.peakX)} m (MR máx {fmt(n.MRmax)}).</span>)}
                    {selected.sup.need.map((n, i) => <span key={'s' + i}> M− {fmt(n.peak)} en x={fmt(n.peakX)} m (MR máx {fmt(n.MRmax)}).</span>)}
                    {' '}Sube el armado corrido o la sección.
                  </div>
                )}
                {[...selected.inf.bars, ...selected.sup.bars].some((b) => b.corteTension?.length) && (
                  <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px' }}>
                    Un bastón se corta en zona de tensión con Vu &gt; ⅔·Vr en el punto de corte (NTC §5.1.4.1): prolónguelo o añada estribos en ese tramo.
                  </div>
                )}
                <div dangerouslySetInnerHTML={{ __html: diagramSvg(selected, group.caps, { width: 760 }) }} />
                <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--color-border)', fontSize: 11 }}>
                    <b>Alzado</b> <span style={{ color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>{unitLabel(selected)} · L = {fmt(selected.L)} m</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--color-tx3)' }}>zoom</span>
                    {[['fit', 'ajustar'], ['1', '1×'], ['2', '2×']].map(([z, lbl]) => (
                      <button key={z} className="btn" onClick={() => setZoom(z)} style={{ fontSize: 10, padding: '2px 8px', background: zoom === z ? 'var(--color-accent)' : 'var(--color-panel)', color: zoom === z ? '#fff' : 'var(--color-tx2)', border: '1px solid var(--color-border)' }}>{lbl}</button>
                    ))}
                    <span style={{ color: 'var(--color-tx3)', fontSize: 10 }}>{zoom === 'fit' ? '' : '(desplázate horizontalmente)'}</span>
                  </div>
                  <div style={{ overflowX: 'auto', overflowY: 'hidden', padding: 6 }}
                    dangerouslySetInnerHTML={{ __html: elevationSvg(form, selected, { scale: zoom === '2' ? 8 : 5, title: `${form.nombre} · ${unitLabel(selected)}${vista === 'patrones' ? ` · patrón ${group.patterns.find((p) => p.signature === selected.signature)?.label || ''}` : ''}` }).svg.replace('<svg ', zoom === 'fit' ? '<svg style="max-width:100%;height:auto;display:block" ' : '<svg style="height:auto;display:block" ') }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-tx3)' }}>
                  La curva gruesa es la envolvente de resistencia real: sube en rampa a lo largo de Ld donde empieza el bastón (el acero se va desarrollando) y baja donde termina; si en la rampa el momento la rebasara, el bastón se alarga solo hasta cubrirlo. Bastón: desde el punto donde Mu rebasa el MR de las corridas, prolongado ≥ máx(d, 12db) y con Ld desde el pico; longitudes a múltiplos de 5 cm, medidas desde el apoyo I. Los que llegan a un extremo se anclan en él (gancho). Cortante por claros: cuartos extremos con @{form.sepLcuarto}, centro con @{form.sepRest}; los apoyos interiores (triángulos) se detectan donde el cortante salta y cambia de signo. Los alzados salen en su propio DXF (botones ⬇ DXF alzados), aparte del DXF de secciones de la barra.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import useCimStore from '../../store/useCimStore'
import { parseModeloRam } from '../../core/ramModel'
import { modeloGuardado, hace, EVENTO_MODELO } from '../../core/ramSync'
import { gira, GIRO_RAM } from '../../core/agrupacion'
import { PAPELES, papelesPorDefecto, apoyosDe, cargasDeApoyo, aisladasDesde, corridaDesde, contratrabeDesde, agruparPorLado, ladoRequerido } from '../../core/cim/reacciones'
import { tipoCim, nombreLibre, revisarCim, estadoCim } from '../../core/cim'
import { centroColumna } from '../../core/cim/aislada'
import { num } from '../../core/cim/comun'

// Cimientos a partir de las reacciones de los apoyos del modelo de RAM: se
// asigna el papel de cada caso de carga, se eligen apoyos en la planta y se
// crean zapatas aisladas (agrupadas en tipos), una corrida o una contratrabe.
// La misma planta es la de cimentación: cada apoyo con el cimiento que ya
// tiene, a escala, y qué tanto lo aprovecha con su propia reacción.

const GUARDADO = 'auxiv.cim.ram.papeles'
const leer = () => { try { return JSON.parse(localStorage.getItem(GUARDADO) || '{}') } catch { return {} } }
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—')
const pct = (u) => (Number.isFinite(u) ? `${Math.round(u * 100)} %` : '—')

// el color de la utilización: holgado, justo, no cumple
const tonoDe = (u, ok) => (!ok || !(u <= 1 + 1e-9) ? { c: '#c62828', f: 'rgba(198,40,40,0.16)' } : u > 0.85 ? { c: '#b45309', f: 'rgba(232,131,10,0.16)' } : { c: '#1a7a5e', f: 'rgba(26,122,94,0.14)' })
const CORTO = { aislada: 'aislada', corrida: 'corrida', contratrabe: 'contratrabe' }

/**
 * Los cimientos que salieron de estos apoyos, en planta (m del modelo): cada
 * aislada en cada uno de sus apoyos (con la reacción de ese apoyo), y las
 * corridas y contratrabes como franjas sobre su eje.
 */
function cimentacionEnPlanta(A, cimientos, cargas, obra) {
  const idx = new Map(A.apoyos.map((a, i) => [a.nudo, i]))
  const items = [], porNudo = new Map()
  const anota = (n, it) => { if (!porNudo.has(n)) porNudo.set(n, []); porNudo.get(n).push(it) }
  for (const z of cimientos) {
    const nudos = (z.origen?.ram?.nudos || []).map(String).filter((n) => idx.has(n))
    if (!nudos.length) continue
    if (z.tipo === 'aislada') {
      const B = num(z.geo.B, 1), L = num(z.geo.cuadrada ? z.geo.B : z.geo.L, 1)
      const { xc, yc } = centroColumna({ ...z.geo, L })
      for (const n of nudos) {
        const i = idx.get(n), a = A.apoyos[i]
        // con la reacción de hoy de este apoyo: si el modelo cambió, se nota aquí
        const R = revisarCim({ ...z, cargas: cargas[i], apoyos: [] }, obra)
        const { u } = estadoCim(R)
        const cx = a.x - xc, cy = a.y - yc
        const it = {
          z, n, u, ok: R.ok, rige: R.checks.filter((c) => !c.ok).map((c) => c.titulo.toLowerCase()),
          poly: [[cx - B / 2, cy - L / 2], [cx + B / 2, cy - L / 2], [cx + B / 2, cy + L / 2], [cx - B / 2, cy + L / 2]],
        }
        items.push(it); anota(n, it)
      }
    } else if (z.tipo === 'corrida' || z.tipo === 'contratrabe') {
      const pts = nudos.map((n) => A.apoyos[idx.get(n)])
      // el eje: de los dos apoyos más lejanos
      let p = pts[0], q = pts[pts.length - 1], dMax = -1
      for (const s of pts) for (const t of pts) { const d = Math.hypot(t.x - s.x, t.y - s.y); if (d > dMax) { dMax = d; p = s; q = t } }
      const largo = Math.max(dMax, 1e-6)
      let u = [(q.x - p.x) / largo, (q.y - p.y) / largo]
      let ini, L
      if (z.tipo === 'contratrabe') {
        L = num(z.geo.L, largo)
        const c0 = (z.columnas || []).find((c) => c.nudo != null && idx.has(String(c.nudo)))
        const cN = [...(z.columnas || [])].reverse().find((c) => c.nudo != null && idx.has(String(c.nudo)))
        if (c0 && cN && c0 !== cN) {
          const a0 = A.apoyos[idx.get(String(c0.nudo))], aN = A.apoyos[idx.get(String(cN.nudo))]
          const d = Math.hypot(aN.x - a0.x, aN.y - a0.y) || 1
          u = [(aN.x - a0.x) / d, (aN.y - a0.y) / d]
          ini = [a0.x - num(c0.x) * u[0], a0.y - num(c0.x) * u[1]]
        } else ini = [p.x - (L - largo) / 2 * u[0], p.y - (L - largo) / 2 * u[1]]
      } else {
        L = num(z.geo.Lz, largo)
        const m = [(p.x + q.x) / 2, (p.y + q.y) / 2]
        ini = [m[0] - (L / 2) * u[0], m[1] - (L / 2) * u[1]]
      }
      const B = num(z.geo.B, 1), nv = [-u[1] * B / 2, u[0] * B / 2]
      const fin = [ini[0] + L * u[0], ini[1] + L * u[1]]
      const R = revisarCim(z, obra)
      const { u: ut } = estadoCim(R)
      const it = {
        z, nudos, u: ut, ok: R.ok, rige: R.checks.filter((c) => !c.ok).map((c) => c.titulo.toLowerCase()), franja: true,
        poly: [[ini[0] + nv[0], ini[1] + nv[1]], [fin[0] + nv[0], fin[1] + nv[1]], [fin[0] - nv[0], fin[1] - nv[1]], [ini[0] - nv[0], ini[1] - nv[1]]],
        eje: [ini, fin],
      }
      items.push(it)
      for (const n of nudos) anota(n, it)
    }
  }
  return { items, porNudo }
}

export default function CimRam({ obra, onClose, onToast }) {
  const cimientos = useCimStore((s) => s.cimientos)
  const agregarVarios = useCimStore((s) => s.agregarVarios)
  const seleccionar = useCimStore((s) => s.seleccionar)
  const [fuente, setFuente] = useState(null)
  const [aviso, setAviso] = useState('')
  const [papeles, setPapeles] = useState(leer)
  const [sel, setSel] = useState(() => new Set())
  const [tipos, setTipos] = useState(3)
  const [caja, setCaja] = useState(null)
  const [vista, setVista] = useState(null)       // 'cim' | 'cargas'; null = según haya cimientos
  const archivoRef = useRef(null)
  const svgRef = useRef(null)

  const usar = (texto, archivo, at = Date.now()) => {
    const R = parseModeloRam(texto, archivo)
    if (!R.ok) { setAviso(R.warnings[0] || 'No se pudo leer el modelo.'); return }
    setAviso(''); setFuente({ archivo, at, R }); setSel(new Set())
  }
  useEffect(() => {
    const cargar = () => modeloGuardado().then((m) => { if (m?.datos) usar(m.datos, m.archivo || 'modelo.json', m.at) })
    cargar()
    window.addEventListener(EVENTO_MODELO, cargar)
    return () => window.removeEventListener(EVENTO_MODELO, cargar)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const R = fuente?.R
  const A = useMemo(() => (R ? apoyosDe(R) : null), [R])
  const casos = R?.casos || []
  const pap = useMemo(() => {
    const def = papelesPorDefecto(casos)
    return Object.fromEntries(casos.map((c) => [c.id, papeles[c.id] || def[c.id]]))
  }, [casos, papeles])
  useEffect(() => { try { localStorage.setItem(GUARDADO, JSON.stringify(papeles)) } catch { /* sin almacenamiento */ } }, [papeles])

  const cargas = useMemo(() => (A ? A.apoyos.map((a) => cargasDeApoyo(a, pap, A.up)) : []), [A, pap])
  const servicio = cargas.map((c) => c.CM.P + c.CV.P)
  const elegidos = A ? A.apoyos.filter((a) => sel.has(a.nudo)) : []
  const idxElegidos = A ? A.apoyos.map((a, i) => (sel.has(a.nudo) ? i : -1)).filter((i) => i >= 0) : []

  // ── la cimentación que ya hay sobre estos apoyos ──
  const planta = useMemo(() => (A ? cimentacionEnPlanta(A, cimientos, cargas, obra) : { items: [], porNudo: new Map() }), [A, cimientos, cargas, obra])
  const verCim = (vista ?? (planta.items.length ? 'cim' : 'cargas')) === 'cim'
  const cubiertos = A ? A.apoyos.filter((a) => planta.porNudo.has(a.nudo)).length : 0
  const faltan = A ? A.apoyos.filter((a) => !planta.porNudo.has(a.nudo)) : []
  const dobles = A ? A.apoyos.filter((a) => new Set((planta.porNudo.get(a.nudo) || []).map((it) => it.z.uid)).size > 1) : []
  // por cimiento: su peor apoyo y cuántos cubre
  const resumenCim = useMemo(() => {
    const m = new Map()
    for (const it of planta.items) {
      const r = m.get(it.z.uid) || { z: it.z, u: 0, ok: true, nApoyos: 0 }
      m.set(it.z.uid, { ...r, u: Math.max(r.u, it.u), ok: r.ok && it.ok, nApoyos: r.nApoyos + (it.franja ? it.nudos.length : 1) })
    }
    return [...m.values()].sort((a, b) => (a.ok === b.ok ? b.u - a.u : a.ok ? 1 : -1))
  }, [planta])

  // ── planta ──
  const W = 640, H = 460, M = 36
  const geo = useMemo(() => {
    if (!A?.apoyos.length) return null
    // que quepan los apoyos y los cimientos dibujados
    const todos = [...A.apoyos.map((a) => [a.x, a.y]), ...planta.items.flatMap((it) => it.poly)]
    const pts0 = todos.map(([x, y]) => gira(x, y, GIRO_RAM))
    const xs = pts0.map((p) => p[0]), ys = pts0.map((p) => p[1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const k = Math.min((W - 2 * M) / Math.max(x1 - x0, 1), (H - 2 * M) / Math.max(y1 - y0, 1))
    const ox = M + ((W - 2 * M) - (x1 - x0) * k) / 2, oy = M + ((H - 2 * M) - (y1 - y0) * k) / 2
    const P = (x, y) => { const [a, b] = gira(x, y, GIRO_RAM); return [ox + (a - x0) * k, oy + (b - y0) * k] }
    // miembros al nivel de los apoyos, de contexto
    const nodes = R.model?.nodes || {}
    const elevMin = Math.min(...A.apoyos.map((a) => a.elev))
    const up = A.up
    const cerca = (n) => n && Math.abs((n[up] ?? 0) - elevMin) < 0.3
    const lineas = (R.model?.rows || []).map((r) => {
      const a = nodes[r.nj], b = nodes[r.nk]
      if (!cerca(a) || !cerca(b)) return null
      return [P(a[A.plano[0]], a[A.plano[1]]), P(b[A.plano[0]], b[A.plano[1]])]
    }).filter(Boolean)
    return { P, k, lineas, pts: A.apoyos.map((a) => P(a.x, a.y)) }
  }, [A, R, planta])
  const maxP = Math.max(1e-6, ...servicio)

  const punto = (e) => { const r = svgRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const empezarCaja = (e) => { if (e.target.dataset.nudo || e.target.dataset.cim) return; const p = punto(e); setCaja({ a: p, b: p, suma: e.shiftKey || e.ctrlKey || e.metaKey }) }
  const moverCaja = (e) => { if (caja) setCaja({ ...caja, b: punto(e) }) }
  const soltarCaja = () => {
    if (!caja || !geo) { setCaja(null); return }
    const [x0, x1] = [Math.min(caja.a[0], caja.b[0]), Math.max(caja.a[0], caja.b[0])]
    const [y0, y1] = [Math.min(caja.a[1], caja.b[1]), Math.max(caja.a[1], caja.b[1])]
    if (x1 - x0 > 4 || y1 - y0 > 4) {
      const n = new Set(caja.suma ? sel : [])
      A.apoyos.forEach((a, i) => { const [x, y] = geo.pts[i]; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) n.add(a.nudo) })
      setSel(n)
    } else if (!caja.suma) setSel(new Set())
    setCaja(null)
  }
  const tocar = (nudo, e) => {
    const n = new Set(e.shiftKey || e.ctrlKey || e.metaKey ? sel : [])
    if (n.has(nudo)) n.delete(nudo); else n.add(nudo)
    setSel(n)
  }
  const abrir = (z) => { seleccionar(z.uid); onClose() }

  const archivo = fuente?.archivo || ''
  const grupos = useMemo(() => (idxElegidos.length ? agruparPorLado(idxElegidos.map((i) => ladoRequerido(cargas[i], obra)), tipos) : []), [idxElegidos.join(','), tipos, cargas, obra]) // eslint-disable-line react-hooks/exhaustive-deps
  const conNombres = (lista) => {
    const hechos = [...cimientos]
    return lista.map((z) => { const n = { ...z, nombre: nombreLibre(z.tipo, hechos) }; hechos.push(n); return n })
  }
  const crear = (lista, que) => {
    if (!lista.length) return
    const armados = conNombres(lista).map((z) => { try { return { ...z, ...tipoCim(z.tipo).proponer(z, obra) } } catch { return z } })
    agregarVarios(armados)
    const yaTenian = elegidos.filter((a) => planta.porNudo.has(a.nudo)).map((a) => a.nudo)
    onToast?.(`${que}: ${armados.map((z) => z.nombre).join(', ')} desde las reacciones de RAM, ya dimensionados y armados${yaTenian.length ? ` · ojo: ${yaTenian.length} apoyo(s) ya tenían cimiento` : ''}`, yaTenian.length ? 'warn' : undefined)
    // se queda abierta para ver cómo va la cimentación
    setSel(new Set()); setVista('cim')
  }

  const poli = (pts) => pts.map(([x, y]) => geo.P(x, y).map((v) => v.toFixed(1)).join(',')).join(' ')

  return (
    <div className="cim-modal-fondo" onClick={onClose}>
      <div className="cim-modal cim-modal-ancho" onClick={(e) => e.stopPropagation()} data-testid="cim-ram">
        <header>
          <b>Cimientos desde las reacciones de RAM</b>
          <span>{fuente ? `${fuente.archivo} · ${A?.apoyos.length || 0} apoyos · ${hace(fuente.at)}` : 'Sin modelo sincronizado'}</span>
          <button className="cim-mini" onClick={() => archivoRef.current?.click()}>abrir modelo.json…</button>
          <input ref={archivoRef} type="file" accept=".json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) usar(await f.text(), f.name, f.lastModified) }} />
          <button className="cim-mini" onClick={onClose}>cerrar ✕</button>
        </header>
        {aviso && <div className="cim-avisos"><li>{aviso}</li></div>}
        {!fuente && !aviso && (
          <div className="cim-modal-cuerpo"><p className="cim-nota">Sincroniza el modelo desde <b>Reportes de RAM → ⚡ Desde RAM</b> (o abre su modelo.json) y vuelve aquí.</p></div>
        )}
        {fuente && A && !A.apoyos.length && (
          <div className="cim-modal-cuerpo"><p className="cim-nota">El modelo no trae reacciones de apoyos. Vuelve a generar sincronizar.py desde la app y sincroniza.</p></div>
        )}
        {fuente && A?.apoyos.length > 0 && (
          <div className="cim-ram-cuerpo">
            <div className="cim-ram-izq">
              <div className="cim-grupo-t">Papel de cada caso</div>
              {!A.conCasos && (
                <p className="cim-aviso-mini" data-testid="cim-ram-sincasos">Este modelo trae las reacciones sólo por combinación. Vuelve a generar <b>sincronizar.py</b> desde la app (Reportes de RAM → Configurar RAM) y sincroniza para tenerlas por caso (CM, CV, sismo).</p>
              )}
              {casos.map((c) => (
                <label key={c.id} className="cim-caso-fila">
                  <span title={c.descripcion}>{c.id}<small>{c.descripcion && c.descripcion !== c.id ? ` · ${c.descripcion}` : ''}</small></span>
                  <select className="field-select" value={pap[c.id]} data-testid={`cim-papel-${c.id}`} onChange={(e) => setPapeles({ ...papeles, [c.id]: e.target.value })}>
                    {PAPELES.map((p) => <option key={p.id} value={p.id}>{p.t}</option>)}
                  </select>
                </label>
              ))}
              <p className="cim-nota">La muerta y la viva de servicio dimensionan; el sismo entra cargando y descargando cada apoyo, 1.1 (CM + CV ± S), con su momento y su cortante. Las combinaciones no se usan aquí.</p>
            </div>
            <div className="cim-ram-centro">
              <div className="cim-ram-herr">
                <div className="cim-seg" role="tablist">
                  <button role="tab" aria-selected={verCim} className={verCim ? 'on' : ''} data-testid="cim-ram-vista-cim" onClick={() => setVista('cim')}>Cimentación</button>
                  <button role="tab" aria-selected={!verCim} className={!verCim ? 'on' : ''} data-testid="cim-ram-vista-cargas" onClick={() => setVista('cargas')}>Cargas</button>
                </div>
                <span>{sel.size ? `${sel.size} apoyo(s) elegidos` : 'Clic en un apoyo o arrastra una ventana; Mayús suma'}</span>
                <button className="cim-mini" data-testid="cim-ram-todos" onClick={() => setSel(new Set(A.apoyos.map((a) => a.nudo)))}>todos</button>
                <button className="cim-mini" onClick={() => setSel(new Set())}>ninguno</button>
              </div>
              <svg ref={svgRef} width={W} height={H} className="cim-ram-planta" data-testid="cim-ram-planta"
                onPointerDown={empezarCaja} onPointerMove={moverCaja} onPointerUp={soltarCaja}>
                {geo?.lineas.map(([p, q], i) => <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#cfc8bd" strokeWidth={1.4} />)}
                {verCim && planta.items.map((it, j) => {
                  const t = tonoDe(it.u, it.ok)
                  const pts = it.poly.map(([x, y]) => geo.P(x, y))
                  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = Math.min(...pts.map((p) => p[1]))
                  const ancho = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]))
                  return (
                    <g key={`${it.z.uid}-${it.n || j}`} className="cim-plan-item" data-testid={it.franja ? `cim-plan-${it.z.nombre}` : `cim-plan-${it.z.nombre}-${it.n}`}
                      onPointerDown={(e) => { e.stopPropagation() }} onClick={() => abrir(it.z)} style={{ cursor: 'pointer' }}>
                      <polygon data-cim={it.z.uid} points={poli(it.poly)} fill={t.f} stroke={t.c} strokeWidth={1.5} />
                      {it.franja && <line x1={geo.P(...it.eje[0])[0]} y1={geo.P(...it.eje[0])[1]} x2={geo.P(...it.eje[1])[0]} y2={geo.P(...it.eje[1])[1]} stroke={t.c} strokeWidth={it.z.tipo === 'contratrabe' ? 3.2 : 1} strokeDasharray={it.z.tipo === 'contratrabe' ? undefined : '5 3'} pointerEvents="none" />}
                      {(it.franja || ancho > 26) && <text x={cx} y={cy - 3} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={t.c} fontFamily="Instrument Sans, sans-serif" pointerEvents="none">{it.z.nombre}{it.franja ? ` · ${pct(it.u)}` : ''}</text>}
                      <title>{`${it.z.nombre} · ${tipoCim(it.z.tipo).nombre}${it.n ? ` en el nudo ${it.n}` : ` sobre ${it.nudos.length} apoyos`}: ${pct(it.u)}${it.ok ? '' : ` · no cumple: ${it.rige.join(', ')}`} · clic para abrirlo`}</title>
                    </g>
                  )
                })}
                {A.apoyos.map((a, i) => {
                  const [x, y] = geo.pts[i]
                  const on = sel.has(a.nudo)
                  const suyos = planta.porNudo.get(a.nudo) || []
                  const doble = new Set(suyos.map((it) => it.z.uid)).size > 1
                  const suyo = suyos.find((it) => !it.franja) || suyos[0]
                  if (verCim) {
                    const t = suyo ? tonoDe(suyo.u, suyo.ok) : null
                    return (
                      <g key={a.nudo}>
                        {doble && <circle cx={x} cy={y} r={9} fill="none" stroke="#c62828" strokeWidth={1.4} strokeDasharray="3 2" pointerEvents="none" />}
                        <circle data-nudo={a.nudo} data-testid={`cim-apoyo-${a.nudo}`} cx={x} cy={y} r={on ? 6 : 4.5}
                          fill={on ? '#e8830a' : suyo ? t.c : '#fff'} stroke={on ? '#b45309' : suyo ? t.c : '#8a837a'} strokeWidth={1.3} strokeDasharray={suyo || on ? undefined : '2.5 2'}
                          style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); tocar(a.nudo, e) }}>
                          <title>{`Nudo ${a.nudo}: ${suyos.length ? suyos.map((it) => `${it.z.nombre} ${pct(it.u)}`).join(' · ') : 'sin cimiento'}${doble ? ' · ¡está en dos cimientos!' : ''}`}</title>
                        </circle>
                        <text x={x + 7} y={y - 3} fontSize={8.5} fill="#8a837a" fontFamily="DM Mono, monospace" pointerEvents="none">{a.nudo}</text>
                        {suyo && !suyo.franja && <text data-testid={`cim-u-${a.nudo}`} x={x + 7} y={y + 8} fontSize={9.5} fontWeight={700} fill={t.c} fontFamily="DM Mono, monospace" pointerEvents="none">{pct(suyo.u)}</text>}
                        {!suyos.length && <text x={x + 7} y={y + 8} fontSize={8.5} fill="#8a837a" fontFamily="DM Mono, monospace" pointerEvents="none">sin cimiento</text>}
                      </g>
                    )
                  }
                  const r = 4 + 9 * Math.sqrt(Math.max(0, servicio[i]) / maxP)
                  return (
                    <g key={a.nudo}>
                      <circle data-nudo={a.nudo} data-testid={`cim-apoyo-${a.nudo}`} cx={x} cy={y} r={r} fill={on ? '#e8830a' : '#5bc5ae'} fillOpacity={on ? 0.85 : 0.55} stroke={on ? '#b45309' : '#1a7a5e'} strokeWidth={1.2}
                        style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); tocar(a.nudo, e) }}>
                        <title>{`Nudo ${a.nudo}: CM ${f2(cargas[i].CM.P)} t · CV ${f2(cargas[i].CV.P)} t · S ${f2(cargas[i].S.P)} t${a.col ? ` · columna ${a.col.c1}×${a.col.c2}` : ''}`}</title>
                      </circle>
                      <text x={x + r + 2} y={y - 2} fontSize={9} fill="#6b6760" fontFamily="DM Mono, monospace" pointerEvents="none">{a.nudo}</text>
                      <text x={x + r + 2} y={y + 8} fontSize={9} fill="#1a1814" fontFamily="DM Mono, monospace" pointerEvents="none">{servicio[i].toFixed(1)} t</text>
                    </g>
                  )
                })}
                {caja && <rect x={Math.min(caja.a[0], caja.b[0])} y={Math.min(caja.a[1], caja.b[1])} width={Math.abs(caja.b[0] - caja.a[0])} height={Math.abs(caja.b[1] - caja.a[1])} fill="rgba(232,131,10,0.08)" stroke="#e8830a" strokeDasharray="4 3" />}
              </svg>
              {verCim ? (
                <div className="cim-ram-leyenda">
                  <span><i className="cuadro" /> zapata aislada, a escala</span>
                  <span><i className="franja" /> corrida o contratrabe</span>
                  <span><i style={{ background: '#1a7a5e' }} /> ≤ 85 %</span>
                  <span><i style={{ background: '#b45309' }} /> ≤ 100 %</span>
                  <span><i style={{ background: '#c62828' }} /> no cumple</span>
                  <span><i className="vacio" /> sin cimiento</span>
                  <span className="gris">% con la reacción de cada apoyo · clic en un cimiento para abrirlo</span>
                </div>
              ) : <div className="cim-nota">Círculo: carga de servicio CM + CV del apoyo. Planta orientada como RAM.</div>}
            </div>
            <div className="cim-ram-der">
              <div className="cim-grupo-t">Planta de cimentación</div>
              <div className="cim-ram-resumen" data-testid="cim-ram-resumen">
                <div className="cim-ram-avance"><i style={{ width: `${(100 * cubiertos) / A.apoyos.length}%` }} /></div>
                <b>{cubiertos} de {A.apoyos.length}</b> apoyos con cimiento
                {faltan.length > 0 && <button className="cim-mini" data-testid="cim-ram-faltan" onClick={() => setSel(new Set(faltan.map((a) => a.nudo)))}>elegir los {faltan.length} que faltan</button>}
              </div>
              {dobles.length > 0 && <p className="cim-aviso-mini" data-testid="cim-ram-dobles">Nudo{dobles.length > 1 ? 's' : ''} {dobles.map((a) => a.nudo).join(', ')} en dos cimientos: borra el que sobre.</p>}
              {resumenCim.length > 0 && (
                <div className="cim-ram-lista" data-testid="cim-ram-lista">
                  {resumenCim.map((r) => {
                    const t = tonoDe(r.u, r.ok)
                    return (
                      <button key={r.z.uid} onClick={() => abrir(r.z)} title="Abrirlo" data-testid={`cim-ram-cim-${r.z.nombre}`}>
                        <b>{r.z.nombre}</b>
                        <span>{CORTO[r.z.tipo] || r.z.tipo} · {r.nApoyos} apoyo{r.nApoyos > 1 ? 's' : ''}</span>
                        <em style={{ color: t.c }}>{pct(r.u)}{r.ok ? '' : ' ✗'}</em>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="cim-grupo-t" style={{ marginTop: 10 }}>Zapatas aisladas</div>
              <label className="cim-caso-fila"><span>tipos de zapata</span>
                <select className="field-select" value={tipos} data-testid="cim-ram-tipos" onChange={(e) => setTipos(+e.target.value)}>{[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
              {grupos.length > 0 && (
                <table className="cim-mini-tabla" data-testid="cim-ram-grupos">
                  <thead><tr><th>tipo</th><th>apoyos</th><th>lado pedido</th></tr></thead>
                  <tbody>{grupos.map((g, i) => <tr key={i}><td>{i + 1}</td><td>{g.idx.length}</td><td>{f2(g.desde)}–{f2(g.hasta)} m</td></tr>)}</tbody>
                </table>
              )}
              <button className="btn btn-primary" data-testid="cim-ram-aisladas" disabled={!sel.size} onClick={() => crear(aisladasDesde(elegidos, pap, A.up, { tipos, obra, archivo }), 'Zapatas aisladas')}>
                Crear {Math.min(tipos, sel.size) || ''} tipo(s) de zapata
              </button>
              <button className="btn btn-secondary" data-testid="cim-ram-una" disabled={!sel.size} onClick={() => crear(aisladasDesde(elegidos, pap, A.up, { tipos: 1, obra, archivo }), 'Zapata aislada')}>
                Una zapata para todos (envolvente)
              </button>
              <div className="cim-grupo-t" style={{ marginTop: 10 }}>Sobre un eje</div>
              <button className="btn btn-secondary" data-testid="cim-ram-corrida" disabled={sel.size < 2} onClick={() => { const z = corridaDesde(elegidos, pap, A.up, { archivo }); if (z) crear([z], 'Zapata corrida') }}>
                Zapata corrida (muro sobre estos apoyos)
              </button>
              <button className="btn btn-secondary" data-testid="cim-ram-contratrabe" disabled={sel.size < 2} onClick={() => { const z = contratrabeDesde(elegidos, pap, A.up, { archivo }); if (z) crear([z], 'Contratrabe') }}>
                Corrida con contratrabe (columnas del eje)
              </button>
              <p className="cim-nota">Cada cimiento guarda de qué nudos salió y se revisa con la reacción de cada uno. Con un modelo nuevo, la planta dice cuáles ya no alcanzan.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

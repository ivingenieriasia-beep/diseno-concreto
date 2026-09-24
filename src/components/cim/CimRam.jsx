import { useEffect, useMemo, useRef, useState } from 'react'
import useCimStore from '../../store/useCimStore'
import { parseModeloRam } from '../../core/ramModel'
import { modeloGuardado, hace, EVENTO_MODELO } from '../../core/ramSync'
import { gira, GIRO_RAM } from '../../core/agrupacion'
import { PAPELES, papelesPorDefecto, apoyosDe, cargasDeApoyo, aisladasDesde, corridaDesde, contratrabeDesde, agruparPorLado, ladoRequerido } from '../../core/cim/reacciones'
import { tipoCim, nombreLibre } from '../../core/cim'

// Cimientos a partir de las reacciones de los apoyos del modelo de RAM: se
// asigna el papel de cada caso de carga, se eligen apoyos en la planta y se
// crean zapatas aisladas (agrupadas en tipos), una corrida o una contratrabe.

const GUARDADO = 'auxiv.cim.ram.papeles'
const leer = () => { try { return JSON.parse(localStorage.getItem(GUARDADO) || '{}') } catch { return {} } }
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—')

export default function CimRam({ obra, onClose, onToast }) {
  const cimientos = useCimStore((s) => s.cimientos)
  const agregarVarios = useCimStore((s) => s.agregarVarios)
  const [fuente, setFuente] = useState(null)
  const [aviso, setAviso] = useState('')
  const [papeles, setPapeles] = useState(leer)
  const [sel, setSel] = useState(() => new Set())
  const [tipos, setTipos] = useState(3)
  const [caja, setCaja] = useState(null)
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

  // ── planta ──
  const W = 640, H = 460, M = 36
  const geo = useMemo(() => {
    if (!A?.apoyos.length) return null
    const pts = A.apoyos.map((a) => gira(a.x, a.y, GIRO_RAM))
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
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
      const p = P(a[A.plano[0]], a[A.plano[1]]), q = P(b[A.plano[0]], b[A.plano[1]])
      return [p, q]
    }).filter(Boolean)
    return { P, lineas, pts: A.apoyos.map((a) => P(a.x, a.y)) }
  }, [A, R])
  const maxP = Math.max(1e-6, ...servicio)

  const punto = (e) => { const r = svgRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const empezarCaja = (e) => { if (e.target.dataset.nudo) return; const p = punto(e); setCaja({ a: p, b: p, suma: e.shiftKey || e.ctrlKey || e.metaKey }) }
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
    const n = new Set(e.shiftKey || e.ctrlKey || e.metaKey ? sel : sel.has(nudo) && sel.size === 1 ? [] : [])
    if (n.has(nudo)) n.delete(nudo); else n.add(nudo)
    setSel(n)
  }

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
    onToast?.(`${que}: ${armados.map((z) => z.nombre).join(', ')} desde las reacciones de RAM, ya dimensionados y armados`)
    onClose()
  }

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
              <p className="cim-nota">La muerta y la viva de servicio dimensionan; el sismo entra en 1.1 (CM + CV + S). Las combinaciones no se usan aquí.</p>
            </div>
            <div className="cim-ram-centro">
              <div className="cim-ram-herr">
                <span>{sel.size ? `${sel.size} apoyo(s) elegidos` : 'Clic en un apoyo o arrastra una ventana; Mayús suma'}</span>
                <button className="cim-mini" data-testid="cim-ram-todos" onClick={() => setSel(new Set(A.apoyos.map((a) => a.nudo)))}>todos</button>
                <button className="cim-mini" onClick={() => setSel(new Set())}>ninguno</button>
              </div>
              <svg ref={svgRef} width={W} height={H} className="cim-ram-planta" data-testid="cim-ram-planta"
                onPointerDown={empezarCaja} onPointerMove={moverCaja} onPointerUp={soltarCaja}>
                {geo?.lineas.map(([p, q], i) => <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#cfc8bd" strokeWidth={1.4} />)}
                {A.apoyos.map((a, i) => {
                  const [x, y] = geo.pts[i]
                  const r = 4 + 9 * Math.sqrt(Math.max(0, servicio[i]) / maxP)
                  const on = sel.has(a.nudo)
                  return (
                    <g key={a.nudo}>
                      <circle data-nudo={a.nudo} data-testid={`cim-apoyo-${a.nudo}`} cx={x} cy={y} r={r} fill={on ? '#e8830a' : '#5bc5ae'} fillOpacity={on ? 0.85 : 0.55} stroke={on ? '#b45309' : '#1a7a5e'} strokeWidth={1.2}
                        style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); tocar(a.nudo, e) }}>
                        <title>{`Nudo ${a.nudo}: CM ${f2(cargas[i].CM.P)} t · CV ${f2(cargas[i].CV.P)} t · S ${f2(cargas[i].S.P)} t`}</title>
                      </circle>
                      <text x={x + r + 2} y={y - 2} fontSize={9} fill="#6b6760" fontFamily="DM Mono, monospace" pointerEvents="none">{a.nudo}</text>
                      <text x={x + r + 2} y={y + 8} fontSize={9} fill="#1a1814" fontFamily="DM Mono, monospace" pointerEvents="none">{servicio[i].toFixed(1)} t</text>
                    </g>
                  )
                })}
                {caja && <rect x={Math.min(caja.a[0], caja.b[0])} y={Math.min(caja.a[1], caja.b[1])} width={Math.abs(caja.b[0] - caja.a[0])} height={Math.abs(caja.b[1] - caja.a[1])} fill="rgba(232,131,10,0.08)" stroke="#e8830a" strokeDasharray="4 3" />}
              </svg>
              <div className="cim-nota">Círculo: carga de servicio CM + CV del apoyo. Planta orientada como RAM.</div>
            </div>
            <div className="cim-ram-der">
              <div className="cim-grupo-t">Zapatas aisladas</div>
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
              <div className="cim-grupo-t" style={{ marginTop: 12 }}>Sobre un eje</div>
              <button className="btn btn-secondary" data-testid="cim-ram-corrida" disabled={sel.size < 2} onClick={() => { const z = corridaDesde(elegidos, pap, A.up, { archivo }); if (z) crear([z], 'Zapata corrida') }}>
                Zapata corrida (muro sobre estos apoyos)
              </button>
              <button className="btn btn-secondary" data-testid="cim-ram-contratrabe" disabled={sel.size < 2} onClick={() => { const z = contratrabeDesde(elegidos, pap, A.up, { archivo }); if (z) crear([z], 'Contratrabe') }}>
                Corrida con contratrabe (columnas del eje)
              </button>
              <p className="cim-nota">Cada cimiento guarda de qué nudos salió. Con un modelo nuevo, vuelve a crearlos o edítalos a mano.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

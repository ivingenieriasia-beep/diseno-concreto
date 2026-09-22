import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { projectModel, detectUpAxis, levels, planAxes, memberToChain } from '../core/modelView'

// Reconstrucción del modelo de RAM: se dibuja lo que la app entendió de los
// nudos y los miembros, coloreado por el estado de diseño de cada elemento.
// Sirve para ubicar en el edificio al que falla y para comprobar que los
// tramos se encadenaron como uno espera.

const C = {
  resto: '#c9cfda',
  excl: '#9aa3b2',
  ok: '#15803d',
  bast: '#1d4ed8',
  bad: '#c62828',
  sel: '#f59e0b',
  nodo: '#8b93a3',
}
const VISTAS = [['iso', 'Isométrica'], ['planta', 'Planta'], ['frente', 'Frente'], ['lado', 'Lado']]
const PASOS = [1, 2, 5, 10, 20, 50]

export default function ModelView({
  nodes, rows, results, porElemento = true, selectedId, onSelect,
  excluidos, chains, archivo = '', trabe = '',
}) {
  const [vista, setVista] = useState('iso')
  const [nivel, setNivel] = useState(null)
  const [soloGrupo, setSoloGrupo] = useState(false)
  const [verNudos, setVerNudos] = useState(false)
  const [vb, setVb] = useState(null)
  const [hover, setHover] = useState(null)
  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const drag = useRef(null)
  const [caja, setCaja] = useState({ w: 600, h: 400 })

  const up = useMemo(() => detectUpAxis(nodes), [nodes])
  const niveles = useMemo(() => levels(nodes, up), [nodes, up])
  const proj = useMemo(() => projectModel(nodes, rows, { vista, up, nivel }), [nodes, rows, vista, up, nivel])

  // miembro → estado de diseño y unidad (elemento o miembro) a la que pertenece
  const porMiembro = useMemo(() => {
    const m = new Map()
    for (const r of results || []) {
      const tone = r.status === 'insuficiente' || r.shearFail ? 'bad' : r.status === 'baston' ? 'bast' : 'ok'
      const ids = r.isElement ? r.members.map((x) => String(x.id)) : [String(r.id)]
      for (const id of ids) m.set(id, { tone, unit: r.id })
    }
    for (const id of excluidos || []) if (!m.has(String(id))) m.set(String(id), { tone: 'excl', unit: null })
    return m
  }, [results, excluidos])

  const cadenaDe = useMemo(() => memberToChain(chains), [chains])
  const miembrosSel = useMemo(() => {
    if (selectedId == null) return new Set()
    const s = new Set()
    for (const [id, ch] of cadenaDe) if (ch === selectedId) s.add(id)
    if (!s.size) s.add(String(selectedId))
    return s
  }, [selectedId, cadenaDe])

  // ── encuadre ──
  const fit = () => {
    const b = proj.bounds
    const pad = Math.max(b.w, b.h) * 0.05 + 0.3
    setVb([b.minX - pad, b.minY - pad, b.w + 2 * pad, b.h + 2 * pad])
  }
  useEffect(fit, [vista, nivel, proj.bounds.w, proj.bounds.h]) // eslint-disable-line

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const medir = () => setCaja({ w: el.clientWidth || 600, h: el.clientHeight || 400 })
    const ro = new ResizeObserver(medir)
    ro.observe(el); medir()
    return () => ro.disconnect()
  }, [])

  // zoom con la rueda, centrado en el cursor (no pasivo para poder frenar el scroll)
  useEffect(() => {
    const el = svgRef.current
    if (!el || !vb) return
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height
      const k = e.deltaY > 0 ? 1.15 : 1 / 1.15
      setVb(([x, y, w, h]) => {
        const nw = Math.min(Math.max(w * k, 0.2), 10000), nh = h * (nw / w)
        return [x + (w - nw) * fx, y + (h - nh) * fy, nw, nh]
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [vb])

  const onDown = (e) => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, vb }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d || !d.vb) return
    const r = svgRef.current.getBoundingClientRect()
    const dx = (e.clientX - d.x) * d.vb[2] / r.width, dy = (e.clientY - d.y) * d.vb[3] / r.height
    setVb([d.vb[0] - dx, d.vb[1] - dy, d.vb[2], d.vb[3]])
  }
  const onUp = () => { drag.current = null }

  const pick = (e) => {
    const id = e.target?.dataset?.id
    if (!id) return null
    return { id, seg: proj.segs.find((s) => s.id === id) }
  }
  const onClick = (e) => {
    const p = pick(e)
    if (!p || !onSelect) return
    const info = porMiembro.get(p.id)
    if (info?.unit != null) onSelect(info.unit)
    else if (porElemento && cadenaDe.has(p.id)) onSelect(cadenaDe.get(p.id))
  }

  // ── escena (memorizada: el paneo no la vuelve a construir) ──
  const escena = useMemo(() => {
    const vbw = vb?.[2] || proj.bounds.w
    const rMarca = vbw / 220
    const capas = { resto: [], excl: [], ok: [], bast: [], bad: [], sel: [] }
    for (const s of proj.segs) {
      const info = porMiembro.get(s.id)
      const capa = miembrosSel.has(s.id) ? 'sel' : info ? info.tone : 'resto'
      if (soloGrupo && capa === 'resto') continue
      capas[capa].push(s)
    }
    const linea = (s, capa) => {
      const puntual = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < rMarca
      const w = capa === 'sel' ? 3.4 : capa === 'resto' ? 0.8 : 2
      return puntual
        ? <rect key={s.id} data-id={s.id} x={s.x1 - rMarca} y={s.y1 - rMarca} width={rMarca * 2} height={rMarca * 2}
          fill={C[capa]} fillOpacity={capa === 'resto' ? 0.5 : 0.85} stroke="none" style={{ cursor: 'pointer' }} />
        : <line key={s.id} data-id={s.id} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke={C[capa]} strokeWidth={w} strokeLinecap="round" vectorEffect="non-scaling-stroke"
          style={{ cursor: capa === 'resto' ? 'default' : 'pointer' }} />
    }
    const nodosVis = new Map()
    if (verNudos) for (const s of proj.segs) {
      if (!nodosVis.has(s.nj)) nodosVis.set(s.nj, [s.x1, s.y1])
      if (!nodosVis.has(s.nk)) nodosVis.set(s.nk, [s.x2, s.y2])
    }
    return (
      <g>
        {['resto', 'excl', 'ok', 'bast', 'bad', 'sel'].map((capa) => (
          <g key={capa}>{capas[capa].map((s) => linea(s, capa))}</g>
        ))}
        {[...nodosVis].map(([id, [cx, cy]]) => (
          <circle key={id} cx={cx} cy={cy} r={rMarca * 0.9} fill={C.nodo} opacity={0.6} />
        ))}
      </g>
    )
  }, [proj.segs, porMiembro, miembrosSel, soloGrupo, verNudos, vb?.[2]]) // eslint-disable-line

  const [ejeH, ejeK] = planAxes(up)
  // el SVG encaja con preserveAspectRatio="meet": manda la dimensión más apretada
  const escala = useMemo(() => {
    if (!vb) return null
    const pxPorM = Math.min(caja.w / vb[2], caja.h / vb[3])
    if (!isFinite(pxPorM) || pxPorM <= 0) return null
    const paso = PASOS.find((p) => p * pxPorM > 60) || PASOS[PASOS.length - 1]
    return { paso, px: paso * pxPorM }
  }, [vb, caja])

  const cuenta = useMemo(() => {
    const c = { total: proj.segs.length, grupo: 0, bad: 0 }
    for (const s of proj.segs) { const i = porMiembro.get(s.id); if (i) { c.grupo++; if (i.tone === 'bad') c.bad++ } }
    return c
  }, [proj.segs, porMiembro])

  const hoverInfo = hover && porMiembro.get(hover.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 8px', borderBottom: '1px solid var(--color-border)', fontSize: 11 }}>
        {VISTAS.map(([id, lbl]) => (
          <button key={id} className="btn" onClick={() => setVista(id)} data-testid={`vista-${id}`}
            style={{ fontSize: 10.5, padding: '3px 9px', background: vista === id ? 'var(--color-accent)' : 'var(--color-panel)', color: vista === id ? '#fff' : 'var(--color-tx2)', border: '1px solid var(--color-border)' }}>{lbl}</button>
        ))}
        <select className="field-input" data-testid="modelo-nivel" style={{ fontSize: 10.5, padding: '2px 4px', width: 'auto' }} value={nivel === null ? '' : String(nivel)}
          onChange={(e) => setNivel(e.target.value === '' ? null : +e.target.value)} title={`Filtra por el nivel (eje ${up.toUpperCase()})`}>
          <option value="">todos los niveles</option>
          {niveles.map((n) => <option key={n.v} value={n.v}>{up.toUpperCase()} = {n.v} m ({n.n} nudos)</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Oculta el resto del modelo y deja sólo los miembros de esta trabe">
          <input type="checkbox" checked={soloGrupo} onChange={(e) => setSoloGrupo(e.target.checked)} /> sólo {trabe || 'el grupo'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <input type="checkbox" checked={verNudos} onChange={(e) => setVerNudos(e.target.checked)} /> nudos
        </label>
        <button className="btn btn-secondary" style={{ fontSize: 10.5, padding: '3px 9px', marginLeft: 'auto' }} onClick={fit}>⤢ ajustar</button>
      </div>

      <div ref={wrapRef} style={{ position: 'relative', flex: 1, minHeight: 260, background: '#fbfcfe', overflow: 'hidden' }}>
        {vb && (
          <svg ref={svgRef} viewBox={vb.join(' ')} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
            data-testid="modelo-svg"
            style={{ display: 'block', touchAction: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { onUp(); setHover(null) }}
            onClick={onClick}
            onMouseOver={(e) => { const p = pick(e); if (p?.seg) setHover({ id: p.id, seg: p.seg, x: e.clientX, y: e.clientY }) }}
            onMouseOut={() => setHover(null)}>
            {escena}
          </svg>
        )}

        {/* leyenda */}
        <div style={{ position: 'absolute', left: 8, top: 8, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.86)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 8px' }}>
          {(results?.length ? [[C.ok, 'pasa con corridas'], [C.bast, 'requiere bastón'], [C.bad, 'insuficiente / cortante'], [C.excl, 'excluido'], [C.resto, 'resto del modelo']] : [[C.resto, 'miembros del modelo']]).map(([col, lbl]) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 3, background: col, borderRadius: 2 }} /> {lbl}
            </div>
          ))}
          {selectedId != null && <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 4, background: C.sel, borderRadius: 2 }} /> seleccionado</div>}
        </div>

        {/* escala y ejes */}
        <div style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>
          {escala && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: Math.round(escala.px), height: 6, borderLeft: '2px solid var(--color-tx3)', borderRight: '2px solid var(--color-tx3)', borderBottom: '2px solid var(--color-tx3)' }} />
            {escala.paso} m
          </div>}
          <div>{vista === 'planta' ? `planta · ${ejeH.toUpperCase()}→ ${ejeK.toUpperCase()}↑` : vista === 'iso' ? `isométrica · vertical ${up.toUpperCase()}` : `elevación · vertical ${up.toUpperCase()}`}</div>
        </div>

        {/* tarjeta del miembro bajo el cursor */}
        {hover?.seg && (
          <div style={{ position: 'absolute', right: 8, top: 8, background: 'rgba(255,255,255,0.95)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 9px', fontSize: 10.5, fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
            <b>M-{hover.seg.id}</b> {hover.seg.descripcion ? `· ${hover.seg.descripcion}` : ''}<br />
            {hover.seg.seccion} · L = {hover.seg.len.toFixed(2)} m · {hover.seg.kind}<br />
            nudos {hover.seg.nj}–{hover.seg.nk}
            {hoverInfo?.unit != null && <><br />elemento <b>{hoverInfo.unit}</b> · clic para verlo</>}
          </div>
        )}
      </div>

      <div style={{ padding: '5px 8px', borderTop: '1px solid var(--color-border)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span>{archivo ? `${archivo} · ` : ''}{nodes.size} nudos · {rows.length} miembros</span>
        <span>a la vista: {cuenta.total}{cuenta.grupo ? ` · ${cuenta.grupo} de esta trabe` : ''}{cuenta.bad ? ` · ${cuenta.bad} con problema` : ''}</span>
        <span style={{ marginLeft: 'auto' }}>rueda = zoom · arrastrar = mover · clic en un miembro para analizarlo</span>
      </div>
    </div>
  )
}

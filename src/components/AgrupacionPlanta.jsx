import { useEffect, useRef, useState } from 'react'

// Las trabes en planta, un dibujo por nivel, coloreadas por su grupo.
// Clic: una trabe · Mayús/Ctrl+clic: la agrega o la quita · arrastrar en un
// hueco: selección por ventana (con Mayús, se suma) · Esc: nada.

const SEL = '#f59e0b'
const COLUMNA = '#8b93a3'

function Planta({ N, geo, vb, fs, estilo, sel, onSel, nombres, setHover }) {
  const svgRef = useRef(null)
  const drag = useRef(null)
  const [ventana, setVentana] = useState(null)

  const aSvg = (ev) => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = ev.clientX; pt.y = ev.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return [p.x, p.y]
  }
  const suma = (ev) => ev.shiftKey || ev.ctrlKey || ev.metaKey

  const abajo = (ev) => {
    if (ev.button !== 0) return
    drag.current = { p0: aSvg(ev), c0: [ev.clientX, ev.clientY], add: suma(ev) }
    svgRef.current.setPointerCapture?.(ev.pointerId)
  }
  const mueve = (ev) => {
    const d = drag.current
    if (!d) return
    const p = aSvg(ev)
    setVentana([Math.min(d.p0[0], p[0]), Math.min(d.p0[1], p[1]), Math.max(d.p0[0], p[0]), Math.max(d.p0[1], p[1])])
  }
  const arriba = (ev) => {
    const d = drag.current
    drag.current = null
    setVentana(null)
    if (!d) return
    const movio = Math.hypot(ev.clientX - d.c0[0], ev.clientY - d.c0[1]) > 4
    if (!movio) { if (!d.add) onSel(new Set()); return }
    const p = aSvg(ev)
    const [x0, y0, x1, y1] = [Math.min(d.p0[0], p[0]), Math.min(d.p0[1], p[1]), Math.max(d.p0[0], p[0]), Math.max(d.p0[1], p[1])]
    const dentro = N.ids.filter((id) => geo.porId.get(id).segs.some((s) => {
      const mx = (s[0] + s[2]) / 2, my = (s[1] + s[3]) / 2
      return mx >= x0 && mx <= x1 && my >= y0 && my <= y1
    }))
    onSel(d.add ? new Set([...sel, ...dentro]) : new Set(dentro))
  }

  const clic = (ev, id) => {
    ev.stopPropagation()
    if (suma(ev)) {
      const s = new Set(sel)
      if (s.has(id)) s.delete(id); else s.add(id)
      onSel(s)
    } else onSel(new Set([id]))
  }

  const todasSel = N.ids.length > 0 && N.ids.every((id) => sel.has(id))
  const cols = geo.columnas.filter((c) => c.nivel === N.n)
  const lado = fs * 0.75

  return (
    <div data-testid={`agr-nivel-${N.n}`} style={{ border: '1px solid var(--color-border)', borderRadius: 9, background: 'var(--color-bg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 9px', borderBottom: '1px solid var(--color-border)', fontSize: 11 }}>
        <b>N{N.n}</b>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>{geo.up} = {N.v >= 0 ? '+' : ''}{N.v.toFixed(2)} m</span>
        <span style={{ color: 'var(--color-tx3)' }}>{N.ids.length} trabe(s)</span>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 7px' }}
          onClick={(ev) => onSel(todasSel ? new Set([...sel].filter((id) => !N.ids.includes(id))) : new Set([...(suma(ev) ? sel : []), ...N.ids]))}>
          {todasSel ? 'quitar el nivel' : 'todo el nivel'}
        </button>
      </div>
      <svg ref={svgRef} viewBox={vb.join(' ')} style={{ width: '100%', height: 'auto', maxHeight: '72vh', display: 'block', touchAction: 'none', userSelect: 'none', cursor: 'crosshair' }}
        onPointerDown={abajo} onPointerMove={mueve} onPointerUp={arriba} onPointerCancel={() => { drag.current = null; setVentana(null) }}>
        {cols.map((c, i) => (
          <rect key={i} x={c.x - lado / 2} y={c.y - lado / 2} width={lado} height={lado} fill={COLUMNA} opacity={0.55} pointerEvents="none" />
        ))}
        {N.ids.map((id) => {
          const g = geo.porId.get(id)
          const st = estilo(id)
          const d = g.segs.map((s) => `M${s[0]} ${s[1]}L${s[2]} ${s[3]}`).join('')
          const on = sel.has(id)
          return (
            <g key={id} data-testid={`agr-trabe-${id}`} data-grupo={st.etiqueta || ''} data-sel={on ? '1' : '0'}
              onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => clic(ev, id)}
              onPointerEnter={(ev) => setHover({ id, x: ev.clientX, y: ev.clientY })}
              onPointerMove={(ev) => setHover({ id, x: ev.clientX, y: ev.clientY })}
              onPointerLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
              {on && <path d={d} stroke={SEL} strokeWidth={10} opacity={0.55} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />}
              <path d={d} stroke={st.color} strokeWidth={on ? 3.8 : 2.8} strokeDasharray={st.dash} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
              {st.mal && <path d={d} stroke="#c62828" strokeWidth={1.3} strokeDasharray="1 4" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />}
              <path d={d} stroke="transparent" strokeWidth={14} fill="none" vectorEffect="non-scaling-stroke" pointerEvents="stroke" />
            </g>
          )
        })}
        {nombres && N.ids.map((id) => {
          const g = geo.porId.get(id)
          const st = estilo(id)
          if (!st.etiqueta) return null
          return (
            <text key={`t${id}`} x={g.cx} y={g.cy} fontSize={fs} textAnchor="middle" dominantBaseline="central" pointerEvents="none"
              fill={st.color} strokeWidth={fs * 0.3} paintOrder="stroke" strokeLinejoin="round"
              style={{ stroke: 'var(--color-bg)', fontWeight: 800, fontFamily: 'var(--font-sans, sans-serif)' }}>
              {st.etiqueta}
            </text>
          )
        })}
        {ventana && (
          <rect x={ventana[0]} y={ventana[1]} width={ventana[2] - ventana[0]} height={ventana[3] - ventana[1]}
            fill={SEL} fillOpacity={0.12} stroke={SEL} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" pointerEvents="none" />
        )}
      </svg>
    </div>
  )
}

export default function AgrupacionPlanta({ geo, estilo, sel, onSel, info, voltear }) {
  const [nivel, setNivel] = useState(null)          // null = todos
  const [nombres, setNombres] = useState(true)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const esc = (ev) => { if (ev.key === 'Escape') onSel(new Set()) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onSel])

  if (!geo?.niveles.length) return <div style={{ fontSize: 11.5, color: 'var(--color-tx3)' }}>No hay trabes que dibujar.</div>

  const visibles = nivel ? geo.niveles.filter((N) => N.n === nivel) : geo.niveles
  const b = geo.bounds
  const pad = Math.max(b.w, b.h) * 0.05 + 0.4
  const vb = [b.minX - pad, b.minY - pad, b.w + 2 * pad, b.h + 2 * pad]
  const fs = Math.max(b.w, b.h) / (nivel ? 64 : 34)
  const chip = (on) => ({
    fontSize: 11, padding: '2px 9px', borderRadius: 7, cursor: 'pointer',
    border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: on ? 'var(--color-bg)' : 'transparent', fontWeight: on ? 700 : 500, color: 'inherit',
  })

  return (
    <div data-testid="agr-planta" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button style={chip(nivel === null)} onClick={() => setNivel(null)}>Todos los niveles</button>
        {geo.niveles.map((N) => (
          <button key={N.n} data-testid={`agr-ver-nivel-${N.n}`} style={chip(nivel === N.n)} onClick={() => setNivel(N.n)}>N{N.n}</button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginLeft: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={nombres} onChange={() => setNombres((v) => !v)} /> nombres
        </label>
        <span data-testid="agr-ejes" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)', marginLeft: 6 }}>
          {geo.ejes[0]} → · {geo.ejes[1]} {geo.zAbajo ? '↓' : '↑'}
        </span>
        {voltear && (
          <button data-testid="agr-voltear" style={chip(false)} onClick={voltear} title="Si no se ve como la planta de RAM, voltéala">↕ voltear</button>
        )}
        <span style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginLeft: 'auto' }}>
          clic: una · Mayús/Ctrl+clic: suma o quita · arrastrar en un hueco: ventana · Esc: ninguna
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: nivel ? '1fr' : 'repeat(auto-fill, minmax(330px, 1fr))', gap: 8 }}>
        {visibles.map((N) => (
          <Planta key={N.n} N={N} geo={geo} vb={vb} fs={fs} estilo={estilo} sel={sel} onSel={onSel} nombres={nombres} setHover={setHover} />
        ))}
      </div>
      {hover && (
        <div style={{
          position: 'fixed', left: hover.x + 14, top: hover.y + 14, zIndex: 50, pointerEvents: 'none',
          background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,.18)', padding: '7px 10px', fontSize: 11, lineHeight: 1.55, maxWidth: 320,
        }}>
          {info(hover.id).map((l, i) => <div key={i} style={i === 0 ? { fontWeight: 800 } : { fontFamily: 'var(--font-mono)' }}>{l}</div>)}
        </div>
      )}
    </div>
  )
}

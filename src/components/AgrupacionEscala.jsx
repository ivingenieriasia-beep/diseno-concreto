import { useLayoutEffect, useMemo, useRef, useState } from 'react'

// Escala de aprovechamiento: una fila por grupo, un punto por trabe en el
// aprovechamiento de la sección de su grupo (100 % = justo). Como la escala
// de momentos de Secciones, pero para toda la agrupación.
//
//   · clic en un punto: esa trabe · Mayús/Ctrl+clic: suma o quita
//   · arrastrar en un hueco: selección por ventana
//   · con trabes seleccionadas, en cada otra fila unos círculos huecos dicen
//     dónde caerían en esa T (y si la T tendría que crecer)
//   · en el acomodo manual, arrastrar puntos a otra fila los mueve; a
//     «＋ grupo nuevo» arma uno con ellos; a «sin asignar» los saca

const ETI = 150          // ancho de las etiquetas de fila
const FILA = 34
const R = 4.6
const SEL = '#f59e0b'
const ROJO = '#c62828'
const corto = (s) => (s ? s.nombre.replace(' X ', '×') : '—')
const pct = (v) => `${Math.round(v * 100)} %`

/** Acomoda los puntos de una fila en carriles para que no se encimen */
function enjambre(items, xDe, sep = R * 2.1) {
  const orden = [...items].sort((a, b) => xDe(a) - xDe(b))
  const puestos = []
  const carriles = [0, -1, 1, -2, 2, -3, 3]
  for (const it of orden) {
    const x = xDe(it)
    let c = 0
    for (const k of carriles) {
      if (!puestos.some((p) => p.c === k && Math.abs(p.x - x) < sep)) { c = k; break }
      c = k
    }
    puestos.push({ it, x, c })
  }
  return puestos
}

export default function AgrupacionEscala({
  filas, sueltos, uDe, colorDe, sel, setSel, editable, info, destino, onSoltarEn,
}) {
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const [ancho, setAncho] = useState(800)
  const [hover, setHover] = useState(null)
  const [ventana, setVentana] = useState(null)
  const [arrastre, setArrastre] = useState(null)   // { ids, x, y, fila }
  const gesto = useRef(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const medir = () => setAncho(el.clientWidth || 800)
    const ro = new ResizeObserver(medir)
    ro.observe(el); medir()
    return () => ro.disconnect()
  }, [])

  // filas de la escala: los grupos, y en el manual «sin asignar» y «＋ grupo nuevo»
  const lineas = useMemo(() => {
    const out = filas.map((g, i) => ({ tipo: 'grupo', g, i, key: g.id || g.nombre, elems: g.elems }))
    if (editable) {
      out.push({ tipo: 'sueltos', key: '__sueltos', elems: sueltos })
      out.push({ tipo: 'nuevo', key: '__nuevo', elems: [] })
    }
    return out
  }, [filas, sueltos, editable])

  const todasU = lineas.flatMap((l) => (l.tipo === 'grupo' ? l.elems.map((e) => uDe(e, l.g)) : []))
  const uTope = Math.max(1.25, Math.min(3, Math.max(0, ...todasU.filter(Number.isFinite)) + 0.08))
  const x0 = ETI + 10, x1 = Math.max(x0 + 200, ancho - 150)
  const xDe = (u) => x0 + (Math.min(Math.max(u, 0), uTope) / uTope) * (x1 - x0)
  const alto = 26 + lineas.length * FILA + 8
  const yDe = (k) => 26 + k * FILA + FILA / 2

  const selIds = [...sel]
  const selElems = useMemo(() => {
    const m = new Map()
    for (const l of lineas) for (const e of l.elems) m.set(e.id, e)
    return selIds.map((id) => m.get(id)).filter(Boolean)
  }, [lineas, sel]) // eslint-disable-line react-hooks/exhaustive-deps

  // dónde caerían las seleccionadas en cada fila (sin moverlas)
  const fantasmas = useMemo(() => {
    if (!selElems.length) return {}
    const out = {}
    lineas.forEach((l) => {
      if (l.tipo !== 'grupo') return
      const fuera = selElems.filter((e) => !l.elems.includes(e))
      if (!fuera.length) return
      out[l.key] = destino(fuera, l.g)
    })
    return out
  }, [selElems, lineas, destino])

  // ── puntero ──
  const aSvg = (ev) => {
    const r = svgRef.current.getBoundingClientRect()
    return [ev.clientX - r.left, ev.clientY - r.top]
  }
  const filaEn = (y) => Math.max(0, Math.min(lineas.length - 1, Math.floor((y - 26) / FILA)))
  const suma = (ev) => ev.shiftKey || ev.ctrlKey || ev.metaKey

  const abajoPunto = (ev, e) => {
    ev.stopPropagation()
    if (ev.button !== 0) return
    const [x, y] = aSvg(ev)
    gesto.current = { tipo: 'punto', id: e.id, x, y, add: suma(ev), movido: false }
    svgRef.current.setPointerCapture?.(ev.pointerId)
  }
  const abajoFondo = (ev) => {
    if (ev.button !== 0) return
    const [x, y] = aSvg(ev)
    gesto.current = { tipo: 'ventana', x, y, add: suma(ev) }
    svgRef.current.setPointerCapture?.(ev.pointerId)
  }
  const mueve = (ev) => {
    const [x, y] = aSvg(ev)
    const G = gesto.current
    if (!G) return
    if (G.tipo === 'ventana') {
      setVentana([Math.min(G.x, x), Math.min(G.y, y), Math.max(G.x, x), Math.max(G.y, y)])
      return
    }
    if (!editable) return
    if (!G.movido && Math.hypot(x - G.x, y - G.y) < 5) return
    if (!G.movido) {
      G.movido = true
      G.ids = sel.has(G.id) ? selIds : [G.id]
      if (!sel.has(G.id)) setSel(new Set([G.id]))
    }
    setArrastre({ ids: G.ids, x, y, fila: filaEn(y) })
  }
  const arriba = (ev) => {
    const G = gesto.current
    gesto.current = null
    const [x, y] = aSvg(ev)
    if (G?.tipo === 'ventana') {
      setVentana(null)
      if (Math.hypot(x - G.x, y - G.y) < 4) { if (!G.add) setSel(new Set()); return }
      const [a0, b0, a1, b1] = [Math.min(G.x, x), Math.min(G.y, y), Math.max(G.x, x), Math.max(G.y, y)]
      const dentro = puestosTodos.filter((p) => p.x >= a0 && p.x <= a1 && p.y >= b0 && p.y <= b1).map((p) => p.id)
      setSel(G.add ? new Set([...sel, ...dentro]) : new Set(dentro))
      return
    }
    if (G?.tipo === 'punto') {
      if (G.movido && arrastre) {
        const l = lineas[filaEn(y)]
        setArrastre(null)
        if (l) onSoltarEn(G.ids, l.tipo === 'grupo' ? l.g.id : l.tipo)
        return
      }
      setArrastre(null)
      if (G.add) {
        const s = new Set(sel)
        if (s.has(G.id)) s.delete(G.id); else s.add(G.id)
        setSel(s)
      } else setSel(new Set([G.id]))
    }
  }

  // lo que pasaría al soltar aquí
  const lAr = arrastre ? lineas[arrastre.fila] : null
  const previa = useMemo(() => {
    if (!arrastre || !lAr || lAr.tipo !== 'grupo') return null
    const es = arrastre.ids.map((id) => selElems.find((e) => e.id === id)).filter(Boolean)
    const fuera = es.filter((e) => !lAr.elems.includes(e))
    return fuera.length ? destino(fuera, lAr.g) : null
  }, [arrastre?.fila, arrastre?.ids, lAr, selElems, destino]) // eslint-disable-line react-hooks/exhaustive-deps

  // posiciones de todos los puntos (para la ventana y para dibujar)
  const puestosTodos = []
  lineas.forEach((l, k) => {
    if (l.tipo === 'nuevo') return
    const xFn = (e) => (l.tipo === 'grupo' ? xDe(uDe(e, l.g)) : x0 + ((l.elems.indexOf(e) + 0.5) / Math.max(1, l.elems.length)) * (x1 - x0))
    for (const p of enjambre(l.elems, xFn)) {
      puestosTodos.push({ id: p.it.id, e: p.it, l, k, x: p.x, y: yDe(k) + p.c * (R * 1.5) })
    }
  })

  const ticks = []
  for (let u = 0; u <= uTope + 1e-9; u += 0.25) ticks.push(u)

  return (
    <div ref={wrapRef} data-testid="agr-escala" style={{ border: '1px solid var(--color-border)', borderRadius: 9, background: 'var(--color-bg)', position: 'relative' }}>
      <svg ref={svgRef} width={ancho} height={alto} style={{ display: 'block', touchAction: 'none', userSelect: 'none', cursor: arrastre ? 'grabbing' : 'crosshair' }}
        onPointerDown={abajoFondo} onPointerMove={mueve} onPointerUp={arriba}
        onPointerCancel={() => { gesto.current = null; setVentana(null); setArrastre(null) }}>
        {/* zona pasada de 100 % y rejilla */}
        <rect x={xDe(1)} y={20} width={x1 - xDe(1)} height={alto - 26} fill={ROJO} opacity={0.07} />
        {ticks.map((u) => (
          <g key={u}>
            <line x1={xDe(u)} x2={xDe(u)} y1={20} y2={alto - 6} stroke={Math.abs(u - 1) < 1e-9 ? ROJO : 'var(--color-border)'} strokeWidth={Math.abs(u - 1) < 1e-9 ? 1.4 : 1} opacity={Math.abs(u - 1) < 1e-9 ? 0.7 : 1} />
            <text x={xDe(u)} y={13} fontSize={10} textAnchor="middle" fill="var(--color-tx3)" style={{ fontFamily: 'var(--font-mono)' }}>{pct(u)}</text>
          </g>
        ))}
        {/* filas */}
        {lineas.map((l, k) => {
          const y = yDe(k)
          const esDestino = arrastre && arrastre.fila === k
          const col = l.tipo === 'grupo' ? colorDe(l.g, l.i) : '#9aa3b2'
          const titulo = l.tipo === 'grupo' ? l.g.nombre : l.tipo === 'sueltos' ? 'sin asignar' : '＋ grupo nuevo'
          const sub = l.tipo === 'grupo' ? `${corto(l.g.sec)}${l.g.auto ? ' auto' : ''} · ${l.elems.length}` : l.tipo === 'sueltos' ? `${l.elems.length} trabe(s)` : 'suelta aquí'
          return (
            <g key={l.key} data-testid={`agr-esc-fila-${l.tipo === 'grupo' ? l.g.nombre : l.tipo}`}>
              <rect x={2} y={y - FILA / 2 + 1} width={ancho - 4} height={FILA - 2} rx={6}
                fill={esDestino ? SEL : k % 2 ? 'transparent' : 'var(--color-panel)'} opacity={esDestino ? 0.16 : 0.55}
                stroke={esDestino ? SEL : 'none'} strokeDasharray={l.tipo === 'nuevo' ? '4 3' : undefined} />
              {l.tipo === 'nuevo' && <rect x={x0} y={y - 9} width={x1 - x0} height={18} rx={5} fill="none" stroke="var(--color-border)" strokeDasharray="4 3" />}
              <rect x={8} y={y - 6} width={12} height={12} rx={3} fill={col} opacity={l.tipo === 'grupo' ? 1 : 0.5} />
              <text x={26} y={y - 1} fontSize={12} fontWeight={800} fill="var(--color-tx1, currentColor)">{titulo}</text>
              <text x={26} y={y + 11} fontSize={9.5} fill="var(--color-tx3)" style={{ fontFamily: 'var(--font-mono)' }}>{sub}</text>
              {l.tipo === 'grupo' && l.elems.length > 0 && (
                <text x={x1 + 8} y={y + 4} fontSize={10.5} fill={l.g.fuera ? ROJO : 'var(--color-tx3)'} style={{ fontFamily: 'var(--font-mono)' }}>
                  {pct(l.g.uMin ?? 0)}–{pct(l.g.uMax ?? 0)}
                </text>
              )}
            </g>
          )
        })}
        {/* dónde caerían las seleccionadas */}
        {!arrastre && lineas.map((l, k) => {
          const f = fantasmas[l.key]
          if (!f) return null
          const y = yDe(k)
          return (
            <g key={`f${l.key}`} data-testid={`agr-esc-fantasma-${l.g.nombre}`} pointerEvents="none">
              {f.us.map((u, j) => (
                <circle key={j} cx={xDe(u)} cy={y} r={R + 1.5} fill="none" stroke={u > 1 + 1e-9 ? ROJO : SEL} strokeWidth={1.6} strokeDasharray="2 2" />
              ))}
              <text x={x1 + 8} y={y + 15} fontSize={9.5} fill={f.malo ? ROJO : f.crece ? '#92400e' : '#15803d'} style={{ fontWeight: 700 }}>{f.texto}</text>
            </g>
          )
        })}
        {/* los puntos */}
        {puestosTodos.map((p) => {
          const u = p.l.tipo === 'grupo' ? uDe(p.e, p.l.g) : null
          const on = sel.has(p.id)
          const col = p.l.tipo === 'grupo' ? colorDe(p.l.g, p.l.i) : '#9aa3b2'
          const arrastrado = arrastre?.ids.includes(p.id)
          return (
            <circle key={p.id} data-testid={`agr-esc-punto-${p.id}`} data-sel={on ? '1' : '0'} cx={p.x} cy={p.y} r={on ? R + 1 : R}
              fill={u !== null && u > 1 + 1e-9 ? ROJO : col} stroke={on ? SEL : 'var(--color-bg)'} strokeWidth={on ? 2.4 : 1}
              opacity={arrastrado ? 0.35 : 0.92} style={{ cursor: editable ? 'grab' : 'pointer' }}
              onPointerDown={(ev) => abajoPunto(ev, p.e)}
              onPointerEnter={(ev) => setHover({ id: p.id, x: ev.clientX, y: ev.clientY })}
              onPointerMove={(ev) => setHover({ id: p.id, x: ev.clientX, y: ev.clientY })}
              onPointerLeave={() => setHover(null)} />
          )
        })}
        {/* arrastrando: dónde quedarían en la fila de destino */}
        {arrastre && lAr && (
          <g pointerEvents="none">
            {previa && previa.us.map((u, j) => (
              <circle key={j} cx={xDe(u)} cy={yDe(arrastre.fila)} r={R + 1.5} fill={u > 1 + 1e-9 ? ROJO : SEL} opacity={0.75} />
            ))}
            {previa && <text x={x1 + 8} y={yDe(arrastre.fila) + 15} fontSize={9.5} fill={previa.malo ? ROJO : previa.crece ? '#92400e' : '#15803d'} style={{ fontWeight: 700 }}>{previa.texto}</text>}
            <text x={arrastre.x + 10} y={arrastre.y - 8} fontSize={11} fontWeight={800} fill={SEL}>
              {arrastre.ids.length} trabe(s) → {lAr.tipo === 'grupo' ? lAr.g.nombre : lAr.tipo === 'sueltos' ? 'sin asignar' : 'grupo nuevo'}
            </text>
          </g>
        )}
        {ventana && (
          <rect x={ventana[0]} y={ventana[1]} width={ventana[2] - ventana[0]} height={ventana[3] - ventana[1]}
            fill={SEL} fillOpacity={0.12} stroke={SEL} strokeDasharray="4 3" pointerEvents="none" />
        )}
      </svg>
      {hover && !arrastre && (
        <div style={{
          position: 'fixed', left: hover.x + 14, top: hover.y + 14, zIndex: 50, pointerEvents: 'none',
          background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,.18)', padding: '7px 10px', fontSize: 11, lineHeight: 1.55, maxWidth: 320,
        }}>
          {info(hover.id).map((l, i) => <div key={i} style={i === 0 ? { fontWeight: 800 } : { fontFamily: 'var(--font-mono)' }}>{l}</div>)}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', padding: '0 10px 7px', lineHeight: 1.5 }}>
        Cada punto es una trabe en la sección de su grupo. Con trabes seleccionadas, los círculos huecos dicen dónde caerían en cada T.
        {editable ? ' Arrastra puntos a otra fila para moverlos, a «＋ grupo nuevo» para armar uno o a «sin asignar» para sacarlos.' : ' Para moverlas, ✎ ajusta esta propuesta a mano.'}
      </div>
    </div>
  )
}

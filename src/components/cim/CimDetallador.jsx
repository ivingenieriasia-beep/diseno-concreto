import { useEffect, useMemo, useRef, useState } from 'react'
import { dibujarCim } from '../../core/cim/dibujo'
import { ctDe } from '../../core/cim/ct'
import { CALIBRES } from './campos'

// El dibujo del cimiento con lo que se puede tocar: las MANIJAS (orillas,
// peraltes, la columna) se arrastran a cada 5 cm y las ETIQUETAS de varilla
// abren un selector de # y separación. El dibujo se muestra a su tamaño
// natural (1 unidad = 1 px), así la manija sigue al cursor; mientras se
// arrastra, la escala se congela para que no se mueva bajo el ratón.

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o)
function setPath(o, path, v) {
  const [k, ...resto] = path.split('.')
  if (!resto.length) return Array.isArray(o) ? o.map((x, i) => (String(i) === k ? v : x)) : { ...o, [k]: v }
  const hijo = o?.[k]
  const nuevo = setPath(hijo ?? (/^\d+$/.test(resto[0]) ? [] : {}), resto.join('.'), v)
  return Array.isArray(o) ? o.map((x, i) => (String(i) === k ? nuevo : x)) : { ...o, [k]: nuevo }
}
const redondear = (v, p) => Number((Math.round(v / p) * p).toFixed(4))

/** Qué se edita al hacer clic en una etiqueta de varilla */
const CT_EDITA = { 'ct-sup': 'n', 'ct-inf': 'n', 'ct-est': 'est' }
const EDITA = {
  aislada: { x: 's', y: 's', ...CT_EDITA },
  corrida: { t: 's', l: 's', ...CT_EDITA },
  contratrabe: { inf: 'n', sup: 'n', est: 'est', alero: 's', long: 's' },
  liga: { inf: 'n', sup: 'n', est: 'est' },
  contencion: { pv: 's', bast: 'bast', pe: 's', ph: 's', ts: 's', pi: 's', pl: 's' },
}

export default function CimDetallador({ z, R, Df, actualizar, marcar }) {
  const caja = useRef(null)
  const capa = useRef(null)
  const [ancho, setAncho] = useState(900)
  const [drag, setDrag] = useState(null)       // { h, x0, y0, inicio, antes, escala }
  const [pop, setPop] = useState(null)         // { id, x, y }
  const [sobre, setSobre] = useState(null)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(520, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { setPop(null) }, [z.uid])

  const d = useMemo(() => dibujarCim(z, R, { ancho, Df, ...(drag?.escala || {}) }), [z, R, ancho, Df, drag?.escala])
  if (!d) return <div ref={caja} className="cim-dib cim-vacio">Sin dibujo para este cimiento.</div>

  const punto = (e) => {
    const r = capa.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const empezar = (h, e) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = punto(e)
    const campos = Array.isArray(h.campo) ? h.campo : [h.campo]
    const inicio = h.campo === 'col'
      ? { xc: centroDe(z).xc, yc: centroDe(z).yc }
      : Object.fromEntries(campos.map((c) => [c, Number(get(z, c)) || 0]))
    setPop(null)
    setDrag({ h, x0: p.x, y0: p.y, inicio, antes: z, escala: d.escalas ? { escalas: d.escalas } : { k: d.k } })
  }
  const mover = (e) => {
    if (!drag) return
    const p = punto(e)
    const { h } = drag
    const dx = (p.x - drag.x0) / h.k, dy = -(p.y - drag.y0) / h.k      // cm del modelo, y hacia arriba
    if (h.campo === 'col') {
      actualizar(z.uid, (zz) => ({ ...zz, geo: moverColumna(zz.geo, drag.inicio.xc + dx / 100, drag.inicio.yc + dy / 100) }), { historial: false })
      return
    }
    const campos = Array.isArray(h.campo) ? h.campo : [h.campo]
    const factores = Array.isArray(h.factor) ? h.factor : [h.factor]
    const delta = h.eje === 'y' ? dy : dx
    actualizar(z.uid, (zz) => {
      let out = zz
      campos.forEach((c, i) => {
        let v = redondear(drag.inicio[c] + delta * factores[i], h.paso)
        if (h.min != null && i === 0) v = Math.max(h.min, v)
        if (h.max != null && i === 0) v = Math.min(h.max, v)
        if (i > 0) v = Math.max(0, v)
        out = setPath(out, c, v)
      })
      if (out.geo?.cuadrada && campos.includes('geo.B')) out = { ...out, geo: { ...out.geo, L: out.geo.B } }
      return out
    }, { historial: false })
  }
  const soltar = () => {
    if (!drag) return
    marcar(drag.antes)
    setDrag(null)
  }

  const editable = EDITA[z.tipo] || {}
  const abrir = (hit) => {
    if (!editable[hit.id]) return
    setPop({ id: hit.id, x: hit.x + hit.w / 2, y: hit.y + hit.h + 6, titulo: hit.titulo })
  }
  // las varillas de la CT de la zapata viven en z.ct; las demás en z.arm
  const deCT = pop?.id?.startsWith('ct-')
  const arm = pop ? (deCT ? ctDe(z)[pop.id.slice(3)] : z.arm?.[pop.id]) : null
  const setArm = (v) => (deCT
    ? actualizar(z.uid, { ct: { ...ctDe(z), [pop.id.slice(3)]: v } })
    : actualizar(z.uid, { arm: { ...z.arm, [pop.id]: v, ...(pop.id === 'pv' && z.arm.bast?.on ? { bast: { ...z.arm.bast, s: v.s } } : {}) } }))

  return (
    <div ref={caja} className="cim-dib" data-testid="cim-dibujo">
      <div style={{ position: 'relative', width: d.W, height: d.H }}>
        <div dangerouslySetInnerHTML={{ __html: d.svg }} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <svg ref={capa} width={d.W} height={d.H} viewBox={`0 0 ${d.W} ${d.H}`} style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
          onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
          onPointerDown={() => setPop(null)}>
          {d.hits.filter((h) => editable[h.id]).map((h) => (
            <rect key={`z-${h.id}`} data-testid={`cim-varilla-${h.id}`} x={h.x} y={h.y} width={h.w} height={h.h} rx={4}
              fill="transparent" stroke={sobre === h.id ? '#e8830a' : 'transparent'} strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
              onPointerEnter={() => setSobre(h.id)} onPointerLeave={() => setSobre(null)}
              onPointerDown={(e) => { e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation(); abrir(h) }}>
              <title>{h.titulo || 'Cambiar la varilla'}</title>
            </rect>
          ))}
          {d.handles.map((h) => {
            const activo = drag?.h.id === h.id
            const cursor = h.eje === 'x' ? 'ew-resize' : h.eje === 'y' ? 'ns-resize' : 'move'
            return (
              <g key={`m-${h.id}`} data-testid={`cim-manija-${h.id}`} style={{ cursor }} onPointerDown={(e) => empezar(h, e)}
                onPointerEnter={() => setSobre(`m-${h.id}`)} onPointerLeave={() => setSobre(null)}>
                <title>{`Arrastra para cambiar ${h.titulo}`}</title>
                {h.forma === 'punto'
                  ? <circle cx={h.x} cy={h.y} r={activo || sobre === `m-${h.id}` ? 9 : 7} fill="#fff" stroke="#e8830a" strokeWidth={2.2} />
                  : h.eje === 'x'
                    ? <rect x={h.x - 5} y={h.y - 14} width={10} height={28} rx={5} fill={activo ? '#e8830a' : '#fff'} stroke="#e8830a" strokeWidth={2} />
                    : <rect x={h.x - 14} y={h.y - 5} width={28} height={10} rx={5} fill={activo ? '#e8830a' : '#fff'} stroke="#e8830a" strokeWidth={2} />}
                {(activo || sobre === `m-${h.id}`) && (
                  <text x={h.x + 12} y={h.y - 12} fontSize={11} fontWeight={700} fill="#b45309" fontFamily="DM Mono, monospace">{valorTxt(z, h)}</text>
                )}
              </g>
            )
          })}
        </svg>
        {pop && arm && (
          <div className="cim-pop" style={{ left: Math.min(pop.x - 110, d.W - 240), top: pop.y }} data-testid="cim-pop" onPointerDown={(e) => e.stopPropagation()}>
            <div className="cim-pop-t">{pop.titulo || 'Varilla'}</div>
            {editable[pop.id] === 'bast' && (
              <label className="cim-check"><input type="checkbox" checked={!!arm.on} onChange={(e) => setArm({ ...arm, on: e.target.checked, s: z.arm.pv.s })} /> <span>con bastones</span></label>
            )}
            <div className="cim-pop-cal">
              {CALIBRES.map((c) => (
                <button key={c.v} className={String(arm.num) === c.v ? 'on' : ''} data-testid={`cim-pop-num-${c.v}`} onClick={() => setArm({ ...arm, num: parseFloat(c.v) })}>{c.t}</button>
              ))}
            </div>
            {editable[pop.id] === 'n' ? (
              <div className="cim-pop-s">
                <span>piezas</span>
                {[2, 3, 4, 5, 6].map((n) => <button key={n} className={arm.n === n ? 'on' : ''} onClick={() => setArm({ ...arm, n })}>{n}</button>)}
              </div>
            ) : editable[pop.id] !== 'bast' && (
              <div className="cim-pop-s">
                <span>@</span>
                {[10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30].map((s) => <button key={s} className={arm.s === s && arm.modo !== 'n' ? 'on' : ''} data-testid={`cim-pop-s-${s}`} onClick={() => setArm({ ...arm, s, modo: 's' })}>{s}</button>)}
              </div>
            )}
            {editable[pop.id] === 'est' && (
              <div className="cim-pop-s"><span>ramas</span>{[2, 3, 4].map((n) => <button key={n} className={arm.ramas === n ? 'on' : ''} onClick={() => setArm({ ...arm, ramas: n })}>{n}</button>)}</div>
            )}
            <button className="cim-pop-cerrar" onClick={() => setPop(null)}>listo</button>
          </div>
        )}
      </div>
      <div className="cim-dib-ayuda">Arrastra las manijas naranjas (a cada 5 cm) · clic en una etiqueta de varilla para cambiarla · Ctrl+Z deshace</div>
    </div>
  )
}

function centroDe(z) {
  const g = z.geo
  const B = +g.B, L = +(g.cuadrada ? g.B : g.L), a = +g.c1 / 100, b = +g.c2 / 100
  const eje = (p, v, D, c) => (p === 'min' ? -D / 2 + c / 2 : p === 'max' ? D / 2 - c / 2 : p === 'libre' ? +v || 0 : 0)
  return { xc: eje(g.px, g.xc, B, a), yc: eje(g.py, g.yc, L, b) }
}

/** La columna se arrastra a cada 5 cm y se pega al centro y a las orillas */
function moverColumna(g, xc, yc) {
  const B = +g.B, L = +(g.cuadrada ? g.B : g.L), a = +g.c1 / 100, b = +g.c2 / 100
  const eje = (v, D, c) => {
    const lim = D / 2 - c / 2
    const w = Math.max(-lim, Math.min(lim, Math.round(v / 0.05) * 0.05))
    if (Math.abs(w) < 0.026) return { p: 'centro', v: 0 }
    if (w <= -lim + 0.026) return { p: 'min', v: -lim }
    if (w >= lim - 0.026) return { p: 'max', v: lim }
    return { p: 'libre', v: Number(w.toFixed(3)) }
  }
  const X = eje(xc, B, a), Y = eje(yc, L, b)
  return { ...g, px: X.p, py: Y.p, xc: X.v, yc: Y.v }
}

function valorTxt(z, h) {
  if (h.campo === 'col') {
    const c = centroDe(z)
    return `x ${c.xc.toFixed(2)} · y ${c.yc.toFixed(2)} m`
  }
  const c = Array.isArray(h.campo) ? h.campo[0] : h.campo
  const v = Number(get(z, c))
  const cmCampo = (/\.(h|H|bw|t)$/.test(c) && z.tipo !== 'contencion' && z.tipo !== 'gravedad' && z.tipo !== 'mamposteria') || c.startsWith('ct.')
  return `${h.titulo} = ${cmCampo ? `${v} cm` : `${v.toFixed(2)} m`}`
}

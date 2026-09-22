import { useMemo, useRef, useState, useEffect } from 'react'
import { pesoCapa, formulaCapa, num } from '../core/loads'

// ══════════════════════════════════════════════════════════════
// Piezas comunes del módulo de Pesos Unitarios.
// La tabla de capas es la misma para losas y para muros: una losa no es
// más que la lista de lo que la compone, y cada componente entra por
// espesor, por peso directo o por perfiles repartidos en un área.
// ══════════════════════════════════════════════════════════════

export const MODOS = [
  { id: 'espesor', etiqueta: 'Espesor × γ', corto: 'esp' },
  { id: 'directo', etiqueta: 'Peso directo', corto: 'dir' },
  { id: 'lineal', etiqueta: 'Perfiles / área', corto: 'lin' },
]

export const fmt = (v, d = 2) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function Stat({ label, value, unit, tone, title }) {
  return (
    <div title={title} style={{
      background: tone === 'acento' ? 'var(--color-accent)' : 'var(--color-bg)',
      border: `1px solid ${tone === 'acento' ? 'var(--color-accent)' : 'var(--color-border)'}`,
      borderRadius: 7, padding: '8px 12px', minWidth: 108,
    }}>
      <div style={{
        fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)',
        color: tone === 'acento' ? 'rgba(255,255,255,0.85)' : 'var(--color-tx3)', marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1.1,
        color: tone === 'acento' ? '#fff' : 'var(--color-tx)',
      }}>
        {value}
        {unit && <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 4, opacity: 0.7 }}>{unit}</span>}
      </div>
    </div>
  )
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
        fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)',
      }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      {right}
    </div>
  )
}

export function IconBtn({ onClick, title, disabled, children, tone }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{
        width: 22, height: 22, borderRadius: 5, display: 'grid', placeItems: 'center', cursor: 'pointer',
        border: '1px solid var(--color-border)', background: 'var(--color-bg)',
        color: tone === 'malo' ? '#c62828' : 'var(--color-tx2)',
        opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto', flexShrink: 0,
      }}>
      {children}
    </button>
  )
}

const celda = {
  width: '100%', padding: '3px 5px', border: '1px solid transparent', borderRadius: 4,
  background: 'transparent', color: 'var(--color-tx)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
}

function Celda({ value, onChange, placeholder, tipo = 'number', paso = 'any', deshabilitada, ancho }) {
  if (deshabilitada) return <span style={{ fontSize: 11, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', paddingLeft: 5 }}>—</span>
  return (
    <input
      type={tipo} step={paso} value={value ?? ''} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...celda, width: ancho || '100%' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'var(--color-bg)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}
    />
  )
}

const COLS = '1.9fr 104px 1fr 1fr 1fr 88px 104px'

/**
 * Tabla de capas componible.
 * Cada renglón se puede apagar sin borrarlo (para probar una variante),
 * subir, bajar o cambiar de modo; el peso se recalcula al vuelo.
 */
export function CapaTabla({ capas = [], materiales = [], componentes = [], onUpdate, onRemove, onMover, onAdd, total }) {
  const matPorNombre = useMemo(() => new Map(materiales.map((m) => [m.nombre, m])), [materiales])
  const compPorNombre = useMemo(() => new Map(componentes.map((c) => [c.nombre, c])), [componentes])
  const listaId = useRef(`mat-${Math.random().toString(36).slice(2, 8)}`).current

  // Al escribir un nombre conocido se rellena solo el dato que le toca
  const cambiarNombre = (capa, nombre) => {
    const patch = { nombre }
    const mat = matPorNombre.get(nombre)
    const comp = compPorNombre.get(nombre)
    if (mat && (capa.modo === 'espesor' || !num(capa.gamma))) { patch.modo = 'espesor'; patch.gamma = mat.gamma }
    else if (comp && !num(capa.W)) { patch.modo = 'directo'; patch.W = comp.W }
    onUpdate(capa.id, patch)
  }

  return (
    <div>
      <datalist id={listaId}>
        {materiales.map((m) => <option key={`m-${m.nombre}`} value={m.nombre}>{m.gamma} kg/m³</option>)}
        {componentes.map((c) => <option key={`c-${c.nombre}`} value={c.nombre}>{c.W} kg/m²</option>)}
      </datalist>

      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-panel)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '6px 8px',
          background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
          fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--color-tx3)',
        }}>
          <span>Material</span><span>Modo</span>
          <span>Espesor / Long.</span><span>γ · peso · W</span><span>Área m²</span>
          <span style={{ textAlign: 'right' }}>W kg/m²</span><span />
        </div>

        {capas.length === 0 && (
          <div style={{ padding: '18px 10px', textAlign: 'center', fontSize: 12, color: 'var(--color-tx3)' }}>
            Sin capas todavía. Añade la primera abajo o parte de una plantilla.
          </div>
        )}

        {capas.map((c, i) => {
          const apagada = c.activa === false
          const W = pesoCapa(c)
          return (
            <div key={c.id} style={{
              display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '3px 8px', alignItems: 'center',
              borderBottom: '1px solid var(--color-border)', opacity: apagada ? 0.42 : 1,
              background: i % 2 ? 'rgba(0,0,0,0.015)' : 'transparent',
            }}>
              <input
                list={listaId} value={c.nombre || ''} placeholder="Nombre de la capa"
                onChange={(e) => cambiarNombre(c, e.target.value)}
                style={{ ...celda, textDecoration: apagada ? 'line-through' : 'none' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'var(--color-bg)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}
              />
              <select
                value={c.modo || 'directo'} onChange={(e) => onUpdate(c.id, { modo: e.target.value })}
                style={{ ...celda, cursor: 'pointer', fontSize: 11 }}
                title="Cómo entra esta capa al peso por metro cuadrado"
              >
                {MODOS.map((m) => <option key={m.id} value={m.id}>{m.etiqueta}</option>)}
              </select>

              {c.modo === 'espesor' && (<>
                <Celda value={c.t} onChange={(v) => onUpdate(c.id, { t: v })} placeholder="m" />
                <Celda value={c.gamma} onChange={(v) => onUpdate(c.id, { gamma: v })} placeholder="kg/m³" />
                <Celda deshabilitada />
              </>)}
              {c.modo === 'lineal' && (<>
                <Celda value={c.long} onChange={(v) => onUpdate(c.id, { long: v })} placeholder="m" />
                <Celda value={c.pesoML} onChange={(v) => onUpdate(c.id, { pesoML: v })} placeholder="kg/m" />
                <Celda value={c.area} onChange={(v) => onUpdate(c.id, { area: v })} placeholder="m²" />
              </>)}
              {(!c.modo || c.modo === 'directo') && (<>
                <Celda value={c.t} onChange={(v) => onUpdate(c.id, { t: v })} placeholder="m (ref.)" />
                <Celda value={c.W} onChange={(v) => onUpdate(c.id, { W: v })} placeholder="kg/m²" />
                <Celda deshabilitada />
              </>)}

              <span title={formulaCapa(c)} style={{
                textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: apagada ? 'var(--color-tx3)' : 'var(--color-tx)',
              }}>{fmt(W)}</span>

              <span style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                <IconBtn title={apagada ? 'Volver a contar esta capa' : 'No contar esta capa'}
                  onClick={() => onUpdate(c.id, { activa: apagada })}>
                  {apagada
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M17.9 17.9A10.1 10.1 0 0 1 12 19c-7 0-11-7-11-7a18 18 0 0 1 5.1-5.9M9.9 4.2A10 10 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2M1 1l22 22" /></svg>}
                </IconBtn>
                <IconBtn title="Subir" disabled={i === 0} onClick={() => onMover(c.id, -1)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 15 12 9 18 15" /></svg>
                </IconBtn>
                <IconBtn title="Bajar" disabled={i === capas.length - 1} onClick={() => onMover(c.id, 1)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </IconBtn>
                <IconBtn title="Quitar la capa" tone="malo" onClick={() => onRemove(c.id)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
                </IconBtn>
              </span>
            </div>
          )
        })}

        {/* Alta de capas y total */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', background: 'var(--color-bg)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>Añadir:</span>
          {MODOS.map((m) => (
            <button key={m.id} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 9px' }}
              onClick={() => onAdd(m.id)} title={`Nueva capa por ${m.etiqueta.toLowerCase()}`}>
              + {m.etiqueta}
            </button>
          ))}
          {total !== undefined && (
            <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--color-tx3)' }}>Carga muerta total = </span>
              <strong style={{ fontSize: 14 }}>{fmt(total)}</strong>
              <span style={{ color: 'var(--color-tx3)' }}> kg/m²</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Menú de "insertar desde plantilla" con buscador. */
export function MenuPlantillas({ plantillas, onPick, etiqueta = 'Desde plantilla', ancho = 320 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const vistos = plantillas.filter((p) => norm(p.nombre).includes(norm(q)))

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => { setOpen(!open); setQ('') }}>
        {etiqueta}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, width: ancho, maxHeight: 340, overflowY: 'auto',
          background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.16)', padding: 6, zIndex: 200,
        }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
            className="field-input" style={{ marginBottom: 6, fontSize: 12 }} />
          {vistos.length === 0 && <div style={{ padding: 10, fontSize: 11, color: 'var(--color-tx3)' }}>Nada con ese nombre.</div>}
          {vistos.map((p) => (
            <div key={p.id} onClick={() => { setOpen(false); onPick(p) }}
              style={{ padding: '6px 9px', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: 'var(--color-tx2)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                {p.origen === 'usuario' && <span style={{
                  fontSize: 8, fontFamily: 'var(--font-mono)', background: 'var(--color-accent)', color: '#fff',
                  padding: '1px 5px', borderRadius: 99,
                }}>tuya</span>}
              </div>
              {p.capas && <div style={{ fontSize: 10, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                {p.capas.length} capa(s){p.tipo ? ` · ${p.tipo}` : ''}
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

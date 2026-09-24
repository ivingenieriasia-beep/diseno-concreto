import { useEffect, useState } from 'react'

// Campos de captura del módulo de Cimentaciones. El número se edita como
// texto (para poder escribir «1.» o borrar) y se entrega como número al salir
// del foco o con Enter; mientras se escribe también se entrega si ya es válido.

export function Num({ label, value, onChange, unit = '', step = 0.05, min = null, max = null, placeholder = '', testid, propio = false, onReset = null, ancho = null, titulo = '', disabled = false }) {
  const muestra = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : (v ?? ''))
  const [txt, setTxt] = useState(muestra(value))
  useEffect(() => { setTxt(muestra(value)) }, [value])
  const entregar = (t) => {
    const v = parseFloat(String(t).replace(',', '.'))
    if (!Number.isFinite(v)) return
    let w = v
    if (min != null) w = Math.max(min, w)
    if (max != null) w = Math.min(max, w)
    if (w !== value) onChange(w)
  }
  return (
    <label className="cim-campo" style={ancho ? { width: ancho } : undefined} title={titulo}>
      {label && (
        <span className="cim-etq">
          {label}
          {propio && (
            <button type="button" className="cim-propio" onClick={(e) => { e.preventDefault(); onReset?.() }} title="Este cimiento tiene su propio valor; clic para volver al de la obra">
              propio ↺
            </button>
          )}
        </span>
      )}
      <span className="cim-num">
        <input
          type="text" inputMode="decimal" data-testid={testid} disabled={disabled}
          value={txt} placeholder={placeholder}
          onChange={(e) => { setTxt(e.target.value); const v = parseFloat(e.target.value.replace(',', '.')); if (Number.isFinite(v) && (min == null || v >= min) && (max == null || v <= max)) onChange(v) }}
          onBlur={() => { entregar(txt); setTxt(muestra(value)) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { entregar(txt); e.currentTarget.blur() }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              const base = Number.isFinite(parseFloat(txt)) ? parseFloat(txt) : (value || 0)
              const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
              const v = Math.round((base + d) / step) * step
              entregar(Number(v.toFixed(6)))
            }
          }}
        />
        {unit && <span className="cim-uni">{unit}</span>}
      </span>
    </label>
  )
}

export function Sel({ label, value, onChange, opciones, testid, ancho = null }) {
  return (
    <label className="cim-campo" style={ancho ? { width: ancho } : undefined}>
      {label && <span className="cim-etq">{label}</span>}
      <select className="field-select" data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '4px 6px', fontSize: 12.5 }}>
        {opciones.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </label>
  )
}

export function Check({ label, value, onChange, testid, titulo = '' }) {
  return (
    <label className="cim-check" title={titulo}>
      <input type="checkbox" data-testid={testid} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Bloque({ titulo, children, extra = null, abierto = true, testid }) {
  const [a, setA] = useState(abierto)
  return (
    <section className="cim-bloque" data-testid={testid}>
      <header onClick={() => setA(!a)}>
        <span className="cim-flecha">{a ? '▾' : '▸'}</span>
        <span>{titulo}</span>
        {extra && <span className="cim-extra" onClick={(e) => e.stopPropagation()}>{extra}</span>}
      </header>
      {a && <div className="cim-cuerpo">{children}</div>}
    </section>
  )
}

export const CALIBRES = ['2.5', '3', '4', '5', '6', '8'].map((n) => ({ v: n, t: `#${n}` }))

/** # y separación de una parrilla */
export function Varilla({ label, arm, onChange, testid, conN = false, conRamas = false, conOn = false }) {
  return (
    <div className="cim-varilla" data-testid={testid}>
      <span className="cim-etq" style={{ flex: '1 1 100%' }}>{label}</span>
      {conOn && <Check label="con bastones" value={arm.on} onChange={(v) => onChange({ ...arm, on: v })} testid={testid ? `${testid}-on` : undefined} />}
      {conN && <Num value={arm.n} onChange={(v) => onChange({ ...arm, n: Math.max(2, Math.round(v)) })} unit="pzas" step={1} min={2} max={12} ancho={82} testid={testid ? `${testid}-n` : undefined} />}
      <Sel value={String(arm.num)} onChange={(v) => onChange({ ...arm, num: parseFloat(v) })} opciones={CALIBRES} ancho={72} testid={testid ? `${testid}-num` : undefined} />
      {!conN && !conRamas && <Num value={arm.s} onChange={(v) => onChange({ ...arm, s: v })} unit="@ cm" step={2.5} min={5} max={60} ancho={96} testid={testid ? `${testid}-s` : undefined} />}
      {conRamas && <Num value={arm.ramas} onChange={(v) => onChange({ ...arm, ramas: Math.max(2, Math.round(v)) })} unit="ramas" step={1} min={2} max={6} ancho={82} />}
      {conRamas && <Num value={arm.s} onChange={(v) => onChange({ ...arm, s: v })} unit="@ cm" step={2.5} min={5} max={60} ancho={96} />}
    </div>
  )
}

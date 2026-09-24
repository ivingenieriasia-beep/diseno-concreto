import { useEffect, useState } from 'react'
import { parrilla, varilla } from '../../core/cim/comun'

// Campos de captura del módulo de Cimentaciones. El número se edita como
// texto (para poder escribir «1.» o borrar) y se entrega como número al salir
// del foco o con Enter; mientras se escribe también se entrega si ya es válido.

/** Al siguiente múltiplo del paso hacia arriba o hacia abajo (15 → 20, 18.3 → 20 o 15) */
export const pasoSiguiente = (base, step, dir) => {
  const q = base / step
  const k = dir > 0 ? Math.floor(q + 1e-9) + 1 : Math.ceil(q - 1e-9) - 1
  return Number((k * step).toFixed(6))
}

export function Num({ label, value, onChange, unit = '', step = 0.05, min = null, max = null, placeholder = '', testid, propio = false, onReset = null, ancho = null, titulo = '', disabled = false, flechas = false, apagado = false }) {
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
    <label className={`cim-campo${apagado ? ' cim-apagado' : ''}`} style={ancho ? { width: ancho } : undefined} title={titulo}>
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
              entregar(pasoSiguiente(base, step * (e.shiftKey ? 10 : 1), e.key === 'ArrowUp' ? 1 : -1))
            }
          }}
        />
        {unit && <span className="cim-uni">{unit}</span>}
        {flechas && !disabled && (
          <span className="cim-flechas">
            <button type="button" tabIndex={-1} data-testid={testid ? `${testid}-mas` : undefined} title={`+${step}`}
              onClick={(e) => { e.preventDefault(); entregar(pasoSiguiente(Number(value) || 0, step, 1)) }}>▲</button>
            <button type="button" tabIndex={-1} data-testid={testid ? `${testid}-menos` : undefined} title={`−${step}`}
              onClick={(e) => { e.preventDefault(); entregar(pasoSiguiente(Number(value) || 0, step, -1)) }}>▼</button>
          </span>
        )}
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

/**
 * Separación ↔ cantidad de una parrilla: se programa una de las dos (la otra
 * se ve atenuada con lo que resulta). Con la cantidad, la separación sale de
 * repartir las varillas en el ancho (o de 100/n en una franja por metro).
 */
export function separacionDe(arm, { ancho = 100, r = 5, porMetro = false } = {}) {
  const n = Math.max(porMetro ? 1 : 2, Math.round(Number(arm.n) || 2))
  if (porMetro) return 100 / n
  const libre = Math.max(0, ancho - 2 * r - varilla(arm.num).diam)
  return libre / (n - 1)
}
export function cantidadDe(arm, { ancho = 100, r = 5, porMetro = false } = {}) {
  const s = Number(arm.s) || 20
  return parrilla({ num: arm.num, s, W: ancho, r, porMetro }).n
}
const r1 = (v) => Math.round(v * 10) / 10

/** # y separación (o cantidad) de una parrilla; # y piezas de un lecho */
export function Varilla({ label, arm, onChange, testid, conN = false, conRamas = false, conOn = false, ancho = null, r = 5, porMetro = false }) {
  const parrillaSN = !conN && !conRamas && !conOn
  const modoN = parrillaSN && arm.modo === 'n' && Number(arm.n) > 0
  const geo = { ancho: ancho ?? 100, r, porMetro }
  const sMostrada = modoN ? r1(separacionDe(arm, geo)) : arm.s
  const nMostrada = modoN ? arm.n : (porMetro ? r1(cantidadDe(arm, geo)) : cantidadDe(arm, geo))
  return (
    <div className="cim-varilla" data-testid={testid}>
      <span className="cim-etq" style={{ flex: '1 1 100%' }}>{label}</span>
      {conOn && <Check label="con bastones" value={arm.on} onChange={(v) => onChange({ ...arm, on: v })} testid={testid ? `${testid}-on` : undefined} />}
      {conN && <Num value={arm.n} onChange={(v) => onChange({ ...arm, n: Math.max(2, Math.round(v)) })} unit="pzas" step={1} min={2} max={12} ancho={82} testid={testid ? `${testid}-n` : undefined} />}
      <Sel value={String(arm.num)} onChange={(v) => onChange({ ...arm, num: parseFloat(v) })} opciones={CALIBRES} ancho={parrillaSN ? 64 : 72} testid={testid ? `${testid}-num` : undefined} />
      {conOn && <Num value={arm.s} onChange={(v) => onChange({ ...arm, s: v })} unit="@ cm" step={2.5} min={5} max={60} ancho={96} testid={testid ? `${testid}-s` : undefined} />}
      {parrillaSN && <>
        <Num value={sMostrada} flechas apagado={modoN} unit="@ cm" step={5} min={5} max={60} ancho={102}
          titulo={modoN ? 'La separación que da la cantidad; escríbela (o usa las flechas) para programar la separación' : 'Separación (flechas a cada 5 cm)'}
          onChange={(v) => onChange({ ...arm, s: v, modo: 's' })} testid={testid ? `${testid}-s` : undefined} />
        <Num value={nMostrada} flechas apagado={!modoN} unit={porMetro ? '/m' : 'pzas'} step={1} min={porMetro ? 1 : 2} max={200} ancho={94}
          titulo={modoN ? 'Cantidad de varillas' : 'Las varillas que da la separación; escríbelas para programar la cantidad'}
          onChange={(v) => { const n = Math.max(porMetro ? 1 : 2, Math.round(v)); onChange({ ...arm, n, modo: 'n', s: Number(separacionDe({ ...arm, n }, geo).toFixed(2)) }) }}
          testid={testid ? `${testid}-cant` : undefined} />
      </>}
      {conRamas && <Num value={arm.ramas} onChange={(v) => onChange({ ...arm, ramas: Math.max(2, Math.round(v)) })} unit="ramas" step={1} min={2} max={6} ancho={82} />}
      {conRamas && <Num value={arm.s} onChange={(v) => onChange({ ...arm, s: v })} unit="@ cm" step={2.5} min={5} max={60} ancho={96} />}
    </div>
  )
}

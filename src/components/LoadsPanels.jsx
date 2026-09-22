import { useMemo, useState } from 'react'
import useLoadsStore from '../store/useLoadsStore'
import { analizarTablero, filasRam, tablaRamCSV, METODOS, UNIDADES, num } from '../core/loads'
import { Stat, SectionTitle, IconBtn, fmt } from './LoadsShared'

// ══════════════════════════════════════════════════════════════
// Tableros: de la presión por metro cuadrado a la carga lineal que se
// captura en RAM sobre las trabes de cada lado del tablero.
// ══════════════════════════════════════════════════════════════

const COLS = '1.3fr 74px 1.5fr 62px 62px 116px 96px 84px 1.2fr 56px 84px 56px 82px 82px 62px'

export default function LoadsPanels({ onToast }) {
  const losas = useLoadsStore((s) => s.losas)
  const muros = useLoadsStore((s) => s.muros)
  const tableros = useLoadsStore((s) => s.tableros)
  const unidad = useLoadsStore((s) => s.unidad)
  const setUnidad = useLoadsStore((s) => s.setUnidad)
  const addTablero = useLoadsStore((s) => s.addTablero)
  const updateTablero = useLoadsStore((s) => s.updateTablero)
  const removeTablero = useLoadsStore((s) => s.removeTablero)
  const duplicarTablero = useLoadsStore((s) => s.duplicarTablero)

  const [sel, setSel] = useState(null)

  const analisis = useMemo(() => {
    const mapa = new Map()
    for (const t of tableros) {
      mapa.set(t.id, analizarTablero(t, losas.find((l) => l.id === t.losaId) || null, muros.find((m) => m.id === t.muroId) || null))
    }
    return mapa
  }, [tableros, losas, muros])

  const filas = useMemo(() => filasRam(tableros, losas, muros, { unidad }), [tableros, losas, muros, unidad])
  const suf = UNIDADES[unidad].sufijo
  const activo = tableros.find((t) => t.id === sel) || tableros[0] || null
  const aAct = activo ? analisis.get(activo.id) : null

  const copiar = async () => {
    const texto = tablaRamCSV(filas, { sep: '\t', unidad })
    try {
      await navigator.clipboard.writeText(texto)
      onToast?.(`${filas.length} renglón(es) copiados; pégalos en tu hoja o captúralos en RAM`)
    } catch {
      // Sin permiso de portapapeles: se deja seleccionado para copiar a mano
      const ta = document.createElement('textarea')
      ta.value = texto
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); onToast?.(`${filas.length} renglón(es) copiados`) }
      catch { onToast?.('El navegador no dejó copiar; descarga el CSV', 'aviso') }
      ta.remove()
    }
  }

  const descargar = () => {
    const blob = new Blob([tablaRamCSV(filas, { sep: ',', unidad })], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cargas-tableros-${unidad}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Captura de tableros ── */}
        <div>
          <SectionTitle right={
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => addTablero()} disabled={losas.length === 0}>
              + Tablero
            </button>
          }>Tableros</SectionTitle>

          {losas.length === 0 && (
            <div style={{
              padding: '16px 12px', fontSize: 12, color: 'var(--color-tx2)', lineHeight: 1.6,
              background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 7,
            }}>
              Primero captura al menos una losa en la pestaña <strong>Losas</strong>: el tablero toma de ahí la carga por metro cuadrado.
            </div>
          )}

          {losas.length > 0 && (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-panel)' }}>
              <div style={{ minWidth: 1280 }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '6px 10px',
                  background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
                  fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-tx3)',
                }}>
                  <span>Tablero</span><span>Nivel</span><span>Losa</span>
                  <span>a1 (m)</span><span>a2 (m)</span><span>Método</span><span>Dirección</span><span>Caso CV</span>
                  <span>Muro borde</span><span>h (m)</span><span>Lado</span>
                  <span style={{ textAlign: 'right' }}>m</span>
                  <span style={{ textAlign: 'right' }} title="Carga total sobre la trabe del lado corto">Σ corto</span>
                  <span style={{ textAlign: 'right' }} title="Carga total sobre la trabe del lado largo">Σ largo</span>
                  <span />
                </div>

                {tableros.length === 0 && (
                  <div style={{ padding: '18px 10px', textAlign: 'center', fontSize: 12, color: 'var(--color-tx3)' }}>
                    Sin tableros. Añade uno y captura sus dos claros.
                  </div>
                )}

                {tableros.map((t, i) => {
                  const a = analisis.get(t.id)
                  const marcado = activo?.id === t.id
                  return (
                    <div key={t.id} onClick={() => setSel(t.id)}
                      style={{
                        display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '3px 10px', alignItems: 'center',
                        borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
                        background: marcado ? 'var(--color-bg)' : (i % 2 ? 'rgba(0,0,0,0.015)' : 'transparent'),
                        boxShadow: marcado ? 'inset 2px 0 0 var(--color-accent)' : 'none',
                      }}>
                      <Txt value={t.nombre} onChange={(v) => updateTablero(t.id, { nombre: v })} placeholder="Tablero" />
                      <Txt value={t.nivel} onChange={(v) => updateTablero(t.id, { nivel: v })} placeholder="N+0.00" />
                      <Sel value={t.losaId || ''} onChange={(v) => updateTablero(t.id, { losaId: v || null })}
                        opciones={[{ v: '', t: '— sin losa —' }, ...losas.map((l) => ({ v: l.id, t: l.nombre }))]} />
                      <Txt tipo="number" value={t.a1} onChange={(v) => updateTablero(t.id, { a1: v })} placeholder="m" />
                      <Txt tipo="number" value={t.a2} onChange={(v) => updateTablero(t.id, { a2: v })} placeholder="m" />
                      <Sel value={t.metodo || 'tributaria'} onChange={(v) => updateTablero(t.id, { metodo: v })}
                        opciones={Object.values(METODOS).map((m) => ({ v: m.id, t: m.nombre }))} />
                      <Sel value={t.direccion || 'auto'} onChange={(v) => updateTablero(t.id, { direccion: v })}
                        opciones={[{ v: 'auto', t: 'Automática' }, { v: 'dos', t: '2 direcc.' }, { v: 'una', t: '1 direcc.' }]} />
                      <Sel value={t.casoCV || 'Wm'} onChange={(v) => updateTablero(t.id, { casoCV: v })}
                        opciones={[{ v: 'W', t: 'W media' }, { v: 'Wa', t: 'Wa instant.' }, { v: 'Wm', t: 'Wm máxima' }]} />
                      <Sel value={t.muroId || ''} onChange={(v) => updateTablero(t.id, { muroId: v || null })}
                        opciones={[{ v: '', t: '— ninguno —' }, ...muros.map((m) => ({ v: m.id, t: m.nombre }))]} />
                      <Txt tipo="number" value={t.muroH} onChange={(v) => updateTablero(t.id, { muroH: v })} placeholder="m" />
                      <Sel value={t.muroLado || 'largo'} onChange={(v) => updateTablero(t.id, { muroLado: v })}
                        opciones={[{ v: 'largo', t: 'Largo' }, { v: 'corto', t: 'Corto' }, { v: 'ambos', t: 'Ambos' }]} />

                      <span style={{ textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: a?.dosDirecciones ? 'var(--color-accent2)' : 'var(--color-tx3)' }}
                        title={a?.dosDirecciones ? 'Trabaja en dos direcciones' : 'Trabaja en una dirección'}>
                        {a && a.m > 0 ? a.m.toFixed(3) : '—'}
                      </span>
                      <span style={{ textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {a ? fmt(a.totalCorto * UNIDADES[unidad].factor, unidad === 'ton' ? 3 : 1) : '—'}
                      </span>
                      <span style={{ textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {a ? fmt(a.totalLargo * UNIDADES[unidad].factor, unidad === 'ton' ? 3 : 1) : '—'}
                      </span>
                      <span style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                        <IconBtn title="Duplicar el tablero" onClick={() => duplicarTablero(t.id)}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
                        </IconBtn>
                        <IconBtn title="Quitar el tablero" tone="malo" onClick={() => removeTablero(t.id)}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
                        </IconBtn>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Croquis y desglose del tablero marcado ── */}
        {aAct && aAct.resumen && num(activo.a1) > 0 && num(activo.a2) > 0 && (
          <div>
            <SectionTitle>{activo.nombre || 'Tablero'} · reparto</SectionTitle>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <CroquisTablero a={aAct} unidad={unidad} />
              <div style={{ flex: 1, minWidth: 340 }}>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-panel)' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 96px 100px 100px', gap: 8, padding: '6px 10px',
                    background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
                    fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-tx3)',
                  }}>
                    <span>Caso</span>
                    <span style={{ textAlign: 'right' }}>w</span>
                    <span style={{ textAlign: 'right' }}>WLC corto</span>
                    <span style={{ textAlign: 'right' }}>WLL largo</span>
                  </div>
                  {aAct.casos.map((c) => (
                    <div key={c.clave} style={{
                      display: 'grid', gridTemplateColumns: '1.4fr 96px 100px 100px', gap: 8, padding: '5px 10px',
                      alignItems: 'center', borderBottom: '1px solid var(--color-border)', fontSize: 12, fontFamily: 'var(--font-mono)',
                    }}>
                      <span style={{ fontWeight: 600 }}>{c.etiqueta}</span>
                      <span style={{ textAlign: 'right', color: 'var(--color-tx3)' }}>
                        {fmt(c.w, 1)}<span style={{ fontSize: 9 }}> {c.clave === 'CM-muro' ? 'kg/m' : 'kg/m²'}</span>
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(c.wCorto * UNIDADES[unidad].factor, unidad === 'ton' ? 3 : 1)}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(c.wLargo * UNIDADES[unidad].factor, unidad === 'ton' ? 3 : 1)}</span>
                    </div>
                  ))}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 96px 100px 100px', gap: 8, padding: '6px 10px',
                    background: 'var(--color-bg)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 800,
                  }}>
                    <span>Suma ({suf})</span><span />
                    <span style={{ textAlign: 'right' }}>{fmt(aAct.totalCorto * UNIDADES[unidad].factor, unidad === 'ton' ? 3 : 1)}</span>
                    <span style={{ textAlign: 'right' }}>{fmt(aAct.totalLargo * UNIDADES[unidad].factor, unidad === 'ton' ? 3 : 1)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 6, lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
                  {formulaTexto(aAct, activo)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Salida para RAM ── */}
        <div>
          <SectionTitle right={
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                {Object.values(UNIDADES).map((u) => (
                  <button key={u.id} onClick={() => setUnidad(u.id)}
                    style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 9px', cursor: 'pointer', border: 'none',
                      background: unidad === u.id ? 'var(--color-accent)' : 'var(--color-bg)',
                      color: unidad === u.id ? '#fff' : 'var(--color-tx2)',
                    }}>{u.sufijo}</button>
                ))}
              </span>
              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={copiar} disabled={filas.length === 0}>
                Copiar tabla
              </button>
              <button className="btn btn-export" style={{ fontSize: 11, padding: '4px 10px' }} onClick={descargar} disabled={filas.length === 0}>
                CSV
              </button>
            </span>
          }>Salida para RAM</SectionTitle>

          {filas.length === 0 ? (
            <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--color-tx3)', border: '1px dashed var(--color-border)', borderRadius: 7 }}>
              Aquí aparece un renglón por tablero y caso de carga, listo para capturar en RAM.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-panel)' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 960, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    {['Tablero', 'Nivel', 'Losa', 'Caso', 'a1', 'a2', 'm', 'Dirección', 'Método', 'w', `WLC corto (${suf})`, `WLL largo (${suf})`].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} style={{ background: i % 2 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                      <td style={td}>{f.tablero}</td>
                      <td style={td}>{f.nivel}</td>
                      <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.losa}>{f.losa}</td>
                      <td style={td}>{f.caso}</td>
                      <td style={tdN}>{fmt(f.a1, 2)}</td>
                      <td style={tdN}>{fmt(f.a2, 2)}</td>
                      <td style={tdN}>{f.m.toFixed(3)}</td>
                      <td style={td}>{f.direccion}</td>
                      <td style={td}>{f.metodo}</td>
                      <td style={tdN}>{fmt(f.w, unidad === 'ton' && f.unidadW !== 'kg/m²' ? 3 : 1)}</td>
                      <td style={{ ...tdN, fontWeight: 700 }}>{fmt(f.wCorto, unidad === 'ton' ? 3 : 1)}</td>
                      <td style={{ ...tdN, fontWeight: 700 }}>{fmt(f.wLargo, unidad === 'ton' ? 3 : 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Croquis del reparto ──────────────────────────────────────
// El tablero a escala con las líneas a 45°: el triángulo baja a la trabe
// corta y el trapecio a la larga. En una dirección se dibujan las dos
// franjas que se van completas a las trabes largas.
function CroquisTablero({ a, unidad }) {
  const W = 300, H = 210, pad = 34
  const L = a.largo, S = a.corto
  if (!(L > 0 && S > 0)) return null
  const esc = Math.min((W - 2 * pad) / L, (H - 2 * pad) / S)
  const w = L * esc, h = S * esc
  const x0 = (W - w) / 2, y0 = (H - h) / 2
  const f = UNIDADES[unidad].factor
  const dec = unidad === 'ton' ? 3 : 0
  const cortoTxt = fmt(a.totalCorto * f, dec)
  const largoTxt = fmt(a.totalLargo * f, dec)

  const ax = x0 + h / 2, bx = x0 + w - h / 2, my = y0 + h / 2
  const tri = 'rgba(201,79,42,0.22)', trap = 'rgba(37,99,168,0.18)'

  return (
    <svg width={W} height={H} style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, flexShrink: 0 }}>
      {a.dosDirecciones ? (
        <>
          <polygon points={`${x0},${y0} ${x0},${y0 + h} ${ax},${my}`} fill={tri} />
          <polygon points={`${x0 + w},${y0} ${x0 + w},${y0 + h} ${bx},${my}`} fill={tri} />
          <polygon points={`${x0},${y0} ${x0 + w},${y0} ${bx},${my} ${ax},${my}`} fill={trap} />
          <polygon points={`${x0},${y0 + h} ${x0 + w},${y0 + h} ${bx},${my} ${ax},${my}`} fill={trap} />
          <g stroke="var(--color-tx3)" strokeWidth="0.8" strokeDasharray="3 2">
            <line x1={x0} y1={y0} x2={ax} y2={my} /><line x1={x0} y1={y0 + h} x2={ax} y2={my} />
            <line x1={x0 + w} y1={y0} x2={bx} y2={my} /><line x1={x0 + w} y1={y0 + h} x2={bx} y2={my} />
            {bx > ax && <line x1={ax} y1={my} x2={bx} y2={my} />}
          </g>
        </>
      ) : (
        <>
          <rect x={x0} y={y0} width={w} height={h / 2} fill={trap} />
          <rect x={x0} y={y0 + h / 2} width={w} height={h / 2} fill={trap} />
          <line x1={x0} y1={my} x2={x0 + w} y2={my} stroke="var(--color-tx3)" strokeWidth="0.8" strokeDasharray="3 2" />
        </>
      )}

      <rect x={x0} y={y0} width={w} height={h} fill="none" stroke="var(--color-tx2)" strokeWidth="1.6" />

      {/* Acotaciones */}
      <text x={x0 + w / 2} y={y0 + h + 15} textAnchor="middle" style={rot}>a2 = {fmt(L, 2)} m</text>
      <text x={x0 - 8} y={y0 + h / 2} textAnchor="middle" style={rot} transform={`rotate(-90 ${x0 - 8} ${y0 + h / 2})`}>a1 = {fmt(S, 2)} m</text>

      {/* Cargas resultantes */}
      <text x={x0 + w / 2} y={y0 - 10} textAnchor="middle" style={{ ...lbl, fill: '#2563a8' }}>
        {largoTxt} {UNIDADES[unidad].sufijo}
      </text>
      <text x={x0 + w + 8} y={y0 + h / 2} textAnchor="middle" style={{ ...lbl, fill: a.dosDirecciones ? '#c94f2a' : 'var(--color-tx3)' }}
        transform={`rotate(90 ${x0 + w + 8} ${y0 + h / 2})`}>
        {cortoTxt} {UNIDADES[unidad].sufijo}
      </text>
      <text x={W / 2} y={H - 4} textAnchor="middle" style={{ ...rot, fill: 'var(--color-tx3)' }}>
        m = {a.m.toFixed(3)} · {a.dosDirecciones ? 'dos direcciones' : 'una dirección'}
      </text>
    </svg>
  )
}

const lbl = { fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }
const rot = { fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-tx2)' }

function formulaTexto(a, t) {
  const m = a.m.toFixed(3)
  if (!a.dosDirecciones) return `Una dirección (m = ${m}): WLL = w · a1 / 2, con a1 = ${fmt(a.corto, 2)} m. El lado corto no recibe carga de la losa.`
  if ((t.metodo || 'tributaria') === 'equivalente') {
    return `Dos direcciones (m = ${m}), equivalente por momento: WLC = w · a1 / 3 y WLL = (w · a1 / 3) · (3 − m²) / 2.`
  }
  return `Dos direcciones (m = ${m}), área tributaria: WLC = w · a1 / 4 y WLL = (w · a1 / 4) · (2 − m).`
}

// ── Celdas editables de la tabla ─────────────────────────────
const base = {
  width: '100%', padding: '3px 5px', border: '1px solid transparent', borderRadius: 4,
  background: 'transparent', color: 'var(--color-tx)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none',
}

function Txt({ value, onChange, placeholder, tipo = 'text' }) {
  return (
    <input type={tipo} step="any" value={value ?? ''} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()}
      style={base}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'var(--color-bg)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }} />
  )
}

function Sel({ value, onChange, opciones }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()}
      style={{ ...base, cursor: 'pointer' }}>
      {opciones.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  )
}

const th = { padding: '6px 8px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-tx3)', fontWeight: 600, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }
const td = { padding: '4px 8px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }
const tdN = { ...td, textAlign: 'right' }

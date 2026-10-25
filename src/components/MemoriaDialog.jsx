import { useState, useEffect, useRef } from 'react'
import { generateMemoria } from '../core/generateMemoria'
import { generateMemoriaDocx } from '../core/generateMemoriaDocx'
import useColumnStore from '../store/useColumnStore'
import useLoadsStore from '../store/useLoadsStore'
import useCimStore from '../store/useCimStore'
import { prellenado } from '../core/memoriaDatos'
import { modeloGuardado } from '../core/ramSync'
import { parseModeloRam } from '../core/ramModel'
import { MARCA } from '../core/marca'

const LS_KEY = 'iv_memoria_meta'

const blankMeta = () => ({
  proyecto: '', ubicacion: '', area: '', niveles: '', hEntrepiso: '',
  // SOGRUB: firma el Ing. Fernando Burgos; se puede cambiar en el diálogo
  responsable: (MARCA.responsable || '').replace(/^Ing\.\s*/, ''), cedula: '', fecha: new Date().toLocaleDateString('es-MX'),
  descripcion: '',
  cmEntrepiso: '236.5', cmMuro: '249.4', cvEntrepiso: '190', cvAzotea: '100',
  detalleTodos: true,
})

function loadMeta() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...blankMeta(), ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return blankMeta()
}

function Field({ label, children, full, fuente }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label className="field-label">{label}</label>
      {children}
      {fuente && <div data-testid="mem-fuente" style={{ fontSize: 10, color: '#1a7a5e', marginTop: 2, fontFamily: 'var(--font-mono)' }}>↳ {fuente}</div>}
    </div>
  )
}

const DE_FABRICA = blankMeta()
/** Lo que el diálogo puede llenar solo, si el campo está vacío o con el valor de fábrica */
const LLENABLES = ['area', 'niveles', 'hEntrepiso', 'cmEntrepiso', 'cmMuro', 'cvEntrepiso', 'cvAzotea']

export default function MemoriaDialog({ open, onClose, sections, projectName }) {
  const columns = useColumnStore((s) => s.columns)
  const losas = useLoadsStore((s) => s.losas)
  const muros = useLoadsStore((s) => s.muros)
  const tableros = useLoadsStore((s) => s.tableros)
  const cimientos = useCimStore((s) => s.cimientos)
  const sueloCim = useCimStore((s) => s.suelo)
  const criteriosCim = useCimStore((s) => s.criterios)
  const [meta, setMeta] = useState(loadMeta)
  const [fuentes, setFuentes] = useState({})
  const [sugerido, setSugerido] = useState({ valores: {}, fuente: {} })
  const [dcheck, setDcheck] = useState(null)
  const [dcheckName, setDcheckName] = useState('')
  const [dcheckErr, setDcheckErr] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  // On open: reload persisted meta, default proyecto to current project name
  useEffect(() => {
    if (!open) return
    const m = loadMeta()
    if (!m.proyecto && projectName) m.proyecto = projectName
    m.fecha = m.fecha || new Date().toLocaleDateString('es-MX')
    setMeta(m)
    setFuentes({})
    // lo que ya se capturó en Pesos Unitarios y lo que dice el modelo de RAM
    let vivo = true
    modeloGuardado().then((g) => {
      let R = null
      try { if (g?.datos) { const r = parseModeloRam(g.datos, g.archivo || 'modelo.json'); if (r.ok) R = r } } catch { /* sin modelo */ }
      if (!vivo) return
      const P = prellenado({ losas, muros, tableros }, R)
      setSugerido(P)
      const auto = {}
      setMeta((prev) => {
        const n = { ...prev }
        for (const k of LLENABLES) {
          if (P.valores[k] == null) continue
          const v = String(prev[k] ?? '').trim()
          if (!v || v === String(DE_FABRICA[k] ?? '')) { n[k] = P.valores[k]; auto[k] = P.fuente[k] }
        }
        return n
      })
      setFuentes(auto)
    })
    return () => { vivo = false }
  }, [open, projectName]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setMeta((prev) => ({ ...prev, [k]: v }))
    setFuentes((f) => { if (!f[k]) return f; const n = { ...f }; delete n[k]; return n })
  }
  const hayPrellenado = Object.keys(sugerido.valores).some((k) => LLENABLES.includes(k))
  const llenarTodo = () => {
    const n = {}, auto = {}
    for (const k of LLENABLES) if (sugerido.valores[k] != null) { n[k] = sugerido.valores[k]; auto[k] = sugerido.fuente[k] }
    setMeta((prev) => ({ ...prev, ...n }))
    setFuentes(auto)
  }

  function handleDcheck(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.format !== 'sogrub-dcheck') {
          setDcheckErr('El archivo no es un Double Check válido (.dcheck).')
          setDcheck(null); setDcheckName('')
          return
        }
        setDcheck(data)
        setDcheckName(file.name)
        setDcheckErr('')
      } catch {
        setDcheckErr('No se pudo leer el archivo.')
        setDcheck(null); setDcheckName('')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(meta)) } catch { /* ignore */ }
  }

  async function handleWord() {
    persist()
    setBusy(true)
    try {
      await generateMemoriaDocx({ sections, columns, meta, dcheck, cimientos, obraCim: { suelo: sueloCim, criterios: criteriosCim } })
      onClose()
    } catch (err) {
      alert('No se pudo generar el documento Word: ' + (err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  function handlePdf() {
    persist()
    generateMemoria({ sections, columns, meta, dcheck, cimientos, obraCim: { suelo: sueloCim, criterios: criteriosCim } })
    onClose()
  }

  const inputStyle = { width: '100%' }
  const dcheckCount = dcheck?.sections?.length || 0

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(13,17,23,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'var(--color-panel)', border: '1px solid var(--color-border)',
        borderRadius: 12, width: 640, maxWidth: '100%', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-tx1)' }}>Generar memoria de cálculo</div>
            <div style={{ fontSize: 11, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {sections.length} trabe(s) · {columns.length} columna(s) · {cimientos.length} cimiento(s) · NTC-2023
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--color-tx3)', lineHeight: 1,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto' }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>Datos del proyecto</span>
            {hayPrellenado && (
              <button data-testid="mem-llenar" onClick={llenarTodo} title="Toma niveles y altura del modelo de RAM, y cargas y área de Pesos Unitarios"
                style={{ fontSize: 10.5, textTransform: 'none', letterSpacing: 0, padding: '2px 8px', borderRadius: 99, border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                ↻ Llenar con Pesos Unitarios y el modelo
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <Field label="Proyecto" full>
              <input className="field-input" style={inputStyle} value={meta.proyecto} onChange={set('proyecto')} placeholder="ej: Casa habitación Terrasoles" />
            </Field>
            <Field label="Ubicación" full>
              <input className="field-input" style={inputStyle} value={meta.ubicacion} onChange={set('ubicacion')} placeholder="Calle, fraccionamiento, ciudad" />
            </Field>
            <Field label="Área de construcción (m²)" fuente={fuentes.area}>
              <input className="field-input" style={inputStyle} value={meta.area} onChange={set('area')} placeholder="111" />
            </Field>
            <Field label="Niveles" fuente={fuentes.niveles}>
              <input className="field-input" style={inputStyle} value={meta.niveles} onChange={set('niveles')} placeholder="2" />
            </Field>
            <Field label="Altura de entrepiso (m)" fuente={fuentes.hEntrepiso}>
              <input className="field-input" style={inputStyle} value={meta.hEntrepiso} onChange={set('hEntrepiso')} placeholder="2.90" />
            </Field>
            <Field label="Fecha">
              <input className="field-input" style={inputStyle} value={meta.fecha} onChange={set('fecha')} />
            </Field>
            <Field label="Ing. responsable">
              <input className="field-input" style={inputStyle} value={meta.responsable} onChange={set('responsable')} placeholder="Nombre" />
            </Field>
            <Field label="Cédula profesional">
              <input className="field-input" style={inputStyle} value={meta.cedula} onChange={set('cedula')} placeholder="00000000" />
            </Field>
            <Field label="Descripción / introducción (opcional)" full>
              <textarea className="field-input" style={{ ...inputStyle, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
                value={meta.descripcion} onChange={set('descripcion')}
                placeholder="Si se deja vacío se genera un texto base a partir de los datos anteriores." />
            </Field>
          </div>

          <div className="section-title" style={{ marginTop: 16 }}>Cargas (kg/m²)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
            <Field label="CM losa" fuente={fuentes.cmEntrepiso}><input className="field-input" style={inputStyle} value={meta.cmEntrepiso} onChange={set('cmEntrepiso')} /></Field>
            <Field label="CM muro" fuente={fuentes.cmMuro}><input className="field-input" style={inputStyle} value={meta.cmMuro} onChange={set('cmMuro')} /></Field>
            <Field label="CV entrepiso" fuente={fuentes.cvEntrepiso}><input className="field-input" style={inputStyle} value={meta.cvEntrepiso} onChange={set('cvEntrepiso')} /></Field>
            <Field label="CV azotea" fuente={fuentes.cvAzotea}><input className="field-input" style={inputStyle} value={meta.cvAzotea} onChange={set('cvAzotea')} /></Field>
          </div>

          <div className="section-title" style={{ marginTop: 16 }}>Verificación cruzada</div>
          <div style={{
            marginTop: 8, padding: '12px 14px', borderRadius: 8,
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          }}>
            <input ref={fileRef} type="file" accept=".dcheck,.json,application/json" style={{ display: 'none' }} onChange={handleDcheck} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>
                📎 Cargar Double Check (.dcheck)
              </button>
              {dcheckName
                ? <span style={{ fontSize: 12, color: '#15803d', fontFamily: 'var(--font-mono)' }}>
                    ✓ {dcheckName} · {dcheckCount} elemento(s)
                    <button onClick={() => { setDcheck(null); setDcheckName('') }} style={{
                      marginLeft: 8, fontSize: 11, background: 'none', border: 'none',
                      color: 'var(--color-tx3)', textDecoration: 'underline', cursor: 'pointer',
                    }}>quitar</button>
                  </span>
                : <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>Opcional — añade tabla comparativa y capturas</span>}
            </div>
            {dcheckErr && <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626' }}>{dcheckErr}</div>}
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-tx3)' }}>
              ¿No lo tienes a la mano? Genéralo desde el botón <b>Double Check</b> de la barra y guarda el archivo .dcheck.
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer', fontSize: 12, color: 'var(--color-tx2)' }}>
            <input type="checkbox" checked={meta.detalleTodos} onChange={set('detalleTodos')} />
            Detallar todas las trabes paso a paso (si se desactiva, sólo la trabe gobernante)
          </label>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span style={{ fontSize: 10.5, color: 'var(--color-tx3)', maxWidth: 240, lineHeight: 1.4 }}>
            Word (.docx) nativo, editable directamente en Microsoft Word.
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="btn btn-secondary" style={{ fontSize: 13 }} disabled={sections.length + columns.length + cimientos.length === 0 || busy} onClick={handlePdf}>
              Vista PDF
            </button>
            <button className="btn btn-primary" data-testid="mem-word" style={{ fontSize: 13 }} disabled={sections.length + columns.length + cimientos.length === 0 || busy} onClick={handleWord}>
              {busy ? 'Generando…' : 'Generar Word (.docx)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

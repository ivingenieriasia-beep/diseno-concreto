import { useState, useRef, useEffect } from 'react'
import useBeamStore from '../store/useBeamStore'
import useColumnStore from '../store/useColumnStore'
import { timeAgo } from '../core/autosave'
import { APP_VERSION } from '../core/constants'
import { repartirEnvolventes, resumenReparto } from '../core/bulkEnvelopes'

const SCALE_PRESETS = [
  { label: '50:1', value: 0.02 },
  { label: '20:1', value: 0.05 },
  { label: '10:1', value: 0.1 },
  { label: '1:1', value: 1 },
  { label: '1:10', value: 10 },
  { label: '1:20', value: 20 },
  { label: '1:50', value: 50 },
]

export default function TopBar({ onExportDxf, onExportSvg, onSave, onOpen, onNew, recents = [], onOpenRecent, onVerifyResumido, onVerifyDetallado, onMemoria, onExportDcheck, onModulos, onToast, onAbrirCentro, dxfScale, setDxfScale, projectName, setProjectName }) {
  const sections = useBeamStore((s) => s.sections)
  const selectedIdx = useBeamStore((s) => s.selectedIdx)
  const selectSection = useBeamStore((s) => s.selectSection)
  const removeSection = useBeamStore((s) => s.removeSection)
  const createSection = useBeamStore((s) => s.createSection)
  const moveSection = useBeamStore((s) => s.moveSection)
  const setEnvelopeAt = useBeamStore((s) => s.setEnvelopeAt)
  const setPerfilAt = useBeamStore((s) => s.setPerfilAt)
  const columns = useColumnStore((s) => s.columns)
  const setColEnvelopeAt = useColumnStore((s) => s.setEnvelopeAt)
  const columnsCount = columns.length
  const hasContent = sections.length > 0 || columnsCount > 0

  const [arrastre, setArrastre] = useState(null) // { from, over, lado }
  const envRef = useRef(null)
  // Reparte por nombre de archivo los reportes de RAM entre trabes y columnas
  async function cargarEnvolventes(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    const archivos = []
    for (const f of files) {
      try { archivos.push({ nombre: f.name, texto: await f.text() }) } catch { /* ignora el ilegible */ }
    }
    const r = repartirEnvolventes(archivos, { trabes: sections, columnas: columns })
    for (const a of r.asignados) {
      if (a.tipo === 'trabe') {
        setEnvelopeAt(a.idx, a.env)
        if (a.perfil) setPerfilAt(a.idx, a.perfil)
      } else setColEnvelopeAt(a.idx, a.env)
    }
    onToast?.(resumenReparto(r), r.asignados.length ? (r.sinDestino.length || r.ilegibles.length ? 'warn' : 'ok') : 'warn')
  }

  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const menuRef = useRef(null)
  const verifyRef = useRef(null)
  const recentRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    if (!open && !verifyOpen && !recentOpen) return
    const handler = (e) => {
      if (open && menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
      if (verifyOpen && verifyRef.current && !verifyRef.current.contains(e.target)) setVerifyOpen(false)
      if (recentOpen && recentRef.current && !recentRef.current.contains(e.target)) setRecentOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, verifyOpen, recentOpen])

  const currentLabel = SCALE_PRESETS.find((p) => p.value === dxfScale)?.label
    || (dxfScale >= 1 ? `1:${dxfScale}` : `${Math.round(1 / dxfScale)}:1`)

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', minHeight: 48 }}>
      {/* Logo / title */}
      <div className="flex items-center gap-2 mr-4" style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
          &#9645;
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-tx1)' }}>
          Auxiliar IV
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
          v{APP_VERSION}
        </span>
      </div>

      {/* Nuevo proyecto */}
      <button
        className="btn btn-secondary"
        onClick={onNew}
        style={{ fontSize: 12, padding: '6px 10px', flexShrink: 0 }}
        title="Proyecto nuevo (lo actual queda en Recientes)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6" />
          <path d="M12 12v6M9 15h6" />
        </svg>
      </button>

      {/* Project name */}
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Proyecto"
        style={{
          width: 140, padding: '4px 8px', fontSize: 12,
          fontFamily: 'var(--font-mono)', background: 'var(--color-bg)',
          border: '1px solid var(--color-border)', borderRadius: 5,
          color: 'var(--color-tx1)', outline: 'none', flexShrink: 0,
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
      />

      {/* Verify button with dropdown */}
      <div style={{ position: 'relative', flexShrink: 0 }} ref={verifyRef}>
        <button
          className="btn"
          onClick={() => setVerifyOpen(!verifyOpen)}
          disabled={!hasContent}
          style={{
            fontSize: 12, padding: '5px 12px',
            background: '#e8830a', color: '#fff',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#cf7509'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#e8830a'}
          title="Generar informe de verificación"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Verificar
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {verifyOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--color-panel)', border: '1px solid var(--color-border)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: 6, minWidth: 180, zIndex: 100,
          }}>
            <div
              onClick={() => { setVerifyOpen(false); onVerifyResumido?.() }}
              style={{
                padding: '8px 12px', borderRadius: 5, cursor: 'pointer',
                fontSize: 12, color: 'var(--color-tx2)', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600 }}>Resumido</div>
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 2 }}>
                Resumen con verificaciones
              </div>
            </div>
            <div
              onClick={() => { setVerifyOpen(false); onVerifyDetallado?.() }}
              style={{
                padding: '8px 12px', borderRadius: 5, cursor: 'pointer',
                fontSize: 12, color: 'var(--color-tx2)', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600 }}>Detallado</div>
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 2 }}>
                Verificaci&oacute;n paso a paso por secci&oacute;n
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 6px' }} />
            <div
              onClick={() => { setVerifyOpen(false); onMemoria?.() }}
              style={{
                padding: '8px 12px', borderRadius: 5, cursor: 'pointer',
                fontSize: 12, color: 'var(--color-tx2)', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                Memoria de c&aacute;lculo
                <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--color-accent)', color: '#0d1117', padding: '1px 6px', borderRadius: 99 }}>NUEVO</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 2 }}>
                Documento completo + Double Check
              </div>
            </div>
            <div
              onClick={() => { setVerifyOpen(false); onExportDcheck?.() }}
              style={{
                padding: '8px 12px', borderRadius: 5, cursor: 'pointer',
                fontSize: 12, color: 'var(--color-tx2)', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                Exportar a Double Check
                <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--color-accent)', color: '#0d1117', padding: '1px 6px', borderRadius: 99 }}>NUEVO</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 2 }}>
                .dcheck prellenado (Mr, Mu, Vu); s&oacute;lo faltan las capturas
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Módulos — paleta con las herramientas que no son del detalle */}
      <button
        className="btn"
        onClick={onModulos}
        style={{
          fontSize: 12, padding: '5px 12px', flexShrink: 0,
          background: 'var(--color-accent)', color: '#0d1117', fontWeight: 600,
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#49b09a'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
        title="Pesos Unitarios, Longitudinal, BD Global, Double Check… (⌘K / Ctrl+K)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        M&oacute;dulos
      </button>

      <div style={{ width: 1, height: 24, background: 'var(--color-border)', flexShrink: 0 }} />

      <input
        ref={envRef}
        data-testid="env-files"
        type="file"
        multiple
        accept=".txt,.csv,text/plain"
        style={{ display: 'none' }}
        onChange={cargarEnvolventes}
      />

      {/* Section chips */}
      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
        {sections.map((s, i) => {
          const arr = arrastre
          const marca = arr && arr.from !== i && arr.over === i ? (arr.lado === 'izq' ? ' drop-left' : ' drop-right') : ''
          return (
            <span
              key={s.uid || s.nombre + i}
              data-testid={`chip-${i}`}
              className={`chip ${i === selectedIdx ? 'active' : ''}${arr?.from === i ? ' dragging' : ''}${marca}`}
              onClick={() => selectSection(i)}
              draggable
              tabIndex={0}
              title="Arrástralo para cambiarlo de lugar en el tablero (Alt + ← / → con el teclado)"
              onDragStart={(e) => {
                setArrastre({ from: i, over: i, lado: 'der' })
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(i))   // Firefox necesita datos
              }}
              onDragEnd={() => setArrastre(null)}
              onDragOver={(e) => {
                if (!arrastre) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const r = e.currentTarget.getBoundingClientRect()
                const lado = e.clientX < r.left + r.width / 2 ? 'izq' : 'der'
                if (arrastre.over !== i || arrastre.lado !== lado) setArrastre({ ...arrastre, over: i, lado })
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = arrastre?.from ?? +e.dataTransfer.getData('text/plain')
                if (Number.isInteger(from)) {
                  // soltar a la derecha de un chip que está antes no corre el índice
                  let to = arrastre?.lado === 'der' ? i + 1 : i
                  if (from < to) to -= 1
                  moveSection(from, Math.max(0, Math.min(sections.length - 1, to)))
                }
                setArrastre(null)
              }}
              onKeyDown={(e) => {
                if (!e.altKey) return
                if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); moveSection(i, i - 1) }
                if (e.key === 'ArrowRight' && i < sections.length - 1) { e.preventDefault(); moveSection(i, i + 1) }
              }}
            >
              {s.nombre || `S-${i + 1}`}
              <span
                className="chip-x"
                onClick={(e) => { e.stopPropagation(); removeSection(i) }}
              >&times;</span>
            </span>
          )
        })}
        <button
          className="btn btn-primary"
          onClick={createSection}
          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99 }}
        >
          + Nueva
        </button>
      </div>

        {/* Siempre a mano: un proyecto nuevo arranca justo aquí, sincronizando el modelo de RAM */}
        <button
          className="btn btn-secondary"
          data-testid="cargar-envolventes"
          onClick={() => onAbrirCentro?.()}
          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, flexShrink: 0 }}
          title="Centro de carga: sincronizar con RAM, configurar el proyecto y los reportes de texto"
        >
          📥 Reportes de RAM
        </button>

      {/* File + Export buttons */}
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex' }} ref={recentRef}>
          <button
            className="btn btn-secondary"
            onClick={onOpen}
            style={{ fontSize: 12, padding: '6px 10px', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            title="Abrir proyecto (.json)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1" />
              <path d="M14 14l-4 4m0 0l-4-4m4 4V10" style={{ transform: 'rotate(180deg)', transformOrigin: '12px 14px' }} />
            </svg>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setRecentOpen(!recentOpen)}
            disabled={recents.length === 0}
            style={{ fontSize: 10, padding: '6px 5px', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 }}
            title="Proyectos recientes"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {recentOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--color-panel)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: 6, minWidth: 240, zIndex: 100,
            }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 10px 6px' }}>Recientes</div>
              {recents.map((r) => (
                <div key={r.name}
                  onClick={() => { setRecentOpen(false); onOpenRecent?.(r.name) }}
                  style={{ padding: '7px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: 'var(--color-tx2)', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    {r.trabes} trabe(s) · {r.columnas} columna(s) · {timeAgo(r.savedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="btn btn-secondary"
          onClick={onSave}
          disabled={!hasContent}
          style={{ fontSize: 12, padding: '6px 10px' }}
          title="Guardar proyecto (.json)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />

        <button
          className="btn btn-secondary"
          onClick={onExportSvg}
          disabled={!hasContent}
          style={{ fontSize: 12 }}
        >
          SVG
        </button>

        {/* Scale selector */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            className="btn btn-secondary"
            onClick={() => setOpen(!open)}
            style={{ fontSize: 11, padding: '6px 10px', fontFamily: 'var(--font-mono)', gap: 4 }}
            title="Escala de exportación DXF"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2l20 20" />
              <path d="M5.5 5.5L2 2" />
              <path d="M7 2h-5v5" />
              <path d="M18.5 18.5L22 22" />
              <path d="M17 22h5v-5" />
            </svg>
            {currentLabel}
          </button>

          {open && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--color-panel)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: 6, minWidth: 130, zIndex: 100,
            }}>
              {SCALE_PRESETS.map((p) => (
                <div
                  key={p.value}
                  onClick={() => { setDxfScale(p.value); setOpen(false) }}
                  style={{
                    padding: '6px 10px', borderRadius: 5, cursor: 'pointer',
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    background: dxfScale === p.value ? 'var(--color-accent)' : 'transparent',
                    color: dxfScale === p.value ? '#fff' : 'var(--color-tx2)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (dxfScale !== p.value) e.currentTarget.style.background = 'var(--color-border)' }}
                  onMouseLeave={(e) => { if (dxfScale !== p.value) e.currentTarget.style.background = 'transparent' }}
                >
                  {p.label}
                </div>
              ))}

              {/* Custom */}
              <div style={{
                borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 6,
              }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginBottom: 3, paddingLeft: 4 }}>
                  Personalizado
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', paddingLeft: 4 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>1:</span>
                  <input
                    type="number" min="1" step="1"
                    className="field-input"
                    style={{ width: 60, padding: '3px 6px', fontSize: 12 }}
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="—"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = parseInt(custom, 10)
                        if (v > 0) { setDxfScale(v); setOpen(false) }
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 10, padding: '3px 8px' }}
                    onClick={() => {
                      const v = parseInt(custom, 10)
                      if (v > 0) { setDxfScale(v); setOpen(false) }
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-export"
          onClick={onExportDxf}
          disabled={!hasContent}
          style={{ fontSize: 12 }}
        >
          Exportar DXF
        </button>
      </div>
    </header>
  )
}

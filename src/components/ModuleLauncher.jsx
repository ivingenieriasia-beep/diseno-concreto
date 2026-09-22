import { useState, useEffect, useRef, useMemo } from 'react'
import { buscarModulos } from '../core/modules'
import ModuleIcon from './ModuleIcon'

// ══════════════════════════════════════════════════════════════
// Paleta de módulos. Se abre con el botón "Módulos" o con ⌘K / Ctrl+K,
// se escribe para filtrar y se abre con ↵. Las de tipo pestaña quedan
// abiertas junto a las fijas; las de ventana salen en ventana aparte.
// ══════════════════════════════════════════════════════════════

export default function ModuleLauncher({ open, onClose, onPick, abiertos = [], badges = {} }) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const resultados = useMemo(() => buscarModulos(q), [q])

  // Al abrir: campo limpio, foco dentro y el cursor arriba
  useEffect(() => {
    if (!open) return
    setQ('')
    setCursor(0)
    const t = setTimeout(() => inputRef.current?.focus(), 20)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => { setCursor(0) }, [q])

  // La tarjeta marcada siempre a la vista
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[data-cursor="1"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, open])

  if (!open) return null

  const elegir = (mod) => { if (mod) { onClose?.(); onPick?.(mod) } }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return }
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault(); setCursor((c) => (resultados.length ? (c + 1) % resultados.length : 0)); return
    }
    if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault(); setCursor((c) => (resultados.length ? (c - 1 + resultados.length) % resultados.length : 0)); return
    }
    if (e.key === 'Enter') { e.preventDefault(); elegir(resultados[cursor]) }
  }

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(26,24,20,0.34)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh',
      }}
    >
      <div
        onKeyDown={onKeyDown}
        style={{
          width: 'min(680px, calc(100vw - 32px))', maxHeight: '76vh', display: 'flex', flexDirection: 'column',
          background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 12,
          boxShadow: '0 18px 50px rgba(0,0,0,0.22)', overflow: 'hidden',
        }}
      >
        {/* Buscador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-tx3)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar módulo…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 15, fontFamily: 'var(--font-sans)', color: 'var(--color-tx)',
            }}
          />
          <kbd style={kbd}>esc</kbd>
        </div>

        {/* Resultados */}
        <div ref={listRef} style={{ padding: 10, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {resultados.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '28px 12px', textAlign: 'center', color: 'var(--color-tx3)', fontSize: 13 }}>
              Ningún módulo coincide con “{q}”.
            </div>
          )}
          {resultados.map((m, i) => {
            const activo = i === cursor
            const abierto = abiertos.includes(m.id)
            return (
              <button
                key={m.id}
                data-cursor={activo ? '1' : '0'}
                onMouseEnter={() => setCursor(i)}
                onClick={() => elegir(m)}
                style={{
                  textAlign: 'left', display: 'flex', gap: 10, padding: 11, borderRadius: 9, cursor: 'pointer',
                  background: activo ? 'var(--color-bg)' : 'transparent',
                  border: `1px solid ${activo ? 'var(--color-accent)' : 'transparent'}`,
                  transition: 'background 0.1s, border-color 0.1s',
                }}
              >
                <span style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center',
                  background: activo ? 'var(--color-accent)' : 'var(--color-border)',
                  color: activo ? '#fff' : 'var(--color-tx2)',
                }}>
                  <ModuleIcon nombre={m.icono} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-tx)' }}>{m.nombre}</span>
                    {badges[m.id] != null && badges[m.id] !== 0 && (
                      <span style={{ ...pill, background: 'var(--color-accent)', color: '#fff' }}>{badges[m.id]}</span>
                    )}
                    {abierto && <span style={{ ...pill, background: 'var(--color-border)', color: 'var(--color-tx2)' }}>abierto</span>}
                    {m.tipo === 'ventana' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-tx3)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 3h7v7" /><path d="M10 14L21 3" />
                        <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                      </svg>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, lineHeight: 1.45, color: 'var(--color-tx3)', marginTop: 3 }}>
                    {m.resumen}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Pie con los atajos */}
        <div style={{
          borderTop: '1px solid var(--color-border)', padding: '7px 14px', display: 'flex', gap: 14,
          fontSize: 10, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)',
        }}>
          <span><kbd style={kbd}>↑</kbd><kbd style={kbd}>↓</kbd> navegar</span>
          <span><kbd style={kbd}>↵</kbd> abrir</span>
          <span style={{ marginLeft: 'auto' }}>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  )
}

const kbd = {
  fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 5px', borderRadius: 4,
  border: '1px solid var(--color-border2)', background: 'var(--color-bg)', color: 'var(--color-tx3)', marginRight: 3,
}

const pill = {
  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
  padding: '1px 6px', borderRadius: 99, lineHeight: 1.6,
}

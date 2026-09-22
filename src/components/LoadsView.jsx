import { useState, useEffect, useMemo } from 'react'
import useLoadsStore from '../store/useLoadsStore'
import { initLoadsLibrary, getLibrary, onLibraryChange } from '../core/loadsLibrary'
import LoadsSlabs from './LoadsSlabs'
import LoadsWalls from './LoadsWalls'
import LoadsPanels from './LoadsPanels'
import LoadsLibraryView from './LoadsLibraryView'

// ══════════════════════════════════════════════════════════════
// Módulo Pesos Unitarios
// Losas → Muros → Tableros: se componen las recetas, se calculan los
// kg/m² y de ahí salen las cargas lineales que se capturan en RAM.
// ══════════════════════════════════════════════════════════════

const SUB = [
  { id: 'losas', etiqueta: 'Losas' },
  { id: 'muros', etiqueta: 'Muros y pretiles' },
  { id: 'tableros', etiqueta: 'Tableros · RAM' },
  { id: 'biblioteca', etiqueta: 'Biblioteca' },
]

export default function LoadsView({ onToast }) {
  const [sub, setSub] = useState('losas')
  const [lib, setLib] = useState(() => getLibrary())
  const losas = useLoadsStore((s) => s.losas)
  const muros = useLoadsStore((s) => s.muros)
  const tableros = useLoadsStore((s) => s.tableros)

  useEffect(() => {
    setLib(initLoadsLibrary())
    return onLibraryChange(setLib)
  }, [])

  const conteos = useMemo(() => ({
    losas: losas.length, muros: muros.length, tableros: tableros.length,
    biblioteca: lib.plantillasLosa.length + lib.plantillasMuro.length,
  }), [losas.length, muros.length, tableros.length, lib])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '6px 12px 0',
        borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)',
      }}>
        {SUB.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)}
            style={{
              padding: '5px 12px 7px', fontSize: 12, cursor: 'pointer', border: 'none', background: 'transparent',
              fontWeight: sub === s.id ? 700 : 500,
              color: sub === s.id ? 'var(--color-tx)' : 'var(--color-tx3)',
              borderBottom: `2px solid ${sub === s.id ? 'var(--color-accent)' : 'transparent'}`,
              marginBottom: -1,
            }}>
            {s.etiqueta}
            {conteos[s.id] > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: 99,
                background: sub === s.id ? 'var(--color-accent)' : 'var(--color-border)',
                color: sub === s.id ? '#fff' : 'var(--color-tx2)',
              }}>{conteos[s.id]}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', display: sub === 'losas' ? 'block' : 'none' }}>
          <LoadsSlabs lib={lib} onToast={onToast} />
        </div>
        <div style={{ height: '100%', display: sub === 'muros' ? 'block' : 'none' }}>
          <LoadsWalls lib={lib} onToast={onToast} />
        </div>
        <div style={{ height: '100%', display: sub === 'tableros' ? 'block' : 'none' }}>
          <LoadsPanels onToast={onToast} />
        </div>
        <div style={{ height: '100%', display: sub === 'biblioteca' ? 'block' : 'none' }}>
          <LoadsLibraryView lib={lib} onToast={onToast} />
        </div>
      </div>
    </div>
  )
}

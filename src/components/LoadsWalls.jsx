import { useMemo } from 'react'
import useLoadsStore from '../store/useLoadsStore'
import { resumenMuro } from '../core/loads'
import { guardarPlantillaMuro } from '../core/loadsLibrary'
import { CapaTabla, MenuPlantillas, Stat, SectionTitle, IconBtn, fmt } from './LoadsShared'

// ══════════════════════════════════════════════════════════════
// Muros y pretiles: el ensamble da kg/m² y cada altura declarada da la
// carga por metro lineal que se captura sobre la trabe.
// ══════════════════════════════════════════════════════════════

export default function LoadsWalls({ lib, onToast }) {
  const muros = useLoadsStore((s) => s.muros)
  const muroSel = useLoadsStore((s) => s.muroSel)
  const selectMuro = useLoadsStore((s) => s.selectMuro)
  const addMuro = useLoadsStore((s) => s.addMuro)
  const removeMuro = useLoadsStore((s) => s.removeMuro)
  const duplicar = useLoadsStore((s) => s.duplicarMuro)
  const updateMuro = useLoadsStore((s) => s.updateMuro)
  const addCapa = useLoadsStore((s) => s.addCapaMuro)
  const updateCapa = useLoadsStore((s) => s.updateCapaMuro)
  const removeCapa = useLoadsStore((s) => s.removeCapaMuro)
  const moverCapa = useLoadsStore((s) => s.moverCapaMuro)
  const addAltura = useLoadsStore((s) => s.addAltura)
  const updateAltura = useLoadsStore((s) => s.updateAltura)
  const removeAltura = useLoadsStore((s) => s.removeAltura)

  const muro = muros.find((m) => m.id === muroSel) || null
  const res = useMemo(() => (muro ? resumenMuro(muro) : null), [muro])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{
        width: 248, minWidth: 248, borderRight: '1px solid var(--color-border)',
        background: 'var(--color-panel)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => addMuro(null)}>
            + En blanco
          </button>
          <MenuPlantillas
            plantillas={lib.plantillasMuro}
            onPick={(p) => { addMuro(p); onToast?.(`"${p.nombre}" copiado al proyecto`) }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
          {muros.length === 0 && (
            <div style={{ padding: '20px 10px', fontSize: 11, color: 'var(--color-tx3)', lineHeight: 1.6 }}>
              Sin muros ni pretiles capturados. Los que añadas aquí se pueden colgar del borde de un tablero.
            </div>
          )}
          {muros.map((m) => {
            const activa = m.id === muroSel
            const W = resumenMuro(m).W
            return (
              <div key={m.id} onClick={() => selectMuro(m.id)}
                style={{
                  padding: '7px 9px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                  background: activa ? 'var(--color-bg)' : 'transparent',
                  border: `1px solid ${activa ? 'var(--color-accent)' : 'transparent'}`,
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{m.nombre || 'Sin nombre'}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginTop: 2 }}>
                  {fmt(W, 1)} kg/m² · {m.alturas.length} altura(s)
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!muro && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-tx3)', fontSize: 13 }}>
            Elige un muro de la izquierda o crea uno nuevo.
          </div>
        )}

        {muro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={muro.nombre} onChange={(e) => updateMuro(muro.id, { nombre: e.target.value })}
                placeholder="Nombre del muro"
                style={{
                  flex: 1, minWidth: 260, padding: '6px 10px', fontSize: 15, fontWeight: 700,
                  border: '1px solid var(--color-border)', borderRadius: 6,
                  background: 'var(--color-bg)', color: 'var(--color-tx)', outline: 'none',
                }}
              />
              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => duplicar(muro.id)}>
                Duplicar
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}
                onClick={() => { guardarPlantillaMuro(muro); onToast?.(`"${muro.nombre}" guardado en la biblioteca`) }}>
                Guardar en biblioteca
              </button>
              <IconBtn title="Borrar el muro" tone="malo"
                onClick={() => { if (confirm(`¿Borrar "${muro.nombre}"?`)) removeMuro(muro.id) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
              </IconBtn>
            </div>

            <div>
              <SectionTitle>Componentes del muro</SectionTitle>
              <CapaTabla
                capas={muro.capas}
                materiales={lib.materiales}
                componentes={lib.componentes}
                total={res.W}
                onAdd={(modo) => addCapa(muro.id, { modo })}
                onUpdate={(cid, patch) => updateCapa(muro.id, cid, patch)}
                onRemove={(cid) => removeCapa(muro.id, cid)}
                onMover={(cid, d) => moverCapa(muro.id, cid, d)}
              />
            </div>

            <div>
              <SectionTitle right={
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => addAltura(muro.id)}>
                  + Altura
                </button>
              }>Alturas · carga por metro lineal</SectionTitle>

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-panel)' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 140px 40px', gap: 8, padding: '6px 10px',
                  background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
                  fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-tx3)',
                }}>
                  <span>Caso</span><span>Altura (m)</span><span style={{ textAlign: 'right' }}>W (kg/m)</span><span />
                </div>
                {res.alturas.length === 0 && (
                  <div style={{ padding: '14px 10px', fontSize: 11, color: 'var(--color-tx3)', textAlign: 'center' }}>
                    Añade una altura para obtener la carga por metro lineal.
                  </div>
                )}
                {res.alturas.map((a) => (
                  <div key={a.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 140px 40px', gap: 8, padding: '4px 10px',
                    alignItems: 'center', borderBottom: '1px solid var(--color-border)',
                  }}>
                    <input value={a.nombre || ''} placeholder="Pretil, muro…"
                      onChange={(e) => updateAltura(muro.id, a.id, { nombre: e.target.value })}
                      className="field-input" style={{ fontSize: 12, padding: '3px 6px' }} />
                    <input type="number" step="any" value={a.h ?? ''} placeholder="m"
                      onChange={(e) => updateAltura(muro.id, a.id, { h: e.target.value })}
                      className="field-input" style={{ fontSize: 12, padding: '3px 6px' }} />
                    <span style={{ textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {fmt(a.wML, 1)}
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <IconBtn title="Quitar la altura" tone="malo" onClick={() => removeAltura(muro.id, a.id)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
                      </IconBtn>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Stat label="Peso del muro" value={fmt(res.W, 1)} unit="kg/m²" tone="acento" />
              {res.alturas.map((a) => (
                <Stat key={a.id} label={a.nombre || 'Altura'} value={fmt(a.wML, 1)} unit="kg/m" title={`${fmt(res.W, 1)} kg/m² × ${a.h} m`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

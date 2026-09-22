import { useMemo } from 'react'
import useLoadsStore from '../store/useLoadsStore'
import { resumenLosa, cargaMuerta } from '../core/loads'
import { CARGAS_VIVAS, buscarCargaViva } from '../core/loadsCatalog'
import { guardarPlantillaLosa } from '../core/loadsLibrary'
import { CapaTabla, MenuPlantillas, Stat, SectionTitle, IconBtn, fmt } from './LoadsShared'

// ══════════════════════════════════════════════════════════════
// Losas del proyecto: una lista a la izquierda y la receta abierta a la
// derecha. Cada losa es independiente, así que dos losas del mismo tipo
// pueden llevar componentes distintos sin estorbarse.
// ══════════════════════════════════════════════════════════════

const TIPOS = [
  { id: 'azotea', etiqueta: 'Azotea' },
  { id: 'entrepiso', etiqueta: 'Entrepiso' },
  { id: 'cubierta', etiqueta: 'Cubierta' },
]

export default function LoadsSlabs({ lib, onToast }) {
  const losas = useLoadsStore((s) => s.losas)
  const losaSel = useLoadsStore((s) => s.losaSel)
  const selectLosa = useLoadsStore((s) => s.selectLosa)
  const addLosa = useLoadsStore((s) => s.addLosa)
  const removeLosa = useLoadsStore((s) => s.removeLosa)
  const duplicar = useLoadsStore((s) => s.duplicarLosa)
  const updateLosa = useLoadsStore((s) => s.updateLosa)
  const updateCV = useLoadsStore((s) => s.updateCV)
  const addCapa = useLoadsStore((s) => s.addCapa)
  const updateCapa = useLoadsStore((s) => s.updateCapa)
  const removeCapa = useLoadsStore((s) => s.removeCapa)
  const moverCapa = useLoadsStore((s) => s.moverCapa)

  const losa = losas.find((l) => l.id === losaSel) || null
  const res = useMemo(() => (losa ? resumenLosa(losa) : null), [losa])

  const guardarComoPlantilla = () => {
    if (!losa) return
    guardarPlantillaLosa(losa)
    onToast?.(`"${losa.nombre}" guardada en la biblioteca; ya la puedes usar en otros proyectos`)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Lista de losas ── */}
      <div style={{
        width: 248, minWidth: 248, borderRight: '1px solid var(--color-border)',
        background: 'var(--color-panel)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => addLosa(null)}>
            + En blanco
          </button>
          <MenuPlantillas
            plantillas={lib.plantillasLosa}
            onPick={(p) => { addLosa(p); onToast?.(`"${p.nombre}" copiada al proyecto`) }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
          {losas.length === 0 && (
            <div style={{ padding: '20px 10px', fontSize: 11, color: 'var(--color-tx3)', lineHeight: 1.6 }}>
              Todavía no hay losas en este proyecto. Parte de una plantilla del catálogo y quítale o añádele lo que haga falta.
            </div>
          )}
          {losas.map((l) => {
            const cm = cargaMuerta(l.capas).total
            const activa = l.id === losaSel
            return (
              <div key={l.id} onClick={() => selectLosa(l.id)}
                style={{
                  padding: '7px 9px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                  background: activa ? 'var(--color-bg)' : 'transparent',
                  border: `1px solid ${activa ? 'var(--color-accent)' : 'transparent'}`,
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-tx)', lineHeight: 1.3 }}>
                  {l.nombre || 'Sin nombre'}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)', marginTop: 2 }}>
                  {TIPOS.find((t) => t.id === l.tipo)?.etiqueta || l.tipo} · CM {fmt(cm, 1)} kg/m²
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Receta de la losa abierta ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!losa && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-tx3)', fontSize: 13 }}>
            Elige una losa de la izquierda o crea una nueva.
          </div>
        )}

        {losa && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080 }}>
            {/* Encabezado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={losa.nombre} onChange={(e) => updateLosa(losa.id, { nombre: e.target.value })}
                placeholder="Nombre de la losa"
                style={{
                  flex: 1, minWidth: 260, padding: '6px 10px', fontSize: 15, fontWeight: 700,
                  border: '1px solid var(--color-border)', borderRadius: 6,
                  background: 'var(--color-bg)', color: 'var(--color-tx)', outline: 'none',
                }}
              />
              <select className="field-select" style={{ width: 130 }} value={losa.tipo}
                onChange={(e) => updateLosa(losa.id, { tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
              </select>
              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}
                onClick={() => duplicar(losa.id)} title="Copia con otro nombre para probar una variante">
                Duplicar
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}
                onClick={guardarComoPlantilla} title="Guardar esta receta en la biblioteca, para otros proyectos">
                Guardar en biblioteca
              </button>
              <IconBtn title="Borrar la losa del proyecto" tone="malo"
                onClick={() => { if (confirm(`¿Borrar "${losa.nombre}"? Los tableros que la usen se quedan sin losa asignada.`)) removeLosa(losa.id) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
              </IconBtn>
            </div>

            {losa.nota && (
              <div style={{
                fontSize: 11, color: 'var(--color-tx2)', background: '#fffbeb', border: '1px solid #fcd34d',
                borderRadius: 6, padding: '7px 10px', lineHeight: 1.5,
              }}>{losa.nota}</div>
            )}

            {/* Capas */}
            <div>
              <SectionTitle>Componentes · carga muerta</SectionTitle>
              <CapaTabla
                capas={losa.capas}
                materiales={lib.materiales}
                componentes={lib.componentes}
                total={res.cm}
                onAdd={(modo) => addCapa(losa.id, { modo })}
                onUpdate={(cid, patch) => updateCapa(losa.id, cid, patch)}
                onRemove={(cid) => removeCapa(losa.id, cid)}
                onMover={(cid, d) => moverCapa(losa.id, cid, d)}
              />
            </div>

            {/* Carga viva */}
            <CargaVivaPanel losa={losa} res={res} updateCV={updateCV} />

            {/* Totales */}
            <div>
              <SectionTitle>Resumen</SectionTitle>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Stat label="Carga muerta" value={fmt(res.cm, 1)} unit="kg/m²" tone="acento" />
                <Stat label="CM + W" value={fmt(res.total.W, 1)} unit="kg/m²" title="Con la carga viva media" />
                <Stat label="CM + Wa" value={fmt(res.total.Wa, 1)} unit="kg/m²" title="Con la carga viva instantánea" />
                <Stat label="CM + Wm" value={fmt(res.total.Wm, 1)} unit="kg/m²" title="Con la carga viva máxima" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CargaVivaPanel({ losa, res, updateCV }) {
  const cv = losa.cv || {}
  const base = buscarCargaViva(cv.uso)
  const libre = !!base?.WmLibre

  return (
    <div>
      <SectionTitle>Carga viva</SectionTitle>
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-panel)', padding: 12,
        display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 240 }}>
          <label className="field-label">Destino</label>
          <select className="field-select" value={cv.uso || ''} disabled={cv.manual}
            onChange={(e) => updateCV(losa.id, { uso: e.target.value })}>
            {CARGAS_VIVAS.map((c) => <option key={c.uso} value={c.uso}>{c.uso}</option>)}
          </select>
        </div>

        {libre && !cv.manual && (
          <div style={{ width: 130 }}>
            <label className="field-label" title="Comercios, fábricas y bodegas: Wm lo fija el proyecto">Wm del proyecto</label>
            <input className="field-input" type="number" step="any" value={cv.wm ?? ''}
              placeholder={String(base.WmSugerido)}
              onChange={(e) => updateCV(losa.id, { wm: e.target.value })} />
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-tx2)', cursor: 'pointer', paddingBottom: 6 }}>
          <input type="checkbox" checked={!!cv.manual} onChange={(e) => updateCV(losa.id, { manual: e.target.checked })} />
          Capturar los tres valores a mano
        </label>

        {cv.manual && (
          <>
            <div style={{ width: 96 }}>
              <label className="field-label">W</label>
              <input className="field-input" type="number" step="any" value={cv.W ?? ''} onChange={(e) => updateCV(losa.id, { W: e.target.value })} />
            </div>
            <div style={{ width: 96 }}>
              <label className="field-label">Wa</label>
              <input className="field-input" type="number" step="any" value={cv.Wa ?? ''} onChange={(e) => updateCV(losa.id, { Wa: e.target.value })} />
            </div>
            <div style={{ width: 96 }}>
              <label className="field-label">Wm</label>
              <input className="field-input" type="number" step="any" value={cv.Wm ?? ''} onChange={(e) => updateCV(losa.id, { Wm: e.target.value })} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <Stat label="W media" value={fmt(res.cv.W, 0)} unit="kg/m²" />
          <Stat label="Wa instant." value={fmt(res.cv.Wa, 0)} unit="kg/m²" />
          <Stat label="Wm máxima" value={fmt(res.cv.Wm, 0)} unit="kg/m²" />
        </div>
      </div>
      {libre && !cv.manual && (
        <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>
          W = 0.8·Wm = {fmt(res.cv.W, 1)} · Wa = 0.9·Wm = {fmt(res.cv.Wa, 1)} kg/m²
        </div>
      )}
      {base?.nota && !cv.manual && (
        <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 5 }}>
          Observación {base.nota} de la tabla de cargas vivas.
        </div>
      )}
    </div>
  )
}

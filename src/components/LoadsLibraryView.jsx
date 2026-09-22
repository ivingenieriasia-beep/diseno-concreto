import { useRef, useState } from 'react'
import useLoadsStore from '../store/useLoadsStore'
import { cargaMuerta } from '../core/loads'
import {
  guardarMaterial, guardarComponente, borrarMaterial, borrarComponente, borrarPlantilla, restaurar,
  exportLibrary, importLibrary, resetLoadsLibrary,
} from '../core/loadsLibrary'
import { SectionTitle, IconBtn, fmt } from './LoadsShared'

// ══════════════════════════════════════════════════════════════
// Biblioteca: lo que sobrevive al proyecto. Materiales con su peso
// volumétrico, componentes de peso directo y las recetas guardadas.
// ══════════════════════════════════════════════════════════════

export default function LoadsLibraryView({ lib, onToast }) {
  const addLosa = useLoadsStore((s) => s.addLosa)
  const addMuro = useLoadsStore((s) => s.addMuro)
  const fileRef = useRef(null)

  const [mat, setMat] = useState({ nombre: '', gamma: '' })
  const [comp, setComp] = useState({ nombre: '', W: '' })

  const exportar = () => {
    const blob = new Blob([exportLibrary()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'biblioteca-cargas.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importar = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const r = new FileReader()
    r.onload = (ev) => {
      const res = importLibrary(ev.target.result, { modo: 'merge' })
      if (!res.ok) { onToast?.(res.error, 'aviso'); return }
      const c = res.contadas
      onToast?.(`Biblioteca importada · ${c.plantillasLosa} losa(s), ${c.plantillasMuro} muro(s), ${c.materiales} material(es)`)
    }
    r.readAsText(file)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importar} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1080 }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          fontSize: 11, color: 'var(--color-tx3)', lineHeight: 1.6,
        }}>
          <span style={{ flex: 1, minWidth: 300 }}>
            Todo esto se guarda en este navegador y se puede usar en cualquier proyecto.
            Al meter una plantilla en un proyecto se copia: editarla ahí no toca la plantilla.
          </span>
          <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => fileRef.current?.click()}>
            Importar .json
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={exportar}>
            Exportar .json
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => { if (confirm('¿Borrar todo lo que has añadido a la biblioteca y volver al catálogo de fábrica?')) { resetLoadsLibrary(); onToast?.('Biblioteca restablecida al catálogo de fábrica') } }}>
            Restablecer
          </button>
        </div>

        {/* Plantillas de losa */}
        <div>
          <SectionTitle>Plantillas de losa ({lib.plantillasLosa.length})</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 8 }}>
            {lib.plantillasLosa.map((p) => (
              <Tarjeta key={p.id} p={p}
                sub={`${p.capas.length} capa(s) · CM ${fmt(cargaMuerta(p.capas).total, 1)} kg/m²${p.uso ? ` · ${p.uso}` : ''}`}
                onUsar={() => { addLosa(p); onToast?.(`"${p.nombre}" copiada al proyecto`) }}
                onBorrar={() => { borrarPlantilla(p.id); onToast?.(p.origen === 'usuario' ? 'Plantilla borrada' : 'Plantilla de fábrica oculta') }} />
            ))}
          </div>
        </div>

        {/* Plantillas de muro */}
        <div>
          <SectionTitle>Plantillas de muro ({lib.plantillasMuro.length})</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 8 }}>
            {lib.plantillasMuro.map((p) => (
              <Tarjeta key={p.id} p={p}
                sub={`${p.capas.length} capa(s) · ${fmt(cargaMuerta(p.capas).total, 1)} kg/m²`}
                onUsar={() => { addMuro(p); onToast?.(`"${p.nombre}" copiado al proyecto`) }}
                onBorrar={() => { borrarPlantilla(p.id); onToast?.(p.origen === 'usuario' ? 'Plantilla borrada' : 'Plantilla de fábrica oculta') }} />
            ))}
          </div>
        </div>

        {/* Ocultas */}
        {lib.ocultas.length > 0 && (
          <div>
            <SectionTitle>Ocultas ({lib.ocultas.length})</SectionTitle>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lib.ocultas.map((id) => (
                <button key={id} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 9px' }}
                  onClick={() => restaurar(id)} title="Volver a mostrarla">
                  {id} ↺
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Materiales y componentes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div>
            <SectionTitle>Materiales · peso volumétrico</SectionTitle>
            <ListaSimple
              items={lib.materiales.map((m) => ({ clave: m.nombre, nombre: m.nombre, valor: `${fmt(m.gamma, 0)} kg/m³`, origen: m.origen }))}
              onBorrar={(nombre) => { borrarMaterial(nombre); onToast?.('Material quitado de la lista') }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input className="field-input" placeholder="Material" value={mat.nombre} style={{ fontSize: 12 }}
                onChange={(e) => setMat({ ...mat, nombre: e.target.value })} />
              <input className="field-input" type="number" step="any" placeholder="kg/m³" value={mat.gamma} style={{ width: 110, fontSize: 12 }}
                onChange={(e) => setMat({ ...mat, gamma: e.target.value })} />
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => {
                  if (!guardarMaterial(mat)) { onToast?.('Ponle nombre al material', 'aviso'); return }
                  onToast?.(`"${mat.nombre}" guardado`)
                  setMat({ nombre: '', gamma: '' })
                }}>Añadir</button>
            </div>
          </div>

          <div>
            <SectionTitle>Componentes · peso directo</SectionTitle>
            <ListaSimple
              items={lib.componentes.map((c) => ({ clave: c.nombre, nombre: c.nombre, valor: `${fmt(c.W, 2)} kg/m²`, origen: c.origen }))}
              onBorrar={(nombre) => { borrarComponente(nombre); onToast?.('Componente quitado de la lista') }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input className="field-input" placeholder="Componente" value={comp.nombre} style={{ fontSize: 12 }}
                onChange={(e) => setComp({ ...comp, nombre: e.target.value })} />
              <input className="field-input" type="number" step="any" placeholder="kg/m²" value={comp.W} style={{ width: 110, fontSize: 12 }}
                onChange={(e) => setComp({ ...comp, W: e.target.value })} />
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => {
                  if (!guardarComponente(comp)) { onToast?.('Ponle nombre al componente', 'aviso'); return }
                  onToast?.(`"${comp.nombre}" guardado`)
                  setComp({ nombre: '', W: '' })
                }}>Añadir</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Tarjeta({ p, sub, onUsar, onBorrar }) {
  return (
    <div style={{
      border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 11px',
      background: 'var(--color-panel)', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, flex: 1 }}>{p.nombre}</span>
        {p.origen === 'usuario' && (
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', background: 'var(--color-accent)', color: '#fff', padding: '1px 5px', borderRadius: 99 }}>tuya</span>
        )}
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>{sub}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
        <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 9px' }} onClick={onUsar}>Usar en el proyecto</button>
        <span style={{ marginLeft: 'auto' }}>
          <IconBtn title={p.origen === 'usuario' ? 'Borrar de la biblioteca' : 'Ocultar del catálogo'} tone="malo" onClick={onBorrar}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </IconBtn>
        </span>
      </div>
    </div>
  )
}

function ListaSimple({ items, onBorrar }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-panel)', maxHeight: 250, overflowY: 'auto' }}>
      {items.map((it) => (
        <div key={it.clave} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px',
          borderBottom: '1px solid var(--color-border)', fontSize: 12,
        }}>
          <span style={{ flex: 1 }}>{it.nombre}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-tx2)' }}>{it.valor}</span>
          {it.origen === 'usuario' && (
            <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', background: 'var(--color-accent)', color: '#fff', padding: '1px 5px', borderRadius: 99 }}>tuyo</span>
          )}
          <IconBtn title="Quitar de la lista" tone="malo" onClick={() => onBorrar(it.clave)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </IconBtn>
        </div>
      ))}
    </div>
  )
}

import useCimStore from '../../store/useCimStore'
import { Num, Sel, Check } from './campos'
import { nuevoAsent, DISTORSIONES } from '../../core/cim/asentamientos'

// Los datos de los asentamientos (3.12). Los captura el ingeniero del estudio
// de mecánica de suelos y de su criterio: ninguno tiene valor de fábrica. Se
// usan en «Suelo y criterios» y en el apartado «Asentamientos» (es el mismo
// dato, del proyecto).

const txt = { padding: '4px 6px', fontSize: 12.5, width: '100%' }

export default function AsentDatos({ compacto = false }) {
  const guardado = useCimStore((s) => s.asent)
  const setAsent = useCimStore((s) => s.setAsent)
  const cimientos = useCimStore((s) => s.cimientos)
  const a = { ...nuevoAsent(), ...(guardado || {}) }
  const corridas = cimientos.filter((z) => z.tipo === 'corrida')
  const set = (patch) => setAsent(patch)
  const setEst = (i, patch) => set({ estratos: a.estratos.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  const setZona = (i, patch) => set({ zonas: a.zonas.map((z, j) => (j === i ? { ...z, ...patch } : z)) })
  const nuevoId = (pre, lista) => { for (let i = 1; ; i++) if (!lista.some((x) => x.id === `${pre}${i}`)) return `${pre}${i}` }
  const opEst = a.estratos.map((e) => ({ v: e.id, t: e.nombre || e.id }))
  const el = a.modelo === 'elastico', wk = a.modelo === 'winkler'

  return (
    <div className="cim-asent-datos" data-testid="asent-datos">
      <p className="cim-nota">Del estudio de mecánica de suelos y del criterio del ingeniero. Nada tiene valor de fábrica: sin datos no se calcula.</p>
      <Sel label="Modelo del suelo" value={a.modelo} testid="asent-modelo" onChange={(v) => set({ modelo: v })}
        opciones={[{ v: '', t: 'elige…' }, { v: 'elastico', t: 'elástico: semiespacio (E, ν)' }, { v: 'winkler', t: 'Winkler: módulo de reacción (ks)' }]} />

      <div className="cim-etq" style={{ marginTop: 8 }}>Estratos</div>
      {a.estratos.map((e, i) => (
        <div key={e.id} className="cim-grid cim-grid3" data-testid={`asent-estrato-${e.id}`} style={{ alignItems: 'end' }}>
          <label className="cim-campo"><span className="cim-etq">Nombre</span>
            <input className="field-input" style={txt} value={e.nombre} onChange={(ev) => setEst(i, { nombre: ev.target.value })} /></label>
          {(el || !wk) && <Num label="E" unit="t/m²" step={100} value={e.E} apagado={!el} testid={`asent-E-${e.id}`} onChange={(v) => setEst(i, { E: v })} />}
          {(el || !wk) && <Num label="ν" step={0.05} min={0} max={0.49} value={e.nu} apagado={!el} testid={`asent-nu-${e.id}`} onChange={(v) => setEst(i, { nu: v })} />}
          {(wk || !el) && <Num label="ks" unit="t/m³" step={100} value={e.ks} apagado={!wk} testid={`asent-ks-${e.id}`} onChange={(v) => setEst(i, { ks: v })} />}
          {a.estratos.length > 1 && <button className="cim-mini" title="Quitar este estrato" onClick={() => set({ estratos: a.estratos.filter((_, j) => j !== i), zonas: a.zonas.filter((z) => z.estrato !== e.id), base: a.base === e.id ? a.estratos.find((x) => x.id !== e.id).id : a.base })}>✕</button>}
        </div>
      ))}
      <button className="cim-mini" data-testid="asent-mas-estrato" onClick={() => { const id = nuevoId('E', a.estratos); set({ estratos: [...a.estratos, { id, nombre: `Estrato ${a.estratos.length + 1}`, E: '', nu: '', ks: '' }] }) }}>＋ estrato</button>
      <Sel label="Toda la obra sobre" value={a.base} testid="asent-base" onChange={(v) => set({ base: v })} opciones={opEst} />

      <div className="cim-etq" style={{ marginTop: 8 }}>Zonas o tramos sobre otro estrato</div>
      {a.zonas.map((z, i) => (
        <div key={z.id} className="cim-grid cim-grid3" data-testid={`asent-zona-${z.id}`} style={{ alignItems: 'end' }}>
          <label className="cim-campo"><span className="cim-etq">{z.tipo === 'rect' ? 'Zona' : 'Tramo de eje'}</span>
            <input className="field-input" style={txt} value={z.nombre} onChange={(ev) => setZona(i, { nombre: ev.target.value })} /></label>
          <Sel label="Sobre" value={z.estrato} onChange={(v) => setZona(i, { estrato: v })} opciones={[{ v: '', t: 'elige…' }, ...opEst]} />
          {z.tipo === 'rect' ? <>
            <Num label="x desde" unit="m" step={0.25} value={z.x0} onChange={(v) => setZona(i, { x0: v })} />
            <Num label="x hasta" unit="m" step={0.25} value={z.x1} onChange={(v) => setZona(i, { x1: v })} />
            <Num label="y desde" unit="m" step={0.25} value={z.y0} onChange={(v) => setZona(i, { y0: v })} />
            <Num label="y hasta" unit="m" step={0.25} value={z.y1} onChange={(v) => setZona(i, { y1: v })} />
          </> : <>
            <Sel label="Corrida" value={z.cim || ''} onChange={(v) => setZona(i, { cim: v, eje: 0 })} opciones={[{ v: '', t: 'elige…' }, ...corridas.map((c) => ({ v: c.uid, t: c.nombre }))]} />
            <Sel label="Eje" value={String(z.eje ?? 0)} onChange={(v) => setZona(i, { eje: Number(v) })}
              opciones={(() => { const c = corridas.find((x) => x.uid === z.cim); return [{ v: '0', t: '1 (el del diseño)' }, ...((c?.ejes || []).map((e, k) => ({ v: String(k + 1), t: `${k + 2} (nudos ${(e.nudos || []).join(', ')})` })))] })()} />
          </>}
          <button className="cim-mini" title="Quitar" onClick={() => set({ zonas: a.zonas.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <span style={{ display: 'flex', gap: 6 }}>
        <button className="cim-mini" data-testid="asent-mas-zona" onClick={() => set({ zonas: [...a.zonas, { id: nuevoId('Z', a.zonas), nombre: `Zona ${a.zonas.length + 1}`, tipo: 'rect', estrato: '', x0: '', x1: '', y0: '', y1: '' }] })}>＋ zona (rectángulo en planta)</button>
        <button className="cim-mini" data-testid="asent-mas-tramo" onClick={() => set({ zonas: [...a.zonas, { id: nuevoId('Z', a.zonas), nombre: `Tramo ${a.zonas.length + 1}`, tipo: 'eje', estrato: '', cim: '', eje: 0 }] })}>＋ tramo de eje</button>
      </span>
      {!compacto && <p className="cim-nota">Las coordenadas son las de la planta del modelo de RAM (m), las mismas de «Desde RAM».</p>}

      <div className="cim-grid cim-grid3" style={{ marginTop: 8 }}>
        <Num label="Asentamiento medio permisible" unit="mm" step={5} value={a.limMedio} testid="asent-limMedio" titulo="NTC-Cimentaciones 2023, tabla 3.1.1.2.2.3" onChange={(v) => set({ limMedio: v })} />
        <label className="cim-campo"><span className="cim-etq">Zona y caso (para la memoria)</span>
          <input className="field-input" style={txt} value={a.limMedioNota} data-testid="asent-limMedioNota" placeholder="p. ej. zona I, colindante" onChange={(ev) => set({ limMedioNota: ev.target.value })} /></label>
      </div>
      <span className="cim-nota">Tabla 3.1.1.2.2.3, zona I:{' '}
        <button className="cim-mini" onClick={() => set({ limMedio: 50, limMedioNota: 'zona I, construcción aislada' })}>aislada 50 mm</button>{' '}
        <button className="cim-mini" onClick={() => set({ limMedio: 25, limMedioNota: 'zona I, colindante' })}>colindante 25 mm</button>
        {' '}· otra zona: captura su valor.</span>

      <label className="cim-campo" style={{ marginTop: 8 }}>
        <span className="cim-etq">Distorsión permisible (NTC-Criterios y Acciones 2023, tabla 6.2.2.1)</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DISTORSIONES.map((d) => <button key={d} className={`cim-mini ${Number(a.limDist) === d ? 'on' : ''}`} data-testid={`asent-dist-${d}`} onClick={() => set({ limDist: d })}>{d}</button>)}
        </span>
      </label>

      <Sel label="Carga de cada franja (servicio: CM + CV media)" value={a.carga} testid="asent-carga" onChange={(v) => set({ carga: v })}
        opciones={[{ v: '', t: 'elige…' }, { v: 'w', t: 'la w del diseño, pareja en todo el eje' }, { v: 'apoyos', t: 'las reacciones de los apoyos, cada una en su tributario' }, { v: 'suma', t: 'las dos sumadas (w del muro + reacciones)' }]} />
      {a.carga && a.carga !== 'apoyos' && corridas.length > 0 && (
        <div className="cim-grid cim-grid3">
          {corridas.map((z) => <Num key={z.uid} label={`${z.nombre}: w CV media`} unit="t/m" step={0.05} value={a.wCVmed?.[z.uid] ?? ''} testid={`asent-wCVmed-${z.nombre}`} onChange={(v) => set({ wCVmed: { ...(a.wCVmed || {}), [z.uid]: v } })} />)}
        </div>
      )}
      <Check label="Usar la CV máxima donde falte la media (del lado seguro)" value={!!a.cvMaxSiFalta} testid="asent-cvMax" onChange={(v) => set({ cvMaxSiFalta: v })} />
      {a.carga && a.carga !== 'w' && <p className="cim-nota">La CV media de los apoyos sale del caso de RAM con el papel «viva media (asentamientos)» (en «Desde RAM»).</p>}

      <div className="cim-grid cim-grid3" style={{ marginTop: 6 }}>
        <Num label="Inercia agrietada Ie/Ig" step={0.05} min={0.05} max={1} value={a.fInercia} testid="asent-fInercia" titulo="De la CT y las ligas, para M = 6 EI Δ / L²" onChange={(v) => set({ fInercia: v })} />
        <Num label="Factor de carga del hundimiento" step={0.1} min={0.1} value={a.fcAsent} testid="asent-fcAsent" titulo="Multiplica el M y el V inducidos" onChange={(v) => set({ fcAsent: v })} />
      </div>
    </div>
  )
}

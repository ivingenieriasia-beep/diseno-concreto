import { useState } from 'react'
import { Num, Bloque, Check } from './campos'
import { SUELO, CRITERIOS, f2 } from '../../core/cim/comun'
import { meyerhof } from '../../core/cim/suelo'
import { CAMPO_SUELO } from './CimForm'

// El suelo de la obra (del estudio de mecánica de suelos) y los criterios de
// diseño, compartidos por todos los cimientos. Con la hoja «Capacidad Suelo»
// para sacar qadm de c, φ y γ cuando el estudio no la da.

const CRIT = [
  { k: 'fcm', t: 'Factor CM', paso: 0.1 },
  { k: 'fcv', t: 'Factor CV', paso: 0.1 },
  { k: 'facc', t: 'Factor accidental', paso: 0.1, titulo: '1.1 (CM + CV + S)' },
  { k: 'kS', t: 'qadm con sismo ×', paso: 0.01, titulo: 'Incremento de la capacidad con cargas accidentales; confírmalo con el estudio' },
  { k: 'fcEmpuje', t: 'Factor del empuje', paso: 0.1 },
  { k: 'fsVolteo', t: 'FS volteo', paso: 0.1 },
  { k: 'fsDesl', t: 'FS deslizamiento', paso: 0.1 },
  { k: 'hMin', t: 'Peralte mínimo', u: 'cm', paso: 5 },
  { k: 'Bmin', t: 'Ancho mínimo', u: 'm', paso: 0.05 },
  { k: 'DfMin', t: 'Desplante mínimo', u: 'm', paso: 0.05, titulo: 'Df de los cimientos y enterrado de los muros' },
  { k: 'sMin', t: 'Separación mínima', u: 'cm', paso: 2.5 },
  { k: 'sMax', t: 'Separación máxima', u: 'cm', paso: 2.5 },
  { k: 'plantilla', t: 'Plantilla', u: 'cm', paso: 1 },
]

export default function CimObra({ suelo, criterios, setSuelo, setCriterios, onClose }) {
  const S = { ...SUELO, ...suelo }
  const C = { ...CRITERIOS, ...criterios }
  const [my, setMy] = useState({ c: S.c || 0, phi: S.phiB ?? 28, gs: S.gs, Df: S.Df, B: 1.5, L: 1.5, beta: 0, FS: 3, e: 0 })
  const r = meyerhof(my)
  return (
    <div className="cim-modal-fondo" onClick={onClose}>
      <div className="cim-modal" onClick={(e) => e.stopPropagation()} data-testid="cim-obra">
        <header>
          <b>Suelo y criterios de la obra</b>
          <span>Valen para todos los cimientos; cada uno puede cambiar su suelo en su formulario.</span>
          <button className="cim-mini" onClick={onClose}>cerrar ✕</button>
        </header>
        <div className="cim-modal-cuerpo">
          <Bloque titulo="Suelo (estudio de mecánica de suelos)">
            <div className="cim-grid cim-grid3">
              {Object.keys(CAMPO_SUELO).map((k) => (
                <Num key={k} label={CAMPO_SUELO[k].t} unit={CAMPO_SUELO[k].u} step={CAMPO_SUELO[k].paso} titulo={CAMPO_SUELO[k].titulo || ''}
                  min={k === 'Df' ? Number(C.DfMin) || 0.6 : null} value={S[k] ?? ''} placeholder={k === 'gsB' ? 'igual que γ' : ''} testid={`obra-${k}`}
                  onChange={(v) => setSuelo({ [k]: v })} />
              ))}
            </div>
          </Bloque>
          <Bloque titulo="Capacidad de carga (Meyerhof)" abierto={false} testid="obra-meyerhof">
            <p className="cim-nota">Si el estudio no trae qadm: la hoja «Capacidad Suelo», con los factores de forma, profundidad e inclinación y B′ = B − 2e con excentricidad.</p>
            <div className="cim-grid cim-grid3">
              <Num label="c" value={my.c} unit="t/m²" step={0.1} onChange={(v) => setMy({ ...my, c: v })} />
              <Num label="φ" value={my.phi} unit="°" step={1} onChange={(v) => setMy({ ...my, phi: v })} />
              <Num label="γ" value={my.gs} unit="t/m³" step={0.05} onChange={(v) => setMy({ ...my, gs: v })} />
              <Num label="Df" value={my.Df} unit="m" onChange={(v) => setMy({ ...my, Df: v })} />
              <Num label="B" value={my.B} unit="m" onChange={(v) => setMy({ ...my, B: v })} />
              <Num label="L" value={my.L} unit="m" onChange={(v) => setMy({ ...my, L: v })} />
              <Num label="Inclinación β" value={my.beta} unit="°" step={1} onChange={(v) => setMy({ ...my, beta: v })} />
              <Num label="Excentricidad e" value={my.e} unit="m" step={0.05} onChange={(v) => setMy({ ...my, e: v })} />
              <Num label="FS" value={my.FS} step={0.5} onChange={(v) => setMy({ ...my, FS: v })} />
            </div>
            <table className="cim-mini-tabla">
              <tbody>
                {r.pasos.map((p, i) => (
                  <tr key={i}><td>{p.t}</td><td>{p.f}</td><td>{p.n}</td><td>{typeof p.v === 'number' ? `${f2(p.v)} ${p.u}` : ''}</td></tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-primary" data-testid="obra-usar-qadm" onClick={() => setSuelo({ qadm: Math.round(r.qadm * 100) / 100 })}>
              Usar qadm = {f2(r.qadm)} t/m² en la obra
            </button>
          </Bloque>
          <Bloque titulo="Criterios de diseño">
            <div className="cim-grid cim-grid3">
              {CRIT.map((c) => (
                <Num key={c.k} label={c.t} unit={c.u || ''} step={c.paso} titulo={c.titulo || ''} value={C[c.k]} testid={`obra-${c.k}`}
                  onChange={(v) => setCriterios({ [c.k]: v })} />
              ))}
            </div>
            <Check label="Contratrabes de liga con lado ≥ claro libre / 20 (ACI 18.13.3.3, alta sismicidad); si no, la mínima es la CT-1 (15 × 30)"
              value={!!C.ligaAci} onChange={(v) => setCriterios({ ligaAci: v })} testid="obra-ligaAci" />
            <label className="cim-campo" style={{ marginTop: 6 }}>
              <span className="cim-etq">Calibres que se prueban al proponer</span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[3, 4, 5, 6, 8].map((n) => {
                  const on = C.calibres.includes(n)
                  return (
                    <button key={n} className={`cim-mini ${on ? 'on' : ''}`} onClick={() => {
                      const cal = on ? C.calibres.filter((x) => x !== n) : [...C.calibres, n].sort((a, b) => a - b)
                      if (cal.length) setCriterios({ calibres: cal })
                    }}>#{n}</button>
                  )
                })}
              </span>
            </label>
            <button className="cim-mini" style={{ marginTop: 8 }} onClick={() => setCriterios(Object.fromEntries(Object.keys(criterios).map((k) => [k, CRITERIOS[k]])))}>valores de fábrica</button>
          </Bloque>
        </div>
      </div>
    </div>
  )
}

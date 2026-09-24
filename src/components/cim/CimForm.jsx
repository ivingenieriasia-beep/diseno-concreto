import { Num, Sel, Check, Bloque, Varilla } from './campos'
import { SUELO } from '../../core/cim/comun'
import { centrarResultante } from '../../core/cim/contratrabe'
import { MAMPOSTERIA } from '../../core/cim/gravedad'

// Formulario del cimiento seleccionado. Cada cambio va directo al store (y
// de ahí a la revisión y al dibujo), igual que las secciones de trabes.

const POSICIONES = [
  { v: 'centro|centro', t: 'Al centro (céntrica)' },
  { v: 'min|centro', t: 'Lindero izquierdo' },
  { v: 'max|centro', t: 'Lindero derecho' },
  { v: 'centro|min', t: 'Lindero de abajo' },
  { v: 'centro|max', t: 'Lindero de arriba' },
  { v: 'min|min', t: 'Esquina ↙' },
  { v: 'max|min', t: 'Esquina ↘' },
  { v: 'min|max', t: 'Esquina ↖' },
  { v: 'max|max', t: 'Esquina ↗' },
]

/** Qué datos de suelo pide cada tipo */
const SUELO_DE = {
  aislada: ['qadm', 'gs', 'Df'],
  corrida: ['qadm', 'gs', 'Df'],
  contratrabe: ['qadm', 'gs', 'Df'],
  contencion: ['qadm', 'gs', 'phi', 'phiB', 'c', 'gsB'],
  gravedad: ['qadm', 'gs', 'phi', 'phiB', 'c', 'mu', 'gsB'],
  mamposteria: ['qadm', 'gs', 'Df', 'phi', 'mu'],
}
export const CAMPO_SUELO = {
  qadm: { t: 'qadm', u: 't/m²', paso: 0.5, titulo: 'Capacidad admisible del estudio' },
  gs: { t: 'γ suelo / relleno', u: 't/m³', paso: 0.05 },
  Df: { t: 'Desplante Df', u: 'm', paso: 0.05 },
  phi: { t: 'φ relleno', u: '°', paso: 1, titulo: 'Fricción interna del relleno (empujes)' },
  phiB: { t: 'φ suelo de apoyo', u: '°', paso: 1, titulo: 'Fricción del suelo bajo la base (deslizamiento y pasivo)' },
  c: { t: 'c suelo de apoyo', u: 't/m²', paso: 0.1 },
  gsB: { t: 'γ suelo de apoyo', u: 't/m³', paso: 0.05, titulo: 'Vacío = el mismo γ del relleno' },
  mu: { t: 'μ base-suelo', u: '', paso: 0.05, titulo: 'Coeficiente de fricción para el deslizamiento' },
}

function Cargas({ z, set, campos }) {
  const casos = [
    { k: 'CM', t: 'CM', titulo: 'Carga muerta (servicio)' },
    { k: 'CV', t: 'CV', titulo: 'Carga viva máxima (servicio)' },
    { k: 'S', t: 'S', titulo: 'Sismo (opcional): se combina 1.1 (CM + CV + S) y la capacidad sube × kS' },
  ]
  return (
    <div className="cim-tabla" data-testid="cim-cargas">
      <div className="cim-fila cim-cab">
        <span />
        {campos.map((c) => <span key={c.k} title={c.titulo}>{c.t}</span>)}
      </div>
      {casos.map((cs) => (
        <div className="cim-fila" key={cs.k}>
          <span title={cs.titulo} className="cim-caso">{cs.t}</span>
          {campos.map((c) => (
            <Num key={c.k} value={z.cargas?.[cs.k]?.[c.k] ?? 0} step={c.paso ?? 0.1}
              testid={`cim-carga-${cs.k}-${c.k}`}
              onChange={(v) => set({ cargas: { ...z.cargas, [cs.k]: { ...(z.cargas?.[cs.k] || {}), [c.k]: v } } })} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function CimForm({ z, set, obra, onProponer, onDuplicar, onBorrar }) {
  const g = z.geo
  const G = (patch) => set({ geo: { ...g, ...patch } })
  const A = (k, v) => set({ arm: { ...z.arm, [k]: v } })
  const S = z.suelo || {}
  const sueloObra = { ...SUELO, ...(obra.suelo || {}) }
  const esMamp = z.tipo === 'gravedad' || z.tipo === 'mamposteria'
  const M = { ...(esMamp ? MAMPOSTERIA : {}), ...(z.mat || {}) }
  const Mt = (k, v) => set({ mat: { ...M, [k]: v } })

  return (
    <div className="cim-form" data-testid="cim-form">
      <div className="cim-acciones">
        <input className="field-input" value={z.nombre} data-testid="cim-nombre" onChange={(e) => set({ nombre: e.target.value })} style={{ fontWeight: 700, width: 110 }} />
        <button className="btn btn-primary" data-testid="cim-proponer" onClick={onProponer} title="Dimensiona y arma con las cargas y el suelo capturados">⚡ Proponer</button>
        <button className="btn btn-secondary" onClick={onDuplicar} title="Duplicar" style={{ padding: '6px 9px' }}>⧉</button>
        <button className="btn btn-secondary" data-testid="cim-borrar" onClick={onBorrar} title="Borrar" style={{ padding: '6px 9px', color: '#c62828' }}>✕</button>
      </div>
      {z.origen?.ram && (
        <div className="cim-origen" data-testid="cim-origen">
          Desde RAM: {z.origen.ram.resumen}
        </div>
      )}

      {z.tipo === 'aislada' && <>
        <Bloque titulo="Geometría" testid="cim-geo">
          <div className="cim-grid">
            <Num label="B (en x)" value={g.B} onChange={(v) => G({ B: v, ...(g.cuadrada ? { L: v } : {}) })} unit="m" min={0.3} testid="cim-B" />
            <Num label="L (en y)" value={g.cuadrada ? g.B : g.L} onChange={(v) => G({ L: v })} unit="m" min={0.3} disabled={g.cuadrada} testid="cim-L" />
            <Num label="Peralte h" value={g.h} onChange={(v) => G({ h: v })} unit="cm" step={5} min={10} testid="cim-h" />
            <Check label="cuadrada" value={g.cuadrada} onChange={(v) => G({ cuadrada: v, L: g.B })} testid="cim-cuadrada" />
            <Num label="Columna c1 (x)" value={g.c1} onChange={(v) => G({ c1: v })} unit="cm" step={5} min={15} />
            <Num label="Columna c2 (y)" value={g.c2} onChange={(v) => G({ c2: v })} unit="cm" step={5} min={15} />
          </div>
          <Sel label="Posición de la columna" value={g.px === 'libre' || g.py === 'libre' ? 'libre' : `${g.px}|${g.py}`} testid="cim-pos"
            onChange={(v) => { if (v === 'libre') return; const [px, py] = v.split('|'); G({ px, py }) }}
            opciones={[...POSICIONES, ...(g.px === 'libre' || g.py === 'libre' ? [{ v: 'libre', t: 'Corrida a mano (arrastrada)' }] : [])]} />
          {(g.px !== 'centro' || g.py !== 'centro') && (
            <Check label="con trabe de liga (toma la excentricidad N·e)" value={g.liga} onChange={(v) => G({ liga: v })} testid="cim-liga"
              titulo="La liga (o viga de equilibrio) lleva el momento de la excentricidad a la zapata vecina: el suelo trabaja parejo" />
          )}
        </Bloque>
        <Bloque titulo="Cargas en la columna (servicio)">
          <Cargas z={z} set={set} campos={[{ k: 'P', t: 'P (t)' }, { k: 'Mx', t: 'Mx (t·m)', titulo: 'Momento alrededor de x: corre la resultante en y' }, { k: 'My', t: 'My (t·m)', titulo: 'Momento alrededor de y: corre la resultante en x' }]} />
        </Bloque>
      </>}

      {z.tipo === 'corrida' && <>
        <Bloque titulo="Geometría (por metro)" testid="cim-geo">
          <div className="cim-grid">
            <Num label="Ancho B" value={g.B} onChange={(v) => G({ B: v })} unit="m" min={0.3} testid="cim-B" />
            <Num label="Peralte h" value={g.h} onChange={(v) => G({ h: v })} unit="cm" step={5} min={10} testid="cim-h" />
            <Num label="Muro t" value={g.t} onChange={(v) => G({ t: v })} unit="cm" step={1} min={10} />
            <Num label="Largo (planos)" value={g.Lz} onChange={(v) => G({ Lz: v })} unit="m" step={0.5} min={1} />
          </div>
          <Sel label="Muro" value={g.muro} onChange={(v) => G({ muro: v })} opciones={[{ v: 'mamposteria', t: 'de mampostería (flexión a t/4 dentro)' }, { v: 'concreto', t: 'de concreto (flexión en la cara)' }]} />
          <Sel label="Posición" value={g.pos} onChange={(v) => G({ pos: v })} testid="cim-pos" opciones={[{ v: 'centro', t: 'Muro al centro' }, { v: 'lindero', t: 'Muro de lindero' }]} />
          {g.pos === 'lindero' && <Check label="dala y muros perpendiculares toman la excentricidad" value={g.liga} onChange={(v) => G({ liga: v })} testid="cim-liga" />}
        </Bloque>
        <Bloque titulo="Cargas del muro (servicio, por metro)">
          <Cargas z={z} set={set} campos={[{ k: 'w', t: 'w (t/m)' }, { k: 'M', t: 'M (t·m/m)' }]} />
        </Bloque>
      </>}

      {z.tipo === 'contratrabe' && <>
        <Bloque titulo="Geometría" testid="cim-geo">
          <div className="cim-grid">
            <Num label="Largo L" value={g.L} onChange={(v) => G({ L: v })} unit="m" step={0.05} min={1} testid="cim-L" />
            <Num label="Ancho B" value={g.B} onChange={(v) => G({ B: v })} unit="m" min={0.3} testid="cim-B" />
            <Num label="Losa h" value={g.h} onChange={(v) => G({ h: v })} unit="cm" step={5} min={10} testid="cim-h" />
            <Num label="Alma bw" value={g.bw} onChange={(v) => G({ bw: v })} unit="cm" step={5} min={15} />
            <Num label="Peralte H" value={g.H} onChange={(v) => G({ H: v })} unit="cm" step={5} min={30} testid="cim-Hct" />
          </div>
        </Bloque>
        <Bloque titulo={`Columnas (${(z.columnas || []).length})`} extra={<>
          <button className="cim-mini" onClick={() => {
            const cs = z.columnas || []
            const x = cs.length ? Math.min(num(g.L), Math.max(...cs.map((c) => +c.x)) + 3) : 0.3
            set({ columnas: [...cs, { x, c: 30, cb: 30, CM: { P: 15, M: 0 }, CV: { P: 5, M: 0 }, S: { P: 0, M: 0 } }], geo: { ...g, L: Math.max(num(g.L), x + 0.3) } })
          }}>＋ columna</button>
          <button className="cim-mini" data-testid="cim-centrar" title="Ajusta los voladizos para que la resultante caiga al centro" onClick={() => { const c = centrarResultante(z); if (c) set(c) }}>centrar resultante</button>
        </>}>
          {(z.columnas || []).map((c, i) => {
            const C = (patch) => set({ columnas: z.columnas.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
            const K = (caso, k, v) => C({ [caso]: { ...(c[caso] || {}), [k]: v } })
            return (
              <div key={i} className="cim-col" data-testid={`cim-col-${i}`}>
                <div className="cim-col-cab">
                  <b>C{i + 1}</b>
                  <Num value={c.x} onChange={(v) => C({ x: v })} unit="m" step={0.05} min={0} ancho={96} titulo="Posición desde el extremo izquierdo" />
                  <Num value={c.c} onChange={(v) => C({ c: v })} unit="cm" step={5} min={15} ancho={80} titulo="Ancho de la columna a lo largo" />
                  <button className="cim-mini" onClick={() => set({ columnas: z.columnas.filter((_, j) => j !== i) })} title="Quitar">✕</button>
                </div>
                <div className="cim-col-cargas">
                  {['CM', 'CV', 'S'].map((cs) => (
                    <div key={cs}>
                      <span className="cim-caso">{cs}</span>
                      <Num value={c[cs]?.P ?? 0} onChange={(v) => K(cs, 'P', v)} unit="t" step={0.5} ancho={78} />
                      <Num value={c[cs]?.M ?? 0} onChange={(v) => K(cs, 'M', v)} unit="t·m" step={0.1} ancho={84} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </Bloque>
      </>}

      {z.tipo === 'contencion' && <>
        <Bloque titulo="Geometría" testid="cim-geo">
          <div className="cim-grid">
            <Num label="Altura total H" value={g.H} onChange={(v) => G({ H: v })} unit="m" step={0.1} min={0.8} testid="cim-Hm" />
            <Num label="Base hz" value={g.hz} onChange={(v) => G({ hz: v })} unit="m" min={0.2} />
            <Num label="Pantalla arriba tc" value={g.tc} onChange={(v) => G({ tc: v })} unit="m" min={0.15} />
            <Num label="Pantalla abajo tb" value={g.tb} onChange={(v) => G({ tb: v })} unit="m" min={0.15} />
            <Num label="Punta" value={g.punta} onChange={(v) => G({ punta: v })} unit="m" min={0} />
            <Num label="Talón" value={g.talon} onChange={(v) => G({ talon: v })} unit="m" min={0.2} />
            <Num label="Dentellón hk" value={g.hk} onChange={(v) => G({ hk: v })} unit="m" step={0.1} min={0} />
            <Num label="Dentellón bk" value={g.bk} onChange={(v) => G({ bk: v })} unit="m" min={0.2} />
            <Num label="Suelo frente Df" value={g.Df} onChange={(v) => G({ Df: v })} unit="m" min={0} titulo="Tierra frente a la punta, desde el fondo de la base" />
            <Num label="Largo (planos)" value={g.Lz} onChange={(v) => G({ Lz: v })} unit="m" step={0.5} min={1} />
          </div>
        </Bloque>
        <Bloque titulo="Relleno">
          <div className="cim-grid">
            <Num label="Talud β" value={g.beta} onChange={(v) => G({ beta: v })} unit="°" step={1} min={0} max={40} />
            <Num label="Sobrecarga q" value={g.q} onChange={(v) => G({ q: v })} unit="t/m²" step={0.25} min={0} />
          </div>
          <Check label="considerar el empuje pasivo frente a la punta" value={g.pasivo !== false} onChange={(v) => G({ pasivo: v })} />
        </Bloque>
      </>}

      {z.tipo === 'gravedad' && <>
        <Bloque titulo="Geometría" testid="cim-geo">
          <div className="cim-grid">
            <Num label="Altura H" value={g.H} onChange={(v) => G({ H: v })} unit="m" step={0.1} min={0.5} testid="cim-Hm" />
            <Num label="Corona c" value={g.c} onChange={(v) => G({ c: v })} unit="m" min={0.3} />
            <Num label="Base B" value={g.B} onChange={(v) => G({ B: v })} unit="m" min={0.4} testid="cim-B" />
            <Num label="Talud del frente" value={g.m1} onChange={(v) => G({ m1: v })} unit="m" min={0} titulo="Proyección horizontal del paramento del frente" />
            <Num label="Suelo frente Df" value={g.Df} onChange={(v) => G({ Df: v })} unit="m" min={0} />
            <Num label="Largo (planos)" value={g.Lz} onChange={(v) => G({ Lz: v })} unit="m" step={0.5} min={1} />
          </div>
        </Bloque>
        <Bloque titulo="Relleno">
          <div className="cim-grid">
            <Num label="Talud β" value={g.beta} onChange={(v) => G({ beta: v })} unit="°" step={1} min={0} max={40} />
            <Num label="Sobrecarga q" value={g.q} onChange={(v) => G({ q: v })} unit="t/m²" step={0.25} min={0} />
          </div>
          <Check label="considerar el empuje pasivo" value={!!g.pasivo} onChange={(v) => G({ pasivo: v })} />
        </Bloque>
      </>}

      {z.tipo === 'mamposteria' && <>
        <Bloque titulo="Geometría" testid="cim-geo">
          <Sel label="Tipo" value={g.pos} onChange={(v) => G({ pos: v })} testid="cim-pos" opciones={[{ v: 'interior', t: 'Interior (trapecio simétrico)' }, { v: 'lindero', t: 'De lindero (medio trapecio)' }]} />
          <div className="cim-grid">
            <Num label="Base B" value={g.B} onChange={(v) => G({ B: v, autoB: false })} unit="m" min={0.3} testid="cim-B" />
            <Check label="B automática" value={g.autoB} onChange={(v) => G({ autoB: v })} testid="cim-autoB" />
            <Num label="Altura H" value={g.H} onChange={(v) => G({ H: v, autoH: false })} unit="m" min={0.3} />
            <Check label="H automática" value={g.autoH} onChange={(v) => G({ autoH: v })} />
            <Num label="Corona c" value={g.c} onChange={(v) => G({ c: v })} unit="m" min={0.2} />
            <Num label="Muro t" value={g.t} onChange={(v) => G({ t: v })} unit="m" step={0.01} min={0.1} />
            <Num label="B mínima" value={g.Bmin} onChange={(v) => G({ Bmin: v })} unit="m" min={0.3} />
            <Num label="Factor de carga" value={g.FC} onChange={(v) => G({ FC: v })} step={0.1} min={1} />
            {g.pos === 'lindero' && <Num label="Desnivel retenido" value={g.Hrell} onChange={(v) => G({ Hrell: v })} unit="m" step={0.1} min={0} />}
            {g.pos === 'lindero' && <Num label="Perpendiculares a" value={g.Lreal} onChange={(v) => G({ Lreal: v })} unit="m" step={0.5} min={0.5} titulo="Separación real entre cimientos perpendiculares" />}
            <Num label="Largo (cantidades)" value={g.Lz} onChange={(v) => G({ Lz: v })} unit="m" step={0.5} min={1} />
          </div>
        </Bloque>
        <Bloque titulo="Carga del muro (servicio, por metro)">
          <div className="cim-grid">
            <Num label="CM" value={z.cargas?.CM?.w ?? 0} onChange={(v) => set({ cargas: { ...z.cargas, CM: { w: v } } })} unit="t/m" step={0.1} testid="cim-carga-CM-w" />
            <Num label="CV" value={z.cargas?.CV?.w ?? 0} onChange={(v) => set({ cargas: { ...z.cargas, CV: { w: v } } })} unit="t/m" step={0.1} />
          </div>
        </Bloque>
      </>}

      <Bloque titulo="Suelo" abierto={false} testid="cim-suelo">
        <div className="cim-grid">
          {(SUELO_DE[z.tipo] || []).map((k) => {
            const C = CAMPO_SUELO[k]
            const propio = S[k] != null && S[k] !== ''
            return (
              <Num key={k} label={C.t} unit={C.u} step={C.paso} titulo={C.titulo || ''}
                value={propio ? S[k] : (sueloObra[k] ?? '')} placeholder={sueloObra[k] == null ? 'igual' : ''}
                propio={propio} onReset={() => { const n = { ...S }; delete n[k]; set({ suelo: n }) }}
                onChange={(v) => set({ suelo: { ...S, [k]: v } })} testid={`cim-suelo-${k}`} />
            )
          })}
        </div>
        <p className="cim-nota">Lo que no cambies aquí sale de «Suelo y criterios» de la obra.</p>
      </Bloque>

      <Bloque titulo="Materiales" abierto={false}>
        {esMamp ? (
          <div className="cim-grid">
            <Num label="γ mampostería" value={M.gm} onChange={(v) => Mt('gm', v)} unit="t/m³" step={0.05} />
            <Num label="f*m" value={M.fm} onChange={(v) => Mt('fm', v)} unit="kg/cm²" step={1} titulo="Resistencia de diseño a compresión (incluye FR)" />
            <Num label="v*m" value={M.vm} onChange={(v) => Mt('vm', v)} unit="kg/cm²" step={0.05} titulo="Resistencia de diseño a cortante (incluye FR)" />
          </div>
        ) : (
          <div className="cim-grid">
            <Num label="f′c" value={z.mat?.fc} onChange={(v) => set({ mat: { ...z.mat, fc: v } })} unit="kg/cm²" step={50} min={150} />
            <Num label="fy" value={z.mat?.fy} onChange={(v) => set({ mat: { ...z.mat, fy: v } })} unit="kg/cm²" step={200} />
            <Num label="Recubrimiento" value={z.mat?.r} onChange={(v) => set({ mat: { ...z.mat, r: v } })} unit="cm" step={0.5} min={2} />
          </div>
        )}
      </Bloque>

      {z.arm && (
        <Bloque titulo="Armado" testid="cim-armado">
          {z.tipo === 'aislada' && <>
            <Varilla label="Varillas en x (corren a lo largo de B)" arm={z.arm.x} onChange={(v) => A('x', v)} testid="cim-arm-x" />
            <Varilla label="Varillas en y (corren a lo largo de L)" arm={z.arm.y} onChange={(v) => A('y', v)} testid="cim-arm-y" />
          </>}
          {z.tipo === 'corrida' && <>
            <Varilla label="Transversal (por metro)" arm={z.arm.t} onChange={(v) => A('t', v)} testid="cim-arm-t" />
            <Varilla label="Longitudinal" arm={z.arm.l} onChange={(v) => A('l', v)} testid="cim-arm-l" />
          </>}
          {z.tipo === 'contratrabe' && <>
            <Varilla label="Contratrabe: abajo" arm={z.arm.inf} onChange={(v) => A('inf', v)} conN testid="cim-arm-inf" />
            <Varilla label="Contratrabe: arriba" arm={z.arm.sup} onChange={(v) => A('sup', v)} conN testid="cim-arm-sup" />
            <Varilla label="Estribos" arm={z.arm.est} onChange={(v) => A('est', v)} conRamas />
            <Varilla label="Aleros (por metro)" arm={z.arm.alero} onChange={(v) => A('alero', v)} />
            <Varilla label="Losa longitudinal" arm={z.arm.long} onChange={(v) => A('long', v)} />
          </>}
          {z.tipo === 'contencion' && <>
            <Varilla label="Pantalla, cara del relleno (corridas)" arm={z.arm.pv} onChange={(v) => set({ arm: { ...z.arm, pv: v, ...(z.arm.bast?.on ? { bast: { ...z.arm.bast, s: v.s } } : {}) } })} testid="cim-arm-pv" />
            <Varilla label="Bastones intercalados" arm={z.arm.bast} onChange={(v) => A('bast', { ...v, s: z.arm.pv.s })} conOn testid="cim-arm-bast" />
            <Varilla label="Pantalla, cara exterior" arm={z.arm.pe} onChange={(v) => A('pe', v)} />
            <Varilla label="Horizontales (cada cara)" arm={z.arm.ph} onChange={(v) => A('ph', v)} />
            <Varilla label="Talón, arriba" arm={z.arm.ts} onChange={(v) => A('ts', v)} />
            <Varilla label="Base, abajo" arm={z.arm.pi} onChange={(v) => A('pi', v)} />
            <Varilla label="Base, longitudinales" arm={z.arm.pl} onChange={(v) => A('pl', v)} />
          </>}
        </Bloque>
      )}
    </div>
  )
}

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

import { useMemo } from 'react'
import { desgloseMetodoGeneral } from '../core/desgloseGeneral'

/**
 * «Método general (5.4.1.1): punto que gobierna» en la pestaña Cálculo (Excel).
 * Pedido del Ing. Fernando Burgos (2026-11-13). Solo presentación: el D/C que
 * gobierna es el del motor; aquí se desglosa el eje neutro exacto sobre el
 * rayo de demanda, barra por barra.
 */

const fmt = (v, d = 4) => (v === null || v === undefined || isNaN(v) ? '—' : !isFinite(v) ? '∞' : Number(v).toFixed(d))
const TH = { padding: '4px 8px', border: '1px solid var(--color-border)', background: '#1a2040', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'left' }
const TD = { padding: '3px 8px', border: '1px solid var(--color-border)', fontSize: 11, fontFamily: 'var(--font-mono)' }
const ACENTO = '#5b3fa0'

function Bloque({ titulo, children }) {
  return (
    <div style={{ marginBottom: 12, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', background: ACENTO, color: '#fff', fontSize: 12, fontWeight: 700 }}>{titulo}</div>
      <div style={{ padding: '8px 12px', background: 'var(--color-panel)', fontFamily: 'var(--font-mono)', fontSize: 11, display: 'grid', gap: 3 }}>
        {children}
      </div>
    </div>
  )
}

export default function MetodoGeneralExcel({ col, an, caso }) {
  const d = useMemo(() => (an && caso?.bi ? desgloseMetodoGeneral(col, an, caso.bi) : null), [col, an, caso])

  const encabezado = (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ACENTO, margin: '18px 0 8px' }}>
      Método general (5.4.1.1): punto que gobierna
    </div>
  )
  if (!caso?.bi) {
    return <div data-testid="excel-general">{encabezado}<div style={{ fontSize: 11, color: 'var(--color-tx3)' }}>Sin demanda: captura un punto o carga la envolvente.</div></div>
  }
  if (!d?.ok) {
    return (
      <div data-testid="excel-general">{encabezado}
        <div style={{ fontSize: 11, color: '#c62828' }}>No hay desglose: {d?.motivo}. D/C del motor = {fmt(d?.dc, 3)}.</div>
      </div>
    )
  }
  const em = [d.eminX && `Mux sube a Pu·ex,mín = ${fmt(d.MuxD, 4)} t·m (ex,mín = ${fmt(d.exMin * 100, 2)} cm)`,
    d.eminY && `Muy sube a Pu·ey,mín = ${fmt(d.MuyD, 4)} t·m (ey,mín = ${fmt(d.eyMin * 100, 2)} cm)`].filter(Boolean)
  const A = d.aproximado

  return (
    <div data-testid="excel-general" style={{ fontSize: 12 }}>
      {encabezado}
      <div style={{ fontSize: 11, color: 'var(--color-tx3)', marginBottom: 8 }}>
        Caso: {caso.etiqueta}. El D/C que gobierna es el de la app (la superficie de diseño); el desglose es el eje neutro
        exacto sobre el rayo de la demanda, con las mismas hipótesis de 3.6.
      </div>

      <Bloque titulo="1 · Demanda y rayo">
        <span>Pu = {fmt(d.Pu, 4)} t · Mux = {fmt(d.Mux, 4)} t·m · Muy = {fmt(d.Muy, 4)} t·m</span>
        {em.map((t) => <span key={t}>5.3.2.1: {t}</span>)}
        <span>Mu = √(Mux² + Muy²) = {fmt(d.Mu, 4)} t·m · θ = atan(Muy / Mux) = {fmt(d.thetaGrados, 2)}°</span>
      </Bloque>

      <Bloque titulo="2 · Eje neutro que da la capacidad sobre el rayo">
        <span>Dirección de compresión φ = {fmt(d.phiGrados, 3)}° · eje neutro a {fmt(d.ejeNeutroGrados, 3)}° del eje x</span>
        <span>c = {fmt(d.c, 4)} cm (perpendicular al eje neutro, desde la esquina más comprimida) · peralte en esa dirección D = {fmt(d.D, 3)} cm</span>
        <span>a = β1·c = {fmt(d.seccion.b1, 3)} × {fmt(d.c, 4)} = {fmt(d.a, 4)} cm{d.a >= d.D - 1e-9 ? ' (tope: toda la sección)' : ''}</span>
        <span>Zona comprimida: A = {fmt(d.bloque.A, 3)} cm² · centroide u = {fmt(d.bloque.uc, 3)} cm, v = {fmt(d.bloque.vc, 3)} cm</span>
        <span>Cc = 0.85·f'c·A = 0.85 × {d.seccion.fc} × {fmt(d.bloque.A, 3)} / 1000 = {fmt(d.bloque.Cc, 4)} t</span>
      </Bloque>

      <div style={{ marginBottom: 12, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '6px 12px', background: ACENTO, color: '#fff', fontSize: 12, fontWeight: 700 }}>3 · Fuerzas por barra (cada barra tiene su ε)</div>
        <div style={{ padding: '6px 10px', background: 'var(--color-panel)', overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Barra', 'u (cm)', 'v (cm)', 'd (cm)', 'ε', 'f (kg/cm²)', 'F (t)', 'brazo x = v (cm)', 'brazo y = −u (cm)', 'F·v → Mx (t·m)', '−F·u → My (t·m)'].map((t) => <th key={t} style={TH}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.barras.map((b) => (
                <tr key={b.n}>
                  <td style={TD}>{b.n} (#{b.num})</td>
                  <td style={TD}>{fmt(b.u, 2)}</td>
                  <td style={TD}>{fmt(b.v, 2)}</td>
                  <td style={TD}>{fmt(b.d, 3)}</td>
                  <td style={TD}>{fmt(b.eps, 6)}</td>
                  <td style={TD}>{fmt(b.f, 2)}{b.fluye ? ' (fy)' : ''}</td>
                  <td style={TD}>{fmt(b.F, 4)}</td>
                  <td style={TD}>{fmt(b.zx, 2)}</td>
                  <td style={TD}>{fmt(b.zy, 2)}</td>
                  <td style={TD}>{fmt(b.Mx, 5)}</td>
                  <td style={TD}>{fmt(b.My, 5)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...TD, fontWeight: 700 }} colSpan={6}>Cc (concreto)</td>
                <td style={TD}>{fmt(d.bloque.Cc, 4)}</td>
                <td style={TD}>{fmt(d.bloque.zx, 3)}</td>
                <td style={TD}>{fmt(d.bloque.zy, 3)}</td>
                <td style={TD}>{fmt(d.bloque.Mx, 5)}</td>
                <td style={TD}>{fmt(d.bloque.My, 5)}</td>
              </tr>
              <tr>
                <td style={{ ...TD, fontWeight: 700 }} colSpan={6}>Σ (nominal)</td>
                <td style={{ ...TD, fontWeight: 700 }}>Pn = {fmt(d.Pn, 4)}</td>
                <td style={TD} colSpan={2} />
                <td style={{ ...TD, fontWeight: 700 }}>Mxn = {fmt(d.Mxn, 5)}</td>
                <td style={{ ...TD, fontWeight: 700 }}>Myn = {fmt(d.Myn, 5)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
            u desde el centro hacia la derecha (ancho b); v desde el centro hacia la cara superior (lecho 1). ε &gt; 0 compresión.
            d: distancia de la barra a la fibra más comprimida, perpendicular al eje neutro. Mx &gt; 0 comprime la cara superior;
            My &gt; 0 comprime la cara izquierda.
          </div>
        </div>
      </div>

      <Bloque titulo="4 · Resistencia de diseño (3.8.2.2)">
        <span>εt = εc·(dt − c)/c = {fmt(d.epsT, 5)} (dt = {fmt(d.dt, 3)} cm, barra más alejada) · εty = {fmt(d.seccion.epsY, 5)}</span>
        <span>Clasificación: {d.clase} · tabla 3.8.2.2 inciso {d.inciso}{d.inciso === '3.8.2.3' ? ' (topado por refuerzo asimétrico)' : ''} · FR = {fmt(d.FR, 4)}</span>
        <span>3.8.2.6 (FR de compresión en la transición): {d.transicionComoCompresion ? 'activa' : 'no activa'}{d.zunchos ? ' · zunchos (14.7.4)' : ''}</span>
        <span>P = FR·Pn = {fmt(d.P, 4)} t (= Pu) · MRx = FR·Mxn = {fmt(d.MRx, 5)} t·m · MRy = FR·Myn = {fmt(d.MRy, 5)} t·m</span>
      </Bloque>

      <Bloque titulo="5 · Sobre el rayo: D/C = Mu / MR (OA / OB)">
        <span>OB, estado exacto: MR = √(MRx² + MRy²) = {fmt(d.MRexacto, 5)} t·m</span>
        <span>OB, app (superficie de diseño, interpolada): MR = {fmt(d.MRmotor, 5)} t·m · diferencia {fmt(100 * d.diferencia, 3)} %</span>
        <span>OA: Mu = {fmt(d.Mu, 5)} t·m</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-accent2)' }}>
          D/C = {fmt(d.Mu, 5)} / {fmt(d.MRmotor, 5)} = {fmt(d.dc, 3)} (gobierna, el de la app)
        </span>
        <span>Con el estado exacto: D/C = {fmt(d.dcExacto, 3)}</span>
      </Bloque>

      {A && (
        <Bloque titulo={`Referencia: 5.4.1.2 (no decide) · ec. ${A.ecuacion}`}>
          <span>PRx = {fmt(A.PRx, 3)} t · PRy = {fmt(A.PRy, 3)} t · PR0 = {fmt(A.PR0, 3)} t · PR = {fmt(A.PR, 3)} t · PR/PR0 = {fmt(A.relacionPR, 3)}</span>
          <span>MRx = {fmt(A.MRx, 4)} t·m · MRy = {fmt(A.MRy, 4)} t·m (diagramas 2D de diseño)</span>
          <span>D/C 5.4.1.2 = {fmt(A.dc, 3)} (referencia)</span>
        </Bloque>
      )}
    </div>
  )
}

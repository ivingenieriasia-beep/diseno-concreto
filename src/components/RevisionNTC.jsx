import { useMemo } from 'react'
import { datosNTC } from '../core/columnCalculator'
import { contornosEnP, ETIQUETA_EC, METODO_GENERAL } from '../core/columnasNTC'

/**
 * Revisión de flexocompresión de la NTC-Concreto 2023, para revisarla a ojo:
 * la tabla con cada método (uniaxiales, método general 5.4.1.1 y 5.4.1.2),
 * con su FR, εt y clase, cuál gobierna y de qué ecuación sale, y el contorno
 * de momentos de diseño al nivel de Pu con el punto de demanda.
 *
 * @param an     analyzeColumn(col)
 * @param bi     la revisión del caso que se muestra (checkBiaxial)
 * @param titulo de qué caso es (punto capturado o ejemplar crítico)
 */
export default function RevisionNTC({ an, bi, titulo }) {
  if (!an || !bi) return null
  return (
    <div data-testid="revision-ntc" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 16 }}>
      <TablaNTC an={an} bi={bi} titulo={titulo} />
      <ContornoMxMy an={an} bi={bi} />
    </div>
  )
}

const f = (v, n = 3) => (v == null ? '—' : !isFinite(v) ? '∞' : Number(v).toFixed(n))
const colorDC = (dc) => (!(dc <= 1) ? '#c62828' : dc > 0.9 ? '#b45309' : '#15803d')
const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }
const TH = { padding: '5px 8px', background: '#1a2040', color: '#fff', fontSize: 10, textAlign: 'left' }

function FRtexto({ p }) {
  if (!p) return <span style={{ color: 'var(--color-tx3)' }}>—</span>
  return <span>FR {f(p.FR)} · εt {p.epsT == null ? '—' : p.epsT.toFixed(5)} · {p.clase}</span>
}

function TablaNTC({ an, bi, titulo }) {
  const g = bi.general, a = bi.aproximado
  const filas = [
    {
      k: 'x', metodo: 'Uniaxial X (P–Mx, diagrama de diseño)', detalle: <>MRx = {f(bi.checkX.MR)} t·m · <FRtexto p={bi.checkX.punto} /></>,
      dc: bi.checkX.ratio, nota: '',
    },
    {
      k: 'y', metodo: 'Uniaxial Y (P–My, diagrama de diseño)', detalle: <>MRy = {f(bi.checkY.MR)} t·m · <FRtexto p={bi.checkY.punto} /></>,
      dc: bi.checkY.ratio, nota: '',
    },
    {
      k: 'g', metodo: `a) ${METODO_GENERAL}`,
      detalle: <>θ = {f(g.thetaGrados, 1)}° · MR(θ) = {f(g.MR)} t·m · <FRtexto p={g.punto} /> · D/C = √(Mux²+Muy²)/MR(θ){g.vertices ? ` · ${g.vertices} ángulos sin cruce (lado seguro)` : ''}</>,
      dc: g.dc, gobierna: bi.gobierna === 'general',
    },
    {
      k: 'a', metodo: `b) ${ETIQUETA_EC[a.ecuacion]}`,
      detalle: a.ecuacion === '5.4.1.2.a'
        ? <>PRx = {f(a.PRx, 2)} · PRy = {f(a.PRy, 2)} · PR0 = {f(a.PR0, 2)} → PR = {f(a.PR, 2)} t (PR/PR0 = {f(a.relacionPR)}) · D/C = Pu/PR</>
        : <>PR/PR0 = {a.relacionPR == null ? 'sin compresión' : `${f(a.relacionPR)} < 0.1`} · {f(bi.MuxD)}/{f(a.MRx)} + {f(bi.MuyD)}/{f(a.MRy)}</>,
      dc: a.dc, gobierna: bi.gobierna === 'aproximado',
    },
  ]
  return (
    <div style={{ flex: '1 1 520px', maxWidth: 760 }}>
      <div className="section-title">Revisión NTC-Concreto 2023 — {titulo}</div>
      <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', margin: '4px 0 6px', fontFamily: 'var(--font-mono)' }}>
        Pu = {f(bi.Pu, 2)} t · Mux = {f(bi.MuxD)} · Muy = {f(bi.MuyD)} t·m
        {(bi.eminX || bi.eminY) && <> · con excentricidad mínima 5.3.2 en {[bi.eminX && 'X', bi.eminY && 'Y'].filter(Boolean).join(' y ')} (capturado: {f(bi.Mux)} / {f(bi.Muy)})</>}
        {' '}· PR0 = FR·P0 = {f(an.ntc.PR0, 2)} t (FR {f(an.ntc.FRc, 2)}{an.ntc.fr.zunchos ? ', zunchos' : ''})
        {an.ntc.asimetrico && ' · refuerzo asimétrico: FR topado según 3.8.2.3'}
        {an.ntc.fr.transicionComoCompresion && ' · 3.8.2.6: FR de compresión en la transición'}
      </div>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <thead><tr>{['Método', 'Detalle', 'D/C', ''].map((t) => <th key={t} style={TH}>{t}</th>)}</tr></thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.k} data-testid={`ntc-fila-${r.k}`} style={{ background: r.gobierna ? '#fff8e1' : undefined }}>
                <td style={{ ...TD, fontWeight: 700, maxWidth: 220 }}>{r.metodo}</td>
                <td style={TD}>{r.detalle}</td>
                <td style={{ ...TD, fontWeight: 800, color: colorDC(r.dc) }}>{f(r.dc)}</td>
                <td style={{ ...TD, fontWeight: 800 }}>{r.gobierna ? 'GOBIERNA' : ''}</td>
              </tr>
            ))}
            <tr data-testid="ntc-fila-dc">
              <td style={{ ...TD, fontWeight: 800 }}>D/C de la columna</td>
              <td style={TD}>el mayor de a) y b): {bi.gobiernaEcuacion}</td>
              <td style={{ ...TD, fontWeight: 900, color: colorDC(bi.dc) }}>{f(bi.dc)}</td>
              <td style={{ ...TD, fontWeight: 800, color: bi.ok ? '#15803d' : '#c62828' }}>{bi.ok ? '✓ pasa' : '✗ no pasa'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--color-tx3)', lineHeight: 1.5 }}>
        Resistencias de diseño = FR × nominal; FR de la tabla 3.8.2.2 según εt del acero extremo a tensión
        (≤ εty compresión 0.65, transición 0.65 + 0.25(εt − εty)/0.003, ≥ εty + 0.003 tensión 0.90; εty = fy/Es).
        No se revisan esbeltez ni cortante.
      </div>
    </div>
  )
}

/** Contorno Mx–My de diseño al nivel de Pu, con el punto de demanda */
function ContornoMxMy({ an, bi, size = 330 }) {
  const C = useMemo(() => contornosEnP(datosNTC(an), bi.Pu), [an, bi.Pu])
  const PAD = 44
  const all = [...C.general, ...C.aprox]
  const Mmax = Math.max(...all.map((p) => Math.max(p.Mx, p.My)), bi.MuxD, bi.MuyD, 0.01) * 1.12
  const sc = (size - PAD - 14) / Mmax
  const X = (m) => PAD + m * sc
  const Y = (m) => size - PAD + 14 - m * sc - 14
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.Mx).toFixed(1)},${Y(p.My).toFixed(1)}`).join(' ')
  const ok = bi.ok
  const col = ok ? '#15803d' : '#dc2626'
  const g = bi.general
  const nice = (v) => Number(v.toPrecision(2))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => nice(Mmax * t))
  return (
    <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Contorno de diseño Mx–My a P = {f(bi.Pu, 2)} t</div>
      <svg width={size} height={size} data-testid="contorno-mxmy" style={{ fontFamily: 'var(--font-mono)', display: 'block' }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={X(t)} y1={Y(0)} x2={X(t)} y2={Y(Mmax)} stroke="#f2f0ea" />
            <line x1={X(0)} y1={Y(t)} x2={X(Mmax)} y2={Y(t)} stroke="#f2f0ea" />
            <text x={X(t)} y={Y(0) + 13} fontSize="9" fill="#8a8580" textAnchor="middle">{t}</text>
            <text x={X(0) - 5} y={Y(t) + 3} fontSize="9" fill="#8a8580" textAnchor="end">{t}</text>
          </g>
        ))}
        <line x1={X(0)} y1={Y(0)} x2={X(Mmax)} y2={Y(0)} stroke="#b8b2a6" />
        <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(Mmax)} stroke="#b8b2a6" />
        <text x={X(Mmax)} y={Y(0) + 26} fontSize="10" fill="#2563a8" textAnchor="end" fontWeight="700">Mx (t·m)</text>
        <text x={8} y={Y(Mmax) - 4} fontSize="10" fill="#c94f2a" fontWeight="700">My (t·m)</text>
        {/* 5.4.1.2 */}
        <path d={path(C.aprox)} fill="none" stroke="#7c3aed" strokeWidth="1.6" strokeDasharray="6,3" />
        {/* método general */}
        <path d={`${path(C.general)} L${X(0)},${Y(0)} Z`} fill="#2563a8" fillOpacity="0.07" stroke="#2563a8" strokeWidth="2" />
        {/* rayo de la demanda hasta MR(θ) */}
        {g.MR > 0 && <line x1={X(0)} y1={Y(0)} x2={X(g.MRx)} y2={Y(g.MRy)} stroke={col} strokeWidth="1" strokeDasharray="3,2" opacity="0.7" />}
        {g.MR > 0 && <circle cx={X(g.MRx)} cy={Y(g.MRy)} r="3" fill="#fff" stroke="#2563a8" strokeWidth="1.5" />}
        <circle cx={X(bi.MuxD)} cy={Y(bi.MuyD)} r="5" fill={col} stroke="#fff" strokeWidth="1.5" />
        <text x={X(bi.MuxD) + 8} y={Y(bi.MuyD) - 6} fontSize="10" fontWeight="700" fill="#1a1814">(Mux, Muy)</text>
      </svg>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)', lineHeight: 1.6 }}>
        <div><span style={{ color: '#2563a8', fontWeight: 800 }}>━</span> método general (eje neutro inclinado) · D/C {f(g.dc)}</div>
        <div><span style={{ color: '#7c3aed', fontWeight: 800 }}>╍</span> ec. {C.ecuacion} · D/C {f(bi.aproximado.dc)}</div>      </div>
    </div>
  )
}

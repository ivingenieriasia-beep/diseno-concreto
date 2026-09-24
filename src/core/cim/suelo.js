// ══════════════════════════════════════════════════════════════
// Capacidad de carga del suelo — Meyerhof (hoja «Capacidad Suelo»)
//
//   qu = c Nc Fcs Fcd Fci + q Nq Fqs Fqd Fqi + ½ γ B′ Nγ Fγs Fγd Fγi
//   qadm = qu / FS
//
// Factores de capacidad (Vesic para Nγ), de forma (De Beer), de profundidad
// (Hansen) y de inclinación (Meyerhof), como en Das. Correcciones sobre la
// hoja: para Df/B > 1 el factor de profundidad usa tan⁻¹(Df/B) en radianes (la
// hoja ponía la cotangente) y, con excentricidad, el término de γ usa el ancho
// efectivo B′ = B − 2e (la hoja dejaba B). Unidades: t, m.
// ══════════════════════════════════════════════════════════════

import { paso, f2, f3 } from './comun'

const rad = (g) => (g * Math.PI) / 180

export function meyerhof({ c = 0, phi = 30, gs = 1.6, Df = 1, B = 1, L = 1, beta = 0, FS = 3, e = 0 }) {
  const tf = Math.tan(rad(phi))
  const Nq = Math.tan(rad(45 + phi / 2)) ** 2 * Math.exp(Math.PI * tf)
  const Nc = phi > 0 ? (Nq - 1) / tf : 5.14
  const Ng = 2 * (Nq + 1) * tf
  const Bp = Math.max(0, B - 2 * Math.abs(e))
  const Lp = Math.max(L, Bp)          // el ancho efectivo nunca pasa del largo
  const BL = Lp > 0 ? Bp / Lp : 1
  const Fcs = 1 + BL * (Nq / Nc)
  const Fqs = 1 + BL * tf
  const Fgs = Math.max(0, 1 - 0.4 * BL)
  const k = Df / B <= 1 ? Df / B : Math.atan(Df / B)
  const Fqd = phi > 0 ? 1 + 2 * tf * (1 - Math.sin(rad(phi))) ** 2 * k : 1
  const Fcd = phi > 0 ? Fqd - (1 - Fqd) / (Nc * tf) : 1 + 0.4 * k
  const Fgd = 1
  const Fci = (1 - beta / 90) ** 2
  const Fqi = Fci
  const Fgi = phi > 0 ? Math.max(0, 1 - beta / phi) ** 2 : 1
  const q = gs * Df
  const tc = c * Nc * Fcs * Fcd * Fci
  const tq = q * Nq * Fqs * Fqd * Fqi
  const tg = 0.5 * gs * Bp * Ng * Fgs * Fgd * Fgi
  const qu = tc + tq + tg
  const qadm = qu / FS
  const Ap = Bp * L
  const pasos = [
    paso('Factores de capacidad', 'Nq = tan²(45 + φ/2) e^(π tan φ)', `φ = ${phi}°`, Nq, ''),
    paso('', 'Nc = (Nq − 1) cot φ', '', Nc, ''),
    paso('', 'Nγ = 2 (Nq + 1) tan φ', '', Ng, ''),
    paso('Forma', 'Fcs = 1 + (B′/L)(Nq/Nc) · Fqs = 1 + (B′/L) tan φ · Fγs = 1 − 0.4 B′/L', `${f3(Fcs)} · ${f3(Fqs)} · ${f3(Fgs)}`, '', ''),
    paso('Profundidad', Df / B <= 1 ? 'Fqd = 1 + 2 tan φ (1 − sen φ)² Df/B' : 'Fqd = 1 + 2 tan φ (1 − sen φ)² tan⁻¹(Df/B)', `Fcd = ${f3(Fcd)} · Fqd = ${f3(Fqd)} · Fγd = 1`, '', ''),
    paso('Inclinación', 'Fci = Fqi = (1 − β/90)² · Fγi = (1 − β/φ)²', `${f3(Fci)} · ${f3(Fgi)}`, '', ''),
    paso('Sobrecarga al desplante', 'q = γ Df', `= ${f2(gs)} × ${f2(Df)}`, q, 't/m²'),
    paso('Capacidad última', 'qu = c Nc Fcs Fcd Fci + q Nq Fqs Fqd Fqi + ½ γ B′ Nγ Fγs Fγd Fγi', `= ${f2(tc)} + ${f2(tq)} + ${f2(tg)}`, qu, 't/m²'),
    paso('Capacidad admisible', 'qadm = qu / FS', `= ${f2(qu)} / ${FS}`, qadm, 't/m²'),
  ]
  if (e) pasos.splice(6, 0, paso('Ancho efectivo', 'B′ = B − 2e', `= ${f2(B)} − 2 × ${f3(e)}`, Bp, 'm'))
  return { Nq, Nc, Ng, Fcs, Fqs, Fgs, Fcd, Fqd, Fgd, Fci, Fqi, Fgi, q, qu, qadm, Bp, Ap, Qult: qu * Ap, Qadm: (qu * Ap) / FS, pasos }
}

/** Coeficientes de empuje de Rankine; con relleno inclinado β el activo es el general */
export function rankine(phi, beta = 0) {
  const f = rad(phi), b = rad(beta)
  let Ka
  if (beta > 0) {
    const cb = Math.cos(b), cf = Math.cos(f)
    const r = Math.sqrt(Math.max(0, cb * cb - cf * cf))
    Ka = (cb * (cb - r)) / (cb + r)
  } else Ka = Math.tan(rad(45 - phi / 2)) ** 2
  const Kp = Math.tan(rad(45 + phi / 2)) ** 2
  return { Ka, Kp }
}

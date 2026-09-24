// ══════════════════════════════════════════════════════════════
// Muro de contención de mampostería de piedra (por gravedad)
//
// Sección trapecial: base B, corona c, paramento del frente con proyección m1
// y el del relleno con m2 = B − c − m1. El relleno empuja (Rankine) sobre el
// plano vertical que pasa por el talón; la cuña de tierra sobre el paramento
// inclinado cuenta como peso. La piedra no resiste tensión, así que además de
// volteo, deslizamiento y presiones en la base, en cada junta (a cada cuarto de
// la altura) la resultante tiene que caer en el tercio medio y los esfuerzos
// quedar dentro de f*m y v*m (que ya incluyen FR). Por metro de muro.
// ══════════════════════════════════════════════════════════════

import { CRITERIOS, SUELO, paso, check, f1, f2, f3, arriba, num } from './comun'
import { rankine } from './suelo'

export const MAMPOSTERIA = { gm: 2.2, fm: 20, vm: 0.6 }     // t/m³ · kg/cm² · kg/cm² (con FR)

export function nuevaGravedad(nombre = 'MM-1') {
  return {
    tipo: 'gravedad', nombre,
    geo: { H: 2.0, c: 0.4, B: 1.2, m1: 0, Df: 0.5, beta: 0, q: 0, pasivo: false, Lz: 10 },
    mat: { ...MAMPOSTERIA }, suelo: {},
  }
}

const rad = (g) => (g * Math.PI) / 180

/** Área y centroide (x) de un polígono */
function poligono(P) {
  let A = 0, cx = 0, cy = 0
  for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]
    const k = x1 * y2 - x2 * y1
    A += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k
  }
  A /= 2
  return Math.abs(A) < 1e-12 ? { A: 0, x: 0, y: 0 } : { A: Math.abs(A), x: cx / (6 * A), y: cy / (6 * A) }
}

/**
 * Fuerzas sobre la parte del muro por encima de la junta a la altura y.
 * Momentos respecto a la orilla del frente de esa junta.
 */
function sobreJunta(G, y) {
  const { H, c, B, m1, m2, gm, gs, Ka, beta, q } = G
  const xf = (m1 * y) / H, xb = B - (m2 * y) / H, w = xb - xf
  const mas = poligono([[xf, y], [xb, y], [m1 + c, H], [m1, H]])
  const cun = poligono([[xb, y], [xb, H], [m1 + c, H]])
  const tb = Math.tan(rad(beta))
  const run = xb - (m1 + c)
  const talud = poligono([[m1 + c, H], [xb, H], [xb, H + run * tb]])
  const hp = H - y + run * tb
  const cb = Math.cos(rad(beta)), sb = Math.sin(rad(beta))
  const Pa = 0.5 * gs * Ka * hp * hp, Pq = Ka * q * hp
  const Wm = gm * mas.A, Ws = gs * (cun.A + talud.A)
  const xs = cun.A + talud.A > 0 ? (cun.A * cun.x + talud.A * talud.x) / (cun.A + talud.A) : xb
  const N = Wm + Ws + (Pa + Pq) * sb
  const Mr = Wm * (mas.x - xf) + Ws * (xs - xf) + (Pa + Pq) * sb * w
  const Mv = Pa * cb * (hp / 3) + Pq * cb * (hp / 2)
  const Hh = (Pa + Pq) * cb
  return { y, xf, xb, w, Wm, Ws, xm: mas.x, xs, Pa, Pq, hp, N, Mr, Mv, Hh }
}

export function revisarGravedad(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const S = { ...SUELO, ...(obra.suelo || {}), ...(z.suelo || {}) }
  const g = z.geo, M = { ...MAMPOSTERIA, ...(z.mat || {}) }
  const H = num(g.H, 2), c = num(g.c, 0.4), B = Math.max(num(g.B, 1.2), c), m1 = Math.max(0, Math.min(num(g.m1, 0), B - c))
  const m2 = Math.max(0, B - c - m1)
  const beta = Math.max(0, Math.min(num(g.beta, 0), num(S.phi) - 1)), q = Math.max(0, num(g.q, 0))
  const gs = num(S.gs, 1.6), gm = num(M.gm, 2.2), fm = num(M.fm, 20), vm = num(M.vm, 0.6)
  const { Ka } = rankine(num(S.phi, 30), beta)
  const Kp = rankine(num(S.phiB ?? S.phi, 30)).Kp
  const G = { H, c, B, m1, m2, gm, gs, Ka, beta, q }
  const checks = [], secciones = [], avisos = []
  if (num(g.B) < c) avisos.push('La base no puede ser menor que la corona.')

  // ── base ──
  const J0 = sobreJunta(G, 0)
  const FSv = J0.Mv > 0 ? J0.Mr / J0.Mv : Infinity
  const Df = num(g.Df, 0.5)
  const Pp = g.pasivo ? 0.5 * num(S.gsB, gs) * Kp * Df * Df + 2 * num(S.c) * Math.sqrt(Kp) * Df : 0
  const mu = num(S.mu, 0.45)
  const Fr = mu * J0.N + Pp
  const FSd = J0.Hh > 0 ? Fr / J0.Hh : Infinity
  const Wq = q * m2
  const N2 = J0.N + Wq
  const xr = (J0.Mr + Wq * (m1 + c + m2 / 2) - J0.Mv) / N2
  const e = B / 2 - xr
  const qmax = Math.abs(e) <= B / 6 ? (N2 / B) * (1 + (6 * Math.abs(e)) / B) : (2 * N2) / (3 * Math.max(xr, 1e-6))
  const qmin = Math.abs(e) <= B / 6 ? (N2 / B) * (1 - (6 * Math.abs(e)) / B) : 0
  checks.push(check('volteo', 'Volteo', C.fsVolteo, FSv, 'FS', { grupo: 'Estabilidad', nota: `FS = ${f2(FSv)}` }))
  checks.push(check('deslizamiento', 'Deslizamiento', C.fsDesl, FSd, 'FS', { grupo: 'Estabilidad', nota: `FS = ${f2(FSd)}` }))
  checks.push(check('excentricidad', 'Resultante en el tercio medio', Math.abs(e), B / 6, 'm', { grupo: 'Estabilidad', nota: `e = ${f3(e)}` }))
  checks.push(check('suelo', 'Presión máxima', qmax, num(S.qadm), 't/m²', { grupo: 'Estabilidad' }))
  if (qmax > num(S.qadm)) avisos.push(`La presión máxima pasa de qadm = ${f2(num(S.qadm))} t/m²: ensancha la base o inclina el frente (⚡ Proponer prueba los dos). Si ni así, con este suelo conviene muro de concreto armado.`)
  secciones.push({
    titulo: 'Geometría y empujes (por metro)',
    pasos: [
      paso('Proyección del paramento del relleno', 'm2 = B − c − m1', `= ${f2(B)} − ${f2(c)} − ${f2(m1)}`, m2, 'm'),
      paso('Coeficiente activo', beta > 0 ? 'Ka de Rankine con talud' : 'Ka = tan²(45 − φ/2)', `φ = ${f1(num(S.phi))}°`, Ka, ''),
      paso('Empuje activo', 'Pa = ½ γ Ka h²', `h = ${f2(J0.hp)} m`, J0.Pa, 't'),
      ...(q > 0 ? [paso('Empuje de la sobrecarga', 'Pq = Ka q h', '', J0.Pq, 't')] : []),
      paso('Peso de la mampostería', 'Wm = γm (B + c)/2 H', `= ${f2(gm)} × (${f2(B)} + ${f2(c)})/2 × ${f2(H)}`, J0.Wm, 't'),
      paso('Tierra sobre el paramento del relleno', 'Ws = γs m2 H / 2', '', J0.Ws, 't'),
    ],
  })
  secciones.push({
    titulo: 'Estabilidad (cargas de servicio)',
    pasos: [
      paso('Momento resistente', 'Mr = Σ W x', '', J0.Mr, 't·m'),
      paso('Momento de volteo', 'Mv = Pa h/3 + Pq h/2', '', J0.Mv, 't·m'),
      paso('Volteo', 'FS = Mr / Mv', `= ${f2(J0.Mr)} / ${f2(J0.Mv)}`, FSv, '', { ok: FSv >= C.fsVolteo, lim: `≥ ${C.fsVolteo}` }),
      paso('Deslizamiento', 'FS = (μ N + Pp) / ΣH', `= (${f2(mu)} × ${f2(J0.N)} + ${f2(Pp)}) / ${f2(J0.Hh)}`, FSd, '', { ok: FSd >= C.fsDesl, lim: `≥ ${C.fsDesl}` }),
      paso('Excentricidad en la base', 'e = B/2 − (Mr − Mv)/N', `= ${f2(B / 2)} − ${f3(xr)}`, e, 'm', { ok: Math.abs(e) <= B / 6 + 1e-9, lim: `≤ B/6 = ${f3(B / 6)}` }),
      paso('Presiones en el suelo', 'q = N/B (1 ± 6e/B)', `mín ${f2(qmin)}`, qmax, 't/m²', { ok: qmax <= num(S.qadm), lim: `≤ qadm = ${f2(num(S.qadm))}` }),
    ],
  })

  // ── juntas ──
  const juntas = [0, 0.25, 0.5, 0.75].map((k) => {
    const J = sobreJunta(G, k * H)
    const x = (J.Mr - J.Mv) / J.N
    const ej = J.w / 2 - x
    const sig = Math.abs(ej) <= J.w / 6 ? (J.N / J.w) * (1 + (6 * Math.abs(ej)) / J.w) : (2 * J.N) / (3 * Math.max(x, 1e-6))
    const v = J.Hh / J.w
    return { ...J, k, x, e: ej, sigma: sig / 10, v: v / 10, okE: Math.abs(ej) <= J.w / 6 + 1e-9, okS: sig / 10 <= fm, okV: v / 10 <= vm }
  })
  const peorE = juntas.reduce((a, b) => (Math.abs(b.e) / b.w > Math.abs(a.e) / a.w ? b : a))
  const peorS = juntas.reduce((a, b) => (b.sigma > a.sigma ? b : a))
  const peorV = juntas.reduce((a, b) => (b.v > a.v ? b : a))
  checks.push(check('juntasE', 'Juntas sin tensión', Math.abs(peorE.e), peorE.w / 6, 'm', { grupo: 'Mampostería', ok: juntas.every((j) => j.okE), nota: `a ${f2(peorE.y)} m` }))
  checks.push(check('compresion', 'Compresión en la piedra', peorS.sigma, fm, 'kg/cm²', { grupo: 'Mampostería', nota: `a ${f2(peorS.y)} m` }))
  checks.push(check('cortanteM', 'Cortante en las juntas', peorV.v, vm, 'kg/cm²', { grupo: 'Mampostería', nota: `a ${f2(peorV.y)} m` }))
  secciones.push({
    titulo: 'Juntas a cada cuarto de la altura',
    pasos: juntas.flatMap((j) => [
      paso(`Junta a ${f2(j.y)} m`, 'ancho w · carga N · e', `w = ${f2(j.w)} · N = ${f2(j.N)} t`, j.e, 'm', { ok: j.okE, lim: `≤ w/6 = ${f3(j.w / 6)}` }),
      paso('', 'σ = N/w (1 + 6e/w)', '', j.sigma, 'kg/cm²', { ok: j.okS, lim: `≤ f*m = ${fm}` }),
      paso('', 'v = ΣH / w', '', j.v, 'kg/cm²', { ok: j.okV, lim: `≤ v*m = ${vm}` }),
    ]),
  })
  const Lz = num(g.Lz, 1)
  const vol = (B + c) / 2 * H * Lz
  const cant = { mamposteria: vol, piedra: vol * 1.35, mortero: vol * 0.27, excavacion: (B + 0.4) * (Df + 0.1) * Lz }
  const ok = checks.every((k) => k.ok)
  return {
    tipo: 'gravedad', ok, checks, secciones, avisos, cant,
    datos: { H, c, B, m1, m2, Ka, e, qmax, qmin, xr, N: N2, FSv, FSd, juntas, Df, gs },
    resumen: `Muro de contención de piedra braza de ${f2(H)} m: corona ${f2(c)} m, base ${f2(B)} m (frente ${f2(m1)}, relleno ${f2(m2)}), FS volteo ${f2(FSv)} y deslizamiento ${f2(FSd)}`,
  }
}

/**
 * La base más angosta (a cada 5 cm) que pasa todo, probando también el
 * talud del frente m1 (a cada 10 cm): con el frente inclinado el peso se corre
 * hacia la punta y la resultante se centra. Si ninguna pasa hasta B = 3H,
 * la de menor aprovechamiento, y la revisión dice qué no alcanza.
 */
export function proponerGravedad(z, obra = {}) {
  const H = num(z.geo.H, 2)
  const c = Math.max(0.3, num(z.geo.c, 0.4))
  const m0 = Math.max(0, num(z.geo.m1, 0))
  let mejor = null
  for (let B = arriba(Math.max(c + m0 + 0.1, 0.4 * H), 0.05); B <= 3 * H + 1e-9; B = Math.round((B + 0.05) * 100) / 100) {
    const m1s = [m0]
    for (let m = 0; m <= B - c + 1e-9; m = Math.round((m + 0.1) * 100) / 100) if (Math.abs(m - m0) > 1e-9) m1s.push(m)
    let deB = null
    for (const m1 of m1s) {
      const geo = { ...z.geo, B, c, m1 }
      const R = revisarGravedad({ ...z, geo }, obra)
      const u = Math.max(...R.checks.map((k) => (Number.isFinite(k.u) ? k.u : 99)))
      if (R.ok && (!deB || u < deB.u)) deB = { geo, u }
      if (!mejor || u < mejor.u - 1e-9) mejor = { geo, u }
    }
    if (deB) return { geo: deB.geo }
  }
  return { geo: mejor ? mejor.geo : { ...z.geo, B: arriba(0.7 * H, 0.05), c } }
}

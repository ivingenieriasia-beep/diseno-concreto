// ══════════════════════════════════════════════════════════════
// Zapata aislada: céntrica, con momentos, de lindero y de esquina
//
// La base es B (en x) × L (en y) y la columna c1 × c2 puede ir al centro,
// pegada a un lindero (columna al ras de una orilla) o a dos (esquina). Las
// hojas «Zapata Aislada Céntrica» y «Excéntrica», con estas diferencias:
//   · la presión se revisa con el área efectiva de Meyerhof B′ = B − 2e en las
//     dos direcciones (la excéntrica ya la usaba para la reacción última);
//   · la columna de lindero o esquina puede llevar TRABE DE LIGA: la liga toma
//     el momento N·e de la excentricidad y el suelo trabaja parejo. Sin liga
//     la resultante cae casi en la orilla y el área efectiva se desploma;
//   · penetración con la sección crítica real (4, 3 o 2 lados) y transferencia
//     de momento en las dos direcciones;
//   · flexión y cortante en las cuatro caras, con la presión sólo donde el
//     área efectiva la pone; anclaje de las varillas y aplastamiento.
// Convención: My positivo corre la resultante hacia +x; Mx, hacia +y.
// ══════════════════════════════════════════════════════════════

import {
  CRITERIOS, SUELO, MAT, paso, check, f0, f1, f2, f3, arriba, num,
  capacidadEfectiva, presiones, flexion, revisaParrilla, proponerParrilla,
  cortante1D, penetracion, aplastamiento, anclaje, peraltes, varilla, txtArm, parrilla, kgm, GC,
} from './comun'

export function nuevaAislada(nombre = 'Z-1') {
  return {
    tipo: 'aislada', nombre,
    geo: { B: 1.2, L: 1.2, h: 30, c1: 30, c2: 30, px: 'centro', py: 'centro', xc: 0, yc: 0, liga: true, cuadrada: true },
    cargas: { CM: { P: 12, Mx: 0, My: 0 }, CV: { P: 4, Mx: 0, My: 0 }, S: { P: 0, Mx: 0, My: 0 } },
    arm: { x: { num: 4, s: 20 }, y: { num: 4, s: 20 } },
    mat: { ...MAT }, suelo: {},
  }
}

/** Centro de la columna (m, desde el centro de la base) según su posición */
export function centroColumna(g) {
  const B = num(g.B), L = num(g.L), a = num(g.c1) / 100, b = num(g.c2) / 100
  const lim = (v, m) => Math.max(-m, Math.min(m, v))
  const eje = (p, v, D, c) => (p === 'min' ? -D / 2 + c / 2 : p === 'max' ? D / 2 - c / 2 : p === 'libre' ? lim(num(v), Math.max(0, D / 2 - c / 2)) : 0)
  return { xc: eje(g.px, g.xc, B, a), yc: eje(g.py, g.yc, L, b) }
}

export const posicionTexto = (g) => {
  const ex = g.px === 'min' || g.px === 'max', ey = g.py === 'min' || g.py === 'max'
  if (ex && ey) return 'de esquina'
  if (ex || ey) return 'de lindero'
  if (g.px === 'libre' || g.py === 'libre') return 'con la columna corrida'
  return 'céntrica'
}

const ZERO = { P: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 }
const carga = (c, k) => ({ ...ZERO, ...(c?.[k] || {}) })
const signo = (v) => (v < 0 ? -1 : 1)

/**
 * Combinaciones: de servicio para el suelo, últimas para el concreto.
 * Cada una trae P, los momentos en el pie de la columna (Mcx, Mcy) y en el
 * desplante (Mx, My = M + V·h, con h en m): el cortante de la columna también
 * voltea la zapata. El sismo va en los dos sentidos de su axial (carga y
 * descarga la columna) y siempre agrandando los momentos que ya hay.
 */
export function combinaciones(cargas, C, hm = 0) {
  const cm = carga(cargas, 'CM'), cv = carga(cargas, 'CV'), s = carga(cargas, 'S')
  const base = (a, k = 1, b = ZERO, kb = 1) => {
    const P = k * a.P + kb * b.P, Mcx = k * a.Mx + kb * b.Mx, Mcy = k * a.My + kb * b.My
    const Vx = k * a.Vx + kb * b.Vx, Vy = k * a.Vy + kb * b.Vy
    return { P, Mcx, Mcy, Mx: Mcx + Vy * hm, My: Mcy + Vx * hm }
  }
  const serv = base(cm, 1, cv, 1)
  const ult = base(cm, C.fcm, cv, C.fcv)
  const out = {
    servicio: [{ id: 'CM + CV', ...serv, k: 1 }],
    ultimas: [{ id: `${C.fcm} CM + ${C.fcv} CV`, ...ult }],
  }
  const hayS = ['P', 'Mx', 'My', 'Vx', 'Vy'].some((k) => Math.abs(s[k]) > 1e-9)
  if (hayS) {
    const Sx = Math.abs(s.Mx) + Math.abs(s.Vy) * hm, Sy = Math.abs(s.My) + Math.abs(s.Vx) * hm
    const conS = (b, f, sg) => {
      const dx = signo(b.Mx), dy = signo(b.My)
      return {
        P: f * (b.P + sg * Math.abs(s.P)),
        Mcx: f * (b.Mcx + dx * Math.abs(s.Mx)), Mcy: f * (b.Mcy + dy * Math.abs(s.My)),
        Mx: f * (b.Mx + dx * Sx), My: f * (b.My + dy * Sy),
      }
    }
    for (const sg of [1, -1]) {
      if (sg < 0 && Math.abs(s.P) < 1e-9) continue
      const t = sg > 0 ? '+' : '−'
      out.servicio.push({ id: `CM + CV ${t} S`, ...conS(serv, 1, sg), k: C.kS })
      out.ultimas.push({ id: `${C.facc} (CM + CV ${t} S)`, ...conS(serv, C.facc, sg) })
    }
  }
  return out
}

function datos(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const S = { ...SUELO, ...(obra.suelo || {}), ...(z.suelo || {}) }
  const g = z.geo, m = { ...MAT, ...(z.mat || {}) }
  const B = num(g.B, 1), L = num(g.cuadrada ? g.B : g.L, 1), h = num(g.h, 30)
  const c1 = num(g.c1, 30), c2 = num(g.c2, 30)
  const { xc, yc } = centroColumna({ ...g, L })
  return { C, S, g, m, B, L, h, c1, c2, xc, yc, fc: num(m.fc, 250), fy: num(m.fy, 4200), r: num(m.r, 5) }
}

/**
 * Excentricidad (m) de la resultante de una combinación con el peso W de la
 * zapata y el relleno (centrado): e = (N·c + M) / (N + W). Sin trabe de liga
 * la carga de la columna entra en su lugar (c); con liga, al centro.
 */
function excentricidad(D, cmb, W = 0) {
  const off = D.g.liga ? { x: 0, y: 0 } : { x: D.xc, y: D.yc }
  const Nt = cmb.P + W
  if (!(Nt > 0)) return { ex: 0, ey: 0, Nt }
  return { ex: (cmb.P * off.x + cmb.My) / Nt, ey: (cmb.P * off.y + cmb.Mx) / Nt, Nt }
}

/** Área de la intersección de dos rectángulos {x0,x1,y0,y1} */
const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

/**
 * Momento y cortante en una cara de la columna, con la presión uniforme qu
 * sobre la región efectiva. eje 'x': caras x = xf (dir +1 hacia +x, −1 hacia −x).
 */
function voladizo(qu, reg, eje, xf, dir, dCm) {
  const [a0, a1, w] = eje === 'x' ? [reg.x0, reg.x1, reg.y1 - reg.y0] : [reg.y0, reg.y1, reg.x1 - reg.x0]
  // se trabaja con la coordenada medida desde la cara hacia la orilla
  const lo = dir > 0 ? Math.max(xf, a0) : Math.max(-xf, -a1)
  const hi = dir > 0 ? a1 : -a0
  const f = dir > 0 ? xf : -xf
  const Mu = hi > lo ? qu * w * ((hi - f) ** 2 - (lo - f) ** 2) / 2 : 0
  const s = f + dCm / 100
  const lo2 = Math.max(s, lo)
  const Vu = hi > lo2 ? qu * w * (hi - lo2) : 0
  return { Mu, Vu }
}

/**
 * Todo lo que se revisa de la zapata, en números y en pasos.
 * @param obra { suelo, criterios } de la obra
 */
export function revisarAislada(z, obra = {}) {
  const D = datos(z, obra)
  const { C, S, B, L, h, c1, c2, xc, yc, fc, fy, r } = D
  const arm = { x: { num: 4, s: 20, ...(z.arm?.x || {}) }, y: { num: 4, s: 20, ...(z.arm?.y || {}) } }
  const hm = h / 100
  // las cargas de diseño y, si vino de RAM agrupando apoyos, las de cada uno:
  // la envolvente junta la P más pesada con el M más grande, pero con el
  // sismo descargando rige a veces el apoyo ligero de la esquina
  const deApoyos = (z.apoyos || []).map((a) => {
    const c = combinaciones(a.cargas, C, hm)
    const et = (x) => ({ ...x, id: `nudo ${a.nudo} · ${x.id}`, nudo: a.nudo })
    return { servicio: c.servicio.map(et), ultimas: c.ultimas.map(et) }
  })
  const cmb0 = combinaciones(z.cargas, C, hm)
  const cmb = {
    servicio: [...cmb0.servicio, ...deApoyos.flatMap((c) => c.servicio)],
    ultimas: [...cmb0.ultimas, ...deApoyos.flatMap((c) => c.ultimas)],
  }
  // (en la memoria van las de diseño y, de los apoyos, sólo la que rige)
  const checks = [], secciones = [], avisos = []
  const qadm = num(S.qadm), gs = num(S.gs, 1.6), Df = num(S.Df, 1)

  // ── 1. Suelo ────────────────────────────────────────────────
  // con el peso de la zapata y del relleno W (NTC: la presión con el área
  // efectiva y las cargas que llegan al desplante). Con la carga centrada es
  // lo mismo que la hoja: N/A ≤ qe = qadm − W/A.
  const W = B * L * (GC * hm + gs * Math.max(0, Df - hm))
  const qeG = capacidadEfectiva({ ...S, h })
  // se informa en neto, como la hoja: q = (N + W)/A′ − W/A ≤ qe = k qadm − W/A
  const wA = W / (B * L)
  const suelo = cmb.servicio.map((c) => {
    const { ex, ey, Nt } = excentricidad(D, c, W)
    const pr = presiones(Nt, B, L, ex, ey)
    const qe = c.k * qadm - wA
    const q = Nt > 0 ? pr.q - wA : Infinity
    return { c, ex, ey, Nt, pr, q, qe, u: q / qe }
  })
  const sGov = suelo.reduce((a, b) => (b.u > a.u ? b : a))
  const pSuelo = [
    paso('Peso de la zapata y del relleno', 'W = B L [γc h + γs (Df − h)]', `= ${f2(B)} × ${f2(L)} × (${GC} × ${f2(hm)} + ${f2(gs)} × ${f2(Math.max(0, Df - hm))})`, W, 't'),
    { ...qeG.pasos[0], nota: 'qadm menos W/A: lo que queda para la columna' },
  ]
  const hayV = cmb.servicio.some((c) => Math.abs(c.Mx - c.Mcx) + Math.abs(c.My - c.Mcy) > 1e-9)
  if (deApoyos.length) pSuelo.push(paso('Apoyos de RAM', `además de las cargas de diseño, las de sus ${deApoyos.length} apoyos`, (z.apoyos || []).map((a) => a.nudo).join(', '), sGov.c.nudo ? `rige el nudo ${sGov.c.nudo}` : 'rigen las de diseño', ''))
  for (const s of suelo.filter((x) => !x.c.nudo || x === sGov)) {
    const et = cmb.servicio.length > 1 ? ` (${s.c.id})` : ''
    pSuelo.push(paso(`Carga de la columna${et}`, 'N', s.c.id, s.c.P, 't'))
    if (hayV) pSuelo.push(paso('Momentos en el desplante', 'M = M(columna) + V h', `Mx = ${f2(s.c.Mcx)} → ${f2(s.c.Mx)} · My = ${f2(s.c.Mcy)} → ${f2(s.c.My)}`, '', 't·m'))
    pSuelo.push(paso('Carga en el desplante', 'N + W', `= ${f2(s.c.P)} + ${f2(W)}`, s.Nt, 't', s.Nt > 0 ? {} : { ok: false, nota: 'la zapata se levanta: el sismo le quita más de lo que pesa' }))
    if (!(s.Nt > 0)) continue
    if (Math.abs(s.ex) > 1e-6 || Math.abs(s.ey) > 1e-6) {
      pSuelo.push(paso('Excentricidades', `ex = (${D.g.liga ? '' : 'N xc + '}My) / (N + W) · ey = (${D.g.liga ? '' : 'N yc + '}Mx) / (N + W)`, `ex = ${f3(s.ex)} · ey = ${f3(s.ey)}`, '', 'm'))
      pSuelo.push(paso('Área efectiva', 'A′ = (B − 2|ex|)(L − 2|ey|)', `= ${f2(Math.max(0, s.pr.Bp))} × ${f2(Math.max(0, s.pr.Lp))}`, s.pr.Ap, 'm²', s.pr.sinArea ? { ok: false, nota: 'la resultante sale de la base' } : {}))
    } else pSuelo.push(paso('Área de la base', 'A = B × L', `= ${f2(B)} × ${f2(L)}`, B * L, 'm²'))
    if (!s.pr.sinArea) {
      const lim = { ok: s.u <= 1, lim: `≤ qe = ${f2(s.qe)}${s.c.k !== 1 ? ` (${s.c.k} qadm − W/A)` : ''}` }
      if (Math.abs(s.ex) > 1e-6 || Math.abs(s.ey) > 1e-6) {
        pSuelo.push(paso('Presión con el peso', 'q′ = (N + W) / A′', `= ${f2(s.Nt)} / ${f3(s.pr.Ap)}`, s.pr.q, 't/m²'))
        pSuelo.push(paso('Presión neta', 'q = q′ − W / A', `= ${f2(s.pr.q)} − ${f2(wA)}`, s.q, 't/m²', lim))
      } else pSuelo.push(paso('Presión de contacto', 'q = N / A', `= ${f2(s.c.P)} / ${f3(B * L)}`, s.q, 't/m²', lim))
      if (s.pr.despega) pSuelo.push(paso('Presiones elásticas en las esquinas', 'q = (N + W)/A (1 ± 6ex/B ± 6ey/L)', `máx ${f2(s.pr.qmax)} · mín ${f2(s.pr.qmin)}`, 'la base se despega en una orilla', '', { nota: 'la resultante sale del núcleo central' }))
    }
  }
  checks.push(check('suelo', 'Presión en el suelo', sGov.q, sGov.qe, 't/m²', { grupo: 'Suelo', nota: sGov.c.id }))
  if (!(sGov.Nt > 0)) avisos.push(`Con ${sGov.c.id} la zapata se levanta (N + W = ${f2(sGov.Nt)} t): agrándala o hazla más pesada, o liga la columna a las vecinas.`)
  else if (sGov.pr.sinArea) avisos.push(`Con ${sGov.c.id} la resultante cae fuera de la base: agranda la zapata o ponle trabe de liga.`)
  else if (!(sGov.u <= 1) && B * L >= 25) avisos.push(`El suelo pide una zapata de más de ${f2(B)} × ${f2(L)} m (qadm = ${f2(qadm)} t/m²): para esta carga conviene losa de cimentación, pilas o mejorar el suelo.`)
  secciones.push({ titulo: 'Presión en el suelo (cargas de servicio)', pasos: pSuelo })

  if (!D.g.liga && (Math.abs(xc) > 1e-6 || Math.abs(yc) > 1e-6)) {
    avisos.push('Columna corrida sin trabe de liga: la excentricidad la toma sólo el suelo.')
  }
  if (D.g.liga && (Math.abs(xc) > 1e-6 || Math.abs(yc) > 1e-6)) {
    const u0 = cmb.ultimas[0], s0 = cmb.servicio[0]
    const e = Math.hypot(xc, yc)
    secciones.push({
      titulo: 'Trabe de liga (toma la excentricidad de la columna)',
      pasos: [
        paso('Excentricidad de la columna', 'e = distancia del centro de la columna al de la base', `x = ${f3(xc)} · y = ${f3(yc)}`, e, 'm'),
        paso('Momento de servicio para la liga', 'M = N · e', `= ${f2(s0.P)} × ${f3(e)}`, s0.P * e, 't·m'),
        paso('Momento último para la liga', 'Mu = Nu · e', `= ${f2(u0.P)} × ${f3(e)}`, u0.P * e, 't·m', { nota: 'diséñala en Secciones con este momento' }),
      ],
    })
  }

  // ── 2. Concreto ─────────────────────────────────────────────
  // capa de abajo: la dirección con más momento por metro
  // la reacción del suelo con el peso (0.9 W: el peso que estabiliza no se
  // infla) sobre el área efectiva, menos ese peso repartido en toda la base:
  // con carga centrada queda Nu / A, como siempre
  const Wu = 0.9 * W
  const todo = { x0: -B / 2, x1: B / 2, y0: -L / 2, y1: L / 2 }
  const conc = cmb.ultimas.map((c) => {
    const { ex, ey, Nt } = excentricidad(D, c, Wu)
    const pr = presiones(Math.max(Nt, 0), B, L, ex, ey)
    const qu = pr.sinArea ? 0 : pr.q
    const qd = Wu / (B * L)
    const cargaEn = (rect) => qu * inter(rect, pr.region) - qd * inter(rect, todo)
    const fx = { d: xc + c1 / 200, i: xc - c1 / 200 }, fy_ = { d: yc + c2 / 200, i: yc - c2 / 200 }
    return { c, ex, ey, Nt, pr, qu, qd, cargaEn, fx, fy: fy_ }
  })
  // el voladizo con la reacción sobre el área efectiva menos el peso en todo
  const vol = (k, eje, xf, dir, d) => {
    const a = voladizo(k.qu, k.pr.region, eje, xf, dir, d), b = voladizo(k.qd, todo, eje, xf, dir, d)
    return { Mu: a.Mu - b.Mu, Vu: a.Vu - b.Vu }
  }
  const momentos = (k, dx, dy) => {
    const X1 = vol(k, 'x', k.fx.d, 1, dx), X2 = vol(k, 'x', k.fx.i, -1, dx)
    const Y1 = vol(k, 'y', k.fy.d, 1, dy), Y2 = vol(k, 'y', k.fy.i, -1, dy)
    return { Mx: Math.max(X1.Mu, X2.Mu, 0), Vx: Math.max(X1.Vu, X2.Vu, 0), My: Math.max(Y1.Mu, Y2.Mu, 0), Vy: Math.max(Y1.Vu, Y2.Vu, 0) }
  }
  // tanteo con el peralte de la capa de abajo para decidir el orden
  const d0 = h - r - varilla(arm.x.num).diam / 2
  const m0 = conc.map((k) => momentos(k, d0, d0))
  const abajoX = Math.max(...m0.map((m) => m.Mx / L)) >= Math.max(...m0.map((m) => m.My / B))
  const pr_ = abajoX ? peraltes(h, r, arm.x.num, arm.y.num) : peraltes(h, r, arm.y.num, arm.x.num)
  const dX = abajoX ? pr_.dAbajo : pr_.dArriba, dY = abajoX ? pr_.dArriba : pr_.dAbajo
  const dMed = (dX + dY) / 2
  const envol = conc.map((k) => ({ k, ...momentos(k, dX, dY) }))
  const gov = (key) => envol.reduce((a, b) => (b[key] > a[key] ? b : a))

  // penetración con cada combinación última
  const pen = conc.map((k) => {
    return { k, P: penetracion({ Pu: k.c.P, Mux: k.c.Mcx, Muy: k.c.Mcy, c1, c2, xc, yc, B, L, d: dMed, fc, carga: k.cargaEn }) }
  })
  const penG = pen.reduce((a, b) => ((b.P.u || 0) > (a.P.u || 0) ? b : a))
  checks.push(check('penetracion', 'Penetración', penG.P.vu, penG.P.vcR, 'kg/cm²', { grupo: 'Cortante', ok: penG.P.ok, nota: penG.P.posicion }))

  const secU = []
  const kGov = [gov('Mx').k, gov('My').k, penG.k]
  for (const k of conc.filter((x) => !x.c.nudo || kGov.includes(x))) {
    const et = conc.length > 1 ? ` (${k.c.id})` : ''
    secU.push(paso(`Carga última${et}`, 'Nu', k.c.id, k.c.P, 't'))
    if (Math.abs(k.ex) > 1e-6 || Math.abs(k.ey) > 1e-6) {
      secU.push(paso('Reacción del suelo con el peso', 'qu = (Nu + 0.9 W) / A′', `= (${f2(k.c.P)} + ${f2(Wu)}) / ${f3(k.pr.Ap)}`, k.qu, 't/m²'))
      secU.push(paso('Menos el peso, en toda la base', 'qd = 0.9 W / (B L)', `= ${f2(Wu)} / ${f3(B * L)}`, k.qd, 't/m²', { nota: 'la losa trabaja con qu en el área efectiva y −qd en toda la base' }))
    } else secU.push(paso('Reacción última neta', 'qu − qd = Nu / A', `= ${f2(k.c.P)} / ${f3(B * L)}`, k.qu - k.qd, 't/m²'))
  }
  secciones.push({ titulo: 'Reacción última del suelo', pasos: secU })
  secciones.push({ titulo: `Penetración${pen.length > 1 ? ` (rige ${penG.k.c.id})` : ''}`, pasos: [paso('Peralte útil medio', 'd = (dx + dy)/2', `= (${f1(dX)} + ${f1(dY)})/2`, dMed, 'cm'), ...penG.P.pasos] })

  // cortante en una dirección
  const gx = gov('Vx'), gy = gov('Vy')
  const vX = cortante1D({ Vu: gx.Vx, b: L * 100, d: dX, h, fc, nombre: 'a d de la cara (dirección x)' })
  const vY = cortante1D({ Vu: gy.Vy, b: B * 100, d: dY, h, fc, nombre: 'a d de la cara (dirección y)' })
  checks.push(check('cortanteX', 'Cortante en x', vX.Vu, vX.VcR, 't', { grupo: 'Cortante' }))
  checks.push(check('cortanteY', 'Cortante en y', vY.Vu, vY.VcR, 't', { grupo: 'Cortante' }))
  secciones.push({ titulo: 'Cortante como viga ancha', pasos: [...vX.pasos, ...vY.pasos] })

  // flexión y parrillas
  const gmx = gov('Mx'), gmy = gov('My')
  const flX = flexion({ Mu: gmx.Mx, b: L * 100, d: dX, h, fc, fy, nombre: 'en la cara (varillas en x)' })
  const flY = flexion({ Mu: gmy.My, b: B * 100, d: dY, h, fc, fy, nombre: 'en la cara (varillas en y)' })
  const pX = revisaParrilla({ arm: arm.x, As: flX.As, W: L * 100, r, sMin: C.sMin, sMax: C.sMax, nombre: 'en x' })
  const pY = revisaParrilla({ arm: arm.y, As: flY.As, W: B * 100, r, sMin: C.sMin, sMax: C.sMax, nombre: 'en y' })
  checks.push(check('flexionX', 'Flexión en x', flX.As, pX.As, 'cm²', { grupo: 'Flexión', ok: !flX.insuficiente && pX.ok, nota: txtArm(arm.x) }))
  checks.push(check('flexionY', 'Flexión en y', flY.As, pY.As, 'cm²', { grupo: 'Flexión', ok: !flY.insuficiente && pY.ok, nota: txtArm(arm.y) }))
  if (pX.apretada || pY.apretada) avisos.push(`Parrilla apretada (menos de ${C.sMin} cm): sube el # o el peralte.`)
  secciones.push({
    titulo: 'Flexión en la cara de la columna',
    pasos: [
      paso('Peraltes útiles', abajoX ? 'capa de abajo en x' : 'capa de abajo en y', `dx = ${f1(dX)} · dy = ${f1(dY)}`, '', 'cm'),
      ...flX.pasos, ...pX.pasos, ...flY.pasos, ...pY.pasos,
    ],
  })

  // anclaje: del paño de la columna a la orilla del voladizo más largo
  const volX = Math.max(B / 2 - (xc + c1 / 200), (xc - c1 / 200) + B / 2) * 100
  const volY = Math.max(L / 2 - (yc + c2 / 200), (yc - c2 / 200) + L / 2) * 100
  const aX = anclaje({ num: arm.x.num, s: arm.x.s, disponible: volX - r, fc, fy, r, AsReq: flX.AsReq, AsProv: pX.As })
  const aY = anclaje({ num: arm.y.num, s: arm.y.s, disponible: volY - r, fc, fy, r, AsReq: flY.AsReq, AsProv: pY.As })
  checks.push(check('anclajeX', 'Anclaje en x', aX.recto ? aX.Ld : aX.Ldh, aX.disponible, 'cm', { grupo: 'Detallado', ok: aX.ok, nota: aX.recto ? 'recta' : aX.gancho ? 'con gancho' : 'no se desarrolla' }))
  checks.push(check('anclajeY', 'Anclaje en y', aY.recto ? aY.Ld : aY.Ldh, aY.disponible, 'cm', { grupo: 'Detallado', ok: aY.ok, nota: aY.recto ? 'recta' : aY.gancho ? 'con gancho' : 'no se desarrolla' }))
  secciones.push({ titulo: 'Anclaje de las varillas', pasos: [...aX.pasos, ...aY.pasos] })

  // aplastamiento: A2 concéntrica y semejante a la columna, dentro de la base
  const mx = Math.min(B / 2 - Math.abs(xc) - c1 / 200, L / 2 - Math.abs(yc) - c2 / 200) * 100
  const A2A1 = ((c1 + 2 * Math.max(0, mx)) * (c2 + 2 * Math.max(0, mx))) / (c1 * c2)
  const ap = aplastamiento({ Pu: Math.max(...cmb.ultimas.map((c) => c.P)), c1, c2, fc, fy, A2A1 })
  checks.push(check('aplastamiento', 'Aplastamiento', ap.Pu, ap.PR, 't', { grupo: 'Detallado', ok: ap.ok, nota: ap.conBastones ? `con ${f2(ap.AsT)} cm² de arranques` : 'sólo el concreto' }))
  if (ap.conBastones) {
    avisos.push(ap.ok
      ? `La columna excede el aplastamiento del concreto (${f2(ap.PRc)} t): ancla en la zapata al menos ${f2(ap.AsT)} cm² de sus varillas (arranques con gancho sobre la parrilla).`
      : `El aplastamiento no pasa ni con 4 % de arranques: la columna de ${f0(c1)}×${f0(c2)} es chica para ${f2(ap.Pu)} t; agrándala o sube f′c.`)
  }

  // peralte mínimo
  const hMin = C.hMin
  checks.push(check('peralte', 'Peralte mínimo', hMin, h, 'cm', { grupo: 'Detallado', nota: `h ≥ ${hMin} cm` }))
  secciones.push({ titulo: 'Aplastamiento y peralte mínimo', pasos: [...ap.pasos, paso('Peralte mínimo', `h ≥ ${hMin} cm`, `h = ${f1(h)}`, h >= hMin ? 'cumple' : 'no cumple', '', { ok: h >= hMin })] })

  // cantidades
  const gX = parrilla({ num: arm.x.num, s: arm.x.s, W: L * 100, r }), gY = parrilla({ num: arm.y.num, s: arm.y.s, W: B * 100, r })
  const largoX = B - 2 * r / 100 + (aX.gancho ? 2 * 12 * gX.v.diam / 100 : 0)
  const largoY = L - 2 * r / 100 + (aY.gancho ? 2 * 12 * gY.v.diam / 100 : 0)
  const cant = {
    concreto: B * L * h / 100,
    plantilla: B * L * C.plantilla / 100,
    acero: gX.n * largoX * kgm(gX.v) + gY.n * largoY * kgm(gY.v),
    excavacion: B * L * (num(S.Df) + C.plantilla / 100),
  }

  const ok = checks.every((c) => c.ok)
  return {
    tipo: 'aislada', ok, checks, secciones, avisos, cant,
    datos: {
      B, L, h, c1, c2, xc, yc, dX, dY, abajoX, qe: sGov.qe, W, q: sGov.q, qu: Math.max(...conc.map((k) => k.qu - k.qd)),
      region: sGov.pr.region, ganchoX: aX.gancho, ganchoY: aY.gancho, nX: gX.n, nY: gY.n, pen: penG.P.rect,
      AsX: flX.As, AsY: flY.As, AsReqX: flX.AsReq, AsReqY: flY.AsReq, arm,
    },
    resumen: `Zapata ${posicionTexto(D.g)} de ${f2(B)} × ${f2(L)} m, h = ${f1(h)} cm, `
      + `${txtArm(arm.x)} en x y ${txtArm(arm.y)} en y${aX.gancho || aY.gancho ? ' (con gancho)' : ''}, f′c = ${fc} kg/cm²`,
  }
}

// ── Proponer ─────────────────────────────────────────────────
/**
 * Dimensiona y arma: la base más chica (a cada 5 cm) que el suelo aguanta,
 * el peralte más chico (a cada 5 cm) que pasa penetración, cortante y
 * flexión, y la parrilla con menos acero entre las prácticas que anclan.
 * Todo se vuelve a revisar con las varillas elegidas (con otra varilla cambia
 * el peralte útil) hasta que nada se mueve: si una varilla no ancla se abre la
 * base; si no cabe el acero, se sube el peralte.
 */
export function proponerAislada(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  let geo = { ...z.geo }
  const c1 = num(geo.c1, 30), c2 = num(geo.c2, 30)
  let minB = Math.max(C.Bmin, arriba(c1 / 100 + 0.3, 0.05))
  const minL = Math.max(C.Bmin, arriba(c2 / 100 + 0.3, 0.05))
  const ratio = geo.cuadrada ? 1 : Math.max(0.3, num(geo.L, 1) / Math.max(num(geo.B, 1), 0.05))
  const r = num(z.mat?.r, 5), fc = num(z.mat?.fc, 250), fy = num(z.mat?.fy, 4200)
  const BMAX = 10, HMAX = 200
  let arm = { x: { num: 4, s: 20 }, y: { num: 4, s: 20 } }
  const prueba = (g, a = arm) => revisarAislada({ ...z, geo: g, arm: a }, obra)
  const pasa = (R, ids) => ids.every((id) => R.checks.find((c) => c.id === id)?.ok)
  const concOk = (R) => pasa(R, ['penetracion', 'cortanteX', 'cortanteY', 'peralte'])
    && !R.secciones.some((s) => s.pasos.some((p) => p.v === 'no alcanza'))
  const Lde = (B) => (geo.cuadrada ? B : Math.max(minL, arriba(B * ratio, 0.05)))
  const sube = (v) => Math.round((v + 0.05) * 100) / 100

  let h = Math.max(25, arriba(num(geo.h, 25), 5))
  let hPiso = 25                      // sólo sube: cuando el acero pide más peralte
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    // base: la más chica que el suelo aguanta con este peralte
    let B = minB
    while (B < BMAX && !pasa(prueba({ ...geo, B, L: Lde(B), h }), ['suelo'])) B = sube(B)
    const L = Lde(B)
    // peralte: el más chico que pasa el concreto
    let h2 = hPiso
    while (h2 < HMAX && !concOk(prueba({ ...geo, B, L, h: h2 }))) h2 += 5
    geo = { ...geo, B, L, h: h2 }
    if (h2 !== h) { h = h2; continue }          // otro peralte, otro qe: otra vuelta
    // parrillas con el peralte de las varillas actuales
    const R = prueba(geo)
    const volX = Math.max(B / 2 - (R.datos.xc + c1 / 200), R.datos.xc - c1 / 200 + B / 2) * 100 - r
    const volY = Math.max(L / 2 - (R.datos.yc + c2 / 200), R.datos.yc - c2 / 200 + L / 2) * 100 - r
    const fil = (vol, AsReq, W) => (n, s) => anclaje({ num: n, s, disponible: vol, fc, fy, r, AsReq, AsProv: parrilla({ num: n, s, W, r }).As }).ok
    const base = { r, calibres: C.calibres, sMin: C.sMin, sMax: C.sMax, paso: C.paso }
    const ax = proponerParrilla({ ...base, As: R.datos.AsX, W: L * 100, filtro: fil(volX, R.datos.AsReqX, L * 100) })
    const ay = proponerParrilla({ ...base, As: R.datos.AsY, W: B * 100, filtro: fil(volY, R.datos.AsReqY, B * 100) })
    if (!ax || !ay) {
      const cabe = (As, W) => proponerParrilla({ ...base, As, W })
      // el acero no cabe ni sin pensar en el anclaje: más peralte
      if ((!ax && !cabe(R.datos.AsX, L * 100)) || (!ay && !cabe(R.datos.AsY, B * 100))) {
        if (h >= HMAX) break
        h += 5; hPiso = h; geo = { ...geo, h }; minB = Math.max(minB, B); continue
      }
      // cabe pero no ancla: más volado; si ya no se puede, el acero que pide
      // la flexión y el anclaje avisa
      if (B >= BMAX) {
        const sx = ax || cabe(R.datos.AsX, L * 100), sy = ay || cabe(R.datos.AsY, B * 100)
        arm = { x: { num: sx.num, s: sx.s }, y: { num: sy.num, s: sy.s } }
        break
      }
      minB = sube(B); continue
    }
    const nuevo = { x: { num: ax.num, s: ax.s }, y: { num: ay.num, s: ay.s } }
    const igual = nuevo.x.num === arm.x.num && nuevo.x.s === arm.x.s && nuevo.y.num === arm.y.num && nuevo.y.s === arm.y.s
    arm = nuevo
    const R2 = prueba(geo)
    if (R2.ok) break
    if (!igual) continue                          // con otra varilla cambia d: se revisa otra vez
    if (!pasa(R2, ['suelo']) && B < BMAX) { minB = sube(B); continue }
    if (!concOk(R2) || !pasa(R2, ['flexionX', 'flexionY'])) { if (h >= HMAX) break; h += 5; hPiso = h; geo = { ...geo, h }; continue }
    if (!pasa(R2, ['anclajeX', 'anclajeY'])) { if (B >= BMAX) break; minB = sube(B); continue }
    break                                         // lo que queda (aplastamiento) no lo arregla la zapata
  }
  if (geo.cuadrada) geo.L = geo.B
  return { geo, arm }
}

/** Peso propio (t) de la zapata, por si alguien lo quiere sumar a mano */
export const pesoPropio = (z) => num(z.geo.B) * num(z.geo.cuadrada ? z.geo.B : z.geo.L) * num(z.geo.h) / 100 * GC

// ══════════════════════════════════════════════════════════════
// Cimiento corrido de mampostería de piedra braza — hoja «Diseño Cimiento»
// (NTC-Mampostería 8.4 + NTC-Cimentaciones, todo por metro lineal)
//
//   · el SUELO fija el ancho B; el CORTANTE en el escarpio y la pendiente
//     1.5 : 1 fijan la altura H;
//   · compresión en la corona, excentricidad (el lindero es medio trapecio),
//     y para el lindero: volteo, deslizamiento y presiones como muro que
//     retiene el desnivel, más los cimientos perpendiculares de la tabla 8.4.
// Igual que la hoja, con una corrección: la presión en el suelo se compara con
// la capacidad efectiva (descontado el peso del propio cimiento y el relleno
// sobre sus escarpios), no con la admisible entera.
// ══════════════════════════════════════════════════════════════

import { CRITERIOS, SUELO, paso, check, f1, f2, f3, arriba, num, minimos } from './comun'
import { MAMPOSTERIA } from './gravedad'
import { rankine } from './suelo'

export function nuevaMamposteria(nombre = 'CP-1') {
  return {
    tipo: 'mamposteria', nombre,
    geo: { B: 0.6, H: 0.75, c: 0.3, t: 0.15, pos: 'lindero', autoB: true, autoH: true, Bmin: 0.6, FC: 1, Hrell: 0.5, Lreal: 4, Lz: 10 },
    cargas: { CM: { w: 3.6 }, CV: { w: 1.29 } },
    mat: { ...MAMPOSTERIA }, suelo: {},
  }
}

/** Tabla 8.4: separación máxima entre cimientos perpendiculares según q (kg/cm²) */
export const tabla84 = (q) => (q <= 2 ? 10 : q <= 2.5 ? 9 : q <= 3 ? 7.5 : q <= 4 ? 6 : q <= 5 ? 4.5 : 0)

export function revisarMamposteria(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const S = { ...SUELO, ...(obra.suelo || {}), ...(z.suelo || {}) }
  const g = z.geo, M = { ...MAMPOSTERIA, ...(z.mat || {}) }
  const lind = g.pos === 'lindero'
  const Wu = num(z.cargas?.CM?.w) + num(z.cargas?.CV?.w)
  const FC = num(g.FC, 1)
  const c = num(g.c, 0.3), t = num(g.t, 0.15), Bmin = Math.max(num(g.Bmin, C.Bmin), num(C.Bmin, 0.6))
  const gm = num(M.gm, 2.2), fm = num(M.fm, 20), vm = num(M.vm, 0.6)
  const qadm = num(S.qadm), gs = num(S.gs, 1.6), Df = num(S.Df, 1)
  const checks = [], secciones = [], avisos = []
  const W = Wu * FC

  // capacidad efectiva con la sección de tanteo
  const qeDe = (B, H) => {
    const A = (B + c) / 2 * H
    return qadm - (gm * A + gs * (B * H - A) + gs * Math.max(0, Df - H) * B) / B
  }
  // ── ancho y altura ──
  let B = num(g.B, 0.6), H = num(g.H, 0.75), sinSolucion = false
  const Hde = (b) => {
    const V = lind ? b - c : (b - c) / 2
    const q = W / b
    return Math.max(arriba(1.5 * V, 0.05), arriba((q * V) / (10 * vm), 0.05), 0.3)
  }
  if (g.autoB || g.autoH) {
    for (let i = 0; i < 10; i++) {
      if (g.autoH) H = Hde(B)
      if (g.autoB) {
        // el primer ancho que cumple; si ninguno hasta 5 m (suelo muy pobre: el
        // peso de la piedra crece más rápido que el ancho), el de menor q/qe
        let b = arriba(Math.max(Bmin, c + 0.1), 0.05), mejor = null
        sinSolucion = true
        while (b <= 5 + 1e-9) {
          const qe = qeDe(b, g.autoH ? Hde(b) : H)
          const u = qe > 0 ? W / b / qe : Infinity
          if (u <= 1 + 1e-9) { mejor = [b, u]; sinSolucion = false; break }
          if (!mejor || u < mejor[1] - 1e-9) mejor = [b, u]
          b = Math.round((b + 0.05) * 100) / 100
        }
        B = mejor[0]
      }
      if (g.autoH) H = Hde(B)
      if (!g.autoB || W / B <= qeDe(B, H) + 1e-9) break
    }
  }
  const qe = qeDe(B, H)
  const q = W / B
  if (sinSolucion) avisos.push(`Con qadm = ${f2(qadm)} t/m² ningún ancho de mampostería cumple: el peso de la piedra crece más rápido que el área de apoyo. Usa una zapata corrida de concreto o mejora el suelo.`)
  const V = lind ? B - c : (B - c) / 2
  const Bc = W / qe
  checks.push(check('suelo', 'Presión en el suelo', q, qe, 't/m²', { grupo: 'Suelo', nota: `B ${g.autoB ? 'automático' : 'capturado'}` }))
  secciones.push({
    titulo: '1 · Predimensionamiento: el suelo gobierna el ancho B',
    pasos: [
      paso('Carga de servicio del muro', 'Wu = CM + CV', `= ${f2(num(z.cargas?.CM?.w))} + ${f2(num(z.cargas?.CV?.w))}`, Wu, 't/m'),
      paso('Carga para el suelo', 'Wu · FC', `= ${f2(Wu)} × ${f2(FC)}`, W, 't/m'),
      paso('Capacidad efectiva', 'qe = qadm − (peso del cimiento + relleno) / B', `= ${f2(qadm)} − …`, qe, 't/m²', { nota: 'corrección: la hoja comparaba con qadm entera' }),
      paso('Ancho requerido por suelo', 'Bc = Wu FC / qe', `= ${f2(W)} / ${f2(qe)}`, Bc, 'm'),
      paso('Ancho adoptado', 'B = máx(Bc, Bmín) a 5 cm', `Bmín = ${f2(Bmin)} · rige ${Bc > Bmin ? 'el suelo' : 'el mínimo constructivo'}`, B, 'm'),
      paso('Presión de contacto', 'q = Wu FC / B', `= ${f2(W)} / ${f2(B)}`, q, 't/m²', { ok: q <= qe + 1e-9, lim: `≤ qe = ${f2(qe)}` }),
    ],
  })

  // ── cortante en el escarpio ──
  const Vu = q * V
  const Hcor = Vu / (10 * vm)
  const Hesc = 1.5 * V
  const Vr = H * 10 * vm
  checks.push(check('cortante', 'Cortante en el escarpio', Vu, Vr, 't/m', { grupo: 'Mampostería' }))
  const p = V > 0 ? H / V : Infinity
  checks.push(check('pendiente', 'Pendiente del escarpio', 1.5, p, 'V:H', { grupo: 'Mampostería', nota: `${f1((Math.atan(p) * 180) / Math.PI)}°` }))
  secciones.push({
    titulo: '2 · Cortante en el escarpio: gobierna la altura H',
    pasos: [
      paso('Vuelo del escarpio', lind ? 'V = B − c (lindero)' : 'V = (B − c)/2 (interior)', '', V, 'm'),
      paso('Altura por la pendiente 1.5 : 1', 'H = 1.5 V', `= 1.5 × ${f2(V)}`, Hesc, 'm'),
      paso('Cortante en el vuelo', 'Vu = q V', `= ${f2(q)} × ${f2(V)}`, Vu, 't/m'),
      paso('Altura por cortante', 'H = Vu / v*m', `= ${f2(Vu)} / (${vm} × 10)`, Hcor, 'm'),
      paso('Altura adoptada', 'H', `rige ${Hcor > Hesc ? 'el cortante' : 'el escarpio'}${g.autoH ? '' : ' (capturada)'}`, H, 'm'),
      paso('Cortante resistente', 'Vr = H · 1 m · v*m', `= ${f2(H)} × 10 × ${vm}`, Vr, 't/m', { ok: Vr >= Vu, lim: `≥ Vu = ${f2(Vu)}` }),
      paso('Pendiente del escarpio', 'p = H / V ≥ 1.5', `ángulo ${f1((Math.atan(p) * 180) / Math.PI)}° ≥ 56.3°`, p, '', { ok: p >= 1.5 - 1e-9, nota: 'la piedra no resiste tensión en el vuelo' }),
    ],
  })

  // ── compresión en la corona ──
  const sA = (W * 1000 / 100) / (c * 100)
  checks.push(check('corona', 'Compresión en la corona', sA, fm, 'kg/cm²', { grupo: 'Mampostería' }))
  secciones.push({ titulo: '3 · Compresión en la corona', pasos: [paso('Esfuerzo actuante', 'σ = Wu FC / c', `= ${f2(W)}×10 / ${f1(c * 100)}`, sA, 'kg/cm²', { ok: sA <= fm, lim: `≤ f*m = ${fm}` })] })

  // ── excentricidad ──
  const e = lind ? B / 2 - t / 2 : 0
  const okE = e <= B / 6 + 1e-9
  const pE = [
    paso('Excentricidad', lind ? 'e = B/2 − t/2 (lindero)' : 'interior: e = 0', '', e, 'm', { ok: okE, lim: `≤ B/6 = ${f3(B / 6)}` }),
    paso('Momento por excentricidad', 'M = Wu e', '', Wu * e, 't·m/m'),
  ]

  // ── lindero como muro de contención ──
  let lindOk = true, rL = null
  if (lind || !okE) {
    const Hr = num(g.Hrell, 0.5)
    const phi = num(S.phi, 30), mu = num(S.mu, 0.45), FSmin = C.fsDesl
    const Ka = rankine(phi).Ka
    const Eh = 0.5 * Ka * gs * Hr * Hr, yE = Hr / 3
    const Wp = (B + c) / 2 * H * gm
    const xcg = ((c * H) * (c / 2) + ((B - c) * H / 2) * (c + (B - c) / 3)) / ((B + c) / 2 * H)
    const Mest = Wp * (B - xcg) + Wu * (B - t / 2)
    const Mvol = Eh * yE
    const FSv = Mvol > 0 ? Mest / Mvol : Infinity
    const Fr = mu * (Wu + Wp)
    const FSd = Eh > 0 ? Fr / Eh : Infinity
    const etot = (Wu * (B / 2 - t / 2) + Eh * yE) / (Wu + Wp)
    const qkg = q / 10
    const Lmax = tabla84(qkg)
    const Lreal = num(g.Lreal, 4)
    const okPerp = qkg <= 5 && Lreal <= Lmax
    const sinDesp = etot <= B / 6
    lindOk = FSv >= FSmin && FSd >= FSmin && (sinDesp || okPerp)
    rL = { Hr, Ka, Eh, Wp, xcg, Mest, Mvol, FSv, FSd, etot, Lmax, Lreal, okPerp, sinDesp }
    checks.push(check('volteo', 'Lindero: volteo', FSmin, FSv, 'FS', { grupo: 'Lindero', nota: `FS = ${f2(FSv)}` }))
    checks.push(check('deslizamiento', 'Lindero: deslizamiento', FSmin, FSd, 'FS', { grupo: 'Lindero', nota: `FS = ${f2(FSd)}` }))
    checks.push(check('perpendiculares', 'Lindero: perpendiculares o sin despegue', okPerp || sinDesp ? 0 : 1, 1, '', { grupo: 'Lindero', ok: okPerp || sinDesp, nota: sinDesp ? 'sin despegue' : okPerp ? `perpendiculares a ${f1(Lreal)} ≤ ${f1(Lmax)} m` : `perpendiculares a ${f1(Lreal)} > ${f1(Lmax)} m` }))
    secciones.push({
      titulo: '4 · Excentricidad y revisión de lindero',
      pasos: [
        ...pE,
        paso('Empuje del desnivel retenido', 'Eh = ½ Ka γs H²', `Ka = ${f3(Ka)}, H = ${f2(Hr)} m (sin cohesión: lado seguro)`, Eh, 't/m'),
        paso('Peso propio del cimiento', 'W = (B + c)/2 H γm', '', Wp, 't/m'),
        paso('Momento estabilizador', 'W (B − xcg) + N (B − t/2)', `xcg = ${f3(xcg)} m`, Mest, 't·m'),
        paso('Momento volcador', 'Eh · H/3', '', Mvol, 't·m'),
        paso('Volteo', 'FS = Mest / Mvol', '', FSv, '', { ok: FSv >= FSmin, lim: `≥ ${FSmin}` }),
        paso('Deslizamiento', 'FS = μ (N + W) / Eh', `μ = ${f2(mu)}`, FSd, '', { ok: FSd >= FSmin, lim: `≥ ${FSmin}` }),
        paso('Excentricidad total', 'e = (N (B/2 − t/2) + Eh yE) / (N + W)', '', etot, 'm', { ok: sinDesp, lim: sinDesp ? `≤ B/6: sin despegue` : `> B/6: se despega` }),
        paso('Cimientos perpendiculares (tabla 8.4)', `q = ${f2(qkg)} kg/cm² → Lmáx`, `separación real ${f1(Lreal)} m`, Lmax, 'm', { ok: okPerp, lim: qkg > 5 ? 'q > 5: revisar torsión' : `Lreal ≤ ${f1(Lmax)}` }),
      ],
    })
  } else {
    checks.push(check('excentricidad', 'Excentricidad', e, B / 6, 'm', { grupo: 'Mampostería' }))
    secciones.push({ titulo: '4 · Excentricidad', pasos: pE })
  }

  const mn = minimos(C, { B, Df, que: 'B' })
  checks.push(...mn.checks)
  secciones.push({ titulo: 'Mínimos', pasos: mn.pasos })

  const Lz = num(g.Lz, 1)
  const A = (B + c) / 2 * H
  const cant = { mamposteria: A * Lz, piedra: A * 1.35 * Lz, mortero: A * 0.27 * Lz, excavacion: B * Df * Lz }
  secciones.push({
    titulo: '5 · Cuantificación',
    pasos: [
      paso('Área de la sección', 'A = (B + c)/2 H', '', A, 'm²'),
      paso('Mampostería', 'A × L', `L = ${f1(Lz)} m`, cant.mamposteria, 'm³'),
      paso('Piedra suelta', '× 1.35 (acomodo)', '', cant.piedra, 'm³'),
      paso('Mortero', '× 0.27', '', cant.mortero, 'm³'),
    ],
  })
  const ok = checks.every((k) => k.ok) && lindOk
  return {
    tipo: 'mamposteria', ok, checks, secciones, avisos, cant,
    datos: { B, H, c, t, V, q, qe, e, lind, rL, Wu, Hcor, Hesc, p },
    resumen: `Cimiento ${lind ? 'de lindero (medio trapecio)' : 'interior (trapecio simétrico)'} de piedra braza: B = ${f2(B)} m, corona ${f2(c)} m, `
      + `H = ${f2(H)} m, escarpio a ${f1((Math.atan(p) * 180) / Math.PI)}°${lind && rL ? `; perpendiculares a ${f1(rL.Lmax)} m máximo` : ''}. Mortero ≥ 50 kg/cm²`,
  }
}

export function proponerMamposteria(z, obra = {}) {
  const R = revisarMamposteria({ ...z, geo: { ...z.geo, autoB: true, autoH: true } }, obra)
  return { geo: { ...z.geo, B: R.datos.B, H: R.datos.H, autoB: true, autoH: true } }
}

// ══════════════════════════════════════════════════════════════
// Viga sobre resortes de Winkler (3.13)
//
// Cada corrida (con su CT), cada contratrabe y cada eje ligado es una viga
// de Euler-Bernoulli, partida en elementos de DS_VIGA m, sobre resortes
// ks · B · (largo tributario) en cada nudo de la malla, con el ks del estrato
// o de la zona bajo ese punto. A diferencia de la corrida flexible (3.12),
// la viga reparte la carga: un tramo sobre suelo blando se cuelga del resto.
//
// Las trabes de liga unen dos puntos de las vigas (de un nudo a otro, o de un
// nudo al eje de otra viga). Cada una es un resorte vertical entre esos dos
// puntos con la rigidez que le dan sus extremos:
//   · empotrada en los dos:            k = 12 EI / L³,  M = 6 EI Δ / L² en cada extremo;
//   · empotrada en uno, articulada en el otro: k = 3 EI / L³, M = 3 EI Δ / L² en el empotrado;
//   · articulada en los dos: no transmite nada.
// La liga no tiene apoyo en el suelo ni peso propio en el modelo.
//
// Un nudo que está en dos vigas (un cruce) puede tomarse unido (las dos vigas
// bajan lo mismo ahí) o separado (cada viga por su cuenta): lo elige el
// ingeniero.
//
// Se resuelve dos veces con la misma rigidez: en servicio (CM + CV media) para
// los asentamientos y la distorsión, y con U1 (fcm CM + fcv CV máxima) para el
// M y el V de cada viga y de cada liga, contra su MR y su VR.
//
// La matriz de las vigas es de banda (cada nudo con su vecino); las ligas y
// las uniones la acoplan en pocos lugares y se suman con la fórmula de
// Woodbury: K⁻¹ f = y − Z (C⁻¹ + Uᵀ Z)⁻¹ Uᵀ y, con y = Kb⁻¹ f y Z = Kb⁻¹ U.
// ══════════════════════════════════════════════════════════════

/** Largo de cada elemento de la viga, m (el de la malla de colores es MALLA) */
export const DS_VIGA = 0.025

// ── la matriz de banda (simétrica, media banda 3) ──────────────
const MB = 3

function nuevaBanda(N) {
  return { N, A: new Float64Array(N * (MB + 1)), Lf: null }
}
const idx = (i, k) => i * (MB + 1) + k
function sumaB(B, i, j, v) {
  if (j < i) [i, j] = [j, i]
  B.A[idx(i, j - i)] += v
}
/** Eliminación de Gauss sin pivoteo (la matriz es definida positiva) */
function factoriza(B) {
  const { N, A } = B
  const Lf = new Float64Array(N * (MB + 1))
  for (let k = 0; k < N; k++) {
    const piv = A[idx(k, 0)]
    if (!(piv > 0)) throw new Error('La viga sobre resortes quedó inestable (pivote nulo): revisa los ks y la rigidez.')
    for (let i = k + 1; i <= Math.min(N - 1, k + MB); i++) {
      const c = A[idx(k, i - k)] / piv
      if (!c) continue
      Lf[idx(k, i - k)] = c
      for (let j = i; j <= Math.min(N - 1, k + MB); j++) A[idx(i, j - i)] -= c * A[idx(k, j - k)]
    }
  }
  B.Lf = Lf
}
function resuelveB(B, f) {
  const { N, A, Lf } = B
  const y = Float64Array.from(f)
  for (let k = 0; k < N; k++) for (let i = k + 1; i <= Math.min(N - 1, k + MB); i++) y[i] -= Lf[idx(k, i - k)] * y[k]
  const x = new Float64Array(N)
  for (let k = N - 1; k >= 0; k--) {
    let s = y[k]
    for (let j = k + 1; j <= Math.min(N - 1, k + MB); j++) s -= A[idx(k, j - k)] * x[j]
    x[k] = s / A[idx(k, 0)]
  }
  return x
}
/** Sistema denso chico (Gauss con pivoteo parcial) */
function densa(M, b) {
  const n = b.length, a = M.map((r) => [...r]), x = [...b]
  for (let k = 0; k < n; k++) {
    let p = k
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i
    ;[a[k], a[p]] = [a[p], a[k]];[x[k], x[p]] = [x[p], x[k]]
    for (let i = k + 1; i < n; i++) {
      const c = a[i][k] / a[k][k]
      if (!c) continue
      for (let j = k; j < n; j++) a[i][j] -= c * a[k][j]
      x[i] -= c * x[k]
    }
  }
  const out = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= a[i][j] * out[j]; out[i] = s / a[i][i] }
  return out
}

/** Momento (positivo: tensión abajo) en los extremos de un elemento y su cortante */
export function esfuerzosElemento(EI, h, w1, t1, w2, t2) {
  const M1 = -EI * (-6 * w1 - 4 * h * t1 + 6 * w2 - 2 * h * t2) / (h * h)
  const M2 = -EI * (6 * w1 + 2 * h * t1 - 6 * w2 + 4 * h * t2) / (h * h)
  return { M1, M2, V: (M2 - M1) / h }
}

/**
 * El sistema de vigas sobre resortes, con enlaces entre nudos.
 * @param vigas    [{ EI (t·m²; 0 = sin rigidez, cada nudo por su cuenta), nodos: [{ s (m), k (t/m), P: [carga de cada caso, t] }] }]
 * @param enlaces  [{ a: { v, i }, b: { v, i } | null (punto fijo), k (t/m) | Infinity (unión rígida) }]
 * @param nCasos   cuántos casos de carga trae P
 * @returns { vigas: [{ w[c][i], t[c][i], M[c][i], V[c][e] }], enlaces: [{ d[c] (w_a − w_b), F[c] }] }
 */
export function resolverVigas(vigas, enlaces = [], nCasos = 1) {
  const off = []
  let N = 0
  for (const v of vigas) { off.push(N); N += 2 * v.nodos.length }
  const B = nuevaBanda(N)
  const f = Array.from({ length: nCasos }, () => new Float64Array(N))
  vigas.forEach((v, iv) => {
    const o = off[iv], n = v.nodos.length
    for (let i = 0; i < n; i++) {
      sumaB(B, o + 2 * i, o + 2 * i, v.nodos[i].k)
      for (let c = 0; c < nCasos; c++) f[c][o + 2 * i] += v.nodos[i].P[c] || 0
    }
    if (v.EI > 0) {
      for (let e = 0; e < n - 1; e++) {
        const h = v.nodos[e + 1].s - v.nodos[e].s, c = v.EI / h ** 3
        const ke = [[12, 6 * h, -12, 6 * h], [6 * h, 4 * h * h, -6 * h, 2 * h * h], [-12, -6 * h, 12, -6 * h], [6 * h, 2 * h * h, -6 * h, 4 * h * h]]
        const d = [o + 2 * e, o + 2 * e + 1, o + 2 * e + 2, o + 2 * e + 3]
        for (let a = 0; a < 4; a++) for (let b = a; b < 4; b++) sumaB(B, d[a], d[b], ke[a][b] * c)
      }
    } else for (let i = 0; i < n; i++) sumaB(B, o + 2 * i + 1, o + 2 * i + 1, 1)
    if (n === 1) sumaB(B, o + 1, o + 1, 1)
  })
  const dof = (p) => off[p.v] + 2 * p.i
  // los enlaces a un punto fijo van a la diagonal; los demás, por Woodbury
  const acop = []
  for (const L of enlaces) {
    if (!L.b) { if (Number.isFinite(L.k)) sumaB(B, dof(L.a), dof(L.a), L.k); else sumaB(B, dof(L.a), dof(L.a), 1e12); continue }
    if (dof(L.a) === dof(L.b)) continue
    acop.push(L)
  }
  factoriza(B)
  const ys = f.map((fc) => resuelveB(B, fc))
  let us = ys
  if (acop.length) {
    const r = acop.length
    const Z = acop.map((L) => { const u = new Float64Array(N); u[dof(L.a)] = 1; u[dof(L.b)] = -1; return resuelveB(B, u) })
    const UtZ = acop.map((L) => Z.map((z) => z[dof(L.a)] - z[dof(L.b)]))
    const S = UtZ.map((row, i) => row.map((v, j) => v + (i === j && Number.isFinite(acop[i].k) ? 1 / acop[i].k : 0)))
    us = ys.map((y) => {
      const g = densa(S, acop.map((L) => y[dof(L.a)] - y[dof(L.b)]))
      const u = Float64Array.from(y)
      for (let l = 0; l < r; l++) if (g[l]) for (let i = 0; i < N; i++) u[i] -= Z[l][i] * g[l]
      return u
    })
  }
  const outV = vigas.map((v, iv) => {
    const o = off[iv], n = v.nodos.length
    const w = us.map((u) => Array.from({ length: n }, (_, i) => u[o + 2 * i]))
    const t = us.map((u) => Array.from({ length: n }, (_, i) => (v.EI > 0 ? u[o + 2 * i + 1] : 0)))
    const M = [], V = []
    for (let c = 0; c < nCasos; c++) {
      const Mc = new Array(n).fill(0), cnt = new Array(n).fill(0), Vc = []
      if (v.EI > 0) for (let e = 0; e < n - 1; e++) {
        const h = v.nodos[e + 1].s - v.nodos[e].s
        const r = esfuerzosElemento(v.EI, h, w[c][e], t[c][e], w[c][e + 1], t[c][e + 1])
        Mc[e] += r.M1; cnt[e]++; Mc[e + 1] += r.M2; cnt[e + 1]++
        Vc.push(r.V)
      } else for (let e = 0; e < n - 1; e++) Vc.push(0)
      M.push(Mc.map((m, i) => (cnt[i] ? m / cnt[i] : 0))); V.push(Vc)
    }
    return { w, t, M, V }
  })
  const val = (p, c) => us[c][dof(p)]
  const outE = enlaces.map((L) => {
    const d = Array.from({ length: nCasos }, (_, c) => val(L.a, c) - (L.b ? val(L.b, c) : 0))
    return { d, F: d.map((x) => (Number.isFinite(L.k) ? L.k * x : NaN)) }
  })
  return { vigas: outV, enlaces: outE }
}

/**
 * La liga: su rigidez vertical y sus momentos en los extremos (positivo:
 * tensión abajo) para un diferencial Δ = w_a − w_b.
 */
export function rigidezLiga(EI, L, extA, extB) {
  const ea = extA === 'empotrada', eb = extB === 'empotrada'
  if (ea && eb) return { k: 12 * EI / L ** 3, M: (D) => ({ Ma: 6 * EI * D / L ** 2, Mb: -6 * EI * D / L ** 2 }) }
  if (eb) return { k: 3 * EI / L ** 3, M: (D) => ({ Ma: 0, Mb: -3 * EI * D / L ** 2 }) }
  if (ea) return { k: 3 * EI / L ** 3, M: (D) => ({ Ma: 3 * EI * D / L ** 2, Mb: 0 }) }
  return { k: 0, M: () => ({ Ma: 0, Mb: 0 }) }
}

/**
 * Los nudos de la malla de una viga de largo L con puntos obligados (apoyos,
 * extremos de liga): entre cada par, partes iguales de DS_VIGA o menos.
 */
export function mallaViga(L, puntos = [], ds = DS_VIGA) {
  const ks = [...new Set([0, L, ...puntos.filter((s) => s > 1e-9 && s < L - 1e-9)].map((s) => Math.round(s * 1e6) / 1e6))].sort((a, b) => a - b)
  const out = [0]
  for (let j = 0; j < ks.length - 1; j++) {
    const a = ks[j], b = ks[j + 1], n = Math.max(1, Math.ceil((b - a) / ds - 1e-6))
    for (let i = 1; i <= n; i++) out.push(i === n ? b : a + ((b - a) * i) / n)
  }
  return out
}

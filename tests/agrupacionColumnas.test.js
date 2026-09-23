import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { parseModeloRam } from '../src/core/ramModel'
import {
  proponerColumnas, elementosColumna, verificarColumnas, planosColumnas, diagramaDe, usoPunto, armadoDeReferencia,
  COLUMNAS_CATALOGO, COLUMNAS_DE_FABRICA, candidatasColumna, criticoDe, nubeDe,
} from '../src/core/agrupacionColumnas'
import {
  aprovechamiento, armarManual, manualDesde, grupoNuevo, renumerar, buscarMiembros, inventario,
} from '../src/core/agrupacion'
import { evaluateEnvelope, peorPorMiembro } from '../src/core/ramParser'
import { generarAplicarAgrupacion } from '../src/core/ramScript'

// Lo escribió sincronizar.py contra un RAM falso con física: el edificio de
// prueba (4 × 3 ejes, 3 entrepisos de 3 m, columnas C1 «COL 30 X 30»), con
// el axial por área tributaria, sismo en X y en Z (M33 y M22) con su volteo,
// y los momentos de gravedad que no se equilibran en las orillas.
const TEXTO = readFileSync(new URL('./fixtures/modelo_columnas.json', import.meta.url), 'utf8')
const R = parseModeloRam(TEXTO)
const COMBOS = ['CD', 'CSX', 'CSXN', 'CSZ', 'CSZN']
const sec = (n) => COLUMNAS_CATALOGO.find((s) => s.nombre === n)

describe('el modelo trae las fuerzas simultáneas de las columnas', () => {
  it('un punto por combinación en el pie y en la cabeza, con su M22', () => {
    const C1 = R.grupos.find((g) => g.nombre === 'C1')
    expect(R.conFlexo).toBe(36)
    expect(C1.points).toHaveLength(36 * COMBOS.length * 2)
    const p = C1.points.find((x) => x.member === '1' && x.tipo === 'CD pie')
    expect(p).toBeTruthy()
    expect(p.P).toBeCloseTo(-p.axial, 9)
    expect(p.P).toBeGreaterThan(0)                           // compresión positiva
    expect(C1.points.some((x) => Math.abs(x.m22) > 0.5)).toBe(true)
    expect(new Set(C1.points.map((x) => x.tipo.split(' ')[0]))).toEqual(new Set(COMBOS))
    expect(new Set(C1.points.map((x) => x.tipo.split(' ')[1]))).toEqual(new Set(['pie', 'cabeza']))
  })

  it('el pie es el extremo de abajo aunque el miembro esté dibujado de arriba abajo', () => {
    const d = JSON.parse(TEXTO)
    const m = d.miembros.find((x) => x.flexo)
    ;[m.ni, m.nj] = [m.nj, m.ni]
    m.flexo = m.flexo.map((f) => [+(m.L - f[0]).toFixed(3), ...f.slice(1)])
    const R2 = parseModeloRam(d)
    const pts = R2.grupos.find((g) => g.nombre === 'C1').points.filter((x) => x.member === String(m.id))
    const antes = R.grupos.find((g) => g.nombre === 'C1').points.filter((x) => x.member === String(m.id))
    for (const p of antes) expect(pts.find((q) => q.tipo === p.tipo).m33).toBe(p.m33)
  })

  it('las trabes siguen con su máximo y su mínimo', () => {
    const T1 = R.grupos.find((g) => g.nombre === 'T1')
    expect(new Set(T1.points.map((p) => p.tipo))).toEqual(new Set(['Max', 'Min']))
  })

  it('un modelo.json de antes: el máximo y el mínimo de siempre, y se sabe', () => {
    const d = JSON.parse(TEXTO)
    for (const m of d.miembros) delete m.flexo
    const R0 = parseModeloRam(d)
    expect(R0.conFlexo).toBe(0)
    expect(R0.grupos.find((g) => g.nombre === 'C1').points).toHaveLength(72)
    expect(elementosColumna(R0, ['C1']).every((e) => e.sinM22)).toBe(true)
    expect(proponerColumnas(R0, ['C1']).sinM22).toBe(true)
  })
})

describe('el diagrama de cada sección', () => {
  it('se dimensiona con el armado de menos barras entre 1.5 y 2.5 %', () => {
    const t = (n) => diagramaDe(sec(n)).texto
    expect(t('COL 30 X 30')).toBe('8#5 (ρ 1.76 %)')
    expect(t('COL 20 X 20')).toBe('4#5 (ρ 1.98 %)')
    expect(t('COL 36 X 36')).toBe('8#6 (ρ 1.76 %)')
    for (const s of COLUMNAS_CATALOGO) {
      const a = armadoDeReferencia(s)
      expect(a.As / (s.b * s.h)).toBeGreaterThanOrEqual(0.01)
      expect(a.As / (s.b * s.h)).toBeLessThanOrEqual(0.04)
    }
  })

  it('las de fábrica son las de 20 cm o más por lado, de menos a más concreto', () => {
    expect(COLUMNAS_DE_FABRICA).toEqual(['COL 20 X 20', 'COL 20 X 25', 'COL 25 X 25', 'COL 30 X 30', 'COL 36 X 36'])
    const c = candidatasColumna()
    for (let i = 1; i < c.length; i++) expect(c[i].b * c[i].h).toBeGreaterThanOrEqual(c[i - 1].b * c[i - 1].h)
  })

  it('el aprovechamiento dice lo mismo que la revisión del módulo Columnas', () => {
    const pts = R.grupos.find((g) => g.nombre === 'C1').points
    for (const n of ['COL 20 X 20', 'COL 25 X 25', 'COL 30 X 30']) {
      const D = diagramaDe(sec(n))
      const ev = evaluateEnvelope(pts, D.an.dirX, D.an.dirY, 'M33X')
      let distintos = 0
      for (const r of ev.results) {
        const u = usoPunto(D, { P: r.Pu, Mx: r.Mux, My: r.Muy })
        if ((u <= 1) !== r.ok && Math.abs(u - 1) > 0.01) distintos++
      }
      expect(distintos).toBe(0)
    }
  })

  it('es proporcional: el doble de demanda, el doble de aprovechamiento', () => {
    const D = diagramaDe(sec('COL 30 X 30'))
    const p = { P: 30, Mx: 4, My: 2 }
    const u = usoPunto(D, p)
    expect(u).toBeGreaterThan(0.2)
    expect(usoPunto(D, { P: 60, Mx: 8, My: 4 })).toBeCloseTo(2 * u, 2)
    expect(usoPunto(D, { P: 0, Mx: 0, My: 0 })).toBe(0)
    // compresión pura: la frontera es el POC
    expect(usoPunto(D, { P: D.x.Pmax, Mx: 0, My: 0 })).toBeCloseTo(1, 2)
  })
})

describe('las columnas como elementos', () => {
  it('por entrepiso: una por miembro; completas: una por eje, de abajo arriba', () => {
    const E = elementosColumna(R, ['C1'], { completa: false })
    expect(E).toHaveLength(36)
    expect(E.every((e) => e.miembros.length === 1 && Math.abs(e.L - 3) < 1e-6)).toBe(true)
    const C = elementosColumna(R, ['C1'], { completa: true })
    expect(C).toHaveLength(12)
    for (const e of C) {
      expect(e.miembros).toHaveLength(3)
      expect(e.zBot).toBeCloseTo(0, 6)
      expect(e.zTop).toBeCloseTo(9, 6)
      expect(e.puntos).toHaveLength(3 * COMBOS.length * 2)
    }
    // la de planta baja carga más que la de azotea en el mismo eje
    const porEje = C[0].miembros.map((id) => E.find((e) => e.id === id).Pu)
    expect(porEje[0]).toBeGreaterThan(porEje[2])
  })

  it('su punto crítico es de una combinación y un extremo', () => {
    const e = elementosColumna(R, ['C1'])[0]
    const c = criticoDe(e, sec('COL 30 X 30'))
    expect(c.tipo).toMatch(/^(CD|CSXN?|CSZN?) (pie|cabeza)$/)
    expect(c.u).toBeCloseTo(aprovechamiento(e, sec('COL 30 X 30')), 9)
  })
})

describe('las propuestas', () => {
  const A = proponerColumnas(R, ['C1'], { completa: false })

  it('grupos C1, C2… de la sección más grande a la más chica, y todas asignadas', () => {
    const P = A.propuestas.find((p) => p.id === 'equilibrada')
    expect(P.grupos.map((g) => `${g.nombre}:${g.sec.nombre}`)).toEqual(['C1:COL 36 X 36', 'C2:COL 30 X 30', 'C3:COL 25 X 25'])
    expect(P.grupos.reduce((s, g) => s + g.elems.length, 0)).toBe(36)
    for (const g of P.grupos) expect(g.uMax).toBeLessThanOrEqual(1 + 1e-9)
    expect(A.propuestas[0].grupos.length).toBeLessThanOrEqual(P.grupos.length)
    expect(A.propuestas[2].grupos.length).toBeGreaterThanOrEqual(P.grupos.length)
  })

  it('con toda la altura, una sección por columna completa', () => {
    const B = proponerColumnas(R, ['C1'], { completa: true })
    expect(B.elementos).toHaveLength(12)
    const P = B.propuestas.find((p) => p.id === 'equilibrada')
    expect(P.grupos.map((g) => g.sec.nombre)).toEqual(['COL 36 X 36', 'COL 30 X 30'])
  })

  it('con menos secciones permitidas, sólo ésas', () => {
    const B = proponerColumnas(R, ['C1'], { permitidas: ['COL 30 X 30', 'COL 36 X 36'] })
    for (const P of B.propuestas) for (const g of P.grupos) expect(['COL 30 X 30', 'COL 36 X 36']).toContain(g.sec.nombre)
  })

  it('la Fase 1 arma cada grupo con el motor de Columnas', () => {
    const P = A.propuestas.find((p) => p.id === 'equilibrada')
    for (const g of P.grupos) {
      const v = verificarColumnas(R, g)
      expect(v.estado).toBe('ok')
      expect(v.texto).toMatch(/#\d.*ρ .* · E#2\.5/)
      expect(v.kg).toBeGreaterThan(0)
    }
  })

  it('el acomodo manual, con C: grupo nuevo, sección fija y renumerar', () => {
    const P = A.propuestas.find((p) => p.id === 'equilibrada')
    let m = manualDesde(P)
    const g = grupoNuevo(m, undefined, 'C')
    expect(g.nombre).toBe('C4')
    m = { ...m, grupos: m.grupos.map((x) => (x.nombre === 'C1' ? { ...x, sec: 'COL 25 X 25' } : x)) }
    const M = armarManual(A.elementos, A.cands, m)
    const c1 = M.grupos.find((x) => x.nombre === 'C1')
    expect(c1.sec.nombre).toBe('COL 25 X 25')
    expect(c1.fuera).toBe(true)
    const r = renumerar({ ...m, grupos: [...m.grupos].reverse() }, M, 'C')
    expect(r.grupos.map((x) => x.nombre)).toEqual(['C1', 'C2', 'C3'])
  })

  it('el aplicar_agrupacion.py lleva las secciones de columna', () => {
    const r = generarAplicarAgrupacion(A.propuestas.find((p) => p.id === 'equilibrada'))
    const d = JSON.parse(r.texto.match(/AGRUPACION = (\{[\s\S]*?\n\})\n/)[1])
    expect(d.grupos.map((g) => `${g.descripcion} ${g.seccion}`)).toEqual(['C1 COL 36 X 36', 'C2 COL 30 X 30', 'C3 COL 25 X 25'])
    expect(d.grupos.flatMap((g) => g.miembros).sort((a, b) => a - b)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1))
  })
})

describe('la planta y la búsqueda', () => {
  it('un cuadro por columna, por entrepiso, con las trabes del nivel', () => {
    const E = elementosColumna(R, ['C1'], { completa: false })
    const g = planosColumnas(R, E, { completa: false })
    expect(g.niveles.map((N) => `${N.etiqueta}:${N.ids.length}`)).toEqual(['E1:12', 'E2:12', 'E3:12'])
    expect(g.niveles[0].titulo).toMatch(/0\.00 → 3\.00/)
    for (const N of g.niveles) expect(N.contexto.length).toBeGreaterThan(20)
    for (const [, x] of g.porId) expect(x.punto).toHaveLength(2)
    const C = elementosColumna(R, ['C1'], { completa: true })
    const g2 = planosColumnas(R, C, { completa: true })
    expect(g2.niveles).toHaveLength(1)
    expect(g2.niveles[0].etiqueta).toBe('Toda la altura')
  })

  it('buscar una trabe entre las columnas dice dónde está', () => {
    const E = elementosColumna(R, ['C1'])
    const viga = R.grupos.find((x) => x.nombre === 'T1').perfil.members[0].id
    const r = buscarMiembros(R, E, `${viga} 1`, 'columna')
    expect(r.elems).toEqual(['1'])
    expect(r.fuera[0].motivo).toMatch(/es una trabe \(T1\).*Trabes/)
  })

  it('el inventario las reconoce como columnas', () => {
    expect(inventario(R).find((g) => g.nombre === 'C1').tipo).toBe('columna')
  })

  it('la nube del diagrama: un punto por combinación y extremo', () => {
    const E = elementosColumna(R, ['C1'], { completa: false }).slice(0, 2)
    const n = nubeDe(E, sec('COL 30 X 30'))
    expect(n).toHaveLength(2 * COMBOS.length * 2)
    expect(n.every((p) => typeof p.ok === 'boolean' && p.Pu > 0)).toBe(true)
  })
})

describe('los informes listan el punto que rige de cada miembro', () => {
  it('peorPorMiembro', () => {
    const r = peorPorMiembro([
      { member: '1', util: 0.4, ok: true }, { member: '1', util: 0.9, ok: true },
      { member: '2', util: 1.2, ok: false }, { member: '2', util: 0.1, ok: true },
    ])
    expect(r.map((x) => `${x.member}:${x.util}`)).toEqual(['2:1.2', '1:0.9'])
  })
})

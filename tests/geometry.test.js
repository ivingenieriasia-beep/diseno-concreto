import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseNodeXlsx, parseNodeText, parseMemberGeometry, parseGeometryReport, attachGeometry, memberLengths, chainMembers, sectionDims, sectionMismatches } from '../src/core/geometry.js'
import { parseRamStations, unitsFor, buildElement, detectSupports, analyzeGroup, memberProfile } from '../src/core/longitudinal.js'

const here = dirname(fileURLToPath(import.meta.url))
const XLSX = readFileSync(join(here, 'fixtures', 'coordocaso.xlsx'))
const GEOM = readFileSync(join(here, 'fixtures', 'miembrost4.txt'), 'utf-8')
const T4 = readFileSync(join(here, 'fixtures', 'T4_estaciones.txt'), 'utf-8')

describe('geometría del modelo RAM', () => {
  it('lee las coordenadas de nudos del .xlsx exportado de RAM (sin encabezado, 656 nudos)', async () => {
    const nodes = await parseNodeXlsx(XLSX)
    expect(nodes.size).toBe(656)
    expect(nodes.get('1')).toEqual({ x: 13.8551, y: 0, z: -24.8937 })
    expect(nodes.get('784')).toEqual({ x: 7.40549, y: 7.85, z: -19.1366 })
  })
  it('lee nudos en texto con o sin encabezado y separadores mezclados', () => {
    const n = parseNodeText('Nudo X Y Z\n1  13.8551 0 -24.8937\n2;8.9\t0;-24.89\n')
    expect(n.size).toBe(2)
    expect(n.get('2')).toEqual({ x: 8.9, y: 0, z: -24.89 })
  })
  it('lee el reporte Datos de Geometría → Miembros', () => {
    const g = parseMemberGeometry(GEOM)
    expect(g.warnings).toEqual([])
    expect(g.rows).toHaveLength(98)
    expect(g.rows[0]).toMatchObject({ member: '1112', nj: '11', nk: '7', descripcion: 'T3-v2', seccion: '15 x 20' })
    expect(g.rows.find((r) => r.member === '1139').seccion).toBe('RcBeam 15X20')
  })
  it('sectionDims entiende "15 x 20", "15X25" y "RcBeam 15X20"', () => {
    expect(sectionDims('15 x 20')).toEqual({ b: 15, h: 20 })
    expect(sectionDims('15X25')).toEqual({ b: 15, h: 25 })
    expect(sectionDims('RcBeam 15X20')).toEqual({ b: 15, h: 20 })
    expect(sectionDims('f\'c 250')).toBeNull()
  })
  it('longitudes = distancia NJ–NK (m) para los 98 miembros', async () => {
    const nodes = await parseNodeXlsx(XLSX)
    const { Lpor, missing } = memberLengths(parseMemberGeometry(GEOM).rows, nodes)
    expect(missing).toEqual([])
    expect(Object.keys(Lpor)).toHaveLength(98)
    expect(Lpor['1']).toBeCloseTo(2.6997, 3)
    expect(Lpor['9']).toBeCloseTo(3.15, 3)
    expect(Lpor['1107']).toBeCloseTo(0.6526, 3)
    expect(Lpor['1060']).toBeCloseTo(3.6898, 3)
  })
  it('detecta miembros con sección distinta a la trabe', async () => {
    const nodes = await parseNodeXlsx(XLSX)
    const { secPor } = memberLengths(parseMemberGeometry(GEOM).rows, nodes)
    const ids = Object.keys(secPor)
    const m = sectionMismatches(secPor, ids, { ancho: 15, peralte: 20 })
    expect(m.distintos.map((d) => d.member).sort()).toEqual(['1028', '140', '141', '155', '17', '996', '997'].sort())
    expect(m.resumen['15 x 20']).toBe(63)
    expect(m.resumen['RcBeam 15X20']).toBe(28)
  })
})

describe('cadenas de miembros colineales → elementos', () => {
  it('une los tramos de RAM en 38 elementos; el más largo tiene 23 miembros y 11.70 m', async () => {
    const nodes = await parseNodeXlsx(XLSX)
    const ids = parseRamStations(T4).members.map((m) => m.id)
    const chains = chainMembers(parseMemberGeometry(GEOM).rows, nodes, ids)
    expect(chains).toHaveLength(38)
    expect(chains.filter((c) => c.members.length === 1)).toHaveLength(20)
    const sum = chains.reduce((s, c) => s + c.members.length, 0)
    expect(sum).toBe(98)
    const big = [...chains].sort((a, b) => b.members.length - a.members.length)[0]
    expect(big.members).toHaveLength(23)
    expect(big.L).toBeCloseTo(11.70, 1)
    expect(big.members[0].x0).toBe(0)
    for (let i = 1; i < big.members.length; i++) expect(big.members[i].x0).toBeCloseTo(big.members[i - 1].x0 + big.members[i - 1].L, 3)
    const c1099 = chains.find((c) => c.members.some((m) => m.id === '1099'))
    expect(c1099.members.map((m) => m.id)).toEqual(['1099', '1104', '1105', '1106', '1107', '1108', '1109'])
    expect(c1099.L).toBeCloseTo(11.82, 1)
  })
  it('buildElement concatena estaciones con x continua y conserva el signo de M33', async () => {
    const nodes = await parseNodeXlsx(XLSX)
    const P = parseRamStations(T4)
    const chains = chainMembers(parseMemberGeometry(GEOM).rows, nodes, P.members.map((m) => m.id))
    const ch = chains.find((c) => c.members.some((m) => m.id === '1099'))
    const byId = new Map(P.members.map((m) => [m.id, m]))
    const el = buildElement(ch, byId)
    expect(el.isElement).toBe(true)
    expect(el.stations).toHaveLength(7 * 10)
    expect(el.Lreport).toBeCloseTo(ch.L, 6)
    for (let i = 1; i < el.stations.length; i++) expect(el.stations[i].raw).toBeGreaterThanOrEqual(el.stations[i - 1].raw - 1e-9)
    // el miembro 1107 (Mu− 1.78 en su nudo I) sigue ahí, a la x del elemento
    const m1107 = ch.members.find((m) => m.id === '1107')
    const s = el.stations.find((st) => st.member === '1107' && Math.abs(st.raw - (m1107.reversed ? m1107.x0 + m1107.L : m1107.x0)) < 1e-6)
    expect(s.m33.max).toBe(-1.78)
    const prof = memberProfile(el, 0)
    expect(prof.L).toBeCloseTo(ch.L, 6)
    expect(prof.muNmax).toBe(1.78)
  })
  it('detectSupports: extremos siempre, interiores donde el cortante salta y cambia de signo', async () => {
    const nodes = await parseNodeXlsx(XLSX)
    const P = parseRamStations(T4)
    const chains = chainMembers(parseMemberGeometry(GEOM).rows, nodes, P.members.map((m) => m.id))
    const byId = new Map(P.members.map((m) => [m.id, m]))
    const el = buildElement(chains.find((c) => c.members.some((m) => m.id === '1099')), byId)
    const sup = detectSupports(el)
    expect(sup[0]).toBe(0)
    expect(sup[sup.length - 1]).toBeCloseTo(el.Lreport, 6)
    expect(sup.length).toBeGreaterThan(2) // trabe continua sobre varios apoyos
  })
  it('unitsFor: con geometría analiza por elemento; sin ella o desactivado, por miembro; respeta excluir', async () => {
    const nodes = await parseNodeXlsx(XLSX)
    const P = parseRamStations(T4)
    const chains = chainMembers(parseMemberGeometry(GEOM).rows, nodes, P.members.map((m) => m.id))
    const base = { members: P.members, L: 0, geom: { chains } }
    expect(unitsFor(base)).toHaveLength(38)
    expect(unitsFor({ ...base, porElemento: false })).toHaveLength(98)
    expect(unitsFor({ ...base, geom: null })).toHaveLength(98)
    const u = unitsFor({ ...base, excluir: ['1107'] })
    // la cadena 1099…1109 se rompe: sus 6 miembros restantes se analizan sueltos
    expect(u).toHaveLength(37 + 6)
    expect(u.some((x) => x.id === '1107')).toBe(false)
  })
  it('analyzeGroup por elemento con las L de la geometría: bastones en el elemento, no en el tramo', async () => {
    const nodes = await parseNodeXlsx(XLSX)
    const P = parseRamStations(T4)
    const geom = parseMemberGeometry(GEOM).rows
    const { Lpor } = memberLengths(geom, nodes)
    const chains = chainMembers(geom, nodes, P.members.map((m) => m.id))
    const T = { nombre: 'T-4', ancho: 15, peralte: 20, recub: 3, fc: 250, calSup: '3', cantSup: 2, calInf: '3', cantInf: 2, calBastonSup: '3', cantBastonSup: 0, calBastonInf: '3', cantBastonInf: 0, calEst: '2.5', sepLcuarto: 8, sepRest: 16, calc: { fy: 4200, varEstNum: 2.5, nramas: 2 } }
    const G = analyzeGroup(T, { members: P.members, L: 0, Lpor, geom: { chains }, porElemento: true })
    expect(G.n).toBe(38)
    expect(G.acero.mTotal).toBeCloseTo(Object.values(Lpor).reduce((s, v) => s + v, 0), 2)
    const e = G.results.find((r) => r.id.startsWith('1099'))
    expect(e.isElement).toBe(true)
    expect(e.members).toHaveLength(7)
    expect(e.L).toBeCloseTo(11.82, 1)
    // el pico de 1.78 t·m del M-1107 queda en el interior del elemento: el bastón no se ancla en un extremo
    const bar = e.sup.bars.find((b) => b.zone.peak === 1.78 || b.zones?.some((z) => z.peak === 1.78))
    expect(bar).toBeTruthy()
    expect(bar.x0).toBeGreaterThan(0)
    expect(bar.x1).toBeLessThan(e.L)
  })
})

// ── Reporte "Datos de Geometría" completo en un solo .txt ──
const JOF = readFileSync(join(here, 'fixtures', 'geometria_jofrito.txt'), 'utf-8')

describe('reporte Datos de Geometría completo (un solo .txt)', () => {
  it('separa las tablas y lee nudos y miembros del mismo archivo', () => {
    const g = parseGeometryReport(JOF)
    expect(g.tablas).toEqual(['nudos', 'restricciones', 'miembros', 'placas', 'nomenclatura'])
    expect(g.rows).toHaveLength(1448)
    expect(g.nodes.size).toBe(887)
    expect(g.nodes.get('1')).toEqual({ x: 18.6111, y: 3, z: 21.4596 })
    expect(g.rows[0]).toMatchObject({ member: '10', nj: '281', nk: '282', descripcion: 'T2', seccion: 'RcBeam 15X25', material: "f'c 250" })
  })
  it('no confunde las filas de placas ni de restricciones con miembros', () => {
    const g = parseGeometryReport(JOF)
    expect(g.rows.every((r) => /^\d+$/.test(r.nj) && /^\d+$/.test(r.nk))).toBe(true)
    expect(g.rows.some((r) => /CAPA/.test(r.descripcion))).toBe(false)
  })
  it('respeta secciones con doble espacio ("COL  25 X 10") y no arrastra las columnas numéricas', () => {
    const g = parseGeometryReport(JOF)
    const col = g.rows.filter((r) => r.seccion === 'COL  25 X 10')
    expect(col).toHaveLength(3)
    expect(sectionDims(col[0].seccion)).toEqual({ b: 25, h: 10 })
    expect([...new Set(g.rows.map((r) => r.material))]).toEqual(["f'c 250"])
  })
  it('con un solo archivo saca todas las longitudes', () => {
    const g = parseGeometryReport(JOF)
    const { Lpor, missing } = memberLengths(g.rows, g.nodes)
    expect(missing).toHaveLength(0)
    expect(Object.keys(Lpor)).toHaveLength(1448)
    expect(Lpor['10']).toBeCloseTo(5.92, 2)
  })
  it('convierte a metros si la tabla de nudos viene en cm', () => {
    const txt = 'Nudos\n\nNudo   X   Y   Z\n      [cm] [cm] [cm]\n---\n1  100.00  0.00  250.00\n\nMiembros\n\nMiembro NJ NK Descripción\n1  1  1  T1\n'
    const g = parseGeometryReport(txt)
    expect(g.nodes.get('1')).toEqual({ x: 1, y: 0, z: 2.5 })
    expect(g.warnings[0]).toMatch(/cm/)
  })
  it('una tabla suelta sin título se sigue reconociendo por su forma', () => {
    const solo = parseGeometryReport(GEOM)
    expect(solo.rows).toHaveLength(98)
    expect(solo.nodes.size).toBe(0)
  })
  it('attachGeometry pega longitudes, secciones y elementos al perfil, y respeta las L capturadas a mano', () => {
    const g = parseGeometryReport(JOF)
    const model = { rows: g.rows, nodes: Object.fromEntries(g.nodes) }
    const ids = ['10', '11', '12']
    const p = attachGeometry({ members: ids.map((id) => ({ id, stations: [] })), Lpor: { 12: 9.99 } }, model)
    expect(p.Lpor['10']).toBeCloseTo(5.92, 2)
    expect(p.Lpor['12']).toBe(9.99)        // la captura a mano manda
    expect(p.secPor['10']).toBe('RcBeam 15X25')
    expect(p.geom.chains.length).toBeGreaterThan(0)
    expect(attachGeometry(null, model)).toBe(null)
    expect(attachGeometry({ members: [] }, model)).toEqual({ members: [] })
  })
})

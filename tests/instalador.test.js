import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generarInstaladorCatalogo, catalogoComoPython } from '../src/core/ramScript.js'
import { datosCatalogo, SECCIONES_RAM, MAMPOSTERIA_RAM } from '../src/core/catalogoRam.js'

const here = dirname(fileURLToPath(import.meta.url))
const REPO = readFileSync(join(here, '..', 'scripts', 'ram', 'instalar_catalogo.py'), 'utf-8')

describe('instalar_catalogo.py', () => {
  it('lleva el catálogo entero dentro', () => {
    const r = generarInstaladorCatalogo()
    expect(r.ok).toBe(true)
    expect(r.nombre).toBe('instalar_catalogo.py')
    for (const s of SECCIONES_RAM) expect(r.texto).toContain(`"nombre": "${s.nombre}"`)
    expect(r.texto).toContain(`"nombre": "F'C 400"`)
  })

  it('la copia del repositorio no se ha quedado atrás del catálogo', () => {
    // si esto falla: se cambió catalogoRam.js sin regenerar el .py del repositorio
    expect(REPO).toContain(catalogoComoPython())
    expect(generarInstaladorCatalogo().texto).toBe(REPO)
  })

  it('los materiales, con el formato que usa RAM en Concreto.mat', () => {
    const m = datosCatalogo().materiales.find((x) => x.nombre === "F'C 250")
    expect(m.FcH).toBe('250')
    expect(m.FytH).toBe('4200')
    expect(m.Alpha).toBe('1E-5')
    expect(m.E.startsWith('221359.436211786')).toBe(true)
    expect(m.RCRegion).toBe('US')
  })

  it('la mampostería para placas: tabique, block hueco, block macizo y Covintec (NTC-Mampostería)', () => {
    const m = Object.fromEntries(datosCatalogo().mamposteria.map((x) => [x.nombre, x]))
    expect(Object.keys(m)).toEqual(['TABIQUE', 'BLOCK HUECO', 'BLOCK MACIZO', 'COVINTEC'])
    // barro: Em = 600 f'm; concreto: Em = 800 f'm; Gm = 0.4 Em → ν = 0.25
    expect(m.TABIQUE).toMatchObject({ tabla: 'Mampostería de barro', plantilla: 'clay', Fm: 15, E: 9000, G: 3600, U: 0.25, W: 0.0015 })
    expect(m['BLOCK HUECO']).toMatchObject({ tabla: 'Mampostería de concreto', plantilla: 'concrete', Fm: 15, E: 12000, G: 4800, W: 0.0014 })
    expect(m['BLOCK MACIZO']).toMatchObject({ plantilla: 'concrete', E: 12000, W: 0.0021 })
    // el de Covintec lo dio la oficina: 0.0012 kg/cm³
    expect(m.COVINTEC).toMatchObject({ plantilla: 'concrete', W: 0.0012, E: 32000, U: 0.2 })
    expect(m.COVINTEC.G).toBeCloseTo(32000 / 2.4, 6)
    for (const x of MAMPOSTERIA_RAM) expect(x.fy).toBe(4200)
    const r = generarInstaladorCatalogo()
    expect(r.texto).toContain('"nombre": "COVINTEC"')
    expect(r.texto).toContain('def instalar_mamposteria(')
  })

  it('el .py no depende de barras invertidas raras ni trae tabuladores', () => {
    expect(REPO.includes('\t')).toBe(false)
    expect(REPO.split('\n')[0]).toBe('# -*- coding: utf-8 -*-')
  })
})

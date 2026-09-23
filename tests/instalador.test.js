import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generarInstaladorCatalogo, catalogoComoPython } from '../src/core/ramScript.js'
import { datosCatalogo, SECCIONES_RAM } from '../src/core/catalogoRam.js'

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

  it('el .py no depende de barras invertidas raras ni trae tabuladores', () => {
    expect(REPO.includes('\t')).toBe(false)
    expect(REPO.split('\n')[0]).toBe('# -*- coding: utf-8 -*-')
  })
})

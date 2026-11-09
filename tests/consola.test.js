// La consola opera la app con los mismos motores que los botones: los
// ejercicios de agente/referencia/09-practica.md tienen que salir iguales.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { ejecutar } from '../src/core/consola'
import { partir, leerArgs, buscarChip } from '../src/core/consola/comandos'
import useConsola from '../src/core/consola/registro'
import useBeamStore from '../src/store/useBeamStore'
import useColumnStore from '../src/store/useColumnStore'

const MODELO = readFileSync(new URL('../agente/ejemplos/modelo.json', import.meta.url), 'utf8')

describe('lectura de la línea', () => {
  it('parte palabras, opciones y banderas', () => {
    expect(partir('fijar T-1 inf=3#4 "dos palabras" --json')).toEqual(['fijar', 'T-1', 'inf=3#4', 'dos palabras', '--json'])
    const a = leerArgs(['T-1', 'inf=3#4', 'EST=2.5@8/16', '--Quieto'])
    expect(a.pos).toEqual(['T-1'])
    expect(a.kv).toEqual({ inf: '3#4', est: '2.5@8/16' })
    expect(a.flags.has('quieto')).toBe(true)
  })

  it('un comando que no existe no truena', async () => {
    const r = await ejecutar('volar T-1')
    expect(r.ok).toBe(false)
    expect(r.texto).toMatch(/ayuda/)
  })

  it('ayuda lista los comandos', async () => {
    const r = await ejecutar('ayuda')
    expect(r.ok).toBe(true)
    for (const c of ['ram', 'grupos', 'fijar', 'calculo', 'columnas', 'longitudinal', 'deflexiones', 'bd', 'agrupar', 'resultados', 'exportar']) {
      expect(r.texto).toContain(c)
    }
  })
})

describe('el edificio de ejemplo por la consola (09-practica.md)', () => {
  beforeAll(() => {
    useBeamStore.getState().loadProject([], null)
    useColumnStore.getState().loadColumns([])
    useConsola.getState().limpiar()
  })

  it('ejercicio 1: cargar el modelo', async () => {
    const r = await ejecutar('ram cargar', { origen: 'api', datos: { texto: MODELO, nombre: 'modelo.json' } })
    expect(r.ok).toBe(true)
    expect(r.texto).toContain('modelo.json: 7 grupo(s) · 240 miembros · 201 nudos · CD / CSX / CSXN / CSZ / CSZN · 12 apoyos')
    expect(r.texto).toContain('7 grupo(s) sin sección en el proyecto')
    expect(r.datos.faltan.sort()).toEqual(['C1', 'C2', 'T1', 'T2', 'T3', 'T4', 'T5'])
  })

  it('ejercicio 1: crear las 7 secciones con su armado propuesto', async () => {
    const r = await ejecutar('ram crear')
    expect(r.ok).toBe(true)
    expect(r.texto).toContain('Creadas 7 sección(es) con su armado PROPUESTO: 7 pasan')
    expect(r.texto).toContain('T-4 15×40 · ')
    expect(r.texto).toContain('inf 3#4 + 2#4 puntual · sup 3#4 + 3#4 puntual · E#2.5 @18/18')
    expect(r.texto).toContain('T-2 20×40')
    expect(r.texto).toContain('inf 2#4 + 2#4 puntual · sup 3#5 + 2#5 puntual · E#2.5 @18/18')
    expect(r.texto).toContain('8#5 (ρ 1.76 %)')
    expect(r.texto).toContain('4#6 (ρ 1.82 %)')
    expect(useBeamStore.getState().sections).toHaveLength(5)
    expect(useColumnStore.getState().columns).toHaveLength(2)
  })

  it('grupos y miembros', async () => {
    const g = await ejecutar('grupos --json')
    expect(JSON.parse(g.salida).trabes.map((t) => t.chip).sort()).toEqual(['T-1', 'T-2', 'T-3', 'T-4', 'T-5'])
    const m = await ejecutar('miembros t2')
    expect(m.ok).toBe(true)
    expect(m.datos.miembros.length).toBeGreaterThan(0)
  })

  it('ejercicio 2: Calculo y Longitudinal de T-2', async () => {
    const c = await ejecutar('calculo T-2')
    expect(c.ok).toBe(true)
    expect(c.datos.fuente).toBe('envolvente')
    expect(c.datos.MRP).toBeGreaterThan(0)
    expect(c.datos.dc).toBeGreaterThan(0)
    const l = await ejecutar('longitudinal T-2')
    expect(l.ok).toBe(true)
    expect(l.datos.n).toBe(2)
    expect(l.datos.ok).toBe(0)
    expect(l.datos.conBaston).toBe(2)
    expect(l.datos.kg).toBe(202)
  })

  it('ejercicio 3: columnas', async () => {
    const r = await ejecutar('columnas C-1')
    expect(r.ok).toBe(true)
    expect(r.datos.fuente).toBe('envolvente')
    expect(r.datos.ok).toBe(true)
    expect(r.datos.dc).toBeLessThanOrEqual(1)
  })

  it('ejercicio 4: agrupación (sólo propuesta)', async () => {
    const r = await ejecutar('agrupar')
    expect(r.ok).toBe(true)
    expect(r.texto).toContain('hoy 5 grupo(s), 15.87 m³')
    const P = Object.fromEntries(r.datos.propuestas.map((p) => [p.id, p]))
    expect(P.pocos.grupos).toHaveLength(2)
    expect(P.equilibrada.grupos).toHaveLength(3)
    expect(P.ajustada.grupos).toHaveLength(5)
    expect(P.pocos.concreto.toFixed(2)).toBe('19.39')
    expect(P.equilibrada.concreto.toFixed(2)).toBe('16.52')
    expect(P.ajustada.concreto.toFixed(2)).toBe('15.61')
    expect(r.texto).toMatch(/la consola no lo hace/)
  })

  it('ejercicio 5: deflexiones', async () => {
    const r = await ejecutar('deflexiones')
    expect(r.ok).toBe(true)
    expect(r.datos.formula).toBe('CS = 1·CM + 1·CV')
    expect(r.datos.tramos).toBe(51)
    expect(r.datos.noPasan).toBe(3)
    expect(r.datos.lista[0].grupo).toBe('T5')
    expect(Math.round(r.datos.lista[0].u.post * 100)).toBe(121)
  })

  it('resultados: demanda/capacidad de todo', async () => {
    const r = await ejecutar('dc')
    expect(r.ok).toBe(true)
    expect(r.datos.trabes).toHaveLength(5)
    expect(r.datos.columnas).toHaveLength(2)
    expect(r.texto.split('\n')).toHaveLength(1 + 5 + 2)
  })

  it('fijar el armado de una trabe: queda como propuesto y se revisa', async () => {
    const r = await ejecutar('fijar T-5 inf=3#4 est=2.5@10/15')
    expect(r.ok).toBe(true)
    const t = buscarChip('T-5').chip
    expect(t.cantInf).toBe(3)
    expect(t.calInf).toBe('4')
    expect(t.calc.varPCount).toBe(3)       // el gemelo de la calculadora, al día
    expect(t.sepLcuarto).toBe(10)
    expect(t.sepRest).toBe(15)
    expect(t.armadoPropuesto).toBe(true)
    expect(r.texto).not.toMatch(/Cambió la sección/)
  })

  it('fijar la sección avisa que el cambio va a RAM', async () => {
    const r = await ejecutar('fijar T-5 h=40')
    expect(r.ok).toBe(true)
    expect(r.texto).toMatch(/Cambió la sección/)
    expect(buscarChip('T-5').chip.peralte).toBe(40)
  })

  it('fijar rechaza lo que la app no tiene', async () => {
    expect((await ejecutar('fijar T-5 inf=3#7')).ok).toBe(false)
    expect((await ejecutar('fijar T-5 est=5@10/15')).ok).toBe(false)
    expect((await ejecutar('fijar T-5 color=rojo')).ok).toBe(false)
    expect((await ejecutar('fijar T-9 inf=3#4')).ok).toBe(false)
  })

  it('fijar los lechos de una columna', async () => {
    const r = await ejecutar('fijar C-2 lechos=3#5,2#5,3#5 est=3')
    expect(r.ok).toBe(true)
    const c = buscarChip('C-2').chip
    expect(c.nLechos).toBe(3)
    expect(c.lechos).toEqual([{ n: 3, num: '5' }, { n: 2, num: '5' }, { n: 3, num: '5' }])
    expect(c.estriboNum).toBe('3')
    expect(c.armadoPropuesto).toBe(true)
  })

  it('el registro guarda cada comando con su resultado', async () => {
    const ents = useConsola.getState().entradas
    expect(ents.length).toBeGreaterThan(5)
    expect(ents[0].origen).toBe('api')
    expect(ents.every((e) => e.estado !== 'corriendo')).toBe(true)
  })
})

describe('D/C de una trabe con bastones puntuales', () => {
  it('se mide con los puntuales y da aparte el de las corridas solas', async () => {
    const r = await ejecutar('calculo T-2')
    expect(r.datos.ok).toBe(true)
    expect(r.datos.conPuntual).toBeGreaterThan(0)
    expect(r.datos.dc).toBeLessThanOrEqual(1)
    expect(r.datos.dcCorridas).toBeGreaterThan(1)
    expect(r.texto).toMatch(/con puntuales \(corridas solas \d+ %\)/)
  })
})

describe('proyecto nuevo y abrir (autorizado por FB, 2026-11-09)', () => {
  // La pantalla no existe en estas pruebas: un sustituto hace lo que App
  // (applyProject) hace con los stores, para probar el comando.
  let nombreActual = 'Edificio de práctica'
  const recientes = []
  beforeAll(async () => {
    const { registrarUI } = await import('../src/core/consola/puente')
    const vaciar = (data) => {
      useBeamStore.getState().loadProject(data.sections || [], data.model || null)
      useColumnStore.getState().loadColumns(data.columns || [])
      nombreActual = data.projectName || ''
    }
    registrarUI({
      proyecto: () => nombreActual,
      nuevoProyecto: (nombre) => {
        const antes = useBeamStore.getState().sections.length + useColumnStore.getState().columns.length
        if (antes) recientes.push(nombreActual)
        vaciar({ projectName: nombre })
        return { aRecientes: antes ? nombreActual || 'Sin nombre' : null, nombre }
      },
      abrirProyecto: (data) => {
        if (!Array.isArray(data.sections)) return { invalido: true }
        vaciar(data)
        return { aRecientes: null, nombre: data.projectName }
      },
    })
  })

  it('proyecto nuevo deja uno vacío con su nombre y contesta el estado', async () => {
    expect(useBeamStore.getState().sections.length).toBeGreaterThan(0)
    const r = await ejecutar('proyecto nuevo CH-26-001 v11 gravedad i02')
    expect(r.ok).toBe(true)
    expect(r.datos.proyecto).toBe('CH-26-001 v11 gravedad i02')
    expect(r.texto).toContain('Proyecto nuevo «CH-26-001 v11 gravedad i02» · 0 trabes, 0 columnas')
    expect(r.texto).toContain('quedó en Recientes')
    expect(useBeamStore.getState().sections).toHaveLength(0)
    expect(useColumnStore.getState().columns).toHaveLength(0)
    expect(recientes).toEqual(['Edificio de práctica'])
    const e = await ejecutar('proyecto')
    expect(e.datos).toEqual({ proyecto: 'CH-26-001 v11 gravedad i02', trabes: 0, columnas: 0 })
  })

  it('después de proyecto nuevo, ram cargar y ram crear arman todo otra vez', async () => {
    expect((await ejecutar('ram cargar', { origen: 'api', datos: { texto: MODELO } })).ok).toBe(true)
    const c = await ejecutar('ram crear')
    expect(c.texto).toContain('Creadas 7 sección(es)')
  })

  it('proyecto abrir carga un proyecto.json y rechaza lo que no lo es', async () => {
    const proy = { projectName: 'Prueba', sections: [], columns: [] }
    const r = await ejecutar('proyecto abrir', { datos: { texto: JSON.stringify(proy), nombre: 'prueba.json' } })
    expect(r.ok).toBe(true)
    expect(r.texto).toContain('Abierto prueba.json: proyecto «Prueba» · 0 trabes, 0 columnas')
    expect((await ejecutar('proyecto abrir', { datos: { texto: '{no es json' } })).ok).toBe(false)
    expect((await ejecutar('proyecto abrir', { datos: { texto: '{"hola":1}' } })).ok).toBe(false)
    expect((await ejecutar('proyecto abrir')).ok).toBe(false)
  })

  it('el registro deja constancia de proyecto nuevo', () => {
    expect(useConsola.getState().entradas.some((e) => e.linea.startsWith('proyecto nuevo') && e.estado !== 'error')).toBe(true)
  })
})

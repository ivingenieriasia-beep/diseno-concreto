import { describe, it, expect } from 'vitest'
import { generarScriptRam, normalizarRuta, esRutaWindows, nombreCarpeta } from '../src/core/ramScript.js'

// La ruta la captura la app —donde pegarla es natural— y sale un .py con
// ella dentro. Que no se pueda romper es el punto: editarlo a mano ya
// reventó una vez con SyntaxError en \Users.
describe('generar el script de RAM desde la app', () => {
  const RUTA = 'C:\\Users\\Admin\\OneDrive\\IV INGENIERÍAS\\PROYECTOS\\DISEÑOS\\RS-Jofrito (Departamentos simétricos)\\PROCESO\\Reportes de Secciones RAM'

  it('limpia lo que pega Windows al copiar una ruta', () => {
    expect(normalizarRuta('  "C:\\Users\\Admin"  ')).toBe('C:\\Users\\Admin')
    expect(normalizarRuta('C:\\Users\\Admin\\')).toBe('C:\\Users\\Admin')
    expect(normalizarRuta("'C:/a/b/'")).toBe('C:/a/b')
    expect(normalizarRuta('')).toBe('')
  })

  it('reconoce una ruta de Windows y rechaza lo que no lo es', () => {
    expect(esRutaWindows(RUTA)).toBe(true)
    expect(esRutaWindows('D:/proyectos/x')).toBe(true)
    expect(esRutaWindows('\\\\servidor\\obras\\x')).toBe(true)
    expect(esRutaWindows('/home/user/cosas')).toBe(false)
    expect(esRutaWindows('Reportes de Secciones RAM')).toBe(false)
    expect(esRutaWindows('')).toBe(false)
  })

  it('el nombre de la carpeta sirve para contrastarlo con el del selector', () => {
    expect(nombreCarpeta(RUTA)).toBe('Reportes de Secciones RAM')
    expect(nombreCarpeta('C:/a/b/')).toBe('b')
  })

  it('mete la ruta en el script, con barras normales para que no se rompa', () => {
    const r = generarScriptRam(RUTA, { proyecto: 'Jofrito' })
    expect(r.ok).toBe(true)
    expect(r.nombre).toBe('sincronizar.py')
    // la línea de CARPETA, con la ruta real y sin una sola barra invertida
    const linea = r.texto.split('\n').find((l) => /^CARPETA\s*=/.test(l))
    expect(linea).toBe("CARPETA = 'C:/Users/Admin/OneDrive/IV INGENIERÍAS/PROYECTOS/DISEÑOS/RS-Jofrito (Departamentos simétricos)/PROCESO/Reportes de Secciones RAM'")
    expect(linea).not.toContain('\\')
    // y sólo una: no quedan dos definiciones peleándose
    expect(r.texto.split('\n').filter((l) => /^CARPETA\s*=/.test(l))).toHaveLength(1)
  })

  it('el script generado sigue siendo Python válido de principio a fin', () => {
    const r = generarScriptRam(RUTA)
    // la línea de codificación tiene que seguir siendo la primera de todas
    expect(r.texto.split('\n')[0]).toMatch(/^# -\*- coding: utf-8 -\*-/)
    expect(r.texto).toContain('Generado por Auxiliar IV')
    expect(r.texto).toContain('def exportar(')
    expect(r.texto).toContain('member_forces_at_station')
    expect(r.texto.length).toBeGreaterThan(10000)
  })

  it('no genera nada con una ruta que no sirve', () => {
    expect(generarScriptRam('').ok).toBe(false)
    expect(generarScriptRam('').aviso).toMatch(/Falta la ruta/)
    expect(generarScriptRam('mis documentos').aviso).toMatch(/no parece una ruta de Windows/)
    expect(generarScriptRam("C:\\a'b").aviso).toMatch(/comilla simple/)
  })

  it('la cabecera dice de dónde salió y cómo usarlo', () => {
    const r = generarScriptRam(RUTA, { proyecto: 'Jofrito' })
    expect(r.texto).toContain('para «Jofrito»')
    expect(r.texto).toContain('Abrir Script… → Ctrl+R')
    expect(r.ruta).toBe(RUTA)
  })
})

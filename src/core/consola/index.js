// ══════════════════════════════════════════════════════════════
// Consola de Auxiliar: ejecutar una línea y la API para el agente.
//
//   await auxiliarIV.cmd('calculo T-1')          → texto corto
//   await auxiliarIV.cmd('grupos --json')        → el mismo resultado en JSON
//   await auxiliarIV.json('resultados')          → { ok, texto, datos }
//   await auxiliarIV.cmd('ram cargar', { texto }) → aplica un modelo.json pasado aparte
//
// Todo lo que entra por aquí queda en el registro de la consola, así que el
// ingeniero ve en vivo qué hizo el agente y la pantalla se actualiza sola.
// ══════════════════════════════════════════════════════════════

import { APP_VERSION } from '../constants'
import useConsola from './registro'
import { partir, leerArgs, comando, ayuda, COMANDOS } from './comandos'

const mal = (texto) => ({ ok: false, texto, datos: null })

/** ¿Sigue a la vista la pantalla de usuario y contraseña? */
function enPantallaDeEntrada() {
  if (typeof document === 'undefined') return false
  const g = document.getElementById('iv-auth-gate')
  return !!g && g.style.display !== 'none'
}

/**
 * Ejecuta una línea de la consola.
 * @param origen  'consola' (alguien la escribió) o 'api' (un script o el agente)
 * @param datos   lo que no cabe en la línea: { texto, nombre } de un modelo.json, { ver:false }
 * @returns { ok, texto, datos }
 */
export async function ejecutar(linea, { origen = 'consola', datos = null } = {}) {
  const reg = useConsola.getState()
  const [cab, ...resto] = partir(linea)
  const k = String(cab || '').toLowerCase()
  if (k === 'limpiar' || k === 'cls' || k === 'clear') { reg.limpiar(); return { ok: true, texto: '', datos: null } }
  const id = reg.empezar(String(linea || '').trim() || 'ayuda', origen)
  const args = leerArgs(resto)
  let r
  try {
    if (origen === 'api' && enPantallaDeEntrada()) {
      r = mal('La app está en la pantalla de entrada: un ingeniero tiene que escribir el usuario y la contraseña.')
    } else if (!k || k === 'ayuda' || k === 'help' || k === '?') {
      r = ayuda(args.pos[0])
    } else {
      const c = comando(k)
      const ctx = { quieto: args.flags.has('quieto') || datos?.ver === false, datos: datos || null }
      r = c?.fn ? await c.fn(args, ctx) : mal(`No hay comando «${cab}». Escribe «ayuda».`)
    }
  } catch (e) {
    console.error(e)
    r = mal(`Error: ${e?.message || e}`)
  }
  const salida = args.flags.has('json') ? JSON.stringify(r.datos) : r.texto
  reg.terminar(id, { ok: r.ok, texto: salida })
  return { ...r, salida }
}

/** window.auxiliarIV: la consola sin clics, para el agente y para scripts */
export function instalarApi() {
  if (typeof window === 'undefined') return
  window.auxiliarIV = {
    version: APP_VERSION,
    /** Texto corto (o JSON con --json); los errores empiezan con ✗ */
    cmd: async (linea, datos) => {
      const r = await ejecutar(linea, { origen: 'api', datos })
      return r.ok ? r.salida : `✗ ${r.salida}`
    },
    /** { ok, texto, datos } */
    json: async (linea, datos) => {
      const r = await ejecutar(linea, { origen: 'api', datos })
      return { ok: r.ok, texto: r.texto, datos: r.datos }
    },
    comandos: () => COMANDOS.map((c) => c.uso),
    /** Las últimas n entradas del registro */
    registro: (n = 20) => useConsola.getState().entradas.slice(-n)
      .map((e) => ({ linea: e.linea, origen: e.origen, estado: e.estado, texto: e.texto, ms: e.ms })),
    abrir: () => useConsola.getState().abrir(),
    cerrar: () => useConsola.getState().cerrar(),
  }
}

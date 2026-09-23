// ══════════════════════════════════════════════════════════════
// Generar el script de RAM desde la app, con la carpeta del proyecto ya
// metida dentro.
//
// El reparto de papeles es el que impone cada entorno:
//   · el navegador SÍ tiene selector de carpetas, pero nunca revela la ruta
//     absoluta (es una decisión de seguridad, no un descuido);
//   · el Python de RAM SÍ conoce las rutas, pero va en caja de arena — sin
//     tkinter y con ctypes bloqueado — así que no puede abrir un diálogo.
//
// De ahí esto: la ruta se captura una vez en la app, donde pegarla es natural
// y donde podemos escribirla sin que se rompa, y sale un .py listo para dejar
// en la carpeta del proyecto. Cambiar de proyecto es generar otro.
//
// La ruta se escribe con barras normales a propósito: Windows las acepta en
// todas las funciones de os.path, y así no hay escapes que puedan reventar
// —que es justo lo que pasó al pedir que se editara el .py a mano:
//     CARPETA = 'C:\Users\...'
//     SyntaxError: 'unicodeescape' codec can't decode bytes...
// ══════════════════════════════════════════════════════════════

import PLANTILLA from '../../scripts/ram/sincronizar.py?raw'

/** Quita comillas, espacios y barras sobrantes de una ruta pegada a mano */
export function normalizarRuta(s) {
  let r = String(s || '').trim()
  // «Copiar como ruta» de Windows la entrega entre comillas
  if ((r.startsWith('"') && r.endsWith('"')) || (r.startsWith("'") && r.endsWith("'"))) {
    r = r.slice(1, -1).trim()
  }
  r = r.replace(/[\\/]+$/, '')          // sin barra final
  return r
}

/**
 * ¿Parece una ruta absoluta de Windows? Se aceptan las dos formas
 * (C:\… y \\servidor\…) y también con barras normales.
 */
export function esRutaWindows(s) {
  const r = normalizarRuta(s)
  return /^[A-Za-z]:[\\/]/.test(r) || /^\\\\[^\\/]+[\\/]/.test(r)
}

/** El nombre de la última carpeta, para poder contrastarlo con el del selector */
export function nombreCarpeta(s) {
  const r = normalizarRuta(s)
  const partes = r.split(/[\\/]+/).filter(Boolean)
  return partes.length ? partes[partes.length - 1] : ''
}

/**
 * El script de RAM con la carpeta dentro.
 * @param ruta     ruta absoluta de Windows, tal como se copia del explorador
 * @param proyecto nombre del proyecto, sólo para la cabecera
 * @returns {{ ok, texto, nombre, aviso }}
 */
export function generarScriptRam(ruta, { proyecto = '' } = {}) {
  const limpia = normalizarRuta(ruta)
  if (!limpia) return { ok: false, aviso: 'Falta la ruta de la carpeta.' }
  if (!esRutaWindows(limpia)) {
    return { ok: false, aviso: `«${limpia}» no parece una ruta de Windows (se espera algo como C:\\Users\\…).` }
  }
  // barras normales: Windows las entiende y no hay escapes que romper
  const paraPython = limpia.replace(/\\/g, '/')
  if (paraPython.includes("'")) {
    return { ok: false, aviso: 'La ruta lleva una comilla simple; renombra la carpeta o usa CARPETA a mano.' }
  }

  const linea = `CARPETA = '${paraPython}'`
  if (!/^CARPETA\s*=.*$/m.test(PLANTILLA)) {
    return { ok: false, aviso: 'La plantilla del script cambió y ya no trae la línea CARPETA.' }
  }
  let texto = PLANTILLA.replace(/^CARPETA\s*=.*$/m, linea)

  const cabecera = [
    '# ──────────────────────────────────────────────────────────────',
    `# Generado por Auxiliar IV${proyecto ? ` para «${proyecto}»` : ''} el ${new Date().toLocaleDateString('es-MX')}.`,
    '# La carpeta de destino ya viene puesta abajo, en CARPETA.',
    '# Déjalo en la carpeta del proyecto y córrelo desde:',
    '#   RAM Elements → Python Console → Abrir Script… → Ctrl+R',
    '# ──────────────────────────────────────────────────────────────',
    '',
  ].join('\n')
  // después de la línea de codificación, que tiene que seguir siendo la primera
  texto = texto.replace(/^(# -\*- coding: [^\n]*\n)/, `$1${cabecera}`)

  return {
    ok: true, texto, ruta: limpia,
    nombre: 'sincronizar.py',
    aviso: '',
  }
}

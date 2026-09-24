// ══════════════════════════════════════════════════════════════
// Cimentaciones: los tipos, cada uno con su motor
// ══════════════════════════════════════════════════════════════

import { nuevaAislada, revisarAislada, proponerAislada } from './aislada'
import { nuevaCorrida, revisarCorrida, proponerCorrida } from './corrida'
import { nuevaContratrabe, revisarContratrabe, proponerContratrabe } from './contratrabe'
import { nuevaContencion, revisarContencion, proponerContencion } from './contencion'
import { nuevaGravedad, revisarGravedad, proponerGravedad } from './gravedad'
import { nuevaMamposteria, revisarMamposteria, proponerMamposteria } from './mamposteria'
import { nuevaLiga, revisarLiga, proponerLiga } from './liga'
import { revisarEnEjes, proponerEnEjes } from './ejes'

// los que se pueden repetir en varios ejes: se revisan y se proponen en todos
const multi = (revisar, proponer) => ({
  revisar: (z, obra) => revisarEnEjes(revisar, z, obra),
  proponer: (z, obra) => proponerEnEjes(proponer, revisar, z, obra),
})

export const TIPOS_CIM = [
  { id: 'aislada', nombre: 'Zapata aislada', corto: 'Aislada', prefijo: 'Z', material: 'concreto', resumen: 'Céntrica, con momentos, de lindero o de esquina, con o sin trabe de liga.', nuevo: nuevaAislada, revisar: revisarAislada, proponer: proponerAislada },
  { id: 'corrida', nombre: 'Zapata corrida bajo muro', corto: 'Corrida', prefijo: 'ZC', material: 'concreto', resumen: 'Franja por metro bajo muro de mampostería o de concreto, central o de lindero; un diseño para varios ejes.', nuevo: nuevaCorrida, ...multi(revisarCorrida, proponerCorrida) },
  { id: 'contratrabe', nombre: 'Zapata corrida con contratrabe', corto: 'Contratrabe', prefijo: 'ZT', material: 'concreto', resumen: 'Bajo un eje de columnas: contratrabe como viga invertida y aleros, método rígido; un diseño para varios ejes.', nuevo: nuevaContratrabe, ...multi(revisarContratrabe, proponerContratrabe) },
  { id: 'liga', nombre: 'Contratrabe de liga', corto: 'Liga', prefijo: 'TL', material: 'concreto', resumen: 'Une las zapatas a la altura del dado, sin zapata propia: axial de liga, N·e de las de lindero y muro.', nuevo: nuevaLiga, ...multi(revisarLiga, proponerLiga) },
  { id: 'contencion', nombre: 'Muro de contención de concreto', corto: 'Contención', prefijo: 'MC', material: 'concreto', resumen: 'En voladizo: volteo, deslizamiento, presiones, pantalla con bastones, talón y punta.', nuevo: nuevaContencion, revisar: revisarContencion, proponer: proponerContencion },
  { id: 'gravedad', nombre: 'Muro de contención de mampostería', corto: 'Muro de piedra', prefijo: 'MM', material: 'mamposteria', resumen: 'Por gravedad, de piedra braza: estabilidad y juntas sin tensión.', nuevo: nuevaGravedad, revisar: revisarGravedad, proponer: proponerGravedad },
  { id: 'mamposteria', nombre: 'Cimiento de mampostería', corto: 'Mampostería', prefijo: 'CP', material: 'mamposteria', resumen: 'Cimiento corrido de piedra braza, interior o de lindero (NTC-Mampostería 8.4).', nuevo: nuevaMamposteria, revisar: revisarMamposteria, proponer: proponerMamposteria },
]

export const tipoCim = (id) => TIPOS_CIM.find((t) => t.id === id) || TIPOS_CIM[0]

/** Revisión que nunca revienta la pantalla: si algo falla, lo dice */
export function revisarCim(z, obra) {
  try {
    return tipoCim(z.tipo).revisar(z, obra)
  } catch (e) {
    console.error(e)
    return { tipo: z.tipo, ok: false, checks: [], secciones: [], avisos: [`No se pudo revisar: ${e.message}`], cant: {}, datos: null, resumen: '', error: true }
  }
}

/** Siguiente nombre libre con el prefijo del tipo: Z-1, Z-2… */
export function nombreLibre(tipo, existentes) {
  const pre = tipoCim(tipo).prefijo
  const usados = new Set(existentes.map((z) => z.nombre))
  for (let i = 1; ; i++) if (!usados.has(`${pre}-${i}`)) return `${pre}-${i}`
}

/** Un cimiento nuevo ya dimensionado y armado para sus cargas de fábrica */
export function crearCim(tipo, existentes = [], obra = {}, extra = {}) {
  const T = tipoCim(tipo)
  const z = { ...T.nuevo(nombreLibre(tipo, existentes)), ...extra }
  try { return { ...z, ...T.proponer(z, obra) } } catch { return z }
}

/** Resumen de estado para el chip: ok · aprovechamiento máximo */
export function estadoCim(R) {
  if (!R || R.error) return { tono: 'mal', u: Infinity }
  const u = Math.max(0, ...R.checks.filter((c) => Number.isFinite(c.u)).map((c) => c.u))
  return { tono: R.ok ? (u > 0.95 ? 'justo' : 'ok') : 'mal', u }
}

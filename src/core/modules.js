// ══════════════════════════════════════════════════════════════
// Registro de módulos
// El header sólo lleva lo del proyecto; las herramientas viven aquí y se
// abren desde el botón "Módulos" (o con ⌘K / Ctrl+K). Las de tipo
// "pestaña" se montan como pestaña cerrable junto a las fijas; las de
// tipo "ventana" abren una ventana aparte y no dejan pestaña.
// ══════════════════════════════════════════════════════════════

export const MODULOS = [
  {
    id: 'pesos',
    nombre: 'Pesos Unitarios',
    tipo: 'pestana',
    icono: 'capas',
    resumen: 'Bajada de cargas: recetas de losa, muros y presiones por área tributaria para RAM.',
    palabras: ['pesos', 'unitarios', 'cargas', 'losa', 'losas', 'muros', 'pretil', 'azotea', 'entrepiso', 'area', 'tributaria', 'ram', 'cm', 'cv', 'bajada'],
  },
  {
    id: 'longitudinal',
    nombre: 'Longitudinal',
    tipo: 'pestana',
    icono: 'alzado',
    resumen: 'Alzados de trabes por estaciones del modelo: bastones donde hacen falta y envolvente desarrollada.',
    palabras: ['longitudinal', 'alzado', 'alzados', 'bastones', 'estaciones', 'trabe', 'trabes', 'envolvente'],
  },
  {
    id: 'agrupacion',
    nombre: 'Agrupación',
    tipo: 'pestana',
    icono: 'grupos',
    resumen: 'De un modelo sin agrupar a unas pocas T: tres propuestas o tu propio acomodo en planta, con su sección, su armado y el script para aplicarlo en RAM.',
    palabras: ['agrupacion', 'agrupar', 'grupos', 'secciones', 'trabes', 'ram', 'propuesta', 'iteracion', 'estructuracion', 't1', 'manual', 'acomodo', 'planta'],
  },
  {
    id: 'deflexiones',
    nombre: 'Deflexiones',
    tipo: 'pestana',
    icono: 'flecha',
    resumen: 'Flechas de las trabes con los desplazamientos de RAM: inercia agrietada con su armado, diferidas y límites de la NTC.',
    palabras: ['deflexiones', 'deflexion', 'flechas', 'flecha', 'desplazamientos', 'servicio', 'ntc', 'l/240', 'l/480', 'diferidas', 'inercia', 'agrietada'],
  },
  {
    id: 'bdglobal',
    nombre: 'BD Global',
    tipo: 'pestana',
    icono: 'base',
    resumen: 'Base de datos de trabes ya resueltas: busca una sección por momento y úsala en el proyecto.',
    palabras: ['bd', 'base', 'datos', 'global', 'buscar', 'trabes', 'malla', 'momentos', 'seccion'],
  },
  {
    id: 'doublecheck',
    nombre: 'Double Check',
    tipo: 'ventana',
    icono: 'check',
    ventana: { url: 'double_check_estructural.html', target: 'iv_doublecheck', w: 1440, h: 900 },
    resumen: 'Revisión cruzada en ventana aparte. Se puede prellenar desde Verificar → Exportar a Double Check.',
    palabras: ['double', 'check', 'revision', 'cruzada', 'verificacion'],
  },
  {
    id: 'malla',
    nombre: 'Malla de Vigas',
    tipo: 'ventana',
    icono: 'malla',
    ventana: { url: 'MallaVigas.html', target: 'iv_malla', w: 1440, h: 900 },
    resumen: 'Generador de la malla de vigas que alimenta la BD Global.',
    palabras: ['malla', 'vigas', 'generador', 'fabrica'],
  },
]

export function getModulo(id) {
  return MODULOS.find((m) => m.id === id) || null
}

/** Normaliza para buscar sin acentos ni mayúsculas. */
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Filtro del buscador del launcher: nombre, resumen y palabras clave. */
export function buscarModulos(q) {
  const t = norm(q).trim()
  if (!t) return MODULOS
  const partes = t.split(/\s+/)
  return MODULOS.filter((m) => {
    const heno = norm(`${m.nombre} ${m.resumen} ${m.palabras.join(' ')}`)
    return partes.every((p) => heno.includes(p))
  })
}

/** Abre una herramienta que vive en su propia ventana, centrada y reutilizable. */
export function abrirVentana(mod) {
  const cfg = mod?.ventana
  if (!cfg || typeof window === 'undefined') return null
  const w = Math.min(cfg.w || 1200, window.screen.availWidth)
  const h = Math.min(cfg.h || 800, window.screen.availHeight)
  const left = Math.max(0, (window.screen.availWidth - w) / 2)
  const top = Math.max(0, (window.screen.availHeight - h) / 2)
  const win = window.open(cfg.url, cfg.target, `width=${w},height=${h},left=${left},top=${top}`)
  win?.focus()
  return win
}

// ── Pestañas abiertas: se recuerdan entre sesiones ───────────
const LS_TABS = 'iv_modulos_abiertos_v1'

export function cargarAbiertos() {
  try {
    const raw = localStorage.getItem(LS_TABS)
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter((id) => getModulo(id)?.tipo === 'pestana') : []
  } catch { return [] }
}

export function guardarAbiertos(ids) {
  try { localStorage.setItem(LS_TABS, JSON.stringify(ids)) } catch { /* cuota — silencioso */ }
}

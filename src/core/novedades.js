// ══════════════════════════════════════════════════════════════
// Novedades de la versión: lo que sale al pasar el cursor por "vX.Y"
// en la barra. Cada entrega (3.0, 3.1…) se escribe arriba de la anterior.
// El log se reinicia con el número entero: al pasar a la 4 se abre uno
// nuevo con sus propias entregas y lo de la 3 ya no se muestra.
// ══════════════════════════════════════════════════════════════

import { APP_VERSION } from './constants'
import imgSincronizar from '../assets/novedades/sincronizar.webp'
import imgAgrTrabes from '../assets/novedades/agr-trabes.webp'
import imgAgrColumnas from '../assets/novedades/agr-columnas.webp'
import imgDeflexiones from '../assets/novedades/deflexiones.webp'

export const TIPOS = {
  nuevo: { etiqueta: 'NUEVO', fondo: '#dcf3ec', color: '#1a7a5e' },
  mejora: { etiqueta: 'MEJORA', fondo: '#e3ecf8', color: '#2563a8' },
  arreglo: { etiqueta: 'CORRECCIÓN', fondo: '#f9e6df', color: '#b8461f' },
}

/**
 * Una entrega por versión: `destacados` son las tarjetas grandes (pueden
 * llevar imagen, con `alt`), `cambios` la lista corta de abajo y `aviso`
 * lo que hay que hacer para aprovecharla.
 */
export const NOVEDADES = [
  {
    version: '3.0',
    fecha: '2026-09-23',
    lema: 'Auxiliar IV ya trabaja junto con RAM Elements: del modelo sin agrupar a trabes y columnas armadas, y de regreso a RAM con un script.',
    aviso: 'Para tenerlo todo, vuelve a generar sincronizar.py desde la app (Reportes de RAM → Configurar RAM), córrelo en RAM y sincroniza.',
    destacados: [
      {
        tipo: 'nuevo',
        titulo: 'Sincronizar con RAM Elements',
        texto: 'Un script lee el modelo entero: geometría, secciones, combinaciones, fuerzas por estación y desplazamientos. La app lo carga con un clic y cada trabe llega con su armado propuesto.',
        donde: 'Reportes de RAM → Desde RAM',
        img: imgSincronizar,
        alt: 'Configurar RAM con la ruta de la obra ya cargada',
      },
      {
        tipo: 'nuevo',
        titulo: 'Agrupación de trabes',
        texto: 'De un modelo sin agrupar a unas pocas T por flexión y cortante: tres propuestas o tu propio acomodo en planta, con buscador por miembro, escala de aprovechamiento y el script que lo aplica en RAM, con su Deshacer.',
        donde: 'Módulos → Agrupación → Trabes',
        img: imgAgrTrabes,
        alt: 'Plantas de los tres niveles con cada grupo de trabes en su color',
      },
      {
        tipo: 'nuevo',
        titulo: 'Agrupación de columnas',
        texto: 'Cada columna se ubica en el diagrama de interacción con P, M22 y M33 de la misma combinación, y se agrupa por umbrales igual que las trabes. Por entrepiso o con la misma sección en toda la altura.',
        donde: 'Módulos → Agrupación → Columnas',
        img: imgAgrColumnas,
        alt: 'Diagramas P–Mx y P–My de un grupo de columnas con sus puntos',
      },
      {
        tipo: 'nuevo',
        titulo: 'Deflexiones',
        texto: 'La flecha de cada tramo con los desplazamientos de RAM: inercia agrietada con su armado, diferidas y los límites de la NTC (L/240 y L/480 + 0.3 cm), con la carga de servicio CS = 1·CM + 1·CV.',
        donde: 'Módulos → Deflexiones',
        img: imgDeflexiones,
        alt: 'Tabla de tramos con la flecha inmediata, la diferida y el límite',
      },
    ],
    cambios: [
      { tipo: 'nuevo', texto: 'Carpeta de la obra: crear-proyectoiv.bat arma PROCESO\\Auxiliar IV con su árbol, y la app y los scripts saben dónde leer y dónde dejar cada cosa.' },
      { tipo: 'nuevo', texto: 'Catálogo de la casa en RAM: instalar_catalogo.py da de alta nuestras secciones y concretos en el grupo Personales, con sus medidas reales.' },
      { tipo: 'nuevo', texto: 'Edificio de prueba desde la consola de Python de RAM, para ensayar el flujo completo sin tocar una obra.' },
      { tipo: 'nuevo', texto: 'Manual del equipo en PDF: Auxiliar IV con RAM Elements, paso a paso y con capturas.' },
      { tipo: 'mejora', texto: 'Columnas: se revisan con P, M22 y M33 simultáneos de cada combinación, y los informes listan el punto que rige de cada miembro.' },
      { tipo: 'mejora', texto: 'Columnas: estribos por zonas, con la altura que da el modelo.' },
      { tipo: 'mejora', texto: 'Longitudinal: momentos con la convención de RAM y cortante con su signo.' },
      { tipo: 'mejora', texto: 'La pestaña Detalle ahora se llama Secciones, y borrar una sección desde su chip pide confirmación.' },
      { tipo: 'arreglo', texto: 'aplicar_agrupacion.py: si RAM no deja devolver una sección al probar, lo dice tal cual y pide cerrar sin guardar, en vez de reportar que no tocó nada.' },
    ],
  },
]

/** El número entero de una versión: '3.1' → 3. */
export const mayorDe = (v) => parseInt(String(v).split('.')[0], 10) || 0

/** Compara '3.10' con '3.9' como números, parte por parte. */
export function compararVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

/**
 * El log que se muestra: las entregas de la versión mayor vigente, de la más
 * nueva a la más vieja, sin las que todavía no salen.
 */
export function logVigente(version = APP_VERSION, lista = NOVEDADES) {
  const mayor = mayorDe(version)
  const entregas = lista
    .filter((e) => mayorDe(e.version) === mayor && compararVersion(e.version, version) <= 0)
    .sort((a, b) => compararVersion(b.version, a.version))
  const cuenta = (k) => entregas.reduce((s, e) => s + (e[k]?.length || 0), 0)
  return { mayor, entregas, destacados: cuenta('destacados'), cambios: cuenta('cambios') }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** '2026-09-23' → '23 sep 2026' */
export function fechaCorta(iso) {
  const [a, m, d] = String(iso).split('-').map((n) => parseInt(n, 10))
  return a && m && d ? `${d} ${MESES[m - 1]} ${a}` : String(iso || '')
}

// Qué versión ya leyó quien usa la app: mientras no la lea, la barra la marca.
export const CLAVE_VISTA = 'auxiv.novedades.vista'
export function leerVista() {
  try { return localStorage.getItem(CLAVE_VISTA) || '' } catch { return '' }
}
export function marcarVista(version = APP_VERSION) {
  try { localStorage.setItem(CLAVE_VISTA, version) } catch { /* sin almacenamiento: sólo se vuelve a marcar */ }
}

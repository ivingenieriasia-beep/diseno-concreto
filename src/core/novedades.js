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
import imgCimDetallador from '../assets/novedades/cim-detallador.webp'
import imgCimContencion from '../assets/novedades/cim-contencion.webp'
import imgCimRam from '../assets/novedades/cim-ram.webp'
import imgMemPrellenado from '../assets/novedades/mem-prellenado.webp'
import imgCimPlanta from '../assets/novedades/cim-planta.webp'
import imgCimLinderos from '../assets/novedades/cim-linderos.webp'
import imgCimLigaEjes from '../assets/novedades/cim-liga-ejes.webp'

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
    version: '3.06',
    fecha: '2026-09-24',
    lema: 'Cada zapata con su contratrabe de liga, mínimos de 0.60 m y el armado por separación o por cantidad.',
    destacados: [
      {
        tipo: 'nuevo',
        titulo: 'La contratrabe de liga de cada zapata: la CT-1',
        texto: 'Toda zapata aislada y toda corrida bajo muro de mampostería lleva su contratrabe de liga a la altura del tope del dado, con el lecho alto al nivel del terreno. Por omisión la CT-1 de la oficina (15 × 30, 4#4, E#2.5 @ 15, recubrimiento 3 cm y 5 abajo): sale en el corte, en su detalle, en la memoria y en el DXF. Se revisa con la liga del 10 % de la Pu, el N·e de las de lindero o, en la corrida, como dala de desplante; si no alcanza, ⚡ Proponer la diseña.',
        donde: 'Cimentaciones → el formulario de la zapata → Contratrabe de liga',
      },
      {
        tipo: 'nuevo',
        titulo: 'Armado por separación o por cantidad',
        texto: 'Junto a la separación (con flechas a cada 5 cm) va la cantidad de varillas: programas una y la otra se ve atenuada con lo que resulta. La cantidad programada se queda aunque cambies el ancho.',
        donde: 'Cimentaciones → Armado',
      },
    ],
    cambios: [
      { tipo: 'nuevo', texto: 'Mínimos de la oficina: ninguna zapata de menos de 0.60 m de ancho ni desplante de menos de 0.60 m. ⚡ Proponer no baja de ahí y la revisión lo marca.' },
      { tipo: 'mejora', texto: 'Contratrabe de liga independiente (TL): arranca en la CT-1 y crece sólo si las cargas lo piden; la regla del claro/20 del ACI queda como criterio opcional en Suelo y criterios.' },
      { tipo: 'arreglo', texto: 'Liga: recubrimiento de 3 cm arriba y a los lados y de 5 cm sólo abajo, contra el suelo (antes 5 parejo), y el ancho que piden las varillas con el recubrimiento de los lados.' },
      { tipo: 'arreglo', texto: 'instalar_catalogo.py no encontraba las tablas de mampostería de RAM: las de fábrica no traen la línea «//infotable» (y pueden venir con BOM o en UTF-16). Ahora las lee; si aun así no las halla, imprime un diagnóstico de lo que hay en las carpetas de materiales.' },
      { tipo: 'arreglo', texto: 'DXF: los superíndices salían «?» en AutoCAD (txt.shx no los trae): t/m² sale t/m2 y m³ sale m3; Δ, ≈, ½ y demás símbolos, con su equivalente en texto. Los acentos siguen como en la 3.05.' },
    ],
    aviso: 'Las zapatas de proyectos anteriores reciben la CT-1 al abrirlos; dale ⚡ Proponer a las de lindero para que su CT tome el N·e.',
  },
  {
    version: '3.05',
    fecha: '2026-09-24',
    lema: 'Mampostería para placas en el catálogo de RAM, y los DXF con sus acentos.',
    destacados: [
      {
        tipo: 'nuevo',
        titulo: 'Tabique, block y Covintec en el grupo Personales de RAM',
        texto: 'instalar_catalogo.py ahora también da de alta los materiales de mampostería para placas: TABIQUE (barro recocido), BLOCK HUECO y BLOCK MACIZO (concreto) con f′m = 15 kg/cm², Em = 600 u 800 f′m y Gm = 0.4 Em de la NTC-Mampostería, y COVINTEC con 1.2 t/m³. Toma el formato de las tablas «Masonry clay» y «Masonry concrete» de tu RAM y te dice qué columna llenó con qué.',
        donde: 'Reportes de RAM → ⚡ Desde RAM → ⚙ Configurar RAM → ⬇ instalar_catalogo.py',
      },
    ],
    cambios: [
      { tipo: 'arreglo', texto: 'DXF: los acentos, la ñ y los símbolos ya no salen como «?» en AutoCAD («Zapata céntrica», «sección», m², Δ). Vale para todos los planos: vigas, columnas, alzados y cimentaciones.' },
      { tipo: 'mejora', texto: 'En el DXF, «·» sale como «-», «×» como «x» y «≤» como «<=», que txt.shx sí dibuja; Ø, ° y ± con %%c, %%d y %%p.' },
    ],
    aviso: 'Para tener la mampostería en RAM, vuelve a descargar y correr instalar_catalogo.py (es seguro correrlo otra vez).',
  },
  {
    version: '3.04',
    fecha: '2026-09-24',
    lema: 'Contratrabes de liga, un mismo diseño en varios ejes y la planta de cimentación en grande.',
    destacados: [
      {
        tipo: 'nuevo',
        titulo: 'Contratrabe de liga y un diseño para varios ejes',
        texto: 'Elige un eje y crea una contratrabe de liga: une las zapatas a la altura del dado, no lleva zapata y se diseña con la liga de la oficina (10 % de la Pu en tensión y compresión), el N·e de las zapatas de lindero y el muro que cargue. Y una corrida, contratrabe o liga se puede aplicar a otros ejes: se revisa con lo de cada uno y ⚡ Proponer la hace cumplir en todos.',
        donde: 'Cimentaciones → ⚡ Desde RAM → Sobre un eje',
        img: imgCimLigaEjes,
        alt: 'Planta con una corrida en dos ejes, zapatas aisladas y una contratrabe de liga que las une',
      },
    ],
    cambios: [
      { tipo: 'nuevo', texto: 'Tipo nuevo: Contratrabe de liga (TL), con su alzado sobre los dados, su corte, su memoria y su DXF.' },
      { tipo: 'nuevo', texto: '«o el mismo diseño de…  ＋ en este eje»: agrega los apoyos elegidos como otro eje de una corrida, contratrabe o liga; su formulario lista los ejes y cada revisión dice cuál rige.' },
      { tipo: 'mejora', texto: 'La ventana de Desde RAM ocupa casi toda la pantalla y la planta crece con ella.' },
      { tipo: 'arreglo', texto: 'Las corridas y contratrabes desde RAM terminan a 0.5 m de la última columna (antes, media crujía), o al ras si el extremo cae en un lindero.' },
    ],
  },
  {
    version: '3.03',
    fecha: '2026-09-24',
    lema: 'Zapatas de lindero y de esquina desde la planta de cimentación.',
    destacados: [
      {
        tipo: 'nuevo',
        titulo: 'Linderos en la planta',
        texto: 'Marca qué lados de la planta son colindancia (clic en el lado o en su botón). Al crear, los apoyos sobre un lindero salen con zapata de lindero y los de dos lados con zapata de esquina, cada una girada hacia adentro con sus cargas en sus ejes: un mismo tipo sirve en los cuatro lados. Si marcas un lindero después, la planta dice qué zapatas pasan de él.',
        donde: 'Cimentaciones → ⚡ Desde RAM → Linderos',
        img: imgCimLinderos,
        alt: 'Planta con dos linderos marcados, zapatas de lindero y de esquina, y las que pasan de un tercer lindero marcadas en rojo',
      },
    ],
    cambios: [
      { tipo: 'nuevo', texto: 'Los tipos de zapata se agrupan por condición (céntrica, de lindero, de esquina) y la tabla de tipos lo dice.' },
      { tipo: 'nuevo', texto: 'Una corrida sobre un lindero sale de lindero (el muro a la orilla, la zapata hacia adentro); una contratrabe sobre un lindero avisa que se diseña centrada.' },
      { tipo: 'mejora', texto: 'Los linderos se guardan con el proyecto.' },
    ],
  },
  {
    version: '3.02',
    fecha: '2026-09-24',
    lema: 'Con el primer modelo real de RAM: la planta de cimentación, y el sismo, el cortante y el peso de la zapata en su lugar.',
    aviso: 'Las zapatas que se crearon desde RAM con la 3.01 conviene crearlas otra vez: ahora se revisan con el sismo descargando cada apoyo, con su cortante y con la reacción de cada uno.',
    destacados: [
      {
        tipo: 'nuevo',
        titulo: 'Planta de cimentación',
        texto: 'En ⚡ Desde RAM cada apoyo aparece con su cimiento a escala (aisladas, corridas y contratrabes), el % de utilización de cada uno con su propia reacción y cuántos faltan. Clic en un cimiento para abrirlo; si resincronizas un modelo más cargado, ahí se ve cuál ya no alcanza.',
        donde: 'Cimentaciones → ⚡ Desde RAM → Cimentación',
        img: imgCimPlanta,
        alt: 'Planta con una contratrabe y nueve zapatas, cada una con su porcentaje',
      },
    ],
    cambios: [
      { tipo: 'arreglo', texto: 'Signos de los momentos de RAM: con el sismo en +X la zapata se carga hacia +X. Antes, en X quedaba al revés, y en una contratrabe el momento de las columnas se restaba al volteo en vez de sumarse.' },
      { tipo: 'mejora', texto: 'El sismo carga y descarga cada columna: también se revisa CM + CV − S, la que rige en las de orilla.' },
      { tipo: 'mejora', texto: 'La excentricidad cuenta con el peso de la zapata y el relleno: e = (M + V h)/(N + W). Con carga centrada, idéntico a la hoja.' },
      { tipo: 'nuevo', texto: 'El cortante de la columna llega al desplante (M + V·h): Vx y Vy en la aislada, V en cada columna de la contratrabe.' },
      { tipo: 'mejora', texto: 'Una zapata tipo se revisa con cada uno de sus apoyos, no sólo con la envolvente: la esquina ligera puede mandar.' },
      { tipo: 'mejora', texto: 'La columna de cada apoyo sale del modelo con su sección real, en vez de 30 × 30.' },
    ],
  },
  {
    version: '3.01',
    fecha: '2026-09-24',
    lema: 'Llega Cimentaciones: zapatas, corridas, contratrabes, muros de contención y mampostería, dimensionados y armados con su memoria paso a paso, con tus cargas o con las reacciones de RAM.',
    aviso: 'Es la primera entrega del módulo: úsalo en obras reales y anota lo que falte. Para traer las reacciones por caso de carga, vuelve a generar sincronizar.py desde la app y sincroniza.',
    destacados: [
      {
        tipo: 'nuevo',
        titulo: 'Cimentaciones',
        texto: 'Seis tipos: zapata aislada (céntrica, de lindero o de esquina, con momentos y trabe de liga), corrida bajo muro, corrida con contratrabe, muro de contención de concreto y de piedra, y cimiento de mampostería. ⚡ Proponer dimensiona y arma con el criterio de nuestras hojas, corregido.',
        donde: 'Pestaña Cimentaciones, junto a Columnas',
        img: imgCimDetallador,
        alt: 'Zapata de lindero con su planta, su corte y las revisiones al lado',
      },
      {
        tipo: 'nuevo',
        titulo: 'Detallador que se arrastra',
        texto: 'Las manijas naranjas cambian las medidas a cada 5 cm, la columna se lleva al lindero con el mouse y un clic en una etiqueta cambia el # y la separación. Las revisiones se recalculan al instante y Ctrl+Z deshace.',
        donde: 'Cimentaciones → el dibujo de cada cimiento',
        img: imgCimContencion,
        alt: 'Corte de un muro de contención con sus manijas, empujes y presiones',
      },
      {
        tipo: 'nuevo',
        titulo: 'Desde las reacciones de RAM',
        texto: 'Los apoyos del modelo en planta con su carga de servicio. La app agrupa las columnas en los tipos de zapata que pidas, o arma una corrida o una contratrabe con los apoyos de un eje; cada cimiento recuerda de qué nudos salió.',
        donde: 'Cimentaciones → ⚡ Desde RAM',
        img: imgCimRam,
        alt: 'Planta con los doce apoyos del modelo y tres tipos de zapata',
      },
      {
        tipo: 'mejora',
        titulo: 'La Memoria se llena sola',
        texto: 'Niveles, altura de entrepiso y área salen del modelo de RAM; las cargas de losa, de muro y vivas, de Pesos Unitarios. La Memoria Word trae ya el capítulo de cimentación, con dibujos y revisiones.',
        donde: 'Verificar → Memoria de cálculo',
        img: imgMemPrellenado,
        alt: 'Datos del proyecto prellenados, cada uno con su origen',
      },
    ],
    cambios: [
      { tipo: 'nuevo', texto: 'Memoria de la cimentación en PDF: fórmula, sustitución y resultado de cada revisión, con el dibujo de cada cimiento y una tabla resumen.' },
      { tipo: 'nuevo', texto: 'Planos DXF por capas, a escala, y SVG, de un cimiento o de todos.' },
      { tipo: 'nuevo', texto: 'Suelo y criterios de la obra en un solo lugar, con la calculadora de capacidad de carga de Meyerhof.' },
      { tipo: 'nuevo', texto: 'Aplastamiento con arranques: si la columna pasa de lo que aguanta el concreto, la app dice cuánto acero debe anclar en la zapata.' },
      { tipo: 'mejora', texto: 'sincronizar.py lee las reacciones de cada caso de carga, además de las de cada combinación.' },
      { tipo: 'mejora', texto: 'Cuando no hay cimiento que cumpla (suelo muy pobre, columna chica, resultante fuera de la base), la revisión dice por qué y qué conviene.' },
      { tipo: 'arreglo', texto: 'Respecto de las hojas: la capacidad efectiva restaba t/m³ a kg/m²; la presión se revisa con el área efectiva de Meyerhof B′ = B − 2e; el factor de profundidad usa atan(Df/B).' },
    ],
  },
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

// ══════════════════════════════════════════════════════════════
// La marca de la app: IV Ingenierías (la de siempre) o SOGRUB.
//
// Se elige al compilar con VITE_MARCA (npm run build:sogrub usa
// .env.sogrub). Sin ella es IV, así que la app publicada no cambia.
// Sólo cambia lo que se ve: nombre, empresa, logo, el color de las
// líneas de los informes, el pie, la firma y la carpeta de la obra. Los formatos de archivo
// (proyecto.json, modelo.json «auxiliar-iv/ram») son los mismos en las dos.
// ══════════════════════════════════════════════════════════════

import LOGO_SOGRUB from '../assets/marca/sogrub.svg?raw'
import LOGO_SOGRUB_CORTO from '../assets/marca/sogrub-sin-isotipo.svg?raw'

const LOGO_IV = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 170">
  <rect x="18" y="10" width="22" height="90" fill="#1a1a2e"/>
  <rect x="8"  y="10" width="42" height="14" fill="#1a1a2e"/>
  <rect x="8"  y="86" width="42" height="14" fill="#1a1a2e"/>
  <polygon points="52,10 74,10 110,100 88,100" fill="#1a1a2e"/>
  <polygon points="148,10 170,10 128,100 106,100" fill="#1a1a2e"/>
  <rect x="111" y="28" width="10" height="52" rx="4" transform="rotate(-18,116,54)" fill="#4ecac4"/>
  <rect x="127" y="24" width="10" height="52" rx="4" transform="rotate(-18,132,50)" fill="#8a9ab0"/>
  <text x="100" y="148" text-anchor="middle" font-family="Arial,sans-serif"
    font-size="15" font-weight="800" letter-spacing="5" fill="#1a1a2e">INGENIERÍAS</text>
</svg>`

export const MARCAS = {
  iv: {
    id: 'iv',
    app: 'Auxiliar IV',
    empresa: 'IV Ingenierías',
    empresaMayus: 'IV INGENIERÍAS',
    carpeta: 'Auxiliar IV',
    acento: '#4ecac4',
    acentoTexto: '#1a7a5e',
    tinta: '#1b2349',
    logo: LOGO_IV,
    logoAncho: 48,      // px del logo en el encabezado de las memorias
    logoOpacidad: 0.85,
    fuenteWord: 'Calibri',
    pie: 'IV Ingenierías',
  },
  // SOGRUB Concreto: la marca aprobada el 25-oct-2026 (kit del CMO,
  // direcciones/cmo/trabajo/marca-auxiliares). Uso interno, sin lema.
  sogrub: {
    id: 'sogrub',
    app: 'SOGRUB Concreto',
    nombreCorto: 'Concreto',
    descripcion: 'Diseño y detallado de elementos de concreto reforzado',
    empresa: 'Grupo Constructor SOGRUB',
    empresaMayus: 'SOGRUB · GRUPO CONSTRUCTOR',
    razonSocial: 'Grupo Constructor SOGRUB, S.A.S. de C.V.',
    telefono: '442 385 5912',
    responsable: 'Ing. Fernando Burgos',
    carpeta: 'SOGRUB Concreto',
    acento: '#1A9DD9',       // líneas y filetes
    acentoTexto: '#0F6E9C',  // el azul claro sobre blanco no pasa para texto chico (3.06:1)
    tinta: '#29235C',        // marino del logotipo
    logo: LOGO_SOGRUB.trim(),            // horizontal a color
    logoCorto: LOGO_SOGRUB_CORTO.trim(), // sin isotipo: barras y sitios chicos
    logoAncho: 113,   // ≈ 30 mm, el mínimo del Manual en las memorias
    logoOpacidad: 1,  // el Manual no admite el logo atenuado
    fuenteWord: 'Aptos',   // el cuerpo del Word (Roboto no viaja dentro del .docx)
    pieEnHojas: true,       // pie con razón social y teléfono en cada hoja de Word y de PDF
    nombreEnLogo: true,    // el logotipo ya dice «Grupo Constructor»: no se repite debajo
    firmaRegistro: true,   // la firma lleva renglones para cédula y registro de Corresponsable/DRO, a mano
    pie: 'Grupo Constructor SOGRUB, S.A.S. de C.V. · Tel. 442 385 5912',
  },
}

const elegida = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_MARCA : undefined
export const MARCA = MARCAS[elegida] || MARCAS.iv

/** El logo listo para un <img src> */
export const logoDataUri = (m = MARCA) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(m.logo)))}`

/** '#1A9DD9' → [26, 157, 217] */
export const rgbDe = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16))

/** Sin acentos ni «·», para jsPDF con la fuente de fábrica */
export const enPdf = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/·/g, '-')

/**
 * Textos escritos con la marca IV (las plantillas de los scripts de RAM, las
 * novedades) pasados a la marca de esta compilación. Con IV no cambia nada.
 */
export function deMarca(texto, m = MARCA) {
  if (m.id === 'iv' || texto == null) return texto
  return String(texto)
    .replace(/IV Ingenierías/g, m.empresa)
    .replace(/IV INGENIER[IÍ]AS/g, m.empresaMayus)
    .replace(/Auxiliar IV/g, m.app)
    .replace(/crear-proyectoiv\.bat/g, `crear-proyecto${m.id}.bat`)
}

/**
 * Quién firma. El nombre que se captura en la memoria va con «Ing.»; si no
 * se capturó, el de la marca (SOGRUB: Ing. Fernando Burgos) o un renglón en blanco.
 */
export function firmante(responsable, m = MARCA) {
  const r = String(responsable ?? '').trim()
  if (r) return `Ing. ${r}`
  return m.responsable || 'Ing. ________________________'
}

/** El logo corto (sin isotipo) listo para un <img src>, o null si la marca no lo tiene */
export const logoCortoDataUri = (m = MARCA) => (m.logoCorto ? logoDataUri({ logo: m.logoCorto }) : null)

// ══════════════════════════════════════════════════════════════
// La marca de la app: IV Ingenierías (la de siempre) o SOGRUB.
//
// Se elige al compilar con VITE_MARCA (npm run build:sogrub usa
// .env.sogrub). Sin ella es IV, así que la app publicada no cambia.
// Sólo cambia lo que se ve: nombre, empresa, logo, el color de las
// líneas de los informes y la carpeta de la obra. Los formatos de archivo
// (proyecto.json, modelo.json «auxiliar-iv/ram») son los mismos en las dos.
// ══════════════════════════════════════════════════════════════

import LOGO_SOGRUB from '../assets/marca/sogrub.svg?raw'

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
    tinta: '#1b2349',
    logo: LOGO_IV,
  },
  sogrub: {
    id: 'sogrub',
    app: 'Auxiliar SOGRUB',
    empresa: 'SOGRUB Grupo Constructor',
    empresaMayus: 'SOGRUB · GRUPO CONSTRUCTOR',
    razonSocial: 'Grupo Constructor SOGRUB, S.A.S. de C.V.',
    carpeta: 'Auxiliar SOGRUB',
    acento: '#b0643f',
    tinta: '#2e2a27',
    logo: LOGO_SOGRUB.trim(),
  },
}

const elegida = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_MARCA : undefined
export const MARCA = MARCAS[elegida] || MARCAS.iv

/** El logo listo para un <img src> */
export const logoDataUri = (m = MARCA) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(m.logo)))}`

/** '#b0643f' → [176, 100, 63] */
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

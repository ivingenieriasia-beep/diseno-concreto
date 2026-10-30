// ══════════════════════════════════════════════════════════════
// La marca de la app: IV Ingenierías.
//
// Nombre, empresa, logo, el color de las líneas de los informes, el pie
// y la carpeta de la obra salen de aquí.
// ══════════════════════════════════════════════════════════════

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
}

export const MARCA = MARCAS.iv

/** El logo listo para un <img src> */
export const logoDataUri = (m = MARCA) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(m.logo)))}`

/** '#4ecac4' → [78, 202, 196] */
export const rgbDe = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16))

/** Sin acentos ni «·», para jsPDF con la fuente de fábrica */
export const enPdf = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/·/g, '-')

/**
 * Quién firma. El nombre que se captura en la memoria va con «Ing.»; si no
 * se capturó, un renglón en blanco.
 */
export function firmante(responsable) {
  const r = String(responsable ?? '').trim()
  return r ? `Ing. ${r}` : 'Ing. ________________________'
}


// Tipografías de SOGRUB (Manual de Identidad § 2): Roboto para títulos,
// alojada aquí (WOFF del kit, sin llamar a Google); Aptos para el texto, que es de
// Microsoft 365 y no se puede alojar: sale donde esté instalada y, si no, Segoe UI.
import r400 from '../assets/marca/fonts/roboto-400.woff?inline'
import r500 from '../assets/marca/fonts/roboto-500.woff?inline'
import r700 from '../assets/marca/fonts/roboto-700.woff?inline'

const TITULOS = "'Roboto','Segoe UI',system-ui,sans-serif"
const TEXTO = "'Aptos','Segoe UI','Roboto',system-ui,sans-serif"

const cara = (peso, uri) => `@font-face{font-family:'Roboto';font-style:normal;font-weight:${peso};font-display:swap;src:url(${uri}) format('woff')}`
const CARAS = [cara(400, r400), cara(500, r500), cara(700, r700)].join('\n')

/** Para los documentos que abre la app en otra ventana (memorias, informes) */
export const FUENTES_DOC = `
${CARAS}
body { font-family:${TEXTO}; }
h1, h2, h3, h4, h1.mem, h2.mem, h3.mem, .paso-h, .titulo-doc { font-family:${TITULOS}; }
`

/**
 * Para la app misma (main.jsx lo pone en un <style>): tipografías y los acentos
 * de la interfaz en los azules del Manual (#1A9DD9 y #0F6E9C para texto).
 * Los verdes de pasa / no pasa de los dibujos son semáforos, no marca.
 */
export const ESTILO_APP = `
${CARAS}
:root { --font-sans: ${TEXTO}; --color-accent: #1A9DD9; --color-accent2: #0F6E9C; --color-pink: #1A9DD9; }
h1, h2, h3, h4, .titulo-marca, .nov-titulo { font-family:${TITULOS}; }
.btn-primary:hover { background: #168AC0; }
.btn-export:hover { background: #0B5A80; }
.nov-cabeza { background:
    linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(120deg, #1B1740, #29235C 40%, #0F6E9C 80%, #1A9DD9); }
`

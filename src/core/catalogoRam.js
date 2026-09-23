// ══════════════════════════════════════════════════════════════
// El catálogo de secciones y materiales «de la casa» para RAM.
//
// Es la fuente única: lo que se dé de alta en el grupo «Personales» de RAM
// sale de aquí, y el módulo de agrupación sólo propondrá secciones que estén
// aquí — así nunca propone una que RAM no tenga.
//
// Los materiales se calculan, no se copian. El «F'C 250» que había en RAM
// salió de la plantilla US: se le cambió el nombre, Ec y Fy, pero f'c se quedó
// en 281.23 kg/cm² (4 ksi exactos) y Fyt en 4218.4 (60 ksi). El análisis no lo
// nota —usa Ec—, pero el diseño que hace RAM con ese material supone un
// concreto 12 % más resistente.
// ══════════════════════════════════════════════════════════════

/** s: recubrimiento mecánico que se da de alta en RAM, siempre el mismo */
export const RECUB_RAM = 3

// RAM guarda cada tipo en su tabla —un archivo por tabla dentro de la carpeta
// del grupo—, así que cada sección sabe a cuál va:
//   …\Database\Sections\Personales\Vigas de Concreto.sec
//   …\Database\Sections\Personales\Columnas de Concreto.sec
export const TABLA_VIGAS = 'Vigas de Concreto'
export const TABLA_COLUMNAS = 'Columnas de Concreto'

// b × h en cm. La lista de uso corriente; 25×50 en lugar de un segundo 20×50.
const VIGAS = [
  [10, 25],                                                   // nervadura
  [15, 20], [15, 25], [15, 30], [15, 35], [15, 40], [15, 45],
  [20, 20], [20, 25], [20, 30], [20, 35], [20, 40], [20, 45], [20, 50],
  [25, 20], [25, 25], [25, 30], [25, 35], [25, 40], [25, 45], [25, 50],
]
const COLUMNAS = [
  [15, 15], [15, 20], [15, 25], [20, 20], [20, 25], [25, 10], [25, 25], [30, 30], [36, 36],
]

/**
 * Como se llaman en RAM: «20 X 35» las vigas y «COL 20 X 25» las columnas.
 * RAM busca las secciones por NOMBRE, así que una viga y una columna de la
 * misma medida no pueden llamarse igual; el prefijo es el que ya usaba el
 * grupo NTC («COL 36 X 36»). El nombre siempre es b × h.
 */
export const nombreSeccionRam = (b, h, tipo = 'viga') => `${tipo === 'columna' ? 'COL ' : ''}${b} X ${h}`

const alta = (tipo, tabla) => ([b, h]) => ({ b, h, s: RECUB_RAM, nombre: nombreSeccionRam(b, h, tipo), tipo, tabla })
export const SECCIONES_RAM = [
  ...VIGAS.map(alta('viga', TABLA_VIGAS)),
  ...COLUMNAS.map(alta('columna', TABLA_COLUMNAS)),
]

/**
 * ¿Está esta sección en el catálogo? (la agrupación sólo propone éstas)
 * @param tipo 'viga' | 'columna' — sin él, cualquiera de las dos tablas
 */
export const enCatalogo = (b, h, tipo = null) =>
  SECCIONES_RAM.some((x) => x.b === +b && x.h === +h && (!tipo || x.tipo === tipo))

// ── Materiales ───────────────────────────────────────────────
// NTC-Concreto:
//   · clase 1 (f'c ≥ 250 kg/cm²): Ec = 14 000 √f'c con agregado grueso calizo
//     (11 000 √f'c si es basáltico). 14 000 es el que ya se usaba en RAM.
//   · clase 2 (200 ≤ f'c < 250):  Ec =  8 000 √f'c. Por eso el F'C 200 lleva
//     casi la mitad de rigidez que si se le aplicara la fórmula de clase 1.
export const FC_RAM = [200, 250, 300, 350, 400]

export function materialRam(fc, { agregado = 'calizo' } = {}) {
  const clase = fc >= 250 ? 1 : 2
  const k = clase === 2 ? 8000 : agregado === 'basaltico' ? 11000 : 14000
  return {
    nombre: `F'C ${fc}`,
    tipo: 'Concreto',
    clase,
    fc,                              // kg/cm² — el nominal, no 4 ksi
    Ec: Math.round(k * Math.sqrt(fc)), // kg/cm²
    EcExacto: k * Math.sqrt(fc),     // el que se escribe en RAM, sin redondear
    nu: 0.2,                         // Poisson del concreto (en RAM estaba 0.3)
    pesoUnitario: 0.0024,            // kg/cm³ = 2.4 t/m³, concreto reforzado
    alfa: 1.0e-5,                    // 1/°C
    fy: 4200,                        // kg/cm², refuerzo longitudinal
    fyt: 4200,                       // kg/cm², refuerzo transversal (en RAM estaba 60 ksi)
    Es: 2.04e6,                      // kg/cm² = 200 GPa
    J: 0.05,                         // factor de la constante de torsión (concreto agrietado)
  }
}

export const MATERIALES_RAM = FC_RAM.map((fc) => materialRam(fc))

/**
 * El catálogo en la forma en que lo escribe instalar_catalogo.py en las tablas
 * de RAM: las secciones con su tabla, y los materiales con las columnas de
 * Concreto.mat ya como texto (RAM las guarda así: «9.9E-6», «221359.43…»).
 */
// Lo que instaló una versión anterior del catálogo y ya no va: se quita de
// la tabla sólo si sigue EXACTAMENTE como se dejó (si alguien la editó, es
// suya y se queda).
const RETIRADAS = [
  { tabla: TABLA_COLUMNAS, nombre: '25 X 10', b: 25, h: 10, s: 3 },   // ahora «COL 25 X 10»
  { tabla: TABLA_COLUMNAS, nombre: '36 X 36', b: 36, h: 36, s: 3 },   // ahora «COL 36 X 36»
]

export function datosCatalogo() {
  return {
    retirar: RETIRADAS,
    secciones: SECCIONES_RAM.map(({ tabla, nombre, b, h, s }) => ({ tabla, nombre, b, h, s })),
    materiales: MATERIALES_RAM.map((m) => ({
      nombre: m.nombre,
      U: String(m.nu),
      W: String(m.pesoUnitario),
      Alpha: m.alfa.toExponential().toUpperCase(),
      E: String(m.EcExacto),
      FyH: String(m.fy),
      factorTor: String(m.J),
      FcH: String(m.fc),
      Es: String(m.Es),
      FytH: String(m.fyt),
      RCRegion: 'US',
    })),
  }
}

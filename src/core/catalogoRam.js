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

// b × h en cm. La lista de uso corriente; 25×50 en lugar de un segundo 20×50.
const MEDIDAS = [
  [15, 20], [15, 25], [15, 30], [15, 35], [15, 40], [15, 45],
  [20, 20], [20, 25], [20, 30], [20, 35], [20, 40], [20, 45], [20, 50],
  [25, 20], [25, 25], [25, 30], [25, 35], [25, 40], [25, 45], [25, 50],
]

/** Como las nombra RAM en el grupo: «15 X 15» */
export const nombreSeccionRam = (b, h) => `${b} X ${h}`

export const SECCIONES_RAM = MEDIDAS.map(([b, h]) => ({ b, h, s: RECUB_RAM, nombre: nombreSeccionRam(b, h) }))

/** ¿Está esta sección en el catálogo? (la agrupación sólo propone éstas) */
export const enCatalogo = (b, h) => SECCIONES_RAM.some((x) => x.b === +b && x.h === +h)

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

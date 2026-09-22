// ══════════════════════════════════════════════════════════════
// Catálogo de fábrica para Pesos Unitarios
// Traducción directa del libro PESOS_UNITARIOS.xlsx:
//   · hoja "Datos"        → CARGAS_VIVAS (tabla de cargas vivas unitarias)
//   · hoja "P. Unitarios" → PLANTILLAS_LOSA (una receta por tipo de losa)
//   · hoja "Muros"        → PLANTILLAS_MURO
// Todo lo de aquí es sólo el punto de partida: la biblioteca del usuario
// (loadsLibrary.js) puede añadir, editar y ocultar lo que haga falta.
// ══════════════════════════════════════════════════════════════

// ── Cargas vivas unitarias (kg/m²) ───────────────────────────
// W  = carga media · Wa = carga instantánea · Wm = carga máxima.
// Comercios, fábricas y bodegas no traen valor fijo: Wm lo define el
// proyecto y las otras dos salen de él (0.8Wm y 0.9Wm), igual que en la hoja.
export const CARGAS_VIVAS = [
  { uso: 'Casa–habitación', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Departamentos', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Viviendas', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Dormitorios', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Cuartos de hotel', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Internados de escuelas', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Cuarteles', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Cárceles', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Correccionales', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Hospitales', W: 80, Wa: 100, Wm: 190, nota: '1' },
  { uso: 'Oficinas', W: 100, Wa: 180, Wm: 250, nota: '2' },
  { uso: 'Despachos', W: 100, Wa: 180, Wm: 250, nota: '2' },
  { uso: 'Laboratorios', W: 100, Wa: 180, Wm: 250, nota: '2' },
  { uso: 'Pasillos', W: 40, Wa: 150, Wm: 350, nota: '3 y 4' },
  { uso: 'Escaleras', W: 40, Wa: 150, Wm: 350, nota: '3 y 4' },
  { uso: 'Rampas', W: 40, Wa: 150, Wm: 350, nota: '3 y 4' },
  { uso: 'Vestíbulos', W: 40, Wa: 150, Wm: 350, nota: '3 y 4' },
  { uso: 'Pasajes públicos', W: 40, Wa: 150, Wm: 350, nota: '3 y 4' },
  { uso: 'Estadios', W: 40, Wa: 350, Wm: 450, nota: '5' },
  { uso: 'Centros de reunión', W: 40, Wa: 350, Wm: 450, nota: '5' },
  { uso: 'Bibliotecas', W: 40, Wa: 250, Wm: 350, nota: '5' },
  { uso: 'Templos', W: 40, Wa: 250, Wm: 350, nota: '5' },
  { uso: 'Cines', W: 40, Wa: 250, Wm: 350, nota: '5' },
  { uso: 'Teatros', W: 40, Wa: 250, Wm: 350, nota: '5' },
  { uso: 'Gimnasios', W: 40, Wa: 250, Wm: 350, nota: '5' },
  { uso: 'Salones de baile', W: 40, Wa: 250, Wm: 350, nota: '5' },
  { uso: 'Restaurantes', W: 40, Wa: 250, Wm: 350, nota: '5' },
  { uso: 'Salas de juego', W: 40, Wa: 250, Wm: 350, nota: '5' },
  { uso: 'Comercios', factorW: 0.8, factorWa: 0.9, WmLibre: true, WmSugerido: 350, nota: '6' },
  { uso: 'Fábricas', factorW: 0.8, factorWa: 0.9, WmLibre: true, WmSugerido: 350, nota: '6' },
  { uso: 'Bodegas', factorW: 0.8, factorWa: 0.9, WmLibre: true, WmSugerido: 350, nota: '6' },
  { uso: 'Marquesinas', W: 15, Wa: 70, Wm: 300, nota: '' },
  { uso: 'Balcones', W: 15, Wa: 70, Wm: 300, nota: '' },
  { uso: 'Garajes', W: 40, Wa: 100, Wm: 250, nota: '10' },
  { uso: 'Estacionamientos', W: 40, Wa: 100, Wm: 250, nota: '10' },
  { uso: 'Azoteas < 5%', W: 15, Wa: 70, Wm: 100, nota: '4 y 7', azotea: true },
  { uso: 'Azoteas ≥ 5%', W: 5, Wa: 20, Wm: 40, nota: '4, 7, 8 y 9', azotea: true },
]

export function buscarCargaViva(uso) {
  return CARGAS_VIVAS.find((c) => c.uso === uso) || null
}

// ── Materiales: peso volumétrico (kg/m³) ─────────────────────
// Los que trae el libro; la biblioteca del usuario puede añadir más.
export const MATERIALES = [
  { nombre: 'Concreto', gamma: 2400 },
  { nombre: 'Mortero', gamma: 2100 },
  { nombre: 'Aplanado de mortero', gamma: 2100 },
  { nombre: 'Yeso', gamma: 1500 },
  { nombre: 'Relleno', gamma: 1200 },
  { nombre: 'Relleno de arenilla', gamma: 1600 },
  { nombre: 'Enladrillado', gamma: 1500 },
  { nombre: 'Capa de compresión', gamma: 2400 },
  { nombre: 'Nervaduras', gamma: 2400 },
  { nombre: 'Casetón', gamma: 1500 },
]

// ── Componentes de peso directo (kg/m²) ──────────────────────
// Piezas que no se calculan por espesor × peso volumétrico sino que
// entran con su peso de catálogo del fabricante o de proyecto.
export const COMPONENTES_DIRECTOS = [
  { nombre: 'Instalaciones', W: 10 },
  { nombre: 'Impermeabilizante', W: 10 },
  { nombre: 'Piso', W: 30 },
  { nombre: 'Sobrecarga (concreto)', W: 20 },
  { nombre: 'Sobrecarga (mortero)', W: 20 },
  { nombre: 'Vigueta', W: 9 },
  { nombre: 'Bovedilla', W: 0 },
  { nombre: 'Qualylosa 4.06', W: 155.25 },
  { nombre: 'Ternium 25 (acero)', W: 9.06 },
  { nombre: 'Lámina losacero cal. 22', W: 8.5 },
  { nombre: 'Lámina', W: 5.58 },
  { nombre: 'Aislante térmico', W: 0.5 },
  { nombre: 'Sistema contra incendios', W: 7 },
]

// Atajos para escribir las plantillas sin repetirse
const esp = (nombre, t, gamma) => ({ nombre, modo: 'espesor', t, gamma })
const dir = (nombre, W) => ({ nombre, modo: 'directo', W })
const lin = (nombre, long, pesoML, area) => ({ nombre, modo: 'lineal', long, pesoML, area })

// ── Plantillas de losa (hoja "P. Unitarios") ─────────────────
// Cada plantilla es sólo un arranque: al insertarla en el proyecto se copia
// y a partir de ahí se le quitan, añaden o cambian capas libremente.
export const PLANTILLAS_LOSA = [
  {
    id: 'azotea-maciza',
    nombre: 'Losa de azotea horizontal (Maciza)',
    tipo: 'azotea',
    uso: 'Azoteas < 5%',
    capas: [
      esp('Losa de concreto', 0.15, 2400),
      esp('Relleno', 0.07, 1200),
      esp('Mortero', 0.03, 2100),
      esp('Yeso', 0.015, 1500),
      esp('Enladrillado', 0, 1500),
      dir('Instalaciones', 0),
      dir('Impermeabilizante', 10),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
  {
    id: 'charola-banos',
    nombre: 'Charola para baños (Maciza)',
    tipo: 'entrepiso',
    uso: 'Oficinas',
    capas: [
      esp('Losa de concreto', 0.15, 2400),
      esp('Relleno de arenilla', 0.15, 1600),
      dir('Instalaciones', 0),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
  {
    id: 'entrepiso-maciza',
    nombre: 'Losa de entrepiso horizontal (Maciza)',
    tipo: 'entrepiso',
    uso: 'Oficinas',
    capas: [
      esp('Losa de concreto', 0.15, 2400),
      esp('Yeso', 0.015, 1500),
      dir('Instalaciones', 0),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
  {
    id: 'cubierta-naves',
    nombre: 'Cubierta para naves industriales',
    tipo: 'cubierta',
    uso: 'Azoteas ≥ 5%',
    capas: [
      lin('Largeros', 52, 5.57, 50.5),
      lin('Contraventeos', 20, 1.55, 50.5),
      lin('Contraflambeos', 16, 1.83, 50.5),
      dir('Lámina', 5.58),
      dir('Aislante térmico', 0.5),
      dir('Sistema contra incendios', 7),
      dir('Instalaciones', 10),
    ],
  },
  {
    id: 'cubierta-lamina',
    nombre: 'Cubierta de lámina',
    tipo: 'cubierta',
    uso: 'Azoteas ≥ 5%',
    capas: [
      lin('Largeros', 9, 4.5, 9),
      dir('Lámina', 5.5),
      dir('Instalaciones', 10),
    ],
  },
  {
    id: 'losacero-ternium25',
    nombre: 'Losacero de entrepiso horizontal (Ternium 25)',
    tipo: 'entrepiso',
    uso: 'Oficinas',
    capas: [
      { nombre: 'Ternium 25 (acero)', modo: 'directo', W: 9.06, t: 0.12 },
      esp('Concreto', 0.11, 2400),
      dir('Instalaciones', 10),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
  {
    id: 'azotea-qualypanel',
    nombre: 'Losa de azotea horizontal (Qualypanel)',
    tipo: 'azotea',
    uso: 'Azoteas < 5%',
    capas: [
      dir('Qualylosa 4.06', 155.25),
      esp('Relleno', 0.14, 1200),
      esp('Yeso', 0.015, 1500),
      dir('Instalaciones', 10),
      dir('Impermeabilizante', 10),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
  {
    id: 'entrepiso-vigueta',
    nombre: 'Losa de entrepiso horizontal (Vigueta y bovedilla)',
    tipo: 'entrepiso',
    uso: 'Casa–habitación',
    capas: [
      dir('Vigueta', 9),
      dir('Bovedilla', 0),
      esp('Capa de compresión', 0.07, 2400),
      esp('Yeso', 0.015, 1500),
      dir('Piso', 30),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
  {
    id: 'azotea-vigueta',
    nombre: 'Losa de azotea horizontal (Vigueta y bovedilla)',
    tipo: 'azotea',
    uso: 'Azoteas < 5%',
    nota: 'En el libro original: tipo de losa usado en el proyecto que no corresponde a la tabla; el peso propio de la losa es de 144 kg/m².',
    capas: [
      dir('Vigueta', 9),
      dir('Bovedilla', 0),
      esp('Capa de compresión', 0.07, 2400),
      esp('Relleno', 0.05, 1200),
      esp('Yeso', 0.015, 1500),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
  {
    id: 'entrepiso-losacero22',
    nombre: 'Losa de entrepiso losacero (cal. 22)',
    tipo: 'entrepiso',
    uso: 'Casa–habitación',
    capas: [
      dir('Lámina losacero cal. 22', 8.5),
      esp('Capa de compresión', 0.06, 2400),
      esp('Yeso', 0.015, 1500),
      dir('Piso', 30),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
  {
    id: 'losa-nervada',
    nombre: 'Losa Nervada',
    tipo: 'entrepiso',
    uso: 'Casa–habitación',
    capas: [
      esp('Capa de compresión', 0.05, 2400),
      { nombre: 'Nervaduras', modo: 'directo', W: 85, t: 0.06 },
      { nombre: 'Casetón', modo: 'directo', W: 3, t: 0.015 },
      esp('Yeso', 0.015, 1500),
      dir('Piso', 30),
      dir('Sobrecarga (concreto)', 20),
      dir('Sobrecarga (mortero)', 20),
    ],
  },
]

// ── Plantillas de muro / pretil (hoja "Muros") ───────────────
// El peso de la pared va como peso directo por m² de muro; el aplanado
// se calcula por espesor. La carga por metro lineal sale de la altura.
export const PLANTILLAS_MURO = [
  {
    id: 'block-macizo-15',
    nombre: 'Block macizo de 15 × 20 × 40',
    capas: [dir('Pared de block', 312.9), esp('Aplanado de mortero', 0.02, 2100)],
    alturas: [{ nombre: 'Muro', h: 3 }],
  },
  {
    id: 'block-macizo-12',
    nombre: 'Block macizo de 12 × 20 × 40',
    capas: [dir('Pared de block', 249.4), esp('Aplanado de mortero', 0.02, 2100)],
    alturas: [{ nombre: 'Muro', h: 3 }],
  },
  {
    id: 'aircrete-pretil',
    nombre: 'Block Aircrete de 40 × 60 (Pretil)',
    capas: [dir('Pared de aircrete', 75), esp('Aplanado de mortero', 0.02, 2100)],
    alturas: [
      { nombre: 'Pretil', h: 0.6 },
      { nombre: 'Pretil 2', h: 0.8 },
      { nombre: 'Pretil 3', h: 0.9 },
    ],
  },
  {
    id: 'aircrete-muro',
    nombre: 'Block Aircrete de 40 × 60 (Muro)',
    capas: [dir('Pared de aircrete', 75), esp('Aplanado de mortero', 0.02, 2100)],
    alturas: [{ nombre: 'Muro', h: 3 }],
  },
  {
    id: 'block-40x60-muro',
    nombre: 'Block de 40 × 60 (Muro)',
    capas: [dir('Pared de block', 180), esp('Aplanado de mortero', 0.02, 2100)],
    alturas: [{ nombre: 'Muro', h: 3 }],
  },
]

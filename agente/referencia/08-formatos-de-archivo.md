# Formatos de archivo

Para leerlos y entenderlos, no para editarlos a mano. La app y los scripts de RAM los escriben y los leen; si un dato está mal, se corrige en la app o en RAM y se vuelve a generar.

---

## 1. `modelo.json` — lo que escribe RAM (`sincronizar.py`)

Lo escribe `sincronizar.py` dentro de RAM Elements, en la carpeta de la obra, después de analizar. La app lo lee al sincronizar (o con «Cargar modelo.json…» / «abrir modelo.json…») y lo guarda en el navegador (IndexedDB), no en el proyecto.

```jsonc
{
  "formato": "auxiliar-iv/ram",          // así lo reconoce la app
  "version": 1,
  "modelo": { "titulo": "…", "unidades": "Ton-m", "generado": "2026-10-09T12:00:00",
              "nudos_total": 201, "miembros_total": 240 },

  "campos_est":   ["x", "m33min", "m33max", "v2min", "v2max", "axmin", "axmax"],
  "campos_flexo": ["x", "combo", "axial", "m22", "m33", "v2", "v3"],

  "casos":         [{ "id": "CM", "descripcion": "Carga Muerta", "categoria": "DL" }, …],
  "combinaciones": [{ "id": "CD", "formula": "1.3CM+1.5CV" }, …],
  "envueltas":     ["CD", "CSX", "CSXN", "CSZ", "CSZN"],     // las combinaciones de diseño

  "nudos": { "1": { "x": 0, "y": 0, "z": 0, "apoyo": "dxdydzrxryrz" }, "2": { … } },

  "miembros": [{
    "id": 37, "grupo": "T3",                // grupo = descripción de RAM → chip T-3
    "seccion": "15 X 45", "material": "F'C 250",
    "ni": 2, "nj": 49, "L": 1.0,            // nudos y longitud (m)
    "est": [[x, m33min, m33max, v2min, v2max, axmin, axmax], …],   // estaciones (envolvente)
    "max": { "m33p": 7.495, "m33n": -8.828, "v2": 4.985, "axp": 0.35, "axn": -0.08, … }, // pico exacto
    "flexo": [[x, iCombo, axial, m22, m33, v2, v3], …],   // sólo columnas: fuerzas simultáneas por combinación
    "def": { "x": [...], "dy": { "CM": [...], "CV": [...] }, "m": { "CM": [...], "CV": [...] } } // sólo trabes: flechas por caso
  }, …],

  "reacciones": [{ "nudo": 1, "x": 0, "y": 0, "z": 0,
                   "por": { "CD": [fx, fy, fz, mx, my, mz], …, "CM": […], "CV": […], "SX": […] } }],

  "secciones": { "15 X 35": { "b": 15, "h": 35, "s": 3, "tipo": "viga",
                              "fuente": "grupo Personales", "tabla": "Vigas de Concreto" } },

  "deflexiones": { "casos": [ … ], "unidad": "cm", "desde": "m", "comprobada": true,
                   "ejes": "globales", "dispersion": 0.71, "trabes": 204, "estaciones": 11 },

  "saltados": { "sin_longitud": [], "sin_resultados": [], "motivos": {} }
}
```

Para leerlo:
- El **eje vertical** del edificio de ejemplo es **Y** (los niveles están en y = 3, 6, 9). La planta de la app se dibuja «como RAM»: X↓ Z←.
- **`grupo`** manda: todos los miembros con la misma descripción forman un grupo y alimentan el chip del mismo nombre (`T5` → `T-5`, `C1` → `C-1`). Los miembros sin descripción llegan como `(sin nombre)`.
- **`secciones`** trae las medidas **reales** de la tabla de RAM. Si el nombre dice otra cosa («20X25» dado de alta como 25×20), la app avisa y diseña con la tabla.
- **`reacciones.por`** trae las combinaciones y además los **casos** (CM, CV, SX…). Sin los casos, Cimentaciones no puede separar la muerta, la viva y el sismo («sólo por combinación»: hay que generar el script otra vez).
- Si falta `campos_flexo` / `flexo`, el script es viejo: Columnas y Agrupación → Columnas no pueden revisar con las fuerzas simultáneas.
- Si falta `deflexiones` / `def`, Deflexiones no tiene con qué trabajar.
- Un `modelo.json` con `secciones: {}` es de un script anterior: las medidas se deducen de los nombres.

## 2. `proyecto.json` — el proyecto de la app (Guardar)

```jsonc
{
  "version": 6,
  "projectName": "Edificio de ejemplo",
  "dxfScale": 1,                    // escala del DXF (1 = 1:1)
  "sections": [ … ],                // trabes (chips de la barra)
  "columns":  [ … ],                // columnas (pestaña Columnas)
  "cargas": { "losas": [], "muros": [], "tableros": [], "unidad": "kg" },   // Pesos Unitarios
  "cimentacion": { "cimientos": [ … ], "suelo": {}, "criterios": {}, "linderos": {} },
  "model": { "archivo": "modelo.json", "rows": [ … ], "nodes": { … } },     // la geometría del modelo
  "rutaRam": "C:\\…\\PROCESO\\Auxiliar IV",   // la carpeta de la obra; con ella se reconecta
  "savedAt": "2026-10-17T…"
}
```

**Una trabe (`sections[i]`)**, con los campos principales:

| Campo | Qué es |
|---|---|
| `nombre` | El nombre del chip (T-4). |
| `ancho`, `peralte`, `recub`, `fc` | b, h y r (cm), y f'c (kg/cm²). |
| `calSup`, `cantSup` / `calInf`, `cantInf` | Varillas corridas arriba y abajo (calibre y cantidad). |
| `calBastonSup`, `cantBastonSup` / `…Inf` | Bastones corridos. |
| `cantBastonPuntSup`, `cantBastonPuntInf` | Bastones puntuales que vienen de Longitudinal. |
| `calEst`, `sepLcuarto`, `sepRest` | Estribo y su separación en L/4 y en el resto (cm). |
| `muPos`, `muNeg`, `vu` | Demandas capturadas (t·m, t). Vacías si mandan las del modelo. |
| `mrPos`, `mrNeg`, `vr` | Lo que calculó la app (t·m, t). |
| `calc` | El estado de la calculadora (fy, L, Vu, ramas, la S real en obra…). |
| `envelope` | La envolvente de RAM por miembro (puntos Max/Min). |
| `perfil` | Las estaciones de cada miembro, para Longitudinal. |
| `armadoPropuesto` | `true` mientras nadie haya tocado el armado que propuso la app. |

**Una columna (`columns[i]`):** `nombre`, `b`, `h`, `r`, `fc`, `fy`, `epsC`, `lechos` (`[{ n, num }]`, de arriba hacia abajo), `estriboNum`, `sepExt`, `sepCen`, `longExt`, `altura`, `Pu`/`MuX`/`MuY` (el punto a mano), `envelope` (los puntos del modelo, con `mapping`) y `armadoPropuesto`.

**Un cimiento (`cimentacion.cimientos[i]`):** `tipo` (`aislada` Z, `corrida` ZC, `contratrabe` ZT, `liga` TL, `contencion` MC, `gravedad` MM —muro de piedra—, `mamposteria` CP), `nombre` (el prefijo y un número: Z-1, ZC-1, TL-1…), `geo` (dimensiones en m y cm, posición de la columna, si lleva liga), `cargas` (`CM`, `CV`, `S` con `P`, `Mx`, `My`, `Vx`, `Vy`), `arm` (parrillas), `ct` (la contratrabe de liga de la zapata), `mat`, `suelo` (el propio; vacío = el de la obra), `apoyos` (los nudos de RAM de donde salió, con sus cargas) y `origen`.

`cimentacion.suelo` y `criterios` vacíos significan que se usan los valores de fábrica (qadm 15 t/m², etc.).

## 3. `.dcheck` — Double Check

```jsonc
{ "format": "sogrub-dcheck", "version": 1,
  "meta": { "proyecto": "…", "reviso": "…", "fecha": "17 de octubre de 2026" },
  "sections": [{ "name": "T-4", "ma": 6.65, "mr": 4.97, "man": 7.99, "mrn": 4.97, "un": "ton·m",
                 "va": 5.85, "vr": 9.64, "unv": "ton", "obs": "Trabe 15×40 cm · … · demanda: …",
                 "mark": "ok|warn|bad", "imgA": null, "imgB": null, "imgC": null, "imgD": null }] }
```

`ma`/`mr` son Mu+ y MR+, `man`/`mrn` Mu− y MR−, `va`/`vr` Vu y Vr. En una columna, `ma`/`mr` son Mux/MRx y `man`/`mrn` Muy/MRy. `mark` es ok si el peor cociente es ≤ 0.9, warn si es ≤ 1 y bad si pasa de 1.

Lo genera Verificar → Exportar a Double Check, con las demandas y resistencias ya puestas; las capturas (A momento del modelo, B momento de diseño, C cortante del modelo, D cortante de diseño) se pegan después en la ventana Double Check. La Memoria de cálculo lee el `.dcheck` y usa las capturas A y C.

## 4. Biblioteca de cargas (Pesos Unitarios)

`{ "tipo": "auxiliar-iv-biblioteca-cargas", "version": 1, … }` con las plantillas de losa y de muro que agregó el usuario. Se exporta e importa desde Pesos Unitarios → Biblioteca; al importar se combina con lo que ya hay.

## 5. Scripts de RAM (`.py`)

| Script | Lo da | Qué hace en RAM |
|---|---|---|
| `sincronizar.py` | Reportes de RAM → ⚙ Configurar RAM → ⬇ Generar sincronizar.py | Sólo lee el modelo y escribe `modelo.json` en la carpeta de la obra (`CARPETA = '…'` va dentro). |
| `instalar_catalogo.py` | ⚙ Configurar RAM → ⬇ instalar_catalogo.py | Da de alta las secciones, los concretos y la mampostería en el grupo Personales, con respaldo en el Escritorio. Una vez por computadora. |
| `aplicar_agrupacion.py` | Agrupación → ⬇ aplicar_agrupacion.py | Pone a cada miembro su descripción y su sección. Deja un «Deshacer agrupación <fecha>.py» en `1 Agrupación`. |
| `edificio_prueba.py` | El repositorio de la app (`scripts/ram`) | Construye y analiza un edificio de práctica en un modelo vacío. |

En RAM siempre se abren con Python Console → **Abrir Script…** → **Ctrl+R**. Nunca se pegan.

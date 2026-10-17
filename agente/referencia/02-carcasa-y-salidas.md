# Auxiliar IV: la carcasa de la app, el proyecto y las salidas

Esta guía cubre lo que rodea a los módulos de cálculo: la barra superior, las pestañas, el ciclo de vida del proyecto (autoguardado, recientes, guardar, abrir, nuevo), todas las salidas (PDF, HTML, Word, .dcheck, DXF, SVG, alzados) y el Centro de carga **📥 Reportes de RAM**. Las etiquetas van tal como aparecen en el código (versión de la app `3.06`, `src/core/constants.js`).

**Inicio de sesión:** antes de la app aparece una pantalla de acceso de IV Ingenierías (la inyecta `auth-inject.py` en el build), con los campos `Usuario` y `Contraseña` y el botón `Ingresar`. Si te equivocas, sale «Credenciales incorrectas».

---

## 1. Mapa de la pantalla

### 1.1 Barra superior (de izquierda a derecha)

| # | Elemento (texto exacto) | Qué hace |
|---|---|---|
| 1 | `▭ Auxiliar IV` | Logo y nombre. No es un botón. |
| 2 | `v3.06` (botón, `data-testid="version"`) | Novedades. Al pasar el cursor se abre el registro de cambios de la versión mayor vigente («✦ ¡Nueva actualización!»). Con un clic se queda abierto, y se cierra con Esc o con un clic fuera. Un punto indica «hay novedades sin leer» y se borra en cuanto lo abres. Las imágenes tienen «⤢ ampliar». |
| 3 | Botón de ícono (hoja con +), title «Proyecto nuevo (lo actual queda en Recientes)» | **Proyecto nuevo**. Ver §2.5. |
| 4 | Campo de texto con placeholder `Proyecto` | Nombre del proyecto. Se usa en los nombres de archivo, en los encabezados de los informes y como clave de Recientes. |
| 5 | `Verificar ▾` (naranja, title «Generar informe de verificación») | Menú de salidas: `Resumido` («Resumen con verificaciones»), `Detallado` («Verificación paso a paso por sección»), `Memoria de cálculo` con etiqueta NUEVO («Documento completo + Double Check») y `Exportar a Double Check` con etiqueta NUEVO («.dcheck prellenado (Mr, Mu, Vu); sólo faltan las capturas»). Se deshabilita si no hay trabes, columnas ni cimientos. |
| 6 | `Módulos` (verde, title «Pesos Unitarios, Longitudinal, BD Global, Double Check… (⌘K / Ctrl+K)») | Abre la paleta de módulos (§1.3). |
| 7 | Chips de secciones (`data-testid="chip-0"`, `chip-1`…) | Cada trabe del proyecto. Con un clic la seleccionas para editarla en Secciones o Cálculo. La arrastras para reordenarla (también con Alt + ← / →). El `×` (`data-testid="chip-x-N"`, title «Eliminar la sección») la borra después de pedir confirmación: «¿Seguro que quieres eliminar la sección «X»? Se pierden su armado y sus demandas (lo guardado en proyecto.json no se toca).» |
| 8 | `+ Nueva` | **Crea una sección (trabe) nueva**, no un proyecto nuevo. No la confundas con el botón 3. |
| 9 | `📥 Reportes de RAM` (`data-testid="cargar-envolventes"`) | Abre el Centro de carga (§4). |
| 10 | Botón de ícono (carpeta), title «Abrir proyecto (.json)» | Abre un .json (§2.4). |
| 11 | `▾` pegado al anterior, title «Proyectos recientes» | Lista de Recientes. Está deshabilitado si la lista está vacía. |
| 12 | Botón de ícono (disquete), title «Guardar proyecto (.json)» | Guardar (§2.3). Está deshabilitado si no hay trabes, columnas ni cimientos. |
| 13 | `SVG` | Exporta el SVG (§3.6). |
| 14 | Selector de escala (title «Escala de exportación DXF»; muestra p. ej. `1:1`) | Valores fijos `50:1`, `20:1`, `10:1`, `1:1`, `1:10`, `1:20`, `1:50`, y `Personalizado` (`1:` + número + `OK` o Enter). |
| 15 | `Exportar DXF` | Exporta el DXF de secciones y columnas (§3.5). |

También hay un input oculto `data-testid="env-files"` (multiple, .txt/.csv) que reparte reportes de RAM entre trabes y columnas según el nombre del archivo. Ningún botón visible lo abre, pero un agente puede usarlo con `setInputFiles`.

### 1.2 Fila de pestañas

- **Fijas:** `Secciones` (id interno `detalle`, que es el editor de trabes con lienzo), `Calculo` (sin acento en la etiqueta; tiene un punto rojo cuando hay una alerta de cálculo, y dentro están las subpestañas `Flexión`, `Cortante` y `Memoria`) y `Columnas` (con una píldora que cuenta las columnas).
- Después de un separador vienen las **pestañas de módulo** (`role="tab"`, `data-testid="tab-<id>"`):
  - `Cimentaciones` (`tab-cimentaciones`): es **fija**, siempre está abierta y no tiene `×`. La píldora cuenta los cimientos.
  - Las demás son cerrables con `×` (title «Cerrar X (lo capturado se conserva)», o con Supr/Backspace sobre la pestaña): `Pesos Unitarios` (`tab-pesos`, cuenta losas + tableros), `Longitudinal` (`tab-longitudinal`, cuenta las trabes con perfil y lleva un punto rojo si alguna no cumple), `Agrupación` (`tab-agrupacion`), `Deflexiones` (`tab-deflexiones`) y `BD Global` (`tab-bdglobal`, cuenta los registros de la BD).
- Al final está el botón `+ Módulos` (title «Abrir un módulo (⌘K / Ctrl+K)»).
- Las pestañas de módulo que dejas abiertas se recuerdan entre sesiones (`localStorage` `iv_modulos_abiertos_v1`). Cerrar una pestaña **no** borra lo que capturaste, y cambiar de pestaña tampoco (todas siguen montadas).

### 1.3 Paleta de módulos (Ctrl+K / ⌘K)

Se abre con el botón `Módulos`, con `+ Módulos` o con **Ctrl+K / ⌘K** desde cualquier lugar (la misma combinación también la cierra). Tiene un buscador con placeholder `Buscar módulo…` que no distingue acentos ni mayúsculas y busca en el nombre, el resumen y las palabras clave. Con ↑/↓ o Tab te mueves, con ↵ abres y con `esc` cierras. Si nada coincide, dice «Ningún módulo coincide con “…”». Cada tarjeta muestra su contador y la marca `abierto`. Los módulos de **ventana** llevan un ícono de enlace externo.

Los módulos son: Cimentaciones, Pesos Unitarios, Longitudinal, Agrupación, Deflexiones y BD Global (pestaña), más **Double Check** y **Malla de Vigas** (ventana).

### 1.4 Módulos de ventana

- **Double Check** (`public/double_check_estructural.html`, «Double Check Estructural — IV Ingenierías»). Se abre en una ventana aparte de 1440×900 (nombre `iv_doublecheck`). Sirve para la revisión cruzada de cada elemento: Mu contra Mr, Vu contra Vr, las capturas del modelo y de la herramienta (cuatro imágenes por elemento, A–D) y una marca de ok, «Revisar» o «No pasa». Sus botones son `Abrir .dcheck`, `Guardar .dcheck`, `Generar PDF`, `Preparar entorno`, `+ Agregar una` y `Modo revisión visual`. Para no llenarlo a mano, primero exporta con **Verificar → Exportar a Double Check** y luego ábrelo aquí con `Abrir .dcheck`.
- **Malla de Vigas** (`public/MallaVigas.html`, «Malla de Trabes · NTC-2023»). También abre en ventana aparte (`iv_malla`). Genera la malla de vigas resueltas que alimenta la BD Global, con `📂 Cargar JSON`, `↓ Exportar BD`, `⌕ Buscar` y mapas por `Sección`, `Ratio Mu/MRT` o `As total`.

Si el navegador bloquea las ventanas emergentes, estos módulos no se abren.

---

## 2. Ciclo de vida del proyecto

### 2.1 Qué se guarda dónde

| Dato | Dónde | Clave |
|---|---|---|
| Proyecto abierto (autoguardado) | `localStorage` | `iv_autosave_v1` |
| Recientes (hasta 6, con el proyecto completo dentro) | `localStorage` | `iv_recents_v1` |
| Pestañas de módulo abiertas | `localStorage` | `iv_modulos_abiertos_v1` |
| Datos del diálogo de Memoria (responsable, cédula, cargas…) | `localStorage` | `iv_memoria_meta` |
| Fechas de la última sincronización con RAM | `localStorage` | `iv_ram_sync_v1` |
| BD Global del usuario / biblioteca de cargas | `localStorage` | `iv_global_db` / `iv_loads_lib_v1` |
| **El `modelo.json` de RAM tal cual (casi 1 MB de estaciones)** | **IndexedDB** `iv_fs`, store `datos`, clave `modelo_ram` | no cabe en el autoguardado |
| Carpeta de la obra elegida (handle) | IndexedDB `iv_fs`, store `handles`, clave `carpeta_ram::<ruta de Windows>` | se recuerda **por proyecto** |
| Proyecto en disco | `proyecto.json` en la carpeta de la obra, o descarga `secciones-<Proyecto>.json` | — |

Del `modelo.json` guardado en IndexedDB leen Cimentaciones (las reacciones), Deflexiones y el prellenado de la Memoria. El proyecto solo guarda la **geometría** (`model`: `{archivo, rows, nodes}`).

### 2.2 Formato de `proyecto.json` (versión 6)

```json
{
  "version": 6, "projectName": "", "dxfScale": 1,
  "sections": [], "columns": [],
  "cargas": { "losas": [], "muros": [], "tableros": [], "unidad": "kg" },
  "cimentacion": { "cimientos": [], "suelo": {}, "criterios": {}, "linderos": ... },
  "model": { "archivo": "", "rows": [], "nodes": {} },
  "rutaRam": "C:\\...\\PROCESO\\Auxiliar IV",
  "savedAt": "ISO-8601"
}
```

Las envolventes y perfiles de RAM ya aplicados viajan dentro de cada sección o columna. `rutaRam` es la ruta de Windows de la carpeta de la obra, y es la llave con la que la app vuelve a conectar esa carpeta al abrir el proyecto.

### 2.3 Autoguardado y sesión recuperada

- Cada cambio (nombre, escala, secciones, columnas, cargas, modelo, rutaRam, cimentación) se escribe en `localStorage` 600 ms después de que dejas de teclear. Un proyecto vacío borra la clave.
- Al arrancar, si hay autoguardado, se carga solo y aparece el aviso «Sesión recuperada · N trabe(s), M columna(s), L losa(s), C cimiento(s) · hace X min».
- El autoguardado **no** alimenta Recientes. Recientes se actualiza al Guardar, al Abrir y al empezar un proyecto Nuevo.

### 2.4 Guardar

1. Pon un nombre en el campo `Proyecto`.
2. Clic en el disquete (title «Guardar proyecto (.json)»).
3. Hay dos casos:
   - **Si la carpeta de la obra está conectada y con permiso de escritura** (ver §4), el proyecto se escribe como `Auxiliar IV\proyecto.json`. Antes, el que había se respalda en `3 Respaldos\proyecto AAAA-MM-DD HHMM.json` (se conservan los 30 más recientes). Si el `proyecto.json` de la carpeta tiene **otro** `projectName`, la app pregunta: «La carpeta ya tiene el proyecto «A» y vas a guardar «B» encima. Se respalda, pero ¿seguro?». Si cancelas, sale el aviso «No se guardó: la carpeta tiene otro proyecto». Si todo sale bien, el aviso es «Proyecto guardado en Auxiliar IV\proyecto.json · el anterior quedó en 3 Respaldos».
   - **Sin carpeta** (o sin permiso), se descarga `secciones-<Proyecto-con-guiones>.json` (o `secciones.json` si no hay nombre) sin ningún aviso.
4. El proyecto entra a Recientes.

Ojo: el botón Guardar solo se habilita si hay trabes, columnas o cimientos. Un proyecto que solo tiene Pesos Unitarios se autoguarda, pero no se puede guardar a archivo hasta que tenga uno de esos elementos.

### 2.5 Abrir, Recientes y Nuevo

- **Abrir:** el ícono de carpeta abre un selector de `.json`. El archivo se acepta si trae un arreglo `sections`, o `cargas`, o `cimentacion`. Si lo acepta, carga todo, lo agrega a Recientes y avisa «Proyecto abierto · N trabe(s), M columna(s), C cimiento(s)». Si no, muestra alertas: «El archivo no tiene secciones. Verifica que sea un proyecto de Auxiliar IV.» o «No se pudo leer el archivo. Verifica que sea un JSON válido.». Al cargar `rutaRam`, la app reconecta sola la carpeta que recordaba para esa ruta.
- **Recientes (`▾`):** la lista se titula «Recientes» y cada fila muestra `Nombre`, `N trabe(s) · M columna(s) · hace X`. Con un clic se abre y avisa «Proyecto reciente "X" abierto». Se identifican por nombre: dos proyectos con el mismo nombre (o los dos «Sin nombre») se pisan entre sí.
- **Proyecto nuevo** (ícono de hoja con +): si hay algo capturado, pide confirmar con «¿Empezar un proyecto nuevo? Lo que hay ahora queda en "Recientes" (y en tu último .json guardado).». Al aceptar, el proyecto actual se manda a Recientes, todo se vacía (incluidos `rutaRam` y la geometría, así que la carpeta se desconecta), se borra el autoguardado y la app vuelve a Secciones. El `modelo.json` en IndexedDB **no** se borra.
- **`+ Nueva`** solo agrega una sección (trabe) al proyecto actual.

---

## 3. Salidas

Regla general (`src/core/carpeta.js`, `guardarSalida`): si la carpeta de la obra está conectada y deja escribir, cada archivo cae en su subcarpeta y aparece un aviso «… guardado en Auxiliar IV\2 Salidas\…». Si no, se **descarga** (normalmente sin aviso). El árbol de la carpeta es este:

```
Auxiliar IV\
├─ proyecto.json        (Guardar)
├─ modelo.json          (lo escribe sincronizar.py)
├─ sincronizar.py       (lo genera la app)
├─ 1 Agrupación\        aplicar_agrupacion.py y sus «Deshacer»
├─ 2 Salidas\
│   ├─ Memoria\         memoria .docx, verificación PDF
│   ├─ Planos\          DXF, SVG, alzados
│   └─ Double Check\    .dcheck
└─ 3 Respaldos\         proyecto y modelo anteriores, fechados
```

(`scripts/crear-proyectoiv.bat` también crea este árbol en Windows.)

### 3.1 Verificar → Resumido (PDF)

- **Contenido:** el «Informe de Verificación» en tamaño carta, vertical, generado con jsPDF. Trae el encabezado con el proyecto y la fecha. Para cada trabe incluye el dibujo de la sección (b×h, f'c, Sup/Inf, estribos) y la tabla «Verificación Estructural» (Concepto, Res., Dem., Mu/Mr, Estado OK/N.C.), o «Información incompleta (n/6)» si faltan datos. Después vienen «Columnas - revision por flexocompresion» y «Ejemplares del modelo - revision individual» (utilización miembro por miembro de las envolventes de RAM), una conclusión («Todos los elementos verificados cumplen.» o la lista de pendientes), una marca de agua y el pie con el número de página.
- **Pasos:** `Verificar ▾` → `Resumido`.
- **Dónde queda:** `secciones-<Proyecto>-verificacion.pdf` en `2 Salidas\Memoria`, con el aviso «Verificación guardado en …», o como descarga.
- Las trabes con perfil se analizan con la geometría completa del modelo, igual que en Longitudinal.

### 3.2 Verificar → Detallado (HTML imprimible)

- **Contenido:** una página por sección con «MEMORIA DE CÁLCULO — T-x»: «Datos de entrada», «Revisión por flexión» (M+ y M−, paso a paso) y la de cortante. Luego vienen las columnas y al final un «RESUMEN DE VERIFICACIÓN» (✓ CUMPLE / ✗ NO CUMPLE / Sin datos).
- **Pasos:** `Verificar ▾` → `Detallado`. Se abre una pestaña nueva y, a los 0.8 s, el diálogo de impresión del navegador. Para tener el PDF, elige «Guardar como PDF».
- **Dónde queda:** no se guarda en la carpeta, solo existe en esa ventana. Requiere permitir ventanas emergentes.

### 3.3 Verificar → Memoria de cálculo (Word .docx o vista PDF)

Abre el diálogo **«Generar memoria de cálculo»**, con el subtítulo `N trabe(s) · M columna(s) · C cimiento(s) · NTC-2023`.

1. **Datos del proyecto:** `Proyecto` (de entrada toma el nombre del proyecto), `Ubicación`, `Área de construcción (m²)`, `Niveles`, `Altura de entrepiso (m)`, `Fecha`, `Ing. responsable`, `Cédula profesional` y `Descripción / introducción (opcional)` (si la dejas vacía, se genera un texto base).
2. **Cargas (kg/m²):** `CM losa` (236.5 de fábrica), `CM muro` (249.4), `CV entrepiso` (190) y `CV azotea` (100).
3. **Prellenado automático:** los campos vacíos o con su valor de fábrica se llenan solos desde **Pesos Unitarios** (cargas, área de los tableros, niveles) y desde el **modelo de RAM en IndexedDB** (niveles, altura de entrepiso más común, área aproximada). Debajo de cada campo llenado así aparece `↳ <fuente>` (`data-testid="mem-fuente"`). El botón `↻ Llenar con Pesos Unitarios y el modelo` (`data-testid="mem-llenar"`) fuerza el llenado de todos esos campos.
4. **Verificación cruzada:** `📎 Cargar Double Check (.dcheck)` es opcional. Valida que el archivo sea `format: "sogrub-dcheck"`; si no, avisa «El archivo no es un Double Check válido (.dcheck).». Una vez cargado, muestra `✓ archivo · N elemento(s)` y el enlace `quitar`. En el Word se usan solo las capturas **del modelo** (A = momento, C = cortante), emparejadas por nombre de trabe (sin distinguir mayúsculas, espacios ni guiones).
5. La casilla «Detallar todas las trabes paso a paso (si se desactiva, sólo la trabe gobernante)» controla cuánto detalle lleva.
6. Botones: `Cancelar`, `Vista PDF` y `Generar Word (.docx)` (`data-testid="mem-word"`; muestra «Generando…» mientras trabaja). Los dos últimos se deshabilitan si no hay ningún elemento. Los datos capturados se recuerdan en `iv_memoria_meta`.

- **Word:** archivo `.docx` nativo (A4, Calibri) con portada y los capítulos Introducción, Propiedades de los materiales, Análisis de cargas (Cargas muertas, Cargas vivas, Estados de carga, Normativas de diseño), Diseño (Diseño de trabes y columnas, Estado límite de diseño con la trabe gobernante y la tabla resumen, un bloque por trabe con su figura y alzado longitudinal, Estado límite de servicio, Diseño de columnas, Diseño de cimentación) y Anexos, más la firma «ATENTAMENTE». Se guarda como `MEMORIA-<Proyecto>.docx` en `2 Salidas\Memoria` o se descarga. Si falla, aparece la alerta «No se pudo generar el documento Word: …».
- **Vista PDF:** abre una ventana con la memoria en HTML y el botón `🖨 Imprimir / Guardar PDF`. Si las emergentes están bloqueadas, sale «Habilita las ventanas emergentes para ver la memoria.».
- El texto del diálogo dice «Genéralo desde el botón Double Check de la barra», pero en realidad el .dcheck prellenado se genera en **Verificar → Exportar a Double Check**.

Aparte de esto, cada sección tiene su memoria individual en **Calculo → Memoria**, con el botón `Imprimir / Exportar PDF`, que imprime solo esa sección.

### 3.4 Verificar → Exportar a Double Check (.dcheck)

- **Contenido:** un JSON `{"format":"sogrub-dcheck","version":1,"meta":{proyecto,reviso,fecha},"sections":[…]}` con un elemento por trabe y por columna:
  - **Trabe:** `ma` = Mu+, `mr` = MR+, `man`/`mrn` = negativos, `va` = Vu, `vr` = Vr, y en `obs` la sección, el armado, los estribos y la fuente de la demanda (la envolvente de RAM si existe; si no, el punto capturado).
  - **Columna:** Mux/MRx, Muy/MRy, Pu y el índice biaxial.
  - La marca `mark` vale ok si el peor ratio es ≤ 0.9, warn si es ≤ 1 y bad si pasa de 1.
  - Las imágenes A–D van vacías, porque las capturas se agregan después en la ventana Double Check.
- **Pasos:** `Verificar ▾` → `Exportar a Double Check`. Después abre `Módulos → Double Check` → `Abrir .dcheck`, pega las capturas y guarda.
- **Dónde queda:** `DoubleCheck_<Proyecto_con_guiones_bajos>.dcheck` en `2 Salidas\Double Check`, o como descarga. Siempre aparece el aviso «Double Check guardado en … / exportado · N elemento(s) prellenados; falta añadir las capturas».

### 3.5 Exportar DXF y la escala

- **Contenido:** el lienzo de secciones de trabes (lo que ves en Secciones) y, debajo, la retícula de secciones de columnas, apilados en un solo dibujo. Formato DXF R12 (AC1009), con unidades en **cm** (`$INSUNITS = 5`). Las capas se asignan según el color del trazo:

  | Capa | Color ACI | Contenido |
  |---|---|---|
  | `ACERO_SUPERIOR` | 30 | varillas del lecho superior |
  | `ACERO_INFERIOR` | 72 | varillas del lecho inferior |
  | `ESTRIBOS` | 150 | estribos |
  | `CONCRETO` | 11 | contorno de la sección |
  | `COTAS` | 250 | cotas y textos (grises y negros) |

- **Escala:** con `1:1`, 1 unidad del DXF = 1 cm real. El selector multiplica las coordenadas por el factor: con `1:50` (factor 50) todo sale 50 veces más grande, y con `10:1` (0.1) sale más chico. Elígela **antes** de exportar. La escala se guarda en el proyecto (`dxfScale`).
- **Pasos:** selector de escala → `Exportar DXF`.
- **Dónde queda:** `secciones-<Proyecto>.dxf` en `2 Salidas\Planos` (aviso «DXF guardado en …») o como descarga.
- Los **alzados** longitudinales no van en este DXF.

### 3.6 SVG

`SVG` exporta el mismo dibujo (trabes + columnas) en SVG a 14 px/cm, como `secciones-<Proyecto>.svg`, en `2 Salidas\Planos` (aviso «SVG guardado en …») o como descarga.

### 3.7 Alzados (desde Longitudinal)

En la pestaña `Longitudinal` están los botones `⬇ DXF alzados · <trabe>` (la trabe actual) y `⬇ DXF alzados · todas (N)` (todas las que tienen perfil). Exportan `alzados-<Proyecto>[-<trabe>].dxf`, con la misma escala del selector y las mismas capas, en `2 Salidas\Planos`. El mensaje de resultado es «DXF de alzados … : n patrón(es) de m trabe(s), a escala real (1 unidad = 1 cm…)». Si no hay perfiles, avisa «No hay alzados que exportar: carga el reporte por estaciones y la longitud (o la geometría).».

Otras salidas que usan la misma carpeta: `aplicar_agrupacion.py` (Agrupación → `1 Agrupación`) y los planos y la memoria PDF de Cimentaciones (`Planos` / `Memoria`).

---

## 4. Centro de carga «📥 Reportes de RAM»

Se abre con el botón `📥 Reportes de RAM` (`data-testid="cargar-envolventes"`) y se cierra con la `×` (`data-testid="cerrar-centro"`) o con un clic fuera. Su título es **«Cargar el modelo de RAM»**. A la derecha de las pestañas muestra `N trabe(s) · M columna(s)`. Puedes **soltar** archivos o carpetas encima del panel en cualquier pestaña.

### 4.1 Pestañas

- `⚡ Desde RAM` (`data-testid="tab-ram"`, title «El script y la carpeta: entra todo de un clic»). Es la predeterminada en Chrome y Edge. Su subtítulo dice «Corre sincronizar.py en la consola de Python de RAM y dale a Sincronizar: entra el modelo entero.»
- `📄 Método manual` (`data-testid="tab-manual"`, title «Los cuatro reportes de texto, uno por uno»). Es la predeterminada en Firefox y Safari, que no pueden recordar carpetas. Su subtítulo dice «Nombra cada archivo como su chip (T-5.txt, C-1.txt): el contenido decide qué es cada uno.»

Atención con la automatización: `tab-ram` y `tab-manual` no son pestañas de módulo, aunque usan el mismo patrón de `data-testid`.

### 4.2 Flujo «Desde RAM» (el recomendado)

**Primera vez en una obra (configurar):**

1. Abre `⚙ Configurar RAM para este proyecto` (un `<details>`, `data-testid="config-ram"`). Junto al título dice `sin configurar` o `✓ <carpeta>`. Viene abierto si el proyecto todavía no tiene ruta.
2. En el explorador de Windows, haz clic derecho con Mayús sobre la carpeta `PROCESO\Auxiliar IV` de la obra → **Copiar como ruta**. Pégala en el campo (`data-testid="ruta-ram"`, placeholder `C:\\Users\\...\\PROCESO\\Auxiliar IV`). Las comillas y la barra final se quitan solas.
3. Clic en `⬇ Generar sincronizar.py en la carpeta` (`data-testid="generar-script"`; sin la API de carpetas el botón dice `⬇ Generar sincronizar.py`). Solo se habilita con una ruta de Windows válida (`C:\…` o `\\servidor\…`). Si la ruta no sirve, el error sale en rojo (`data-testid="aviso-ruta"`), por ejemplo ««x» no parece una ruta de Windows (se espera algo como C:\Users\…).» o «La ruta lleva una comilla simple; renombra la carpeta o usa CARPETA a mano.».
4. Si todavía no hay carpeta recordada, el navegador pide elegirla, con permiso de edición. Si eliges `PROCESO`, la app usa (o crea) `Auxiliar IV` adentro. La app crea el árbol (`1 Agrupación`, `2 Salidas`, `3 Respaldos`) y deja `sincronizar.py` con `CARPETA = '<ruta con barras normales>'` ya puesta. Mensaje: «sincronizar.py guardado en Auxiliar IV\sincronizar.py, con su árbol (1 Agrupación, 2 Salidas, 3 Respaldos). En RAM: Abrir Script… → Ctrl+R.». Sin permiso o sin la API, se descarga: «sincronizar.py descargado. Déjalo en «Auxiliar IV» y ábrelo en la consola de Python de RAM.».
5. La ruta se guarda en el proyecto (`rutaRam`), así que al cambiar de obra cambia sola. Si el nombre de la carpeta elegida no coincide con el final de la ruta, aparece «⚠ La carpeta que elegiste arriba se llama A y esta ruta acaba en B. Si no son la misma, el script dejará el modelo.json donde la app no lo va a buscar.».
6. **Una vez por computadora:** `⬇ instalar_catalogo.py` (`data-testid="bajar-catalogo"`) descarga el instalador que da de alta en el grupo **Personales** de RAM las secciones, los concretos y la mampostería del catálogo de la casa. Conserva lo que ya tengas y deja un respaldo en el Escritorio. Mensaje: «instalar_catalogo.py descargado. En RAM: Python Console → Abrir Script… → Ctrl+R (pegado en el editor se descompone la sangría).».

Elegir la carpeta (permiso del **navegador** para leer y escribir) y pegar la ruta (texto que va **dentro** del .py para que **RAM** sepa dónde escribir) son dos pasos distintos, y hacen falta los dos: el navegador nunca revela la ruta real, y el Python de RAM no puede abrir un diálogo.

**Cada vez que reanalizas en RAM (sincronizar):**

1. En RAM Elements, con el modelo analizado: Python Console → Abrir Script… → `sincronizar.py` → Ctrl+R. El script escribe `modelo.json`, con la geometría, las estaciones finas (cada 5 cm) con el pico exacto, los grupos según la *description* de RAM (T5, C1…), las reacciones por combinación y por caso, las flechas y la flexocompresión de las columnas.
2. En la app, clic en `🔄 Sincronizar con RAM` (`data-testid="sincronizar"`; sin carpeta recordada dice `🔄 Elegir la carpeta y sincronizar…`). Mientras trabaja muestra «Leyendo la carpeta…».
3. La app pide el permiso de edición. Si lo das, la carpeta queda como **carpeta activa** de la obra: ahí se guardan el proyecto y las salidas, y se reconstruye el árbol. Si no, solo la lee. El estado aparece en `data-testid="carpeta-escribible"`: «✓ La app guarda aquí el proyecto, las salidas y los respaldos.» o «(La app sólo la lee: al sincronizar, acepta el permiso de edición para que guarde aquí.)». También dice «Carpeta recordada: X · sincronizada hace N min».
4. La app recorre la carpeta y sus subcarpetas (ignora `1 Agrupación`, `2 Salidas`, `3 Respaldos` y `proyecto.json`) y compara contra la sincronización anterior. El resumen es, por ejemplo, «N archivo(s) leídos de la carpeta», «Sin cambios: los N archivos siguen igual que la última vez» o «2 actualizado(s) y 1 nuevo(s) de N: …».
5. Si encuentra un `modelo.json` del script, ese manda y los .txt se ignoran («N archivo(s) de texto ignorados: el modelo.json ya los cubre»). La app aplica la geometría, las reacciones, y los perfiles y envolventes a cada chip por nombre (`T5` → `T-5`), y guarda el modelo en IndexedDB, de donde se actualizan solos Agrupación, Deflexiones y Cimentaciones. El resumen tiene la forma `modelo.json: G grupo(s) · M miembros · K nudos · combos · A apoyos · picos exactos de la API de RAM · aplicado a N chip(s): …`.
6. El `modelo.json` anterior se respalda en `3 Respaldos\modelo AAAA-MM-DD HHMM.json`.
7. El enlace `olvidar` (`data-testid="olvidar-carpeta"`) borra la carpeta recordada para esta ruta y el historial de sincronización, y desconecta la carpeta activa.

Si el navegador no tiene la API de carpetas, verás «Este navegador no sabe recordar una carpeta. Abre la app en Chrome o Edge, o usa el método manual.».

### 4.3 Avisos después de sincronizar (se ven en las dos pestañas)

- **Medidas distintas** (`data-testid="aviso-medidas"`, rojo): «Las demandas que acaban de entrar son de otra sección. T-5: el proyecto dice 20×40 y RAM analizó 25×50 (…)». Tienes dos opciones:
  - `usar las medidas de RAM` (`data-testid="usar-medidas-ram"`) copia b×h de RAM a los chips y avisa «Medidas puestas como en RAM: …».
  - `dejarlo como está` cierra el aviso sin cambiar nada.
  
  Si el nombre de la sección en RAM contradice sus medidas dadas de alta (`data-testid="aviso-invertida"`): «⚠ Ojo con X: la sección de RAM se llama … pero está dada de alta como … — invertida». En ese caso **el error está en RAM**: corrígelo allá, reanaliza y vuelve a sincronizar. Usar las medidas de RAM solo copiaría el error.
- **Grupos sin sección** (`data-testid="faltan-secciones"`, azul): «El modelo trae N grupo(s) que el proyecto todavía no tiene: T7 (20×45) · 12 miembros — … RAM ya dice cómo se llaman y de qué tamaño son.». Tienes dos opciones:
  - `crear la sección con su armado` / `crear las N secciones con su armado` (`data-testid="crear-faltantes"`) crea cada trabe o columna con sus medidas, su envolvente y un **armado propuesto**, verificado con los mismos motores que Longitudinal y Columnas. Avisa «Creadas N sección(es) desde el modelo con su armado propuesto: k pasan, j a revisar · …» y muestra la tabla «Armado propuesto» (`data-testid="propuestas"`, filas `propuesta-<nombre>` con `data-estado` = ok / revisar / sin: ✓ / ✗ / —, con motivos ✗, avisos ⚠ y kg de acero). El armado queda marcado como propuesta hasta que lo modifiques. El enlace `cerrar` oculta la tabla.
  - `ahora no` cierra el aviso.
- **Sin descripción** (`data-testid="sin-descripcion"`, ámbar): «N miembro(s) llegan sin descripción…». Son miembros sin agrupar. Agrúpalos en **Módulos → Agrupación**, aplica el script en RAM, reanaliza y vuelve a sincronizar.
- El último mensaje queda en `data-testid="centro-msg"`. Las advertencias del parser también se suman ahí, por ejemplo «El modelo está en …; la app trabaja en Ton-m y no convierte.», «X mezcla N secciones…», «El script dejó fuera N miembro(s)…» o «Ese .json no lo escribió el script de RAM de Auxiliar IV.».

### 4.4 Flujo «Método manual»

1. `🗂 Elegir una carpeta…` (`data-testid="cargar-carpeta"`, input `centro-dir`) o `📂 Archivos sueltos…` (`data-testid="cargar-todo"`, input `centro-files`). Esta carpeta **no** se recuerda. También puedes soltar los archivos encima del panel.
2. Hay cuatro casillas de reporte, cada una con su botón `Cargar…` o `Reemplazar…` (`data-testid="slot-<id>"`) y el enlace `cómo pedirlo` / `ocultar el cómo` (`ayuda-<id>`), que explica las casillas, los parámetros y dónde cae cada dato:
   - `acciones`: «Esfuerzos a lo largo del elemento» (RECOMENDADO), en Imprimir análisis → Miembros → «Esfuerzos en puntos de importancia + puntos de inflexión», agrupado por Elementos. Alimenta Longitudinal.
   - `estaciones`: «Esfuerzos a lo largo (alternativa)», el reporte «Envolvente de esfuerzos en puntos fijos» con 20 estaciones o más.
   - `maximos`: «Máximos por miembro», el reporte «Máximos esfuerzos». Alimenta Cálculo y Columnas y da el pico exacto. Imprímelo en la misma impresión que el reporte a lo largo.
   - `geometria`: «Geometría del modelo», en Imprimir datos → Datos de geometría (Nudos + Miembros). Acepta un .txt, o el .xlsx de nudos más el .txt de miembros.
3. Cada casilla muestra su estado (✓ / ○ y un texto como «sin cargar» o «N trabe(s): …»). Si la geometría solo trae una de las dos tablas, el aviso dice «geometría incompleta: falta …».
4. La organización recomendada es una carpeta por proyecto con las subcarpetas `COLUMNAS · LONGITUDINAL · MAXIMOS` y un .txt por chip (`T-5.txt`, `C-1.txt`). El **contenido** decide qué tipo de reporte es cada archivo, y el **nombre** decide a qué chip va.
5. El resumen tiene la forma «Reportes cargados en N trabe(s) y M columna(s) · … · todas con su máximo exacto». Algunos avisos posibles son «SIN máximos exactos: …», «sin sección que coincida: …», «no se reconocieron: …», «no se pudieron abrir (¿sólo en la nube?)» y «No se pudo leer … — si están en OneDrive, ábrelos una vez o márcalos «Conservar siempre en este dispositivo»».

---

## 5. Referencia rápida para automatizar (selectores)

| Acción | Selector o texto |
|---|---|
| Versión / novedades | `[data-testid=version]`, panel `[data-testid=novedades]` |
| Proyecto nuevo | botón `title="Proyecto nuevo (lo actual queda en Recientes)"` (+ confirm) |
| Nombre del proyecto | `input[placeholder=Proyecto]` |
| Menú Verificar | botón «Verificar» → «Resumido» / «Detallado» / «Memoria de cálculo» / «Exportar a Double Check» |
| Paleta de módulos | botón «Módulos» o Ctrl+K; buscador `placeholder="Buscar módulo…"` |
| Pestaña de módulo | `[data-testid=tab-cimentaciones]`, `tab-pesos`, `tab-longitudinal`, `tab-agrupacion`, `tab-deflexiones`, `tab-bdglobal` |
| Chip de sección / borrar | `[data-testid=chip-N]` / `[data-testid=chip-x-N]` (+ confirm) |
| Nueva sección | botón «+ Nueva» |
| Centro de carga | `[data-testid=cargar-envolventes]`; cerrar `[data-testid=cerrar-centro]` |
| Pestañas del centro | `[data-testid=tab-ram]`, `[data-testid=tab-manual]` |
| Configurar RAM | `[data-testid=config-ram]`, `[data-testid=ruta-ram]`, `[data-testid=generar-script]`, `[data-testid=bajar-catalogo]` |
| Sincronizar / olvidar | `[data-testid=sincronizar]`, `[data-testid=olvidar-carpeta]` |
| Avisos de sincronización | `aviso-medidas`, `usar-medidas-ram`, `aviso-invertida`, `faltan-secciones`, `crear-faltantes`, `sin-descripcion`, `propuestas`, `propuesta-<nombre>`, `centro-msg`, `carpeta-escribible`, `aviso-ruta` |
| Manual | `cargar-carpeta`, `cargar-todo`, `slot-acciones|estaciones|maximos|geometria`, `ayuda-<id>`; inputs `centro-files`, `centro-dir` |
| Reparto directo de .txt | input oculto `[data-testid=env-files]` |
| Abrir / Recientes / Guardar | `title="Abrir proyecto (.json)"` (input `type=file accept=.json`), `title="Proyectos recientes"`, `title="Guardar proyecto (.json)"` |
| Salidas gráficas | «SVG», `title="Escala de exportación DXF"`, «Exportar DXF» |
| Memoria | `[data-testid=mem-llenar]`, `[data-testid=mem-word]`, «Vista PDF», «Cancelar», «📎 Cargar Double Check (.dcheck)» |

Notas para el agente:

- El selector de carpetas (`showDirectoryPicker`) y las peticiones de permiso necesitan un **gesto real del usuario** y no se pueden automatizar con facilidad. En pruebas, usa el método manual con `setInputFiles`.
- Varias acciones usan `window.confirm` o `alert`, así que tienes que aceptar o descartar esos diálogos.
- Detallado y Vista PDF abren ventanas nuevas.

---

## 6. Avisos (toasts) comunes y qué significan

Los toasts salen arriba a la derecha y duran 4 s. Si son verdes, todo salió bien. Si son ámbar, hay que revisar algo.

| Aviso | Significado |
|---|---|
| «Sesión recuperada · N trabe(s), M columna(s)… · hace X» | Al abrir la app se cargó el autoguardado del navegador. |
| «Proyecto abierto · N trabe(s), M columna(s)…» | El .json se leyó bien. |
| «Proyecto reciente "X" abierto» | Se cargó desde Recientes. |
| «Proyecto guardado en Auxiliar IV\proyecto.json · el anterior quedó en 3 Respaldos» | Se guardó en la carpeta de la obra, con respaldo. |
| «No se guardó: la carpeta tiene otro proyecto» (ámbar) | Cancelaste porque la carpeta conectada es de otra obra. Revisa `rutaRam` y la carpeta. |
| «Verificación guardado en …» / «SVG guardado en …» / «DXF guardado en …» | La salida quedó en `2 Salidas`. Si no aparece ningún aviso, el archivo se descargó. |
| «Double Check guardado en … / exportado · N elemento(s) prellenados; falta añadir las capturas» | El .dcheck está listo. Ábrelo en el módulo Double Check. |
| «Reportes cargados en … · SIN máximos exactos: …» (ámbar) | Faltó el reporte «Máximos esfuerzos». El pico saldrá de las estaciones y puede quedarse corto. |
| «… · sin sección que coincida: …» | Hay archivos cuyo nombre no corresponde a ningún chip. Renómbralos o crea la sección. |
| «⚠ MEDIDAS DISTINTAS a las analizadas: …» (ámbar) | El chip y RAM no tienen la misma b×h. Ver §4.3. |
| «Creadas N sección(es) desde el modelo con su armado propuesto: k pasan, j a revisar» | Se crearon secciones con un armado automático. Revisa las marcadas ✗. |
| «Medidas puestas como en RAM: …» | Se adoptaron las b×h de RAM. |
| «El navegador no dio permiso para leer la carpeta. Vuelve a elegirla.» | Negaste el permiso, o el navegador lo revocó. |
| «No hay archivos legibles en «X».» | La carpeta no tiene .json, .txt, .csv ni .xlsx (fuera de las subcarpetas de la app). |
| «No se pudo sincronizar: …» / «No se pudo usar la carpeta: …» | Error de acceso a la carpeta. Cancelar el selector no muestra error. |

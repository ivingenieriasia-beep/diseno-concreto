# Módulos «Longitudinal», «Agrupación» y «Deflexiones»

Guía para operar la interfaz. Los conceptos de Agrupación (caps. 5–7 del manual), Deflexiones (cap. 10) y lo básico de Longitudinal (cap. 9) ya están en el manual de usuario y aquí no se repiten. Esta guía cubre lo que hace falta para manejar la pantalla: qué hay en ella, qué texto exacto lleva cada control, qué cambia al pulsarlo y cómo leer lo que sale. Todo lo de abajo se revisó contra el código (`src/components/*.jsx`, `src/core/*.js`).

## 0. Cómo se abren

- Los tres son módulos de tipo «pestaña». Se abren con el botón **Módulos** de la barra superior o con **Ctrl+K / ⌘K**. Palabras que los encuentran: «longitudinal», «alzado», «bastones», «estaciones»; «agrupación», «agrupar», «acomodo», «planta»; «deflexiones», «flechas», «L/240».
- Al abrirse quedan como pestaña junto a Secciones / Calculo / Columnas, con `data-testid="tab-longitudinal"`, `tab-agrupacion` y `tab-deflexiones`. Se cierran con la **×** de la pestaña (title «Cerrar Longitudinal (lo capturado se conserva)»), o con Supr/Retroceso si la pestaña tiene el foco. Cerrarla no borra nada.
- **Píldora de la pestaña Longitudinal**: dice cuántas trabes del proyecto tienen cargado un reporte por estaciones. Un **punto rojo** quiere decir que alguna trabe tiene miembros insuficientes o un armado corrido que no cumple (title «N trabe(s) con miembros insuficientes o armado corrido que no cumple»).
- **Longitudinal** trabaja sobre la trabe que esté seleccionada en los chips de la barra superior (`data-testid="chip-{i}"`; **+ Nueva** crea una). **Agrupación** y **Deflexiones** no dependen del chip: leen el último modelo.json sincronizado.
- **Atajo desde Calculo**: en la tabla «Envolvente del modelo» de la pestaña Calculo, cada miembro tiene el botón **bastonear →** (`data-testid="bastonear-{miembro}"`). Abre Longitudinal enfocado en ese miembro (ver §1.6, banner 🎯).

---

# 1. Longitudinal

## 1.1 Para qué sirve

Revisa una trabe (un chip del proyecto) **a lo largo**. Para eso usa las demandas por estaciones de **todos** los miembros de RAM que pertenecen a ella. La base del análisis es el diseño de la sección: varillas corridas más el **bastón corrido** del corte. Con esa base calcula MR+ y MR−. Donde el momento actuante las rebasa, reparte **bastones puntuales**: sólo en ese tramo y sólo en el elemento que los pide. A cada bastón le da su longitud (prolongación ≥ máx(d, 12db), Ld desde el pico, múltiplos de 5 cm y mínimo práctico de obra), revisa el cortante por zonas de estribos y agrupa los elementos con el mismo bastoneo en **patrones**, para dibujar pocos alzados. Además compara el acero total contra el diseño «uniforme» y exporta los alzados a DXF. Si hay geometría del modelo, une los miembros colineales de RAM en **elementos** (la trabe física) y dibuja el modelo en 3D o en planta.

### Vocabulario que usa la pantalla

| Término | Qué es en la app |
|---|---|
| **Perfil** | El reporte de esfuerzos a lo largo de la trabe que vive dentro de la sección (`form.perfil`). Guarda: archivo, combinación, miembros con sus estaciones (M33 y V2 máx/mín por estación), L del grupo, L por miembro (`Lpor`), M33 invertido sí/no, bastón mínimo, `porElemento`, lista de miembros **excluidos** y si se ajusta a los máximos (`ajustarAMaximos`). Se guarda con el proyecto. |
| **Miembro** (`M-97`) | Un miembro de RAM tal cual. |
| **Elemento** (`E 97…100`, o `E 97` si es de un solo tramo) | Una cadena de miembros colineales que comparten nudo: la trabe física, de I a J. Sólo existe si hay geometría. |
| **Unidad** | Lo que se analiza en cada fila: un elemento (con «por elemento» activo y geometría) o un miembro suelto. |
| **Bastón corrido** | Va en toda la longitud, se dibuja en el corte y cuenta en MR. Son los campos `cantBastonInf/Sup` de la sección. Es parte de la **base**. |
| **Bastón puntual** | Sólo existe donde el momento lo pide. No va en el corte; se dibuja en el alzado con su longitud. Se anota en `cantBastonPuntInf/Sup` de la sección. |
| **Patrón** (A, B, C…) | Grupo de unidades con la misma firma de bastones (mismos k, posiciones y longitudes). Un alzado por patrón. Si existe el patrón sin bastones, es siempre **A**; los demás se ordenan del más numeroso al menos. |
| **Base** | MR+ / MR− con corridas + bastón corrido. |
| **Al filo** | Pasa con menos de 12 % de holgura y el pico sale sólo de las estaciones impresas, sin máximo exacto. Eso no verifica nada. |

## 1.2 Cómo se cargan los datos

Hay dos caminos. El resultado es el mismo: un **perfil** en la trabe y una **geometría del modelo** que comparten todas las trabes.

### A) Sincronizando el modelo.json (camino normal)

Con **📥 Reportes de RAM** (barra superior, `data-testid="cargar-envolventes"`), o con **🗂 Carpeta de todo el proyecto…** desde Longitudinal (`data-testid="abrir-centro-long"`, abre el mismo Centro de carga), sincronizas el modelo.json del script de RAM. Con eso:
- Cada chip cuyo nombre coincide con un grupo de RAM (T1 ≈ T-1) recibe su perfil, con los picos ya afinados por el script. Cuentan como máximos exactos, así que no salen avisos «al filo» por estaciones.
- La geometría (nudos + miembros) queda guardada como modelo del proyecto.
- En Longitudinal no hay que cargar nada más: los pasos 1 y 2 aparecen con ✓.

### B) Con reportes de texto de RAM, en la propia pestaña

- **📂 Cargar reportes de RAM** (`data-testid="cargar-ram"`) abre el selector, que acepta varios archivos `.txt`, `.csv` o `.xlsx`. El `<input type=file>` oculto es `data-testid="perfil-file"`; para automatizar, ponle los archivos ahí. También puedes **soltar los archivos en cualquier parte de la pestaña**: aparece el aviso «Suelta aquí los reportes de RAM (.txt / .xlsx)».
- La app decide qué es cada archivo **por su contenido**, no por su nombre, y en este orden:
  1. `.xlsx` → tabla de **nudos** (primera hoja; columnas id, X, Y, Z).
  2. **Acciones discriminadas y puntos de inflexión** (el mejor reporte) o **Envolvente de esfuerzos por estaciones** → **perfil** de la trabe. Del mismo archivo sale también la envolvente de la sección, salvo que ya hubiera una cargada de «Máximos esfuerzos en miembros»: ésa no se pisa.
  3. **Datos de Geometría → Guardar como TXT** (Nudos + Miembros en un archivo) → **geometría del modelo**.
  4. **Máximos esfuerzos en miembros** → envolvente de la sección, con el pico exacto, que también usa el análisis a lo largo.
  5. Cualquier otra cosa: «{archivo}: no se reconoció (ni esfuerzos ni geometría)».
- Lo que entendió de cada archivo sale en una línea gris bajo la barra (`data-testid="perfil-msg"`). Frases útiles para verificar:
  - `…: acciones discriminadas (puntos de inflexión) · N miembros · K estaciones · {combo}` o `…: envolvente por estaciones · …`
  - `· con el bloque de máximos (picos exactos)` / `· sólo X de N traen el bloque de máximos` / `· SIN el bloque de máximos: los picos salen de las estaciones impresas`
  - `…: N miembros + M nudos` (geometría) y luego `N longitudes calculadas · E elementos (k formados por varios miembros colineales)`
  - `falta el reporte de miembros (NJ/NK)` / `faltan las coordenadas de los nudos`
  - `…: máximos por miembro (N) → envolvente de la sección, y el pico exacto para el análisis a lo largo (las estaciones impresas se quedan cortas)`
- La **geometría es del proyecto**, no de la trabe. Se carga una vez y la usan todas las trabes.

### Las fichas de paso (barra superior)

| Ficha | Lista (✓ verde) cuando | Texto de detalle | Clic en el título | ✕ (title «quitar») |
|---|---|---|---|---|
| **1 · Esfuerzos por estaciones** | la trabe tiene perfil | `{archivo} · N miembros · {combo}`; si falta, «.txt de la envolvente por estaciones» | abre el selector | Borra el perfil de **esta** trabe (y su envolvente si había salido de las estaciones). |
| **2 · Geometría del modelo** | hay miembros y nudos | `{archivo} · N miembros · M nudos · E elementos`; si falta, «opcional · .txt «Datos de Geometría»» | abre el selector | Borra la geometría de **todo el proyecto** (es compartida). |

Al pasar el mouse por cada ficha sale el reporte de RAM que pide.

### Estados vacíos

- Sin trabe seleccionada: «Selecciona una trabe (o crea una con “+ Nueva”) para analizarla a lo largo».
- Sin perfil y sin geometría: tarjeta «**Analizar {trabe} a lo largo**» con las instrucciones «1 · Esfuerzos» y «2 · Geometría», y el botón **📂 Elegir archivos…**.
- Sin perfil pero con geometría: «**Falta el paso 1:** en RAM, Miembros → Envolvente de esfuerzos …», el botón **📂 Elegir archivo…** y, debajo, el modelo dibujado sin colores de estado.

## 1.3 Anatomía de la pantalla

### Barra superior (de izquierda a derecha)

- **Nombre de la trabe** y su resumen: `b×h · corridas n#c abajo / n#c arriba · bastón #c/#c · E#c@s1/s2`.
- **📂 Cargar reportes de RAM**, **🗂 Carpeta de todo el proyecto…**, y las fichas 1 y 2.
- Sólo si hay perfil:
  - Casilla **por elemento (N)**. Sólo aparece si la geometría formó cadenas. Viene marcada. Marcada, analiza elementos completos; desmarcada, cada miembro de RAM por separado. Tooltip: «Une los miembros colineales de RAM que comparten nudo y analiza el elemento completo».
  - Campo **L del grupo (m)** (`data-testid="perfil-L"`, placeholder `4.00`). Sólo aparece si falta la longitud de alguna unidad o no hay geometría. Se guarda al salir del campo o con Enter.
  - **⚙ Ajustes**: abre o cierra la fila de ajustes.

### Fila «⚙ Ajustes»

| Control | Qué hace |
|---|---|
| **bastón mín (m)** (número, paso 0.05, por defecto 0.6) | Longitud mínima práctica de un bastón. Uno más corto se alarga simétricamente respecto al pico, sin salirse del claro. |
| **M33 normal ⇄** / **M33 invertido ⇄** | Invierte el signo de M33, en el perfil y en la envolvente de la sección, para modelos donde el positivo va al revés. |
| **L del grupo (m)** | El mismo campo de arriba, pero aquí se ve aunque haya geometría. Sirve de longitud por omisión. |
| Texto | «Puedes soltar los .txt de RAM en cualquier parte de esta pestaña.» |

### Franja de avisos (ver §1.7)

### Barra de resumen del grupo (una franja con color)

- **Verde**: todo pasa y el corrido cumple. **Rojo**: hay insuficientes, fallas por cortante o el corrido no cumple. **Ámbar**: el resto (piden puntuales, al filo…).
- Textos, en orden:
  - `N elementos:` (o `N miembros:` si no hay elementos)
  - `X cubiertos con el diseño` (verde): les basta lo que la trabe lleva en toda su longitud.
  - `Y piden bastón puntual` (azul)
  - `Z insuficientes` (rojo, si hay)
  - `W fallan por cortante` (rojo, si hay)
  - `⚠ F al filo` (`data-testid="al-filo"`)
  - `⚠ S con s > s máx`: la separación de estribos pasa de d/2 (o de d/4 con cortante alto). Es sólo un aviso; no cuenta como falla.
  - `base MR+ a · MR− b t·m (sólo corridas)` o `(corridas + i/s bastón corrido)`
  - A la derecha: `acero: T kg (B corridas + K bastones) · uniforme n#c/n#c: U kg → ahorro|exceso D kg (p %)`. «Uniforme» es lo que pesaría subir el corrido de toda la familia para cubrir el pico, sin bastones. Si no hay uniforme posible con ese calibre y ancho, ese tramo del texto no aparece.
- Ojo: «fallan por cortante» no excluye a los otros contadores. Un elemento sin bastones que falla por cortante se cuenta en «cubiertos» y también en «fallan por cortante».
- Debajo, una línea fija recuerda la diferencia entre **Bastón corrido** y **Bastón puntual** y repite la base de la trabe.

### Fila de acciones del grupo

| Botón (texto exacto) | `data-testid` | Cuándo aparece | Qué cambia |
|---|---|---|---|
| **⇢ Correr el bastón en la sección (a/b → c/d)** | `correr-baston` | si el grupo pide algún puntual | Convierte los puntuales en **corridos**. Bastón corrido inf = mín(corridas inf, corrido actual + máx. puntual del grupo), y lo mismo arriba. Los puntuales quedan en 0. El corte cambia, sube el MR de la base y el grupo deja de pedir puntuales. Detalle más simple, más acero. |
| **← Anotar k/k bastones puntuales en {trabe} (hoy x/y)** | `cubrir-grupo` | si lo anotado en la trabe no coincide con el máximo que pide el grupo | Pone `cantBastonPuntInf/Sup` = lo máximo que pide cualquier elemento. **El corte no cambia**: los puntuales salen en el alzado y los usan Calculo («✓ con bastón puntual») y Deflexiones. |
| **⧉ Separar los N que piden puntual en otra trabe** | `separar-criticos` | si algunos (no todos) piden puntual | Ver §1.5 «Separar». |
| **⚙ Optimizar armado corrido (mínimo acero)** / **Ocultar optimizador** | — | siempre | Abre o cierra el panel del optimizador. |
| **⬇ DXF alzados · {trabe}** | `dxf-long-one` | siempre | DXF con un alzado por patrón de esta trabe. |
| **⬇ DXF alzados · todas (N)** | `dxf-long-all` | siempre | Igual, para todas las trabes que tienen perfil, apiladas. |
| **ver** `todos (n)` / `piden puntual (n)` / `no alcanzan (n)` | `filtro-todos`, `filtro-criticos`, `filtro-baston` | sólo en la vista Miembros | Filtra la tabla (ver §1.4). |
| **Miembros** / **Patrones (N)** / **🏗 Modelo** | `view-tabla`, `view-patrones`, `view-modelo` | 🏗 Modelo sólo si hay geometría | Cambia el panel izquierdo. |

### Panel del optimizador

- Título: «Armado corrido de mínimo acero (corridas + bastones, todos los miembros cubiertos, bastón del mismo calibre)».
- Dos filas, **Lecho inferior (M+):** y **Lecho superior (M−):**. Cada una muestra hasta 4 opciones, como `n#c  kg kg · MR x · m c/bastón`. La primera, en verde, es la de menos acero.
- Busca en calibres #3 a #6 y de 2 a 8 varillas. Descarta los armados que no cumplen As mín, As máx o b mín, y los que dejan algún elemento insuficiente. El bastón usa el mismo calibre que la corrida, con máximo uno por varilla.
- Si ninguno sirve: «ningún armado de #3–#6 cubre todos los miembros con esta sección».
- **← Aplicar a la sección (n#c abajo / n#c arriba)** cambia calibre y cantidad de las corridas y pone el calibre del bastón igual al de la corrida. El bastón corrido queda en 0 y los puntuales quedan anotados con el nuevo máximo del grupo. Después cierra el panel.

## 1.4 Panel izquierdo

### Vista «Miembros» (tabla)

Columnas: **Elemento** (o **Miembro**) · **L (m)** · **Mu+** · **Mu−** · **Vu** · **Bastón puntual inf.** · **Bastón puntual sup.** · **Estado**.

- **Elemento/Miembro**: `E 97…100` o `M-97`. En un elemento, la línea chica dice `n tramos: 97 · 98 · 99 · 100 · k apoyo(s) int.`. En un miembro suelto sale su sección de RAM y el enlace **excluir**. Las filas de los excluidos aparecen al final, atenuadas, con el enlace **incluir** y la píldora `excluido del grupo · {sección}`. Sólo se ven con el filtro «todos».
- **L (m)**: si la longitud vino del reporte, de la geometría o del elemento, sólo se muestra. Si no, aparece un campo para capturarla por miembro (placeholder = L del grupo).
- **Mu+** sale en azul si pasa del MR+ de la base; **Mu−** en naranja si pasa del MR−; **Vu** en rojo si falla por cortante. Estos valores ya vienen ajustados a los máximos de RAM (ver aviso de ajuste).
- **Bastón puntual inf./sup.**: cada bastón se escribe `k#cal L=longitud @x0`, separados por « · », y «—» si no hay. `@x0` es la distancia desde el apoyo I. `⟂I`, `⟂J` o `⟂IJ` quiere decir que el bastón llega al apoyo y se ancla ahí con gancho.
- **Estado** (píldora):

| Píldora | Significa |
|---|---|
| `✓ con el diseño` (verde) | Le basta la base: corridas + bastón corrido. |
| `✓ al filo (x % en MR+ / MR− / Vr extremos / Vr centro)` (ámbar) | Pasa con menos de 12 % de holgura en ese concepto y el pico sale de estaciones impresas. El tooltip explica que el real puede ser mayor. |
| `+k abajo / k arriba puntual` (azul) | Pide bastón puntual. |
| `✗ insuficiente` (rojo) | Ni con un bastón por cada varilla corrida libre alcanza la flexión, o la sección no da para el cortante con ningún estribo. |
| `✗ cortante` (rojo) | Con los estribos de la sección no pasa el cortante en extremos o centro. |

- Una fila se selecciona con un clic y se resalta. Las filas insuficientes o con falla de cortante tienen el fondo rosa.
- **Filtros**:
  - **todos**: todas las filas.
  - **piden puntual**: las que piden puntual, más las insuficientes y las que fallan por cortante.
  - **no alcanzan**: insuficientes o con falla de cortante.
  - Con un filtro activo, al final sale `x de n · ver todos`.
- Al entrar a la pestaña sin selección, queda seleccionado el primer elemento que no está «ok». Si todos están bien, el primero.

### Cómo leer «cubiertos / piden bastón puntual / no alcanzan»

- **Cubiertos con el diseño**: el corte actual basta en toda su longitud. No hay que hacer nada.
- **Piden bastón puntual**: tienen picos locales sobre la base. Hay tres salidas: (a) **Anotar** los puntuales y dibujarlos en el alzado; (b) **Correr** el bastón, que simplifica el detalle con más acero; (c) **Separar** esos elementos en otra trabe para no castigar a toda la familia.
- **No alcanzan** (insuficientes o cortante): ningún bastoneo los resuelve. Sube el corrido (⚙ Optimizar), la sección o los estribos. También puedes separarlos para darles otra sección.

### Vista «Patrones (N)»

Una tarjeta por patrón, que dice:
- **Patrón A** y cuántas unidades tiene (`n miembros`), con la píldora de estado de su muestra.
- Las líneas `inf: …` y `sup: …` con los bastones.
- La lista de unidades: `E 97…100, M-12…`.

Un clic selecciona la muestra del patrón y el alzado de la derecha toma el título `… · patrón X`. Cada patrón es un alzado en el DXF.

### Vista «🏗 Modelo»

Es el modelo reconstruido a partir de nudos y miembros. Ocupa el 58 % del ancho.
- Botones de vista: **Isométrica** · **Planta** · **Frente** · **Lado** (`vista-iso`, `vista-planta`, `vista-frente`, `vista-lado`; de fábrica, isométrica).
- Selector de nivel (`data-testid="modelo-nivel"`): **todos los niveles** o `Y = 3 m (n nudos)`. El eje vertical lo detecta solo (Y en RAM).
- Casillas **sólo {trabe}**, que oculta el resto del modelo, y **nudos**, que muestra los nudos. Botón **⤢ ajustar**, que reencuadra.
- Ratón: rueda = zoom en el cursor · arrastrar = mover · **clic en un miembro** = selecciona su elemento en la tabla y lo muestra a la derecha. El SVG es `data-testid="modelo-svg"`; cada miembro lleva `data-id="{miembro}"`.
- Leyenda de colores: **pasa con corridas** (verde) · **requiere bastón** (azul) · **insuficiente / cortante** (rojo) · **excluido** (gris) · **resto del modelo** (gris claro) · **seleccionado** (ámbar).
- Al pasar el mouse sale una tarjeta: `M-97 · {descripción}` / `{sección} · L = x m · trabe|columna|diagonal` / `nudos a–b` / `elemento X · clic para verlo`.
- Pie: `{archivo} · n nudos · m miembros` · `a la vista: n · k de esta trabe · j con problema`. La rotulación de ejes en planta sale como `planta · Z← X↓` (como RAM).
- Sirve para ver si una trabe continua se encadenó bien: si sale partida, en RAM sus tramos no comparten nudo o no son colineales (coseno ≥ 0.995). Si dos tramos colineales se cruzan en un nudo de manera ambigua, tampoco se unen.

## 1.5 Panel derecho: el elemento seleccionado

### Encabezado

- `E 97…100` y su píldora de estado.
- Píldoras de aviso, cuando aplican:
  - `⚠ s máx X cm (NTC d/2 ó d/4)`
  - `⚠ perfil ajustado ×k a los máximos de RAM (Mu+ a · Mu− b)`
  - `extremos: E@s necesario`, `centro: E@s necesario`: la separación de estribos que haría falta.
- Cifras:
  - `Mu+ a / MR+ b`
  - `Mu− a / MR− b`
  - `Vu a / Vr L4 b · centro c`
  - `Ld bastón i/s cm · prolongación ≥ máx(d, 12db) = e cm`

### Botones de la unidad

| Botón | `data-testid` | Qué hace |
|---|---|---|
| **← Anotar su bastón puntual (k/k)** (se desactiva y agrega « · ya está» si coincide con lo anotado) | `aplicar-baston` | Anota en la trabe los puntuales que pide **este** elemento. Si otros piden más, sale la píldora `el grupo pide hasta a/b` y el tooltip advierte: «Anótalo así si vas a separarlo en su propia trabe». |
| **⧉ Separarlo en otra trabe** | `separar-uno` | Saca este elemento a una trabe aparte. |
| Texto gris | — | `con k/k puntual(es): MR+ · MR− t·m vs Mu+ · Mu−`: la resistencia que tendría con esos puntuales. |

### «Separar» (los dos botones ⧉)

1. Crea una **trabe nueva**, copia de la actual, con nombre libre `{trabe}a`, `{trabe}b`… y la **deja seleccionada**. Se lleva sólo los miembros de las unidades elegidas: su perfil y su envolvente.
2. Los quita de la trabe original: los añade a su lista de **excluidos** y los borra de su envolvente.
3. En la trabe nueva anota los puntuales que piden (`cantBastonPunt` = k). Además pone el **bastón corrido del corte** (`cantBastonInf/Sup`) igual a esa k, así que en la trabe nueva esos bastones cuentan como base. Revisa en Secciones si los quieres corridos o puntuales.
4. Mensaje: `{nueva}: N elemento(s) (M miembro(s)) con i/s bastón(es). {original} ya no los incluye.` Si alguno no alcanza ni así: `… no alcanzan ni con un bastón por varilla: súbeles el armado corrido o la sección (⚙ Optimizar).`

### Avisos del elemento

- Rojo, si es insuficiente: «Ni con i/s bastón(es) puntual(es) más (uno por varilla libre) alcanza: M+ x en x=… m (MR máx …). … Sube el armado corrido o la sección.»
- Ámbar, si algún bastón termina donde hay tensión con Vu > ⅔·Vr: «Un bastón se corta en zona de tensión con Vu > ⅔·Vr en el punto de corte (NTC §5.1.4.1): prolónguelo o añada estribos en ese tramo.»

### Diagrama de momento y cortante (arriba)

- **Momento (t·m) · E … · L = x m · k apoyo(s) interior(es)**. Con la convención de RAM: **M+ hacia arriba** (azul) y **M− hacia abajo** (naranja).
- Líneas punteadas: `MR+ corridas x` / `MR− corridas x`. Si hay bastón corrido dicen `MR+ base (corridas + bastón corrido) x`.
- Curva gruesa: `MR+ con k bastón(es) puntual(es) x — envolvente desarrollada (Ld y m)`. Es la resistencia real: sube en rampa a lo largo de Ld donde empieza el bastón y baja donde termina.
- Zona verde achurada = «cubierto por el acero». Rectángulos tenues azul y naranja = dónde van los bastones. Etiquetas de pico: `Mu+ x @ x m`, `Mu− x @ x m`.
- **Puntos rojos** = sitios donde Mu rebasa la envolvente. No deberían quedar, porque el bastón se alarga de 5 en 5 cm hasta cubrir. Si los ves, hay un problema.
- **Cortante V2 (t) · envolvente máx y mín · estribos E#c @ a / b · se diseña con |V| x**. Las líneas `±Vr L/4 x · centro y` y los picos `V+ x`, `V− x`. Se diseña con el mayor valor absoluto.

### Alzado (abajo)

- Cabecera: **Alzado** `E … · L = x m`. Zoom **ajustar** · **1×** · **2×**; en 1× y 2× dice «(desplázate horizontalmente)».
- El dibujo va a escala real:
  - Corridas arriba y abajo con gancho en los apoyos, rotuladas `n#c corridas` o `… + k#c bastón corrido`.
  - Cada bastón puntual en segunda capa: `bastón puntual k#c L=x m (anclar en I)`, con sus cotas debajo, medidas desde el **apoyo I**.
  - Estribos dibujados por zonas de cada claro (cuartos extremos con `sepLcuarto`, centro con `sepRest`), con `E#c @ s` y la longitud de cada zona.
  - Triángulos = apoyos interiores, detectados donde el cortante salta y cambia de signo. Rótulos `M-id` en el arranque de cada tramo de RAM.
  - Rótulos `L = x m`, `apoyo I`, `apoyo J` y el título `{trabe} · E …`.
- Nota al pie: resume las reglas de longitud (Ld, prolongación, múltiplos de 5 cm, anclaje con gancho al llegar a un extremo) y recuerda que los alzados salen en su propio DXF.

## 1.6 Flujos paso a paso

**A. Revisar una trabe ya sincronizada**
1. Selecciona su chip y abre la pestaña Longitudinal.
2. Mira la franja de resumen. Si es verde, terminaste con esa trabe.
3. Con «piden puntual (n)» filtra las que piden puntual y revísalas una por una en el diagrama.
4. Decide entre **← Anotar k/k bastones puntuales…** (`cubrir-grupo`) y **⇢ Correr el bastón en la sección** (`correr-baston`).
5. Exporta **⬇ DXF alzados · {trabe}**.

**B. Cargar a mano desde reportes de texto**
1. En RAM, Miembros → Acciones discriminadas y puntos de inflexión (o Envolvente de esfuerzos por estaciones) de los miembros de ese tipo de trabe. Guárdalo como TXT.
2. (Recomendable) Datos de Geometría → Guardar como TXT.
3. **📂 Cargar reportes de RAM**: elige los dos archivos a la vez, o suéltalos en la pestaña.
4. Lee la línea `perfil-msg`. Si dice «SIN el bloque de máximos», carga también «Máximos esfuerzos en miembros» del mismo grupo.
5. Si falta L, captúrala en **L del grupo (m)** o por miembro en la tabla.

**C. Unos pocos elementos castigan a toda la familia**
1. Filtra **piden puntual (n)**.
2. Si son pocos, pulsa **⧉ Separar los N que piden puntual en otra trabe**.
3. Queda seleccionada la trabe nueva (`{trabe}a`). Revisa su sección en Secciones y vuelve a Longitudinal para cada una.

**D. Ajustar el corrido al mínimo acero**
1. Pulsa **⚙ Optimizar armado corrido (mínimo acero)**.
2. Compara las opciones verdes de cada lecho.
3. Pulsa **← Aplicar a la sección (…)**.
4. La tabla se recalcula sola; revisa que no queden insuficientes.

**E. Llegar desde la envolvente**
1. En Calculo, en la tabla «Envolvente del modelo», pulsa **bastonear →** en el miembro que no pasa.
2. Longitudinal se abre con el banner azul **🎯 M-{id}** «llegó desde la envolvente para resolverlo con bastones.» y selecciona el elemento que lo contiene.
3. Si fallaban varios, el banner trae el botón **¿Trasladar también los demás? — ver sólo los que piden puntual (n)** (`foco-todos`).
4. Si la trabe aún no tiene perfil, el banner pide cargar el paso 1. Se cierra con **✕**.

**F. Excluir miembros que no son de esta trabe**
- Con «por elemento» desmarcado, cada miembro tiene su enlace **excluir**. Con «por elemento» marcado, el enlace no aparece en los elementos: usa los botones de los avisos (otra sección, compartidos) o desmarca «por elemento».
- Si excluyes un tramo de un elemento, el resto de esa cadena se analiza en miembros sueltos.
- **incluir** (en la fila atenuada) o **restaurar** (en el aviso de sección) los regresan.

## 1.7 Avisos comunes (texto y qué hacer)

| Aviso (inicio del texto) | Color | Causa | Qué hacer / botón |
|---|---|---|---|
| «Captura la longitud L del grupo (o por miembro en la tabla), o carga la geometría del modelo para calcularla sola.» | ámbar | Alguna unidad no tiene L. | Llena **L del grupo (m)** o carga la geometría. |
| «N miembro(s) de este reporte también están en {otra}: … se están diseñando dos veces, con dos secciones distintas.» | ámbar | Una variante separada cuya trabe original sigue trayendo esos miembros. | **Excluirlos de {trabe}** (`excluir-compartidos-{otra}`). |
| «N miembro(s) del reporte tienen otra sección que esta trabe (b×h): sec ×n …» | ámbar | La sección en RAM no coincide con la del chip. | **Excluir del grupo los de otra sección (M-…)**; se deshace con **restaurar**. |
| «N elementos tienen el perfil ajustado a los máximos que reporta RAM: … el mayor ajuste es ×k en E …» | ámbar | Las estaciones impresas se quedaban cortas frente al pico exacto, así que se escaló el perfil. Es lo correcto. | **usar sólo las estaciones** (`toggle-ajuste`); no se recomienda. |
| «Se están usando sólo las estaciones impresas: …» | rojo | Se apagó el ajuste. | **respetar los máximos del reporte** (`toggle-ajuste`). |
| «La envolvente de la sección pide más que este reporte en N elemento(s). …» | rojo | La envolvente y el reporte por estaciones vienen de archivos o combinaciones distintas. El diseño ya usa el mayor de los dos. | Reexporta el reporte por estaciones con las mismas combinaciones. |
| «N elemento(s) pasan por muy poco y su pico sale sólo de las estaciones impresas de {archivo} …» (`aviso-filo`) | ámbar | No hay bloque de máximos; la holgura es menor de 12 %. | **cargar «Máximos esfuerzos en miembros»** (`cargar-maximos`). |
| «El armado corrido no cumple por sí solo (As mín, As máx o b mín): MR+ · MR− t·m. Sube el armado corrido antes de repartir bastones.» | rojo | La base no es válida. | Cambia las corridas en Secciones o usa ⚙ Optimizar. |
| «No hay alzados que exportar: carga el reporte por estaciones y la longitud (o la geometría).» | mensaje | DXF sin perfil o sin L. | Paso 1 y la L. |
| «DXF de alzados {dónde}: n patrón(es) de m trabe(s), a escala real (1 unidad = 1 cm…)» | mensaje | Exportación correcta. | El archivo `alzados-{proyecto}-{trabe}.dxf` (o `alzados-{proyecto}.dxf` para todas) queda en `2 Salidas\Planos` de la obra, o se descarga si no hay carpeta. |

## 1.8 Qué no hace

- **No cambia el corte con los puntuales.** Anotarlos sólo los registra en la sección; para que vayan en el corte hay que **correrlos**.
- No toca RAM ni reanaliza; trabaja con los esfuerzos que le cargas.
- No modifica estribos: usa `sepLcuarto` y `sepRest` de la sección y dice qué separación haría falta (`E@s necesario`). Pasarse de s máx es sólo aviso.
- No revisa deflexiones; eso es el módulo Deflexiones.
- Bastones: el calibre es el `calBaston` de la sección, con máximo uno por cada varilla corrida que no sea ya bastón corrido. El optimizador sólo prueba #3–#6 y de 2 a 8 varillas.
- Los apoyos interiores se deducen del cortante (heurística); no vienen de la geometría.
- El DXF de alzados va aparte del DXF de secciones de la barra superior.

## 1.9 Tabla de `data-testid` (Longitudinal y modelo)

| testid | Elemento |
|---|---|
| `perfil-file`, `geom-files` | inputs de archivo ocultos (los dos hacen lo mismo) |
| `cargar-ram` | 📂 Cargar reportes de RAM |
| `abrir-centro-long` | 🗂 Carpeta de todo el proyecto… |
| `perfil-L` | L del grupo (m) de la barra |
| `perfil-msg` | línea de mensajes |
| `foco-todos` | ¿Trasladar también los demás? … |
| `excluir-compartidos-{trabe}` | Excluirlos de … |
| `toggle-ajuste` | usar sólo las estaciones / respetar los máximos del reporte |
| `aviso-filo`, `cargar-maximos`, `al-filo` | aviso, botón y contador «al filo» |
| `correr-baston`, `cubrir-grupo`, `separar-criticos` | acciones del grupo |
| `dxf-long-one`, `dxf-long-all` | DXF de alzados |
| `filtro-todos`, `filtro-criticos`, `filtro-baston` | filtros de la tabla |
| `view-tabla`, `view-patrones`, `view-modelo` | Miembros / Patrones / 🏗 Modelo |
| `aplicar-baston`, `separar-uno` | botones del elemento seleccionado |
| `vista-iso`, `vista-planta`, `vista-frente`, `vista-lado`, `modelo-nivel`, `modelo-svg` | vista del modelo |

---

# 2. Agrupación

## 2.1 Para qué sirve

Parte de un modelo de RAM sin agrupar (todo 15×20 y sin descripción) y propone unas pocas **T** (trabes) o **C** (columnas), cada una con su sección del catálogo. Da tres propuestas automáticas (**Pocos grupos**, **Equilibrada**, **Ajustada**) y un **acomodo manual**. Cada grupo se verifica con la Fase 1, el mismo motor que arma las secciones. Al final genera **aplicar_agrupacion.py**, que en RAM pone a cada miembro su descripción y su sección. Los criterios están en los caps. 5–7 del manual; aquí va lo que necesitas para manejar la pantalla.

## 2.2 Anatomía

### Encabezado y fuente

- Título: **Agrupación de trabes** o **Agrupación de columnas**, con la nota «Primera iteración: las demandas son las del análisis con las secciones de hoy. Aplicar, reanalizar y volver a agrupar.»
- Recuadro de fuente (`data-testid="agr-fuente"`):
  - Con modelo: `Modelo: {archivo} · N nudos · M miembros · hace X min`, seguido de `· con las medidas reales de RAM` o `· medidas deducidas de los nombres (sincroniza con el script nuevo para tener las reales)`.
  - Sin modelo: «No hay modelo todavía: sincroniza en **Reportes de RAM**, o carga un **modelo.json**.»
  - Botón **Cargar modelo.json…** (input oculto `data-testid="agr-archivo"`, acepta `.json`).
  - El módulo toma solo el último modelo sincronizado y se actualiza si vuelves a sincronizar con la pestaña abierta.
- Si el archivo no se puede leer sale un texto rojo con el motivo.

### Interruptor Trabes | Columnas

- `data-testid="agr-pieza"`, con los botones `agr-pieza-trabe` (**Trabes**) y `agr-pieza-columna` (**Columnas**). Cada botón dice cuántos miembros hay de ese tipo (`N miembros`).
- A la derecha, el criterio:
  - Trabes: «por flexión y cortante: momento con ½ ρ balanceada, cortante con estribos que se pueden armar».
  - Columnas: «por flexocompresión: la demanda de cada columna sobre el diagrama de interacción de cada sección».
- Lo que hiciste en cada pieza se conserva al cambiar a la otra. La pieza elegida se recuerda entre sesiones.

### Paso 1 · Qué agrupar

- Arriba a la derecha: «Se sugieren las trabes de 15 cm o más; las nervaduras y las columnas, no» (o «Se sugieren los grupos de columnas; las trabes, no»).
- Una casilla por grupo de RAM (`data-testid="agr-grupo-{nombre}"`). Cada una muestra el nombre (o `(sin nombre)`), `b×h` o la sección, y el número de miembros. Si el grupo es de otro tipo se agrega `· columna` o `· trabe` y la casilla se ve atenuada.
- **Trabes**:
  - **Anchos que se pueden proponer:** 15 / 20 / 25 cm (`agr-ancho-{b}`).
  - **Peraltes que se pueden proponer:** 20 25 30 35 40 45 50 cm (`agr-peralte-{h}`).
  - Selector **tope** (`agr-tope`): marca todos los peraltes hasta ése y ninguno más grande.
  - Si no queda ninguno marcado: «Marca al menos un ancho y un peralte.»
  - Anchos y peraltes se recuerdan entre sesiones.
- **Columnas**:
  - **Secciones que se pueden proponer:** casillas `15×15 … 36×36` (`agr-colsec-{b}x{h}`). De fábrica vienen las de 20 cm o más por lado; las de 15 cm son castillos.
  - **Misma sección en toda la altura** (`agr-completa`).
  - Si no queda ninguna marcada: «Marca al menos una sección.»
  - Aviso `agr-sin-m22`: «**Este modelo.json es de un sincronizar.py anterior:** …»
- `agr-sin-elementos`: «Esos grupos no tienen miembros horizontales (trabes) con resultados.» (o «miembros verticales (columnas)»).

### Paso 2 · Propuestas

- Arriba a la derecha: `N trabes continuas · hoy G grupos, X m³ · sin juntar nada serían K grupos, Y m³` (en columnas: `columnas completas` o `columnas por entrepiso`).
- **Tarjetas** `agr-propuesta-pocos`, `agr-propuesta-equilibrada`, `agr-propuesta-ajustada`. La elegida de fábrica es **Equilibrada**. Cada tarjeta trae:
  - Nombre y botón **✎ a mano** (`agr-ajustar-{id}`).
  - Subtítulo: «sube una clase de sección si su trabe más cargada aprovecharía la mayor al 50 % / 65 % / 80 %».
  - `N grupos` (`agr-ngrupos-{id}`) · `X m³ (+p % vs hoy)` · `K kg` (mientras verifica: `verificando i/n…`).
  - Estado (`agr-estado-{id}`): «armando cada grupo con la Fase 1…» → «✓ todos los grupos pasan con su armado propuesto» o «✗ N grupo(s) a revisar».
  - Una fila por grupo: `✓ T1` / `✗ T1` (o `·` mientras se verifica) · sección `20×40` (con ` ⚠` si alguna trabe no cabe) · `n trabe(s) · m miembros` · `aprovechamiento a %–b %`. Si hay problema se agrega el primer motivo de la Fase 1 en rojo, o «ninguna sección permitida alcanza» / «no cabe en la sección fijada».
  - **Un clic en la tarjeta la elige**: es la que se dibuja en el paso 3 y la que baja el paso 4.
- **Cuarta tarjeta, Manual** (`agr-propuesta-manual`):
  - Si no hay acomodo: recuadro punteado con **✎ partir de «{propuesta elegida}»** (`agr-desde-elegida`) y **empezar de cero** (`agr-vacio`).
  - Si hay acomodo: la tarjeta normal. Subtítulo «acomodada a mano, desde «Equilibrada»» o «…, desde cero». Nota ámbar `N trabe(s) sin asignar: en RAM no se tocan`. Botón **✕ descartar** (`agr-descartar`).
- Notas grises: «N miembro(s) de esos grupos no son horizontales: no se agrupan y se quedan como están.» (o «no son verticales»).

### Paso 3 · Verla en planta / Acomodar a mano

El título cambia según la tarjeta elegida.

**Escala de aprovechamiento** (`agr-escala`; botón **ocultar/mostrar** `agr-escala-ver`)
- Filas por grupo (`agr-esc-fila-{T1}`) con su nombre, `sección auto · n` y, a la derecha, `a %–b %`. En el manual hay además las filas **sin asignar** (`agr-esc-fila-sueltos`) y **＋ grupo nuevo** (`agr-esc-fila-nuevo`, «suelta aquí»).
- Un punto por trabe (`agr-esc-punto-{id}`, con `data-sel="1"` si está seleccionado). Es rojo si pasa de 100 %; la zona rosa es más de 100 %.
- Con una selección, en cada otra fila aparecen círculos huecos (`agr-esc-fantasma-{T}`) y un texto que dice qué pasaría: `cabe · x %`, `T2 subiría a 20×45`, `no cabe en 20×40`, `ninguna sección alcanza` o `quedaría 20×35`.
- Arrastrando (sólo en el manual): `n trabe(s) → T3`.

**Barra de la planta** (`agr-planta`)
- **Todos los niveles** y un botón por nivel `N1`, `N2`… (`agr-ver-nivel-{n}`). En columnas: **Todos los entrepisos** y `E1`, `E2`… (E1 es el de abajo). Con «Misma sección en toda la altura» hay un solo dibujo, «Toda la altura», y no salen estos botones. Los botones de nivel sólo aparecen si hay más de uno.
- Casilla **nombres**.
- Ejes (`agr-ejes`): `X↓ Z← · como RAM`.
- **↻ girar** (`agr-girar`).
- Ayuda: «clic: una · Mayús/Ctrl+clic: suma o quita · arrastrar en un hueco: ventana · Esc: ninguna».

**Cada nivel** (`agr-nivel-{n}`)
- Cabecera `N1  Y = +3.00 m  n trabe(s)` y el botón **todo el nivel** / **quitar el nivel**.
- Cada trabe es un `<g data-testid="agr-trabe-{id}" data-grupo="T1" data-sel="0|1">`. El `id` de una trabe continua es `{primer miembro}…{último}`.
- Las sin asignar salen en gris punteado. Una línea punteada roja encima es una trabe que no cabe. Columnas en gris.
- Al pasar el mouse: `Trabe {id} · N1` / `L · Mu+ · Mu− · Vu` / `le basta 20×35 · hoy 15×20` / `en T2 (20×40) al 78 %` (o «sin asignar: en RAM no se toca») / `miembros: …`. En columnas se agrega la línea `rige … P · Mx · My`.

**Buscar miembro**
- Campo `agr-buscar` (placeholder «Buscar miembro de RAM: 97, 120-124»). Enter selecciona; Mayús+Enter suma a la selección. Botón **🔍 buscar** (`agr-buscar-ir`).
- Respuesta en `agr-buscar-msg`: `97 → trabe 95…99 · N2 · en T3`. Si no la encuentra, el motivo: «no existe en el modelo», «no tiene nudos en el modelo», «es una columna (de C1): está en Agrupación → Columnas», «no es horizontal: no se agrupa», «su grupo «X» no está marcado en «Qué agrupar»», «no llegó con resultados del análisis».

**Selección** (`agr-seleccion`)
- `N trabe(s) seleccionada(s)` (`agr-sel-n`) · «juntas piden al menos **20×40**» · `Mu máx · Vu máx`.
- **＋ las mismas en otros niveles** (`agr-mismas`; en columnas «＋ la misma en otros entrepisos») · **limpiar** (`agr-limpiar`).
- Tabla `nivel · trabe · L m · Mu+ · Mu− · Vu t · le basta · grupo · aprov.`, hasta 80 filas.
- En columnas, el diagrama de interacción (`agr-diagrama`): **P–Mx (M33, peralte h = …)** y **P–My (M22, ancho b = …)**.

**Panel de grupos** (`agr-panel-grupos`)
- En una propuesta automática dice «Así queda **Equilibrada**. Para mover trabes:» con el botón **✎ ajustar ésta a mano** (`agr-ajustar-aqui`).
- En el manual: **＋ grupo nuevo con la selección (n)** (`agr-nuevo`) · **sacar de su grupo** (`agr-soltar`) · **renumerar T1…** (`agr-renumerar`) · **↶ deshacer** (`agr-deshacer`, hasta 60 pasos).
- Una tarjeta por grupo (`agr-g-{nombre}`):
  - Cuadro de color (`agr-g-sel-{nombre}`): selecciona sus trabes; con Mayús, las suma.
  - Nombre editable (`agr-g-nombre-{nombre}`): se guarda al salir del campo o con Enter; Esc lo cancela.
  - Selector de sección (`agr-g-sec-{nombre}`): `auto · 20×40` o una viga del catálogo, agrupadas por `b = 10/15/20/25 cm`.
  - `n trabe(s) · L m` (o `vacío`).
  - **← aquí** (`agr-g-aqui-{nombre}`): mueve ahí la selección.
  - **✕** (`agr-g-borrar-{nombre}`): quita el grupo.
  - Una tira de aprovechamiento con `a %–b %` (y ` · no alcanza`) y el veredicto `agr-g-verif-{nombre}`: `…`, `✓ 123 kg` o `✗ {motivo}`.
- `agr-sueltos`: «**N trabe(s) sin asignar** — clic para seleccionarlas. Al aplicar, en RAM no se tocan.»

### Paso 4 · Aplicarla en RAM

- **⬇ aplicar_agrupacion.py — {Equilibrada|Manual|…}** (`agr-bajar`). Se desactiva si la propuesta no tiene grupos o si hay problemas de nombres.
- Baja `aplicar_agrupacion <fecha>.py` (o `aplicar_agrupacion columnas <fecha>.py`) a la carpeta `1 Agrupación` de la obra, o como descarga. Toast: `{archivo} {dónde}: en RAM, Abrir Script… → Ctrl+R`.
- Problemas de nombres (`agr-problemas`): «Hay un grupo sin nombre.», ««T2» está dos veces.», ««T5» ya existe en el modelo en un grupo que no se está agrupando.»
- Otro aviso posible: «El acomodo no tiene ningún grupo con trabes.»
- Nota de criterio. Trabes: «Dimensiona con el momento a ½ ρ balanceada y el cortante con estribos #2.5 a no menos de 8 cm … No revisa deflexiones». Columnas: «… No revisa esbeltez ni cortante de columnas.»

## 2.3 Flujo para el agente

1. Abre Agrupación y comprueba que `agr-fuente` diga un modelo y «con las medidas reales de RAM».
2. Elige **Trabes** o **Columnas** (`agr-pieza-*`).
3. Paso 1: revisa las casillas de grupos y los anchos y peraltes, o las secciones de columna.
4. Paso 2: espera a que cada tarjeta deje de decir «verificando…». Compara grupos, m³ y kg, y elige una tarjeta con un clic.
5. Paso 3: revisa la planta. Si hace falta ajustar, pulsa **✎ a mano** en la tarjeta y mueve trabes con la selección y **← aquí**, o arrastrando puntos en la escala. Fija secciones con `agr-g-sec-*` y termina con **renumerar T1…**.
6. Paso 4: confirma que `agr-problemas` no existe y pulsa `agr-bajar`.
7. En RAM: Abrir Script… → Ctrl+R → reanaliza → sincroniza. Vuelve a abrir Agrupación para la segunda vuelta.

Persistencia: el acomodo manual de cada pieza se guarda en el navegador y se restaura si coincide con trabes del modelo actual; **✕ descartar** lo borra. El giro de la planta, la pieza y los filtros también se recuerdan.

## 2.4 Qué no hace

- No escribe en RAM; sólo genera el script.
- No revisa deflexiones, esbeltez ni cortante de columnas.
- No agrupa miembros inclinados: en trabes, sólo los horizontales; en columnas, sólo los verticales.
- No propone secciones fuera del catálogo de la casa, ni anchos o peraltes que no marcaste.
- No es la última palabra: hay que aplicar, reanalizar y volver a agrupar.

---

# 3. Deflexiones

## 3.1 Para qué sirve

Revisa las flechas de **todos los tramos de trabe** del modelo con los desplazamientos que calculó RAM. Usa las cargas de servicio (de fábrica CS = 1·CM + 1·CV) y corrige la flecha elástica de RAM con la inercia agrietada del armado de cada sección del proyecto. Para el armado toma corridas, bastón corrido y **puntuales anotados en Longitudinal**: lo de abajo en el centro y lo de arriba en los apoyos. Agrega la diferida (λ = 2/(1 + 50ρ′) en clase 1) y compara contra L/240 + 0.5 cm y, opcionalmente, L/480 + 0.3 cm (después de muros). En voladizos los límites son el doble. Fórmulas en el cap. 10 del manual.

## 3.2 Anatomía

- Encabezado **Deflexiones** con la nota «Flechas de RAM por caso, con la inercia agrietada del armado de cada sección y las diferidas (NTC). Límites L/240 + 0.5 cm y L/480 + 0.3 cm.»
- Fuente (`def-fuente`): `Modelo: {archivo} · hace X min · flechas de N miembros de trabe`. Botón **Cargar modelo.json…** (input `def-archivo`). Como Agrupación, toma solo el último sincronizado.
- `def-sin-datos` (ámbar): «**Este modelo.json no trae desplazamientos.** Lo escribió un sincronizar.py anterior: genéralo otra vez en **Reportes de RAM → ⚙ Configurar RAM → ⬇ Generar sincronizar.py**, córrelo en RAM y vuelve a sincronizar.»
- `def-unidad`: «⚠ El script no pudo comprobar la unidad de los desplazamientos con los giros de RAM y los tomó en metros. Revisa que las flechas tengan sentido.»

### Tarjeta «Cargas de servicio»

- Fórmula en `def-cs`, por ejemplo **CS = 1·CM + 1·CV**. A la derecha: «para la inmediata y, completa, como carga sostenida para la diferida» (o «con la viva media,» / «con el x % de la viva,»).
- Un rótulo por caso de RAM (`def-caso-{id}`) con id, descripción y selector de papel: **muerta** / **viva** / **viva media** / **no usar**. De fábrica, DEAD/CM/PP → muerta; LIVE/CV → viva; viva media, accidental, sismo y los demás → no usar.
- **viva sostenida en la diferida** `[100] %` (`def-fsost`, paso 5). Se desactiva y dice «(se usa el caso de viva media)» si algún caso tiene el papel viva media.
- Casilla **revisar también L/480 + 0.3 cm (muros de mampostería u otros elementos que se dañan)** (`def-post`, marcada de fábrica).
- **valores de fábrica**: regresa a 100 %, L/480 activo y los papeles automáticos.
- La configuración se recuerda en el navegador.

### Resumen y filtros

- `def-resumen`: `N tramos` · `✗ n no pasan` o `✓ pasan los n que tienen armado` · `n sin armado: crea sus secciones para revisarlos`.
- Chips por sección (`def-grupo-{grupo de RAM}`), del peor al mejor. Cada uno dice `✓ T1` / `✗ T1` / `? T1` y `n · peor x %`. Muestra el nombre de la sección del proyecto si coincide (T1 ≈ T-1). Un clic filtra por esa sección; otro clic quita el filtro.
- **sólo los que no pasan** (`def-solo-mal`); este filtro también deja los «sin armado».
- Buscador `def-buscar` (placeholder «miembro de RAM: 97, 120-124»). Filtra al teclear: muestra los tramos que contienen esos miembros. Acepta comas y rangos.
- Contador: `n tramo(s) de T1 · clic en uno para ver el cálculo`.

### Tabla (`def-tabla`)

Columnas: **sección** · **tramo** · **nivel** · **L m** · **elástica cm** · **Ig/Ie** · **inmediata cm** · **diferida cm** · **total / lím. cm** · **después de muros / lím.** (sólo con L/480 activo) · **estado**.

- **tramo**:
  - El id de la trabe continua, `97…100`. Si se parte entre apoyos (nudo con columna o apoyo), se le agrega ` · k/n`.
  - Un voladizo lleva ` · voladizo`.
  - Los apoyos de un tramo son los nudos con columna o con apoyo, y los extremos que llegan a otro elemento. Un extremo libre es un voladizo.
- **nivel**: la coordenada vertical (m) del primer nudo del tramo.
- **total / lím.** y **después de muros / lím.** traen el porcentaje entre paréntesis. Rojo si pasa de 100 %, ámbar si pasa de 90 %.
- **estado**: `✓`, `✗` o `? sin armado` (ámbar). Pasa si total ≤ límite y, con L/480 activo, también después de muros ≤ su límite.
- Orden: del más comprometido al menos, por el mayor de los dos porcentajes. Se muestran hasta 400 filas; si hay más, «… y N más: filtra por sección o busca un miembro.».
- Cada fila es `def-fila-{tramo}`, con `data-estado="ok|no|sin-armado"`.

### Detalle de un tramo (clic en la fila → `def-detalle`; otro clic lo cierra)

- Línea: `miembros 97, 98 · flecha respecto a la cuerda entre sus apoyos` (o `voladizo: flecha del extremo libre respecto al apoyo, límites al doble`).
- Tres columnas de valores:
  - `f'c · Ec` · `Ig · IRAM` · `Iag centro · apoyo` · `Mag (agrietamiento)`
  - `Ma total: centro · extremos` · `Ie muerta · sostenida · total` · `ρ′ · λ = 2/(1+50ρ′)`
  - `elástica RAM (total)` · `inmediata: muerta · total` · `diferida = λ · sostenida` · `total · después de muros`
- Si no hay armado: «El proyecto no tiene la sección **T3**: sin su armado no se puede calcular la inercia agrietada, así que se muestra la flecha elástica de RAM (x cm), que se queda corta. Créala desde **Reportes de RAM** para revisarla.»

Nota al pie: Inmediata = elástica de RAM × IRAM/Ie (Branson; en continuos (Ie1 + Ie2 + 2·Ie3)/4); supone que RAM usó el Ec de la NTC para el f′c de la sección.

## 3.3 Flujo para el agente

1. Sincroniza con un sincronizar.py actual y crea las secciones (cap. 8). Opcional: anota en Longitudinal los puntuales, que sí cuentan en la inercia agrietada.
2. Abre Deflexiones. Revisa `def-cs`; si los casos de tu modelo se llaman distinto, asígnales su papel en `def-caso-*`.
3. Lee `def-resumen`. Marca `def-solo-mal` y abre las filas `✗` para ver qué manda: una diferida grande pide más acero de compresión (ρ′); una Ig/Ie alta pide más peralte o armado.
4. Para cambiar el armado ve a Secciones; Deflexiones se recalcula sola con el proyecto.

## 3.4 Qué no hace

- No calcula la elástica: usa los desplazamientos de RAM. Si RAM no usó el Ec de la NTC, el resultado se desvía.
- No usa el sismo ni combinaciones que no estén en los papeles muerta/viva.
- No revisa trabes sin sección en el proyecto: les muestra la elástica de RAM, que se queda corta.
- No cambia RAM ni las secciones.
- Ni Agrupación ni las propuestas de armado consideran deflexiones. Este módulo es la revisión posterior.

## 3.5 Tabla de `data-testid` (Agrupación y Deflexiones)

| testid | Elemento |
|---|---|
| `agr-fuente`, `agr-archivo` | fuente del modelo / input modelo.json |
| `agr-pieza`, `agr-pieza-trabe`, `agr-pieza-columna` | interruptor Trabes / Columnas |
| `agr-grupo-{nombre}` | casilla de un grupo de RAM (paso 1) |
| `agr-ancho-{b}`, `agr-peralte-{h}`, `agr-tope` | filtros de trabes |
| `agr-colsec-{b}x{h}`, `agr-completa`, `agr-sin-m22` | filtros y aviso de columnas |
| `agr-sin-elementos` | «Esos grupos no tienen …» |
| `agr-propuesta-{pocos\|equilibrada\|ajustada\|manual}` | tarjetas (clic = elegir) |
| `agr-ngrupos-{id}`, `agr-estado-{id}`, `agr-ajustar-{id}` | número de grupos, estado, ✎ a mano |
| `agr-desde-elegida`, `agr-vacio`, `agr-descartar` | iniciar o descartar el acomodo manual |
| `agr-escala`, `agr-escala-ver`, `agr-esc-fila-{T\|sueltos\|nuevo}`, `agr-esc-punto-{id}`, `agr-esc-fantasma-{T}` | escala de aprovechamiento |
| `agr-planta`, `agr-ver-nivel-{n}`, `agr-nivel-{n}`, `agr-trabe-{id}`, `agr-ejes`, `agr-girar` | planta |
| `agr-buscar`, `agr-buscar-ir`, `agr-buscar-msg` | buscar miembro |
| `agr-seleccion`, `agr-sel-n`, `agr-mismas`, `agr-limpiar`, `agr-diagrama` | selección |
| `agr-panel-grupos`, `agr-ajustar-aqui`, `agr-nuevo`, `agr-soltar`, `agr-renumerar`, `agr-deshacer`, `agr-sueltos` | panel de grupos |
| `agr-g-{T}`, `agr-g-sel-{T}`, `agr-g-nombre-{T}`, `agr-g-sec-{T}`, `agr-g-aqui-{T}`, `agr-g-borrar-{T}`, `agr-g-verif-{T}` | tarjeta de un grupo |
| `agr-bajar`, `agr-problemas` | paso 4 |
| `def-fuente`, `def-archivo`, `def-sin-datos`, `def-unidad` | fuente y avisos |
| `def-cs`, `def-caso-{id}`, `def-fsost`, `def-post` | cargas de servicio |
| `def-resumen`, `def-grupo-{g}`, `def-solo-mal`, `def-buscar` | resumen y filtros |
| `def-tabla`, `def-fila-{tramo}` (`data-estado`), `def-detalle` | tabla y detalle |

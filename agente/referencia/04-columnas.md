# Pestaña «Columnas»

## 1. Para qué sirve

La pestaña fija **Columnas** (en la barra de pestañas, entre «Calculo» y los módulos; si ya hay columnas muestra una píldora con cuántas son) revisa columnas rectangulares de concreto reforzado por **flexocompresión biaxial**. Por cada columna capturas la sección (b, h, r, f'c, fy, εc), el acero longitudinal por lechos y los estribos por zonas. La app construye los diagramas de interacción P–M de las dos direcciones, que replican celda por celda la hoja «Columnas» de `DISEN_O_DE_CONCRETO_v2.xlsx`, y la superficie 3D P–Mx–My. Después revisa contra ellos el punto capturado a mano o la envolvente que llega de RAM Elements. Las columnas se guardan con el proyecto (proyecto.json), alimentan el detallado DXF/SVG (una retícula de 4 secciones por renglón) y entran en la memoria y en los informes de verificación.

## 2. Anatomía de la pantalla

### 2.1 Barra de chips (arriba)
- **Un chip por columna** (`data-testid="chip-col-{i}"`) con su nombre; si no tiene nombre muestra `C-{i+1}`. Con un clic la seleccionas. Arrástralo para reordenar, o usa **Alt + ← / →** con el chip enfocado. El orden es el mismo del tablero y del DXF.
- **×** en cada chip (`data-testid="col-chip-x-{i}"`, tooltip «Eliminar la columna»). Pide confirmación: «¿Seguro que quieres eliminar la columna «C-1»? Se pierden su armado y sus demandas (lo guardado en proyecto.json no se toca).»
- **+ Nueva**: crea `C-1`, `C-2`… con los valores por defecto y la deja seleccionada.
- **Insignias de veredicto** (a la derecha). Primero aparece la fuente de la demanda (`envolvente · N ejemplares`, `punto capturado` o `sin demanda`) y luego **Mx ✓/✗**, **My ✓/✗** y **Biaxial ✓/✗**. Si no hay ninguna demanda aparece la insignia gris **sin revisar**.

### 2.2 Panel lateral (formulario)
Si no hay columna seleccionada, el panel dice «Crea una columna con el botón “+ Nueva”».

**Identificación**
| Etiqueta | Valor por defecto | Notas |
|---|---|---|
| Nombre de columna | `C-n` | placeholder «ej: C-1». El nombre es la llave para asociar los reportes de RAM (C1, C-1 y c_1 se toman como el mismo). |

**Geometría (cm)**
| Etiqueta | Defecto | Rango del input | Qué hace |
|---|---|---|---|
| Base (b) | 30 | 10–200 | Dimensión en X. Es el «peralte» de la dirección Y. |
| Peralte (h) | 30 | 10–200 | Dimensión en Y. Es el peralte que trabaja Mx (dirección X). |
| Recubrimiento (r) | 3 | 1–10, paso 0.5 | Distancia de la cara al centro de la varilla extrema. Con él se reparten los lechos (dp = r … h−r) y las barras a lo ancho. |
| f'c (kg/cm²) | 250 | 100–700 | β1 = 0.85 si f'c ≤ 280; si no, 1.05 − f'c/1400. |
| fy (kg/cm²) | 4200 | 2000–6000 | εy = fy/E, con E = 2 000 000 kg/cm² fijo (no se edita). |
| εc (concreto) | 0.003 | 0.002–0.004 | Deformación última del concreto. |

**Acero longitudinal**
- **Número de lechos (2–8)**: el valor por defecto es 2 y se recorta automáticamente entre 2 y 8. Al subirlo se agregan lechos de 2 #4.
- Cada lecho se rotula `LECHO 1 · CARA SUP.`, `LECHO 2`… y el último `· CARA INF.`. Tiene dos campos: **Varillas (n)** (1–12, por defecto 2) y **Calibre (#)** (#3 a #12, por defecto #4). Debajo aparece `As = x.xx cm²`.
- Los lechos se reparten a la misma separación entre r y h−r. Dentro de cada lecho, las n barras se reparten a lo ancho con las extremas a r de cada cara (con n = 1 la barra queda centrada). Una sección de 8 varillas se arma así: lecho 1 = 3, lecho 2 = 2 (una en cada cara) y lecho 3 = 3.
- Las áreas salen de la tabla BD del Excel. Ojo: en #9 y #10 difieren un poco de la tabla de vigas (6.41 y 7.92 cm²).

**Elementos mecánicos (últimos)**: el punto que capturas a mano.
| Etiqueta | Unidad | Defecto |
|---|---|---|
| Pu — carga axial (ton) | t, compresión positiva | 0 |
| Mux (ton·m) | t·m, trabaja el peralte h | 0 |
| Muy (ton·m) | t·m, trabaja la base b | 0 |

**Estribos**
| Etiqueta | Defecto | Qué hace |
|---|---|---|
| Calibre del estribo (#) | #2.5 | Opciones #2, #2.5, #3 y #4. |
| Sep. extremos (cm) (`data-testid="col-sep-ext"`) | vacío | El placeholder muestra la separación única de la hoja. |
| Sep. centro (cm) (`data-testid="col-sep-cen"`) | vacío | Igual que el anterior. |
| Long. extremo (cm) | vacío | El placeholder muestra la longitud NTC calculada. |
| Altura H (m) | vacío, placeholder «—» | Sólo sirve para la regla H/6 de la zona extrema. |

- Botón **«Según NTC: @sExt / @sCen · lExt cm»** (`data-testid="col-estribos-ntc"`): llena las tres casillas. Si el lado menor es menor de 20 cm se trata como castillo y el texto cambia a **«Según NTC-Mampostería (castillo): …»**. El tooltip muestra las reglas que se evaluaron.
  - **Columna (t = lado menor ≥ 20 cm)**, marcos no dúctiles: s centro = piso de min(850/√fy · db de la longitudinal más delgada, 48 · db del estribo, t/2). s extremos = piso de la mitad de ese mínimo. Longitud extrema = máx(lado mayor, H/6, 60 cm), redondeada a múltiplos de 5 hacia arriba. Ejemplos: 36×36 con 8#5 → @9/@18 · 60 cm; con H = 4.2 m la zona sube a 70 cm.
  - **Castillo (t < 20 cm)**: s centro = min(1.5·t, 20 cm) y en los extremos la mitad (esto último es criterio, no requisito de la norma). Ejemplo: 15×15 → @10/@20.
- Debajo aparece el texto del armado vigente, por ejemplo `E#2.5 @ 9 cm en extremos (60 cm) · @ 18 cm al centro`. Si no hay zonas aparece «Sin zonas: separación única de la hoja, @s cm.». Las zonas cuentan sólo cuando **las dos** separaciones son mayores que 0. Si falta una, se usa la fórmula legada de la hoja para que los proyectos viejos no cambien.

### 2.3 Área principal
- Si no hay selección aparece «Pulsa “+ Nueva” para crear una columna». Si faltan datos aparece «Datos incompletos — revisa geometría y lechos.», que sale cuando b, h, r o f'c valen 0 o están vacíos, o cuando algún lecho tiene n = 0.
- Sub-pestañas: **Diagramas P–M**, **Superficie 3D** y **Cálculo (Excel)**. A la derecha, una línea de resumen: `C-1 — 30×30 cm — Ast = x.xx cm² — Realizar revisión por flexocompresión`. Si e = Mux/Pu < 0.1·(lado menor) aparece «Realizar revisión por compresión».
- **Barra de envolvente** (sección 3.2).

## 3. Cómo se capturan las demandas

La regla está en `columnDemand.js`: **si hay envolvente cargada, ella manda**. Todos sus ejemplares deciden el veredicto y el punto manual queda sólo como referencia. En ese caso la barra lo avisa: «Con la envolvente cargada el veredicto lo dan sus N ejemplares; el punto capturado a mano (Pu = …, Mux = …, Muy = … t·m) queda sólo como referencia.». Si no hay envolvente, decide el punto manual, siempre que alguno de sus tres valores sea distinto de 0.

### 3.1 A mano
Llena Pu, Mux y Muy en «Elementos mecánicos (últimos)». La compresión va positiva. Los momentos se comparan como magnitudes, así que captura valores positivos.

### 3.2 Envolvente de texto en la propia pestaña
- Botón **📄 Cargar envolvente (RAM .txt)** (acepta .txt y .csv). El archivo es el reporte de RAM **«Máximos esfuerzos en miembros»**: por miembro trae filas `Max`/`Min` con Axial · V2 · V3 · Torsión · M22 · M33. Se toma P = −Axial, porque en RAM la compresión es negativa.
- Se grafican **todos los miembros del archivo** sobre esta sección; no se filtran por nombre. Sin envolvente, la barra muestra «Opcional — grafica todos los miembros del reporte sobre el diagrama de esta sección».
- Ya cargada, la barra muestra `archivo · N puntos · combo`, el botón de mapeo, el enlace **quitar** y la insignia `pasan/total dentro · crítico M-<miembro> (util 0.000)`.
- Limitación: las filas Max/Min del reporte impreso **no son simultáneas** (el máximo de M22 y el de M33 pueden venir de combinaciones distintas). Usa el modelo.json siempre que puedas.

### 3.3 Desde el Centro de carga (botón de la barra superior «📥 Reportes de RAM»)
Abre el diálogo «Cargar el modelo de RAM», con dos pestañas:
- **⚡ Desde RAM** (`tab-ram`): corres `sincronizar.py` en la consola de Python de RAM y luego **🔄 Sincronizar con RAM** (`sincronizar`). El **modelo.json** trae, por cada miembro de columna y por cada combinación, **P, M22 y M33 simultáneos** en el pie y en la cabeza (y en el centro si hay estación intermedia). Cada punto se rotula en la columna «Env.» como `<combo> pie`, `<combo> cabeza` o `<combo> centro`. Los grupos de RAM caen por nombre en su chip (C1 → C-1). Un modelo.json de antes, sin `flexo`, sólo trae Max/Min sin M22.
- **📄 Método manual** (`tab-manual`): son los reportes de texto. El que sirve para columnas es la ranura **«Máximos por miembro»** (`slot-maximos`). El archivo se nombra como el chip (`C-1.txt` → columna C-1). Conviene guardarlos en las subcarpetas `COLUMNAS · LONGITUDINAL · MAXIMOS`. Botones: **🗂 Elegir una carpeta…** (`cargar-carpeta`) y **📂 Archivos sueltos…** (`cargar-todo`).
- Avisos del diálogo que afectan a columnas:
  - «Las demandas que acaban de entrar son de otra sección.»: el chip tiene otras b×h que la sección que RAM analizó. Las opciones son **usar las medidas de RAM** (`usar-medidas-ram`) o **dejarlo como está**.
  - Grupos que el proyecto no tiene: **crear la sección con su armado** / **crear las N secciones con su armado** (`crear-faltantes`). Para cada columna se crea el chip, se le asigna la envolvente y se propone un armado: el de menos barras con ρ entre 1 % y 4 % que deja todos los puntos dentro (#4–#8; #3 sólo en castillos). También se proponen estribos por zonas, con H = el tramo más largo del grupo. El armado queda marcado como *propuesta* hasta que lo toques.

### 3.4 Mapeo de ejes
- Valor por defecto **`M33X`**, con el botón rotulado **«M33→Mx · M22→My ⇄»**: Mux = |M33| y Muy = |M22|.
- Con un clic cambia a **`M22X`**, con el botón rotulado **«M22→Mx · M33→My ⇄»**: Mux = |M22| y Muy = |M33|. El tooltip dice «Intercambia qué momento del reporte actúa en cada dirección».
- Recuerda que **Mx trabaja el peralte h** y **My trabaja la base b**. Si los ejes locales de la columna en RAM están girados respecto a cómo capturaste b y h, invierte el mapeo. El modelo.json siempre entra con `M33X`.

## 4. Cómo leer los resultados

### 4.1 Diagramas P–M (2D)
- Se ven dos diagramas junto al dibujo de la sección (concreto, estribo, barras, cotas `h =` / `b =`, rótulos L1…Ln y flechas «Mx →» «My ↑»):
  - **«Dirección X — P–Mx (peralte h=…)»**, en azul.
  - **«Dirección Y — P–My (peralte b=…)»**, en naranja. Es la sección girada 90°, con las barras agrupadas por su coordenada x.
- Ejes: **M (ton·m)** en horizontal y **P (ton)** en vertical. La compresión va arriba y la tensión abajo de la línea P = 0.
- La línea gruesa es la frontera (barrido fino del eje neutro, de c = h/20 a c = h/β1, cerrado en POC). El área sombreada es la región segura.
- Los círculos blancos son los **puntos canónicos del Excel**: POC, Punto 1, D (balanceada), Punto 2, Punto 3 y M0. Al pasar el cursor por uno ves `label · c=…` y `P=… t · M=…`.
- **Punto manual**: una cruz con círculo rotulada «(Mu, Pu)», verde si cae dentro y roja si no. La insignia dice **«✓ DENTRO · MR=…»** o **«✗ FUERA · MR=…»**, donde MR es el momento resistente interpolado al nivel de Pu en esa dirección. Esta revisión es uniaxial; la biaxial está en la insignia del encabezado.
- **Con envolvente**: el punto manual se oculta y aparece una nube de puntos verdes (cumplen) y rojos (no cumplen), con la insignia `n/N dentro`. Ojo: el color es el **veredicto global** del ejemplar (Mx, My **y** biaxial). Un punto puede verse rojo en el diagrama X aunque quede dentro de la curva X, porque falla en Y o en el contorno biaxial. Al pasar el cursor ves `Miembro … (tipo)`, P, M y `util`.
- Botón **⤢ demanda / ⤡ todo**: alterna entre ver el diagrama completo y acercarte a la zona de la demanda, sin perder de vista la frontera en ese rango de P.
- Si el Pu de un punto se sale del rango de la curva (más compresión que POC, o más tensión que la del último punto, c = h/20), el punto queda **fuera**, con MR = 0 y util ∞.

### 4.2 Tabla «Revisión de la envolvente — N puntos»
Aparece debajo de los diagramas cuando hay envolvente. Sus columnas son: **Miembro · Env. · Pu (t) · Mux (t·m) · Muy (t·m) · MRx · MRy · Util. · Estado** («✓ pasa» o «✗ no pasa»). Está ordenada de mayor a menor utilización. La fila resaltada en amarillo es el caso crítico. Util. se pinta en verde si es ≤ 0.9, en ámbar si está entre 0.9 y 1 y en rojo si es > 1.
- **Utilización = √[(Mux/MRx)² + (Muy/MRy)²]**, con MRx y MRy al nivel de Pu de cada punto (contorno biaxial elíptico, α = 2). Un ejemplar **pasa** si util ≤ 1 **y** además Mux ≤ MRx y Muy ≤ MRy.

### 4.3 Superficie 3D
- Muestra el «geoide» P–Mx–My: en cada nivel de P traza la elipse (Mx/MRx)² + (My/MRy)² = 1. Los meridianos azul (Mx) y naranja (My) son exactamente las curvas 2D.
- Controles: **Iso**, **Mx–P**, **My–P**, **Planta**, **+**, **−**, **⤢ demanda** (acerca y centra la vista en la demanda), **⌂** (restablece zoom y paneo) y **Malla** (muestra u oculta los anillos). Arrastras para rotar y usas la rueda para el zoom, como recuerda la leyenda «arrastra = rotar · rueda = zoom».
- La elipse ámbar punteada rotulada `P = … t` es el contorno al nivel de carga del punto activo. Con ella ves si el punto queda dentro a **su** nivel de P.
- La franja de estado dice **«✓ DENTRO de la superficie»** o **«✗ FUERA de la superficie»** y añade `Pu · Mux · Muy`. Con el punto manual añade `(Mux/MRx)²+(Muy/MRy)²=…`; con un ejemplar de la nube añade `util=…`. Con envolvente, pasa el cursor por un punto para seleccionarlo; mientras no hay ninguno seleccionado se lee «Pasa el cursor por un punto de la nube para resaltarlo y ver la elipse de su nivel de carga.».

### 4.4 Estado ✓/✗ (resumen)
- **Mx ✓**: todos los ejemplares (o el punto manual) tienen Mux ≤ MRx.
- **My ✓**: lo mismo con Muy ≤ MRy.
- **Biaxial ✓**: todos cumplen (Mux/MRx)² + (Muy/MRy)² ≤ 1.
- El mismo veredicto (`columnDemand`) alimenta el informe resumido, el detallado y la memoria. Con envolvente, esos documentos reportan el «ejemplar crítico».

## 5. Vista «Cálculo (Excel)»

Es la réplica de la hoja de cálculo, para auditar o comparar con el Excel. Tiene los botones **Dirección X** y **Dirección Y**; la Y aparece como «Dirección Y (h=b cm, sección girada)».
- **Encabezado de datos**: h, b, r, d = h − r, f'c, β1, fy, E, εc, εy, Ast, e = Mu/Pu (m) y el modo de revisión.
- **«… — puntos del diagrama»**: un bloque por punto canónico (POC «— compresión pura», Punto 1, D (balanceada), Punto 2, Punto 3 y M0) con su c, P y M. Cada bloque lleva la tabla **Lecho · ε · f (kg/cm²) · F (ton) · Z (cm) · M (ton·m)** y la fila **CC (concreto)**. F es positiva en compresión y Z se mide desde el centroide.
- **«Diseño de acero transversal»**: s1 (por estribos) y s2 (por acero longitudinal, lecho 1) se calculan con la fórmula literal de la hoja (área BD × 16 y área BD × 48). s3 es por dimensiones = min(h, b). Al final aparece «s propuesta = E#… @ s cm». Si la columna tiene estribos por zonas, ese renglón sale tachado y abajo aparece «Por zonas = …», que es lo que manda.

## 6. Flujos típicos

**A. Revisión rápida a mano**
1. Ve a **Columnas** y pulsa **+ Nueva**.
2. Captura el nombre, b, h, r, f'c y fy.
3. Pon el Número de lechos y, en cada lecho, n y el calibre. Verifica Ast en la línea de resumen.
4. Captura Pu, Mux y Muy.
5. Lee las insignias Mx / My / Biaxial. En **Diagramas P–M** revisa «✓ DENTRO» de cada dirección y en **Superficie 3D** la suma biaxial.
6. En Estribos elige el calibre, captura **Altura H (m)** y pulsa **Según NTC: …**.

**B. Con RAM (recomendado)**
1. **📥 Reportes de RAM** → **⚡ Desde RAM** → **🔄 Sincronizar con RAM**.
2. Si aparece «Las demandas que acaban de entrar son de otra sección», decide entre usar las medidas de RAM o corregir en RAM.
3. Si el modelo trae grupos C sin chip, usa **crear … con su armado**.
4. En **Columnas** selecciona el chip. Verás `envolvente · N ejemplares` y la nube. Revisa el mapeo **M33→Mx · M22→My** contra la orientación de b y h.
5. En la tabla, revisa el caso crítico. Si hay «✗ no pasa», sube calibres o lechos, o crece la sección. El veredicto se recalcula al instante.
6. Ajusta los estribos con **Según NTC** y corrige a mano si quieres.

**C. Envolvente .txt de una sola columna**
1. Selecciona el chip y pulsa **📄 Cargar envolvente (RAM .txt)**.
2. Elige el reporte «Máximos esfuerzos en miembros» (sólo con los miembros de esa columna, porque se grafican todos).
3. Ajusta el mapeo. Para regresar al punto manual, pulsa **quitar**.

## 7. Botones y data-testid relevantes

| Texto en la UI | data-testid / ubicación |
|---|---|
| Chip de columna | `chip-col-{i}` |
| × del chip | `col-chip-x-{i}` |
| + Nueva | barra de chips (sin testid) |
| Sep. extremos (cm) / Sep. centro (cm) | `col-sep-ext` / `col-sep-cen` |
| Según NTC… / Según NTC-Mampostería (castillo)… | `col-estribos-ntc` |
| Diagramas P–M · Superficie 3D · Cálculo (Excel) | sub-pestañas (sin testid) |
| 📄 Cargar envolvente (RAM .txt) · M33→Mx · M22→My ⇄ · quitar | barra de envolvente |
| ⤢ demanda / ⤡ todo | cada diagrama 2D |
| Iso · Mx–P · My–P · Planta · + · − · ⤢ demanda · ⌂ · Malla | vista 3D |
| Dirección X / Dirección Y | vista Excel |
| 📥 Reportes de RAM | barra superior (abre el Centro de carga) |
| ⚡ Desde RAM / 📄 Método manual | `tab-ram` / `tab-manual` |
| 🔄 Sincronizar con RAM | `sincronizar` |
| Cargar… (Máximos por miembro) | `slot-maximos` |
| 🗂 Elegir una carpeta… / 📂 Archivos sueltos… | `cargar-carpeta` / `cargar-todo` |
| usar las medidas de RAM | `usar-medidas-ram` |
| crear … con su armado | `crear-faltantes` |

Para pruebas e integraciones, el store queda expuesto en `window.__COL_STORE__` (zustand).

## 8. Avisos comunes y límites

**Avisos**
- «Datos incompletos — revisa geometría y lechos.»: b, h, r o f'c valen 0 o están vacíos, o algún lecho tiene «Varillas (n)» en 0.
- «No se encontraron filas Max/Min con 6 valores. Verifica que sea un reporte de "Máximos esfuerzos en miembros".» (en rojo junto al botón): el .txt no es el reporte correcto.
- Otros avisos del parser: «Fila "…" ignorada: se esperaban 6 valores y hay n.», «Unidades no reconocidas como Ton…» y «No se encontró el encabezado de columnas; se asumió el orden Axial · V2 · V3 · Torsión · M22 · M33.». Las unidades deben ser **Ton y m**.
- «sin revisar»: no hay Pu, Mux ni Muy distintos de 0 y tampoco hay envolvente.
- «Realizar revisión por compresión» / «…por flexocompresión»: es sólo informativo (e = Mux/Pu contra 0.1·lado menor). No cambia el cálculo.
- Util «∞» / «✗ FUERA · MR=0.00»: el Pu del punto está fuera del rango de la curva (más que POC, o una tensión mayor que la del extremo inferior de la curva).

**Qué NO revisa (verificado en el código)**
- **Esbeltez**: no hay amplificación de momentos ni efectos P-Δ. «Altura H (m)» sólo se usa para la regla H/6 de la zona de estribos.
- **Cortante y torsión**: V2, V3 y Torsión se leen del reporte, pero ninguna revisión los usa. Tampoco se revisa confinamiento para marcos dúctiles; las reglas de estribos son las de marcos no dúctiles o las de castillo.
- **Factores de resistencia FR**: el diagrama es **nominal** (POC = 0.85·f'c·(Ag − Ast) + Ast·fy; bloque 0.85·f'c·β1·c·b). No se aplica FR ni tope de carga axial máxima, ni excentricidad mínima.
- **Cuantía y separación entre barras**: la pestaña no comprueba ρmín/ρmáx ni si las varillas caben. Sólo la propuesta automática del Centro de carga limita ρ entre 1 % y 4 %.
- **Biaxial**: se usa un contorno elíptico de referencia (α = 2) con MRx y MRy uniaxiales, no la superficie exacta por integración en ángulo.
- **Secciones**: sólo rectangulares y con acero en retícula de lechos (no hay circulares ni barras en posición libre).

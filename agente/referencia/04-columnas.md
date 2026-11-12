# Pestaña «Columnas»

## 1. Para qué sirve

La pestaña fija **Columnas** (en la barra de pestañas, entre «Calculo» y los módulos; si ya hay columnas muestra una píldora con cuántas son) revisa columnas rectangulares de concreto reforzado por **flexocompresión biaxial**. Por cada columna capturas la sección (b, h, r, f'c, fy, εc), el acero longitudinal por lechos y los estribos por zonas. La app construye los diagramas de interacción P–M de las dos direcciones, que replican celda por celda la hoja «Columnas» de `DISEN_O_DE_CONCRETO_v2.xlsx`, y la superficie 3D P–Mx–My. Después revisa contra ellos el punto capturado a mano o la envolvente que llega de RAM Elements. Las columnas se guardan con el proyecto (proyecto.json), alimentan el detallado DXF/SVG (una retícula de 4 secciones por renglón) y entran en la memoria y en los informes de verificación.

**Desde la 3.07 (pedido del Ing. Fernando Burgos, 2026-11-11) la revisión es la de la NTC-Concreto 2023:** cada diagrama tiene su versión **nominal** (la de la hoja, punteada) y la de **diseño** (FR·Pn, FR·Mn, con el FR de la tabla 3.8.2.2 según εt, en línea continua), y la flexión biaxial se revisa con el **método general** (eje neutro inclinado, 5.4.1.1) y con el **método aproximado** de 5.4.1.2. **Desde la 3.08 el D/C de la columna es el del método general** (criterio del Ing. Fernando Burgos, 2026-11-11: «ok, vamos a manejar el método general en la aplicación»). El 5.4.1.2 se calcula y se muestra **solo como referencia**; no decide (§4.5). El contorno elíptico α = 2 de antes ya no se usa.

## 2. Anatomía de la pantalla

### 2.1 Barra de chips (arriba)
- **Un chip por columna** (`data-testid="chip-col-{i}"`) con su nombre; si no tiene nombre muestra `C-{i+1}`. Con un clic la seleccionas. Arrástralo para reordenar, o usa **Alt + ← / →** con el chip enfocado. El orden es el mismo del tablero y del DXF.
- **×** en cada chip (`data-testid="col-chip-x-{i}"`, tooltip «Eliminar la columna»). Pide confirmación: «¿Seguro que quieres eliminar la columna «C-1»? Se pierden su armado y sus demandas (lo guardado en proyecto.json no se toca).»
- **+ Nueva**: crea `C-1`, `C-2`… con los valores por defecto y la deja seleccionada.
- **Insignias de veredicto** (a la derecha). Primero aparece la fuente de la demanda (`envolvente · N ejemplares`, `punto capturado` o `sin demanda`) y luego **Mx ✓/✗**, **My ✓/✗** y **Biaxial NTC ✓/✗ · D/C x.xx (gral.)**, con el D/C del método general del caso que manda. Si no hay ninguna demanda aparece la insignia gris **sin revisar**.

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

**Factores de resistencia (NTC 3.8.2)**
| Casilla | Defecto | Qué hace |
|---|---|---|
| Refuerzo helicoidal (zunchos) que cumple 14.7.4 (`data-testid="col-zunchos"`) | apagada | FR de la columna «zunchos» de la tabla 3.8.2.2: 0.75 / 0.75 + 0.15(εt − εty)/0.003 / 0.90. Apagada = estribos («Otros»): 0.65 / 0.65 + 0.25(…)/0.003 / 0.90. |
| 3.8.2.6: usar en la transición el FR de compresión (`data-testid="col-fr-transicion"`) | apagada | En la transición toma 0.65 (o 0.75), que la norma acepta; es más conservador. |

Se guardan en la columna como `zunchos` y `frTransicionCompresion`.

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
- **Dos fronteras por diagrama:** la **nominal** (la de la hoja, punteada y tenue) y la de **diseño** (FR·Pn, FR·Mn, línea gruesa). La región segura sombreada y el veredicto son los de diseño. La curva de diseño se dibuja en el orden de c, porque en la transición puede no ser monótona en P.
- La insignia del diagrama dice **«✓ DENTRO · MR=… · FR x.xx · εt 0.00xx · compresión|transición|tensión»**: MR de diseño al nivel de Pu y el FR, el εt y la clase del punto resistente.
- Con la excentricidad mínima de 5.3.2 el punto de demanda se dibuja con el momento de diseño (Pu·e mín. si es mayor que el capturado).
- Se ven dos diagramas junto al dibujo de la sección (concreto, estribo, barras, cotas `h =` / `b =`, rótulos L1…Ln y flechas «Mx →» «My ↑»):
  - **«Dirección X — P–Mx (peralte h=…)»**, en azul.
  - **«Dirección Y — P–My (peralte b=…)»**, en naranja. Es la sección girada 90°, con las barras agrupadas por su coordenada x.
- Ejes: **M (ton·m)** en horizontal y **P (ton)** en vertical. La compresión va arriba y la tensión abajo de la línea P = 0.
- La línea gruesa es la frontera de diseño (barrido fino del eje neutro, de c = h/20 a c = h/β1, cerrado en FR·POC = 0.65·POC). El área sombreada es la región segura.
- Los círculos blancos son los **puntos canónicos del Excel** (nominales): POC, Punto 1, D (balanceada), Punto 2, Punto 3 y M0. Al pasar el cursor por uno ves `label · c=… · FR …` y `P=… t · M=…`.
- **Punto manual**: una cruz con círculo rotulada «(Mu, Pu)», verde si cae dentro y roja si no. La insignia dice **«✓ DENTRO · MR=…»** o **«✗ FUERA · MR=…»**, donde MR es el momento resistente de diseño interpolado al nivel de Pu en esa dirección. Esta revisión es uniaxial; la biaxial está en §4.5 y en la insignia del encabezado.
- **Con envolvente**: el punto manual se oculta y aparece una nube de puntos verdes (cumplen) y rojos (no cumplen), con la insignia `n/N dentro`. Ojo: el color es el **veredicto global** del ejemplar (Mx, My **y** biaxial NTC). Un punto puede verse rojo en el diagrama X aunque quede dentro de la curva X, porque falla en Y o en el contorno biaxial. Al pasar el cursor ves `Miembro … (tipo)`, P, M y `util`.
- Botón **⤢ demanda / ⤡ todo**: alterna entre ver el diagrama completo y acercarte a la zona de la demanda, sin perder de vista la frontera en ese rango de P.
- Si el Pu de un punto se sale del rango de la curva de diseño (más compresión que PR0 = FR·POC, o más tensión que la del último punto, c = h/20), el punto queda **fuera**, con MR = 0 y util ∞.

### 4.2 Tabla «Revisión de la envolvente — N puntos»
Aparece debajo de la revisión NTC cuando hay envolvente. Sus columnas son: **Miembro · Env. · Pu (t) · Mux (t·m) · Muy (t·m) · MRx · MRy · FR · D/C gral. (gobierna) · D/C 5.4.1.2 (ref.) · Ec. ref. · Util. · Estado** («✓ pasa» o «✗ no pasa»). Está ordenada de mayor a menor utilización. La fila resaltada en amarillo es el caso crítico. Util. se pinta en verde si es ≤ 0.9, en ámbar si está entre 0.9 y 1 y en rojo si es > 1.
- **Utilización = D/C de la NTC** = el del método general (§4.5); el 5.4.1.2 va como referencia, con MRx y MRy de diseño al nivel de Pu de cada punto. Un ejemplar **pasa** si util ≤ 1 **y** además Mux ≤ MRx y Muy ≤ MRy (con la excentricidad mínima).

### 4.3 Superficie 3D
- Muestra la superficie de **diseño** P–Mx–My: en cada nivel de P traza el contorno de momentos del eje neutro inclinado (el del método general), que en las esquinas se mete respecto a la elipse. Los meridianos azul (Mx) y naranja (My) son las curvas 2D de diseño.
- Controles: **Iso**, **Mx–P**, **My–P**, **Planta**, **+**, **−**, **⤢ demanda** (acerca y centra la vista en la demanda), **⌂** (restablece zoom y paneo) y **Malla** (muestra u oculta los anillos). Arrastras para rotar y usas la rueda para el zoom, como recuerda la leyenda «arrastra = rotar · rueda = zoom».
- El contorno ámbar punteado rotulado `P = … t` es el del nivel de carga del punto activo. Con él ves si el punto queda dentro a **su** nivel de P.
- La franja de estado dice **«✓ DENTRO de la superficie»** o **«✗ FUERA de la superficie»** y añade `Pu · Mux · Muy`. Con el punto manual añade `D/C NTC=… (método general | ec. 5.4.1.2.x)`; con un ejemplar de la nube añade `util=…`. Con envolvente, pasa el cursor por un punto para seleccionarlo; Mientras no hay ninguno seleccionado se lee «Pasa el cursor por un punto de la nube para resaltarlo y ver el contorno de su nivel de carga.».

### 4.4 Estado ✓/✗ (resumen)
- **Mx ✓**: todos los ejemplares (o el punto manual) tienen Mux ≤ MRx (de diseño, con la excentricidad mínima).
- **My ✓**: lo mismo con Muy ≤ MRy.
- **Biaxial NTC ✓**: todos tienen D/C ≤ 1 por el método general.
- El mismo veredicto (`columnDemand` → `checkBiaxial`) alimenta el informe resumido, el detallado, la memoria, el Double Check, la consola, la propuesta automática y la Agrupación. Con envolvente, esos documentos reportan el «ejemplar crítico».

### 4.5 Revisión NTC-Concreto 2023 (`data-testid="revision-ntc"`)
Debajo de los diagramas, para el caso que manda (el ejemplar crítico de la envolvente o el punto capturado):
- **Encabezado**: Pu, Mux y Muy con que se revisó; si entró la **excentricidad mínima de 5.3.2** (e ≥ 0.05h y ≥ 20 mm, en cada dirección), lo dice y muestra lo capturado. También PR0 = FR·P0 y si aplica zunchos, 3.8.2.3 (refuerzo asimétrico) o 3.8.2.6.
- **Tabla** (`ntc-fila-x`, `-y`, `-g`, `-a`, `-dc`):
  - Uniaxial X y Y: MR de diseño al nivel de Pu, con FR, εt y clase del punto resistente.
  - **a) Método general** (NTC 5.4.1.1, hipótesis de 3.6): el eje neutro se gira; para cada ángulo se barre c, se integra el bloque 0.85 f'c hasta β1c medido perpendicular al eje neutro (la zona comprimida es un triángulo, un trapecio o un pentágono) y las barras reales de la retícula con deformación plana y εc = 0.003; cada punto lleva el FR de su εt (el acero más alejado de la fibra extrema comprimida). Al nivel de Pu se arma el contorno Mx–My y se corta con el rayo del vector (Mux, Muy): **D/C = √(Mux² + Muy²)/MR(θ)**.
  - **b) Método aproximado 5.4.1.2**: con los diagramas de diseño, **Bresler** 1/PR = 1/PRx + 1/PRy − 1/PR0 (ec. 5.4.1.2.a, D/C = Pu/PR), o, si **PR/PR0 < 0.1**, **Mux/MRx + Muy/MRy** (ec. 5.4.1.2.b). PRx y PRy son la carga de diseño de cada diagrama con su excentricidad (e = Mu/Pu); PR0 = FR·P0.
  - **D/C de la columna** = el de a), el método general, que es la fila resaltada «GOBIERNA». La fila b) dice «referencia» y no decide. Criterio del Ing. Fernando Burgos (2026-11-11): «ok, vamos a manejar el método general en la aplicación». Hasta la 3.07 gobernaba el mayor de a) y b).
- **Contorno de diseño Mx–My a P = Pu** (`data-testid="contorno-mxmy"`): azul, el del método general (con el rayo de la demanda hasta MR(θ)); morado discontinuo, el de 5.4.1.2 (Bresler si Pu/PR0 ≥ 0.1, si no la recta lineal). El punto (Mux, Muy) sale verde o rojo.

## 5. Vista «Cálculo (Excel)»

Es la réplica de la hoja de cálculo, para auditar o comparar con el Excel. Tiene los botones **Dirección X** y **Dirección Y**; la Y aparece como «Dirección Y (h=b cm, sección girada)».
- **Encabezado de datos**: h, b, r, d = h − r, f'c, β1, fy, E, εc, εy, Ast, e = Mu/Pu (m) y el modo de revisión.
- **«… — puntos del diagrama»**: un bloque por punto canónico (POC «— compresión pura», Punto 1, D (balanceada), Punto 2, Punto 3 y M0) con su c, P y M nominales. Debajo del encabezado va la línea **NTC 3.8.2.2: εt = … · clase · FR = … → FR·P = … · FR·M = …** (`data-testid="excel-fr-<punto>"`). Cada bloque lleva la tabla **Lecho · ε · f (kg/cm²) · F (ton) · Z (cm) · M (ton·m)** y la fila **CC (concreto)**. F es positiva en compresión y Z se mide desde el centroide.
- **«Diseño de acero transversal»**: s1 (por estribos) y s2 (por acero longitudinal, lecho 1) se calculan con la fórmula literal de la hoja (área BD × 16 y área BD × 48). s3 es por dimensiones = min(h, b). Al final aparece «s propuesta = E#… @ s cm». Si la columna tiene estribos por zonas, ese renglón sale tachado y abajo aparece «Por zonas = …», que es lo que manda.

## 6. Flujos típicos

**A. Revisión rápida a mano**
1. Ve a **Columnas** y pulsa **+ Nueva**.
2. Captura el nombre, b, h, r, f'c y fy.
3. Pon el Número de lechos y, en cada lecho, n y el calibre. Verifica Ast en la línea de resumen.
4. Captura Pu, Mux y Muy.
5. Lee las insignias Mx / My / Biaxial NTC. En **Diagramas P–M** revisa «✓ DENTRO» de cada dirección y, abajo, la **Revisión NTC-Concreto 2023**: el D/C del método general (el que gobierna), el de 5.4.1.2 como referencia y el contorno Mx–My al nivel de Pu.
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
| Zunchos 14.7.4 / 3.8.2.6 (formulario) | `col-zunchos` / `col-fr-transicion` |
| Revisión NTC-Concreto 2023 (tabla y contorno) | `revision-ntc`, `ntc-fila-x/-y/-g/-a/-dc`, `contorno-mxmy` |
| Línea de FR de cada punto (vista Excel) | `excel-fr-POC`, `excel-fr-P1`, `excel-fr-D`… |
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

**Qué revisa (NTC-Concreto 2023, verificado en el texto de la Gaceta CDMX)**
- **FR, 3.8.1.1 y 3.8.2.2** (tabla 3.8.2.2): por punto del diagrama, según εt del acero extremo a tensión, con εty = fy/Es (3.8.2.4). Estribos: 0.65 / 0.65 + 0.25(εt − εty)/0.003 / 0.90; zunchos (14.7.4): 0.75 / 0.75 + 0.15(…)/0.003 / 0.90. Opción de 3.8.2.6 (FR de compresión en la transición).
- **3.8.2.3 refuerzo asimétrico**: si los lechos no son simétricos, FR no pasa de la recta entre el FR de compresión en PbR y 0.9 en 0.1 f'c Ag (P de diseño).
- **5.3.1 / 5.3.2**: flexocompresión con diagramas según 3.6 y FR de 3.8.2.2; excentricidad mínima de diseño máx(0.05h, 20 mm) en la dirección de cada flexión. Se aplica en las dos direcciones a la vez, también en la revisión biaxial (criterio a confirmar por los ingenieros).
- **5.4.1.1 y 5.4.1.2**: biaxial con las hipótesis de 3.6 (método general, eje neutro inclinado) y con el método aproximado (Bresler, o la suma lineal si PR/PR0 < 0.1). Gobierna el método general (criterio de FB, 3.08); 5.4.1.2 es referencia.
- **Tope de carga axial**: la NTC-Concreto 2023 no trae un tope general del tipo 0.8·FR·P0 para columnas (sólo 0.8·FR·Po para pilas y pilotes, 9.7.3.1.b). La app limita la carga de diseño a PR0 = FR·P0. Para marcos de ductilidad alta, 8.4.2.3 pide además Ag ≥ Pu/(0.5 f'c); la app no lo revisa (es un requisito geométrico del capítulo 8, no un tope de resistencia).

**Criterios que el Ing. Fernando Burgos debe confirmar (la revisión es una propuesta hasta que él verifique los valores)**
- ~~**MRx y MRy de la ec. 5.4.1.2.b**~~: desde la 3.08 ya no cambia el resultado, porque 5.4.1.2 solo es referencia. La app sigue tomando el MR de diseño al nivel de Pu.
- **Excentricidad mínima en biaxial**: se aplica en las dos direcciones a la vez (5.3.2.1 habla de flexión en una dirección).
- **Signo de los momentos**: se revisan en magnitud. Con refuerzo asimétrico (lecho superior distinto del inferior) el signo de Mux importa y la app sólo revisa el lado en que el lecho 1 queda comprimido.
- **β1**: ver «Qué NO revisa».

**Qué NO revisa (verificado en el código)**
- **Esbeltez**: no hay amplificación de momentos ni efectos P-Δ. «Altura H (m)» sólo se usa para la regla H/6 de la zona de estribos.
- **Cortante y torsión**: V2, V3 y Torsión se leen del reporte, pero ninguna revisión los usa. Tampoco se revisa confinamiento para marcos dúctiles; las reglas de estribos son las de marcos no dúctiles o las de castillo.
- **Cuantía y separación entre barras**: la pestaña no comprueba ρmín/ρmáx (6.4.3.1.1 pide 1 % a 6 % en ductilidad baja) ni si las varillas caben. Sólo la propuesta automática del Centro de carga limita ρ entre 1 % y 4 %.
- **Concreto desplazado**: como la hoja, el bloque de compresión no descuenta el área de las barras comprimidas (P0 sí la descuenta).
- **β1**: se conserva el de la hoja (0.85 hasta f'c = 280 kg/cm²; después 1.05 − f'c/1400, sin el mínimo de 0.65). La NTC 2023 (3.6.1 e, ec. 3.6.1) pone 0.85 hasta 300 kg/cm² y el mínimo de 0.65: entre 280 y 300 kg/cm² la app es ligeramente conservadora. Está anotado como pendiente.
- **Secciones**: sólo rectangulares y con acero en retícula de lechos (no hay circulares ni barras en posición libre).
- **Precisión del método general**: la superficie se arma con 144 ángulos del eje neutro y 81 profundidades por ángulo; entre vértices se interpola en línea recta (del lado seguro en contornos convexos). Contra una integración por fibras independiente la diferencia es menor de 0.5 % (pruebas `columnasNTC.test.js`).

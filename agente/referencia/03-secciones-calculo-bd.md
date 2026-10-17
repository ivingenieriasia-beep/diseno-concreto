# Auxiliar IV — Pestañas «Secciones» y «Calculo», y módulo «BD Global»

> Base de conocimiento para usar la app. Todas las etiquetas están verificadas contra el código (v3.06).
> **Ojo con las mayúsculas:** casi todas las etiquetas de campo (`.field-label`) y los títulos de bloque (`.section-title`) se ven en MAYÚSCULAS porque el CSS aplica `text-transform: uppercase`, pero en el DOM el texto está en mayúsculas y minúsculas. En pantalla ves «RECUBRIMIENTO (R)»; en el DOM dice `Recubrimiento (r)`. Si automatizas con selectores de texto, usa el texto del DOM (el que aparece abajo entre comillas) o una búsqueda que no distinga mayúsculas.
> Los signos menos de «Mr (−)», «Mu (−)», «Mu−» son el carácter Unicode `−` (U+2212), no el guion `-`.

---

## 1. Para qué sirve cada parte

**Secciones** (pestaña fija, id interno `detalle`): es el detallador de trabes. Aquí das de alta cada sección tipo (T-1, T-2…), capturas su geometría, f'c y armado (corridas, bastones corridos, estribos), y ves el dibujo del corte a escala junto con la «Escala de momentos», que compara los MR de todas las secciones del proyecto contra una demanda. El dibujo es el que se exporta a DXF/SVG. Los momentos resistentes (MR) y el Vr **no** se capturan aquí: los calcula la pestaña Calculo y se copian solos a esta pestaña.

**Calculo** (pestaña fija, id `calculo`; el texto de la pestaña dice «Calculo», sin acento): es la calculadora de flexión y cortante según NTC-2023 de la sección que tengas seleccionada. Muestra paso a paso d, Rn, ρ, As mín/máx/requerido, MRT, b mín, VCR, Va_max, separación de estribos y Vr, con verificaciones ✓/✗. También tiene la subpestaña «Memoria» (memoria imprimible de la sección) y el panel «Envolvente del modelo», donde cargas el reporte de RAM y revisas la sección contra todos los miembros que la usan.

**BD Global** (módulo, se abre desde «Módulos»): es una base de datos de trabes ya resueltas (7,613 de fábrica, precalculadas con NTC-2023 para r = 3 cm, f'c = 250 kg/cm², fy = 4200 kg/cm², b de 15 a 45 cm y h de 20 a 45 cm, Mu hasta 28 t·m en pasos de 0.25) más las que tú agregues. Sirve para buscar la sección y el armado más económicos que cubran un Mu+ / Mu− y aplicarlos a la sección seleccionada del proyecto. Incluye un heatmap («Malla de Trabes»).

---

## 2. Anatomía de la pantalla

### 2.1 Barra superior (TopBar) — lo que toca a las secciones

- **Chips de sección**: un chip por trabe con su nombre (si no tiene nombre muestra `S-<n>`). Clic = seleccionar (el chip activo se pinta de color acento). Cada chip tiene una «×» para borrar. Se pueden **arrastrar** para reordenar (o, con el chip enfocado, `Alt + ←` / `Alt + →`). El orden de los chips es el orden del dibujo.
- **«+ Nueva»**: crea una sección con los valores por defecto y nombre `T-<n>` consecutivo (al abrir un proyecto, sigue numerando tras el T-n más alto). La deja seleccionada.
- **«📥 Reportes de RAM»**: abre el *Centro de carga* (modelo de RAM y reportes de texto; ver flujo 4.3).
- Otros botones globales (no exclusivos de esta área): «Verificar» (menú: Resumido, Detallado, Memoria de cálculo, Exportar a Double Check), «Módulos», abrir/recientes/guardar proyecto, «SVG», selector de escala DXF (50:1 … 1:50 o «Personalizado» 1:N + «OK»), «Exportar DXF».

### 2.2 Pestaña «Secciones»: tres columnas

**(a) Formulario lateral (izquierda).** Si no hay sección seleccionada dice: «Selecciona una sección del toolbar o crea una nueva con el botón “+”».

Arriba aparece el **badge de BD** (ver §3.4). Después, los bloques en este orden:

| Bloque (título) | Campo (texto en DOM) | Tipo / unidades | Rango HTML | Defecto | Qué hace |
|---|---|---|---|---|---|
| **Identificación** | «Nombre de sección» | texto (placeholder «ej: V-1 izq») | — | `T-n` | Nombre del chip, del dibujo y con el que se emparejan los reportes de RAM (T-5.txt → T-5). Renombrar = editar aquí. |
| **Geometría (cm)** | «Ancho (b)» | número, cm | 10–200 | 15 | Base. |
| | «Peralte (h)» | número, cm | 15–300 | 20 | Altura total. |
| | «Recubrimiento (r)» | número, cm, paso 0.5 | 1–10 | 3 | **Distancia de la cara al centro de la varilla** (d = h − r). No es el recubrimiento libre: en el dibujo el estribo se coloca a r − radio de la varilla. |
| | «f'c (kg/cm²)» | número, paso 10 | 100–700 | 250 | Resistencia del concreto. |
| **Acero superior** (título en rojo) | «Calibre (#)» | select #2, #2.5, #3, #4, #5, #6, #8 | — | #3 | Varilla corrida del lecho superior (resiste M−). |
| | «Cantidad» | número | 1–20 | 2 | Número de corridas superiores. |
| | Sub-bloque «Bastón corrido sup. (0–N)» → «Calibre» y «Cantidad» | select / número | 0 a N | #3 / 0 | N = cantidad de corridas: máximo **un bastón por varilla** (el store recorta el valor si te pasas, también si bajas las corridas). |
| **Acero inferior** (título en azul) | «Calibre (#)», «Cantidad», sub-bloque «Bastón corrido inf. (0–N)» → «Calibre», «Cantidad» | igual que arriba | | #3, 2 / #3, 0 | Lecho inferior (resiste M+). |
| **Momentos (t·m)** | «Mr (+)» | solo lectura (gris, placeholder «—», tooltip «Calculado automáticamente») | | vacío | MR del lecho inferior, lo pone Calculo. |
| | «Mu (+)» | número, paso 0.01 | | vacío | Demanda positiva. Se sincroniza con «Mu+ (positivo)» de Calculo. |
| | «Mr (−)» | solo lectura | | vacío | MR del lecho superior. |
| | «Mu (−)» | número, paso 0.01 | | vacío | Demanda negativa (en valor absoluto). |
| **Estribos** (título en verde) | «Calibre estribo (#)» | select #2, #2.5, #3, #4 | | #2.5 | Calibre del estribo. |
| | «Sep. L/4 (cm)» | número | 3–40 | 8 | Separación en los extremos (zona L/4). |
| | «Sep. resto (cm)» | número | 3–40 | 16 | Separación en el centro. |
| **Cortantes (t)** (título morado) | «Vu» | número, paso 0.01 | | vacío | Cortante último. |
| | «Vr» | solo lectura | | vacío | Lo calcula Calculo. |

Texto de ayuda bajo cada bastón: «Uno por varilla (amarre de pares). **Corrido**: recorre la trabe, se dibuja en el corte y suma al As y al MR; no cambia b mín.»
Si la trabe trae bastones **puntuales** del módulo Longitudinal aparece además, en azul: «+ N bastón(es) **puntual(es)** del análisis longitudinal: no van en el corte ni en este MR, salen en el alzado con su longitud.»

Al final: botón **«+ Añadir a BD Global»** (ver §3.5).

Los rangos `min/max` son sólo del input HTML: el navegador no te impide teclear fuera de rango. El único límite que sí aplica la app es el de bastones ≤ corridas.

**(b) Lienzo (centro).** Dibujo de todas las secciones, en rejilla de hasta 4 columnas, a escala (14 px por cm). Sin secciones dice: «Pulsa “+ Nueva” para crear una sección». Detalles en §3.3.

**(c) «Escala de momentos» (derecha, 280 px).** Sólo aparece si hay al menos una sección. Sin MR dice: «Ingresa valores de Mr en las propiedades de cada sección para activar la escala.» Con MR muestra dos campos de demanda «Mu(+)» y «Mu(−)» (paso 0.1, no se guardan en el proyecto) y dos reglas verticales «Mr(+)» y «Mr(−)» (ver §3.2).

### 2.3 Pestaña «Calculo»

Sin selección: «Selecciona una sección del toolbar para calcular». Arriba hay tres botones de subpestaña: **«Flexión»**, **«Cortante»**, **«Memoria»**, y a la derecha el resumen `T-1 — 15×20 cm — f'c=250 — fy=4200`.

Si alguna verificación falla con demanda capturada, la pestaña «Calculo» muestra un **punto rojo** en su esquina (aunque estés en Secciones).

**Flexión — columna de datos:**
- «Sección y materiales»: caja de solo lectura `b=… h=… r=… cm — f'c=… kg/cm²` con la nota «↑ Editables desde la pestaña Secciones».
- «fy» (kg/cm², defecto **4200**). **fy sólo se edita aquí**; no existe en Secciones.
- «Momentos»: «Mu+ (positivo)» y «Mu− (negativo)», en ton·m.
- «Acero superior (M−)»: «Varilla principal» (select `#n — Ø…mm | A=…cm²`, de #2 a #10), «Cant. varillas (0 = auto)»; sub-bloque «Bastón M−»: «Varilla bastón», «Cantidad (0–N)».
- «Acero inferior (M+)»: los mismos campos, sub-bloque «Bastón M+».

Todo lo que cambias aquí (varilla, cantidad, bastón, Mu) se refleja en Secciones y viceversa: son el mismo dato.

**Flexión — resultados:** dos tarjetas, «▲ Momento positivo M+» (azul, lecho inferior) y «▼ Momento negativo M−» (rojo, lecho superior). Filas: «d», «Rn», «ρ calculada», «As calculado», «As mínimo», «As máximo», «As requerido», «ρ real», «q = ρ·fy / f''c», «Varillas calculadas», «Varillas usadas», recuadro «Desglose As — lecho inferior/superior» (corridas, bastones o «Sin bastones», «As total»), «b mínimo» (tag «b OK» / «b < bmin»), «MRT (acero)» en ton·m (tag «MR ≥ Mu» / «MR < Mu»), «MRC (concreto)». Abajo, tags «As ≥ As min», «As ≤ As max», «MR ≥ Mu», «b ≥ b min» y, si todo pasa, la franja verde «✓ 2 var. #3 + 1 bastón(es) #3 — As = 2.13 cm²». Las filas con «ⓘ» muestran la fórmula al pasar el mouse.

**Cortante — columna de datos:** «Sección y materiales», «fy», «Cortante»: «L (longitud libre)» en m (defecto 0), «Vu (cortante último)» en ton, «As usada (long.)» en cm² (por defecto toma el mayor As total de flexión, fondo verde y leyenda «✓ De Flexión»; si la escribes pasa a «✎ Manual» con el enlace «restablecer»), indicador «L/h» con su zona («→ ec. 5.5.3.1.1.a/b», «⚠ 4–5» o «⚠ <4»). Si L/h < 4 aparece «¿Hay momento negativo? (L/h < 4)» con botones «SIN M−» / «CON M−»; con «CON M−» sale «Mu en sección crítica» (ton·m). Luego «Estribos»: «Varilla del estribo» y «Nº de ramas» (defecto 2).

**Cortante — resultados** («Resultados — Cortante (NTC-2023 Sec. 5.5)»): «d», «L/h», «ρ (cuantía long.)», «VCR fórmula a», «VCR fórmula b», «VCR adoptado (ec.)», «VCR_min», «VCR_max», «Va_max (límite)» (tag «Vu ≤ Va_max»), «VSR necesario» (tag «Requiere estribos» / «Solo mínimos»), «Av estribo», «S calculado», «S máximo», «S mínimo (constr.)» (6 cm), recuadro «Separación de diseño» `S = 12 cm` / `E #2.5 @ 12 cm (2 ramas)`, «VSR real», «Vr = VCR + VSR» (tag «Vr ≥ Vu»). Recuadro «Separación real en obra»: «S en zona L/4» (placeholder = S de diseño) y «S en zona L/restante», cada uno con su `Vr = … ton` (verde/rojo contra Vu). Tags finales «Vu ≤ Va_max», «S ≥ 6 cm», «S ≤ S max», «Vr ≥ Vu» y franja «✓ E #2.5 @ 12 cm — Vr = … ton».

**Memoria:** memoria de cálculo de la sección con el botón «Imprimir / Exportar PDF».

**Panel «Envolvente del modelo»** (debajo de Flexión y de Cortante, no de Memoria):
- Botón «📄 Cargar envolvente (RAM .txt)» (acepta .txt/.csv). Sin archivo: «Opcional — revisa esta sección contra todos los miembros del modelo».
- Con archivo: `<archivo> · N miembros · <combo>`, botón «M33 normal ⇄» / «M33 invertido ⇄» (invierte el signo de M33 si en tu modelo el positivo va al revés), enlace «quitar», y la píldora `X/Y pasan` (+ « (k con el bastón puntual)», + « · crítico M-<id> (util 0.xxx)»), verde si todos pasan, roja si no.
- Franja «Envolvente global: Mu+ = … Mu− = … Vu = … vs MR+ … · MR− … · Vr …» con el botón **«← Usar envolvente global»** (copia la más desfavorable a Mu+, Mu− y Vu de la trabe).
- Tabla por miembro, ordenada de mayor a menor utilización: «Miembro», «Mu+ (t·m)», «Mu− (t·m)», «Vu (t)», «Mu+/MR+», «Mu−/MR−», «Vu/Vr», «Util.», «Estado» y dos botones por fila: **«usar»** (copia los valores de ese miembro a la calculadora) y **«bastonear →»** (abre el módulo Longitudinal centrado en ese miembro).
- Nota al pie: «Por miembro: Mu+ = mayor M33 positivo · Mu− = |menor M33 negativo| · Vu = máx |V2|. Utilización = máx(Mu+/MR+, Mu−/MR−, Vu/Vr). La fila resaltada es el caso crítico.»

### 2.4 Módulo «BD Global»

Se abre con «Módulos» (o `⌘K` / `Ctrl+K`) → buscar «BD Global» en «Buscar módulo…». Queda como pestaña con el contador de vigas; se cierra con su «×» sin perder nada.

- **Tarjetas**: «Total», «Fábrica» («NTC-2023 precalc.»), «Tuyas» («añadidas manualmente»).
- **Botones**: «📂 Cargar BD» (importa un .json y lo mezcla), «↓ Exportar BD» (descarga `bd_global_vigas.json`), «🗑 Limpiar mis vigas» (borra sólo las tuyas, pide confirmación), «↻ Actualizar heatmap».
- **Búsqueda**: «Mu+ (t·m)» y «Mu− (t·m)» (paso 0.25, placeholder «0.00», Enter busca), botón «Buscar», botón «Limpiar filtros» (aparece cuando hay resultados, mensaje o restricciones).
- **Restricciones**: chips «Restringir base b» (15…45) y «Restringir peralte h» (20…45); puedes marcar varios.
- **Resultados**: hasta 12 tarjetas, una por tamaño b×h (de cada tamaño, el armado más ajustado, es decir, con mayor relación Mu/MR), ordenadas de menor a mayor As total. La primera lleva la etiqueta «ÓPTIMA». Cada tarjeta muestra `b×h cm`, `M+ 2×#4 +1×#3`, `As+ … cm²`, `M− …`, `As− …`, «Ratio máx» (verde ≥ 0.88, ámbar ≥ 0.70, azul < 0.70), «As total» y «← Usar en proyecto». **Toda la tarjeta es clicable.**
- **Heatmap** «Malla de Trabes» (iframe `MallaVigas.html`, pie «MallaVigas · NTC-2023»): modos «Sección», «Ratio Mu/MRT», «As total». Al abrir resalta el b×h de la sección seleccionada; la búsqueda le aplica el mismo filtro.

---

## 3. Qué calcula y cómo se lee

### 3.1 MR contra MU
- **Mu** es la demanda (la capturas tú o viene de RAM). **MR** es la resistencia de la sección con el armado que pusiste: MRT = FR·As·fy·(d − a/2), con FR = 0.9, f''c = 0.85 f'c, β1 = 0.85 hasta f'c 280 (luego baja, mínimo 0.65).
- Cumple si **MR ≥ Mu** y además As ≥ As mín (0.7√f'c/fy·b·d), As ≤ As máx (0.9·As bal) y b ≥ b mín (2r + (2n − 1)·Ø, **sólo con las corridas**: los bastones van amarrados y no ocupan ancho).
- **Bastón corrido**: suma su área al As del lecho y entra en el MR y en el dibujo. **Bastón puntual**: lo reparte el módulo Longitudinal; no entra en el corte ni en este MR, sale en el alzado. En la envolvente, un miembro que sólo pasa gracias al puntual se marca «✓ con bastón puntual» (azul).
- Cortante: Vr = VCR + VSR con FR = 0.75; la zona L/h decide la ecuación de VCR (L/h > 5: máx de 5.5.3.1.1.a/b acotado entre VCR_min y VCR_max; L/h < 4: 5.3.2 sin compresión o 5.3.3 con compresión). S de diseño = mín(S calculado, S máximo), redondeado hacia abajo y nunca menor que 6 cm.
- **El Mr(+), Mr(−) y Vr de Secciones se actualizan en vivo** mientras la sección está seleccionada (la calculadora siempre está montada aunque no la veas). Con Vu > 0, las «Sep. L/4» y «Sep. resto» de Secciones también se sincronizan con las de Calculo.

### 3.2 Escala de momentos
- Cada sección con MR > 0 es una banda de color. Las bandas se apilan de menor a mayor MR: cada banda va del MR de la anterior al suyo, con el nombre de la sección dentro y su MR en el eje (t·m). Hay una regla para «Mr(+)» y otra para «Mr(−)».
- Si escribes una demanda en «Mu(+)»/«Mu(−)», aparece una línea de demanda; la banda que la contiene se resalta y su nombre se escribe sobre la línea (es la sección más chica del proyecto que la cubre en esa dirección). Si la demanda rebasa todas: «Excede».
- Con **ambas** demandas capturadas aparece la sugerencia local: «→ Usar **T-3** (20×40)» (clic en el nombre = seleccionarla) o «⚠ Diseñar sección» si ninguna cubre las dos.
- Con al menos una demanda aparecen además hasta 3 botones «BD Global» con etiqueta «h mín» (menor peralte), «As mín» (menos acero) y «balance»; el tooltip dice el As total. **Clic = aplica ese b×h y armado a la sección seleccionada** (no cambia Mu ni muestra aviso).
- Clic en una banda selecciona esa sección.

### 3.3 Dibujo del corte
- Contorno del concreto: línea rosa-magenta. **Estribo: verde** (rectángulo redondeado con dos ganchos en la varilla superior izquierda).
- **Varillas superiores: rojo/naranja** (círculo relleno). **Varillas inferiores: azul**.
- **Bastones corridos**: círculo **sin relleno** del color de su lecho, unido con una línea corta a la varilla a la que se amarran. Se amarran primero en las esquinas y luego hacia el centro; el primer bastón superior va a ~53° para librar los ganchos.
- Rótulos: arriba, en verde, `Est. #2.5  @8/@16 cm`; luego en rojo `2Ø#3 corridas + 1Ø#3 bastón`; abajo en azul el lecho inferior; cotas de `r=3` y del peralte a la izquierda y del ancho abajo; al pie el nombre, `15 × 20 cm` y `f'c = 250 kg/cm2`.
- Los bastones puntuales **no** se dibujan aquí.

### 3.4 Badge de BD (arriba del formulario)
Compara b, h, corridas y bastones corridos de la sección contra la BD Global. **No** compara f'c, r, estribos ni Mu.
- «🟢 De BD Global · G…»: armado idéntico a una viga de la BD (muestra su id).
- «🟡 Basada en BD · modificada · G…»: el b×h sí existe en la BD pero con otro armado; el id es el de la viga de ese tamaño con As total más parecido.
- «⚪ Trabe nueva · no guardada»: ese b×h no existe en la BD.

### 3.5 «+ Añadir a BD Global»
Se habilita cuando hay sección seleccionada, el badge **no** es verde, y al menos una dirección tiene MR > 0 con MR ≥ Mu (o sin Mu). Al pulsarlo valida y guarda la viga como «Tuyas». Las vigas tuyas viven en el `localStorage` del navegador (clave `iv_global_db`): no viajan en el proyecto .json; para llevarlas a otra máquina usa «↓ Exportar BD» / «📂 Cargar BD».

### 3.6 Envolvente
«Util.» = máx(Mu+/MR+, Mu−/MR−, Vu/Vr): ≤ 0.9 verde, 0.9–1.0 ámbar, > 1 rojo (azul si lo cubre el puntual). «Estado»: «✓ pasa», «✓ con bastón puntual», «✗ no pasa». Las razones que no cumplen se pintan en rojo.

---

## 4. Flujos típicos

### 4.1 Crear una sección nueva y revisarla a mano
1. Clic en **«+ Nueva»** (barra superior). Se crea `T-n` seleccionada con 15×20, r 3, f'c 250, 2#3 arriba y abajo, E#2.5 @8/@16.
2. En **Secciones**, cambia «Nombre de sección» si quieres otro nombre (el chip se renombra solo).
3. Captura «Ancho (b)», «Peralte (h)», «Recubrimiento (r)», «f'c (kg/cm²)».
4. Elige «Calibre (#)» y «Cantidad» de Acero superior e inferior; añade bastones corridos si hace falta (máx. uno por varilla).
5. Captura «Mu (+)», «Mu (−)» y «Vu». Lee «Mr (+)», «Mr (−)» y «Vr» (se llenan solos).
6. Ve a **«Calculo»** → «Flexión»: confirma «fy», revisa las cuatro verificaciones de cada lecho. En «Cortante» captura «L (longitud libre)» (si la dejas en 0, L/h = 0 y se usa la rama L/h < 4), ajusta «Varilla del estribo» / «Nº de ramas» y fija «S en zona L/4» y «S en zona L/restante».
7. Si sale el punto rojo en «Calculo», algo no pasa: sube armado o sección.
8. Opcional: «+ Añadir a BD Global» para reutilizarla en otras obras.

### 4.2 Capturar momentos a mano
Puedes hacerlo en dos lugares equivalentes: «Mu (+)» / «Mu (−)» / «Vu» en Secciones, o «Mu+ (positivo)» / «Mu− (negativo)» / «Vu (cortante último)» en Calculo. Unidades: t·m y t. Mu− va en valor absoluto (positivo).

### 4.3 Cargar la envolvente de RAM por archivo de texto
**Opción A — una sola trabe, desde Calculo:**
1. Selecciona el chip. Ve a «Calculo» (Flexión o Cortante).
2. En «Envolvente del modelo» pulsa «📄 Cargar envolvente (RAM .txt)» y elige el reporte «Máximos esfuerzos» (Max/Min por miembro) o uno por estaciones.
3. Revisa la píldora «X/Y pasan» y la tabla. Si los signos salen al revés, pulsa «M33 normal ⇄».
4. Pulsa «← Usar envolvente global» para diseñar con la más desfavorable, o «usar» en la fila de un miembro.
5. Si un miembro no pasa, «bastonear →» te lleva a Longitudinal para resolverlo con bastones puntuales.

**Opción B — varias trabes, «📄 Método manual» del Centro de carga:**
1. Guarda en RAM un .txt por chip con el **mismo nombre que el chip** (`T-5.txt` → T-5; se ignoran guiones, espacios y mayúsculas). Ideal: carpeta por tipo (COLUMNAS · LONGITUDINAL · MAXIMOS).
2. Pulsa «📥 Reportes de RAM» → pestaña «📄 Método manual».
3. Usa «🗂 Elegir una carpeta…», «📂 Archivos sueltos…», suelta los archivos encima, o el «Cargar…» de cada tarjeta de reporte («Esfuerzos a lo largo del elemento» [RECOMENDADO], «Esfuerzos a lo largo (alternativa)», «Máximos por miembro», «Geometría del modelo»).
4. La app clasifica cada archivo por su contenido y lo asigna a la trabe por el nombre. Un aviso resume el resultado (p. ej. «Reportes cargados en 3 trabe(s) · todas con su máximo exacto»). Si una trabe recibió sólo estaciones, el aviso dice «SIN máximos exactos: …»: carga también «Máximos esfuerzos» para que el pico no quede corto.
5. Vuelve a «Calculo» de cada trabe y usa «← Usar envolvente global».

### 4.4 Buscar una sección por momento en BD Global y traerla al proyecto
1. **Primero selecciona (o crea) el chip** que va a recibir la sección.
2. Abre «Módulos» → «BD Global».
3. Escribe «Mu+ (t·m)» y/o «Mu− (t·m)»; opcionalmente marca chips de «Restringir base b» / «Restringir peralte h».
4. Pulsa «Buscar» (o Enter). Lee el mensaje «N secciones pasan Mu+ = … / Mu− = … t·m».
5. Haz clic en la tarjeta que quieras (la «ÓPTIMA» es la de menos acero). Aviso: «Sección 20×40 aplicada».
6. Se copian b, h, corridas, bastones corridos **y el Mu+/Mu− con el que se generó esa viga de la BD** (no el que buscaste). Regresa a Secciones y **vuelve a capturar tu Mu real**; confirma f'c y r (la BD supone 250 y 3).
7. El badge pasará a «🟢 De BD Global».

Atajo sin salir de Secciones: escribe la demanda en la «Escala de momentos» y pulsa uno de los botones «BD Global» («h mín», «As mín», «balance»).

### 4.5 Renombrar, reordenar, borrar, «duplicar»
- **Renombrar:** selecciona el chip y edita «Nombre de sección».
- **Reordenar:** arrastra el chip o usa `Alt + ←/→` con el chip enfocado.
- **Borrar:** «×» del chip → confirmación «¿Seguro que quieres eliminar la sección «T-3»? Se pierden su armado y sus demandas (lo guardado en proyecto.json no se toca).» Acepta. Se selecciona la contigua.
- **Duplicar:** **no hay botón para duplicar trabes.** Lo más parecido: crea «+ Nueva» y copia los datos a mano, o aplica la misma viga de la BD Global. En Longitudinal existen «⧉ Separar los N que piden puntual en otra trabe» y «⧉ Separarlo en otra trabe», que crean una trabe nueva con parte de los miembros (es otro módulo).

---

## 5. Botones, acciones y selectores para automatizar

| Elemento | Texto exacto | Selector útil |
|---|---|---|
| Pestaña Secciones | «Secciones» | `role="tab"` con nombre «Secciones» |
| Pestaña Calculo | «Calculo» (sin acento) | `role="tab"` con nombre «Calculo» |
| Pestaña BD Global (abierta) | «BD Global» + contador | `data-testid="tab-bdglobal"` |
| Abrir módulos | «Módulos» | input «Buscar módulo…» en la paleta |
| Chip de sección i (0-based) | nombre | `data-testid="chip-{i}"` |
| Borrar chip i | «×» | `data-testid="chip-x-{i}"` (luego aceptar `confirm`) |
| Nueva sección | «+ Nueva» | botón `.btn-primary` por texto |
| Centro de carga | «📥 Reportes de RAM» | `data-testid="cargar-envolventes"` |
| Input oculto multi-archivo de la barra | — | `data-testid="env-files"` (input file, reparte por nombre) |
| Centro de carga: pestañas | «⚡ Desde RAM», «📄 Método manual» | `data-testid="tab-ram"`, `tab-manual` |
| Centro de carga: carga | «🗂 Elegir una carpeta…», «📂 Archivos sueltos…», «Cargar…»/«Reemplazar…» | `cargar-carpeta`, `cargar-todo`, `slot-acciones`, `slot-estaciones`, `slot-maximos`, `slot-geometria`; ayuda `ayuda-{id}`; cerrar `cerrar-centro` |
| Crear secciones del modelo | «crear las N secciones con su armado» | `data-testid="crear-faltantes"` |
| Subpestañas Calculo | «Flexión», «Cortante», «Memoria» | botones por texto |
| Envolvente | «📄 Cargar envolvente (RAM .txt)», «M33 normal ⇄»/«M33 invertido ⇄», «quitar», «← Usar envolvente global», «usar», «bastonear →» | `data-testid="bastonear-{miembro}"` |
| Cortante L/h<4 | «SIN M−», «CON M−» | por texto |
| As manual | «restablecer» | por texto |
| Añadir a BD | «+ Añadir a BD Global» | por texto (puede estar `disabled`) |
| BD Global | «📂 Cargar BD», «↓ Exportar BD», «🗑 Limpiar mis vigas», «↻ Actualizar heatmap», «Buscar», «Limpiar filtros», «← Usar en proyecto» (dentro de la tarjeta) | por texto |
| Memoria | «Imprimir / Exportar PDF» | por texto |

Los inputs del formulario no tienen `data-testid` ni `id`; ubícalos por la etiqueta `<label class="field-label">` que los precede dentro del mismo `<div>`. Los campos son *controlados* por React: para escribir usa eventos reales de teclado (o el setter nativo + evento `input`), no basta con cambiar `value`.
Para inspección, el store de trabes está expuesto en `window.__BEAM_STORE__` (Zustand: `getState().sections`, `selectedIdx`, `form`). Úsalo para leer; para escribir, mejor la UI.

---

## 6. Errores y avisos comunes

| Mensaje | Dónde | Significa / qué hacer |
|---|---|---|
| «Selecciona una sección del toolbar o crea una nueva con el botón “+”» | Secciones | No hay chip seleccionado. |
| «Selecciona una sección del toolbar para calcular» | Calculo | Ídem. |
| «Sección insuficiente (aumenta b o d)» | tarjeta de flexión | El Mu rebasa lo que admite el concreto (la raíz de ρ sale negativa). Sube b o h. **Ojo:** mientras dure el error, el «Mr» de Secciones conserva su último valor. |
| «Datos incompletos» / «Sin datos» | flexión | Falta b, h, r, f'c o fy. |
| Tags «✗ MR < Mu», «✗ b < bmin», «✗ As ≥ As min», «✗ As ≤ As max» | flexión | Resistencia, ancho mínimo, acero mínimo o máximo no cumple. |
| «⚠ Vu supera límite ec. 5.5.2.2 — Redimensionar» | cortante | Vu > Va_max: ningún estribo alcanza, cambia la sección. |
| «⚠ S calculado < 6 cm — Se adopta S = 6 cm» | cortante | Estribos demasiado juntos; se usa 6 cm y probablemente Vr < Vu. Sube el calibre, las ramas o el peralte. |
| «⚠ 4–5» / «⚠ <4» junto a L/h | cortante | Zona de trabe corta o de transición; revisa. Con L = 0 siempre cae en «<4». |
| Punto rojo en «Calculo» | barra de pestañas | Alguna verificación de la sección activa falla con demanda > 0. |
| «✗ Mr+ < Mu+ — no pasa», «✗ Mr− < Mu− — no pasa», «✗ Vr < Vu — no pasa», «✗ Sin resultados de cálculo» | bajo «+ Añadir a BD Global» | No se guarda una viga que no pasa o sin MR. |
| «✓ G… añadida a BD Global» / «Ya existe: G…» | ídem | Guardada / ya había una con el mismo id (mismo b×h, armado y Mu). |
| «Selecciona una sección primero» | BD Global (aviso arriba a la derecha) | Clic en una tarjeta sin chip seleccionado. |
| «Ingresa al menos un Mu» | BD Global | Búsqueda vacía. |
| «Ninguna sección cubre Mu+ = … / Mu− = … t·m (…)» | BD Global | Ninguna viga de la BD alcanza (o tus restricciones la excluyen). Quita restricciones o diseña a mano. |
| «N vigas nuevas · M ya existían» / «Error al leer archivo» | BD Global, Cargar BD | Resultado de importar; el error indica que el archivo no es JSON válido. |
| «Excede» | Escala de momentos | La demanda rebasa el MR de todas las secciones. |
| «⚠ Diseñar sección» | Escala de momentos | Ninguna sección del proyecto cubre Mu+ y Mu− a la vez. |
| «No se encontraron filas Max/Min con 6 valores. Verifica que sea un reporte de "Máximos esfuerzos en miembros".» / «No se pudieron leer puntos del archivo.» | Envolvente | El .txt no es un reporte que la app entienda. |
| «Reporte por estaciones: N miembros. También disponible en la pestaña Longitudinal (bastones a lo largo).» | Envolvente | Aviso informativo: el archivo sirvió también como perfil para Longitudinal. |
| «… sin sección que coincida: X.txt» / «… no se pudieron leer: …» / «… SIN máximos exactos: …» | aviso del reparto masivo | El nombre del archivo no corresponde a ningún chip / formato no reconocido / falta el reporte de máximos. |

---

## 7. Qué NO hace (o qué hay que tener en cuenta)

- **No calcula el MR si no hay una sección seleccionada:** el MR de cada sección se calcula y guarda cuando la seleccionas. Una sección que nunca seleccionaste puede tener «Mr» vacío y no aparecer en la Escala de momentos; selecciónala una vez.
- **No tiene botón de duplicar trabe** ni deshacer en este formulario.
- **No captura fy en Secciones** (sólo en Calculo, defecto 4200), ni estribos con más de 2 ramas en el dibujo (las «Nº de ramas» sólo afectan el cálculo).
- **No dibuja bastones puntuales** ni cuenta su resistencia en el MR del corte; eso es del módulo Longitudinal.
- **No dibuja varillas en doble lecho:** todas las corridas van en una sola fila; los bastones se amarran pegados a la varilla.
- **«Cant. varillas (0 = auto)»** en Calculo calcula con las varillas que pide el As, pero **no** cambia la «Cantidad» de Secciones ni el dibujo. Captura siempre el número final.
- **La BD Global no considera f'c ni recubrimiento:** está precalculada para f'c 250 y r 3. Si tu trabe es de otro f'c, el badge o la búsqueda pueden coincidir, pero el MR real será el que dé Calculo. Al aplicar una viga de la BD **no** se cambian f'c, r ni estribos, y el Mu se reemplaza por el de la viga de la BD.
- **Las vigas que tú añades a la BD** se guardan en ese navegador (no en el proyecto) y sin As por lecho: en las tarjetas de búsqueda salen con As = 0 y por eso pueden aparecer primero. Fíjate en el armado, no sólo en el As.
- **El heatmap no manda la sección al proyecto:** para aplicar, usa las tarjetas de resultado de BD Global o los botones de la Escala de momentos.
- **No revisa deflexiones, torsión, anclaje ni traslapes** en estas pestañas (deflexiones y longitudes de bastón están en otros módulos).
- **No valida los rangos de los inputs:** puedes teclear valores fuera de rango; sólo se limita bastones ≤ corridas.
- **Borrar un chip no toca el archivo `proyecto.json` guardado**, pero sí el autoguardado del navegador.

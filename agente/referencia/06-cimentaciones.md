# Cimentaciones: cómo operar la pestaña

Esta guía complementa el capítulo 11 del manual (conceptos y criterio de cálculo). Aquí está lo que necesitas para **operar la interfaz**: qué botón dice qué, qué campos hay y con qué valores arrancan, qué revisiones salen y en qué orden hacer las cosas. Los `data-testid` van entre corchetes, por ejemplo [cim-proponer].

Lo básico del estado:
- Todo vive en `useCimStore`: `cimientos`, `suelo` (lo capturado de la obra), `criterios` (lo que cambiaste de los de fábrica), `linderos` y `hist` (deshacer, hasta 40 pasos). Se guarda con el proyecto `.json`, en el bloque `cimentacion`.
- Cada cambio del formulario o del dibujo se revisa **al momento**: no hay un botón de "calcular". ⚡ Proponer es el único que redimensiona.

---

## 1. Anatomía de la pestaña [cim-view]

### Barra superior
- Título **Cimentaciones** con el contador: "N cimiento(s) · M no cumplen" o "· todos cumplen".
- **🪨 Suelo y criterios** con la etiqueta `qadm 15.0` (el qadm vigente) [cim-obra-btn]: abre el modal de la obra.
- **⚡ Desde RAM** [cim-ram-btn]: abre la ventana de reacciones.
- **📄 Memoria PDF** [cim-pdf]: PDF del cimiento seleccionado. Se desactiva si no hay ninguno.
- **todos** [cim-pdf-todos]: PDF de todos los cimientos. Necesita al menos 2.
- **DXF** [cim-dxf]: el seleccionado. **DXF todos** [cim-dxf-todos] necesita al menos 2.
- **SVG** [cim-svg]: sólo el seleccionado.

### Chips y + Nuevo
- Hay un chip por cimiento [cim-chip-Z-1] con su icono, su nombre y un punto de color: `ok` verde, `justo` (cumple pero con más de 95 %) o `mal` (no cumple). El tooltip trae el tipo y el aprovechamiento máximo. Un clic lo selecciona.
- **+ Nuevo ▾** [cim-nuevo] despliega el menú [cim-menu]. Cada opción es [cim-nuevo-{id}]. El menú se cierra si el cursor sale de él.
- **↶ deshacer** [cim-deshacer] sólo aparece cuando hay historial.
- Si no hay cimientos, en lugar del cuerpo sale [cim-inicio], con tarjetas [cim-tarjeta-{id}] y el botón "⚡ O créalos desde las reacciones de RAM".

| id | Nombre exacto en el menú | Prefijo |
|---|---|---|
| aislada | Zapata aislada | Z-1, Z-2… |
| corrida | Zapata corrida bajo muro | ZC- |
| contratrabe | Zapata corrida con contratrabe | ZT- |
| liga | Contratrabe de liga | TL- |
| contencion | Muro de contención de concreto | MC- |
| gravedad | Muro de contención de mampostería | MM- |
| mamposteria | Cimiento de mampostería | CP- |

El nombre que toma un cimiento nuevo es el primer `{prefijo}-n` libre. La contratrabe de liga **de cada zapata** se llama CT-1 o CT-2; ver §3. Esa no es un cimiento aparte, la TL sí lo es.

Al crear, la app propone de inmediato con las cargas de ejemplo y lanza el aviso: "Z-1: zapata aislada propuesta con cargas de ejemplo; captura las tuyas y pulsa ⚡ Proponer".

### Cuerpo, en tres columnas
- **Izquierda, el formulario** [cim-form]. Arriba están el nombre editable [cim-nombre], **⚡ Proponer** [cim-proponer], **⧉** (duplicar: crea `base-n` libre y quita el origen RAM) y **✕** [cim-borrar], que pide confirmación: "¿Borrar Z-1? (Ctrl+Z lo regresa)".
  - Si el cimiento salió de RAM, abajo aparece "Desde RAM: …" [cim-origen].
- **Centro**: el encabezado con el nombre y el tipo, luego el dibujo [cim-dibujo] y la **Memoria paso a paso** [cim-memoria], con el botón "abrir todo" / "cerrar todo". Cada sección se abre con un clic y la que falla dice **no cumple**.
- **Derecha, las revisiones** [cim-revisiones]:
  - El veredicto [cim-veredicto] dice "✓ Cumple" o "✗ No cumple (n)", seguido del resumen.
  - Luego los avisos [cim-avisos].
  - Después las revisiones agrupadas. Cada una es [cim-check-{id}] y muestra su barra, el %, y "actuante / resistente unidad · nota". En las de FS sólo sale la nota.
  - Al final, las cantidades [cim-cant]: concreto m³, acero kg, mampostería, excavación.

Mensajes de ⚡ Proponer: "Z-1: dimensionado y armado; cumple todo", o bien "Z-1: propuesta hecha, pero no cumple penetración, …", con fondo de advertencia.

---

## 2. Formulario por tipo

### Cómo se comportan los campos
- Los números se escriben como texto y la coma vale como punto. El valor entra mientras escribes (si ya es válido y está en rango), al salir del campo o con Enter.
- ↑/↓ suben o bajan al siguiente múltiplo del paso; con Mayús, ×10.
- Si escribes menos del mínimo, se corrige al mínimo. Ejemplos: B no baja de 0.60 y el Df del suelo tampoco.
- Los bloques se pliegan con un clic en su encabezado (▾/▸). **Suelo** y **Materiales** arrancan plegados.

### Tabla de cargas por caso [cim-cargas]
- Tiene renglones **CM**, **CV** y **S**, y una columna por componente. El campo es [cim-carga-{caso}-{k}], por ejemplo [cim-carga-CM-P].
- Son cargas **de servicio**. S es opcional.

### Bloques comunes
- **Suelo** [cim-suelo] (todos menos la liga):
  - Muestra el valor de la obra. Si lo cambias, aparece **propio ↺**; un clic regresa al de la obra. Nota del bloque: "Lo que no cambies aquí sale de «Suelo y criterios» de la obra".
  - Los campos son [cim-suelo-{k}] y dependen del tipo:
    - aislada, corrida, contratrabe: qadm, γ suelo / relleno, Desplante Df.
    - contención: qadm, γ, φ relleno, φ suelo de apoyo, c suelo de apoyo, γ suelo de apoyo.
    - gravedad: los mismos de contención más μ base-suelo.
    - mampostería: qadm, γ, Df, φ relleno, μ.
- **Materiales**:
  - Concreto: f′c (kg/cm², 250), fy (4200) y Recubrimiento (5 cm). En la liga, "Recubrimiento arriba y lados" (3) y "Recubrimiento abajo" (5).
  - Piedra: γ mampostería (2.2 t/m³), f\*m (20 kg/cm²) y v\*m (0.6 kg/cm²).
- **Armado** [cim-armado]: varía por tipo. El campo dual se explica en §5.

### Zapata aislada (Z)
Valores de fábrica, antes de que Proponer los ajuste: B = L = 1.20 m, h = 30 cm, columna 30 × 30, céntrica, con liga, cuadrada. Cargas CM P = 12 t y CV P = 4 t. Parrilla #4 @ 20 en ambos sentidos.

- **Geometría** [cim-geo]:
  - **B (en x)** m [cim-B], **L (en y)** m [cim-L] (desactivado si es cuadrada), **Peralte h** cm [cim-h], ☑ **cuadrada** [cim-cuadrada], **Columna c1 (x)** cm, **Columna c2 (y)** cm.
  - **Posición de la columna** [cim-pos]: Al centro (céntrica) · Lindero izquierdo · Lindero derecho · Lindero de abajo · Lindero de arriba · Esquina ↙ · Esquina ↘ · Esquina ↖ · Esquina ↗. Si arrastraste la columna a un punto intermedio, aparece además "Corrida a mano (arrastrada)".
  - Si no es céntrica, sale ☑ **con trabe de liga (toma la excentricidad N·e)** [cim-liga].
- **Cargas en la columna (servicio)**: columnas **P (t)**, **Mx (t·m)**, **My (t·m)**, **Vx (t)**, **Vy (t)**.
  - Si salió de RAM agrupando apoyos, sale la nota [cim-apoyos]: "Además se revisa con las cargas de cada uno de sus N apoyo(s)…", con el botón **quitar** (revisa sólo con las de arriba).
- **Armado**: "Varillas en x (corren a lo largo de B, repartidas en L)" [cim-arm-x] y "Varillas en y (…)" [cim-arm-y].
- **Contratrabe de liga**: ver §3.
- **Revisiones**, con su grupo:
  - Suelo: Presión en el suelo.
  - Cortante: Penetración, Cortante en x, Cortante en y.
  - Flexión: Flexión en x, Flexión en y.
  - Detallado: Anclaje en x, Anclaje en y, Aplastamiento, Peralte mínimo, Ancho mínimo, Desplante mínimo.
  - Contratrabe de liga CT-x: ver §3.

### Zapata corrida bajo muro (ZC)
Valores de fábrica: B = 0.80 m, h = 20 cm, muro t = 15 cm de mampostería, al centro, Largo 10 m. Cargas CM w = 4.75 t/m y CV w = 1.2 t/m. Armado transversal #3 @ 20 y longitudinal #3 @ 25.

- **Geometría (por metro)**:
  - **Ancho B** m, **Peralte h** cm, **Muro t** cm, **Largo (planos)** m.
  - **Muro**: "de mampostería (flexión a t/4 dentro)" o "de concreto (flexión en la cara)".
  - **Posición** [cim-pos]: "Muro al centro" o "Muro de lindero". Si es de lindero, sale ☑ "dala y muros perpendiculares toman la excentricidad" [cim-liga].
- **Cargas del muro (servicio, por metro)**: **w (t/m)** y **M (t·m/m)**.
- **Armado**: "Transversal (por metro)" [cim-arm-t] y "Longitudinal (repartidas en B)" [cim-arm-l].
- Lleva bloque CT **sólo si el muro es de mampostería**.
- **Revisiones**:
  - Suelo: Presión en el suelo.
  - Cortante: Cortante.
  - Flexión: Flexión transversal, Longitudinal (temperatura).
  - Detallado: Anclaje transversal, Peralte mínimo, Ancho mínimo, Desplante mínimo.
  - Con muro de mampostería, además el grupo "Contratrabe de liga CT-x".

### Zapata corrida con contratrabe (ZT)
Valores de fábrica: L = 8.60 m, B = 1.20 m, Losa h = 20 cm, Alma bw = 25 cm, Peralte H = 70 cm. Tres columnas en x = 0.3, 4.3 y 8.3 m, con CM P = 18, 26 y 16 t y CV al 35 %. Armado 3#5 abajo y 3#5 arriba, estribos #3 de 2 ramas @ 20, aleros #4 @ 25 y losa longitudinal #3 @ 30.

- **Geometría**: **Largo L** [cim-L], **Ancho B** [cim-B], **Losa h** [cim-h], **Alma bw**, **Peralte H** [cim-Hct].
- **Columnas (n)**, con los botones **＋ columna** y **centrar resultante** [cim-centrar].
  - Cada columna Ci [cim-col-i] trae su x (m, desde el extremo izquierdo), su ancho c (cm) y ✕.
  - Abajo, un renglón por caso **CM / CV / S** con **P (t)**, **M (t·m)** (positivo hacia la derecha) y **V (t)**.
- **Armado**: Contratrabe: abajo [cim-arm-inf] · Contratrabe: arriba [cim-arm-sup] (en piezas) · Estribos (# · ramas · @) · Aleros (por metro) [cim-arm-alero] · Losa longitudinal (repartidas en B − bw).
- **Revisiones**:
  - Suelo: Presión en el suelo.
  - Contratrabe: Contratrabe abajo (M+), Contratrabe arriba (M−), Contratrabe cortante.
  - Aleros: Alero flexión, Alero cortante, Alero anclaje, Losa longitudinal.
  - Detallado: Peralte de la losa, Ancho mínimo, Desplante mínimo.
- No lleva CT propia.

### Contratrabe de liga (TL)
Valores de fábrica: b = 15 cm, h = 30 cm, dado de 60 cm. Dos apoyos: x = 0 con Pu = 45 t y N·e = 4 t·m, y x = 5.5 con Pu = 70 t. Armado 2#4 arriba y 2#4 abajo, estribos #2.5 @ 15. Recubrimientos de 3 y 5 cm.

- **Sección**: **Ancho b** cm (mínimo 15), **Peralte h** cm (mínimo 20), **Dado bajo la liga** (sólo para el dibujo).
- **Apoyos (n)**, con **＋ apoyo**. Cada uno trae x (m), c (cm), **Pu** (t, carga **última**) y **N·e** (t·m; 0 si la zapata es céntrica).
- **Muro sobre la liga (servicio)**: CM y CV en t/m.
- **Armado**: Arriba (en los apoyos), Abajo (al centro), Estribos cerrados.
- No tiene bloque Suelo.
- **Revisiones**:
  - Flexión: Liga arriba (M−), Liga abajo (M+).
  - Axial: Tensión de liga, Compresión de liga.
  - Cortante: Cortante.
  - Detallado: Sección mínima.
  - Con un solo apoyo sale "Apoyos" y el aviso "La liga necesita al menos dos apoyos".

### Muro de contención de concreto (MC)
Valores de fábrica: H = 3.0, tc = 0.20, tb = 0.30, punta 0.60, talón 1.30, hz = 0.35, hk = 0, bk = 0.30, Df = 0.80, β = 0, q = 1.0 t/m², pasivo encendido y Largo 10 (todo en m salvo donde se indica).

- **Geometría**: Altura total H · Base hz · Pantalla arriba tc · Pantalla abajo tb · Punta · Talón · Dentellón hk · Dentellón bk · Suelo frente Df (mínimo DfMin) · Largo (planos). Todo en m.
- **Relleno**: **Talud β** (°, de 0 a 40) y **Sobrecarga q** (t/m²). ☑ "considerar el empuje pasivo frente a la punta".
- No hay tabla de cargas: lo que actúa es el empuje.
- **Armado**, todo por metro:
  - Pantalla, cara del relleno (corridas, por metro) [cim-arm-pv].
  - Bastones intercalados [cim-arm-bast], con ☑ con bastones. La separación es la misma de la pantalla.
  - Pantalla, cara exterior; Horizontales (cada cara); Talón, arriba; Base, abajo; Base, longitudinales.
- **Revisiones**:
  - Estabilidad: Volteo, Deslizamiento, Resultante en el tercio medio, Presión máxima.
  - Pantalla: Pantalla flexión, Pantalla cortante, Pantalla anclaje en la base, Pantalla temperatura.
  - Base: Talón flexión, Talón cortante, Punta flexión, Punta cortante, Base longitudinal.
  - Detallado: Desplante mínimo.

### Muro de contención de mampostería (MM)
Valores de fábrica: H = 2.0, c = 0.40, B = 1.20, frente 0, Df = 0.60, sin sobrecarga y sin pasivo.

- **Geometría**: Altura H · Corona c · Base B · Talud del frente (proyección horizontal) · Suelo frente Df · Largo (planos).
- **Relleno**: Talud β, Sobrecarga q y ☑ "considerar el empuje pasivo".
- Sin armado.
- **Revisiones**:
  - Estabilidad: Volteo, Deslizamiento, Resultante en el tercio medio, Presión máxima.
  - Mampostería: Juntas sin tensión, Compresión en la piedra, Cortante en las juntas.
  - Detallado: Desplante mínimo.

### Cimiento de mampostería (CP)
Valores de fábrica: de lindero, B = 0.60, H = 0.75, c = 0.30, t = 0.15, B y H automáticas, B mínima 0.60, FC = 1, Desnivel retenido 0.50, Perpendiculares a 4.0 m, Largo 10. Cargas CM w = 3.6 t/m y CV w = 1.29 t/m.

- **Geometría**:
  - **Tipo** [cim-pos]: "Interior (trapecio simétrico)" o "De lindero (medio trapecio)".
  - Base B [cim-B] y ☑ B automática [cim-autoB]. Al escribir B se apaga la automática; lo mismo pasa con Altura H y ☑ H automática.
  - Corona c · Muro t · B mínima · Factor de carga.
  - Sólo en lindero: Desnivel retenido y Perpendiculares a. Al final, Largo (cantidades).
- **Carga del muro (servicio, por metro)**: CM [cim-carga-CM-w] y CV en t/m. No lleva sismo.
- **Revisiones**:
  - Suelo: Presión en el suelo.
  - Mampostería: Cortante en el escarpio, Pendiente del escarpio, Compresión en la corona y, en interior, Excentricidad.
  - Lindero: Lindero: volteo, Lindero: deslizamiento, Lindero: perpendiculares o sin despegue.
  - Detallado: Ancho mínimo, Desplante mínimo.

### Varios ejes (corrida, contratrabe y liga)
Si el diseño se aplicó a más ejes desde RAM, aparece el bloque **Ejes (n)** [cim-ejes]:
- "1 · el del diseño · nudos …" y luego cada eje [cim-eje-2…] con su ✕ para quitarlo.
- Cada revisión informa el peor eje y lo agrega a su nota.
- La memoria empieza con "En sus n ejes", el resumen termina en "· en n ejes" y las cantidades suman todos.

---

## 3. La contratrabe de liga de cada zapata (bloque CT) [cim-ct]

**Cuándo sale:** en toda zapata aislada y en la corrida con muro de mampostería. No sale en la corrida con muro de concreto.

**Encabezado:** "Contratrabe de liga · CT-1 15 × 30 · 4#4 · E#2.5 @ 15".

**Campos:**
- **Nombre** [cim-ct-nombre].
- **Ancho b** [cim-ct-b], cm, mínimo 15.
- **Peralte h** [cim-ct-h], cm, mínimo 30.
- Sólo en la aislada:
  - **Claro libre a la vecina** [cim-ct-Ln], m, 4.00 por omisión. Desde RAM se calcula a la columna vecina más cercana.
  - **Muro sobre la CT**, t/m de servicio.
- **Recubrimiento arriba y lados** (3 cm) y **Recubrimiento abajo** (5 cm).
- **Varillas:** Arriba [cim-ct-sup] y Abajo [cim-ct-inf], en piezas (2#4 cada una), y Estribos cerrados [cim-ct-est] (#2.5, 2 ramas, @ 15).

**Volver a la CT-1:** si la CT ya no es la CT-1, aparece **volver a la CT-1** [cim-ct-1]. Conserva el Ln y el muro.

**Cuándo ⚡ Proponer crea la CT-2:** primero prueba la CT-1 con las solicitaciones de la zapata.
- Si pasa, deja la CT-1.
- Si no pasa, diseña la más chica que pasa y la llama **CT-2**, a menos que ya le hayas puesto otro nombre distinto de CT-1.
- En la aislada, lo típico es que la de lindero o de esquina con liga cargue el N·e (Pu × excentricidad); también pesan un Ln largo o un muro encima.
- En la corrida, prueba anchos de 15 a 40 cm (siempre ≥ t) con 4 a 6 varillas.

**Revisiones** (grupo "Contratrabe de liga CT-x"):
- En la aislada: las de la liga, con id `ct-…`: Liga arriba (M−), Liga abajo (M+), Tensión de liga, Compresión de liga, Cortante, Sección mínima.
- En la corrida: Ancho de la CT, Refuerzo longitudinal, Estribos, Sección mínima (CT-1).

**Avisos:**
- "La contratrabe de liga CT-1 no alcanza con el N·e de la zapata (… t·m): ⚡ Proponer la diseña…"
- "…no cumple como dala de desplante del muro: ⚡ Proponer la diseña."

En el dibujo, el detalle de la CT tiene manijas `ct-h` y `ct-b`, y sus etiquetas de varilla (`ct-sup`, `ct-inf`, `ct-est`) se pueden cliquear.

---

## 4. Suelo y criterios de la obra [cim-obra]

Es un modal titulado "Suelo y criterios de la obra", con el botón **cerrar ✕**. **Un clic fuera del modal también lo cierra.** Todo se guarda con el proyecto.

**Suelo (estudio de mecánica de suelos)**, campos [obra-{k}], de fábrica:

| Campo | Fábrica |
|---|---|
| qadm | 15 t/m² |
| γ suelo / relleno | 1.6 t/m³ |
| Desplante Df | 1.0 m (mínimo DfMin) |
| φ relleno | 28° |
| φ suelo de apoyo | 28° |
| c suelo de apoyo | 0 t/m² |
| γ suelo de apoyo | vacío, "igual que γ" |
| μ base-suelo | 0.45 |

**Capacidad de carga (Meyerhof)** [obra-meyerhof]: arranca plegado; ábrelo con un clic en su encabezado.
- Campos: c, φ, γ, Df, B, L, Inclinación β, Excentricidad e, FS.
- Arranca con c y φ del suelo de apoyo, γ y Df de la obra, B = L = 1.5, β = 0, e = 0 y FS = 3.
- Muestra la tabla de pasos y el botón **Usar qadm = X t/m² en la obra** [obra-usar-qadm], que redondea a centésimas.
- Los valores de la calculadora no se guardan; sólo el qadm que pasas.

**Criterios de diseño**, campos [obra-{k}]:

| Campo | Fábrica |
|---|---|
| Factor CM | 1.3 |
| Factor CV | 1.5 |
| Factor accidental | 1.1 |
| qadm con sismo × | 1.33 |
| Factor del empuje | 1.5 |
| FS volteo | 2.0 |
| FS deslizamiento | 1.5 |
| Peralte mínimo | 15 cm |
| Ancho mínimo | 0.60 m |
| Desplante mínimo | 0.60 m |
| Separación mínima | 10 cm |
| Separación máxima | 30 cm |
| Plantilla | 5 cm |

Además del cuadro:
- ☑ "Contratrabes de liga con lado ≥ claro libre / 20 (ACI 18.13.3.3, alta sismicidad)…" [obra-ligaAci], apagado por omisión.
- **Calibres que se prueban al proponer**: botones #3, #4, #5, #6 y #8. De fábrica están encendidos #4, #5, #6 y #8, y al menos uno queda encendido siempre.
- **valores de fábrica**: regresa los criterios que cambiaste.

**Mínimos de 0.60 m:**
- Los campos B y Df no aceptan menos de Ancho mínimo y Desplante mínimo.
- ⚡ Proponer no baja de ahí.
- Si los criterios cambian, las revisiones Ancho mínimo y Desplante mínimo (grupo Detallado) lo marcan.

---

## 5. El dibujo y el campo dual

### Manijas
Las manijas son naranjas [cim-manija-{id}]. Al pasar el cursor, cada una muestra su valor, por ejemplo "B = 1.35 m" o "h = 30 cm". Se mueven a cada 5 cm (o a cada 1 cm en el muro t) y mientras arrastras la escala se congela.

| Tipo | Manijas |
|---|---|
| Aislada | B, L (si no es cuadrada), h, col (un punto), ct-h, ct-b |
| Corrida | B, h, t (muro), ct-h, ct-b |
| Contratrabe | c0…cn (cada columna a lo largo del eje), L, B, H, h, bw |
| Liga | h, b |
| Contención | punta, talon, H, hz, tb, tc, hk |
| Muro de piedra | B, c, H, m1 (el frente) |
| Mampostería | B, H, c |

### Arrastrar la columna (aislada)
- Se pega al centro (céntrica), a una orilla (de lindero) o a dos orillas (de esquina).
- Si la dejas en medio, queda "Corrida a mano (arrastrada)", que en los datos es `px/py = 'libre'`.
- Sin trabe de liga sale el aviso "Columna corrida sin trabe de liga…".

### Clic en una etiqueta de varilla
La etiqueta, por ejemplo "#4 @ 20" [cim-varilla-{id}], abre el selector [cim-pop]:
- Calibres #2.5 a #8 [cim-pop-num-{n}].
- **@** 10 a 30 cada 2.5 [cim-pop-s-{s}], o **piezas** 2 a 6 en los lechos de contratrabe, liga y CT.
- **ramas** 2 a 4 en los estribos y ☑ con bastones en `bast`.
- **listo** cierra.

En los muros de piedra y en el cimiento de mampostería no hay varillas que editar.

### Deshacer
**Ctrl+Z** (o Cmd+Z) funciona sólo si la pestaña está a la vista y el foco **no** está en un input, select o textarea. Equivale a ↶ deshacer. Un arrastre completo cuenta como un solo paso, y también se pueden deshacer los borrados y las creaciones desde RAM.

### Campo dual separación ↔ cantidad (parrillas y franjas)
- En cada parrilla hay: # [{testid}-num], **@ cm** con ▲▼ [{testid}-s, -s-mas, -s-menos] y **pzas** (o **/m** en franjas por metro) con ▲▼ [{testid}-cant].
- El campo que programaste se ve normal; el otro sale atenuado con lo que resulta.
- Si escribes en **@ cm**, el modo pasa a separación.
- Si escribes en **pzas**, el modo pasa a cantidad (`modo: 'n'`) y la separación se recalcula. Esa cantidad se queda aunque cambies B o L.
- Los lechos de contratrabe, liga y CT se capturan en **pzas** (de 2 a 12) y los estribos en ramas y @.

---

## 6. Ventana ⚡ Desde RAM [cim-ram]

**Encabezado.** Dice "Cimientos desde las reacciones de RAM", el archivo, el número de apoyos y la antigüedad. Botones: **abrir modelo.json…** y **cerrar ✕**.
- La ventana toma sola el último modelo sincronizado. Si no hay, pide "Sincroniza el modelo desde Reportes de RAM → ⚡ Desde RAM".
- Un clic en el fondo la cierra.

**Columna izquierda: Papel de cada caso.**
- Hay un select por caso [cim-papel-{caso}] con las opciones muerta (CM), viva (CV), sismo (S) y no usar.
- El papel sale del nombre del caso: sismo para SISM/SX/EX…; viento queda en no usar; muerta para DEAD/CM/PP/SD…; viva para LIVE/CV/L, salvo la viva media o instantánea, que queda en no usar.
- Lo que elijas se recuerda en el navegador (`auxiv.cim.ram.papeles`).
- Si sale [cim-ram-sincasos], el modelo sólo trae combinaciones: hay que volver a generar sincronizar.py.

**Centro: la planta** [cim-ram-planta].
- Pestañas **Cimentación** [cim-ram-vista-cim] y **Cargas** [cim-ram-vista-cargas]. Si ya hay cimientos, arranca en Cimentación.
- Elige apoyos con clic en el apoyo [cim-apoyo-{nudo}], con Mayús/Ctrl+clic para sumar, o arrastrando una ventana. También están **todos** [cim-ram-todos] y **ninguno**.
- En la vista Cargas, el radio del círculo es la carga CM + CV y en rojo sale "lindero" o "esquina".
- En la vista Cimentación:
  - Los cimientos van a escala [cim-plan-{nombre}-{nudo}]; las franjas son [cim-plan-{nombre}] o [cim-plan-{nombre}-e{n}].
  - Cada apoyo trae su % [cim-u-{nudo}]. Si el apoyo no tiene cimiento, el círculo sale punteado y dice "sin cimiento".
  - Un clic en un cimiento lo abre y cierra la ventana.
- Cada lado de la planta [cim-lado-x-min|x-max|y-min|y-max] dice "lindero?". Al cliquearlo queda marcado como **LINDERO** en rojo.

**Derecha.**
- **Planta de cimentación** [cim-ram-resumen]: "N de M apoyos con cimiento" y **elegir los N que faltan** [cim-ram-faltan].
- Avisos posibles: [cim-ram-invade] "Pasan del lindero: … Bórralas y créalas otra vez con el lindero marcado." y [cim-ram-dobles] "Nudo … en dos cimientos: borra el que sobre."
- Lista de cimientos [cim-ram-cim-{nombre}], del peor al mejor.
- **Linderos**: un botón por lado con su coordenada en los ejes del modelo, por ejemplo "X = 0.00" o "Z = 9.00" [cim-lindero-{lado}].
- **Zapatas aisladas**:
  - Select **tipos de zapata** [cim-ram-tipos] con 1, 2, 3, 4, 5, 6 u 8 (3 por omisión).
  - Tabla [cim-ram-grupos] con tipo (y su condición: céntrica, lindero o esquina), apoyos y lado pedido.
  - **Crear N tipo(s) de zapata** [cim-ram-aisladas] y **Una zapata para todos (envolvente)** [cim-ram-una]. Piden 1 apoyo o más.
- **Sobre un eje**, todos piden 2 apoyos o más:
  - **Zapata corrida (muro sobre estos apoyos)** [cim-ram-corrida].
  - **Corrida con contratrabe (columnas del eje)** [cim-ram-contratrabe].
  - **Contratrabe de liga (une las zapatas)** [cim-ram-liga].
  - Si ya hay una corrida, contratrabe o liga, sale "o el mismo diseño de" con el select [cim-ram-destino] ("elige…") y **＋ en este eje** [cim-ram-aplicar]. Ese botón agrega los apoyos elegidos como otro eje y vuelve a proponer. Si esos nudos ya están en el diseño, avisa "… ya está en esos apoyos".

**Después de crear.** El aviso dice "Zapatas aisladas: Z-1, Z-2 desde las reacciones de RAM, ya dimensionados y armados". Si había apoyos con cimiento, agrega "· ojo: N apoyo(s) ya tenían cimiento". La selección se limpia y la vista pasa a Cimentación.

---

## 7. Salidas

Si hay una carpeta de proyecto activa, las salidas se guardan ahí; si no, se descargan. El aviso dice dónde quedaron.

**📄 Memoria PDF** (uno, o **todos**):
- Va en `2 Salidas\Memoria\cimentacion-{proyecto}-{nombre|todos}-memoria-AAAA-MM-DD.pdf`.
- Es tamaño carta y trae: el criterio, la tabla del suelo de la obra y, si hay más de un cimiento, el **Resumen** (Cimiento / Tipo / Solución / Estado CUMPLE o NO CUMPLE).
- Luego, una página por cimiento con su veredicto, avisos, dibujo, tabla de **Revisiones** (Revisión / Actuante / Resistente / límite / Aprov.) y cada sección paso a paso.
- Aviso al terminar: "Memoria de Z-1 (n págs.) …".

**DXF** / **DXF todos**:
- Van en `2 Salidas\Planos\cimentacion-{proyecto}-{nombre|todos}.dxf`.
- Salen a escala real × el factor DXF del proyecto, con los cimientos apilados y su título y resumen.
- Las capas se asignan por color: **CONCRETO**, **ACERO_INFERIOR**, **ACERO_SUPERIOR**, **ESTRIBOS** y **COTAS**, las mismas de las trabes.

**SVG**: sólo el seleccionado, en `2 Salidas\Planos\…svg`.

**Memoria Word**:
- Ruta: barra superior **Verificar → Memoria de cálculo**. En el diálogo, **Generar Word (.docx)** [mem-word] o **Vista PDF**. El diálogo cuenta "· N cimiento(s)".
- El capítulo **Diseño de cimentación** trae el párrafo de criterio, la tabla Cimiento / Tipo / Solución / Estado (VERIFICADO o NO PASA) y, por cimiento, su dibujo, revisiones y pasos.
- Sin cimientos sale "Sin cimientos capturados."
- Se usan el suelo y los criterios de la obra vigentes.

---

## 8. Flujos típicos

### A. Zapata aislada a mano
1. Abre 🪨 Suelo y criterios. Captura qadm, γ y Df (o usa Meyerhof → Usar qadm) y cierra.
2. + Nuevo ▾ → Zapata aislada. Se crea Z-n.
3. En Cargas en la columna (servicio) captura P, Mx, My, Vx y Vy por CM, CV y S.
4. Ajusta c1 y c2 y la Posición de la columna. Si es de lindero o de esquina, decide ☑ con trabe de liga.
5. Pulsa ⚡ Proponer y lee el aviso.
6. Revisa el panel derecho. Si la CT pasó a CT-2, revisa su bloque; ajusta el Claro libre a la vecina si lo conoces y vuelve a proponer.
7. Afina en el dibujo o en el formulario: las revisiones se recalculan solas.
8. Saca la 📄 Memoria PDF o el DXF.

### B. Desde RAM: aisladas por tipos
1. Sincroniza en Reportes de RAM y luego entra a Cimentaciones → ⚡ Desde RAM.
2. Revisa el papel de cada caso.
3. **Antes de crear**, marca los linderos.
4. Elige los apoyos (todos, o una ventana sobre las columnas aisladas).
5. Escoge cuántos tipos de zapata quieres y revisa la tabla: cada condición se agrupa aparte.
6. Pulsa Crear N tipo(s) de zapata.
7. En la vista Cimentación revisa los %. Si hay rojo, abre el cimiento, sube B o pulsa ⚡ Proponer. Recuerda que también se revisa con cada uno de sus apoyos.

### C. Corrida o contratrabe en un eje
1. Elige los apoyos de **una fila** (2 o más).
2. Pulsa Zapata corrida (muro sobre estos apoyos) o Corrida con contratrabe (columnas del eje).
   - Terminan a 0.5 m de la última columna, o al ras si ese extremo cae en un lindero marcado.
3. Para repetir el diseño en otro eje: elige los apoyos del otro eje, escoge el diseño en "o el mismo diseño de" y pulsa ＋ en este eje.

### D. Contratrabe de liga (TL)
1. **Crea primero las aisladas** del eje. La liga busca la zapata de cada nudo para tomar su N·e; si la creas antes, el N·e queda en 0.
2. Elige los apoyos del eje y pulsa Contratrabe de liga (une las zapatas).
3. El origen dice "… N zapata(s) excéntrica(s) se ligan aquí". La TL no cuenta como cimiento de sus apoyos.

### E. Linderos
1. Marca los lados con clic en "lindero?" o con los botones X = … / Z = ….
2. Crea las zapatas. Las que caen en un lindero salen de lindero; en dos linderos, de esquina, con trabe de liga.
3. Si marcaste el lindero **después** de crear: las que pasan del lindero salen en rojo punteado y con el aviso "Pasan del lindero". Bórralas (✕ en el formulario) y créalas otra vez.
4. Si la estructura no tiene liga, quita ☑ con trabe de liga y vuelve a proponer.

---

## 9. Avisos comunes y qué hacer

| Aviso (texto en la app) | Qué hacer |
|---|---|
| "Con … la zapata se levanta (N + W = …)" / "la resultante cae fuera de la base" | Agranda la base o activa con trabe de liga. Revisa el signo del sismo. |
| "El suelo pide una zapata de más de … m … conviene losa de cimentación, pilas o mejorar el suelo" | Revisa qadm. ⚡ Proponer ya llegó a su límite. |
| "Columna corrida sin trabe de liga: la excentricidad la toma sólo el suelo." | Activa la liga o regresa la columna a una posición fija. |
| "Parrilla apretada (menos de 10 cm): sube el # o el peralte." | Cambia el # en el selector o sube h. |
| "La columna excede el aplastamiento… ancla … cm² de sus varillas" / "no pasa ni con 4 % de arranques" | Lo primero es informativo. Lo segundo: agranda la columna o sube f′c. |
| "La contratrabe de liga CT-1 no alcanza…" | Pulsa ⚡ Proponer, que deja la CT-2. Si ni así, considera zapata combinada. |
| "N columna(s) quedan fuera de la zapata: revisa sus x o el largo L." (ZT) | Corrige las x o L, o arrastra las manijas cN. |
| "La resultante está a … m del centro: «Centrar la resultante» ajusta los voladizos." | Pulsa centrar resultante. |
| "Lindero: la excentricidad la toman la dala y los muros perpendiculares; confírmalo en planta." | Es informativo. Confirma la estructuración. |
| "Con qadm = … ningún ancho de mampostería cumple…" | Cambia a Zapata corrida bajo muro. |
| "La presión máxima pasa de qadm…" (muro de piedra) | ⚡ Proponer prueba ensanchar e inclinar el frente. Si no basta, usa un muro de concreto. |
| "No se pudo revisar: …" | Algún dato es inválido (vacío o negativo). Corrígelo o pulsa Ctrl+Z. |
| RAM: "El modelo no trae reacciones de apoyos" / [cim-ram-sincasos] | Genera de nuevo sincronizar.py, córrelo y sincroniza. |
| RAM: "Nudo … en dos cimientos" | Borra el cimiento sobrante desde su formulario. |
| Toast "… ojo: N apoyo(s) ya tenían cimiento" | Revisa si hay duplicados (anillo rojo) en la planta. |

Cuidados finales:
- Los % de la planta se calculan con el modelo cargado hoy: al resincronizar, vuelve a revisar y propón otra vez lo que quede en rojo.
- Duplicar (⧉) quita el origen RAM de la copia.

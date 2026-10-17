# Práctica con los archivos de ejemplo

Ejercicios para aprender la app de punta a punta sin tocar una obra real, con los resultados que da la versión 3.06. Si tu resultado es distinto, primero revisa que hiciste el paso como dice. Si estás seguro, puede ser una versión más nueva de la app: dilo y sigue.

**Archivos** (en `ejemplos/`):
- `modelo.json`: el «Edificio de ejemplo» analizado en RAM. Tiene 3 niveles de 3 m (y = 3, 6, 9; el eje vertical es Y) y una rejilla con claros de 4.0, 6.5 y 4.5 m en X y de 5.5 y 3.5 m en Z. Trae 7 grupos ya agrupados (T1–T5, C1, C2), 240 miembros, 201 nudos, 12 apoyos empotrados, 6 casos (CM, CV, SX, SXN, SZ, SZN) y 5 combinaciones de diseño (CD, CSX, CSXN, CSZ, CSZN).
- `proyecto.json`: el mismo edificio ya trabajado en la app, con 5 trabes, 2 columnas y la cimentación (Z-1, Z-2, Z-3 y la liga TL-1). Sirve para revisar y entregar sin repetir los pasos.

Empieza con la app vacía: si hay algo, usa el ícono **Proyecto nuevo** (lo actual se va a Recientes).

---

## Ejercicio 1 · Cargar el modelo y crear las secciones

1. Escribe «Edificio de ejemplo» en el campo **Proyecto**.
2. **📥 Reportes de RAM** → pestaña **⚡ Desde RAM**. Sin carpeta de obra, carga el archivo por el input del Centro de carga (`centro-files`) o arrastra `modelo.json` sobre el panel.
3. **Esperado:** `modelo.json: 7 grupo(s) · 240 miembros · 201 nudos · CD / CSX / CSXN / CSZ / CSZN · 12 apoyos · picos exactos de la API de RAM · aplicado a 0 chip(s) · 7 grupo(s) sin sección en el proyecto`, y el aviso azul con T-4, T-5, T-1, C-1, T-3, T-2 y C-2.
4. Clic en **crear las 7 secciones con su armado**.
5. **Esperado:** «Creadas 7 sección(es) desde el modelo con su armado propuesto: 7 pasan», y la tabla Armado propuesto:

| Sección | b×h | Armado propuesto |
|---|---|---|
| T-4 | 15×40 | inf 3#4 + 2#4 puntual · sup 3#4 + 3#4 puntual · E#2.5 @18/18 |
| T-5 | 15×35 | inf 2#3 + 2#3 puntual · sup 2#4 + 2#4 puntual · E#2.5 @16/16 |
| T-1 | 20×45 | inf 3#4 + 2#4 puntual · sup 3#5 + 2#5 puntual · E#2.5 @21/21 |
| T-3 | 15×45 | inf 3#4 + 2#4 puntual · sup 3#4 + 3#4 puntual · E#2.5 @21/21 |
| T-2 | 20×40 | inf 2#4 + 2#4 puntual · sup 3#5 + 2#5 puntual · E#2.5 @18/18 |
| C-1 | 30×30 | 8#5 (ρ 1.76 %) · E#2.5 @ 7 cm en extremos (60 cm) · @ 15 cm al centro |
| C-2 | 25×25 | 4#6 (ρ 1.82 %) · E#2.5 @ 6 cm en extremos (60 cm) · @ 12 cm al centro |

**Comprueba que entiendes:** ¿por qué T-4 lleva bastones puntuales y no corridos? (Porque el momento sólo los pide en ciertas zonas; los resuelve Longitudinal y no van en el corte.) ¿De dónde salen las medidas? (De `secciones` del `modelo.json`, la tabla de RAM.)

## Ejercicio 2 · Revisar una trabe

1. Clic en el chip **T-2** → pestaña **Secciones**. Lee el corte: 3#5 arriba, 2#4 abajo, estribo E#2.5.
2. Pestaña **Calculo** → Flexión y Cortante. Busca en el panel **Envolvente del modelo** cuántos miembros pasan y cuál es el crítico.
3. **Módulos → Longitudinal** con T-2. **Esperado:** «2 elementos: 0 cubiertos con el diseño · 2 piden bastón puntual», y acero de 202 kg (160 de corridas + 42 de bastones). El elemento de 15 m (miembros 117…128) lleva «+2 abajo / 2 arriba puntual».
4. Explica con tus palabras qué es la curva gruesa de la gráfica de momento (la envolvente de resistencia con los bastones desarrollándose a lo largo de Ld).

## Ejercicio 3 · Columnas

1. Pestaña **Columnas** → C-1. Revisa el diagrama de interacción en X y en Y y la tabla de la envolvente.
2. Encuentra el punto que rige (combinación y extremo) y su aprovechamiento.
3. Di qué **no** revisa esta pestaña (esbeltez y cortante).

## Ejercicio 4 · Agrupación

1. **Módulos → Agrupación** → **Trabes**. El modelo se toma solo.
2. **Esperado** (con los anchos y peraltes de fábrica): «21 trabes continuas · hoy 5 grupos, 15.87 m³» y tres propuestas:

| Propuesta | Grupos | Concreto | Acero |
|---|---|---|---|
| Pocos grupos | 2 | 19.39 m³ (+22 % vs hoy) | 1 753 kg |
| Equilibrada | 3 | 16.52 m³ (+4 % vs hoy) | 1 680 kg |
| Ajustada | 5 | 15.61 m³ (−2 % vs hoy) | 1 688 kg |

3. Mira la escala de aprovechamiento: ¿qué grupo tiene el rango más abierto? Pasa la Equilibrada a mano (**✎ a mano**) y mueve una trabe a otro grupo; luego **↶ deshacer**.
4. Cambia a **Columnas** y compara «por entrepiso» contra «misma sección en toda la altura».
5. **No apliques nada en RAM:** es un modelo de práctica. Sí puedes bajar `aplicar_agrupacion.py` para ver lo que hace (lee su encabezado).

## Ejercicio 5 · Deflexiones

1. **Módulos → Deflexiones**. Revisa que diga `CS = 1·CM + 1·CV`.
2. **Esperado:** 51 tramos y 3 no pasan: T-5 (peor 121 %), T-2 (111 %) y T-1 (103 %); T-4 llega a 73 % y T-3 a 57 %. El peor tramo es de T-5 (miembros 173…184, 2/3): total 2.87 de 3.21 cm (90 %), pero después de los muros 2.01 de 1.65 cm (121 %).
3. Abre ese tramo y explica cada número: elástica de RAM, Ig/Ie, inmediata, diferida, total contra L/240 + 0.5 y contra L/480 + 0.3.
4. Apaga «revisar también L/480 + 0.3 cm» y di qué cambia. Vuelve a encenderlo.

## Ejercicio 6 · Cimentación desde RAM

1. Pestaña **Cimentaciones** → **⚡ Desde RAM**. **Esperado:** 12 apoyos con su carga de servicio CM + CV; los más cargados son el 29 (57.3 t) y el 17 (54.9 t), y el menos cargado el 9 (9.3 t).
2. Revisa el papel de cada caso: CM muerta, CV viva y los cuatro sismos.
3. **todos** → tipos de zapata **3** → **Crear tipo(s) de zapata**. **Esperado:** Z-1 aislada con 4 apoyos (92 %), Z-3 con 7 apoyos (87 %) y Z-2 con 1 apoyo (85 %). Los 12 apoyos quedan con cimiento.
4. Contratrabe de liga en el eje central: **ninguno**, clic en el apoyo 5 y Mayús+clic en 17, 29 y 41 → **Contratrabe de liga**. **Esperado:** TL-1 cumple al 52 %: 15 × 30, 2#4 arriba y 2#4 abajo, E#2.5 @ 15, tensión de liga T = 7.69 t.
5. Abre Z-1: lee las revisiones (suelo, penetración, cortante, flexión, anclaje, aplastamiento y la CT) y la memoria paso a paso.
6. Prueba los linderos en un proyecto aparte: marca X = 0 antes de crear y fíjate en cómo salen las zapatas de lindero y la de esquina.

## Ejercicio 7 · Una zapata a mano

1. **+ Nuevo** → Zapata aislada. Captura CM P = 40 t, CV P = 10 t, sin momentos.
2. **⚡ Proponer**. Anota B, h y la parrilla.
3. Cambia la qadm de la obra (🪨 Suelo y criterios) de 15 a 10 t/m² y vuelve a proponer. ¿Qué cambió y por qué?
4. Regresa la qadm a como estaba. **Regla:** en una obra real nunca cambies la qadm sin el estudio de mecánica de suelos.

## Ejercicio 8 · Bajada de cargas

1. **Módulos → Pesos Unitarios** → Losas → **Desde plantilla**: elige una losa de vigueta y bovedilla de entrepiso.
2. Lee su CM y la CV según el destino. Quita una capa y mira cómo cambia.
3. En **Tableros · RAM**, arma un tablero de 4.0 × 5.5 m y lee WLC y WLL.
4. Abre Verificar → Memoria de cálculo y fíjate en qué campos se llenaron desde Pesos Unitarios (el «↳» lo dice).

## Ejercicio 9 · Entregar

1. Verificar → **Resumido**: lee el PDF y enlista lo que no cumple.
2. Verificar → **Exportar a Double Check** → Módulos → **Double Check** → Abrir .dcheck. Fíjate en qué viene prellenado y qué falta (las capturas).
3. Verificar → **Memoria de cálculo**: revisa los datos prellenados y genera el Word.
4. Escala 1:1 → **Exportar DXF**. Longitudinal → **⬇ DXF alzados · todas**. Cimentaciones → **DXF todos** y **Memoria PDF** con todos.
5. **Guardar.** Sin carpeta de obra, se descarga `secciones-Edificio-de-ejemplo.json`.

## Ejercicio 10 · Abrir el proyecto de ejemplo y diagnosticar

1. Abre `ejemplos/proyecto.json` con el ícono de carpeta.
2. **Esperado:** «Proyecto abierto · 5 trabe(s), 2 columna(s), 4 cimiento(s)».
3. Sin que nadie te diga qué buscar, escribe un reporte corto para el ingeniero: qué cumple, qué no, qué tiene aviso y qué falta revisar (por ejemplo, las flechas de T-5, T-2 y T-1, que necesitan el `modelo.json` cargado para verse en Deflexiones).

---

## Autoevaluación

Al terminar tienes que poder contestar sin dudar:
- ¿Qué botón crea una **trabe** nueva y cuál un **proyecto** nuevo?
- ¿Qué pasa si en RAM se cambia la descripción de un miembro de T3 a T5?
- ¿Por qué no se pegan los scripts en la consola de RAM?
- ¿Qué diferencia hay entre un bastón corrido y uno puntual, y en qué pestaña se resuelve cada uno?
- ¿Qué significa el aviso «invertida» y qué haces con él?
- ¿Por qué la agrupación se repite una o dos veces?
- ¿Qué cargas usa el suelo y cuáles el concreto en una zapata?
- ¿Qué es la CT-1 y cuándo aparece una CT-2?
- ¿Qué cosas no revisa la app y le tienes que avisar al ingeniero?
- ¿Dónde queda cada salida cuando la carpeta de la obra está conectada?

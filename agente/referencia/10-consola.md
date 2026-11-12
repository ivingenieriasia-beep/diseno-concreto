# Auxiliar IV: la consola de la app

La consola sirve para operar la app con **comandos** en lugar de clics. La usa el agente desde el navegador (con la API `window.auxiliarIV`) y la puede usar cualquiera desde la pantalla. Los botones siguen funcionando igual: la consola llama a los mismos motores y a los mismos stores, así que el resultado es el mismo que con los clics.

No hay que confundirla con la **consola de Python de RAM**, donde se abren `sincronizar.py` y los demás scripts. Esta consola es de la app y no toca RAM.

---

## 1. Dónde está

- **Botón:** el último de la barra superior, a la derecha de `Exportar DXF`. Es un cuadro oscuro redondeado con `>_` en blanco (`data-testid="consola-btn"`, title «Consola de comandos (Ctrl+`)»). Un punto ámbar quiere decir que el agente mandó comandos con la consola cerrada.
- **Teclado:** `Ctrl`+`` ` `` la abre y la cierra. `Esc` la cierra cuando el cursor está en la línea.
- **El panel** (`data-testid="consola"`) va abajo, dentro de la página: no tapa nada, sólo achica el área de trabajo. Tiene:
  - el **registro** (`consola-registro`): cada comando con la hora, quién lo mandó (`agente` si llegó por la API, `consola` si se escribió), la línea, el tiempo que tardó y el resultado; en rojo y con ✗ si falló;
  - la **línea** (`consola-linea`, prompt `>_`): Enter ejecuta, ↑ y ↓ recorren lo escrito y Tab completa el nombre del comando;
  - **abrir sola con el agente** (`consola-autoabrir`, marcada por omisión): la consola se abre sola cuando llega un comando por la API, para que el ingeniero vea en vivo lo que hace el agente;
  - `ayuda`, `limpiar` (borra el registro, no el proyecto), el botón de altura y `×`.
- **La pantalla se actualiza sola:** después de un comando, la app va a la pestaña donde se ve el resultado (Calculo, Columnas, Longitudinal, Deflexiones, Agrupación…) y selecciona el chip. Con `--quieto` no cambia de pestaña.

## 2. La API para el agente

La app expone `window.auxiliarIV` en cuanto carga:

| Llamada | Devuelve |
|---|---|
| `await auxiliarIV.cmd('calculo T-1')` | Texto corto. Si falla, empieza con `✗ `. |
| `await auxiliarIV.cmd('grupos --json')` | El mismo resultado en JSON (texto). |
| `await auxiliarIV.json('resultados')` | `{ ok, texto, datos }`, con `datos` como objeto. |
| `await auxiliarIV.cmd('ram cargar', { texto, nombre })` | Aplica un `modelo.json` pasado aparte (su texto). |
| `await auxiliarIV.cmd('calculo T-1', { ver: false })` | Igual que `--quieto`: no cambia de pestaña. |
| `auxiliarIV.comandos()` | La lista de usos. |
| `auxiliarIV.registro(20)` | Las últimas entradas del registro. |
| `auxiliarIV.abrir()` / `auxiliarIV.cerrar()` | Abre o cierra el panel. |

Todo lo que entra por la API queda en el registro de la consola.

**Mientras esté la pantalla de entrada** («Uso exclusivo de IV Ingenierías»), la API contesta `✗ La app está en la pantalla de entrada: un ingeniero tiene que escribir el usuario y la contraseña.` El usuario y la contraseña los escribe un ingeniero; nunca van en un script ni en un mensaje.

Ejemplo con Playwright (Node), con la app ya abierta y la sesión iniciada por un ingeniero:

```js
const r = await page.evaluate(() => window.auxiliarIV.cmd('resultados'))
console.log(r)
```

Para gastar pocos tokens: pide texto (`cmd`) para leer y JSON (`--json` o `json()`) sólo cuando un script tenga que procesar el resultado. Un comando de resumen (`resultados`, `deflexiones`, `agrupar`) dice más que muchas capturas de pantalla.

## 3. Comandos

Los chips se escriben como en la barra: `T-1`, `t1` y `T 1` son el mismo. Las unidades son las de la app: t, t·m, cm y m.

| Comando | Qué hace | Es lo mismo que |
|---|---|---|
| `ayuda [comando]` | La lista de comandos, o el uso de uno. | — |
| `estado` | Versión, proyecto, cuántos chips, el modelo sincronizado (archivo, grupos, miembros, hace cuánto), la carpeta y la pestaña. | Leer la barra y el Centro de carga. |
| `proyecto` | El nombre del proyecto y cuántas trabes y columnas tiene. | Leer la barra. |
| `proyecto nuevo [nombre]` | Lo que hay pasa a **Recientes** y queda un proyecto vacío con ese nombre. Contesta `Proyecto nuevo «…» · 0 trabes, 0 columnas`. No pregunta (el comando ya es la orden), pero si el navegador no deja guardar lo actual en Recientes, no hace nada y lo dice. | El botón «Proyecto nuevo (lo actual queda en Recientes)». |
| `proyecto renombrar <nombre>` | Desde la 3.09. Cambia **solo el nombre** del proyecto abierto: no toca trabes, columnas, cargas ni la carpeta, y no pasa nada a Recientes. Las descargas (`secciones-<nombre>…`) salen con el nombre nuevo. Contesta `Proyecto «viejo» → «nuevo»`. Sin nombre, contesta el uso. |
| `proyecto abrir <url>` | Abre un `proyecto.json` de **este mismo servidor** (por ejemplo `../agente/ejemplos/proyecto.json`). Lo que había queda antes en Recientes. Desde un script también se le pasa el texto: `cmd('proyecto abrir', { texto })`. | El botón Abrir. |
| `ram sync` | Lee el `modelo.json` de la carpeta de la obra recordada y lo aplica. Si el modelo cambió y hay permiso de edición, el anterior va a `3 Respaldos`. | 📥 Reportes de RAM → 🔄 Sincronizar con RAM. |
| `ram cargar <url>` | Aplica un `modelo.json` de **este mismo servidor** (por ejemplo `../agente/ejemplos/modelo.json`). Desde un script también se le pasa el texto: `cmd('ram cargar', { texto })`. | El input de archivos del Centro de carga. |
| `ram faltan` | Los grupos del modelo que todavía no tienen sección. | El aviso azul del Centro de carga. |
| `ram crear` | Crea esas secciones con su **armado propuesto** y dice cuáles pasan. | «crear las N secciones con su armado». |
| `grupos [trabes\|columnas]` | Cada chip con su sección, f'c, armado, número de miembros y si el armado es propuesto. | Leer los chips. |
| `miembros <chip>` | Los miembros de RAM del chip, con su longitud. | La envolvente del chip. |
| `sel <chip>` | Selecciona el chip y lo muestra. | Clic en el chip. |
| `fijar <chip> …` | Fija la sección y el armado (ver §4). Queda como **propuesto**. Contesta con la revisión al día. | Editar Secciones o Columnas. |
| `calculo <chip>` | Trabe: MR+, MR−, Vr, Mu+, Mu−, Vu, el D/C y el miembro crítico, cuántos miembros pasan, As mín, As máx y b mín. | Calculo → Flexión, Cortante y Envolvente del modelo. |
| `columnas [chip]` | Columna: armado, estribos, D/C de la NTC-Concreto 2023 (el del método general desde la 3.08; el de 5.4.1.2 como referencia), FR y clase del punto, el punto crítico (miembro, combinación y extremo) con Pu, Mux y Muy, y cuántos puntos pasan. Sin chip, todas. Campos del JSON en §«columnas: los campos NTC». | La pestaña Columnas. |
| `longitudinal [chip]` | Unidades con corridas, con bastón, insuficientes, por cortante y al filo; kg de acero (y el uniforme); bastones puntuales; las unidades que fallan. Sin chip, todas. | Módulos → Longitudinal. |
| `deflexiones [grupo] [--todos]` | La fórmula de servicio, cuántos tramos, cuántos no pasan y sin armado, y los tramos que no pasan (o todos), con total y posterior contra su límite. | Módulos → Deflexiones (con los papeles de caso y las opciones guardadas ahí). |
| `bd` | Cuántas trabes tiene la BD Global. | La pestaña BD Global. |
| `bd <Mu+> <Mu−> [b=15,20] [h=30,35] [n=5]` | Las secciones de la BD que cubren esos momentos, de menos acero a más, numeradas. | BD Global → buscar por momentos. |
| `bd usar <n> <chip>` | Aplica el resultado n de la última búsqueda al chip (como **propuesto**). | El botón de usar de BD Global. |
| `agrupar [trabes\|columnas] [grupos=T1,T2] [anchos=15,20,25] [peraltes=…] [--verificar]` | Las tres propuestas (Pocos grupos, Equilibrada, Ajustada) con sus grupos, sección, miembros, aprovechamiento y m³ contra hoy. Con `--verificar`, además el ✓/✗ y los kg de cada grupo con su armado. **Sólo propone.** | Módulos → Agrupación (las tarjetas). |
| `resultados` (o `dc`) | El D/C de todas las trabes y columnas, del peor al mejor, con el conteo de ✓ y ✗. | Verificar → Resumido, en corto. |
| `exportar dxf\|svg\|pdf\|detallado\|dcheck` | Las salidas. Dice si quedó en la carpeta de la obra (con la ruta) o si se descargó. `detallado` abre una ventana nueva. | Exportar DXF, SVG y el menú Verificar. |
| `guardar` | Guarda el `proyecto.json`. Si la carpeta tiene otro proyecto, la app pregunta como siempre. | El botón Guardar. |
| `ir <pestaña>\|centro` | Va a `secciones`, `calculo`, `columnas`, `longitudinal`, `agrupacion`, `deflexiones`, `bd`, `pesos` o `cimentaciones`, o abre el Centro de carga. | Clic en la pestaña. |
| `limpiar` | Borra el registro de la consola. No toca el proyecto. | — |

**Opciones en cualquier comando:** `--json` contesta en JSON y `--quieto` no cambia de pestaña.

**`proyecto nuevo`, igual que el botón:** vacía trabes, columnas, cargas y cimentación, y olvida la carpeta de la obra (`rutaRam`). **No** borra el modelo de RAM sincronizado: la consola lo avisa, y antes de `ram crear` hay que correr `ram cargar <url>` o `ram sync` con el modelo de la obra nueva. Recientes guarda los últimos 6, uno por nombre: un proyecto sin nombre reemplaza al anterior sin nombre. Lo autorizó el Ing. Fernando Burgos (FB) el 2026-11-09.

**D/C de una trabe:** es demanda entre capacidad del miembro más exigido. Si un miembro sólo pasa gracias a los bastones puntuales que resolvió Longitudinal, su D/C es contra la resistencia con esos bastones; la consola da aparte el de las corridas solas: `D/C 95 % (M+ en M-122) con puntuales (corridas solas 184 %)`.

## 4. `fijar`

**Trabes:**

```
fijar T-1 b=20 h=40 r=3 fc=250 inf=3#4 sup=2#4 binf=1#4 bsup=0 est=2.5@8/16
```

| Clave | Qué fija | Campo de Secciones |
|---|---|---|
| `b`, `h` | Ancho y peralte, cm | Ancho (b), Peralte (h) |
| `r` | Recubrimiento al centro de la varilla, cm | Recubrimiento (r) |
| `fc` | f'c, kg/cm² | f'c |
| `inf`, `sup` | Varillas corridas: cantidad#calibre | Acero inferior y superior |
| `binf`, `bsup` | Bastones corridos: cantidad#calibre, o `0` | Bastón corrido inf. y sup. |
| `est` | Estribo: calibre@extremos/centro (`2.5@8/16`, `@10/15` o sólo `3`) | Estribos, separación L/4 y resto |

**Columnas:**

```
fijar C-1 b=30 h=30 r=3 fc=250 lechos=3#5,2#5,3#5 est=3 sep=10/15
```

`lechos` va de la cara superior a la inferior (2 a 8 lechos); `est` es el calibre del estribo y `sep` la separación en extremos/centro, cm.

Sólo se aceptan los calibres de la app: varillas #2, #2.5, #3, #4, #5, #6 y #8; estribos #2, #2.5, #3 y #4. Una clave que no existe o un calibre que no está da error y no cambia nada.

**Lo que fija la consola queda como armado propuesto** (la marca «propuesto» de la app), hasta que un ingeniero lo edita o lo acepta en la pantalla. Es un borrador, igual que el que propone `ram crear`.

**Si cambias b o h** (desde la 3.09, solo si de verdad son distintos de los que ya tiene la sección; `b=15 h=15` en una 15×15 no avisa), la consola avisa: las demandas son de RAM con la sección anterior. El cambio tiene que ir a RAM, reanalizar y sincronizar. En la Oficina IV eso lo aplica el Modelador con la aprobación de un ingeniero.

## 5. Lo que la consola no hace

Es a propósito, para que no se pueda hacer sin un ingeniero:

- No borra chips ni limpia la BD. Sí empieza un proyecto nuevo o abre uno (`proyecto`, autorizado por FB el 2026-11-09), siempre con lo de antes guardado primero en Recientes, y le cambia el nombre (`proyecto renombrar`, 3.09).
- No genera `aplicar_agrupacion.py` ni escribe nada en RAM. La agrupación la elige un ingeniero en Agrupación.
- No elige la carpeta de la obra ni da permisos del navegador: eso pide un clic real de una persona. Si falta, `ram sync` lo dice.
- No trae archivos de otros servidores: `ram cargar` y `proyecto abrir` sólo aceptan URL del mismo servidor de la app.
- No acepta diseños: todo lo que fija es propuesta.
- No escribe el usuario ni la contraseña de la pantalla de entrada.

## 6. Ejemplo: el edificio de práctica

Con la app vacía y `ejemplos/modelo.json` servido junto a la app (ejercicios 1 a 5 de `09-practica.md`):

```
> ram cargar ../agente/ejemplos/modelo.json
modelo.json: 7 grupo(s) · 240 miembros · 201 nudos · CD / CSX / CSXN / CSZ / CSZN · 12 apoyos · picos exactos de la API de RAM · aplicado a 0 chip(s) · 7 grupo(s) sin sección en el proyecto
7 grupo(s) sin sección en el proyecto: T4, T5, T1, C1, T3, T2, C2 → «ram crear»

> ram crear
Creadas 7 sección(es) con su armado PROPUESTO: 7 pasan
✓ T-4 15×40 · 96 miembros · inf 3#4 + 2#4 puntual · sup 3#4 + 3#4 puntual · E#2.5 @18/18 · 764 kg
✓ T-2 20×40 · 20 miembros · inf 2#4 + 2#4 puntual · sup 3#5 + 2#5 puntual · E#2.5 @18/18 · 202 kg
✓ C-1 30×30 · 27 miembros · 8#6 (ρ 2.53 %) · E#2.5 @ 7 cm en extremos (60 cm) · @ 15 cm al centro
…

> longitudinal T-2
✓ T-2 · 2 unidades: 0 con corridas, 2 con bastón · acero 202 kg · puntuales inf 2 sup 2

> columnas C-1
✓ C-1 30×30 · 8#6 (ρ 2.53 %) · E#2.5 @ 7 cm en extremos (60 cm) · @ 15 cm al centro · D/C 94 % (miembro 22 CSZ pie) · Pu 57.55 t · Mux 0.60 · Muy 9.10 t·m · NTC: general 94 % (gobierna) · referencia 5.4.1.2.a 96 % · FR 0.65 (transición) · 270/270 puntos

> deflexiones
CS = 1·CM + 1·CV · 51 tramo(s) · 3 no pasan · 0 sin armado · peor T5 tramo 173…184 · 2/3: 121 % del límite
✗ T5 tramo 173…184 · 2/3 L 6.50 m · total 2.87/3.21 cm (90 %) · posterior 2.01/1.65 cm (121 %)
✗ T2 tramo 117…128 · 2/3 L 6.50 m · total 2.54/3.21 cm (79 %) · posterior 1.83/1.65 cm (111 %)
✗ T1 tramo 49…60 · 2/3 L 6.50 m · total 2.34/3.21 cm (73 %) · posterior 1.70/1.65 cm (103 %)

> agrupar
Agrupación de trabes (sólo propuesta) · grupos de RAM: T4, T5, T1, T3, T2 · hoy 5 grupo(s), 15.87 m³
■ Pocos grupos: 2 grupos · 19.39 m³ (+22 % vs hoy)
■ Equilibrada: 3 grupos · 16.52 m³ (+4 % vs hoy)
■ Ajustada: 5 grupos · 15.61 m³ (-2 % vs hoy)
…
```

Son los mismos números que esperan los ejercicios; `tests/consola.test.js` lo comprueba.

## 7. Mensajes de error frecuentes

| Mensaje | Qué hacer |
|---|---|
| `No hay carpeta de la obra recordada…` | Un ingeniero elige la carpeta una vez en 📥 Reportes de RAM → 🔄 Elegir la carpeta y sincronizar…. Para practicar: `ram cargar <url>`. |
| `El navegador no deja leer «…» sin un clic…` | Un clic en 🔄 Sincronizar con RAM en el Centro de carga; después `ram sync` ya funciona. |
| `No hay modelo sincronizado…` | `ram sync` o `ram cargar <url>` antes de `deflexiones`, `agrupar` o `ram crear`. |
| `El modelo no trae desplazamientos…` | Generar otra vez `sincronizar.py` desde la app y correrlo en RAM. |
| `No hay chip «…»` | `grupos` para ver los nombres. |
| `No se hizo nada: el navegador no dejó guardar lo actual en Recientes…` | `guardar` primero; después `proyecto nuevo` otra vez. |
| `La app está en la pantalla de entrada…` | Un ingeniero inicia la sesión. |

## 8. Para quien mantiene la app

- Los comandos viven en `src/core/consola/comandos.js`, la API y `ejecutar` en `src/core/consola/index.js`, el registro en `src/core/consola/registro.js` y el panel en `src/components/Consola.jsx`.
- La pantalla le presta sus acciones a la consola en `App.jsx` (`registrarUI`): cambiar de pestaña, abrir un módulo, los avisos, las exportaciones, guardar, y empezar o abrir un proyecto (`nuevoProyecto` y `abrirProyecto`, que también usan los botones).
- Sincronizar y crear secciones están en `src/core/ramAplicar.js`, y los usan el Centro de carga y la consola. Un cambio ahí cambia los dos.
- Si cambias un botón o un motor que tiene comando, revisa su comando y esta referencia, y corre `npm test` (`tests/consola.test.js` repite los ejercicios de práctica por la consola).

## columnas: los campos NTC

Desde la 3.07, el `datos` de `await auxiliarIV.json('columnas C-1')` (o el JSON de `columnas C-1 --json`) trae, además de `dc`, `ok`, `critico`, `Pu`, `Mux` y `Muy`, la revisión de la NTC-Concreto 2023 del punto que manda (el ejemplar crítico de la envolvente o el punto capturado):

| Campo | Qué es |
|---|---|
| `dc` | El D/C de la columna: el mayor de `dcGeneral` y `dc5412`. |
| `gobierna` | Siempre `general` desde la 3.08 (criterio del Ing. Fernando Burgos). |
| `criterio` | El criterio en texto. `referencia5412: true` marca que `dc5412` no decide. |
| `ecuacion` | De qué ecuación sale el D/C que gobierna, en texto. |
| `dcGeneral` | a) Método general, 5.4.1.1 con las hipótesis de 3.6 y el eje neutro inclinado: √(Mux² + Muy²)/MR(θ). |
| `dc5412`, `ecuacion5412` | b) Método aproximado: `5.4.1.2.a` (Bresler, D/C = Pu/PR) o `5.4.1.2.b` (si PR/PR0 < 0.1: Mux/MRx + Muy/MRy). |
| `PR`, `PRx`, `PRy`, `PR0`, `PRsobrePR0` | Los términos de la ec. 5.4.1.2.a, en t (de diseño, con FR). |
| `MRx`, `MRy` | Momentos resistentes de diseño al nivel de Pu (t·m). |
| `MRtheta`, `theta` | MR(θ) del método general y el ángulo θ del vector de momento (grados, 0 = Mx). |
| `MuxDiseno`, `MuyDiseno`, `eminX`, `eminY` | Los momentos con que se revisó y si entró la excentricidad mínima de 5.3.2 en cada dirección. |
| `FR`, `epsT`, `clase`, `incisoFR` | FR, εt y clasificación (compresión, transición o tensión) del punto resistente del método que gobierna; con 5.4.1.2, los del diagrama uniaxial más exigido. `incisoFR` es el inciso de la tabla 3.8.2.2 (o `3.8.2.3` si se topó por refuerzo asimétrico). |
| `FRx`, `epsTx`, `FRy`, `epsTy`, `FRgeneral`, `epsTgeneral` | Lo mismo en cada diagrama. |
| `fr` | Las opciones de la columna: `FRc` (0.65 o 0.75), `zunchos`, `transicionComoCompresion` (3.8.2.6), `asimetrico` y `PR0`. |

Ejemplo, para leer los D/C nuevos sin abrir la pestaña:

```js
const { datos: d } = await auxiliarIV.json('columnas C-1')
// d = { dc: 0.9397, gobierna: 'general', ecuacion5412: '5.4.1.2.a', dcGeneral: 0.9397, dc5412: 0.9637 (referencia), FR: 0.6505, epsT: 0.00209, clase: 'transición', … }
// sin chip, datos es la lista de todas las columnas:
const { datos: todas } = await auxiliarIV.json('columnas')
todas.map((c) => [c.chip, c.dc, c.gobierna, c.ecuacion5412, c.dcGeneral, c.dc5412])
```

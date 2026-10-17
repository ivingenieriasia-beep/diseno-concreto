# Módulo Pesos Unitarios (bajada de cargas)

## 1. Para qué sirve

Pesos Unitarios es la bajada de cargas de Auxiliar IV. Ahí armas la "receta" de cada losa capa por capa (concreto, relleno, yeso, impermeabilizante, sobrecargas…) y obtienes su carga muerta en kg/m². La carga viva sale del catálogo por destino (W media, Wa instantánea, Wm máxima). También calculas el peso de muros y pretiles en kg/m² y en kg/m según su altura. Después repartes la presión de cada losa en sus tableros por área tributaria a 45° o por momento equivalente, y obtienes las cargas lineales uniformes (WLC lado corto, WLL lado largo) que **capturas a mano en RAM Elements** sobre las trabes. Los totales también prellenan la sección "Cargas (kg/m²)" de la Memoria de cálculo. El módulo traduce el libro de Excel `PESOS_UNITARIOS.xlsx` (hojas "Datos", "P. Unitarios" y "Muros").

**Cómo abrirlo:** botón **Módulos** de la barra superior (o ⌘K / Ctrl+K) → "Pesos Unitarios". Se abre como pestaña cerrable. El contador de la pestaña es el número de losas más el de tableros.

---

## 2. Anatomía

El módulo tiene cuatro sub-pestañas. Cada una muestra un contador cuando tiene elementos:

| Sub-pestaña | Etiqueta exacta | Contador |
|---|---|---|
| Losas | `Losas` | nº de losas del proyecto |
| Muros | `Muros y pretiles` | nº de muros |
| Tableros | `Tableros · RAM` | nº de tableros |
| Biblioteca | `Biblioteca` | plantillas de losa + plantillas de muro visibles |

### 2.1 Losas

**Columna izquierda (lista):**
- Botón **`+ En blanco`**: crea "Losa nueva", con tipo Entrepiso, destino "Oficinas" y sin capas.
- Botón **`Desde plantilla`** ▾: menú con buscador (`Buscar…`) de las plantillas de losa, de fábrica y tuyas. Las tuyas llevan la marca "tuya". Si no hay coincidencias, el menú dice "Nada con ese nombre.". Al elegir una, aparece el toast `"<nombre>" copiada al proyecto`.
- Cada renglón muestra el nombre y `<Tipo> · CM <x> kg/m²`.
- Si no hay losas, la lista dice: "Todavía no hay losas en este proyecto. Parte de una plantilla del catálogo y quítale o añádele lo que haga falta."

**Panel derecho (losa abierta):**
- Campo de nombre (placeholder `Nombre de la losa`).
- Selector de tipo: **Azotea / Entrepiso / Cubierta**. El tipo **no cambia la carga viva**, que depende del "Destino". Sí cuenta para la Memoria: las losas tipo azotea alimentan "CV azotea" y las demás alimentan "CM losa" y "CV entrepiso".
- **`Duplicar`**: copia la losa con el nombre `<nombre> (variante)`, justo debajo de la original.
- **`Guardar en biblioteca`**: guarda la receta como plantilla tuya. Toast: `"<nombre>" guardada en la biblioteca; ya la puedes usar en otros proyectos`.
- Ícono de bote (title "Borrar la losa del proyecto"): pide confirmación con `¿Borrar "<nombre>"? Los tableros que la usen se quedan sin losa asignada.`
- Si la plantilla trae nota, aparece en un recuadro amarillo. Por ejemplo, la de azotea de vigueta y bovedilla dice "…el peso propio de la losa es de 144 kg/m²".

**Sección `COMPONENTES · CARGA MUERTA` (tabla de capas, igual para losas y muros).** Columnas: `Material`, `Modo`, `Espesor / Long.`, `γ · peso · W`, `Área m²`, `W kg/m²`. Cada capa entra de una de tres maneras (selector **Modo**):

| Modo (etiqueta) | Campos que pide | Fórmula |
|---|---|---|
| `Espesor × γ` | t (m), γ (kg/m³) | W = t·γ |
| `Peso directo` | t (m, solo referencia, no cuenta), W (kg/m²) | W = W |
| `Perfiles / área` | Long. (m), peso (kg/m), Área (m²) | W = long·peso/área (si el área es ≤ 0, W = 0) |

- Columna Material: campo con autocompletado de materiales (γ) y componentes (W) de la biblioteca. Si escribes un nombre conocido, la capa se rellena sola. Con un material, pasa a modo espesor y toma su γ. Con un componente, pasa a peso directo y toma su W, pero solo si la W estaba vacía.
- Botones por renglón: ojo (title `No contar esta capa` / `Volver a contar esta capa`) para apagar la capa sin borrarla. Una capa apagada se ve tachada y pesa 0. También están `Subir`, `Bajar` y `Quitar la capa` (✕).
- Pie de la tabla: `Añadir:` con **`+ Espesor × γ`**, **`+ Peso directo`** y **`+ Perfiles / área`**, y a la derecha `Carga muerta total = <x> kg/m²`.
- Si la tabla está vacía, dice: "Sin capas todavía. Añade la primera abajo o parte de una plantilla."
- Las cifras aceptan coma decimal ("0,15").

**Sobrecarga NTC:** no se agrega sola. Va como dos capas de peso directo dentro de la receta: `Sobrecarga (concreto)` 20 kg/m² y `Sobrecarga (mortero)` 20 kg/m², es decir, 40 kg/m² en total. Todas las plantillas de concreto ya las traen. Si partes de cero, agrégalas tú.

**Sección `CARGA VIVA`:**
- `Destino` (select): la tabla de cargas vivas en kg/m² (W / Wa / Wm):
  - Casa–habitación, Departamentos, Viviendas, Dormitorios, Cuartos de hotel, Internados de escuelas, Cuarteles, Cárceles, Correccionales, Hospitales: 80 / 100 / 190
  - Oficinas, Despachos, Laboratorios: 100 / 180 / 250
  - Pasillos, Escaleras, Rampas, Vestíbulos, Pasajes públicos: 40 / 150 / 350
  - Estadios, Centros de reunión: 40 / 350 / 450
  - Bibliotecas, Templos, Cines, Teatros, Gimnasios, Salones de baile, Restaurantes, Salas de juego: 40 / 250 / 350
  - Comercios, Fábricas, Bodegas: Wm libre; W = 0.8·Wm y Wa = 0.9·Wm
  - Marquesinas, Balcones: 15 / 70 / 300
  - Garajes, Estacionamientos: 40 / 100 / 250
  - `Azoteas < 5%`: 15 / 70 / 100
  - `Azoteas ≥ 5%`: 5 / 20 / 40
- Con Comercios, Fábricas o Bodegas aparece el campo **`Wm del proyecto`** (placeholder 350, que es el valor sugerido si lo dejas vacío). Debajo se ve `W = 0.8·Wm = … · Wa = 0.9·Wm = … kg/m²`.
- Casilla **`Capturar los tres valores a mano`**: desactiva el Destino y muestra los campos `W`, `Wa` y `Wm`.
- Tarjetas `W media`, `Wa instant.` y `Wm máxima` (kg/m²). Debajo aparece la nota `Observación <n> de la tabla de cargas vivas.`

**Sección `RESUMEN`:** tarjetas `Carga muerta`, `CM + W`, `CM + Wa` y `CM + Wm`, todas en kg/m². Son sumas simples, **sin factores de carga**.

**Plantillas de losa de fábrica (CM verificada en las pruebas):**
- Losa de azotea horizontal (Maciza): 579.5
- Charola para baños (Maciza): 640
- Losa de entrepiso horizontal (Maciza): 422.5
- Cubierta para naves industriales: ≈30.0
- Cubierta de lámina: 20
- Losacero de entrepiso horizontal (Ternium 25): 323.06
- Losa de azotea horizontal (Qualypanel): 405.75
- Losa de entrepiso horizontal (Vigueta y bovedilla): 269.5
- Losa de azotea horizontal (Vigueta y bovedilla): 299.5
- Losa de entrepiso losacero (cal. 22): 245
- Losa Nervada: 300.5

Cada plantilla trae su destino por omisión: las azoteas "Azoteas < 5%", las cubiertas "Azoteas ≥ 5%", y las de entrepiso "Oficinas" o "Casa–habitación". **Revisa el Destino al insertar una plantilla**: varias de entrepiso salen con "Oficinas".

### 2.2 Muros y pretiles

- La lista y los botones son iguales que en Losas: **`+ En blanco`**, que crea "Muro nuevo" con una altura "Muro" de 3 m, y **`Desde plantilla`**. Toast: `"<nombre>" copiado al proyecto`. Cada renglón muestra `<x> kg/m² · <n> altura(s)`.
- Encabezado: nombre (placeholder `Nombre del muro`), **`Duplicar`**, **`Guardar en biblioteca`** (toast `"<nombre>" guardado en la biblioteca`) y el bote (title "Borrar el muro", confirmación `¿Borrar "<nombre>"?`).
- `COMPONENTES DEL MURO`: la misma tabla de capas. La pared entra como peso directo y el aplanado por espesor.
- `ALTURAS · CARGA POR METRO LINEAL`, con el botón **`+ Altura`**. Columnas `Caso` (placeholder "Pretil, muro…"), `Altura (m)` y `W (kg/m)` = kg/m² × h.
- Tarjetas: `Peso del muro` (kg/m²) y una por altura (kg/m).
- Plantillas de fábrica:
  - Block macizo 15×20×40: 354.9 kg/m²
  - Block macizo 12×20×40: 291.4 kg/m²
  - Block Aircrete 40×60 (Pretil): 117 kg/m², con alturas de 0.6, 0.8 y 0.9 m (0.6 m da 70.2 kg/m)
  - Block Aircrete 40×60 (Muro): 117 kg/m² a 3 m
  - Block de 40×60 (Muro): 222 kg/m², que a 3 m da 666 kg/m

### 2.3 Tableros · RAM

**Sección `TABLEROS`**, con el botón **`+ Tablero`**. Está deshabilitado si no hay losas, y en ese caso aparece el aviso amarillo "Primero captura al menos una losa en la pestaña **Losas**…". Columnas de la tabla editable:

| Columna | Qué es | Default |
|---|---|---|
| `Tablero` | nombre | "Tablero N" |
| `Nivel` | texto libre (placeholder N+0.00) | vacío |
| `Losa` | losa del proyecto o `— sin losa —` | la primera losa |
| `a1 (m)`, `a2 (m)` | claros; se ordenan solos (el corto manda) | vacíos |
| `Método` | `Área tributaria` / `Equivalente por momento` | Área tributaria |
| `Dirección` | `Automática` / `2 direcc.` / `1 direcc.` | Automática (m > 0.5 → dos direcciones) |
| `Caso CV` | `W media` / `Wa instant.` / `Wm máxima` | Wm máxima |
| `Muro borde` | muro del proyecto o `— ninguno —` | ninguno |
| `h (m)` | altura del muro sobre ese borde | vacío |
| `Lado` | `Largo` / `Corto` / `Ambos` | Largo |
| `m` | a1/a2 (se resalta si trabaja en 2 direcciones) | calculado |
| `Σ corto`, `Σ largo` | suma de todo lo que baja a cada trabe | calculado |

Por renglón tienes los íconos `Duplicar el tablero` (crea "<nombre> (copia)") y `Quitar el tablero` (sin confirmación). Para marcar un tablero, haz clic en su renglón. Si no marcas ninguno, se usa el primero.

**Fórmulas** (w en kg/m², a1 = claro corto, m = a1/a2):
- Dos direcciones, área tributaria: WLC = w·a1/4 y WLL = (w·a1/4)·(2 − m).
- Dos direcciones, equivalente por momento: WLC = w·a1/3 y WLL = (w·a1/3)·(3 − m²)/2.
- Una dirección (con cualquiera de los dos métodos): WLC = 0 y WLL = w·a1/2.
- Muro de borde: **no se reparte por área**. Es una carga lineal de kg/m² × h que se suma al lado elegido. La h es la que pones en el tablero, no las alturas del muro.

**Sección `<tablero> · REPARTO`**: aparece cuando el tablero marcado tiene losa y a1, a2 > 0. Incluye:
- Un croquis a escala con las líneas a 45°: triángulos sobre las trabes cortas y trapecios sobre las largas, o dos franjas si trabaja en una dirección.
- Una tabla con las columnas `Caso`, `w`, `WLC corto` y `WLL largo`, con los renglones `CM (losa)`, el caso de CV elegido (p. ej. `CV máxima (Wm)`) y `CM muro (<nombre>)` si lo hay, más una fila `Suma (kg/m | t/m)`.
- El texto de la fórmula aplicada.

**Sección `SALIDA PARA RAM`:**
- Interruptor de unidad: botones **`kg/m`** y **`t/m`**. Afecta WLC, WLL y la w del muro. La w de la losa sigue en kg/m². La unidad se guarda con el proyecto (por omisión, kg).
- **`Copiar tabla`**: copia la tabla separada por tabuladores, con encabezado, para pegarla en Excel. Toast: `<n> renglón(es) copiados; pégalos en tu hoja o captúralos en RAM`. Si el navegador no deja copiar, el toast dice "El navegador no dejó copiar; descarga el CSV".
- **`CSV`**: descarga `cargas-tableros-kg.csv` o `cargas-tableros-ton.csv`.
- Ambos botones están deshabilitados si no hay filas. Sin filas, la sección dice: "Aquí aparece un renglón por tablero y caso de carga, listo para capturar en RAM."
- La tabla tiene un renglón por tablero y caso. Columnas en pantalla: Tablero, Nivel, Losa, Caso, a1, a2, m, Dirección, Método, w, `WLC corto (kg/m)` y `WLL largo (kg/m)`. Encabezados del CSV: `Tablero, Nivel, Losa, Caso, a1 corto (m), a2 largo (m), m = a1/a2, Dirección, Método, w, WLC lado corto (kg/m), WLL lado largo (kg/m)`. Los números del CSV van redondeados a 3 decimales.

---

## 3. Biblioteca de cargas

La biblioteca es lo que sobrevive entre proyectos: materiales (γ), componentes de peso directo (W) y plantillas de losa y de muro. El catálogo de fábrica siempre está ahí. Lo que tú agregas se guarda **en este navegador** (localStorage, clave `iv_loads_lib_v1`), no en el proyecto. Al usar una plantilla en un proyecto se **copia**: editar la copia no toca la plantilla.

**Barra superior:** **`Importar .json`**, **`Exportar .json`** (descarga `biblioteca-cargas.json`) y **`Restablecer`**. Este último pide confirmación con `¿Borrar todo lo que has añadido a la biblioteca y volver al catálogo de fábrica?` y deja el toast "Biblioteca restablecida al catálogo de fábrica".

**Secciones:**
- `Plantillas de losa (n)` y `Plantillas de muro (n)`: tarjetas con el nombre, la marca "tuya", `<n> capa(s) · CM <x> kg/m² · <uso>` y el botón **`Usar en el proyecto`**. La ✕ de la tarjeta (title `Borrar de la biblioteca` en las tuyas, `Ocultar del catálogo` en las de fábrica) borra las tuyas y solo oculta las de fábrica.
- `Ocultas (n)`: botones `<id> ↺` para volver a mostrar lo oculto.
- `Materiales · peso volumétrico`: lista, más los campos `Material` y `kg/m³` con el botón **`Añadir`**.
- `Componentes · peso directo`: lista, más los campos `Componente` y `kg/m²` con el botón **`Añadir`**.
- Si agregas un material o componente con un nombre que ya existe, el tuyo sustituye al anterior. Así se corrige una γ de fábrica. Si no le pones nombre, aparece el aviso "Ponle nombre al material" (o "…al componente"). La ✕ de las listas ("Quitar de la lista") borra los tuyos y oculta los de fábrica.

**Formato del .json exportado.** Solo incluye lo tuyo, no el catálogo de fábrica:
```json
{
  "tipo": "auxiliar-iv-biblioteca-cargas",
  "version": 1,
  "materiales":   [{ "nombre": "Tezontle", "gamma": 1250 }],
  "componentes":  [{ "nombre": "Loseta", "W": 45 }],
  "plantillasLosa": [{ "id": "usr-…", "nombre": "…", "tipo": "entrepiso", "uso": "Casa–habitación", "nota": "",
                       "capas": [{ "nombre": "Losa de concreto", "modo": "espesor", "t": 0.1, "gamma": 2400 }] }],
  "plantillasMuro": [{ "id": "usr-muro-…", "nombre": "…", "capas": [...], "alturas": [{ "nombre": "Muro", "h": 3 }] }],
  "ocultas": ["azotea-maciza", "Bovedilla"]
}
```
Las capas usan los campos `modo: "espesor"` con `t` y `gamma`; `modo: "directo"` con `W` (y `t` opcional como referencia); y `modo: "lineal"` con `long`, `pesoML` y `area`.

**Importar** siempre **combina**: conserva lo que ya tienes y lo que llega sustituye por `id` (plantillas) o por `nombre` (materiales y componentes). Toast: `Biblioteca importada · <n> losa(s), <n> muro(s), <n> material(es)`. Errores posibles: "El archivo no es un JSON válido.", "El archivo no tiene el formato esperado." y "Ese .json no es una biblioteca de cargas de Auxiliar IV." (este último si `tipo` es otro).

---

## 4. Cómo se usan los resultados

**En RAM Elements:** la app **no escribe cargas en RAM**: no hay script ni sincronización de cargas. La "Salida para RAM" es una tabla para capturar a mano. A cada trabe del lado corto del tablero le pones una carga uniforme WLC y a cada trabe del lado largo una WLL, por caso de carga: CM de losa, CM de muro y la CV elegida. Usa `t/m` si tu modelo de RAM trabaja en toneladas. Si una trabe recibe dos tableros, suma lo de ambos, porque la app reparte tablero por tablero y no por trabe. Aparte, el catálogo de RAM de la app (`instalar_catalogo.py`) da de alta la mampostería para placas (TABIQUE, BLOCK HUECO, BLOCK MACIZO y COVINTEC). El peso del BLOCK MACIZO (2.1 t/m³) coincide con el de Pesos Unitarios (312.9 kg/m² en 15 cm), pero ese catálogo **no lee** los datos de este módulo.

**En la Memoria de cálculo:** al abrir "Generar memoria de cálculo", la sección "Cargas (kg/m²)" se prellena desde Pesos Unitarios:
- `CM losa`: la CM más alta de las losas que no son azotea. Si todas son azotea, la más alta de todas.
- `CV entrepiso`: la Wm más alta de las losas que no son azotea.
- `CV azotea`: la Wm más alta de las losas tipo Azotea.
- `CM muro`: los kg/m² del muro más pesado.
- `Área de construcción (m²)`: la suma de a1·a2 de todos los tableros. Tiene prioridad sobre el área del modelo de RAM.
- `Niveles`: el número de valores distintos de "Nivel" en los tableros. Si hay modelo de RAM, manda el modelo.

Solo llena los campos vacíos o los que siguen con el valor de fábrica: 236.5, 249.4, 190 y 100. Debajo de cada campo llenado aparece `↳ Pesos Unitarios` (data-testid `mem-fuente`). El botón **`↻ Llenar con Pesos Unitarios y el modelo`** (data-testid `mem-llenar`) fuerza el llenado de todo.

**En Cimentaciones:** no hay liga directa. El módulo de cimentaciones no lee losas, muros ni tableros. Si quieres usar estos pesos ahí, captúralos a mano.

**Guardado:** todo lo del proyecto (`losas`, `muros`, `tableros` y `unidad`) viaja en el `.json` del proyecto bajo la clave `cargas` y en el autoguardado. Al recuperar la sesión, el toast incluye "…, N losa(s)". Un proyecto nuevo deja el módulo vacío.

---

## 5. Flujos típicos

**A. Bajada de cargas de una casa de vigueta y bovedilla**
1. Abre Módulos → Pesos Unitarios → `Losas`.
2. Ve a `Desde plantilla` → "Losa de entrepiso horizontal (Vigueta y bovedilla)". Revisa que el Destino sea "Casa–habitación". Ajusta capas: apaga con el ojo lo que no lleve y agrega con `+ Peso directo`, p. ej., un piso de 45 kg/m².
3. Ve a `Desde plantilla` → "Losa de azotea horizontal (Vigueta y bovedilla)". Confirma que el tipo sea Azotea y el Destino "Azoteas < 5%". Agrega `Impermeabilizante` si hace falta, porque esta plantilla no lo trae.
4. En `Muros y pretiles`, ve a `Desde plantilla` → "Block macizo de 12 × 20 × 40" y "Block Aircrete de 40 × 60 (Pretil)".
5. En `Tableros · RAM`, usa `+ Tablero` por cada tablero. Captura Nivel, Losa, a1 y a2. Para las viguetas, que trabajan en una dirección, pon `Dirección` = `1 direcc.`. En los de azotea, cuelga el pretil en `Muro borde` con su `h (m)` y su `Lado`.
6. Elige `t/m` o `kg/m` y usa `Copiar tabla` o `CSV`. Captura WLC y WLL en las trabes de RAM.
7. En la barra, ve a Memoria y revisa que CM losa, CM muro, CV entrepiso y CV azotea digan `↳ Pesos Unitarios`.

**B. Comercio o bodega con Wm de proyecto:** en la losa elige Destino "Comercios" (o "Fábricas" o "Bodegas") y captura `Wm del proyecto`. W y Wa salen solas (0.8 y 0.9·Wm).

**C. Probar una variante:** usa `Duplicar` en la losa, cambia espesores en la copia "(variante)" y reasigna la losa en los tableros para comparar Σ corto y Σ largo.

**D. Llevar recetas a otro proyecto o a otra computadora:** usa `Guardar en biblioteca` en la losa o el muro. Luego ve a `Biblioteca` → `Exportar .json`. En la otra máquina, `Biblioteca` → `Importar .json`, y después `Usar en el proyecto` o `Desde plantilla`.

**E. Corregir un γ de fábrica:** en `Biblioteca` → `Materiales`, agrega el mismo nombre (p. ej. "Relleno") con el γ nuevo → `Añadir`. Afecta las capas nuevas o las que reescribas, no las que ya tienes en el proyecto.

---

## 6. Botones y acciones (texto exacto)

| Lugar | Texto / title | Acción |
|---|---|---|
| Sub-pestañas | `Losas`, `Muros y pretiles`, `Tableros · RAM`, `Biblioteca` | cambiar de vista |
| Losas / Muros | `+ En blanco`, `Desde plantilla` | crear |
| Losa / Muro abierto | `Duplicar`, `Guardar en biblioteca`, bote "Borrar la losa del proyecto" / "Borrar el muro" | |
| Tabla de capas | `+ Espesor × γ`, `+ Peso directo`, `+ Perfiles / área`; íconos "No contar esta capa", "Subir", "Bajar", "Quitar la capa" | |
| Carga viva | casilla `Capturar los tres valores a mano` | modo manual |
| Muros | `+ Altura`, "Quitar la altura" | |
| Tableros | `+ Tablero`, "Duplicar el tablero", "Quitar el tablero" | |
| Salida RAM | `kg/m` / `t/m`, `Copiar tabla`, `CSV` | |
| Biblioteca | `Importar .json`, `Exportar .json`, `Restablecer`, `Usar en el proyecto`, `Añadir`, `<id> ↺` | |
| Memoria | `↻ Llenar con Pesos Unitarios y el modelo` | data-testid `mem-llenar`; fuentes `mem-fuente` |

**Sin data-testid:** ningún componente `Loads*.jsx` tiene `data-testid`. Para automatizar, localiza los botones por su texto o por su `title`.

---

## 7. Avisos y qué NO hace

- **No aplica factores de carga** ni combina casos. Todo son cargas de servicio (CM, CV y CM + CV). Las combinaciones van en RAM.
- **No incluye el peso propio de trabes y columnas.** Eso lo calcula RAM.
- **No manda cargas a RAM** ni lee el modelo. La captura es manual o pegando la tabla.
- **No suma por trabe.** Cada tablero da sus WLC y WLL. Si una trabe es frontera de dos tableros, suma tú.
- Por cada tablero se reporta un solo caso de CV, el de `Caso CV`. Si necesitas W, Wa y Wm, duplica el tablero o cámbialo y copia de nuevo.
- Solo cabe un muro de borde por tablero, y su altura es la `h (m)` del tablero, no las alturas definidas en el muro.
- La sobrecarga NTC no es automática: son las dos capas de 20 kg/m² de la receta.
- El tipo de losa (Azotea, Entrepiso o Cubierta) no fija la CV. Lo hace el `Destino`.
- Borrar una losa o un muro no borra los tableros: quedan como `— sin losa —` o sin muro, y un tablero sin losa no genera filas de losa.
- `Quitar el tablero` y `Quitar la capa` no piden confirmación.
- `Guardar en biblioteca` siempre crea una plantilla nueva, aunque tenga el mismo nombre, así que pulsarlo dos veces duplica. Además, las capas apagadas se guardan como activas.
- La biblioteca vive en el navegador. Si cambias de equipo o borras los datos del sitio, se pierde. Respáldala con `Exportar .json`, que no incluye el catálogo de fábrica.
- En la Memoria, la tabla de desglose de cargas muertas es fija (Vigueta y bovedilla 144, Sobrecarga 40, Piso 30, Yeso 22.5) y solo el **Total** toma "CM losa". El texto de cargas vivas también es fijo: habla de casa habitación y cita "NTC, 2017". Revísalo si tu losa es otra.
- Pesos Unitarios no tiene ninguna liga con Cimentaciones.

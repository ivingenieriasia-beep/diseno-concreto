# auxiliar-iv

Herramientas de cálculo y detallado estructural en una sola app.

## Cómo se navega

El header sólo lleva lo del proyecto (nuevo, nombre, verificar, abrir, guardar y
exportar). Las herramientas viven detrás del botón **Módulos** (o con `⌘K` /
`Ctrl+K`): se busca por nombre, se abre con `↵` y el módulo queda como una
pestaña cerrable junto a las fijas — Secciones, Cálculo y Columnas.

Un módulo abierto sigue montado aunque cambies de pestaña, así que no se pierde
nada al ir y venir. Las pestañas abiertas se recuerdan para la próxima sesión, y
cerrar una no borra lo capturado: vuelve tal cual al abrirla de nuevo.

| Módulo | Qué hace |
| --- | --- |
| Pesos Unitarios | Bajada de cargas: recetas de losa, muros y presiones por área tributaria para RAM |
| Longitudinal | Alzados de trabes por estaciones del modelo |
| BD Global | Base de datos de trabes ya resueltas |
| Double Check | Revisión cruzada, en ventana aparte |
| Malla de Vigas | Generador de la malla que alimenta la BD Global |

## Módulo Pesos Unitarios

Sustituye al libro `PESOS_UNITARIOS.xlsx`, con los mismos números y el mismo
criterio, pero componible.

**Losas.** Cada losa es una lista de capas y cada capa entra de una de tres
maneras: por espesor (`t × γ`), por peso directo (catálogo del fabricante o de
proyecto) o por perfiles repartidos en un área (`long × peso/m ÷ área`, para los
largueros de cubierta). Las capas se añaden, se quitan, se reordenan y se pueden
apagar sin borrarlas, para probar una variante y volver atrás. La carga viva sale
de la tabla de cargas vivas unitarias por destino (`W` media, `Wa` instantánea,
`Wm` máxima); en comercios, fábricas y bodegas el `Wm` lo fija el proyecto y de
ahí salen `W = 0.8·Wm` y `Wa = 0.9·Wm`.

**Muros y pretiles.** El ensamble da kg/m² y cada altura declarada da su carga
por metro lineal.

**Tableros · RAM.** Con los dos claros del tablero y la carga por metro cuadrado
se obtiene la carga lineal sobre las trabes de cada lado:

- `m = a1/a2` con `a1` el claro corto. Si `m > 0.5` el tablero trabaja en dos
  direcciones (se puede forzar a una u otra).
- **Área tributaria** (el criterio del libro, por omisión):
  `WLC = w·a1/4` y `WLL = (w·a1/4)·(2 − m)`.
- **Equivalente por momento** (alterno, por tablero):
  `WLC = w·a1/3` y `WLL = (w·a1/3)·(3 − m²)/2`.
- En una dirección, con los dos criterios: `WLL = w·a1/2` y el lado corto no
  recibe carga de la losa.

Se calcula un renglón por caso (carga muerta, carga viva del tipo elegido y, si
el tablero lleva muro en algún borde, su carga lineal aparte). La salida se copia
al portapapeles o se baja en CSV, en kg/m o t/m.

**Biblioteca.** Materiales, componentes y recetas de losa y muro que sobreviven
al proyecto, guardados en el navegador y con import/export en `.json`. Al meter
una plantilla en un proyecto se copia: editarla ahí no toca la plantilla. Las
plantillas de fábrica se pueden ocultar y restaurar; las tuyas se borran.

Todo lo capturado viaja en el `.json` del proyecto y en el autoguardado, junto a
las trabes y las columnas.

## Reportes de RAM Elements

Todo se carga desde **📥 Reportes de RAM** (barra superior). Nombra cada archivo
como su chip —`T-5.txt`, `C-1.txt`, `N-1.txt`— y suéltalos todos juntos: el
contenido decide qué es cada uno y el nombre decide a qué sección va. Un mismo
.txt puede traer varios reportes seguidos; la app los separa y se queda con el
mejor de cada cosa.

| Reporte en RAM | Dónde se pide | Parámetros | Qué llena |
|---|---|---|---|
| **Esfuerzos en puntos de importancia + puntos de inflexión** ⭐ | Imprimir análisis → Miembros | Marca las combinaciones a envolver · Agrupar por: Elementos | El módulo **Longitudinal**: bastones puntuales con su longitud, estribos por claro y alzados. Trae la distancia en metros, así que la longitud de cada miembro sale sola. |
| **Envolvente de esfuerzos en puntos fijos** | Imprimir análisis → Miembros | **Nro. estaciones a imprimir: 20 o más** | Lo mismo, si no tienes el anterior. Es una rejilla fija: con 10 estaciones llegó a saltarse el pico por 49 %. |
| **Máximos esfuerzos** | Imprimir análisis → Miembros | Las mismas combinaciones | La revisión de la sección (pestaña Cálculo) y la de columnas (P, Mx, My). Además le sirve de red de seguridad al análisis a lo largo. |
| **Datos de Geometría** (Nudos + Miembros) | Imprimir datos → Datos de geometría | Las dos tablas en un solo archivo | Longitudes, la unión de tramos colineales en elementos completos y el visor del modelo. Se carga **una vez por proyecto**. |

⭐ = el recomendado. Sus estaciones caen en los picos y en los puntos de
inflexión, que es justo donde la rejilla fija falla.

**Orden que conviene:** primero la geometría, luego los esfuerzos a lo largo de
cada tipo de trabe y, si los exportaste aparte, los máximos de trabes y
columnas.

**Si dos reportes no coinciden** (por venir de combinaciones distintas), la app
lo dice nombrando el elemento, los dos valores y los dos archivos — y diseña
con el mayor de los dos.

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo
npm test        # suite de pruebas
npm run build   # build de un solo archivo a dist/
```

### Marca SOGRUB y paquete del agente

La misma app sale como **SOGRUB Concreto** (Grupo Constructor SOGRUB; nombre,
logo, pantalla de entrada, informes, memoria con pie y firma, tipografías y
carpeta `PROCESO\SOGRUB Concreto`). La marca vive en `src/core/marca.js`, el kit
(logos, íconos, Roboto) en `src/assets/marca/` y viene de
`direcciones/cmo/trabajo/marca-auxiliares` de la oficina. `build:sogrub` además
deja junto al `index.html` los favicons, íconos, `manifest.webmanifest` y la
`og-1200x630.png` (los publica todos juntos). Las fuentes de la marca entran sólo
a ese build (`#marca-extra` en `vite.config.js`). Los formatos de archivo son los
mismos en las dos marcas; la marca IV de siempre no cambia.

```bash
npm run build:sogrub                              # dist-sogrub/ con su pantalla de entrada
python3 scripts/paquete_agente.py --marca sogrub  # paquete-agente-auxiliar-sogrub.zip
```

El paquete junta `agente/` (el prompt de sistema, la referencia de cada
pantalla y los ejemplos) con la app compilada, para enseñarle la app a un
agente de IA. Cuando cambie la interfaz, actualiza `agente/referencia/`.

### Versión y novedades

La versión vive en `src/core/constants.js` (`APP_VERSION`); `package.json` y el
pie del manual van a la par (las pruebas lo revisan). Al pasar el cursor por
`vX.Y` en la barra sale el log de novedades, que se escribe en
`src/core/novedades.js`:

- Cada entrega (3.0, 3.1…) va arriba de la anterior, con sus tarjetas
  grandes (`destacados`, pueden llevar imagen de `src/assets/novedades/`) y la
  lista corta (`cambios`: `nuevo`, `mejora` o `arreglo`).
- El log se reinicia con el número entero: al pasar a la 4 se escribe una
  entrega `4.0` y la barra sólo muestra lo de la 4, con su «¡Nueva
  actualización! Auxiliar IV v4».
- Subir la versión sin escribir su entrega hace fallar las pruebas.

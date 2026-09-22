# auxiliar-iv

Herramientas de cálculo y detallado estructural en una sola app.

## Cómo se navega

El header sólo lleva lo del proyecto (nuevo, nombre, verificar, abrir, guardar y
exportar). Las herramientas viven detrás del botón **Módulos** (o con `⌘K` /
`Ctrl+K`): se busca por nombre, se abre con `↵` y el módulo queda como una
pestaña cerrable junto a las fijas — Detalle, Cálculo y Columnas.

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

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo
npm test        # suite de pruebas
npm run build   # build de un solo archivo a dist/
```

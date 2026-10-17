# Paquete del agente de Auxiliar IV

Todo lo que necesita un agente de IA para aprender a usar **Auxiliar IV**: el prompt, la referencia de cada pantalla, la app y archivos de práctica.

## Qué trae

| Carpeta / archivo | Para qué |
|---|---|
| `PROMPT_SISTEMA.md` | **El prompt.** Quién es el agente, el mapa de la app, para qué sirve cada herramienta, el flujo de una obra, los conceptos, las reglas, las recetas y el diagnóstico. |
| `SKILL.md` | El mismo prompt como *skill* de Claude (con su encabezado `name` / `description`). |
| `referencia/` | La base de conocimiento: el manual del equipo y una guía por pantalla, con las etiquetas exactas de botones y campos (y los `data-testid` para operar con navegador). `09-practica.md` trae ejercicios con resultados esperados. |
| `app/` | La app lista para usarse: abre `app/index.html` en Chrome o Edge. `double_check_estructural.html` y `MallaVigas.html` van junto a ella porque la app los abre como ventanas. |
| `ejemplos/modelo.json` | Un modelo de RAM de práctica (3 niveles, 7 grupos, 12 apoyos). |
| `ejemplos/proyecto.json` | El mismo edificio ya trabajado en la app: 5 trabes, 2 columnas y la cimentación. |
| `scripts/` | El `.bat` que arma la carpeta de una obra (`PROCESO\Auxiliar IV`). |

La app pide usuario y contraseña al abrirse; son las mismas de siempre. No van escritas en el paquete.

## Cómo dárselo a cada tipo de agente

**Claude, en un Proyecto de claude.ai**
1. Crea un proyecto y pega el contenido de `PROMPT_SISTEMA.md` en las instrucciones del proyecto.
2. Sube a su conocimiento los archivos de `referencia/` (y, si quieres, las imágenes de `referencia/img/`).

**Claude Code o Cowork, como skill**
- Copia la carpeta completa como una skill: `SKILL.md` ya está en la raíz y apunta a `referencia/`, `app/` y `ejemplos/`.

**Otro agente (ChatGPT, un agente propio por API…)**
- `PROMPT_SISTEMA.md` va como prompt de sistema; los `.md` de `referencia/` como archivos de conocimiento o recuperación.

**Para que además opere la app** (no sólo que sepa de ella), el agente necesita un navegador que pueda controlar: Claude en Chrome, el uso de computadora o Playwright. Abre `app/index.html` en Chrome o Edge. Hay dos cosas que siempre necesitan un clic de una persona: elegir la carpeta de la obra y dar el permiso del navegador para editarla. El agente lo sabe y te lo va a pedir.

## Cómo enseñarle

1. Empieza con `referencia/09-practica.md`: pídele que haga los ejercicios 1 a 6 con `ejemplos/modelo.json` y que compare sus resultados con los esperados.
2. Luego pídele un diagnóstico de `ejemplos/proyecto.json` (ejercicio 10), sin decirle qué buscar.
3. Termina con las preguntas de autoevaluación del final.
4. Cuando falle, corrige el prompt o la referencia: la siguiente vez lo hará bien.

## Lo que el agente no hace todavía

Opera la app, explica cada herramienta y revisa que todo esté completo, pero **no sustituye el criterio del ingeniero**: no acepta diseños, no cambia criterios de la oficina y avisa de lo que la app no revisa (esbeltez y cortante de columnas, asentamientos, etc.).

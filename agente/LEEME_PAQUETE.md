# Paquete del agente de Auxiliar IV

Todo lo que necesita un agente de IA para diseñar elementos de concreto con **Auxiliar IV**: el prompt, la referencia de cada pantalla, la app y archivos de práctica.

## Qué trae

| Carpeta / archivo | Para qué |
|---|---|
| `PROMPT_SISTEMA.md` | **El prompt.** Quién es el agente (el diseñador) y su frontera con el modelo de RAM, el mapa de la app, para qué sirve cada herramienta, el flujo de una obra, los conceptos, las reglas, las recetas y el diagnóstico. |
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

## Qué hace el agente y qué no

**Es el diseñador.** Recibe el modelo de RAM ya validado por el modelador y por el de cargas (su frontera), y a partir de ahí diseña y detalla trabes, columnas y cimentación, revisa flechas y arma la memoria, los planos y el Double Check.

**No toca lo que está antes de la frontera:** cargas, combinaciones, geometría, apoyos ni secciones de RAM. Si la solución pide cambiar algo de eso, lo regresa al eslabón que corresponde y la cadena se reinicia. Tampoco cambia los criterios de la oficina sin autorización, avisa de lo que la app no revisa (esbeltez y cortante de columnas, asentamientos, etc.) y no firma: la memoria la firma el ingeniero responsable.

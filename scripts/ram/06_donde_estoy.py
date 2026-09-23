# -*- coding: utf-8 -*-
u"""
Auxiliar IV · ¿Sabe el script dónde está él mismo?

De esto depende cómo se configura la carpeta de aquí en adelante.

  · Si al ejecutarlo desde RAM queda definido __file__ (o el directorio actual
    es el suyo), el script puede escribir el modelo.json A SU LADO. Entonces
    basta con dejar el .py en la carpeta del proyecto: cero configuración,
    cero rutas que teclear, y cambiar de proyecto es cambiar de carpeta.

  · Si no lo sabe, la app tendrá que generar el .py con la ruta ya metida
    dentro — y esa ruta se la tendrás que dar una vez por proyecto.

Hay un indicio de que será lo segundo: cuando el SyntaxError de la ruta saltó,
el mensaje decía «File "<string>", line 34». Eso sugiere que RAM ejecuta el
código sin decirle de qué archivo viene. Pero conviene comprobarlo.

Tarda un segundo. No toca el modelo ni escribe nada permanente.

  RAM Elements → Python Console → «Ejecutar archivo…» → este .py
"""

import os
import sys

print(u'=' * 70)
print(u'¿Sabe este script dónde vive?')
print(u'=' * 70)

# ── 1. __file__ ──────────────────────────────────────────────
tiene = '__file__' in globals()
print(u'')
print(u'[1] __file__ definido: %s' % tiene)
if tiene:
    print(u'    __file__ = %r' % __file__)
    try:
        print(u'    carpeta  = %r' % os.path.dirname(os.path.abspath(__file__)))
    except Exception as e:
        print(u'    !! no se pudo resolver: %s' % e)

# ── 2. El directorio actual ──────────────────────────────────
print(u'')
print(u'[2] os.getcwd() = %r' % os.getcwd())
print(u'    (si fuera la carpeta del .py, también nos serviría)')

# ── 3. Cómo llama RAM al código ──────────────────────────────
print(u'')
print(u'[3] sys.argv = %r' % (sys.argv,))
try:
    marco = sys._getframe()
    print(u'    nombre del código en ejecución = %r' % marco.f_code.co_filename)
    print(u"    (si dice '<string>', RAM ejecuta el texto sin decir de dónde salió)")
except Exception as e:
    print(u'    !! %s' % e)

# ── 4. ¿Y si miramos el rastro de la pila? ───────────────────
print(u'')
print(u'[4] La pila, por si alguien de más arriba conserva la ruta:')
try:
    import traceback
    for linea in traceback.format_stack()[:6]:
        print(u'    %s' % linea.strip().replace('\n', ' | '))
except Exception as e:
    print(u'    !! %s' % e)

# ── 5. Lo que RAM recuerda del último script abierto ─────────
# Si guarda la ruta en su configuración, la app podría apoyarse en eso.
print(u'')
print(u'[5] ¿Guarda RAM la ruta del último script abierto?')
base = os.environ.get('APPDATA')
encontrado = False
if base:
    raiz = os.path.join(base, 'Bentley', 'Engineering', 'RAM Elements')
    for dirpath, _dirs, files in os.walk(raiz) if os.path.isdir(raiz) else []:
        for f in files:
            if not f.lower().endswith(('.ini', '.xml')):
                continue
            ruta = os.path.join(dirpath, f)
            try:
                with open(ruta, 'rb') as fh:
                    txt = fh.read().decode('utf-8', 'replace')
            except Exception:
                continue
            for linea in txt.splitlines():
                if '.py' in linea.lower():
                    print(u'    %s' % os.path.basename(ruta))
                    print(u'       %s' % linea.strip()[:160])
                    encontrado = True
if not encontrado:
    print(u'    (nada)')

print(u'')
print(u'=' * 70)
print(u'Mándame esta salida tal cual.')

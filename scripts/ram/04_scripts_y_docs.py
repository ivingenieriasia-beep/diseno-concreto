# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Los dos cabos sueltos de la instalación.

El rastreo encontró dos cosas que conviene mirar:

  · PythonScripts\\  en la raíz de RAM. Si es de donde el programa toma los
    scripts, dejar ahí el nuestro podría ahorrar navegar hasta él cada vez.
  · python\\docs\\    la documentación de la API, EN LOCAL. Vale más que
    cualquier respuesta generada, y aquí el sitio de Bentley está bloqueado.

No modifica nada: lista y muestra las primeras líneas.

  RAM Elements → Python Console → «Ejecutar archivo…» → este .py
"""

import os
import sys

LINEAS = []


def p(*a):
    s = u' '.join(str(x) for x in a)
    LINEAS.append(s)
    print(s)


def kb(n):
    return u'%7.1f KB' % (n / 1024.0)


def arbol(raiz, tope=120):
    u"""Todo lo que cuelga de una carpeta, con su tamaño."""
    out = []
    for dirpath, dirnames, filenames in os.walk(raiz):
        rel = os.path.relpath(dirpath, raiz)
        for f in sorted(filenames):
            ruta = os.path.join(dirpath, f)
            try:
                n = os.path.getsize(ruta)
            except Exception:
                n = 0
            out.append((os.path.join(rel if rel != '.' else '', f), n, ruta))
            if len(out) >= tope:
                return out
    return out


def cabeza(ruta, n=14):
    u"""Las primeras líneas de un archivo de texto."""
    try:
        with open(ruta, 'rb') as f:
            crudo = f.read(60000)
        txt = crudo.decode('utf-8', 'replace')
    except Exception as e:
        return [u'(no se pudo leer: %s)' % e]
    lineas = [l.rstrip() for l in txt.splitlines()]
    # en un .html, el texto útil está entre las etiquetas
    if ruta.lower().endswith(('.html', '.htm')):
        import re
        plano = re.sub(r'<[^>]+>', ' ', txt)
        plano = re.sub(r'\s+', ' ', plano).strip()
        return [plano[:1200]]
    return lineas[:n]


inst = os.path.dirname(sys.executable)
p(u'=' * 74)
p(u'Auxiliar IV — PythonScripts y la documentación local')
p(u'=' * 74)

# ── 1. PythonScripts ─────────────────────────────────────────
ps = os.path.join(inst, 'PythonScripts')
p(u'')
p(u'[1] %s' % ps)
if not os.path.isdir(ps):
    p(u'    (no existe)')
else:
    items = arbol(ps)
    if not items:
        p(u'    (vacía — puede ser justo donde dejar el nuestro)')
    for rel, n, ruta in items:
        p(u'    %-52s %s' % (rel, kb(n)))
    # las primeras líneas de cada .py: dicen si son ejemplos o ganchos
    for rel, n, ruta in items:
        if ruta.lower().endswith('.py'):
            p(u'')
            p(u'    ── %s ──' % rel)
            for l in cabeza(ruta, 20):
                p(u'       %s' % l)

# ── 2. La documentación local de la API ──────────────────────
docs = os.path.join(inst, 'python', 'docs')
p(u'')
p(u'[2] %s' % docs)
if not os.path.isdir(docs):
    p(u'    (no existe)')
else:
    items = arbol(docs, tope=200)
    p(u'    %d archivo(s):' % len(items))
    for rel, n, ruta in items:
        p(u'    %-52s %s' % (rel, kb(n)))
    # y el índice o el primer documento, para saber qué cubre
    cand = [x for x in items if os.path.basename(x[0]).lower().startswith(('index', 'readme', 'api'))]
    cand = cand or [x for x in items if x[0].lower().endswith(('.md', '.rst', '.txt', '.html'))]
    for rel, n, ruta in cand[:3]:
        p(u'')
        p(u'    ── %s ──' % rel)
        for l in cabeza(ruta, 40):
            p(u'       %s' % l)

# ── 3. ¿Y la consola, de dónde abre los scripts? ─────────────
# Si RAM recuerda la última carpeta, estará en su configuración.
p(u'')
p(u'[3] CONFIGURACIÓN DE RAM (por si guarda la carpeta de scripts)')
for base in (os.environ.get('APPDATA'), os.environ.get('LOCALAPPDATA')):
    if not base:
        continue
    raiz = os.path.join(base, 'Bentley', 'Engineering')
    if not os.path.isdir(raiz):
        continue
    for dirpath, dirnames, filenames in os.walk(raiz):
        if dirpath.count(os.sep) - raiz.count(os.sep) > 3:
            dirnames[:] = []
            continue
        for f in filenames:
            if f.lower().endswith(('.ini', '.xml', '.json', '.config')):
                p(u'    %s' % os.path.join(dirpath, f))

p(u'')
p(u'=' * 74)

for d in (os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_docs.txt'),
          os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_docs.txt'),
          os.path.join(os.path.expanduser('~'), 'ram_docs.txt')):
    try:
        if not os.path.isdir(os.path.dirname(d)):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        print(u'\n>>> Salida guardada en: %s' % d)
        break
    except Exception:
        continue

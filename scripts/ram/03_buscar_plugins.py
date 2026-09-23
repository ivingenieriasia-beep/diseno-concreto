# -*- coding: utf-8 -*-
u"""
Auxiliar IV · ¿RAM Elements admite extensiones en la cinta?

Copilot dice que no hay soporte documentado, pero ya se equivocó antes. Esto
mira la instalación de verdad: carpetas de complementos, definiciones de cinta,
ganchos de arranque de Python y qué hay detrás de `ramelements`.

No modifica nada: sólo lista. Si aparece algo, el botón es posible; si no,
queda la ventanita que abre el propio script.

  RAM Elements → Python Console → «Ejecutar archivo…» → este .py
"""

import os
import sys

LINEAS = []


def p(*a):
    s = u' '.join(str(x) for x in a)
    LINEAS.append(s)
    print(s)


def seguro(fn, etiqueta=u''):
    try:
        return fn()
    except Exception as e:
        if etiqueta:
            p(u'   !! %s -> %s: %s' % (etiqueta, type(e).__name__, e))
        return None


# Nombres que delatarían un mecanismo de extensión
PISTAS = ('addin', 'add-in', 'plugin', 'plug-in', 'extension', 'macro', 'script',
          'ribbon', 'cinta', 'toolbar', 'custom', 'user', 'api', 'sdk', 'automation')

INTERESANTES = ('.py', '.pyd', '.xml', '.json', '.config', '.addin', '.manifest', '.toml', '.ini')


def interesa(nombre):
    n = nombre.lower()
    return any(k in n for k in PISTAS)


def listar(raiz, profundidad=3, tope=400):
    u"""Carpetas y archivos cuyo nombre huela a extensión."""
    hallados, vistos = [], 0
    raiz = os.path.normpath(raiz)
    base_nivel = raiz.rstrip(os.sep).count(os.sep)
    for dirpath, dirnames, filenames in os.walk(raiz):
        if dirpath.rstrip(os.sep).count(os.sep) - base_nivel >= profundidad:
            dirnames[:] = []
        vistos += 1
        if vistos > tope:
            hallados.append(u'   … (búsqueda cortada en %d carpetas)' % tope)
            break
        rel = os.path.relpath(dirpath, raiz)
        if rel != '.' and interesa(os.path.basename(dirpath)):
            hallados.append(u'   [carpeta] %s' % rel)
        for f in filenames:
            if interesa(f) and os.path.splitext(f)[1].lower() in INTERESANTES:
                hallados.append(u'   %s' % os.path.join(rel if rel != '.' else '', f))
    return hallados


p(u'=' * 74)
p(u'Auxiliar IV — ¿hay forma de poner un botón en la cinta?')
p(u'=' * 74)

# ── 1. Dónde está instalado ──────────────────────────────────
exe = sys.executable
inst = os.path.dirname(exe)
p(u'')
p(u'[1] INSTALACIÓN')
p(u'    ejecutable: %s' % exe)
p(u'    carpeta:    %s' % inst)
p(u'    existe:     %s' % os.path.isdir(inst))

# ── 2. Qué hay en la raíz de la instalación ──────────────────
p(u'')
p(u'[2] CARPETAS DE PRIMER NIVEL')
try:
    for n in sorted(os.listdir(inst)):
        ruta = os.path.join(inst, n)
        if os.path.isdir(ruta):
            marca = u'  <<<' if interesa(n) else u''
            p(u'    [dir]  %s%s' % (n, marca))
except Exception as e:
    p(u'    !! %s' % e)

# ── 3. Nombres que huelen a extensión ────────────────────────
p(u'')
p(u'[3] LO QUE PARECE UN MECANISMO DE EXTENSIÓN')
hall = listar(inst, profundidad=3)
if hall:
    for h in hall[:120]:
        p(h)
    if len(hall) > 120:
        p(u'   … y %d más' % (len(hall) - 120))
else:
    p(u'   (nada con esos nombres)')

# ── 4. La carpeta python: de dónde sale ramelements ──────────
p(u'')
p(u'[4] LA CARPETA python DE RAM')
pyd = os.path.join(inst, 'python')
if os.path.isdir(pyd):
    for n in sorted(os.listdir(pyd))[:40]:
        p(u'    %s' % n)
    rame = os.path.join(pyd, 'ramelements')
    if os.path.isdir(rame):
        p(u'    ramelements/: %s' % u', '.join(sorted(os.listdir(rame))[:30]))
else:
    p(u'    (no está donde se esperaba)')

# ── 5. ¿Hay gancho de arranque? ──────────────────────────────
# Si Python corre algo al iniciar, ahí se podría colgar el panel sin tocar nada.
p(u'')
p(u'[5] GANCHOS DE ARRANQUE DE PYTHON')
p(u'    PYTHONSTARTUP = %r' % os.environ.get('PYTHONSTARTUP'))
p(u'    PYTHONPATH    = %r' % os.environ.get('PYTHONPATH'))
for mod in ('sitecustomize', 'usercustomize'):
    m = seguro(lambda mod=mod: __import__(mod))
    p(u'    %-14s %s' % (mod, getattr(m, '__file__', u'(no existe)') if m else u'(no existe)'))
p(u'    sys.path:')
for x in sys.path[:15]:
    p(u'       %s' % x)

# ── 6. El puente con Delphi: ¿ofrece algo más? ───────────────
p(u'')
p(u'[6] EL NÚCLEO (_ramelements_core)')
ram = seguro(lambda: __import__('ramelements'), u'import')
core = seguro(lambda: ram.get_core(), u'get_core()') if ram else None
if core is not None:
    p(u'    archivo: %s' % getattr(core, '__file__', u'(integrado en el .exe)'))
    nombres = [n for n in dir(core) if not n.startswith('_')]
    p(u'    %d funciones. Las que suenan a interfaz o a menú:' % len(nombres))
    ui = [n for n in nombres if any(k in n.lower() for k in
          ('menu', 'ribbon', 'button', 'boton', 'command', 'comando', 'ui', 'window',
           'dialog', 'toolbar', 'register', 'registrar', 'add_', 'plugin'))]
    for n in ui[:40]:
        p(u'       %s' % n)
    if not ui:
        p(u'       (ninguna)')
    p(u'    todas: %s' % u', '.join(nombres[:80]))

# ── 7. Config del usuario ────────────────────────────────────
p(u'')
p(u'[7] CONFIGURACIÓN DEL USUARIO (por si el botón se declara ahí)')
for var in ('APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA'):
    base = os.environ.get(var)
    if not base:
        continue
    bent = os.path.join(base, 'Bentley')
    if not os.path.isdir(bent):
        continue
    p(u'    %s\\Bentley:' % var)
    for h in listar(bent, profundidad=4)[:40]:
        p(u'    %s' % h)

p(u'')
p(u'=' * 74)

for d in (os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_plugins.txt'),
          os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_plugins.txt'),
          os.path.join(os.path.expanduser('~'), 'ram_plugins.txt')):
    try:
        if not os.path.isdir(os.path.dirname(d)):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        print(u'\n>>> Salida guardada en: %s' % d)
        break
    except Exception:
        continue

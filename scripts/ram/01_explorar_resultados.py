# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Paso 0.5 — el reconocimiento, hacia adentro.

El primer script dejó ver que `model()` tiene `.results`, `.units`,
`.load_condition` y `.analysis`, pero no qué hay dentro. Esto entra en cada uno
de esos objetos (dos niveles), lista el vocabulario de los submódulos y hace un
censo de los miembros por `description`, que es donde el modelo ya trae el
nombre de la trabe ('T2', 'T-5'…).

Lo que buscamos, en orden de importancia:
  1. cómo pedir los esfuerzos de un miembro a lo largo, y si son el máximo real
  2. las reacciones en los apoyos (para el módulo de cimentación)
  3. en qué unidades vienen
  4. cómo se llaman las combinaciones de carga

No modifica el modelo: sólo lee. Requiere que el análisis ya esté corrido.

  RAM Elements → Python Console → «Ejecutar archivo…» → este .py
"""

import os
import sys

LINEAS = []
VISTOS = set()

PRIMITIVOS = (bool, int, float, complex, str, bytes, type(None))
# En una lista o un dict no hay nada que explorar: sus métodos son los de
# Python. Lo que interesa es su CONTENIDO.
CONTENEDORES = (list, tuple, set, frozenset, dict)


def muestra(v, n=4):
    u"""Los primeros elementos de un contenedor, en una línea."""
    try:
        items = list(v)[:n] if not isinstance(v, dict) else list(v.items())[:n]
    except Exception:
        return u''
    if not items:
        return u''
    def uno(x):
        if isinstance(x, PRIMITIVOS):
            r = repr(x)
            return r if len(r) <= 40 else r[:40] + u'…'
        return u'<%s>' % type(x).__name__
    extra = u', …' if seguro(lambda: len(v)) not in (None, len(items)) else u''
    return u' = [%s%s]' % (u', '.join(uno(x) for x in items), extra)


def p(*a):
    s = u' '.join(str(x) for x in a)
    LINEAS.append(s)
    print(s)


def seguro(fn, callar=True, etiqueta=''):
    try:
        return fn()
    except Exception as e:
        if not callar:
            p(u'   !! %s -> %s: %s' % (etiqueta, type(e).__name__, e))
        return None


def publicos(obj):
    return sorted(n for n in dir(obj) if not n.startswith('_'))


def firma(v):
    s = seguro(lambda: str(__import__('inspect').signature(v)))
    return s or u'(?)'


def doc1(v, n=1):
    d = (getattr(v, '__doc__', u'') or u'').strip()
    if not d:
        return u''
    return u' — ' + u' '.join(d.splitlines()[:n]).strip()


def resumen(v, limite=90):
    t = type(v).__name__
    if isinstance(v, PRIMITIVOS):
        s = repr(v)
        return u'%s = %s' % (t, s if len(s) <= limite else s[:limite] + u'…')
    if callable(v):
        return u'%s%s%s' % (t if t != 'method' else u'', firma(v), doc1(v))
    n = seguro(lambda: len(v))
    if n is not None:
        return u'%s (%d elementos)%s' % (t, n, muestra(v))
    return t


def explorar(obj, etiqueta, nivel=0, profundidad=1, max_items=70):
    u"""Vuelca los atributos públicos y baja un nivel en los que sean objetos."""
    if obj is None:
        p(u'%s%s: (no existe)' % (u'  ' * (nivel + 1), etiqueta))
        return
    marca = id(obj)
    sangria = u'  ' * (nivel + 1)
    nombres = publicos(obj)
    p(u'%s%s  [%s] · %d atributos' % (sangria, etiqueta, type(obj).__name__, len(nombres)))
    if marca in VISTOS:
        p(u'%s  (ya explorado arriba)' % sangria)
        return
    VISTOS.add(marca)
    hijos = []
    for n in nombres[:max_items]:
        v = seguro(lambda n=n: getattr(obj, n))
        p(u'%s  .%-28s %s' % (sangria, n, resumen(v)))
        if v is None or isinstance(v, PRIMITIVOS) or callable(v) or nivel >= profundidad:
            continue
        if isinstance(v, CONTENEDORES):
            # de un contenedor sólo vale la pena ver UN elemento, si es un objeto
            uno = seguro(lambda v=v: next(iter(v.values() if isinstance(v, dict) else v)))
            if uno is not None and not isinstance(uno, PRIMITIVOS) and id(uno) not in VISTOS:
                hijos.append((u'%s[0]' % n, uno))
            continue
        if id(v) not in VISTOS:
            hijos.append((n, v))
    if len(nombres) > max_items:
        p(u'%s  … y %d más' % (sangria, len(nombres) - max_items))
    for n, v in hijos:
        sep = u'' if n.endswith(']') else u'.'
        explorar(v, u'%s%s%s' % (etiqueta, sep, n), nivel + 1, profundidad, max_items)


def primero(col):
    u"""Primer elemento de una colección, sin asumir que es indexable."""
    v = seguro(lambda: col[0])
    if v is not None:
        return v
    return seguro(lambda: next(iter(col)))


p(u'=' * 74)
p(u'Auxiliar IV — reconocimiento 2: resultados, unidades y combinaciones')
p(u'=' * 74)

ram = seguro(lambda: __import__('ramelements'), callar=False, etiqueta='import')
m = seguro(lambda: ram.model(), callar=False, etiqueta='model()') if ram else None

if m is None:
    p(u'Sin modelo abierto. Abre el modelo y vuelve a correrlo.')
else:
    # ── 1. RESULTADOS ────────────────────────────────────────
    p(u'')
    p(u'[1] model().results  ← lo más importante')
    explorar(seguro(lambda: m.results), u'results', profundidad=2)

    p(u'')
    p(u'[2] módulo ramelements.results')
    explorar(seguro(lambda: getattr(ram, 'results')), u'ramelements.results', profundidad=1)

    # ── 3. UNIDADES ──────────────────────────────────────────
    p(u'')
    p(u'[3] model().units  ← en qué vienen las fuerzas')
    explorar(seguro(lambda: m.units), u'units', profundidad=2)

    # ── 4. CASOS Y COMBINACIONES ─────────────────────────────
    p(u'')
    p(u'[4] model().load_condition  (%s)' % resumen(seguro(lambda: m.load_condition)))
    lc = seguro(lambda: m.load_condition)
    explorar(lc, u'load_condition', profundidad=1)
    uno = primero(lc) if lc is not None else None
    if uno is not None:
        p(u'')
        explorar(uno, u'load_condition[0]', profundidad=1)

    p(u'')
    p(u'[5] model().analysis  (¿guarda aquí las combinaciones?)')
    explorar(seguro(lambda: m.analysis), u'analysis', profundidad=2)

    # ── 6. LAS COLECCIONES, no sus elementos ─────────────────
    p(u'')
    p(u'[6] Colecciones: qué saben hacer')
    for nombre in ('members', 'nodes', 'shells'):
        col = seguro(lambda n=nombre: getattr(m, n))
        if col is None:
            continue
        metodos = [n for n in publicos(col) if callable(seguro(lambda n=n, c=col: getattr(c, n)))]
        p(u'  m.%s  [%s]  métodos: %s' % (nombre, type(col).__name__, u', '.join(metodos) or u'(ninguno)'))
        for n in metodos:
            v = seguro(lambda n=n, c=col: getattr(c, n))
            p(u'      .%s%s%s' % (n, firma(v), doc1(v)))

    # ── 7. Apoyos: de dónde saldrán las reacciones ───────────
    p(u'')
    p(u'[7] Apoyos (para cimentación)')
    nodos = seguro(lambda: m.nodes)
    n0 = primero(nodos) if nodos is not None else None
    explorar(seguro(lambda: n0.restraints) if n0 is not None else None, u'nodes[0].restraints', profundidad=1)
    apoyos = seguro(lambda: [nd for nd in nodos if str(seguro(lambda nd=nd: nd.restraints)) not in ('None', '')][:0])
    conteo = seguro(lambda: sum(1 for nd in nodos if any(
        bool(getattr(nd.restraints, a, False)) for a in publicos(nd.restraints) if not callable(getattr(nd.restraints, a, None)))))
    p(u'  nudos con alguna restricción: %s de %s' % (conteo, seguro(lambda: len(nodos))))

    # ── 8. Censo de miembros por description y section ───────
    p(u'')
    p(u'[8] Censo de miembros: el modelo ya trae el nombre de la trabe')
    censo = {}
    for mb in seguro(lambda: list(m.members)) or []:
        d = seguro(lambda mb=mb: mb.description) or u'(sin description)'
        s = seguro(lambda mb=mb: mb.section) or u'?'
        clave = (d, s)
        censo[clave] = censo.get(clave, 0) + 1
    for (d, s), n in sorted(censo.items(), key=lambda kv: -kv[1]):
        p(u'  %-22s %-22s %5d miembro(s)' % (d, s, n))
    p(u'  (%d combinaciones description × section)' % len(censo))

    # ── 9. El vocabulario completo de los submódulos ─────────
    p(u'')
    p(u'[9] Clases de cada submódulo')
    for sub in ('entities', 'member', 'node', 'shell', 'enums', 'analysis', 'loads', 'results', 'exceptions'):
        mod = seguro(lambda s=sub: getattr(ram, s))
        if mod is None:
            continue
        p(u'  ramelements.%-12s %s' % (sub, u', '.join(publicos(mod))[:400]))

p(u'')
p(u'=' * 74)

destinos = [os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_api2.txt'),
            os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_api2.txt'),
            os.path.join(os.path.expanduser('~'), 'ram_api2.txt')]
for d in destinos:
    try:
        if not os.path.isdir(os.path.dirname(d)):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        print(u'\n>>> Salida guardada en: %s' % d)
        print(u'>>> Mándame ese archivo.')
        break
    except Exception:
        continue
else:
    print(u'\n>>> No se pudo guardar; copia la salida de arriba.')

# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Paso 0 — reconocimiento de la API de Python de RAM Elements.

No modifica el modelo: sólo mira qué ofrece `ramelements` y lo escribe en un
.txt del Escritorio para poder mandarlo. Con eso se decide si el script de
sincronización puede sacar los esfuerzos directo de la API (mejor: trae el
pico exacto) o si hay que seguir pasando por los reportes impresos.

Cómo correrlo:
  RAM Elements → Inicio → Python Console → «Ejecutar archivo…» → este .py
  (o pegarlo en la pestaña Script y darle a «Ejecutar»)

Al terminar dice en la pestaña «Salida» dónde dejó el archivo.
"""

import os
import sys
import traceback

LINEAS = []


def p(*a):
    s = u' '.join(unicode(x) if sys.version_info[0] == 2 else str(x) for x in a)
    LINEAS.append(s)
    print(s)


def seguro(etiqueta, fn, callar=False):
    u"""Todo va envuelto: no sabemos qué existe y no queremos que truene a medias."""
    try:
        return fn()
    except Exception as e:
        if not callar:
            p(u'   !! %s -> %s: %s' % (etiqueta, type(e).__name__, e))
        return None


def publicos(obj):
    return [n for n in dir(obj) if not n.startswith('_')]


def resumen(v, limite=120):
    u"""Una línea que describa el valor sin volcar el modelo entero."""
    try:
        t = type(v).__name__
        if v is None or isinstance(v, (bool, int, float)):
            return u'%s = %r' % (t, v)
        if isinstance(v, str) or (sys.version_info[0] == 2 and isinstance(v, unicode)):
            s = v if len(v) <= limite else v[:limite] + u'…'
            return u'%s = %r' % (t, s)
        n = seguro('len', lambda: len(v), callar=True)
        if n is not None:
            return u'%s (%d elementos)' % (t, n)
        if callable(v):
            doc = (getattr(v, '__doc__', '') or '').strip().split('\n')[0]
            return u'callable%s' % (u' — ' + doc[:limite] if doc else u'')
        return t
    except Exception as e:
        return u'?? (%s)' % e


# Lo que de verdad queremos encontrar: resultados por miembro, reacciones en
# apoyos, combinaciones y, si existe, una forma de generar los reportes.
CLAVES = ('result', 'resultado', 'force', 'fuerza', 'esfuerz', 'reaction', 'reaccion',
          'report', 'informe', 'print', 'imprim', 'export', 'combo', 'combinac',
          'load', 'carga', 'analy', 'analis', 'station', 'estacion', 'moment',
          'shear', 'cortante', 'diagram', 'support', 'apoyo', 'section', 'seccion')


def interesa(nombre):
    n = nombre.lower()
    return any(k in n for k in CLAVES)


def explorar(obj, etiqueta, nivel=0, max_items=40):
    sangria = u'  ' * (nivel + 1)
    nombres = publicos(obj)
    p(u'%s%s · %d atributos públicos' % (sangria, etiqueta, len(nombres)))
    for n in nombres[:max_items]:
        v = seguro(u'%s.%s' % (etiqueta, n), lambda n=n: getattr(obj, n), callar=True)
        marca = u'  <<<' if interesa(n) else u''
        p(u'%s  .%-24s %s%s' % (sangria, n, resumen(v), marca))
    if len(nombres) > max_items:
        p(u'%s  … y %d más' % (sangria, len(nombres) - max_items))


p(u'=' * 70)
p(u'Auxiliar IV — reconocimiento de la API de RAM Elements')
p(u'=' * 70)
p(u'Python %s' % sys.version.replace('\n', ' '))
p(u'Ejecutable: %s' % sys.executable)
p(u'')

# ── 1. El módulo ──────────────────────────────────────────────
ram = seguro('import ramelements', lambda: __import__('ramelements'))
if ram is None:
    p(u'No se pudo importar «ramelements». Copia esta salida tal cual.')
else:
    p(u'[1] MÓDULO ramelements')
    p(u'    archivo: %s' % getattr(ram, '__file__', '?'))
    p(u'    versión: %s' % getattr(ram, '__version__', '(no declara)'))
    explorar(ram, u'ramelements', max_items=60)
    p(u'')

    # ── 2. El modelo abierto ──────────────────────────────────
    m = seguro('model()', lambda: ram.model())
    if m is None:
        p(u'    No se pudo obtener model(). ¿Hay un modelo abierto?')
    else:
        p(u'[2] MODELO')
        explorar(m, u'model()', max_items=60)
        p(u'')

        # ── 3. Un nudo y un miembro de muestra ────────────────
        for coleccion in ('nodes', 'nudos', 'members', 'miembros', 'supports', 'apoyos'):
            col = seguro(coleccion, lambda c=coleccion: getattr(m, c), callar=True)
            if col is None:
                continue
            n = seguro('len', lambda c=col: len(c), callar=True)
            p(u'[3] m.%s — %s' % (coleccion, u'%d elementos' % n if n is not None else u'sin len()'))
            uno = seguro('primero', lambda c=col: list(c)[0] if n else None, callar=True)
            if uno is not None:
                explorar(uno, u'm.%s[0]  (%s)' % (coleccion, type(uno).__name__), max_items=50)
            p(u'')

        # ── 4. ¿Hay resultados del análisis a mano? ───────────
        p(u'[4] LO QUE PARECE RESULTADOS / REPORTES')
        encontrados = []
        for fuente, obj in ((u'ramelements', ram), (u'model()', m)):
            for n in publicos(obj):
                if interesa(n):
                    v = seguro(n, lambda o=obj, n=n: getattr(o, n), callar=True)
                    encontrados.append(u'    %s.%s  ->  %s' % (fuente, n, resumen(v)))
        if encontrados:
            for e in encontrados:
                p(e)
        else:
            p(u'    (nada con esos nombres; mira la lista completa de arriba)')
        p(u'')

        # ── 5. Firma de lo que sea invocable e interese ───────
        p(u'[5] DOCUMENTACIÓN DE LO INTERESANTE')
        for fuente, obj in ((u'ramelements', ram), (u'model()', m)):
            for n in publicos(obj):
                if not interesa(n):
                    continue
                v = seguro(n, lambda o=obj, n=n: getattr(o, n), callar=True)
                if not callable(v):
                    continue
                doc = (getattr(v, '__doc__', '') or u'').strip()
                firma = seguro('signature', lambda v=v: str(__import__('inspect').signature(v)), callar=True)
                p(u'    %s.%s%s' % (fuente, n, firma or u'(?)'))
                if doc:
                    for linea in doc.splitlines()[:6]:
                        p(u'        %s' % linea.rstrip())
        p(u'')

p(u'=' * 70)

# ── Guardar para poder mandarlo ───────────────────────────────
destinos = [os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_api.txt'),
            os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_api.txt'),
            os.path.join(os.path.expanduser('~'), 'ram_api.txt')]
guardado = None
for d in destinos:
    try:
        carpeta = os.path.dirname(d)
        if not os.path.isdir(carpeta):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        guardado = d
        break
    except Exception:
        continue

if guardado:
    print(u'\n>>> Salida guardada en: %s' % guardado)
    print(u'>>> Mándame ese archivo.')
else:
    print(u'\n>>> No se pudo guardar el .txt; copia la salida de arriba tal cual.')

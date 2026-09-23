# -*- coding: utf-8 -*-
u"""
Auxiliar IV · ¿Deja RAM que le escribamos, o sólo leer?

De esta respuesta depende la forma de todo el módulo de agrupación:

  · Si `member.description` y `member.section` son de ESCRITURA, la app puede
    generar un `aplicar.py` y etiquetar los 1401 miembros de un Ctrl+R. Mismo
    gesto que sincronizar, en el otro sentido. No hace falta pegar nada.

  · Si son de sólo lectura, habrá que producir un archivo que RAM sepa
    importar (o pegar en su tabla de miembros), y el flujo es más largo.

Toca UN SOLO miembro y le devuelve su valor original. Aun así:

    GUARDA EL MODELO ANTES DE CORRERLO. Si algo queda escrito, cierra sin
    guardar y no ha pasado nada.

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
    u"""Ejecuta y cuenta qué pasó, sin tumbar el script."""
    try:
        return True, fn()
    except Exception as e:
        if etiqueta:
            p(u'      !! %s -> %s: %s' % (etiqueta, type(e).__name__, e))
        return False, None


def publicos(obj):
    return sorted(n for n in dir(obj) if not n.startswith('_'))


def tipo(v):
    return type(v).__name__


p(u'=' * 74)
p(u'Auxiliar IV — ¿se puede escribir en el modelo?')
p(u'=' * 74)

ok, ram = seguro(lambda: __import__('ramelements'), u'import ramelements')
ok, m = seguro(lambda: ram.model(), u'model()') if ok else (False, None)

if m is None:
    p(u'Sin modelo abierto. Abre el modelo y vuelve a correrlo.')
else:
    miembros = None
    ok, miembros = seguro(lambda: list(m.members), u'm.members')
    if not miembros:
        p(u'El modelo no trae miembros.')
    else:
        mb = miembros[0]
        p(u'')
        p(u'Miembro de prueba: id=%s' % getattr(mb, 'id', u'?'))

        # ── 1. ¿Qué son hoy description y section? ───────────────
        p(u'')
        p(u'[1] Lo que hay ahora')
        for campo in ('description', 'section', 'label', 'name'):
            ok, v = seguro(lambda c=campo: getattr(mb, c))
            if ok:
                p(u'    .%-14s [%s] = %r' % (campo, tipo(v), v))

        # ── 2. Escribir la descripción y leerla de vuelta ────────
        # Es lo que de verdad importa: la etiqueta con la que la app agrupa.
        p(u'')
        p(u'[2] ESCRIBIR .description  ← la pregunta del millón')
        ok, original = seguro(lambda: mb.description)
        if not ok:
            p(u'    El miembro no tiene .description en esta versión.')
        else:
            prueba = u'AUXIV_PRUEBA'
            puesto, _ = seguro(lambda: setattr(mb, 'description', prueba), u'asignar')
            if not puesto:
                p(u'    NO se puede asignar: es de sólo lectura.')
            else:
                _, leido = seguro(lambda: mb.description)
                p(u'    asignado sin error · al releer dice %r' % (leido,))
                if leido == prueba:
                    p(u'    >>> SE PUEDE ESCRIBIR. El aplicar.py es viable.')
                else:
                    p(u'    >>> aceptó la asignación pero NO se quedó '
                      u'(el objeto es una copia, no el miembro del modelo).')
                # devolverlo como estaba, pase lo que pase
                vuelto, _ = seguro(lambda: setattr(mb, 'description', original), u'restaurar')
                _, ahora = seguro(lambda: mb.description)
                p(u'    restaurado a %r · ahora dice %r' % (original, ahora))

        # ── 3. ¿Y la sección? ───────────────────────────────────
        # Aquí hay dos incógnitas: si se puede asignar, y qué espera
        # (¿el nombre en texto, o un objeto sacado de un catálogo del modelo?).
        p(u'')
        p(u'[3] La SECCIÓN: qué es y si se deja cambiar')
        ok, sec = seguro(lambda: mb.section)
        if ok:
            p(u'    .section es [%s] = %r' % (tipo(sec), sec))
            if not isinstance(sec, (str, bytes, type(None))):
                p(u'    sus atributos: %s' % u', '.join(publicos(sec))[:400])
        puesto, _ = seguro(lambda: setattr(mb, 'section', sec), u'reasignar la MISMA sección')
        p(u'    reasignar la misma sección: %s' % (u'la acepta' if puesto else u'no deja'))

        # ── 4. ¿Hay un catálogo de secciones donde dar de alta una nueva? ──
        # Para proponer 25×45 hace falta que esa sección EXISTA en el modelo.
        p(u'')
        p(u'[4] ¿Dónde vive el catálogo de secciones?')
        for nombre in publicos(m):
            if 'sect' not in nombre.lower() and 'shape' not in nombre.lower():
                continue
            ok, col = seguro(lambda n=nombre: getattr(m, n))
            if not ok:
                continue
            n = seguro(lambda c=col: len(c))[1]
            p(u'    m.%s  [%s]%s' % (nombre, tipo(col), u' · %d' % n if n is not None else u''))
            metodos = [x for x in publicos(col) if callable(getattr(col, x, None))]
            if metodos:
                p(u'       métodos: %s' % u', '.join(metodos))

        # ── 5. Guardar: ¿hace falta, y se puede desde aquí? ──────
        p(u'')
        p(u'[5] Guardar / deshacer')
        for nombre in ('save', 'save_as', 'undo', 'refresh', 'update'):
            tiene = hasattr(m, nombre)
            p(u'    m.%-10s %s' % (nombre, u'sí' if tiene else u'—'))
        p(u'    (si no hay save, lo escrito vive en el modelo abierto y lo')
        p(u'     guardas tú desde el menú; cerrar sin guardar lo deshace)')

p(u'')
p(u'=' * 74)
p(u'Mándame esta salida tal cual.')

for d in (os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_escribir.txt'),
          os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_escribir.txt'),
          os.path.join(os.path.expanduser('~'), 'ram_escribir.txt')):
    try:
        if not os.path.isdir(os.path.dirname(d)):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        print(u'\n>>> Salida guardada en: %s' % d)
        break
    except Exception:
        continue

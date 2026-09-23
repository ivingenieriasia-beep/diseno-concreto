# -*- coding: utf-8 -*-
u"""
Auxiliar IV · ¿Qué hace RAM si le cambias la sección a un miembro?

La sonda anterior dejó claro que `member.description` se escribe y se queda,
y que `member.section` es un TEXTO ('RcBeam 15X25'), no un objeto. Pero esos
textos no son un patrón fijo: son los nombres que diste de alta en el modelo
('COL 36 X 36', 'RcBeam 20x25', 'RcBeam 15X25'…). Así que falta saber:

  1. ¿Se puede pasar un miembro a OTRA sección que ya existe?
  2. ¿Y a una que todavía no existe? ¿La crea, la rechaza, o la acepta
     callada y deja al miembro con una sección fantasma?
  3. ¿RAM se da cuenta de que hay que volver a analizar?
  4. ¿Con qué se llama save_as, para que aplicar.py guarde una copia antes
     de tocar nada?

Toca UN miembro y le devuelve su sección. Aun así:

    GUARDA EL MODELO ANTES DE CORRERLO. Si algo queda mal, cierra sin
    guardar y no ha pasado nada.

  RAM Elements → Python Console → «Ejecutar archivo…» → este .py
"""

import os

LINEAS = []
FANTASMA = u'AUXIV PRUEBA 99X99'


def p(*a):
    s = u' '.join(str(x) for x in a)
    LINEAS.append(s)
    print(s)


def seguro(fn, etiqueta=u''):
    try:
        return True, fn()
    except Exception as e:
        if etiqueta:
            p(u'      !! %s -> %s: %s' % (etiqueta, type(e).__name__, e))
        return False, None


def publicos(obj):
    return sorted(n for n in dir(obj) if not n.startswith('_'))


def estado_analisis(m):
    u"""Lo que diga el modelo sobre si el análisis sigue vigente."""
    ok, an = seguro(lambda: m.analysis)
    if not ok or an is None:
        return u'(sin .analysis)'
    partes = []
    for n in publicos(an):
        bajo = n.lower()
        if not any(k in bajo for k in ('status', 'valid', 'done', 'run', 'state', 'dirty', 'current')):
            continue
        ok, v = seguro(lambda n=n: getattr(an, n))
        if ok and not callable(v):
            partes.append(u'%s=%r' % (n, v))
    return u', '.join(partes) or u'(nada que diga si está vigente)'


def probar(mb, nueva, etiqueta):
    u"""Asigna, relee y cuenta qué pasó. No restaura: eso lo hace quien llama."""
    puesto, _ = seguro(lambda: setattr(mb, 'section', nueva), u'asignar %r' % nueva)
    if not puesto:
        p(u'    %s: NO la acepta.' % etiqueta)
        return False
    _, leido = seguro(lambda: mb.section)
    if leido == nueva:
        p(u'    %s: la acepta y al releer dice %r' % (etiqueta, leido))
    else:
        p(u'    %s: la acepta sin error, pero al releer dice %r' % (etiqueta, leido))
    return leido == nueva


p(u'=' * 74)
p(u'Auxiliar IV — secciones: cuáles hay y si se dejan cambiar')
p(u'=' * 74)

ok, ram = seguro(lambda: __import__('ramelements'), u'import ramelements')
ok, m = seguro(lambda: ram.model(), u'model()') if ok else (False, None)

if m is None:
    p(u'Sin modelo abierto. Abre el modelo y vuelve a correrlo.')
else:
    ok, miembros = seguro(lambda: list(m.members), u'm.members')
    miembros = miembros or []

    # ── 1. El censo: qué nombres de sección usa el modelo ────────
    p(u'')
    p(u'[1] Secciones en uso (así las nombraste en RAM)')
    censo = {}
    for mb in miembros:
        ok, s = seguro(lambda mb=mb: mb.section)
        if ok:
            censo[s] = censo.get(s, 0) + 1
    for s, n in sorted(censo.items(), key=lambda x: -x[1]):
        p(u'    %5d  %r' % (n, s))

    # ¿Hay algún catálogo de secciones definidas, fuera de las que están en uso?
    p(u'')
    p(u'    ¿Un catálogo aparte? (en el módulo y en el modelo)')
    for dueno, obj in ((u'ramelements', ram), (u'model()', m)):
        for n in publicos(obj):
            bajo = n.lower()
            if any(k in bajo for k in ('sect', 'shape', 'prop', 'material', 'librar', 'catalog')):
                ok, v = seguro(lambda n=n, o=obj: getattr(o, n))
                p(u'      %s.%s  [%s]' % (dueno, n, type(v).__name__ if ok else u'?'))

    if not miembros or len(censo) < 1:
        p(u'')
        p(u'El modelo no trae miembros con sección.')
    else:
        mb = miembros[0]
        ok, original = seguro(lambda: mb.section)
        p(u'')
        p(u'Miembro de prueba: id=%s · sección %r' % (getattr(mb, 'id', u'?'), original))
        p(u'    análisis antes: %s' % estado_analisis(m))

        # ── 2. Otra sección que YA existe en el modelo ─────────────
        otra = next((s for s in censo if s != original), None)
        p(u'')
        p(u'[2] Cambiar a otra sección que YA existe')
        if otra is None:
            p(u'    El modelo sólo usa una sección: no hay a cuál cambiar.')
        else:
            probar(mb, otra, u'%r' % otra)
            p(u'    análisis después: %s' % estado_analisis(m))
            seguro(lambda: setattr(mb, 'section', original), u'restaurar')
            _, ahora = seguro(lambda: mb.section)
            p(u'    restaurado · ahora dice %r' % (ahora,))

        # ── 3. Una que NO existe ───────────────────────────────────
        p(u'')
        p(u'[3] Cambiar a una sección que NO existe (%r)' % FANTASMA)
        se_quedo = probar(mb, FANTASMA, u'la fantasma')
        if se_quedo:
            p(u'    >>> OJO: RAM acepta nombres que no existen. aplicar.py tendrá que')
            p(u'        usar SÓLO secciones ya dadas de alta, o darlas de alta antes.')
        seguro(lambda: setattr(mb, 'section', original), u'restaurar')
        _, ahora = seguro(lambda: mb.section)
        p(u'    restaurado · ahora dice %r' % (ahora,))
        if ahora != original:
            p(u'    !!! NO SE PUDO RESTAURAR. Cierra el modelo SIN GUARDAR.')

    # ── 4. Guardar una copia antes de tocar ────────────────────────
    p(u'')
    p(u'[4] Cómo se llama save_as (para guardar una copia antes de aplicar)')
    for n in ('save', 'save_as'):
        ok, fn = seguro(lambda n=n: getattr(m, n))
        if not ok or fn is None:
            p(u'    m.%s: no existe' % n)
            continue
        ok, firma = seguro(lambda fn=fn: str(__import__('inspect').signature(fn)))
        doc = (getattr(fn, '__doc__', u'') or u'').strip().splitlines()
        p(u'    m.%s%s' % (n, firma if ok else u'(?)'))
        for linea in doc[:4]:
            p(u'        %s' % linea.strip())
    ok, ruta = seguro(lambda: m.path)
    if ok:
        p(u'    m.path = %r' % (ruta,))

p(u'')
p(u'=' * 74)
p(u'Mándame esta salida tal cual.')

for d in (os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_secciones.txt'),
          os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_secciones.txt'),
          os.path.join(os.path.expanduser('~'), 'ram_secciones.txt')):
    try:
        if not os.path.isdir(os.path.dirname(d)):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        print(u'\n>>> Salida guardada en: %s' % d)
        break
    except Exception:
        continue

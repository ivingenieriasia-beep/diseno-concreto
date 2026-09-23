# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Aplica en RAM la agrupación que propuso la app.

Pone a cada miembro su descripción (T1, T2…) y su sección del catálogo.

Antes de tocar nada:
  · comprueba que TODAS las secciones existen en la base de datos de RAM;
    si falta una, no cambia ningún miembro (corre antes instalar_catalogo.py);
  · deja en la carpeta «1 Agrupación» del proyecto (o, si no la hay, en el
    Escritorio) un «Deshacer agrupación ….py» que devuelve cada
    miembro a la descripción y la sección que tenía.

Después: vuelve a correr el análisis y sincroniza. Las secciones nuevas
cambian las rigideces, así que los momentos cambian: ésta es una iteración.
Si algo no convence, cierra el modelo SIN guardar y no ha pasado nada.

Ábrelo con Abrir Script… (pegado en el editor se descompone la sangría) y
Ctrl+R.
"""

import json
import os
import time

# ── La agrupación (la escribe la app; no hace falta tocarla)
AGRUPACION = {
 "propuesta": "",
 "grupos": []
}
# ── fin de la agrupación

# Dónde dejar el «Deshacer» (lo pone la app: PROCESO\Auxiliar IV\1 Agrupación)
CARPETA_DESHACER = None


def log(*a):
    print(u' '.join(str(x) for x in a))


def escritorio():
    u"""Una carpeta que ya exista: dentro de RAM no se pueden crear carpetas."""
    casa = os.path.expanduser('~')
    for sub in ('Desktop', 'Escritorio', os.path.join('OneDrive', 'Escritorio'), os.path.join('OneDrive', 'Desktop')):
        d = os.path.join(casa, sub)
        if os.path.isdir(d):
            return d
    return casa


DESHACER = u'''# -*- coding: utf-8 -*-
u"""Auxiliar IV · Deshace la agrupación aplicada el %(fecha)s.
Devuelve a cada miembro la descripción y la sección que tenía.
Ábrelo con Abrir Script… y Ctrl+R."""
import ramelements
ANTES = %(antes)s
m = ramelements.model()
por_id = dict((int(mb.id), mb) for mb in m.members)
hechos, fallos = 0, []
for k in ANTES:
    desc, sec = ANTES[k]
    mb = por_id.get(int(k))
    if mb is None:
        fallos.append(k)
        continue
    try:
        mb.description = desc
        mb.section = sec
        hechos += 1
    except Exception as e:
        fallos.append(k)
print(u'Devueltos a como estaban: %%d miembros' %% hechos)
if fallos:
    print(u'No se pudieron devolver: %%s' %% fallos[:20])
print(u'Vuelve a correr el análisis.')
'''


def principal():
    grupos = AGRUPACION.get('grupos') or []
    log(u'=' * 70)
    log(u'Auxiliar IV — aplicar agrupación «%s»' % AGRUPACION.get('propuesta', u''))
    log(u'=' * 70)
    if not grupos:
        log(u'Este archivo no trae agrupación: descárgalo desde la app (módulo Agrupación).')
        return
    import ramelements
    m = ramelements.model()
    por_id = dict((int(mb.id), mb) for mb in m.members)

    # 1) Lo que había, para poder deshacerlo (antes de tocar nada, también
    #    antes de la prueba de abajo)
    antes = {}
    ausentes = []
    for g in grupos:
        for i in g['miembros']:
            mb = por_id.get(i)
            if mb is None:
                ausentes.append(i)
                continue
            antes[str(i)] = [u'%s' % (mb.description or u''), u'%s' % (mb.section or u'')]

    # 2) ¿Existen todas las secciones? Se prueba en un miembro y se devuelve.
    #    Poner la nueva y devolver la de antes son dos cosas: si RAM no deja
    #    devolverla, no es que falte la nueva, y hay que decirlo.
    faltan, sin_devolver = [], []
    for g in grupos:
        mb = next((por_id[i] for i in g['miembros'] if i in por_id), None)
        if mb is None:
            continue
        previa = mb.section
        try:
            mb.section = g['seccion']
        except Exception as e:
            faltan.append((g['seccion'], e))
            continue
        try:
            mb.section = previa
        except Exception as e:
            sin_devolver.append((int(mb.id), g['seccion'], previa, e))
    if faltan:
        log(u'No apliqué la agrupación: estas secciones no existen en la base de datos de RAM:')
        for s, e in faltan:
            log(u'   %s  (%s)' % (s, e))
        log(u'Corre instalar_catalogo.py (Reportes de RAM → Configurar RAM) y vuelve a intentarlo.')
        for i, s, p, e in sin_devolver:
            log(u'  ⚠ Al probar, el miembro %d se quedó con «%s»: RAM no dejó devolverle «%s» (%s).' % (i, s, p, e))
        if sin_devolver:
            log(u'    Cierra el modelo SIN guardar para dejarlo como estaba.')
        return
    for i, s, p, e in sin_devolver:
        log(u'  (el miembro %d no aceptó de vuelta «%s» al probar; de todos modos lleva «%s»)' % (i, p, s))
    fecha = time.strftime('%Y-%m-%d %H.%M')
    donde = CARPETA_DESHACER if CARPETA_DESHACER and os.path.isdir(CARPETA_DESHACER) else escritorio()
    ruta = os.path.join(donde, u'Deshacer agrupación %s.py' % fecha)
    with open(ruta, 'wb') as f:
        f.write((DESHACER % {'fecha': fecha, 'antes': json.dumps(antes, ensure_ascii=False, indent=0)}).encode('utf-8'))
    log(u'Para deshacerlo: %s' % ruta)
    log(u'')

    # 3) Aplicar
    total = 0
    for g in grupos:
        hechos, fallos = 0, []
        for i in g['miembros']:
            mb = por_id.get(i)
            if mb is None:
                continue
            try:
                mb.description = g['descripcion']
                mb.section = g['seccion']
                hechos += 1
            except Exception as e:
                fallos.append((i, e))
        total += hechos
        log(u'  %-4s %-10s %4d miembros%s' % (g['descripcion'], g['seccion'], hechos,
                                            u'   ⚠ %d no se pudieron' % len(fallos) if fallos else u''))
        for i, e in fallos[:5]:
            log(u'       miembro %s: %s' % (i, e))
    if ausentes:
        log(u'')
        log(u'  %d miembro(s) ya no están en el modelo (¿se borraron desde que sincronizaste?): %s'
            % (len(ausentes), ausentes[:15]))
    log(u'')
    log(u'Listo: %d miembros. Ahora corre el análisis y sincroniza en la app.' % total)
    log(u'Si algo no convence, cierra SIN guardar, o corre el «Deshacer agrupación».')
    log(u'=' * 70)


try:
    principal()
except Exception as e:
    import traceback
    print(u'ERROR: %s: %s' % (type(e).__name__, e))
    traceback.print_exc()

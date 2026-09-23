# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Edificio de PRUEBA, construido desde la consola de Python.

Para probar todo el flujo de punta a punta: sincronizar, agrupar, aplicar,
reanalizar y diseñar. No es un proyecto: los claros, cargas y el sismo son
razonables pero de ejemplo.

  · 3 niveles de 3.0 m, rejilla de 3 × 2 crujías con claros distintos
    (X: 4.0, 6.5, 4.5 m · Z: 5.5, 3.5 m) para que las trabes pidan cosas
    distintas. El eje vertical es Y, como en RAM.
  · Columnas «COL 30 X 30» con descripción C1.
  · TODAS las trabes «15 X 20» y SIN descripción: como se empieza a iterar.
    Justo lo que el módulo de Agrupación tiene que resolver.
  · Concreto «F'C 250» del grupo Personales.
  · Cargas: CM y CV de losa repartidas por áreas tributarias (triángulos y
    trapecios de losa en dos direcciones). Como la API no trae carga
    repartida sobre miembros, cada trabe va en 4 tramos y la carga entra en
    sus nudos; el peso propio sí es repartido (lo calcula RAM).
  · Sismo estático en X y en Z, con sus dos signos, distribución triangular.
  · Combinaciones: CD = 1.3CM + 1.5CV y las cuatro accidentales
    1.1(CM + CV + S). (Para simplificar se usa CV también en la accidental.)

ANTES: Archivo → Nuevo (el script se niega a trabajar sobre un modelo que ya
tenga algo) y que el catálogo esté instalado (instalar_catalogo.py).
Ábrelo con Abrir Script… y Ctrl+R. Al terminar, guárdalo con Guardar como…
en una carpeta de prueba.
"""

import ramelements as re
from ramelements.enums import LoadCategory, ComboType

# ── Parámetros ───────────────────────────────────────────────
CLAROS_X = [4.0, 6.5, 4.5]          # m
CLAROS_Z = [5.5, 3.5]               # m
ALTURAS = [3.0, 3.0, 3.0]           # m, de abajo hacia arriba
TRAMOS = 4                          # tramos por trabe (la carga entra en sus nudos)
SEC_COLUMNA = u'COL 30 X 30'
SEC_TRABE = u'15 X 20'
MATERIAL = u"F'C 250"
# t/m² sobre la losa (el peso propio de trabes y columnas lo pone RAM)
CM = [0.50, 0.50, 0.45]             # entrepisos y azotea
CV = [0.19, 0.19, 0.10]             # máxima: departamentos y azotea
CVA = [0.10, 0.10, 0.07]            # accidental, sólo para el peso sísmico
COEF_SISMICO = 0.16                 # c/Q', de prueba

log = print


def categoria(*nombres):
    u"""El primer miembro del enum que exista; las versiones cambian de nombre."""
    for n in nombres:
        if hasattr(LoadCategory, n):
            return getattr(LoadCategory, n)
    for c in LoadCategory:
        if any(n in c.name.upper() for n in nombres):
            return c
    return list(LoadCategory)[0]


def tipo_combo():
    for c in ComboType:
        if 'CONCRETE' in c.name.upper():
            return c
    return getattr(ComboType, 'DESIGN_STEEL', list(ComboType)[0])


def principal():
    m = re.model()
    if len(m.nodes) or len(m.members):
        log(u'Este modelo ya tiene %d nudos y %d miembros. Para no tocar un proyecto de'
            % (len(m.nodes), len(m.members)))
        log(u'verdad, el edificio de prueba sólo se construye en un modelo NUEVO:')
        log(u'Archivo → Nuevo, y vuelve a correr este script.')
        return
    m.units.set(re.Units.TON_M)

    xs = [0.0]
    for c in CLAROS_X:
        xs.append(xs[-1] + c)
    zs = [0.0]
    for c in CLAROS_Z:
        zs.append(zs[-1] + c)
    ys = [0.0]
    for h in ALTURAS:
        ys.append(ys[-1] + h)

    nudos = {}

    def nudo(x, y, z, fijo=False):
        k = (round(x, 4), round(y, 4), round(z, 4))
        if k not in nudos:
            nudos[k] = m.nodes.add(x, y, z, restraints=re.FIXED) if fijo else m.nodes.add(x, y, z)
        return nudos[k]

    def miembro(a, b, seccion, descripcion=u''):
        return m.members.add(node_i=a.id, node_j=b.id, section=seccion, material=MATERIAL, description=descripcion)

    # ── Columnas ─────────────────────────────────────────────
    # La primera se crea aparte: si la sección o el material no existen en
    # la base de datos, se dice claro y no se construye nada más.
    try:
        miembro(nudo(xs[0], 0.0, zs[0], True), nudo(xs[0], ys[1], zs[0]), SEC_COLUMNA, u'C1')
    except Exception as e:
        log(u'No se pudo crear la primera columna: %s' % e)
        log(u'¿Está instalado el catálogo? Corre instalar_catalogo.py (Reportes de RAM →')
        log(u'Configurar RAM) y vuelve a empezar con Archivo → Nuevo.')
        return
    n_col = 1
    for i, x in enumerate(xs):
        for j, z in enumerate(zs):
            for k in range(len(ALTURAS)):
                if i == 0 and j == 0 and k == 0:
                    continue
                miembro(nudo(x, ys[k], z, k == 0), nudo(x, ys[k + 1], z), SEC_COLUMNA, u'C1')
                n_col += 1

    # ── Casos de carga ───────────────────────────────────────
    lc = m.load_condition
    cm = lc.add_load_case('CM', u'Carga muerta', categoria('DEAD'))
    cm.enable_self_weight()
    lc.add_load_case('CV', u'Carga viva máxima', categoria('LIVE'))
    sis = categoria('SEISMIC', 'EARTHQUAKE', 'QUAKE', 'SEIS')
    for caso, txt in (('SX', u'Sismo +X'), ('SXN', u'Sismo -X'), ('SZ', u'Sismo +Z'), ('SZN', u'Sismo -Z')):
        lc.add_load_case(caso, txt, sis)

    # ── Trabes, en TRAMOS, con la carga de losa en sus nudos ─
    # Carga equivalente por metro que cada losa manda a cada uno de sus
    # bordes (losa en dos direcciones): triángulo al lado corto, trapecio al
    # largo. Sumado a los cuatro bordes da exactamente q · área.
    def w_borde(lado, otro):
        s, l = min(lado, otro), max(lado, otro)
        return s / 4.0 if lado <= otro else (s / 2.0) * (1 - s / (2.0 * l))

    n_trabe = 0
    fuerzas = {}          # (id del nudo, caso) → fy acumulada

    def carga(nd, caso, fy):
        fuerzas[(nd.id, caso)] = fuerzas.get((nd.id, caso), 0.0) + fy

    def trabe(p0, p1, y, w_cm, w_cv):
        u'''Una crujía de trabe en TRAMOS; w en t/m.'''
        nonlocal n_trabe
        L = sum((p1[c] - p0[c]) ** 2 for c in (0, 1)) ** 0.5
        puntos = [nudo(p0[0] + (p1[0] - p0[0]) * t / float(TRAMOS), y, p0[1] + (p1[1] - p0[1]) * t / float(TRAMOS))
                  for t in range(TRAMOS + 1)]
        for a, b in zip(puntos, puntos[1:]):
            miembro(a, b, SEC_TRABE)
            n_trabe += 1
        for t, nd in enumerate(puntos):
            parte = 0.5 if t in (0, TRAMOS) else 1.0      # los extremos cargan medio tramo
            for caso, w in (('CM', w_cm), ('CV', w_cv)):
                carga(nd, caso, -w * L / TRAMOS * parte)

    for k in range(len(ALTURAS)):
        y = ys[k + 1]
        # trabes en X (a lo largo de cada eje z)
        for j, z in enumerate(zs):
            for i in range(len(CLAROS_X)):
                lx = CLAROS_X[i]
                trib = 0.0
                if j > 0:
                    trib += w_borde(lx, CLAROS_Z[j - 1])
                if j < len(CLAROS_Z):
                    trib += w_borde(lx, CLAROS_Z[j])
                trabe((xs[i], z), (xs[i + 1], z), y, CM[k] * trib, CV[k] * trib)
        # trabes en Z (a lo largo de cada eje x)
        for i, x in enumerate(xs):
            for j in range(len(CLAROS_Z)):
                lz = CLAROS_Z[j]
                trib = 0.0
                if i > 0:
                    trib += w_borde(lz, CLAROS_X[i - 1])
                if i < len(CLAROS_X):
                    trib += w_borde(lz, CLAROS_X[i])
                trabe((x, zs[j]), (x, zs[j + 1]), y, CM[k] * trib, CV[k] * trib)

    for (nid, caso), fy in fuerzas.items():
        m.nodes[nid].add_force(caso, fy=fy)

    # ── Sismo estático: triangular, repartido en las columnas de cada nivel ──
    area = sum(CLAROS_X) * sum(CLAROS_Z)
    W = [(CM[k] + CVA[k] + 0.10) * area for k in range(len(ALTURAS))]     # +0.10 t/m² por peso propio
    Wh = [W[k] * ys[k + 1] for k in range(len(ALTURAS))]
    V = COEF_SISMICO * sum(W)
    cols_por_nivel = len(xs) * len(zs)
    for k in range(len(ALTURAS)):
        F = V * Wh[k] / sum(Wh) / cols_por_nivel
        for x in xs:
            for z in zs:
                nd = nudo(x, ys[k + 1], z)
                nd_ = m.nodes[nd.id]
                nd_.add_force('SX', fx=F)
                nd_.add_force('SXN', fx=-F)
                nd_.add_force('SZ', fz=F)
                nd_.add_force('SZN', fz=-F)

    # ── Combinaciones ────────────────────────────────────────
    tc = tipo_combo()
    lc.add_load_combination('CD', u'1.3CM+1.5CV', tc)
    for s in ('SX', 'SXN', 'SZ', 'SZN'):
        lc.add_load_combination('C' + s, u'1.1CM+1.1CV+1.1%s' % s, tc)

    log(u'Edificio de prueba: %d nudos · %d columnas · %d tramos de trabe (%d trabes)'
        % (len(m.nodes), n_col, n_trabe, n_trabe // TRAMOS))
    log(u'  %d niveles · planta %.1f × %.1f m · cortante basal %.2f t (c = %.2f)'
        % (len(ALTURAS), sum(CLAROS_X), sum(CLAROS_Z), V, COEF_SISMICO))
    log(u'  casos: CM (con peso propio), CV, SX, SXN, SZ, SZN · combinaciones: CD, CSX, CSXN, CSZ, CSZN')
    log(u'  sismo como «%s», combinaciones como «%s»' % (sis.name, tc.name))
    log(u'')
    log(u'Analizando…')
    m.analyze()
    log(u'Listo.')
    log(u'')
    log(u'Ahora:')
    log(u'  1. Guárdalo (Guardar como…) en una carpeta de prueba, por ejemplo')
    log(u'     Escritorio / Prueba Auxiliar — NO en la de un proyecto real.')
    log(u'  2. En la app, un proyecto nuevo: Reportes de RAM → Configurar RAM → pega la')
    log(u'     ruta de esa carpeta → Generar sincronizar.py → déjalo ahí.')
    log(u'  3. Aquí: Abrir Script… sincronizar.py → Ctrl+R. En la app: Sincronizar.')
    log(u'     (Cuando ofrezca crear secciones, «ahora no»: primero se agrupa.)')
    log(u'  4. Módulos → Agrupación → elige → aplicar_agrupacion.py → aquí, reanaliza.')


try:
    principal()
except Exception as e:
    import traceback
    print(u'ERROR: %s: %s' % (type(e).__name__, e))
    traceback.print_exc()

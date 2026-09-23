# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Paso 1 — probar los resultados con números reales.

Ya sabemos que existe:

    results.member_forces_at_station(member_id, load_case, stations, principal=False)
        -> list[MemberForcesAtStation(axial, V2, V3, torsion, M22, M33)]
    results.member_end_forces(member_id, load_case) -> MemberForces
    results.node_reaction(node_id, load_case)       -> NodeReaction(fx…mz)

Falta lo que sólo dicen los números:

  1. ¿`stations` va en FRACCIÓN (0…1) o en METROS (0…L)?
  2. Con un barrido fino, ¿sale el pico real? Es LA pregunta: el reporte
     impreso del miembro 12 se quedaba en −5.84 y RAM rotula −6.03.
  3. ¿Cuánto tarda? De eso depende si el script barre los 1401 miembros
     con 200 estaciones o hay que afinar sólo cerca de los picos.

No modifica el modelo. Requiere el análisis ya corrido.

  RAM Elements → Python Console → «Ejecutar archivo…» → este .py

Si quieres probar un miembro concreto, cámbialo aquí abajo.
"""

MIEMBRO = None          # p.ej. 12 · None = escoge uno de la trabe más cargada
COMBO = None            # p.ej. 'CD' · None = la primera combinación que encuentre
N_FINO = 201            # estaciones del barrido fino

import os
import time

LINEAS = []


def p(*a):
    s = u' '.join(str(x) for x in a)
    LINEAS.append(s)
    print(s)


def seguro(fn, etiqueta=u'', callar=False):
    try:
        return fn()
    except Exception as e:
        if not callar:
            p(u'   !! %s -> %s: %s' % (etiqueta, type(e).__name__, e))
        return None


def campos(o):
    u"""Los valores de un dataclass de resultados, en una línea."""
    if o is None:
        return u'(nada)'
    ns = [n for n in dir(o) if not n.startswith('_') and not callable(getattr(o, n, None))]
    return u'  '.join(u'%s=%s' % (n, _num(getattr(o, n))) for n in ns)


def _num(v):
    try:
        return u'%.4f' % float(v)
    except Exception:
        return str(v)


p(u'=' * 74)
p(u'Auxiliar IV — prueba de resultados con números reales')
p(u'=' * 74)

ram = seguro(lambda: __import__('ramelements'), u'import ramelements')
m = seguro(lambda: ram.model(), u'model()') if ram else None
if m is None:
    p(u'Sin modelo. Abre el modelo, corre el análisis y repite.')
else:
    R = m.results

    # ── 1. Unidades y condiciones de carga ───────────────────
    p(u'')
    p(u'[1] UNIDADES: %s' % seguro(lambda: m.units.current, u'units'))
    p(u'    (TON_M = toneladas y metros, que es lo que espera la app)')

    p(u'')
    p(u'[2] CONDICIONES DE CARGA')
    casos, combos = [], []
    for lc in seguro(lambda: list(m.load_condition), u'load_condition') or []:
        es_combo = bool(seguro(lambda lc=lc: lc.is_combination, callar=True))
        idd = seguro(lambda lc=lc: lc.id, callar=True)
        desc = seguro(lambda lc=lc: lc.description, callar=True) or u''
        formula = seguro(lambda lc=lc: lc.formula, callar=True) or u''
        p(u'    %-6s %-10s %-24s %s' % (idd, u'COMBINACIÓN' if es_combo else u'caso', desc, formula))
        (combos if es_combo else casos).append(idd)
    combo = COMBO or (combos[0] if combos else (casos[0] if casos else None))
    p(u'    -> se probará con: %s' % combo)

    # ── 3. Coordenadas por id, para medir longitudes ─────────
    coords = {}
    todas = seguro(lambda: m.nodes.all_coordinates(), u'all_coordinates', callar=True)
    if todas:
        ids, xs, ys, zs = todas
        for i, nid in enumerate(ids):
            coords[int(nid)] = (float(xs[i]), float(ys[i]), float(zs[i]))
    else:
        for nd in seguro(lambda: list(m.nodes), callar=True) or []:
            coords[int(nd.id)] = (nd.x, nd.y, nd.z)
    p(u'')
    p(u'[3] %d nudos con coordenadas' % len(coords))

    def largo(mb):
        a = coords.get(int(mb.node_i)), coords.get(int(mb.node_j))
        if not a[0] or not a[1]:
            return 0.0
        return sum((a[0][k] - a[1][k]) ** 2 for k in range(3)) ** 0.5

    # ── 4. Elegir el miembro de prueba ───────────────────────
    miembros = seguro(lambda: list(m.members), u'members') or []
    mb = None
    if MIEMBRO is not None:
        mb = next((x for x in miembros if int(x.id) == int(MIEMBRO)), None)
    if mb is None:
        # el más largo de las trabes T5 / T2A, que son las del caso que nos ocupa
        cand = [x for x in miembros if str(seguro(lambda x=x: x.description, callar=True) or '').upper().startswith(('T5', 'T2A'))]
        cand = cand or [x for x in miembros if str(seguro(lambda x=x: x.description, callar=True) or '').upper().startswith('T')]
        mb = max(cand, key=largo) if cand else (miembros[0] if miembros else None)
    if mb is None:
        p(u'No hay miembros.')
    else:
        L = largo(mb)
        p(u'')
        p(u'[4] MIEMBRO DE PRUEBA')
        p(u'    id=%s  description=%r  section=%r  nodos %s→%s  L=%.4f m'
          % (mb.id, mb.description, mb.section, mb.node_i, mb.node_j, L))

        # ── 5. Fuerzas en los extremos ───────────────────────
        p(u'')
        p(u'[5] member_end_forces(%s, %r)' % (mb.id, combo))
        ef = seguro(lambda: R.member_end_forces(mb.id, combo), u'member_end_forces')
        p(u'    %s' % campos(ef))

        # ── 6. ¿Fracción o metros? ───────────────────────────
        p(u'')
        p(u'[6] ¿EN QUÉ VAN LAS ESTACIONES?')
        pruebas = {}
        for etiqueta, sts in ((u'fracción 0…1', [0.0, 0.25, 0.5, 0.75, 1.0]),
                              (u'metros 0…L', [0.0, L * 0.25, L * 0.5, L * 0.75, L])):
            r = seguro(lambda sts=sts: R.member_forces_at_station(mb.id, combo, sts), etiqueta)
            if r is None:
                continue
            pruebas[etiqueta] = r
            p(u'    %s -> %d estaciones' % (etiqueta, len(r)))
            for st, v in zip(sts, r):
                p(u'        x=%-9.4f M33=%-10.4f V2=%-10.4f axial=%.4f' % (st, v.M33, v.V2, v.axial))
        # si las dos dan lo mismo, L≈1; si no, la buena es la que no repita el extremo
        if len(pruebas) == 2:
            a, b = list(pruebas.values())
            iguales = all(abs(x.M33 - y.M33) < 1e-9 for x, y in zip(a, b))
            p(u'    -> las dos listas %s' % (u'COINCIDEN (ojo: L≈1 m o se ignora la escala)' if iguales
                                             else u'DIFIEREN: hay que quedarse con la que case con los extremos de [5]'))

        # ── 7. El barrido fino: ¿aparece el pico real? ───────
        p(u'')
        p(u'[7] BARRIDO FINO (%d estaciones) — ¿sale el pico que el reporte se saltaba?' % N_FINO)
        for etiqueta, tope in ((u'fracción', 1.0), (u'metros', L)):
            if tope <= 0:
                continue
            sts = [i * tope / (N_FINO - 1) for i in range(N_FINO)]
            t0 = time.perf_counter()
            r = seguro(lambda sts=sts: R.member_forces_at_station(mb.id, combo, sts), u'barrido %s' % etiqueta)
            dt = time.perf_counter() - t0
            if not r:
                continue
            mx = max(r, key=lambda v: v.M33)
            mn = min(r, key=lambda v: v.M33)
            vmx = max(r, key=lambda v: abs(v.V2))
            xmx = sts[r.index(mx)] if mx in r else -1
            xmn = sts[r.index(mn)] if mn in r else -1
            p(u'    [%s] %d puntos en %.3f s' % (etiqueta, len(r), dt))
            p(u'        M33 máx = %+.4f en x=%.4f' % (mx.M33, xmx))
            p(u'        M33 mín = %+.4f en x=%.4f   <<< comparar con lo que rotula RAM' % (mn.M33, xmn))
            p(u'        |V2| máx = %.4f' % abs(vmx.V2))

        # ── 8. ¿Cuánto costaría el modelo entero? ────────────
        p(u'')
        p(u'[8] TIEMPO: cuánto tardaría barrer todo el modelo')
        muestra = miembros[:20]
        sts = [i / (N_FINO - 1.0) for i in range(N_FINO)]
        t0 = time.perf_counter()
        n_ok = 0
        for x in muestra:
            if seguro(lambda x=x: R.member_forces_at_station(x.id, combo, sts), callar=True) is not None:
                n_ok += 1
        dt = time.perf_counter() - t0
        if n_ok:
            por_miembro = dt / n_ok
            total = por_miembro * len(miembros) * max(1, len(combos))
            p(u'    %d miembros × %d estaciones en %.3f s  ->  %.1f ms por miembro' % (n_ok, N_FINO, dt, por_miembro * 1000))
            p(u'    estimado para %d miembros × %d combinación(es): %.1f s' % (len(miembros), max(1, len(combos)), total))
        else:
            p(u'    no se pudo medir')

    # ── 9. Reacciones en los apoyos (cimentación) ────────────
    p(u'')
    p(u'[9] REACCIONES EN APOYOS')
    apoyos = []
    for nd in seguro(lambda: list(m.nodes), callar=True) or []:
        r = seguro(lambda nd=nd: nd.restraints, callar=True)
        if r is not None and any(bool(getattr(r, a, False)) for a in ('dx', 'dy', 'dz', 'rx', 'ry', 'rz')):
            apoyos.append(nd)
    p(u'    %d nudos con restricción' % len(apoyos))
    for nd in apoyos[:3]:
        rx = seguro(lambda nd=nd: R.node_reaction(nd.id, combo), u'node_reaction(%s)' % nd.id)
        p(u'    nudo %-5s (%.2f, %.2f, %.2f)  %s' % (nd.id, nd.x, nd.y, nd.z, campos(rx)))

    # ── 10. ¿Sirve to_dataframe para sacar todo de un golpe? ─
    p(u'')
    p(u'[10] to_dataframe()')
    df = seguro(lambda: m.members.to_dataframe(), u'members.to_dataframe')
    if df is not None:
        p(u'    columnas: %s' % list(getattr(df, 'columns', []))[:30])
        p(u'    filas: %s' % seguro(lambda: len(df), callar=True))

p(u'')
p(u'=' * 74)

for d in (os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_api3.txt'),
          os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_api3.txt'),
          os.path.join(os.path.expanduser('~'), 'ram_api3.txt')):
    try:
        if not os.path.isdir(os.path.dirname(d)):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        print(u'\n>>> Salida guardada en: %s' % d)
        break
    except Exception:
        continue

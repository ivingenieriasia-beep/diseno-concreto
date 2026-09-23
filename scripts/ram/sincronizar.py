# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Sincronizar RAM → la app.

Lee el modelo analizado por la API de Python de RAM Elements y escribe UN
archivo .json que la app carga de un clic. Sustituye a los tres reportes de
texto (acciones, máximos y geometría) y a la carpeta con un .txt por trabe.

Lo que cambia respecto a los reportes impresos:

  · Las estaciones las elige este script, no un diálogo. Se barre fino (una
    cada 5 cm), se AFINA alrededor de cada extremo y el pico queda guardado
    como tal. El caso que nos costó —el reporte impreso decía −5.84 donde RAM
    rotula −6.03— no puede volver a pasar: el máximo va explícito.

  · Los miembros se agrupan por `description`, que es como el modelo ya los
    tiene etiquetados (T2, T2A, T5, C1…). No hace falta casar nombres de
    archivo ni repartir miembros a mano entre trabes parecidas.

  · Van también las reacciones de los nudos con apoyo, para cimentación.

Cómo correrlo:
  RAM Elements → Inicio → Python Console → «Ejecutar archivo…» → este .py
  (con el modelo abierto y el análisis ya corrido)

Ajusta CARPETA para que apunte a donde la app va a leer.
"""

# ── Ajustes ───────────────────────────────────────────────────
CARPETA = None          # None = el Escritorio. Ej: r'C:\\Users\\Admin\\OneDrive\\PROCESO\\Reportes de Secciones RAM'
ARCHIVO = 'modelo.json'
PASO_M = 0.05           # una estación cada 5 cm
MIN_EST = 21            # nunca menos de esto por miembro
MAX_EST = 401           # ni más
TOL_REL = 0.01          # al compactar la curva, error admitido (1 % del rango)
# Medido sobre un modelo de 1401 miembros, contra una referencia de 2000
# puntos por miembro. El error del PICO es ~0 en todos los casos porque va
# guardado aparte; lo que crece es el error de la curva intermedia, que sólo
# desplaza un poco dónde empieza y acaba cada bastón:
#     tol    KB    est/miembro   err pico   err curva
#    0.004  4144      55.1         0.00 %     0.43 %
#    0.010  2825      35.7         0.01 %     1.09 %   <- el elegido
#    0.020  2090      24.9         0.01 %     2.15 %
#    0.030  1837      21.2         0.01 %     2.99 %
SOLO_GRUPOS = None      # None = todos. Ej: ['T5', 'T2A'] para probar rápido

import json
import os
import time

VERSION = 1


def log(*a):
    print(u' '.join(str(x) for x in a))


# ── Compactar una curva sin perder los picos ──────────────────
def douglas_peucker(xs, ys, tol):
    u"""Índices que hay que conservar para reproducir la curva dentro de `tol`."""
    n = len(xs)
    if n <= 2:
        return set(range(n))
    guardar = {0, n - 1}
    pila = [(0, n - 1)]
    while pila:
        a, b = pila.pop()
        if b <= a + 1:
            continue
        x0, y0, x1, y1 = xs[a], ys[a], xs[b], ys[b]
        dx = x1 - x0
        peor, iPeor = tol, -1
        for i in range(a + 1, b):
            # distancia vertical a la recta a-b (basta: el eje x es monótono)
            y = y0 if dx == 0 else y0 + (xs[i] - x0) * (y1 - y0) / dx
            d = abs(ys[i] - y)
            if d > peor:
                peor, iPeor = d, i
        if iPeor >= 0:
            guardar.add(iPeor)
            pila.append((a, iPeor))
            pila.append((iPeor, b))
    return guardar


def indices_clave(xs, series, tol_min):
    u"""
    Los puntos que hay que exportar: los dos extremos, los máximos y mínimos de
    cada serie (que son los que gobiernan el diseño) y los que hagan falta para
    que la curva compactada no se desvíe de la real.
    """
    guardar = {0, len(xs) - 1}
    for ys in series:
        if not ys:
            continue
        rango = max(ys) - min(ys)
        tol = max(tol_min, TOL_REL * rango)
        guardar |= douglas_peucker(xs, ys, tol)
        guardar.add(ys.index(max(ys)))
        guardar.add(ys.index(min(ys)))
    return sorted(guardar)


# ── Estaciones ────────────────────────────────────────────────
def estaciones(L):
    n = int(round(L / PASO_M)) + 1
    n = max(MIN_EST, min(MAX_EST, n))
    return [i * L / (n - 1.0) for i in range(n)]


def alrededor(xs, i, L, n=11):
    u"""Un entorno fino entre los vecinos de xs[i], para afinar un extremo."""
    a = xs[max(0, i - 1)]
    b = xs[min(len(xs) - 1, i + 1)]
    if b <= a:
        return []
    return [a + k * (b - a) / (n - 1.0) for k in range(1, n - 1)]


def main():
    t0 = time.perf_counter()
    import ramelements
    m = ramelements.model()
    R = m.results

    unidades = str(getattr(m.units, 'current', '?'))
    log(u'Modelo: %r · unidades %s' % (m.title or u'(sin título)', unidades))
    if 'TON' not in unidades.upper():
        log(u'  ⚠ AVISO: la app espera Ton-m. Cambia las unidades del modelo o los')
        log(u'    números entrarán con otra escala.')

    # ── Condiciones de carga: se envuelven todas las combinaciones ──
    combos, casos = [], []
    for lc in m.load_condition:
        idd = str(lc.id)
        if getattr(lc, 'is_combination', False):
            combos.append({'id': idd, 'formula': str(getattr(lc, 'description', '') or '')})
        else:
            casos.append({'id': idd, 'descripcion': str(getattr(lc, 'description', '') or ''),
                          'categoria': str(getattr(lc, 'category', '') or '')})
    usadas = [c['id'] for c in combos] or [c['id'] for c in casos]
    log(u'Combinaciones a envolver: %s' % u', '.join(usadas))

    # ── Nudos ────────────────────────────────────────────────
    coords = {}
    ids, xs_, ys_, zs_ = m.nodes.all_coordinates()
    for i, nid in enumerate(ids):
        coords[int(nid)] = (float(xs_[i]), float(ys_[i]), float(zs_[i]))

    apoyos = []
    nudos = {}
    for nd in m.nodes:
        nid = int(nd.id)
        r = nd.restraints
        fijo = any(bool(getattr(r, a, False)) for a in ('dx', 'dy', 'dz', 'rx', 'ry', 'rz'))
        x, y, z = coords.get(nid, (nd.x, nd.y, nd.z))
        nudos[str(nid)] = {'x': round(x, 4), 'y': round(y, 4), 'z': round(z, 4)}
        if fijo:
            nudos[str(nid)]['apoyo'] = ''.join(a for a in ('dx', 'dy', 'dz', 'rx', 'ry', 'rz')
                                               if getattr(r, a, False))
            apoyos.append(nid)
    log(u'%d nudos · %d con apoyo' % (len(nudos), len(apoyos)))

    def largo(mb):
        a, b = coords.get(int(mb.node_i)), coords.get(int(mb.node_j))
        if not a or not b:
            return 0.0
        return sum((a[k] - b[k]) ** 2 for k in range(3)) ** 0.5

    # ── Miembros ─────────────────────────────────────────────
    miembros = []
    grupos = {}
    # Saltar miembros en silencio esconde problemas: se apunta el motivo y el id.
    sin_largo, sin_result, motivos = [], [], {}
    est_por_grupo = {}
    todos = list(m.members)
    for k, mb in enumerate(todos):
        grupo = str(mb.description or u'(sin nombre)').strip()
        if SOLO_GRUPOS and grupo not in SOLO_GRUPOS:
            continue
        L = largo(mb)
        if L <= 1e-6:
            sin_largo.append(int(mb.id))
            continue
        mid = int(mb.id)
        xs = estaciones(L)

        # 1) barrido fino, envolviendo todas las combinaciones
        por_combo = {}
        for c in usadas:
            try:
                por_combo[c] = R.member_forces_at_station(mid, c, xs)
            except Exception as e:
                clave = u'%s: %s' % (type(e).__name__, e)
                motivos[clave] = motivos.get(clave, 0) + 1
        if not por_combo:
            sin_result.append(int(mb.id))
            continue

        def envolver(lista_xs, datos):
            m33max = [max(d[i].M33 for d in datos) for i in range(len(lista_xs))]
            m33min = [min(d[i].M33 for d in datos) for i in range(len(lista_xs))]
            v2max = [max(d[i].V2 for d in datos) for i in range(len(lista_xs))]
            v2min = [min(d[i].V2 for d in datos) for i in range(len(lista_xs))]
            axmax = [max(d[i].axial for d in datos) for i in range(len(lista_xs))]
            axmin = [min(d[i].axial for d in datos) for i in range(len(lista_xs))]
            return m33max, m33min, v2max, v2min, axmax, axmin

        datos = list(por_combo.values())
        m33max, m33min, v2max, v2min, axmax, axmin = envolver(xs, datos)

        # 2) afinar alrededor de los extremos: el pico casi nunca cae en la
        #    rejilla, y es justo el valor con el que se diseña
        extras = []
        for serie, quien in ((m33max, max), (m33min, min), (v2max, max), (v2min, min)):
            i = serie.index(quien(serie))
            extras.extend(alrededor(xs, i, L))
        extras = sorted(set(round(x, 5) for x in extras if 0.0 <= x <= L))
        if extras:
            finos = {}
            for c in usadas:
                try:
                    finos[c] = R.member_forces_at_station(mid, c, extras)
                except Exception:
                    finos = {}
                    break
            if finos and len(finos) == len(por_combo):
                todos_xs = xs + extras
                orden = sorted(range(len(todos_xs)), key=lambda j: todos_xs[j])
                xs2 = [todos_xs[j] for j in orden]
                datos2 = []
                for c in usadas:
                    junto = list(por_combo[c]) + list(finos[c])
                    datos2.append([junto[j] for j in orden])
                xs, datos = xs2, datos2
                m33max, m33min, v2max, v2min, axmax, axmin = envolver(xs, datos)

        # 3) compactar conservando picos
        tol_min = 0.005   # t·m / t: por debajo de esto da igual
        keep = indices_clave(xs, [m33max, m33min, v2max, v2min], tol_min)
        est = []
        for i in keep:
            est.append([round(xs[i], 4),
                        round(m33min[i], 4), round(m33max[i], 4),
                        round(v2min[i], 4), round(v2max[i], 4),
                        round(axmin[i], 4), round(axmax[i], 4)])

        iP, iN = m33max.index(max(m33max)), m33min.index(min(m33min))
        iV = max(range(len(xs)), key=lambda i: max(abs(v2max[i]), abs(v2min[i])))
        miembros.append({
            'id': mid, 'grupo': grupo, 'seccion': str(mb.section or ''),
            'material': str(mb.material or ''), 'ni': int(mb.node_i), 'nj': int(mb.node_j),
            'L': round(L, 4),
            'est': est,
            'max': {
                'm33p': round(max(m33max), 4), 'xm33p': round(xs[iP], 4),
                'm33n': round(min(m33min), 4), 'xm33n': round(xs[iN], 4),
                'v2': round(max(abs(v2max[iV]), abs(v2min[iV])), 4), 'xv2': round(xs[iV], 4),
                'axp': round(max(axmax), 4), 'axn': round(min(axmin), 4),
            },
        })
        grupos[grupo] = grupos.get(grupo, 0) + 1
        est_por_grupo.setdefault(grupo, []).append(len(est))
        if (k + 1) % 200 == 0:
            log(u'  … %d/%d miembros' % (k + 1, len(todos)))

    # ── Reacciones ───────────────────────────────────────────
    reacciones = []
    for nid in apoyos:
        por = {}
        for c in usadas:
            try:
                r = R.node_reaction(nid, c)
                por[c] = [round(r.fx, 4), round(r.fy, 4), round(r.fz, 4),
                          round(r.mx, 4), round(r.my, 4), round(r.mz, 4)]
            except Exception:
                pass
        if por:
            x, y, z = coords.get(nid, (0, 0, 0))
            reacciones.append({'nudo': nid, 'x': round(x, 4), 'y': round(y, 4), 'z': round(z, 4),
                               'por': por})

    # ── Escribir ─────────────────────────────────────────────
    salida = {
        'formato': 'auxiliar-iv/ram', 'version': VERSION,
        'modelo': {
            'titulo': m.title or '', 'unidades': unidades,
            'generado': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'nudos_total': len(nudos), 'miembros_total': len(todos),
        },
        'campos_est': ['x', 'm33min', 'm33max', 'v2min', 'v2max', 'axmin', 'axmax'],
        'casos': casos, 'combinaciones': combos, 'envueltas': usadas,
        'nudos': nudos, 'miembros': miembros, 'reacciones': reacciones,
        'saltados': {'sin_longitud': sin_largo, 'sin_resultados': sin_result, 'motivos': motivos},
    }

    carpeta = CARPETA or os.path.join(os.path.expanduser('~'), 'Desktop')
    if not os.path.isdir(carpeta):
        os.makedirs(carpeta)
    ruta = os.path.join(carpeta, ARCHIVO)
    with open(ruta, 'wb') as f:
        f.write(json.dumps(salida, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))

    dt = time.perf_counter() - t0
    n_est = sum(len(x['est']) for x in miembros)
    log(u'')
    log(u'Grupos: %s' % u', '.join(u'%s(%d)' % (g, n) for g, n in sorted(grupos.items(), key=lambda kv: -kv[1])))
    log(u'%d miembros · %d estaciones guardadas (%.1f por miembro) · %d reacciones'
        % (len(miembros), n_est, n_est / float(len(miembros) or 1), len(reacciones)))
    if sin_largo or sin_result:
        log(u'')
        log(u'SALTADOS: %d sin longitud, %d sin resultados' % (len(sin_largo), len(sin_result)))
        if sin_largo:
            log(u'  sin longitud (nudos i y j en el mismo punto, o sin coordenadas): %s%s'
                % (sin_largo[:15], u' …' if len(sin_largo) > 15 else u''))
        if sin_result:
            log(u'  sin resultados: %s%s' % (sin_result[:15], u' …' if len(sin_result) > 15 else u''))
        for k, v in sorted(motivos.items(), key=lambda kv: -kv[1]):
            log(u'  motivo (%d veces): %s' % (v, k))

    log(u'')
    log(u'ESTACIONES POR GRUPO (mín / media / máx) — si salen 2 o 3, la curva es plana:')
    for g in sorted(est_por_grupo, key=lambda g: -len(est_por_grupo[g])):
        v = est_por_grupo[g]
        log(u'  %-8s %4d miembros   %2d / %4.1f / %3d' % (g, len(v), min(v), sum(v) / float(len(v)), max(v)))
    log(u'%.1f s · %.1f KB' % (dt, os.path.getsize(ruta) / 1024.0))
    log(u'')
    log(u'>>> %s' % ruta)
    log(u'>>> En la app: Sincronizar con RAM')


try:
    main()
except Exception as e:
    import traceback
    print(u'ERROR: %s: %s' % (type(e).__name__, e))
    traceback.print_exc()

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
# CARPETA manda sobre todo lo demás:
#   None          la primera vez abre el explorador, y RECUERDA lo que elijas
#   'preguntar'   vuelve a preguntar (para cambiarla)
#   r'C:\\ruta'    esa y sin preguntar
CARPETA = None
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
DEFLEXIONES = True      # flechas: desplazamientos de las trabes por caso de carga (módulo Deflexiones)
EST_FLECHA = 11         # estaciones por trabe para las flechas
FLEXO = True            # columnas: P, M22 y M33 simultáneos por combinación (Columnas y Agrupación)

import json
import os
import re
import sys
import time

VERSION = 1


def log(*a):
    print(u' '.join(str(x) for x in a))


# ── Dónde dejar el modelo.json ────────────────────────────────
# Se pregunta una vez y se guarda en el perfil del usuario, para que a partir
# de entonces correr el script sea de verdad un solo gesto.
def _config():
    base = os.environ.get('APPDATA') or os.path.expanduser('~')
    return os.path.join(base, 'AuxiliarIV', 'ram_sync.json')


def _ruta_txt():
    u"""Un .txt con la ruta y nada más: sin comillas, sin escapes, sin JSON."""
    base = os.environ.get('APPDATA') or os.path.expanduser('~')
    return os.path.join(base, 'AuxiliarIV', 'carpeta.txt')


def _leer_txt():
    try:
        with open(_ruta_txt(), 'rb') as f:
            texto = f.read().decode('utf-8-sig', 'replace')
    except Exception:
        return None
    for linea in texto.splitlines():
        linea = linea.strip().strip('"').strip(u"'")
        if linea and not linea.startswith('#'):
            return os.path.normpath(linea)
    return None


def _plantilla_txt():
    u"""Deja el archivo listo para pegar la ruta dentro."""
    ruta = _ruta_txt()
    if os.path.exists(ruta):
        return ruta
    try:
        carp = os.path.dirname(ruta)
        if not os.path.isdir(carp):
            os.makedirs(carp)
        with open(ruta, 'wb') as f:
            f.write((
                u'# Auxiliar IV — dónde dejar el modelo.json\n'
                u'#\n'
                u'# Pega abajo la ruta de la carpeta, tal cual la copias del\n'
                u'# explorador de Windows. Sin comillas y sin tocar nada más.\n'
                u'# Ejemplo:\n'
                u'#   C:\\Users\\Admin\\OneDrive\\PROCESO\\Reportes de Secciones RAM\n'
                u'\n'
            ).encode('utf-8'))
        return ruta
    except Exception:
        return None


def _leer_config():
    try:
        with open(_config(), 'rb') as f:
            return json.loads(f.read().decode('utf-8'))
    except Exception:
        return {}


def _guardar_config(d):
    try:
        carp = os.path.dirname(_config())
        if not os.path.isdir(carp):
            os.makedirs(carp)
        with open(_config(), 'wb') as f:
            f.write(json.dumps(d, ensure_ascii=False, indent=2).encode('utf-8'))
        return True
    except Exception:
        return False


def carpeta_del_modelo():
    u"""
    Dónde está el .retx abierto. La API no lo dice, pero RAM guarda los
    recientes en su Recents.xml y leer un archivo sí está permitido.
    """
    base = os.environ.get('APPDATA')
    if not base:
        return None
    raiz = os.path.join(base, 'Bentley', 'Engineering', 'RAM Elements')
    if not os.path.isdir(raiz):
        return None
    candidatos = []
    for dirpath, _dirs, files in os.walk(raiz):
        for f in files:
            if f.lower() == 'recents.xml':
                ruta = os.path.join(dirpath, f)
                try:
                    candidatos.append((os.path.getmtime(ruta), ruta))
                except Exception:
                    pass
    if not candidatos:
        return None
    candidatos.sort(reverse=True)
    try:
        with open(candidatos[0][1], 'rb') as f:
            txt = f.read().decode('utf-8', 'replace')
    except Exception:
        return None
    import re
    for m in re.finditer(r'([A-Za-z]:\\[^<>"\r\n]+?\.ret[xs]?)', txt):
        # el separador se quita a mano: os.path.dirname sólo entiende el del
        # sistema donde corre, y aquí la ruta siempre es de Windows
        carp = re.sub(r'[\\/][^\\/]*$', '', m.group(1))
        if carp and os.path.isdir(carp):
            return carp
    return None


def resolver_carpeta():
    u"""
    La carpeta de destino. Sin diálogo posible, el orden es:
      1. CARPETA, si la pusiste arriba (lo normal, y queda para siempre)
      2. la que se guardó la última vez
      3. la carpeta del modelo abierto, leyendo los recientes de RAM
      4. el Escritorio, avisando de que hay que poner CARPETA
    """
    cfg = _leer_config()
    guardada = cfg.get('carpeta')
    if CARPETA and CARPETA != 'preguntar' and str(CARPETA).strip():
        d = os.path.normpath(CARPETA)
        if guardada != d:
            cfg['carpeta'] = d
            _guardar_config(cfg)
        return d, u'la de CARPETA, en el script', True
    delTxt = _leer_txt()
    if delTxt and os.path.isdir(delTxt):
        if guardada != delTxt:
            cfg['carpeta'] = delTxt
            _guardar_config(cfg)
        return delTxt, u'la de carpeta.txt', True
    if delTxt:
        log(u'  (carpeta.txt apunta a %r, que no existe)' % delTxt)
    if guardada and os.path.isdir(guardada):
        return guardada, u'recordada de la vez anterior', True
    delModelo = carpeta_del_modelo()
    if delModelo:
        return delModelo, u'la del modelo, a falta de configuración', False
    return os.path.join(os.path.expanduser('~'), 'Desktop'), u'el Escritorio, a falta de algo mejor', False


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
# La longitud sale de las coordenadas de los nudos y puede quedar un pelo por
# encima de la que la API tiene por dentro; entonces la última estación cae
# fuera y RAM rechaza LA LLAMADA ENTERA:
#     ValueError: station_x 5.47003 is out of range [0, 5.47003]
# Por eso los extremos se meten 0.1 mm hacia dentro. A efectos de diseño no
# cambia nada (con V = 2 t son 0.0002 t·m) y evita perder el miembro completo.
EPS = 1e-4


def acotar(x, L):
    e = min(EPS, L * 0.001)
    return min(max(x, e), L - e)


def estaciones(L):
    n = int(round(L / PASO_M)) + 1
    n = max(MIN_EST, min(MAX_EST, n))
    return [acotar(i * L / (n - 1.0), L) for i in range(n)]


def pedir(R, mid, combo, xs, L):
    u"""Pide las fuerzas; si el rango sigue sin gustarle, encoge y reintenta."""
    try:
        return R.member_forces_at_station(mid, combo, xs)
    except ValueError:
        e = max(EPS, L * 1e-4)
        xs2 = [min(max(x, e), L - e) for x in xs]
        return R.member_forces_at_station(mid, combo, xs2)


def alrededor(xs, i, L, n=11):
    u"""Un entorno fino entre los vecinos de xs[i], para afinar un extremo."""
    a = xs[max(0, i - 1)]
    b = xs[min(len(xs) - 1, i + 1)]
    if b <= a:
        return []
    return [a + k * (b - a) / (n - 1.0) for k in range(1, n - 1)]


# ── Columnas: las fuerzas SIMULTÁNEAS ─────────────────────────
# La envolvente de arriba guarda el máximo de cada fuerza por su lado, y en
# una trabe eso basta. En una columna no: el diagrama de interacción pide el
# P que va JUNTO con sus M22 y M33 en la misma combinación, y el P máximo casi
# nunca viene con el momento máximo. Por eso, en cada columna y en cada
# combinación, se guardan los extremos (y el punto de en medio si ahí el
# momento es mayor). Sale del mismo barrido: no cuesta llamadas a RAM.
CAMPOS_FLEXO = ['x', 'combo', 'axial', 'm22', 'm33', 'v2', 'v3']


def _es_columna(a, b):
    u"""Vertical (Y es la vertical en RAM)."""
    dh = ((b[0] - a[0]) ** 2 + (b[2] - a[2]) ** 2) ** 0.5
    return dh <= 0.1 and abs(b[1] - a[1]) > 0.1


def flexo(xs, por_combo, usadas):
    u"""[[x, i de la combinación en 'envueltas', axial, M22, M33, V2, V3], …]"""
    out = []
    n = len(xs)
    for ci, c in enumerate(usadas):
        d = por_combo.get(c)
        if not d or n < 2:
            continue
        mom = [(float(d[i].M22) ** 2 + float(d[i].M33) ** 2) ** 0.5 for i in range(n)]
        idx = [0, n - 1]
        k = max(range(n), key=lambda i: mom[i])
        if 0 < k < n - 1 and mom[k] > 1.05 * max(mom[0], mom[-1]):
            idx.insert(1, k)
        for i in idx:
            f = d[i]
            out.append([round(xs[i], 3), ci, round(float(f.axial), 3), round(float(f.M22), 3), round(float(f.M33), 3),
                        round(float(f.V2), 3), round(float(f.V3), 3)])
    return out


# ── Las medidas REALES de cada sección ────────────────────────
# El nombre de una sección puede mentir: «RCBEAM 20X25» estaba dada de alta
# con b = 25 y h = 20, y RAM analiza con la tabla, no con el nombre. Las
# tablas son texto plano, así que se leen y se manda a la app lo que RAM usó.
# Por orden de preferencia:
#   1. la copia que guarda el propio modelo (ZipTemp), si es la del abierto
#   2. los grupos del usuario (ProgramData: Personales, NTC…)
#   3. los de la instalación
A_CM = {'cm': 1.0, 'mm': 0.1, 'm': 100.0, 'in': 2.54, 'ft': 30.48}


def _normal(nombre):
    u"""'COL  25 X 10' y 'col 25 x 10' son la misma: RAM no distingue."""
    return u' '.join((u'%s' % nombre).split()).lower()


def _leer_sec(ruta):
    u"""Filas de una tabla .sec: [(nombre, b, h, s en cm, plantilla)]."""
    try:
        with open(ruta, 'rb') as f:
            crudo = f.read()
    except Exception:
        return []
    try:
        texto = crudo.decode('utf-8')
    except UnicodeDecodeError:
        texto = crudo.decode('cp1252', 'replace')
    plantilla, enc, out = u'', None, []
    for linea in texto.splitlines():
        if not linea.strip() or linea.startswith(u'//'):
            continue
        if linea.startswith(u'['):
            plantilla = linea.strip(u'[] ')
            continue
        partes = linea.split(u'\t')
        if enc is None:
            enc = [x.strip().lower() for x in partes]
            continue
        fila = dict(zip(enc, partes))
        try:
            k = A_CM.get(fila.get('unit', 'cm').strip().lower(), 1.0)
            out.append((fila.get('name', u'').strip(), float(fila['b']) * k, float(fila['h']) * k,
                        float(fila.get('s') or 0) * k, plantilla))
        except (KeyError, ValueError):
            continue
    return out


def _modelo_reciente():
    u"""El nombre (sin extensión) del último modelo que abrió RAM."""
    app = os.environ.get('APPDATA')
    raiz = os.path.join(app, 'Bentley', 'Engineering', 'RAM Elements') if app else None
    if not raiz or not os.path.isdir(raiz):
        return None
    candidatos = []
    for dirpath, _d, files in os.walk(raiz):
        for f in files:
            if f.lower() == 'recents.xml':
                ruta = os.path.join(dirpath, f)
                try:
                    candidatos.append((os.path.getmtime(ruta), ruta))
                except Exception:
                    pass
    if not candidatos:
        return None
    try:
        with open(max(candidatos)[1], 'rb') as f:
            txt = f.read().decode('utf-8', 'replace')
    except Exception:
        return None
    m = re.search(r'[A-Za-z]:[^<>"\r\n]+?\.ret\w*', txt)
    if not m:
        return None
    base = re.split(r'[\\/]', m.group(0))[-1]
    return re.sub(r'\.ret\w*$', '', base, flags=re.I).lower()


def _fuentes_de_secciones():
    u"""[(prioridad, fuente, ruta de la .sec)], la más fiable primero."""
    fuentes = []
    reciente = _modelo_reciente()
    app = os.environ.get('APPDATA')
    raiz = os.path.join(app, 'Bentley', 'Engineering', 'RAM Elements') if app else None
    for dirpath, _d, files in (os.walk(raiz) if raiz and os.path.isdir(raiz) else []):
        if os.path.basename(dirpath).lower() != 'ziptemp':
            continue
        modelos = [re.sub(r'\.ret\w*$', '', f, flags=re.I).lower() for f in files if re.search(r'\.ret\w*$', f, re.I)]
        es_este = bool(reciente) and reciente in modelos
        for d2, _d2, f2 in os.walk(os.path.join(dirpath, 'Sections')):
            for f in f2:
                if f.lower().endswith('.sec'):
                    fuentes.append((0 if es_este else 3, u'el propio modelo' if es_este else u'la copia de otro modelo',
                                    os.path.join(d2, f)))
    pd = os.path.join(os.environ.get('PROGRAMDATA') or u'C:/ProgramData', 'Bentley', 'Engineering', 'RAM Elements')
    for v in (os.listdir(pd) if os.path.isdir(pd) else []):
        for d2, _d2, f2 in os.walk(os.path.join(pd, v, 'Database', 'Sections')):
            for f in f2:
                if f.lower().endswith('.sec'):
                    fuentes.append((1, u'grupo %s' % os.path.basename(d2), os.path.join(d2, f)))
    inst = os.path.join(os.path.dirname(sys.executable), 'Database', 'Sections')
    for d2, _d2, f2 in os.walk(inst):
        for f in f2:
            if f.lower().endswith('.sec'):
                fuentes.append((2, u'instalación, %s' % os.path.basename(d2), os.path.join(d2, f)))
    fuentes.sort(key=lambda x: x[0])
    return fuentes


def medidas_de_secciones(nombres):
    u"""{nombre usado en el modelo: {b, h, s, tipo, fuente, tabla}}."""
    buscar = dict((_normal(n), n) for n in nombres if n)
    hallado = {}
    for _prio, fuente, ruta in _fuentes_de_secciones():
        if len(hallado) == len(buscar):
            break
        for nom, b, h, s_, plantilla in _leer_sec(ruta):
            k = _normal(nom)
            if k not in buscar or buscar[k] in hallado:
                continue
            pl = plantilla.lower()
            hallado[buscar[k]] = {
                'b': round(b, 2), 'h': round(h, 2), 's': round(s_, 2),
                'tipo': 'columna' if 'col' in pl else 'viga' if 'beam' in pl else plantilla,
                'fuente': fuente, 'tabla': os.path.splitext(os.path.basename(ruta))[0],
            }
    return hallado


def _dice_el_nombre(nombre):
    u"""Las dos últimas cifras del nombre: 'RcBeam 20x25' → (20, 25)."""
    nums = re.findall(r'\d+(?:\.\d+)?', u'%s' % nombre)
    return (float(nums[-2]), float(nums[-1])) if len(nums) >= 2 else None


# ── Flechas ───────────────────────────────────────────────────
# Para el módulo Deflexiones: en cada trabe horizontal, el desplazamiento
# vertical y el momento por CASO de carga (no por combinación: la app arma
# las de servicio, CM + CV, con la parte sostenida que toca a largo plazo).
# Los casos de sismo, viento y temperatura no se leen.
_LATERAL = ('SEISM', 'SISM', 'EARTHQ', 'QUAKE', 'WIND', 'VIENTO', 'TEMP')
# Unidades de longitud que podría tener el desplazamiento: unidades por metro
_UNIDADES = ((1.0, 'm'), (100.0, 'cm'), (1000.0, 'mm'), (39.3701, 'in'), (3.28084, 'ft'))


def _es_lateral(c):
    t = (u'%s %s' % (c.get('categoria', ''), c.get('descripcion', ''))).upper()
    if any(k in t for k in _LATERAL):
        return True
    return bool(re.match(r'^S[XYZ]', str(c.get('id', '')).upper()))


def _factor_ig(mb):
    u"""El factor de inercia que RAM le aplica al miembro (1 = sin reducir)."""
    try:
        sf = mb.get_stiffness_factors()
        ig = float(sf[0]) if isinstance(sf, (tuple, list)) else float(getattr(sf, 'ig'))
        return ig if 0 < ig < 1 else 1.0
    except Exception:
        return 1.0


def flechas(m, R, miembros, coords, casos, log=log):
    u"""Agrega a cada trabe horizontal su 'def' (x, dy en cm, momento por caso) y su 'ig'."""
    grav = [c for c in casos if not _es_lateral(c)]
    if not grav:
        log(u'Flechas: el modelo no tiene casos de carga gravitacionales sueltos (sólo combinaciones o sismo).')
        return None
    ids = [c['id'] for c in grav]
    por_id = dict((int(mb.id), mb) for mb in m.members)
    muestras = []       # (pendiente de la flecha, giro global que la predice, giro local)
    crudos = []
    for x in miembros:
        a, b = coords.get(x['ni']), coords.get(x['nj'])
        if not a or not b:
            continue
        dh = ((b[0] - a[0]) ** 2 + (b[2] - a[2]) ** 2) ** 0.5
        if abs(b[1] - a[1]) > 0.01 or dh < 0.05:
            continue                    # sólo trabes horizontales (Y es la vertical en RAM)
        ux, uz = (b[0] - a[0]) / dh, (b[2] - a[2]) / dh
        L = x['L']
        xs = [acotar(L * i / float(EST_FLECHA - 1), L) for i in range(EST_FLECHA)]
        dy, mm = {}, {}
        for c in ids:
            try:
                d = list(R.member_displacements_at_station(x['id'], c, xs))
                f = pedir(R, x['id'], c, xs, L)
            except Exception:
                continue
            dy[c] = [float(v.dy) for v in d]
            mm[c] = [round(float(v.M33), 4) for v in f]
            # La unidad del desplazamiento no se adivina: su pendiente a lo largo
            # de la trabe es el giro, y los giros van en radianes.
            if len(muestras) < 600:
                for i in range(len(xs) - 1):
                    ds = xs[i + 1] - xs[i]
                    if ds <= 1e-6:
                        continue
                    pend = (d[i + 1].dy - d[i].dy) / ds
                    gg = 0.5 * ((-uz * d[i].rx + ux * d[i].rz) + (-uz * d[i + 1].rx + ux * d[i + 1].rz))
                    gl = 0.5 * (d[i].rz + d[i + 1].rz)
                    muestras.append((pend, gg, gl))
        if not dy:
            continue
        x['def'] = {'x': [round(v, 4) for v in xs], 'dy': dy, 'm': mm}
        ig = _factor_ig(por_id.get(x['id']))
        if ig < 1:
            x['ig'] = round(ig, 4)
        crudos.append(x)
    if not crudos:
        log(u'Flechas: RAM no devolvió desplazamientos de ninguna trabe.')
        return None

    def escala(k):
        rs = sorted(abs(s_[0] / s_[k]) for s_ in muestras if abs(s_[k]) > 1e-7 and abs(s_[0]) > 1e-12)
        if len(rs) < 5:
            return None, 0.0
        med = rs[len(rs) // 2]
        return med, sum(1 for r in rs if abs(r - med) <= 0.1 * med) / float(len(rs))
    g, dg = escala(1)
    l, dl = escala(2)
    med, disp, ejes = (g, dg, u'globales') if dg >= dl else (l, dl, u'locales')
    unidad, comprobada = u'm', False
    if med:
        import math
        k, unidad = min(_UNIDADES, key=lambda u: abs(math.log(med / u[0])))
        comprobada = abs(math.log(med / k)) < 0.15 and disp >= 0.6
    else:
        k = 1.0
    if not comprobada:
        k = 1.0
        unidad = u'm'
    a_cm = 100.0 / k
    for x in crudos:
        x['def']['dy'] = dict((c, [round(v * a_cm, 5) for v in vals]) for c, vals in x['def']['dy'].items())
    log(u'')
    log(u'FLECHAS: %d trabes · casos %s' % (len(crudos), u', '.join(ids)))
    if comprobada:
        log(u'  desplazamientos de RAM en %s (comprobado con los giros, ejes %s, %d %% de las muestras)'
            % (unidad, ejes, round(disp * 100)))
    else:
        log(u'  ⚠ no se pudo comprobar la unidad de los desplazamientos con los giros: se tomaron en metros.')
        log(u'    Revisa en la app que las flechas tengan sentido antes de usarlas.')
    return {
        'casos': grav, 'unidad': 'cm', 'desde': unidad, 'comprobada': comprobada,
        'ejes': ejes, 'dispersion': round(disp, 3), 'trabes': len(crudos), 'estaciones': EST_FLECHA,
    }


def exportar(destino, log=log):
    u"""Lee el modelo y escribe el .json. Devuelve el resumen para el panel."""
    t0 = time.perf_counter()
    import ramelements
    m = ramelements.model()
    R = m.results

    unidades = str(getattr(m.units, 'current', '?'))
    log(u'Modelo: %r · unidades %s' % (m.title or u'(sin título)', unidades))
    if 'TON' not in unidades.upper():
        log(u'    (se puede cambiar con m.units.set(ramelements.Units.TON_M),')
        log(u'     pero eso toca TU modelo, así que lo dejo en tus manos)')
    if 'TON' not in unidades.upper():
        log(u'  ⚠ AVISO: la app espera Ton-m. Cambia las unidades del modelo o los')
        log(u'    números entrarán con otra escala.')

    # ── ¿Está corrido el análisis? ───────────────────────────
    # Preguntarlo ahora y con nombre y apellido, en vez de acabar con 1401
    # miembros «sin resultados» y sin saber por qué.
    try:
        primero = next(iter(m.members))
        m.results.member_end_forces(primero.id, next(iter(m.load_condition)).id)
    except StopIteration:
        raise RuntimeError(u'El modelo no tiene miembros o no tiene casos de carga.')
    except Exception as e:
        if 'AnalysisNotRun' in type(e).__name__:
            raise RuntimeError(
                u'El análisis todavía no se ha corrido: no hay resultados que exportar.\n'
                u'    Corre el análisis en RAM (o m.analyze() aquí) y vuelve a intentarlo.')
        # otra cosa: que siga y que cada miembro lo reporte por su cuenta

    # ── ¿Estamos midiendo la misma longitud que RAM? ─────────
    # La documentación de Bentley dice que member.node_i / node_j son «node
    # INDICES»; el modelo real devuelve números que encajan como IDs. Si nos
    # equivocáramos, emparejaríamos nudos que no son y todas las longitudes
    # saldrían mal, en silencio.
    #
    # Hay una forma de preguntárselo a RAM: rechaza cualquier estación fuera
    # de [0, L]. Si acepta una un 5 % más allá de la L que calculamos con las
    # coordenadas, es que su miembro es más largo — y no estamos midiendo lo
    # mismo.
    def verificar_longitudes(muestra=25):
        todos_mb = list(m.members)
        if not todos_mb:
            return []
        paso = max(1, len(todos_mb) // muestra)
        combo0 = usadas[0]
        malos = []
        for mb in todos_mb[::paso][:muestra]:
            L = largo(mb)
            if L <= 0.01:
                continue
            try:
                m.results.member_forces_at_station(int(mb.id), combo0, [L * 1.05])
                malos.append((int(mb.id), L))     # lo aceptó: RAM lo tiene más largo
            except Exception:
                pass                               # lo rechazó: vamos bien
        return malos

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

    malos = verificar_longitudes()
    if malos:
        log(u'')
        log(u'  ⚠⚠ LAS LONGITUDES NO CUADRAN CON LAS DE RAM ⚠⚠')
        log(u'  RAM acepta estaciones más allá de la longitud que calculamos con')
        log(u'  las coordenadas de los nudos, en %d de los miembros de muestra:' % len(malos))
        for mid, L in malos[:5]:
            log(u'     miembro %s: medimos %.4f m' % (mid, L))
        log(u'  Puede que node_i/node_j sean índices y no ids. NO uses este')
        log(u'  archivo hasta aclararlo: los momentos estarían mal ubicados.')
        log(u'')
    else:
        log(u'Longitudes verificadas contra RAM (muestra de miembros): coinciden')

    # ── Miembros ─────────────────────────────────────────────
    miembros = []
    grupos = {}
    # Saltar miembros en silencio esconde problemas: se apunta el motivo y el id.
    sin_largo, sin_result, motivos = [], [], {}
    est_por_grupo = {}
    n_flexo = 0
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
                por_combo[c] = pedir(R, mid, c, xs, L)
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

        # columnas: las fuerzas simultáneas de cada combinación, antes de afinar
        fl = None
        if FLEXO:
            a_, b_ = coords.get(int(mb.node_i)), coords.get(int(mb.node_j))
            if a_ and b_ and _es_columna(a_, b_):
                try:
                    fl = flexo(xs, por_combo, usadas)
                except Exception as e:
                    clave = u'fuerzas de columna, %s: %s' % (type(e).__name__, e)
                    motivos[clave] = motivos.get(clave, 0) + 1

        # 2) afinar alrededor de los extremos: el pico casi nunca cae en la
        #    rejilla, y es justo el valor con el que se diseña
        extras = []
        for serie, quien in ((m33max, max), (m33min, min), (v2max, max), (v2min, min)):
            i = serie.index(quien(serie))
            extras.extend(alrededor(xs, i, L))
        extras = sorted(set(round(acotar(x, L), 5) for x in extras))
        if extras:
            finos = {}
            for c in usadas:
                try:
                    finos[c] = pedir(R, mid, c, extras, L)
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
        if fl:
            miembros[-1]['flexo'] = fl
            n_flexo += 1
        grupos[grupo] = grupos.get(grupo, 0) + 1
        est_por_grupo.setdefault(grupo, []).append(len(est))
        if (k + 1) % 200 == 0:
            log(u'  … %d/%d miembros' % (k + 1, len(todos)))

    # ── Flechas (nunca tumban la sincronización) ─────────────
    deflexiones = None
    if DEFLEXIONES:
        t1 = time.perf_counter()
        try:
            deflexiones = flechas(m, R, miembros, coords, casos, log)
        except Exception as e:
            log(u'  (no se pudieron leer los desplazamientos: %s: %s)' % (type(e).__name__, e))
        if deflexiones:
            log(u'  %.1f s' % (time.perf_counter() - t1))

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

    # ── Las medidas reales de las secciones que se usan ──────
    # Nunca tumba la sincronización: si algo falla, la app deduce del nombre
    try:
        secciones = medidas_de_secciones(set(x['seccion'] for x in miembros))
    except Exception as e:
        secciones = {}
        log(u'  (no se pudieron leer las tablas de secciones: %s)' % e)

    # ── Escribir ─────────────────────────────────────────────
    salida = {
        'formato': 'auxiliar-iv/ram', 'version': VERSION,
        'modelo': {
            'titulo': m.title or '', 'unidades': unidades,
            'generado': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'nudos_total': len(nudos), 'miembros_total': len(todos),
        },
        'campos_est': ['x', 'm33min', 'm33max', 'v2min', 'v2max', 'axmin', 'axmax'],
        'campos_flexo': CAMPOS_FLEXO,
        'casos': casos, 'combinaciones': combos, 'envueltas': usadas,
        'nudos': nudos, 'miembros': miembros, 'reacciones': reacciones,
        'secciones': secciones,
        'deflexiones': deflexiones,
        'saltados': {'sin_longitud': sin_largo, 'sin_resultados': sin_result, 'motivos': motivos},
    }

    carpeta = destino
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
    if FLEXO:
        log(u'COLUMNAS: %d miembros verticales con P, M22 y M33 simultáneos en %d combinaciones'
            % (n_flexo, len(usadas)))
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

    usadas_sec = sorted(set(x['seccion'] for x in miembros))
    log(u'')
    log(u'SECCIONES: %d en uso · %d con sus medidas reales leídas de las tablas de RAM'
        % (len(usadas_sec), len(secciones)))
    for nom in usadas_sec:
        d = secciones.get(nom)
        if not d:
            log(u'  %-16s sin tabla: la app deducirá las medidas del nombre' % nom)
            continue
        dice = _dice_el_nombre(nom)
        ojo = u''
        if dice and (d['b'], d['h']) != dice and (d['h'], d['b']) == dice:
            ojo = u'   ⚠ INVERTIDA: el nombre dice %g×%g' % dice
        elif dice and (d['b'], d['h']) != dice:
            ojo = u'   ⚠ el nombre dice %g×%g' % dice
        log(u'  %-16s b %-5g h %-5g s %-4g %-8s (%s)%s' % (nom, d['b'], d['h'], d['s'], d['tipo'], d['fuente'], ojo))

    log(u'')
    log(u'ESTACIONES POR GRUPO (mín / media / máx) — si salen 2 o 3, la curva es plana:')
    for g in sorted(est_por_grupo, key=lambda g: -len(est_por_grupo[g])):
        v = est_por_grupo[g]
        log(u'  %-8s %4d miembros   %2d / %4.1f / %3d' % (g, len(v), min(v), sum(v) / float(len(v)), max(v)))
    log(u'%.1f s · %.1f KB' % (dt, os.path.getsize(ruta) / 1024.0))
    log(u'')
    log(u'>>> %s' % ruta)
    log(u'>>> En la app: Sincronizar con RAM')
    return {
        'ruta': ruta, 'miembros': len(miembros), 'grupos': grupos,
        'estaciones': n_est, 'reacciones': len(reacciones), 'nudos': len(nudos),
        'segundos': dt, 'kb': os.path.getsize(ruta) / 1024.0,
        'saltados': len(sin_largo) + len(sin_result),
    }


def main():
    destino, comoSalio, configurada = resolver_carpeta()
    log(u'Destino: %s  (%s)' % (destino, comoSalio))
    if not configurada:
        ruta = _plantilla_txt()
        log(u'')
        log(u'  ┌─ Para que caiga donde la app la busca, pega la ruta en:')
        log(u'  │    %s' % (ruta or _ruta_txt()))
        log(u'  │  Tal cual la copias del explorador, sin comillas. Se hace')
        log(u'  │  una vez. (Aquí no hay explorador: RAM no lo permite.)')
        log(u'  └─')
        log(u'')
    exportar(destino)


try:
    main()
except Exception as e:
    import traceback
    print(u'ERROR: %s: %s' % (type(e).__name__, e))
    traceback.print_exc()

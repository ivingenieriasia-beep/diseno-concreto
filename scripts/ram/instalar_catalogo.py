# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Instala el catálogo de la casa en el grupo «Personales» de RAM.

Da de alta las secciones (vigas y columnas de concreto), los concretos y la
mampostería para placas (tabique, block hueco, block macizo y Covintec) del
catálogo de la app. Es una vez por computadora: los grupos son de RAM, no
del proyecto, así que a partir de aquí todos los modelos los tienen.

Qué hace, y qué no:
  · ESCRIBE las tablas del grupo Personales (lo crea si no existe):
      Sections / Personales / Vigas de Concreto.sec
      Sections / Personales / Columnas de Concreto.sec
      Materials / Personales / Concreto.mat
      Materials / Personales / Mampostería de barro.mat      (tabique)
      Materials / Personales / Mampostería de concreto.mat   (blocks, Covintec)
  · La mampostería copia el formato de las tablas de RAM «Masonry clay» y
    «Masonry concrete» (grupo United States): sus columnas, y de su fila más
    parecida lo que no es de la NTC. Sólo cambia E, G, ν, peso, α, f'm y fy,
    ya en las unidades de esa fila. Imprime qué columna llenó con qué.
  · FUSIONA, no sustituye: lo que ya tenías se queda. Si una fila se llama
    igual que una del catálogo, manda la del catálogo (así se corrige el
    F'C 250 que traía f'c = 281 de la plantilla US).
  · Antes de tocar nada deja en el Escritorio una copia de cada tabla
    original («Respaldo RAM - Sections - Personales - Vigas de Concreto.sec»…).
    El primer respaldo nunca se pisa. Para deshacer: copia esos archivos de
    vuelta a su carpeta, quitándoles el prefijo.
  · No toca el grupo NTC ni los de la instalación.

Ábrelo con Abrir Script… (pegado en el editor se descompone la sangría) y
Ctrl+R. Si las secciones no aparecen enseguida, cierra y vuelve a abrir RAM.
"""

import os
import re
import sys

# qué instalador es: sale en el encabezado de la salida (si dice otra cosa,
# se corrió un archivo viejo)
VERSION = u'3.06 · rev. 2 (lee las tablas de fábrica sin «//infotable»)'

# ── El catálogo (lo escribe la app desde catalogoRam.js; no hace falta tocarlo)
CATALOGO = {
 "retirar": [
  {
   "tabla": "Columnas de Concreto",
   "nombre": "25 X 10",
   "b": 25,
   "h": 10,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "36 X 36",
   "b": 36,
   "h": 36,
   "s": 3
  }
 ],
 "secciones": [
  {
   "tabla": "Vigas de Concreto",
   "nombre": "10 X 25",
   "b": 10,
   "h": 25,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "15 X 20",
   "b": 15,
   "h": 20,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "15 X 25",
   "b": 15,
   "h": 25,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "15 X 30",
   "b": 15,
   "h": 30,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "15 X 35",
   "b": 15,
   "h": 35,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "15 X 40",
   "b": 15,
   "h": 40,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "15 X 45",
   "b": 15,
   "h": 45,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "20 X 20",
   "b": 20,
   "h": 20,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "20 X 25",
   "b": 20,
   "h": 25,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "20 X 30",
   "b": 20,
   "h": 30,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "20 X 35",
   "b": 20,
   "h": 35,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "20 X 40",
   "b": 20,
   "h": 40,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "20 X 45",
   "b": 20,
   "h": 45,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "20 X 50",
   "b": 20,
   "h": 50,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "25 X 20",
   "b": 25,
   "h": 20,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "25 X 25",
   "b": 25,
   "h": 25,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "25 X 30",
   "b": 25,
   "h": 30,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "25 X 35",
   "b": 25,
   "h": 35,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "25 X 40",
   "b": 25,
   "h": 40,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "25 X 45",
   "b": 25,
   "h": 45,
   "s": 3
  },
  {
   "tabla": "Vigas de Concreto",
   "nombre": "25 X 50",
   "b": 25,
   "h": 50,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 15 X 15",
   "b": 15,
   "h": 15,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 15 X 20",
   "b": 15,
   "h": 20,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 15 X 25",
   "b": 15,
   "h": 25,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 20 X 20",
   "b": 20,
   "h": 20,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 20 X 25",
   "b": 20,
   "h": 25,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 25 X 10",
   "b": 25,
   "h": 10,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 25 X 25",
   "b": 25,
   "h": 25,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 30 X 30",
   "b": 30,
   "h": 30,
   "s": 3
  },
  {
   "tabla": "Columnas de Concreto",
   "nombre": "COL 36 X 36",
   "b": 36,
   "h": 36,
   "s": 3
  }
 ],
 "materiales": [
  {
   "nombre": "F'C 200",
   "U": "0.2",
   "W": "0.0024",
   "Alpha": "1E-5",
   "E": "113137.08498984762",
   "FyH": "4200",
   "factorTor": "0.05",
   "FcH": "200",
   "Es": "2040000",
   "FytH": "4200",
   "RCRegion": "US"
  },
  {
   "nombre": "F'C 250",
   "U": "0.2",
   "W": "0.0024",
   "Alpha": "1E-5",
   "E": "221359.43621178655",
   "FyH": "4200",
   "factorTor": "0.05",
   "FcH": "250",
   "Es": "2040000",
   "FytH": "4200",
   "RCRegion": "US"
  },
  {
   "nombre": "F'C 300",
   "U": "0.2",
   "W": "0.0024",
   "Alpha": "1E-5",
   "E": "242487.11305964284",
   "FyH": "4200",
   "factorTor": "0.05",
   "FcH": "300",
   "Es": "2040000",
   "FytH": "4200",
   "RCRegion": "US"
  },
  {
   "nombre": "F'C 350",
   "U": "0.2",
   "W": "0.0024",
   "Alpha": "1E-5",
   "E": "261916.0170741759",
   "FyH": "4200",
   "factorTor": "0.05",
   "FcH": "350",
   "Es": "2040000",
   "FytH": "4200",
   "RCRegion": "US"
  },
  {
   "nombre": "F'C 400",
   "U": "0.2",
   "W": "0.0024",
   "Alpha": "1E-5",
   "E": "280000",
   "FyH": "4200",
   "factorTor": "0.05",
   "FcH": "400",
   "Es": "2040000",
   "FytH": "4200",
   "RCRegion": "US"
  }
 ],
 "mamposteria": [
  {
   "nombre": "TABIQUE",
   "tabla": "Mampostería de barro",
   "plantilla": "clay",
   "E": 9000,
   "G": 3600,
   "U": 0.25,
   "W": 0.0015,
   "Alpha": 0.0000072,
   "Fm": 15,
   "Fy": 4200
  },
  {
   "nombre": "BLOCK HUECO",
   "tabla": "Mampostería de concreto",
   "plantilla": "concrete",
   "E": 12000,
   "G": 4800,
   "U": 0.25,
   "W": 0.0014,
   "Alpha": 0.0000081,
   "Fm": 15,
   "Fy": 4200
  },
  {
   "nombre": "BLOCK MACIZO",
   "tabla": "Mampostería de concreto",
   "plantilla": "concrete",
   "E": 12000,
   "G": 4800,
   "U": 0.25,
   "W": 0.0021,
   "Alpha": 0.0000081,
   "Fm": 15,
   "Fy": 4200
  },
  {
   "nombre": "COVINTEC",
   "tabla": "Mampostería de concreto",
   "plantilla": "concrete",
   "E": 32000,
   "G": 13333.333333333334,
   "U": 0.2,
   "W": 0.0012,
   "Alpha": 0.00001,
   "Fm": 40,
   "Fy": 4200
  }
 ]
}
# ── fin del catálogo

LEO = {u'Vigas de Concreto': u'[RcBeamR.leo]', u'Columnas de Concreto': u'[RcColR.leo]'}
ENC_SECCION = [u'Name', u'Local', u'Qmod2exact', u'Unit', u'b', u'h', u's']
LEO_MAT = u'[Reinforced concrete]'
ENC_MATERIAL = [u'Name', u'Unit', u'U', u'W', u'Alpha', u'E', u'FyH', u'factorTor', u'FcH', u'Es', u'FytH', u'RCRegion']
FIN = u'\r\n'


def log(*a):
    print(u' '.join(str(x) for x in a))


def base_de_datos():
    u"""La carpeta Database de la versión de RAM más reciente."""
    raiz = os.path.join(os.environ.get('PROGRAMDATA') or u'C:/ProgramData', 'Bentley', 'Engineering', 'RAM Elements')
    versiones = []
    for v in (os.listdir(raiz) if os.path.isdir(raiz) else []):
        if os.path.isdir(os.path.join(raiz, v, 'Database')):
            clave = tuple(int(x) if x.isdigit() else 0 for x in v.split('.'))
            versiones.append((clave, v))
    if not versiones:
        return None
    return os.path.join(raiz, max(versiones)[1], 'Database')


def decodificar(crudo):
    u"""(texto, codificación). Las tablas que escribe RAM van en UTF-8 o ANSI sin
    marca; las de fábrica pueden traer BOM o venir en UTF-16: se respeta."""
    if crudo[:2] in (b'\xff\xfe', b'\xfe\xff'):
        return crudo.decode('utf-16'), 'utf-16'
    if crudo[:3] == b'\xef\xbb\xbf':
        return crudo[3:].decode('utf-8', 'replace'), 'utf-8-sig'
    # UTF-16 sin marca: medio archivo son ceros
    if crudo[:200].count(b'\x00') > len(crudo[:200]) // 3:
        for cod in ('utf-16-le', 'utf-16-be'):
            try:
                return crudo.decode(cod), cod
            except UnicodeDecodeError:
                pass
    for cod in ('utf-8', 'cp1252'):
        try:
            return crudo.decode(cod), cod
        except UnicodeDecodeError:
            pass
    return crudo.decode('latin-1'), 'latin-1'


def leer_tabla(ruta):
    u"""(encabezado, filas como dicts, codificación) — o None si no existe."""
    if not os.path.isfile(ruta):
        return None
    with open(ruta, 'rb') as f:
        crudo = f.read()
    texto, cod = decodificar(crudo)
    lineas = [l.rstrip(u'\r').lstrip(u'\ufeff') for l in texto.split(u'\n')]
    enc, filas = None, []
    for l in lineas:
        if not l.strip() or l.startswith(u'//') or l.startswith(u'['):
            continue
        partes = l.split(u'\t')
        if enc is None:
            enc = partes
            continue
        partes += [u''] * (len(enc) - len(partes))
        filas.append(dict(zip(enc, partes)))
    return enc, filas, cod, crudo


def escribir_tabla(ruta, leo, enc, filas, cod):
    lineas = [u'//infotable version=2.0', leo, u'\t'.join(enc)]
    for f in filas:
        lineas.append(u'\t'.join(u'%s' % f.get(c, u'') for c in enc))
    texto = FIN.join(lineas) + FIN
    with open(ruta, 'wb') as fh:
        fh.write(texto.encode(cod, 'replace'))


def es_retirada(f, retirar):
    u"""¿Es una fila que puso una versión anterior del catálogo, intacta?"""
    for r in retirar:
        if f.get(u'Name', u'').strip().lower() != r['nombre'].lower():
            continue
        try:
            return float(f.get(u'b')) == r['b'] and float(f.get(u'h')) == r['h'] and float(f.get(u's')) == r['s']
        except (TypeError, ValueError):
            return False
    return False


def fusionar(existentes, nuevas, retirar=()):
    u"""Las del catálogo mandan sobre las que se llaman igual; el resto se queda."""
    porNombre = dict((n[u'Name'].strip().lower(), n) for n in nuevas)
    usadas, salida, actualizadas = set(), [], 0
    quitadas = [f for f in existentes if es_retirada(f, retirar)]
    existentes = [f for f in existentes if not es_retirada(f, retirar)]
    for f in existentes:
        k = f.get(u'Name', u'').strip().lower()
        if k in porNombre:
            salida.append(porNombre[k])
            usadas.add(k)
            actualizadas += 1
        else:
            salida.append(f)
    nuevas_de_verdad = [n for n in nuevas if n[u'Name'].strip().lower() not in usadas]
    return salida + nuevas_de_verdad, actualizadas, len(nuevas_de_verdad), len(existentes) - actualizadas, quitadas


def invertidas(filas):
    u"""Filas cuyo nombre dice «20X25» pero guardan b = 25 y h = 20."""
    out = []
    for f in filas:
        nums = re.findall(r'\d+(?:\.\d+)?', f.get(u'Name', u''))
        try:
            b, h = float(f.get(u'b', u'')), float(f.get(u'h', u''))
        except ValueError:
            continue
        if len(nums) >= 2:
            n1, n2 = float(nums[-2]), float(nums[-1])
            if n1 != n2 and (b, h) == (n2, n1):
                out.append(u'%s: b = %g, h = %g' % (f[u'Name'], b, h))
    return out


def carpeta_de_respaldo():
    u"""
    Una carpeta que YA exista: dentro de RAM no se pueden crear carpetas
    (os.mkdir y os.remove valen None en su caja de arena). El Escritorio
    existe siempre y es donde se ve.
    """
    casa = os.path.expanduser('~')
    for sub in ('Desktop', 'Escritorio', os.path.join('OneDrive', 'Escritorio'), os.path.join('OneDrive', 'Desktop')):
        d = os.path.join(casa, sub)
        if os.path.isdir(d):
            return d
    return casa


def respaldar(db, relativa, crudo):
    nombre = u'Respaldo RAM - ' + u' - '.join(relativa.replace(os.sep, '/').split('/'))
    destino = os.path.join(carpeta_de_respaldo(), nombre)
    if os.path.isfile(destino):
        return destino, False           # el primer respaldo es el bueno: no se pisa
    with open(destino, 'wb') as f:
        f.write(crudo)
    return destino, True


def instalar_tabla(db, tipo, nombre_archivo, leo, enc_omision, nuevas, retirar=()):
    relativa = os.path.join(tipo, u'Personales', nombre_archivo)
    ruta = os.path.join(db, relativa)
    carpeta = os.path.dirname(ruta)
    if not os.path.isdir(carpeta):
        try:
            os.makedirs(carpeta)
            log(u'  grupo Personales creado en %s' % tipo)
        except Exception as e:
            # dentro de RAM os.mkdir vale None: no hay forma de crear carpetas
            log(u'  !! no se pudo crear %s (%s)' % (carpeta, e))
            log(u'     créala a mano (una carpeta llamada «Personales») y vuelve a correr esto.')
            return False
    previo = leer_tabla(ruta)
    if previo:
        enc, existentes, cod, crudo = previo
        try:
            destino, nuevo = respaldar(db, relativa, crudo)
        except Exception as e:
            # sin copia no se escribe: esta tabla se queda como estaba
            log(u'  !! no se pudo respaldar %s (%s): no la toco.' % (nombre_archivo, e))
            return False
        log(u'  respaldo %s: %s' % (u'guardado' if nuevo else u'ya existía, se conserva', destino))
    else:
        enc, existentes, cod = list(enc_omision), [], 'utf-8'
    filas, act, alta, conservadas, quitadas = fusionar(existentes, nuevas, retirar)
    escribir_tabla(ruta, leo, enc, filas, cod)
    log(u'  %s: %d nueva(s), %d actualizada(s), %d tuya(s) conservada(s) → %d en total'
        % (nombre_archivo, alta, act, conservadas, len(filas)))
    if quitadas:
        log(u'    retiradas (las puso una versión anterior del catálogo): %s'
            % u', '.join(f[u'Name'] for f in quitadas))
    for aviso in invertidas(filas):
        log(u'    ⚠ invertida: %s (el nombre dice lo contrario)' % aviso)
    return True


def seccion(s):
    return {u'Name': s['nombre'], u'Local': u'False', u'Qmod2exact': u'False', u'Unit': u'Cm',
            u'b': u'%g' % s['b'], u'h': u'%g' % s['h'], u's': u'%g' % s['s']}


def material(m):
    fila = {u'Name': m['nombre'], u'Unit': u'Kg-Cm'}
    for k in ENC_MATERIAL[2:]:
        fila[k] = m[k]
    return fila



# ── Mampostería: el formato lo pone RAM ──────────────────────────
# Las tablas de mampostería de RAM no son como la de concreto y aquí no se
# inventan: se lee la que trae RAM («Masonry clay» o «Masonry concrete» del
# grupo United States), se toma su fila más parecida como plantilla y sólo se
# reescriben las columnas que se reconocen. Las propiedades vienen de la app
# en kg y cm y se pasan a las unidades de esa fila (RAM guarda cada fila con
# las suyas: «Kip-In», «Kg-Cm»…), así que lo que no se toca sigue coherente.

FUERZA = {u'kip': 453.59237, u'kips': 453.59237, u'lb': 0.45359237, u'lbs': 0.45359237,
          u'kg': 1.0, u'kgf': 1.0, u'ton': 1000.0, u't': 1000.0, u'tonf': 1000.0,
          u'kn': 101.971621297793, u'n': 0.101971621297793}
LARGO = {u'in': 2.54, u'ft': 30.48, u'cm': 1.0, u'm': 100.0, u'mm': 0.1}


def unidades(u):
    u"""(kg por unidad de fuerza, cm por unidad de largo, ¿°F?) de «Kip-In», «Kg-Cm»…"""
    partes = [p for p in re.split(r'[-_ /]+', (u or u'').strip().lower()) if p]
    if len(partes) != 2 or partes[0] not in FUERZA or partes[1] not in LARGO:
        return None
    return FUERZA[partes[0]], LARGO[partes[1]], partes[1] in (u'in', u'ft')


def numero(x):
    u"""Como los escribe RAM: «9.9E-6», «221359.436211787»."""
    s = u'%.15G' % x
    if u'E' in s:
        m, e = s.split(u'E')
        s = u'%sE%d' % (m, int(e))
    return s


def _n(c):
    return re.sub(r'[^a-z]', u'', c.lower())


# qué columna es qué, por su nombre (sin mayúsculas ni signos)
ROLES = (
    (u'E', lambda n: n in (u'e', u'em')),
    (u'G', lambda n: n in (u'g', u'gm', u'ev', u'gv')),
    (u'U', lambda n: n in (u'u', u'nu', u'poisson')),
    (u'W', lambda n: n in (u'w', u'gamma', u'density', u'weight', u'unitweight')),
    (u'Alpha', lambda n: n in (u'alpha', u'alfa')),
    (u'Fm', lambda n: re.match(r'^f(p|prime)?mh?$', n) is not None),
    (u'Fy', lambda n: n.startswith(u'fy')),
)


def numeros_del_nombre(nombre):
    return [float(x) for x in re.findall(r'\d+(?:\.\d+)?', nombre or u'')]


def papeles(enc, plantilla, u):
    u"""{columna: papel}. f'm también por su valor: «BMU 1.0-60» lleva f'm = 1.0 ksi."""
    out = {}
    for c in enc:
        for papel, es in ROLES:
            if es(_n(c)):
                out[c] = papel
                break
    if u'Fm' not in out.values() and u[2]:
        nums = numeros_del_nombre(plantilla.get(u'Name'))
        a_ksi = u[0] / u[1] ** 2 / 70.3069579640175   # de la unidad de la fila a ksi
        cands = []
        for c in enc:
            n = _n(c)
            if c in out or not n.startswith(u'f') or n.startswith(u'factor'):
                continue
            try:
                v = float(plantilla.get(c, u''))
            except ValueError:
                continue
            if nums and abs(v * a_ksi - nums[0]) < 1e-6 * max(1.0, nums[0]):
                cands.append(c)
        if len(cands) == 1:
            out[cands[0]] = u'Fm'
    return out


def fila_plantilla(filas):
    u"""La de menor f'm y, entre ésas, la de fy más cercano a 60 ksi (4 200 kg/cm²)."""
    def clave(f):
        n = numeros_del_nombre(f.get(u'Name'))
        return (n[0] if n else 1e9, abs((n[1] if len(n) > 1 else 60) - 60))
    return min(filas, key=clave) if filas else None


def raices_de_materiales(db):
    u"""Donde RAM guarda sus tablas de fábrica (Program Files) y, al final, las de ProgramData."""
    bases = [os.path.dirname(sys.executable or u'')]
    for var in ('PROGRAMFILES', 'PROGRAMW6432'):
        if os.environ.get(var):
            bases.append(os.path.join(os.environ[var], 'Bentley', 'Engineering', 'RAM Elements'))
    bases.append(u'C:/Program Files/Bentley/Engineering/RAM Elements')
    raices, vistas = [], set()
    for b in bases + [os.path.dirname(db)]:
        r = os.path.join(b, 'Database', 'Materials')
        clave = os.path.normcase(os.path.abspath(r))
        if clave not in vistas and os.path.isdir(r):
            vistas.add(clave)
            raices.append(r)
    return raices


def leer_con_leo(ruta):
    u"""(leo, encabezado, filas) de una tabla de RAM, o None. No exige la
    línea «//infotable»: basta la plantilla entre corchetes y un encabezado
    con Name, separado por tabuladores."""
    try:
        if os.path.getsize(ruta) > 4 * 1024 * 1024:
            return None
        previo = leer_tabla(ruta)
        with open(ruta, 'rb') as f:
            texto, _cod = decodificar(f.read())
    except Exception:
        return None
    lineas = [l.rstrip(u'\r').lstrip(u'\ufeff').strip() for l in texto.split(u'\n')]
    leo = next((l for l in lineas if l.startswith(u'[') and l.endswith(u']')), None)
    if not leo or not previo or not previo[0] or len(previo[0]) < 2:
        return None
    if u'name' not in [c.strip().lower() for c in previo[0]]:
        return None
    return leo, previo[0], previo[1]


def muestra(ruta, n=110):
    u"""Cómo empieza un archivo, para el diagnóstico."""
    try:
        with open(ruta, 'rb') as f:
            crudo = f.read(600)
        texto, cod = decodificar(crudo)
        util = sum(1 for ch in texto[:200] if ch.isprintable() or ch in u'\t\r\n')
        if util < len(texto[:200]) * 0.85:
            return u'binario: ' + u' '.join(u'%02x' % (c if isinstance(c, int) else ord(c)) for c in crudo[:24])
        return u'%s: %s' % (cod, texto[:n].replace(u'\r', u'').replace(u'\n', u' | ').replace(u'\t', u' → '))
    except Exception as e:
        return u'no se pudo leer (%s)' % e


def plantillas_de_mamposteria(db):
    u"""{'clay'|'concrete': (ruta, leo, enc, filas)} — primero el grupo United States."""
    halladas, vistos = {}, []
    for raiz in raices_de_materiales(db):
        grupos = sorted(os.listdir(raiz), key=lambda g: (g.lower() != u'united states', g.lower()))
        for g in grupos:
            carpeta = os.path.join(raiz, g)
            if g.lower() == u'personales' or not os.path.isdir(carpeta):
                continue
            archivos = []
            for dirpath, _d, files in os.walk(carpeta):
                archivos += [os.path.join(dirpath, f) for f in sorted(files)]
            for ruta in archivos:
                f = os.path.basename(ruta)
                t = leer_con_leo(ruta)
                if not t:
                    continue
                vistos.append((ruta, t[0], t[1]))
                texto = (f + u' ' + t[0]).lower()
                if u'masonry' not in texto and u'mamposter' not in texto:
                    continue
                tipo = u'clay' if (u'clay' in texto or u'barro' in texto) else \
                       u'concrete' if u'concret' in texto else None
                if tipo and tipo not in halladas and t[2]:
                    halladas[tipo] = (ruta, t[0], t[1], t[2])
    return halladas, vistos


def fila_mamposteria(m, plantilla, enc, u, roles):
    F, L, grados_f = u
    esfuerzo = lambda x: x * L ** 2 / F
    valores = {u'E': esfuerzo(m['E']), u'G': esfuerzo(m['G']), u'U': m['U'],
               u'W': m['W'] * L ** 3 / F, u'Alpha': m['Alpha'] / 1.8 if grados_f else m['Alpha'],
               u'Fm': esfuerzo(m['Fm']), u'Fy': esfuerzo(m['Fy'])}
    fila = dict(plantilla)
    fila[u'Name'] = m['nombre']
    for c in enc:
        if c in roles:
            fila[c] = numero(valores[roles[c]])
        elif _n(c) == u'readonly':
            fila[c] = u'False'
    return fila


def instalar_mamposteria(db, lista):
    halladas, vistos = plantillas_de_mamposteria(db)
    tablas = []
    for m in lista:
        if m['tabla'] not in [x[0] for x in tablas]:
            tablas.append((m['tabla'], m['plantilla']))
    faltan = []
    for tabla, tipo in tablas:
        mats = [m for m in lista if m['tabla'] == tabla]
        if tipo not in halladas:
            faltan.append(u'%s (%s)' % (tabla, u', '.join(m['nombre'] for m in mats)))
            continue
        ruta, leo, enc, filas = halladas[tipo]
        base = fila_plantilla(filas)
        u = unidades(base.get(u'Unit'))
        if u is None:
            log(u'  !! %s: no entiendo las unidades «%s» de %s; no la toco.' % (tabla, base.get(u'Unit'), ruta))
            continue
        roles = papeles(enc, base, u)
        log(u'  %s: formato de %s %s, plantilla «%s» (%s)' % (tabla, ruta, leo, base.get(u'Name'), base.get(u'Unit')))
        log(u'    llena: %s' % u', '.join(u'%s = %s' % (c, roles[c]) for c in enc if c in roles))
        otras = [c for c in enc if c not in roles and c not in (u'Name', u'Unit') and _n(c) != u'readonly']
        if otras:
            log(u'    como en RAM: %s' % u', '.join(u'%s = %s' % (c, base.get(c, u'')) for c in otras))
        sin = [p for p in (u'E', u'W') if p not in roles.values()]
        if sin:
            log(u'  !! %s: la tabla de RAM no trae columna para %s; no la toco.' % (tabla, u' ni '.join(sin)))
            continue
        instalar_tabla(db, u'Materials', tabla + u'.mat', leo, enc,
                       [fila_mamposteria(m, base, enc, u, roles) for m in mats])
    if faltan:
        log(u'')
        log(u'  !! No encontré la tabla de mampostería de RAM que sirve de formato para:')
        for f in faltan:
            log(u'       %s' % f)
        log(u'     Mándale esta salida a quien mantiene la app.')
        if vistos:
            log(u'     Las tablas de materiales que sí pude leer:')
            for ruta, leo, enc in vistos[:40]:
                log(u'       %s  %s  %s' % (ruta, leo, u' '.join(enc)))
        diagnostico(db)


def diagnostico(db):
    u"""Qué hay donde RAM guarda sus materiales: carpetas, archivos y cómo empiezan."""
    log(u'')
    log(u'  Diagnóstico — dónde busqué las tablas de materiales de RAM:')
    bases = [(u'junto a RAM (sys.executable)', os.path.dirname(sys.executable or u''))]
    for var in ('PROGRAMFILES', 'PROGRAMW6432'):
        if os.environ.get(var):
            bases.append((var, os.path.join(os.environ[var], 'Bentley', 'Engineering', 'RAM Elements')))
    bases.append((u'ProgramData', os.path.dirname(db)))
    lineas = 0
    for etq, b in bases:
        r = os.path.join(b, 'Database', 'Materials')
        existe = os.path.isdir(r)
        log(u'    %s: %s  %s' % (etq, r, u'(existe)' if existe else u'(no existe)'))
        if not existe:
            continue
        try:
            grupos = sorted(os.listdir(r))
        except Exception as e:
            log(u'      no se pudo listar (%s)' % e)
            continue
        log(u'      grupos: %s' % u', '.join(grupos))
        for g in sorted(grupos, key=lambda x: (x.lower() != u'united states', x.lower()))[:2]:
            carpeta = os.path.join(r, g)
            if not os.path.isdir(carpeta):
                continue
            for dirpath, _d, files in os.walk(carpeta):
                for f in sorted(files):
                    if lineas >= 40:
                        log(u'      …')
                        return
                    ruta = os.path.join(dirpath, f)
                    try:
                        kb = os.path.getsize(ruta) / 1024.0
                    except Exception:
                        kb = -1
                    log(u'      %s (%.1f KB) — %s' % (os.path.relpath(ruta, r), kb, muestra(ruta)))
                    lineas += 1


log(u'=' * 70)
log(u'Auxiliar IV — catálogo de la casa → grupo Personales de RAM')
log(u'instalar_catalogo.py %s' % VERSION)
log(u'=' * 70)

if not CATALOGO['secciones']:
    log(u'Este archivo no trae catálogo: descárgalo desde la app (Reportes de RAM →')
    log(u'Configurar RAM → instalar_catalogo.py), que lo rellena.')
else:
    db = base_de_datos()
    if not db:
        log(u'No encontré la carpeta Database de RAM en ProgramData.')
    else:
        log(u'Base de datos: %s' % db)
        log(u'')
        for tabla in (u'Vigas de Concreto', u'Columnas de Concreto'):
            nuevas = [seccion(s) for s in CATALOGO['secciones'] if s['tabla'] == tabla]
            retirar = [r for r in CATALOGO.get('retirar', []) if r['tabla'] == tabla]
            instalar_tabla(db, u'Sections', tabla + u'.sec', LEO[tabla], ENC_SECCION, nuevas, retirar)
        instalar_tabla(db, u'Materials', u'Concreto.mat', LEO_MAT, ENC_MATERIAL,
                       [material(m) for m in CATALOGO['materiales']])
        if CATALOGO.get('mamposteria'):
            instalar_mamposteria(db, CATALOGO['mamposteria'])

        # la sonda 10 dejó archivos de prueba que la caja de arena no le dejó borrar
        restos = []
        for dirpath, _d, files in os.walk(db):
            restos += [os.path.join(dirpath, f) for f in files if f == '_auxiv_prueba.tmp']
        if restos:
            log(u'')
            log(u'Bórralos a mano (vacíos, de una prueba anterior; RAM no deja borrarlos desde aquí):')
            for r in restos:
                log(u'  %s' % r)

        log(u'')
        log(u'Listo. Si no aparecen en el grupo Personales, cierra y vuelve a abrir RAM.')
log(u'=' * 70)

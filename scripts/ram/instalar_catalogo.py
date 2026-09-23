# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Instala el catálogo de la casa en el grupo «Personales» de RAM.

Da de alta las secciones (vigas y columnas de concreto) y los concretos del
catálogo de la app. Es una vez por computadora: los grupos son de RAM, no
del proyecto, así que a partir de aquí todos los modelos los tienen.

Qué hace, y qué no:
  · ESCRIBE las tres tablas del grupo Personales (lo crea si no existe):
      Sections / Personales / Vigas de Concreto.sec
      Sections / Personales / Columnas de Concreto.sec
      Materials / Personales / Concreto.mat
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

# ── El catálogo (lo escribe la app desde catalogoRam.js; no hace falta tocarlo)
CATALOGO = {
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
   "nombre": "15 X 15",
   "b": 15,
   "h": 15,
   "s": 3
  },
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
    lineas = [l.rstrip(u'\r') for l in texto.split(u'\n')]
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


def fusionar(existentes, nuevas):
    u"""Las del catálogo mandan sobre las que se llaman igual; el resto se queda."""
    porNombre = dict((n[u'Name'].strip().lower(), n) for n in nuevas)
    usadas, salida, actualizadas = set(), [], 0
    for f in existentes:
        k = f.get(u'Name', u'').strip().lower()
        if k in porNombre:
            salida.append(porNombre[k])
            usadas.add(k)
            actualizadas += 1
        else:
            salida.append(f)
    nuevas_de_verdad = [n for n in nuevas if n[u'Name'].strip().lower() not in usadas]
    return salida + nuevas_de_verdad, actualizadas, len(nuevas_de_verdad), len(existentes) - actualizadas


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


def instalar_tabla(db, tipo, nombre_archivo, leo, enc_omision, nuevas):
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
    filas, act, alta, conservadas = fusionar(existentes, nuevas)
    escribir_tabla(ruta, leo, enc, filas, cod)
    log(u'  %s: %d nueva(s), %d actualizada(s), %d tuya(s) conservada(s) → %d en total'
        % (nombre_archivo, alta, act, conservadas, len(filas)))
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


log(u'=' * 70)
log(u'Auxiliar IV — catálogo de la casa → grupo Personales de RAM')
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
            instalar_tabla(db, u'Sections', tabla + u'.sec', LEO[tabla], ENC_SECCION, nuevas)
        instalar_tabla(db, u'Materials', u'Concreto.mat', LEO_MAT, ENC_MATERIAL,
                       [material(m) for m in CATALOGO['materiales']])

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

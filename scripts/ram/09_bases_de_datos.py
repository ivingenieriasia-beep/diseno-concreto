# -*- coding: utf-8 -*-
u"""
Auxiliar IV · ¿Dónde guarda RAM sus grupos de secciones y materiales?

La API de Python NO puede crear secciones ni materiales: su núcleo expone
11 funciones (analysis, design, members, nodes, results…) y ninguna es de
catálogos. `members.add(section=...)` sólo REFERENCIA una sección por nombre.

Pero los grupos del desplegable —China, Europe, NTC, Personales…— son bases
de datos que RAM guarda en disco. Si el archivo de «Personales» es legible,
la app lo genera con todas nuestras secciones y materiales y se deja en su
sitio una vez: a partir de ahí, todos los proyectos los tienen.

Esto lo busca de tres maneras:
  1. por el nombre (Personales, NTC, Sections, Materials…);
  2. por el CONTENIDO: los archivos que llevan «15 X 15» o «F'C 250», que
     son las que diste de alta tú;
  3. por la fecha: lo que modificaste al darlas de alta es de lo más reciente.

Y de lo que encuentre dice el formato (XML, texto, SQLite, Access…) y si la
carpeta admite escritura. No modifica nada: sólo crea y borra un archivo
vacío de prueba para saber si se puede escribir ahí.

  RAM Elements → Python Console → «Ejecutar archivo…» → este .py
"""

import os
import sys
import time

LINEAS = []
MARCAS = (u'Personales', u'15 X 15', u"F'C 250", u"F'c 250")
NOMBRES = ('personal', 'ntc', 'section', 'seccion', 'sección', 'material', 'concrete', 'concreto')
TOPE_BYTES = 8 * 1024 * 1024     # no se leen archivos más grandes que esto
TOPE_LISTA = 250


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


def formato(cabeza):
    u"""Qué es un archivo, por sus primeros bytes."""
    if cabeza.startswith(b'SQLite format 3'):
        return u'SQLite'
    if b'Standard Jet DB' in cabeza[:32]:
        return u'Access (.mdb)'
    if b'Standard ACE DB' in cabeza[:32]:
        return u'Access (.accdb)'
    if cabeza.startswith(b'PK\x03\x04'):
        return u'ZIP (¿con XML dentro?)'
    if cabeza.startswith(b'\xff\xfe') or cabeza.startswith(b'\xfe\xff'):
        return u'texto UTF-16'
    t = cabeza.lstrip(b'\xef\xbb\xbf').lstrip()
    if t.startswith(b'<?xml') or t.startswith(b'<'):
        return u'XML'
    if t.startswith(b'[') or t.startswith(b';'):
        return u'INI'
    if t.startswith(b'{'):
        return u'JSON'
    muestra = cabeza[:512]
    if muestra and sum(1 for c in muestra if c < 9 or 13 < c < 32) < len(muestra) * 0.05:
        return u'texto'
    return u'binario'


def como_texto(crudo):
    if crudo.startswith(b'\xff\xfe') or crudo.startswith(b'\xfe\xff'):
        return crudo.decode('utf-16', 'replace')
    return crudo.decode('utf-8', 'replace')


def contiene(crudo, marca):
    u"""Busca la marca en UTF-8 y en UTF-16 (Windows guarda mucho así)."""
    return marca.encode('utf-8') in crudo or marca.encode('utf-16-le') in crudo


def recorrer(raiz, profundidad=5):
    if not raiz or not os.path.isdir(raiz):
        return []
    out = []
    base = raiz.rstrip('\\/').count(os.sep)
    for dirpath, dirnames, filenames in os.walk(raiz):
        if dirpath.count(os.sep) - base >= profundidad:
            dirnames[:] = []
        for f in filenames:
            ruta = os.path.join(dirpath, f)
            ok, st = seguro(lambda r=ruta: os.stat(r))
            if ok:
                out.append((ruta, st.st_size, st.st_mtime))
    return out


def escribible(carpeta):
    prueba = os.path.join(carpeta, '_auxiv_prueba.tmp')
    ok, _ = seguro(lambda: open(prueba, 'wb').close())
    if ok:
        seguro(lambda: os.remove(prueba))
    return ok


p(u'=' * 74)
p(u'Auxiliar IV — dónde viven los grupos de secciones y materiales')
p(u'=' * 74)

inst = os.path.dirname(sys.executable)
env = os.environ.get
raices = [
    (u'instalación\\Database', os.path.join(inst, 'Database')),
    (u'PROGRAMDATA', os.path.join(env('PROGRAMDATA') or '', 'Bentley', 'Engineering', 'RAM Elements')),
    (u'APPDATA', os.path.join(env('APPDATA') or '', 'Bentley', 'Engineering', 'RAM Elements')),
    (u'LOCALAPPDATA', os.path.join(env('LOCALAPPDATA') or '', 'Bentley', 'Engineering', 'RAM Elements')),
]
docs = os.path.expanduser('~')
for sub in ('Documents', 'Documentos', os.path.join('OneDrive', 'Documents'), os.path.join('OneDrive', 'Documentos')):
    d = os.path.join(docs, sub)
    if os.path.isdir(d):
        for n in os.listdir(d):
            if 'ram' in n.lower() or 'bentley' in n.lower():
                raices.append((u'%s\\%s' % (sub, n), os.path.join(d, n)))

todos = []
p(u'')
p(u'[1] Lo que hay en cada sitio')
for etiqueta, raiz in raices:
    items = recorrer(raiz)
    p(u'')
    p(u'    %s  →  %s' % (etiqueta, raiz if os.path.isdir(raiz) else u'(no existe)'))
    if not items:
        continue
    p(u'      %d archivo(s)%s' % (len(items), u', los primeros %d:' % TOPE_LISTA if len(items) > TOPE_LISTA else u':'))
    for ruta, n, mt in sorted(items)[:TOPE_LISTA]:
        rel = os.path.relpath(ruta, raiz)
        ojo = u'  <<<' if any(k in rel.lower() for k in NOMBRES) else u''
        p(u'      %-58s %9.1f KB%s' % (rel, n / 1024.0, ojo))
    todos.extend(items)

# ── 2. Por el contenido: dónde están las que diste de alta ──────
p(u'')
p(u'[2] Archivos que llevan tus secciones y materiales')
con_marca = []
for ruta, n, mt in todos:
    if n > TOPE_BYTES:
        continue
    ok, crudo = seguro(lambda r=ruta: open(r, 'rb').read())
    if not ok:
        continue
    halladas = [m for m in MARCAS if contiene(crudo, m)]
    if halladas:
        con_marca.append((ruta, n, crudo, halladas))
        p(u'    %s' % ruta)
        p(u'       lleva: %s' % u', '.join(halladas))
if not con_marca:
    p(u'    (ninguno: puede estar en otro sitio, o en un formato que no guarda el texto tal cual)')

# ── 3. Por la fecha ─────────────────────────────────────────────
p(u'')
p(u'[3] Lo modificado más recientemente (tus altas deberían salir aquí)')
for ruta, n, mt in sorted(todos, key=lambda x: -x[2])[:15]:
    p(u'    %s  %s' % (time.strftime('%Y-%m-%d %H:%M', time.localtime(mt)), ruta))

# ── 4. Formato y escritura de los candidatos ────────────────────
p(u'')
p(u'[4] Formato de los candidatos, y si se puede escribir en su carpeta')
candidatos = [(r, n, c) for r, n, c, _ in con_marca]
vistos = set(r for r, _, _ in candidatos)
for ruta, n, mt in todos:
    if ruta in vistos or n > TOPE_BYTES:
        continue
    if any(k in os.path.basename(ruta).lower() for k in NOMBRES):
        ok, crudo = seguro(lambda r=ruta: open(r, 'rb').read())
        if ok:
            candidatos.append((ruta, n, crudo))
            vistos.add(ruta)
carpetas = {}
for ruta, n, crudo in candidatos[:12]:
    fmt = formato(crudo[:64])
    carpeta = os.path.dirname(ruta)
    if carpeta not in carpetas:
        carpetas[carpeta] = escribible(carpeta)
    p(u'')
    p(u'    ── %s' % ruta)
    p(u'       formato: %s · %.1f KB · carpeta %s' % (fmt, n / 1024.0,
      u'ESCRIBIBLE' if carpetas[carpeta] else u'de sólo lectura (haría falta admin)'))
    if fmt in (u'XML', u'INI', u'JSON', u'texto', u'texto UTF-16'):
        texto = como_texto(crudo)
        # el trozo donde aparece la primera marca, que es lo que hay que imitar
        i = -1
        for m in MARCAS:
            i = texto.find(m)
            if i >= 0:
                break
        desde = max(0, i - 700) if i >= 0 else 0
        for linea in texto[desde:desde + 1600].splitlines()[:40]:
            p(u'       | %s' % linea.rstrip()[:160])

# ── 5. Herramientas a mano en el Python de RAM ──────────────────
p(u'')
p(u'[5] ¿Qué sabe leer este Python?')
for mod in ('sqlite3', 'xml.etree.ElementTree', 'zipfile', 'configparser'):
    ok, _ = seguro(lambda m=mod: __import__(m))
    p(u'    %-24s %s' % (mod, u'sí' if ok else u'no'))

# ── 6. Cómo guarda el MODELO sus secciones (lectura sin conexión) ─
p(u'')
p(u'[6] Las tablas del archivo del modelo (ramelements.io)')
ok, io = seguro(lambda: __import__('ramelements.io', fromlist=['*']), u'import ramelements.io')
lista = getattr(io, 'list_rme_tables', None) if ok else None
if lista is None and ok:
    ok2, fo = seguro(lambda: __import__('ramelements.io.file_ops', fromlist=['*']))
    lista = getattr(fo, 'list_rme_tables', None) if ok2 else None
if lista is None:
    p(u'    (no está list_rme_tables)')
else:
    ok, firma = seguro(lambda: str(__import__('inspect').signature(lista)))
    p(u'    list_rme_tables%s' % (firma if ok else u'(?)'))
    # el último modelo abierto, de Recents.xml
    rec = os.path.join(env('APPDATA') or '', 'Bentley', 'Engineering', 'RAM Elements')
    ruta_modelo = None
    for ruta, n, mt in recorrer(rec, 4):
        if os.path.basename(ruta).lower() == 'recents.xml':
            ok, crudo = seguro(lambda r=ruta: open(r, 'rb').read())
            if ok:
                import re
                hall = re.findall(r'[A-Za-z]:\\[^<>"\r\n]+?\.(?:rme|RME|rte|RTE|etz)', como_texto(crudo))
                if hall:
                    ruta_modelo = hall[0]
                    break
    p(u'    último modelo: %s' % (ruta_modelo or u'(no se encontró)'))
    if ruta_modelo:
        ok, tablas = seguro(lambda: lista(ruta_modelo), u'list_rme_tables')
        if ok and tablas:
            tablas = list(tablas)
            p(u'    %d tabla(s). Las que suenan a secciones o materiales:' % len(tablas))
            for t in tablas:
                if any(k in str(t).lower() for k in ('sect', 'mat', 'prop', 'shape')):
                    p(u'       %s' % t)

p(u'')
p(u'=' * 74)
p(u'Mándame esta salida tal cual.')

for d in (os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_bases.txt'),
          os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_bases.txt'),
          os.path.join(os.path.expanduser('~'), 'ram_bases.txt')):
    try:
        if not os.path.isdir(os.path.dirname(d)):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        print(u'\n>>> Salida guardada en: %s' % d)
        break
    except Exception:
        continue

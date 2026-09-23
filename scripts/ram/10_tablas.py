# -*- coding: utf-8 -*-
u"""
Auxiliar IV · Qué hay DENTRO de las tablas de secciones y materiales.

La sonda 09 encontró dónde viven los grupos: una carpeta por grupo y un
archivo por tabla, dentro de ProgramData / Bentley / Engineering /
RAM Elements / 26.0.1 / Database:
      Sections / Personales / Vigas de Concreto.sec
      Sections / Personales / Columnas de Concreto.sec
      Materials / Personales / Concreto.mat

Esto vuelca su contenido completo (son de 0.1-0.2 KB), dice si la carpeta
admite escritura, y busca de qué tabla salen los nombres que usa el modelo
('RcBeam 15X25', 'COL 36 X 36', '15 x 15'). Con eso la app podrá escribir
esas tablas con todo el catálogo.

No modifica nada: sólo crea y borra un archivo vacío de prueba.

  RAM Elements → Python Console → «Ejecutar archivo…» → este .py
"""

import os
import sys

LINEAS = []
BUSCAR = (u'RcBeam', u'COL ', u'15 x 15', u'15 X 15', u"F'C 250")


def p(*a):
    s = u' '.join(str(x) for x in a)
    LINEAS.append(s)
    print(s)


def leer(ruta):
    try:
        with open(ruta, 'rb') as f:
            return f.read()
    except Exception as e:
        p(u'      !! no se pudo leer: %s' % e)
        return None


def es_texto(crudo):
    if crudo.startswith(b'\xff\xfe') or crudo.startswith(b'\xfe\xff'):
        return True
    m = crudo[:512]
    return bool(m) and sum(1 for c in m if c < 9 or 13 < c < 32) < len(m) * 0.05


def texto(crudo):
    if crudo.startswith(b'\xff\xfe') or crudo.startswith(b'\xfe\xff'):
        return crudo.decode('utf-16', 'replace')
    return crudo.decode('utf-8', 'replace')


def volcar(ruta, max_bytes=4096):
    crudo = leer(ruta)
    if crudo is None:
        return
    p(u'    ── %s  (%d bytes)' % (ruta, len(crudo)))
    if es_texto(crudo):
        cod = u'UTF-16' if crudo[:2] in (b'\xff\xfe', b'\xfe\xff') else u'UTF-8/ANSI'
        p(u'       texto %s:' % cod)
        for linea in texto(crudo[:max_bytes]).splitlines():
            p(u'       | %s' % linea.rstrip())
    else:
        p(u'       BINARIO. Primeros bytes:')
        for i in range(0, min(len(crudo), 384), 16):
            fila = crudo[i:i + 16]
            hexa = u' '.join(u'%02x' % c for c in fila)
            asc = u''.join(chr(c) if 32 <= c < 127 else u'.' for c in fila)
            p(u'       %04x  %-48s  %s' % (i, hexa, asc))


def escribible(carpeta):
    prueba = os.path.join(carpeta, '_auxiv_prueba.tmp')
    try:
        open(prueba, 'wb').close()
        os.remove(prueba)
        return True
    except Exception:
        return False


p(u'=' * 74)
p(u'Auxiliar IV — el contenido de las tablas de secciones y materiales')
p(u'=' * 74)

pd = os.path.join(os.environ.get('PROGRAMDATA') or u'C:/ProgramData', 'Bentley', 'Engineering', 'RAM Elements')
versiones = [v for v in (os.listdir(pd) if os.path.isdir(pd) else []) if os.path.isdir(os.path.join(pd, v, 'Database'))]

# ── 1. Las tablas del usuario, completas ────────────────────────
for v in sorted(versiones):
    db = os.path.join(pd, v, 'Database')
    p(u'')
    p(u'[1] %s' % db)
    for tipo in ('Sections', 'Materials'):
        raiz = os.path.join(db, tipo)
        if not os.path.isdir(raiz):
            continue
        for grupo in sorted(os.listdir(raiz)):
            carpeta = os.path.join(raiz, grupo)
            if not os.path.isdir(carpeta):
                continue
            p(u'')
            p(u'  %s / %s   · carpeta %s' % (tipo, grupo, u'ESCRIBIBLE' if escribible(carpeta) else u'de sólo lectura'))
            for f in sorted(os.listdir(carpeta)):
                volcar(os.path.join(carpeta, f))

# ── 2. Las tablas que trae RAM: dónde está cada nombre del modelo ─
inst = os.path.dirname(sys.executable)
p(u'')
p(u'[2] Tablas de la instalación que llevan los nombres del modelo')
for tipo in ('Sections', 'Materials'):
    raiz = os.path.join(inst, 'Database', tipo)
    if not os.path.isdir(raiz):
        p(u'    %s: (no existe)' % raiz)
        continue
    grupos = sorted(os.listdir(raiz))
    p(u'    %s: %s' % (raiz, u', '.join(grupos)))
    for dirpath, _d, files in os.walk(raiz):
        for f in files:
            ruta = os.path.join(dirpath, f)
            crudo = leer(ruta)
            if not crudo:
                continue
            halladas = [b for b in BUSCAR if b.encode('utf-8') in crudo or b.encode('utf-16-le') in crudo]
            if not halladas:
                continue
            p(u'    ── %s (%.1f KB) lleva %s' % (os.path.relpath(ruta, raiz), len(crudo) / 1024.0, u', '.join(halladas)))
            if es_texto(crudo):
                t = texto(crudo)
                i = t.find(halladas[0])
                for linea in t[max(0, i - 300):i + 500].splitlines()[:14]:
                    p(u'       | %s' % linea.rstrip()[:150])
            else:
                i = crudo.find(halladas[0].encode('utf-8'))
                if i < 0:
                    i = crudo.find(halladas[0].encode('utf-16-le'))
                trozo = crudo[max(0, i - 64):i + 128]
                p(u'       binario; alrededor: %s' % u''.join(chr(c) if 32 <= c < 127 else u'.' for c in trozo))

# ── 3. Las plantillas paramétricas de las secciones rectangulares ─
p(u'')
p(u'[3] Las plantillas de sección de concreto (Leos)')
leos = os.path.join(inst, 'Leos')
if os.path.isdir(leos):
    for f in sorted(os.listdir(leos)):
        if f.lower().startswith(('rcbeam', 'rccol')):
            volcar(os.path.join(leos, f), max_bytes=2500)
else:
    p(u'    (no hay carpeta Leos)')

p(u'')
p(u'=' * 74)
p(u'Mándame esta salida tal cual (también queda en el Escritorio).')

for d in (os.path.join(os.path.expanduser('~'), 'Desktop', 'ram_tablas.txt'),
          os.path.join(os.path.expanduser('~'), 'Escritorio', 'ram_tablas.txt'),
          os.path.join(os.path.expanduser('~'), 'ram_tablas.txt')):
    try:
        if not os.path.isdir(os.path.dirname(d)):
            continue
        with open(d, 'wb') as f:
            f.write(u'\n'.join(LINEAS).encode('utf-8'))
        print(u'\n>>> Salida guardada en: %s' % d)
        break
    except Exception:
        continue

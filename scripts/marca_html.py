#!/usr/bin/env python3
"""Pasa a otra marca las herramientas que van aparte de la app (Double Check).

    python3 scripts/marca_html.py dist-sogrub sogrub

La app misma toma su marca al compilar (VITE_MARCA); estas páginas se copian
tal cual de public/, así que aquí se cambia lo que se ve: título y logo.
Malla de Vigas no lleva marca.
"""
import base64
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
MARCA_DIR = os.path.join(AQUI, '..', 'src', 'assets', 'marca')
MARCAS = {
    'sogrub': {'empresa': 'SOGRUB Grupo Constructor', 'pdf': 'SOGRUB GRUPO CONSTRUCTOR',
               'logo': 'sogrub.png', 'logo_blanco': 'sogrub-blanco.png'},
}


def png(nombre):
    with open(os.path.join(MARCA_DIR, nombre), 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode('ascii')


def cambiar(texto, viejo, nuevo, cuenta=None):
    n = texto.count(viejo) if cuenta is None else cuenta
    if viejo not in texto:
        print('ERROR: no encontré ' + repr(viejo[:60]))
        sys.exit(1)
    return texto.replace(viejo, nuevo)


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in MARCAS:
        print('uso: marca_html.py <carpeta del build> <' + '|'.join(MARCAS) + '>')
        sys.exit(1)
    carpeta, m = sys.argv[1], MARCAS[sys.argv[2]]
    ruta = os.path.join(carpeta, 'double_check_estructural.html')
    with open(ruta, 'r', encoding='utf-8') as f:
        s = f.read()
    s = cambiar(s, '<title>Double Check Estructural — IV Ingenierías</title>',
                '<title>Double Check Estructural — ' + m['empresa'] + '</title>')
    s = cambiar(s, 'alt="IV Ingenierías"', 'alt="' + m['empresa'] + '"')
    s = cambiar(s, "doc.text('IV INGENIERIAS'", "doc.text('" + m['pdf'] + "'")
    s, n1 = re.subn(r"const IV_LOGO_LIGHT='data:image/png;base64,[^']+'", "const IV_LOGO_LIGHT='" + png(m['logo']) + "'", s)
    s, n2 = re.subn(r"const IV_LOGO_WHITE='data:image/png;base64,[^']+'", "const IV_LOGO_WHITE='" + png(m['logo_blanco']) + "'", s)
    if n1 != 1 or n2 != 1:
        print('ERROR: no encontré los logos de Double Check')
        sys.exit(1)
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(s)
    print('OK: ' + ruta + ' con la marca ' + sys.argv[2])


if __name__ == '__main__':
    main()

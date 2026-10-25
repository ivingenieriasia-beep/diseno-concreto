#!/usr/bin/env python3
"""Pasa a otra marca lo que no sale del código de la app.

    python3 scripts/marca_html.py dist-sogrub sogrub

La app misma toma su marca al compilar (VITE_MARCA). Aquí se hacen dos cosas:
  1. La cabeza de index.html (título, íconos, manifest, theme-color, og:image) y
     la copia de esos archivos junto al index (favicon, íconos, manifest, og).
  2. Las herramientas que se copian tal cual de public/ (Double Check): título
     y logo. Malla de Vigas no lleva marca.
"""
import base64
import json
import os
import re
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
MARCA_DIR = os.path.join(AQUI, '..', 'src', 'assets', 'marca')
ICONOS_DIR = os.path.join(MARCA_DIR, 'concreto')
MARCAS = {
    'sogrub': {'empresa': 'Grupo Constructor SOGRUB', 'pdf': 'GRUPO CONSTRUCTOR SOGRUB',
               'logo': 'sogrub.png', 'logo_blanco': 'sogrub-blanco.png',
               # el logo horizontal en el encabezado de Double Check: 51 px de alto = 120 px de ancho
               'logo_alto_dc': 51,
               # cabeza de index.html (kit del CMO: marca-auxiliares/LEEME.md § 3 y § 5)
               'nombre': 'SOGRUB Concreto', 'corto': 'Concreto',
               'descripcion': 'Diseño y detallado de elementos de concreto reforzado',
               'color': '#29235C', 'iconos': ICONOS_DIR},
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


def esc(t):
    return t.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


def cabeza(carpeta, m):
    """Título, íconos, manifest, theme-color y og:image del index.html de la app."""
    ruta = os.path.join(carpeta, 'index.html')
    with open(ruta, 'r', encoding='utf-8') as f:
        s = f.read()
    titulo = m['nombre'] + ' — ' + m['descripcion']
    s, n = re.subn(r'<title>[^<]*</title>', lambda _: '<title>' + esc(titulo) + '</title>', s, count=1)
    if n != 1:
        print('ERROR: index.html no tiene <title>')
        sys.exit(1)
    # Instrument Sans (la tipografía de IV) no se pide en esta marca; DM Mono sí (cifras)
    s = s.replace('&family=Instrument+Sans:wght@400;500;600', '')
    archivos = ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
                'icon-maskable-512.png', 'og-1200x630.png']
    for a in archivos:
        shutil.copyfile(os.path.join(m['iconos'], a), os.path.join(carpeta, a))
    manifest = {
        'name': m['nombre'], 'short_name': m['corto'], 'lang': 'es-MX',
        'description': m['descripcion'],
        'theme_color': m['color'], 'background_color': m['color'], 'display': 'standalone',
        'start_url': './', 'scope': './',
        'icons': [
            {'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
            {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
            {'src': 'icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ],
    }
    with open(os.path.join(carpeta, 'manifest.webmanifest'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write('\n')
    d, t = esc(m['descripcion']), esc(titulo)
    # og:image relativa: cuando se defina el dominio hay que poner la URL absoluta
    meta = '\n'.join([
        '<meta name="description" content="' + d + '">',
        '<meta name="theme-color" content="' + m['color'] + '">',
        '<link rel="icon" href="favicon.ico" sizes="any">',
        '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
        '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
        '<link rel="manifest" href="manifest.webmanifest">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="' + esc(m['nombre']) + '">',
        '<meta property="og:locale" content="es_MX">',
        '<meta property="og:title" content="' + t + '">',
        '<meta property="og:description" content="' + d + '">',
        '<meta property="og:image" content="og-1200x630.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="' + esc(m['nombre']) + ' — ' + d + '">',
        '<meta name="twitter:card" content="summary_large_image">',
    ])
    s = s.replace('</title>', '</title>\n' + meta, 1)
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(s)
    print('OK: cabeza de ' + ruta + ' (título, íconos, manifest, og:image)')


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in MARCAS:
        print('uso: marca_html.py <carpeta del build> <' + '|'.join(MARCAS) + '>')
        sys.exit(1)
    carpeta, m = sys.argv[1], MARCAS[sys.argv[2]]
    cabeza(carpeta, m)
    ruta = os.path.join(carpeta, 'double_check_estructural.html')
    with open(ruta, 'r', encoding='utf-8') as f:
        s = f.read()
    s = cambiar(s, '<title>Double Check Estructural — IV Ingenierías</title>',
                '<title>Double Check Estructural — ' + m['empresa'] + '</title>')
    s = cambiar(s, 'alt="IV Ingenierías"', 'alt="' + m['empresa'] + '"')
    s = cambiar(s, "doc.text('IV INGENIERIAS'", "doc.text('" + m['pdf'] + "'")
    s = cambiar(s, '/* IV Ingenierías — carbón / azul sien / gris */', '/* ' + m['empresa'] + ' */')
    s = cambiar(s, '.logo{height:34px;', '.logo{height:' + str(m['logo_alto_dc']) + 'px;')
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

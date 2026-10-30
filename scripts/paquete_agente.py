#!/usr/bin/env python3
"""Arma el paquete para enseñarle la app a un agente de IA.

    npm run build                                (primero, la app compilada)
    python3 scripts/paquete_agente.py            → paquete-agente-auxiliar-iv.zip

Junta el prompt y la referencia de agente/ con los textos pasados a la marca,
las imágenes del manual, la app compilada (dist-<marca>, o dist con IV), los
ejemplos y el .bat de la carpeta de la obra.
"""
import os
import re
import shutil
import sys
import tempfile
import zipfile

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

MARCAS = {
    'iv': {'app': 'Auxiliar IV', 'carpeta_zip': 'paquete-agente-auxiliar-iv', 'dist': 'dist', 'cambios': []},
}

DESCRIPCION = {
    'iv': 'Opera Auxiliar IV, la app de IV Ingenierías',
}


def marcar(texto, m):
    for a, b in m['cambios']:
        texto = texto.replace(a, b)
    return texto


def leer(ruta):
    # newline='': el .bat se queda con sus CRLF
    with open(ruta, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def escribir(ruta, texto):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8', newline='') as f:
        f.write(texto)


def main():
    args = sys.argv[1:]
    marca = 'iv'
    if '--marca' in args:
        marca = args[args.index('--marca') + 1]
    if marca not in MARCAS:
        sys.exit('marca desconocida: %s (hay: %s)' % (marca, ', '.join(MARCAS)))
    m = MARCAS[marca]
    salida = args[args.index('--out') + 1] if '--out' in args else os.path.join(RAIZ, m['carpeta_zip'] + '.zip')

    dist = os.path.join(RAIZ, m['dist'])
    if not os.path.isfile(os.path.join(dist, 'index.html')):
        sys.exit('Falta la app compilada en %s: corre antes «npm run build%s»' % (m['dist'], ':' + marca if marca != 'iv' else ''))
    indice = leer(os.path.join(dist, 'index.html'))
    if 'iv-auth-gate' not in indice:
        sys.exit('%s/index.html no tiene la pantalla de entrada: pásalo por auth-inject.py' % m['dist'])

    tmp = tempfile.mkdtemp()
    base = os.path.join(tmp, m['carpeta_zip'])
    agente = os.path.join(RAIZ, 'agente')

    # El prompt, el LEEME y la skill
    prompt = marcar(leer(os.path.join(agente, 'PROMPT_SISTEMA.md')), m)
    escribir(os.path.join(base, 'PROMPT_SISTEMA.md'), prompt)
    escribir(os.path.join(base, 'LEEME.md'), marcar(leer(os.path.join(agente, 'LEEME_PAQUETE.md')), m))
    cuerpo = re.sub(r'^# .*\n+', '', prompt, count=1)
    skill = ('---\n'
             'name: %s\n'
             'description: "%s para diseñar y detallar concreto reforzado (NTC-2023) con RAM Elements: secciones, '
             'columnas, agrupación, deflexiones, cimentaciones, pesos unitarios, memoria y planos. Úsala para diseñar una obra '
             'a partir del modelo de RAM ya validado, operar la app o explicar para qué sirve cada herramienta."\n'
             '---\n\n# %s\n\n%s') % (m['carpeta_zip'].replace('paquete-agente-', ''), DESCRIPCION[marca], m['app'], cuerpo)
    escribir(os.path.join(base, 'SKILL.md'), skill)

    # La referencia, con las imágenes del manual junto a ella
    ref = os.path.join(agente, 'referencia')
    for nombre in sorted(os.listdir(ref)):
        if nombre.endswith('.md'):
            texto = marcar(leer(os.path.join(ref, nombre)), m).replace('](../../manual/img/', '](img/')
            escribir(os.path.join(base, 'referencia', nombre), texto)
    shutil.copytree(os.path.join(RAIZ, 'manual', 'img'), os.path.join(base, 'referencia', 'img'))

    # La app
    shutil.copytree(dist, os.path.join(base, 'app'))

    # Ejemplos (los datos no llevan marca: son del modelo)
    shutil.copytree(os.path.join(agente, 'ejemplos'), os.path.join(base, 'ejemplos'))

    # El .bat de la carpeta de la obra
    bat = marcar(leer(os.path.join(RAIZ, 'scripts', 'crear-proyectoiv.bat')), m)
    escribir(os.path.join(base, 'scripts', 'crear-proyecto%s.bat' % marca), bat)

    if os.path.exists(salida):
        os.remove(salida)
    with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as z:
        for carpeta, _, archivos in os.walk(base):
            for a in sorted(archivos):
                ruta = os.path.join(carpeta, a)
                z.write(ruta, os.path.relpath(ruta, tmp))
    shutil.rmtree(tmp)
    print('OK: %s (%.1f MB)' % (salida, os.path.getsize(salida) / 1e6))


if __name__ == '__main__':
    main()

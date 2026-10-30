#!/usr/bin/env python3
"""Inject the auth gate into built index.html - uses rfind to find the REAL <body> tag

    python3 auth-inject.py dist/index.html docs/index.html
"""
import os
import re
import sys


def app_version():
    """La versión de la app, de src/core/constants.js: la misma que dice la app."""
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'core', 'constants.js')
    with open(ruta, 'r', encoding='utf-8') as f:
        m = re.search(r"APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]", f.read())
    if not m:
        print("ERROR: APP_VERSION not found in " + ruta)
        sys.exit(1)
    return m.group(1)

LOGO_IV = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 170" width="120" style="margin:0 auto 24px;display:block">
<rect x="18" y="10" width="22" height="90" fill="#1a1a2e"/><rect x="8" y="10" width="42" height="14" fill="#1a1a2e"/>
<rect x="8" y="86" width="42" height="14" fill="#1a1a2e"/><polygon points="52,10 74,10 110,100 88,100" fill="#1a1a2e"/>
<polygon points="148,10 170,10 128,100 106,100" fill="#1a1a2e"/>
<rect x="111" y="28" width="10" height="52" rx="4" transform="rotate(-18,116,54)" fill="#4ecac4"/>
<rect x="127" y="24" width="10" height="52" rx="4" transform="rotate(-18,132,50)" fill="#8a9ab0"/>
<text x="100" y="148" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="5" fill="#1a1a2e">INGENIER&#205;AS</text>
</svg>'''


# Lo que cambia de una marca a otra en la pantalla de entrada
MARCAS = {
    'iv': {'fondo': '#1a1a2e 0%,#16213e 50%,#0f3460 100%', 'tinta': '#1a1a2e', 'boton': '#1a7a5e',
           'app': 'Auxiliar IV', 'empresa': 'IV Ingenier&#237;as', 'logo': lambda: LOGO_IV,
           'fuente': 'Arial,sans-serif', 'fuente_titulo': '', 'desc': ''},
}

LOGIN_BLOCK = '''<!-- IV Auth Gate -->
<div id="iv-auth-gate" style="position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,__IV_FONDO__);font-family:__IV_FUENTE__">
<div style="background:#fff;border-radius:16px;padding:48px 40px;width:360px;box-shadow:0 24px 64px rgba(0,0,0,0.3);text-align:center">
__IV_LOGO__
<h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:__IV_TINTA____IV_FUENTE_TITULO__">__IV_APP__</h2>__IV_DESC__
<p style="margin:0 0 24px;font-size:12px;color:#6b7280">Uso exclusivo de __IV_EMPRESA__</p>
<div id="iv-err" style="display:none;margin-bottom:12px;padding:8px 12px;border-radius:8px;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;font-size:12px">Credenciales incorrectas</div>
<form id="iv-frm" style="display:flex;flex-direction:column;gap:12px">
<input id="iv-u" type="text" placeholder="Usuario" style="padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none"/>
<input id="iv-p" type="password" placeholder="Contrase&#241;a" style="padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none"/>
<button type="submit" style="padding:12px;border:none;border-radius:8px;background:__IV_BOTON__;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Ingresar</button>
</form>
<p style="margin:16px 0 0;font-size:10px;color:#9ca3af">v__IV_VERSION__ &#183; NTC-2023</p>
</div></div>
<script>
(function(){
var K="iv_auth_ok";
if(sessionStorage.getItem(K)==="1"){document.getElementById("iv-auth-gate").style.display="none"}
document.getElementById("iv-frm").addEventListener("submit",function(e){
e.preventDefault();
var u=document.getElementById("iv-u").value.trim();
var p=document.getElementById("iv-p").value;
if(u==="admin"&&p==="huicholes"){
sessionStorage.setItem(K,"1");
document.getElementById("iv-auth-gate").style.display="none";
}else{
document.getElementById("iv-err").style.display="block";
document.getElementById("iv-p").value="";
}
});
})();
</script>
'''

args = sys.argv[1:]
marca = 'iv'
if '--marca' in args:
    i = args.index('--marca')
    marca = args[i + 1] if i + 1 < len(args) else ''
    del args[i:i + 2]
if marca not in MARCAS:
    print("ERROR: marca desconocida: " + marca + " (hay: " + ", ".join(MARCAS) + ")")
    sys.exit(1)
src = args[0]
dst = args[1] if len(args) > 1 else src

with open(src, 'r', encoding='utf-8') as f:
    html = f.read()

# Use rfind to find the LAST <body> — the real HTML one, not the ones inside JS strings
idx = html.rfind('<body>')
if idx == -1:
    print("ERROR: <body> not found")
    sys.exit(1)

version = app_version()
insert_at = idx + len('<body>')
m = MARCAS[marca]
bloque = (LOGIN_BLOCK.replace('__IV_VERSION__', version).replace('__IV_FONDO__', m['fondo'])
          .replace('__IV_TINTA__', m['tinta']).replace('__IV_BOTON__', m['boton']).replace('__IV_APP__', m['app'])
          .replace('__IV_EMPRESA__', m['empresa']).replace('__IV_LOGO__', m['logo']())
          .replace('__IV_FUENTE_TITULO__', m['fuente_titulo']).replace('__IV_FUENTE__', m['fuente'])
          .replace('__IV_DESC__', ('<p style="margin:0 0 6px;font-size:12px;color:#374151">' + m['desc'] + '</p>') if m['desc'] else ''))
out = html[:insert_at] + '\n' + bloque + '\n' + html[insert_at:]

with open(dst, 'w', encoding='utf-8') as f:
    f.write(out)

print(f"OK: auth {marca} v{version} injected at position {idx} into {dst} ({len(out):,} bytes)")

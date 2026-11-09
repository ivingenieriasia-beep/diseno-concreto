import { useEffect, useRef, useState } from 'react'
import useConsola from '../core/consola/registro'
import { ejecutar } from '../core/consola'
import { COMANDOS } from '../core/consola/comandos'

// La consola: un registro de cada comando con su resultado (los del agente
// llegan por window.auxiliarIV y se ven aquí en vivo) y una línea para
// escribir. Va abajo, dentro del flujo de la página: no tapa nada.

/** El ícono de terminal: cuadro oscuro redondeado con «>_» en blanco */
export function IconoConsola({ size = 20 }) {
  return (
    <svg width={size} height={Math.round(size * 0.82)} viewBox="0 0 22 18" aria-hidden="true">
      <rect x="0.5" y="0.5" width="21" height="17" rx="3.5" fill="#1e1e1e" stroke="#444" />
      <path d="M5 5.5l3.5 3.5L5 12.5" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 12.5h6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

const HIST = 'auxiv.consola.historial'
const leerHist = () => { try { return JSON.parse(sessionStorage.getItem(HIST) || '[]') } catch { return [] } }
const hora = (t) => new Date(t).toLocaleTimeString('es-MX', { hour12: false })

const C = {
  fondo: '#141414', barra: '#1f1f1f', borde: '#333', tx: '#d4d4d4', tenue: '#8a8a8a',
  cmd: '#ffffff', ok: '#d4d4d4', error: '#ff7b72', agente: '#e3b341', tu: '#7ee787', prompt: '#58a6ff',
}

export default function Consola() {
  const abierta = useConsola((s) => s.abierta)
  const entradas = useConsola((s) => s.entradas)
  const autoAbrir = useConsola((s) => s.autoAbrir)
  const setAutoAbrir = useConsola((s) => s.setAutoAbrir)
  const cerrar = useConsola((s) => s.cerrar)
  const [linea, setLinea] = useState('')
  const [hist, setHist] = useState(leerHist)
  const [pos, setPos] = useState(-1)        // -1 = la línea nueva
  const [alto, setAlto] = useState(240)
  const logRef = useRef(null)
  const inputRef = useRef(null)

  // siempre a la vista lo último
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entradas, abierta])
  useEffect(() => { if (abierta) inputRef.current?.focus({ preventScroll: true }) }, [abierta])

  if (!abierta) return null

  async function enviar() {
    const l = linea.trim()
    setLinea('')
    setPos(-1)
    if (!l) return
    const h = [...hist.filter((x) => x !== l), l].slice(-100)
    setHist(h)
    try { sessionStorage.setItem(HIST, JSON.stringify(h)) } catch { /* sin almacenamiento */ }
    await ejecutar(l, { origen: 'consola' })
  }

  function tecla(e) {
    if (e.key === 'Enter') { e.preventDefault(); enviar(); return }
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!hist.length) return
      e.preventDefault()
      let p = pos === -1 ? hist.length : pos
      p = e.key === 'ArrowUp' ? Math.max(0, p - 1) : p + 1
      if (p >= hist.length) { setPos(-1); setLinea(''); return }
      setPos(p); setLinea(hist[p])
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const pal = linea.trimStart()
      if (pal.includes(' ')) return
      const opc = COMANDOS.map((c) => c.nombre).filter((n) => n.startsWith(pal.toLowerCase()))
      if (opc.length === 1) setLinea(`${opc[0]} `)
    }
  }

  const btn = {
    background: 'transparent', border: `1px solid ${C.borde}`, color: C.tenue, borderRadius: 4,
    fontSize: 11, padding: '1px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
  }

  return (
    <section aria-label="Consola" data-testid="consola" style={{
      flex: 'none', height: alto, display: 'flex', flexDirection: 'column',
      background: C.fondo, borderTop: `1px solid ${C.borde}`, color: C.tx,
      fontFamily: 'var(--font-mono)', fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: C.barra, borderBottom: `1px solid ${C.borde}` }}>
        <IconoConsola size={16} />
        <b style={{ color: C.cmd, fontSize: 12 }}>Consola</b>
        <span style={{ color: C.tenue, fontSize: 11 }}>{entradas.length} comando(s) · «ayuda» para la lista · el agente: window.auxiliarIV.cmd(…)</span>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, color: C.tenue, fontSize: 11, cursor: 'pointer' }}
          title="Si está marcada, la consola se abre sola cuando el agente manda un comando">
          <input type="checkbox" checked={autoAbrir} onChange={(e) => setAutoAbrir(e.target.checked)} data-testid="consola-autoabrir" />
          abrir sola con el agente
        </label>
        <button style={btn} onClick={() => ejecutar('ayuda')}>ayuda</button>
        <button style={btn} onClick={() => ejecutar('limpiar')} title="Borra el registro; no toca el proyecto">limpiar</button>
        <button style={btn} onClick={() => setAlto((a) => (a > 300 ? 240 : 460))} title="Más o menos alta">{alto > 300 ? '▁' : '▔'}</button>
        <button style={{ ...btn, border: 'none', fontSize: 15, padding: '0 4px' }} onClick={cerrar} aria-label="Cerrar la consola" title="Cerrar (Esc)">×</button>
      </div>

      <div ref={logRef} data-testid="consola-registro" style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}
        onClick={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true }) }}>
        {!entradas.length && (
          <div style={{ color: C.tenue }}>
            Escribe un comando (por ejemplo «estado», «grupos» o «calculo T-1») y Enter. ↑ ↓ recorre lo escrito y Tab completa.
          </div>
        )}
        {entradas.map((e) => (
          <div key={e.id} data-estado={e.estado} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ color: C.tenue, fontSize: 10.5 }}>{hora(e.at)}</span>
              <span style={{ color: e.origen === 'api' ? C.agente : C.tu, fontSize: 10.5 }}>{e.origen === 'api' ? 'agente' : 'consola'}</span>
              <span style={{ color: C.prompt }}>&gt;</span>
              <span style={{ color: C.cmd, fontWeight: 600, wordBreak: 'break-word' }}>{e.linea}</span>
              <span style={{ marginLeft: 'auto', color: C.tenue, fontSize: 10.5 }}>{e.estado === 'corriendo' ? '…' : `${e.ms} ms`}</span>
            </div>
            {e.texto && (
              <pre style={{ margin: '2px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', color: e.estado === 'error' ? C.error : C.ok }}>
                {e.estado === 'error' ? '✗ ' : ''}{e.texto}
              </pre>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderTop: `1px solid ${C.borde}` }}>
        <span style={{ color: C.prompt, fontWeight: 700 }}>&gt;_</span>
        <input ref={inputRef} value={linea} onChange={(e) => { setLinea(e.target.value); setPos(-1) }} onKeyDown={tecla}
          data-testid="consola-linea" aria-label="Comando" spellCheck={false} autoComplete="off"
          placeholder="comando…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.cmd, fontFamily: 'inherit', fontSize: 12.5 }} />
      </div>
    </section>
  )
}

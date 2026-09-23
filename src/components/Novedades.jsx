import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { APP_VERSION } from '../core/constants'
import { TIPOS, logVigente, fechaCorta, leerVista, marcarVista } from '../core/novedades'

// La versión en la barra. Al pasar el cursor abre el log de la versión mayor
// vigente; un clic lo deja abierto para leerlo con calma.
export default function Novedades() {
  const log = logVigente()
  const [abierto, setAbierto] = useState(false)
  const [fijo, setFijo] = useState(false)
  const [zoom, setZoom] = useState(null)          // { src, alt } de la imagen ampliada
  const [vista, setVista] = useState(leerVista)
  const caja = useRef(null)
  const reloj = useRef(null)
  const nueva = vista !== APP_VERSION

  const programar = (fn, ms) => { clearTimeout(reloj.current); reloj.current = setTimeout(fn, ms) }
  const abrir = () => programar(() => setAbierto(true), 110)
  const cerrar = () => { if (!fijo && !zoom) programar(() => setAbierto(false), 220) }
  const cerrarYa = () => { clearTimeout(reloj.current); setAbierto(false); setFijo(false) }
  useEffect(() => () => clearTimeout(reloj.current), [])

  // leído: la marca de "nueva" se va hasta la siguiente versión
  useEffect(() => {
    if (abierto && nueva) { marcarVista(); setVista(APP_VERSION) }
  }, [abierto, nueva])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => {
      if (zoom) return
      if (caja.current && !caja.current.contains(e.target)) cerrarYa()
    }
    const tecla = (e) => {
      if (e.key !== 'Escape') return
      if (zoom) setZoom(null)
      else cerrarYa()
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto, zoom])

  return (
    <span ref={caja} className="nov-caja" onMouseEnter={abrir} onMouseLeave={cerrar}>
      <button
        type="button"
        data-testid="version"
        className={`nov-version${nueva ? ' nueva' : ''}${abierto ? ' abierta' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => { clearTimeout(reloj.current); if (fijo) cerrarYa(); else { setAbierto(true); setFijo(true) } }}
        onFocus={abrir}
        onBlur={(e) => { if (!caja.current?.contains(e.relatedTarget)) cerrar() }}
      >
        v{APP_VERSION}
        {nueva && <span className="nov-punto" aria-label="hay novedades sin leer" />}
      </button>

      {abierto && (
        <div className="nov-puente">
          <div className="nov-pop" role="dialog" aria-label={`Novedades de Auxiliar IV v${log.mayor}`} data-testid="novedades">
            <Encabezado log={log} />
            <div className="nov-cuerpo">
              {log.entregas.map((e) => (
                <Entrega key={e.version} e={e} separador={log.entregas.length > 1} ampliar={(img) => { setFijo(true); setZoom(img) }} />
              ))}
            </div>
            <div className="nov-pie">
              <span>{fijo ? 'Esc o clic fuera para cerrar' : 'Clic en la versión para dejarlo abierto'}</span>
              <span>Log de la v{log.mayor} · se reinicia en la v{log.mayor + 1}</span>
            </div>
          </div>
        </div>
      )}

      {zoom && createPortal(
        <div className="nov-zoom" data-testid="novedades-zoom" onClick={() => setZoom(null)} role="dialog" aria-label={zoom.alt}>
          <img src={zoom.src} alt={zoom.alt} />
          <div>{zoom.alt} · clic o Esc para volver</div>
        </div>,
        document.body,
      )}
    </span>
  )
}

function Encabezado({ log }) {
  const ultima = log.entregas[0]
  return (
    <div className="nov-cabeza">
      <div className="nov-marca" aria-hidden="true">{log.mayor}</div>
      <div className="nov-kicker">✦ ¡Nueva actualización!</div>
      <div className="nov-titulo">
        Auxiliar IV <span>v{log.mayor}</span>
      </div>
      {ultima?.lema && <p className="nov-lema">{ultima.lema}</p>}
      {ultima && (
        <div className="nov-meta">
          <span className="nov-chip">{ultima.version}</span>
          <span>{fechaCorta(ultima.fecha)}</span>
          <span>·</span>
          <span>{log.destacados} novedades grandes y {log.cambios} cambios</span>
        </div>
      )}
    </div>
  )
}

function Etiqueta({ tipo }) {
  const t = TIPOS[tipo] || TIPOS.mejora
  return <span className="nov-etiqueta" style={{ background: t.fondo, color: t.color }}>{t.etiqueta}</span>
}

function Entrega({ e, separador, ampliar }) {
  return (
    <section className="nov-entrega">
      {separador && (
        <div className="nov-separador"><span>{e.version}</span>{fechaCorta(e.fecha)}</div>
      )}
      {e.aviso && <div className="nov-aviso"><b>Para empezar</b> {e.aviso}</div>}
      {(e.destacados || []).map((d) => (
        <article key={d.titulo} className="nov-tarjeta">
          <div className="nov-tarjeta-cabeza">
            <Etiqueta tipo={d.tipo} />
            <h4>{d.titulo}</h4>
          </div>
          <p>{d.texto}</p>
          {d.img && (
            <button type="button" className="nov-img" onClick={() => ampliar({ src: d.img, alt: d.alt || d.titulo })} title="Ver en grande">
              <img src={d.img} alt={d.alt || d.titulo} loading="lazy" />
              <span>⤢ ampliar</span>
            </button>
          )}
          {d.donde && <div className="nov-donde">{d.donde}</div>}
        </article>
      ))}
      {e.cambios?.length > 0 && (
        <>
          <div className="nov-subtitulo">Y además</div>
          <ul className="nov-lista">
            {e.cambios.map((c) => (
              <li key={c.texto}><Etiqueta tipo={c.tipo} /><span>{c.texto}</span></li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

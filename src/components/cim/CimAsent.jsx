import { useEffect, useMemo, useRef, useState } from 'react'
import useCimStore from '../../store/useCimStore'
import { parseModeloRam } from '../../core/ramModel'
import { modeloGuardado, hace, EVENTO_MODELO } from '../../core/ramSync'
import { apoyosDe, cargasDeApoyo, vivaMediaDeApoyo, papelesPorDefecto, PAPELES } from '../../core/cim/reacciones'
import { asentamientos, nuevoAsent } from '../../core/cim/asentamientos'
import { dibujoAsent, diagramaViga, diagramaLiga } from '../../core/cim/asentDibujo'
import { exportarAsent } from '../../core/cim/salidas'
import CimRevisiones, { CimMemoria } from './CimRevisiones'
import AsentDatos from './AsentDatos'

// Asentamientos (3.12): la malla de las corridas que salieron de RAM, cómo
// se asienta (mapa de color y deformada exagerada, en planta o en 3D), la
// revisión del medio y de la distorsión, y lo que el diferencial le hace a
// la CT y a las ligas. Los datos son los de «Suelo y criterios».

const GUARDADO = 'auxiv.cim.ram.papeles'
const leer = () => { try { return JSON.parse(localStorage.getItem(GUARDADO) || '{}') } catch { return {} } }

export default function CimAsent({ dxfScale = 1, projectName = '', onClose, onToast }) {
  const cimientos = useCimStore((s) => s.cimientos)
  const guardado = useCimStore((s) => s.asent)
  const [fuente, setFuente] = useState(null)
  const [aviso, setAviso] = useState('')
  const [papeles, setPapeles] = useState(leer)
  const [vista, setVista] = useState('planta')
  const [escenario, setEscenario] = useState('zonas')
  const [exag, setExag] = useState(1)
  const [ocupado, setOcupado] = useState(false)
  const archivoRef = useRef(null)
  const lienzoRef = useRef(null)
  const [tam, setTam] = useState({ w: 900, h: 600 })

  const usar = (texto, archivo, at = Date.now()) => {
    const R = parseModeloRam(texto, archivo)
    if (!R.ok) { setAviso(R.warnings[0] || 'No se pudo leer el modelo.'); return }
    setAviso(''); setFuente({ archivo, at, R })
  }
  useEffect(() => {
    const cargar = () => modeloGuardado().then((m) => { if (m?.datos) usar(m.datos, m.archivo || 'modelo.json', m.at) })
    cargar()
    window.addEventListener(EVENTO_MODELO, cargar)
    return () => window.removeEventListener(EVENTO_MODELO, cargar)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(GUARDADO, JSON.stringify(papeles)) } catch { /* sin almacenamiento */ } }, [papeles])
  useEffect(() => {
    const el = lienzoRef.current
    if (!el) return
    const ro = new ResizeObserver(([en]) => setTam({ w: Math.max(480, Math.floor(en.contentRect.width)), h: Math.max(360, Math.floor(en.contentRect.height)) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [fuente])

  const R = fuente?.R
  const A = useMemo(() => (R ? apoyosDe(R) : null), [R])
  const casos = R?.casos || []
  const pap = useMemo(() => {
    const def = papelesPorDefecto(casos)
    return Object.fromEntries(casos.map((c) => [c.id, papeles[c.id] || def[c.id]]))
  }, [casos, papeles])
  const conCasoMedio = Object.values(pap).includes('CVmed')
  const cargas = useMemo(() => (A ? A.apoyos.map((a) => {
    const c = cargasDeApoyo(a, pap, A.up)
    return { CM: c.CM.P, CV: c.CV.P, CVmed: vivaMediaDeApoyo(a, pap, A.up) }
  }) : []), [A, pap])
  const asent = useMemo(() => ({ ...nuevoAsent(), ...(guardado || {}) }), [guardado])
  const criterios = useCimStore((s) => s.criterios)
  const suelo = useCimStore((s) => s.suelo)
  const res = useMemo(() => asentamientos({ A, cimientos, cargas, asent, escenario, conCasoMedio, criterios, suelo }), [A, cimientos, cargas, asent, escenario, conCasoMedio, criterios, suelo])
  const esViga = res.metodo === 'viga'
  const vistaDib = vista === '3d' ? '3d' : 'planta'
  const dib = useMemo(() => (res.paneles.length ? dibujoAsent(res, { vista: vistaDib, exag, W: tam.w, H: tam.h, zonas: asent.zonas }) : null), [res, vistaDib, exag, tam, asent.zonas])
  const diags = useMemo(() => (esViga && vista === 'diagramas' && res.paneles.length
    ? [...res.vigas.map((v) => ({ id: `v-${v.f.z.uid}-${v.f.k}`, d: diagramaViga(v, { W: Math.max(600, tam.w - 24), limD: res.limD }) })), ...res.ligas.filter((l) => !l.inactiva).map((l) => ({ id: `l-${l.key}`, d: diagramaLiga(l, { W: Math.max(600, tam.w - 24) }) }))]
    : []), [res, esViga, vista, tam.w])
  const Rrev = { ok: res.ok, checks: res.checks, secciones: res.secciones, avisos: res.avisos || [], cant: {}, resumen: res.paneles.length ? `medio ${(res.medio * 1000).toFixed(2)} mm · máximo ${(res.dMax * 1000).toFixed(2)} mm · ${res.tramos.length} tramos${esViga ? ` · ${res.vigas.length} viga${res.vigas.length === 1 ? "" : "s"} · ${res.ligas.length} liga${res.ligas.length === 1 ? "" : "s"}` : ''}` : '' }

  const salida = async (formato) => {
    setOcupado(true)
    try { onToast?.(await exportarAsent(res, { formato, vista: vistaDib, exag, dxfScale, projectName, zonas: asent.zonas })) } catch (e) { onToast?.(`No se pudo: ${e.message}`, 'warn') }
    setOcupado(false)
  }

  return (
    <div className="cim-modal-fondo cim-fondo-grande" onClick={onClose}>
      <div className="cim-modal cim-modal-ancho cim-modal-grande" onClick={(e) => e.stopPropagation()} data-testid="cim-asent">
        <header>
          <b>Asentamientos de la cimentación</b>
          <span>{fuente ? `${fuente.archivo} · ${A?.apoyos.length || 0} apoyos · ${hace(fuente.at)}` : 'Sin modelo sincronizado'}</span>
          <button className="cim-mini" onClick={() => archivoRef.current?.click()}>abrir modelo.json…</button>
          <input ref={archivoRef} type="file" accept=".json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) usar(await f.text(), f.name, f.lastModified) }} />
          <button className="cim-mini" onClick={onClose}>cerrar ✕</button>
        </header>
        {aviso && <div className="cim-avisos"><li>{aviso}</li></div>}
        <div className="cim-ram-cuerpo cim-asent-cuerpo">
          <div className="cim-ram-izq">
            <div className="cim-grupo-t">Datos (los mismos de «Suelo y criterios»)</div>
            <AsentDatos compacto />
            {casos.length > 0 && <>
              <div className="cim-grupo-t" style={{ marginTop: 8 }}>Papel de cada caso de RAM</div>
              {casos.map((c) => (
                <label key={c.id} className="cim-caso-fila">
                  <span title={c.descripcion}>{c.id}<small>{c.descripcion && c.descripcion !== c.id ? ` · ${c.descripcion}` : ''}</small></span>
                  <select className="field-select" value={pap[c.id]} data-testid={`asent-papel-${c.id}`} onChange={(e) => setPapeles({ ...papeles, [c.id]: e.target.value })}>
                    {PAPELES.map((p) => <option key={p.id} value={p.id}>{p.t}</option>)}
                  </select>
                </label>
              ))}
              <p className="cim-nota">Son los mismos papeles de «Desde RAM». La viva media sólo entra a los asentamientos.</p>
            </>}
          </div>
          <div className="cim-ram-centro">
            <div className="cim-ram-herr">
              <div className="cim-seg" role="tablist">
                <button role="tab" aria-selected={vista === 'planta'} className={vista === 'planta' ? 'on' : ''} data-testid="asent-vista-planta" onClick={() => setVista('planta')}>Planta</button>
                <button role="tab" aria-selected={vista === '3d'} className={vista === '3d' ? 'on' : ''} data-testid="asent-vista-3d" onClick={() => setVista('3d')}>3D</button>
                {esViga && <button role="tab" aria-selected={vista === 'diagramas'} className={vista === 'diagramas' ? 'on' : ''} data-testid="asent-vista-diagramas" onClick={() => setVista('diagramas')}>Vigas y ligas: M y V</button>}
                <button role="tab" aria-selected={vista === 'memoria'} className={vista === 'memoria' ? 'on' : ''} data-testid="asent-vista-memoria" onClick={() => setVista('memoria')}>Memoria paso a paso</button>
              </div>
              <div className="cim-seg" role="tablist" title="Escenario del suelo">
                <button role="tab" aria-selected={escenario === 'base'} className={escenario === 'base' ? 'on' : ''} data-testid="asent-esc-base" onClick={() => setEscenario('base')}>todo sobre un estrato</button>
                <button role="tab" aria-selected={escenario === 'zonas'} className={escenario === 'zonas' ? 'on' : ''} data-testid="asent-esc-zonas" onClick={() => setEscenario('zonas')}>con zonas</button>
              </div>
              <label className="cim-nota" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>deformada
                <input type="range" min={0.25} max={4} step={0.25} value={exag} data-testid="asent-exag" onChange={(e) => setExag(Number(e.target.value))} />
                × {dib ? Math.round(dib.E) : '—'}
              </label>
            </div>
            <div className="cim-ram-lienzo" ref={lienzoRef} style={{ flex: 1, minHeight: 360, position: 'relative' }}>
              {res.faltan.length > 0 ? (
                <div className="cim-modal-cuerpo" data-testid="asent-faltan">
                  <p><b>Sin estos datos no se calcula:</b></p>
                  <ul className="cim-avisos">{res.faltan.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              ) : vista === 'memoria' ? (
                <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}><CimMemoria R={Rrev} /></div>
              ) : vista === 'diagramas' && esViga ? (
                <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }} data-testid="asent-diagramas">
                  {diags.map(({ id, d }) => <div key={id} dangerouslySetInnerHTML={{ __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.W} ${d.H}" width="${d.W}" height="${d.H}" font-family="DM Mono, monospace">${d.inner}</svg>` }} />)}
                </div>
              ) : dib && (
                <div data-testid="asent-dibujo" dangerouslySetInnerHTML={{ __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dib.W} ${dib.H}" width="${dib.W}" height="${dib.H}" font-family="DM Mono, monospace">${dib.inner}</svg>` }} />
              )}
            </div>
            <p className="cim-nota">Color: asentamiento de cada panel (≈ 0.25 m de la franja). Línea oscura: la deformada sobre el eje. Tramos entre apoyos: verde si la distorsión cumple, rojo si no. Pasa el cursor por un panel o un tramo para ver sus números.</p>
          </div>
          <div className="cim-ram-der">
            {res.paneles.length > 0 && <CimRevisiones R={Rrev} />}
            {res.sinPos?.length > 0 && <p className="cim-aviso-mini" data-testid="asent-sinpos">Sin posición en planta (no salieron de RAM ni tienen ejes ligados): {res.sinPos.map((z) => z.nombre).join(', ')}. No entran.</p>}
            {res.ligasSin?.length > 0 && <p className="cim-aviso-mini" data-testid="asent-ligassin">{esViga ? `Ligas que no entran: ${res.ligasSin.join(', ')}.` : `Ligas con un apoyo fuera de las corridas: ${res.ligasSin.join(', ')}. Su efecto no se calcula.`}</p>}
            <div className="cim-grupo-t" style={{ marginTop: 8 }}>Salidas</div>
            <button className="btn btn-secondary" data-testid="asent-pdf" disabled={!res.paneles.length || ocupado} onClick={() => salida('pdf')}>📄 Memoria PDF</button>
            <button className="btn btn-secondary" data-testid="asent-svg" disabled={!res.paneles.length || ocupado} onClick={() => salida('svg')}>Imagen (SVG) de la vista</button>
            <button className="btn btn-secondary" data-testid="asent-dxf" disabled={!res.paneles.length || ocupado} onClick={() => salida('dxf')}>DXF de la planta deformada</button>
          </div>
        </div>
      </div>
    </div>
  )
}

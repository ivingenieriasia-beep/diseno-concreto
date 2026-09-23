import { useEffect, useMemo, useRef, useState } from 'react'
import { parseModeloRam } from '../core/ramModel'
import { modeloGuardado, hace, EVENTO_MODELO } from '../core/ramSync'
import {
  inventario, proponerAgrupacion, verificarGrupo, planos, GIRO_RAM, armarManual, manualDesde, manualVacio, problemasDeNombres,
} from '../core/agrupacion'
import { generarAplicarAgrupacion } from '../core/ramScript'
import AgrupacionManual from './AgrupacionManual'

// Agrupación: de un modelo sin agrupar a unas pocas T. Tres propuestas con su
// sección, su armado verificado y el script para aplicarlas en RAM; o un
// acomodo a mano, partiendo de una de ellas o de cero, que sale igual.

const ANCHOS = [15, 20, 25]
const pct = (v) => `${Math.round(v * 100)} %`
const m3 = (v) => `${v.toFixed(2)} m³`
const GUARDADO = 'auxiv.agrupacion.manual'
// la verificación de un grupo depende de su sección y de sus miembros, no de su nombre
const firma = (g) => `${g.sec?.nombre}|${[...g.miembros].sort().join(',')}`

function Paso({ n, titulo, children, extra }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-panel)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-accent2)' }}>{n}</span>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{titulo}</span>
        {extra && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-tx3)' }}>{extra}</span>}
      </div>
      {children}
    </div>
  )
}

function Tarjeta({ P, vs, hoy, activa, onClick, subtitulo, accion, nota }) {
  const listos = vs.filter(Boolean).length
  const malos = vs.filter((v) => v && v.estado !== 'ok').length
  const kg = vs.reduce((s, v) => s + (v?.kg || 0), 0)
  const dC = hoy.concreto > 0 ? (P.concreto - hoy.concreto) / hoy.concreto : 0
  return (
    <div data-testid={`agr-propuesta-${P.id}`} onClick={onClick} style={{
      border: `2px solid ${activa ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
      background: activa ? 'var(--color-bg)' : 'var(--color-panel)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ fontSize: 13 }}>{P.id === 'manual' ? 'Manual' : P.nombre}</b>
        <span style={{ marginLeft: 'auto' }}>{accion}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginTop: 1 }}>{subtitulo}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 14, rowGap: 2, marginTop: 6, fontSize: 12, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
        <span data-testid={`agr-ngrupos-${P.id}`}><b style={{ fontSize: 18 }}>{P.grupos.length}</b> grupos</span>
        <span>{m3(P.concreto)} <span style={{ color: dC > 0 ? '#92400e' : '#15803d' }}>({dC >= 0 ? '+' : ''}{Math.round(dC * 100)} % vs hoy)</span></span>
        <span>{listos === vs.length ? `${kg.toFixed(0)} kg` : `verificando ${listos}/${vs.length}…`}</span>
      </div>
      <div data-testid={`agr-estado-${P.id}`} style={{ fontSize: 11, marginTop: 3, color: listos < vs.length ? 'var(--color-tx3)' : malos ? '#c62828' : '#15803d' }}>
        {!vs.length ? 'todavía sin grupos' : listos < vs.length ? 'armando cada grupo con la Fase 1…' : malos ? `✗ ${malos} grupo(s) a revisar` : '✓ todos los grupos pasan con su armado propuesto'}
      </div>
      {nota && <div style={{ fontSize: 10.5, color: '#92400e', marginTop: 2 }}>{nota}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', columnGap: 8, rowGap: 3, marginTop: 8, fontSize: 11, alignItems: 'baseline' }}>
        {P.grupos.map((g, i) => {
          const v = vs[i]
          return [
            <b key={`${i}n`} style={{ color: v ? (v.estado === 'ok' ? '#15803d' : '#c62828') : 'inherit' }}>{v ? (v.estado === 'ok' ? '✓' : '✗') : '·'} {g.nombre}</b>,
            <span key={`${i}s`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{g.sec ? g.sec.nombre.replace(' X ', '×') : '—'}{g.fuera ? ' ⚠' : ''}</span>,
            <span key={`${i}c`} style={{ color: 'var(--color-tx3)' }}>{g.elems.length} trabe(s) · {g.miembros.length} miembros</span>,
            <span key={`${i}u`} style={{ color: 'var(--color-tx3)' }} title={v?.texto || ''}>
              aprovechamiento {pct(g.uMin)}–{pct(g.uMax)}
              {v?.motivos?.length ? <span style={{ color: '#c62828' }}> · {v.motivos[0]}</span> : null}
              {g.fuera ? <span style={{ color: '#c62828' }}> · {g.auto === false ? 'no cabe en la sección fijada' : 'ninguna del catálogo alcanza'}</span> : null}
            </span>,
          ]
        })}
      </div>
    </div>
  )
}

export default function AgrupacionView({ onToast }) {
  const [fuente, setFuente] = useState(null)       // { archivo, at, R }
  const [aviso, setAviso] = useState('')
  const [elegidos, setElegidos] = useState(null)   // Set de grupos a agrupar
  const [anchos, setAnchos] = useState(ANCHOS)
  const [verif, setVerif] = useState({})           // `${propuesta}|${grupo}` → resultado de la Fase 1
  const [elegida, setElegida] = useState('equilibrada')
  const [manual, setManual] = useState(null)       // el acomodo a mano (ver core/agrupacion)
  const [hist, setHist] = useState([])             // acomodos anteriores, para deshacer
  const [sel, setSel] = useState(() => new Set())  // trabes seleccionadas en la planta
  const [verifM, setVerifM] = useState({})         // firma del grupo → resultado de la Fase 1
  const verifMRef = useRef({})
  const restaurado = useRef(false)
  const archivoRef = useRef(null)

  const usar = (texto, archivo, at = Date.now()) => {
    const R = parseModeloRam(texto, archivo)
    if (!R.ok) { setAviso(R.warnings[0] || 'No se pudo leer el modelo.'); return }
    setAviso('')
    setFuente({ archivo, at, R })
    setElegidos(new Set(inventario(R).filter((g) => g.sugerido).map((g) => g.nombre)))
    setVerif({})
    verifMRef.current = {}
    setVerifM({})
  }

  // el último modelo sincronizado (Reportes de RAM lo deja guardado)
  useEffect(() => {
    const cargar = () => modeloGuardado().then((m) => { if (m?.datos) usar(m.datos, m.archivo || 'modelo.json', m.at) })
    cargar()
    window.addEventListener(EVENTO_MODELO, cargar)
    return () => window.removeEventListener(EVENTO_MODELO, cargar)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const inv = useMemo(() => (fuente ? inventario(fuente.R) : []), [fuente])
  const A = useMemo(() => {
    if (!fuente || !elegidos?.size || !anchos.length) return null
    try { return proponerAgrupacion(fuente.R, [...elegidos], { anchos }) } catch (e) { console.error(e); return null }
  }, [fuente, elegidos, anchos])

  // Verificar cada grupo con la Fase 1, de a uno para que la pantalla respire
  useEffect(() => {
    if (!A || !fuente) return
    let vivo = true
    setVerif({})
    ;(async () => {
      for (const P of A.propuestas) {
        for (const g of P.grupos) {
          await new Promise((r) => setTimeout(r, 0))
          if (!vivo) return
          let v = null
          try { v = verificarGrupo(fuente.R, g) } catch (e) { console.error(e) }
          setVerif((prev) => ({ ...prev, [`${P.id}|${g.nombre}`]: v || { estado: 'sin' } }))
        }
      }
    })()
    return () => { vivo = false }
  }, [A, fuente])

  // ── acomodo manual ──
  const [giro, setGiro] = useState(() => {
    try { const g = parseInt(localStorage.getItem(GUARDADO + '.giro'), 10); return Number.isFinite(g) ? g : GIRO_RAM } catch { return GIRO_RAM }
  })
  const girar = () => {
    const g = (giro + 1) % 4
    try { localStorage.setItem(GUARDADO + '.giro', String(g)) } catch { /* sin almacenamiento */ }
    setGiro(g)
  }
  const geo = useMemo(() => (A && fuente ? planos(fuente.R, A.elementos, { giro }) : null), [A, fuente, giro])
  const M = useMemo(() => (A && manual ? armarManual(A.elementos, A.cands, manual) : null), [A, manual])

  // lo que se estaba acomodando la última vez, si es de este modelo
  useEffect(() => {
    if (!A || manual || restaurado.current) return
    restaurado.current = true
    try {
      const g = JSON.parse(localStorage.getItem(GUARDADO) || 'null')
      const ids = new Set(A.elementos.map((e) => e.id))
      if (g?.manual?.grupos && Object.keys(g.manual.de || {}).some((id) => ids.has(id))) {
        setManual(g.manual)
        setElegida('manual')
      }
    } catch { /* sin almacenamiento: se empieza de nuevo */ }
  }, [A, manual])
  useEffect(() => {
    try {
      if (manual) localStorage.setItem(GUARDADO, JSON.stringify({ manual, archivo: fuente?.archivo, at: Date.now() }))
    } catch { /* sin almacenamiento */ }
  }, [manual, fuente])

  const cambiar = (f) => {
    const nuevo = typeof f === 'function' ? f(manual) : f
    if (manual) setHist((h) => [...h.slice(-59), manual])
    setManual(nuevo)
  }
  const deshacer = () => {
    if (!hist.length) return
    setManual(hist[hist.length - 1])
    setHist((h) => h.slice(0, -1))
  }
  const ajustar = (P) => {
    cambiar(manualDesde(P))
    setElegida('manual')
    if (manual) onToast?.(`El acomodo manual ahora parte de «${P.nombre}» (↶ deshacer para volver al anterior)`, 'ok')
  }
  const empezarVacio = () => {
    cambiar(manualVacio())
    setElegida('manual')
  }
  const descartar = () => {
    setHist([])
    setManual(null)
    setSel(new Set())
    if (elegida === 'manual') setElegida('equilibrada')
    try { localStorage.removeItem(GUARDADO) } catch { /* sin almacenamiento */ }
  }

  // Verificar los grupos del acomodo con la Fase 1: sólo los que cambiaron
  useEffect(() => {
    if (!M || !fuente) return
    let vivo = true
    ;(async () => {
      for (const g of M.grupos) {
        const k = firma(g)
        if (verifMRef.current[k]) continue
        await new Promise((r) => setTimeout(r, 0))
        if (!vivo) return
        let v = null
        try { v = verificarGrupo(fuente.R, g) } catch (e) { console.error(e) }
        verifMRef.current[k] = v || { estado: 'sin' }
        setVerifM({ ...verifMRef.current })
      }
    })()
    return () => { vivo = false }
  }, [M, fuente])

  const verifDe = (P, g) => (P.id === 'manual' ? verifM[firma(g)] : verif[`${P.id}|${g.nombre}`])
  const mostrada = elegida === 'manual' ? M : A?.propuestas.find((p) => p.id === elegida)
  const ocupados = inv.filter((g) => !elegidos?.has(g.nombre)).map((g) => g.nombre)
  const problemas = mostrada ? problemasDeNombres(mostrada.grupos, ocupados) : []

  const cargarArchivo = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) usar(await f.text(), f.name, f.lastModified)
  }

  const bajar = () => {
    const P = mostrada
    if (!P) return
    if (!P.grupos.length) { setAviso('El acomodo no tiene ningún grupo con trabes.'); return }
    if (problemas.length) { setAviso(problemas.join(' ')); return }
    setAviso('')
    const r = generarAplicarAgrupacion(P)
    if (!r.ok) { setAviso(r.aviso); return }
    const url = URL.createObjectURL(new Blob([r.texto], { type: 'text/x-python;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = r.nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    onToast?.(`${r.nombre} descargado: en RAM, Abrir Script… → Ctrl+R`, 'ok')
  }

  const conmuta = (set, v) => { const s = new Set(set); if (s.has(v)) s.delete(v); else s.add(v); return s }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1400, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 800 }}>Agrupación de trabes</span>
        <span style={{ fontSize: 11.5, color: 'var(--color-tx3)' }}>
          Primera iteración: las demandas son las del análisis con las secciones de hoy. Aplicar, reanalizar y volver a agrupar.
        </span>
      </div>

      <div data-testid="agr-fuente" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11.5, padding: '8px 12px', borderRadius: 9, border: '1px dashed var(--color-border)', background: 'var(--color-bg)' }}>
        {fuente
          ? <span>Modelo: <b>{fuente.archivo}</b> · {Object.keys(fuente.R.model.nodes).length} nudos · {fuente.R.grupos.reduce((s, g) => s + g.n, 0)} miembros · {hace(fuente.at)}
              {fuente.R.conMedidas ? ' · con las medidas reales de RAM' : ' · medidas deducidas de los nombres (sincroniza con el script nuevo para tener las reales)'}</span>
          : <span>No hay modelo todavía: sincroniza en <b>Reportes de RAM</b>, o carga un <b>modelo.json</b>.</span>}
        <button className="btn btn-secondary" style={{ fontSize: 11, marginLeft: 'auto' }} onClick={() => archivoRef.current?.click()}>Cargar modelo.json…</button>
        <input ref={archivoRef} data-testid="agr-archivo" type="file" accept=".json" style={{ display: 'none' }} onChange={cargarArchivo} />
      </div>
      {aviso && <div style={{ color: '#c62828', fontSize: 11.5 }}>{aviso}</div>}

      {fuente && (
        <Paso n="1" titulo="Qué agrupar" extra="Se sugieren las trabes de 15 cm o más; las nervaduras y las columnas, no">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {inv.map((g) => (
              <label key={g.nombre} data-testid={`agr-grupo-${g.nombre}`} style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
                border: `1px solid ${elegidos?.has(g.nombre) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: elegidos?.has(g.nombre) ? 'var(--color-bg)' : 'transparent', opacity: g.tipo === 'trabe' ? 1 : 0.6,
              }}>
                <input type="checkbox" checked={!!elegidos?.has(g.nombre)} onChange={() => setElegidos((s) => conmuta(s, g.nombre))} />
                <b>{g.nombre}</b>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>{g.b && g.h ? `${g.b}×${g.h}` : g.seccion}</span>
                <span style={{ color: 'var(--color-tx3)' }}>{g.n}{g.tipo !== 'trabe' ? ` · ${g.tipo}` : ''}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11.5 }}>
            <span style={{ color: 'var(--color-tx2)' }}>Anchos que se pueden proponer:</span>
            {ANCHOS.map((b) => (
              <label key={b} data-testid={`agr-ancho-${b}`} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={anchos.includes(b)} onChange={() => setAnchos((a) => (a.includes(b) ? a.filter((x) => x !== b) : [...a, b].sort((x, y) => x - y)))} />
                {b} cm
              </label>
            ))}
            <span style={{ color: 'var(--color-tx3)', fontSize: 10.5 }}>(el ancho suele mandarlo el muro o la columna)</span>
          </div>
        </Paso>
      )}

      {A && (
        <Paso n="2" titulo="Propuestas"
          extra={`${A.elementos.length} trabes continuas · hoy ${A.hoy.grupos} grupos, ${m3(A.hoy.concreto)} · sin juntar nada serían ${A.natural.grupos.length} grupos, ${m3(A.natural.concreto)}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {A.propuestas.map((P) => (
              <Tarjeta key={P.id} P={P} vs={P.grupos.map((g) => verifDe(P, g))} hoy={A.hoy} activa={elegida === P.id} onClick={() => setElegida(P.id)}
                subtitulo={`sube una clase de sección si su trabe más cargada aprovecharía la mayor al ${pct(P.tau)}`}
                accion={<button className="btn btn-secondary" data-testid={`agr-ajustar-${P.id}`} style={{ fontSize: 10.5, padding: '1px 8px' }}
                  title="Copiarla al acomodo manual para mover trabes" onClick={(ev) => { ev.stopPropagation(); ajustar(P) }}>✎ a mano</button>} />
            ))}
            {M ? (
              <Tarjeta P={M} vs={M.grupos.map((g) => verifDe(M, g))} hoy={A.hoy} activa={elegida === 'manual'} onClick={() => setElegida('manual')}
                subtitulo={manual.base === 'cero' ? 'acomodada a mano, desde cero' : `acomodada a mano, desde «${manual.base}»`}
                nota={M.sueltos.length ? `${M.sueltos.length} trabe(s) sin asignar: en RAM no se tocan` : ''}
                accion={<button className="btn btn-secondary" data-testid="agr-descartar" style={{ fontSize: 10.5, padding: '1px 8px' }}
                  title="Tirar el acomodo manual" onClick={(ev) => { ev.stopPropagation(); descartar() }}>✕ descartar</button>} />
            ) : (
              <div data-testid="agr-propuesta-manual" style={{ border: '2px dashed var(--color-border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <b style={{ fontSize: 13 }}>Manual</b>
                <span style={{ fontSize: 11.5, color: 'var(--color-tx2)', lineHeight: 1.55 }}>
                  Acomoda tú las trabes, viéndolas en planta: parte de una propuesta (<b>✎ a mano</b> en su tarjeta)
                  y mueve las que no te convenzan, o empieza de cero y arma los grupos por ejes o por niveles.
                </span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" data-testid="agr-desde-elegida" style={{ fontSize: 11 }} onClick={() => ajustar(mostrada || A.propuestas[1])}>
                    ✎ partir de «{(mostrada || A.propuestas[1]).nombre}»
                  </button>
                  <button className="btn btn-secondary" data-testid="agr-vacio" style={{ fontSize: 11 }} onClick={empezarVacio}>empezar de cero</button>
                </span>
              </div>
            )}
          </div>
          {A.noHorizontales > 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginTop: 8 }}>
              {A.noHorizontales} miembro(s) de esos grupos no son horizontales: no se agrupan y se quedan como están.
            </div>
          )}
        </Paso>
      )}

      {A && geo && mostrada && (
        <Paso n="3" titulo={elegida === 'manual' ? 'Acomodar a mano' : 'Verla en planta'}
          extra={elegida === 'manual' ? 'selecciona trabes en la planta y mándalas a un grupo' : 'los colores son sus grupos; la línea punteada roja, una trabe que no cabe'}>
          <AgrupacionManual A={A} R={fuente.R} geo={geo} P={mostrada} editable={elegida === 'manual'} manual={manual} cambiar={cambiar}
            sel={sel} setSel={setSel} verifDe={(g) => verifDe(mostrada, g)} onAjustar={() => ajustar(mostrada)}
            deshacer={deshacer} nHist={hist.length} girar={girar} />
        </Paso>
      )}

      {A && mostrada && (
        <Paso n="4" titulo="Aplicarla en RAM">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11.5 }}>
            <button className="btn btn-primary" data-testid="agr-bajar" onClick={bajar} disabled={!mostrada.grupos.length || problemas.length > 0}>
              ⬇ aplicar_agrupacion.py — {mostrada.id === 'manual' ? 'Manual' : mostrada.nombre}
            </button>
            <span style={{ color: 'var(--color-tx2)', lineHeight: 1.6, flex: '1 1 420px' }}>
              Pone a cada miembro su T y su sección. Antes comprueba que las secciones existan en RAM
              (si no, corre <b>instalar_catalogo.py</b>) y deja en tu Escritorio un <b>«Deshacer agrupación»</b>.
              En RAM: <b>Abrir Script… → Ctrl+R</b>; luego reanaliza y sincroniza.
            </span>
          </div>
          {problemas.length > 0 && (
            <div data-testid="agr-problemas" style={{ color: '#c62828', fontSize: 11.5, marginTop: 6 }}>{problemas.join(' ')}</div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginTop: 8, lineHeight: 1.6 }}>
            Dimensiona con el momento a ½ ρ balanceada y el cortante con estribos #2.5 a no menos de 8 cm; el armado de cada
            grupo lo da la Fase 1 con los mismos motores de Longitudinal. No revisa deflexiones: ésas las dirá RAM al reanalizar.
          </div>
        </Paso>
      )}
    </div>
  )
}

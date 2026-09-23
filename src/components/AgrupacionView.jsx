import { useEffect, useMemo, useRef, useState } from 'react'
import { parseModeloRam } from '../core/ramModel'
import { modeloGuardado, hace, EVENTO_MODELO } from '../core/ramSync'
import {
  inventario, proponerAgrupacion, verificarGrupo, planos, GIRO_RAM, PERALTES, armarManual, manualDesde, manualVacio, problemasDeNombres,
} from '../core/agrupacion'
import {
  proponerColumnas, verificarColumnas, planosColumnas, COLUMNAS_CATALOGO, COLUMNAS_DE_FABRICA, RHO_COL_DIM,
} from '../core/agrupacionColumnas'
import { generarAplicarAgrupacion } from '../core/ramScript'
import AgrupacionManual from './AgrupacionManual'
import useBeamStore from '../store/useBeamStore'
import { guardarSalida, dondeQuedo, sello } from '../core/carpeta'

// Agrupación: de un modelo sin agrupar a unas pocas T (o unas pocas C). Tres
// propuestas con su sección, su armado verificado y el script para aplicarlas
// en RAM; o un acomodo a mano, partiendo de una de ellas o de cero, que sale
// igual. Las trabes se dimensionan por flexión y cortante; las columnas, con
// el diagrama de interacción de cada sección.

const ANCHOS = [15, 20, 25]
const FILTROS = 'auxiv.agrupacion.filtros'
const PIEZA = 'auxiv.agrupacion.pieza'
const leerFiltros = () => { try { return JSON.parse(localStorage.getItem(FILTROS) || 'null') || {} } catch { return {} } }
const guardarFiltros = (cambio) => { try { localStorage.setItem(FILTROS, JSON.stringify({ ...leerFiltros(), ...cambio })) } catch { /* sin almacenamiento */ } }
const alterna = (lista, v) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v].sort((x, y) => x - y))
const pct = (v) => `${Math.round(v * 100)} %`
const m3 = (v) => `${v.toFixed(2)} m³`
const GIRO = 'auxiv.agrupacion.manual.giro'
// la verificación de un grupo depende de su sección y de sus miembros, no de su nombre
const firma = (g) => `${g.sec?.nombre}|${[...g.miembros].sort().join(',')}`
const corto = (nombre) => nombre.replace(/^COL /, '').replace(' X ', '×')

/** Lo que cambia entre agrupar trabes y agrupar columnas */
const PIEZAS = {
  trabe: {
    titulo: 'Agrupación de trabes', boton: 'Trabes', una: 'trabe', unas: 'trabe(s)', pre: 'T',
    guardado: 'auxiv.agrupacion.manual',
    sugerir: (g) => g.sugerido,
    extraQue: 'Se sugieren las trabes de 15 cm o más; las nervaduras y las columnas, no',
    verificar: verificarGrupo,
  },
  columna: {
    titulo: 'Agrupación de columnas', boton: 'Columnas', una: 'columna', unas: 'columna(s)', pre: 'C',
    guardado: 'auxiv.agrupacion.columnas.manual',
    sugerir: (g) => g.tipo === 'columna',
    extraQue: 'Se sugieren los grupos de columnas; las trabes, no',
    verificar: verificarColumnas,
  },
}

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

function Tarjeta({ P, vs, hoy, activa, onClick, subtitulo, accion, nota, unas = 'trabe(s)' }) {
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
            <span key={`${i}s`} data-sec={g.sec?.nombre || ''} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{g.sec ? corto(g.sec.nombre) : '—'}{g.fuera ? ' ⚠' : ''}</span>,
            <span key={`${i}c`} style={{ color: 'var(--color-tx3)' }}>{g.elems.length} {unas} · {g.miembros.length} miembros</span>,
            <span key={`${i}u`} style={{ color: 'var(--color-tx3)' }} title={v?.texto || ''}>
              aprovechamiento {pct(g.uMin)}–{pct(g.uMax)}
              {v?.motivos?.length ? <span style={{ color: '#c62828' }}> · {v.motivos[0]}</span> : null}
              {g.fuera ? <span style={{ color: '#c62828' }}> · {g.auto === false ? 'no cabe en la sección fijada' : 'ninguna sección permitida alcanza'}</span> : null}
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
  const [pieza, setPieza] = useState(() => { try { return localStorage.getItem(PIEZA) === 'columna' ? 'columna' : 'trabe' } catch { return 'trabe' } })
  // lo de cada pieza que no debe perderse al cambiar de una a otra (sólo se monta la activa)
  const memo = useRef({ trabe: {}, columna: {} })
  const archivoRef = useRef(null)

  const usar = (texto, archivo, at = Date.now()) => {
    const R = parseModeloRam(texto, archivo)
    if (!R.ok) { setAviso(R.warnings[0] || 'No se pudo leer el modelo.'); return }
    setAviso('')
    memo.current = { trabe: {}, columna: {} }
    setFuente({ archivo, at, R })
  }

  // el último modelo sincronizado (Reportes de RAM lo deja guardado)
  useEffect(() => {
    const cargar = () => modeloGuardado().then((m) => { if (m?.datos) usar(m.datos, m.archivo || 'modelo.json', m.at) })
    cargar()
    window.addEventListener(EVENTO_MODELO, cargar)
    return () => window.removeEventListener(EVENTO_MODELO, cargar)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [giro, setGiro] = useState(() => {
    try { const g = parseInt(localStorage.getItem(GIRO), 10); return Number.isFinite(g) ? g : GIRO_RAM } catch { return GIRO_RAM }
  })
  const girar = () => {
    const g = (giro + 1) % 4
    try { localStorage.setItem(GIRO, String(g)) } catch { /* sin almacenamiento */ }
    setGiro(g)
  }

  const inv = useMemo(() => (fuente ? inventario(fuente.R) : []), [fuente])
  const cuenta = (tipo) => inv.filter((g) => g.tipo === tipo).reduce((s, g) => s + g.n, 0)
  const elegir = (p) => {
    setPieza(p)
    try { localStorage.setItem(PIEZA, p) } catch { /* sin almacenamiento */ }
  }

  const cargarArchivo = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) usar(await f.text(), f.name, f.lastModified)
  }

  const boton = (p) => {
    const on = pieza === p
    const n = cuenta(p)
    return (
      <button key={p} data-testid={`agr-pieza-${p}`} onClick={() => elegir(p)} aria-pressed={on} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
        border: 'none', borderRadius: 8, color: on ? '#fff' : 'var(--color-tx2)', background: on ? 'var(--color-accent)' : 'transparent',
      }}>
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
          {p === 'trabe'
            ? <><rect x="1" y="4" width="16" height="5" rx="1" fill="currentColor" /><rect x="1" y="9" width="2.5" height="4" fill="currentColor" opacity=".5" /><rect x="14.5" y="9" width="2.5" height="4" fill="currentColor" opacity=".5" /></>
            : <><rect x="6" y="1" width="6" height="12" rx="1" fill="currentColor" /><rect x="1" y="1" width="16" height="2" fill="currentColor" opacity=".5" /></>}
        </svg>
        {PIEZAS[p].boton}
        {fuente && <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.8, fontFamily: 'var(--font-mono)' }}>{n} miembros</span>}
      </button>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1400, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{PIEZAS[pieza].titulo}</span>
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

      <div role="group" aria-label="Qué se agrupa" data-testid="agr-pieza" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 3, padding: 3, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-panel)' }}>
          {boton('trabe')}{boton('columna')}
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>
          {pieza === 'trabe'
            ? 'por flexión y cortante: momento con ½ ρ balanceada, cortante con estribos que se pueden armar'
            : 'por flexocompresión: la demanda de cada columna sobre el diagrama de interacción de cada sección'}
        </span>
      </div>

      {fuente && (
        <Agrupador key={`${pieza}|${fuente.at}|${fuente.archivo}`} pieza={pieza} fuente={fuente} inv={inv} memo={memo.current[pieza]}
          giro={giro} girar={girar} onToast={onToast} setAvisoGeneral={setAviso} />
      )}
    </div>
  )
}

/** Todo lo de una pieza: qué agrupar, propuestas, planta y aplicar */
function Agrupador({ pieza, fuente, inv, memo, giro, girar, onToast, setAvisoGeneral }) {
  const K = PIEZAS[pieza]
  const esCol = pieza === 'columna'
  const [elegidos, setElegidos] = useState(() => memo.elegidos || new Set(inv.filter(K.sugerir).map((g) => g.nombre)))
  const [anchos, setAnchos] = useState(() => leerFiltros().anchos || ANCHOS)
  const [peraltes, setPeraltes] = useState(() => leerFiltros().peraltes || PERALTES)
  const [permitidas, setPermitidas] = useState(() => leerFiltros().columnas || COLUMNAS_DE_FABRICA)
  const [completa, setCompleta] = useState(() => !!leerFiltros().completa)
  useEffect(() => { guardarFiltros(esCol ? { columnas: permitidas, completa } : { anchos, peraltes }) }, [esCol, anchos, peraltes, permitidas, completa])
  const [verif, setVerif] = useState(() => memo.verif || {})            // `${propuesta}|${grupo}` → resultado de la Fase 1
  const [elegida, setElegida] = useState(() => memo.elegida || 'equilibrada')
  const [manual, setManual] = useState(() => memo.manual || null)       // el acomodo a mano (ver core/agrupacion)
  const [hist, setHist] = useState(() => memo.hist || [])               // acomodos anteriores, para deshacer
  const [sel, setSel] = useState(() => memo.sel || new Set())           // seleccionadas en la planta
  const [verifM, setVerifM] = useState(() => memo.verifM || {})         // firma del grupo → resultado de la Fase 1
  const verifMRef = useRef(memo.verifM || {})
  const restaurado = useRef(!!memo.restaurado)
  const [aviso, setAviso] = useState('')
  // lo que no debe perderse al cambiar de pieza
  useEffect(() => { Object.assign(memo, { elegidos, verif, elegida, manual, hist, sel, verifM, restaurado: restaurado.current }) })

  const A = useMemo(() => {
    if (!elegidos?.size) return null
    try {
      if (esCol) return permitidas.length ? proponerColumnas(fuente.R, [...elegidos], { permitidas, completa }) : null
      if (!anchos.length || !peraltes.length) return null
      return proponerAgrupacion(fuente.R, [...elegidos], { anchos, peraltes })
    } catch (e) { console.error(e); return null }
  }, [fuente, elegidos, anchos, peraltes, permitidas, completa, esCol])

  // Verificar cada grupo con la Fase 1, de a uno para que la pantalla respire.
  // Al volver a esta pieza con las mismas propuestas, lo ya verificado se queda.
  const firmaA = useMemo(() => (A ? A.propuestas.map((P) => P.grupos.map(firma).join(';')).join('/') : ''), [A])
  useEffect(() => {
    if (!A) return
    let vivo = true
    const ya = memo.firmaA === firmaA ? { ...(memo.verif || {}) } : {}
    memo.firmaA = firmaA
    setVerif(ya)
    ;(async () => {
      for (const P of A.propuestas) {
        for (const g of P.grupos) {
          const k = `${P.id}|${g.nombre}`
          if (ya[k]) continue
          await new Promise((r) => setTimeout(r, 0))
          if (!vivo) return
          let v = null
          try { v = K.verificar(fuente.R, g) } catch (e) { console.error(e) }
          setVerif((prev) => ({ ...prev, [k]: v || { estado: 'sin' } }))
        }
      }
    })()
    return () => { vivo = false }
  }, [A, fuente]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── acomodo manual ──
  const geo = useMemo(() => {
    if (!A) return null
    return esCol ? planosColumnas(fuente.R, A.elementos, { giro, completa }) : planos(fuente.R, A.elementos, { giro })
  }, [A, fuente, giro, esCol, completa])
  const M = useMemo(() => (A && manual ? armarManual(A.elementos, A.cands, manual) : null), [A, manual])

  // lo que se estaba acomodando la última vez, si es de este modelo
  useEffect(() => {
    if (!A || manual || restaurado.current) return
    restaurado.current = true
    try {
      const g = JSON.parse(localStorage.getItem(K.guardado) || 'null')
      const ids = new Set(A.elementos.map((e) => e.id))
      if (g?.manual?.grupos && Object.keys(g.manual.de || {}).some((id) => ids.has(id))) {
        setManual(g.manual)
        setElegida('manual')
      }
    } catch { /* sin almacenamiento: se empieza de nuevo */ }
  }, [A, manual]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      if (manual) localStorage.setItem(K.guardado, JSON.stringify({ manual, archivo: fuente?.archivo, at: Date.now() }))
    } catch { /* sin almacenamiento */ }
  }, [manual, fuente]) // eslint-disable-line react-hooks/exhaustive-deps

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
    try { localStorage.removeItem(K.guardado) } catch { /* sin almacenamiento */ }
  }

  // Verificar los grupos del acomodo con la Fase 1: sólo los que cambiaron
  useEffect(() => {
    if (!M) return
    let vivo = true
    ;(async () => {
      for (const g of M.grupos) {
        const k = firma(g)
        if (verifMRef.current[k]) continue
        await new Promise((r) => setTimeout(r, 0))
        if (!vivo) return
        let v = null
        try { v = K.verificar(fuente.R, g) } catch (e) { console.error(e) }
        verifMRef.current[k] = v || { estado: 'sin' }
        setVerifM({ ...verifMRef.current })
      }
    })()
    return () => { vivo = false }
  }, [M, fuente]) // eslint-disable-line react-hooks/exhaustive-deps

  const verifDe = (P, g) => (P.id === 'manual' ? verifM[firma(g)] : verif[`${P.id}|${g.nombre}`])
  const mostrada = elegida === 'manual' ? M : A?.propuestas.find((p) => p.id === elegida)
  const ocupados = inv.filter((g) => !elegidos?.has(g.nombre)).map((g) => g.nombre)
  const problemas = mostrada ? problemasDeNombres(mostrada.grupos, ocupados) : []

  const rutaRam = useBeamStore((s) => s.rutaRam)
  const bajar = async () => {
    const P = mostrada
    if (!P) return
    if (!P.grupos.length) { setAviso(`El acomodo no tiene ningún grupo con ${esCol ? 'columnas' : 'trabes'}.`); return }
    if (problemas.length) { setAviso(problemas.join(' ')); return }
    setAviso('')
    setAvisoGeneral('')
    // el «Deshacer» que deja el script va a la carpeta 1 Agrupación de la obra
    const r = generarAplicarAgrupacion(P, { carpetaDeshacer: rutaRam ? `${rutaRam}\\1 Agrupación` : '' })
    if (!r.ok) { setAviso(r.aviso); return }
    const nombre = `aplicar_agrupacion${esCol ? ' columnas' : ''} ${sello()}.py`
    const g = await guardarSalida(nombre, new Blob([r.texto], { type: 'text/x-python;charset=utf-8' }), { sub: 'agrupacion' })
    onToast?.(`${nombre} ${dondeQuedo(g)}: en RAM, Abrir Script… → Ctrl+R`, 'ok')
  }

  const conmuta = (set, v) => { const s = new Set(set); if (s.has(v)) s.delete(v); else s.add(v); return s }
  const faltaFiltro = esCol ? !permitidas.length : (!anchos.length || !peraltes.length)

  return (
    <>
      {aviso && <div style={{ color: '#c62828', fontSize: 11.5 }}>{aviso}</div>}
      <Paso n="1" titulo="Qué agrupar" extra={K.extraQue}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {inv.map((g) => (
            <label key={g.nombre} data-testid={`agr-grupo-${g.nombre}`} style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
              border: `1px solid ${elegidos?.has(g.nombre) ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: elegidos?.has(g.nombre) ? 'var(--color-bg)' : 'transparent', opacity: g.tipo === pieza ? 1 : 0.6,
            }}>
              <input type="checkbox" checked={!!elegidos?.has(g.nombre)} onChange={() => setElegidos((s) => conmuta(s, g.nombre))} />
              <b>{g.nombre}</b>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>{g.b && g.h ? `${g.b}×${g.h}` : g.seccion}</span>
              <span style={{ color: 'var(--color-tx3)' }}>{g.n}{g.tipo !== pieza ? ` · ${g.tipo}` : ''}</span>
            </label>
          ))}
        </div>

        {esCol ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11.5, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-tx2)' }}>Secciones que se pueden proponer:</span>
              {COLUMNAS_CATALOGO.map((s) => (
                <label key={s.nombre} data-testid={`agr-colsec-${s.b}x${s.h}`} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  title={Math.min(s.b, s.h) < 20 ? 'Lado menor de 20 cm: castillo' : ''}>
                  <input type="checkbox" checked={permitidas.includes(s.nombre)}
                    onChange={() => setPermitidas((a) => (a.includes(s.nombre) ? a.filter((x) => x !== s.nombre) : [...a, s.nombre]))} />
                  {corto(s.nombre)}
                </label>
              ))}
              <span style={{ color: 'var(--color-tx3)', fontSize: 10.5 }}>(las del catálogo; de fábrica, las de 20 cm o más por lado)</span>
            </div>
            <label data-testid="agr-completa" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5, cursor: 'pointer', width: 'fit-content' }}>
              <input type="checkbox" checked={completa} onChange={() => setCompleta((v) => !v)} />
              <span><b>Misma sección en toda la altura</b> <span style={{ color: 'var(--color-tx3)', fontSize: 10.5 }}>
                (cada columna completa, de la base a la azotea; sin marcar, cada entrepiso por separado)</span></span>
            </label>
            {!permitidas.length && <div style={{ color: '#c62828', fontSize: 11, marginTop: 6 }}>Marca al menos una sección.</div>}
            {A?.sinM22 && (
              <div data-testid="agr-sin-m22" style={{ marginTop: 8, fontSize: 11.5, color: '#92400e', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.4)', borderRadius: 8, padding: '7px 10px', lineHeight: 1.55 }}>
                <b>Este modelo.json es de un sincronizar.py anterior:</b> sus columnas traen el P máximo y el M33 máximo por separado y sin M22,
                así que la flexocompresión sale incompleta. Genera el sincronizar.py nuevo (<b>Reportes de RAM → Configurar RAM</b>), córrelo en RAM y
                vuelve a sincronizar: trae P, M22 y M33 de cada combinación en el pie y la cabeza de cada columna.
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11.5 }}>
              <span style={{ color: 'var(--color-tx2)' }}>Anchos que se pueden proponer:</span>
              {ANCHOS.map((b) => (
                <label key={b} data-testid={`agr-ancho-${b}`} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={anchos.includes(b)} onChange={() => setAnchos((a) => alterna(a, b))} />
                  {b} cm
                </label>
              ))}
              <span style={{ color: 'var(--color-tx3)', fontSize: 10.5 }}>(el ancho suele mandarlo el muro o la columna)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11.5, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-tx2)' }}>Peraltes que se pueden proponer:</span>
              {PERALTES.map((h) => (
                <label key={h} data-testid={`agr-peralte-${h}`} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={peraltes.includes(h)} onChange={() => setPeraltes((a) => alterna(a, h))} />
                  {h}
                </label>
              ))}
              <span style={{ color: 'var(--color-tx2)' }}>cm</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }} title="Marca todos los peraltes hasta éste y ninguno más grande">
                tope
                <select data-testid="agr-tope" value={peraltes.length ? Math.max(...peraltes) : ''}
                  onChange={(e) => setPeraltes(PERALTES.filter((h) => h <= +e.target.value))}
                  style={{ fontSize: 11.5, border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-bg)', color: 'inherit' }}>
                  {PERALTES.map((h) => <option key={h} value={h}>{h} cm</option>)}
                </select>
              </label>
              <span style={{ color: 'var(--color-tx3)', fontSize: 10.5 }}>(el peralte suele mandarlo la arquitectura: plafones, ventanas, altura libre)</span>
            </div>
            {(!anchos.length || !peraltes.length) && (
              <div style={{ color: '#c62828', fontSize: 11, marginTop: 6 }}>Marca al menos un ancho y un peralte.</div>
            )}
          </>
        )}
        {!faltaFiltro && elegidos?.size > 0 && A && !A.elementos.length && (
          <div data-testid="agr-sin-elementos" style={{ color: '#92400e', fontSize: 11.5, marginTop: 8 }}>
            Esos grupos no tienen {esCol ? 'miembros verticales (columnas)' : 'miembros horizontales (trabes)'} con resultados.
          </div>
        )}
      </Paso>

      {A && A.elementos.length > 0 && (
        <Paso n="2" titulo="Propuestas"
          extra={`${A.elementos.length} ${esCol ? (completa ? 'columnas completas' : 'columnas por entrepiso') : 'trabes continuas'} · hoy ${A.hoy.grupos} grupos, ${m3(A.hoy.concreto)} · sin juntar nada serían ${A.natural.grupos.length} grupos, ${m3(A.natural.concreto)}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {A.propuestas.map((P) => (
              <Tarjeta key={P.id} P={P} vs={P.grupos.map((g) => verifDe(P, g))} hoy={A.hoy} activa={elegida === P.id} onClick={() => setElegida(P.id)} unas={K.unas}
                subtitulo={`sube una clase de sección si su ${K.una} más cargada aprovecharía la mayor al ${pct(P.tau)}`}
                accion={<button className="btn btn-secondary" data-testid={`agr-ajustar-${P.id}`} style={{ fontSize: 10.5, padding: '1px 8px' }}
                  title={`Copiarla al acomodo manual para mover ${esCol ? 'columnas' : 'trabes'}`} onClick={(ev) => { ev.stopPropagation(); ajustar(P) }}>✎ a mano</button>} />
            ))}
            {M ? (
              <Tarjeta P={M} vs={M.grupos.map((g) => verifDe(M, g))} hoy={A.hoy} activa={elegida === 'manual'} onClick={() => setElegida('manual')} unas={K.unas}
                subtitulo={manual.base === 'cero' ? 'acomodada a mano, desde cero' : `acomodada a mano, desde «${manual.base}»`}
                nota={M.sueltos.length ? `${M.sueltos.length} ${K.unas} sin asignar: en RAM no se tocan` : ''}
                accion={<button className="btn btn-secondary" data-testid="agr-descartar" style={{ fontSize: 10.5, padding: '1px 8px' }}
                  title="Tirar el acomodo manual" onClick={(ev) => { ev.stopPropagation(); descartar() }}>✕ descartar</button>} />
            ) : (
              <div data-testid="agr-propuesta-manual" style={{ border: '2px dashed var(--color-border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <b style={{ fontSize: 13 }}>Manual</b>
                <span style={{ fontSize: 11.5, color: 'var(--color-tx2)', lineHeight: 1.55 }}>
                  {esCol
                    ? <>Acomoda tú las columnas, viéndolas en planta y en su diagrama de interacción: parte de una propuesta (<b>✎ a mano</b> en su tarjeta)
                      y mueve las que no te convenzan, o empieza de cero y arma los grupos por ejes o por entrepisos.</>
                    : <>Acomoda tú las trabes, viéndolas en planta: parte de una propuesta (<b>✎ a mano</b> en su tarjeta)
                      y mueve las que no te convenzan, o empieza de cero y arma los grupos por ejes o por niveles.</>}
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
          {A.noVerticales > 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginTop: 8 }}>
              {A.noVerticales} miembro(s) de esos grupos no son verticales: no se agrupan y se quedan como están.
            </div>
          )}
        </Paso>
      )}

      {A && A.elementos.length > 0 && geo && mostrada && (
        <Paso n="3" titulo={elegida === 'manual' ? 'Acomodar a mano' : 'Verla en planta'}
          extra={elegida === 'manual'
            ? `selecciona ${esCol ? 'columnas' : 'trabes'} en la planta o en la escala y mándalas a un grupo`
            : esCol ? 'los colores son sus grupos; con borde rojo, una columna que no cabe' : 'los colores son sus grupos; la línea punteada roja, una trabe que no cabe'}>
          <AgrupacionManual A={A} R={fuente.R} geo={geo} P={mostrada} editable={elegida === 'manual'} manual={manual} cambiar={cambiar}
            sel={sel} setSel={setSel} verifDe={(g) => verifDe(mostrada, g)} onAjustar={() => ajustar(mostrada)}
            deshacer={deshacer} nHist={hist.length} girar={girar} pieza={pieza} />
        </Paso>
      )}

      {A && A.elementos.length > 0 && mostrada && (
        <Paso n="4" titulo="Aplicarla en RAM">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11.5 }}>
            <button className="btn btn-primary" data-testid="agr-bajar" onClick={bajar} disabled={!mostrada.grupos.length || problemas.length > 0}>
              ⬇ aplicar_agrupacion.py — {mostrada.id === 'manual' ? 'Manual' : mostrada.nombre}
            </button>
            <span style={{ color: 'var(--color-tx2)', lineHeight: 1.6, flex: '1 1 420px' }}>
              Pone a cada miembro su {K.pre} y su sección. Antes comprueba que las secciones existan en RAM
              (si no, corre <b>instalar_catalogo.py</b>) y deja un <b>«Deshacer agrupación»</b> en <b>1 Agrupación</b> de la obra (o en tu Escritorio).
              En RAM: <b>Abrir Script… → Ctrl+R</b>; luego reanaliza y sincroniza.
            </span>
          </div>
          {problemas.length > 0 && (
            <div data-testid="agr-problemas" style={{ color: '#c62828', fontSize: 11.5, marginTop: 6 }}>{problemas.join(' ')}</div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginTop: 8, lineHeight: 1.6 }}>
            {esCol
              ? <>Dimensiona con el diagrama de interacción de cada sección armada cerca de {Math.round(RHO_COL_DIM * 100)} % (la de menos barras entre 1.5 y 2.5 %),
                con P, Mx y My de la misma combinación y el contorno biaxial del módulo Columnas. El armado de cada grupo lo da la Fase 1 con ese mismo motor.
                No revisa esbeltez ni cortante de columnas.</>
              : <>Dimensiona con el momento a ½ ρ balanceada y el cortante con estribos #2.5 a no menos de 8 cm; el armado de cada
                grupo lo da la Fase 1 con los mismos motores de Longitudinal. No revisa deflexiones: ésas las dirá RAM al reanalizar.</>}
          </div>
        </Paso>
      )}
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import useBeamStore from '../store/useBeamStore'
import useColumnStore from '../store/useColumnStore'
import { REPORTES, clasificarLote } from '../core/ramReports'
import { repartirEnvolventes, resumenReparto } from '../core/bulkEnvelopes'
import { parseGeometryReport, parseNodeXlsx, attachGeometry } from '../core/geometry'
import { parseModeloRam, looksLikeModeloRam, resumenModeloRam, repartirModelo, seccionSugerida, SIN_NOMBRE } from '../core/ramModel'
import { generarScriptRam, esRutaWindows, normalizarRuta, nombreCarpeta, generarInstaladorCatalogo } from '../core/ramScript'
import { SECCIONES_RAM, MATERIALES_RAM } from '../core/catalogoRam'
import { proponerTrabe, proponerColumna } from '../core/propuesta'
import {
  puedeRecordar, elegirCarpeta, carpetaGuardada, permisoDe, recorrerCarpeta, guardarCarpeta, modeloGuardado,
  guardarModelo, guardarSync, ultimaSync, cambios, resumenSync, hace, olvidarCarpeta,
} from '../core/ramSync'
import { setCarpetaActiva, asegurarArbol, escribir, respaldarModelo, rutaLegible } from '../core/carpeta'

// Centro de carga: un solo lugar para meter todo lo que sale de RAM, con el
// manual al lado — qué reporte pedir, con qué parámetros y qué llena cada uno.

const TONO = {
  ok: { bg: '#e8f5e9', bd: '#a5d6a7', fg: '#15803d' },
  pend: { bg: 'var(--color-panel)', bd: 'var(--color-border)', fg: 'var(--color-tx3)' },
  warn: { bg: '#fffbeb', bd: '#fcd34d', fg: '#92400e' },
}

function Slot({ r, estado, onCargar }) {
  const [abierto, setAbierto] = useState(false)
  const t = TONO[estado.tono || 'pend']
  return (
    <div style={{ border: `1px solid ${t.bd}`, background: t.bg, borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 12.5 }}>{estado.tono === 'ok' ? '✓' : '○'} {r.titulo}</span>
        {r.preferido && <span style={{ fontSize: 9.5, fontWeight: 800, padding: '1px 7px', borderRadius: 99, background: '#1a7a5e', color: '#fff' }}>RECOMENDADO</span>}
        <span style={{ fontSize: 10.5, color: 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>{r.formatos}</span>
        <button className="btn btn-primary" style={{ fontSize: 11, marginLeft: 'auto' }} data-testid={`slot-${r.id}`} onClick={onCargar}>
          {estado.tono === 'ok' ? 'Reemplazar…' : 'Cargar…'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: t.fg, marginTop: 4, fontFamily: 'var(--font-mono)' }}>{estado.txt}</div>
      <div style={{ fontSize: 11, color: 'var(--color-tx2)', marginTop: 5, lineHeight: 1.5 }}>
        En RAM: <b>{r.donde}</b> → <b>{r.reporte}</b>. {r.llena}
      </div>
      <button onClick={() => setAbierto((v) => !v)} data-testid={`ayuda-${r.id}`}
        style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, cursor: 'pointer', fontSize: 10.5, color: 'var(--color-accent2)', textDecoration: 'underline' }}>
        {abierto ? 'ocultar el cómo' : 'cómo pedirlo'}
      </button>
      {abierto && (
        <div style={{ fontSize: 10.5, color: 'var(--color-tx2)', marginTop: 5, lineHeight: 1.6, borderTop: `1px dashed ${t.bd}`, paddingTop: 5 }}>
          <div><b>Casillas:</b> {r.casillas.map((c) => `«${c}»`).join(' · ')}</div>
          <div><b>Parámetros:</b></div>
          <ul style={{ margin: '2px 0 0 16px', padding: 0 }}>{r.parametros.map((p) => <li key={p}>{p}</li>)}</ul>
          <div style={{ marginTop: 3 }}><b>Dónde cae:</b> {r.destino}</div>
          {r.ventaja && <div style={{ marginTop: 3, color: '#15803d' }}>✓ {r.ventaja}</div>}
          {r.aviso && <div style={{ marginTop: 3, color: '#92400e' }}>⚠ {r.aviso}</div>}
        </div>
      )}
    </div>
  )
}

export default function LoadCenter({ onClose, onToast, projectName = '' }) {
  const sections = useBeamStore((s) => s.sections)
  const setEnvelopeAt = useBeamStore((s) => s.setEnvelopeAt)
  const setPerfilAt = useBeamStore((s) => s.setPerfilAt)
  const model = useBeamStore((s) => s.model)
  const setModel = useBeamStore((s) => s.setModel)
  const setReacciones = useBeamStore((s) => s.setReacciones)
  const rutaRam = useBeamStore((s) => s.rutaRam)
  const setRutaRam = useBeamStore((s) => s.setRutaRam)
  const addSection = useBeamStore((s) => s.addSection)
  const patchSectionAt = useBeamStore((s) => s.patchSectionAt)
  const columns = useColumnStore((s) => s.columns)
  const setColEnvelopeAt = useColumnStore((s) => s.setEnvelopeAt)
  const addColumn = useColumnStore((s) => s.addColumn)
  const patchColumnAt = useColumnStore((s) => s.patchColumnAt)
  const inputRef = useRef(null)
  const dirRef = useRef(null)
  const [msg, setMsg] = useState('')
  const [drop, setDrop] = useState(false)
  const [filtro, setFiltro] = useState(null)   // id del slot que abrió el diálogo
  const [carpeta, setCarpeta] = useState(null)      // handle recordado
  const [sync, setSync] = useState(ultimaSync())
  const [ocupado, setOcupado] = useState('')
  const [faltan, setFaltan] = useState([])          // grupos del modelo sin chip
  const [sinDescripcion, setSinDescripcion] = useState(0) // miembros que RAM trae sin descripción
  const [discrepan, setDiscrepan] = useState([])    // chips con otras medidas que RAM
  const [propuestas, setPropuestas] = useState([])  // armado propuesto a las secciones recién creadas
  const [ruta, setRuta] = useState('')              // la ruta de Windows, mientras se edita
  const [avisoRuta, setAvisoRuta] = useState('')
  // El camino normal es la API de RAM; los cuatro reportes de texto siguen
  // ahí, pero detrás de su pestaña para que no estorben.
  const [pestana, setPestana] = useState(puedeRecordar() ? 'ram' : 'manual')
  // abierto es estado propio: si dependiera de rutaRam, el panel se plegaría
  // solo en cuanto se guarda la ruta — justo mientras se está usando
  const [configAbierta, setConfigAbierta] = useState(!useBeamStore.getState().rutaRam)

  // La carpeta se eligió una vez y el navegador la recuerda entre sesiones
  // …y se recuerda por proyecto: la llave es la ruta de Windows de la obra
  useEffect(() => { carpetaGuardada(rutaRam || '').then(setCarpeta) }, [rutaRam])
  const [escribible, setEscribible] = useState(false)
  useEffect(() => {
    let vivo = true
    if (!carpeta) { setEscribible(false); return }
    permisoDe(carpeta, false, 'readwrite').then((p) => { if (vivo) setEscribible(p === 'granted') })
    return () => { vivo = false }
  }, [carpeta])
  useEffect(() => { setRuta(rutaRam || '') }, [rutaRam])

  const nodes = useMemo(() => new Map(Object.entries(model?.nodes || {})), [model])

  // ── Estado de cada casilla ──
  const estados = useMemo(() => {
    const conPerfil = sections.filter((s) => s.perfil?.members?.length)
    // 'ram-api' es mejor que cualquier reporte impreso: las estaciones las puso
    // el script donde hacían falta y el pico viene exacto. No es «rejilla fija».
    const api = conPerfil.filter((s) => s.perfil.formato === 'ram-api')
    const acc = conPerfil.filter((s) => s.perfil.formato === 'acciones')
    const est = conPerfil.filter((s) => !['ram-api', 'acciones'].includes(s.perfil.formato))
    const envT = sections.filter((s) => s.envelope?.points?.length)
    const envC = columns.filter((c) => c.envelope?.points?.length)
    const nEl = model?.rows?.length && nodes.size
      ? sections.reduce((n, s) => Math.max(n, attachGeometry(s.perfil, model)?.geom?.chains?.length || 0), 0)
      : 0
    return {
      acciones: api.length
        ? { tono: 'ok', txt: `${api.length} trabe(s) desde la API de RAM — ya no hace falta este reporte: ${api.map((s) => s.nombre).join(', ')}` }
        : acc.length
          ? { tono: 'ok', txt: `${acc.length} trabe(s): ${acc.map((s) => s.nombre).join(', ')}` }
          : { tono: 'pend', txt: 'sin cargar' },
      estaciones: est.length
        ? { tono: 'warn', txt: `${est.length} trabe(s) con la rejilla fija: ${est.map((s) => s.nombre).join(', ')} — mejor el de puntos de inflexión` }
        : { tono: 'pend', txt: api.length ? 'no hace falta: el modelo entra por la API' : 'sin cargar (opcional si ya tienes el de arriba)' },
      maximos: envT.length || envC.length
        ? { tono: 'ok', txt: `${envT.length} trabe(s) y ${envC.length} columna(s)`
            + (api.length ? ' — los de la API vienen con el pico exacto' : '') }
        : { tono: 'pend', txt: 'sin cargar' },
      geometria: model?.rows?.length
        ? { tono: 'ok', txt: `${model.archivo || 'cargada'} · ${model.rows.length} miembros · ${nodes.size} nudos${nEl ? ` · ${nEl} elementos` : ''}` }
        : { tono: 'pend', txt: 'sin cargar (opcional, pero da longitudes y el visor del modelo)' },
    }
  }, [sections, columns, model, nodes])

  // ── Carga: el contenido decide qué es cada archivo ──
  // `files` = [{ file, carpeta }]. La carpeta (COLUMNAS / LONGITUDINAL /
  // MAXIMOS) no decide el tipo de reporte — eso lo dice el contenido — pero
  // sirve de desempate cuando una trabe y una columna se llaman igual.
  async function cargar(files, prefijo = '') {
    if (!files.length) return
    const archivos = []
    const noLeidos = []
    for (const { file: f, carpeta } of files) {
      if (!/\.(json|txt|csv|xlsx)$/i.test(f.name)) continue     // en una carpeta puede haber de todo
      try { archivos.push({ nombre: f.name, carpeta, texto: /\.xlsx$/i.test(f.name) ? '' : await f.text(), file: f }) } catch { noLeidos.push(f.name) }
    }
    if (!archivos.length) {
      // en OneDrive/Drive, un archivo «sólo en la nube» no se puede leer hasta bajarlo
      setMsg(noLeidos.length
        ? `No se pudo leer ${noLeidos.join(', ')} — si están en OneDrive, ábrelos una vez o márcalos «Conservar siempre en este dispositivo»`
        : 'La carpeta no trae .json, .txt ni .xlsx')
      return
    }
    const notas = prefijo ? [prefijo] : []

    // 0) el modelo.json del script manda: lo trae todo y con el pico exacto
    const modelo = archivos.find((a) => /\.json$/i.test(a.nombre) && looksLikeModeloRam(a.texto))
    if (modelo) {
      const r = aplicarModelo(modelo.texto, modelo.nombre)
      notas.push(r.nota)
      if (r.discrepan?.length) {
        notas.push('⚠ MEDIDAS DISTINTAS a las analizadas: '
          + r.discrepan.map((d) => `${d.nombre} es ${d.b}×${d.h} y en RAM es ${d.ancho}×${d.peralte}`).join(' · '))
      }
      setDiscrepan(r.discrepan || [])
      for (const w of r.R?.warnings || []) notas.push(w)
      const resto = archivos.filter((a) => a !== modelo && !/\.json$/i.test(a.nombre))
      if (resto.length) notas.push(`${resto.length} archivo(s) de texto ignorados: el modelo.json ya los cubre`)
      const texto0 = notas.join(' · ')
      setMsg(texto0)
      onToast?.(texto0, r.R?.ok && !r.discrepan?.length ? 'ok' : 'warn')
      return
    }

    const clas = clasificarLote(archivos.filter((a) => !/\.json$/i.test(a.nombre)))

    // 1) geometría (es del proyecto, no de una trabe)
    const geos = archivos.filter((a) => clas.geometria.includes(a.nombre))
    if (geos.length) {
      let rows = model?.rows || null, nds = nodes.size ? nodes : null
      for (const a of geos) {
        try {
          if (/\.xlsx$/i.test(a.nombre)) { nds = await parseNodeXlsx(await a.file.arrayBuffer()); continue }
          const g = parseGeometryReport(a.texto)
          if (g.rows.length) rows = g.rows
          if (g.nodes.size) nds = g.nodes
        } catch (e) { notas.push(`${a.nombre}: ${e.message}`) }
      }
      if (rows?.length && nds?.size) {
        setModel({ archivo: geos.map((a) => a.nombre).join(' + '), rows, nodes: Object.fromEntries(nds) })
        notas.push(`geometría: ${rows.length} miembros · ${nds.size} nudos`)
      } else notas.push(`geometría incompleta: falta ${rows?.length ? 'el archivo de nudos' : 'el de miembros'}`)
    }

    // 2) esfuerzos: se reparten por el nombre del archivo
    const esf = archivos.filter((a) => !clas.geometria.includes(a.nombre) && !clas.desconocidos.includes(a.nombre))
    if (esf.length) {
      const r = repartirEnvolventes(esf, { trabes: sections, columnas: columns })
      for (const a of r.asignados) {
        if (a.tipo === 'trabe') {
          if (a.env) setEnvelopeAt(a.idx, a.env)
          if (a.perfil) setPerfilAt(a.idx, a.perfil)
        } else if (a.env) setColEnvelopeAt(a.idx, a.env)
      }
      notas.push(resumenReparto(r))
    }
    if (noLeidos.length) notas.push(`no se pudieron abrir (¿sólo en la nube?): ${noLeidos.join(', ')}`)
    if (clas.desconocidos.length) notas.push(`no se reconocieron: ${clas.desconocidos.join(', ')}`)
    const texto = notas.join(' · ')
    setMsg(texto)
    onToast?.(texto, clas.desconocidos.length ? 'warn' : 'ok')
  }

  // ── El modelo.json del script de RAM ─────────────────────
  // Un solo archivo con geometría, esfuerzos y reacciones, y con el pico de
  // cada miembro ya afinado. Los grupos vienen etiquetados por el propio
  // modelo (T5, C1…), así que caen solos en su chip.
  function aplicarModelo(texto, nombre) {
    const R = parseModeloRam(texto, nombre)
    if (!R.ok) return { nota: R.warnings[0], R }
    setModel(R.model)
    setReacciones(R.reacciones)
    const { asignados, sinChip } = repartirModelo(R, { trabes: sections, columnas: columns })
    // Si el chip tiene otras medidas que la sección analizada en RAM, las
    // demandas que entran son de otra sección. Callarlo sería lo peor.
    const discrepan = []
    for (const a of asignados) {
      const su = seccionSugerida(a.grupo)
      if (!su.ancho) continue
      const chip = a.tipo === 'trabe' ? sections[a.idx] : columns[a.idx]
      const b = +(a.tipo === 'trabe' ? chip.ancho : chip.b) || 0
      const h = +(a.tipo === 'trabe' ? chip.peralte : chip.h) || 0
      if (b !== su.ancho || h !== su.peralte) {
        discrepan.push({ tipo: a.tipo, idx: a.idx, nombre: chip.nombre, b, h, ancho: su.ancho, peralte: su.peralte, seccion: su.seccion, contradice: su.contradice })
      }
    }
    for (const a of asignados) {
      if (a.tipo === 'trabe') {
        setPerfilAt(a.idx, a.grupo.perfil)
        setEnvelopeAt(a.idx, { archivo: nombre, combo: a.grupo.perfil.combo, unidades: R.modelo.unidades, invertir: false, points: a.grupo.points })
      } else {
        setColEnvelopeAt(a.idx, { archivo: nombre, combo: a.grupo.perfil.combo, unidades: R.modelo.unidades, mapping: 'M33X', points: a.grupo.points })
      }
    }
    // Los miembros sin descripción no son una sección: son lo que falta agrupar
    setFaltan(sinChip.filter((g) => g.nombre !== SIN_NOMBRE))
    setSinDescripcion(sinChip.filter((g) => g.nombre === SIN_NOMBRE).reduce((n, g) => n + g.n, 0))
    guardarModelo(texto, nombre)          // en IndexedDB: no cabe en el autoguardado
    const enChip = asignados.map((a) => a.grupo.nombre).join(', ')
    return {
      R,
      discrepan,
      nota: `${resumenModeloRam(R)} · aplicado a ${asignados.length} chip(s)${enChip ? `: ${enChip}` : ''}`
        + (sinChip.length ? ` · ${sinChip.length} grupo(s) sin sección en el proyecto` : ''),
    }
  }

  // ── El script de RAM, con la carpeta de ESTE proyecto dentro ──
  // El navegador nunca revela la ruta absoluta de la carpeta que eliges (es
  // una decisión de seguridad), y el Python de RAM no puede abrir un diálogo
  // porque va en caja de arena. Así que la ruta se pega aquí una vez por
  // proyecto: aquí es natural pegarla, y aquí la escribimos nosotros en el
  // .py sin que se pueda romper.
  // Con la carpeta: se elige una vez (aquí mismo), se le hace su árbol y el
  // script queda dentro. Sin la API de carpetas, se descarga como siempre.
  async function generarScript() {
    const r = generarScriptRam(ruta, { proyecto: projectName })
    if (!r.ok) { setAvisoRuta(r.aviso); return }
    setAvisoRuta('')
    let h = carpeta
    try {
      if (!h && puedeRecordar()) h = (await elegirCarpeta(r.ruta)).handle
      else if (h) await guardarCarpeta(h, r.ruta)       // la misma carpeta, ahora con la ruta del proyecto
    } catch (e) {
      if (e?.name !== 'AbortError') setMsg(`No se pudo usar la carpeta: ${e.message}`)
      h = null
    }
    if (h) setCarpeta(h)
    setRutaRam(r.ruta)
    if (h && (await permisoDe(h, true, 'readwrite')) === 'granted') {
      try {
        await asegurarArbol(h)
        await escribir(h, [], r.nombre, r.texto)
        setCarpetaActiva(h, r.ruta)
        setEscribible(true)
        setMsg(`${r.nombre} guardado en ${rutaLegible(h, [], r.nombre)}, con su árbol (1 Agrupación, 2 Salidas, 3 Respaldos). En RAM: Abrir Script… → Ctrl+R.`)
        return
      } catch (e) { setMsg(`No se pudo escribir en la carpeta (${e.message}); se descarga.`) }
    }
    descargar(r)
    setMsg(`${r.nombre} descargado. Déjalo en «${nombreCarpeta(r.ruta)}» y ábrelo en la consola de Python de RAM.`)
  }

  function descargar(r) {
    const url = URL.createObjectURL(new Blob([r.texto], { type: 'text/x-python;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = r.nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /** El catálogo de la casa al grupo Personales de RAM: una vez por computadora */
  function bajarInstalador() {
    const r = generarInstaladorCatalogo()
    if (!r.ok) { setMsg(r.aviso); return }
    descargar(r)
    setMsg(`${r.nombre} descargado. En RAM: Python Console → Abrir Script… → Ctrl+R (pegado en el editor se descompone la sangría).`)
  }

  /** Adopta en los chips las medidas de la sección que RAM analizó */
  function usarMedidasDeRam() {
    for (const d of discrepan) {
      if (d.tipo === 'trabe') patchSectionAt(d.idx, { ancho: d.ancho, peralte: d.peralte })
      else patchColumnAt(d.idx, { b: d.ancho, h: d.peralte })
    }
    const texto = `Medidas puestas como en RAM: ${discrepan.map((d) => `${d.nombre} ${d.ancho}×${d.peralte}`).join(', ')}`
    setDiscrepan([])
    setMsg(texto)
    onToast?.(texto, 'ok')
  }

  /**
   * Crea de golpe las secciones que el modelo trae y el proyecto no — y no
   * desnudas: cada una sale con un armado propuesto que cubre su envolvente,
   * verificado con los mismos motores que luego la revisan.
   */
  async function crearFaltantes() {
    const hechos = []
    const props = []
    const lista = faltan
    setFaltan([])
    for (const g of lista) {
      const s = seccionSugerida(g)
      setOcupado(`Proponiendo el armado de ${s.nombre}…`)
      await new Promise((r) => setTimeout(r, 0))     // que se pinte el avance entre grupos
      let p = null
      if (s.esColumna) {
        const idx = addColumn({ nombre: s.nombre, ...(s.ancho ? { b: s.ancho, h: s.peralte } : {}) })
        setColEnvelopeAt(idx, { archivo: g.perfil.archivo, combo: g.perfil.combo, mapping: 'M33X', points: g.points })
        // la altura (para la zona de estribos de los extremos): el tramo más largo del grupo
        const H = Math.max(0, ...g.perfil.members.map((m) => +m.Lreport || 0)) || null
        try { p = proponerColumna(useColumnStore.getState().columns[idx], { H }) } catch (e) { console.error(e) }
        if (p && Object.keys(p.patch).length) patchColumnAt(idx, p.patch)
      } else {
        const idx = addSection({ nombre: s.nombre, ...(s.ancho ? { ancho: s.ancho, peralte: s.peralte } : {}) })
        setPerfilAt(idx, g.perfil)
        setEnvelopeAt(idx, { archivo: g.perfil.archivo, combo: g.perfil.combo, invertir: false, points: g.points })
        const B = useBeamStore.getState()
        try { p = proponerTrabe(B.sections[idx], B.model) } catch (e) { console.error(e) }
        if (p && Object.keys(p.patch).length) patchSectionAt(idx, p.patch)
      }
      const bh = s.ancho ? `${s.ancho}×${s.peralte}` : ''
      hechos.push(`${s.nombre}${bh ? ` (${bh})` : ''}`)
      props.push({
        nombre: s.nombre, tipo: s.esColumna ? 'columna' : 'trabe', bh, n: g.n,
        estado: p?.estado || 'sin', texto: p?.texto || 'sin envolvente: no hay con qué proponer',
        motivos: p?.motivos || [], avisos: p?.avisos || [], kg: p?.kg || 0,
      })
    }
    setOcupado('')
    setPropuestas(props)
    const nOk = props.filter((x) => x.estado === 'ok').length
    const texto = `Creadas ${hechos.length} sección(es) desde el modelo con su armado propuesto: `
      + `${nOk} pasan${nOk < props.length ? `, ${props.length - nOk} a revisar` : ''} · ${hechos.join(', ')}`
    setMsg(texto)
    onToast?.(texto, nOk === props.length ? 'ok' : 'warn')
  }

  // ── Sincronizar: releer la carpeta recordada, de un clic ─────
  async function sincronizar() {
    setOcupado('Leyendo la carpeta…')
    try {
      let h = carpeta
      if (!h) { h = (await elegirCarpeta(rutaRam || '')).handle; setCarpeta(h) }
      // con permiso de edición la app también guarda ahí; si no, basta con leer
      let permiso = await permisoDe(h, true, 'readwrite')
      const puedeEscribirAqui = permiso === 'granted'
      if (!puedeEscribirAqui) permiso = await permisoDe(h, true, 'read')
      if (permiso !== 'granted') {
        setOcupado('')
        setMsg('El navegador no dio permiso para leer la carpeta. Vuelve a elegirla.')
        return
      }
      setEscribible(puedeEscribirAqui)
      if (puedeEscribirAqui) {
        setCarpetaActiva(h, rutaRam || '')
        try { await asegurarArbol(h) } catch { /* el árbol no es indispensable para leer */ }
      }
      const archivos = await recorrerCarpeta(h)
      if (!archivos.length) {
        setOcupado(''); setMsg(`No hay archivos legibles en «${h.name}».`); return
      }
      const previo = await modeloGuardado()
      const c = cambios(archivos)
      await cargar(archivos, resumenSync(c, archivos.length))
      guardarSync(h.name, archivos)
      setSync(ultimaSync())
      // el modelo que se acaba de reemplazar, a 3 Respaldos
      const nuevo = archivos.find((a) => !a.carpeta && a.nombre.toLowerCase() === 'modelo.json')
      if (puedeEscribirAqui && previo?.datos && nuevo) {
        try { if ((await nuevo.file.text()) !== previo.datos) await respaldarModelo(previo.datos, previo.at) } catch { /* nunca estorba */ }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setMsg(`No se pudo sincronizar: ${e.message}`)
    } finally { setOcupado('') }
  }

  const abrir = (id) => { setFiltro(id); inputRef.current?.click() }
  const abrirCarpeta = () => { setFiltro(null); dirRef.current?.click() }
  // webkitRelativePath = "MAXIMOS/T-5.txt": la carpeta que contiene al archivo
  const carpetaDe = (f) => {
    const p = (f.webkitRelativePath || '').split('/')
    return p.length > 1 ? p[p.length - 2] : ''
  }
  const onInput = (e) => {
    const fs = [...(e.target.files || [])].map((f) => ({ file: f, carpeta: carpetaDe(f) }))
    e.target.value = ''
    cargar(fs)
  }

  // Soltar una carpeta: hay que recorrer el árbol a mano (las entradas del
  // dataTransfer se invalidan en cuanto se hace await, así que se toman todas
  // de golpe antes de empezar).
  async function deSoltar(dt) {
    const entries = [...(dt.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean)
    const sueltos = [...(dt.files || [])]
    if (!entries.some((e) => e.isDirectory)) return sueltos.map((f) => ({ file: f, carpeta: '' }))
    const out = []
    const leer = async (entry, carpeta) => {
      if (entry.isFile) {
        const f = await new Promise((res, rej) => entry.file(res, rej)).catch(() => null)
        if (f) out.push({ file: f, carpeta })
      } else if (entry.isDirectory) {
        const rd = entry.createReader()
        for (;;) {
          const lote = await new Promise((res) => rd.readEntries(res, () => res([])))
          if (!lote.length) break
          for (const e of lote) await leer(e, entry.name)
        }
      }
    }
    for (const e of entries) await leer(e, e.isDirectory ? e.name : '')
    return out
  }

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(16,18,28,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6vh' }}
    >
      <div
        onDragOver={(e) => { e.preventDefault(); if (!drop) setDrop(true) }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDrop(false) }}
        onDrop={async (e) => { e.preventDefault(); setDrop(false); cargar(await deSoltar(e.dataTransfer)) }}
        style={{
          width: 'min(900px, calc(100vw - 32px))', maxHeight: '84vh', display: 'flex', flexDirection: 'column',
          background: 'var(--color-panel)', border: `1px solid ${drop ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 12, boxShadow: '0 18px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Cargar el modelo de RAM</span>
          <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>
            {pestana === 'ram'
              ? 'Corre sincronizar.py en la consola de Python de RAM y dale a Sincronizar: entra el modelo entero.'
              : 'Nombra cada archivo como su chip (T-5.txt, C-1.txt): el contenido decide qué es cada uno.'}
          </span>
          <button onClick={onClose} data-testid="cerrar-centro" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--color-tx3)' }}>×</button>
        </div>

        <div style={{ padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* ── Las dos maneras de meter el modelo ── */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)' }}>
            {[
              ['ram', '⚡ Desde RAM', 'El script y la carpeta: entra todo de un clic'],
              ['manual', '📄 Método manual', 'Los cuatro reportes de texto, uno por uno'],
            ].map(([id, texto, ayuda]) => (
              <button key={id} data-testid={`tab-${id}`} title={ayuda} onClick={() => setPestana(id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', fontSize: 12,
                  fontWeight: pestana === id ? 800 : 500,
                  color: pestana === id ? 'var(--color-tx)' : 'var(--color-tx3)',
                  borderBottom: `2px solid ${pestana === id ? 'var(--color-accent)' : 'transparent'}`,
                  marginBottom: -1,
                }}>
                {texto}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>
              {sections.length} trabe(s) · {columns.length} columna(s)
            </span>
          </div>

          {pestana === 'ram' ? (
          <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', borderRadius: 9, background: 'var(--color-bg)', border: '1px dashed var(--color-border)' }}>
            {puedeRecordar()
              ? (
                <button className="btn btn-primary" style={{ fontSize: 12 }} data-testid="sincronizar" onClick={sincronizar} disabled={!!ocupado}>
                  {ocupado || (carpeta ? '🔄 Sincronizar con RAM' : '🔄 Elegir la carpeta y sincronizar…')}
                </button>
              )
              : (
                <span style={{ fontSize: 11, color: '#92400e' }}>
                  Este navegador no sabe recordar una carpeta. Abre la app en Chrome o Edge, o usa el <b>método manual</b>.
                </span>
              )}
            <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>
              {carpeta
                ? <>Carpeta recordada: <b>{carpeta.name}</b>{sync?.at ? ` · sincronizada ${hace(sync.at)}` : ''}. Corre el script en RAM y dale a sincronizar.
                    <span data-testid="carpeta-escribible" style={{ color: escribible ? '#15803d' : 'var(--color-tx3)' }}>
                      {escribible ? ' ✓ La app guarda aquí el proyecto, las salidas y los respaldos.' : ' (La app sólo la lee: al sincronizar, acepta el permiso de edición para que guarde aquí.)'}
                    </span></>
                : <>Corre <b>sincronizar.py</b> en la consola de Python de RAM y elige aquí la carpeta: se recuerda, y a partir de entonces es un clic.</>}
            </span>
            {carpeta && (
              <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: 'var(--color-tx3)', textDecoration: 'underline' }}
                data-testid="olvidar-carpeta" onClick={() => { olvidarCarpeta(rutaRam || ''); setCarpeta(null); setSync(null); setCarpetaActiva(null) }}>
                olvidar
              </button>
            )}
          </div>

          {/* ── Configurar RAM: la carpeta de este proyecto ── */}
          <details data-testid="config-ram" open={configAbierta}
            onToggle={(e) => setConfigAbierta(e.currentTarget.open)}
            style={{ border: '1px solid var(--color-border)', borderRadius: 9, background: 'var(--color-bg)', padding: '8px 12px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              ⚙ Configurar RAM para este proyecto
              {rutaRam
                ? <span style={{ fontWeight: 400, color: '#15803d', marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>✓ {nombreCarpeta(rutaRam)}</span>
                : <span style={{ fontWeight: 400, color: '#92400e', marginLeft: 8, fontSize: 10.5 }}>sin configurar</span>}
            </summary>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-tx2)', lineHeight: 1.6 }}>
              Pega aquí la ruta de la carpeta <b>Auxiliar IV</b> de la obra (<code>PROCESO\Auxiliar IV</code>) y dale a
              Generar: eliges esa misma carpeta una vez, la app le hace su árbol (1 Agrupación, 2 Salidas, 3 Respaldos) y deja
              ahí el <b>sincronizar.py</b> con la ruta ya dentro. Se guarda con el proyecto, así que al cambiar de obra cambia sola.
              <div style={{ fontSize: 10, color: 'var(--color-tx3)', marginTop: 4, lineHeight: 1.65 }}>
                <b>Es la misma carpeta que eliges arriba, pero no es el mismo gesto</b>, y por eso hay que
                hacer los dos: el botón de arriba le da al <b>navegador</b> permiso para <b>leer</b> ahí
                (se recuerda, pero el navegador nunca te dice la ruta real de lo que elegiste); esta ruta
                es el texto que va <b>dentro</b> del .py para que <b>RAM</b> sepa dónde <b>escribir</b> el
                modelo.json — y el Python de RAM no puede abrir un explorador para preguntártelo.
                <div style={{ marginTop: 2 }}>Para copiarla: en el explorador, clic derecho sobre la carpeta con Mayús → <b>Copiar como ruta</b>.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <input data-testid="ruta-ram" value={ruta} onChange={(e) => { setRuta(e.target.value); setAvisoRuta('') }}
                  placeholder="C:\\Users\\...\\PROCESO\\Auxiliar IV"
                  style={{
                    flex: '1 1 340px', fontSize: 11, fontFamily: 'var(--font-mono)', padding: '5px 8px',
                    borderRadius: 5, border: `1px solid ${avisoRuta ? '#ef9a9a' : 'var(--color-border)'}`,
                    background: 'var(--color-panel)', color: 'var(--color-tx)',
                  }} />
                <button className="btn btn-primary" style={{ fontSize: 10.5 }} data-testid="generar-script"
                  disabled={!esRutaWindows(ruta)} onClick={() => generarScript()}>
                  {carpeta || puedeRecordar() ? '⬇ Generar sincronizar.py en la carpeta' : '⬇ Generar sincronizar.py'}
                </button>
              </div>
              {avisoRuta && <div data-testid="aviso-ruta" style={{ color: '#c62828', fontSize: 10.5, marginTop: 5 }}>{avisoRuta}</div>}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" style={{ fontSize: 10.5 }} data-testid="bajar-catalogo" onClick={bajarInstalador}>
                  ⬇ instalar_catalogo.py
                </button>
                <span style={{ fontSize: 10.5, color: 'var(--color-tx3)', lineHeight: 1.5, flex: '1 1 300px' }}>
                  Da de alta en el grupo <b>Personales</b> de RAM las {SECCIONES_RAM.length} secciones y los {MATERIALES_RAM.length} concretos
                  del catálogo. Una vez por computadora, no por proyecto: conserva lo que ya tengas y guarda un respaldo.
                </span>
              </div>
              {esRutaWindows(ruta) && carpeta && nombreCarpeta(ruta) !== carpeta.name && (
                <div style={{ color: '#92400e', fontSize: 10.5, marginTop: 5 }}>
                  ⚠ La carpeta que elegiste arriba se llama <b>{carpeta.name}</b> y esta ruta acaba en
                  <b> {nombreCarpeta(ruta)}</b>. Si no son la misma, el script dejará el modelo.json
                  donde la app no lo va a buscar.
                </div>
              )}
            </div>
          </details>
          </>
          ) : (
          <>
          {/* ── El método de antes: un .txt por chip, a mano ── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', borderRadius: 9, background: 'var(--color-bg)', border: '1px dashed var(--color-border)' }}>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} data-testid="cargar-carpeta" onClick={abrirCarpeta}>🗂 Elegir una carpeta…</button>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} data-testid="cargar-todo" onClick={() => abrir(null)}>📂 Archivos sueltos…</button>
            <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>
              Una lectura y ya: esta carpeta <b>no</b> se recuerda. También puedes soltar los archivos aquí encima.
            </span>
          </div>

          {REPORTES.map((r) => (
            <Slot key={r.id} r={r} estado={estados[r.id]} onCargar={() => abrir(r.id)} />
          ))}

          <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', lineHeight: 1.6 }}>
            <b>Cómo conviene guardarlos:</b> una carpeta por proyecto con una subcarpeta por tipo de reporte
            (<span style={{ fontFamily: 'var(--font-mono)' }}>COLUMNAS · LONGITUDINAL · MAXIMOS</span>) y, dentro, un .txt por chip
            (<span style={{ fontFamily: 'var(--font-mono)' }}>T-5.txt</span>, <span style={{ fontFamily: 'var(--font-mono)' }}>C-1.txt</span>).
            Eliges la carpeta de arriba y entra todo: cada trabe recibe su reporte a lo largo <b>y</b> su máximo exacto, que es lo que hace falta
            para que el momento de diseño no se quede corto. La geometría puede ir suelta en la carpeta raíz.
            Un mismo .txt puede traer varios reportes juntos: la app los separa y se queda con el mejor de cada cosa.
          </div>
          </>
          )}

          {/* Los avisos salen de sincronizar, pero se quedan a la vista en las dos pestañas */}
          {discrepan.length > 0 && (
            <div data-testid="aviso-medidas" style={{ padding: '9px 12px', borderRadius: 9, background: '#fdecea', border: '1px solid #ef9a9a', fontSize: 11.5, color: '#7f1d1d', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>
                <b>Las demandas que acaban de entrar son de otra sección.</b>{' '}
                {discrepan.map((d) => `${d.nombre}: el proyecto dice ${d.b}×${d.h} y RAM analizó ${d.ancho}×${d.peralte} (${d.seccion})`).join(' · ')}.
                {discrepan.filter((d) => d.contradice).map((d) => (
                  <div key={d.nombre} data-testid="aviso-invertida" style={{ marginTop: 4 }}>
                    ⚠ Ojo con {d.nombre}: la sección de RAM se llama {d.contradice.dice} pero está dada de alta como {d.ancho}×{d.peralte}
                    {d.contradice.invertida ? ' — invertida' : ''}. Si la intención era {d.contradice.dice}, el error está en RAM:
                    corrígela allá, vuelve a analizar y sincroniza; «usar las medidas de RAM» sólo copiaría el error.
                  </div>
                ))}
              </span>
              <button className="btn btn-primary" style={{ fontSize: 10.5, marginLeft: 'auto' }} data-testid="usar-medidas-ram" onClick={usarMedidasDeRam}>
                usar las medidas de RAM
              </button>
              <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: '#7f1d1d', textDecoration: 'underline' }}
                onClick={() => setDiscrepan([])}>dejarlo como está</button>
            </div>
          )}

          {faltan.length > 0 && (
            <div data-testid="faltan-secciones" style={{ padding: '9px 12px', borderRadius: 9, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 11.5, color: '#1e3a8a', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>
                El modelo trae <b>{faltan.length} grupo(s)</b> que el proyecto todavía no tiene:{' '}
                {faltan.map((g) => {
                  const su = seccionSugerida(g)
                  return `${su.nombre}${su.ancho ? ` (${su.ancho}×${su.peralte})` : ''} · ${g.n} miembros`
                }).join(' — ')}.
                RAM ya dice cómo se llaman y de qué tamaño son.
              </span>
              <button className="btn btn-primary" style={{ fontSize: 10.5, marginLeft: 'auto' }} data-testid="crear-faltantes" onClick={crearFaltantes} disabled={!!ocupado}>
                crear {faltan.length === 1 ? 'la sección' : `las ${faltan.length} secciones`} con su armado
              </button>
              <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: '#1e3a8a', textDecoration: 'underline' }}
                onClick={() => setFaltan([])}>ahora no</button>
            </div>
          )}

          {sinDescripcion > 0 && (
            <div data-testid="sin-descripcion" style={{ padding: '9px 12px', borderRadius: 9, background: '#fffbeb', border: '1px solid #fcd34d', fontSize: 11.5, color: '#92400e' }}>
              <b>{sinDescripcion} miembro(s) llegan sin descripción</b> — todavía no están agrupados, así que no se crea
              una sección con ellos. Agrúpalos en <b>Módulos → Agrupación</b>: te propone las T con su sección, las aplicas en
              RAM, reanalizas y al volver a sincronizar ya entran como secciones.
            </div>
          )}

          {propuestas.length > 0 && (
            <div data-testid="propuestas" style={{ padding: '9px 12px', borderRadius: 9, background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <b style={{ fontSize: 12 }}>Armado propuesto</b>
                <span style={{ color: 'var(--color-tx3)', fontSize: 10.5 }}>
                  verificado con los mismos motores que Longitudinal y Columnas · queda marcado como propuesta hasta que lo toques
                </span>
                <button style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: 'var(--color-tx3)', textDecoration: 'underline' }}
                  onClick={() => setPropuestas([])}>cerrar</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', columnGap: 10, rowGap: 3, alignItems: 'baseline' }}>
                {propuestas.map((p) => {
                  const col = p.estado === 'ok' ? '#15803d' : p.estado === 'revisar' ? '#c62828' : 'var(--color-tx3)'
                  return [
                    <span key={`${p.nombre}-e`} data-testid={`propuesta-${p.nombre}`} data-estado={p.estado} style={{ color: col, fontWeight: 800 }}>
                      {p.estado === 'ok' ? '✓' : p.estado === 'revisar' ? '✗' : '—'}
                    </span>,
                    <b key={`${p.nombre}-n`}>{p.nombre}</b>,
                    <span key={`${p.nombre}-b`} style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>{p.bh}</span>,
                    <span key={`${p.nombre}-t`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                      {p.texto}{p.kg ? <span style={{ color: 'var(--color-tx3)' }}> · {p.kg.toFixed(0)} kg</span> : null}
                      {p.motivos.map((m) => <div key={m} style={{ color: '#c62828', fontFamily: 'inherit' }}>✗ {m}</div>)}
                      {p.avisos.map((m) => <div key={m} style={{ color: '#92400e', fontFamily: 'inherit' }}>⚠ {m}</div>)}
                    </span>,
                  ]
                })}
              </div>
            </div>
          )}

          {msg && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px' }} data-testid="centro-msg">{msg}</div>}
        </div>
      </div>

      <input ref={inputRef} data-testid="centro-files" type="file" multiple
        accept={filtro === 'geometria' ? '.txt,.csv,.xlsx,text/plain' : '.txt,.csv,text/plain'}
        style={{ display: 'none' }} onChange={onInput} />
      {/* webkitdirectory no es un atributo de React: se pone sobre el nodo */}
      <input data-testid="centro-dir" type="file" multiple style={{ display: 'none' }} onChange={onInput}
        ref={(el) => { dirRef.current = el; if (el) { el.webkitdirectory = true; el.directory = true } }} />
    </div>
  )
}

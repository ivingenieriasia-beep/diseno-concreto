import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import TopBar from './components/TopBar'
import BeamForm from './components/BeamForm'
import BeamCanvas from './components/BeamCanvas'
import MomentScale from './components/MomentScale'
import CalculatorView from './components/CalculatorView'
import BDGlobalView from './components/BDGlobalView'
import ColumnsView from './components/ColumnsView'
import LongitudinalView from './components/LongitudinalView'
import AgrupacionView from './components/AgrupacionView'
import DeflexionesView from './components/DeflexionesView'
import CimentacionesView from './components/CimentacionesView'
import LoadsView from './components/LoadsView'
import ModuleLauncher from './components/ModuleLauncher'
import LoadCenter from './components/LoadCenter'
import ModuleIcon from './components/ModuleIcon'
import MemoriaDialog from './components/MemoriaDialog'
import useBeamStore from './store/useBeamStore'
import useColumnStore from './store/useColumnStore'
import useLoadsStore from './store/useLoadsStore'
import useCimStore from './store/useCimStore'
import { getModulo, abrirVentana, cargarAbiertos, guardarAbiertos, conFijos } from './core/modules'
import { svgToDxf } from './core/svgToDxf'
import { columnsGridSvg } from './core/columnsSvg'
import { generateReport } from './core/generateReport'
import { generateDetailedReport } from './core/generateDetailedHTML'
import { initGlobalDB, getDB, getStats, onDBChange } from './core/globalDB'
import { packProject, saveSnapshot, loadSnapshot, clearSnapshot, pushRecent, listRecents, timeAgo, debounce, isEmptyProject } from './core/autosave'
import { buildDcheck } from './core/dcheckExport'
import { analyzeGroup, perfilCompleto } from './core/longitudinal'
import { carpetaGuardada } from './core/ramSync'
import { setCarpetaActiva, guardarSalida, guardarProyecto, dondeQuedo } from './core/carpeta'

// Guardar en localStorage con un pequeño retraso para no escribir en cada tecla
const autosave = debounce((p) => saveSnapshot(p), 600)

export default function App() {
  const svgRef = useRef(null)
  const fileInputRef = useRef(null)
  const sections = useBeamStore((s) => s.sections)
  const loadProject = useBeamStore((s) => s.loadProject)
  const model = useBeamStore((s) => s.model)
  const rutaRam = useBeamStore((s) => s.rutaRam)
  const setRutaRam = useBeamStore((s) => s.setRutaRam)
  const longFocus = useBeamStore((s) => s.longFocus)
  const calcAlert = useBeamStore((s) => s.calcAlert)
  const columns = useColumnStore((s) => s.columns)
  const loadColumns = useColumnStore((s) => s.loadColumns)
  const losasCarga = useLoadsStore((s) => s.losas)
  const murosCarga = useLoadsStore((s) => s.muros)
  const tablerosCarga = useLoadsStore((s) => s.tableros)
  const unidadCarga = useLoadsStore((s) => s.unidad)
  const loadCargas = useLoadsStore((s) => s.loadCargas)
  const packCargas = useLoadsStore((s) => s.packCargas)
  const cimientos = useCimStore((s) => s.cimientos)
  const sueloObra = useCimStore((s) => s.suelo)
  const criteriosObra = useCimStore((s) => s.criterios)
  const linderosObra = useCimStore((s) => s.linderos)
  const cargarCim = useCimStore((s) => s.cargar)
  const empacarCim = useCimStore((s) => s.empacar)
  const [dxfScale, setDxfScale] = useState(1)
  const [projectName, setProjectName] = useState('')
  const [mainTab, setMainTab] = useState('detalle')
  const [dbCount, setDbCount] = useState(0)
  const [memoriaOpen, setMemoriaOpen] = useState(false)
  const [recents, setRecents] = useState(() => listRecents())
  const [toast, setToast] = useState(null)
  const [modulos, setModulos] = useState(() => cargarAbiertos())
  const [launcher, setLauncher] = useState(false)
  const [centro, setCentro] = useState(false)
  const restored = useRef(false)

  const showToast = useCallback((msg, tone = 'ok') => {
    setToast({ msg, tone })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Init Global DB on mount
  useEffect(() => {
    initGlobalDB()
    setDbCount(getStats().total)
    return onDBChange(() => setDbCount(getStats().total))
  }, [])

  // ── Carga completa de un proyecto (archivo, reciente o autosave) ──
  const applyProject = useCallback((data) => {
    loadProject(Array.isArray(data.sections) ? data.sections : [], data.model || null)
    loadColumns(Array.isArray(data.columns) ? data.columns : [])
    loadCargas(data.cargas || {})
    cargarCim(data.cimentacion || {})
    setProjectName(data.projectName !== undefined ? data.projectName : '')
    if (data.dxfScale !== undefined) setDxfScale(data.dxfScale)
    setRutaRam(data.rutaRam || '')
  }, [loadProject, loadColumns, loadCargas, cargarCim, setRutaRam])

  // Recuperar la sesión anterior al arrancar
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const snap = loadSnapshot()
    if (!snap) return
    applyProject(snap)
    const nLosas = snap.cargas?.losas?.length || 0
    const nCim = snap.cimentacion?.cimientos?.length || 0
    showToast(`Sesión recuperada · ${snap.sections?.length || 0} trabe(s), ${snap.columns?.length || 0} columna(s)`
      + `${nLosas ? `, ${nLosas} losa(s)` : ''}${nCim ? `, ${nCim} cimiento(s)` : ''} · ${timeAgo(snap.savedAt)}`)
  }, [applyProject, showToast])

  // Autoguardado en cada cambio
  useEffect(() => {
    if (!restored.current) return
    autosave(packProject({ projectName, dxfScale, sections, columns, cargas: packCargas(), model, rutaRam, cimentacion: empacarCim() }))
  }, [projectName, dxfScale, sections, columns, model, rutaRam, losasCarga, murosCarga, tablerosCarga, unidadCarga, packCargas, cimientos, sueloObra, criteriosObra, linderosObra, empacarCim])

  // Las pestañas de módulos abiertas se recuerdan entre sesiones
  useEffect(() => { guardarAbiertos(modulos) }, [modulos])

  // ⌘K / Ctrl+K abre la paleta de módulos desde donde sea
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setLauncher((v) => !v) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Módulos ──
  const abrirModulo = useCallback((mod) => {
    if (!mod) return
    if (mod.tipo === 'ventana') { abrirVentana(mod); return }
    setModulos((ms) => conFijos(ms.includes(mod.id) ? ms : [...ms, mod.id]))
    setMainTab(mod.id)
  }, [])

  // «Bastonear» desde la envolvente abre Longitudinal en ese miembro
  useEffect(() => {
    if (longFocus?.ts) abrirModulo(getModulo('longitudinal'))
  }, [longFocus?.ts, abrirModulo])

  const cerrarModulo = useCallback((id) => {
    if (getModulo(id)?.fijo) return
    setModulos((ms) => ms.filter((x) => x !== id))
    setMainTab((t) => (t === id ? 'detalle' : t))
  }, [])

  // SVG de export: vigas (canvas en vivo) + columnas (grid generado),
  // apiladas en un solo documento a 14 px/cm. Con forDxf=true el ancho/alto
  // van en cm para que svgToDxf deduzca la escala física real.
  const getSvgString = useCallback((forDxf = false) => {
    const el = svgRef.current
    const hasBeams = sections.length > 0 && el
    const grid = columns.length > 0 ? columnsGridSvg(columns, 14) : { inner: '', W: 0, H: 0 }
    if (!hasBeams && !grid.inner) return null

    let beamsInner = ''
    let wB = 0, hB = 0
    if (hasBeams) {
      wB = parseFloat(el.getAttribute('width')) || 0
      hB = parseFloat(el.getAttribute('height')) || 0
      const str = new XMLSerializer().serializeToString(el)
      beamsInner = str.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    }

    // (los alzados longitudinales se exportan aparte, desde la pestaña Longitudinal)
    const W = Math.max(wB, grid.W)
    const H = hB + grid.H
    const wCm = (W / 14).toFixed(4)
    const hCm = (H / 14).toFixed(4)
    const size = forDxf ? `width="${wCm}cm" height="${hCm}cm"` : `width="${W}" height="${H}"`
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${size} ` +
      `data-real-width-cm="${wCm}" data-real-height-cm="${hCm}" style="font-family:'DM Mono',monospace">` +
      beamsInner +
      (grid.inner ? `<g transform="translate(0,${hB})">${grid.inner}</g>` : '') +
      `</svg>`
  }, [sections.length, columns])

  const fileName = projectName.trim()
    ? `secciones-${projectName.trim().replace(/\s+/g, '-')}`
    : 'secciones'

  // La carpeta de la obra (PROCESO\Auxiliar IV) se recuerda con la ruta del
  // proyecto: al abrir otra obra, se conecta la suya o ninguna.
  useEffect(() => {
    let vivo = true
    carpetaGuardada(rutaRam || '').then((h) => { if (vivo) setCarpetaActiva(rutaRam ? h : null, rutaRam || '') })
    return () => { vivo = false }
  }, [rutaRam])

  const handleExportSvg = useCallback(async () => {
    const str = getSvgString(false)
    if (!str) return
    const r = await guardarSalida(`${fileName}.svg`, str, { sub: 'planos', mime: 'image/svg+xml' })
    if (r.donde === 'carpeta') showToast(`SVG ${dondeQuedo(r)}`)
  }, [getSvgString, fileName, showToast])

  const handleExportDxf = useCallback(async () => {
    const str = getSvgString(true)
    if (!str) return
    const dxf = svgToDxf(str, { scaleFactor: dxfScale })
    const r = await guardarSalida(`${fileName}.dxf`, dxf, { sub: 'planos', mime: 'application/dxf' })
    if (r.donde === 'carpeta') showToast(`DXF ${dondeQuedo(r)}`)
  }, [getSvgString, dxfScale, fileName, showToast])

  const handleSave = useCallback(async () => {
    const data = packProject({ projectName, dxfScale, sections, columns, cargas: packCargas(), model, rutaRam, cimentacion: empacarCim() })
    const r = await guardarProyecto(data, `${fileName}.json`)
    if (r.cancelado) { showToast('No se guardó: la carpeta tiene otro proyecto', 'warn'); return }
    pushRecent(data)
    setRecents(listRecents())
    if (r.donde === 'carpeta') showToast(`Proyecto ${dondeQuedo(r)} · el anterior quedó en 3 Respaldos`)
  }, [projectName, dxfScale, sections, columns, model, rutaRam, packCargas, empacarCim, fileName, showToast])

  // Los informes tienen que ver lo mismo que el módulo Longitudinal: con la
  // geometría pegada el análisis va por elemento completo (y las zonas de
  // estribos se miden sobre el claro real, no sobre cada tramo suelto), y con
  // la envolvente pegada el diseño no queda por debajo de lo que RAM reporta.
  const seccionesConGeometria = useMemo(
    () => sections.map((s) => (s.perfil?.members?.length ? { ...s, perfil: perfilCompleto(s, model) } : s)),
    [sections, model],
  )

  const handleVerifyResumido = useCallback(() => {
    if (sections.length === 0 && columns.length === 0) return
    const doc = generateReport(seccionesConGeometria, projectName, columns)
    guardarSalida(`${fileName}-verificacion.pdf`, doc.output('blob'), { sub: 'memoria', mime: 'application/pdf' })
      .then((r) => { if (r.donde === 'carpeta') showToast(`Verificación ${dondeQuedo(r)}`) })
  }, [seccionesConGeometria, sections.length, columns, projectName, fileName, showToast])

  const handleVerifyDetallado = useCallback(() => {
    if (sections.length === 0 && columns.length === 0) return
    generateDetailedReport(seccionesConGeometria, projectName, columns)
  }, [seccionesConGeometria, sections.length, columns, projectName])

  // Double Check prellenado (nombres, resistencias y demandas); sólo faltan las capturas
  const handleExportDcheck = useCallback(() => {
    if (sections.length === 0 && columns.length === 0) return
    const data = buildDcheck({ projectName, sections, columns })
    const stamp = (projectName.trim() || 'proyecto').replace(/\s+/g, '_')
    guardarSalida(`DoubleCheck_${stamp}.dcheck`, JSON.stringify(data), { sub: 'dcheck', mime: 'application/json' }).then((r) => {
      showToast(`Double Check ${r.donde === 'carpeta' ? dondeQuedo(r) : 'exportado'} · ${data.sections.length} elemento(s) prellenados; falta añadir las capturas`)
    })
  }, [sections, columns, projectName, showToast])

  const handleOpen = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if ((data.sections && Array.isArray(data.sections)) || data.cargas || data.cimentacion) {
          applyProject(data)
          pushRecent({ ...data, savedAt: new Date().toISOString() })
          setRecents(listRecents())
          const nCim = data.cimentacion?.cimientos?.length || 0
          showToast(`Proyecto abierto · ${(data.sections || []).length} trabe(s), ${(data.columns || []).length} columna(s)${nCim ? `, ${nCim} cimiento(s)` : ''}`)
        } else {
          alert('El archivo no tiene secciones. Verifica que sea un proyecto de Auxiliar IV.')
        }
      } catch {
        alert('No se pudo leer el archivo. Verifica que sea un JSON válido.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [applyProject, showToast])

  const handleOpenRecent = useCallback((name) => {
    const r = listRecents().find((x) => x.name === name)
    if (!r?.project) return
    applyProject(r.project)
    showToast(`Proyecto reciente "${name}" abierto`)
  }, [applyProject, showToast])

  const handleNew = useCallback(() => {
    const current = packProject({ projectName, dxfScale, sections, columns, cargas: packCargas(), model, rutaRam, cimentacion: empacarCim() })
    if (!isEmptyProject(current) && !confirm('¿Empezar un proyecto nuevo? Lo que hay ahora queda en "Recientes" (y en tu último .json guardado).')) return
    if (!isEmptyProject(current)) { pushRecent(current); setRecents(listRecents()) }
    applyProject({ sections: [], columns: [], cargas: {}, cimentacion: {}, projectName: '', dxfScale: 1 })
    clearSnapshot()
    setMainTab('detalle')
  }, [projectName, dxfScale, sections, columns, model, rutaRam, packCargas, empacarCim, applyProject])

  // Una pestaña activa se dibuja como pestaña: contorno, barra de acento
  // arriba y el borde de abajo abierto hacia el contenido.
  const estiloTab = (activo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative', cursor: 'pointer',
    padding: '6px 14px 7px', borderRadius: '8px 8px 0 0', fontSize: 13, whiteSpace: 'nowrap',
    fontWeight: activo ? 700 : 500,
    background: activo ? 'var(--color-surface)' : 'transparent',
    color: activo ? 'var(--color-tx)' : 'var(--color-tx3)',
    border: `1px solid ${activo ? 'var(--color-border)' : 'transparent'}`,
    borderBottomColor: activo ? 'var(--color-surface)' : 'transparent',
    boxShadow: activo ? 'inset 0 2px 0 var(--color-accent)' : 'none',
    marginBottom: -1,
  })

  const tabBtn = (id, label, badge) => (
    <button role="tab" aria-selected={mainTab === id} onClick={() => setMainTab(id)} style={estiloTab(mainTab === id)}>
      {label}
      {badge}
    </button>
  )
  const pill = (n, tone) => (
    <span style={{
      marginLeft: 6, fontSize: 10, fontFamily: 'var(--font-mono)',
      background: tone === 'bad' ? '#c62828' : 'var(--color-border)',
      color: tone === 'bad' ? '#fff' : 'var(--color-tx2)',
      padding: '1px 6px', borderRadius: 99,
    }}>{n}</span>
  )

  // Trabes con perfil por estaciones cargado (pestaña Longitudinal)
  const longStats = useMemo(() => {
    let n = 0, bad = 0
    for (const t of sections) {
      if (!t.perfil?.members?.length) continue
      n++
      try { const g = analyzeGroup(t, perfilCompleto(t, model)); if (!g.allOk || !g.caps.okBase) bad++ } catch { bad++ }
    }
    return { n, bad }
  }, [sections, model])

  // Contadores que se ven en la pestaña del módulo y en la paleta
  const badges = useMemo(() => ({
    longitudinal: longStats.n || 0,
    bdglobal: dbCount || 0,
    pesos: losasCarga.length + tablerosCarga.length,
    cimentaciones: cimientos.length,
  }), [longStats.n, dbCount, losasCarga.length, tablerosCarga.length, cimientos.length])

  const vistaModulo = {
    longitudinal: <LongitudinalView dxfScale={dxfScale} projectName={projectName} onAbrirCentro={() => setCentro(true)} />,
    bdglobal: <BDGlobalView />,
    agrupacion: <AgrupacionView onToast={showToast} />,
    deflexiones: <DeflexionesView />,
    pesos: <LoadsView onToast={showToast} />,
    cimentaciones: <CimentacionesView onToast={showToast} dxfScale={dxfScale} projectName={projectName} />,
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)' }}>
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
      {toast && (
        <div style={{
          position: 'fixed', top: 56, right: 14, zIndex: 2000,
          padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
          background: toast.tone === 'ok' ? '#f0fdf4' : '#fffbeb',
          border: `1.5px solid ${toast.tone === 'ok' ? '#86efac' : '#fcd34d'}`,
          color: toast.tone === 'ok' ? '#15803d' : '#92400e', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        }}>{toast.msg}</div>
      )}
      <TopBar
        onExportDxf={handleExportDxf} onExportSvg={handleExportSvg}
        onSave={handleSave} onOpen={handleOpen} onNew={handleNew}
        recents={recents} onOpenRecent={handleOpenRecent}
        onVerifyResumido={handleVerifyResumido} onVerifyDetallado={handleVerifyDetallado}
        onMemoria={() => setMemoriaOpen(true)} onExportDcheck={handleExportDcheck}
        onModulos={() => setLauncher(true)}
        onToast={showToast}
        onAbrirCentro={() => setCentro(true)}
        dxfScale={dxfScale} setDxfScale={setDxfScale}
        projectName={projectName} setProjectName={setProjectName}
      />
      {centro && <LoadCenter onClose={() => setCentro(false)} onToast={showToast} projectName={projectName} />}
      <MemoriaDialog
        open={memoriaOpen}
        onClose={() => setMemoriaOpen(false)}
        sections={seccionesConGeometria}
        projectName={projectName}
      />
      <div role="tablist" className="flex items-center gap-1 px-4 pt-2" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        {tabBtn('detalle', 'Secciones')}
        {tabBtn('calculo', 'Calculo', calcAlert && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444', border: '1.5px solid var(--color-bg)',
          }} />
        ))}
        {tabBtn('columnas', 'Columnas', columns.length > 0 && pill(columns.length))}

        {/* Módulos abiertos: se cierran sin perder lo capturado */}
        {modulos.length > 0 && (
          <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 6px', alignSelf: 'center' }} />
        )}
        {modulos.map((id) => {
          const mod = getModulo(id)
          if (!mod) return null
          const activo = mainTab === id
          return (
            <span key={id} role="tab" aria-selected={activo} tabIndex={0}
              onClick={() => setMainTab(id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMainTab(id) }
                if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); cerrarModulo(id) }
              }}
              data-testid={`tab-${id}`}
              style={{ ...estiloTab(activo), paddingRight: mod.fijo ? 14 : 10 }}>
              <ModuleIcon nombre={mod.icono} size={13} />
              {mod.nombre}
              {badges[id] > 0 && pill(badges[id].toLocaleString())}
              {id === 'longitudinal' && longStats.bad > 0 && (
                <span title={`${longStats.bad} trabe(s) con miembros insuficientes o armado corrido que no cumple`} style={{
                  position: 'absolute', top: 2, right: 16, width: 8, height: 8, borderRadius: '50%',
                  background: '#ef4444', border: '1.5px solid var(--color-bg)',
                }} />
              )}
              {!mod.fijo && <span
                role="button" aria-label={`Cerrar ${mod.nombre}`}
                onClick={(e) => { e.stopPropagation(); cerrarModulo(id) }}
                title={`Cerrar ${mod.nombre} (lo capturado se conserva)`}
                style={{ fontSize: 14, lineHeight: 1, opacity: 0.5, marginLeft: 2 }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 0.5}
              >&times;</span>}
            </span>
          )
        })}

        <button
          onClick={() => setLauncher(true)}
          title="Abrir un módulo (⌘K / Ctrl+K)"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, padding: '4px 10px',
            fontSize: 12, cursor: 'pointer', borderRadius: 99,
            border: '1px dashed var(--color-border2)', background: 'transparent', color: 'var(--color-tx3)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border2)'; e.currentTarget.style.color = 'var(--color-tx3)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 6v12M6 12h12" />
          </svg>
          Módulos
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden" style={{ display: mainTab === 'detalle' ? 'flex' : 'none' }}>
        <BeamForm />
        <BeamCanvas sections={sections} svgRef={svgRef} />
        <MomentScale />
      </div>
      <div className="flex-1 overflow-auto" style={{ display: mainTab === 'calculo' ? 'block' : 'none' }}>
        <CalculatorView />
      </div>
      <div className="flex-1 overflow-hidden" style={{ display: mainTab === 'columnas' ? 'flex' : 'none', flexDirection: 'column' }}>
        <ColumnsView />
      </div>
      {/* Cada módulo abierto se queda montado: cambiar de pestaña no pierde nada */}
      {modulos.map((id) => (
        <div key={id} className="flex-1 overflow-hidden"
          style={{ display: mainTab === id ? 'flex' : 'none', flexDirection: 'column' }}>
          {vistaModulo[id]}
        </div>
      ))}

      <ModuleLauncher
        open={launcher}
        onClose={() => setLauncher(false)}
        onPick={abrirModulo}
        abiertos={modulos}
        badges={badges}
      />
    </div>
  )
}

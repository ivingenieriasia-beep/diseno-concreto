import { useEffect, useMemo, useRef, useState } from 'react'
import useCimStore from '../store/useCimStore'
import { TIPOS_CIM, tipoCim, revisarCim, estadoCim } from '../core/cim'
import { SUELO } from '../core/cim/comun'
import CimForm from './cim/CimForm'
import CimDetallador from './cim/CimDetallador'
import CimRevisiones, { CimMemoria } from './cim/CimRevisiones'
import CimObra from './cim/CimObra'
import CimRam from './cim/CimRam'
import { exportarPlanos, exportarMemoriaPdf } from '../core/cim/salidas'

// Cimentaciones: aisladas, corridas (bajo muro y con contratrabe), muros de
// contención de concreto y de piedra, y cimientos de mampostería. Cada uno
// con su formulario, su detallado arrastrable, sus revisiones y su memoria.

const ICONO = {
  aislada: <><rect x="3" y="13" width="18" height="6" rx="1" /><rect x="9" y="4" width="6" height="9" /></>,
  corrida: <><rect x="2" y="14" width="20" height="5" rx="1" /><rect x="9.5" y="4" width="5" height="10" /></>,
  contratrabe: <><rect x="2" y="16" width="20" height="4" rx="1" /><rect x="9" y="9" width="6" height="7" /><path d="M5 9V4M19 9V4" /></>,
  contencion: <><path d="M4 20h16v-3H11V4H8v13H4z" /><path d="M13 7l7 0" strokeDasharray="2 2" /></>,
  gravedad: <path d="M5 20h12L11 4H7z" />,
  mamposteria: <><path d="M5 20h14l-4-7H9z" /><rect x="10" y="4" width="4" height="9" /></>,
}
export const IconoCim = ({ tipo, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONO[tipo]}</svg>
)

export default function CimentacionesView({ onToast, dxfScale = 1, projectName = '' }) {
  const cimientos = useCimStore((s) => s.cimientos)
  const selUid = useCimStore((s) => s.selUid)
  const suelo = useCimStore((s) => s.suelo)
  const criterios = useCimStore((s) => s.criterios)
  const agregar = useCimStore((s) => s.agregar)
  const seleccionar = useCimStore((s) => s.seleccionar)
  const actualizar = useCimStore((s) => s.actualizar)
  const marcar = useCimStore((s) => s.marcar)
  const borrar = useCimStore((s) => s.borrar)
  const duplicar = useCimStore((s) => s.duplicar)
  const deshacer = useCimStore((s) => s.deshacer)
  const setSuelo = useCimStore((s) => s.setSuelo)
  const setCriterios = useCimStore((s) => s.setCriterios)
  const hist = useCimStore((s) => s.hist)
  const [menu, setMenu] = useState(false)
  const [obraAbierta, setObraAbierta] = useState(false)
  const [ram, setRam] = useState(false)
  const raiz = useRef(null)

  const obra = useMemo(() => ({ suelo, criterios }), [suelo, criterios])
  const revisiones = useMemo(() => new Map(cimientos.map((z) => [z.uid, revisarCim(z, obra)])), [cimientos, obra])
  const z = cimientos.find((x) => x.uid === selUid) || cimientos[0] || null
  const R = z ? revisiones.get(z.uid) : null
  const DfDe = (x) => Number((x?.suelo?.Df ?? suelo.Df ?? SUELO.Df))

  // Ctrl+Z sólo cuando esta pestaña está a la vista y no se escribe en un campo
  useEffect(() => {
    const h = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      if (!raiz.current || raiz.current.offsetParent === null) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      e.preventDefault()
      deshacer()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [deshacer])

  const nuevo = (tipo) => {
    const n = agregar(tipo)
    setMenu(false)
    onToast?.(`${n.nombre}: ${tipoCim(tipo).nombre.toLowerCase()} propuesta con cargas de ejemplo; captura las tuyas y pulsa ⚡ Proponer`)
  }
  const proponer = () => {
    if (!z) return
    try {
      const p = tipoCim(z.tipo).proponer(z, obra)
      actualizar(z.uid, p)
      const R2 = revisarCim({ ...z, ...p }, obra)
      onToast?.(R2.ok ? `${z.nombre}: dimensionado y armado; cumple todo` : `${z.nombre}: propuesta hecha, pero no cumple ${R2.checks.filter((c) => !c.ok).map((c) => c.titulo.toLowerCase()).join(', ')}`, R2.ok ? 'ok' : 'warn')
    } catch (e) {
      console.error(e)
      onToast?.(`No se pudo proponer: ${e.message}`, 'warn')
    }
  }
  const planos = async (formato, todos) => {
    const lista = todos ? cimientos : z ? [z] : []
    if (!lista.length) return
    try {
      const r = await exportarPlanos(lista, obra, { formato, dxfScale, projectName })
      onToast?.(r)
    } catch (e) { console.error(e); onToast?.(`No se pudo exportar: ${e.message}`, 'warn') }
  }
  const memoria = async (todos) => {
    const lista = todos ? cimientos : z ? [z] : []
    if (!lista.length) return
    try {
      const r = await exportarMemoriaPdf(lista, obra, { projectName })
      onToast?.(r)
    } catch (e) { console.error(e); onToast?.(`No se pudo generar la memoria: ${e.message}`, 'warn') }
  }
  const nMal = [...revisiones.values()].filter((r) => !r.ok).length

  return (
    <div ref={raiz} className="cim" data-testid="cim-view">
      <div className="cim-barra-sup">
        <div className="cim-titulo">
          <b>Cimentaciones</b>
          <span>{cimientos.length ? `${cimientos.length} cimiento(s)${nMal ? ` · ${nMal} no cumplen` : ' · todos cumplen'}` : 'Zapatas, corridas, contratrabes, muros de contención y mampostería'}</span>
        </div>
        <div className="cim-herr">
          <button className="btn btn-secondary" data-testid="cim-obra-btn" onClick={() => setObraAbierta(true)} title="Suelo del estudio y criterios de diseño de la obra">
            🪨 Suelo y criterios <span className="cim-q">qadm {Number(suelo.qadm ?? SUELO.qadm).toFixed(1)}</span>
          </button>
          <button className="btn btn-secondary" data-testid="cim-ram-btn" onClick={() => setRam(true)} title="Crear cimientos con las reacciones de los apoyos del modelo de RAM">⚡ Desde RAM</button>
          <span className="cim-sep" />
          <button className="btn btn-secondary" data-testid="cim-pdf" disabled={!z} onClick={() => memoria(false)} title="Memoria paso a paso del cimiento seleccionado">📄 Memoria PDF</button>
          <button className="btn btn-secondary" data-testid="cim-pdf-todos" disabled={cimientos.length < 2} onClick={() => memoria(true)} title="Memoria de todos los cimientos, con su tabla resumen">todos</button>
          <button className="btn btn-export" data-testid="cim-dxf" disabled={!z} onClick={() => planos('dxf', false)} title={`Plano del cimiento a escala real (factor ${dxfScale})`}>DXF</button>
          <button className="btn btn-secondary" data-testid="cim-dxf-todos" disabled={cimientos.length < 2} onClick={() => planos('dxf', true)} title="Todos los cimientos en un solo DXF">DXF todos</button>
          <button className="btn btn-secondary" data-testid="cim-svg" disabled={!z} onClick={() => planos('svg', false)}>SVG</button>
        </div>
      </div>

      <div className="cim-chips">
        {cimientos.map((x) => {
          const e = estadoCim(revisiones.get(x.uid))
          return (
            <button key={x.uid} data-testid={`cim-chip-${x.nombre}`} className={`cim-chip ${x.uid === z?.uid ? 'on' : ''} ${e.tono}`} onClick={() => seleccionar(x.uid)} title={`${tipoCim(x.tipo).nombre} · aprovechamiento máximo ${Number.isFinite(e.u) ? Math.round(e.u * 100) : '—'} %`}>
              <IconoCim tipo={x.tipo} size={14} />
              {x.nombre}
              <span className="cim-punto" />
            </button>
          )
        })}
        <div style={{ position: 'relative' }}>
          <button className="btn btn-primary" data-testid="cim-nuevo" onClick={() => setMenu(!menu)} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12 }}>+ Nuevo ▾</button>
          {menu && (
            <div className="cim-menu" data-testid="cim-menu" onMouseLeave={() => setMenu(false)}>
              {TIPOS_CIM.map((t) => (
                <button key={t.id} data-testid={`cim-nuevo-${t.id}`} onClick={() => nuevo(t.id)}>
                  <IconoCim tipo={t.id} size={18} />
                  <span><b>{t.nombre}</b><small>{t.resumen}</small></span>
                </button>
              ))}
            </div>
          )}
        </div>
        {hist.length > 0 && <button className="cim-mini" data-testid="cim-deshacer" onClick={deshacer} title="Ctrl+Z">↶ deshacer</button>}
      </div>

      {!z ? (
        <div className="cim-inicio" data-testid="cim-inicio">
          <p>Elige qué cimiento diseñar. Cada uno arranca dimensionado y armado con cargas de ejemplo; captura las tuyas o tráelas de las reacciones de RAM.</p>
          <div className="cim-tarjetas">
            {TIPOS_CIM.map((t) => (
              <button key={t.id} className="cim-tarjeta" data-testid={`cim-tarjeta-${t.id}`} onClick={() => nuevo(t.id)}>
                <IconoCim tipo={t.id} size={34} />
                <b>{t.nombre}</b>
                <span>{t.resumen}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={() => setRam(true)} style={{ marginTop: 14 }}>⚡ O créalos desde las reacciones de RAM</button>
        </div>
      ) : (
        <div className="cim-cuerpo-principal">
          <aside className="cim-izq">
            <CimForm key={z.uid} z={z} obra={obra} set={(p) => actualizar(z.uid, p)}
              onProponer={proponer} onDuplicar={() => duplicar(z.uid)}
              onBorrar={() => { if (window.confirm(`¿Borrar ${z.nombre}? (Ctrl+Z lo regresa)`)) borrar(z.uid) }} />
          </aside>
          <main className="cim-centro">
            <div className="cim-tipo-cab">
              <IconoCim tipo={z.tipo} size={18} />
              <b>{z.nombre}</b>
              <span>{tipoCim(z.tipo).nombre}</span>
            </div>
            <CimDetallador z={z} R={R} Df={DfDe(z)} actualizar={actualizar} marcar={marcar} />
            <CimMemoria key={`m-${z.uid}`} R={R} />
          </main>
          <aside className="cim-der">
            <CimRevisiones R={R} />
          </aside>
        </div>
      )}

      {obraAbierta && <CimObra suelo={suelo} criterios={criterios} setSuelo={setSuelo} setCriterios={setCriterios} onClose={() => setObraAbierta(false)} />}
      {ram && <CimRam obra={obra} onClose={() => setRam(false)} onToast={onToast} />}
    </div>
  )
}

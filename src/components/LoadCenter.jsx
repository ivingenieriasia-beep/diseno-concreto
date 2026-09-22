import { useMemo, useRef, useState } from 'react'
import useBeamStore from '../store/useBeamStore'
import useColumnStore from '../store/useColumnStore'
import { REPORTES, clasificarLote } from '../core/ramReports'
import { repartirEnvolventes, resumenReparto } from '../core/bulkEnvelopes'
import { parseGeometryReport, parseNodeXlsx, attachGeometry } from '../core/geometry'

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

export default function LoadCenter({ onClose, onToast }) {
  const sections = useBeamStore((s) => s.sections)
  const setEnvelopeAt = useBeamStore((s) => s.setEnvelopeAt)
  const setPerfilAt = useBeamStore((s) => s.setPerfilAt)
  const model = useBeamStore((s) => s.model)
  const setModel = useBeamStore((s) => s.setModel)
  const columns = useColumnStore((s) => s.columns)
  const setColEnvelopeAt = useColumnStore((s) => s.setEnvelopeAt)
  const inputRef = useRef(null)
  const [msg, setMsg] = useState('')
  const [drop, setDrop] = useState(false)
  const [filtro, setFiltro] = useState(null)   // id del slot que abrió el diálogo

  const nodes = useMemo(() => new Map(Object.entries(model?.nodes || {})), [model])

  // ── Estado de cada casilla ──
  const estados = useMemo(() => {
    const conPerfil = sections.filter((s) => s.perfil?.members?.length)
    const acc = conPerfil.filter((s) => s.perfil.formato === 'acciones')
    const est = conPerfil.filter((s) => s.perfil.formato !== 'acciones')
    const envT = sections.filter((s) => s.envelope?.points?.length)
    const envC = columns.filter((c) => c.envelope?.points?.length)
    const nEl = model?.rows?.length && nodes.size
      ? sections.reduce((n, s) => Math.max(n, attachGeometry(s.perfil, model)?.geom?.chains?.length || 0), 0)
      : 0
    return {
      acciones: acc.length
        ? { tono: 'ok', txt: `${acc.length} trabe(s): ${acc.map((s) => s.nombre).join(', ')}` }
        : { tono: 'pend', txt: 'sin cargar' },
      estaciones: est.length
        ? { tono: 'warn', txt: `${est.length} trabe(s) con la rejilla fija: ${est.map((s) => s.nombre).join(', ')} — mejor el de puntos de inflexión` }
        : { tono: 'pend', txt: 'sin cargar (opcional si ya tienes el de arriba)' },
      maximos: envT.length || envC.length
        ? { tono: 'ok', txt: `${envT.length} trabe(s) y ${envC.length} columna(s)` }
        : { tono: 'pend', txt: 'sin cargar' },
      geometria: model?.rows?.length
        ? { tono: 'ok', txt: `${model.archivo || 'cargada'} · ${model.rows.length} miembros · ${nodes.size} nudos${nEl ? ` · ${nEl} elementos` : ''}` }
        : { tono: 'pend', txt: 'sin cargar (opcional, pero da longitudes y el visor del modelo)' },
    }
  }, [sections, columns, model, nodes])

  // ── Carga: el contenido decide qué es cada archivo ──
  async function cargar(files) {
    if (!files.length) return
    const archivos = []
    for (const f of files) {
      try { archivos.push({ nombre: f.name, texto: /\.xlsx$/i.test(f.name) ? '' : await f.text(), file: f }) } catch { /* ignora */ }
    }
    const clas = clasificarLote(archivos)
    const notas = []

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
          setEnvelopeAt(a.idx, a.env)
          if (a.perfil) setPerfilAt(a.idx, a.perfil)
        } else setColEnvelopeAt(a.idx, a.env)
      }
      notas.push(resumenReparto(r))
    }
    if (clas.desconocidos.length) notas.push(`no se reconocieron: ${clas.desconocidos.join(', ')}`)
    const texto = notas.join(' · ')
    setMsg(texto)
    onToast?.(texto, clas.desconocidos.length ? 'warn' : 'ok')
  }

  const abrir = (id) => { setFiltro(id); inputRef.current?.click() }
  const onInput = (e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; cargar(fs) }

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(16,18,28,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6vh' }}
    >
      <div
        onDragOver={(e) => { e.preventDefault(); if (!drop) setDrop(true) }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDrop(false) }}
        onDrop={(e) => { e.preventDefault(); setDrop(false); cargar([...(e.dataTransfer?.files || [])]) }}
        style={{
          width: 'min(900px, calc(100vw - 32px))', maxHeight: '84vh', display: 'flex', flexDirection: 'column',
          background: 'var(--color-panel)', border: `1px solid ${drop ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 12, boxShadow: '0 18px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Cargar reportes de RAM</span>
          <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>
            Nombra cada archivo como su chip (T-5.txt, C-1.txt) y suéltalos todos aquí: el contenido decide qué es cada uno.
          </span>
          <button onClick={onClose} data-testid="cerrar-centro" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--color-tx3)' }}>×</button>
        </div>

        <div style={{ padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', borderRadius: 9, background: 'var(--color-bg)', border: '1px dashed var(--color-border)' }}>
            <button className="btn btn-primary" style={{ fontSize: 12 }} data-testid="cargar-todo" onClick={() => abrir(null)}>📂 Elegir todos los archivos…</button>
            <span style={{ fontSize: 11, color: 'var(--color-tx3)' }}>o suéltalos en esta ventana. Puedes mezclar esfuerzos, máximos y geometría.</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx3)' }}>
              {sections.length} trabe(s) · {columns.length} columna(s)
            </span>
          </div>

          {REPORTES.map((r) => (
            <Slot key={r.id} r={r} estado={estados[r.id]} onCargar={() => abrir(r.id)} />
          ))}

          {msg && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-tx2)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px' }} data-testid="centro-msg">{msg}</div>}

          <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', lineHeight: 1.6 }}>
            <b>El orden que conviene:</b> primero la <b>geometría</b> (una vez por proyecto), luego los <b>esfuerzos a lo largo</b> de cada tipo de trabe y, si los exportaste aparte, los <b>máximos</b> de trabes y columnas.
            Un mismo .txt puede traer varios reportes juntos: la app los separa y se queda con el mejor de cada cosa.
          </div>
        </div>
      </div>

      <input ref={inputRef} data-testid="centro-files" type="file" multiple
        accept={filtro === 'geometria' ? '.txt,.csv,.xlsx,text/plain' : '.txt,.csv,text/plain'}
        style={{ display: 'none' }} onChange={onInput} />
    </div>
  )
}

import { useMemo, useState } from 'react'
import AgrupacionPlanta from './AgrupacionPlanta'
import AgrupacionEscala from './AgrupacionEscala'
import {
  aprovechamiento, seccionDeGrupo, mismasEnOtrosNiveles, VIGAS_CATALOGO, grupoNuevo, renumerar, buscarMiembros,
} from '../core/agrupacion'

// Ver una propuesta en planta y, en el acomodo manual, mover trabes entre
// grupos, crear y quitar grupos, renombrarlos y fijarles sección.

export const PALETA = [
  '#1a7a5e', '#2563eb', '#ea580c', '#9333ea', '#0891b2', '#65a30d', '#db2777', '#4f46e5',
  '#ca8a04', '#0f766e', '#b45309', '#7c3aed', '#0369a1', '#a21caf', '#4d7c0f', '#be123c',
]
export const colorGrupo = (g, i) => PALETA[(g.c ?? i) % PALETA.length]
const SUELTA = '#9aa3b2'

const pct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)} %` : '—')
const corto = (s) => (s ? s.nombre.replace(' X ', '×') : '—')
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—')

/** El aprovechamiento de cada trabe en la sección de su grupo: 0 a 125 % */
function TiraU({ us, color }) {
  const W = 150, H = 16, top = 1.25
  const x = (u) => 4 + (Math.min(u, top) / top) * (W - 8)
  return (
    <svg width={W} height={H} style={{ display: 'block', flex: 'none' }}>
      <rect x={x(1)} y={2} width={x(top) - x(1) + 4} height={H - 4} fill="#c62828" opacity={0.12} />
      <line x1={4} x2={W - 4} y1={H / 2} y2={H / 2} stroke="var(--color-border)" />
      <line x1={x(1)} x2={x(1)} y1={1} y2={H - 1} stroke="#c62828" strokeWidth={1} opacity={0.6} />
      {us.map((u, i) => (
        <circle key={i} cx={x(u)} cy={H / 2} r={3.2} fill={u > 1 + 1e-9 ? '#c62828' : color} opacity={0.85} />
      ))}
    </svg>
  )
}

/** El nombre se escribe libre y se guarda al salir (o con Enter): así el deshacer va por nombre, no por letra */
function Nombre({ valor, onCambio, testid, disabled }) {
  const [txt, setTxt] = useState(null)
  const fin = () => { if (txt !== null && txt !== valor) onCambio(txt.trim()); setTxt(null) }
  return (
    <input data-testid={testid} disabled={disabled} value={txt ?? valor} onChange={(e) => setTxt(e.target.value)} onBlur={fin}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setTxt(null) }}
      style={{ width: 64, fontWeight: 800, fontSize: 12, padding: '2px 5px', border: '1px solid var(--color-border)', borderRadius: 5, background: disabled ? 'transparent' : 'var(--color-bg)', color: 'inherit' }} />
  )
}

export default function AgrupacionManual({
  A, R, geo, P, editable, manual, cambiar, sel, setSel, verifDe, onAjustar, deshacer, nHist, girar,
}) {
  const [busca, setBusca] = useState('')
  const [hallazgo, setHallazgo] = useState(null)   // lo que encontró la última búsqueda
  const [foco, setFoco] = useState(null)           // trabes a enfocar y hacer parpadear en la planta
  const elemPor = useMemo(() => new Map(A.elementos.map((e) => [e.id, e])), [A])
  const filas = editable ? P.todos : P.grupos
  const grupoDe = useMemo(() => {
    const m = new Map()
    P.grupos.forEach((g, i) => { for (const e of g.elems) m.set(e.id, { g, i }) })
    return m
  }, [P])

  const estilo = (id) => {
    const x = grupoDe.get(id)
    if (!x) return { color: SUELTA, dash: '5 4', etiqueta: '' }
    const e = elemPor.get(id)
    return { color: colorGrupo(x.g, x.i), etiqueta: x.g.nombre, mal: x.g.sec ? aprovechamiento(e, x.g.sec) > 1 + 1e-9 : false }
  }
  const info = (id) => {
    const e = elemPor.get(id), g = geo.porId.get(id), x = grupoDe.get(id)
    const out = [
      `Trabe ${id} · N${g?.nivel ?? '?'}`,
      `L ${e.L.toFixed(2)} m · Mu+ ${f1(e.MuP)} · Mu− ${f1(e.MuN)} t·m · Vu ${f1(e.Vu)} t`,
      `le basta ${corto(e.minima?.sec)}${e.minima?.fuera ? ' (ni ésa alcanza)' : ''} · hoy ${e.hoy.b && e.hoy.h ? `${e.hoy.b}×${e.hoy.h}` : e.hoy.seccion}`,
    ]
    out.push(x ? `en ${x.g.nombre} (${corto(x.g.sec)}) al ${pct(aprovechamiento(e, x.g.sec))}` : 'sin asignar: en RAM no se toca')
    out.push(`miembros: ${e.miembros.length > 14 ? `${e.miembros.slice(0, 14).join(', ')}…` : e.miembros.join(', ')}`)
    return out
  }

  // ── buscar por miembro de RAM ──
  const buscar = (sumar) => {
    const r = buscarMiembros(R, A.elementos, busca)
    setHallazgo(r)
    if (!r.elems.length) return
    setSel(sumar ? new Set([...sel, ...r.elems]) : new Set(r.elems))
    setFoco({ ids: r.elems, n: Date.now() })
  }
  const mensaje = () => {
    const h = hallazgo
    if (!h.pedidos) return { txt: 'Escribe uno o más números de miembro: 97, 120-124…', mal: true }
    const partes = []
    if (h.encontrados.length && h.encontrados.length <= 3) {
      for (const f of h.encontrados) {
        const x = grupoDe.get(f.elem)
        partes.push(`${f.miembro} → trabe ${f.elem} · N${geo.porId.get(f.elem)?.nivel ?? '?'} · ${x ? `en ${x.g.nombre}` : 'sin asignar'}`)
      }
    } else if (h.encontrados.length) partes.push(`${h.encontrados.length} miembros → ${h.elems.length} trabe(s) seleccionada(s)`)
    const fuera = h.fuera.slice(0, 3).map((f) => `${f.miembro}: ${f.motivo}`)
    if (h.fuera.length > 3) fuera.push(`y ${h.fuera.length - 3} más que no están`)
    return { txt: [...partes, ...fuera].join(' · '), mal: !h.encontrados.length }
  }

  const selIds = [...sel].filter((id) => elemPor.has(id))
  const selElems = selIds.map((id) => elemPor.get(id))
  const pide = selElems.length ? seccionDeGrupo(selElems, A.cands) : null

  // ── acciones del acomodo ──
  const mover = (gid, ids = selIds) => cambiar((m) => ({ ...m, de: { ...m.de, ...Object.fromEntries(ids.map((id) => [id, gid])) } }))
  const nuevo = (ids = selIds) => cambiar((m) => {
    const g = grupoNuevo(m)
    return { ...m, grupos: [...m.grupos, g], de: { ...m.de, ...Object.fromEntries(ids.map((id) => [id, g.id])) } }
  })
  const soltar = (ids = selIds) => cambiar((m) => {
    const de = { ...m.de }
    for (const id of ids) delete de[id]
    return { ...m, de }
  })
  // la escala: soltar puntos en una fila
  const soltarEn = (ids, destino) => {
    const ya = (id) => (destino === 'sueltos' ? !manual.de[id] : manual.de[id] === destino)
    if (destino !== 'nuevo' && ids.every(ya)) return          // soltó donde ya estaban
    if (destino === 'nuevo') nuevo(ids)
    else if (destino === 'sueltos') soltar(ids)
    else mover(destino, ids)
    setSel(new Set(ids))
  }
  // dónde caerían unas trabes en un grupo: si es automático, con la sección que le quedaría
  const destino = (es, g) => {
    const todas = [...g.elems, ...es]
    let sec = g.sec, crece = false, malo = false
    if (g.auto !== false) {
      const r = seccionDeGrupo(todas, A.cands)
      crece = !!g.sec && r.sec?.nombre !== g.sec.nombre
      sec = r.sec
      malo = r.fuera
    }
    const us = sec ? es.map((e) => aprovechamiento(e, sec)) : []
    if (g.auto === false) malo = us.some((u) => u > 1 + 1e-9)
    const top = Math.max(...us)
    const texto = !sec ? '' : malo
      ? (g.auto === false ? `no cabe en ${corto(sec)}` : 'ninguna sección alcanza')
      : !g.elems.length ? `quedaría ${corto(sec)}`
        : crece ? `${g.nombre} subiría a ${corto(sec)}` : `cabe · ${pct(top)}`
    return { us, texto, crece, malo }
  }
  const [conEscala, setConEscala] = useState(true)
  const borrar = (gid) => cambiar((m) => ({
    ...m, grupos: m.grupos.filter((g) => g.id !== gid),
    de: Object.fromEntries(Object.entries(m.de).filter(([, v]) => v !== gid)),
  }))
  const editar = (gid, cambio) => cambiar((m) => ({ ...m, grupos: m.grupos.map((g) => (g.id === gid ? { ...g, ...cambio } : g)) }))
  const seleccionarGrupo = (g, ev) => {
    const ids = g.elems.map((e) => e.id)
    setSel(ev.shiftKey || ev.ctrlKey || ev.metaKey ? new Set([...sel, ...ids]) : new Set(ids))
  }

  const btn = { fontSize: 11, padding: '3px 9px' }
  const anchos = [...new Set(VIGAS_CATALOGO.map((s) => s.b))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
          <b style={{ fontSize: 12 }}>Escala de aprovechamiento</b>
          <span style={{ fontSize: 10.5, color: 'var(--color-tx3)' }}>qué tanto usa cada trabe la sección de su grupo; la selección es la misma que en la planta</span>
          <button className="btn btn-secondary" data-testid="agr-escala-ver" style={{ fontSize: 10, padding: '1px 8px', marginLeft: 'auto' }} onClick={() => setConEscala((v) => !v)}>
            {conEscala ? 'ocultar' : 'mostrar'}
          </button>
        </div>
        {conEscala && (
          <AgrupacionEscala filas={filas} sueltos={editable ? P.sueltos : []} editable={editable} sel={sel} setSel={setSel} info={info}
            uDe={(e, g) => (g.sec ? aprovechamiento(e, g.sec) : Infinity)} colorDe={colorGrupo} destino={destino} onSoltarEn={soltarEn} />
        )}
      </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input data-testid="agr-buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar miembro de RAM: 97, 120-124"
            onKeyDown={(e) => { if (e.key === 'Enter') buscar(e.shiftKey) }}
            title="Número de miembro de RAM; varios con coma o espacio, o un rango 120-124. Enter selecciona su trabe; Mayús+Enter la suma a la selección"
            style={{ width: 250, fontSize: 12, fontFamily: 'var(--font-mono)', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-bg)', color: 'inherit' }} />
          <button className="btn btn-secondary" data-testid="agr-buscar-ir" style={btn} onClick={() => buscar(false)}>🔍 buscar</button>
          {hallazgo && (() => {
            const m = mensaje()
            return <span data-testid="agr-buscar-msg" style={{ fontSize: 11, color: m.mal ? '#c62828' : 'var(--color-tx2)' }}>{m.txt}</span>
          })()}
        </div>
        <AgrupacionPlanta geo={geo} estilo={estilo} sel={sel} onSel={setSel} info={info} girar={girar} foco={foco} />

        {selElems.length > 0 && (
          <div data-testid="agr-seleccion" style={{ border: `1px solid ${'#f59e0b'}`, borderRadius: 9, padding: '8px 10px', background: 'var(--color-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
              <b data-testid="agr-sel-n">{selElems.length} trabe(s) seleccionada(s)</b>
              <span style={{ color: 'var(--color-tx2)' }}>
                juntas piden al menos <b style={{ fontFamily: 'var(--font-mono)' }}>{corto(pide?.sec)}</b>{pide?.fuera ? ' (y ni ésa alcanza)' : ''}
                {' '}· Mu máx {f1(Math.max(...selElems.map((e) => e.Mu)))} t·m · Vu máx {f1(Math.max(...selElems.map((e) => e.Vu)))} t
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary" data-testid="agr-mismas" style={btn} title="La misma trabe en los otros niveles (misma posición en planta)"
                  onClick={() => setSel(mismasEnOtrosNiveles(geo, selIds))}>＋ las mismas en otros niveles</button>
                <button className="btn btn-secondary" data-testid="agr-limpiar" style={btn} onClick={() => setSel(new Set())}>limpiar</button>
              </span>
            </div>
            <div style={{ maxHeight: 230, overflow: 'auto', marginTop: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ color: 'var(--color-tx3)', textAlign: 'right' }}>
                    <th style={{ textAlign: 'left', fontWeight: 600 }}>nivel</th><th style={{ textAlign: 'left', fontWeight: 600 }}>trabe</th>
                    <th style={{ fontWeight: 600 }}>L m</th><th style={{ fontWeight: 600 }}>Mu+</th><th style={{ fontWeight: 600 }}>Mu−</th><th style={{ fontWeight: 600 }}>Vu t</th>
                    <th style={{ fontWeight: 600 }}>le basta</th><th style={{ fontWeight: 600 }}>grupo</th><th style={{ fontWeight: 600 }}>aprov.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...selElems].sort((a, b) => (geo.porId.get(a.id)?.nivel ?? 0) - (geo.porId.get(b.id)?.nivel ?? 0) || b.Mu - a.Mu).slice(0, 80).map((e) => {
                    const x = grupoDe.get(e.id)
                    const u = x ? aprovechamiento(e, x.g.sec) : null
                    return (
                      <tr key={e.id} style={{ borderTop: '1px solid var(--color-border)', textAlign: 'right' }}>
                        <td style={{ textAlign: 'left' }}>N{geo.porId.get(e.id)?.nivel ?? '?'}</td>
                        <td style={{ textAlign: 'left' }}>{e.id}</td>
                        <td>{e.L.toFixed(2)}</td><td>{f1(e.MuP)}</td><td>{f1(e.MuN)}</td><td>{f1(e.Vu)}</td>
                        <td>{corto(e.minima?.sec)}</td>
                        <td style={{ color: x ? colorGrupo(x.g, x.i) : SUELTA, fontWeight: 800 }}>{x ? x.g.nombre : '—'}</td>
                        <td style={{ color: u > 1 + 1e-9 ? '#c62828' : 'inherit' }}>{u === null ? '' : pct(u)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {selElems.length > 80 && <div style={{ fontSize: 10.5, color: 'var(--color-tx3)' }}>… y {selElems.length - 80} más</div>}
            </div>
          </div>
        )}
      </div>

      <div data-testid="agr-panel-grupos" style={{ flex: '0 1 430px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {editable ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" data-testid="agr-nuevo" style={btn} disabled={!selIds.length} onClick={() => nuevo()}>
              ＋ grupo nuevo con la selección{selIds.length ? ` (${selIds.length})` : ''}
            </button>
            <button className="btn btn-secondary" data-testid="agr-soltar" style={btn} disabled={!selIds.length} onClick={() => soltar()}>sacar de su grupo</button>
            <button className="btn btn-secondary" data-testid="agr-renumerar" style={btn} title="T1 la sección más grande … Tn la más chica"
              onClick={() => cambiar((m) => renumerar(m, P))}>renumerar T1…</button>
            <button className="btn btn-secondary" data-testid="agr-deshacer" style={btn} disabled={!nHist} onClick={deshacer}>↶ deshacer</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--color-tx2)' }}>
            <span>Así queda <b>{P.nombre}</b>. Para mover trabes:</span>
            <button className="btn btn-primary" data-testid="agr-ajustar-aqui" style={btn} onClick={onAjustar}>✎ ajustar ésta a mano</button>
          </div>
        )}

        {filas.map((g, i) => {
          const v = verifDe(g)
          const color = colorGrupo(g, i)
          return (
            <div key={g.id || g.nombre} data-testid={`agr-g-${g.nombre}`} style={{
              border: '1px solid var(--color-border)', borderLeft: `5px solid ${color}`, borderRadius: 8, padding: '6px 8px',
              background: 'var(--color-panel)', display: 'flex', flexDirection: 'column', gap: 4, opacity: g.vacio ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button title="Seleccionar sus trabes (con Mayús, sumarlas)" data-testid={`agr-g-sel-${g.nombre}`} onClick={(ev) => seleccionarGrupo(g, ev)}
                  style={{ width: 16, height: 16, borderRadius: 4, background: color, border: 'none', cursor: 'pointer', flex: 'none' }} />
                {editable
                  ? <Nombre valor={g.nombre} testid={`agr-g-nombre-${g.nombre}`} onCambio={(nombre) => editar(g.id, { nombre })} />
                  : <b style={{ fontSize: 12.5, minWidth: 34 }}>{g.nombre}</b>}
                {editable ? (
                  <select data-testid={`agr-g-sec-${g.nombre}`} value={g.auto ? '' : g.sec?.nombre || ''} onChange={(ev) => editar(g.id, { sec: ev.target.value || null })}
                    style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-bg)', color: 'inherit' }}>
                    <option value="">auto · {corto(g.auto ? g.sec : null)}</option>
                    {anchos.map((b) => (
                      <optgroup key={b} label={`b = ${b} cm`}>
                        {VIGAS_CATALOGO.filter((s) => s.b === b).map((s) => <option key={s.nombre} value={s.nombre}>{corto(s)}</option>)}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12 }}>{corto(g.sec)}</span>
                )}
                <span style={{ fontSize: 10.5, color: 'var(--color-tx3)' }}>
                  {g.vacio ? 'vacío' : `${g.elems.length} trabe(s) · ${g.L.toFixed(1)} m`}
                </span>
                {editable && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary" data-testid={`agr-g-aqui-${g.nombre}`} style={{ ...btn, padding: '1px 7px' }} disabled={!selIds.length}
                      title="Mover aquí las trabes seleccionadas" onClick={() => mover(g.id)}>← aquí</button>
                    <button className="btn btn-secondary" data-testid={`agr-g-borrar-${g.nombre}`} style={{ ...btn, padding: '1px 7px' }}
                      title="Quitar el grupo: sus trabes quedan sin asignar" onClick={() => borrar(g.id)}>✕</button>
                  </span>
                )}
              </div>
              {!g.vacio && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
                  <TiraU us={g.us || g.elems.map((e) => aprovechamiento(e, g.sec))} color={color} />
                  <span style={{ color: g.fuera ? '#c62828' : 'var(--color-tx3)', fontFamily: 'var(--font-mono)' }}>
                    {pct(g.uMin)}–{pct(g.uMax)}{g.fuera ? ' · no alcanza' : ''}
                  </span>
                  <span data-testid={`agr-g-verif-${g.nombre}`} title={v?.texto || ''} style={{ marginLeft: 'auto', fontWeight: 700, color: !v ? 'var(--color-tx3)' : v.estado === 'ok' ? '#15803d' : '#c62828' }}>
                    {!v ? '…' : v.estado === 'ok' ? `✓ ${Math.round(v.kg || 0)} kg` : `✗ ${v.motivos?.[0] || 'a revisar'}`}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {editable && P.sueltos.length > 0 && (
          <div data-testid="agr-sueltos" style={{ border: '1px dashed var(--color-border)', borderLeft: `5px dashed ${SUELTA}`, borderRadius: 8, padding: '6px 8px', fontSize: 11 }}>
            <button onClick={(ev) => setSel(new Set([...(ev.shiftKey ? sel : []), ...P.sueltos.map((e) => e.id)]))}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', fontSize: 11, textAlign: 'left' }}>
              <b>{P.sueltos.length} trabe(s) sin asignar</b> <span style={{ color: 'var(--color-tx3)' }}>— clic para seleccionarlas. Al aplicar, en RAM no se tocan.</span>
            </button>
          </div>
        )}
        {editable && manual && (
          <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', lineHeight: 1.55 }}>
            «auto» toma la sección de menos concreto que les basta a todas sus trabes (con los anchos permitidos); si la fijas,
            las que no quepan se marcan en rojo en la tira y con puntos rojos en la planta.
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

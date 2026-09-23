import { useEffect, useMemo, useRef, useState } from 'react'
import useBeamStore from '../store/useBeamStore'
import { parseModeloRam } from '../core/ramModel'
import { modeloGuardado, hace, EVENTO_MODELO } from '../core/ramSync'
import { revisarModelo, rolesPorDefecto, ROLES, formulaServicio } from '../core/deflexiones'
import { leerMiembros } from '../core/agrupacion'
import { claveNombre } from '../core/bulkEnvelopes'

// Deflexiones: las flechas de las trabes con los desplazamientos del modelo
// de RAM, corregidas con la inercia agrietada del armado de cada sección,
// más las diferidas, contra los límites de la NTC.

// v2: la sostenida pasó a ser CS completa (antes, CM + 40 % de CV)
const GUARDADO = 'auxiv.deflexiones.config.v2'
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—')
const pct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)} %` : '—')
const rojo = '#c62828', verde = '#15803d', ambar = '#92400e'

function leerConfig() {
  try { return JSON.parse(localStorage.getItem(GUARDADO) || 'null') || {} } catch { return {} }
}

function Detalle({ r }) {
  if (r.sinArmado) {
    return (
      <div style={{ fontSize: 11, color: 'var(--color-tx2)', lineHeight: 1.6 }}>
        El proyecto no tiene la sección <b>{r.tramo.grupo}</b>: sin su armado no se puede calcular la inercia agrietada, así que se
        muestra la flecha elástica de RAM ({f2(r.elastico.tot)} cm), que se queda corta. Créala desde <b>Reportes de RAM</b> para revisarla.
      </div>
    )
  }
  const fila = (k, v) => [<span key={`${k}k`} style={{ color: 'var(--color-tx3)' }}>{k}</span>, <span key={`${k}v`} style={{ fontFamily: 'var(--font-mono)' }}>{v}</span>]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '4px 18px', fontSize: 11 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
        {fila('f\'c · Ec', `${r.fc} · ${Math.round(r.Ec).toLocaleString('es-MX')} kg/cm²`)}
        {fila('Ig · IRAM', `${Math.round(r.Ig)} · ${Math.round(r.Iram)} cm⁴`)}
        {fila('Iag centro · apoyo', `${Math.round(r.Iag.centro)} · ${Math.round(r.Iag.apoyo)} cm⁴`)}
        {fila('Mag (agrietamiento)', `${f2(r.Mag)} t·m`)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
        {fila('Ma total: centro · extremos', `${f2(r.Ma.tot.pos)} · ${f2(r.Ma.tot.negI)} / ${f2(r.Ma.tot.negJ)} t·m`)}
        {fila('Ie muerta · sostenida · total', `${Math.round(r.Ie.cm)} · ${Math.round(r.Ie.sost)} · ${Math.round(r.Ie.tot)} cm⁴`)}
        {fila('ρ′ · λ = 2/(1+50ρ′)', `${(r.rhoP * 100).toFixed(2)} % · ${r.lambda.toFixed(2)}`)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
        {fila('elástica RAM (total)', `${f2(r.elastico.tot)} cm`)}
        {fila('inmediata: muerta · total', `${f2(r.inmediata.cm)} · ${f2(r.inmediata.tot)} cm`)}
        {fila('diferida = λ · sostenida', `${f2(r.lambda)} × ${f2(r.inmediata.sost)} = ${f2(r.diferida)} cm`)}
        {fila('total · después de muros', `${f2(r.total)} · ${f2(r.post)} cm`)}
      </div>
    </div>
  )
}

export default function DeflexionesView() {
  const secciones = useBeamStore((s) => s.sections)
  const [fuente, setFuente] = useState(null)       // { archivo, at, R }
  const [aviso, setAviso] = useState('')
  const [cfg, setCfg] = useState(() => ({ fSost: 1, post: true, roles: null, ...leerConfig() }))
  const [soloMal, setSoloMal] = useState(false)
  const [grupo, setGrupo] = useState('')
  const [busca, setBusca] = useState('')
  const [abierto, setAbierto] = useState(null)
  const archivoRef = useRef(null)

  const usar = (texto, archivo, at = Date.now()) => {
    const R = parseModeloRam(texto, archivo)
    if (!R.ok) { setAviso(R.warnings[0] || 'No se pudo leer el modelo.'); return }
    setAviso('')
    setFuente({ archivo, at, R })
  }
  useEffect(() => {
    const cargar = () => modeloGuardado().then((m) => { if (m?.datos) usar(m.datos, m.archivo || 'modelo.json', m.at) })
    cargar()
    window.addEventListener(EVENTO_MODELO, cargar)
    return () => window.removeEventListener(EVENTO_MODELO, cargar)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(GUARDADO, JSON.stringify(cfg)) } catch { /* sin almacenamiento */ } }, [cfg])

  const R = fuente?.R
  const casos = R?.flechas?.casos || []
  // los papeles que guardaste valen si son de estos casos; si no, los de fábrica
  const roles = useMemo(() => {
    const def = rolesPorDefecto(casos)
    const g = cfg.roles || {}
    return Object.fromEntries(casos.map((c) => [c.id, g[c.id] || def[c.id]]))
  }, [casos, cfg.roles])
  const hayMedia = Object.values(roles).includes('viva-media')

  const res = useMemo(() => {
    if (!R?.flechas) return []
    try { return revisarModelo(R, secciones, { roles, fSost: cfg.fSost, post: cfg.post }) } catch (e) { console.error(e); return [] }
  }, [R, secciones, roles, cfg.fSost, cfg.post])

  const nombreDe = useMemo(() => new Map(secciones.map((t) => [claveNombre(t.nombre), t.nombre])), [secciones])
  const grupos = useMemo(() => {
    const m = new Map()
    for (const r of res) {
      const g = r.tramo.grupo
      if (!m.has(g)) m.set(g, { g, n: 0, mal: 0, sin: 0, peor: 0 })
      const x = m.get(g)
      x.n++
      if (r.estado === 'no') x.mal++
      if (r.sinArmado) x.sin++
      x.peor = Math.max(x.peor, cfg.post ? Math.max(r.u.total, r.u.post) : r.u.total)
    }
    return [...m.values()].sort((a, b) => b.peor - a.peor)
  }, [res, cfg.post])

  const buscados = useMemo(() => new Set(leerMiembros(busca)), [busca])
  const uDe = (r) => (cfg.post ? Math.max(r.u.total, r.u.post) : r.u.total)
  const filas = res
    .filter((r) => (!soloMal || r.estado !== 'ok') && (!grupo || r.tramo.grupo === grupo) && (!buscados.size || r.tramo.miembros.some((m) => buscados.has(m))))
    .sort((a, b) => uDe(b) - uDe(a))
  const nMal = res.filter((r) => r.estado === 'no').length
  const nSin = res.filter((r) => r.sinArmado).length

  const cargarArchivo = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) usar(await f.text(), f.name, f.lastModified)
  }
  const cambiarRol = (id, rol) => setCfg((c) => ({ ...c, roles: { ...roles, [id]: rol } }))

  const caja = { border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-panel)', padding: '12px 14px' }
  const th = { textAlign: 'right', fontWeight: 600, color: 'var(--color-tx3)', padding: '4px 6px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)' }
  const td = { textAlign: 'right', padding: '4px 6px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1400, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 800 }}>Deflexiones</span>
        <span style={{ fontSize: 11.5, color: 'var(--color-tx3)' }}>
          Flechas de RAM por caso, con la inercia agrietada del armado de cada sección y las diferidas (NTC). Límites L/240 + 0.5 cm y L/480 + 0.3 cm.
        </span>
      </div>

      <div data-testid="def-fuente" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11.5, padding: '8px 12px', borderRadius: 9, border: '1px dashed var(--color-border)', background: 'var(--color-bg)' }}>
        {fuente
          ? <span>Modelo: <b>{fuente.archivo}</b> · {hace(fuente.at)}{R.flechas ? ` · flechas de ${Object.keys(R.flechas.miembros).length} miembros de trabe` : ''}</span>
          : <span>No hay modelo todavía: sincroniza en <b>Reportes de RAM</b>, o carga un <b>modelo.json</b>.</span>}
        <button className="btn btn-secondary" style={{ fontSize: 11, marginLeft: 'auto' }} onClick={() => archivoRef.current?.click()}>Cargar modelo.json…</button>
        <input ref={archivoRef} data-testid="def-archivo" type="file" accept=".json" style={{ display: 'none' }} onChange={cargarArchivo} />
      </div>
      {aviso && <div style={{ color: rojo, fontSize: 11.5 }}>{aviso}</div>}

      {fuente && !R.flechas && (
        <div data-testid="def-sin-datos" style={{ ...caja, borderColor: '#f5c26b', background: '#fffbeb', color: ambar, fontSize: 12, lineHeight: 1.6 }}>
          <b>Este modelo.json no trae desplazamientos.</b> Lo escribió un sincronizar.py anterior: genéralo otra vez en
          <b> Reportes de RAM → ⚙ Configurar RAM → ⬇ Generar sincronizar.py</b>, córrelo en RAM y vuelve a sincronizar.
        </div>
      )}

      {R?.flechas && (
        <>
          {!R.flechas.comprobada && (
            <div data-testid="def-unidad" style={{ color: ambar, fontSize: 11.5 }}>
              ⚠ El script no pudo comprobar la unidad de los desplazamientos con los giros de RAM y los tomó en metros. Revisa que las flechas tengan sentido.
            </div>
          )}
          <div style={caja}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>Cargas de servicio</span>
              <b data-testid="def-cs" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--color-accent2)' }}>{formulaServicio(roles)}</b>
              <span style={{ fontSize: 10.5, color: 'var(--color-tx3)' }}>
                para la inmediata y, {hayMedia ? 'con la viva media,' : cfg.fSost >= 1 ? 'completa,' : `con el ${Math.round(cfg.fSost * 100)} % de la viva,`} como carga sostenida para la diferida
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
              {casos.map((c) => (
                <label key={c.id} data-testid={`def-caso-${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--color-border)', borderRadius: 7, padding: '3px 8px', background: 'var(--color-bg)' }}>
                  <b>{c.id}</b>
                  <span style={{ color: 'var(--color-tx3)' }}>{c.descripcion}</span>
                  <select value={roles[c.id]} onChange={(e) => cambiarRol(c.id, e.target.value)}
                    style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-panel)', color: 'inherit' }}>
                    {ROLES.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', fontSize: 11.5, marginTop: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hayMedia ? 0.5 : 1 }}
                title="Qué parte de la viva de CS se toma como sostenida para la diferida. 100 % = CS completa (el criterio de fábrica)">
                viva sostenida en la diferida
                <input data-testid="def-fsost" type="number" min={0} max={100} step={5} disabled={hayMedia} value={Math.round(cfg.fSost * 100)}
                  onChange={(e) => setCfg((c) => ({ ...c, fSost: Math.max(0, Math.min(100, +e.target.value || 0)) / 100 }))}
                  style={{ width: 54, fontFamily: 'var(--font-mono)', fontSize: 12, padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-bg)', color: 'inherit' }} /> %
                {hayMedia && <span style={{ color: 'var(--color-tx3)' }}>(se usa el caso de viva media)</span>}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input data-testid="def-post" type="checkbox" checked={cfg.post} onChange={() => setCfg((c) => ({ ...c, post: !c.post }))} />
                revisar también L/480 + 0.3 cm (muros de mampostería u otros elementos que se dañan)
              </label>
              <button className="btn btn-secondary" style={{ fontSize: 10.5, padding: '1px 8px' }} onClick={() => setCfg({ fSost: 1, post: true, roles: null })}>valores de fábrica</button>
            </div>
          </div>

          <div data-testid="def-resumen" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 12 }}>
            <span><b style={{ fontSize: 18 }}>{res.length}</b> tramos</span>
            {nSin < res.length && (
              <span style={{ color: nMal ? rojo : verde, fontWeight: 700 }}>{nMal ? `✗ ${nMal} no pasan` : `✓ pasan los ${res.length - nSin} que tienen armado`}</span>
            )}
            {nSin > 0 && <span style={{ color: ambar }}>{nSin} sin armado: crea sus secciones para revisarlos</span>}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {grupos.map((x) => (
              <button key={x.g} data-testid={`def-grupo-${x.g}`} onClick={() => setGrupo((g) => (g === x.g ? '' : x.g))}
                style={{
                  fontSize: 11.5, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', color: 'inherit',
                  border: `1.5px solid ${grupo === x.g ? 'var(--color-accent)' : 'var(--color-border)'}`, background: grupo === x.g ? 'var(--color-bg)' : 'var(--color-panel)',
                }}>
                <b style={{ color: x.sin ? ambar : x.mal ? rojo : verde }}>{x.sin ? '?' : x.mal ? '✗' : '✓'} {nombreDe.get(claveNombre(x.g)) || x.g}</b>
                <span style={{ color: 'var(--color-tx3)', marginLeft: 6 }}>{x.n} · peor {pct(x.peor)}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <input data-testid="def-solo-mal" type="checkbox" checked={soloMal} onChange={() => setSoloMal((v) => !v)} /> sólo los que no pasan
            </label>
            <input data-testid="def-buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="miembro de RAM: 97, 120-124"
              style={{ width: 210, fontSize: 12, fontFamily: 'var(--font-mono)', padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-bg)', color: 'inherit' }} />
            <span style={{ color: 'var(--color-tx3)' }}>{filas.length} tramo(s){grupo ? ` de ${grupo}` : ''} · clic en uno para ver el cálculo</span>
          </div>

          <div style={{ ...caja, padding: 0, overflow: 'auto' }}>
            <table data-testid="def-tabla" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>sección</th>
                  <th style={{ ...th, textAlign: 'left' }}>tramo</th>
                  <th style={th}>nivel</th>
                  <th style={th}>L m</th>
                  <th style={th} title="Flecha de RAM con la carga total, relativa a la cuerda de los apoyos">elástica cm</th>
                  <th style={th} title="Ig/Ie con la carga total: cuánto la agrieta">Ig/Ie</th>
                  <th style={th}>inmediata cm</th>
                  <th style={th}>diferida cm</th>
                  <th style={th}>total / lím. cm</th>
                  {cfg.post && <th style={th}>después de muros / lím.</th>}
                  <th style={{ ...th, textAlign: 'center' }}>estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 400).map((r) => {
                  const t = r.tramo
                  const abiertoAqui = abierto === t.id
                  const col = (u) => (u > 1 + 1e-9 ? rojo : u > 0.9 ? ambar : 'inherit')
                  return [
                    <tr key={t.id} data-testid={`def-fila-${t.id}`} data-estado={r.estado} onClick={() => setAbierto(abiertoAqui ? null : t.id)}
                      style={{ cursor: 'pointer', borderTop: '1px solid var(--color-border)', background: abiertoAqui ? 'var(--color-bg)' : 'transparent' }}>
                      <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 700 }}>{nombreDe.get(claveNombre(t.grupo)) || t.grupo}</td>
                      <td style={{ ...td, textAlign: 'left' }}>{t.id}{t.tipo === 'voladizo' ? ' · voladizo' : ''}</td>
                      <td style={td}>{f2(t.nivel)}</td>
                      <td style={td}>{f2(t.L)}</td>
                      <td style={td}>{f2(r.elastico.tot)}</td>
                      <td style={td}>{r.sinArmado ? '—' : f2(r.Iram / r.Ie.tot)}</td>
                      <td style={td}>{r.sinArmado ? '—' : f2(r.inmediata.tot)}</td>
                      <td style={td}>{r.sinArmado ? '—' : f2(r.diferida)}</td>
                      <td style={{ ...td, color: r.sinArmado ? 'var(--color-tx3)' : col(r.u.total) }}>{f2(r.total)} / {f2(r.lim.total)} <span style={{ fontSize: 10 }}>({pct(r.u.total)})</span></td>
                      {cfg.post && <td style={{ ...td, color: r.sinArmado ? 'var(--color-tx3)' : col(r.u.post) }}>{f2(r.post)} / {f2(r.lim.post)} <span style={{ fontSize: 10 }}>({pct(r.u.post)})</span></td>}
                      <td style={{ ...td, textAlign: 'center', fontFamily: 'inherit', fontWeight: 800, color: r.sinArmado ? ambar : r.estado === 'ok' ? verde : rojo }}>
                        {r.sinArmado ? '? sin armado' : r.estado === 'ok' ? '✓' : '✗'}
                      </td>
                    </tr>,
                    abiertoAqui && (
                      <tr key={`${t.id}-d`} data-testid="def-detalle">
                        <td colSpan={cfg.post ? 11 : 10} style={{ padding: '8px 12px 12px', background: 'var(--color-bg)' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginBottom: 6 }}>
                            miembros {t.miembros.join(', ')} · {t.tipo === 'voladizo' ? 'voladizo: flecha del extremo libre respecto al apoyo, límites al doble' : 'flecha respecto a la cuerda entre sus apoyos'}
                          </div>
                          <Detalle r={r} />
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
            {filas.length > 400 && <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', padding: 8 }}>… y {filas.length - 400} más: filtra por sección o busca un miembro.</div>}
          </div>

          <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', lineHeight: 1.6 }}>
            Inmediata = elástica de RAM × IRAM/Ie, con Ie de Branson y la sección agrietada con el armado del proyecto (corridas y puntuales);
            en tramos continuos Ie = (Ie1 + Ie2 + 2·Ie3)/4. Diferida = λ × inmediata sostenida, λ = 2/(1 + 50ρ′) (4/(1 + 50ρ′) en clase 2).
            Supone que RAM usó el Ec de la NTC para el f′c de la sección. Las secciones que el proyecto no tiene se muestran con la elástica de RAM, sin agrietar.
          </div>
        </>
      )}
    </div>
  )
}

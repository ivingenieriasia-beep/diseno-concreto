import { useEffect, useMemo, useRef, useState } from 'react'
import { parseModeloRam } from '../core/ramModel'
import { modeloGuardado, hace } from '../core/ramSync'
import { inventario, proponerAgrupacion, verificarGrupo } from '../core/agrupacion'
import { generarAplicarAgrupacion } from '../core/ramScript'

// Agrupación: de un modelo sin agrupar a unas pocas T. Tres propuestas con su
// sección, su armado verificado y el script para aplicarlas en RAM.

const ANCHOS = [15, 20, 25]
const pct = (v) => `${Math.round(v * 100)} %`
const m3 = (v) => `${v.toFixed(2)} m³`

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

export default function AgrupacionView({ onToast }) {
  const [fuente, setFuente] = useState(null)       // { archivo, at, R }
  const [aviso, setAviso] = useState('')
  const [elegidos, setElegidos] = useState(null)   // Set de grupos a agrupar
  const [anchos, setAnchos] = useState(ANCHOS)
  const [verif, setVerif] = useState({})           // `${propuesta}|${grupo}` → resultado de la Fase 1
  const [elegida, setElegida] = useState('equilibrada')
  const archivoRef = useRef(null)

  const usar = (texto, archivo, at = Date.now()) => {
    const R = parseModeloRam(texto, archivo)
    if (!R.ok) { setAviso(R.warnings[0] || 'No se pudo leer el modelo.'); return }
    setAviso('')
    setFuente({ archivo, at, R })
    setElegidos(new Set(inventario(R).filter((g) => g.sugerido).map((g) => g.nombre)))
    setVerif({})
  }

  // el último modelo sincronizado (Reportes de RAM lo deja guardado)
  useEffect(() => {
    modeloGuardado().then((m) => { if (m?.datos) usar(m.datos, m.archivo || 'modelo.json', m.at) })
  }, [])

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

  const cargarArchivo = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) usar(await f.text(), f.name, f.lastModified)
  }

  const bajar = () => {
    const P = A?.propuestas.find((p) => p.id === elegida)
    if (!P) return
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
        <Paso n="2" titulo="Tres propuestas"
          extra={`${A.elementos.length} trabes continuas · hoy ${A.hoy.grupos} grupos, ${m3(A.hoy.concreto)} · sin juntar nada serían ${A.natural.grupos.length} grupos, ${m3(A.natural.concreto)}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 10 }}>
            {A.propuestas.map((P) => {
              const vs = P.grupos.map((g) => verif[`${P.id}|${g.nombre}`])
              const listos = vs.filter(Boolean).length
              const malos = vs.filter((v) => v && v.estado !== 'ok').length
              const kg = vs.reduce((s, v) => s + (v?.kg || 0), 0)
              const dC = A.hoy.concreto > 0 ? (P.concreto - A.hoy.concreto) / A.hoy.concreto : 0
              const activa = elegida === P.id
              return (
                <div key={P.id} data-testid={`agr-propuesta-${P.id}`} onClick={() => setElegida(P.id)} style={{
                  border: `2px solid ${activa ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                  background: activa ? 'var(--color-bg)' : 'var(--color-panel)',
                }}>
                  <b style={{ fontSize: 13 }}>{P.nombre}</b>
                  <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginTop: 1 }}>
                    sube una clase de sección si su trabe más cargada aprovecharía la mayor al {pct(P.tau)}
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    <span data-testid={`agr-ngrupos-${P.id}`}><b style={{ fontSize: 18 }}>{P.grupos.length}</b> grupos</span>
                    <span>{m3(P.concreto)} <span style={{ color: dC > 0 ? '#92400e' : '#15803d' }}>({dC >= 0 ? '+' : ''}{Math.round(dC * 100)} % vs hoy)</span></span>
                    <span>{listos === vs.length ? `${kg.toFixed(0)} kg` : `verificando ${listos}/${vs.length}…`}</span>
                  </div>
                  <div data-testid={`agr-estado-${P.id}`} style={{ fontSize: 11, marginTop: 3, color: listos < vs.length ? 'var(--color-tx3)' : malos ? '#c62828' : '#15803d' }}>
                    {listos < vs.length ? 'armando cada grupo con la Fase 1…' : malos ? `✗ ${malos} grupo(s) a revisar` : '✓ todos los grupos pasan con su armado propuesto'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', columnGap: 8, rowGap: 3, marginTop: 8, fontSize: 11, alignItems: 'baseline' }}>
                    {P.grupos.map((g) => {
                      const v = verif[`${P.id}|${g.nombre}`]
                      return [
                        <b key={`${g.nombre}n`} style={{ color: v ? (v.estado === 'ok' ? '#15803d' : '#c62828') : 'inherit' }}>{v ? (v.estado === 'ok' ? '✓' : '✗') : '·'} {g.nombre}</b>,
                        <span key={`${g.nombre}s`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{g.sec.nombre.replace(' X ', '×')}{g.fuera ? ' ⚠' : ''}</span>,
                        <span key={`${g.nombre}c`} style={{ color: 'var(--color-tx3)' }}>{g.elems.length} trabe(s) · {g.miembros.length} miembros</span>,
                        <span key={`${g.nombre}u`} style={{ color: 'var(--color-tx3)' }} title={v?.texto || ''}>
                          aprovechamiento {pct(g.uMin)}–{pct(g.uMax)}
                          {v?.motivos?.length ? <span style={{ color: '#c62828' }}> · {v.motivos[0]}</span> : null}
                          {g.fuera ? <span style={{ color: '#c62828' }}> · ninguna del catálogo alcanza</span> : null}
                        </span>,
                      ]
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          {A.noHorizontales > 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginTop: 8 }}>
              {A.noHorizontales} miembro(s) de esos grupos no son horizontales: no se agrupan y se quedan como están.
            </div>
          )}
        </Paso>
      )}

      {A && (
        <Paso n="3" titulo="Aplicarla en RAM">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11.5 }}>
            <button className="btn btn-primary" data-testid="agr-bajar" onClick={bajar}>
              ⬇ aplicar_agrupacion.py — {A.propuestas.find((p) => p.id === elegida)?.nombre}
            </button>
            <span style={{ color: 'var(--color-tx2)', lineHeight: 1.6, flex: '1 1 420px' }}>
              Pone a cada miembro su T y su sección. Antes comprueba que las secciones existan en RAM
              (si no, corre <b>instalar_catalogo.py</b>) y deja en tu Escritorio un <b>«Deshacer agrupación»</b>.
              En RAM: <b>Abrir Script… → Ctrl+R</b>; luego reanaliza y sincroniza.
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--color-tx3)', marginTop: 8, lineHeight: 1.6 }}>
            Dimensiona con el momento a ½ ρ balanceada y el cortante con estribos #2.5 a no menos de 8 cm; el armado de cada
            grupo lo da la Fase 1 con los mismos motores de Longitudinal. No revisa deflexiones: ésas las dirá RAM al reanalizar.
          </div>
        </Paso>
      )}
    </div>
  )
}

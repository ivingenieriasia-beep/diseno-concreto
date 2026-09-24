import { useState } from 'react'

// Lo que se revisa del cimiento: el veredicto, cada revisión con su
// aprovechamiento, los avisos y la memoria paso a paso (fórmula, sustitución
// y resultado), que es la misma que va al PDF y al Word.

const fmt = (v, u) => {
  if (typeof v !== 'number') return v ?? ''
  if (!Number.isFinite(v)) return '∞'
  const a = Math.abs(v)
  const d = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : 3
  return `${v.toFixed(d)}${u ? ` ${u}` : ''}`
}

export function Barra({ u, ok }) {
  const w = Math.min(1, Number.isFinite(u) ? u : 1)
  const c = !ok ? '#c62828' : u > 0.95 ? '#d97706' : u > 0.8 ? '#65a30d' : '#15803d'
  return (
    <span className="cim-barra"><span style={{ width: `${Math.max(2, w * 100)}%`, background: c }} /></span>
  )
}

export default function CimRevisiones({ R }) {
  const grupos = []
  for (const c of R.checks) {
    let g = grupos.find((x) => x.g === (c.grupo || ''))
    if (!g) grupos.push(g = { g: c.grupo || '', items: [] })
    g.items.push(c)
  }
  const nMal = R.checks.filter((c) => !c.ok).length
  const cant = R.cant || {}
  return (
    <div className="cim-rev" data-testid="cim-revisiones">
      <div className={`cim-veredicto ${R.ok ? 'ok' : 'mal'}`} data-testid="cim-veredicto">
        <b>{R.ok ? '✓ Cumple' : `✗ No cumple (${nMal})`}</b>
        <span>{R.resumen}</span>
      </div>
      {R.avisos?.length > 0 && (
        <ul className="cim-avisos" data-testid="cim-avisos">{R.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
      )}
      {grupos.map((g) => (
        <div key={g.g} className="cim-grupo">
          {g.g && <div className="cim-grupo-t">{g.g}</div>}
          {g.items.map((c) => (
            <div key={c.id} className={`cim-check-fila ${c.ok ? '' : 'mal'}`} data-testid={`cim-check-${c.id}`} title={c.nota}>
              <span className="cim-check-t">{c.ok ? '✓' : '✗'} {c.titulo}</span>
              <Barra u={c.u} ok={c.ok} />
              <span className="cim-check-v">{Number.isFinite(c.u) ? `${Math.round(c.u * 100)} %` : '—'}</span>
              <span className="cim-check-n">{c.unidad === 'FS' ? c.nota : `${fmt(c.act)} / ${fmt(c.res)} ${c.unidad}`}{c.unidad !== 'FS' && c.nota ? ` · ${c.nota}` : ''}</span>
            </div>
          ))}
        </div>
      ))}
      {(cant.concreto || cant.mamposteria) && (
        <div className="cim-cant" data-testid="cim-cant">
          {cant.concreto != null && <span>concreto <b>{fmt(cant.concreto, 'm³')}</b></span>}
          {cant.acero != null && <span>acero <b>{fmt(cant.acero, 'kg')}</b></span>}
          {cant.mamposteria != null && <span>mampostería <b>{fmt(cant.mamposteria, 'm³')}</b></span>}
          {cant.piedra != null && <span>piedra <b>{fmt(cant.piedra, 'm³')}</b></span>}
          {cant.mortero != null && <span>mortero <b>{fmt(cant.mortero, 'm³')}</b></span>}
          {cant.excavacion != null && <span>excavación <b>{fmt(cant.excavacion, 'm³')}</b></span>}
        </div>
      )}
    </div>
  )
}

export function CimMemoria({ R }) {
  const [abiertas, setAbiertas] = useState(() => new Set())
  const todas = abiertas.size === R.secciones.length
  return (
    <div className="cim-memoria" data-testid="cim-memoria">
      <div className="cim-memoria-cab">
        <b>Memoria paso a paso</b>
        <span>la misma que va al PDF y a la Memoria de cálculo</span>
        <button className="cim-mini" onClick={() => setAbiertas(todas ? new Set() : new Set(R.secciones.map((_, i) => i)))}>{todas ? 'cerrar todo' : 'abrir todo'}</button>
      </div>
      {R.secciones.map((s, i) => {
        const a = abiertas.has(i)
        const mal = s.pasos.some((p) => p.ok === false)
        return (
          <section key={s.titulo + i} className={`cim-mem-sec ${mal ? 'mal' : ''}`}>
            <header onClick={() => { const n = new Set(abiertas); if (a) n.delete(i); else n.add(i); setAbiertas(n) }}>
              <span>{a ? '▾' : '▸'}</span> {s.titulo} {mal && <b className="cim-mem-mal">no cumple</b>}
            </header>
            {a && (
              <table>
                <tbody>
                  {s.pasos.map((p, j) => (
                    <tr key={j} className={p.ok === false ? 'mal' : p.ok ? 'ok' : ''}>
                      <td className="t">{p.t}</td>
                      <td className="f">{p.f}</td>
                      <td className="n">{p.n}</td>
                      <td className="v">{fmt(p.v, p.u)}{p.ok != null && <span className="m">{p.ok ? ' ✓' : ' ✗'}</span>}{p.lim && <div className="l">{p.lim}</div>}{p.nota && <div className="l">{p.nota}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )
      })}
    </div>
  )
}

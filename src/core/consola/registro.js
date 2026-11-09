// ══════════════════════════════════════════════════════════════
// Registro de la consola: cada comando con su resultado, venga de la consola
// (alguien lo escribió) o de la API (window.auxiliarIV, el agente). Es lo que
// deja ver en vivo lo que hace el agente.
// ══════════════════════════════════════════════════════════════

import { create } from 'zustand'

const MAX = 300
const AUTO = 'auxiv.consola.autoabrir'

const leerAuto = () => { try { return localStorage.getItem(AUTO) !== '0' } catch { return true } }

let seq = 0

const useConsola = create((set, get) => ({
  entradas: [],          // [{ id, at, origen:'consola'|'api', linea, estado:'corriendo'|'ok'|'error', texto, ms }]
  abierta: false,
  noLeidas: 0,           // lo que llegó por la API con la consola cerrada
  autoAbrir: leerAuto(), // la consola se abre sola cuando el agente manda un comando

  /** Apunta un comando que empieza; devuelve su id */
  empezar: (linea, origen) => {
    const id = ++seq
    const e = { id, at: Date.now(), origen, linea, estado: 'corriendo', texto: '', ms: 0 }
    set((s) => {
      const abrir = origen === 'api' && s.autoAbrir
      return {
        entradas: [...s.entradas, e].slice(-MAX),
        abierta: s.abierta || abrir,
        noLeidas: s.abierta || abrir || origen !== 'api' ? s.noLeidas : s.noLeidas + 1,
      }
    })
    return id
  },

  terminar: (id, { ok, texto }) => set((s) => ({
    entradas: s.entradas.map((e) => (e.id === id ? { ...e, estado: ok ? 'ok' : 'error', texto, ms: Date.now() - e.at } : e)),
  })),

  limpiar: () => set({ entradas: [], noLeidas: 0 }),
  abrir: () => set({ abierta: true, noLeidas: 0 }),
  cerrar: () => set({ abierta: false }),
  alternar: () => (get().abierta ? get().cerrar() : get().abrir()),
  setAutoAbrir: (v) => {
    try { localStorage.setItem(AUTO, v ? '1' : '0') } catch { /* sin almacenamiento */ }
    set({ autoAbrir: !!v })
  },
}))

export default useConsola

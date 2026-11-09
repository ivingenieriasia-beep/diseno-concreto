// ══════════════════════════════════════════════════════════════
// Puente entre la consola y la pantalla. Lo que vive en App (la pestaña
// activa, abrir un módulo, los avisos y las exportaciones) se registra aquí
// en cada render, para que un comando haga lo mismo que el botón.
// ══════════════════════════════════════════════════════════════

let ui = {}

/** App registra sus acciones; un comando las usa con usarUI() */
export function registrarUI(acciones) {
  ui = { ...ui, ...acciones }
}

export const usarUI = () => ui

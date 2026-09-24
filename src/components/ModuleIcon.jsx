// Íconos de los módulos: trazo simple, heredan el color del contenedor.
const PATHS = {
  cimiento: (
    <>
      <path d="M10 3h4v8h-4z" />
      <path d="M4 11h16v5H4z" />
      <path d="M2 20h20" />
      <path d="M6 18.5l-1.5 1.5M11 18.5l-1.5 1.5M16 18.5l-1.5 1.5M21 18.5l-1.5 1.5" />
    </>
  ),
  capas: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 17.5l9 5 9-5" />
    </>
  ),
  alzado: (
    <>
      <path d="M3 7h18" />
      <path d="M3 17h18" />
      <path d="M6 7v10M18 7v10" />
      <path d="M9 12h6" />
    </>
  ),
  base: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
      <path d="M4 11.5v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </>
  ),
  check: (
    <>
      <path d="M1 12l4 4L13 6" />
      <path d="M11 16l4 4L23 8" />
    </>
  ),
  malla: (
    <>
      <path d="M3 3h18v18H3z" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  flecha: (
    <>
      <path d="M3 7c4 7 14 7 18 0" />
      <path d="M3 7l-1.5 3h3z" />
      <path d="M21 7l-1.5 3h3z" />
      <path d="M12 14v5M10 17l2 2 2-2" />
    </>
  ),
  grupos: (
    <>
      <path d="M3 5h18" strokeWidth="3" />
      <path d="M3 12h12" strokeWidth="2.2" />
      <path d="M3 19h7" />
    </>
  ),
}

export default function ModuleIcon({ nombre, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[nombre] || PATHS.capas}
    </svg>
  )
}

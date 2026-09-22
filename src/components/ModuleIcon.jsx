// Íconos de los módulos: trazo simple, heredan el color del contenedor.
const PATHS = {
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
}

export default function ModuleIcon({ nombre, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[nombre] || PATHS.capas}
    </svg>
  )
}

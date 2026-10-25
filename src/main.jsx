import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ESTILO_APP } from '#marca-extra'

// Tipografías de la marca SOGRUB (con IV no hay nada que poner)
if (ESTILO_APP) {
  const st = document.createElement('style')
  st.id = 'marca-estilo'
  st.textContent = ESTILO_APP
  document.head.appendChild(st)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

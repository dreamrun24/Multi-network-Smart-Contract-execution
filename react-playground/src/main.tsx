import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TabbedApp from './TabbedApp'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <TabbedApp />
  </StrictMode>,
)

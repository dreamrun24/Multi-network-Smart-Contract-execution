/*
 Multi Network Smart Contract Studio – main.tsx
 Purpose: Entry point that mounts the React app into the DOM.
 What’s important:
 - This is where we render the top-level App component.
 - Vite handles bundling; index.html contains the root element.
*/
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TabbedApp from './TabbedApp'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <TabbedApp />
  </StrictMode>,
)

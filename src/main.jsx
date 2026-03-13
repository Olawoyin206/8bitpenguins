import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'

const App = lazy(() => import('./App.jsx'))
const Mint = lazy(() => import('./Mint.jsx'))
const ThreeGenerator = lazy(() => import('./ThreeGenerator.jsx'))
const Task = lazy(() => import('./Task.jsx'))
const Evolve = lazy(() => import('./Evolve.jsx'))
const Admin = lazy(() => import('./Admin.jsx'))
const PlayToWL = lazy(() => import('./PlayToWL.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d1117' }} />}>
        <Routes>
          <Route path="/" element={<Task />} />
          <Route path="/generate" element={<App />} />
          <Route path="/mint" element={<Mint />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/evolve" element={<Evolve />} />
          <Route path="/3d" element={<ThreeGenerator />} />
          <Route path="/play-to-wl" element={<PlayToWL />} />
        </Routes>
      </Suspense>
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)

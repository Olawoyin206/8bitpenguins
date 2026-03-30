import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Error404 from './Error404.jsx'
import './index.css'
import './Button.css'

const App = lazy(() => import('./App.jsx'))
const Mint = lazy(() => import('./Mint.jsx'))
const ThreeGenerator = lazy(() => import('./ThreeGenerator.jsx'))
const Task = lazy(() => import('./Task.jsx'))
const Evolve = lazy(() => import('./Evolve.jsx'))
const Admin = lazy(() => import('./Admin.jsx'))
const PlayToWL = lazy(() => import('./PlayToWL.jsx'))
const LOCK_NON_TASK_PAGES = import.meta.env.PROD

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d1117' }} />}>
        <Routes>
          <Route path="/" element={<Task />} />
          <Route path="/task" element={<Task />} />
          {LOCK_NON_TASK_PAGES ? (
            <>
              <Route path="/generate" element={<Error404 />} />
              <Route path="/mint" element={<Error404 />} />
              <Route path="/admin" element={<Error404 />} />
              <Route path="/evolve" element={<Error404 />} />
              <Route path="/3d" element={<Error404 />} />
              <Route path="/play-to-wl" element={<PlayToWL />} />
            </>
          ) : (
            <>
              <Route path="/generate" element={<App />} />
              <Route path="/mint" element={<Mint />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/evolve" element={<Evolve />} />
              <Route path="/3d" element={<ThreeGenerator />} />
              <Route path="/play-to-wl" element={<PlayToWL />} />
            </>
          )}
          <Route path="*" element={<Error404 />} />
        </Routes>
      </Suspense>
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)

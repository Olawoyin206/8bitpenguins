import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Error404 from './pages/Error404.jsx'
import GlobalFooter from './components/GlobalFooter.jsx'
import { applyStorageSchemaMigration } from './storageSchema.js'
import { SNAPSHOT_LOCK_ENABLED } from './snapshotLockConfig.js'
import './index.css'
import './Button.css'

const loadApp = () => import('./pages/App.jsx')
const loadMint = () => import('./pages/Mint.jsx')
const loadThreeGenerator = () => import('./pages/ThreeGenerator.jsx')
const loadTask = () => import('./pages/Task.jsx')
const loadEvolve = () => import('./pages/Evolve.jsx')
const loadAdmin = () => import('./pages/Admin.jsx')
const loadPlayToWL = () => import('./pages/PlayToWL.jsx')
const loadWalletChecker = () => import('./pages/WalletChecker.jsx')
const loadSnapshotLocked = () => import('./pages/SnapshotLocked.jsx')
const App = lazy(loadApp)
const Mint = lazy(loadMint)
const ThreeGenerator = lazy(loadThreeGenerator)
const Task = lazy(loadTask)
const Evolve = lazy(loadEvolve)
const Admin = lazy(loadAdmin)
const PlayToWL = lazy(loadPlayToWL)
const WalletChecker = lazy(loadWalletChecker)
const SnapshotLocked = lazy(loadSnapshotLocked)
const isProductionBuild = Boolean(import.meta?.env?.PROD)
const showTestingRoutesInDev = Boolean(import.meta?.env?.DEV)
const taskRouteElement = SNAPSHOT_LOCK_ENABLED ? <SnapshotLocked pageLabel="Tasks" /> : <Task />
const playToWlRouteElement = SNAPSHOT_LOCK_ENABLED ? <SnapshotLocked pageLabel="Play To WL" /> : <PlayToWL />

applyStorageSchemaMigration()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <div className="app-root-shell">
        <div className="app-route-shell">
          <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d1117' }} />}>
            <Routes>
              <Route path="/" element={taskRouteElement} />
              <Route path="/task" element={taskRouteElement} />
              <Route path="/generate" element={<App />} />
              <Route path="/mint" element={<Mint />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/evolve" element={<Evolve />} />
              {(isProductionBuild || showTestingRoutesInDev) && <Route path="/testingmint" element={<Mint />} />}
              {(isProductionBuild || showTestingRoutesInDev) && <Route path="/testingadmin" element={<Admin />} />}
              {(isProductionBuild || showTestingRoutesInDev) && <Route path="/testingevolve" element={<Evolve />} />}
              <Route path="/3d" element={<ThreeGenerator />} />
              {showTestingRoutesInDev && <Route path="/testing3d" element={<ThreeGenerator />} />}
              <Route path="/wallet-checker" element={<WalletChecker />} />
              <Route path="/play-to-wl" element={playToWlRouteElement} />
              <Route path="*" element={<Error404 />} />
            </Routes>
          </Suspense>
        </div>
        <GlobalFooter />
        <Analytics />
      </div>
    </BrowserRouter>
  </StrictMode>,
)

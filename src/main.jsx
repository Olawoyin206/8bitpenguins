import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.jsx'
import Mint from './Mint.jsx'
import ThreeGenerator from './ThreeGenerator.jsx'
import Task from './Task.jsx'
import Evolve from './Evolve.jsx'
import Admin from './Admin.jsx'
import PlayToWL from './PlayToWL.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Task />} />
        <Route path="/generate" element={<App />} />
        <Route path="/mint" element={<Mint />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/evolve" element={<Evolve />} />
        <Route path="/3d" element={<ThreeGenerator />} />
        <Route path="/play-to-wl" element={<PlayToWL />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)

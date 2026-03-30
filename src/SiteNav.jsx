import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './SiteNav.css'

const DEV_NAV_ITEMS = [
  { to: '/', label: 'Tasks' },
  { to: '/generate', label: 'Generate' },
  { to: '/play-to-wl', label: 'Play To WL' },
]
const PROD_NAV_ITEMS = [
  { to: '/', label: 'Tasks' },
  { to: '/play-to-wl', label: 'Play To WL' },
]
const NAV_ITEMS = import.meta.env.PROD ? PROD_NAV_ITEMS : DEV_NAV_ITEMS

function SiteNav({ label = '' }) {
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  return (
    <nav className={`site-nav${isMenuOpen ? ' is-open' : ''}`} aria-label="Primary">
      <div className="site-nav-topbar">
        <div className="site-nav-brand-wrap">
          <NavLink to="/" className="site-nav-brand" onClick={() => setIsMenuOpen(false)}>
            8bit Penguins
          </NavLink>
          {label ? <span className="site-nav-label">{label}</span> : null}
        </div>

        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="site-nav-links"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div id="site-nav-links" className="site-nav-links">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setIsMenuOpen(false)}
            className={({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default SiteNav

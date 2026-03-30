import SiteNav from './SiteNav.jsx'

export default function Error404() {
  return (
    <div
      className="app-page"
      style={{
        minHeight: '100vh',
        background: '#0d1117',
        color: '#f0f6fc',
        padding: '24px',
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <SiteNav label="Page Not Found" />
      <main
        style={{
          minHeight: 'calc(100vh - 140px)',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '0.08em' }}>404</div>
          <div style={{ fontSize: '0.85rem', color: '#8b949e', textTransform: 'uppercase' }}>
            Page Not Found
          </div>
        </div>
      </main>
    </div>
  )
}

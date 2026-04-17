import SiteNav from '../components/SiteNav.jsx'
import {
  SNAPSHOT_LOCK_NOTE,
  SNAPSHOT_LOCK_TITLE,
} from '../snapshotLockConfig.js'
import '../SnapshotLocked.css'

function SnapshotLocked({ pageLabel = 'Locked' }) {
  const pageName = String(pageLabel || 'Page').trim() || 'Page'

  return (
    <div className="snapshot-locked-page">
      <div className="snapshot-locked-shell">
        <SiteNav label={`${pageLabel} Locked`} />
        <main className="snapshot-locked-main">
          <section className="snapshot-locked-card">
            <span className="snapshot-locked-kicker">Access Paused</span>
            <h1>{SNAPSHOT_LOCK_TITLE}</h1>
            <p>{`${pageName} snapshot has been taken.`}</p>
            <p className="snapshot-locked-note">{SNAPSHOT_LOCK_NOTE}</p>
            <div className="snapshot-locked-actions">
              <a className="snapshot-locked-btn snapshot-locked-btn-primary" href="/generate">
                Go To Generate
              </a>
              <a
                className="snapshot-locked-btn"
                href="https://x.com/8bitspenguins_"
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit X
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default SnapshotLocked

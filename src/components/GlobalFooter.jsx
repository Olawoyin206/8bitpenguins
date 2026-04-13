function GlobalFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="global-footer" role="contentinfo">
      <div className="global-footer-inner">
        <span className="global-footer-brand">8bit Penguins</span>
        <span className="global-footer-sep">|</span>
        <span className="global-footer-copy">{`© ${currentYear} All rights reserved`}</span>
      </div>
    </footer>
  )
}

export default GlobalFooter

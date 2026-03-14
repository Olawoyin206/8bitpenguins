import Button from './Button.jsx'

function ConnectedWallet({
  label = '',
  address,
  badge,
  badgeClassName = '',
  onDisconnect,
  disconnectLabel = 'Disconnect',
  className = '',
}) {
  return (
    <div className={`mint-connected ${className}`.trim()}>
      <div className="mint-wallet">
        <div className="mint-wallet-main">
          {label ? <span className="mint-wallet-kicker">{label}</span> : null}
          <div className="mint-wallet-tags">
            <button className="mint-wallet-addr-btn" disabled>
              {address}
            </button>
            {badge ? <span className={`mint-wallet-bal ${badgeClassName}`.trim()}>{badge}</span> : null}
          </div>
        </div>
        <Button className="mint-disconnect-btn" variant="secondary" size="sm" onClick={onDisconnect}>
          {disconnectLabel}
        </Button>
      </div>
    </div>
  )
}

export default ConnectedWallet

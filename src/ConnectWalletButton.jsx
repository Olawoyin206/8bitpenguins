import Button from './Button.jsx'

function ConnectWalletButton({
  label = 'Connect Wallet',
  onClick,
  className = '',
  variant = 'primary',
  size = 'md',
  block = false,
}) {
  return (
    <Button
      className={`mint-connect-btn ${className}`.trim()}
      variant={variant}
      size={size}
      block={block}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

export default ConnectWalletButton

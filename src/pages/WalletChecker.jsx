import { useCallback, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import SiteNav from '../components/SiteNav.jsx'
import Button from '../components/Button.jsx'
import StatusNotice from '../components/StatusNotice.jsx'
import '../WalletChecker.css'
import { CONTRACT_ADDRESS } from '../contractConfig.js'
import { getSharedReadProvider, resilientRpcCall } from '../readProvider.js'

const WALLET_CHECKER_ABI = [
  'function phaseCount() view returns (uint256)',
  'function getPhase(uint256 phaseId) view returns (string name, uint256 price, uint256 startTime, uint256 endTime, uint256 maxSupply, uint256 maxPerWallet, uint256 minted, bool enabled)',
  'function phaseWhitelistCount(uint256 phaseId) view returns (uint256)',
  'function isPhaseWhitelisted(uint256 phaseId, address account) view returns (bool)',
]

function normalizeAddress(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  try {
    return ethers.getAddress(trimmed)
  } catch {
    return ''
  }
}

function parsePhaseName(name, fallback) {
  const raw = String(name || '').trim()
  if (!raw) return fallback
  const parts = raw.split('::').map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) return raw
  return `${parts[0]} - ${parts.slice(1).join(' / ')}`
}

function formatWalletCheckerError(error) {
  const raw = String(error?.shortMessage || error?.message || 'Unknown error')
    .replace(/^execution reverted:?\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
  if (!raw) return 'Eligibility check failed. Please try again.'
  if (/network|rpc|timeout|rate limit|too many requests|quota/i.test(raw)) {
    return 'Eligibility check failed due to RPC/network limits. Please try again shortly.'
  }
  return `Eligibility check failed: ${raw}`
}

function WalletChecker() {
  const provider = useMemo(() => getSharedReadProvider(), [])
  const contract = useMemo(() => new ethers.Contract(CONTRACT_ADDRESS, WALLET_CHECKER_ABI, provider), [provider])

  const [walletInput, setWalletInput] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const safeRead = useCallback(async (call, fallback) => {
    return resilientRpcCall(call, {
      timeoutMs: 12000,
      retries: 2,
      fallback,
    })
  }, [])

  const checkWallet = useCallback(async () => {
    const wallet = normalizeAddress(walletInput)
    if (!wallet) {
      setError('Enter a valid wallet address.')
      setResult(null)
      return
    }

    setIsChecking(true)
    setError('')
    const unsupported = Symbol('unsupported')

    try {
      const phaseCountRaw = await safeRead(() => contract.phaseCount(), unsupported)
      if (phaseCountRaw === unsupported) {
        setError('Phase checker is not available on this contract.')
        setResult(null)
        return
      }

      const phaseCount = Number(phaseCountRaw || 0)
      const eligiblePhases = []

      for (let i = 0; i < phaseCount; i += 1) {
        const phaseRaw = await safeRead(() => contract.getPhase(i), unsupported)
        if (phaseRaw === unsupported) continue

        const enabled = Boolean(phaseRaw[7])
        if (!enabled) continue

        const whitelistCount = Number(await safeRead(() => contract.phaseWhitelistCount(i), 0n) || 0)
        const requiresWhitelist = whitelistCount > 0
        const whitelisted = requiresWhitelist
          ? Boolean(await safeRead(() => contract.isPhaseWhitelisted(i, wallet), false))
          : true

        if (whitelisted) {
          eligiblePhases.push({
            id: i,
            name: parsePhaseName(phaseRaw[0], `Phase ${i + 1}`),
          })
        }
      }

      setResult({
        eligible: eligiblePhases.length > 0,
        phases: eligiblePhases,
      })
    } catch (error) {
      setError(formatWalletCheckerError(error))
      setResult(null)
    } finally {
      setIsChecking(false)
    }
  }, [contract, safeRead, walletInput])

  return (
    <div className="wallet-checker-page">
      <SiteNav label="Wallet Checker" />

      <main className="wallet-checker-main">
        <section className="wallet-checker-panel">
          <div className="wallet-checker-head">
            <h1>Wallet Eligibility Checker</h1>
          </div>

          <div className="wallet-checker-form">
            <label htmlFor="wallet-checker-input" className="wallet-checker-label">Wallet Address</label>
            <div className="wallet-checker-form-row">
              <input
                id="wallet-checker-input"
                type="text"
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isChecking) {
                    e.preventDefault()
                    checkWallet()
                  }
                }}
              />
              <Button variant="primary" size="md" onClick={checkWallet} disabled={isChecking}>
                {isChecking ? 'Checking...' : 'Check'}
              </Button>
            </div>
          </div>

          {error ? (
            <StatusNotice
              message={error}
              tone="error"
              className="wallet-checker-status"
            />
          ) : null}

          {result ? (
            <section className="wallet-checker-result">
              <div className="wallet-checker-result-head">
                <p className={`wallet-checker-eligibility ${result.eligible ? 'yes' : 'no'}`}>
                  <strong>Eligible:</strong>{' '}
                  <span>{result.eligible ? 'YES' : 'NO'}</span>
                </p>
                <span className="wallet-checker-phase-count">{result.phases.length} phase(s)</span>
              </div>
              <div className="wallet-checker-phases-block">
                <strong className="wallet-checker-phases-title">Eligible Phases</strong>
                {result.phases.length === 0 ? (
                  <p className="wallet-checker-none">No eligible phases.</p>
                ) : (
                  <ul className="wallet-checker-phase-list">
                    {result.phases.map((phase, index) => (
                      <li className="wallet-checker-phase-row" key={`wallet-phase-${phase.id}`}>
                        <div className="wallet-checker-phase-top">
                          <span className="wallet-checker-phase-index">{index + 1}</span>
                          <span className="wallet-checker-phase-tag">Eligible</span>
                        </div>
                        <span className="wallet-checker-phase-name">{phase.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : (
            <p className="wallet-checker-placeholder">Enter a wallet address to check phase eligibility.</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default WalletChecker

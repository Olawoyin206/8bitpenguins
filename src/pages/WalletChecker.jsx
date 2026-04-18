import { useCallback, useState } from 'react'
import { ethers } from 'ethers'
import SiteNav from '../components/SiteNav.jsx'
import Button from '../components/Button.jsx'
import StatusNotice from '../components/StatusNotice.jsx'
import '../WalletChecker.css'
import { CONTRACT_ADDRESS, MINT_GATE_ADDRESS } from '../contractConfig.js'

const WHITELIST_PROOF_API_PATH = '/api/whitelist-proof'

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

async function requestWhitelistEligibilityBatch({ wallet, contractAddress }) {
  const params = new URLSearchParams({
    wallet: String(wallet || ''),
    checkOnly: '1',
    allPhases: '1',
    scope: 'all',
    phaseId: '0',
  })
  if (contractAddress) {
    params.set('contract', String(contractAddress))
  }

  const response = await fetch(`${WHITELIST_PROOF_API_PATH}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    const message = String(payload?.error || 'Whitelist proof check failed')
    const requestError = new Error(message)
    requestError.status = response.status
    throw requestError
  }
  return payload
}

function WalletChecker() {
  const mintGateAddress = normalizeAddress(MINT_GATE_ADDRESS)
  const phaseContractAddress = mintGateAddress || normalizeAddress(CONTRACT_ADDRESS)

  const [walletInput, setWalletInput] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const checkWallet = useCallback(async () => {
    if (!phaseContractAddress) {
      setError('Contract address is not configured.')
      setResult(null)
      return
    }

    const wallet = normalizeAddress(walletInput)
    if (!wallet) {
      setError('Enter a valid wallet address.')
      setResult(null)
      return
    }

    setIsChecking(true)
    setError('')

    try {
      const payload = await requestWhitelistEligibilityBatch({
        wallet,
        contractAddress: phaseContractAddress,
      })
      const phases = Array.isArray(payload?.phases) ? payload.phases : []
      const matchedPhases = []

      for (const phase of phases) {
        const phaseId = Number(phase?.phaseId)
        const enabled = Boolean(phase?.enabled)
        const required = Boolean(phase?.required)
        const eligible = Boolean(phase?.eligible)
        const maxAllowance = Number(phase?.maxAllowance || 0)
        if (!enabled || !required || !eligible || maxAllowance <= 0 || !Number.isInteger(phaseId) || phaseId < 0) {
          continue
        }

        matchedPhases.push({
          id: phaseId,
          name: parsePhaseName(phase?.phaseName, `Phase ${phaseId + 1}`),
          accessSource: 'offchain-signature',
          maxAllowance,
        })
      }

      if (matchedPhases.length === 0 && Boolean(payload?.partial)) {
        setError('Whitelist checker could not verify all phases due RPC/API issues. Please retry.')
      }

      setResult({
        matched: matchedPhases.length > 0,
        phases: matchedPhases,
      })
    } catch (requestError) {
      setError(formatWalletCheckerError(requestError))
      setResult(null)
    } finally {
      setIsChecking(false)
    }
  }, [phaseContractAddress, walletInput])

  return (
    <div className="wallet-checker-page">
      <SiteNav label="Wallet Checker" />

      <main className="wallet-checker-main">
        <section className="wallet-checker-panel">
          <div className="wallet-checker-head">
            <h1>Wallet Whitelist Checker</h1>
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
                <p className={`wallet-checker-eligibility ${result.matched ? 'yes' : 'no'}`}>
                  <strong>Appears In Whitelist:</strong>{' '}
                  <span>{result.matched ? 'YES' : 'NO'}</span>
                </p>
                <span className="wallet-checker-phase-count">{result.phases.length} phase(s)</span>
              </div>
              <p className="wallet-checker-contract">
                Checked contract: {phaseContractAddress}
              </p>
              <div className="wallet-checker-phases-block">
                <strong className="wallet-checker-phases-title">Whitelist Phases</strong>
                {result.phases.length === 0 ? (
                  <p className="wallet-checker-none">Address does not appear in any whitelist phase.</p>
                ) : (
                  <ul className="wallet-checker-phase-list">
                    {result.phases.map((phase, index) => (
                      <li className="wallet-checker-phase-row" key={`wallet-phase-${phase.id}`}>
                        <div className="wallet-checker-phase-top">
                          <span className="wallet-checker-phase-index">{index + 1}</span>
                        </div>
                        <span className="wallet-checker-phase-name">{phase.name}</span>
                        <span className="wallet-checker-phase-meta">
                          {phase.accessSource === 'offchain-signature'
                            ? `Signed sheet whitelist${phase.maxAllowance > 0 ? ` - allowance ${phase.maxAllowance}` : ''}`
                            : 'Signed sheet whitelist'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : (
            <p className="wallet-checker-placeholder">Enter a wallet address to see which whitelist phase(s) it appears in.</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default WalletChecker

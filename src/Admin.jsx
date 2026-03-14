import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ethers } from 'ethers'
import * as XLSX from 'xlsx'
import SiteNav from './SiteNav.jsx'
import './Mint.css'
import { BLOCK_EXPLORER_URL, CHAIN_ID_HEX, CHAIN_NAME, CONTRACT_ADDRESS, ETH_SEPOLIA_RPC } from './contractConfig.js'
import contractABI from './abi/EightBitPenguinsUpgradeable.abi.js'
import {
  DEFAULT_TASK_PINNED_POST_LINK,
  getTaskPinnedPostLink,
  isValidPinnedPostLink,
  resetTaskPinnedPostLink,
  saveTaskPinnedPostLink,
} from './taskConfig.js'

function shortAddress(value) {
  if (!value) return 'Not set'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatEth(value) {
  try {
    return Number(ethers.formatEther(value)).toFixed(4)
  } catch {
    return '0.0000'
  }
}

function normalizeOnchainImage(image) {
  if (!image || typeof image !== 'string') return ''
  if (image.startsWith('data:image/')) return image
  if (image.startsWith('<svg')) return `data:image/svg+xml;utf8,${encodeURIComponent(image)}`
  if (image.startsWith('ipfs://')) return image.replace('ipfs://', 'https://ipfs.io/ipfs/')
  return image
}

function parseMetadata(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return {
      name: parsed.name || '',
      image: normalizeOnchainImage(parsed.image || ''),
      attributes: Array.isArray(parsed.attributes) ? parsed.attributes : [],
      revealed: parsed.revealed,
      evolved3D: parsed.evolved_3d,
    }
  } catch {
    return null
  }
}

function toDatetimeLocal(timestamp) {
  if (!timestamp) return ''
  const date = new Date(Number(timestamp) * 1000)
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function fromDatetimeLocal(value) {
  if (!value) return 0
  return Math.floor(new Date(value).getTime() / 1000)
}

function phaseWindowLabel(phase) {
  const start = phase.startTime ? new Date(phase.startTime * 1000).toLocaleString() : 'Immediate'
  const end = phase.endTime ? new Date(phase.endTime * 1000).toLocaleString() : 'Open ended'
  return `${start} to ${end}`
}

function notifyContractUpdated(source = 'admin') {
  const payload = { ts: Date.now(), source }
  try {
    localStorage.setItem('penguin:contract-updated', JSON.stringify(payload))
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('penguin:contract-updated', { detail: payload }))
  } catch {}
}

function FieldLabel({ label, children }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      {children}
    </label>
  )
}

function addMinutesToDatetimeLocal(value, minutes) {
  if (!value) return ''
  const base = new Date(value)
  if (Number.isNaN(base.getTime())) return ''
  base.setMinutes(base.getMinutes() + minutes)
  const offsetMs = base.getTimezoneOffset() * 60000
  return new Date(base.getTime() - offsetMs).toISOString().slice(0, 16)
}

function normalizeWhitelistAddress(value) {
  const trimmed = String(value || '').trim()
  return ethers.isAddress(trimmed) ? ethers.getAddress(trimmed) : null
}

function parseAddressList(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(/[\s,]+/)
        .map(normalizeWhitelistAddress)
        .filter(Boolean)
    )
  )
}

function analyzeAddressList(value) {
  const rawEntries = String(value || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const normalized = []
  const invalid = []
  const duplicate = []
  const seen = new Set()

  rawEntries.forEach((entry) => {
    const parsed = normalizeWhitelistAddress(entry)
    if (!parsed) {
      invalid.push(entry)
      return
    }
    if (seen.has(parsed)) {
      duplicate.push(parsed)
      return
    }
    seen.add(parsed)
    normalized.push(parsed)
  })

  return {
    totalEntries: rawEntries.length,
    valid: normalized,
    invalid,
    duplicate,
  }
}

async function safeRead(call, fallback) {
  try {
    return await call()
  } catch {
    return fallback
  }
}

function Admin() {
  const rpcProvider = useMemo(() => new ethers.JsonRpcProvider(ETH_SEPOLIA_RPC), [])
  const [account, setAccount] = useState(null)
  const [owner, setOwner] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [status, setStatus] = useState('')
  const [lastTxHash, setLastTxHash] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [state, setState] = useState({
    totalSupply: 0,
    maxSupply: 0,
    maxPerWallet: 0,
    mintPriceEth: '0',
    mintActive: false,
    revealed: false,
    contractBalance: '0.0000',
    placeholderImage: '',
  })
  const [placeholderDraft, setPlaceholderDraft] = useState('')
  const [ownershipDraft, setOwnershipDraft] = useState('')
  const [globalPriceDraft, setGlobalPriceDraft] = useState('0')
  const [globalSupplyDraft, setGlobalSupplyDraft] = useState('0')
  const [globalWalletDraft, setGlobalWalletDraft] = useState('0')
  const [taskPinnedPostDraft, setTaskPinnedPostDraft] = useState(() => getTaskPinnedPostLink())
  const [tokenIdInput, setTokenIdInput] = useState('')
  const [tokenInspect, setTokenInspect] = useState(null)
  const [walletInspectInput, setWalletInspectInput] = useState('')
  const [walletInspect, setWalletInspect] = useState(null)
  const [loadingToken, setLoadingToken] = useState(false)
  const [phases, setPhases] = useState([])
  const [currentPhaseId, setCurrentPhaseId] = useState(null)
  const [supportsPhaseControls, setSupportsPhaseControls] = useState(false)
  const [supportsGlobalSetters, setSupportsGlobalSetters] = useState(false)
  const [phaseGapMinutes, setPhaseGapMinutes] = useState('5')
  const [phaseDurationMinutes, setPhaseDurationMinutes] = useState('60')
  const [activeTab, setActiveTab] = useState('controls')
  const [whitelistDraft, setWhitelistDraft] = useState('')
  const [selectedWhitelistPhaseId, setSelectedWhitelistPhaseId] = useState('')
  const [phaseWhitelistAddresses, setPhaseWhitelistAddresses] = useState([])
  const [phaseWhitelistCounts, setPhaseWhitelistCounts] = useState({})
  const [phaseWhitelistMinted, setPhaseWhitelistMinted] = useState({})
  const [whitelistSearch, setWhitelistSearch] = useState('')
  const [whitelistPage, setWhitelistPage] = useState(1)
  const [whitelistVersion, setWhitelistVersion] = useState(0)
  const whitelistFileInputRef = useRef(null)
  const [phaseDraft, setPhaseDraft] = useState({
    phaseId: '',
    name: '',
    priceEth: '0',
    startAt: '',
    endAt: '',
    maxSupply: '0',
    maxPerWallet: '0',
    enabled: true,
  })

  const syncState = async (walletAddress = account) => {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider)
      const [contractOwner, totalSupply, maxSupply, maxPerWallet, mintPrice, mintActive, revealed, placeholderImage, contractBalance] = await Promise.all([
        contract.owner(),
        contract.totalSupply(),
        contract.MAX_SUPPLY(),
        contract.MAX_PER_WALLET(),
        contract.mintPrice(),
        contract.mintActive(),
        contract.revealed(),
        contract.placeholderImage(),
        rpcProvider.getBalance(CONTRACT_ADDRESS),
      ])

      setOwner(contractOwner)
      setIsOwner(Boolean(walletAddress) && contractOwner.toLowerCase() === walletAddress.toLowerCase())
      setState({
        totalSupply: Number(totalSupply),
        maxSupply: Number(maxSupply),
        maxPerWallet: Number(maxPerWallet),
        mintPriceEth: ethers.formatEther(mintPrice),
        mintActive,
        revealed,
        contractBalance: formatEth(contractBalance),
        placeholderImage,
      })
      setPlaceholderDraft(placeholderImage)
      setGlobalPriceDraft(ethers.formatEther(mintPrice))
      setGlobalSupplyDraft(String(Number(maxSupply)))
      setGlobalWalletDraft(String(Number(maxPerWallet)))

      const unsupported = Symbol('unsupported')
      const [phaseCountRaw, currentPhase] = await Promise.all([
        safeRead(() => contract.phaseCount(), unsupported),
        safeRead(() => contract.currentPhaseId(), unsupported),
      ])

      const phaseApiSupported = phaseCountRaw !== unsupported && currentPhase !== unsupported
      const phaseCount = phaseApiSupported ? Number(phaseCountRaw || 0) : 0
      setSupportsPhaseControls(phaseApiSupported)
      setSupportsGlobalSetters(phaseApiSupported)

      if (phaseCount > 0) {
        const phaseResults = await Promise.all(
          Array.from({ length: phaseCount }, async (_, index) => {
            const [phase, whitelistCount] = await Promise.all([
              contract.getPhase(index),
              safeRead(() => contract.phaseWhitelistCount(index), 0),
            ])
            return {
              id: index,
              name: phase[0],
              price: phase[1],
              startTime: Number(phase[2]),
              endTime: Number(phase[3]),
              maxSupply: Number(phase[4]),
              maxPerWallet: Number(phase[5]),
              minted: Number(phase[6]),
              enabled: Boolean(phase[7]),
              whitelistCount: Number(whitelistCount),
            }
          })
        )
        setPhases(phaseResults)
        setPhaseWhitelistCounts(
          Object.fromEntries(phaseResults.map((phase) => [String(phase.id), phase.whitelistCount || 0]))
        )
      } else {
        setPhases([])
        setPhaseWhitelistCounts({})
      }

      setCurrentPhaseId(phaseApiSupported && (Array.isArray(currentPhase) ? currentPhase[0] : false) ? Number(currentPhase[1]) : null)
    } catch (err) {
      setStatus(`Error: ${err.message?.slice(0, 140) || 'Failed to load contract state'}`)
    }
  }

  useEffect(() => {
    syncState(null)
  }, [])

  useEffect(() => {
    if (!window.ethereum) return undefined

    const handleAccountsChanged = (accounts) => {
      const next = accounts?.[0] || null
      setAccount(next)
      setLastTxHash('')
      syncState(next)
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)
    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [owner])

  useEffect(() => {
    if (!String(tokenIdInput || '').trim()) {
      setTokenInspect(null)
    }
  }, [tokenIdInput])

  useEffect(() => {
    const trimmed = String(tokenIdInput || '').trim()
    if (!trimmed) return

    const tokenId = Number(trimmed)
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      setTokenInspect(null)
      return
    }

    const timer = setTimeout(() => {
      inspectToken()
    }, 250)

    return () => clearTimeout(timer)
  }, [tokenIdInput])

  useEffect(() => {
    const loadPhaseWhitelist = async () => {
      if (!supportsPhaseControls || selectedWhitelistPhaseId === '') {
        setPhaseWhitelistAddresses([])
        return
      }

      const phaseId = Number(selectedWhitelistPhaseId)
      if (!Number.isInteger(phaseId) || phaseId < 0) {
        setPhaseWhitelistAddresses([])
        return
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider)
      const addresses = await safeRead(() => contract.getPhaseWhitelist(phaseId), [])
      setPhaseWhitelistAddresses(Array.isArray(addresses) ? addresses : [])
    }

    loadPhaseWhitelist().catch(() => setPhaseWhitelistAddresses([]))
  }, [selectedWhitelistPhaseId, supportsPhaseControls, whitelistVersion])

  useEffect(() => {
    setWhitelistSearch('')
    setWhitelistPage(1)
    setPhaseWhitelistMinted({})
  }, [selectedWhitelistPhaseId])

  const connect = async () => {
    if (!window.ethereum) {
      setStatus('Install MetaMask')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const next = accounts?.[0] || null
      setAccount(next)
      setStatus('')
      await syncState(next)
    } catch {
      setStatus('Connection failed')
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setIsOwner(false)
    setLastTxHash('')
    setStatus('Wallet disconnected')
  }

  const switchToEthereumSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      })
    } catch {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: CHAIN_ID_HEX,
            chainName: CHAIN_NAME,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [ETH_SEPOLIA_RPC],
            blockExplorerUrls: [BLOCK_EXPLORER_URL],
          }],
        })
      } catch {
        setStatus('Add Ethereum Sepolia manually')
      }
    }
  }

  const runOwnerAction = async (label, fn) => {
    if (!account) {
      setStatus('Connect wallet first')
      return false
    }
    if (!isOwner) {
      setStatus('Connected wallet is not the contract owner')
      return false
    }

    try {
      setIsBusy(true)
      setStatus(`${label}...`)
      setLastTxHash('')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)
      const tx = await fn(contract)
      setLastTxHash(tx.hash)
      setStatus('Confirming...')
      await tx.wait()
      await syncState(account)
      setWhitelistVersion((prev) => prev + 1)
      notifyContractUpdated(label)
      setStatus(`${label} complete`)
      return true
    } catch (err) {
      setStatus(`Error: ${err.reason || err.shortMessage || err.message?.slice(0, 160) || 'Transaction failed'}`)
      return false
    } finally {
      setIsBusy(false)
    }
  }

  const inspectToken = async () => {
    const tokenId = Number(tokenIdInput)
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      setStatus('Enter a valid token ID')
      return
    }
    try {
      setLoadingToken(true)
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider)
      const [tokenOwner, tokenName, evolved, metadataJson] = await Promise.all([
        contract.ownerOf(tokenId),
        contract.tokenName(tokenId),
        contract.tokenEvolved3D(tokenId),
        contract.tokenMetadataJson(tokenId),
      ])
      setTokenInspect({
        tokenId,
        owner: tokenOwner,
        tokenName,
        evolved,
        parsedMetadata: parseMetadata(metadataJson),
      })
      setStatus('')
    } catch (err) {
      setTokenInspect(null)
      setStatus(`Error: ${err.reason || err.message?.slice(0, 140) || 'Token lookup failed'}`)
    } finally {
      setLoadingToken(false)
    }
  }

  const inspectWallet = async () => {
    const address = walletInspectInput.trim()
    if (!ethers.isAddress(address)) {
      setStatus('Enter a valid wallet address')
      return
    }
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider)
      const [minted, balance] = await Promise.all([
        contract.mintedPerWallet(address),
        contract.balanceOf(address),
      ])
      setWalletInspect({
        address,
        minted: Number(minted),
        balance: Number(balance),
      })
      setStatus('')
    } catch (err) {
      setWalletInspect(null)
      setStatus(`Error: ${err.reason || err.message?.slice(0, 140) || 'Wallet lookup failed'}`)
    }
  }

  const exportSnapshot = () => {
    const snapshot = {
      contractAddress: CONTRACT_ADDRESS,
      owner,
      state,
      currentPhaseId,
      phases,
      tokenInspect,
      walletInspect,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `penguins-admin-snapshot-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const saveTaskPageSettings = () => {
    if (!isValidPinnedPostLink(taskPinnedPostDraft)) {
      setStatus('Enter a valid X/Twitter post URL')
      return
    }

    const payload = saveTaskPinnedPostLink(taskPinnedPostDraft)
    setTaskPinnedPostDraft(payload.link)
    setStatus('Task page pinned post link updated')
  }

  const resetTaskPageSettings = () => {
    const payload = resetTaskPinnedPostLink()
    setTaskPinnedPostDraft(payload.link)
    setStatus('Task page pinned post link reset to default')
  }

  const loadPhaseIntoForm = (phase) => {
    setPhaseDraft({
      phaseId: String(phase.id),
      name: phase.name || '',
      priceEth: ethers.formatEther(phase.price || 0n),
      startAt: toDatetimeLocal(phase.startTime),
      endAt: toDatetimeLocal(phase.endTime),
      maxSupply: String(phase.maxSupply || 0),
      maxPerWallet: String(phase.maxPerWallet || 0),
      enabled: Boolean(phase.enabled),
    })
  }

  const resetPhaseForm = () => {
    setPhaseDraft({
      phaseId: '',
      name: '',
      priceEth: '0',
      startAt: '',
      endAt: '',
      maxSupply: '0',
      maxPerWallet: '0',
      enabled: true,
    })
  }

  const savePhase = () => {
    if (!phaseDraft.name.trim()) {
      setStatus('Phase name is required')
      return
    }

    const phaseId = phaseDraft.phaseId === '' ? phases.length : Number(phaseDraft.phaseId)
    if (!Number.isInteger(phaseId) || phaseId < 0) {
      setStatus('Invalid phase ID')
      return
    }

    runOwnerAction('Saving phase', (contract) => contract.upsertPhase(
      phaseId,
      phaseDraft.name.trim(),
      ethers.parseEther(phaseDraft.priceEth || '0'),
      fromDatetimeLocal(phaseDraft.startAt),
      fromDatetimeLocal(phaseDraft.endAt),
      BigInt(phaseDraft.maxSupply || '0'),
      BigInt(phaseDraft.maxPerWallet || '0'),
      Boolean(phaseDraft.enabled)
    ))
  }

  const applyNextPhaseGap = () => {
    const phaseId = phaseDraft.phaseId === '' ? phases.length : Number(phaseDraft.phaseId)
    const previousPhase = phases
      .filter((phase) => phase.id < phaseId && phase.endTime > 0)
      .sort((a, b) => b.id - a.id)[0]

    if (!previousPhase) {
      setStatus('No previous phase with an end time found')
      return
    }

    const gap = Number(phaseGapMinutes || '5')
    const previousEndLocal = toDatetimeLocal(previousPhase.endTime)
    const nextStart = addMinutesToDatetimeLocal(previousEndLocal, Number.isFinite(gap) ? gap : 5)
    if (!nextStart) {
      setStatus('Failed to calculate next phase start')
      return
    }

    setPhaseDraft((prev) => ({ ...prev, startAt: nextStart }))
    setStatus(`Next phase start set to ${gap || 5} minutes after previous phase end`)
  }

  const applyPhaseDuration = () => {
    if (!phaseDraft.startAt) {
      setStatus('Set a phase start time first')
      return
    }

    const duration = Number(phaseDurationMinutes || '60')
    const nextEnd = addMinutesToDatetimeLocal(phaseDraft.startAt, Number.isFinite(duration) ? duration : 60)
    if (!nextEnd) {
      setStatus('Failed to calculate phase end time')
      return
    }

    setPhaseDraft((prev) => ({ ...prev, endAt: nextEnd }))
    setStatus(`Phase end set to ${duration || 60} minutes after start`)
  }

  const checkPhaseOverlap = () => {
    const phaseId = phaseDraft.phaseId === '' ? phases.length : Number(phaseDraft.phaseId)
    const draftStart = fromDatetimeLocal(phaseDraft.startAt)
    const draftEnd = fromDatetimeLocal(phaseDraft.endAt)

    if (!draftStart || !draftEnd || draftEnd <= draftStart) {
      setStatus('Set a valid phase start and end time first')
      return
    }

    const overlap = phases.find((phase) => {
      if (phase.id === phaseId || !phase.enabled) return false
      if (!phase.startTime || !phase.endTime) return false
      return draftStart < phase.endTime && draftEnd > phase.startTime
    })

    if (overlap) {
      setStatus(`Overlap found with phase ${overlap.id}: ${overlap.name || `Phase ${overlap.id}`}`)
      return
    }

    setStatus('No phase overlap detected')
  }

  const progress = state.maxSupply > 0 ? (state.totalSupply / state.maxSupply) * 100 : 0
  const ownerLocked = Boolean(account) && Boolean(owner) && !isOwner
  const adminReady = Boolean(account) && isOwner
  const selectedWhitelistPhase = phases.find((phase) => String(phase.id) === String(selectedWhitelistPhaseId)) || null
  const whitelistAnalysis = useMemo(() => analyzeAddressList(whitelistDraft), [whitelistDraft])
  const whitelistExistingSet = useMemo(() => new Set(phaseWhitelistAddresses), [phaseWhitelistAddresses])
  const whitelistToAdd = useMemo(
    () => whitelistAnalysis.valid.filter((address) => !whitelistExistingSet.has(address)),
    [whitelistAnalysis, whitelistExistingSet]
  )
  const whitelistToRemove = useMemo(
    () => whitelistAnalysis.valid.filter((address) => whitelistExistingSet.has(address)),
    [whitelistAnalysis, whitelistExistingSet]
  )
  const filteredWhitelistAddresses = useMemo(() => {
    const query = whitelistSearch.trim().toLowerCase()
    if (!query) return phaseWhitelistAddresses
    return phaseWhitelistAddresses.filter((address) => address.toLowerCase().includes(query))
  }, [phaseWhitelistAddresses, whitelistSearch])
  const whitelistPageSize = 50
  const whitelistTotalPages = Math.max(1, Math.ceil(filteredWhitelistAddresses.length / whitelistPageSize))
  const paginatedWhitelistAddresses = useMemo(() => {
    const start = (whitelistPage - 1) * whitelistPageSize
    return filteredWhitelistAddresses.slice(start, start + whitelistPageSize)
  }, [filteredWhitelistAddresses, whitelistPage])

  useEffect(() => {
    const loadWhitelistMinted = async () => {
      if (!supportsPhaseControls || !selectedWhitelistPhase || paginatedWhitelistAddresses.length === 0) {
        setPhaseWhitelistMinted({})
        return
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider)
      const entries = await Promise.all(
        paginatedWhitelistAddresses.map(async (address) => {
          const minted = await safeRead(() => contract.phaseMintedPerWallet(selectedWhitelistPhase.id, address), 0)
          return [address, Number(minted || 0)]
        })
      )
      setPhaseWhitelistMinted(Object.fromEntries(entries))
    }

    loadWhitelistMinted().catch(() => setPhaseWhitelistMinted({}))
  }, [supportsPhaseControls, selectedWhitelistPhase, paginatedWhitelistAddresses, rpcProvider])

  useEffect(() => {
    if (whitelistPage > whitelistTotalPages) {
      setWhitelistPage(whitelistTotalPages)
    }
  }, [whitelistPage, whitelistTotalPages])

  const addWhitelistEntries = async () => {
    if (whitelistAnalysis.valid.length === 0) {
      setStatus('Enter at least one valid wallet address')
      return
    }

    if (selectedWhitelistPhaseId === '') {
      setStatus('Select a phase first')
      return
    }

    const duplicateCount = whitelistAnalysis.duplicate.length
    const invalidCount = whitelistAnalysis.invalid.length

    if (whitelistToAdd.length === 0) {
      setStatus('All valid addresses are already assigned to this phase')
      return
    }

    const ok = await runOwnerAction('Updating phase whitelist', (contract) => contract.setPhaseWhitelist(
      BigInt(selectedWhitelistPhaseId),
      whitelistToAdd,
      true
    ))
    if (!ok) return

    setWhitelistDraft('')
    setWhitelistSearch('')
    const skipped = duplicateCount + invalidCount
    setStatus(
      skipped > 0
        ? `Added ${whitelistToAdd.length} address${whitelistToAdd.length !== 1 ? 'es' : ''}, skipped ${skipped}`
        : `Added ${whitelistToAdd.length} whitelist address${whitelistToAdd.length !== 1 ? 'es' : ''}`
    )
  }

  const removeWhitelistEntries = async () => {
    if (whitelistAnalysis.valid.length === 0) {
      setStatus('Enter at least one valid wallet address')
      return
    }

    if (selectedWhitelistPhaseId === '') {
      setStatus('Select a phase first')
      return
    }

    const missingCount = whitelistAnalysis.valid.length - whitelistToRemove.length
    const invalidCount = whitelistAnalysis.invalid.length

    if (whitelistToRemove.length === 0) {
      setStatus(
        missingCount > 0 || invalidCount > 0
          ? `No matching whitelist addresses found. Skipped ${missingCount + invalidCount} address${missingCount + invalidCount !== 1 ? 'es' : ''}`
          : 'No matching whitelist addresses found'
      )
      return
    }

    const ok = await runOwnerAction('Removing phase whitelist addresses', (contract) => contract.setPhaseWhitelist(
      BigInt(selectedWhitelistPhaseId),
      whitelistToRemove,
      false
    ))
    if (!ok) return

    setWhitelistDraft('')
    setWhitelistSearch('')
    setStatus(
      missingCount + invalidCount > 0
        ? `Removed ${whitelistToRemove.length} address${whitelistToRemove.length !== 1 ? 'es' : ''}, skipped ${missingCount + invalidCount}`
        : `Removed ${whitelistToRemove.length} whitelist address${whitelistToRemove.length !== 1 ? 'es' : ''}`
    )
  }

  const removePhaseWhitelistEntry = async (phaseId, address) => {
    const ok = await runOwnerAction('Removing phase whitelist address', (contract) => contract.setPhaseWhitelist(
      BigInt(phaseId),
      [address],
      false
    ))
    if (ok) {
      setStatus(`Removed ${shortAddress(address)} from phase ${phaseId}`)
    }
  }

  const exportWhitelist = () => {
    const blob = new Blob([phaseWhitelistAddresses.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `penguins-whitelist-${Date.now()}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadWhitelistTemplate = () => {
    const blob = new Blob(['address\n0x0000000000000000000000000000000000000000\n'], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'penguins-whitelist-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const loadOnChainWhitelistToDraft = () => {
    if (phaseWhitelistAddresses.length === 0) {
      setStatus('No on-chain whitelist addresses to load')
      return
    }
    setWhitelistDraft(phaseWhitelistAddresses.join('\n'))
    setStatus(`Loaded ${phaseWhitelistAddresses.length} on-chain address${phaseWhitelistAddresses.length !== 1 ? 'es' : ''} into draft`)
  }

  const openWhitelistFilePicker = () => {
    whitelistFileInputRef.current?.click()
  }

  const importWhitelistFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const firstSheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false })
      const values = rows.flat().map((value) => String(value || '').trim()).filter(Boolean)
      const parsed = parseAddressList(values.join('\n'))

      if (parsed.length === 0) {
        setStatus('No valid wallet addresses found in file')
      } else {
        setWhitelistDraft((prev) => {
          const merged = analyzeAddressList([prev, parsed.join('\n')].filter(Boolean).join('\n'))
          return merged.valid.join('\n')
        })
        setStatus(`Imported ${parsed.length} wallet address${parsed.length !== 1 ? 'es' : ''} from ${file.name}`)
      }
    } catch {
      setStatus('Failed to read file. Use a valid CSV, XLS, or XLSX file')
    } finally {
      event.target.value = ''
    }
  }

  if (!adminReady) {
    return (
      <div className="mint-page admin-page admin-page-gated">
        <SiteNav label="Admin Control" />
        <div className="admin-gate-screen">
          <div className="admin-locked">
            <div className="admin-locked-badge">ADMIN ONLY</div>
            <h2>{account ? 'Admin Access Restricted' : 'Owner Wallet Required'}</h2>
            <p className="admin-locked-copy">
              {account
                ? 'Connected wallet is not the contract owner.'
                : 'Connect the owner wallet to unlock the dashboard.'}
            </p>
            {account && <div className="admin-locked-owner">Authorized owner: {owner}</div>}
            <div className="admin-inline-actions admin-locked-actions">
              <button className="mint-network-btn" onClick={switchToEthereumSepolia}>Switch to Ethereum Sepolia</button>
              {!account ? (
                <button className="mint-connect-btn" onClick={connect}>Connect Wallet</button>
              ) : (
                <button className="mint-disconnect-btn" onClick={disconnectWallet}>Disconnect</button>
              )}
            </div>
            {status && <div className={`mint-status ${status.includes('Error') ? 'error' : ''}`}>{status}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mint-page admin-page">
      <SiteNav label="Admin Control" />

      <div className="mint-layout">
        <>
            <div className="mint-card">
              <div className="mint-card-header">
                <span className="mint-card-title">Admin</span>
                <span className="mint-card-badge">OWNER</span>
              </div>

              <div className="mint-supply">
                <div className="mint-supply-header">
                  <span className="mint-supply-label">Minted</span>
                  <span className="mint-supply-value">{state.totalSupply}<span> / {state.maxSupply}</span></span>
                </div>
                <div className="mint-supply-bar">
                  <div className="mint-supply-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="mint-supply-footer">
                  <span>{state.maxSupply - state.totalSupply} remaining</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              <button className="mint-network-btn" onClick={switchToEthereumSepolia}>Switch to Ethereum Sepolia</button>

              <div className="mint-connected">
                <div className="mint-wallet">
                  <div className="mint-wallet-main">
                    <button className="mint-wallet-addr-btn" disabled>{shortAddress(account)}</button>
                    <span className="mint-wallet-bal admin-ok">Owner</span>
                  </div>
                  <button className="mint-disconnect-btn" onClick={disconnectWallet}>Disconnect</button>
                </div>
              </div>

              {status && <div className={`mint-status ${status.includes('Error') ? 'error' : ''}`}>{status}</div>}
              {lastTxHash && (
                <a href={`${BLOCK_EXPLORER_URL}/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" className="mint-tx-link">
                  {'View Transaction ->'}
                </a>
              )}
            </div>

            <div className="mint-display admin-display">
            <>
              <div className="mint-tabs admin-tabs">
                <button className={`mint-tab ${activeTab === 'controls' ? 'active' : ''}`} onClick={() => setActiveTab('controls')}>
                  Controls
                </button>
                <button className={`mint-tab ${activeTab === 'whitelist' ? 'active' : ''}`} onClick={() => setActiveTab('whitelist')}>
                  Whitelist Manager
                </button>
              </div>
              {activeTab === 'controls' ? (
            <div className="admin-grid">
              <section className="admin-panel admin-panel-state admin-panel-wide">
                <div className="admin-panel-head">
                  <h2>Contract State</h2>
                  <div className="admin-inline-actions">
                    <button className="mint-page-btn" onClick={() => syncState(account)}>Refresh</button>
                    <button className="mint-page-btn" onClick={exportSnapshot}>Export Snapshot</button>
                  </div>
                </div>
                <div className="admin-stat-grid">
                  <div className="admin-stat"><span>Owner</span><strong>{shortAddress(owner)}</strong></div>
                  <div className="admin-stat"><span>Mint</span><strong>{state.mintActive ? 'Active' : 'Paused'}</strong></div>
                  <div className="admin-stat"><span>Reveal</span><strong>{state.revealed ? 'Revealed' : 'Hidden'}</strong></div>
                  <div className="admin-stat"><span>Max Supply</span><strong>{state.maxSupply}</strong></div>
                  <div className="admin-stat"><span>Global Price</span><strong>{state.mintPriceEth} ETH</strong></div>
                  <div className="admin-stat"><span>Global Wallet Max</span><strong>{state.maxPerWallet}</strong></div>
                  <div className="admin-stat"><span>Contract ETH</span><strong>{state.contractBalance}</strong></div>
                </div>
              </section>

              <section className="admin-panel admin-panel-actions">
                <div className="admin-panel-head">
                  <h2>Owner Actions</h2>
                </div>
                <div className="admin-actions">
                  <button className="mint-submit-btn admin-action-btn" disabled={isBusy || !isOwner} onClick={() => runOwnerAction(state.mintActive ? 'Pausing mint' : 'Activating mint', (contract) => contract.toggleMint())}>
                    {state.mintActive ? 'Pause Mint' : 'Activate Mint'}
                  </button>
                  <button className="mint-submit-btn admin-action-btn" disabled={isBusy || !isOwner || state.revealed} onClick={() => runOwnerAction('Revealing collection', (contract) => contract.setRevealed(true))}>
                    Reveal Collection
                  </button>
                  <button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !isOwner || !state.revealed} onClick={() => runOwnerAction('Hiding reveal', (contract) => contract.setRevealed(false))}>
                    Hide Reveal
                  </button>
                  <button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !isOwner} onClick={() => runOwnerAction('Withdrawing funds', (contract) => contract.withdraw())}>
                    Withdraw Contract ETH
                  </button>
                </div>
              </section>

              <section className="admin-panel admin-panel-global">
                <div className="admin-panel-head">
                  <h2>Global Mint Settings</h2>
                </div>
                {!supportsGlobalSetters && (
                  <div className="mint-status">
                    Upgrade required for on-chain price and wallet limit controls.
                  </div>
                )}
                <div className="admin-global-settings">
                  <div className="admin-setting-row">
                    <FieldLabel label="Max Supply">
                      <input className="admin-input" value={globalSupplyDraft} onChange={(e) => setGlobalSupplyDraft(e.target.value)} placeholder="8888" />
                    </FieldLabel>
                    <button className="mint-submit-btn admin-action-btn admin-setting-btn" disabled={isBusy || !isOwner || !supportsGlobalSetters || Number(globalSupplyDraft || '0') < state.totalSupply} onClick={() => runOwnerAction('Updating max supply', (contract) => contract.setMaxSupply(BigInt(globalSupplyDraft || '0')))}>
                      Save Supply
                    </button>
                  </div>
                  <div className="admin-setting-row">
                    <FieldLabel label="Mint Price (ETH)">
                      <input className="admin-input" value={globalPriceDraft} onChange={(e) => setGlobalPriceDraft(e.target.value)} placeholder="0.01" />
                    </FieldLabel>
                    <button className="mint-submit-btn admin-action-btn admin-setting-btn" disabled={isBusy || !isOwner || !supportsGlobalSetters} onClick={() => runOwnerAction('Updating global mint price', (contract) => contract.setMintPrice(ethers.parseEther(globalPriceDraft || '0')))}>
                      Save Price
                    </button>
                  </div>
                  <div className="admin-setting-row">
                    <FieldLabel label="Global Max Per Wallet">
                      <input className="admin-input" value={globalWalletDraft} onChange={(e) => setGlobalWalletDraft(e.target.value)} placeholder="50" />
                    </FieldLabel>
                    <button className="mint-submit-btn admin-action-btn admin-setting-btn" disabled={isBusy || !isOwner || !supportsGlobalSetters || Number(globalWalletDraft || '0') <= 0} onClick={() => runOwnerAction('Updating global wallet limit', (contract) => contract.setMaxPerWallet(BigInt(globalWalletDraft || '0')))}>
                      Save Wallet Max
                    </button>
                  </div>
                </div>
              </section>

              <section className="admin-panel admin-panel-global">
                <div className="admin-panel-head">
                  <h2>Task Page Settings</h2>
                </div>
                <div className="admin-global-settings">
                  <div className="admin-setting-row">
                    <FieldLabel label="Pinned Post Link">
                      <input
                        className="admin-input"
                        value={taskPinnedPostDraft}
                        onChange={(e) => setTaskPinnedPostDraft(e.target.value)}
                        placeholder={DEFAULT_TASK_PINNED_POST_LINK}
                      />
                    </FieldLabel>
                    <button
                      className="mint-submit-btn admin-action-btn admin-setting-btn"
                      disabled={isBusy || !isValidPinnedPostLink(taskPinnedPostDraft)}
                      onClick={saveTaskPageSettings}
                    >
                      Save Link
                    </button>
                  </div>
                  <div className="admin-inline-actions">
                    <a
                      className="mint-submit-btn admin-action-btn admin-action-muted admin-setting-btn"
                      href={isValidPinnedPostLink(taskPinnedPostDraft) ? taskPinnedPostDraft : DEFAULT_TASK_PINNED_POST_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Link
                    </a>
                    <button
                      className="mint-submit-btn admin-action-btn admin-action-muted admin-setting-btn"
                      disabled={isBusy || taskPinnedPostDraft === DEFAULT_TASK_PINNED_POST_LINK}
                      onClick={resetTaskPageSettings}
                    >
                      Reset Default
                    </button>
                  </div>
                  <p className="admin-setting-help">
                    This updates the pinned post used by the task page for both the like/retweet step and the quote-tweet step.
                  </p>
                </div>
              </section>

              <section className="admin-panel admin-panel-placeholder">
                <div className="admin-panel-head">
                  <h2>Placeholder Image</h2>
                </div>
                <textarea className="admin-textarea" value={placeholderDraft} onChange={(e) => setPlaceholderDraft(e.target.value)} placeholder="Paste data:image/... or IPFS URL" rows={6} />
                <div className="admin-form-actions">
                  <button className="mint-submit-btn admin-action-btn" disabled={isBusy || !isOwner || !placeholderDraft.trim()} onClick={() => runOwnerAction('Updating placeholder image', (contract) => contract.setPlaceholderImage(placeholderDraft.trim()))}>
                    Save Placeholder
                  </button>
                </div>
              </section>

              <section className="admin-panel admin-panel-ownership">
                <div className="admin-panel-head">
                  <h2>Transfer Ownership</h2>
                </div>
                <input className="admin-input" value={ownershipDraft} onChange={(e) => setOwnershipDraft(e.target.value)} placeholder="0x..." />
                <div className="admin-form-actions">
                  <button className="mint-submit-btn admin-action-btn admin-action-danger" disabled={isBusy || !isOwner || !ethers.isAddress(ownershipDraft || '')} onClick={() => runOwnerAction('Transferring ownership', (contract) => contract.transferOwnership(ownershipDraft.trim()))}>
                    Transfer Ownership
                  </button>
                </div>
              </section>

              <section className="admin-panel admin-panel-phases admin-panel-wide">
                <div className="admin-panel-head">
                  <h2>Phases</h2>
                </div>
                {!supportsPhaseControls && (
                  <div className="mint-status">
                    Upgrade required for phase controls on the deployed contract.
                  </div>
                )}
                <div className="admin-phase-form">
                  <FieldLabel label="Phase ID">
                    <input className="admin-input" value={phaseDraft.phaseId} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, phaseId: e.target.value }))} placeholder={`Blank = new ${phases.length}`} />
                  </FieldLabel>
                  <FieldLabel label="Phase Name">
                    <input className="admin-input" value={phaseDraft.name} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Public mint" />
                  </FieldLabel>
                  <FieldLabel label="Price (ETH)">
                    <input className="admin-input" value={phaseDraft.priceEth} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, priceEth: e.target.value }))} placeholder="0.01" />
                  </FieldLabel>
                  <FieldLabel label="Max Per Phase">
                    <input className="admin-input" value={phaseDraft.maxSupply} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, maxSupply: e.target.value }))} placeholder="0 = unlimited" />
                  </FieldLabel>
                  <FieldLabel label="Max Per Wallet">
                    <input className="admin-input" value={phaseDraft.maxPerWallet} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, maxPerWallet: e.target.value }))} placeholder="0 = use global" />
                  </FieldLabel>
                  <FieldLabel label="Start Time">
                    <input className="admin-input" type="datetime-local" value={phaseDraft.startAt} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, startAt: e.target.value }))} />
                  </FieldLabel>
                  <FieldLabel label="End Time">
                    <input className="admin-input" type="datetime-local" value={phaseDraft.endAt} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, endAt: e.target.value }))} />
                  </FieldLabel>
                  <FieldLabel label="Gap After Previous (min)">
                    <input className="admin-input" value={phaseGapMinutes} onChange={(e) => setPhaseGapMinutes(e.target.value)} placeholder="5" />
                  </FieldLabel>
                  <FieldLabel label="Duration From Start (min)">
                    <input className="admin-input" value={phaseDurationMinutes} onChange={(e) => setPhaseDurationMinutes(e.target.value)} placeholder="60" />
                  </FieldLabel>
                </div>
                <div className="admin-phase-toggle-row">
                  <label className="admin-check">
                    <input type="checkbox" checked={phaseDraft.enabled} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, enabled: e.target.checked }))} />
                    <span>Phase enabled</span>
                  </label>
                </div>
                <div className="admin-inline-actions admin-phase-actions">
                  <button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !supportsPhaseControls} onClick={applyNextPhaseGap}>
                    Start After Previous
                  </button>
                  <button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !supportsPhaseControls} onClick={applyPhaseDuration}>
                    Set End From Duration
                  </button>
                  <button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !supportsPhaseControls} onClick={checkPhaseOverlap}>
                    Check Overlap
                  </button>
                  <button className="mint-submit-btn admin-action-btn" disabled={isBusy || !isOwner || !supportsPhaseControls || !phaseDraft.name.trim()} onClick={savePhase}>
                    Save Phase
                  </button>
                  <button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy} onClick={resetPhaseForm}>
                    Reset Form
                  </button>
                </div>
                <div className="admin-phase-list">
                  {phases.length === 0 ? (
                    <div className="mint-empty">No phases configured</div>
                  ) : phases.map((phase) => (
                    <div key={phase.id} className="admin-phase-item">
                      <div>
                        <strong>{phase.name || `Phase ${phase.id}`}{currentPhaseId === phase.id ? ' (Live)' : ''}</strong>
                        <span>Price: {ethers.formatEther(phase.price || 0n)} ETH</span>
                        <span>Minted: {phase.minted} / {phase.maxSupply || 'unlimited'}</span>
                        <small>Window: {phaseWindowLabel(phase)}</small>
                        <small>Wallet Max: {phase.maxPerWallet || state.maxPerWallet}</small>
                        <small>Status: {phase.enabled ? 'enabled' : 'disabled'}</small>
                      </div>
                      <div className="admin-inline-actions">
                        <button className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn" onClick={() => loadPhaseIntoForm(phase)}>Edit</button>
                        <button className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn" disabled={!supportsPhaseControls || phase.id !== phases.length - 1} onClick={() => runOwnerAction(`Deleting phase ${phase.id}`, (contract) => contract.deletePhase(phase.id))}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="admin-panel admin-panel-token admin-panel-wide">
                <div className="admin-panel-head">
                  <h2>Token Inspector</h2>
                </div>
                <div className="admin-inspector-row">
                  <FieldLabel label="Token ID">
                    <input className="admin-input" value={tokenIdInput} onChange={(e) => setTokenIdInput(e.target.value)} placeholder="Enter token number" />
                  </FieldLabel>
                  <div className="admin-token-actions">
                    <button className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn" onClick={() => { setTokenIdInput(''); setTokenInspect(null) }} disabled={!tokenIdInput && !tokenInspect}>Clear</button>
                  </div>
                </div>
                {tokenInspect && (
                  <div className="admin-token-card">
                    {tokenInspect.parsedMetadata?.image && (
                      <div className="admin-token-preview">
                        <img src={tokenInspect.parsedMetadata.image} alt={`Token ${tokenInspect.tokenId}`} />
                      </div>
                    )}
                    <div className="admin-token-body">
                      <div className="admin-token-summary">
                        <div className="admin-token-heading">
                          <span className="admin-token-kicker">Token #{tokenInspect.tokenId}</span>
                          <strong>{tokenInspect.tokenName || 'Unnamed Token'}</strong>
                        </div>
                        <div className="admin-token-meta">
                          <div className="admin-stat"><span>Owner</span><strong>{shortAddress(tokenInspect.owner)}</strong></div>
                          <div className="admin-stat"><span>3D</span><strong>{tokenInspect.evolved ? 'Yes' : 'No'}</strong></div>
                          <div className="admin-stat"><span>Metadata</span><strong>{tokenInspect.parsedMetadata ? 'Loaded' : 'Unavailable'}</strong></div>
                          <div className="admin-stat"><span>Traits</span><strong>{tokenInspect.parsedMetadata?.attributes?.length || 0}</strong></div>
                        </div>
                      </div>
                      {tokenInspect.parsedMetadata?.attributes?.length > 0 && (
                        <div className="admin-token-traits-wrap">
                          <div className="admin-token-section-title">Traits</div>
                          <div className="mint-gallery-traits admin-token-traits">
                            {tokenInspect.parsedMetadata.attributes.map((attr, index) => (
                              <span key={`${attr.trait_type}-${index}`} className="mint-gallery-trait">
                                <strong>{attr.trait_type}</strong>
                                <span>{String(attr.value)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!tokenInspect && (
                  <div className="admin-token-empty">
                    Enter a token ID to load owner, metadata preview, and traits.
                  </div>
                )}
              </section>

              <section className="admin-panel admin-panel-wallet">
                <div className="admin-panel-head">
                  <h2>Wallet Inspector</h2>
                </div>
                <div className="admin-inspector-row">
                  <input className="admin-input" value={walletInspectInput} onChange={(e) => setWalletInspectInput(e.target.value)} placeholder="Wallet address" />
                  <button className="mint-page-btn" onClick={inspectWallet}>Inspect</button>
                </div>
                {walletInspect && (
                  <div className="admin-token-meta">
                    <div className="admin-stat"><span>Wallet</span><strong>{shortAddress(walletInspect.address)}</strong></div>
                    <div className="admin-stat"><span>Total Minted</span><strong>{walletInspect.minted}</strong></div>
                    <div className="admin-stat"><span>Current NFT Balance</span><strong>{walletInspect.balance}</strong></div>
                  </div>
                )}
              </section>
            </div>
              ) : (
                <div className="admin-grid">
                  <section className="admin-panel admin-panel-wide">
                    <div className="admin-panel-head">
                      <h2>Whitelist Manager</h2>
                    </div>
                    <div className="mint-status">
                      On-chain phase whitelist manager. Wallet assignments are written to the contract and enforced during mint.
                    </div>
                    <div className="admin-whitelist-shell">
                      <div className="admin-whitelist-phase-card admin-whitelist-phase-card-wide">
                        <div className="admin-whitelist-toolbar">
                          <FieldLabel label="Assign To Phase">
                            <select
                              className="admin-input"
                              value={selectedWhitelistPhaseId}
                              onChange={(e) => setSelectedWhitelistPhaseId(e.target.value)}
                            >
                              <option value="">Select phase</option>
                              {phases.map((phase) => (
                                <option key={phase.id} value={String(phase.id)}>
                                  {phase.name || `Phase ${phase.id}`}
                                </option>
                              ))}
                            </select>
                          </FieldLabel>
                          {selectedWhitelistPhase ? (
                            <div className="admin-whitelist-phase-meta">
                              <strong>{selectedWhitelistPhase.name || `Phase ${selectedWhitelistPhase.id}`}</strong>
                              <span>{selectedWhitelistPhase.enabled ? 'Enabled' : 'Disabled'}</span>
                              <span>{phaseWindowLabel(selectedWhitelistPhase)}</span>
                              <span>{phaseWhitelistAddresses.length} wallets on chain</span>
                            </div>
                          ) : (
                            <div className="admin-token-empty">Select a phase to manage its whitelist.</div>
                          )}
                        </div>
                        <div className="admin-whitelist-stats">
                          <div className="admin-stat">
                            <span>Valid</span>
                            <strong>{whitelistAnalysis.valid.length}</strong>
                          </div>
                          <div className="admin-stat">
                            <span>Duplicates</span>
                            <strong>{whitelistAnalysis.duplicate.length}</strong>
                          </div>
                          <div className="admin-stat">
                            <span>Invalid</span>
                            <strong>{whitelistAnalysis.invalid.length}</strong>
                          </div>
                          <div className="admin-stat">
                            <span>Ready To Add</span>
                            <strong>{whitelistToAdd.length}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="admin-whitelist-editor admin-whitelist-editor-wide">
                        <FieldLabel label="Wallet Addresses">
                          <textarea
                            className="admin-textarea"
                            rows={8}
                            value={whitelistDraft}
                            onChange={(e) => setWhitelistDraft(e.target.value)}
                            placeholder={'One address per line or comma separated'}
                          />
                        </FieldLabel>
                        <div className="admin-whitelist-help">
                          Paste addresses, upload a file, then add or remove them from the selected phase.
                        </div>
                        {whitelistAnalysis.valid.length > 0 && (
                          <div className="admin-whitelist-preview">
                            <div className="admin-whitelist-preview-head">
                              <strong>Batch Preview</strong>
                              <span>{whitelistAnalysis.valid.length} valid wallet{whitelistAnalysis.valid.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="admin-whitelist-chips">
                              {whitelistAnalysis.valid.slice(0, 8).map((address) => (
                                <span key={address} className="admin-whitelist-chip">{shortAddress(address)}</span>
                              ))}
                              {whitelistAnalysis.valid.length > 8 && (
                                <span className="admin-whitelist-chip">+{whitelistAnalysis.valid.length - 8} more</span>
                              )}
                            </div>
                          </div>
                        )}
                        <input
                          ref={whitelistFileInputRef}
                          type="file"
                          accept=".csv,.xls,.xlsx"
                          onChange={importWhitelistFile}
                          style={{ display: 'none' }}
                        />
                        <div className="admin-whitelist-actions">
                          <div className="admin-whitelist-action-group">
                            <button className="mint-submit-btn admin-action-btn admin-action-success" onClick={addWhitelistEntries} disabled={!supportsPhaseControls || selectedWhitelistPhaseId === '' || whitelistToAdd.length === 0}>
                              Add To Phase
                            </button>
                            <button className="mint-submit-btn admin-action-btn admin-action-danger" onClick={removeWhitelistEntries} disabled={!supportsPhaseControls || selectedWhitelistPhaseId === '' || whitelistToRemove.length === 0}>
                              Remove From Phase
                            </button>
                          </div>
                          <div className="admin-whitelist-action-group">
                            <button className="mint-submit-btn admin-action-btn" onClick={openWhitelistFilePicker}>
                              Upload CSV/Excel
                            </button>
                            <button className="mint-submit-btn admin-action-btn" onClick={downloadWhitelistTemplate}>
                              Download Template
                            </button>
                            <button className="mint-submit-btn admin-action-btn" onClick={loadOnChainWhitelistToDraft} disabled={phaseWhitelistAddresses.length === 0}>
                              Load On-Chain List
                            </button>
                            <button className="mint-submit-btn admin-action-btn" onClick={exportWhitelist} disabled={phaseWhitelistAddresses.length === 0}>
                              Export
                            </button>
                            <button className="mint-submit-btn admin-action-btn" onClick={() => setWhitelistDraft('')} disabled={!whitelistDraft.trim()}>
                              Clear Draft
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="admin-panel admin-panel-wide admin-whitelist-saved-panel">
                    <div className="admin-panel-head">
                      <h2>Saved Addresses</h2>
                      {selectedWhitelistPhaseId !== '' && (
                        <div className="admin-inline-actions">
                          <input
                            className="admin-input admin-whitelist-search"
                            value={whitelistSearch}
                            onChange={(e) => setWhitelistSearch(e.target.value)}
                            placeholder="Search address"
                          />
                        </div>
                      )}
                    </div>
                    {selectedWhitelistPhaseId !== '' ? (
                      phaseWhitelistAddresses.length === 0 ? (
                        <div className="admin-token-empty">No wallets assigned to this phase yet.</div>
                      ) : (
                        <div className="admin-phase-list admin-whitelist-table">
                          <div className="admin-whitelist-header">
                            <span>Wallet</span>
                            <span>Phase</span>
                            <span>Remaining</span>
                            <span>Action</span>
                          </div>
                          {paginatedWhitelistAddresses.map((address) => (
                            <div key={`${selectedWhitelistPhaseId}-${address}`} className="admin-phase-item admin-whitelist-row">
                              <div className="admin-whitelist-row-main">
                                <strong>{shortAddress(address)}</strong>
                                <small>{address}</small>
                              </div>
                              <div className="admin-whitelist-cell">
                                <strong>{selectedWhitelistPhase?.name || `Phase ${selectedWhitelistPhaseId}`}</strong>
                                <small>{selectedWhitelistPhase?.enabled ? 'Enabled' : 'Disabled'}</small>
                              </div>
                              <div className="admin-whitelist-cell">
                                <strong>
                                  {Math.max(
                                    0,
                                    Number((selectedWhitelistPhase?.maxPerWallet || state.maxPerWallet || 0)) - Number(phaseWhitelistMinted[address] || 0)
                                  )}
                                </strong>
                                <small>
                                  {Number(phaseWhitelistMinted[address] || 0)} minted / {Number(selectedWhitelistPhase?.maxPerWallet || state.maxPerWallet || 0)} max
                                </small>
                              </div>
                              <div className="admin-inline-actions">
                                <button className="mint-submit-btn admin-action-btn admin-action-danger admin-phase-btn" onClick={() => removePhaseWhitelistEntry(String(selectedWhitelistPhaseId), address)}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                          {filteredWhitelistAddresses.length === 0 && (
                            <div className="admin-token-empty">No saved address matches that search.</div>
                          )}
                          {filteredWhitelistAddresses.length > 0 && (
                            <div className="admin-whitelist-pagination">
                              <span>
                                Page {whitelistPage} of {whitelistTotalPages} • {filteredWhitelistAddresses.length} result{filteredWhitelistAddresses.length !== 1 ? 's' : ''}
                              </span>
                              <div className="admin-inline-actions">
                                <button
                                  className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn"
                                  onClick={() => setWhitelistPage((prev) => Math.max(1, prev - 1))}
                                  disabled={whitelistPage <= 1}
                                >
                                  Prev
                                </button>
                                <button
                                  className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn"
                                  onClick={() => setWhitelistPage((prev) => Math.min(whitelistTotalPages, prev + 1))}
                                  disabled={whitelistPage >= whitelistTotalPages}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="admin-token-empty">Select a phase to view its on-chain whitelist.</div>
                    )}
                  </section>
                  <section className="admin-panel admin-panel-wide">
                    <div className="admin-panel-head">
                      <h2>Phase Assignment Overview</h2>
                    </div>
                    {phases.length === 0 ? (
                      <div className="admin-token-empty">No phases available yet.</div>
                    ) : (
                      <div className="admin-phase-list">
                        {phases.map((phase) => {
                          const assigned = phaseWhitelistCounts[String(phase.id)] || 0
                          return (
                            <div key={`overview-${phase.id}`} className="admin-phase-item">
                              <div>
                                <strong>{phase.name || `Phase ${phase.id}`}</strong>
                                <small>Assigned wallets: {assigned}</small>
                              </div>
                              <div className="admin-inline-actions">
                                <button
                                  className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn"
                                  onClick={() => setSelectedWhitelistPhaseId(String(phase.id))}
                                >
                                  Manage
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
            </div>
        </>
      </div>
    </div>
  )
}

export default Admin

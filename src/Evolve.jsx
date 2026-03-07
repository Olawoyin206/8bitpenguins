import { useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { render3DSnapshot } from './Mint.jsx'
import './Mint.css'
import { BLOCK_EXPLORER_URL, CHAIN_ID_HEX, CHAIN_NAME, CONTRACT_ADDRESS, ETH_SEPOLIA_RPC } from './contractConfig.js'
import contractABI from './abi/EightBitPenguinsUpgradeable.abi.js'

const MODEL_TRAITS = {
  background: [
    { name: 'Light Blue', color: '#ADD8E6' },
    { name: 'Baby Pink', color: '#F4A6B8' },
    { name: 'Sky Blue', color: '#87CEEB' },
    { name: 'Arctic White', color: '#F8FBFF' },
    { name: 'Soft Lavender', color: '#C8B6FF' },
    { name: 'Mint Green', color: '#98FFCC' },
    { name: 'Pastel Pink', color: '#FFD1DC' },
    { name: 'Royal Blue', color: '#4169E1' },
    { name: 'Peach Cream', color: '#FFE5B4' },
    { name: 'Lilac Purple', color: '#D8B4F8' },
    { name: 'Warm Beige', color: '#F5F5DC' },
    { name: 'Coral Red', color: '#FF6B6B' },
    { name: 'Midnight Blue', color: '#1A1A2E' },
    { name: 'Sunset Orange', color: '#FF7A18' },
    { name: 'Deep Teal', color: '#0F4C5C' },
    { name: 'Forest Green', color: '#2E8B57' },
    { name: 'Charcoal Gray', color: '#36454F' },
    { name: 'Neon Yellow', color: '#F5FF3B' },
    { name: 'Electric Cyan', color: '#00FFFF' },
    { name: 'Golden Glow', color: '#FFD700' },
    { name: 'Crimson Red', color: '#DC143C' },
  ],
  body: [
    { name: 'Skeleton Dark Bone', base: '#D6CCB8', highlight: '#E8E2D4', shadow: '#9F8B7D' },
    { name: 'Snow White', base: '#F5F5F5', highlight: '#FFFFFF', shadow: '#C2C2C2' },
    { name: 'Jet Black', base: '#1C1C1C', highlight: '#484848', shadow: '#000000' },
    { name: 'Ash Gray', base: '#B2B2B2', highlight: '#D9D9D9', shadow: '#858585' },
    { name: 'Cream', base: '#FFF3D6', highlight: '#FFFFEB', shadow: '#CCC2A3' },
    { name: 'Light Brown', base: '#C68642', highlight: '#E0A86A', shadow: '#8E5C2B' },
    { name: 'Chocolate Brown', base: '#5C3A21', highlight: '#8A6145', shadow: '#3A2514' },
    { name: 'Golden Tan', base: '#D2A679', highlight: '#E8C9A4', shadow: '#9E7856' },
    { name: 'Ice Blue', base: '#CFE9FF', highlight: '#F0F8FF', shadow: '#9FBFCD' },
    { name: 'Baby Blue', base: '#A7C7E7', highlight: '#D4E9F5', shadow: '#7A96B0' },
    { name: 'Ocean Blue', base: '#2B6CB0', highlight: '#5A9AD4', shadow: '#1D4D7E' },
    { name: 'Soft Pink', base: '#F4A6B8', highlight: '#FAD2DD', shadow: '#B77A8B' },
    { name: 'Bubblegum Pink', base: '#FF77AA', highlight: '#FFA5CC', shadow: '#CC4F7D' },
    { name: 'Lavender Body', base: '#BFA2DB', highlight: '#D9C9EB', shadow: '#8F76A4' },
    { name: 'Royal Purple', base: '#6B3FA0', highlight: '#9670BF', shadow: '#4D2A75' },
    { name: 'Mint Body', base: '#A8E6CF', highlight: '#D4F5E8', shadow: '#7DB39C' },
    { name: 'Olive Green', base: '#708238', highlight: '#96A65C', shadow: '#515D27' },
    { name: 'Coral Body', base: '#FF8C69', highlight: '#FFB49B', shadow: '#CC634A' },
    { name: 'Sunset Gold', base: '#E6B422', highlight: '#F0CC57', shadow: '#B38618' },
    { name: 'Glass Style', base: '#E0FFFF', highlight: '#F0FFFF', shadow: '#A8C8C8' },
  ],
  belly: [
    { name: 'Cream', base: '#FDF5E6', highlight: '#FFFAF0', shadow: '#F5E6D3' },
    { name: 'Peach', base: '#FFDAB9', highlight: '#FFE4C4', shadow: '#F5CBA7' },
    { name: 'Light Blue', base: '#D6EAF8', highlight: '#EBF5FB', shadow: '#AED6F1' },
    { name: 'Mint', base: '#D5F5E3', highlight: '#E8F8F5', shadow: '#ABEBC6' },
    { name: 'Lavender', base: '#E8DAEF', highlight: '#F4ECF7', shadow: '#D2B4DE' },
  ],
  beak: [
    { name: 'Small', type: 'small', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Large', type: 'large', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Wide', type: 'wide', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Pointy', type: 'pointy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Round', type: 'round', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Puffy', type: 'puffy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
  ],
  eyes: [
    { name: 'Normal', type: 'round' },
    { name: 'Happy', type: 'happy' },
    { name: 'Sad', type: 'sad' },
    { name: 'Angry', type: 'angry' },
    { name: 'Sleepy', type: 'sleepy' },
    { name: 'Surprised', type: 'surprised' },
    { name: 'Wink', type: 'wink' },
    { name: 'Side-eye', type: 'sideeye' },
    { name: 'Closed', type: 'closed' },
    { name: 'Sparkle', type: 'sparkle' },
  ],
  head: [
    { name: 'None', type: 'none' },
    { name: 'Cap Gold', type: 'cap', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' },
    { name: 'Cap Matte Black', type: 'cap', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' },
    { name: 'Cap Sapphire Blue', type: 'cap', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' },
    { name: 'Cap Crimson', type: 'cap', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' },
    { name: 'Cap Royal Gold', type: 'cap', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' },
    { name: 'Beanie Gold', type: 'beanie', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' },
    { name: 'Beanie Matte Black', type: 'beanie', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' },
    { name: 'Beanie Sapphire Blue', type: 'beanie', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' },
    { name: 'Beanie Crimson', type: 'beanie', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' },
    { name: 'Beanie Royal Gold', type: 'beanie', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' },
    { name: 'Scarf Gold', type: 'scarf', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' },
    { name: 'Scarf Matte Black', type: 'scarf', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' },
    { name: 'Scarf Sapphire Blue', type: 'scarf', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' },
    { name: 'Scarf Crimson', type: 'scarf', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' },
    { name: 'Scarf Royal Gold', type: 'scarf', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' },
    { name: 'Headband Gold', type: 'headband', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' },
    { name: 'Headband Matte Black', type: 'headband', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' },
    { name: 'Headband Sapphire Blue', type: 'headband', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' },
    { name: 'Headband Crimson', type: 'headband', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' },
    { name: 'Headband Royal Gold', type: 'headband', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' },
    { name: 'Crown Imperial', type: 'crown', style: 'imperial' },
    { name: 'Crown Elegant', type: 'crown', style: 'elegant' },
    { name: 'Halo', type: 'halo' },
  ],
}

const FALLBACK_TRAITS = {
  background: MODEL_TRAITS.background[0],
  body: MODEL_TRAITS.body[0],
  belly: MODEL_TRAITS.belly[0],
  beak: MODEL_TRAITS.beak[0],
  eyes: MODEL_TRAITS.eyes[0],
  head: MODEL_TRAITS.head[0],
}

function decodeBase64Loose(input) {
  const cleaned = String(input || '').trim().replace(/^base64,/, '').replace(/\s+/g, '')
  const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  try {
    return atob(padded)
  } catch {
    return ''
  }
}

function normalizeOnchainImage(image) {
  if (!image || typeof image !== 'string') return ''
  if (image.startsWith('data:image/')) return image
  if (image.startsWith('ipfs://')) return image.replace('ipfs://', 'https://ipfs.io/ipfs/')
  return image
}

async function optimizeImageDataUrl(inputDataUrl, opts = {}) {
  const width = Number(opts.width || 512)
  const height = Number(opts.height || 512)
  const quality = Number(opts.quality || 0.8)
  if (!inputDataUrl || !inputDataUrl.startsWith('data:image/')) return inputDataUrl

  const img = new Image()
  img.decoding = 'async'
  const loaded = new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load snapshot for compression'))
  })
  img.src = inputDataUrl
  await loaded

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return inputDataUrl
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

async function waitForConfirmationWithTimeout(provider, txHash, timeoutMs = 120000) {
  const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs)
  if (!receipt) throw new Error('Confirmation timeout')
  return receipt
}

function findByName(list, name, fallback) {
  return list.find((item) => item.name === name) || fallback
}

function traitsFromAttributes(attributes = []) {
  const map = Object.fromEntries((attributes || []).map((a) => [a.trait_type, a.value]))
  return {
    background: findByName(MODEL_TRAITS.background, map.Background, FALLBACK_TRAITS.background),
    body: findByName(MODEL_TRAITS.body, map.Body, FALLBACK_TRAITS.body),
    belly: findByName(MODEL_TRAITS.belly, map.Belly, FALLBACK_TRAITS.belly),
    beak: findByName(MODEL_TRAITS.beak, map.Beak, FALLBACK_TRAITS.beak),
    eyes: findByName(MODEL_TRAITS.eyes, map.Eyes, FALLBACK_TRAITS.eyes),
    head: findByName(MODEL_TRAITS.head, map.Head, FALLBACK_TRAITS.head),
  }
}

async function fetchTokenMetadata(provider, tokenId) {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
    const uri = await contract.tokenURI(tokenId)
    if (!uri?.startsWith('data:application/json;base64,')) return { name: '', image: '', attributes: [], revealed: null }
    const encoded = uri.split('base64,')[1]
    const raw = decodeBase64Loose(encoded)
    if (!raw) return { name: '', image: '', attributes: [], revealed: null }
    const parsed = JSON.parse(raw)
    return {
      name: parsed.name || '',
      image: normalizeOnchainImage(parsed.image || ''),
      attributes: Array.isArray(parsed.attributes) ? parsed.attributes : [],
      evolved3D: Boolean(parsed.evolved_3d),
      revealed: typeof parsed.revealed === 'boolean' ? parsed.revealed : null,
    }
  } catch {
    return { name: '', image: '', attributes: [], evolved3D: false, revealed: null }
  }
}

function EvolveGalleryItem({
  tokenId,
  selected,
  onSelect,
  selectable = true,
  showTraitsOnClick,
  onOpenTraits,
  meta = { name: '', image: '', attributes: [], evolved3D: false },
  loading = false,
  error = '',
}) {

  const handleClick = () => {
    if (selectable) onSelect({ tokenId, meta })
    if (showTraitsOnClick) onOpenTraits?.({ tokenId, meta })
  }

  return (
    <div className={`mint-gallery-item ${selected ? 'evolved' : ''}`} onClick={handleClick}>
      <div className="mint-gallery-image" style={{ cursor: 'pointer' }}>
        {meta.image ? <img src={meta.image} alt={`${meta.name || 'NFT'} #${tokenId}`} /> : <div className="mint-loading">{loading ? 'Loading...' : error || 'No image'}</div>}
      </div>
      <div className="mint-gallery-info">
        <span className="mint-gallery-id">#{tokenId}</span>
        {meta.name && <span className="mint-gallery-id">{meta.name}</span>}
        {showTraitsOnClick && <span className="mint-gallery-id">Traits: {meta.attributes?.length || 0}</span>}
        <div className="mint-gallery-actions">
          <a
            href={`${BLOCK_EXPLORER_URL}/nft/${CONTRACT_ADDRESS}/${tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mint-evolve-btn"
            onClick={(e) => e.stopPropagation()}
          >
            {'View ->'}
          </a>
        </div>
      </div>
    </div>
  )
}

function Evolve() {
  const provider = useMemo(() => new ethers.JsonRpcProvider(ETH_SEPOLIA_RPC), [])
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(0)
  const [status, setStatus] = useState('')
  const [myNFTs, setMyNFTs] = useState([])
  const [myPage, setMyPage] = useState(1)
  const [evolvedPage, setEvolvedPage] = useState(1)
  const [activeTab, setActiveTab] = useState('my')
  const [selectedNFT, setSelectedNFT] = useState(null)
  const [isEvolving, setIsEvolving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastTxHash, setLastTxHash] = useState('')
  const [metaByToken, setMetaByToken] = useState({})
  const [loadingByToken, setLoadingByToken] = useState({})
  const [errorByToken, setErrorByToken] = useState({})
  const [traitsModal, setTraitsModal] = useState(null)
  const [isLoadingNfts, setIsLoadingNfts] = useState(false)
  const [isHydratingMeta, setIsHydratingMeta] = useState(false)
  const [globalTotalMinted, setGlobalTotalMinted] = useState(0)
  const [globalEvolvedCount, setGlobalEvolvedCount] = useState(0)
  const [isLoadingGlobalProgress, setIsLoadingGlobalProgress] = useState(false)

  const isEvolvedMeta = (meta) => {
    if (!meta) return false
    if (meta.evolved3D) return true
    return (meta.attributes || []).some(
      (a) => a?.trait_type === 'Evolution' && String(a.value).toLowerCase().includes('evolved')
    )
  }
  const isUnrevealedMeta = (meta) => {
    if (!meta) return false
    return meta.revealed === false
  }
  const selectedMeta = selectedNFT ? (metaByToken[selectedNFT.tokenId] || selectedNFT.meta) : null
  const selectedIsEvolved = Boolean(selectedMeta && isEvolvedMeta(selectedMeta))
  const selectedIsUnrevealed = Boolean(selectedMeta && isUnrevealedMeta(selectedMeta))

  const fetchGlobalProgress = async (supplyHint = null) => {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
      const supplyNum = Number(supplyHint ?? (await contract.totalSupply()))
      setGlobalTotalMinted(supplyNum)
      if (supplyNum <= 0) {
        setGlobalEvolvedCount(0)
        return
      }
      setIsLoadingGlobalProgress(true)
      let evolved = 0
      const CHUNK = 6
      for (let i = 1; i <= supplyNum; i += CHUNK) {
        const batch = Array.from({ length: Math.min(CHUNK, supplyNum - i + 1) }, (_, idx) => i + idx)
        const results = await Promise.allSettled(batch.map((tokenId) => fetchTokenMetadata(provider, tokenId)))
        results.forEach((r) => {
          if (r.status !== 'fulfilled') return
          const meta = r.value
          const evolvedByFlag = Boolean(meta?.evolved3D)
          const evolvedByTrait = (meta?.attributes || []).some(
            (a) => a?.trait_type === 'Evolution' && String(a.value).toLowerCase().includes('evolved')
          )
          if (evolvedByFlag || evolvedByTrait) evolved += 1
        })
      }
      setGlobalEvolvedCount(evolved)
    } catch {
      setGlobalTotalMinted(0)
      setGlobalEvolvedCount(0)
    } finally {
      setIsLoadingGlobalProgress(false)
    }
  }

  const fetchContractData = async (address, options = {}) => {
    const silent = Boolean(options?.silent)
    if (!silent) setIsLoadingNfts(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
      const [supply] = await Promise.all([contract.totalSupply()])
      const supplyNum = Number(supply)
      setGlobalTotalMinted(supplyNum)
      const all = Array.from({ length: supplyNum }, (_, i) => ({ tokenId: i + 1 })).sort((a, b) => b.tokenId - a.tokenId)

      if (!address) {
        setMyNFTs([])
        return
      }
      const [bal] = await Promise.all([contract.balanceOf(address)])
      setBalance(Number(bal))

      const owned = []
      const lower = address.toLowerCase()
      const CHUNK = 8
      for (let i = 0; i < all.length; i += CHUNK) {
        const batch = all.slice(i, i + CHUNK)
        const results = await Promise.allSettled(batch.map((nft) => contract.ownerOf(nft.tokenId)))
        const retryIndices = []
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            if (r.value.toLowerCase() === lower) owned.push(batch[idx])
          } else {
            retryIndices.push(idx)
          }
        })
        if (retryIndices.length > 0) {
          const retryResults = await Promise.allSettled(
            retryIndices.map((idx) => contract.ownerOf(batch[idx].tokenId))
          )
          retryResults.forEach((r, rIdx) => {
            if (r.status === 'fulfilled' && r.value.toLowerCase() === lower) {
              owned.push(batch[retryIndices[rIdx]])
            }
          })
        }
      }
      setMyNFTs(owned)
    } catch (err) {
      if (!silent) setStatus(`Error: ${err.message?.slice(0, 50) || 'Unable to fetch contract'}`)
    } finally {
      if (!silent) setIsLoadingNfts(false)
    }
  }

  useEffect(() => {
    fetchContractData(null)
    fetchGlobalProgress()
  }, [])

  useEffect(() => {
    fetchGlobalProgress()
  }, [refreshKey])

  useEffect(() => {
    if (!account) return
    const lower = String(account).toLowerCase()

    const refreshOwned = () => fetchContractData(account, { silent: true })
    const onFocus = () => refreshOwned()
    const onCustom = (e) => {
      const evAcc = String(e?.detail?.account || '').toLowerCase()
      if (!evAcc || evAcc === lower) refreshOwned()
    }
    const onStorage = (e) => {
      if (e.key !== 'penguin:nft-updated' || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue)
        const evAcc = String(parsed?.account || '').toLowerCase()
        if (!evAcc || evAcc === lower) refreshOwned()
      } catch {}
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('penguin:nft-updated', onCustom)
    window.addEventListener('storage', onStorage)
    const timer = setInterval(refreshOwned, 30000)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('penguin:nft-updated', onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [account])

  const connect = async () => {
    if (!window.ethereum) {
      setStatus('Install MetaMask')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const address = accounts?.[0]
      if (!address) throw new Error('No account selected')
      setAccount(address)
      setStatus('')
      fetchContractData(address)
    } catch {
      setStatus('Connection failed')
    }
  }

  const disconnectWallet = async () => {
    setAccount(null)
    setBalance(0)
    setMyNFTs([])
    setMyPage(1)
    setEvolvedPage(1)
    setActiveTab('my')
    setSelectedNFT(null)
    setLastTxHash('')
    setMetaByToken({})
    setLoadingByToken({})
    setErrorByToken({})
    setStatus('Wallet disconnected')
  }

  const switchToEthereumSepolia = async () => {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] })
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

  const evolveSelected = () => {
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    if (!selectedNFT) {
      setStatus('Select an NFT to evolve')
      return
    }
    if (selectedIsUnrevealed) {
      setStatus(`NFT #${selectedNFT.tokenId} is unrevealed and cannot be evolved yet`)
      return
    }
    if (!selectedMeta?.attributes?.length) {
      setStatus('Select an NFT with on-chain traits')
      return
    }
    if (selectedIsEvolved) {
      setStatus(`NFT #${selectedNFT.tokenId} is already evolved to 3D`)
      return
    }
    ;(async () => {
      try {
        setIsEvolving(true)
        setLastTxHash('')
        setStatus(`Preparing 3D snapshot for #${selectedNFT.tokenId}...`)

        const modelTraits = traitsFromAttributes(selectedMeta.attributes)
        const currentAttributes = Array.isArray(selectedMeta.attributes) ? selectedMeta.attributes : []
        const hasEvolution = currentAttributes.some(
          (a) => a?.trait_type === 'Evolution' && String(a.value).toLowerCase().includes('evolved')
        )
        const updatedAttributes = hasEvolution
          ? currentAttributes
          : [...currentAttributes, { trait_type: 'Evolution', value: 'Evolved 3D' }]

        const browserProvider = new ethers.BrowserProvider(window.ethereum)
        const signer = await browserProvider.getSigner()
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)

        setStatus('Rendering 3D image...')
        const snapshot = render3DSnapshot(modelTraits, {
          width: 512,
          height: 512,
          format: 'image/jpeg',
          quality: 0.8,
          fast: false,
        })
        if (!snapshot) throw new Error('Failed to render 3D snapshot')
        if (!snapshot.startsWith('data:image/jpeg;base64,')) {
          throw new Error('Snapshot is not JPEG base64')
        }

        setStatus('Compressing image...')
        const optimizedSnapshot = await optimizeImageDataUrl(snapshot, {
          width: 512,
          height: 512,
          quality: 0.8,
        })

        if (optimizedSnapshot.length > 180000) {
          throw new Error('JPEG payload is too large for on-chain storage gas limits')
        }

        setStatus('Confirm in wallet...')
        const attrsJson = JSON.stringify(updatedAttributes)
        const tokenId = selectedNFT.tokenId
        await contract.evolveTo3D.estimateGas(tokenId, optimizedSnapshot, attrsJson)
        const tx = await contract.evolveTo3D(tokenId, optimizedSnapshot, attrsJson)

        const afterConfirmed = async () => {
          setSelectedNFT((prev) =>
            prev ? { ...prev, meta: { ...prev.meta, image: optimizedSnapshot, attributes: updatedAttributes, evolved3D: true } } : prev
          )
          setMetaByToken((prev) => ({
            ...prev,
            [tokenId]: { ...(prev[tokenId] || {}), image: optimizedSnapshot, attributes: updatedAttributes, evolved3D: true },
          }))
          try {
            const refreshedMeta = await fetchTokenMetadata(provider, tokenId)
            setMetaByToken((prev) => ({ ...prev, [tokenId]: refreshedMeta }))
            setSelectedNFT((prevSel) =>
              prevSel && prevSel.tokenId === tokenId ? { ...prevSel, meta: refreshedMeta } : prevSel
            )
          } catch {}
          setStatus(`NFT #${tokenId} evolved to 3D.`)
          setActiveTab('evolved')
          setEvolvedPage(1)
          setRefreshKey((k) => k + 1)
        }

        setLastTxHash(tx.hash)
        setStatus('Transaction sent. Confirming on-chain...')
        try {
          const receipt = await waitForConfirmationWithTimeout(browserProvider, tx.hash, 120000)
          if (!receipt || receipt.status !== 1) throw new Error('Evolve transaction reverted')
          await afterConfirmed()
        } catch (confirmErr) {
          const msg = String(confirmErr?.message || '')
          if (msg.toLowerCase().includes('timeout')) {
            setStatus('Transaction pending on-chain...')
            ;(async () => {
              for (let i = 0; i < 36; i++) {
                await new Promise((resolve) => setTimeout(resolve, 10000))
                const receipt = await browserProvider.getTransactionReceipt(tx.hash)
                if (!receipt) continue
                if (receipt.status === 1) {
                  await afterConfirmed()
                  return
                }
                setStatus('Error: evolve transaction reverted')
                return
              }
              setStatus('Still pending. Check BaseScan with the link below.')
            })()
            return
          }
          throw confirmErr
        }
      } catch (err) {
        const msg =
          err?.reason ||
          err?.shortMessage ||
          err?.info?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Evolve failed'
        if (String(msg).toLowerCase().includes('too large')) {
          setStatus('Error: JPEG snapshot is too large for on-chain gas limit.')
        } else {
          setStatus(`Error: ${String(msg).slice(0, 160)}`)
        }
      } finally {
        setIsEvolving(false)
      }
    })()
  }

  const evolvedNFTs = useMemo(
    () => myNFTs.filter((nft) => isEvolvedMeta(metaByToken[nft.tokenId])),
    [myNFTs, metaByToken]
  )
  const twoDNFTs = useMemo(
    () => myNFTs.filter((nft) => !isEvolvedMeta(metaByToken[nft.tokenId])),
    [myNFTs, metaByToken]
  )
  const shownNFTs = activeTab === 'evolved' ? evolvedNFTs : twoDNFTs
  const page = activeTab === 'evolved' ? evolvedPage : myPage
  const setPage = activeTab === 'evolved' ? setEvolvedPage : setMyPage
  const ITEMS_PER_PAGE = 10
  const remainingToEvolve = Math.max(globalTotalMinted - globalEvolvedCount, 0)
  const evolveProgress = globalTotalMinted > 0 ? (globalEvolvedCount / globalTotalMinted) * 100 : 0
  const totalPages = Math.max(1, Math.ceil(shownNFTs.length / ITEMS_PER_PAGE))
  const paginated = useMemo(() => shownNFTs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [shownNFTs, page])
  const pageTokenIds = paginated.map((n) => n.tokenId)
  const myTokenIdsKey = myNFTs.map((n) => n.tokenId).join(',')

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages, setPage])

  useEffect(() => {
    let cancelled = false
    if (!account || myNFTs.length === 0) {
      setIsHydratingMeta(false)
      return
    }
    const idsToFetch = myNFTs.map((n) => n.tokenId).filter((id) => !metaByToken[id])
    if (idsToFetch.length === 0) {
      setIsHydratingMeta(false)
      return
    }

    setIsHydratingMeta(true)
    setLoadingByToken((prev) => {
      const next = { ...prev }
      idsToFetch.forEach((id) => {
        next[id] = true
      })
      return next
    })

    ;(async () => {
      const CHUNK = 6
      for (let i = 0; i < idsToFetch.length; i += CHUNK) {
        const batch = idsToFetch.slice(i, i + CHUNK)
        const results = await Promise.allSettled(batch.map((id) => fetchTokenMetadata(provider, id)))
        if (cancelled) return
        const nextMeta = {}
        const nextErr = {}
        const nextLoading = {}
        results.forEach((result, idx) => {
          const id = batch[idx]
          if (result.status === 'fulfilled') {
            nextMeta[id] = result.value
            nextErr[id] = ''
          } else {
            nextErr[id] = 'Failed to load'
          }
          nextLoading[id] = false
        })
        setMetaByToken((prev) => ({ ...prev, ...nextMeta }))
        setErrorByToken((prev) => ({ ...prev, ...nextErr }))
        setLoadingByToken((prev) => ({ ...prev, ...nextLoading }))
      }
      if (!cancelled) setIsHydratingMeta(false)
    })()

    return () => {
      cancelled = true
    }
  }, [account, myTokenIdsKey, refreshKey, provider])

  return (
    <>
    <div className="mint-page evolve-page">
      <header>
        <h1>8bit Penguins</h1>
        <p>SELECT - EVOLVE - 3D</p>
        <div className="header-links">
          <a href="https://x.com/8bitpenguins" target="_blank" rel="noopener noreferrer" className="x-btn">Follow us on X</a>
        </div>
      </header>

      <div className="mint-layout">
        <div className="mint-card">
          <div className="mint-card-header">
            <span className="mint-card-title">Evolve</span>
            <span className="mint-card-badge">3D</span>
          </div>

          <div className="mint-supply">
            <div className="mint-supply-header">
              <span className="mint-supply-label">Collection Evolved</span>
              <span className="mint-supply-value">{globalEvolvedCount}<span> / {globalTotalMinted}</span></span>
            </div>
            <div className="mint-supply-bar">
              <div className="mint-supply-fill" style={{ width: `${evolveProgress}%` }}></div>
            </div>
            <div className="mint-supply-footer">
              <span>{isLoadingGlobalProgress ? 'Updating...' : `${remainingToEvolve} remaining`}</span>
              <span>{Math.round(evolveProgress)}%</span>
            </div>
          </div>

          <button className="mint-network-btn" onClick={switchToEthereumSepolia}>Switch to Ethereum Sepolia</button>

          {!account ? (
            <button className="mint-connect-btn" onClick={connect}>Connect Wallet</button>
          ) : (
            <div className="mint-connected">
              <div className="mint-wallet">
                <div className="mint-wallet-main">
                  <button className="mint-wallet-addr-btn" disabled>{account.slice(0, 4)}...{account.slice(-3)}</button>
                  <span className="mint-wallet-bal">{balance} Penguins</span>
                </div>
                <button className="mint-disconnect-btn" onClick={disconnectWallet}>Disconnect</button>
              </div>

            </div>
          )}

          {activeTab !== 'evolved' && selectedNFT && (
            <div className="evolve-selected-card">
              <div className="evolve-selected-head">
                <span>Selected NFT</span>
                <span>#{selectedNFT.tokenId}</span>
              </div>
              {selectedNFT.meta?.image && (
                <img
                  className="evolve-selected-image"
                  src={selectedNFT.meta.image}
                  alt={selectedNFT.meta?.name || `NFT #${selectedNFT.tokenId}`}
                />
              )}
              <div className="evolve-selected-meta">
                <strong>{selectedNFT.meta?.name || '8bit Penguin'}</strong>
                <span>{selectedNFT.meta?.attributes?.length || 0} traits</span>
              </div>
            </div>
          )}
          {activeTab !== 'evolved' && selectedNFT && (
            <button className="mint-submit-btn" onClick={evolveSelected} disabled={!selectedNFT || isEvolving || selectedIsEvolved || selectedIsUnrevealed}>
              {isEvolving
                ? 'Evolving...'
                : (
                  selectedIsEvolved
                    ? `#${selectedNFT.tokenId} Already 3D`
                    : selectedIsUnrevealed
                      ? `#${selectedNFT.tokenId} Unrevealed`
                      : `Evolve #${selectedNFT.tokenId} to 3D`
                )}
            </button>
          )}
          {status && <div className={`mint-status ${status.includes('Error') ? 'error' : ''}`}>{status}</div>}
          {lastTxHash && (
            <a
              href={`${BLOCK_EXPLORER_URL}/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mint-tx-link"
            >
              {'View Evolve Transaction ->'}
            </a>
          )}
        </div>

        <div className="mint-display">
          <div className="mint-tabs">
            <button
              className={`mint-tab ${activeTab === 'my' ? 'active' : ''}`}
              onClick={() => { setActiveTab('my'); setMyPage(1) }}
            >
              {`My 2D NFTs (${twoDNFTs.length})`}
            </button>
            <button
              className={`mint-tab ${activeTab === 'evolved' ? 'active' : ''}`}
              onClick={() => { setActiveTab('evolved'); setEvolvedPage(1); setSelectedNFT(null) }}
            >
              {`My 3D NFTs (${evolvedNFTs.length})`}
            </button>
          </div>

          <div className="mint-tab-content">
            {!account ? (
              <div className="mint-empty">Connect wallet to view your NFTs</div>
            ) : isLoadingNfts || isHydratingMeta ? (
              <div className="mint-empty">Loading NFTs...</div>
            ) : shownNFTs.length === 0 ? (
              <div className="mint-empty">
                {activeTab === 'evolved' ? 'No evolved NFTs yet' : 'No NFTs found in this wallet'}
              </div>
            ) : (
              <>
                <div className="mint-gallery-grid">
                  {paginated.map((nft) => (
                    <EvolveGalleryItem
                      key={`my-${nft.tokenId}-${refreshKey}`}
                      tokenId={nft.tokenId}
                      selected={selectedNFT?.tokenId === nft.tokenId}
                      meta={metaByToken[nft.tokenId]}
                      loading={Boolean(loadingByToken[nft.tokenId])}
                      error={errorByToken[nft.tokenId] || ''}
                      selectable={activeTab !== 'evolved'}
                      showTraitsOnClick={activeTab === 'evolved'}
                      onOpenTraits={(payload) => setTraitsModal(payload)}
                      onSelect={setSelectedNFT}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mint-pagination">
                    <button className="mint-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                    <span className="mint-page-info">{page} / {totalPages}</span>
                    <button className="mint-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {traitsModal && (
        <div className="mint-traits-modal-overlay" onClick={() => setTraitsModal(null)}>
          <div className="mint-traits-modal" onClick={(e) => e.stopPropagation()}>
            <button className="mint-traits-close" onClick={() => setTraitsModal(null)}>X</button>
            <h3>
              #{traitsModal.tokenId}
              {traitsModal.meta?.name ? ` - ${traitsModal.meta.name}` : ''}
            </h3>
            {traitsModal.meta?.image && (
              <img src={traitsModal.meta.image} alt={traitsModal.meta?.name || `NFT #${traitsModal.tokenId}`} />
            )}
            <div className="mint-gallery-traits">
              {(traitsModal.meta?.attributes || []).length ? (
                traitsModal.meta.attributes.map((attr, idx) => (
                  <span key={`${traitsModal.tokenId}-${idx}`} className="mint-gallery-trait">
                    {attr.trait_type}: {String(attr.value)}
                  </span>
                ))
              ) : (
                <span className="mint-gallery-trait">No traits available</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default Evolve






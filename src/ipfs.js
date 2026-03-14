const PINATA_JWT = import.meta.env.VITE_PINATA_JWT
const JSONBIN_KEY = import.meta.env.VITE_JSONBIN_KEY
const JSONBIN_BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"
const GALLERY_API_PATH = '/api/gallery'
const GALLERY_CACHE_KEY = 'sharedGalleryCache'
const MAX_SAVE_RETRIES = 2

function getGalleryCache() {
  try {
    const cached = localStorage.getItem(GALLERY_CACHE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

function setGalleryCache(data) {
  try {
    localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(data))
  } catch {
    // Storage unavailable
  }
}

function getPenguinKey(penguin) {
  if (!penguin) return ''
  if (penguin.cid) return `cid:${penguin.cid}`
  if (penguin.id != null) return `id:${penguin.id}`
  if (penguin.image) return `image:${penguin.image}`
  return `ts:${penguin.timestamp || 0}`
}

function mergeGalleryEntries(...collections) {
  const byKey = new Map()

  collections.flat().forEach((penguin) => {
    const key = getPenguinKey(penguin)
    if (!key) return
    const existing = byKey.get(key)
    byKey.set(key, existing ? { ...existing, ...penguin } : penguin)
  })

  return Array.from(byKey.values()).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
}

async function fetchGalleryViaApi() {
  const res = await fetch(GALLERY_API_PATH, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Gallery API GET failed: ${res.status}`)
  }

  const data = await res.json()
  return Array.isArray(data.penguins) ? data.penguins : []
}

async function saveGalleryViaApi(penguin) {
  const res = await fetch(GALLERY_API_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(penguin),
  })

  if (!res.ok) {
    throw new Error(`Gallery API POST failed: ${res.status}`)
  }

  const data = await res.json()
  return Array.isArray(data.penguins) ? data.penguins : []
}

function canUseDirectJsonBinFallback() {
  return import.meta.env.DEV && Boolean(JSONBIN_KEY && JSONBIN_BIN_ID)
}

async function fetchGalleryRecord() {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
    headers: { "X-Access-Key": JSONBIN_KEY }
  })

  if (!res.ok) {
    return []
  }

  const data = await res.json()
  return Array.isArray(data.record?.penguins) ? data.record.penguins : []
}

export async function uploadToIPFS(canvasRef) {
  const canvas = canvasRef?.current
  if (!canvas) return null
  return uploadCanvasToIPFS(canvas)
}

export async function uploadCanvasToIPFS(canvas) {
  if (!PINATA_JWT) {
    console.error("Pinata JWT not configured. Set VITE_PINATA_JWT in .env")
    return null
  }

  const dataUrl = canvas.toDataURL("image/png")
  
  const base64Data = dataUrl.split(",")[1]
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  
  const formData = new FormData()
  formData.append("file", new Blob([bytes], { type: "image/png" }))
  
  const options = JSON.stringify({
    name: `penguin_${Date.now()}.png`,
    keyvalues: {
      timestamp: Date.now().toString()
    }
  })
  formData.append("pinataOptions", options)

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PINATA_JWT}`
      },
      body: formData
    })
    
    const data = await res.json()
    if (data.IpfsHash) {
      return {
        cid: data.IpfsHash,
        url: IPFS_GATEWAY + data.IpfsHash
      }
    }
    return null
  } catch (err) {
    console.error("IPFS upload error:", err)
    return null
  }
}

export function getIPFSUrl(cid) {
  if (!cid) return null
  return IPFS_GATEWAY + cid
}

export async function saveToSharedGallery(penguin) {
  try {
    const apiGallery = await saveGalleryViaApi(penguin)
    setGalleryCache(apiGallery)
    return true
  } catch (apiError) {
    if (!canUseDirectJsonBinFallback()) {
      console.error("Error saving to shared gallery:", apiError)
      return null
    }
  }

  if (!JSONBIN_KEY || !JSONBIN_BIN_ID) {
    return null
  }

  try {
    const targetKey = getPenguinKey(penguin)

    for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt += 1) {
      const gallery = mergeGalleryEntries([penguin], await fetchGalleryRecord())

      await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
        method: "PUT",
        headers: {
          "X-Access-Key": JSONBIN_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ penguins: gallery })
      })

      const confirmedGallery = await fetchGalleryRecord()
      const mergedGallery = mergeGalleryEntries(confirmedGallery, [penguin])
      const isSaved = confirmedGallery.some((entry) => getPenguinKey(entry) === targetKey)

      setGalleryCache(mergedGallery)

      if (isSaved) {
        return true
      }
    }

    return null
  } catch (err) {
    console.error("Error saving to shared gallery:", err)
    return null
  }
}

export async function fetchSharedGallery() {
  // Check cache first
  const cached = getGalleryCache()
  if (cached && cached.length > 0) {
    return cached
  }

  return fetchFreshGallery()
}

export async function fetchFreshGallery() {
  try {
    const gallery = await fetchGalleryViaApi()
    setGalleryCache(gallery)
    return gallery
  } catch (apiError) {
    if (!canUseDirectJsonBinFallback()) {
      return []
    }
  }

  try {
    const gallery = await fetchGalleryRecord()
    
    // Cache the result
    setGalleryCache(gallery)
    
    return gallery
  } catch {
    return []
  }
}

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT
const JSONBIN_KEY = import.meta.env.VITE_JSONBIN_KEY
const JSONBIN_BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"
const GALLERY_CACHE_KEY = 'sharedGalleryCache'

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

export async function uploadToIPFS(canvasRef) {
  if (!PINATA_JWT) {
    console.error("Pinata JWT not configured. Set VITE_PINATA_JWT in .env")
    return null
  }
  
  const canvas = canvasRef.current
  if (!canvas) return null

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
  if (!JSONBIN_KEY || !JSONBIN_BIN_ID) {
    return null
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { "X-Access-Key": JSONBIN_KEY }
    })
    
    let gallery = []
    if (res.ok) {
      const data = await res.json()
      gallery = data.record?.penguins || []
    }
    
    gallery.unshift(penguin)
    
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: "PUT",
      headers: {
        "X-Access-Key": JSONBIN_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ penguins: gallery })
    })
    
    // Update cache
    setGalleryCache(gallery)
    
    return true
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

  if (!JSONBIN_KEY || !JSONBIN_BIN_ID) {
    return []
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { "X-Access-Key": JSONBIN_KEY }
    })
    
    if (!res.ok) return []
    
    const data = await res.json()
    const gallery = data.record?.penguins || []
    
    // Cache the result
    setGalleryCache(gallery)
    
    return gallery
  } catch {
    return []
  }
}

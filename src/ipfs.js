const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'
const IPFS_UPLOAD_API_PATH = '/api/ipfs-upload'
const SHARED_GALLERY_API_PATH = '/api/gallery'
const SHARED_GALLERY_STORAGE_KEY = 'sharedGallery'

export async function uploadToIPFS(canvasRef) {
  const canvas = canvasRef?.current
  if (!canvas) return null
  return uploadCanvasToIPFS(canvas)
}

function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null
  const [header, base64Data] = dataUrl.split(',', 2)
  if (!header || !base64Data) return null

  const mimeMatch = header.match(/^data:([^;]+);base64$/i)
  const mimeType = mimeMatch?.[1] || 'application/octet-stream'
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export async function uploadBlobToIPFS(fileBlob, options = {}) {
  if (!fileBlob) {
    throw new Error('No file available for IPFS upload.')
  }

  const extension = options.extension || (fileBlob.type === 'image/jpeg' ? 'jpg' : 'png')
  const timestamp = Date.now().toString()
  const fileName = options.fileName || `penguin_${timestamp}.${extension}`

  const formData = new FormData()
  formData.append('file', fileBlob, fileName)
  formData.append(
    'pinataOptions',
    JSON.stringify({
      name: fileName,
      keyvalues: {
        timestamp,
        ...(options.keyvalues || {}),
      },
    })
  )

  try {
    const res = await fetch(IPFS_UPLOAD_API_PATH, {
      method: 'POST',
      body: formData,
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(String(data?.error || `IPFS upload failed with status ${res.status}`))
    }

    if (data?.cid && data?.url) {
      return {
        cid: data.cid,
        url: data.url,
      }
    }

    if (data?.IpfsHash) {
      return {
        cid: data.IpfsHash,
        url: IPFS_GATEWAY + data.IpfsHash,
      }
    }

    throw new Error('IPFS upload backend returned an unexpected response.')
  } catch (err) {
    console.error('IPFS upload error:', err)
    const message = err instanceof Error ? err.message : String(err)
    const normalized = message.toLowerCase()

    if (normalized.includes('failed to fetch') || normalized.includes('networkerror')) {
      throw new Error('Upload backend unreachable. Run `npm run dev` (full stack) or deploy /api/ipfs-upload.')
    }

    if (normalized.includes('pinata upload backend is not configured')) {
      throw new Error('Upload backend not configured. Set PINATA_JWT for /api/ipfs-upload.')
    }
    if (normalized.includes('origin is not allowed')) {
      throw new Error('Upload origin not allowed. Add this site to ALLOWED_ORIGINS or ALLOWED_ORIGIN_SUFFIXES.')
    }
    if (normalized.includes('upload payload is too large')) {
      throw new Error('Upload payload too large. Lower image size or increase IPFS_UPLOAD_MAX_BYTES.')
    }
    if (normalized.includes('rate limit exceeded')) {
      throw new Error('Upload rate limited. Wait briefly and retry.')
    }
    if (normalized.includes('ipfs upload timed out')) {
      throw new Error('Upload timed out. Retry in a moment.')
    }

    throw err instanceof Error ? err : new Error(message)
  }
}

export async function uploadCanvasToIPFS(canvas) {
  const dataUrl = canvas.toDataURL('image/png')
  return uploadDataUrlToIPFS(dataUrl, { extension: 'png' })
}

export async function uploadDataUrlToIPFS(dataUrl, options = {}) {
  const fileBlob = dataUrlToBlob(dataUrl)
  if (!fileBlob) {
    throw new Error('Generated image data is invalid for IPFS upload.')
  }
  return uploadBlobToIPFS(fileBlob, options)
}

export function getIPFSUrl(cid) {
  if (!cid) return null
  return IPFS_GATEWAY + cid
}

function getLocalStorageSafe() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeGalleryItem(item) {
  if (!item || typeof item !== 'object') return null
  const normalized = {
    ...item,
    id: Number(item.id || Date.now()),
    timestamp: Number(item.timestamp || Date.now()),
  }
  return Number.isFinite(normalized.id) ? normalized : null
}

function readSharedGalleryFromStorage() {
  const storage = getLocalStorageSafe()
  if (!storage) return []
  try {
    const raw = storage.getItem(SHARED_GALLERY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeGalleryItem)
      .filter(Boolean)
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
  } catch {
    return []
  }
}

function writeSharedGalleryToStorage(items) {
  const storage = getLocalStorageSafe()
  if (!storage) return
  try {
    storage.setItem(SHARED_GALLERY_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignore write failures.
  }
}

function mergeById(items) {
  const deduped = new Map()
  for (const item of items) {
    const normalized = normalizeGalleryItem(item)
    if (!normalized) continue
    deduped.set(normalized.id, normalized)
  }
  return Array.from(deduped.values()).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
}

export async function fetchFreshGallery() {
  const cached = readSharedGalleryFromStorage()
  try {
    const res = await fetch(SHARED_GALLERY_API_PATH, { method: 'GET' })
    if (!res.ok) {
      return cached
    }
    const data = await res.json().catch(() => [])
    const remote = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.penguins)
        ? data.penguins
        : (Array.isArray(data) ? data : [])
    const merged = mergeById([...remote, ...cached])
    writeSharedGalleryToStorage(merged)
    return merged
  } catch {
    return cached
  }
}

export async function saveToSharedGallery(item) {
  const cached = readSharedGalleryFromStorage()
  const merged = mergeById([item, ...cached])
  writeSharedGalleryToStorage(merged)

  try {
    await fetch(SHARED_GALLERY_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  } catch {
    // Keep local copy if remote gallery endpoint is unavailable.
  }

  return merged
}

const JSONBIN_KEY = process.env.JSONBIN_KEY || process.env.VITE_JSONBIN_KEY
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || process.env.VITE_JSONBIN_BIN_ID

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

async function fetchGalleryRecord() {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
    headers: { 'X-Access-Key': JSONBIN_KEY },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`JSONBin GET failed: ${res.status} ${errorText}`)
  }

  const data = await res.json()
  return Array.isArray(data.record?.penguins) ? data.record.penguins : []
}

async function writeGalleryRecord(gallery) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: {
      'X-Access-Key': JSONBIN_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ penguins: gallery }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`JSONBin PUT failed: ${res.status} ${errorText}`)
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (!JSONBIN_KEY || !JSONBIN_BIN_ID) {
    res.status(500).json({ error: 'Gallery backend is not configured.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const gallery = await fetchGalleryRecord()
      res.status(200).json({ penguins: gallery })
      return
    }

    if (req.method === 'POST') {
      const penguin = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
      if (!penguin || typeof penguin !== 'object') {
        res.status(400).json({ error: 'Invalid penguin payload.' })
        return
      }

      const gallery = mergeGalleryEntries([penguin], await fetchGalleryRecord())
      await writeGalleryRecord(gallery)
      const confirmedGallery = mergeGalleryEntries(await fetchGalleryRecord(), [penguin])
      res.status(200).json({ ok: true, penguins: confirmedGallery })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (error) {
    res.status(502).json({
      error: 'Gallery backend request failed.',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"

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

export async function uploadMetadataToIPFS(penguinData) {
  if (!PINATA_JWT) {
    console.error("Pinata JWT not configured. Set VITE_PINATA_JWT in .env")
    return null
  }

  const metadata = {
    name: penguinData.isOg ? `OG Penguin #${penguinData.id}` : `8bit Penguin #${penguinData.id}`,
    description: penguinData.isOg ? "Transform PFP - Custom OG Penguin" : "Generated 8-bit Penguin NFT",
    image: penguinData.image,
    attributes: penguinData.isOg ? [] : [
      { trait_type: "Background", value: penguinData.traits.background.name },
      { trait_type: "Body", value: penguinData.traits.body.name },
      { trait_type: "Belly", value: penguinData.traits.belly.name },
      { trait_type: "Beak", value: penguinData.traits.beak.name },
      { trait_type: "Eyes", value: penguinData.traits.eyes.name },
      { trait_type: "Head", value: penguinData.traits.head.name }
    ],
    timestamp: penguinData.timestamp || Date.now()
  }

  const formData = new FormData()
  formData.append("file", new Blob([JSON.stringify(metadata)], { type: "application/json" }))
  
  const options = JSON.stringify({
    name: `penguin_metadata_${penguinData.id}.json`,
    keyvalues: { timestamp: Date.now().toString() }
  })
  formData.append("pinataOptions", options)

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PINATA_JWT}` },
      body: formData
    })
    
    const data = await res.json()
    if (data.IpfsHash) {
      return { cid: data.IpfsHash, url: IPFS_GATEWAY + data.IpfsHash }
    }
    return null
  } catch (err) {
    console.error("IPFS metadata upload error:", err)
    return null
  }
}

const JSONBIN_KEY = import.meta.env.VITE_JSONBIN_KEY
const JSONBIN_BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID

export async function saveToSharedGallery(penguin) {
  if (!JSONBIN_KEY || !JSONBIN_BIN_ID) {
    console.log("JSONBin not configured. Set VITE_JSONBIN_KEY and VITE_JSONBIN_BIN_ID in .env for shared gallery")
    return null
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { "X-Access-Key": JSONBIN_KEY }
    })
    const data = await res.json()
    const gallery = data.record?.penguins || []
    
    gallery.unshift(penguin)
    
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: "PUT",
      headers: {
        "X-Access-Key": JSONBIN_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ penguins: gallery })
    })
    
    return true
  } catch (err) {
    console.error("Error saving to shared gallery:", err)
    return null
  }
}

export async function fetchSharedGallery() {
  if (!JSONBIN_KEY || !JSONBIN_BIN_ID) {
    console.log("JSONBin not configured. Set VITE_JSONBIN_KEY and VITE_JSONBIN_BIN_ID in .env for shared gallery")
    return []
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { "X-Access-Key": JSONBIN_KEY }
    })
    const data = await res.json()
    return data.record?.penguins || []
  } catch (err) {
    console.error("Error fetching shared gallery:", err)
    return []
  }
}

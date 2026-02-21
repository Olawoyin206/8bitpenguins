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

export function getIPFSUrl(cid) {
  if (!cid) return null
  return IPFS_GATEWAY + cid
}

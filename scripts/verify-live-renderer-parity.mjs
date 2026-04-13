import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, loadImage } from 'canvas'
import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`Unsupported element: ${tag}`)
    return createCanvas(0, 0)
  },
}

const rootDir = process.cwd()
const artifactDir = path.join(rootDir, 'tmp-render-compare', 'live-parity')
fs.mkdirSync(artifactDir, { recursive: true })

const { renderPenguinSVG, MINT_TRUE_SVG_OPTIONS } = await import('../src/penguinSvg.js')
const { rebuildMintTraitsFromAttributes } = await import('../src/mintTraits.js')

const RPC_URL =
  process.env.ETH_MAINNET_RPC_URL ||
  process.env.MAINNET_RPC_URL ||
  process.env.ETH_SEPOLIA_RPC_URL ||
  process.env.VITE_RPC_URL ||
  'https://ethereum-rpc.publicnode.com'
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || '').trim()
const SAMPLE_COUNT = Math.max(1, Number(process.env.SAMPLE_COUNT || process.argv[2] || 8))

if (!CONTRACT_ADDRESS) {
  throw new Error('Missing CONTRACT_ADDRESS or VITE_CONTRACT_ADDRESS')
}

const abi = [
  'function totalSupply() view returns (uint256)',
  'function getOnchainRenderer() view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
]

function decodeBase64JsonDataUri(dataUri) {
  const prefix = 'data:application/json;base64,'
  if (!dataUri.startsWith(prefix)) {
    throw new Error(`Unsupported tokenURI format: ${dataUri.slice(0, 32)}`)
  }
  return JSON.parse(Buffer.from(dataUri.slice(prefix.length), 'base64').toString('utf8'))
}

function decodeSvgDataUri(dataUri) {
  const base64Prefix = 'data:image/svg+xml;base64,'
  const utf8Prefix = 'data:image/svg+xml;utf8,'
  if (dataUri.startsWith(base64Prefix)) {
    return Buffer.from(dataUri.slice(base64Prefix.length), 'base64').toString('utf8')
  }
  if (dataUri.startsWith(utf8Prefix)) {
    return decodeURIComponent(dataUri.slice(utf8Prefix.length))
  }
  return null
}

function ensureSvgSize(svg, size = 256) {
  return /<svg[^>]*width=/.test(svg)
    ? svg
    : svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
}

async function rasterizeSvg(svg, size = 256) {
  const image = await loadImage(Buffer.from(ensureSvgSize(svg, size)))
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(image, 0, 0, size, size)
  return { canvas, data: ctx.getImageData(0, 0, size, size).data }
}

function diffPixels(a, b) {
  const diffCanvas = createCanvas(256, 256)
  const diffCtx = diffCanvas.getContext('2d')
  const imageData = diffCtx.createImageData(256, 256)
  let differentPixels = 0
  for (let i = 0; i < a.length; i += 4) {
    const changed = a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]
    if (!changed) continue
    differentPixels += 1
    imageData.data[i] = 255
    imageData.data[i + 1] = 0
    imageData.data[i + 2] = 0
    imageData.data[i + 3] = 255
  }
  diffCtx.putImageData(imageData, 0, 0)
  return { differentPixels, diffCanvas }
}

function mintTrueSvgWithoutWatermark(traits) {
  return renderPenguinSVG(traits, {
    ...MINT_TRUE_SVG_OPTIONS,
    watermark: false,
  })
}

function traitSummary(attributes) {
  return Object.fromEntries(
    (Array.isArray(attributes) ? attributes : [])
      .filter((entry) => entry?.trait_type && entry?.value)
      .map((entry) => [entry.trait_type, entry.value])
  )
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
  const [totalSupplyRaw, renderer] = await Promise.all([
    contract.totalSupply(),
    contract.getOnchainRenderer(),
  ])
  const totalSupply = Number(totalSupplyRaw)

  console.log(`RPC: ${RPC_URL}`)
  console.log(`Contract: ${CONTRACT_ADDRESS}`)
  console.log(`Renderer: ${renderer}`)
  console.log(`Total supply: ${totalSupply}`)

  const startTokenId = Math.max(1, totalSupply - SAMPLE_COUNT + 1)
  let checked = 0
  let worst = null

  for (let tokenId = totalSupply; tokenId >= startTokenId; tokenId -= 1) {
    const tokenUri = await contract.tokenURI(tokenId)
    const metadata = decodeBase64JsonDataUri(tokenUri)
    const onchainSvg = decodeSvgDataUri(metadata.image)
    if (!onchainSvg) {
      console.log(`token ${tokenId}: skipped, non-inline image`)
      continue
    }
    const traits = rebuildMintTraitsFromAttributes(metadata.attributes)
    const missingGroups = Object.entries(traits).filter(([, value]) => !value).map(([key]) => key)
    if (missingGroups.length > 0) {
      console.log(`token ${tokenId}: skipped, missing traits for ${missingGroups.join(', ')}`)
      continue
    }

    const localSvg = mintTrueSvgWithoutWatermark(traits)
    const [live, local] = await Promise.all([rasterizeSvg(onchainSvg), rasterizeSvg(localSvg)])
    const diff = diffPixels(live.data, local.data)
    checked += 1

    if (!worst || diff.differentPixels > worst.differentPixels) {
      worst = {
        tokenId,
        metadata,
        traits,
        onchainSvg,
        localSvg,
        liveCanvas: live.canvas,
        localCanvas: local.canvas,
        diffCanvas: diff.diffCanvas,
        differentPixels: diff.differentPixels,
      }
    }

    console.log(`token ${tokenId}: ${diff.differentPixels} px`)
  }

  if (!checked || !worst) {
    throw new Error('No tokens were successfully checked')
  }

  fs.writeFileSync(path.join(artifactDir, 'live-onchain.svg'), worst.onchainSvg)
  fs.writeFileSync(path.join(artifactDir, 'local-generate.svg'), worst.localSvg)
  fs.writeFileSync(path.join(artifactDir, 'live-onchain.png'), worst.liveCanvas.toBuffer('image/png'))
  fs.writeFileSync(path.join(artifactDir, 'local-generate.png'), worst.localCanvas.toBuffer('image/png'))
  fs.writeFileSync(path.join(artifactDir, 'diff.png'), worst.diffCanvas.toBuffer('image/png'))
  fs.writeFileSync(path.join(artifactDir, 'metadata.json'), JSON.stringify(worst.metadata, null, 2))
  fs.writeFileSync(path.join(artifactDir, 'traits-summary.json'), JSON.stringify(traitSummary(worst.metadata.attributes), null, 2))

  console.log(`Checked: ${checked}`)
  console.log(`Worst token: ${worst.tokenId}`)
  console.log(`Worst diff: ${worst.differentPixels} px`)
  console.log(`Artifacts: ${artifactDir}`)
  console.log(JSON.stringify(traitSummary(worst.metadata.attributes), null, 2))
}

await main()

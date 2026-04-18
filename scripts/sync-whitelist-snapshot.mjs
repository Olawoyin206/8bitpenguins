import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { ethers } from 'ethers'
import * as XLSX from 'xlsx'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

const DEFAULT_CONTRACT_ADDRESS = '0xC15C47C75baAB1D22954DC5E814B520FdE809729'
const DEFAULT_RPC_URL = 'https://ethereum-rpc.publicnode.com'
const DEFAULT_SNAPSHOT_FILE = 'cache/whitelist-snapshot.json'

function readArg(name) {
  const index = process.argv.findIndex((entry) => entry === name)
  if (index < 0) return ''
  return String(process.argv[index + 1] || '').trim()
}

function readContractAddress() {
  const fromArg = readArg('--contract')
  if (fromArg) return fromArg
  return String(
    process.env.WHITELIST_GATE_ADDRESS
    || process.env.ADMIN_MINT_GATE_ADDRESS
    || process.env.VITE_MINT_GATE_ADDRESS
    || process.env.ADMIN_CONTRACT_ADDRESS
    || process.env.VITE_CONTRACT_ADDRESS
    || process.env.CONTRACT_ADDRESS
    || DEFAULT_CONTRACT_ADDRESS
  ).trim()
}

function readRpcUrl() {
  const fromArg = readArg('--rpc')
  if (fromArg) return fromArg
  return String(
    process.env.MAINNET_RPC_URL
    || process.env.ETH_MAINNET_RPC_URL
    || process.env.VITE_RPC_URL
    || process.env.ETH_SEPOLIA_RPC_URL
    || DEFAULT_RPC_URL
  ).trim()
}

function resolveSnapshotOutputPath() {
  const fromArg = readArg('--out')
  const configured = String(fromArg || process.env.WHITELIST_SNAPSHOT_FILE || DEFAULT_SNAPSHOT_FILE).trim()
  if (!configured) return path.resolve(process.cwd(), DEFAULT_SNAPSHOT_FILE)
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured)
}

function normalizeAddress(value) {
  try {
    return ethers.getAddress(String(value || '').trim())
  } catch {
    return ''
  }
}

function normalizePhaseKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\-:/]+/g, ' ')
    .replace(/[()[\]{}.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseSheetConfig() {
  const raw = String(process.env.WHITELIST_PHASE_SHEETS || '').trim()
  if (!raw) return {}
  if (/^https?:\/\//i.test(raw)) {
    return { '*': raw }
  }
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function resolveSheetUrl(phaseId, phaseName) {
  const configured = parseSheetConfig()
  const phaseIdKey = String(Number(phaseId))
  if (configured[phaseIdKey]) return String(configured[phaseIdKey]).trim()

  const normalizedPhaseName = normalizePhaseKey(phaseName)
  if (normalizedPhaseName && configured[normalizedPhaseName]) {
    return String(configured[normalizedPhaseName]).trim()
  }

  const envByPhaseId = String(process.env[`WHITELIST_SHEET_PHASE_${phaseIdKey}`] || '').trim()
  if (envByPhaseId) return envByPhaseId

  if (normalizedPhaseName) {
    const envKey = `WHITELIST_SHEET_${normalizedPhaseName.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
    const envByName = String(process.env[envKey] || '').trim()
    if (envByName) return envByName
  }

  if (configured['*']) return String(configured['*']).trim()

  const envDefault = String(
    process.env.WHITELIST_WORKBOOK_URL
    || process.env.WHITELIST_GOOGLE_SHEET_URL
    || process.env.WHITELIST_SHEET_URL
    || ''
  ).trim()
  if (envDefault) return envDefault

  return ''
}

function isGoogleSpreadsheetUrl(url) {
  return /docs\.google\.com\/spreadsheets\/d\//i.test(String(url || ''))
}

function hasGoogleSheetGid(rawUrl) {
  try {
    const url = new URL(String(rawUrl || '').trim())
    const hashGidMatch = String(url.hash || '').match(/gid=(\d+)/)
    return Boolean(url.searchParams.get('gid') || hashGidMatch?.[1])
  } catch {
    return false
  }
}

function buildGoogleSheetExportUrl(rawUrl) {
  const url = new URL(String(rawUrl || '').trim())
  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error('Invalid Google Sheets URL')
  }
  const hashGidMatch = String(url.hash || '').match(/gid=(\d+)/)
  const gid = url.searchParams.get('gid') || hashGidMatch?.[1] || '0'
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
}

function buildGoogleSheetWorkbookExportUrl(rawUrl) {
  const url = new URL(String(rawUrl || '').trim())
  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error('Invalid Google Sheets URL')
  }
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`
}

function extractPhaseOrdinal(value) {
  const normalized = normalizePhaseKey(value)
  if (!normalized) return 0
  const match = normalized.match(/\b(?:phase|p)?\s*(\d+)\b/)
  if (!match) return 0
  return Number(match[1] || 0)
}

function buildSheetAliases(phaseId, phaseName) {
  const normalizedName = normalizePhaseKey(phaseName)
  const aliases = new Set()
  const addAlias = (value) => {
    const key = normalizePhaseKey(value)
    if (key) aliases.add(key)
  }

  addAlias(normalizedName)
  addAlias(`phase ${Number(phaseId)}`)
  addAlias(`phase ${Number(phaseId) + 1}`)

  const ordinal = extractPhaseOrdinal(normalizedName)
  const looksLikeCommunity = /(communit|community|communities|\bcomm\b)/.test(normalizedName)

  if (/\bteam\b/.test(normalizedName)) {
    addAlias('team')
    addAlias('team treasury')
    addAlias('treasury')
  }
  if (/\bgtd\b/.test(normalizedName) || /\bguaranteed\b/.test(normalizedName)) {
    addAlias('gtd')
    addAlias('guaranteed')
  }
  if (/\bfcfs\b/.test(normalizedName)) {
    addAlias('fcfs')
  }
  if (/\bpublic\b/.test(normalizedName)) {
    addAlias('public')
  }

  if (looksLikeCommunity) {
    addAlias('communities')
    addAlias('community')
    if (ordinal > 0) {
      addAlias(`communities phase ${ordinal}`)
      addAlias(`community phase ${ordinal}`)
      addAlias(`comm phase ${ordinal}`)
      addAlias(`phase ${ordinal}`)
    }
  }

  return aliases
}

function pickWorkbookSheetName(workbook, phaseId, phaseName) {
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : []
  if (sheetNames.length === 0) {
    throw new Error('Whitelist sheet is empty')
  }
  if (sheetNames.length === 1) return sheetNames[0]

  const entries = sheetNames.map((name) => ({
    name,
    key: normalizePhaseKey(name),
  }))
  const aliases = Array.from(buildSheetAliases(phaseId, phaseName))

  for (const alias of aliases) {
    const exact = entries.find((entry) => entry.key === alias)
    if (exact) return exact.name
  }
  for (const alias of aliases) {
    const soft = entries.find((entry) => entry.key.includes(alias) || alias.includes(entry.key))
    if (soft) return soft.name
  }

  throw new Error(
    `Could not match sheet tab for phase ${phaseId} (${phaseName || 'unknown'}). Tabs: ${sheetNames.join(', ')}`
  )
}

function extractAddressMatches(value) {
  const text = String(value || '').trim()
  if (!text) return []
  const matches = text.match(/0x[a-fA-F0-9]{40}/g) || []
  const normalized = []
  for (const match of matches) {
    const address = normalizeAddress(match)
    if (address) normalized.push(address)
  }
  return normalized
}

function parseAllowanceCandidate(value) {
  const text = String(value || '').trim().replace(/,/g, '')
  if (!text) return 0
  if (/^0x/i.test(text)) return 0
  if (!/^\d+(?:\.\d+)?$/.test(text)) return 0
  const numeric = Number(text)
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return Math.max(0, Math.floor(numeric))
}

function extractWhitelistAllowanceMap(rows, defaultAllowance) {
  const allowanceMap = new Map()
  const fallbackAllowance = Math.max(1, Number(defaultAllowance || 1))

  for (const row of rows) {
    const cells = Array.isArray(row) ? row : [row]
    const rowAddresses = []
    for (const cell of cells) {
      rowAddresses.push(...extractAddressMatches(cell))
    }
    if (rowAddresses.length === 0) continue

    let rowAllowance = 0
    for (const cell of cells) {
      const parsed = parseAllowanceCandidate(cell)
      if (parsed > 0) {
        rowAllowance = parsed
        break
      }
    }
    if (rowAllowance <= 0) rowAllowance = fallbackAllowance

    for (const address of rowAddresses) {
      const key = address.toLowerCase()
      const previous = allowanceMap.get(key) || 0
      if (rowAllowance > previous) {
        allowanceMap.set(key, rowAllowance)
      }
    }
  }

  return allowanceMap
}

const workbookCache = new Map()

async function loadWhitelistAllowanceMap(sheetUrl, defaultAllowance, phaseContext = {}) {
  const phaseId = Number(phaseContext?.phaseId)
  const phaseName = String(phaseContext?.phaseName || '')

  if (!sheetUrl) {
    throw new Error('Whitelist sheet URL is not configured')
  }

  let workbook = null
  let targetSheetName = ''

  if (isGoogleSpreadsheetUrl(sheetUrl) && !hasGoogleSheetGid(sheetUrl)) {
    const workbookUrl = buildGoogleSheetWorkbookExportUrl(sheetUrl)
    workbook = workbookCache.get(workbookUrl) || null
    if (!workbook) {
      const workbookResponse = await fetch(workbookUrl, { method: 'GET', cache: 'no-store' })
      if (!workbookResponse.ok) {
        throw new Error(`Failed to fetch whitelist workbook (${workbookResponse.status})`)
      }
      const workbookData = await workbookResponse.arrayBuffer()
      workbook = XLSX.read(workbookData, { type: 'array' })
      workbookCache.set(workbookUrl, workbook)
    }
    targetSheetName = pickWorkbookSheetName(workbook, phaseId, phaseName)
  } else {
    const sourceUrl = isGoogleSpreadsheetUrl(sheetUrl) ? buildGoogleSheetExportUrl(sheetUrl) : sheetUrl
    workbook = workbookCache.get(sourceUrl) || null
    if (!workbook) {
      const response = await fetch(sourceUrl, { method: 'GET', cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed to fetch whitelist sheet (${response.status})`)
      }
      const contentType = String(response.headers.get('content-type') || '').toLowerCase()
      if (contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        const data = await response.arrayBuffer()
        workbook = XLSX.read(data, { type: 'array' })
      } else {
        const rawText = await response.text()
        workbook = XLSX.read(rawText, { type: 'string' })
      }
      workbookCache.set(sourceUrl, workbook)
    }
  }

  const firstSheetName = workbook.SheetNames?.[0]
  if (!firstSheetName) {
    throw new Error('Whitelist sheet is empty')
  }
  const selectedSheetName = targetSheetName || firstSheetName
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheetName], { header: 1, raw: false, defval: '' })
  return extractWhitelistAllowanceMap(rows, defaultAllowance)
}

function mapFromAllowanceMap(allowanceMap) {
  const output = {}
  for (const [wallet, allowance] of allowanceMap.entries()) {
    const parsed = Number(allowance || 0)
    if (!Number.isFinite(parsed) || parsed <= 0) continue
    output[String(wallet).toLowerCase()] = Math.floor(parsed)
  }
  return output
}

async function main() {
  const contractAddress = normalizeAddress(readContractAddress())
  const rpcUrl = readRpcUrl()
  const outPath = resolveSnapshotOutputPath()

  if (!contractAddress) {
    throw new Error('Contract address is not configured')
  }
  if (!rpcUrl) {
    throw new Error('RPC URL is not configured')
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const contract = new ethers.Contract(
    contractAddress,
    [
      'function phaseCount() view returns (uint256)',
      'function getPhase(uint256 phaseId) view returns (string name, uint256 price, uint256 startTime, uint256 endTime, uint256 maxSupply, uint256 maxPerWallet, uint256 minted, bool enabled)',
      'function phaseRequiresWhitelistSignature(uint256 phaseId) view returns (bool)',
      'function MAX_PER_WALLET() view returns (uint256)',
    ],
    provider
  )

  const [network, phaseCountRaw, globalMaxPerWalletRaw] = await Promise.all([
    provider.getNetwork(),
    contract.phaseCount(),
    contract.MAX_PER_WALLET(),
  ])
  const phaseCount = Math.max(0, Number(phaseCountRaw || 0))
  const globalMaxPerWallet = Math.max(0, Number(globalMaxPerWalletRaw || 0))

  const phases = phaseCount > 0
    ? await Promise.all(
      Array.from({ length: phaseCount }, async (_, phaseId) => {
        const [phase, requiredRaw] = await Promise.all([
          contract.getPhase(phaseId),
          contract.phaseRequiresWhitelistSignature(phaseId),
        ])
        return {
          id: phaseId,
          name: String(phase?.[0] || ''),
          enabled: Boolean(phase?.[7]),
          required: Boolean(requiredRaw),
          maxPerWallet: Math.max(0, Number(phase?.[5] || 0)),
        }
      })
    )
    : []

  const whitelistByPhase = {}
  const snapshotPhases = []

  for (const phase of phases) {
    const defaultAllowance = phase.maxPerWallet > 0
      ? phase.maxPerWallet
      : (globalMaxPerWallet > 0 ? globalMaxPerWallet : 1)
    let walletCount = 0
    let sourceSheet = ''

    if (phase.required) {
      sourceSheet = resolveSheetUrl(phase.id, phase.name)
      if (!sourceSheet) {
        throw new Error(`Sheet URL missing for required phase ${phase.id} (${phase.name || 'unnamed'})`)
      }
      const allowanceMap = await loadWhitelistAllowanceMap(sourceSheet, defaultAllowance, {
        phaseId: phase.id,
        phaseName: phase.name,
      })
      const mapped = mapFromAllowanceMap(allowanceMap)
      whitelistByPhase[String(phase.id)] = mapped
      walletCount = Object.keys(mapped).length
    }

    snapshotPhases.push({
      id: phase.id,
      name: phase.name,
      enabled: phase.enabled,
      required: phase.required,
      maxPerWallet: phase.maxPerWallet,
      defaultAllowance,
      walletCount,
      sourceSheet,
    })
  }

  const snapshot = {
    schemaVersion: 1,
    snapshotVersion: Date.now(),
    generatedAt: new Date().toISOString(),
    contract: contractAddress,
    chainId: Number(network?.chainId || 1),
    phaseCount,
    globalMaxPerWallet,
    phases: snapshotPhases,
    whitelistByPhase,
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  const requiredPhaseCount = snapshotPhases.filter((phase) => phase.required).length
  const totalWallets = Object.values(whitelistByPhase).reduce(
    (sum, bucket) => sum + Object.keys(bucket || {}).length,
    0
  )

  console.log(`[whitelist-sync] snapshot written: ${outPath}`)
  console.log(`[whitelist-sync] contract: ${contractAddress} chainId: ${snapshot.chainId}`)
  console.log(`[whitelist-sync] phases: ${phaseCount} required: ${requiredPhaseCount}`)
  console.log(`[whitelist-sync] wallets indexed: ${totalWallets}`)
  console.log(`[whitelist-sync] version: ${snapshot.snapshotVersion}`)
}

main().catch((error) => {
  console.error(`[whitelist-sync] failed: ${String(error?.message || error)}`)
  process.exit(1)
})

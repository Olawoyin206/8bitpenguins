const env = import.meta?.env || {}
const runtimeConfig = globalThis?.__PENGUIN_CONFIG__ || {}

const DEFAULT_CONTRACT_ADDRESS = '0xC15C47C75baAB1D22954DC5E814B520FdE809729'
const DEFAULT_RPC_URL = 'https://ethereum-rpc.publicnode.com'
const DEFAULT_CHAIN_ID_HEX = '0x1'
const DEFAULT_CHAIN_NAME = 'Ethereum Mainnet'
const DEFAULT_BLOCK_EXPLORER_URL = 'https://etherscan.io'

function readConfigValue(name, fallback = '') {
  return String(runtimeConfig?.[name] || env?.[name] || fallback).trim()
}

function readConfigList(name) {
  const raw = readConfigValue(name, '')
  if (!raw) return []
  return raw
    .split(/[,\n\r]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function readConfigBoolean(name, fallback = false) {
  const raw = readConfigValue(name, '')
  if (!raw) return Boolean(fallback)
  const normalized = String(raw).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return Boolean(fallback)
}

function normalizeChainIdHex(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized.startsWith('0x')) return normalized

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return `0x${Math.floor(parsed).toString(16)}`
}

export const CONTRACT_ADDRESS = readConfigValue(
  'VITE_CONTRACT_ADDRESS',
  readConfigValue('VITE_MAINNET_CONTRACT_ADDRESS', DEFAULT_CONTRACT_ADDRESS)
)
export const ETH_SEPOLIA_RPC = readConfigValue(
  'VITE_RPC_URL',
  readConfigValue('VITE_MAINNET_RPC_URL', DEFAULT_RPC_URL)
)
const enableRpcFallbackUrls = readConfigBoolean('VITE_ENABLE_RPC_FALLBACKS', false)
const rpcFallbackUrls = enableRpcFallbackUrls
  ? [
      ...readConfigList('VITE_RPC_FALLBACK_URLS'),
      ...readConfigList('VITE_RPC_URLS'),
    ]
  : []
export const ETH_SEPOLIA_RPC_URLS = Array.from(new Set([ETH_SEPOLIA_RPC, ...rpcFallbackUrls].filter(Boolean)))

export const CHAIN_ID_HEX = normalizeChainIdHex(
  readConfigValue('VITE_CHAIN_ID_HEX', readConfigValue('VITE_CHAIN_ID', DEFAULT_CHAIN_ID_HEX)),
  DEFAULT_CHAIN_ID_HEX
)
export const CHAIN_NAME = readConfigValue('VITE_CHAIN_NAME', DEFAULT_CHAIN_NAME)
export const BLOCK_EXPLORER_URL = readConfigValue('VITE_BLOCK_EXPLORER_URL', DEFAULT_BLOCK_EXPLORER_URL)
export const ETHERSCAN_API_KEY = readConfigValue('VITE_ETHERSCAN_API_KEY', '')

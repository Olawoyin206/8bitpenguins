import { ethers } from 'ethers'
import { CHAIN_ID_HEX, CONTRACT_ADDRESS } from './contractConfig.js'

const STORAGE_PREFIX = 'penguin:mint-commit'
const DEFAULT_CHAIN_ID = Number.parseInt(CHAIN_ID_HEX, 16)

function normalizeAddress(value) {
  const raw = String(value || '').trim()
  return ethers.isAddress(raw) ? ethers.getAddress(raw) : ''
}

function normalizeChainId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID
}

function normalizeSecret(secret) {
  const raw = String(secret || '').trim()
  if (!raw) return ''
  try {
    return ethers.hexlify(ethers.getBytes(raw))
  } catch {
    return ''
  }
}

export function createMintRevealSecret() {
  return ethers.hexlify(ethers.randomBytes(32))
}

export function buildMintCommitment({
  contractAddress = CONTRACT_ADDRESS,
  chainId = DEFAULT_CHAIN_ID,
  account,
  quantity,
  secret,
}) {
  const normalizedContract = normalizeAddress(contractAddress)
  const normalizedAccount = normalizeAddress(account)
  const normalizedSecret = normalizeSecret(secret)
  const normalizedQuantity = BigInt(quantity || 0)

  if (!normalizedContract || !normalizedAccount || !normalizedSecret || normalizedQuantity <= 0n) {
    throw new Error('Invalid mint commitment inputs')
  }

  return ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'address', 'uint256', 'bytes32'],
    [normalizedContract, BigInt(normalizeChainId(chainId)), normalizedAccount, normalizedQuantity, normalizedSecret]
  )
}

export function mintCommitStorageKey({
  contractAddress = CONTRACT_ADDRESS,
  chainId = DEFAULT_CHAIN_ID,
  account,
}) {
  const normalizedContract = normalizeAddress(contractAddress).toLowerCase()
  const normalizedAccount = normalizeAddress(account).toLowerCase()
  return `${STORAGE_PREFIX}:${normalizeChainId(chainId)}:${normalizedContract}:${normalizedAccount}`
}

export function createMintCommitRecord({
  contractAddress = CONTRACT_ADDRESS,
  chainId = DEFAULT_CHAIN_ID,
  account,
  quantity,
  secret,
  commitment,
  txHash = '',
  commitBlock = 0,
  revealAfterBlock = 0,
  expiresAtBlock = 0,
  totalPriceWei = '0',
  createdAt = Date.now(),
}) {
  const normalizedContract = normalizeAddress(contractAddress)
  const normalizedAccount = normalizeAddress(account)
  const normalizedSecret = normalizeSecret(secret)
  const normalizedQuantity = Number(quantity || 0)
  const normalizedCommitment = String(commitment || '').trim().toLowerCase()

  if (!normalizedContract || !normalizedAccount || !normalizedSecret || !normalizedCommitment || normalizedQuantity <= 0) {
    throw new Error('Invalid mint commit record')
  }

  return {
    version: 1,
    contractAddress: normalizedContract,
    chainId: normalizeChainId(chainId),
    account: normalizedAccount,
    quantity: normalizedQuantity,
    secret: normalizedSecret,
    commitment: normalizedCommitment,
    txHash: String(txHash || '').trim(),
    commitBlock: Number(commitBlock || 0),
    revealAfterBlock: Number(revealAfterBlock || 0),
    expiresAtBlock: Number(expiresAtBlock || 0),
    totalPriceWei: String(totalPriceWei || '0'),
    createdAt: Number(createdAt || Date.now()),
  }
}

export function saveMintCommitRecord(storage, record) {
  if (!storage?.setItem || !record?.account) return record
  storage.setItem(
    mintCommitStorageKey(record),
    JSON.stringify(record)
  )
  return record
}

export function readMintCommitRecord(storage, context) {
  if (!storage?.getItem) return null

  try {
    const raw = storage.getItem(mintCommitStorageKey(context))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const record = createMintCommitRecord(parsed)
    if (
      mintCommitStorageKey(record) !== mintCommitStorageKey(context)
    ) {
      return null
    }
    return record
  } catch {
    return null
  }
}

export function clearMintCommitRecord(storage, context) {
  if (!storage?.removeItem) return
  storage.removeItem(mintCommitStorageKey(context))
}

export function normalizePendingMintCommit(raw) {
  if (!raw) return null

  const commitment = String(raw.commitment ?? raw[0] ?? '').trim().toLowerCase()
  if (!commitment || commitment === ethers.ZeroHash) return null

  return {
    commitment,
    commitBlock: Number(raw.commitBlock ?? raw[1] ?? 0),
    revealAfterBlock: Number(raw.revealAfterBlock ?? raw[2] ?? 0),
    expiresAtBlock: Number(raw.expiresAtBlock ?? raw[3] ?? 0),
    quantity: Number(raw.quantity ?? raw[4] ?? 0),
    phaseIdPlusOne: Number(raw.phaseIdPlusOne ?? raw[5] ?? 0),
    totalPriceWei: String(raw.totalPrice ?? raw[6] ?? '0'),
  }
}

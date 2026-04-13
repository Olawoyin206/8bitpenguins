import { ethers } from 'ethers'
import { resilientRpcCall } from './readProvider.js'
import { CHAIN_ID_HEX } from './contractConfig.js'

const TRANSFER_EVENT_TOPIC = ethers.id('Transfer(address,address,uint256)')
const TRANSFER_LOG_BLOCK_CHUNK = 100000
const OWNED_TOKEN_CACHE_PREFIX = 'penguin:owned-token-discovery:v1'

function addressToTopic(address) {
  return ethers.zeroPadValue(ethers.getAddress(address), 32)
}

function parseAddressTopic(topic) {
  return ethers.getAddress(`0x${topic.slice(-40)}`)
}

function parseTokenIdTopic(topic) {
  return Number(BigInt(topic))
}

async function getTransferLogsForAddressInRange(
  contractAddress,
  walletAddress,
  topicIndex,
  provider,
  requestRef,
  requestId,
  fromBlock,
  latestBlock
) {
  const addressTopic = addressToTopic(walletAddress)
  const topics = topicIndex === 1
    ? [TRANSFER_EVENT_TOPIC, addressTopic]
    : [TRANSFER_EVENT_TOPIC, null, addressTopic]
  const logs = []

  for (let startBlock = Math.max(0, Number(fromBlock) || 0); startBlock <= latestBlock; startBlock += TRANSFER_LOG_BLOCK_CHUNK) {
    if (requestRef?.current !== undefined && requestRef.current !== requestId) return null

    const toBlock = Math.min(startBlock + TRANSFER_LOG_BLOCK_CHUNK - 1, latestBlock)
    const chunkLogs = await resilientRpcCall(() => provider.getLogs({
      address: contractAddress,
      fromBlock: startBlock,
      toBlock,
      topics,
    }), {
      timeoutMs: 15000,
      retries: 2,
    })
    logs.push(...chunkLogs)
  }

  return logs
}

async function scanOwnedTokenIdsByOwner(contract, normalizedAddress, balance, requestRef, requestId, totalSupplyHint = null) {
  if (balance === 0) return []

  const totalSupply = Number(totalSupplyHint ?? (await resilientRpcCall(() => contract.totalSupply(), {
    timeoutMs: 12000,
    retries: 2,
  })))
  if (totalSupply === 0) return []

  const ownedTokenIds = []
  const CHUNK = 48

  for (let high = totalSupply; high >= 1 && ownedTokenIds.length < balance; high -= CHUNK) {
    if (requestRef?.current !== undefined && requestRef.current !== requestId) return null

    const low = Math.max(1, high - CHUNK + 1)
    const batch = Array.from({ length: high - low + 1 }, (_, idx) => high - idx)
    const ownerResults = await Promise.allSettled(
      batch.map((tokenId) => contract.ownerOf(tokenId))
    )

    ownerResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && ethers.getAddress(result.value) === normalizedAddress) {
        ownedTokenIds.push(batch[idx])
      }
    })
  }

  return ownedTokenIds.slice(0, balance).sort((a, b) => b - a)
}

function getOwnedTokenCacheKey(contractAddress, walletAddress) {
  const normalizedChain = String(CHAIN_ID_HEX || '').trim().toLowerCase()
  const normalizedContract = String(contractAddress || '').trim().toLowerCase()
  const normalizedWallet = String(walletAddress || '').trim().toLowerCase()
  return normalizedChain && normalizedContract && normalizedWallet
    ? `${OWNED_TOKEN_CACHE_PREFIX}:${normalizedChain}:${normalizedContract}:${normalizedWallet}`
    : ''
}

function sanitizeTokenIds(tokenIds) {
  if (!Array.isArray(tokenIds)) return []
  return Array.from(new Set(
    tokenIds
      .map((tokenId) => Number(tokenId))
      .filter((tokenId) => Number.isInteger(tokenId) && tokenId > 0)
  )).sort((a, b) => b - a)
}

function readOwnedTokenCache(contractAddress, walletAddress) {
  if (typeof window === 'undefined') return null
  const cacheKey = getOwnedTokenCacheKey(contractAddress, walletAddress)
  if (!cacheKey) return null

  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const tokenIds = sanitizeTokenIds(parsed?.tokenIds)
    const latestBlock = Number(parsed?.latestBlock)
    if (!Number.isInteger(latestBlock) || latestBlock < 0) return null
    return { tokenIds, latestBlock }
  } catch {
    return null
  }
}

function writeOwnedTokenCache(contractAddress, walletAddress, tokenIds, latestBlock) {
  if (typeof window === 'undefined') return
  const cacheKey = getOwnedTokenCacheKey(contractAddress, walletAddress)
  if (!cacheKey) return

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({
      tokenIds: sanitizeTokenIds(tokenIds),
      latestBlock: Number(latestBlock) || 0,
      updatedAt: Date.now(),
    }))
  } catch {
    // Ignore cache write failures.
  }
}

function clearOwnedTokenCache(contractAddress, walletAddress) {
  if (typeof window === 'undefined') return
  const cacheKey = getOwnedTokenCacheKey(contractAddress, walletAddress)
  if (!cacheKey) return
  try {
    window.localStorage.removeItem(cacheKey)
  } catch {
    // Ignore cache clear failures.
  }
}

function applyTransferLogsToOwnedSet(initialTokenIds, walletAddress, incomingLogs = [], outgoingLogs = []) {
  const normalizedAddress = ethers.getAddress(walletAddress)
  const nextOwnedSet = new Set(sanitizeTokenIds(initialTokenIds))
  const orderedLogs = [...incomingLogs, ...outgoingLogs].sort((a, b) => (
    a.blockNumber - b.blockNumber ||
    a.transactionIndex - b.transactionIndex ||
    a.index - b.index
  ))

  orderedLogs.forEach((log) => {
    const from = parseAddressTopic(log.topics[1])
    const to = parseAddressTopic(log.topics[2])
    const tokenId = parseTokenIdTopic(log.topics[3])

    if (to === normalizedAddress) nextOwnedSet.add(tokenId)
    if (from === normalizedAddress) nextOwnedSet.delete(tokenId)
  })

  return Array.from(nextOwnedSet).sort((a, b) => b - a)
}

export async function fetchOwnedTokenIds(contract, walletAddress, provider, requestRef, requestId) {
  const normalizedAddress = ethers.getAddress(walletAddress)
  const [balanceRaw, latestBlock, totalSupplyRaw] = await Promise.all([
    resilientRpcCall(() => contract.balanceOf(normalizedAddress), { timeoutMs: 12000, retries: 2 }),
    resilientRpcCall(() => provider.getBlockNumber(), { timeoutMs: 12000, retries: 2 }),
    resilientRpcCall(() => contract.totalSupply(), { timeoutMs: 12000, retries: 2 }),
  ])
  const balance = Number(balanceRaw)
  const totalSupply = Number(totalSupplyRaw)
  if (balance === 0) {
    clearOwnedTokenCache(contract.target, normalizedAddress)
    return []
  }
  const cached = readOwnedTokenCache(contract.target, normalizedAddress)

  if (
    cached &&
    cached.latestBlock <= latestBlock &&
    (requestRef?.current === undefined || requestRef.current === requestId)
  ) {
    try {
      const fromBlock = cached.latestBlock + 1
      const [incomingRecentLogs, outgoingRecentLogs] = fromBlock <= latestBlock
        ? await Promise.all([
            getTransferLogsForAddressInRange(
              contract.target,
              normalizedAddress,
              2,
              provider,
              requestRef,
              requestId,
              fromBlock,
              latestBlock
            ),
            getTransferLogsForAddressInRange(
              contract.target,
              normalizedAddress,
              1,
              provider,
              requestRef,
              requestId,
              fromBlock,
              latestBlock
            ),
          ])
        : [[], []]

      if (
        incomingRecentLogs &&
        outgoingRecentLogs &&
        (requestRef?.current === undefined || requestRef.current === requestId)
      ) {
        const nextTokenIds = applyTransferLogsToOwnedSet(
          cached.tokenIds,
          normalizedAddress,
          incomingRecentLogs,
          outgoingRecentLogs
        )

        if (nextTokenIds.length === balance) {
          writeOwnedTokenCache(contract.target, normalizedAddress, nextTokenIds, latestBlock)
          return nextTokenIds
        }
      }
    } catch {
      // Fall through to owner scan when incremental refresh is unavailable.
    }
  }

  const scannedTokenIds = await scanOwnedTokenIdsByOwner(
    contract,
    normalizedAddress,
    balance,
    requestRef,
    requestId,
    totalSupply
  )
  if (Array.isArray(scannedTokenIds)) {
    writeOwnedTokenCache(contract.target, normalizedAddress, scannedTokenIds, latestBlock)
  }
  return scannedTokenIds
}

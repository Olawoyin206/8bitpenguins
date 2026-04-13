import { ethers } from 'ethers'
import { CHAIN_ID_HEX, ETH_SEPOLIA_RPC, ETH_SEPOLIA_RPC_URLS } from './contractConfig.js'

let sharedReadProvider = null
const parsedChainId = Number.parseInt(String(CHAIN_ID_HEX || '0x1'), 16)
const RPC_NETWORK = ethers.Network.from(Number.isFinite(parsedChainId) && parsedChainId > 0 ? parsedChainId : 1)
const RPC_MAX_CONCURRENT_READS = 6
const RPC_DEFAULT_TIMEOUT_MS = 12000
const RPC_DEFAULT_RETRIES = 2
const RPC_CIRCUIT_FAILURE_THRESHOLD = 6
const RPC_CIRCUIT_COOLDOWN_MS = 45000

let rpcQueueInFlight = 0
const rpcQueuePending = []
const rpcCircuitState = {
  consecutiveFailures: 0,
  openUntil: 0,
}

function isThenable(value) {
  return value && typeof value.then === 'function'
}

function runWithTimeout(call, timeoutMs = RPC_DEFAULT_TIMEOUT_MS) {
  let timeoutId = null
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('RPC timeout')), timeoutMs)
  })

  return Promise.race([
    Promise.resolve().then(call),
    timeoutPromise,
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

function jitterDelayMs(attempt) {
  const base = 500 * (2 ** attempt)
  return base + Math.floor(Math.random() * 350)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)))
}

function dequeueRpcTask() {
  while (rpcQueueInFlight < RPC_MAX_CONCURRENT_READS && rpcQueuePending.length > 0) {
    const next = rpcQueuePending.shift()
    if (!next) continue
    rpcQueueInFlight += 1
    Promise.resolve()
      .then(next.task)
      .then(next.resolve)
      .catch(next.reject)
      .finally(() => {
        rpcQueueInFlight = Math.max(0, rpcQueueInFlight - 1)
        dequeueRpcTask()
      })
  }
}

function enqueueRpcTask(task) {
  return new Promise((resolve, reject) => {
    rpcQueuePending.push({ task, resolve, reject })
    dequeueRpcTask()
  })
}

export function isRpcTransientError(error) {
  const text = String(error?.reason || error?.shortMessage || error?.message || '').toLowerCase()
  const code = Number(error?.code)
  return (
    code === -32001 ||
    code === -32005 ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('network error') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('429') ||
    text.includes('gateway') ||
    text.includes('temporarily unavailable') ||
    text.includes('header not found') ||
    text.includes('missing response')
  )
}

export function getRpcCircuitState() {
  const now = Date.now()
  return {
    isOpen: now < rpcCircuitState.openUntil,
    openUntil: rpcCircuitState.openUntil,
    remainingMs: Math.max(0, rpcCircuitState.openUntil - now),
    consecutiveFailures: rpcCircuitState.consecutiveFailures,
  }
}

function onRpcSuccess() {
  rpcCircuitState.consecutiveFailures = 0
  rpcCircuitState.openUntil = 0
}

function onRpcFailure(error) {
  if (!isRpcTransientError(error)) return
  rpcCircuitState.consecutiveFailures += 1
  if (rpcCircuitState.consecutiveFailures >= RPC_CIRCUIT_FAILURE_THRESHOLD) {
    rpcCircuitState.openUntil = Date.now() + RPC_CIRCUIT_COOLDOWN_MS
  }
}

export async function resilientRpcCall(
  call,
  {
    timeoutMs = RPC_DEFAULT_TIMEOUT_MS,
    retries = RPC_DEFAULT_RETRIES,
    fallback,
    allowWhenCircuitOpen = false,
  } = {}
) {
  const readTask = async () => {
    const circuit = getRpcCircuitState()
    if (circuit.isOpen && !allowWhenCircuitOpen) {
      if (fallback !== undefined) {
        return isThenable(fallback) ? await fallback : fallback
      }
      throw new Error('RPC temporarily degraded. Using cooldown window.')
    }

    let lastError = null
    for (let attempt = 0; attempt <= Math.max(0, Number(retries) || 0); attempt += 1) {
      try {
        const value = await runWithTimeout(call, timeoutMs)
        onRpcSuccess()
        return value
      } catch (error) {
        lastError = error
        onRpcFailure(error)
        if (!isRpcTransientError(error) || attempt >= retries) break
        await delay(jitterDelayMs(attempt))
      }
    }

    if (fallback !== undefined) {
      return isThenable(fallback) ? await fallback : fallback
    }

    throw lastError || new Error('RPC read failed')
  }

  return enqueueRpcTask(readTask)
}

export function createReadProvider() {
  const rpcUrls = Array.from(new Set([
    ...(Array.isArray(ETH_SEPOLIA_RPC_URLS) ? ETH_SEPOLIA_RPC_URLS : []),
    String(ETH_SEPOLIA_RPC || '').trim(),
  ].filter(Boolean)))

  if (rpcUrls.length === 0) {
    throw new Error('No RPC URL configured for read provider')
  }

  if (rpcUrls.length === 1) {
    return new ethers.JsonRpcProvider(rpcUrls[0], undefined, {
      staticNetwork: RPC_NETWORK,
    })
  }

  const fallbackConfigs = rpcUrls.map((rpcUrl, index) => ({
    provider: new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: RPC_NETWORK,
    }),
    priority: index + 1,
    weight: index === 0 ? 2 : 1,
    stallTimeout: 1200 + (index * 400),
  }))

  return new ethers.FallbackProvider(fallbackConfigs, RPC_NETWORK, {
    quorum: 1,
    cacheTimeout: 0,
  })
}

export function getSharedReadProvider() {
  if (!sharedReadProvider) {
    sharedReadProvider = createReadProvider()
  }
  return sharedReadProvider
}

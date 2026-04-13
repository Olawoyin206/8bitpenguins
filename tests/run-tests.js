import assert from 'node:assert/strict'
import {
  buildMintCommitment,
  clearMintCommitRecord,
  createMintCommitRecord,
  normalizePendingMintCommit,
  readMintCommitRecord,
  saveMintCommitRecord,
} from '../src/mintCommit.js'

function run(name, fn) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

run('buildMintCommitment is deterministic for the same inputs and sensitive to quantity', () => {
  const baseInput = {
    contractAddress: '0x00000000000000000000000000000000000000AA',
    chainId: 11155111,
    account: '0x00000000000000000000000000000000000000bb',
    quantity: 2,
    secret: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  }

  const first = buildMintCommitment(baseInput)
  const second = buildMintCommitment(baseInput)
  const differentQuantity = buildMintCommitment({ ...baseInput, quantity: 3 })

  assert.equal(first, second)
  assert.notEqual(first, differentQuantity)
})

run('mint commit storage round-trips only for the matching account context', () => {
  const storage = new Map()
  const fakeStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null
    },
    setItem(key, value) {
      storage.set(key, value)
    },
    removeItem(key) {
      storage.delete(key)
    },
  }

  const record = createMintCommitRecord({
    contractAddress: '0x00000000000000000000000000000000000000AA',
    chainId: 11155111,
    account: '0x00000000000000000000000000000000000000bb',
    quantity: 2,
    secret: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    commitment: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    revealAfterBlock: 100,
    expiresAtBlock: 200,
  })

  saveMintCommitRecord(fakeStorage, record)

  assert.deepEqual(
    readMintCommitRecord(fakeStorage, {
      contractAddress: record.contractAddress,
      chainId: record.chainId,
      account: record.account,
    }),
    record
  )

  assert.equal(
    readMintCommitRecord(fakeStorage, {
      contractAddress: record.contractAddress,
      chainId: record.chainId,
      account: '0x00000000000000000000000000000000000000cc',
    }),
    null
  )

  clearMintCommitRecord(fakeStorage, record)
  assert.equal(readMintCommitRecord(fakeStorage, record), null)
})

run('normalizePendingMintCommit handles ethers-style struct results', () => {
  const pending = normalizePendingMintCommit({
    commitment: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    commitBlock: 11n,
    revealAfterBlock: 13n,
    expiresAtBlock: 40n,
    quantity: 2n,
    phaseIdPlusOne: 1n,
    totalPrice: 123n,
  })

  assert.deepEqual(pending, {
    commitment: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    commitBlock: 11,
    revealAfterBlock: 13,
    expiresAtBlock: 40,
    quantity: 2,
    phaseIdPlusOne: 1,
    totalPriceWei: '123',
  })
})

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}

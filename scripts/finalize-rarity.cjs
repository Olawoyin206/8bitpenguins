const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

const INCLUDED_TRAITS = ["Background", "Body", "Belly", "Beak", "Eyes", "Head", "Feet"];

function parseArgs(argv) {
  const args = { dryRun: false, batchSize: 100, readBatchSize: 200 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--batch" && argv[i + 1]) {
      args.batchSize = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--read-batch" && argv[i + 1]) {
      args.readBatchSize = Number(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function chunkRange(start, end) {
  const ids = [];
  for (let i = start; i <= end; i += 1) ids.push(i);
  return ids;
}

function parseAttributes(raw, tokenId) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Token ${tokenId}: failed to parse tokenAttributes JSON`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Token ${tokenId}: tokenAttributes is not an array`);
  }

  const traits = new Map();
  for (const entry of parsed) {
    const traitType = String(entry?.trait_type || "").trim();
    const value = String(entry?.value || "").trim();
    if (INCLUDED_TRAITS.includes(traitType) && value) {
      traits.set(traitType, value);
    }
  }

  for (const traitType of INCLUDED_TRAITS) {
    if (!traits.has(traitType)) {
      throw new Error(`Token ${tokenId}: missing trait "${traitType}"`);
    }
  }

  return traits;
}

function extractAttributesFromMetadataJson(raw, tokenId) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Token ${tokenId}: failed to parse tokenMetadataJson`);
  }
  return parseAttributes(JSON.stringify(parsed?.attributes || []), tokenId);
}

async function loadTokenTraits(contract, tokenId) {
  const rawAttributes = await contract.tokenAttributes(tokenId);
  if (rawAttributes && String(rawAttributes).trim()) {
    return parseAttributes(rawAttributes, tokenId);
  }
  const metadataJson = await contract.tokenMetadataJson(tokenId);
  return extractAttributesFromMetadataJson(metadataJson, tokenId);
}

function buildFrequencyMap(tokenTraits) {
  const counts = new Map();
  for (const { traits } of tokenTraits) {
    for (const traitType of INCLUDED_TRAITS) {
      const value = traits.get(traitType);
      const key = `${traitType}::${value}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function calculateScores(tokenTraits, counts, supply) {
  return tokenTraits.map(({ tokenId, traits }) => {
    let score = 0;
    for (const traitType of INCLUDED_TRAITS) {
      const value = traits.get(traitType);
      const count = counts.get(`${traitType}::${value}`);
      if (!count) {
        throw new Error(`Token ${tokenId}: missing frequency count for ${traitType}=${value}`);
      }
      score += -Math.log(count / supply);
    }
    return { tokenId, score: Math.round(score * 1000) };
  });
}

function buildRanks(scoredTokens) {
  const sorted = [...scoredTokens].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tokenId - b.tokenId;
  });

  const ranks = new Map();
  sorted.forEach((item, index) => {
    ranks.set(item.tokenId, index + 1);
  });
  return { sorted, ranks };
}

async function main() {
  const { dryRun, batchSize, readBatchSize } = parseArgs(process.argv.slice(2));
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Batch size must be a positive integer");
  }
  if (!Number.isInteger(readBatchSize) || readBatchSize <= 0) {
    throw new Error("Read batch size must be a positive integer");
  }

  const address = getContractAddress();
  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", address);
  const supply = Number(await contract.totalSupply());
  const maxSupply = Number(await contract.MAX_SUPPLY());
  const alreadyFinalized = await contract.rarityFinalized();
  const mintActive = await contract.mintActive();

  console.log(`Contract: ${address}`);
  console.log(`Minted supply: ${supply}`);
  console.log(`Max supply: ${maxSupply}`);
  console.log(`Mint active: ${mintActive}`);

  if (alreadyFinalized) {
    throw new Error("Rarity is already finalized on-chain");
  }
  if (supply <= 0) {
    throw new Error("No tokens minted yet");
  }
  if (supply !== maxSupply && mintActive) {
    throw new Error(`Collection is not sold out and mint is still active (${supply}/${maxSupply})`);
  }

  const tokenTraits = [];
  for (let start = 1; start <= supply; start += readBatchSize) {
    const end = Math.min(supply, start + readBatchSize - 1);
    const ids = chunkRange(start, end);
    const traitBatch = await Promise.all(ids.map(async (tokenId) => ({
      tokenId,
      traits: await loadTokenTraits(contract, tokenId),
    })));
    traitBatch.forEach((entry) => {
      tokenTraits.push(entry);
    });
    console.log(`Loaded attributes ${start}-${end}`);
  }

  const counts = buildFrequencyMap(tokenTraits);
  const scoredTokens = calculateScores(tokenTraits, counts, supply);
  const { sorted, ranks } = buildRanks(scoredTokens);

  console.log("Top 10 rarity preview:");
  sorted.slice(0, 10).forEach((item, index) => {
    console.log(`#${index + 1} token ${item.tokenId} score=${item.score}`);
  });

  if (dryRun) {
    console.log("Dry run complete. No transactions sent.");
    return;
  }

  const [signer] = await hre.ethers.getSigners();
  console.log(`Submitting from owner: ${signer.address}`);

  for (let start = 0; start < sorted.length; start += batchSize) {
    const batch = sorted.slice(start, start + batchSize);
    const tokenIds = batch.map((item) => item.tokenId);
    const scores = batch.map((item) => item.score);
    const batchRanks = batch.map((item) => ranks.get(item.tokenId));

    const tx = await contract.connect(signer).setFinalRarityData(tokenIds, scores, batchRanks);
    console.log(`setFinalRarityData ${tokenIds[0]}-${tokenIds[tokenIds.length - 1]} tx=${tx.hash}`);
    await tx.wait();
  }

  const finalizeTx = await contract.connect(signer).finalizeRarity();
  console.log(`finalizeRarity tx=${finalizeTx.hash}`);
  await finalizeTx.wait();

  console.log("Rarity finalization complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

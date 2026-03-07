function getContractAddress() {
  const address = (process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || "").trim();
  if (!address) {
    throw new Error("Missing contract address. Set CONTRACT_ADDRESS or VITE_CONTRACT_ADDRESS in .env");
  }
  return address;
}

module.exports = { getContractAddress };

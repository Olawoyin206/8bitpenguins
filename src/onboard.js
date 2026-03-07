let onboardInstancePromise = null

export async function getOnboard() {
  if (typeof window === 'undefined') {
    throw new Error('Wallet provider is only available in browser')
  }

  if (!onboardInstancePromise) {
    onboardInstancePromise = (async () => {
      const [{ default: Onboard }, { default: injectedModule }, { default: coinbaseWalletModule }] = await Promise.all([
        import('@web3-onboard/core'),
        import('@web3-onboard/injected-wallets'),
        import('@web3-onboard/coinbase'),
      ])

      const injected = injectedModule()
      const coinbase = coinbaseWalletModule()

      return Onboard({
        wallets: [injected, coinbase],
        chains: [
          {
            id: '0x14a34',
            token: 'ETH',
            label: 'Base Sepolia',
            rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
          },
        ],
        appMetadata: {
          name: '8bit Penguins',
          description: 'Mint and evolve 8bit Penguins',
        },
        connect: {
          autoConnectLastWallet: false,
        },
      })
    })()
  }

  return onboardInstancePromise
}

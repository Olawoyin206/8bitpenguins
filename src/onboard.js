import Onboard from '@web3-onboard/core'
import injectedModule from '@web3-onboard/injected-wallets'
import coinbaseWalletModule from '@web3-onboard/coinbase'

const injected = injectedModule()
const coinbase = coinbaseWalletModule()

const onboard = Onboard({
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

export default onboard

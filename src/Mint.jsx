import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './App.css'

const CONTRACT_ADDRESS = '0xd0510B85EdC7e077b57Ce6AD81D10253608eed92'

const contractABI = [
  "function mint() public payable",
  "function balanceOf(address owner) public view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256)",
  "function totalSupply() public view returns (uint256)",
  "function saleStatus() public view returns (uint256)",
  "function MAX_SUPPLY() public view returns (uint256)"
]

const MAX_SUPPLY = 10000

function Mint() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(0)
  const [status, setStatus] = useState('')
  const [isMinting, setIsMinting] = useState(false)
  const [myTokens, setMyTokens] = useState([])
  const [totalSupply, setTotalSupply] = useState(0)
  const [currentPhase, setCurrentPhase] = useState(0)

  useEffect(() => {
    fetchContractData(null)
  }, [])

  const fetchContractData = async (address) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
      
      const supply = await contract.totalSupply()
      setTotalSupply(supply.toNumber())
      
      const phase = await contract.saleStatus()
      setCurrentPhase(phase.toNumber())
      
      if (address) {
        const bal = await contract.balanceOf(address)
        setBalance(bal.toNumber())
        
        const tokens = []
        for (let i = 0; i < bal.toNumber(); i++) {
          const tokenId = await contract.tokenOfOwnerByIndex(address, i)
          tokens.push(tokenId.toNumber())
        }
        setMyTokens(tokens)
      }
    } catch (e) {
      console.log('Demo mode')
    }
  }

  const connect = async () => {
    if (!window.ethereum) {
      setStatus('Install MetaMask')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accounts[0])
      fetchContractData(accounts[0])
      setStatus('')
    } catch (e) {
      setStatus('Connection failed')
    }
  }

  const mint = async () => {
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    try {
      setIsMinting(true)
      setStatus('Minting...')
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)
      
      const tx = await contract.mint()
      setStatus('Confirming...')
      await tx.wait()
      
      setStatus('Minted!')
      fetchContractData(account)
    } catch (e) {
      setStatus('Error: ' + (e.reason || e.message?.slice(0, 30)))
    } finally {
      setIsMinting(false)
    }
  }

  const progress = (totalSupply / MAX_SUPPLY) * 100

  return (
    <div className="app mint-page">
      <header className="mint-header">
        <div className="mint-header-left">
          <div>
            <h1>Mint</h1>
            <p>Free mint your 8bit Penguins</p>
          </div>
        </div>
      </header>

      <div className="mint-grid">
        <div className="phase-box">
          <span className="phase-label">Current Phase</span>
          <span className="phase-value">{currentPhase === 0 ? 'Whitelist' : currentPhase === 1 ? 'FCFS' : currentPhase === 2 ? 'Public' : 'Ended'}</span>
        </div>

        <div className="phases-bar">
          <div className={`phase-item ${currentPhase >= 0 ? 'active' : ''}`}>
            <span className="phase-dot"></span>
            <span className="phase-name">Whitelist</span>
          </div>
          <div className="phase-line"></div>
          <div className={`phase-item ${currentPhase >= 1 ? 'active' : ''}`}>
            <span className="phase-dot"></span>
            <span className="phase-name">FCFS</span>
          </div>
          <div className="phase-line"></div>
          <div className={`phase-item ${currentPhase >= 2 ? 'active' : ''}`}>
            <span className="phase-dot"></span>
            <span className="phase-name">Public</span>
          </div>
        </div>

        <div className="mint-supply">
          <div className="supply-row">
            <span className="supply-label">Minted</span>
            <span className="supply-value">{totalSupply.toLocaleString()}</span>
          </div>
          <div className="supply-bar">
            <div className="supply-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="supply-row">
            <span className="supply-label">{MAX_SUPPLY - totalSupply} remaining</span>
            <span className="supply-label">{Math.round(progress)}%</span>
          </div>
        </div>

        <div className="mint-action-box">
          {!account ? (
            <div className="connect-wrap">
              <p>Connect wallet to mint</p>
              <button className="btn primary connect-btn" onClick={connect}>Connect Wallet</button>
            </div>
          ) : (
            <div className="mint-form">
              <div className="wallet-row">
                <span className="wallet-addr">{account.slice(0, 8)}...{account.slice(-6)}</span>
                <span className="wallet-bal">{balance} penguins</span>
              </div>
              
              <button 
                className="btn primary mint-btn" 
                onClick={mint}
                disabled={isMinting || currentPhase === 3}
              >
                {isMinting ? 'minting...' : currentPhase === 3 ? 'ended' : 'mint free'}
              </button>
              
              {status && <p className="status">{status}</p>}
            </div>
          )}
        </div>

        {balance > 0 && (
          <div className="my-penguins">
            <div className="penguins-header">
              <span>my_penguins</span>
              <span>[{balance}]</span>
            </div>
            <div className="penguins-list">
              {myTokens.slice(0, 12).map(tokenId => (
                <span key={tokenId} className="penguin-id">#{tokenId}</span>
              ))}
              {myTokens.length > 12 && <span className="penguin-more">+{myTokens.length - 12} more</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Mint

import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WalletContext } from "@/modules/midnight/wallet-widget/contexts/wallet";
import {
  Sparkles, Wallet, ArrowRight, Shield, Database, Zap,
  Loader2, Lock, AlertCircle, Download, RefreshCw, CheckCircle
} from "lucide-react";

export const Home = () => {
  const {
    status,
    error,
    walletInfo,
    availableWallets,
    connect,
    disconnect,
    checkStatus,
  } = useContext(WalletContext);

  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-white -m-6 -mt-6 p-6">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold mb-4">Night Forge Studio</h1>

        <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
          Create and mint NFTs on the Midnight blockchain with zero-knowledge proofs.
        </p>

        {/* Network Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/50 rounded-full mb-8">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          <span className="text-amber-300 text-sm font-semibold">Preview Network</span>
        </div>

        {/* Wallet Status Card */}
        <div className="max-w-md mx-auto mb-8">
          {/* Not Installed */}
          {status === 'not_installed' && (
            <div className="p-6 bg-slate-800/80 border border-slate-700 rounded-2xl">
              <Download className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Wallet Found</h3>
              <p className="text-slate-400 text-sm mb-4">
                Install a Midnight wallet to continue
              </p>
              <div className="flex gap-2">
                <a
                  href="https://chrome.google.com/webstore/detail/yamori"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-center font-medium transition"
                >
                  Get Yamori
                </a>
              </div>
            </div>
          )}

          {/* Locked */}
          {status === 'locked' && (
            <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <Lock className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-amber-300 mb-2">Wallet Locked</h3>
              <p className="text-amber-200/70 text-sm mb-4">
                Click the Yamori extension icon and enter your password
              </p>
              <Button
                onClick={() => checkStatus()}
                variant="outline"
                className="w-full border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                I've Unlocked It
              </Button>
            </div>
          )}

          {/* Ready to Connect */}
          {status === 'ready' && (
            <div className="p-6 bg-slate-800/80 border border-slate-700 rounded-2xl">
              <Wallet className="w-12 h-12 text-violet-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
              <p className="text-slate-400 text-sm mb-4">
                {availableWallets.length > 0
                  ? `Found: ${availableWallets.map(w => w.name).join(', ')}`
                  : 'Select a wallet to connect'}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                {availableWallets.map((wallet) => (
                  <Button
                    key={wallet.rdns}
                    onClick={() => connect(wallet.rdns)}
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 rounded-xl"
                  >
                    <Wallet className="w-5 h-5 mr-2" />
                    Connect {wallet.name}
                  </Button>
                ))}

                {availableWallets.length === 0 && (
                  <Button
                    onClick={() => connect()}
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 rounded-xl"
                  >
                    <Wallet className="w-5 h-5 mr-2" />
                    Connect Wallet
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Connecting */}
          {status === 'connecting' && (
            <div className="p-6 bg-slate-800/80 border border-slate-700 rounded-2xl">
              <Loader2 className="w-12 h-12 text-violet-400 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Connecting...</h3>
              <p className="text-slate-400 text-sm">
                Check your wallet extension for approval
              </p>
            </div>
          )}

          {/* Connected */}
          {status === 'connected' && walletInfo && (
            <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-2xl">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-300 mb-2">Connected!</h3>

              <div className="text-left space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Wallet:</span>
                  <span className="text-white capitalize">{walletInfo.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Network:</span>
                  <span className="text-amber-300 capitalize">{walletInfo.network}</span>
                </div>
                {walletInfo.shieldedAddress !== 'Not available' && (
                  <div className="pt-2 border-t border-slate-700">
                    <span className="text-slate-400 text-xs">Shielded Address:</span>
                    <p className="text-white text-xs font-mono break-all">
                      {walletInfo.shieldedAddress.slice(0, 20)}...{walletInfo.shieldedAddress.slice(-8)}
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => navigate('/real-nft')}
                className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 rounded-xl mb-2"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start Minting
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <button
                onClick={disconnect}
                className="text-sm text-slate-400 hover:text-red-400 transition"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-300 mb-2">Connection Failed</h3>
              <p className="text-red-200/70 text-sm mb-4">{error || 'Unknown error'}</p>
              <Button
                onClick={() => checkStatus()}
                variant="outline"
                className="w-full border-red-500/50 text-red-300 hover:bg-red-500/20"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* Checking */}
          {status === 'checking' && (
            <div className="p-6 bg-slate-800/80 border border-slate-700 rounded-2xl">
              <Loader2 className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Detecting Wallets...</h3>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-violet-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">ZK Proofs</h3>
            <p className="text-slate-400 text-sm">Every transaction is secured with zero-knowledge proofs</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">On-Chain Storage</h3>
            <p className="text-slate-400 text-sm">NFT metadata stored permanently on blockchain</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Preview Network</h3>
            <p className="text-slate-400 text-sm">Test on Midnight's preview network</p>
          </div>
        </div>
      </div>
    </div>
  );
};

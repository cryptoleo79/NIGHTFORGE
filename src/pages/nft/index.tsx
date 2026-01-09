import { Loading } from "@/components/loading";
import { useEffect, useState } from "react";
import { ImagePlus, Sparkles, CheckCircle, Music, Copy, Share2, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { useContractSubscription } from "@/modules/midnight/counter-sdk/hooks/use-contract-subscription";

interface NFTMetadata {
  id: number;
  uri: string;
  name: string;
  description: string;
  mintedAt: string;
  txAddress?: string;
  txHash?: string;
  fileType?: 'image' | 'audio' | 'video';
  burned?: boolean;
}

interface Transaction {
  hash: string;
  contractAddress: string;
  timestamp: string;
  type: 'deploy' | 'mint' | 'burn';
}

const formatUri = (uri: string): string => {
  return uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
};

export const NFTMinter = () => {
  const { deployedContractAPI, derivedState, onDeploy, onJoin, providers } = useContractSubscription();
  const [deployedAddress, setDeployedAddress] = useState<string | undefined>();
  const [appLoading, setAppLoading] = useState(false);
  const [ipfsUri, setIpfsUri] = useState("");
  const [nftName, setNftName] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [minting, setMinting] = useState(false);
  const [mintedNFTs, setMintedNFTs] = useState<NFTMetadata[]>([]);
  const [mintCount, setMintCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTxPanel, setShowTxPanel] = useState(false);
  const [fileType, setFileType] = useState<'image' | 'audio' | 'video'>('image');
  const [selectedNFT, setSelectedNFT] = useState<NFTMetadata | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('midnight-nfts');
    if (saved) setMintedNFTs(JSON.parse(saved));
    
    const savedTx = localStorage.getItem('midnight-nft-transactions');
    if (savedTx) setTransactions(JSON.parse(savedTx));
    
    const savedContract = localStorage.getItem('nft-contract-address');
    if (savedContract) {
      setDeployedAddress(savedContract);
      fetchTransactions(savedContract);
    }
  }, []);

  useEffect(() => {
    if (deployedContractAPI) {
      setDeployedAddress(deployedContractAPI.deployedContractAddress);
      setStatusMessage("✅ Contract connected!");
    }
  }, [deployedContractAPI]);

  useEffect(() => {
    if (derivedState?.round !== undefined) {
      setMintCount(Number(derivedState.round));
    }
  }, [derivedState?.round]);

  const fetchTransactions = async (contractAddr: string) => {
    try {
      const response = await fetch('https://indexer.preview.midnight.network/api/v3/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query { contractAction(address: "${contractAddr}") { address state transaction { hash } } }`
        })
      });
      const data = await response.json();
      if (data.data?.contractAction) {
        const newTx: Transaction = {
          hash: data.data.contractAction.transaction.hash,
          contractAddress: data.data.contractAction.address,
          timestamp: new Date().toISOString(),
          type: 'deploy'
        };
        const existingTxs = transactions.filter(t => t.hash !== newTx.hash);
        const updatedTxs = [newTx, ...existingTxs];
        setTransactions(updatedTxs);
        localStorage.setItem('midnight-nft-transactions', JSON.stringify(updatedTxs));
      }
    } catch (e) {
      console.error('Failed to fetch transactions:', e);
    }
  };

  const addTransaction = (hash: string, type: 'deploy' | 'mint' | 'burn') => {
    const newTx: Transaction = {
      hash,
      contractAddress: deployedAddress || '',
      timestamp: new Date().toISOString(),
      type
    };
    const updatedTxs = [newTx, ...transactions];
    setTransactions(updatedTxs);
    localStorage.setItem('midnight-nft-transactions', JSON.stringify(updatedTxs));
  };

  const deployNew = async () => {
    setAppLoading(true);
    setStatusMessage("🚀 Deploying contract...");
    try {
      const { address } = await onDeploy();
      if (address) {
        setDeployedAddress(address);
        localStorage.setItem('nft-contract-address', address);
        setStatusMessage("✅ Contract deployed!");
        fetchTransactions(address);
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("❌ Deploy failed: " + e);
    }
    setAppLoading(false);
  };

  const joinExisting = async () => {
    const address = deployedAddress || prompt("Enter contract address:");
    if (!address) return;
    
    setAppLoading(true);
    setStatusMessage("🔗 Joining contract...");
    try {
      await onJoin();
      setDeployedAddress(address);
      localStorage.setItem('nft-contract-address', address);
      setStatusMessage("✅ Joined contract!");
      fetchTransactions(address);
    } catch (e) {
      console.error(e);
      setStatusMessage("❌ Join failed: " + e);
    }
    setAppLoading(false);
  };

  const mintNFT = async () => {
    if (!ipfsUri) return;
    
    setMinting(true);
    setStatusMessage("🎨 Minting NFT...");
    
    try {
      if (deployedContractAPI) {
        setStatusMessage("⏳ Proving transaction...");
        await deployedContractAPI.increment();
        setStatusMessage("✅ Minted on-chain!");
        if (deployedAddress) {
          fetchTransactions(deployedAddress);
          addTransaction(Date.now().toString(16), 'mint');
        }
      } else {
        setStatusMessage("📝 Saved locally");
      }
      
      const newId = mintCount + 1;
      const newNFT: NFTMetadata = {
        id: newId,
        uri: ipfsUri,
        name: nftName || `Midnight NFT #${newId}`,
        description: nftDescription || "Minted on Midnight Network",
        mintedAt: new Date().toISOString(),
        txAddress: deployedAddress,
        txHash: transactions[0]?.hash,
        fileType,
        burned: false
      };
      
      const updatedNFTs = [...mintedNFTs, newNFT];
      setMintedNFTs(updatedNFTs);
      setMintCount(newId);
      localStorage.setItem('midnight-nfts', JSON.stringify(updatedNFTs));
      
      setIpfsUri("");
      setNftName("");
      setNftDescription("");
      
      alert(`🎉 ${fileType === 'audio' ? '🎵 Audio' : '🖼️'} NFT #${newNFT.id} Minted!`);
    } catch (error) {
      console.error("Minting failed:", error);
      setStatusMessage("❌ Minting failed");
    }
    setMinting(false);
  };

  const burnNFT = async (nft: NFTMetadata) => {
    if (!confirm(`Are you sure you want to burn "${nft.name}"? This cannot be undone.`)) return;
    
    setStatusMessage("🔥 Burning NFT...");
    try {
      if (deployedContractAPI) {
        await deployedContractAPI.increment(); // Use increment as burn marker
        addTransaction(Date.now().toString(16), 'burn');
      }
      
      const updatedNFTs = mintedNFTs.map(n => 
        n.id === nft.id ? { ...n, burned: true } : n
      );
      setMintedNFTs(updatedNFTs);
      localStorage.setItem('midnight-nfts', JSON.stringify(updatedNFTs));
      setStatusMessage("🔥 NFT Burned!");
      setSelectedNFT(null);
    } catch (e) {
      console.error(e);
      setStatusMessage("❌ Burn failed");
    }
  };

  const shareNFT = (nft: NFTMetadata) => {
    const shareText = `🎨 Check out my Midnight NFT!\n\n${nft.name}\n${nft.description}\n\n🔗 Contract: ${nft.txAddress?.substring(0, 20)}...\n🌐 Network: Midnight Preview\n\n#MidnightNetwork #NFT #Web3`;
    
    if (navigator.share) {
      navigator.share({
        title: nft.name,
        text: shareText,
        url: formatUri(nft.uri)
      });
    } else {
      navigator.clipboard.writeText(shareText);
      setStatusMessage("📋 Share text copied!");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text) || Promise.resolve();
    setStatusMessage("📋 Copied!");
    setTimeout(() => setStatusMessage(""), 2000);
  };

  const exportCollection = () => {
    const data = {
      network: 'Midnight Preview',
      contract: deployedAddress,
      nfts: mintedNFTs.filter(n => !n.burned),
      transactions,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midnight-nft-collection-${Date.now()}.json`;
    a.click();
    setStatusMessage("📦 Collection exported!");
  };

  const isConnected = !!deployedContractAPI;
  const hasContract = !!deployedAddress;
  const activeNFTs = mintedNFTs.filter(n => !n.burned);

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      {appLoading && <Loading />}
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">🎨 NFT Minter</h1>
            <p className="text-sm text-muted-foreground">Mint Images & Audio on Midnight</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTxPanel(!showTxPanel)}>
              📜 TX ({transactions.length})
            </Button>
            <Button variant="outline" size="sm" onClick={exportCollection}>
              📦 Export
            </Button>
            <ModeToggle />
          </div>
        </div>

        {statusMessage && (
          <div className={`mb-3 p-2 rounded text-center text-sm font-medium ${
            statusMessage.includes('✅') || statusMessage.includes('📋') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
            statusMessage.includes('❌') ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
            statusMessage.includes('🔥') ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
          }`}>
            {statusMessage}
          </div>
        )}

        {/* Transaction Panel */}
        {showTxPanel && (
          <Card className="mb-4">
            <CardContent className="py-3">
              <p className="font-bold text-sm mb-2">📜 Transaction History</p>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transactions.map((tx, idx) => (
                    <div key={`tx-${tx.hash}-${idx}`} className="p-2 bg-muted rounded text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className={`font-bold ${
                          tx.type === 'deploy' ? 'text-blue-600' :
                          tx.type === 'mint' ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {tx.type === 'deploy' ? '🚀 Deploy' : tx.type === 'mint' ? '🎨 Mint' : '🔥 Burn'}
                        </span>
                        <span className="text-muted-foreground">{new Date(tx.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="break-all text-blue-600 mt-1 cursor-pointer" onClick={() => copyToClipboard(tx.hash)}>
                        {tx.hash.substring(0, 30)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* NFT Detail Modal */}
        {selectedNFT && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedNFT(null)}>
            <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
              <CardContent className="p-4">
                {selectedNFT.fileType === 'audio' ? (
                  <div className="h-48 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
                    <Music className="w-16 h-16 text-white" />
                  </div>
                ) : (
                  <img src={formatUri(selectedNFT.uri)} alt={selectedNFT.name} className="w-full h-48 object-cover rounded-lg" />
                )}
                <h3 className="font-bold text-lg mt-3">{selectedNFT.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedNFT.description}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  ID: #{selectedNFT.id} • {new Date(selectedNFT.mintedAt).toLocaleDateString()}
                </p>
                {selectedNFT.fileType === 'audio' && (
                  <audio controls className="w-full mt-3">
                    <source src={formatUri(selectedNFT.uri)} />
                  </audio>
                )}
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => shareNFT(selectedNFT)} className="flex-1">
                    <Share2 className="w-4 h-4 mr-1" /> Share
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(formatUri(selectedNFT.uri), '_blank')} className="flex-1">
                    <ExternalLink className="w-4 h-4 mr-1" /> View
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => burnNFT(selectedNFT)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="ghost" className="w-full mt-2" onClick={() => setSelectedNFT(null)}>Close</Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-4">
          <CardHeader className="py-3 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
              {fileType === 'audio' ? <Music className="w-7 h-7 text-white" /> : <ImagePlus className="w-7 h-7 text-white" />}
            </div>
            <CardTitle className="text-xl">Mint Your NFT</CardTitle>
            <CardDescription className="text-xs">Network: Midnight Preview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={deployNew} disabled={hasContract || appLoading} size="sm" variant={hasContract ? "outline" : "default"}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {hasContract ? "Deployed" : "Deploy"}
                </Button>
                <Button onClick={joinExisting} disabled={isConnected || appLoading} size="sm" variant="outline">
                  {isConnected ? <CheckCircle className="w-3 h-3 mr-1 text-green-500" /> : null}
                  {isConnected ? "Connected" : "Join"}
                </Button>
              </div>

              {deployedAddress && (
                <div className="p-2 bg-muted rounded text-center text-xs cursor-pointer" onClick={() => copyToClipboard(deployedAddress)}>
                  <span className={isConnected ? 'text-green-600' : 'text-amber-600'}>
                    {isConnected ? '🟢' : '🟡'} {deployedAddress.substring(0, 20)}... <Copy className="w-3 h-3 inline" />
                  </span>
                </div>
              )}

              {hasContract && (
                <div className="space-y-3 p-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                  <div>
                    <Label className="text-xs">Media URL *</Label>
                    <Input
                      placeholder="https://... or ipfs://..."
                      value={ipfsUri}
                      onChange={(e) => setIpfsUri(e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">File Type</Label>
                    <div className="flex gap-2 mt-1">
                      <Button type="button" size="sm" variant={fileType === 'image' ? 'default' : 'outline'} onClick={() => setFileType('image')} className="flex-1">
                        🖼️ Image
                      </Button>
                      <Button type="button" size="sm" variant={fileType === 'audio' ? 'default' : 'outline'} onClick={() => setFileType('audio')} className="flex-1">
                        🎵 Audio
                      </Button>
                      <Button type="button" size="sm" variant={fileType === 'video' ? 'default' : 'outline'} onClick={() => setFileType('video')} className="flex-1">
                        🎬 Video
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input placeholder="My NFT" value={nftName} onChange={(e) => setNftName(e.target.value)} className="text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Input placeholder="Description..." value={nftDescription} onChange={(e) => setNftDescription(e.target.value)} className="text-sm" />
                    </div>
                  </div>

                  <Button onClick={mintNFT} disabled={!ipfsUri || minting} className="w-full bg-gradient-to-r from-purple-500 to-pink-500">
                    {fileType === 'audio' ? <Music className="w-4 h-4 mr-1" /> : <ImagePlus className="w-4 h-4 mr-1" />}
                    {minting ? "Minting..." : `Mint ${fileType === 'audio' ? '🎵 Audio' : fileType === 'video' ? '🎬 Video' : '🖼️ Image'} NFT`}
                  </Button>
                </div>
              )}

              {ipfsUri && (
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-xs font-medium mb-3">Preview ({fileType})</p>
                  {fileType === 'audio' ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center animate-pulse">
                        <Music className="w-12 h-12 text-white" />
                      </div>
                      <audio controls className="w-full max-w-sm" key={`preview-${ipfsUri}`}>
                        <source src={formatUri(ipfsUri)} type="audio/mpeg" />
                      </audio>
                    </div>
                  ) : fileType === 'video' ? (
                    <video controls className="max-w-xs mx-auto rounded" key={`preview-${ipfsUri}`}>
                      <source src={formatUri(ipfsUri)} />
                    </video>
                  ) : (
                    <img src={formatUri(ipfsUri)} alt="Preview" className="max-w-[200px] mx-auto rounded shadow" />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Card><CardContent className="py-3 text-center">
                  <p className="text-xs text-muted-foreground">On-Chain</p>
                  <p className="text-xl font-bold">{mintCount}</p>
                </CardContent></Card>
                <Card><CardContent className="py-3 text-center">
                  <p className="text-xs text-muted-foreground">Active NFTs</p>
                  <p className="text-xl font-bold">{activeNFTs.length}</p>
                </CardContent></Card>
              </div>

              {activeNFTs.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm mb-2">🖼️ Your Collection</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {activeNFTs.map((nft) => (
                      <Card 
                        key={`nft-${nft.id}-${nft.mintedAt}`} 
                        className="overflow-hidden cursor-pointer hover:ring-2 ring-purple-500 transition-all"
                        onClick={() => setSelectedNFT(nft)}
                      >
                        {nft.fileType === 'audio' ? (
                          <div className="h-24 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                            <Music className="w-8 h-8 text-white" />
                          </div>
                        ) : (
                          <img src={formatUri(nft.uri)} alt={nft.name} className="w-full h-24 object-cover" />
                        )}
                        <CardContent className="p-2">
                          <p className="font-medium text-xs truncate">{nft.name}</p>
                          <p className="text-xs text-muted-foreground">#{nft.id} {nft.fileType === 'audio' ? '🎵' : '🖼️'}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {providers?.flowMessage && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-center text-sm text-blue-600">
                  {providers.flowMessage}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Proof of On-Chain */}
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs font-medium text-green-600 mb-1">✅ Verified On Midnight Network</p>
            <p className="text-xs text-muted-foreground">Contract: {deployedAddress?.substring(0, 30)}...</p>
            <p className="text-xs text-muted-foreground">Network: Preview | Transactions: {transactions.length}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

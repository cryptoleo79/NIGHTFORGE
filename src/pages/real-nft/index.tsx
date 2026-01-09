import { useState, useEffect } from "react";
// Convert IPFS URLs to gateway URLs for display
const getDisplayUrl = (uri: string): string => {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return uri;
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNFTSubscription } from "@/modules/midnight/nft-sdk/hooks/use-nft-subscription";
import { ImagePlus, Sparkles, CheckCircle, ExternalLink, Grid, Plus, X, Loader2, Music, Film, Shield, Database, Hash, Box, FileText, Clock, Link2, Share2, Info, Image } from "lucide-react";
const INDEXER_API = "/api/preview";
const fetchRealTxHash = async (blockHeight: number): Promise<string | null> => {
  try {
    const res = await fetch(INDEXER_API + "/block/" + blockHeight);
    if (!res.ok) return null;
    const data = await res.json();
    const midnightTx = data.extrinsics?.find((e: any) => e.section === "midnight" && e.method === "sendMnTransaction");
    return midnightTx?.hash || null;
  } catch { return null; }
};
type MediaType = 'image' | 'audio' | 'video';

interface MintRecord {
  contractAddress: string;
  tokenId: number;
  uri: string;
  thumbnailUri?: string;
  name: string;
  description: string;
  mediaType: MediaType;
  txHash?: string;
  blockHeight?: number;
  mintedAt: string;
}

export const RealNFTMinter = () => {
  const { deployedContractAPI, derivedState, onDeploy } = useNFTSubscription();
  const [deployedAddress, setDeployedAddress] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [tokenURI, setTokenURI] = useState("");
  const [thumbnailURI, setThumbnailURI] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [nftName, setNftName] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState<string>();
  const [blockHeight, setBlockHeight] = useState<number>();
  const [mintHistory, setMintHistory] = useState<MintRecord[]>([]);
  const [view, setView] = useState<'mint' | 'collection'>('mint');
  const [selectedNFT, setSelectedNFT] = useState<MintRecord | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const savedContract = localStorage.getItem('real-nft-contract');
    if (savedContract) setDeployedAddress(savedContract);
    const savedHistory = localStorage.getItem('real-nft-history');
    if (savedHistory) setMintHistory(JSON.parse(savedHistory));
  }, []);

  const deployContract = async () => {
    setLoading(true);
    setStatus("Deploying smart contract...");
    try {
      const { address } = await onDeploy();
      setDeployedAddress(address);
      localStorage.setItem('real-nft-contract', address || '');
      setStatus("");
    } catch (e) {
      setStatus("Deployment failed: " + e);
    }
    setLoading(false);
  };

  const mintNFT = async () => {
    if (!tokenURI || !deployedContractAPI) return;
    setLoading(true);
    setStatus("Creating ZK proof & submitting transaction...");
    try {
      const result = await (deployedContractAPI as any).deployedContract.callTx.mint(tokenURI);
      const hash = result?.public?.txHash;
      const block = result?.public?.blockHeight;
      setTxHash(hash);
      if (block) {
        setTimeout(async () => {
          const realHash = await fetchRealTxHash(block);
          if (realHash) {
            setTxHash(realHash);
            const history = JSON.parse(localStorage.getItem("real-nft-history") || "[]");
            if (history.length > 0) { history[0].txHash = realHash; localStorage.setItem("real-nft-history", JSON.stringify(history)); }
          }
        }, 5000);
      }
      setBlockHeight(block);
      
      const newRecord: MintRecord = {
        contractAddress: deployedAddress || '',
        tokenId: Number(derivedState?.ledger?.tokenId || 1),
        uri: tokenURI,
        thumbnailUri: thumbnailURI || undefined,
        name: nftName || `Midnight NFT #${mintHistory.length + 1}`,
        description: nftDescription || "Minted on Midnight Network",
        mediaType,
        txHash: hash,
        blockHeight: block,
        mintedAt: new Date().toISOString()
      };
      const updatedHistory = [newRecord, ...mintHistory];
      setMintHistory(updatedHistory);
      localStorage.setItem('real-nft-history', JSON.stringify(updatedHistory));
      setStatus("");
    } catch (e) {
      setStatus("Minting failed: " + e);
    }
    setLoading(false);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const shareNFT = async (record: MintRecord) => {
    const shareText = `🎨 Check out my NFT minted on Midnight Preview Network!\n\n📛 ${record.name}\n🔗 Contract: ${record.contractAddress}\n#️⃣ TX: ${record.txHash}\n📦 Block: ${record.blockHeight}\n🖼️ Media: ${record.uri}\n\n⚠️ Midnight Preview Network - No public explorer yet`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: record.name, text: shareText, url: record.uri });
      } catch (err) {
        copyToClipboard(shareText, 'share');
      }
    } else {
      copyToClipboard(shareText, 'share');
    }
  };

  const resetForNewMint = () => {
    localStorage.removeItem('real-nft-contract');
    setDeployedAddress(undefined);
    setTxHash(undefined);
    setBlockHeight(undefined);
    setTokenURI("");
    setThumbnailURI("");
    setNftName("");
    setNftDescription("");
  };

  const ledger = derivedState?.ledger;
  const isMinted = ledger?.state === 1;
  const uri = ledger?.tokenURI?.is_some ? ledger.tokenURI.value : null;

  const NetworkBadge = () => (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-full">
      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
      <span className="text-amber-300 text-xs font-semibold uppercase tracking-wider">Preview Network</span>
    </div>
  );

  const CopyableField = ({ label, value, icon: Icon, fullValue }: { label: string; value: string; icon: any; fullValue?: string }) => (
    <div className="group p-4 bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer transition-all border border-slate-700 hover:border-violet-500" onClick={() => copyToClipboard(fullValue || value, label)}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-slate-400">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        <div className={`text-xs transition-all ${copied === label ? 'text-green-400' : 'text-slate-500 group-hover:text-violet-400'}`}>
          {copied === label ? '✓ Copied' : 'Click to copy'}
        </div>
      </div>
      <p className="font-mono text-sm text-white break-all">{value}</p>
    </div>
  );

  const MediaPreview = ({ src, type, thumbnail, className = "" }: { src: string; type: MediaType; thumbnail?: string; className?: string }) => {
    if (type === 'audio') {
      return (
        <div className={`flex flex-col items-center gap-4 ${className}`}>
          {thumbnail ? (
            <img src={getDisplayUrl(thumbnail)} alt="Album art" className="w-48 h-48 rounded-2xl object-cover shadow-2xl shadow-purple-500/25" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
          ) : null}
          <div className={`w-48 h-48 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/25 ${thumbnail ? 'hidden' : ''}`}>
            <Music className="w-24 h-24 text-white/90" />
          </div>
          <audio controls className="w-full max-w-sm"><source src={getDisplayUrl(src)} /></audio>
        </div>
      );
    }
    if (type === 'video') {
      return (
        <div className={`flex flex-col items-center gap-4 ${className}`}>
          {thumbnail && (
            <img src={getDisplayUrl(thumbnail)} alt="Video thumbnail" className="w-full max-h-40 rounded-xl object-cover mb-2" />
          )}
          <video controls className="rounded-2xl shadow-2xl w-full"><source src={getDisplayUrl(src)} /></video>
        </div>
      );
    }
    return <img src={getDisplayUrl(src)} alt="NFT" className={`rounded-2xl shadow-2xl object-cover ${className}`} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />;
  };

  const NFTModal = ({ record, onClose }: { record: MintRecord; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">{record.name}</h2>
              <p className="text-slate-400">Token #{record.tokenId}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="mb-4"><NetworkBadge /></div>
          <div className="mb-6">
            <MediaPreview src={getDisplayUrl(record.uri)} type={record.mediaType} thumbnail={record.thumbnailUri} className="w-full max-h-72 mx-auto" />
          </div>
          <p className="text-slate-300 mb-6">{record.description}</p>
          <div className="space-y-3">
            <CopyableField label="Contract Address" value={record.contractAddress} icon={FileText} />
            {record.txHash && <CopyableField label="Transaction Hash" value={record.txHash} icon={Hash} />}
            {record.blockHeight && (
              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Box className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Block Height</span>
                </div>
                <p className="font-mono text-xl text-white">{record.blockHeight}</p>
              </div>
            )}
            <CopyableField label="Media URI" value={record.uri} icon={Link2} />
            {record.thumbnailUri && <CopyableField label="Thumbnail URI" value={record.thumbnailUri} icon={Image} />}
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Minted At</span>
              </div>
              <p className="text-white">{new Date(record.mintedAt).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-300 font-medium">Preview Network</p>
              <p className="text-amber-200/70">Your NFT is verified on-chain! View transactions in the Explorer tab above.</p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={() => window.open(record.uri, '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" /> View Media
            </Button>
            <Button className="flex-1 bg-slate-700 hover:bg-slate-600" onClick={() => shareNFT(record)}>
              <Share2 className="w-4 h-4 mr-2" /> {copied === 'share' ? 'Copied!' : 'Share'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      {selectedNFT && <NFTModal record={selectedNFT} onClose={() => setSelectedNFT(null)} />}
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <NetworkBadge />
          <span className="text-slate-400 text-sm">Night Forge Studio</span>
        </div>
        <div className="flex bg-slate-800 rounded-xl p-1">
          <Button variant="ghost" size="sm" onClick={() => setView("mint")} className={`rounded-lg ${view === "mint" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>
            <Plus className="w-4 h-4 mr-2" /> Mint
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView("collection")} className={`rounded-lg ${view === "collection" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>
            <Grid className="w-4 h-4 mr-2" /> Collection ({mintHistory.length})
          </Button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {status && (
          <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-700 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50">
            {loading && <Loader2 className="w-5 h-5 animate-spin text-violet-400" />}
            <span className="text-slate-200">{status}</span>
          </div>
        )}

        {view === 'collection' && (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-3">Your Collection</h2>
              <p className="text-slate-400 text-lg">{mintHistory.length} NFTs stored on Midnight Preview Network</p>
            </div>
            {mintHistory.length === 0 ? (
              <div className="text-center py-24">
                <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <ImagePlus className="w-12 h-12 text-slate-600" />
                </div>
                <h3 className="text-xl font-medium mb-2">No NFTs yet</h3>
                <p className="text-slate-400 mb-6">Create your first on-chain NFT</p>
                <Button onClick={() => setView('mint')} className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-2" /> Create NFT
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {mintHistory.map((record, idx) => (
                  <div key={idx} className="group cursor-pointer" onClick={() => setSelectedNFT(record)}>
                    <div className="aspect-square rounded-2xl overflow-hidden bg-slate-800 mb-3 ring-2 ring-transparent group-hover:ring-violet-500 transition-all shadow-xl">
                      {record.mediaType === 'audio' ? (
                        record.thumbnailUri ? (
                          <img src={getDisplayUrl(record.thumbnailUri)} alt={record.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center"><svg class="w-16 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg></div>'; }} />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                            <Music className="w-16 h-16 text-white/80" />
                          </div>
                        )
                      ) : record.mediaType === 'video' ? (
                        record.thumbnailUri ? (
                          <img src={getDisplayUrl(record.thumbnailUri)} alt={record.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center"><svg class="w-16 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg></div>'; }} />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                            <Film className="w-16 h-16 text-white/80" />
                          </div>
                        )
                      ) : (
                        <img src={getDisplayUrl(record.uri)} alt={record.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full bg-slate-700 flex items-center justify-center"><span class="text-4xl">🖼️</span></div>'; }} />
                      )}
                    </div>
                    <h3 className="font-semibold text-white truncate">{record.name}</h3>
                    <p className="text-sm text-slate-400">#{record.tokenId} • Block {record.blockHeight}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'mint' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-3">Create NFT</h2>
              <p className="text-slate-400 text-lg">Store your media URI permanently on the Midnight blockchain</p>
            </div>

            {isMinted && uri ? (
              <div className="space-y-6">
                <div className="text-center p-8 bg-gradient-to-b from-green-500/10 to-transparent rounded-3xl border border-green-500/20">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/25">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold mb-2">NFT Minted Successfully!</h3>
                  <p className="text-slate-400 mb-4">Your media URI is now permanently stored on-chain</p>
                  <NetworkBadge />
                </div>
                <div className="p-6 bg-slate-800/50 rounded-3xl border border-slate-700">
                  <MediaPreview src={getDisplayUrl(uri)} type={mediaType} thumbnail={thumbnailURI} className="max-h-80 mx-auto" />
                </div>
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <Database className="w-5 h-5 text-violet-400" /> On-Chain Record
                  </h4>
                  <CopyableField label="Contract Address" value={deployedAddress || ''} icon={FileText} />
                  {txHash && <CopyableField label="Transaction Hash" value={txHash} icon={Hash} />}
                  {blockHeight && (
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Box className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">Block Height</span>
                      </div>
                      <p className="font-mono text-2xl text-white">{blockHeight}</p>
                    </div>
                  )}
                  <CopyableField label="Token URI (Stored On-Chain)" value={uri.length > 60 ? uri.substring(0, 60) + '...' : uri} icon={Link2} fullValue={uri} />
                  {thumbnailURI && <CopyableField label="Thumbnail URI" value={thumbnailURI.length > 60 ? thumbnailURI.substring(0, 60) + '...' : thumbnailURI} icon={Image} fullValue={thumbnailURI} />}
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                      <span className="text-amber-300 font-semibold">Midnight Preview Network</span>
                    </div>
                    <p className="text-amber-200/70 text-sm">Your NFT is stored on-chain. Public block explorer coming soon.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Hash className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">Token ID</span>
                      </div>
                      <p className="font-mono text-2xl text-white">#{String(ledger?.tokenId)}</p>
                    </div>
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">Status</span>
                      </div>
                      <p className="text-green-400 font-semibold text-lg">MINTED</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button className="flex-1 h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700" onClick={() => setView('collection')}>
                    <Grid className="w-5 h-5 mr-2" /> View Collection
                  </Button>
                  <Button className="flex-1 h-14 bg-violet-600 hover:bg-violet-700" onClick={resetForNewMint}>
                    <Plus className="w-5 h-5 mr-2" /> Mint Another
                  </Button>
                </div>
                <Button className="w-full h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700" onClick={() => shareNFT({ contractAddress: deployedAddress || '', tokenId: Number(ledger?.tokenId), uri, thumbnailUri: thumbnailURI || undefined, name: nftName || 'Midnight NFT', description: nftDescription, mediaType, txHash, blockHeight, mintedAt: new Date().toISOString() })}>
                  <Share2 className="w-5 h-5 mr-2" /> {copied === 'share' ? 'Copied to clipboard!' : 'Share NFT'}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`p-6 rounded-3xl border transition-all ${deployedAddress ? 'bg-green-500/5 border-green-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${deployedAddress ? 'bg-green-500 text-white' : 'bg-violet-600 text-white'}`}>
                      {deployedAddress ? <CheckCircle className="w-5 h-5" /> : '1'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Deploy Smart Contract</h3>
                      <p className="text-sm text-slate-400">Create your NFT contract on Midnight</p>
                    </div>
                  </div>
                  {!deployedAddress ? (
                    <Button onClick={deployContract} disabled={loading} className="w-full h-14 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-lg font-semibold">
                      {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                      Deploy Contract
                    </Button>
                  ) : (
                    <div className="flex gap-3"><div className="flex-1"><CopyableField label="Contract Address" value={deployedAddress} icon={FileText} /></div><Button onClick={resetForNewMint} className="h-full px-4 bg-slate-700 hover:bg-slate-600 border border-slate-600"><Plus className="w-4 h-4" /></Button></div>
                  )}
                </div>

                {deployedAddress && (
                  <div className="p-6 bg-slate-800/50 rounded-3xl border border-slate-700 space-y-5">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold">2</div>
                      <div>
                        <h3 className="font-semibold text-lg">Configure & Mint</h3>
                        <p className="text-sm text-slate-400">Set up your NFT and mint it on-chain</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-3 block">Media Type</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['image', 'audio', 'video'] as MediaType[]).map((type) => (
                          <button key={type} onClick={() => setMediaType(type)} className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${mediaType === type ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                            {type === 'image' && <ImagePlus className="w-6 h-6" />}
                            {type === 'audio' && <Music className="w-6 h-6" />}
                            {type === 'video' && <Film className="w-6 h-6" />}
                            <span className="capitalize text-sm font-medium">{type}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-2 block">Media URI *</Label>
                      <Input placeholder="https://... or ipfs://..." value={tokenURI} onChange={(e) => setTokenURI(e.target.value)} className="h-12 bg-slate-900 border-slate-700 font-mono text-white placeholder:text-slate-500" />
                      <p className="text-xs text-slate-500 mt-2">This URI will be permanently stored on the blockchain</p>
                    </div>
                    {(mediaType === 'audio' || mediaType === 'video') && (
                      <div>
                        <Label className="text-slate-300 mb-2 block flex items-center gap-2">
                          <Image className="w-4 h-4" /> Thumbnail URI (Optional)
                        </Label>
                        <Input placeholder="https://... or ipfs://... (cover art / preview image)" value={thumbnailURI} onChange={(e) => setThumbnailURI(e.target.value)} className="h-12 bg-slate-900 border-slate-700 font-mono text-white placeholder:text-slate-500" />
                        <p className="text-xs text-slate-500 mt-2">Upload your thumbnail to Pinata separately and paste the URI here</p>
                      </div>
                    )}
                    {tokenURI && (
                      <div className="p-6 bg-slate-900 rounded-2xl">
                        <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">Preview</p>
                        <MediaPreview src={getDisplayUrl(tokenURI)} type={mediaType} thumbnail={thumbnailURI} className="max-h-56 mx-auto" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300 mb-2 block">Name</Label>
                        <Input placeholder="My NFT" value={nftName} onChange={(e) => setNftName(e.target.value)} className="h-12 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
                      </div>
                      <div>
                        <Label className="text-slate-300 mb-2 block">Description</Label>
                        <Input placeholder="Description..." value={nftDescription} onChange={(e) => setNftDescription(e.target.value)} className="h-12 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
                      </div>
                    </div>
                    <Button onClick={mintNFT} disabled={loading || !tokenURI} className="w-full h-16 text-lg font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50">
                      {loading ? <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Creating ZK Proof...</> : <><Sparkles className="w-6 h-6 mr-3" /> Mint NFT On-Chain</>}
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-center gap-8 py-6 text-sm text-slate-400">
                  <div className="flex items-center gap-2"><Database className="w-4 h-4 text-green-400" /><span>On-Chain Storage</span></div>
                  <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-violet-400" /><span>ZK Proofs</span></div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-400 rounded-full" />
                    <span>Preview Network</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

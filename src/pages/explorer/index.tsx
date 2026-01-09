import { useParams, useNavigate } from "react-router-dom";
import { EpochWidget } from "@/components/EpochWidget";
import { useState, useEffect, useCallback, useRef } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Box, Clock, ChevronRight, RefreshCw, Copy, CheckCircle, Blocks, FileCode, Zap, Eye, Wifi, X, ArrowLeft, Loader2, Database, BarChart3, TrendingUp, Globe } from "lucide-react";

const NETWORKS = {
  preview: { name: "Preview Network", rpc: "wss://rpc.preview.midnight.network", api: "/api/preview", badge: "PREVIEW" },
  testnet: { name: "Testnet-02", rpc: "wss://rpc.testnet-02.midnight.network", api: "/api/testnet", badge: "TESTNET-02" }
};

const NightPriceWidget = () => {
  const [price, setPrice] = useState<{usd: number, change: number, mcap: number} | null>(null);
  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=midnight-3&vs_currencies=usd&include_market_cap=true&include_24hr_change=true")
      .then(r => r.json()).then(d => { if(d["midnight-3"]) setPrice({usd: d["midnight-3"].usd, change: d["midnight-3"].usd_24h_change, mcap: d["midnight-3"].usd_market_cap}); }).catch(() => {});
  }, []);
  if(!price) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700">
      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">◐</div>
      <div><p className="text-xs text-slate-400">NIGHT</p><p className="font-semibold text-white">${price.usd.toFixed(4)}</p></div>
      <div className={price.change >= 0 ? "text-green-400 text-sm" : "text-red-400 text-sm"}>{price.change >= 0 ? "↑" : "↓"}{Math.abs(price.change).toFixed(2)}%</div>
      <div className="hidden md:block border-l border-slate-700 pl-3"><p className="text-xs text-slate-400">MCap</p><p className="text-sm text-white">${(price.mcap/1e9).toFixed(2)}B</p></div>
    </div>
  );
};

interface Block { height: number; hash: string; timestamp: string; txCount: number; parentHash?: string; extrinsics?: Extrinsic[]; }
interface Extrinsic { hash: string; blockHeight: number; timestamp: string; section?: string; method?: string; args?: any; index?: number; }
interface Contract { address: string; deployedAt: string; blockHeight: number; name?: string; type?: string; }

export const Explorer = () => {
  const { height, hash } = useParams();
  const navigate = useNavigate();
  const [activeNetwork, setActiveNetwork] = useState<"preview" | "testnet">(() => { const host = window.location.hostname; if (host.startsWith("testnet.")) return "testnet"; if (host.startsWith("preview.")) return "preview"; const path = window.location.pathname; if (path.includes("/explorer/testnet")) return "testnet"; if (path.includes("/explorer/preview")) return "preview"; return (localStorage.getItem("midnight-network") as "preview" | "testnet") || "preview"; });
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const NETWORK = NETWORKS[activeNetwork];
  const INDEXER_API = NETWORK.api;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "block" | "transaction" | "contract">("all");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'transactions' | 'contracts'>('overview');
  const [isLive, setIsLive] = useState(true);
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedTx, setSelectedTx] = useState<Extrinsic | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [indexerStats, setIndexerStats] = useState<any>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const [stats, setStats] = useState({ totalBlocks: 0, finalizedBlock: 0, totalTxs: 0, totalContracts: 0, chain: '', nodeName: '', nodeVersion: '' });
  const [recentBlocks, setRecentBlocks] = useState<Block[]>([]);
  const [recentTxs, setRecentTxs] = useState<Extrinsic[]>([]);
  const [deployedContracts, setDeployedContracts] = useState<Contract[]>([]);

  const fetchFromIndexer = async (endpoint: string) => {
    try { const res = await fetch(INDEXER_API + endpoint); if (!res.ok) throw new Error("Indexer request failed"); return await res.json(); } catch (e) { return null; }
  };

  const connectToNetwork = useCallback(async () => {
    setConnecting(true);
    try {
      const provider = new WsProvider(NETWORK.rpc);
      const apiInstance = await ApiPromise.create({ provider, noInitWarn: true });
      const [chain, nodeName, nodeVersion] = await Promise.all([apiInstance.rpc.system.chain(), apiInstance.rpc.system.name(), apiInstance.rpc.system.version()]);
      setApi(apiInstance);
      setStats(prev => ({ ...prev, chain: chain.toString(), nodeName: nodeName.toString(), nodeVersion: nodeVersion.toString() }));
      setConnecting(false);
      const iStats = await fetchFromIndexer('/stats');
      if (iStats) setIndexerStats(iStats);
      return apiInstance;
    } catch (err: any) { setError("Connection failed: " + err.message); setConnecting(false); return null; }
  }, [NETWORK.rpc, INDEXER_API]);

  const fetchBlocksParallel = useCallback(async (apiInstance: ApiPromise) => {
    setLoadingBlocks(true);
    try {
      const indexerBlocks = await fetchFromIndexer('/blocks?limit=20');
      if (indexerBlocks?.length > 0) {
        const blocks: Block[] = indexerBlocks.map((b: any) => ({ height: b.height, hash: b.hash, timestamp: new Date(b.timestamp * 1000).toISOString(), txCount: b.extrinsics_count, parentHash: b.parent_hash }));
        setRecentBlocks(blocks);
        if (blocks.length > 0) setStats(prev => ({ ...prev, totalBlocks: blocks[0].height }));
      }
      const indexerExts = await fetchFromIndexer('/extrinsics?limit=50');
      if (indexerExts?.length > 0) {
        const txs: Extrinsic[] = indexerExts.map((e: any) => ({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, index: e.index_in_block }));
        setRecentTxs(txs);
        setStats(prev => ({ ...prev, totalTxs: txs.length }));
      }
      const finalizedHash = await apiInstance.rpc.chain.getFinalizedHead();
      const finalizedHeader = await apiInstance.rpc.chain.getHeader(finalizedHash);
      setStats(prev => ({ ...prev, finalizedBlock: finalizedHeader.number.toNumber() }));
    } catch (err) { console.error("Fetch error:", err); }
    setLoadingBlocks(false);
  }, [INDEXER_API]);

  const fetchBlockDetails = async (blockNum: number) => {
    setLoadingDetail(true);
    try {
      const indexerBlock = await fetchFromIndexer(`/block/${blockNum}`);
      if (indexerBlock) {
        const extrinsics: Extrinsic[] = (indexerBlock.extrinsics || []).map((e: any) => ({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, args: e.args ? JSON.parse(e.args) : [], index: e.index_in_block }));
        setLoadingDetail(false);
        return { height: indexerBlock.height, hash: indexerBlock.hash, timestamp: new Date(indexerBlock.timestamp * 1000).toISOString(), txCount: indexerBlock.extrinsics_count, parentHash: indexerBlock.parent_hash, extrinsics };
      }
    } catch (err) {}
    setLoadingDetail(false);
    return null;
  };

  const handleBlockClick = async (block: Block) => { const details = await fetchBlockDetails(block.height); if (details) { setSelectedBlock(details); setSelectedTx(null); navigate("/explorer/block/" + block.height); } };
  const handleTxClick = (tx: Extrinsic) => { setSelectedTx(tx); setSelectedBlock(null); navigate("/explorer/tx/" + tx.hash); };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return; setSearching(true); setError(null);
    let query = searchQuery.trim();
    if (query.length >= 64 && !query.startsWith('0x') && /^[a-fA-F0-9]+$/.test(query)) query = '0x' + query;
    try {
      const result = await fetchFromIndexer(`/search?q=${encodeURIComponent(query)}`);
      if (result) {
        if (result.type === 'block' && result.result) { const details = await fetchBlockDetails(result.result.height); if (details) { setSelectedBlock(details); setSelectedTx(null); setSearchQuery(""); setSearching(false); return; } }
        if (result.type === 'extrinsic' && result.result) { const e = result.result; setSelectedTx({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, index: e.index_in_block }); setSelectedBlock(null); setSearchQuery(""); setSearching(false); return; }
        if (result.results?.length > 0) { const e = result.results[0]; setSelectedTx({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, index: e.index_in_block }); setSelectedBlock(null); setSearchQuery(""); setSearching(false); return; }
      }
      if (/^\d+$/.test(query)) { const details = await fetchBlockDetails(parseInt(query)); if (details) { setSelectedBlock(details); setSelectedTx(null); setSearchQuery(""); setSearching(false); return; } }
      setError("Not found. Try a block number or full hash.");
    } catch (err: any) { setError(err.message); }
    setSearching(false);
  };

  const subscribeBlocks = useCallback(async (apiInstance: ApiPromise) => {
    try {
      return await apiInstance.rpc.chain.subscribeNewHeads(async (header) => {
        const num = header.number.toNumber();
        try {
          const block = await apiInstance.rpc.chain.getBlock(header.hash);
          const ts = await apiInstance.query.timestamp?.now?.at(header.hash);
          const timestamp = ts ? new Date(Number(ts)).toISOString() : new Date().toISOString();
          const newBlock: Block = { height: num, hash: header.hash.toString(), timestamp, txCount: block.block.extrinsics.length, parentHash: header.parentHash.toString() };
          setRecentBlocks(prev => [newBlock, ...prev.slice(0, 19)]); setStats(prev => ({ ...prev, totalBlocks: num }));
          const finalizedHash = await apiInstance.rpc.chain.getFinalizedHead();
          const finalizedHeader = await apiInstance.rpc.chain.getHeader(finalizedHash);
          setStats(prev => ({ ...prev, finalizedBlock: finalizedHeader.number.toNumber() }));
          if (block.block.extrinsics.length > 0) {
            const newTxs: Extrinsic[] = block.block.extrinsics.map((ext, idx) => ({ hash: ext.hash.toString(), blockHeight: num, timestamp, section: ext.method.section, method: ext.method.method, index: idx }));
            setRecentTxs(prev => [...newTxs, ...prev].slice(0, 50));
          }
        } catch (e) {}
      });
    } catch (err) { return () => {}; }
  }, []);

  const loadLocalData = () => { try { const saved = localStorage.getItem('real-nft-history'); if (saved) { const history = JSON.parse(saved); const contracts: Contract[] = history.map((nft: any) => ({ address: nft.contractAddress, deployedAt: nft.mintedAt, blockHeight: nft.blockHeight || 0, name: nft.name, type: 'NFT' })); setDeployedContracts(contracts); setStats(prev => ({ ...prev, totalContracts: contracts.length })); } } catch (e) {} };

  useEffect(() => { const init = async () => { loadLocalData(); const apiInstance = await connectToNetwork(); if (apiInstance) { await fetchBlocksParallel(apiInstance); if (isLive) unsubRef.current = await subscribeBlocks(apiInstance) as any; } }; init(); return () => { if (unsubRef.current) unsubRef.current(); }; }, [activeNetwork]);
  useEffect(() => { if (height) { fetchBlockDetails(parseInt(height)).then(b => { if (b) setSelectedBlock(b); }); } else if (hash) { fetchFromIndexer("/extrinsic/" + hash).then(e => { if (e) setSelectedTx({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, index: e.index_in_block }); }); } else { setSelectedBlock(null); setSelectedTx(null); } }, [height, hash]);
  useEffect(() => { if (height) { fetchBlockDetails(parseInt(height)).then(b => { if (b) setSelectedBlock(b); }); } else if (hash) { fetchFromIndexer("/extrinsic/" + hash).then(e => { if (e) setSelectedTx({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, index: e.index_in_block }); }); } else { setSelectedBlock(null); setSelectedTx(null); } }, [height, hash]);

  const copyToClipboard = (text: string, label: string) => { navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 2000); };
  const formatTime = (ts: string) => { try { const diff = Date.now() - new Date(ts).getTime(); if (diff < 60000) return Math.floor(diff / 1000) + "s ago"; if (diff < 3600000) return Math.floor(diff / 60000) + "m ago"; if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago"; return Math.floor(diff / 86400000) + "d ago"; } catch { return 'N/A'; } };
  const truncHash = (hash: string, len = 8) => hash ? hash.slice(0, len) + "..." + hash.slice(-len) : '';
  const connected = !connecting && api;

  const BlockDetail = ({ block }: { block: Block }) => (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center gap-3"><Button variant="ghost" size="sm" onClick={() => { setSelectedBlock(null); navigate("/explorer"); }} className="text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button><h3 className="text-lg font-semibold">Block #{block.height.toLocaleString()}</h3></div>
      <div className="p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4"><p className="text-xs text-slate-500 uppercase mb-1">Block Hash</p><div className="flex items-center gap-2"><p className="font-mono text-cyan-400 text-sm break-all">{block.hash}</p><Copy className="w-4 h-4 cursor-pointer text-slate-500 hover:text-cyan-400 flex-shrink-0" onClick={() => copyToClipboard(block.hash, 'hash')} /></div></div>
          <div className="bg-slate-900/50 rounded-xl p-4"><p className="text-xs text-slate-500 uppercase mb-1">Parent Hash</p><p className="font-mono text-slate-300 text-sm break-all">{block.parentHash}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 uppercase mb-1">Height</p><p className="text-2xl font-bold text-white">{block.height.toLocaleString()}</p></div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 uppercase mb-1">Transactions</p><p className="text-2xl font-bold text-purple-400">{block.txCount}</p></div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 uppercase mb-1">Time</p><p className="text-lg font-semibold text-white">{formatTime(block.timestamp)}</p></div>
        </div>
        {block.extrinsics && block.extrinsics.length > 0 && (<div><h4 className="font-semibold mb-3 text-slate-300">Transactions ({block.extrinsics.length})</h4><div className="space-y-2 max-h-80 overflow-y-auto">{block.extrinsics.map((ext, idx) => (<div key={idx} onClick={() => handleTxClick(ext)} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-slate-800/50 cursor-pointer"><div className="flex items-center gap-3"><span className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center text-green-400 text-sm font-mono">{ext.index}</span><p className="font-mono text-sm text-white">{truncHash(ext.hash, 10)}</p></div><span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-300">{ext.section}.{ext.method}</span></div>))}</div></div>)}
      </div>
    </div>
  );

  const TxDetail = ({ tx }: { tx: Extrinsic }) => (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between"><div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={() => { setSelectedTx(null); navigate("/explorer"); }} className="text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button><h3 className="text-lg font-semibold">Transaction Details</h3></div><span className="px-3 py-1 text-sm rounded-full bg-green-500/20 text-green-400">Success</span></div>
      <div className="p-6 space-y-4">
        <div className="bg-slate-900/50 rounded-xl p-4"><p className="text-xs text-slate-500 uppercase mb-1">Hash</p><div className="flex items-center gap-2"><p className="font-mono text-cyan-400 break-all">{tx.hash}</p><Copy className="w-4 h-4 cursor-pointer text-slate-500 hover:text-cyan-400 flex-shrink-0" onClick={() => copyToClipboard(tx.hash, 'tx')} /></div></div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 uppercase mb-1">Block</p><p className="text-xl font-bold text-blue-400 cursor-pointer hover:text-blue-300" onClick={async () => { const b = await fetchBlockDetails(tx.blockHeight); if (b) { setSelectedBlock(b); setSelectedTx(null); } }}>#{tx.blockHeight.toLocaleString()}</p></div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 uppercase mb-1">Index</p><p className="text-xl font-bold text-white">{tx.index}</p></div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 uppercase mb-1">Time</p><p className="text-lg font-semibold text-white">{formatTime(tx.timestamp)}</p></div>
        </div>
        <div className="bg-slate-900/50 rounded-xl p-4"><p className="text-xs text-slate-500 uppercase mb-2">Method</p><div className="flex items-center gap-2"><span className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 font-mono">{tx.section}</span><ChevronRight className="w-4 h-4 text-slate-500" /><span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 font-mono">{tx.method}</span></div></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white">
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {error && (<div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3"><X className="w-5 h-5 text-red-400" /><p className="text-red-300 flex-1">{error}</p><Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-400">Dismiss</Button></div>)}
        {loadingDetail && (<div className="mb-6 p-8 bg-slate-800/50 rounded-2xl border border-slate-700 text-center"><Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-cyan-400" /><p className="text-slate-400">Loading...</p></div>)}
        {selectedBlock && !loadingDetail && <BlockDetail block={selectedBlock} />}
        {selectedTx && !loadingDetail && <TxDetail tx={selectedTx} />}
        {!selectedBlock && !selectedTx && !loadingDetail && (
          <>
            <div className="mb-8">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <div className="relative">
                  <button onClick={() => setShowSearchDropdown(!showSearchDropdown)} className="h-14 px-4 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center gap-2 text-slate-300 hover:bg-slate-700/50">
                    <span className="capitalize">{searchType}</span><ChevronRight className={`w-4 h-4 transition-transform ${showSearchDropdown ? "rotate-90" : ""}`} />
                  </button>
                  {showSearchDropdown && <div className="absolute top-full mt-2 left-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 min-w-[140px] overflow-hidden">
                    {(["all", "block", "transaction", "contract"] as const).map(t => (<button key={t} onClick={() => { setSearchType(t); setShowSearchDropdown(false); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 capitalize ${searchType === t ? "bg-slate-700 text-cyan-400" : "text-white"}`}>{t}{searchType === t && <CheckCircle className="w-3 h-3 inline ml-2" />}</button>))}
                  </div>}
                </div>
                <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><Input placeholder="Search by Hash / Height / Contract Address..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="h-14 pl-12 pr-32 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 text-lg rounded-xl" /><Button onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}</Button></div>
              </div>
              <p className="text-center text-slate-500 text-sm mt-2">Powered by local indexer • search any hash (0x optional)</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center"><Blocks className="w-5 h-5 text-blue-400" /></div><span className="text-slate-400 text-sm">Latest Block</span></div><p className="text-2xl font-bold text-white font-mono">#{stats.totalBlocks.toLocaleString()}</p></div>
              <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-400" /></div><span className="text-slate-400 text-sm">Finalized</span></div><p className="text-2xl font-bold text-white font-mono">#{stats.finalizedBlock.toLocaleString()}</p></div>
              <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center"><Zap className="w-5 h-5 text-purple-400" /></div><span className="text-slate-400 text-sm">Total Transactions</span></div><p className="text-2xl font-bold text-white">{indexerStats?.totalExtrinsics?.toLocaleString() || "..."}</p></div>
              <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center"><FileCode className="w-5 h-5 text-emerald-400" /></div><span className="text-slate-400 text-sm">Contracts</span></div><p className="text-2xl font-bold text-white">{stats.totalContracts}</p></div>
              <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center"><Clock className="w-5 h-5 text-amber-400" /></div><span className="text-slate-400 text-sm">Block Time</span></div><p className="text-2xl font-bold text-white">~2s</p></div>
            </div>
            <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4 overflow-x-auto">
              <Button variant="ghost" onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? "flex items-center gap-2 bg-cyan-500/20 text-cyan-300" : "flex items-center gap-2 text-slate-400"}><Eye className="w-4 h-4" />Overview</Button>
              <Button variant="ghost" onClick={() => setActiveTab('blocks')} className={activeTab === 'blocks' ? "flex items-center gap-2 bg-cyan-500/20 text-cyan-300" : "flex items-center gap-2 text-slate-400"}><Blocks className="w-4 h-4" />Blocks</Button>
              <Button variant="ghost" onClick={() => setActiveTab('transactions')} className={activeTab === 'transactions' ? "flex items-center gap-2 bg-cyan-500/20 text-cyan-300" : "flex items-center gap-2 text-slate-400"}><Zap className="w-4 h-4" />Transactions</Button>
              <Button variant="ghost" onClick={() => setActiveTab('contracts')} className={activeTab === 'contracts' ? "flex items-center gap-2 bg-cyan-500/20 text-cyan-300" : "flex items-center gap-2 text-slate-400"}><FileCode className="w-4 h-4" />My Contracts</Button>
            </div>
            {activeTab === 'overview' && (<div className="grid md:grid-cols-2 gap-6"><div className="bg-slate-800/30 rounded-2xl border border-slate-700 p-5"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold flex items-center gap-2"><Blocks className="w-5 h-5 text-blue-400" />Recent Blocks{isLive && connected && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}</h3><Button variant="ghost" size="sm" onClick={() => setActiveTab('blocks')} className="text-cyan-400">View All <ChevronRight className="w-4 h-4 ml-1" /></Button></div><div className="space-y-3">{loadingBlocks ? (<div className="text-center py-8 text-slate-500"><RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" /><p>Loading...</p></div>) : recentBlocks.slice(0, 5).map((block, idx) => (<div key={idx} onClick={() => handleBlockClick(block)} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-slate-800/50 cursor-pointer"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center"><Box className="w-5 h-5 text-blue-400" /></div><div><p className="font-mono text-white font-medium">#{block.height.toLocaleString()}</p><p className="text-xs text-slate-500">{formatTime(block.timestamp)}</p></div></div><div className="flex items-center gap-2"><div className="text-right"><p className="text-sm text-slate-300">{block.txCount} txs</p><p className="text-xs text-slate-500 font-mono">{truncHash(block.hash, 6)}</p></div><ChevronRight className="w-4 h-4 text-slate-500" /></div></div>))}</div></div><div className="bg-slate-800/30 rounded-2xl border border-slate-700 p-5"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold flex items-center gap-2"><Zap className="w-5 h-5 text-purple-400" />Recent Transactions{isLive && connected && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}</h3><Button variant="ghost" size="sm" onClick={() => setActiveTab('transactions')} className="text-cyan-400">View All <ChevronRight className="w-4 h-4 ml-1" /></Button></div><div className="space-y-3">{recentTxs.length === 0 ? (<p className="text-center py-8 text-slate-500">Waiting...</p>) : recentTxs.slice(0, 5).map((tx, idx) => (<div key={idx} onClick={() => handleTxClick(tx)} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-slate-800/50 cursor-pointer"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-400" /></div><div><p className="font-mono text-white text-sm">{truncHash(tx.hash, 8)}</p><p className="text-xs text-slate-500">{formatTime(tx.timestamp)}</p></div></div><div className="flex items-center gap-2"><span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-300">{tx.section}.{tx.method}</span><ChevronRight className="w-4 h-4 text-slate-500" /></div></div>))}</div></div></div>)}
            {activeTab === 'blocks' && (<div className="bg-slate-800/30 rounded-2xl border border-slate-700"><div className="p-4 border-b border-slate-700"><h3 className="text-lg font-semibold">All Blocks ({recentBlocks.length})</h3></div><div className="divide-y divide-slate-700/50 max-h-[600px] overflow-y-auto">{recentBlocks.map((block, idx) => (<div key={idx} onClick={() => handleBlockClick(block)} className="flex items-center justify-between p-4 hover:bg-slate-800/30 cursor-pointer"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center"><Box className="w-6 h-6 text-blue-400" /></div><div><p className="font-mono text-white font-semibold">#{block.height.toLocaleString()}</p><p className="text-sm text-slate-500">{formatTime(block.timestamp)}</p></div></div><div className="flex items-center gap-6"><div className="hidden md:block"><p className="text-xs text-slate-500">Hash</p><p className="font-mono text-sm text-slate-300">{truncHash(block.hash, 10)}</p></div><div><p className="text-xs text-slate-500">Exts</p><p className="text-white">{block.txCount}</p></div><ChevronRight className="w-5 h-5 text-slate-500" /></div></div>))}</div></div>)}
            {activeTab === 'transactions' && (<div className="bg-slate-800/30 rounded-2xl border border-slate-700"><div className="p-4 border-b border-slate-700"><h3 className="text-lg font-semibold">All Transactions ({recentTxs.length})</h3></div><div className="divide-y divide-slate-700/50 max-h-[600px] overflow-y-auto">{recentTxs.map((tx, idx) => (<div key={idx} onClick={() => handleTxClick(tx)} className="flex items-center justify-between p-4 hover:bg-slate-800/30 cursor-pointer"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-400" /></div><div><p className="font-mono text-white">{truncHash(tx.hash, 10)}</p><p className="text-sm text-slate-500">{formatTime(tx.timestamp)}</p></div></div><div className="flex items-center gap-6"><span className="px-3 py-1 text-sm rounded-full bg-purple-500/20 text-purple-300">{tx.section}.{tx.method}</span><div className="hidden md:block"><p className="text-xs text-slate-500">Block</p><p className="text-white font-mono">#{tx.blockHeight.toLocaleString()}</p></div><ChevronRight className="w-5 h-5 text-slate-500" /></div></div>))}</div></div>)}
            {activeTab === 'contracts' && (<div className="bg-slate-800/30 rounded-2xl border border-slate-700"><div className="p-4 border-b border-slate-700"><h3 className="text-lg font-semibold">My Deployed Contracts</h3></div>{deployedContracts.length === 0 ? (<div className="text-center py-16 text-slate-500"><FileCode className="w-16 h-16 mx-auto mb-4 opacity-50" /><p className="text-lg">No contracts deployed yet</p><p className="text-sm mt-2">Mint an NFT to see it here!</p></div>) : (<div className="divide-y divide-slate-700/50">{deployedContracts.map((c, idx) => (<div key={idx} className="p-4"><div className="flex items-center justify-between mb-3"><div className="flex items-center gap-3"><div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center"><FileCode className="w-6 h-6 text-emerald-400" /></div><div><p className="font-semibold text-white">{c.name || 'NFT Contract'}</p><span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full">{c.type}</span></div></div><p className="text-sm text-slate-400">{formatTime(c.deployedAt)}</p></div><div className="bg-slate-900/50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">Contract Address</p><div className="flex items-center justify-between"><p className="font-mono text-cyan-400 text-sm break-all">{c.address}</p><Button variant="ghost" size="sm" onClick={() => copyToClipboard(c.address, "c-" + idx)} className="text-slate-400 flex-shrink-0">{copied === "c-" + idx ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</Button></div></div></div>))}</div>)}</div>)}
          </>
        )}
      </main>
    </div>
  );
};

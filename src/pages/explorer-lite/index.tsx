// NightForge Explorer - With Full Header
import { useParams, useNavigate, useLocation } from "react-router-dom";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, Box, Clock, ChevronRight, ChevronLeft, Copy, CheckCircle, Blocks, Zap, X, ArrowLeft, Loader2, Database, FileCode, Activity, TrendingUp, Users, DollarSign, ChevronDown, Wifi, Globe, ArrowUpRight, ArrowDownRight, FileText, Code } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { NetworkBackground } from './NetworkBackground';

const NETWORKS: Record<string, { name: string; api: string; ws: string; badge: string }> = {
  preview: { name: "Preview Network", api: "/api/preview", ws: "wss://preview.nightforge.jp/ws", badge: "PREVIEW" },
  testnet: { name: "Testnet-02", api: "/api/testnet", ws: "wss://testnet.nightforge.jp/ws", badge: "TESTNET-02" },
  preprod: { name: "Preprod", api: "/api/preprod", ws: "wss://preprod.nightforge.jp/ws", badge: "PREPROD" },
  mainnet: { name: "Mainnet", api: "/api/mainnet", ws: "wss://mainnet.nightforge.jp/ws", badge: "MAINNET" }
};

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    if (!value || value === 0) {
      setDisplayValue(0);
      return;
    }
    
    const startTime = Date.now();
    const startValue = 0;
    const diff = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(startValue + diff * easeOut));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <>{displayValue.toLocaleString()}</>;
};

interface Block { height: number; hash: string; timestamp: string; txCount: number; parentHash?: string; author?: string; protocolVersion?: string; extrinsics?: Extrinsic[]; }
interface Extrinsic { hash: string; blockHeight: number; timestamp: string; section?: string; method?: string; args?: any; index?: number; }
interface Transaction { id: number; hash: string; block_height: number; block_hash: string; index_in_block: number; status: string; is_shielded: boolean; protocol_version: string; block_timestamp?: string; timestamp?: string; }
interface Contract { id: string; address: string; type_name: string; entry_point: string; tx_hash: string; deploy?: string; tx_id?: string; }

const getMethodColor = (section: string) => {
  if (section === 'timestamp') return { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/30' };
  if (section === 'balances') return { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' };
  if (section === 'contracts' || section === 'compactRuntime') return { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' };
  if (section === 'cNightObservation') return { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' };
  if (section === 'system') return { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' };
  return { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' };
};

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
);

export const ExplorerLite = () => {
  const { height, hash } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeNetwork, setActiveNetwork] = useState<string>(() => {
    const host = window.location.hostname;
    if (host.startsWith("mainnet.")) return "mainnet";
    if (host.startsWith("preprod.")) return "preprod";
    if (host.startsWith("testnet.")) return "testnet";
    return "preview";
  });
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'all' | 'block' | 'tx' | 'contract'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const NETWORK = NETWORKS[activeNetwork];
  const API = NETWORK.api;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'transactions' | 'extrinsics' | 'contracts' | 'pools'>('overview');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedTx, setSelectedTx] = useState<Extrinsic | null>(null);
  const [selectedTxDetail, setSelectedTxDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [chainStatus, setChainStatus] = useState<any>(null);
  const [countdown, setCountdown] = useState<string>('...');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [recentBlocks, setRecentBlocks] = useState<Block[]>([]);
  const [recentTxs, setRecentTxs] = useState<Extrinsic[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [nightPrice, setNightPrice] = useState<number | null>(null);
  const [nightChange, setNightChange] = useState<number | null>(null);
  const [nightMcap, setNightMcap] = useState<number | null>(null);
  const [nightVolume, setNightVolume] = useState<number | null>(null);
  const [tps, setTps] = useState<number>(0);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [newBlockSound, setNewBlockSound] = useState<boolean>(true);
  const wsRef = useRef<WebSocket | null>(null);

  const navTabs = activeNetwork === 'testnet' 
    ? ['Overview', 'Blocks', 'Transactions', 'Extrinsics', 'Contracts', 'Pools']
    : ['Overview', 'Blocks', 'Transactions', 'Extrinsics', 'Contracts'];

  const calculateTps = useCallback((blocks: Block[]) => {
    if (blocks.length < 2) return 0;
    const totalTxs = blocks.slice(0, 10).reduce((sum, b) => sum + b.txCount, 0);
    return totalTxs / 60;
  }, []);

  const chartData = useMemo(() => {
    return recentBlocks.slice(0, 15).reverse().map((b) => ({
      name: `#${b.height}`,
      txs: b.txCount,
      height: b.height
    }));
  }, [recentBlocks]);

  const fetchFromIndexer = async (endpoint: string) => {
    try {
      const res = await fetch(API + endpoint);
      if (!res.ok) throw new Error("Request failed");
      return await res.json();
    } catch (e) { return null; }
  };

  useEffect(() => {
    const fetchPrice = async (force = false) => {
      try {
        const cached = localStorage.getItem('nightPrice');
        const cacheTime = localStorage.getItem('nightPriceTime');
        const fiveMin = 5 * 60 * 1000;
        if (!force && cached && cacheTime && Date.now() - parseInt(cacheTime) < fiveMin) {
          const pd = JSON.parse(cached);
          setNightPrice(pd.usd); setNightChange(pd.change); setNightMcap(pd.mcap); setNightVolume(pd.vol);
          return;
        }
        const res = await fetch('/api/price?ids=midnight-3&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true');
        const pd = await res.json();
        if (pd?.['midnight-3']) {
          setNightPrice(pd['midnight-3'].usd);
          setNightChange(pd['midnight-3'].usd_24h_change);
          setNightMcap(pd['midnight-3'].usd_market_cap);
          setNightVolume(pd['midnight-3'].usd_24h_vol);
          localStorage.setItem('nightPrice', JSON.stringify({usd: pd['midnight-3'].usd, change: pd['midnight-3'].usd_24h_change, mcap: pd['midnight-3'].usd_market_cap, vol: pd['midnight-3'].usd_24h_vol}));
          localStorage.setItem('nightPriceTime', Date.now().toString());
        }
      } catch (e) { console.error("Price fetch error:", e); }
    };
    fetchPrice();
    const priceInterval = setInterval(() => fetchPrice(true), 300000);
    return () => clearInterval(priceInterval);
  }, []);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [statsData, blocksData, extsData, chainData] = await Promise.all([
        fetchFromIndexer('/stats'),
        fetchFromIndexer('/blocks?limit=20'),
        fetchFromIndexer('/extrinsics?limit=50'),
        fetchFromIndexer('/chain-status'),
      ]);
      
      if (statsData) {
        setStats(statsData);
        setIndexedCount(statsData.totalBlocks || statsData.totalTransactions || null);
      }
      if (chainData) {
        setChainStatus(chainData);
      }
      if (blocksData?.length > 0) {
        const blocks = blocksData.map((b: any) => ({
          height: b.height, hash: b.hash,
          timestamp: new Date(b.timestamp * 1000).toISOString(),
          txCount: b.extrinsics_count, parentHash: b.parent_hash, author: b.author, protocolVersion: b.spec_version
        }));
        setRecentBlocks(blocks);
        setTps(calculateTps(blocks));
      }
      if (extsData?.length > 0) {
        setRecentTxs(extsData.map((e: any) => ({
          hash: e.hash, blockHeight: e.block_height,
          timestamp: new Date(e.timestamp * 1000).toISOString(),
          section: e.section, method: e.method, index: e.index_in_block
        })));
      }
      // Fetch real transactions from transactions table (if endpoint exists)
      try {
        const txRes = await fetch(`${API}/transactions?limit=50`);
        if (txRes.ok) {
          const txData = await txRes.json();
          if (Array.isArray(txData) && txData.length > 0) setTransactions(txData);
        }
      } catch (e) { /* transactions endpoint not available */ }
      // Fetch contracts
      try {
        const contractsRes = await fetch(`${API}/contracts`);
        if (contractsRes.ok) { const contractsData = await contractsRes.json(); if (Array.isArray(contractsData)) setContracts(contractsData); }
      } catch (e) { console.log("Contracts fetch error:", e); }
    } catch (e) { console.error("Load error:", e); }
    if (isInitial) setLoading(false);
  }, [API, calculateTps]);

  const fetchBlockDetails = async (blockNum: number) => {
    const data = await fetchFromIndexer("/block/" + blockNum);
    if (!data) return null;
    return {
      height: data.height, hash: data.hash,
      timestamp: new Date(data.timestamp * 1000).toISOString(),
      txCount: data.extrinsics_count, parentHash: data.parent_hash, author: data.author || data.validator, protocolVersion: data.spec_version || "v18000",
      extrinsics: (data.extrinsics || []).map((e: any) => ({
        hash: e.hash, blockHeight: e.block_height,
        timestamp: new Date(e.timestamp * 1000).toISOString(),
        section: e.section, method: e.method, index: e.index_in_block
      }))
    };
  };

  const handleBlockClick = (block: Block) => { 
    setSelectedBlock(block); 
    setSelectedTx(null); 
    navigate("/block/" + block.height); 
  };
  const handleTxClick = (tx: Extrinsic) => { 
    setSelectedTx(tx); 
    setSelectedBlock(null); 
    navigate("/tx/" + tx.hash); 
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setError(null);
    let q = searchQuery.trim();
    if (q.length >= 64 && !q.startsWith('0x') && /^[a-fA-F0-9]+$/.test(q)) q = '0x' + q;
    try {
      const result = await fetchFromIndexer("/search?q=" + encodeURIComponent(q));
      if (result?.type === 'block' && result.result) {
        const details = await fetchBlockDetails(result.result.height);
        if (details) { setSelectedBlock(details); setSelectedTx(null); setSearchQuery(""); navigate("/block/" + details.height); }
      } else if (result?.type === 'extrinsic' && result.result) {
        const e = result.result;
        setSelectedTx({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, index: e.index_in_block });
        setSelectedBlock(null); setSearchQuery(""); navigate("/tx/" + e.hash);
      } else if (/^\d+$/.test(q)) {
        const details = await fetchBlockDetails(parseInt(q));
        if (details) { setSelectedBlock(details); setSelectedTx(null); setSearchQuery(""); navigate("/block/" + details.height); }
        else setError("Block not found");
      } else { setError("Not found"); }
    } catch { setError("Search failed"); }
    setSearching(false);
  };

  const selectedBlockRef = useRef(selectedBlock);
  const selectedTxRef = useRef(selectedTx);
  const selectedContractRef = useRef(selectedContract);
  useEffect(() => { selectedBlockRef.current = selectedBlock; }, [selectedBlock]);
  useEffect(() => { selectedTxRef.current = selectedTx; }, [selectedTx]);
  useEffect(() => { selectedContractRef.current = selectedContract; }, [selectedContract]);

  useEffect(() => { 
    loadData(true); 
    const interval = setInterval(() => {
      // Skip auto-refresh when viewing block or tx details
      if (!selectedBlockRef.current && !selectedTxRef.current && !selectedContractRef.current) {
        loadData(false);
      }
    }, 6000); 
    return () => clearInterval(interval); 
  }, [loadData]);

  // Live countdown timer for next epoch
  useEffect(() => {
    const updateCountdown = () => {
      if (selectedTxRef.current || selectedBlockRef.current || selectedContractRef.current) return;
      if (chainStatus?.sidechain?.nextEpochTimestamp) {
        const diff = chainStatus.sidechain.nextEpochTimestamp - Date.now();
        if (diff <= 0) {
          setCountdown('Soon');
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`${h}h ${m}m ${s}s`);
        }
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [chainStatus]);

  // WebSocket for REAL-TIME updates 🚀
  useEffect(() => {
    if (!NETWORK.ws) return;
    const connectWS = () => {
      try {
        const ws = new WebSocket(NETWORK.ws);
        wsRef.current = ws;
        ws.onopen = () => { console.log('🔌 WebSocket connected'); setWsConnected(true); ws.send(JSON.stringify({ type: 'subscribe', channel: 'blocks' })); };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'block' && data.block && !selectedBlockRef.current && !selectedTxRef.current && !selectedContractRef.current) {
              const newBlock: Block = { height: data.block.height, hash: data.block.hash, timestamp: data.block.timestamp, txCount: data.block.extrinsics_count || 0, parentHash: data.block.parent_hash, author: data.block.author };
              setRecentBlocks(prev => [newBlock, ...prev.slice(0, 14)]);
              setStats((prev: any) => prev ? { ...prev, latestBlock: newBlock.height, totalBlocks: newBlock.height } : prev);
            }
          } catch (e) { /* ignore parse errors */ }
        };
        ws.onclose = () => { setWsConnected(false); setTimeout(connectWS, 5000); };
        ws.onerror = () => { ws.close(); };
      } catch (e) { setTimeout(connectWS, 5000); }
    };
    connectWS();
    return () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null; } };
  }, [NETWORK.ws]);

  useEffect(() => {
    if (height) { 
      if (selectedBlock?.height === parseInt(height)) return;
      setDetailLoading(true);
      setSelectedTx(null); 
      fetchBlockDetails(parseInt(height)).then(b => { if (b) setSelectedBlock(b); setDetailLoading(false); }); 
    }
    else if (hash) { 
      const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
      if (selectedTxDetail?.hash === cleanHash) return;
      setDetailLoading(true);
      setSelectedBlock(null);
      // Try extrinsic endpoints (different backends use different paths)
      const tryFetch = async (url: string) => { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; } };
      tryFetch(API + '/extrinsic/' + hash).then(async tx => {
        if (!tx || tx.error) tx = await tryFetch(API + '/extrinsics/' + hash);
        if (tx && !tx.error) {
          setSelectedTxDetail(tx);
          setSelectedTx({ hash: tx.hash, blockHeight: Number(tx.block_height), timestamp: tx.timestamp || (tx.block_timestamp ? new Date(tx.block_timestamp * 1000).toISOString() : ''), section: tx.section || 'midnight', method: tx.method || 'transaction', index: tx.index_in_block || 0 });
        } else {
          // Fallback to extrinsics via fetchFromIndexer
          const e = await fetchFromIndexer("/extrinsic/" + hash);
          if (e) { 
            setSelectedTxDetail({}); 
            setSelectedTx({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, index: e.index_in_block }); 
          } else {
            // Nothing found - show empty
            setSelectedTxDetail({});
            setSelectedTx({ hash: cleanHash, blockHeight: 0, timestamp: '', section: 'unknown', method: 'unknown', index: 0 });
          }
        }
        setDetailLoading(false);
      }).catch(async () => {
        const e = await fetchFromIndexer("/extrinsic/" + hash);
        if (e) { 
          setSelectedTxDetail({}); 
          setSelectedTx({ hash: e.hash, blockHeight: e.block_height, timestamp: new Date(e.timestamp * 1000).toISOString(), section: e.section, method: e.method, index: e.index_in_block }); 
        } else {
          setSelectedTxDetail({});
          setSelectedTx({ hash: cleanHash, blockHeight: 0, timestamp: '', section: 'unknown', method: 'unknown', index: 0 });
        }
        setDetailLoading(false);
      });
    }
    else { setSelectedBlock(null); setSelectedTx(null); }
  }, [height, hash]);

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); setCopiedHash(text); setTimeout(() => setCopiedHash(null), 2000); };
  const formatTime = (ts: string) => { try { if (!ts) return 'N/A'; const date = new Date(ts); if (date.getFullYear() < 2020) return 'N/A'; const diff = Date.now() - date.getTime(); if (diff < 0) return 'N/A'; if (diff < 60000) return Math.floor(diff / 1000) + "s ago"; if (diff < 3600000) return Math.floor(diff / 60000) + "m ago"; if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago"; if (diff < 2592000000) return Math.floor(diff / 86400000) + "d ago"; const months = Math.floor(diff / 2592000000); const days = Math.floor((diff % 2592000000) / 86400000); if (diff < 31536000000) return days > 0 ? `${months}mo ${days}d ago` : `${months}mo ago`; const years = Math.floor(diff / 31536000000); const remMonths = Math.floor((diff % 31536000000) / 2592000000); return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years}y ago`; } catch { return 'N/A'; } };
  const truncHash = (h: string, len = 8) => h ? h.slice(0, len) + "..." + h.slice(-len) : '';
  const formatNumber = (n: number) => { if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`; if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`; if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`; return `$${n.toFixed(2)}`; };
  const formatMcap = (n: number) => { if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`; if (n >= 1e6) return `$${(n/1e6).toFixed(0)}M`; return `$${n.toLocaleString()}`; };
  const goToNetwork = (n: string) => {
    const urls: Record<string, string> = {
      preview: 'https://preview.nightforge.jp/',
      testnet: 'https://testnet.nightforge.jp/',
      preprod: 'https://preprod.nightforge.jp/',
      mainnet: 'https://mainnet.nightforge.jp/',
    };
    window.location.href = urls[n] || urls.preview;
  };

  const BlockDetail = ({ block }: { block: Block }) => (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center gap-3 bg-slate-800/30">
        <button onClick={() => { setSelectedBlock(null); setSelectedTx(null); navigate("/"); }} className="text-slate-400 hover:text-white flex items-center gap-2 transition cursor-pointer"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="w-px h-6 bg-slate-700" />
        <h3 className="text-lg font-semibold text-white">Block #{block.height.toLocaleString()}</h3><div className="ml-auto flex items-center gap-2"><button onClick={async () => { if (block.height > 1) { const b = await fetchBlockDetails(block.height - 1); if (b) { setSelectedBlock(b); navigate("/block/" + (block.height - 1)); } } }} className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white transition disabled:opacity-50" disabled={block.height <= 1} title="Previous Block"><ChevronLeft className="w-4 h-4" /></button><button onClick={async () => { const b = await fetchBlockDetails(block.height + 1); if (b) { setSelectedBlock(b); navigate("/block/" + (block.height + 1)); } }} className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white transition" title="Next Block"><ChevronRight className="w-4 h-4" /></button></div>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30"><p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Block Hash</p><div className="flex items-center gap-2"><p className="font-mono text-cyan-400 text-sm break-all">{block.hash}</p>{copiedHash === block.hash ? <span className="text-green-400 text-xs font-medium">Copied!</span> : <Copy className="w-4 h-4 cursor-pointer text-slate-500 hover:text-cyan-400 flex-shrink-0 transition" onClick={() => copyToClipboard(block.hash)} />}</div></div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30"><p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Parent Hash</p><p className="font-mono text-slate-300 text-sm break-all">{block.parentHash}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-700/30"><p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Height</p><p className="text-2xl font-bold text-white">{block.height.toLocaleString()}</p></div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-700/30"><p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Transactions</p><p className="text-2xl font-bold text-purple-400">{block.extrinsics?.filter(e => ((e.section === "midnight" && e.method === "sendMnTransaction") || (e.section === "midnightSystem" && e.method === "sendMnSystemTransaction" && (block.height !== 0 || e.index !== 0)))).length || 0}</p></div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-700/30"><p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Time</p><p className="text-lg font-semibold text-white">{formatTime(block.timestamp)}</p><p className="text-xs text-slate-500 mt-1">{block.timestamp && new Date(block.timestamp).getFullYear() >= 2020 ? new Date(block.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p></div>
        </div>
        {/* Block Information Section - Like midnightexplorer.com */}
        <div className="bg-gradient-to-br from-blue-500/5 to-slate-900/60 rounded-2xl border border-blue-500/20 p-6">
          <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-4 flex items-center gap-2"><Database className="w-4 h-4" /> Block Information</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30"><span className="text-slate-400 text-sm">Height</span><span className="font-mono text-cyan-400 text-sm">#{block.height.toLocaleString()}</span></div>
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30"><span className="text-slate-400 text-sm">Hash</span><div className="flex items-center gap-2"><span className="font-mono text-cyan-400 text-sm">{block.hash.slice(0, 20)}...{block.hash.slice(-12)}</span>{copiedHash === block.hash ? <span className="text-green-400 text-xs">Copied!</span> : <Copy className="w-3 h-3 cursor-pointer text-slate-500 hover:text-cyan-400 transition" onClick={() => copyToClipboard(block.hash)} />}</div></div>
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30"><span className="text-slate-400 text-sm">Parent Hash</span><div className="flex items-center gap-2"><span className="font-mono text-purple-400 text-sm">{block.parentHash?.slice(0, 20)}...{block.parentHash?.slice(-12)}</span>{copiedHash === block.parentHash ? <span className="text-green-400 text-xs">Copied!</span> : <Copy className="w-3 h-3 cursor-pointer text-slate-500 hover:text-purple-400 transition" onClick={() => copyToClipboard(block.parentHash || '')} />}</div></div>
            {block.author && <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30"><span className="text-slate-400 text-sm">Author</span><div className="flex items-center gap-2"><span className="font-mono text-green-400 text-sm">{block.author.slice(0, 20)}...{block.author.slice(-12)}</span>{copiedHash === block.author ? <span className="text-green-400 text-xs">Copied!</span> : <Copy className="w-3 h-3 cursor-pointer text-slate-500 hover:text-green-400 transition" onClick={() => copyToClipboard(block.author || '')} />}</div></div>}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30"><span className="text-slate-400 text-sm">Timestamp</span><span className="text-white text-sm">{block.timestamp && new Date(block.timestamp).getFullYear() >= 2020 ? new Date(block.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}</span></div>
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30"><span className="text-slate-400 text-sm">Protocol Version</span><span className="text-slate-300 text-sm">{block.protocolVersion || 'v18000'}</span></div>
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30"><span className="text-slate-400 text-sm">Transaction Count</span><span className="text-purple-400 text-sm font-medium">{block.extrinsics?.filter(e => (e.section === 'midnight' && e.method === 'sendMnTransaction') || (e.section === 'midnightSystem' && e.method === 'sendMnSystemTransaction')).length || 0}</span></div>
          </div>
        </div>
        {/* Transactions Section */}
        {block.extrinsics && block.extrinsics.filter(e => (e.section === 'midnight' && e.method === 'sendMnTransaction') || (e.section === 'midnightSystem' && e.method === 'sendMnSystemTransaction')).length > 0 && (
          <div className="bg-gradient-to-br from-green-500/5 to-slate-900/60 rounded-2xl border border-green-500/20 p-6 backdrop-blur-sm">
            <h4 className="font-semibold mb-4 text-white flex items-center gap-2"><div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center"><CheckCircle className="w-4 h-4 text-green-400" /></div>Transactions ({block.extrinsics.filter(e => (e.section === 'midnight' && e.method === 'sendMnTransaction') || (e.section === 'midnightSystem' && e.method === 'sendMnSystemTransaction')).length})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">{block.extrinsics.filter(e => (e.section === 'midnight' && e.method === 'sendMnTransaction') || (e.section === 'midnightSystem' && e.method === 'sendMnSystemTransaction')).map((ext, idx) => (
              <div key={idx} onClick={() => handleTxClick(ext)} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-green-500/10 cursor-pointer border border-green-500/10 hover:border-green-500/30 transition group">
                <div className="flex items-center gap-3"><span className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center text-green-400 text-sm font-mono group-hover:scale-110 transition">{ext.index}</span><div><p className="font-mono text-sm text-white">{truncHash(ext.hash, 12)}</p><p className="text-xs text-slate-500">{ext.section}.{ext.method}</p></div></div>
                <ChevronRight className="w-4 h-4 text-green-400 group-hover:translate-x-1 transition" />
              </div>
            ))}</div>
          </div>
        )}
        {/* All Extrinsics Section */}
        {block.extrinsics && block.extrinsics.length > 0 && (
          <div className="bg-gradient-to-br from-purple-500/5 to-slate-900/60 rounded-2xl border border-purple-500/20 p-6 backdrop-blur-sm">
            <h4 className="font-semibold mb-4 text-white flex items-center gap-2"><div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center"><Zap className="w-4 h-4 text-purple-400" /></div>Extrinsics ({block.extrinsics.length})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">{block.extrinsics.map((ext, idx) => {
              const colors = getMethodColor(ext.section || '');
              return (
                <div key={idx} onClick={() => handleTxClick(ext)} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-purple-500/10 cursor-pointer border border-purple-500/10 hover:border-purple-500/30 transition group">
                  <div className="flex items-center gap-3"><span className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 text-sm font-mono group-hover:scale-110 transition">{ext.index}</span><p className="font-mono text-sm text-white">{truncHash(ext.hash, 12)}</p></div>
                  <span className={`px-2 py-1 text-xs rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>{ext.section}.{ext.method}</span>
                </div>
              );
            })}</div>
          </div>
        )}
      </div>
    </div>
  );


  // Contract Detail Component - WOW Feature for Japan! 🇯🇵
  const ContractDetail = ({ contract }: { contract: Contract }) => {
    const [contractData, setContractData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      const fetchContractData = async () => {
        try {
          const res = await fetch(`${API}/contract/${contract.address}`);
          if (res.ok) {
            const data = await res.json();
            setContractData(data);
          }
        } catch (e) { console.error('Contract fetch error:', e); }
        setLoading(false);
      };
      fetchContractData();
    }, [contract.address]);
    if (loading) {
      return (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
          <span className="text-slate-400">Loading contract...</span>
        </div>
      );
    }
    return (

      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center gap-3 bg-gradient-to-r from-cyan-900/30 to-slate-800/30">
          <button onClick={() => { setSelectedContract(null); setSelectedTx(null); navigate("/"); }} className="text-slate-400 hover:text-white flex items-center gap-2 transition cursor-pointer"><ArrowLeft className="w-4 h-4" /> Back</button>
          <div className="w-px h-6 bg-slate-700" />
          <FileCode className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Contract Details</h3>
          <span className="ml-auto text-xs text-slate-500">View contract state and information</span>
        </div>
        <div className="p-6 space-y-6">
          {/* Overview Section */}
          <div className="bg-gradient-to-br from-cyan-500/5 to-slate-900/60 rounded-2xl border border-cyan-500/20 p-6">
            <h4 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-4">Overview</h4>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Contract Type</p>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <FileCode className="w-4 h-4" />
                  {contract.type_name || 'Call'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Transaction</p>
                <button onClick={() => { setSelectedContract(null); setSelectedTx({ hash: contract.tx_hash, blockHeight: 0, timestamp: '', section: 'contracts', method: contract.entry_point }); navigate('/tx/' + contract.tx_hash); }} className="font-mono text-purple-400 hover:text-purple-300 text-sm flex items-center gap-2 transition">
                  {contract.tx_hash.slice(0, 20)}...{contract.tx_hash.slice(-12)}
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Contract Address</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-cyan-300 text-sm break-all">{contract.address}</p>
                {copiedHash === contract.address ? <span className="text-green-400 text-xs font-medium">Copied!</span> : <Copy className="w-4 h-4 cursor-pointer text-slate-500 hover:text-cyan-400 flex-shrink-0 transition" onClick={() => copyToClipboard(contract.address)} />}
              </div>
            </div>
          </div>

          {/* Contract State Section */}
          <div className="bg-gradient-to-br from-purple-500/5 to-slate-900/60 rounded-2xl border border-purple-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wide flex items-center gap-2">
                <Code className="w-4 h-4" /> Contract State
              </h4>
              <button onClick={() => copyToClipboard(contractData?.state || '')} className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1 transition">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/50 max-h-48 overflow-y-auto">
              <p className="font-mono text-xs text-slate-300 break-all leading-relaxed">
                {contractData?.state || 'Loading state data...'}
              </p>
            </div>
          </div>

          {/* ZSwap State Section */}
          <div className="bg-gradient-to-br from-green-500/5 to-slate-900/60 rounded-2xl border border-green-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wide flex items-center gap-2">
                <Zap className="w-4 h-4" /> ZSwap State
              </h4>
              <button onClick={() => copyToClipboard(contractData?.zswap_state || '')} className="text-xs text-slate-400 hover:text-green-400 flex items-center gap-1 transition">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/50 max-h-48 overflow-y-auto">
              <p className="font-mono text-xs text-slate-300 break-all leading-relaxed">
                {contractData?.zswap_state || 'Loading ZSwap state...'}
              </p>
            </div>
          </div>

          {/* Attributes Section */}
          <div className="bg-gradient-to-br from-blue-500/5 to-slate-900/60 rounded-2xl border border-blue-500/20 p-6">
            <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Attributes
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                <span className="text-slate-400 text-sm">Entry Point</span>
                <span className="font-mono text-purple-400 text-sm">{contract.entry_point}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                <span className="text-slate-400 text-sm">Type</span>
                <span className="font-mono text-cyan-400 text-sm">{contract.type_name}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                <span className="text-slate-400 text-sm">Contract ID</span>
                <span className="font-mono text-slate-300 text-sm">{contract.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

const TxDetailSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-slate-700 rounded-full"></div>
      <div className="h-8 w-64 bg-slate-700 rounded"></div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
          <div className="h-4 w-20 bg-slate-700 rounded mb-2"></div>
          <div className="h-6 w-32 bg-slate-700 rounded"></div>
        </div>
      ))}
    </div>
    <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
      <div className="h-5 w-24 bg-slate-700 rounded mb-4"></div>
      <div className="space-y-3">
        {[1,2].map(i => (
          <div key={i} className="flex justify-between p-3 bg-slate-900/50 rounded-xl">
            <div className="h-5 w-48 bg-slate-700 rounded"></div>
            <div className="h-5 w-24 bg-slate-700 rounded"></div>
          </div>
        ))}
      </div>
    </div>
    <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
      <div className="h-5 w-24 bg-slate-700 rounded mb-4"></div>
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="flex justify-between p-3 bg-slate-900/50 rounded-xl">
            <div className="h-5 w-48 bg-slate-700 rounded"></div>
            <div className="h-5 w-24 bg-slate-700 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TxDetail = React.memo(({ tx, detail, apiBase }: { tx: Extrinsic; detail?: any; apiBase?: string }) => {
    const colors = getMethodColor(tx.section || '');
    const isRealTx = (tx.section === 'midnight' && tx.method === 'sendMnTransaction') || (tx.section === 'midnight' && tx.method === 'transaction') || (tx.section === 'midnightSystem' && tx.method === 'sendMnSystemTransaction');
    const [detailedTx, setDetailedTx] = useState<any>(detail || null);
    const [decodedData, setDecodedData] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(detail ? false : true);
    const fetchedHashRef = useRef<string | null>(detail?.hash || null);
    const [showRawArgs, setShowRawArgs] = useState(false);
    const [showRawTx, setShowRawTx] = useState(false);
    const [showLedgerParams, setShowLedgerParams] = useState(false);
    const [showIdentifiers, setShowIdentifiers] = useState(false);
    const hasDetail = detail && detail.hash;
    useEffect(() => { if (hasDetail) { setDetailedTx(detail); setLoadingDetails(false); } }, [detail]);
    // Fetch basic tx data if not provided via detail prop
    useEffect(() => {
      if (hasDetail) return;
      const rawHash = tx.hash;
      const cleanHash = rawHash.startsWith('0x') ? rawHash.substring(2) : rawHash;
      if (fetchedHashRef.current === cleanHash) return;
      fetchedHashRef.current = cleanHash;
      const fetchBasic = async () => {
        try {
          if (!detailedTx || !detailedTx.hash) setLoadingDetails(true);
          const base = apiBase || '/api/preview';
          let res = await fetch(base + '/extrinsic/' + rawHash);
          if (!res.ok) res = await fetch(base + '/extrinsics/' + rawHash);
          if (res.ok) {
            const data = await res.json();
            if (!data.error) setDetailedTx(data);
          }
        } catch (e) { console.log('Detailed tx not available'); }
        finally { setLoadingDetails(false); }
      };
      fetchBasic();
    }, [tx.hash]);
    // Always fetch decoded data for Midnight transactions (separate from basic fetch)
    const decodedFetchedRef = useRef<string | null>(null);
    useEffect(() => {
      if (!isRealTx) return;
      const rawHash = tx.hash;
      if (decodedFetchedRef.current === rawHash) return;
      decodedFetchedRef.current = rawHash;
      const fetchDecoded = async () => {
        try {
          const base = apiBase || '/api/preview';
          let dRes = await fetch(base + '/extrinsic/' + rawHash + '/decoded');
          if (!dRes.ok) dRes = await fetch(base + '/extrinsics/' + rawHash + '/decoded');
          if (dRes.ok) {
            const dData = await dRes.json();
            if (dData.decoded) setDecodedData(dData.decoded);
          }
        } catch { /* decoded not available */ }
      };
      fetchDecoded();
    }, [tx.hash]);

    const formatNIGHT = (value: string | number) => { const num = typeof value === 'string' ? parseFloat(value) : value; if (isNaN(num) || num === 0) return '0.000000'; return num.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 }); };
    const formatDateFull = (ts: string | number) => { try { const d = typeof ts === 'number' ? new Date(ts > 1e12 ? ts : ts * 1000) : new Date(ts); if (d.getFullYear() < 2020) return 'N/A'; return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return 'N/A'; } };
    const formatAddr = (addr: string) => { if (!addr) return 'Shielded'; if (addr.length > 24) return `${addr.slice(0, 14)}...${addr.slice(-10)}`; return addr; };
    const totalInputs = detailedTx?.inputs?.reduce((sum: number, inp: any) => sum + parseFloat(inp.value || inp.raw?.value || '0'), 0) || 0;
    const totalOutputs = detailedTx?.outputs?.reduce((sum: number, out: any) => sum + parseFloat(out.value || out.raw?.value || '0'), 0) || 0;
    const hasIO = detailedTx?.inputs?.length > 0 || detailedTx?.outputs?.length > 0;
    const identifiers = decodedData?.identifiers || detailedTx?.identifiers || [];

    return (
      <div className="space-y-6">
        {/* Header Card */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-cyan-500/5 to-transparent">
            <div className="flex items-center gap-3">
              <button onClick={async () => { const b = await fetchBlockDetails(tx.blockHeight); if (b) { setSelectedTx(null); setSelectedBlock(b); navigate("/block/" + tx.blockHeight); } }} className="text-slate-400 hover:text-cyan-400 flex items-center gap-2 transition cursor-pointer group"><ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back</button>
              <div className="w-px h-6 bg-slate-700" />
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-500/50" /><h3 className="text-lg font-bold text-white">{isRealTx ? "Transaction Detail" : "Extrinsic Detail"}</h3></div>
            </div>
            <div className="flex items-center gap-2">
              {detailedTx?.success !== undefined && (
                detailedTx.success ? <span className="px-3 py-1 text-sm rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-bold">SUCCESS</span>
                : <span className="px-3 py-1 text-sm rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">FAILED</span>
              )}
              <span className={`px-3 py-1 text-sm rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>{tx.section}.{tx.method}</span>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30"><p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Hash</p><div className="flex items-center gap-2"><code className="text-cyan-400 font-mono text-sm break-all">{tx.hash}</code>{copiedHash === tx.hash ? <span className="text-green-400 text-xs font-medium px-2 py-1 bg-green-500/20 rounded">Copied!</span> : <Copy className="w-4 h-4 cursor-pointer text-slate-500 hover:text-cyan-400 flex-shrink-0 transition" onClick={() => copyToClipboard(tx.hash)} />}</div></div>
          </div>
        </div>

        {/* Overview + Summary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${isRealTx ? 'lg:col-span-2' : 'lg:col-span-3'} bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm`}>
            <div className="flex items-center gap-2 mb-6"><FileText className="w-5 h-5 text-cyan-400" /><h3 className="text-lg font-bold text-white">{isRealTx ? "Transaction Overview" : "Extrinsic Overview"}</h3></div>
            <div className="space-y-0">
              {detailedTx?.block_hash && (<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b border-slate-700/30 gap-1"><span className="text-slate-400 text-sm">Block Hash</span><code className="text-cyan-400 font-mono text-xs">{formatAddr(detailedTx.block_hash)}</code></div>)}
              <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Block Height</span><span className="text-white font-bold cursor-pointer hover:text-blue-400 transition" onClick={() => navigate("/block/" + tx.blockHeight)}>#{tx.blockHeight.toLocaleString()}</span></div>
              <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Timestamp</span><span className="text-white">{formatDateFull(detailedTx?.timestamp || tx.timestamp)}</span></div>
              <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Index in Block</span><span className="text-white font-mono">#{detailedTx?.index_in_block ?? tx.index ?? 0}</span></div>
              <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Method</span><span className={`px-2 py-1 rounded ${colors.bg} ${colors.text} font-mono text-xs border ${colors.border}`}>{tx.section}.{tx.method}</span></div>
              {detailedTx?.success !== undefined && (<div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Status</span><span className={`px-2 py-1 rounded text-xs font-bold ${detailedTx.success ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>{detailedTx.success ? 'Success' : 'Failed'}</span></div>)}
              {isRealTx && decodedData && (
                <>
                  {decodedData.transactionType && <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Transaction Type</span><span className="text-purple-400 font-medium capitalize">{decodedData.transactionType.replace(/_/g, ' ')}</span></div>}
                  {decodedData.version && decodedData.version !== 'unknown' && <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Protocol Version</span><span className="text-white font-mono">{decodedData.version}</span></div>}
                  {decodedData.signatureType && decodedData.signatureType !== 'unknown' && <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Signature Type</span><span className="text-white font-mono">{decodedData.signatureType}</span></div>}
                  {decodedData.proofType && decodedData.proofType !== 'unknown' && <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Proof Type</span><span className="text-cyan-400 font-mono text-xs">{decodedData.proofType}</span></div>}
                </>
              )}
              {isRealTx && detailedTx && !decodedData && <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Protocol Version</span><span className="text-white font-mono">v{detailedTx.protocol_version || '18000'}</span></div>}
              <div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">Extrinsic ID</span><span className="text-white font-bold">#{detailedTx?.id || tx.index}</span></div>
              {detailedTx?.inputs?.[0] && (<div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">From</span><code className="text-pink-400 font-mono text-xs">{formatAddr(detailedTx.inputs[0].unshielded_address || detailedTx.inputs[0].raw?.owner)}</code></div>)}
              {detailedTx?.outputs?.[0] && (<div className="flex justify-between items-center py-3 border-b border-slate-700/30"><span className="text-slate-400 text-sm">To</span><code className="text-green-400 font-mono text-xs">{formatAddr(detailedTx.outputs[0].unshielded_address || detailedTx.outputs[0].raw?.owner)}</code></div>)}
              {decodedData?.contractAddresses?.length > 0 && (<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start py-3 border-b border-slate-700/30 gap-1"><span className="text-slate-400 text-sm">Contract Addresses</span><div className="flex flex-col gap-1">{decodedData.contractAddresses.map((a: string, i: number) => <code key={i} className="text-orange-400 font-mono text-xs">{formatAddr(a)}</code>)}</div></div>)}
            </div>
          </div>

          {isRealTx && detailedTx && <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/80 rounded-2xl border border-cyan-500/20 p-6 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-6"><div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /><h3 className="text-lg font-bold text-white">Transaction Summary</h3></div>
              {hasIO ? (
                <div className="space-y-6">
                  <div><p className="text-slate-400 text-sm mb-2">Total Input</p><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center border border-pink-500/30"><ArrowUpRight className="w-5 h-5 text-pink-400" /></div><div><p className="text-xs text-slate-500">NIGHT</p><p className="text-2xl font-bold text-white">{formatNIGHT(totalInputs || detailedTx.total_input || 0)}</p></div></div></div>
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
                  <div><p className="text-slate-400 text-sm mb-2">Total Output</p><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30"><ArrowDownRight className="w-5 h-5 text-green-400" /></div><div><p className="text-xs text-slate-500">NIGHT</p><p className="text-2xl font-bold text-green-400">{formatNIGHT(totalOutputs || detailedTx.total_output || 0)}</p></div></div></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30"><Activity className="w-5 h-5 text-purple-400" /></div>
                    <div><p className="text-xs text-slate-500">Type</p><p className="text-lg font-bold text-purple-400 capitalize">{decodedData?.transactionType?.replace(/_/g, ' ') || 'Shielded Transaction'}</p></div>
                  </div>
                  {decodedData?.proofType && decodedData.proofType !== 'unknown' && (
                    <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30"><FileCode className="w-5 h-5 text-cyan-400" /></div>
                      <div><p className="text-xs text-slate-500">ZK Proof</p><p className="text-sm font-bold text-cyan-400 font-mono">{decodedData.proofType}</p></div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30"><Zap className="w-5 h-5 text-green-400" /></div>
                    <div><p className="text-xs text-slate-500">Privacy</p><p className="text-sm font-bold text-green-400">Shielded (ZK Protected)</p></div>
                  </div>
                </div>
              )}
            </div>
          </div>}
        </div>

        {/* Identifiers (decoded) */}
        {identifiers.length > 0 && (
          <div className="bg-slate-800/60 rounded-2xl border border-purple-500/20 overflow-hidden backdrop-blur-sm">
            <button onClick={() => setShowIdentifiers(!showIdentifiers)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors">
              <div className="flex items-center gap-2"><Database className="w-5 h-5 text-purple-400" /><span className="text-white font-bold">Identifiers</span><span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{identifiers.length}</span></div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showIdentifiers ? 'rotate-180' : ''}`} />
            </button>
            {showIdentifiers && (
              <div className="px-6 pb-6"><div className="space-y-2 max-h-64 overflow-auto">{identifiers.map((id: string, i: number) => (
                <div key={i} className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-2 border border-purple-500/10">
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded font-mono">#{i}</span>
                  <code className="text-purple-400 font-mono text-xs break-all flex-1">{typeof id === 'string' ? id : (id as any).id || (id as any).tx_hash}</code>
                  <Copy className="w-3.5 h-3.5 cursor-pointer text-slate-600 hover:text-purple-400 flex-shrink-0 transition" onClick={() => copyToClipboard(typeof id === 'string' ? id : (id as any).id || '')} />
                </div>
              ))}</div></div>
            )}
          </div>
        )}

        {/* Inputs/Outputs */}
        {hasIO && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-pink-500/5 to-slate-900/60 rounded-2xl border border-pink-500/20 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4"><ArrowUpRight className="w-5 h-5 text-pink-400" /><h3 className="text-lg font-bold text-white">Inputs ({detailedTx.inputs?.length || 0})</h3></div>
              {detailedTx.inputs && detailedTx.inputs.length > 0 ? (<div className="space-y-3 max-h-64 overflow-auto">{detailedTx.inputs.map((inp: any, i: number) => (<div key={i} className="bg-slate-900/50 rounded-xl p-4 border border-pink-500/10 hover:border-pink-500/30 transition-all"><div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">#{inp.index || i}</span><span className="text-xs text-pink-400 bg-pink-500/10 px-2 py-1 rounded font-bold">NIGHT</span></div><code className="text-pink-300 font-mono text-xs break-all block mb-2">{inp.unshielded_address || inp.raw?.owner || 'Shielded'}</code><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{inp.ctime ? formatDateFull(inp.ctime) : ''}</span><span className="text-lg font-bold text-pink-400">{formatNIGHT(inp.value || inp.raw?.value || 0)}</span></div></div>))}</div>) : (<div className="text-center py-8 text-slate-500"><p>No inputs (shielded)</p></div>)}
            </div>
            <div className="bg-gradient-to-br from-green-500/5 to-slate-900/60 rounded-2xl border border-green-500/20 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4"><ArrowDownRight className="w-5 h-5 text-green-400" /><h3 className="text-lg font-bold text-white">Outputs ({detailedTx.outputs?.length || 0})</h3></div>
              {detailedTx.outputs && detailedTx.outputs.length > 0 ? (<div className="space-y-3 max-h-64 overflow-auto">{detailedTx.outputs.map((out: any, i: number) => (<div key={i} className="bg-slate-900/50 rounded-xl p-4 border border-green-500/10 hover:border-green-500/30 transition-all"><div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">#{out.index || i}</span><span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded font-bold">NIGHT</span></div><code className="text-green-300 font-mono text-xs break-all block mb-2">{out.unshielded_address || out.raw?.owner || 'Shielded'}</code><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{out.ctime ? formatDateFull(out.ctime) : ''}</span><span className="text-lg font-bold text-green-400">{formatNIGHT(out.value || out.raw?.value || 0)}</span></div></div>))}</div>) : (<div className="text-center py-8 text-slate-500"><p>No outputs (shielded)</p></div>)}
            </div>
          </div>
        )}

        {/* Dust Ledger Events */}
        {detailedTx?.dust_ledger_events && detailedTx.dust_ledger_events.length > 0 && (
          <div className="bg-gradient-to-br from-purple-500/5 to-slate-900/60 rounded-2xl border border-purple-500/20 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4"><Zap className="w-5 h-5 text-purple-400" /><h3 className="text-lg font-bold text-white">Dust Ledger Events ({detailedTx.dust_ledger_events.length})</h3></div>
            <div className="space-y-3">{detailedTx.dust_ledger_events.map((evt: any, i: number) => (<div key={i} className="bg-slate-900/50 rounded-xl p-4 border border-purple-500/10"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">#{evt.index_in_tx}</span><span className="text-sm font-bold text-purple-400">{evt.event_name}</span></div></div>))}</div>
          </div>
        )}

        {/* Raw Args Data */}
        {detailedTx?.args && (
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
            <button onClick={() => setShowRawArgs(!showRawArgs)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"><div className="flex items-center gap-2"><Code className="w-5 h-5 text-slate-400" /><span className="text-white font-bold">Raw Arguments</span><span className="text-xs text-slate-500 ml-2">{typeof detailedTx.args === 'string' ? `${(detailedTx.args.length / 1024).toFixed(1)} KB` : ''}</span></div><ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showRawArgs ? 'rotate-180' : ''}`} /></button>
            {showRawArgs && (<div className="px-6 pb-6"><div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/30 max-h-48 overflow-auto"><code className="text-cyan-300/60 font-mono text-[10px] break-all">{typeof detailedTx.args === 'string' ? detailedTx.args : JSON.stringify(detailedTx.args, null, 2)}</code></div></div>)}
          </div>
        )}

        {/* Raw Transaction Data */}
        {detailedTx?.raw && (
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
            <button onClick={() => setShowRawTx(!showRawTx)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"><div className="flex items-center gap-2"><Code className="w-5 h-5 text-slate-400" /><span className="text-white font-bold">Raw Transaction Data</span></div><ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showRawTx ? 'rotate-180' : ''}`} /></button>
            {showRawTx && (<div className="px-6 pb-6"><div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/30 max-h-48 overflow-auto"><code className="text-cyan-300/60 font-mono text-[10px] break-all">{detailedTx.raw}</code></div></div>)}
          </div>
        )}

        {/* Block Ledger Parameters */}
        {detailedTx?.block_ledger_parameters && (
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
            <button onClick={() => setShowLedgerParams(!showLedgerParams)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"><div className="flex items-center gap-2"><Database className="w-5 h-5 text-slate-400" /><span className="text-white font-bold">Block Ledger Parameters</span></div><ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showLedgerParams ? 'rotate-180' : ''}`} /></button>
            {showLedgerParams && (<div className="px-6 pb-6"><div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/30 max-h-48 overflow-auto"><code className="text-yellow-300/60 font-mono text-[10px] break-all">{detailedTx.block_ledger_parameters}</code></div></div>)}
          </div>
        )}

        {loadingDetails && !detailedTx && (<div className="text-center py-4 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /><p className="text-sm">Loading details...</p></div>)}
      </div>
    );
  }, (prevProps, nextProps) => prevProps.tx.hash === nextProps.tx.hash && prevProps.detail === nextProps.detail);

  return (
    <div className="min-h-screen text-white relative" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1117 50%, #050a12 100%)' }}>
      <NetworkBackground />
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <a href="/" className="flex items-center gap-2 group"><img src="/favicon.ico" alt="NightForge" className="w-8 h-8 rounded-lg group-hover:scale-105 transition" /><span className="font-bold text-lg text-white hidden sm:block">Night Forge</span></a>
              <div className="relative">
                <button onClick={() => setShowNetworkMenu(!showNetworkMenu)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition"><Globe className="w-4 h-4 text-cyan-400" /><span className="text-sm font-medium text-white">{NETWORK.badge}</span><ChevronRight className={`w-4 h-4 text-slate-400 transition ${showNetworkMenu ? 'rotate-90' : ''}`} /></button>
                {showNetworkMenu && (
                  <div className="absolute top-full mt-2 left-0 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-[200] min-w-[220px] overflow-hidden">
                    {[
                      { key: 'mainnet', name: 'Mainnet', sub: 'mainnet.nightforge.jp', dot: 'bg-green-400', hover: 'hover:bg-green-500/10', active: 'text-green-400' },
                      { key: 'preprod', name: 'Preprod Net', sub: 'preprod.nightforge.jp', dot: 'bg-orange-400', hover: 'hover:bg-orange-500/10', active: 'text-orange-400' },
                      { key: 'testnet', name: 'Testnet', sub: 'Sunset Feb 9', dot: 'bg-yellow-400', hover: 'hover:bg-yellow-500/10', active: 'text-yellow-400' },
                      { key: 'preview', name: 'Preview Net', sub: 'preview.nightforge.jp', dot: 'bg-cyan-400', hover: 'hover:bg-cyan-500/10', active: 'text-cyan-400' },
                    ].map(n => (
                      <button key={n.key} onClick={() => goToNetwork(n.key)} className={`w-full px-4 py-3 text-left ${n.hover} transition flex items-center gap-3`}>
                        <div className={`w-2 h-2 rounded-full ${n.dot}`} />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${activeNetwork === n.key ? n.active : 'text-white'}`}>{n.name}</p>
                          <p className={`text-xs ${activeNetwork === n.key ? n.active : 'text-slate-500'}`}>{n.sub}</p>
                        </div>
                        {activeNetwork === n.key && <CheckCircle className={`w-4 h-4 ${n.active}`} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              {nightPrice !== null && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700">
                  <img src="/night-logo.webp" alt="NIGHT" className="w-5 h-5 rounded-full" /><span className="text-sm text-slate-400">NIGHT</span><span className="font-semibold text-white text-sm">${nightPrice.toFixed(4)}</span>
                  {nightChange !== null && <span className={`text-xs font-medium ${nightChange >= 0 ? "text-green-400" : "text-red-400"}`}>{nightChange >= 0 ? "↑" : "↓"}{Math.abs(nightChange).toFixed(2)}%</span>}
                  {nightMcap && <span className="text-xs text-slate-500">MCap {formatMcap(nightMcap)}</span>}
                </div>
              )}
              {indexedCount !== null && <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700"><Database className="w-4 h-4 text-purple-400" /><span className="font-semibold text-white text-sm">{indexedCount.toLocaleString()}</span><span className="text-xs text-slate-500">INDEXED</span></div>}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30"><Wifi className="w-4 h-4 text-green-400" /><span className="text-xs font-medium text-green-400">CONNECTED</span></div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span className="text-xs font-medium text-green-400">LIVE</span></div>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://nightforge.jp" className="text-sm text-slate-400 hover:text-white transition hidden lg:block">Home</a>
              <a href="https://nft.nightforge.jp" className="text-sm text-slate-400 hover:text-pink-400 transition flex items-center gap-1 hidden lg:flex"><span>🎨</span> NFT Minter</a>
            </div>
          </div>
        </div>
      </header>
      <div className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800/30 sticky top-16 z-40 relative">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex items-center gap-1 py-2">
            {navTabs.map((item) => (
              <button key={item} onClick={() => { setActiveTab(item.toLowerCase() as any); setSelectedTx(null); setSelectedBlock(null); setSelectedContract(null); navigate("/"); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === item.toLowerCase() ? 'bg-slate-700/50 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>{item}</button>
            ))}
          </nav>
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 py-6 relative z-10">
        {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 backdrop-blur-sm"><X className="w-5 h-5 text-red-400" /><p className="text-red-300 flex-1">{error}</p><button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 transition">Dismiss</button></div>}
        {selectedBlock && !selectedTx && <BlockDetail block={selectedBlock} />}
        {!selectedBlock && selectedTx && (selectedTxDetail ? <TxDetail tx={selectedTx} detail={selectedTxDetail} apiBase={API} key={selectedTx.hash} /> : <div className="flex flex-col items-center justify-center py-20 gap-4"><div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div><div className="text-slate-400 text-sm">Loading transaction...</div></div>)}
        {selectedContract && <ContractDetail contract={selectedContract} />}
        {!selectedBlock && !selectedTx && !selectedContract && (
          <>
            <div className="mb-4 overflow-hidden rounded-xl bg-slate-800/30 border border-slate-700/30 backdrop-blur-sm">
              <div className="flex items-center">
                <div className="px-3 py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-r border-slate-700/30">
                  <span className="text-xs font-semibold text-pink-400 whitespace-nowrap flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                    LIVE TXS
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="animate-marquee flex items-center gap-8 py-2 px-4">
                    {recentTxs.slice(0, 10).map((tx, i) => (
                      <span key={i} onClick={() => handleTxClick(tx)} className="flex items-center gap-2 text-xs whitespace-nowrap cursor-pointer hover:text-cyan-400 transition">
                        <span className="text-green-400">✓</span>
                        <span className="text-slate-400 font-mono">{truncHash(tx.hash, 6)}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-purple-400">{tx.section}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mb-8"><div className="max-w-3xl mx-auto"><div className="relative flex gap-2">
              <div className="relative">
                <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="h-12 px-4 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center gap-2 hover:border-cyan-500/50 transition backdrop-blur-sm"><span className="text-sm text-slate-300 capitalize">{searchFilter}</span><ChevronDown className="w-4 h-4 text-slate-500" /></button>
                {showFilterMenu && <div className="absolute top-full mt-2 left-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 min-w-[120px] overflow-hidden">{['all', 'block', 'tx', 'contract'].map((f) => (<button key={f} onClick={() => { setSearchFilter(f as any); setShowFilterMenu(false); }} className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-700 transition capitalize ${searchFilter === f ? 'bg-slate-700 text-cyan-400' : 'text-white'}`}>{f}</button>))}</div>}
              </div>
              <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input placeholder="Search by Hash / Height / Contract Address..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-full h-12 pl-12 pr-4 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition backdrop-blur-sm" /></div>
              <button onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="h-12 px-6 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl text-white font-medium transition">{searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}</button>
            </div></div></div>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-white">Network Overview</h2><div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-0.5">
                      <div className="w-1 h-3 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0ms'}} />
                      <div className="w-1 h-5 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '150ms'}} />
                      <div className="w-1 h-4 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '300ms'}} />
                      <div className="w-1 h-6 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '450ms'}} />
                      <div className="w-1 h-3 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '600ms'}} />
                    </div>
                    <span className="text-xs font-medium text-green-400 ml-1">Live</span>
                  </div>
                </div></div>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">{[...Array(6)].map((_, i) => <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 h-24 backdrop-blur-sm"><Skeleton className="w-8 h-8 rounded-lg mb-2" /><Skeleton className="h-6 w-20 mb-1" /><Skeleton className="h-3 w-16" /></div>)}</div>
            ) : (
              <div className="mb-6">
                {/* Hero Stats Row - 3 Big Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Epoch Card with Gradient */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 via-slate-800/50 to-purple-600/20 border border-blue-500/30 p-5 backdrop-blur-sm group hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 bg-blue-500/30 rounded-xl flex items-center justify-center"><Blocks className="w-5 h-5 text-blue-400" /></div>
                        <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Current Epoch</span>
                      </div>
                      <p className="text-3xl font-bold text-white mb-1">{chainStatus?.sidechain?.epoch ? <AnimatedCounter value={chainStatus.sidechain.epoch} /> : '...'}</p>
                      <p className="text-xs text-slate-400">Slot: {chainStatus?.sidechain?.slot?.toLocaleString() || '...'}</p>
                    </div>
                  </div>
                  
                  {/* Transactions Card with Gradient */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600/20 via-slate-800/50 to-emerald-600/20 border border-green-500/30 p-5 backdrop-blur-sm group hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 bg-green-500/30 rounded-xl flex items-center justify-center"><Zap className="w-5 h-5 text-green-400" /></div>
                        <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Total Transactions</span>
                      </div>
                      <p className="text-3xl font-bold text-white mb-1">{stats?.totalTransactions ? <AnimatedCounter value={stats.totalTransactions} /> : '0'}</p>
                      <p className="text-xs text-slate-400">Blocks: {stats?.totalBlocks?.toLocaleString() || '...'}</p>
                    </div>
                  </div>
                  
                  {/* TPS Card with Gauge */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600/20 via-slate-800/50 to-pink-600/20 border border-cyan-500/30 p-5 backdrop-blur-sm group hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 bg-cyan-500/30 rounded-xl flex items-center justify-center"><Activity className="w-5 h-5 text-cyan-400" /></div>
                        <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Network TPS</span>
                      </div>
                      <div className="flex items-end gap-3">
                        <p className="text-3xl font-bold text-white">{tps.toFixed(2)}</p>
                        <div className="flex-1 mb-2">
                          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full transition-all duration-500" style={{width: `${Math.min(tps * 10, 100)}%`}} />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">~6s avg block time</p>
                    </div>
                  </div>
                </div>
                
                {/* Secondary Stats Row - 4 Compact Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-3 hover:border-slate-600/50 transition backdrop-blur-sm">
                    <p className="text-xs text-slate-500 mb-1">Latest Block</p>
                    <p className="text-lg font-semibold text-white">{stats?.latestBlock?.toLocaleString() || '...'}</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-3 hover:border-slate-600/50 transition backdrop-blur-sm">
                    <p className="text-xs text-slate-500 mb-1">Indexed Blocks</p>
                    <p className="text-lg font-semibold text-white">{stats?.totalBlocks?.toLocaleString() || '...'}</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-3 hover:border-cyan-500/30 transition backdrop-blur-sm">
                    <p className="text-xs text-slate-500 mb-1">Next Epoch In</p>
                    <p className="text-lg font-semibold text-cyan-400">{countdown}</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-3 hover:border-slate-600/50 transition backdrop-blur-sm">
                    <p className="text-xs text-slate-500 mb-1">Avg Block Time</p>
                    <p className="text-lg font-semibold text-white">~6s</p>
                  </div>
                </div>
              </div>
            )}
            {!loading && (
              <div className="grid lg:grid-cols-3 gap-4 mb-6">
                {/* BAR CHART - Unique animated gradient bars */}
                <div className="lg:col-span-2 rounded-2xl overflow-hidden backdrop-blur-sm border border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/50">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-600/20 via-purple-600/10 to-transparent border-b border-slate-700/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/30 to-purple-500/30 flex items-center justify-center border border-pink-500/20">
                        <TrendingUp className="w-5 h-5 text-pink-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Block Activity</h3>
                        <p className="text-xs text-slate-500">Last 15 blocks • All transactions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Chart Toggle */}
                      <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg">
                        <button onClick={() => setChartType('bar')} className={`p-1.5 rounded transition ${chartType === 'bar' ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
                        </button>
                        <button onClick={() => setChartType('area')} className={`p-1.5 rounded transition ${chartType === 'area' ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Avg TPS</p>
                        <p className="font-semibold text-white">{tps.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs font-medium text-green-400">Live</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    {chartType === 'bar' ? (
                      <div className="flex items-end justify-between gap-1 h-44">
                        {chartData.slice(-15).map((d, i) => {
                          const maxTxs = Math.max(...chartData.map(x => x.txs), 1);
                          const height = Math.max((d.txs / maxTxs) * 100, 5);
                          const isLatest = i === chartData.slice(-15).length - 1;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                              <div className="relative w-full flex justify-center">
                                <div 
                                  className={`w-full max-w-[24px] rounded-t-lg transition-all duration-500 ${isLatest ? 'animate-pulse' : ''}`}
                                  style={{
                                    height: `${height}%`,
                                    minHeight: '8px',
                                    background: `linear-gradient(to top, #ec4899, #a855f7, #06b6d4)`
                                  }}
                                />
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                  {d.txs} txs
                                </div>
                              </div>
                              <p className="text-[8px] text-slate-600 group-hover:text-slate-400 transition truncate w-full text-center">{d.name.replace('#', '')}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorTxsArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5}/>
                                <stop offset="50%" stopColor="#ec4899" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #a855f7', borderRadius: '12px', fontSize: '12px' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#a855f7' }} />
                            <Area type="monotone" dataKey="txs" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorTxsArea)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Network Status + Token - Japanese style */}
                <div className="rounded-2xl overflow-hidden backdrop-blur-sm border border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/50">
                  {/* Token Mini Header */}
                  <div className="p-3 bg-gradient-to-r from-yellow-600/20 to-transparent border-b border-slate-700/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src="/night-logo.webp" alt="NIGHT" className="w-8 h-8 rounded-full" />
                        <div>
                          <p className="font-bold text-white text-sm">NIGHT</p>
                          <p className="text-[10px] text-slate-500">Midnight</p>
                        </div>
                      </div>
                      {/* Mini Sparkline */}
                      <div className="flex-1 mx-3 h-8">
                        <svg viewBox="0 0 100 32" className="w-full h-full" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={(nightChange ?? 0) >= 0 ? "#22c55e" : "#ef4444"} stopOpacity="0.3"/>
                              <stop offset="100%" stopColor={(nightChange ?? 0) >= 0 ? "#22c55e" : "#ef4444"} stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path
                            d={`M0,${(nightChange ?? 0) >= 0 ? '28' : '4'} L10,${(nightChange ?? 0) >= 0 ? '24' : '8'} L20,${(nightChange ?? 0) >= 0 ? '26' : '6'} L30,${(nightChange ?? 0) >= 0 ? '20' : '12'} L40,${(nightChange ?? 0) >= 0 ? '22' : '10'} L50,${(nightChange ?? 0) >= 0 ? '16' : '16'} L60,${(nightChange ?? 0) >= 0 ? '18' : '14'} L70,${(nightChange ?? 0) >= 0 ? '12' : '20'} L80,${(nightChange ?? 0) >= 0 ? '8' : '24'} L90,${(nightChange ?? 0) >= 0 ? '6' : '26'} L100,${(nightChange ?? 0) >= 0 ? '4' : '28'} L100,32 L0,32 Z`}
                            fill="url(#sparkGradient)"
                          />
                          <path
                            d={`M0,${(nightChange ?? 0) >= 0 ? '28' : '4'} L10,${(nightChange ?? 0) >= 0 ? '24' : '8'} L20,${(nightChange ?? 0) >= 0 ? '26' : '6'} L30,${(nightChange ?? 0) >= 0 ? '20' : '12'} L40,${(nightChange ?? 0) >= 0 ? '22' : '10'} L50,${(nightChange ?? 0) >= 0 ? '16' : '16'} L60,${(nightChange ?? 0) >= 0 ? '18' : '14'} L70,${(nightChange ?? 0) >= 0 ? '12' : '20'} L80,${(nightChange ?? 0) >= 0 ? '8' : '24'} L90,${(nightChange ?? 0) >= 0 ? '6' : '26'} L100,${(nightChange ?? 0) >= 0 ? '4' : '28'}`}
                            fill="none"
                            stroke={(nightChange ?? 0) >= 0 ? "#22c55e" : "#ef4444"}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="100" cy={(nightChange ?? 0) >= 0 ? '4' : '28'} r="3" fill={(nightChange ?? 0) >= 0 ? "#22c55e" : "#ef4444"} className="animate-pulse" />
                        </svg>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">${nightPrice?.toFixed(4) || '...'}</p>
                        {nightChange !== null && <span className={`text-xs ${nightChange >= 0 ? "text-green-400" : "text-red-400"}`}>{nightChange >= 0 ? "↑" : "↓"}{Math.abs(nightChange).toFixed(2)}%</span>}
                      </div>
                    </div>
                  </div>
                  
                  {/* Network Status */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-green-400" />
                      <h4 className="text-sm font-semibold text-white">Network Status</h4>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Health Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Health</span>
                          <span className="text-green-400 font-medium">Excellent</span>
                        </div>
                        <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                          <div className="h-full w-[98%] bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" />
                        </div>
                      </div>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                          <p className="text-[10px] text-slate-500">FINALITY</p>
                          <p className="font-semibold text-white text-sm">~6s</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                          <p className="text-[10px] text-slate-500">VALIDATORS</p>
                          <p className="font-semibold text-white text-sm">Active</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                          <p className="text-[10px] text-slate-500">MCAP</p>
                          <p className="font-semibold text-white text-sm">{nightMcap ? formatNumber(nightMcap) : '...'}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                          <p className="text-[10px] text-slate-500">VOL 24H</p>
                          <p className="font-semibold text-white text-sm">{nightVolume ? formatNumber(nightVolume) : '...'}</p>
                        </div>
                      </div>
                      
                      {/* Sync Status */}
                      <div className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-xs text-slate-400">Fully Synced</span>
                        </div>
                        <span className="text-xs text-green-400 font-mono">{((stats?.totalBlocks / stats?.latestBlock) * 100).toFixed(1) || '...'}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {loading ? (
              <div className="grid md:grid-cols-2 gap-4"><div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 backdrop-blur-sm"><Skeleton className="h-5 w-28 mb-3" />{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full mb-2" />)}</div><div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 backdrop-blur-sm"><Skeleton className="h-5 w-36 mb-3" />{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full mb-2" />)}</div></div>
            ) : activeTab === 'overview' ? (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Recent Blocks - Unique Style */}
                <div className="rounded-2xl overflow-hidden backdrop-blur-sm border border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/50">
                  <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-blue-600/20 to-transparent border-b border-slate-700/30">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><Blocks className="w-4 h-4 text-blue-400" />Recent Blocks</h3>
                    <button onClick={() => setActiveTab('blocks')} className="text-cyan-400 text-xs hover:text-white hover:underline flex items-center gap-1 transition cursor-pointer">View All <ChevronRight className="w-3 h-3" /></button>
                  </div>
                  <div className="divide-y divide-slate-700/20">{recentBlocks.slice(0, 5).map((block, idx) => (
                    <div key={idx} onClick={() => handleBlockClick(block)} className="flex items-center justify-between p-3 hover:bg-blue-500/5 cursor-pointer transition group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500/30 to-blue-600/10 rounded-lg flex items-center justify-center border border-blue-500/20 group-hover:border-blue-400/40 transition">
                          <span className="text-xs font-bold text-blue-400">{idx + 1}</span>
                        </div>
                        <div>
                          <p className="font-mono text-white text-sm font-medium group-hover:text-blue-300 transition">#{block.height.toLocaleString()}</p>
                          <p className="text-xs text-slate-500">{formatTime(block.timestamp)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-medium text-white bg-blue-500/20 px-2 py-0.5 rounded">{block.txCount} txs</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition" />
                      </div>
                    </div>
                  ))}</div>
                </div>
                
                {/* Recent Transactions - Unique Style */}
                <div className="rounded-2xl overflow-hidden backdrop-blur-sm border border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/50">
                  <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-green-600/20 to-transparent border-b border-slate-700/30">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-green-400" />Recent Transactions</h3>
                    <button onClick={() => setActiveTab('extrinsics')} className="text-cyan-400 text-xs hover:text-white hover:underline flex items-center gap-1 transition cursor-pointer">View All <ChevronRight className="w-3 h-3" /></button>
                  </div>
                  <div className="divide-y divide-slate-700/20">{(transactions.length > 0 ? transactions.slice(0, 5).map((tx, idx) => (
                    <div key={idx} onClick={() => { setSelectedTx({ hash: tx.hash, blockHeight: tx.block_height, timestamp: tx.timestamp || tx.block_timestamp || '', section: 'midnight', method: 'transaction', index: tx.index_in_block }); navigate('/tx/' + tx.hash); }} className="flex items-center justify-between p-3 hover:bg-green-500/5 cursor-pointer transition group">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 bg-gradient-to-br ${tx.status === 'SUCCESS' ? 'from-green-500/30 to-green-600/10 border-green-500/20 group-hover:border-green-400/40' : 'from-red-500/30 to-red-600/10 border-red-500/20'} rounded-lg flex items-center justify-center border transition`}>
                          <CheckCircle className={`w-4 h-4 ${tx.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}`} />
                        </div>
                        <div>
                          <p className="font-mono text-white text-xs group-hover:text-green-300 transition">{truncHash(tx.hash, 8)}</p>
                          <p className="text-xs text-slate-500">{formatTime(tx.timestamp || tx.block_timestamp || '')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${tx.status === 'SUCCESS' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'} border`}>{tx.status}</span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-green-400 transition" />
                      </div>
                    </div>
                  )) : recentTxs.slice(0, 5).map((tx, idx) => {
                    const c = getMethodColor(tx.section || '');
                    return (
                    <div key={idx} onClick={() => handleTxClick(tx)} className="flex items-center justify-between p-3 hover:bg-green-500/5 cursor-pointer transition group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500/30 to-green-600/10 border-green-500/20 group-hover:border-green-400/40 rounded-lg flex items-center justify-center border transition">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <p className="font-mono text-white text-xs group-hover:text-green-300 transition">{truncHash(tx.hash, 8)}</p>
                          <p className="text-xs text-slate-500">{formatTime(tx.timestamp)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${c.bg} ${c.text} border ${c.border}`}>{tx.section}.{tx.method}</span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-green-400 transition" />
                      </div>
                    </div>);
                  }))}</div>
                </div>
              </div>
            ) : activeTab === 'blocks' ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                <div className="px-4 py-3 border-b border-slate-700/50"><h3 className="font-semibold text-sm">All Blocks</h3></div>
                <div className="divide-y divide-slate-700/30 max-h-[500px] overflow-y-auto">{recentBlocks.map((block, idx) => (<div key={idx} onClick={() => handleBlockClick(block)} className="flex items-center justify-between p-3 hover:bg-slate-800/30 cursor-pointer transition"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center"><Box className="w-5 h-5 text-blue-400" /></div><div><p className="font-mono text-white font-medium">#{block.height.toLocaleString()}</p><p className="text-xs text-slate-500">{formatTime(block.timestamp)}</p></div></div><div className="flex items-center gap-4"><div className="hidden md:block text-right"><p className="text-xs text-slate-500">Hash</p><p className="font-mono text-xs text-slate-300">{truncHash(block.hash, 8)}</p></div><div className="text-right"><p className="text-xs text-slate-500">Txs</p><p className="text-white text-sm font-medium">{block.txCount}</p></div><ChevronRight className="w-4 h-4 text-slate-600" /></div></div>))}</div>
              </div>
            ) : activeTab === 'transactions' ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between"><h3 className="font-semibold text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-green-400" />All Transactions ({transactions.length > 0 ? transactions.length : recentTxs.length})</h3><span className="text-xs text-slate-500">{transactions.length > 0 ? 'Real transactions with inputs/outputs' : 'All blockchain extrinsics'}</span></div>
                <div className="divide-y divide-slate-700/30 max-h-[500px] overflow-y-auto">{transactions.length > 0 ? transactions.map((tx, idx) => (<div key={idx} onClick={() => { setSelectedTx({ hash: tx.hash, blockHeight: tx.block_height, timestamp: tx.timestamp || tx.block_timestamp || '', section: 'midnight', method: 'transaction', index: tx.index_in_block }); navigate('/tx/' + tx.hash); }} className="flex items-center justify-between p-3 hover:bg-slate-800/30 cursor-pointer transition"><div className="flex items-center gap-3"><div className={`w-10 h-10 ${tx.status === 'SUCCESS' ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-lg flex items-center justify-center`}><CheckCircle className={`w-5 h-5 ${tx.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}`} /></div><div><p className="font-mono text-white text-sm">{tx.hash.slice(0, 12)}...{tx.hash.slice(-8)}</p><p className="text-xs text-slate-500">{formatTime(tx.timestamp || tx.block_timestamp || '')}</p></div></div><div className="flex items-center gap-4"><span className={`px-2 py-1 text-xs rounded ${tx.status === 'SUCCESS' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'} border`}>{tx.status}</span><span className={`px-2 py-1 text-xs rounded ${tx.is_shielded ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'} border`}>{tx.is_shielded ? '🔒' : '📖'}</span><div className="hidden md:block text-right"><p className="text-xs text-slate-500">Block</p><p className="text-white text-sm font-mono">#{tx.block_height.toLocaleString()}</p></div><ChevronRight className="w-4 h-4 text-slate-600" /></div></div>)) : recentTxs.map((tx, idx) => { const colors = getMethodColor(tx.section || ''); return (<div key={idx} onClick={() => handleTxClick(tx)} className="flex items-center justify-between p-3 hover:bg-slate-800/30 cursor-pointer transition"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-400" /></div><div><p className="font-mono text-white text-sm">{truncHash(tx.hash, 8)}</p><p className="text-xs text-slate-500">{formatTime(tx.timestamp)}</p></div></div><div className="flex items-center gap-4"><span className={`px-2 py-1 text-xs rounded ${colors.bg} ${colors.text} border ${colors.border}`}>{tx.section}.{tx.method}</span><div className="hidden md:block text-right"><p className="text-xs text-slate-500">Block</p><p className="text-white text-sm font-mono">#{tx.blockHeight.toLocaleString()}</p></div><ChevronRight className="w-4 h-4 text-slate-600" /></div></div>); })}</div>
              </div>
            ) : activeTab === 'extrinsics' ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                <div className="px-4 py-3 border-b border-slate-700/50"><h3 className="font-semibold text-sm">All Extrinsics</h3><p className="text-xs text-slate-500">All blockchain operations</p></div>
                <div className="divide-y divide-slate-700/30 max-h-[500px] overflow-y-auto">{recentTxs.map((tx, idx) => { const colors = getMethodColor(tx.section || ''); return (<div key={idx} onClick={() => handleTxClick(tx)} className="flex items-center justify-between p-3 hover:bg-slate-800/30 cursor-pointer transition"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center"><Zap className="w-5 h-5 text-purple-400" /></div><div><p className="font-mono text-white text-sm">{truncHash(tx.hash, 8)}</p><p className="text-xs text-slate-500">{formatTime(tx.timestamp)}</p></div></div><div className="flex items-center gap-4"><span className={`px-2 py-1 text-xs rounded ${colors.bg} ${colors.text} border ${colors.border}`}>{tx.section}.{tx.method}</span><div className="hidden md:block text-right"><p className="text-xs text-slate-500">Block</p><p className="text-white text-sm font-mono">#{tx.blockHeight.toLocaleString()}</p></div><ChevronRight className="w-4 h-4 text-slate-600" /></div></div>); })}</div>
              </div>
            ) : activeTab === 'contracts' ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between"><h3 className="font-semibold text-sm flex items-center gap-2"><FileCode className="w-4 h-4 text-cyan-400" />Smart Contracts ({stats?.totalContracts || contracts.length})</h3><span className="text-xs text-slate-500">Deployed Compact contracts on {NETWORK.name}</span></div>
                <div className="divide-y divide-slate-700/30 max-h-[600px] overflow-y-auto">{contracts.length === 0 ? <div className="p-8 text-center text-slate-500">Loading contracts...</div> : contracts.slice(0, 100).map((contract, idx) => (<div key={idx} onClick={() => { setSelectedContract(contract); navigate('/contract/' + contract.address); }} className="flex items-center justify-between p-3 hover:bg-slate-800/30 cursor-pointer transition"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center"><FileCode className="w-5 h-5 text-cyan-400" /></div><div><p className="font-mono text-cyan-300 text-sm" title={contract.address}>{contract.address.slice(0, 16)}...{contract.address.slice(-8)}</p><p className="text-xs text-slate-500">Entry: <span className="text-purple-400">{contract.entry_point}</span></p></div></div><div className="flex items-center gap-4"><span className="px-2 py-1 text-xs rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">{contract.type_name}</span><div className="hidden md:block text-right"><p className="text-xs text-slate-500">Deploy Tx</p><p className="text-white text-xs font-mono">{contract.tx_hash.slice(0, 10)}...</p></div><ChevronRight className="w-4 h-4 text-slate-600" /></div></div>))}</div>
              </div>
            ) : activeTab === 'pools' && activeNetwork === 'testnet' ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-10 text-center backdrop-blur-sm"><Users className="w-14 h-14 mx-auto mb-3 text-purple-400" /><h3 className="text-lg font-semibold text-white mb-2">Stake Pools / Validators</h3><p className="text-slate-400 text-sm mb-4">Testnet stake pools are live. Full pool explorer coming soon!</p><a href="https://midnight.network" target="_blank" rel="noopener noreferrer" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition inline-block">Learn About Staking</a></div>
            ) : (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-10 text-center backdrop-blur-sm"><FileCode className="w-14 h-14 mx-auto mb-3 text-slate-600" /><h3 className="text-lg font-semibold text-white mb-2">Smart Contracts</h3><p className="text-slate-400 text-sm mb-4">Connect your wallet to view and manage your deployed Compact contracts</p><button className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm font-medium transition">Connect Wallet</button></div>
            )}
          </>
        )}
      </main>
      <footer className="mt-8 py-6 border-t border-slate-800/50 bg-slate-900/50 relative z-10"><div className="max-w-7xl mx-auto px-4"><div className="flex flex-col md:flex-row items-center justify-between gap-3"><div className="flex items-center gap-2"><img src="/favicon.ico" alt="NightForge" className="w-7 h-7 rounded-lg" /><span className="font-semibold text-white text-sm">NightForge Explorer</span></div><p className="text-xs text-slate-500 flex items-center gap-2">© 2026 Night Forge • Powered by Midnight Network <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">🇯🇵 Made in Japan</span></p><div className="flex items-center gap-4"><a href="https://midnight.network" className="text-xs text-slate-400 hover:text-cyan-400 transition">Midnight</a><a href="https://docs.midnight.network" className="text-xs text-slate-400 hover:text-cyan-400 transition">Docs</a><a href="https://nft.nightforge.jp" className="text-xs text-slate-400 hover:text-pink-400 transition">NFT</a></div></div></div></footer>
    </div>
  );
};

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { NetworkBackground } from '../components/NetworkBackground';
import { useState, useEffect } from 'react';
import { Menu, X, Globe, ChevronRight, CheckCircle, Database, Wifi } from 'lucide-react';

const isSubdomain = () => {
  const host = window.location.hostname;
  return host.startsWith('testnet.') || host.startsWith('preview.');
};

const getMainUrl = (path: string) => {
  if (isSubdomain()) {
    return `https://nightforge.jp${path}`;
  }
  return path;
};

const NightPriceWidget = () => {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [mcap, setMcap] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=midnight-3&vs_currencies=usd&include_24hr_change=true&include_market_cap=true', { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        if (data['midnight-3']) {
          setPrice(data['midnight-3'].usd);
          setChange(data['midnight-3'].usd_24h_change);
          const cap = data['midnight-3'].usd_market_cap;
          setMcap(cap >= 1e9 ? `$${(cap/1e9).toFixed(2)}B` : `$${(cap/1e6).toFixed(0)}M`);
        }
      } catch (e) {}
      setLoaded(true);
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);
  if (!loaded) return null;
  if (!price) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700">
      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white">◐</div>
      <span className="text-xs text-slate-400">NIGHT $--</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700">
      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white">◐</div>
      <span className="text-xs text-slate-400">NIGHT</span>
      <span className="text-sm font-bold text-white">${price.toFixed(4)}</span>
      {change !== null && <span className={`text-xs ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{change >= 0 ? '↑' : '↓'}{Math.abs(change).toFixed(2)}%</span>}
      <span className="text-xs text-slate-500">MCap {mcap}</span>
    </div>
  );
};

const ExplorerControls = () => {
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const getNetwork = () => {
    const host = window.location.hostname;
    if (host.startsWith('testnet.')) return 'testnet';
    if (host.startsWith('preview.')) return 'preview';
    return localStorage.getItem('midnight-network') || 'preview';
  };
  const [activeNetwork] = useState(getNetwork);
  const [indexerStats, setIndexerStats] = useState<any>(null);
  
  const NETWORKS: Record<string, any> = {
    preview: { badge: 'PREVIEW', api: '/api/preview' },
    testnet: { badge: 'TESTNET-02', api: '/api/testnet' }
  };
  const NETWORK = NETWORKS[activeNetwork] || NETWORKS.preview;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${NETWORK.api}/stats`);
        const data = await res.json();
        setIndexerStats(data);
      } catch (e) {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [NETWORK.api]);

  const goToNetwork = (network: string) => {
    if (network === 'preview') {
      window.location.href = 'https://preview.nightforge.jp/';
    } else {
      window.location.href = 'https://testnet.nightforge.jp/';
    }
  };

  return (
    <div className="hidden lg:flex items-center gap-2">
      <div className="relative">
        <button onClick={() => setShowNetworkMenu(!showNetworkMenu)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-blue-300">{NETWORK.badge}</span>
          <ChevronRight className={`w-3 h-3 text-blue-400 transition-transform ${showNetworkMenu ? 'rotate-90' : ''}`} />
        </button>
        {showNetworkMenu && (
          <div className="absolute top-full mt-2 left-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden">
            <button onClick={() => goToNetwork('preview')} className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700 flex items-center justify-between ${activeNetwork === 'preview' ? 'bg-slate-700 text-cyan-400' : 'text-white'}`}>
              Preview {activeNetwork === 'preview' && <CheckCircle className="w-3 h-3" />}
            </button>
            <button onClick={() => goToNetwork('testnet')} className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700 flex items-center justify-between ${activeNetwork === 'testnet' ? 'bg-slate-700 text-cyan-400' : 'text-white'}`}>
              Testnet-02 {activeNetwork === 'testnet' && <CheckCircle className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>
      <NightPriceWidget />
      {indexerStats && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/50">
          <Database className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-300">{indexerStats.totalBlocks?.toLocaleString()} INDEXED</span>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/50">
        <Wifi className="w-4 h-4 text-green-400" />
        <span className="text-xs font-semibold text-green-300">CONNECTED</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/50">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-semibold text-green-300">LIVE</span>
      </div>
    </div>
  );
};

const NavItem = ({ to, children, end = false }: { to: string; children: React.ReactNode; end?: boolean }) => {
  const location = useLocation();
  const onSubdomain = isSubdomain();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  if (onSubdomain) {
    // On subdomain, "/" is explorer, everything else goes to main site
    if (to === '/explorer' || to === '/') {
      return (
        <NavLink to="/" className={({ isActive }) => `font-semibold transition hover:text-cyan-400 ${isActive ? 'text-cyan-400' : 'text-slate-300'}`} end>
          {children}
        </NavLink>
      );
    }
    return (
      <a href={getMainUrl(to)} className={`font-semibold transition hover:text-cyan-400 text-slate-300`}>
        {children}
      </a>
    );
  }

  return (
    <NavLink to={to} className={({ isActive }) => `font-semibold transition hover:text-cyan-400 ${isActive ? 'text-cyan-400' : 'text-slate-300'}`} end={end}>
      {children}
    </NavLink>
  );
};

export const MainLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isExplorer = isSubdomain() || location.pathname === "/" || location.pathname.startsWith("/explorer") || location.pathname.startsWith("/block") || location.pathname.startsWith("/tx");
  
  return (
    <div className="min-h-screen flex flex-col bg-[#020817]">
      <NetworkBackground />
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="bg-[#0a1628]/80 backdrop-blur-md border-b border-cyan-900/30">
          <nav className="container mx-auto flex items-center justify-between p-3 gap-3">
            <a href="https://nightforge.jp" className="flex items-center gap-2 shrink-0">
              <img src="/favicon.ico" alt="Night Forge" className="w-8 h-8 rounded-lg" />
              <span className="font-bold text-white hidden sm:block">Night Forge</span>
            </a>
            
            {isExplorer && <ExplorerControls />}
            
            
            <div className="hidden md:flex gap-5 shrink-0">
              <NavItem to="/" end>Home</NavItem>
              <NavItem to="/real-nft">🎨 NFT Minter</NavItem>
              
              
            </div>
            <button className="md:hidden p-2 text-slate-300 hover:text-cyan-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </nav>
          {mobileMenuOpen && (
            <div className="md:hidden bg-[#0a1628]/95 backdrop-blur-md border-t border-cyan-900/30 px-4 py-3 space-y-3">
              <a href={getMainUrl('/')} onClick={() => setMobileMenuOpen(false)} className="block py-2 font-semibold transition text-slate-300 hover:text-cyan-400">Home</a>
              <a href={getMainUrl('/real-nft')} onClick={() => setMobileMenuOpen(false)} className="block py-2 font-semibold transition text-slate-300 hover:text-cyan-400">🎨 NFT Minter</a>
              <a href={isSubdomain() ? '/' : '/explorer'} onClick={() => setMobileMenuOpen(false)} className="block py-2 font-semibold transition text-slate-300 hover:text-cyan-400">🔍 Explorer</a>
              
            </div>
          )}
        </header>
        <main className="flex-1 p-6"><Outlet /></main>
        <footer className="border-t border-cyan-900/30 py-4 text-center">
          <p className="text-slate-500 text-sm">Night Forge • Made in Japan 🇯🇵</p>
        </footer>
      </div>
    </div>
  );
};

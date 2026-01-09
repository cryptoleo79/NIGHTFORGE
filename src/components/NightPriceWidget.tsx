import { useState, useEffect } from 'react';

export const NightPriceWidget = () => {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [mcap, setMcap] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=midnight-network&vs_currencies=usd&include_24hr_change=true&include_market_cap=true');
        const data = await res.json();
        if (data['midnight-network']) {
          setPrice(data['midnight-network'].usd);
          setChange(data['midnight-network'].usd_24h_change);
          const cap = data['midnight-network'].usd_market_cap;
          setMcap(cap >= 1e9 ? `$${(cap/1e9).toFixed(2)}B` : `$${(cap/1e6).toFixed(0)}M`);
        }
      } catch (e) { console.error('Price fetch error:', e); }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!price) return null;

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700">
      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white">◐</div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">NIGHT</span>
        <span className="text-sm font-bold text-white">${price.toFixed(4)}</span>
        {change !== null && (
          <span className={`text-xs ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? '↑' : '↓'}{Math.abs(change).toFixed(2)}%
          </span>
        )}
        {mcap && <span className="text-xs text-slate-500">MCap {mcap}</span>}
      </div>
    </div>
  );
};

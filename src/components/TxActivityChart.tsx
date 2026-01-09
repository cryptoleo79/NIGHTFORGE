import { useState, useEffect } from 'react';

export const TxActivityChart = ({ apiUrl }: { apiUrl: string }) => {
  const [data, setData] = useState<{hour: string, count: number}[]>([]);
  
  useEffect(() => {
    fetch(`${apiUrl}/analytics/volume`)
      .then(r => r.json())
      .then(d => setData(d || []))
      .catch(() => {});
  }, [apiUrl]);
  
  if (!data.length) return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-700 p-6 h-64 flex items-center justify-center text-slate-500">
      Loading chart...
    </div>
  );
  
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: 100 - (d.count / maxCount) * 80
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L 100 100 L 0 100 Z`;
  
  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Transaction Activity</h3>
          <p className="text-sm text-slate-400">Last 24 hours</p>
        </div>
        <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
          Live
        </span>
      </div>
      <div className="h-48">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(34,211,238)" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="rgb(34,211,238)" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#chartGrad)" />
          <path d={pathD} fill="none" stroke="rgb(34,211,238)" strokeWidth="0.5" />
        </svg>
      </div>
    </div>
  );
};

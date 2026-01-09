import { useState, useEffect } from 'react';
import { Clock, Layers } from 'lucide-react';

// Midnight uses ~432000 slots per epoch (5 days), 1 slot = 1 second
const SLOTS_PER_EPOCH = 432000;

export const EpochWidget = ({ currentBlock, api }: { currentBlock: number; api?: any }) => {
  const [epochData, setEpochData] = useState({
    epoch: 0,
    slot: 0,
    timeRemaining: '',
    progress: 0
  });

  useEffect(() => {
    const calculateEpoch = async () => {
      try {
        // Try to get actual slot from API if available
        let currentSlot = 0;
        if (api && api.query && api.query.timestamp) {
          const now = await api.query.timestamp.now();
          // Estimate slot from timestamp (genesis was roughly when chain started)
          currentSlot = Math.floor(Number(now) / 1000);
        } else {
          // Fallback: estimate slot from block (assuming ~1 block per second)
          currentSlot = currentBlock * 1;
        }

        const currentEpoch = Math.floor(currentSlot / SLOTS_PER_EPOCH);
        const slotInEpoch = currentSlot % SLOTS_PER_EPOCH;
        const slotsRemaining = SLOTS_PER_EPOCH - slotInEpoch;
        const progress = (slotInEpoch / SLOTS_PER_EPOCH) * 100;

        // Calculate time remaining
        const hours = Math.floor(slotsRemaining / 3600);
        const minutes = Math.floor((slotsRemaining % 3600) / 60);
        const seconds = slotsRemaining % 60;

        setEpochData({
          epoch: currentEpoch,
          slot: currentSlot,
          timeRemaining: `${hours}h ${minutes}m ${seconds}s`,
          progress
        });
      } catch (e) {
        console.error('Epoch calc error:', e);
      }
    };

    if (currentBlock > 0) {
      calculateEpoch();
      const interval = setInterval(calculateEpoch, 1000);
      return () => clearInterval(interval);
    }
  }, [currentBlock, api]);

  if (!currentBlock || currentBlock === 0) {
    return null;
  }

  return (
    <div className="hidden lg:flex items-center gap-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700">
        <Layers className="w-4 h-4 text-cyan-400" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-slate-500">EPOCH</span>
          <span className="text-sm font-bold text-white">{epochData.epoch.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/30">
        <Clock className="w-4 h-4 text-indigo-400" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-slate-500">NEXT EPOCH</span>
          <span className="text-sm font-bold text-white">{epochData.timeRemaining}</span>
        </div>
        <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            style={{ width: `${epochData.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

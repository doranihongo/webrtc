import React, { useState, useEffect } from 'react';
import { Users, Copy, Check, Clock, ShieldCheck } from 'lucide-react';

interface CallHeaderProps {
  roomId: string;
  hasPeerConnected: boolean;
  peerName?: string;
  onCopyRoomLink: () => void;
  showControls?: boolean;
}

export const CallHeader: React.FC<CallHeaderProps> = ({
  roomId,
  hasPeerConnected,
  peerName,
  onCopyRoomLink,
  showControls = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-b from-slate-950/90 to-transparent backdrop-blur-sm flex max-lg:landscape:hidden items-center justify-between text-xs transition-all duration-500 transform ${showControls === false ? 'max-md:-translate-y-full max-md:opacity-0 max-md:pointer-events-none' : 'translate-y-0 opacity-100'}`}>
      {/* Room Code Badge */}
      <div className="flex items-center gap-2">
        <div className="bg-slate-900/90 border border-slate-800 text-slate-200 px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400 font-normal hidden sm:inline text-[11px]">Mã phòng:</span>
          <span className="font-mono font-bold tracking-wider text-blue-400 uppercase text-xs">{roomId}</span>
          <button
            onClick={handleCopyCode}
            title="Sao chép mã phòng"
            className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors ml-0.5"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Timer & Peer Status */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Call Timer */}
        <div className="bg-slate-900/90 border border-slate-800 text-slate-300 px-2 sm:px-2.5 py-1 rounded-lg font-mono text-[11px] sm:text-xs flex items-center gap-1.5 shadow-md">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{formatTime(seconds)}</span>
        </div>

        {/* Peer Status Badge - Number count only */}
        <div className="bg-slate-900/90 border border-slate-800 px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
          <span className={`w-2 h-2 rounded-full ${hasPeerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <Users className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] sm:text-xs font-bold font-mono">
            {hasPeerConnected ? (
              <span className="text-emerald-400">2/2</span>
            ) : (
              <span className="text-amber-400">1/2</span>
            )}
          </span>
        </div>
      </div>
    </header>
  );
};

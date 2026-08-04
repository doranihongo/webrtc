import React, { useState, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, ArrowRight, RefreshCw, Copy, Check, ShieldAlert } from 'lucide-react';

interface JoinRoomFormProps {
  onJoin: (roomId: string, userName: string, initialAudioMuted: boolean, initialVideoOff: boolean) => void;
  defaultRoomId?: string;
  errorMessage?: string | null;
}

export const JoinRoomForm: React.FC<JoinRoomFormProps> = ({ onJoin, defaultRoomId, errorMessage }) => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPermissionNotice, setShowPermissionNotice] = useState(false);

  useEffect(() => {
    // Generate initial random room code if none provided
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomId(defaultRoomId || randomCode);

    // Read saved username if available
    const savedName = localStorage.getItem('webrtc_user_name');
    if (savedName) setUserName(savedName);
  }, [defaultRoomId]);

  const generateRandomRoom = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomId(randomCode);
  };

  const executeJoin = () => {
    localStorage.setItem('webrtc_user_name', userName.trim());
    onJoin(roomId.trim().toLowerCase(), userName.trim(), isAudioMuted, isVideoOff);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !userName.trim()) return;

    if (isAudioMuted && isVideoOff) {
      executeJoin();
      return;
    }

    let needsPermission = false;
    try {
      const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (
        (!isVideoOff && camStatus.state !== 'granted') || 
        (!isAudioMuted && micStatus.state !== 'granted')
      ) {
        needsPermission = true;
      }
    } catch (err) {
      needsPermission = true;
    }

    if (needsPermission) {
      setShowPermissionNotice(true);
    } else {
      executeJoin();
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 max-lg:landscape:p-2 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Form Card - Perfectly centered card with clean top/bottom margins on all orientations */}
      <div className="w-full max-w-[320px] sm:max-w-sm max-lg:landscape:max-w-[340px] bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 sm:p-6 max-lg:landscape:px-4 max-lg:landscape:py-2.5 shadow-2xl z-10 my-auto">
        {/* Header Branding */}
        <div className="text-center mb-3 sm:mb-5 max-lg:landscape:mb-1.5 flex flex-col items-center">
          {/* Static Icon Badge */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 max-lg:landscape:w-8 max-lg:landscape:h-8 bg-blue-600/20 border border-blue-500/30 rounded-2xl max-lg:landscape:rounded-xl flex items-center justify-center mb-1.5 max-lg:landscape:mb-0.5 text-blue-400">
            <Video className="w-5 h-5 sm:w-6 sm:h-6 max-lg:landscape:w-4 max-lg:landscape:h-4" />
          </div>

          <h1 className="text-base sm:text-2xl max-lg:landscape:text-sm font-bold tracking-tight text-white">
            PHÒNG HỌC DORA
          </h1>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-3 p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs text-center">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 max-lg:landscape:space-y-1.5">
          {/* User Name Input */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5 sm:mb-1">
              Tên hiển thị
            </label>
            <input
              type="text"
              required
              placeholder="VD: Vũ Thế Đạt"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2.5 max-lg:landscape:py-1 bg-slate-800/80 border border-slate-700 rounded-xl text-[16px] sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Room Code Input */}
          <div>
            <div className="flex items-center justify-between mb-0.5 sm:mb-1">
              <label className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Mã phòng học
              </label>
              <button
                type="button"
                onClick={generateRandomRoom}
                className="cursor-pointer text-[11px] sm:text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Mã ngẫu nhiên
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                placeholder="VD: 123456"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2.5 max-lg:landscape:py-1 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono tracking-widest uppercase text-[16px] sm:text-base max-lg:landscape:text-xs"
              />
              <button
                type="button"
                onClick={handleCopyId}
                title="Sao chép mã phòng"
                className="cursor-pointer absolute right-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[10px] sm:text-xs font-medium flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Đã chép' : 'Sao chép'}
              </button>
            </div>
          </div>

          {/* Pre-call Media Controls */}
          <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-2 sm:p-3 max-lg:landscape:p-1 flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-medium text-slate-300">
              Cấu hình:
            </span>
            <div className="flex items-center gap-1.5">
              {/* Mic Toggle */}
              <button
                type="button"
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                title={isAudioMuted ? 'Đang TẮT Micro' : 'Đang BẬT Micro'}
                className={`cursor-pointer p-1.5 sm:p-2 rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium transition-all ${
                  isAudioMuted
                    ? 'bg-rose-600/90 text-white border border-rose-500/50'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600/50'
                }`}
              >
                {isAudioMuted ? <MicOff className="w-3 h-3 text-rose-200" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                <span>Mic</span>
              </button>

              {/* Camera Toggle */}
              <button
                type="button"
                onClick={() => setIsVideoOff(!isVideoOff)}
                title={isVideoOff ? 'Đang TẮT Camera' : 'Đang BẬT Camera'}
                className={`cursor-pointer p-1.5 sm:p-2 rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium transition-all ${
                  isVideoOff
                    ? 'bg-rose-600/90 text-white border border-rose-500/50'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600/50'
                }`}
              >
                {isVideoOff ? <VideoOff className="w-3 h-3 text-rose-200" /> : <Video className="w-3 h-3 text-emerald-400" />}
                <span>Cam</span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!userName.trim() || !roomId.trim()}
            className="cursor-pointer w-full py-2 sm:py-3 max-lg:landscape:py-1.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
          >
            VÀO PHÒNG
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </form>
      </div>

      {/* Permission Pre-prompt Notice Modal */}
      {showPermissionNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-700 p-6 sm:p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Lưu ý: Cấp quyền truy cập
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed px-2">
                Trình duyệt sẽ yêu cầu quyền truy cập Camera và Microphone. Vui lòng chọn <span className="text-white font-medium">"Cho phép"</span> để vào phòng học.
              </p>
            </div>
            <button
              onClick={() => {
                setShowPermissionNotice(false);
                executeJoin();
              }}
              className="cursor-pointer w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all active:scale-[0.98]"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

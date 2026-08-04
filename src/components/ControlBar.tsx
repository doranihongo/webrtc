import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, CircleDot, PictureInPicture, Maximize } from 'lucide-react';
import { ScreenShareIcon, ChatIcon } from './CustomIcons';

interface ControlBarProps {
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRemoteScreenSharing?: boolean;
  isChatOpen: boolean;
  unreadCount: number;
  roomId: string;
  isPipActive?: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onLeaveCall: () => void;
  onOpenSettings: () => void;
  onTogglePip?: () => void;
  onToggleFullscreen?: () => void;
  showControls?: boolean;
  disablePip?: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isRemoteScreenSharing = false,
  isChatOpen,
  unreadCount,
  isPipActive = false,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onLeaveCall,
  onOpenSettings,
  onTogglePip,
  onToggleFullscreen,
  showControls = true,
  disablePip = false,
}) => {
  const [supportsPip, setSupportsPip] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      setSupportsPip(true);
    }
  }, []);

  return (
    <div className={`fixed bottom-4 sm:bottom-4 max-lg:landscape:bottom-2 left-1/2 -translate-x-1/2 z-40 max-w-full px-2 sm:px-4 transition-all duration-500 transform ${showControls === false ? 'max-md:translate-y-24 max-md:opacity-0 max-md:pointer-events-none max-lg:landscape:translate-y-24 max-lg:landscape:opacity-0 max-lg:landscape:pointer-events-none' : 'translate-y-0 opacity-100'}`}>
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl max-lg:landscape:rounded-xl px-3 sm:px-3 max-lg:landscape:px-2 py-2 sm:py-2 max-lg:landscape:py-1.5 shadow-2xl flex items-center gap-2 sm:gap-2.5 max-lg:landscape:gap-1.5">
        {/* Toggle Audio */}
        <button
          onClick={onToggleAudio}
          title={isAudioMuted ? 'Bật Micro' : 'Tắt Micro'}
          className={`cursor-pointer p-2.5 sm:p-2.5 max-lg:landscape:p-2 rounded-xl max-lg:landscape:rounded-lg flex items-center justify-center transition-all ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
        >
          {isAudioMuted ? (
            <MicOff className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
          ) : (
            <Mic className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
          )}
        </button>

        {/* Toggle Video */}
        <button
          onClick={onToggleVideo}
          disabled={isScreenSharing}
          title={isScreenSharing ? 'Không thể bật camera khi đang chia sẻ màn hình' : (isVideoOff ? 'Bật Camera' : 'Tắt Camera')}
          className={`cursor-pointer p-2.5 sm:p-2.5 max-lg:landscape:p-2 rounded-xl max-lg:landscape:rounded-lg flex items-center justify-center transition-all ${
            isScreenSharing
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50'
              : isVideoOff
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
        >
          {isVideoOff ? (
            <VideoOff className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
          ) : (
            <Video className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
          )}
        </button>

        {/* Toggle Screen Share (Hidden on mobile) */}
        <button
          onClick={onToggleScreenShare}
          disabled={isRemoteScreenSharing && !isScreenSharing}
          title={isRemoteScreenSharing && !isScreenSharing ? 'Đối tác đang chia sẻ màn hình' : isScreenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
          className={`cursor-pointer hidden md:flex p-2.5 sm:p-2.5 max-lg:landscape:p-2 rounded-xl max-lg:landscape:rounded-lg items-center justify-center transition-all ${
            isRemoteScreenSharing && !isScreenSharing
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50'
              : isScreenSharing
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
        >
          <ScreenShareIcon className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
        </button>

        {/* Record (Hidden on mobile) */}
        <button
          title="Ghi hình"
          className="cursor-pointer hidden md:flex p-2.5 sm:p-2.5 max-lg:landscape:p-2 rounded-xl max-lg:landscape:rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 items-center justify-center transition-all"
        >
          <CircleDot className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
        </button>

        {/* Toggle Chat */}
        <button
          onClick={onToggleChat}
          title="Trò chuyện"
          className={`cursor-pointer p-2.5 sm:p-2.5 max-lg:landscape:p-2 rounded-xl max-lg:landscape:rounded-lg flex items-center justify-center transition-all relative ${
            isChatOpen
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
        >
          <ChatIcon className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute -top-1.5 -right-1.5 max-lg:landscape:-top-1 max-lg:landscape:-right-1 bg-red-600 text-white text-[10px] max-lg:landscape:text-[8px] font-bold min-w-[20px] max-lg:landscape:min-w-[14px] h-5 max-lg:landscape:h-3.5 px-1 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* PiP Mode */}
        {supportsPip && onTogglePip && (
          <button
            onClick={onTogglePip}
            disabled={disablePip}
            title={disablePip ? "Cần có người trong phòng để mở PiP" : isPipActive ? "Đóng Hình trong hình" : "Mở Hình trong hình"}
            className={`cursor-pointer hidden md:flex p-2.5 sm:p-2.5 max-lg:landscape:p-2 rounded-xl max-lg:landscape:rounded-lg ${disablePip ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed' : isPipActive ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'} items-center justify-center transition-all`}
          >
            <PictureInPicture className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
          </button>
        )}

        {/* Fullscreen Video (Mobile only) */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            title="Toàn màn hình video"
            className="cursor-pointer md:hidden flex p-2.5 sm:p-2.5 max-lg:landscape:p-2 rounded-xl max-lg:landscape:rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 items-center justify-center transition-all"
          >
            <Maximize className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Cài đặt"
          className="cursor-pointer p-2.5 sm:p-2.5 max-lg:landscape:p-2 rounded-xl max-lg:landscape:rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-all"
        >
          <Settings className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 max-lg:landscape:h-3.5 bg-slate-800 my-auto hidden md:block" />

        {/* Leave Call */}
        <button
          onClick={onLeaveCall}
          title="Rời cuộc gọi"
          className="cursor-pointer p-2.5 sm:p-2.5 max-lg:landscape:p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl max-lg:landscape:rounded-lg flex items-center justify-center transition-all shadow-lg shadow-rose-600/30 font-medium"
        >
          <PhoneOff className="w-5 h-5 sm:w-[18px] sm:h-[18px] max-lg:landscape:w-5 max-lg:landscape:h-5" />
        </button>
      </div>
    </div>
  );
};

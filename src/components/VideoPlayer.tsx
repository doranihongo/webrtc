import React, { useEffect, useRef } from 'react';
import { User, MicOff, ScreenShareIcon } from 'lucide-react';

export interface VideoPlayerProps {
  stream: MediaStream | null;
  userName: string;
  isLocal?: boolean;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  className?: string;
  hideNameTag?: boolean;
  compactAvatar?: boolean;
  nameTagPosition?: 'bottom-left' | 'top-left';
  isWaiting?: boolean;
  videoId?: string;
  hideFullscreenButton?: boolean;
  pipCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  forceMute?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
  isPipMode?: boolean;
  showControls?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  stream,
  userName,
  isLocal = false,
  isAudioMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  className = '',
  hideNameTag = false,
  compactAvatar = false,
  nameTagPosition = 'bottom-left',
  isWaiting = false,
  videoId,
  hideFullscreenButton = false,
  pipCorner = 'bottom-right',
  forceMute = false,
  objectFit,
  isPipMode = false,
  showControls = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 2. Video Rendering
  useEffect(() => {
    const videoEl = videoRef.current;
    if (stream) {
      const assignStream = () => {
        if (videoEl && videoEl.srcObject !== stream) {
          videoEl.srcObject = stream;
        }
        if (videoEl) {
          videoEl.muted = isLocal || forceMute;
        }
        videoEl?.play().catch((err) => {
          console.warn('Video auto-play error:', err);
        });
      };
      
      assignStream();

      const handleTrackChanged = () => {
        assignStream();
      };
      
      const handlePause = () => {
        if (videoEl && videoEl.paused && videoEl.srcObject === stream) {
          videoEl.play().catch(e => console.warn('Auto-play recovery failed:', e));
        }
      };

      stream.addEventListener('addtrack', handleTrackChanged);
      stream.addEventListener('removetrack', handleTrackChanged);
      videoEl?.addEventListener('pause', handlePause);
      videoEl?.addEventListener('webkitendfullscreen', handlePause);

      return () => {
        stream.removeEventListener('addtrack', handleTrackChanged);
        stream.removeEventListener('removetrack', handleTrackChanged);
        videoEl?.removeEventListener('pause', handlePause);
        videoEl?.removeEventListener('webkitendfullscreen', handlePause);
      };
    }
  }, [stream, isLocal, forceMute]);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetEl = videoRef.current;
    if (!targetEl) return;
    
    if (targetEl.requestFullscreen) {
      targetEl.requestFullscreen();
    } else if ((targetEl as any).webkitRequestFullscreen) {
      (targetEl as any).webkitRequestFullscreen();
    } else if ((targetEl as any).webkitEnterFullscreen) {
      (targetEl as any).webkitEnterFullscreen();
    }
  };

  const initial = userName ? userName.charAt(0).toUpperCase() : '?';

  if (isWaiting) {
    return (
      <div className={`relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex items-center justify-center group ${className}`}>
        <p className="text-slate-300 font-medium text-sm text-center px-4">Đang đợi người tham gia...</p>
      </div>
    );
  }

  const objectFitClass = objectFit === 'cover' ? 'object-cover' : objectFit === 'fill' ? 'object-fill' : 'object-contain';
  const mediaClassName = `absolute inset-0 w-full h-full pointer-events-none select-none ${objectFitClass} bg-slate-950 ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''} ${
    isVideoOff && !isScreenSharing ? 'opacity-0' : 'opacity-100'
  }`;

  return (
    <div className={`relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex items-center justify-center group ${className}`}>
      {/* Media Element */}
      {stream && (
        <video
          id={videoId ? `${videoId}-video` : undefined}
          ref={videoRef}
          autoPlay
          playsInline
          // @ts-ignore
          webkit-playsinline="true"
          // @ts-ignore
          x5-playsinline="true"
          // @ts-ignore
          x5-video-player-type="h5"
          // @ts-ignore
          x5-video-player-fullscreen="true"
          disablePictureInPicture
          controls={false}
          muted={isLocal || forceMute}
          className={mediaClassName}
        />
      )}

      {/* Video Off Placeholder */}
      {((isVideoOff && !isScreenSharing) || !stream) && (
        isPipMode ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-medium text-slate-300">Camera đang tắt</p>
          </div>
        ) : (hideNameTag || compactAvatar) ? (
          <div className="flex items-center justify-center w-full h-full p-2">
            <div className="p-1.5 sm:p-2 rounded-full border border-slate-700/50 bg-slate-900/60 shadow-inner flex items-center justify-center">
              <div className="w-9 h-9 sm:w-11 sm:h-11 bg-slate-800/90 border border-slate-700/80 rounded-full flex items-center justify-center shadow-md">
                <User className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-slate-300 stroke-[1.75]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-slate-600 rounded-full flex items-center justify-center shadow-lg mb-3">
              <span className="text-3xl sm:text-4xl font-bold text-slate-200">{initial}</span>
            </div>
            <p className="text-sm font-medium text-slate-300">{userName}</p>
            <p className="text-xs text-slate-500 mt-1">Camera đang tắt</p>
          </div>
        )
      )}

      {/* Status Badges Overlay - Top Right */}
      <div className={`absolute flex items-center gap-1 z-10 ${
        isPipMode
          ? 'top-2.5 left-2.5 sm:top-3 sm:left-3'
          : hideNameTag
            ? 'top-1 right-1 sm:top-1.5 sm:right-1.5'
            : 'top-2.5 right-2.5 sm:top-3 sm:right-3 max-lg:landscape:top-1.5 max-lg:landscape:right-1.5'
      }`}>
        {(hideNameTag || isPipMode) && isScreenSharing && (
          <span className="bg-blue-600/90 text-white rounded p-1 backdrop-blur-md shadow-sm">
            <ScreenShareIcon className="w-2.5 h-2.5 text-blue-200" />
          </span>
        )}
        {(hideNameTag || isPipMode) && isAudioMuted && (
          <span
            className="bg-rose-600/90 text-white rounded p-0.5 sm:p-1 backdrop-blur-md shadow-sm"
            title="Đã tắt Micro"
          >
            <MicOff className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </span>
        )}
      </div>

      {/* User Name Tag with Mic & Screen Share Status Icon */}
      {!hideNameTag && !isPipMode && (
        <div className={`absolute ${
          nameTagPosition === 'top-left'
            ? 'top-2.5 left-2.5 sm:top-3 sm:left-3'
            : 'bottom-2.5 left-2.5 sm:bottom-3 sm:left-3'
        } bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-100 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium flex items-center gap-1.5 sm:gap-2 z-10 shadow-md transition-all duration-500 ${showControls === false && !isLocal ? 'max-md:opacity-0 max-md:pointer-events-none max-lg:landscape:opacity-0 max-lg:landscape:pointer-events-none' : 'opacity-100'}`}>
          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 shrink-0" />
          <span className="truncate max-w-[80px] sm:max-w-none">{userName}</span>
          {isLocal && <span className="bg-blue-500/20 text-blue-400 text-[9px] sm:text-[10px] px-1 py-0.2 rounded font-mono shrink-0">(Bạn)</span>}
          
          {isScreenSharing && (
            <div className="flex items-center pl-1 border-l border-slate-700/80 shrink-0" title="Đang chia sẻ màn hình">
              <ScreenShareIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />
            </div>
          )}
          {isAudioMuted && (
            <div className="flex items-center pl-1 border-l border-slate-700/80 shrink-0">
              <span className="flex items-center text-rose-400" title="Micro đang tắt">
                <MicOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
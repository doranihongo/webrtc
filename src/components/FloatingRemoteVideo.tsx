import React, { useState, useRef, useEffect } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { X, MicOff, Mic, VideoOff, Video, PhoneOff, PictureInPicture2 } from 'lucide-react';
import { ScreenShareIcon } from './CustomIcons';

interface FloatingRemoteVideoProps {
  stream: MediaStream | null;
  userName: string;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  onClose: () => void;
  
  localAudioMuted: boolean;
  localVideoOff: boolean;
  localScreenSharing: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeaveCall: () => void;
}

export const FloatingRemoteVideo: React.FC<FloatingRemoteVideoProps> = ({
  stream,
  userName,
  isAudioMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  onClose,
  
  localAudioMuted,
  localVideoOff,
  localScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveCall
}) => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Dimensions
  const [size, setSize] = useState({ width: 240, height: 135 });

  useEffect(() => {
    // Initial position bottom right
    setPosition({
      x: window.innerWidth - size.width - 20,
      y: window.innerHeight - size.height - 20
    });
  }, []);

  const dragRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef<boolean>(false);
  const positionStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    // Ignore drag if clicking on controls or resize handle
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    
    setIsDragging(true);
    hasDraggedRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
    
    if (dragRef.current) {
      try { dragRef.current.setPointerCapture(e.pointerId); } catch {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDraggedRef.current = true;
    let newX = positionStartRef.current.x + dx;
    let newY = positionStartRef.current.y + (e.clientY - pointerStartRef.current.y);
    
    // Bounds check
    const currentWidth = size.width;
    const currentHeight = size.height;
    
    newX = Math.max(0, Math.min(newX, window.innerWidth - currentWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - currentHeight));
    
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragRef.current) {
      try { dragRef.current.releasePointerCapture(e.pointerId); } catch {}
    }
  };
  
  // Resize logic
  type ResizeCorner = 'se' | 'sw' | 'nw';
  const activeResizeRef = useRef<ResizeCorner | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const sizeStartRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, corner: ResizeCorner) => {
    e.stopPropagation();
    setIsResizing(true);
    activeResizeRef.current = corner;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    sizeStartRef.current = { w: size.width, h: size.height };
    positionStartRef.current = { ...position };
    
    if (e.currentTarget) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing || !activeResizeRef.current) return;
    e.stopPropagation();
    
    const dx = e.clientX - pointerStartRef.current.x;
    
    let newW = sizeStartRef.current.w;
    let newX = positionStartRef.current.x;
    let newY = positionStartRef.current.y;

    const MAX_WIDTH = Math.min(400, window.innerWidth - 40);
    const MIN_WIDTH = 160;

    if (activeResizeRef.current === 'se') {
      newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, sizeStartRef.current.w + dx));
    } else if (activeResizeRef.current === 'sw') {
      newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, sizeStartRef.current.w - dx));
      newX = positionStartRef.current.x - (newW - sizeStartRef.current.w);
    } else if (activeResizeRef.current === 'nw') {
      newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, sizeStartRef.current.w - dx));
      newX = positionStartRef.current.x - (newW - sizeStartRef.current.w);
      const newH = newW * (9 / 16);
      newY = positionStartRef.current.y - (newH - sizeStartRef.current.h);
    }

    // Bounds check for newX and newY during resize
    if (newX < 0) {
      newW += newX; // Reduce width by how much it went out
      newX = 0;
    } else if (newX > window.innerWidth - newW) {
       newW = window.innerWidth - newX;
    }

    const newH = newW * (9 / 16);
    
    // Bounds check for newY during resize
    if (newY < 0) {
       newY = 0;
    }

    setSize({ width: newW, height: newH });
    if (activeResizeRef.current !== 'se') {
      setPosition({ x: newX, y: newY });
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    e.stopPropagation();
    setIsResizing(false);
    activeResizeRef.current = null;
    if (e.currentTarget) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  return (
    <div
      ref={dragRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: size.width,
        height: size.height,
      }}
      className="fixed z-[9999] rounded-xl sm:rounded-2xl border border-slate-700/80 hover:border-slate-600 shadow-2xl bg-slate-900 flex flex-col overflow-hidden"
    >
      {/* Top Controls Bar (Visible on Hover) */}
      <div className={`absolute top-0 left-0 right-0 p-2 z-50 flex items-center justify-end ${(isHovered && !isResizing && !isDragging) ? 'opacity-100' : 'opacity-0'} transition-opacity bg-gradient-to-b from-slate-900/80 to-transparent no-drag pointer-events-none`}>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 bg-slate-900/60 hover:bg-rose-600 rounded-lg text-slate-300 hover:text-white backdrop-blur-md cursor-pointer transition-colors"
            title="Đóng PiP"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Video Content */}
      <div className="flex-1 w-full relative cursor-grab active:cursor-grabbing">
        <VideoPlayer
          stream={stream}
          userName={userName}
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          hideNameTag={false}
          isPipMode={true}
          nameTagPosition="top-left"
          className="absolute inset-0 w-full h-full bg-black pointer-events-none rounded-none border-none shadow-none"
          forceMute={true}
          objectFit="contain"
        />
      </div>

      {/* Bottom Control Bar (Visible on Hover) - Local Controls */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center gap-2 bg-slate-900/95 backdrop-blur-md px-2 py-1.5 rounded-xl border border-slate-700/80 ${(isHovered && !isResizing && !isDragging) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} transition-all duration-300 no-drag pointer-events-auto shadow-xl`}>
        <button onClick={onToggleAudio} className={`cursor-pointer p-2 rounded-lg ${localAudioMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`} title={localAudioMuted ? 'Bật Micro' : 'Tắt Micro'}>
          {localAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <button onClick={onToggleVideo} disabled={localScreenSharing} className={`cursor-pointer p-2 rounded-lg ${localScreenSharing ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50' : localVideoOff ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`} title={localVideoOff ? 'Bật Camera' : 'Tắt Camera'}>
          {localVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
        </button>
        <button onClick={onToggleScreenShare} className={`cursor-pointer p-2 rounded-lg ${localScreenSharing ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`} title={localScreenSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}>
          <ScreenShareIcon className="w-4 h-4" />
        </button>
        <button onClick={onLeaveCall} className="cursor-pointer p-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700" title="Rời cuộc gọi">
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>

      {/* Resize Handles */}
      {/* Bottom Right */}
      <div
        onPointerDown={(e) => handleResizePointerDown(e, 'se')}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        className={`absolute bottom-0 right-0 w-8 h-8 cursor-se-resize z-50 no-drag ${isHovered ? 'opacity-100' : 'opacity-0'} transition-opacity flex items-end justify-end p-1`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
          <polyline points="21 15 21 21 15 21" />
          <line x1="21" y1="21" x2="15" y2="15" />
        </svg>
      </div>

      {/* Bottom Left */}
      <div
        onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        className={`absolute bottom-0 left-0 w-8 h-8 cursor-sw-resize z-50 no-drag ${isHovered ? 'opacity-100' : 'opacity-0'} transition-opacity flex items-end justify-start p-1`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
          <polyline points="3 15 3 21 9 21" />
          <line x1="3" y1="21" x2="9" y2="15" />
        </svg>
      </div>

      {/* Top Left */}
      <div
        onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        className={`absolute top-0 left-0 w-8 h-8 cursor-nw-resize z-50 no-drag ${isHovered ? 'opacity-100' : 'opacity-0'} transition-opacity flex items-start justify-start p-1`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
          <polyline points="3 9 3 3 9 3" />
          <line x1="3" y1="3" x2="9" y2="9" />
        </svg>
      </div>
    </div>
  );
};

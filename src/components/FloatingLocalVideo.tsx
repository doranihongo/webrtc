import React, { useState, useRef, useEffect } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { EyeOff, Eye } from 'lucide-react';

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface FloatingLocalVideoProps {
  stream: MediaStream | null;
  userName: string;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  isRemoteScreenSharing?: boolean;
  isPipActive?: boolean;
  onCornerChange?: (corner: Corner) => void;
}

export const FloatingLocalVideo: React.FC<FloatingLocalVideoProps> = ({
  stream,
  userName,
  isAudioMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  isRemoteScreenSharing = false,
  isPipActive = false,
  onCornerChange,
}) => {
  const [corner, setCorner] = useState<Corner>(typeof window !== 'undefined' && window.innerWidth < 1024 ? 'top-right' : 'bottom-right');
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Automatically hide local video when remote starts screen sharing, and show it when it stops
  useEffect(() => {
    if (isRemoteScreenSharing) {
      setIsHidden(true);
    } else {
      setIsHidden(false);
    }
  }, [isRemoteScreenSharing]);
  const [isFadedOut, setIsFadedOut] = useState(false);

  const dragRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetFade = () => {
    setIsFadedOut(false);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      setIsFadedOut(true);
    }, 5000);
  };

  useEffect(() => {
    resetFade();
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [isHidden]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    resetFade();
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    setIsDragging(true);
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: 0, y: 0 });

    if (dragRef.current) {
      try {
        dragRef.current.setPointerCapture(e.pointerId);
      } catch {
        // fallback if setPointerCapture fails
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragRef.current) {
      try {
        dragRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      const boxRect = dragRef.current.getBoundingClientRect();
      const parentEl = dragRef.current.offsetParent as HTMLElement;

      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        
        const boxCenterX = boxRect.left + boxRect.width / 2;
        const boxCenterY = boxRect.top + boxRect.height / 2;

        const isLeft = boxCenterX < parentRect.left + parentRect.width / 2;
        const isTop = boxCenterY < parentRect.top + parentRect.height / 2;

        let newCorner: Corner = 'bottom-right';
        if (isTop && isLeft) newCorner = 'top-left';
        else if (isTop && !isLeft) newCorner = 'top-right';
        else if (!isTop && isLeft) newCorner = 'bottom-left';
        else newCorner = 'bottom-right';

        // Check if dragged mostly out of bounds to hide
        const isOutOfBoundsX = boxRect.left > parentRect.right - boxRect.width * (2/3) || boxRect.right < parentRect.left + boxRect.width * (2/3);
        const isOutOfBoundsY = boxRect.top > parentRect.bottom - boxRect.height * (2/3) || boxRect.bottom < parentRect.top + boxRect.height * (2/3);

        if (isOutOfBoundsX || isOutOfBoundsY) {
          setCorner(newCorner);
          onCornerChange?.(newCorner);
          setIsHidden(true);
          setDragOffset({ x: 0, y: 0 });
          return;
        }

        setCorner(newCorner);
        onCornerChange?.(newCorner);
      }
    }

    setDragOffset({ x: 0, y: 0 });
  };

  const cornerClasses = {
    'top-left': 'top-2.5 left-2.5 sm:top-3 sm:left-3',
    'top-right': 'top-2.5 right-2.5 sm:top-3 sm:right-3',
    'bottom-left': 'bottom-2.5 left-2.5 sm:bottom-3 sm:left-3',
    'bottom-right': 'bottom-2.5 right-2.5 sm:bottom-3 sm:right-3',
  }[corner];

 if (isScreenSharing || isPipActive) return null;

  if (isHidden) {
    return (
      <button
        onClick={() => setIsHidden(false)}
        onPointerEnter={resetFade}
        onPointerMove={resetFade}
        onPointerDown={resetFade}
        className={`absolute ${cornerClasses} z-30 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-4 py-2 sm:px-6 sm:py-2.5 rounded-lg sm:rounded-xl flex items-center justify-center shadow-xl text-slate-100 transition-all duration-300 cursor-pointer ${
          isFadedOut ? 'opacity-30 hover:opacity-100' : 'opacity-100'
        }`}
        title="Hiện camera"
      >
        <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 shrink-0" />
      </button>
    );
  }

  return (
    <div
      ref={dragRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
        transition: isDragging
          ? 'none'
          : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.3s, left 0.3s, right 0.3s, bottom 0.3s',
      }}
      className={`absolute ${cornerClasses} z-30 cursor-grab active:cursor-grabbing select-none touch-none group flex justify-center`}
      onPointerEnter={resetFade}
      onPointerMove={(e) => {
        handlePointerMove(e);
        resetFade();
      }}
    >
      <div className="w-36 sm:w-44 md:w-56 aspect-video rounded-xl sm:rounded-2xl overflow-hidden border-2 border-slate-700/90 hover:border-blue-500/90 shadow-2xl bg-slate-900 relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsHidden(true);
          }}
          onPointerEnter={resetFade}
          onPointerMove={resetFade}
          className={`absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-40 bg-slate-950/80 backdrop-blur-md hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white rounded-lg sm:rounded-xl cursor-pointer shadow-md flex items-center justify-center p-1.5 sm:p-2 transition-all duration-300 ${
            isFadedOut ? 'opacity-30 hover:opacity-100' : 'opacity-100'
          }`}
          title="Ẩn camera"
          onPointerDown={(e) => {
            e.stopPropagation();
            resetFade();
          }} // Prevent drag start when clicking button
        >
          <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-slate-200" />
        </button>

        <VideoPlayer
          stream={stream}
          userName={userName}
          isLocal
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          hideNameTag
          className="w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
};

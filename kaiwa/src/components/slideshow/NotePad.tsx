import { useState, useRef, useEffect, useCallback } from 'react';

interface NotePadProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  setText: (text: string) => void;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'sw' | 'se' | 'ne';

/**
 * Ghi chú nháp - cửa sổ nổi, kéo-thả/resize được, đè lên trên slide đang
 * trình chiếu (xem SlideShow.tsx). Tham khảo/port lại nguyên logic (kéo-
 * thả/resize + undo/redo Ctrl+Z/Ctrl+Y) từ dora-nihongo
 * (C:\Users\Admin\Desktop\dora-nihongo, src/components/common/GlobalNotePad.jsx)
 * sang TSX cho kaiwa - CHỈ đổi z-index (320/330 thay vì 9999/10000 của bản
 * gốc) để nằm đúng trên slide (z-[300]).
 *
 * `text`/`setText` do component cha (SlideShow.tsx) giữ state - ghi chú
 * chỉ tồn tại trong phiên trình chiếu hiện tại, mất khi đóng "Slide"
 * (không lưu localStorage/Supabase) - đơn giản, đúng nhu cầu ghi chú nháp
 * lúc dạy, không phải sổ ghi chép lâu dài.
 */
export function NotePad({ isOpen, onClose, text, setText }: NotePadProps) {
  // Tính vị trí giữa màn hình CHỈ 1 LẦN lúc khởi tạo (component mount, vd
  // lần đầu vào buổi học) - sau đó rect/isMaximized CHỈ đổi qua thao tác
  // thật của người dùng (kéo/resize/phóng to), KHÔNG tự "recenter" hay
  // reset mỗi khi đóng/mở lại (X rồi mở lại) nữa - đóng ở đâu, kích cỡ/vị
  // trí/trạng thái phóng to nào thì mở lại giữ ĐÚNG y hệt vậy.
  const [rect, setRect] = useState(() => ({
    x: Math.max(0, (window.innerWidth - 600) / 2),
    y: Math.max(0, (window.innerHeight - 400) / 2),
    w: 600,
    h: 400,
  }));
  const [fontSize, setFontSize] = useState(30);
  const MIN_FONT = 20;
  const MAX_FONT = 60;

  const MIN_W = 350;
  const MIN_H = 300;

  const [isMaximized, setIsMaximized] = useState(false);
  const preMaxRectRef = useRef<typeof rect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeDir | null>(null);
  const dragRef = useRef<any>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sessionKey, setSessionKey] = useState(0);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      historyRef.current = [text];
      historyIndexRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && historyIndexRef.current >= 0) {
      const currentSaved = historyRef.current[historyIndexRef.current];
      if (text !== currentSaved) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          const h = historyRef.current;
          const idx = historyIndexRef.current;
          if (h[idx] !== text) {
            const newHistory = h.slice(0, idx + 1);
            newHistory.push(text);
            historyRef.current = newHistory;
            historyIndexRef.current = newHistory.length - 1;
          }
        }, 400);
      }
    }
  }, [text, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();

      if (historyIndexRef.current > 0) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        const newIndex = historyIndexRef.current - 1;
        historyIndexRef.current = newIndex;
        setText(historyRef.current[newIndex]);
      }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();

      if (historyIndexRef.current < historyRef.current.length - 1) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        const newIndex = historyIndexRef.current + 1;
        historyIndexRef.current = newIndex;
        setText(historyRef.current[newIndex]);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSessionKey((prev) => prev + 1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.scrollTop = ta.scrollHeight;
      }, 50);
    }
  }, [isOpen]);

  // (Đã bỏ effect tự "recenter"/reset rect+isMaximized mỗi khi isOpen đổi -
  // mở lại giữ NGUYÊN kích cỡ/vị trí/trạng thái phóng to y hệt lúc đóng,
  // xem comment ở chỗ khởi tạo rect phía trên.)

  useEffect(() => {
    const checkBoundary = () => {
      if (isMaximized) {
        setRect({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
        return;
      }
      setRect((prev) => {
        const adjY = Math.max(0, Math.min(prev.y, window.innerHeight - 40));
        const adjX = Math.max(0, Math.min(prev.x, window.innerWidth - prev.w));
        return adjX !== prev.x || adjY !== prev.y ? { ...prev, x: adjX, y: adjY } : prev;
      });
    };
    window.addEventListener('resize', checkBoundary);
    return () => window.removeEventListener('resize', checkBoundary);
  }, [isMaximized]);

  useEffect(() => {
    if (!isOpen || !isMaximized) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isMaximized]);

  const toggleMaximize = (e?: any) => {
    if (e) e.stopPropagation();
    if (isMaximized) {
      setIsMaximized(false);
      if (preMaxRectRef.current) setRect(preMaxRectRef.current);
    } else {
      preMaxRectRef.current = { ...rect };
      setIsMaximized(true);
      setRect({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
    }
  };

  const handleDragStart = (e: any) => {
    if (isMaximized || e.target.closest('.no-drag')) return;
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX, startY: clientY, initX: rect.x, initY: rect.y, currX: rect.x, currY: rect.y, currW: rect.w, currH: rect.h };
  };

  const handleResizeStart = (e: any, dir: ResizeDir) => {
    if (isMaximized) return;
    e.stopPropagation();
    setIsResizing(dir);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX, startY: clientY, initX: rect.x, initY: rect.y, initW: rect.w, initH: rect.h, currX: rect.x, currY: rect.y, currW: rect.w, currH: rect.h };
  };

  const handlePointerMove = useCallback(
    (e: any) => {
      if (!isDragging && !isResizing) return;
      if (e.cancelable && e.type !== 'mousemove') e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;

      if (isDragging) {
        const nX = Math.max(0, Math.min(dragRef.current.initX + dx, window.innerWidth - dragRef.current.currW));
        const nY = Math.max(0, Math.min(dragRef.current.initY + dy, window.innerHeight - 40));
        if (noteRef.current) {
          noteRef.current.style.left = `${nX}px`;
          noteRef.current.style.top = `${nY}px`;
        }
        dragRef.current.currX = nX;
        dragRef.current.currY = nY;
      } else if (isResizing) {
        const { initX, initY, initW, initH } = dragRef.current;
        let nX = initX,
          nY = initY,
          nW = initW,
          nH = initH;
        if (isResizing.includes('e')) nW = Math.max(MIN_W, initW + dx);
        if (isResizing.includes('s')) nH = Math.max(MIN_H, initH + dy);
        if (isResizing.includes('w')) {
          const cDx = Math.min(dx, initW - MIN_W);
          nW = initW - cDx;
          nX = initX + cDx;
        }
        if (isResizing.includes('n')) {
          const cDy = Math.min(dy, initH - MIN_H);
          if (initY + cDy >= 0) {
            nH = initH - cDy;
            nY = initY + cDy;
          }
        }
        if (nX < 0) {
          nW += nX;
          nX = 0;
        }
        const maxW = window.innerWidth - nX;
        if (nW > maxW) nW = maxW;
        if (noteRef.current) {
          noteRef.current.style.left = `${nX}px`;
          noteRef.current.style.top = `${nY}px`;
          noteRef.current.style.width = `${nW}px`;
          noteRef.current.style.height = `${nH}px`;
        }
        dragRef.current.currX = nX;
        dragRef.current.currY = nY;
        dragRef.current.currW = nW;
        dragRef.current.currH = nH;
      }
    },
    [isDragging, isResizing],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
    if (dragRef.current) setRect({ x: dragRef.current.currX, y: dragRef.current.currY, w: dragRef.current.currW, h: dragRef.current.currH });
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handlePointerMove, { passive: false });
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
    }
    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, isResizing, handlePointerMove, handlePointerUp]);

  const lineHeight = Math.round(fontSize * 1.8);

  return (
    <>
      {(isDragging || isResizing) && (
        <div className="fixed inset-0 z-[330]" style={{ cursor: isResizing ? `${isResizing}-resize` : 'move' }} />
      )}
      <div
        ref={noteRef}
        className={`fixed z-[320] bg-[#fdfcf8] shadow-2xl border border-zinc-300 flex flex-col overflow-hidden transition-opacity duration-200
                ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                ${isMaximized ? 'rounded-none border-0' : 'rounded-xl'}`}
        style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }}
      >
        {!isMaximized && (
          <>
            <div className="absolute top-0 left-4 right-10 h-2 cursor-n-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'n')} />
            <div className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize z-50" onMouseDown={(e) => handleResizeStart(e, 's')} />
            <div className="absolute top-4 bottom-4 left-0 w-2 cursor-w-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'w')} />
            <div className="absolute top-10 bottom-4 right-0 w-2 cursor-e-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'e')} />
            <div className="absolute top-0 left-0 w-5 h-5 cursor-nw-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
            <div className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
            <div className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-50" onMouseDown={(e) => handleResizeStart(e, 'se')} />
          </>
        )}
        <div
          className="h-10 bg-[#f4f4f5] border-b border-zinc-200 flex items-center justify-between px-3 shrink-0 select-none relative z-40"
          style={{ cursor: isMaximized ? 'default' : 'move' }}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pointer-events-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span className="text-xs font-black text-zinc-600 uppercase tracking-widest hidden sm:inline-block">Ghi chú</span>
            </div>
            <div className="w-px h-4 bg-zinc-300"></div>
            <div className="flex items-center bg-zinc-200/50 rounded-lg p-0.5 no-drag" onDoubleClick={(e) => e.stopPropagation()}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 2))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-zinc-600 font-black text-xs transition-colors">
                -
              </button>
              <span className="px-1 text-[10px] font-bold text-zinc-500 w-5 text-center">A</span>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 2))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-zinc-600 font-black text-xs transition-colors">
                +
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 no-drag" onDoubleClick={(e) => e.stopPropagation()}>
            <button onMouseDown={(e) => e.preventDefault()} onClick={toggleMaximize} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-200 text-zinc-500 transition-all active:scale-90">
              {isMaximized ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              )}
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500 hover:text-white text-zinc-500 transition-all active:scale-90 outline-none focus:outline-none">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 relative bg-[#fdfcf8] overflow-hidden flex z-30">
          <div className="absolute top-0 bottom-0 left-10 w-px bg-red-300/60 pointer-events-none z-10"></div>
          <textarea
            ref={textareaRef}
            key={`notepad-session-${sessionKey}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Viết ghi chú..."
            className="flex-1 w-full h-full p-4 pl-14 bg-transparent outline-none resize-none text-zinc-800 font-medium custom-scrollbar z-20"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}px`,
              backgroundImage: `repeating-linear-gradient(transparent, transparent ${lineHeight - 1}px, #93c5fd40 ${lineHeight - 1}px, #93c5fd40 ${lineHeight}px)`,
              backgroundAttachment: 'local',
              paddingTop: `${lineHeight}px`,
            }}
          />
        </div>
      </div>
    </>
  );
}

export default NotePad;

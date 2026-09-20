import { useState, useRef, useEffect, useCallback } from 'react';

interface BlackboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'sw' | 'se' | 'ne';

/**
 * Bảng đen vẽ tay - cửa sổ nổi, kéo-thả/resize được, đè lên trên slide
 * đang trình chiếu (xem SlideShow.tsx). Tham khảo/port lại nguyên logic vẽ
 * + kéo-thả/resize từ dora-nihongo (C:\Users\Admin\Desktop\dora-nihongo,
 * src/components/common/GlobalBlackboard.jsx) sang TSX cho kaiwa - CHỈ đổi
 * z-index (320/330 thay vì 9999/10000 của bản gốc) để nằm ĐÚNG TRÊN slide
 * (z-[300]) nhưng dưới NotePad khi cả 2 cùng mở không quan trọng thứ tự.
 */
export function Blackboard({ isOpen, onClose }: BlackboardProps) {
  // Tính vị trí giữa màn hình CHỈ 1 LẦN lúc khởi tạo (component mount, vd
  // lần đầu vào buổi học) - sau đó rect/isMaximized CHỈ đổi qua thao tác
  // thật của người dùng (kéo/resize/phóng to), KHÔNG tự "recenter" hay
  // reset mỗi khi đóng/mở lại (X rồi mở lại) nữa - đóng ở đâu, kích cỡ/vị
  // trí/trạng thái phóng to nào thì mở lại giữ ĐÚNG y hệt vậy.
  const [rect, setRect] = useState(() => ({
    x: Math.max(0, (window.innerWidth - 820) / 2),
    y: Math.max(0, (window.innerHeight - 520) / 2),
    w: 820,
    h: 520,
  }));
  const MIN_W = 450;
  const MIN_H = 300;

  const [isMaximized, setIsMaximized] = useState(false);
  const preMaxRectRef = useRef<typeof rect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeDir | null>(null);
  const dragRef = useRef<any>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastMidRef = useRef({ x: 0, y: 0 });

  const [drawingTool, setDrawingTool] = useState<'pen' | 'eraser'>('pen');
  const [brushSize, setBrushSize] = useState(6);
  const eraserSize = 60;

  const [showBrushSlider, setShowBrushSlider] = useState(false);
  const brushWrapperRef = useRef<HTMLDivElement>(null);

  // Đóng bảng -> chỉ dọn trạng thái công cụ vẽ đang thao tác dở (tool/thanh
  // trượt cỡ bút), KHÔNG đụng vào rect/isMaximized nữa - mở lại giữ NGUYÊN
  // kích cỡ/vị trí/trạng thái phóng to y hệt lúc đóng (xem comment ở chỗ
  // khởi tạo rect phía trên).
  useEffect(() => {
    if (!isOpen) {
      setDrawingTool('pen');
      setShowBrushSlider(false);
    }
  }, [isOpen]);

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

  useEffect(() => {
    const handleGlobalClick = (e: Event) => {
      if (brushWrapperRef.current && !brushWrapperRef.current.contains(e.target as Node)) setShowBrushSlider(false);
    };
    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    const wrapper = containerRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas || !isOpen) return;

    const resizeObserver = new ResizeObserver(() => {
      const width = wrapper.offsetWidth;
      const height = wrapper.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      const newWidth = Math.round(width * dpr);
      const newHeight = Math.round(height * dpr);

      if (canvas.width === newWidth && canvas.height === newHeight) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      let oldDataUrl: string | null = null;

      if (canvas.width > 0 && canvas.height > 0) {
        oldDataUrl = canvas.toDataURL();
      }

      canvas.width = newWidth;
      canvas.height = newHeight;

      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (oldDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        };
        img.src = oldDataUrl;
      }
    });

    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  // ================== LOGIC VẼ (BEZIER SMOOTH) ==================
  const getCoordinates = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: any) => {
    isDrawingRef.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getCoordinates(e);

    lastPosRef.current = { x, y };
    lastMidRef.current = { x, y };

    ctx.lineWidth = drawingTool === 'eraser' ? eraserSize : brushSize;
    ctx.globalCompositeOperation = drawingTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (drawingTool === 'pen') {
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = (e: any) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getCoordinates(e);

    ctx.lineWidth = drawingTool === 'eraser' ? eraserSize : brushSize;
    ctx.globalCompositeOperation = drawingTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#ffffff';

    const midX = (lastPosRef.current.x + x) / 2;
    const midY = (lastPosRef.current.y + y) / 2;

    ctx.beginPath();
    ctx.moveTo(lastMidRef.current.x, lastMidRef.current.y);
    ctx.quadraticCurveTo(lastPosRef.current.x, lastPosRef.current.y, midX, midY);
    ctx.stroke();

    lastPosRef.current = { x, y };
    lastMidRef.current = { x: midX, y: midY };
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCustomCursor = () => {
    if (drawingTool === 'pen') {
      const svgPen = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="black"/><circle cx="17" cy="7" r="2" fill="white" stroke="none"/></svg>`;
      return `url('data:image/svg+xml;utf8,${encodeURIComponent(svgPen)}') 4 28, crosshair`;
    } else {
      const s = eraserSize;
      const svgEraser = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect x="2" y="2" width="${s - 4}" height="${s - 4}" rx="4" fill="black" stroke="white" stroke-width="2" fill-opacity="0.6"/><path d="M${s / 2} 10v${s - 20}" stroke="white" stroke-width="1"/></svg>`;
      return `url('data:image/svg+xml;utf8,${encodeURIComponent(svgEraser)}') ${s / 2} ${s / 2}, crosshair`;
    }
  };

  // ================== LOGIC DRAG & RESIZE BẢNG ==================
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
        if (boardRef.current) {
          boardRef.current.style.left = `${nX}px`;
          boardRef.current.style.top = `${nY}px`;
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
        if (boardRef.current) {
          boardRef.current.style.left = `${nX}px`;
          boardRef.current.style.top = `${nY}px`;
          boardRef.current.style.width = `${nW}px`;
          boardRef.current.style.height = `${nH}px`;
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

  return (
    <>
      {(isDragging || isResizing) && (
        <div className="fixed inset-0 z-[330]" style={{ cursor: isResizing ? `${isResizing}-resize` : 'move' }} />
      )}
      <div
        ref={boardRef}
        className={`fixed z-[320] bg-[#121212] shadow-2xl border border-zinc-700 flex flex-col overflow-hidden transition-opacity duration-200
                ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                ${isMaximized ? 'rounded-none border-0' : 'rounded-2xl'}`}
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

        {/* HEADER BẢNG ĐEN */}
        <div
          className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 select-none relative z-40"
          style={{ cursor: isMaximized ? 'default' : 'move' }}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pointer-events-none text-zinc-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest hidden sm:inline-block">Bảng đen</span>
            </div>
            <div className="w-px h-5 bg-zinc-700 mx-1"></div>

            {/* TOOLBAR */}
            <div className="flex items-center bg-zinc-800 rounded-lg p-1 no-drag gap-1.5" onDoubleClick={(e) => e.stopPropagation()}>
              {/* KHỐI BÚT */}
              <div className="relative flex items-center" ref={brushWrapperRef}>
                <button
                  onClick={() => {
                    setDrawingTool('pen');
                    setShowBrushSlider(!showBrushSlider);
                  }}
                  className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors ${drawingTool === 'pen' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                  title="Bút vẽ"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setDrawingTool('pen');
                    setShowBrushSlider(!showBrushSlider);
                  }}
                  className="px-1.5 text-[11px] font-bold text-zinc-400 hover:text-white w-7 text-center shrink-0"
                  title="Chỉnh cỡ bút"
                >
                  {brushSize}
                </button>
                {showBrushSlider && (
                  <div className="absolute top-full left-0 mt-2 bg-zinc-800 border border-zinc-700 p-3 rounded-xl shadow-xl flex items-center gap-2 z-50 w-48">
                    <span className="text-zinc-400 text-[10px] font-bold whitespace-nowrap w-12 shrink-0">BÚT: {brushSize}</span>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-white"
                    />
                  </div>
                )}
              </div>

              <div className="w-px h-5 bg-zinc-600 mx-0.5"></div>

              {/* KHỐI TẨY */}
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setDrawingTool('eraser');
                    setShowBrushSlider(false);
                  }}
                  className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors ${drawingTool === 'eraser' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                  title="Tẩy"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                    <path d="M22 21H7" />
                    <path d="m5 11 9 9" />
                  </svg>
                </button>
              </div>

              <div className="w-px h-5 bg-zinc-600 mx-0.5"></div>

              {/* Nút Xóa hết */}
              <button onClick={clearCanvas} className="w-9 h-9 flex items-center justify-center rounded-md text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Xóa bảng">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 no-drag" onDoubleClick={(e) => e.stopPropagation()}>
            <button onClick={toggleMaximize} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all active:scale-90">
              {isMaximized ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              )}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500 text-zinc-400 hover:text-white transition-all active:scale-90 outline-none focus:outline-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* KHUNG VẼ */}
        <div ref={containerRef} className="flex-1 relative bg-[#121212] overflow-hidden flex z-30 touch-none">
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full z-20 touch-none"
            style={{ cursor: getCustomCursor(), mixBlendMode: 'normal' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>
    </>
  );
}

export default Blackboard;

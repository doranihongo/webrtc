import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Presentation, NotebookText, PenLine, Eraser, Trash2, X, Maximize2, Minimize2 } from 'lucide-react';
import CallControls from './CallControls';

interface SlideShowProps {
  /** Danh sách URL ảnh slide, đúng thứ tự trang (dò ra từ Lesson.slideFolder - xem types.ts). */
  images: string[];
  title?: string;
  onClose: () => void;
  /** Bảng đen/Ghi chú - state do LessonView.tsx giữ (KHÔNG giữ ở đây) để
   * nội dung không mất khi đóng/mở lại Slide, chỉ mất khi sang buổi học
   * khác - xem comment ở LessonView.tsx chỗ khai báo các state này. */
  isBoardOpen: boolean;
  onToggleBoard: () => void;
  isNoteOpen: boolean;
  onToggleNote: () => void;
  /** Đang nhúng trong 1 cuộc gọi (xem hook useCallEmbed, LessonView.tsx) -
   * hiện thêm cụm nút PiP/Quay lại phòng học (CallControls.tsx, dùng
   * CHUNG component với Home.tsx/LessonView.tsx, không tự vẽ lại) ở ngoài
   * cùng bên phải, y hệt giao diện các trang khác. */
  showCallControls: boolean;
  isPipActive: boolean;
}

const BRUSH_SIZE = 4;
const ERASER_SIZE = 60;
const INK_COLOR = '#ef4444';

/**
 * Con trỏ "laser pointer" - 1 CHẤM ĐỎ TRONG SUỐT đơn giản (bỏ hẳn phần tỏa
 * sáng/glow - dễ bị trình duyệt render sai ra viền tối/đen khi hợp thành
 * cursor, đã gặp thực tế), hiện khi di chuột trên vùng slide (không phải
 * thanh công cụ) lúc KHÔNG bật bút vẽ, để học viên dễ thấy giáo viên đang
 * chỉ vào đâu. Cursor CSS TĨNH (ảnh SVG, không phải 1 <div> theo dõi bằng
 * JS) - trình duyệt tự vẽ, không tốn hiệu năng/không có khái niệm "lag" ở
 * đây. Tính 1 LẦN DUY NHẤT ở module-level (không phụ thuộc state nào) vì
 * cursor này không bao giờ đổi.
 */
const GLOW_CURSOR = (() => {
  // Đỏ tươi (rực hơn hẳn INK_COLOR #ef4444 dùng để vẽ - riêng cursor này
  // cố tình sáng/tươi hơn để dễ nhìn), to hơn (r=10, tổng 26px).
  const BRIGHT_RED = '#ff1a1a';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" fill="${BRIGHT_RED}" fill-opacity="0.9"/></svg>`;
  return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 13 13, auto`;
})();

/**
 * Trình chiếu slide dạng ẢNH cho giáo viên (không phải PDF): mỗi trang là
 * 1 ảnh, bấm Next/Prev (hoặc phím mũi tên) để chuyển - đổi `src` trực tiếp,
 * KHÔNG hiệu ứng fade/transition, giống tinh thần PdfSlideShow.tsx nhưng
 * đơn giản hơn nhiều (không PDF.js/canvas) vì nguồn đã là ảnh sẵn.
 *
 * Bút vẽ đè lên slide: canvas trong suốt phủ TOÀN KHUNG hiển thị (cả vùng
 * đệm quanh ảnh nếu ảnh không lấp hết khung, không riêng gì phần ảnh) - vẽ
 * tay mượt (quadratic curve) y hệt kỹ thuật "vẽ tay" trong bài tập ngữ
 * pháp của dora-nihongo (DoraGrammarDetailView.jsx) - TRỪ mixBlendMode 'multiply':
 * bản gốc dùng multiply vì luôn vẽ trên thẻ NỀN TRẮNG (multiply với trắng
 * giữ nguyên màu mực), còn slide ở đây là ảnh màu bất kỳ - dùng multiply
 * sẽ làm mực bị ám màu theo đúng màu pixel bên dưới (không còn đỏ thuần).
 * Vì vậy cố tình bỏ multiply, mực luôn là đỏ thuần bất kể nền.
 *
 * Coi MỖI SLIDE là 1 trang riêng: nét vẽ lưu theo index trang
 * (slideDrawingsRef, dataURL trong bộ nhớ, KHÔNG lưu ổ đĩa/DB) - next/prev
 * sang trang khác thì hiện đúng canvas rỗng/đã vẽ của trang đó, không lẫn
 * nét vẽ giữa các trang. Canvas dùng ĐÚNG kỹ thuật crossfade 2 lớp A/B như
 * ảnh (activeSlot) - nét vẽ mờ/rõ dần LỒNG vào nhau cùng lúc với ảnh, không
 * đổi tức thì nữa - xem cụm state/effect "Crossfade" bên dưới, canvas A/B
 * dùng CHUNG activeSlot/slotAIndex/slotBIndex với ảnh để luôn khớp trang.
 */
export default function SlideShow({ images, title, onClose, isBoardOpen, onToggleBoard, isNoteOpen, onToggleNote, showCallControls, isPipActive }: SlideShowProps) {
  const [index, setIndex] = useState(0);
  const total = images.length;

  // --- Toàn màn hình ---
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement as any;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }, []);

  const exitFullscreen = useCallback(() => {
    const doc = document as any;
    if (!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement)) return;
    if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    else if (doc.msExitFullscreen) doc.msExitFullscreen();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // KHÔNG tự bật toàn màn hình khi mở "Slide" nữa (bỏ theo yêu cầu) - chỉ
  // bật/tắt thủ công qua nút toggleFullscreen. Vẫn nghe fullscreenchange để
  // icon nút đồng bộ đúng trạng thái (kể cả khi người dùng tự thoát bằng
  // Esc/F11 của trình duyệt), và vẫn tự tắt lúc đóng Slide (unmount) như
  // 1 lớp dọn dẹp an toàn - không để fullscreen "rớt" lại nếu người dùng
  // đã tự bật tay rồi thoát Slide mà quên tắt.
  useEffect(() => {
    const handleChange = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('msfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('msfullscreenchange', handleChange);
      exitFullscreen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Popup xác nhận thoát trình chiếu (nền bị khóa/mờ đi phía sau) ---
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const requestClose = useCallback(() => setShowExitConfirm(true), []);

  // --- Hiệu ứng CROSSFADE (mờ/rõ LỒNG vào nhau) khi chuyển trang ---
  // 2 lớp (ảnh VÀ canvas nét vẽ, xem bên dưới) A/B chồng lên nhau cùng 1 ô
  // lưới - trang mới nạp vào lớp ĐANG ẨN (opacity 0) trước, đợi đúng 2
  // khung hình (double rAF, để trình duyệt chắc chắn đã "chốt" sơn opacity
  // 0 đó) rồi lật `activeSlot` cùng lúc: lớp mới 0->1 VÀ lớp cũ 1->0 chạy
  // simultan (cùng transition, cùng thời điểm) = crossfade thật, không
  // phải đợi lớp cũ tắt hẳn mới đến lớp mới. Ảnh VÀ canvas nét vẽ dùng
  // CHUNG activeSlot/slotAIndex/slotBIndex này để luôn khớp đúng trang.
  const FADE_MS = 150;
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [slotAIndex, setSlotAIndex] = useState(0);
  const [slotBIndex, setSlotBIndex] = useState(0);
  const transitioningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, []);

  // --- Bút vẽ đè lên slide (2 canvas A/B, crossfade y hệt ảnh) ---
  const [isPenMode, setIsPenMode] = useState(false);
  const [penTool, setPenTool] = useState<'pen' | 'eraser'>('pen');
  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  /** Canvas đang HIỆN (đúng trang đang xem) - nơi thao tác vẽ thật sự diễn ra. */
  const getActiveCanvas = () => (activeSlot === 'A' ? canvasARef.current : canvasBRef.current);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastMidRef = useRef({ x: 0, y: 0 });
  // Cache getBoundingClientRect() 1 LẦN lúc bắt đầu nét (startDrawing),
  // dùng lại suốt nét đó thay vì gọi lại mỗi lần di chuột (mousemove) -
  // gọi getBoundingClientRect() liên tục ép trình duyệt tính lại layout
  // (reflow) mỗi lần, gây lag/trễ rõ rệt giữa tay di chuyển và nét vẽ hiện
  // ra, nhất là canvas to (phủ cả khung slide, khác Blackboard.tsx nhỏ
  // hơn nhiều). Đúng kỹ thuật cache này bản gốc DoraGrammarDetailView.jsx
  // (dora-nihongo) đã dùng - lúc port sang đây bị bỏ sót.
  const canvasRectRef = useRef<DOMRect | null>(null);
  // index -> dataURL nét vẽ của đúng trang đó - sống trong bộ nhớ (useRef,
  // không phải state, không cần re-render khi cập nhật), mất hết khi đóng
  // Slide (unmount SlideShow) - phạm vi "nháp lúc trình chiếu", không lưu
  // lâu dài như yêu cầu ban đầu chỉ nói tới next/prev giữa các trang.
  const slideDrawingsRef = useRef<Map<number, string>>(new Map());

  const goTo = useCallback(
    (n: number) => {
      // Chỉ chặn đúng lúc đang THỰC SỰ kéo chuột vẽ dở 1 nét (isDrawingRef -
      // giữa mousedown/touchstart và mouseup/touchend), KHÔNG chặn cả lúc
      // bật bút vẽ nhưng không thao tác gì (bật bút vẫn next/prev bình
      // thường, không cần bấm X thoát vẽ trước - mỗi trang tự lưu nét vẽ
      // riêng nên đổi trang không mất gì). Chặn ở đây (nguồn duy nhất mọi
      // cách chuyển trang đi qua: bàn phím, nút Prev/Next) thay vì rải rác.
      if (isDrawingRef.current) return;
      if (n < 0 || n >= total) return;
      if (transitioningRef.current) return; // đang crossfade dở - bỏ qua bấm dồn dập
      transitioningRef.current = true;

      const nextSlot: 'A' | 'B' = activeSlot === 'A' ? 'B' : 'A';
      if (nextSlot === 'A') setSlotAIndex(n);
      else setSlotBIndex(n);

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setActiveSlot(nextSlot);
          setIndex(n);
          rafRef.current = null;
        });
      });

      settleTimeoutRef.current = setTimeout(() => {
        transitioningRef.current = false;
        settleTimeoutRef.current = null;
      }, FADE_MS + 40);
    },
    [total, activeSlot],
  );

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  // Mở Slide -> tải TRƯỚC TOÀN BỘ ảnh của buổi học ngay 1 lần (không chỉ
  // trang liền kề) vào bộ nhớ cache ảnh của trình duyệt - chuyển trang sau
  // đó (Next/Prev) hiện tức thì, không load/lag giữa chừng. Chỉ chạy 1 lần
  // lúc mở (không phụ thuộc `images`/`index` - cố tình, tránh tải lại mỗi
  // khi đổi trang); cache này sống trong bộ nhớ trình duyệt, tự mất khi
  // đóng tab, không lưu ổ đĩa/DB.
  useEffect(() => {
    images.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Set canvas.width/height (độ phân giải thật, theo kích thước CSS ĐÃ RENDER
   * lúc gọi hàm × dpr) rồi nạp lại nét vẽ đã lưu của `pageIndex` (nếu có) -
   * dùng cho cả lúc chuẩn bị 1 trang MỚI vào slot (xem 2 effect ngay dưới)
   * lẫn lúc cửa sổ đổi cỡ (xem effect resize quan sát riêng từng canvas).
   */
  const loadCanvasForPage = (canvas: HTMLCanvasElement | null, pageIndex: number) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return; // chưa layout xong (vd đang ẩn) - bỏ qua, effect resize sẽ tự lo khi có kích thước thật
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const saved = slideDrawingsRef.current.get(pageIndex);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      };
      img.src = saved;
    }
  };

  // Slot A/B đổi sang trang khác (goTo() đã set slotAIndex/slotBIndex ở
  // trên) -> nạp lại canvas đúng kích thước + đúng nét vẽ đã lưu của trang
  // đó NGAY (useLayoutEffect - chạy trước khi trình duyệt sơn hình, không
  // lệch 1 khung hình).
  useLayoutEffect(() => {
    loadCanvasForPage(canvasARef.current, slotAIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotAIndex]);

  useLayoutEffect(() => {
    loadCanvasForPage(canvasBRef.current, slotBIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotBIndex]);

  // Cửa sổ đổi cỡ (KHÔNG phải đổi trang) -> giữ đúng nét vẽ hiện có của mỗi
  // canvas, resize theo đúng kích thước CSS mới - kỹ thuật y hệt
  // Blackboard.tsx (toDataURL trước khi resize, vẽ lại sau). Quan sát riêng
  // TỪNG canvas (không phải div bọc ngoài) vì kích thước mỗi canvas giờ phụ
  // thuộc aspect-ratio riêng của đúng ảnh nó đang khớp, không đơn thuần
  // bằng kích thước khung chứa chung nữa.
  useEffect(() => {
    const observeResize = (canvas: HTMLCanvasElement) => {
      const ro = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const newWidth = Math.round(rect.width * dpr);
        const newHeight = Math.round(rect.height * dpr);
        if (newWidth < 1 || newHeight < 1) return;
        if (canvas.width === newWidth && canvas.height === newHeight) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let oldDataUrl: string | null = null;
        if (canvas.width > 0 && canvas.height > 0) oldDataUrl = canvas.toDataURL();

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
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          };
          img.src = oldDataUrl;
        }
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    };

    const cleanups: Array<() => void> = [];
    if (canvasARef.current) cleanups.push(observeResize(canvasARef.current));
    if (canvasBRef.current) cleanups.push(observeResize(canvasBRef.current));
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const getCoordinates = (e: any) => {
    // Dùng rect ĐÃ CACHE (từ startDrawing) - không gọi getBoundingClientRect()
    // lại ở đây, xem comment ở canvasRectRef.
    const rect = canvasRectRef.current;
    if (!rect) return { x: 0, y: 0 };
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: any) => {
    if (!isPenMode) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;
    isDrawingRef.current = true;
    canvasRectRef.current = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getCoordinates(e);
    lastPosRef.current = { x, y };
    lastMidRef.current = { x, y };

    ctx.lineWidth = penTool === 'eraser' ? ERASER_SIZE : BRUSH_SIZE;
    ctx.globalCompositeOperation = penTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.fillStyle = INK_COLOR;
    ctx.strokeStyle = INK_COLOR;

    ctx.beginPath();
    if (penTool === 'pen') {
      ctx.arc(x, y, BRUSH_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = (e: any) => {
    if (!isDrawingRef.current || !isPenMode) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getCoordinates(e);

    ctx.lineWidth = penTool === 'eraser' ? ERASER_SIZE : BRUSH_SIZE;
    ctx.globalCompositeOperation = penTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = INK_COLOR;

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
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    canvasRectRef.current = null;
    // Lưu lại nét vừa vẽ vào đúng trang hiện tại - quay lại trang này sau
    // (từ trang khác) sẽ nạp lại đúng nét đã lưu.
    const canvas = getActiveCanvas();
    if (canvas) slideDrawingsRef.current.set(index, canvas.toDataURL());
  };

  const clearCanvas = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    slideDrawingsRef.current.delete(index);
  };

  // Y HỆT getCustomCursor() trong DoraGrammarDetailView.jsx (dora-nihongo) -
  // kể cả chi tiết chấm đỏ trên cursor bút dùng màu "red" (CSS name) chứ
  // không phải INK_COLOR (#ef4444) như mực vẽ thật - giữ nguyên đúng bản gốc.
  const getCustomCursor = () => {
    if (!isPenMode) return 'auto';
    if (penTool === 'pen') {
      const svgPen = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="white"/><circle cx="17" cy="7" r="2" fill="red" stroke="none"/></svg>`;
      return `url('data:image/svg+xml;utf8,${encodeURIComponent(svgPen)}') 4 28, crosshair`;
    }
    const s = ERASER_SIZE;
    const svgEraser = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect x="2" y="2" width="${s - 4}" height="${s - 4}" rx="4" fill="white" stroke="%239ca3af" stroke-width="2" fill-opacity="0.9"/><path d="M${s / 2} 10v${s - 20}" stroke="%239ca3af" stroke-width="1"/></svg>`;
    return `url('data:image/svg+xml;utf8,${encodeURIComponent(svgEraser)}') ${s / 2} ${s / 2}, crosshair`;
  };

  // Phím mũi tên trái/phải + Space để lật trang, Escape để đóng - BỎ QUA
  // khi đang gõ trong ô Ghi chú (textarea/input) để không "cướp" phím khỏi
  // việc gõ chữ. Bật bút vẽ vẫn cho next/prev bình thường (mỗi trang tự
  // lưu nét vẽ riêng, đổi trang không mất gì) - goTo() tự chặn đúng lúc
  // đang kéo chuột vẽ dở, không cần chặn thêm ở đây.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      if (e.key === 'Escape') {
        // Escape đóng popup xác nhận thoát/bảng/ghi chú/bút vẽ đang mở
        // trước, chưa đóng cả trình chiếu - đóng thật thì phải qua popup
        // xác nhận (requestClose), không đóng thẳng nữa.
        if (showExitConfirm) setShowExitConfirm(false);
        else if (isNoteOpen) onToggleNote();
        else if (isBoardOpen) onToggleBoard();
        else if (isPenMode) setIsPenMode(false);
        else requestClose();
        return;
      }

      if (isTyping) return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, requestClose, showExitConfirm, isNoteOpen, isBoardOpen, isPenMode, onToggleBoard, onToggleNote]);

  // Class cho từng TRẠNG THÁI của nút công cụ - tách riêng hẳn 1 chuỗi
  // class HOÀN CHỈNH cho mỗi trạng thái (không ghép base + override chồng
  // lên nhau) để tránh 2 class hover:bg-* xung đột (thứ tự Tailwind sinh
  // CSS không theo thứ tự viết trong JSX, ghép chồng dễ bị "cố định" sai -
  // vd nút đang active bị hover đè mất màu xanh) - lỗi đã gặp thực tế.
  const btnBase = 'flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none';
  const navBtn = `${btnBase} bg-white/10 hover:bg-white/20 text-white`;
  const activeBtn = `${btnBase} bg-blue-600 hover:bg-blue-500 text-white`;
  const exitBtn = `${btnBase} bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300`;
  const clearBtn = `${btnBase} bg-white/10 hover:bg-red-500/30 active:bg-red-500 text-white hover:text-red-300 active:text-white`;

  /** Tooltip tự vẽ bằng CSS (không dùng `title` - tránh chú thích mặc định
   * xấu/chậm của trình duyệt), hiện ngay dưới nút khi hover, kiểu mũi tên
   * trỏ lên - tham khảo đúng pattern tooltip trong DoraTopBarActions.jsx
   * bên dora-nihongo. */
  const Tooltip = ({ label }: { label: string }) => (
    <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 text-white text-[10px] font-bold rounded-md shadow-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-800"></div>
      {label}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-[linear-gradient(315deg,#16324f_0%,#24406b_45%,#345da7_100%)]"
      aria-label={title ? `Slide trình chiếu — ${title}` : 'Slide trình chiếu'}
    >
      {/* Thanh trên - lấy NGUYÊN kiểu nav của Home.tsx/LessonView.tsx (logo +
          nút trở về, cùng class h-16/bg-white/5/backdrop-blur-md/border-b),
          để đồng bộ giao diện với các trang khác. Prev/Next + đếm trang CĂN
          GIỮA (absolute, không phụ thuộc độ rộng 2 cụm nút 2 bên); Bút vẽ/
          Bảng/Ghi chú nằm bên phải. */}
      {/* z-10: backdrop-blur-md tự tạo stacking context riêng cho thanh này
          (backdrop-filter luôn vậy) - nếu không gán z-index rõ ràng ở đây,
          cả thanh (gồm tooltip z-50 bên trong) bị so là z-index:auto so với
          vùng ảnh slide bên dưới (đứng sau trong DOM) và bị đè lên, che mất
          tooltip - lỗi thực tế đã gặp. */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-md shrink-0 gap-3 relative z-10">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={requestClose} className="hover:bg-white/10 text-white p-2 rounded-lg transition-colors border border-transparent shrink-0" aria-label="Trở về">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src="https://i.ibb.co/GvC0pFmy/Logo-tr-ng.png" alt="DORA" className="h-8 object-contain -mt-[5px] shrink-0" />
        </div>

        {/* Prev/Next/đếm trang - căn giữa tuyệt đối thanh header, số trang
            to/rõ (không phải chữ nhỏ mờ như trước). */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <button onClick={goPrev} disabled={index <= 0} className={navBtn} aria-label="Trang trước">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-semibold text-sm min-w-[56px] text-center tabular-nums bg-white/10 rounded-lg px-3 py-1">
            {total > 0 ? `${index + 1}/${total}` : '...'}
          </span>
          <button onClick={goNext} disabled={index >= total - 1} className={navBtn} aria-label="Trang sau">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isPenMode ? (
            <div className="relative group">
              <button
                onClick={() => {
                  // Mở lại luôn mặc định chọn Bút (không nhớ lần trước đóng
                  // đang để Tẩy).
                  setPenTool('pen');
                  setIsPenMode(true);
                }}
                className={navBtn}
                aria-label="Bút vẽ"
              >
                <PenLine className="w-5 h-5" />
              </button>
              <Tooltip label="Bút vẽ" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="relative group">
                <button
                  onClick={() => setPenTool('pen')}
                  className={penTool === 'pen' ? activeBtn : navBtn}
                  aria-label="Bút vẽ"
                >
                  <PenLine className="w-4 h-4" />
                </button>
                <Tooltip label="Bút" />
              </div>
              <div className="relative group">
                <button
                  onClick={() => setPenTool('eraser')}
                  className={penTool === 'eraser' ? activeBtn : navBtn}
                  aria-label="Tẩy"
                >
                  <Eraser className="w-4 h-4" />
                </button>
                <Tooltip label="Tẩy" />
              </div>
              <div className="relative group">
                <button onClick={clearCanvas} className={clearBtn} aria-label="Xóa nét vẽ trang này">
                  <Trash2 className="w-4 h-4" />
                </button>
                <Tooltip label="Xóa hết" />
              </div>
              <div className="relative group">
                <button onClick={() => setIsPenMode(false)} className={exitBtn} aria-label="Thoát vẽ">
                  <X className="w-4 h-4" />
                </button>
                <Tooltip label="Đóng vẽ" />
              </div>
            </div>
          )}

          <div className="w-px h-5 bg-white/15 mx-0.5" />

          <div className="relative group">
            <button
              onClick={onToggleBoard}
              className={isBoardOpen ? activeBtn : navBtn}
              aria-label="Bảng đen"
            >
              <Presentation className="w-5 h-5" />
            </button>
            <Tooltip label="Bảng đen" />
          </div>
          <div className="relative group">
            <button
              onClick={onToggleNote}
              className={isNoteOpen ? activeBtn : navBtn}
              aria-label="Ghi chú"
            >
              <NotebookText className="w-5 h-5" />
            </button>
            <Tooltip label="Ghi chú" />
          </div>
          <div className="relative group">
            <button
              onClick={toggleFullscreen}
              className={isFullscreen ? activeBtn : navBtn}
              aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <Tooltip label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} />
          </div>

          {showCallControls && (
            <>
              <div className="w-px h-5 bg-white/15 mx-0.5" />
              <CallControls isPipActive={isPipActive} />
            </>
          )}
        </div>
      </div>

      {/* Vùng trình chiếu - ảnh full khung, không crop, nền lấy đúng gradient
          trang chủ (khai báo ở div ngoài) lấp phần trống khi tỉ lệ ảnh khác
          tỉ lệ màn hình. Canvas vẽ tay phủ toàn khung (kể cả vùng đệm quanh
          ảnh), không giới hạn theo khung ảnh. */}
      <div className="flex-1 min-h-0 relative overflow-hidden py-3 md:py-6">
        {total > 0 && (
          // 2 ảnh + 2 canvas nét vẽ CÙNG 1 Ô LƯỚI (grid, không dùng
          // position:absolute) để chồng lên nhau cho crossfade - cố tình
          // KHÔNG dùng absolute vì containing block của phần tử absolute
          // tính theo PADDING BOX (gồm cả py-3/md:py-6 ở trên), khiến
          // max-w-full/max-h-full "ăn lấn" vào khoảng đệm, ảnh bị to hơn so
          // với luồng bình thường trước đây - lỗi thực tế đã gặp. Grid item
          // thì % vẫn tính theo content box như luồng thường, giữ đúng
          // kích cỡ.
          //
          // QUAN TRỌNG: PHẢI khai báo gridTemplateRows/Columns rõ ràng
          // (100%) - để mặc định "auto" thì ô lưới (containing block của
          // các phần tử bên trong) không có kích thước XÁC ĐỊNH, khiến
          // max-h-full mất mốc để tính % nên bị trình duyệt BỎ QUA hoàn
          // toàn -> ảnh tràn hết theo đúng kích thước gốc (rất cao, file
          // Canva xuất ra), che mất/tràn khỏi màn hình - lỗi nghiêm trọng
          // thực tế đã gặp.
          //
          // Canvas đặt SAU 2 ảnh trong DOM (cùng ô lưới thì phần tử sau vẽ
          // đè lên phần tử trước) để nét vẽ luôn nổi trên ảnh - phủ TOÀN Ô
          // LƯỚI (w-full h-full, không giới hạn theo khung ảnh), vẽ được cả
          // ra vùng đệm trống quanh ảnh.
          <div
            className="grid h-full w-full place-items-center"
            // cursor: GLOW_CURSOR áp cho cả khung này (không phải bút/tẩy) -
            // khi bật bút vẽ, canvas (pointer-events-auto lúc đó) đứng trên
            // cùng và tự có cursor riêng (getCustomCursor()) nên tự động
            // ĐÈ LÊN cursor này, không cần if/else thủ công ở đây.
            style={{ gridTemplateRows: '100%', gridTemplateColumns: '100%', cursor: GLOW_CURSOR }}
          >
            <img
              src={images[slotAIndex]}
              alt={`Slide ${slotAIndex + 1}/${total}`}
              className={`col-start-1 row-start-1 max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-opacity ease-in-out ${activeSlot === 'A' ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            />
            <img
              src={images[slotBIndex]}
              alt={`Slide ${slotBIndex + 1}/${total}`}
              className={`col-start-1 row-start-1 max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-opacity ease-in-out ${activeSlot === 'B' ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            />
            <canvas
              ref={canvasARef}
              className={`col-start-1 row-start-1 z-10 w-full h-full touch-none transition-opacity ease-in-out ${activeSlot === 'A' ? 'opacity-100' : 'opacity-0'} ${activeSlot === 'A' && isPenMode ? 'pointer-events-auto' : 'pointer-events-none'}`}
              style={{
                cursor: getCustomCursor(),
                touchAction: isPenMode ? 'none' : 'auto',
                transitionDuration: `${FADE_MS}ms`,
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <canvas
              ref={canvasBRef}
              className={`col-start-1 row-start-1 z-10 w-full h-full touch-none transition-opacity ease-in-out ${activeSlot === 'B' ? 'opacity-100' : 'opacity-0'} ${activeSlot === 'B' && isPenMode ? 'pointer-events-auto' : 'pointer-events-none'}`}
              style={{
                cursor: getCustomCursor(),
                touchAction: isPenMode ? 'none' : 'auto',
                transitionDuration: `${FADE_MS}ms`,
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        )}
      </div>

      {/* Popup xác nhận thoát trình chiếu - nền phía sau bị khóa/mờ đi
          (bg-black/50 backdrop-blur-sm), giống hệt kiểu popup "Thoát buổi
          học" đã có trong LessonView.tsx, z cao hơn cả Bảng đen/Ghi chú
          (320/330) để luôn nổi trên cùng. */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4 touch-none overscroll-none"
          onTouchMove={(e) => e.preventDefault()}
        >
          <div
            className="bg-surface border border-surface-border rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-xl flex flex-col text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-2">Thoát trình chiếu</h3>
            <p className="text-[#8fb0ce] font-medium mb-8">Bạn có chắc chắn muốn thoát Slide?</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-[#8fb0ce] bg-white/10 hover:bg-white/20 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onClose();
                }}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

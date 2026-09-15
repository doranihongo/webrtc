// Flashcard từ vựng - bố cục/giao diện copy 100% từ FlashcardModal bên dự án
// C:\Users\Admin\Desktop\phá-đảo-tiếng-nhật (src/components/flashcard/FlashcardModal.jsx,
// nhánh mode==='vocab' KHÔNG autoFit - đây là giao diện THẬT bên đó dùng cho Flashcard Từ
// vựng, autoFit chỉ dành riêng cho Luyện đề) - khối Hán Việt/Cách đọc/Ý nghĩa gộp chung 1
// div "space-y-2", đứng GIỮA thẻ như 1 khối duy nhất (không tách riêng từng dòng), y hệt bên
// đó. Khác 1 chỗ DUY NHẤT: mặt chữ (word) dùng FitText (copy nguyên thuật toán đo
// scrollWidth/scrollHeight THẬT của renderAutoFitVocabFace/FitText bên dự án đó) thay cho
// getFlashcardFontSize() + text-ellipsis gốc - vì buổi học ở đây có từ vựng là cả CÂU/CỤM DÀI
// (không chỉ 1-2 từ ngắn như "Xóa mù Kanji"/kanji gốc bên đó), đoán cỡ chữ theo SỐ KÝ TỰ dễ
// vẫn tràn -> hiện "..." mất chữ; đo thật rồi tự co cỡ chữ tới khi vừa khung thì không bao giờ
// mất chữ (chữ nhỏ lại chứ không bị cắt, tự xuống dòng khi cần). Cỡ chữ BAN ĐẦU (trước khi đo)
// vẫn lấy đúng theo bảng getFlashcardFontSize() gốc (quy đổi ra px) - để chữ NGẮN vẫn to đúng
// như bản gốc (72/60/48px...), chỉ khi đo thật thấy tràn mới co nhỏ dần xuống `min`. Hán Việt/
// Cách đọc/Ý nghĩa giữ nguyên chữ cố định như gốc (không autoFit) vì thực tế không bị tràn.
import React from 'react';
import confetti from 'canvas-confetti';
import type { VocabWord } from '../types';

// Cỡ chữ BAN ĐẦU của mặt chữ theo số ký tự - quy đổi trực tiếp từ getFlashcardFontSize() gốc
// (text-7xl..text-lg) ra px, để chữ ngắn (vd "こんにちは") vẫn to hệt bản gốc; FitText bên dưới
// chỉ co nhỏ TIẾP từ đây nếu đo thật thấy vẫn tràn khung (câu/cụm dài), không bao giờ để mất chữ.
function getWordFontSize(text: string): number {
  const len = text.length;
  if (len <= 1) return 72; // text-7xl
  if (len <= 3) return 60; // text-6xl
  if (len <= 5) return 48; // text-5xl
  if (len <= 7) return 36; // text-4xl
  if (len <= 10) return 30; // text-3xl
  if (len <= 14) return 24; // text-2xl
  if (len <= 18) return 20; // text-xl
  return 18; // text-lg
}

// Copy nguyên thuật toán FitText bên dự án phá-đảo-tiếng-nhật (renderAutoFitVocabFace) -
// singleLineFirst=true: cố giữ 1 dòng (nowrap), hạ cỡ chữ tới khi vừa bề NGANG hoặc chạm cỡ
// nhỏ nhất mới cho xuống dòng (đo lại cả 2 chiều từ đó). "box" (flex-1 min-h-0) nhận chiều
// cao/rộng THẬT qua flex-grow từ cha (div.flex-1 flex-col trong renderVocabFace) -
// clientWidth/clientHeight của box chính là giới hạn không được vượt qua. Mặt chữ luôn là con
// ĐẦU TIÊN (trước khối space-y-2 Hán Việt/Cách đọc/Ý nghĩa) và ở cấu hình mặc định (chỉ hiện 1
// trong 2 khối trên mỗi mặt) là con DUY NHẤT có nội dung trên mặt đó, nên chiếm flex-1 không
// đẩy khối kia trôi lệch - CHỈ lệch nếu người dùng tự bật thêm Cách đọc/Hán Việt cùng mặt với
// Mặt chữ qua nút cài đặt (ít gặp, đúng như bản gốc nếu cấu hình y hệt).
function FitText({
  text,
  as: Tag = 'p',
  className,
  max,
  min = 13,
  singleLineFirst = false,
}: {
  text: string;
  as?: 'p' | 'h3';
  className?: string;
  max: number;
  min?: number;
  singleLineFirst?: boolean;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    const fitsW = () => el.scrollWidth <= box.clientWidth;
    const fitsH = () => el.scrollHeight <= box.clientHeight;

    const run = () => {
      let size = max;
      el.style.whiteSpace = singleLineFirst ? 'nowrap' : 'pre-wrap';
      el.style.fontSize = `${size}px`;
      while (size > min && (!fitsW() || (!singleLineFirst && !fitsH()))) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      // Mặt trước chạm cỡ nhỏ nhất mà vẫn tràn ngang -> đành cho xuống dòng, đo lại cả 2
      // chiều từ đầu (kể cả chiều cao) để chắc không tràn dọc theo sau khi wrap.
      if (singleLineFirst && !fitsW()) {
        el.style.whiteSpace = 'pre-wrap';
        while (size > min && (!fitsW() || !fitsH())) {
          size -= 1;
          el.style.fontSize = `${size}px`;
        }
      }
    };

    run();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(run);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text, max, min, singleLineFirst]);

  return (
    <div ref={boxRef} className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
      <Tag ref={textRef as any} className={className} style={{ fontSize: `${max}px` }}>
        {text}
      </Tag>
    </div>
  );
}

// Từ vựng luôn có ĐÚNG 2 mặt cố định (không cho tùy biến qua nút cài đặt nữa - đã thay bằng
// nút "Lật ngược" bên dưới): mặt chữ (Nhật) và mặt Hán Việt/Cách đọc/Ý nghĩa (Việt).
const WORD_FACE = { word: true, reading: false, hanviet: false, meaning: false };
const MEANING_FACE = { word: false, reading: true, hanviet: true, meaning: true };

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  vocabulary: VocabWord[];
}

export default function FlashcardModal({ isOpen, onClose, vocabulary }: FlashcardModalProps) {
  const [originalQueue, setOriginalQueue] = React.useState<VocabWord[]>([]);
  const [queue, setQueue] = React.useState<VocabWord[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [unknownIndices, setUnknownIndices] = React.useState<number[]>([]);
  const [knownCount, setKnownCount] = React.useState(0);
  const [history, setHistory] = React.useState<any[]>([]);
  const [isFinished, setIsFinished] = React.useState(false);
  const [exitDirection, setExitDirection] = React.useState<string | null>(null);
  const [showHint, setShowHint] = React.useState(true);
  const [dragX, setDragX] = React.useState(0);
  const [startX, setStartX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [btnFeedback, setBtnFeedback] = React.useState<string | null>(null);
  const [isShuffleOn, setIsShuffleOn] = React.useState(false);

  // Lật ngược HƯỚNG học: mặc định mặt trước = mặt chữ (tiếng Nhật), mặt sau = Hán Việt/Cách
  // đọc/Ý nghĩa (tiếng Việt) - giống hướng học "Nhật -> Việt". Bật nút này thì đảo lại, mặt
  // trước thành tiếng Việt, lật mới thấy tiếng Nhật ("Việt -> Nhật"). Chỉ đổi NỘI DUNG hiện ở
  // mặt nào (frontOptions/backOptions dưới đây), không đụng tới isFlipped/hiệu ứng lật thẻ.
  const [isReversed, setIsReversed] = React.useState(false);

  const triggerConfetti = React.useCallback(() => {
    if (typeof confetti === 'undefined') return;
    const count = 200;
    const defaults = { origin: { y: 0.6 }, zIndex: 1500 };
    function fire(particleRatio: number, opts: any) {
      confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
    }
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, []);
  React.useEffect(() => {
    if (isFinished && isOpen) triggerConfetti();
  }, [isFinished, triggerConfetti, isOpen]);

  const shuffleArray = React.useCallback((array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  }, []);

  const startNewSession = React.useCallback((items: VocabWord[]) => {
    setQueue(items);
    setCurrentIndex(0);
    setIsFlipped(false);
    setUnknownIndices([]);
    setKnownCount(0);
    setHistory([]);
    setIsFinished(false);
    setExitDirection(null);
    setDragX(0);
    setBtnFeedback(null);
  }, []);

  // --- INIT DATA ---
  React.useEffect(() => {
    if (isOpen && vocabulary && vocabulary.length > 0) {
      // Khử trùng theo "word" (giữ bản ghi đầu tiên) - tương đương [...new Set(chars)] bên bản gốc.
      const seen = new Set<string>();
      const items = vocabulary.filter((v) => {
        if (!v.word || seen.has(v.word)) return false;
        seen.add(v.word);
        return true;
      });

      if (items.length === 0) {
        alert('Không có dữ liệu hợp lệ để ôn tập!');
        onClose();
        return;
      }

      setOriginalQueue(items);
      const queueToLoad = isShuffleOn ? shuffleArray(items) : items;
      startNewSession(queueToLoad);
      setShowHint(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } else if (!isOpen) {
      setIsFinished(false);
      setQueue([]);
    }
  }, [isOpen, vocabulary]);

  React.useEffect(() => {
    const container = document.getElementById('lesson-view-container') || document.getElementById('course-detail-container') || document.body;
    if (isOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.overflow = 'hidden';
      container.style.overflow = 'hidden';
      container.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      document.documentElement.style.overflow = '';
      container.style.overflow = '';
      container.style.paddingRight = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      container.style.overflow = '';
      container.style.paddingRight = '';
    };
  }, [isOpen]);

  const toggleFlip = React.useCallback(() => {
    setIsFlipped((prev) => !prev);
    if (currentIndex === 0) setShowHint(false);
  }, [currentIndex]);

  const handleNext = React.useCallback(
    (isKnown: boolean) => {
      if (exitDirection || isFinished || queue.length === 0) return;
      const currentItem = queue[currentIndex];
      setIsFlipped(false);
      if (isKnown) {
        setKnownCount((prev) => prev + 1);
      } else {
        setUnknownIndices((prev) => [...prev, currentIndex]);
      }
      setHistory((prev) => [...prev, { isKnown, item: currentItem }]);

      setBtnFeedback(isKnown ? 'right' : 'left');
      setExitDirection(isKnown ? 'right' : 'left');
      setTimeout(() => {
        setCurrentIndex((prevIndex) => {
          if (prevIndex < queue.length - 1) {
            setExitDirection(null);
            setDragX(0);
            setBtnFeedback(null);
            return prevIndex + 1;
          } else {
            setIsFinished(true);
            return prevIndex;
          }
        });
      }, 175);
    },
    [currentIndex, queue, exitDirection, isFinished]
  );

  const handleBack = (e: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
    }
    if (currentIndex > 0 && history.length > 0) {
      const lastItem = history[history.length - 1];
      if (lastItem.isKnown === true) {
        setKnownCount((prev) => Math.max(0, prev - 1));
      } else {
        setUnknownIndices((prev) => prev.slice(0, -1));
      }
      setHistory((prev) => prev.slice(0, -1));
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      setExitDirection(null);
      setDragX(0);
      setBtnFeedback(null);
    }
  };

  const handleToggleShuffle = (e: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
    }
    const nextState = !isShuffleOn;
    setIsShuffleOn(nextState);
    setBtnFeedback('shuffle');
    setTimeout(() => setBtnFeedback(null), 400);

    const passedPart = queue.slice(0, currentIndex);
    const remainingPart = queue.slice(currentIndex);
    if (remainingPart.length === 0) return;

    let newRemainingPart: VocabWord[];
    if (nextState) {
      newRemainingPart = shuffleArray(remainingPart);
    } else {
      const counts: Record<string, number> = {};
      remainingPart.forEach((it) => { counts[it.id] = (counts[it.id] || 0) + 1; });
      newRemainingPart = [];
      for (const item of originalQueue) {
        if (counts[item.id] > 0) {
          newRemainingPart.push(item);
          counts[item.id]--;
        }
      }
    }

    setQueue([...passedPart, ...newRemainingPart]);
    setIsFlipped(false);
  };

  const handleDragStart = (e: any) => {
    if (exitDirection || isFinished) return;
    setIsDragging(true);
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    setStartX(clientX);
  };
  const handleDragMove = (e: any) => {
    if (!isDragging || exitDirection) return;
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    setDragX(clientX - startX);
  };
  const dynamicBorder = () => {
    if (dragX > 70 || btnFeedback === 'right') return '#22c55e';
    if (dragX < -70 || btnFeedback === 'left') return '#ef4444';
    return 'white';
  };

  React.useEffect(() => {
    const handleKeyDown = (e: any) => {
      if (!isOpen || isFinished) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          toggleFlip();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleNext(false);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext(true);
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFinished, toggleFlip, handleNext, onClose]);

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX > 70) handleNext(true);
    else if (dragX < -70) handleNext(false);
    else setDragX(0);
  };

  const currentItem = queue[currentIndex] || null;

  if (!isOpen || queue.length === 0) return null;

  if (!currentItem && !isFinished && isOpen) setIsFinished(true);
  const progressRatio = currentIndex / (queue.length - 1 || 1);

  const currentWord = currentItem?.word || '';

  const frontOptions = isReversed ? MEANING_FACE : WORD_FACE;
  const backOptions = isReversed ? WORD_FACE : MEANING_FACE;

  // Nút công cụ chung (Quay lại / Xáo trộn)
  const CardTools = (
    <div className={`absolute left-0 right-0 items-center z-50 bottom-4 px-6 ${isFlipped ? 'hidden sm:flex' : 'flex'} justify-between`}>
      <button
        onClick={handleBack}
        className={`p-2.5 bg-black/5 hover:bg-black/10 active:scale-90 rounded-full transition-all flex items-center justify-center ${currentIndex === 0 ? 'opacity-10 cursor-not-allowed' : 'text-gray-400 hover:text-gray-700'}`}
        disabled={currentIndex === 0}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="pointer-events-none">
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h12a5 5 0 0 1 0 10H7" />
        </svg>
      </button>
      <button
        onClick={handleToggleShuffle}
        className={`p-2.5 bg-black/5 hover:bg-black/10 active:scale-90 rounded-full transition-all flex items-center justify-center ${isShuffleOn ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-700'}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`pointer-events-none ${btnFeedback === 'shuffle' ? 'animate-[spin_0.4s_linear_infinite]' : ''}`}>
          <path d="m21 16-4 4-4-4" />
          <path d="M17 20V4" />
          <path d="m3 8 4-4 4 4" />
          <path d="M7 4v16" />
        </svg>
      </button>
    </div>
  );

  const renderVocabFace = (options: any) => {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full transform -translate-y-3 px-2">
        {options.word && (
          <FitText
            text={currentWord}
            as="h3"
            className="font-bold mb-3 leading-tight text-center px-4 max-w-full font-jp text-gray-800"
            max={getWordFontSize(currentWord)}
            min={14}
            singleLineFirst
          />
        )}
        <div className="space-y-2 text-center w-full">
          {options.hanviet && currentItem?.sinoVietnamese && (
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 inline-block pb-1">{currentItem.sinoVietnamese}</p>
          )}
          {options.reading && currentItem?.reading && (
            <p className="text-xl font-bold text-indigo-600 font-jp">{currentItem.reading}</p>
          )}
          {options.meaning && currentItem?.meaning && (
            <p className="text-2xl font-bold text-gray-700 italic leading-snug px-2">{currentItem.meaning}</p>
          )}
        </div>
      </div>
    );
  };

  const cardContent = {
    front: (
      <>
        {renderVocabFace(frontOptions)}
        {currentIndex === 0 && showHint && (
          <p className="absolute bottom-14 text-indigo-400 text-[7px] font-black uppercase tracking-[0.4em] animate-pulse">Chạm để lật</p>
        )}
        {CardTools}
      </>
    ),
    back: <>{renderVocabFace(backOptions)}</>,
  };

  // Thanh tiến độ NẰM TRÊN thẻ + nút "Lật ngược" (đảo hướng học) và nút "Đóng thẻ" (icon +
  // chữ, gộp 1 nút, thay cho nút chữ rời ở dưới cùng) bên phải - thanh tiến độ tự ngắn lại
  // nhường chỗ (flex-1). Bố cục copy từ dự án C:\Users\Admin\Desktop\phá-đảo-tiếng-nhật
  // (FlashcardModal.jsx, progressBarRow) để giao diện flashcard giống hệt - riêng nút cài đặt
  // (bánh răng + menu chọn field cho từng mặt) bên đó được thay bằng nút lật ngược hướng học.
  const progressBarRow = (
    <div className="w-80 flex items-center gap-3 mb-3">
      <div className="flex-1 relative h-6 flex items-center">
        <div className="w-full h-1 bg-white/10 rounded-full relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full bg-sky-400 transition-all duration-300 ease-out" style={{ width: `${progressRatio * 100}%` }} />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-full h-1 pointer-events-none">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-10 rounded-[0.4rem] flex items-center justify-center bg-white shadow-sm z-0">
            <span className="text-[12px] font-black text-black leading-none">{queue.length}</span>
          </div>
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 pointer-events-none">
          <div
            className="absolute top-1/2 -translate-y-1/2 h-7 w-10 bg-sky-400 rounded-[0.4rem] flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.8)] transition-all duration-300 ease-out z-10"
            style={{ left: `calc(${progressRatio * 100}% - ${progressRatio * 40}px)` }}
          >
            <span className="text-[12px] font-black text-white leading-none">{currentIndex + 1}</span>
          </div>
        </div>
      </div>

      {/* Nút "Lật ngược" (đảo hướng học Nhật<->Việt) - bấm bật/tắt, bật thì xanh lá. Thay cho
          nút Cài Đặt (bánh răng + menu chọn field) trước đây. */}
      <button
        onClick={() => setIsReversed((prev) => !prev)}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 ${
          isReversed ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.7)]' : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
        aria-pressed={isReversed}
        aria-label="Lật ngược mặt thẻ"
        title="Lật ngược mặt thẻ"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none">
          <path d="M17 2l4 4-4 4" />
          <path d="M3 12V10a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 12v2a4 4 0 0 1-4 4H3" />
        </svg>
      </button>

      {/* Nút "Đóng thẻ" (icon thoát + chữ) - thay cho nút chữ rời trước đây ở dưới cùng */}
      <button
        onClick={onClose}
        className="h-8 px-3 bg-white/10 hover:bg-red-500/20 text-red-400 hover:text-red-500 rounded-full flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
        aria-label="Đóng thẻ"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="text-[11px] font-black uppercase tracking-wider">Đóng thẻ</span>
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-[#1f2937] backdrop-blur-xl animate-in fade-in duration-200 select-none touch-none cursor-pointer"
      style={{ touchAction: 'none' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm flex flex-col items-center relative cursor-default mb-[-10px]" onClick={(e) => e.stopPropagation()}>
        {!isFinished ? (
          <>
            {/* Thanh tiến độ NẰM TRÊN thẻ */}
            {progressBarRow}

            {/* --- CARD --- */}
            <div
              className={`relative transition-all duration-300 ease-in-out mt-[10px] ${exitDirection === 'left' ? '-translate-x-16 -rotate-3' : exitDirection === 'right' ? 'translate-x-16 rotate-3' : ''}`}
              style={{ transform: !exitDirection && dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX * 0.02}deg)` : '', transition: isDragging ? 'none' : 'all 0.25s ease-out' }}
            >
              <div
                onClick={() => { if (Math.abs(dragX) < 5) toggleFlip(); }}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchMove={handleDragMove}
                onTouchEnd={handleDragEnd}
                className={`relative w-80 sm:w-96 h-80 mt-2 mb-4 cursor-pointer transition-all duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
              >
                {/* FRONT */}
                <div className="absolute inset-0 bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col items-center justify-center border-4 [backface-visibility:hidden] overflow-hidden p-4" style={{ borderColor: dynamicBorder() }}>
                  {cardContent.front}
                </div>
                {/* BACK */}
                <div className="absolute inset-0 bg-[#f8fafc] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col items-center justify-center p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] border-4 overflow-hidden text-center" style={{ borderColor: dynamicBorder() }}>
                  {cardContent.back}
                </div>
              </div>
            </div>

            {/* --- NÚT ĐIỀU HƯỚNG --- */}
            <div className="flex gap-3 w-80 mt-[15px] mb-[-10px] mx-0">
              <button onClick={() => handleNext(false)} className="flex-1 py-3.5 bg-[#312028] hover:bg-red-500/20 active:bg-[#312028] text-[#e04545] border border-transparent rounded-[0.8rem] font-bold text-[13px] transition-all flex items-center justify-center gap-2 uppercase">
                ĐANG HỌC <span className="bg-[#ef4444] text-white min-w-[28px] h-[22px] px-2 rounded-[0.4rem] flex items-center justify-center text-[12px] font-black shadow-sm">{unknownIndices.length}</span>
              </button>
              <button onClick={() => handleNext(true)} className="flex-1 py-3.5 bg-[#173229] hover:bg-green-500/20 active:bg-[#173229] text-[#12a150] border border-transparent rounded-[0.8rem] font-bold text-[13px] transition-all flex items-center justify-center gap-2 uppercase">
                ĐÃ BIẾT <span className="bg-[#22c55e] text-white min-w-[28px] h-[22px] px-2 rounded-[0.4rem] flex items-center justify-center text-[12px] font-black shadow-sm">{knownCount}</span>
              </button>
            </div>
          </>
        ) : (
          // MÀN HÌNH HOÀN THÀNH
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-[280px] text-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-4 border-indigo-50 animate-in zoom-in-95">
            <div className="text-5xl mb-4 animate-bounce cursor-pointer hover:scale-125 transition-transform" onClick={triggerConfetti} title="Bấm để bắn pháo hoa!">🎉</div>
            <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">Hoàn thành</h3>
            <p className="text-gray-400 mb-6 text-[11px] font-medium italic">Bạn đã học được {knownCount}/{queue.length} từ.</p>
            <div className="space-y-2">
              {unknownIndices.length > 0 && (
                <button
                  onClick={() => startNewSession(isShuffleOn ? shuffleArray(unknownIndices.map((idx) => queue[idx])) : unknownIndices.map((idx) => queue[idx]))}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] shadow-lg active:scale-95 transition-colors"
                >
                  ÔN LẠI {unknownIndices.length} THẺ ĐANG HỌC
                </button>
              )}
              <button
                onClick={() => startNewSession(isShuffleOn ? shuffleArray(originalQueue) : originalQueue)}
                className="w-full py-3.5 bg-blue-50 border-2 border-blue-100 text-blue-500 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700 rounded-xl font-black text-[11px] transition-all active:scale-95"
              >
                HỌC LẠI TỪ ĐẦU
              </button>
              <button onClick={() => onClose()} className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-600 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95">
                THOÁT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

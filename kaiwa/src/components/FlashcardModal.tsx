// Flashcard từ vựng - copy logic 100% từ FlashcardModal (dự án "Xóa mù Kanji",
// D:\web\xóa mù kanji\src\components\FlashcardModal.tsx), chỉ bỏ phần liên quan
// tới Kanji/SRS (kaiwa không có Kanji, và bản gốc cũng chỉ lưu SRS khi
// mode==='kanji' - mode 'vocab' vốn dĩ không đụng tới SRS) và đổi nguồn dữ
// liệu: bản gốc tra cứu nghĩa/cách đọc qua dbData/customVocabData (dictionary
// tải từ GitHub) theo TỪNG CHỮ, còn ở đây mỗi từ vựng đã tự mang đủ
// reading/meaning/hanviet ngay trong VocabWord nên dùng thẳng, không cần tra.
import React from 'react';
import confetti from 'canvas-confetti';
import type { VocabWord } from '../types';

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

  // --- STATE CHO CẤU HÌNH HIỂN THỊ ---
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const configRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isConfigOpen && configRef.current && !configRef.current.contains(event.target as Node)) {
        setIsConfigOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isConfigOpen]);

  const [frontOptions, setFrontOptions] = React.useState<any>({ word: true, reading: false, hanviet: false, meaning: false });
  const [backOptions, setBackOptions] = React.useState<any>({ word: false, reading: true, hanviet: true, meaning: true });

  // --- LOGIC XỬ LÝ CHECKBOX (tự động bỏ tích mặt kia) ---
  const handleOptionCheck = (side: string, key: string) => {
    const isFront = side === 'front';
    const newFront = { ...frontOptions };
    const newBack = { ...backOptions };
    const currentOpts = isFront ? newFront : newBack;
    const otherOpts = isFront ? newBack : newFront;
    const limit = isFront ? 2 : 3;

    if (currentOpts[key]) {
      currentOpts[key] = false;
      setFrontOptions(newFront);
      setBackOptions(newBack);
      return;
    }

    if (otherOpts[key]) {
      otherOpts[key] = false;
    }

    const activeKeys = Object.keys(currentOpts).filter((k) => currentOpts[k]);
    if (activeKeys.length >= limit) {
      const keyToRemove = activeKeys[0];
      currentOpts[keyToRemove] = false;
    }

    currentOpts[key] = true;
    setFrontOptions(newFront);
    setBackOptions(newBack);
  };

  // --- HÀM TÍNH CỠ CHỮ ĐỘNG ---
  const getFlashcardFontSize = (text: string) => {
    if (!text) return 'text-3xl';
    const len = text.length;
    if (len <= 1) return 'text-7xl';
    if (len <= 3) return 'text-6xl';
    if (len <= 5) return 'text-5xl';
    if (len <= 7) return 'text-4xl';
    if (len <= 10) return 'text-3xl';
    if (len <= 14) return 'text-2xl';
    if (len <= 18) return 'text-xl';
    return 'text-lg';
  };

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

  const renderVocabFace = (options: any) => (
    <div className="flex-1 flex flex-col items-center justify-center w-full transform -translate-y-3 px-2">
      {options.word && (
        <h3 className={`${getFlashcardFontSize(currentWord)} font-bold mb-3 leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis px-4 max-w-full font-jp text-gray-800`}>
          {currentWord}
        </h3>
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

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-[#1f2937] backdrop-blur-xl animate-in fade-in duration-200 select-none touch-none cursor-pointer"
      style={{ touchAction: 'none' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm flex flex-col items-center relative cursor-default mb-[-10px]" onClick={(e) => e.stopPropagation()}>
        {!isFinished ? (
          <>
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

            {/* --- THANH TIẾN TRÌNH + NÚT CÀI ĐẶT --- */}
            <div className="w-80 flex items-center gap-3 mt-4 mb-2">
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

              {/* Nút Cài Đặt (nằm bên phải thanh tiến độ) */}
              <div className="relative" ref={configRef}>
                <button
                  onClick={() => setIsConfigOpen(!isConfigOpen)}
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
                {isConfigOpen && (
                  <div className="absolute bottom-full right-0 mb-3 bg-white rounded-xl shadow-2xl p-3 w-56 animate-in fade-in zoom-in-95 z-[60] text-gray-800 border border-gray-100">
                    <div className="mb-3 border-b border-gray-100 pb-2">
                      <p className="text-[10px] font-black text-indigo-600 mb-1.5 uppercase">Mặt trước (Câu hỏi)</p>
                      <div className="space-y-1">
                        {['word', 'reading', 'meaning'].map((opt) => (
                          <label key={`f-${opt}`} className="flex items-center gap-2 text-[11px] p-1.5 rounded transition-all cursor-pointer hover:bg-indigo-50">
                            <input type="checkbox" checked={frontOptions[opt] || false} onChange={() => handleOptionCheck('front', opt)} className="accent-indigo-600 w-3.5 h-3.5" />
                            <span className="font-medium">{opt === 'word' ? 'Mặt chữ' : opt === 'reading' ? 'Cách đọc' : 'Ý nghĩa'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-600 mb-1.5 uppercase">Mặt sau (Đáp án)</p>
                      <div className="space-y-1">
                        {['word', 'reading', 'hanviet', 'meaning'].map((opt) => (
                          <label key={`b-${opt}`} className="flex items-center gap-2 text-[11px] p-1.5 rounded transition-all cursor-pointer hover:bg-indigo-50">
                            <input type="checkbox" checked={backOptions[opt] || false} onChange={() => handleOptionCheck('back', opt)} className="accent-indigo-600 w-3.5 h-3.5" />
                            <span className="font-medium">{opt === 'word' ? 'Mặt chữ' : opt === 'reading' ? 'Cách đọc' : opt === 'hanviet' ? 'Hán Việt' : 'Ý nghĩa'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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

            <button onClick={onClose} className="mt-8 text-white/40 hover:text-white transition-all text-[13px] font-black uppercase tracking-[0.2em] py-2 px-4 active:scale-95">Đóng thẻ</button>
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

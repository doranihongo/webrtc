import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { Headphones } from 'lucide-react';
import { convertToKana } from '../utils/helpers';

const GITHUB_BASE = "https://cdn.jsdelivr.net/gh/datto02/luyenvietkanji@main";

interface Vocabulary {
  id: string | number;
  word: string;
  reading: string;
  meaning: string;
  sentence?: string;
  sentenceVi?: string;
  blankWord?: string;
  blankReading?: string;
  wordStartTime?: number;
  wordEndTime?: number;
  sentenceStartTime?: number;
  sentenceEndTime?: number;
}

interface PartData {
  part: number;
  title: string;
  audioPath: string;
  hasSentences?: boolean;
  vocabularies: Vocabulary[];
}

interface DictationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DictationModal({ isOpen, onClose }: DictationModalProps) {
  const [view, setView] = useState<'books' | 'parts' | 'practice'>('books');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const hasFinishedRef = useRef(false);
  // Popup xác nhận trước khi đóng hẳn tool - tránh bấm nhầm dấu X mất tiến
  // trình đang luyện. Mọi nút X đều chỉ mở popup này, nút "Đóng" trong popup
  // mới thật sự gọi handleClose().
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleClose = () => {
    onClose();
    if (hasFinishedRef.current) {
      setTimeout(() => window.dispatchEvent(new CustomEvent('triggerAd')), 500);
      hasFinishedRef.current = false;
    }
  };

  const [bookCache, setBookCache] = useState<Record<string, PartData[]>>({});
  const [partsList, setPartsList] = useState<PartData[]>([]);
  const [selectedBookTitle, setSelectedBookTitle] = useState('');
  const [currentPartIndex, setCurrentPartIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);

      setView('books');
      setPartsList([]);
      hasFinishedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoadBook = async (bookId: string, bookTitle: string) => {
    setSelectedBookTitle(bookTitle);

    if (bookCache[bookId]) {
      setPartsList(bookCache[bookId]);
      setView('parts');
      return;
    }

    setIsLoading(true);
    setProgress(30);
    try {
      const response = await fetch(`${GITHUB_BASE}/data/nghechinhta/${bookId}.json`);
      if (!response.ok) throw new Error("Lỗi tải data");
      const data: PartData[] = await response.json();

      setBookCache(prev => ({ ...prev, [bookId]: data }));
      setPartsList(data);

      setProgress(100);
      setTimeout(() => {
        setView('parts');
        setIsLoading(false);
      }, 400);

    } catch (error) {
      alert("Lỗi tải dữ liệu nghe! Hãy đảm bảo file json tồn tại.");
      setIsLoading(false);
      setProgress(0);
    }
  };

  const renderBooks = () => (
    <div className="flex flex-col h-full bg-blue-900 overflow-hidden relative">
      <div className="flex justify-between items-center px-6 py-5 border-b border-surface-border bg-blue-800 z-10 shadow-sm shrink-0">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Luyện Nghe Chính Tả</h2>
        <button onClick={() => setShowCloseConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer">✕</button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => handleLoadBook('tangon5', 'Tango N5')}
            className="w-full p-5 sm:p-6 bg-blue-700 border-2 border-transparent rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-start active:scale-95 group relative overflow-hidden cursor-pointer"
          >
            <div className="flex justify-between items-center w-full gap-4">
              <span className="text-lg sm:text-xl font-black text-white uppercase text-left leading-tight transition-colors">
                Tango N5
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-blue-100 mt-1.5 text-left">TỪ ĐƠN & VÍ DỤ</span>
          </button>
          <button 
            onClick={() => handleLoadBook('tangon4', 'Tango N4')}
            className="w-full p-5 sm:p-6 bg-blue-700 border-2 border-transparent rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-start active:scale-95 group relative overflow-hidden cursor-pointer"
          >
            <div className="flex justify-between items-center w-full gap-4">
              <span className="text-lg sm:text-xl font-black text-white uppercase text-left leading-tight transition-colors">
                Tango N4
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-blue-100 mt-1.5 text-left">TỪ ĐƠN & VÍ DỤ</span>
          </button>

          <button 
            onClick={() => handleLoadBook('minna1', 'MINNA NO NIHONGO N5')}
            className="w-full p-5 sm:p-6 bg-blue-700 border-2 border-transparent rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-start active:scale-95 group relative overflow-hidden cursor-pointer"
          >
            <div className="flex justify-between items-center w-full gap-4">
              <span className="text-lg sm:text-xl font-black text-white uppercase text-left leading-tight transition-colors">
                MINNA NO NIHONGO N5
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-blue-100 mt-1.5 text-left">TỪ ĐƠN</span>
          </button>
          <button 
            onClick={() => handleLoadBook('minna2', 'MINNA NO NIHONGO N4')}
            className="w-full p-5 sm:p-6 bg-blue-700 border-2 border-transparent rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-start active:scale-95 group relative overflow-hidden cursor-pointer"
          >
            <div className="flex justify-between items-center w-full gap-4">
              <span className="text-lg sm:text-xl font-black text-white uppercase text-left leading-tight transition-colors">
                MINNA NO NIHONGO N4
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-blue-100 mt-1.5 text-left">TỪ ĐƠN</span>
          </button>


        </div>
      </div>
    </div>
  );

  const renderParts = () => (
    <div className="flex flex-col h-full bg-blue-900 overflow-hidden">
      <div className="p-4 bg-blue-800 border-b border-surface-border flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('books')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-[#8fb0ce] transition-colors outline-none cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h2 className="text-sm font-black text-white uppercase">{selectedBookTitle}</h2>
        </div>
        <button onClick={() => setShowCloseConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-red-500/20 hover:text-red-400 transition-all outline-none cursor-pointer">✕</button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
        {partsList.map((part, idx) => (
          <button 
            key={idx}
            onClick={() => { setCurrentPartIndex(idx); setView('practice'); }}
            className="w-full p-4 sm:p-5 bg-blue-700 border-2 border-transparent rounded-xl text-left md:hover:border-blue-300 md:hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-between group outline-none cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black text-white font-sans transition-colors uppercase tracking-wide">{part.title}</span>
              <span className="text-xs font-bold text-blue-100 mt-1">{part.vocabularies?.length || 0} từ vựng</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center md:group-hover:bg-white/25 transition-colors">
              <svg className="w-4 h-4 text-blue-100 md:group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[500] flex justify-center items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-blue-900 w-full h-full sm:h-[90vh] max-w-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative">
        {isLoading && (
          <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center bg-blue-900/90 backdrop-blur-md">
            <div className="text-center">
              <span className="text-xs font-bold text-white uppercase tracking-widest animate-pulse mb-4 block">
                Đang tải dữ liệu... {progress}%
              </span>
              <div className="w-48 bg-white/15 rounded-full h-1.5 overflow-hidden mx-auto">
                <div className="bg-blue-600 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>
        )}

        {view === 'books' && renderBooks()}
        {view === 'parts' && renderParts()}
        {view === 'practice' && (
          <DictationPracticeView 
            lessonData={partsList[currentPartIndex]} 
            onBack={() => setView('parts')}
            onClose={() => setShowCloseConfirm(true)}
            onLessonComplete={() => {
              hasFinishedRef.current = true;
            }}
          />
        )}
      </div>

      {/* Popup xác nhận đóng tool - tránh bấm nhầm dấu X mất tiến trình
          đang luyện (xem showCloseConfirm ở trên). */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[800] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCloseConfirm(false)}>
          <div className="bg-blue-900 border border-surface-border rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl flex flex-col text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-8 flex items-center justify-center gap-2.5">
              <Headphones className="w-5 h-5 text-blue-300 shrink-0" />
              Đóng Nghe chính tả?
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-[#8fb0ce] bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => { setShowCloseConfirm(false); handleClose(); }}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DictationPracticeViewProps {
  lessonData: PartData;
  onBack: () => void;
  onClose: () => void;
  onLessonComplete?: () => void;
}

function DictationPracticeView({ lessonData, onBack, onClose, onLessonComplete }: DictationPracticeViewProps) {
  if (!lessonData || !lessonData.vocabularies) {
    return null;
  }

  const [queue, setQueue] = useState<Vocabulary[]>([]); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong' | 'retyping'>('idle');
  const [userInput, setUserInput] = useState('');
  const [finished, setFinished] = useState(false);
  const [wrongCount, setWrongCount] = useState(0); 
  const [wrongDetected, setWrongDetected] = useState(false); 

  const [mode, setMode] = useState<'word' | 'hidden_word' | 'full_sentence'>('word'); 
  const [showVi, setShowVi] = useState(false); 
  const [showHint, setShowHint] = useState(false); 
  const [isLooping, setIsLooping] = useState(false); 
  const [isAutoReview, setIsAutoReview] = useState(true); 
  const [playbackRate, setPlaybackRate] = useState(1); 

  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const soundRef = useRef<Howl | null>(null);
  const loopTimerRef = useRef<any>(null);

  const currentIndexRef = useRef(currentIndex);
  const queueRef = useRef(queue);
  const modeRef = useRef(mode);
  const isComposing = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const extractBase = (str?: string) => str ? str.replace(/\[(.*?)\]\([^)]+\)/g, '$1') : '';
  const extractRuby = (str?: string) => str ? str.replace(/\[.*?\]\(([^)]+)\)/g, '$1') : '';

  const renderFurigana = (text?: string, isShow?: boolean) => {
    if (!text) return null;
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, index) => {
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <ruby key={index} className="leading-loose mx-0.5">
            {match[1]}
            {isShow && <rt className="text-[11px] sm:text-xs text-blue-300 font-bold select-none"><span className="sm:inline-block sm:-translate-y-0.5">{match[2]}</span></rt>}
          </ruby>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const supportSentence = useMemo(() => {
    if (!lessonData) return true;
    if (lessonData.hasSentences === false) return false;
    if (lessonData.vocabularies) {
      const hasAnySentence = lessonData.vocabularies.some(item => item.sentence && item.sentence.trim() !== '');
      if (!hasAnySentence) return false;
    }
    return true;
  }, [lessonData]);

  useEffect(() => {
    if (!supportSentence && (mode === 'hidden_word' || mode === 'full_sentence')) {
      setMode('word');
    }
  }, [supportSentence, mode]);

  useEffect(() => {
    setStatus('idle');
    setShowHint(false);
    setUserInput('');
    setWrongCount(0);
    if (soundRef.current) {
      soundRef.current.stop();
    }
  }, [mode]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    queueRef.current = queue;
    modeRef.current = mode;
  }, [currentIndex, queue, mode]);

  const initLesson = useCallback((keepAudio = false) => {
    clearTimeout(loopTimerRef.current);
    if (!lessonData || !lessonData.vocabularies) return;

    if (!keepAudio) {
      setIsAudioLoaded(false);
      setIsAudioLoading(false);
      if (soundRef.current) {
        soundRef.current.unload();
        soundRef.current = null;
      }
    } else {
      if (soundRef.current) soundRef.current.stop();
    }

    const shuffled = [...lessonData.vocabularies].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setCurrentIndex(0);
    setStatus('idle');
    setUserInput('');
    setFinished(false);
    setShowHint(false);
    setWrongCount(0);
    setWrongDetected(false);
  }, [lessonData]);

  useEffect(() => {
    initLesson(false); 
    return () => {
      clearTimeout(loopTimerRef.current);
      if (soundRef.current) {
        soundRef.current.unload();
        soundRef.current = null;
      }
    };
  }, [initLesson]);

  const getFullAudioUrl = (audioPath: string) => {
    if (!audioPath) return '';
    if (audioPath.startsWith('http://') || audioPath.startsWith('https://')) return audioPath;
    const cleanPath = audioPath.replace(/^\.\//, '');
    return `${GITHUB_BASE}/${cleanPath}`;
  };

  const playCurrentAudio = useCallback(() => {
    if (queueRef.current.length === 0) return;

    if (!soundRef.current) {
      if (isAudioLoading) return; 
      setIsAudioLoading(true);

      const spriteData: Record<string, [number, number]> = {};
      lessonData.vocabularies.forEach(item => {
        if (item.wordStartTime !== undefined && item.wordEndTime !== undefined) {
          spriteData[`${item.id}_word`] = [item.wordStartTime * 1000, (item.wordEndTime - item.wordStartTime) * 1000];
        }
        if (item.sentenceStartTime !== undefined && item.sentenceEndTime !== undefined) {
          spriteData[`${item.id}_sentence`] = [item.sentenceStartTime * 1000, (item.sentenceEndTime - item.sentenceStartTime) * 1000];
        }
      });

      const fullAudioUrl = getFullAudioUrl(lessonData.audioPath);

      soundRef.current = new Howl({
        src: [fullAudioUrl],
        sprite: spriteData,
        html5: false,
        volume: 1.5,
        preload: true,
        onload: function() {
          this.volume(1.5);
          setIsAudioLoaded(true);
          setIsAudioLoading(false);
          this.rate(playbackRate); 
          
          const currentItem = queueRef.current[currentIndexRef.current];
          if (!currentItem) return;
          const hasSentenceData = Boolean(currentItem.sentence && currentItem.sentence.trim() !== '' && currentItem.sentenceStartTime !== undefined && currentItem.sentenceEndTime !== undefined);
          
          const actualMode = ((modeRef.current === 'hidden_word' || modeRef.current === 'full_sentence') && hasSentenceData) ? 'sentence' : 'word';
          const spriteKey = `${currentItem.id}_${actualMode}`;
          
          this.play(spriteKey);
        },
        onplay: () => setIsPlaying(true),
        onend: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
        onloaderror: () => {
          alert("Lỗi tải file âm thanh! Hãy kiểm tra lại đường truyền.");
          setIsAudioLoaded(false);
          setIsAudioLoading(false);
        }
      });
      return;
    }

    if (!isAudioLoaded) return;
    const currentItem = queueRef.current[currentIndexRef.current];
    if (!currentItem) return;
    
    const hasSentenceData = Boolean(currentItem.sentence && currentItem.sentence.trim() !== '' && currentItem.sentenceStartTime !== undefined && currentItem.sentenceEndTime !== undefined);
    
    const actualMode = ((modeRef.current === 'hidden_word' || modeRef.current === 'full_sentence') && hasSentenceData) ? 'sentence' : 'word';
    const spriteKey = `${currentItem.id}_${actualMode}`;
    
    soundRef.current.volume(1.5);
    soundRef.current.stop(); 
    soundRef.current.play(spriteKey);
  }, [lessonData, isAudioLoaded, isAudioLoading, playbackRate]);

  useEffect(() => {
    if (!finished && queue.length > 0 && isAudioLoaded && soundRef.current) {
      const timer = setTimeout(() => {
        playCurrentAudio();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, finished, mode, playCurrentAudio, isAudioLoaded, queue.length]);

  useEffect(() => {
    if (!isPlaying && isLooping && !finished && isAudioLoaded) {
      loopTimerRef.current = setTimeout(() => {
        playCurrentAudio();
      }, 800);
    }
    return () => clearTimeout(loopTimerRef.current);
  }, [isPlaying, isLooping, finished, isAudioLoaded, playCurrentAudio]);

  useEffect(() => {
    if (soundRef.current) soundRef.current.rate(playbackRate);
  }, [playbackRate]);

  const cyclePlaybackRate = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIdx]);
  };

  const processInput = (val: string) => {
    const currentItem = queue[currentIndex];
    const isRealFullSentence = mode === 'full_sentence' && currentItem?.sentence;

    if (isRealFullSentence) {
      setUserInput(convertToKana(val, ''));
      return;
    }

    const rawTarget = (mode === 'hidden_word' && currentItem?.blankReading) 
                 ? currentItem.blankReading 
                 : (currentItem?.word || currentItem?.reading || '');
                 
    const targetKana = rawTarget.replace(/\[(.*?)\]\((.*?)\)/g, "$1");

    setUserInput(convertToKana(val, targetKana));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isComposing.current) {
      setUserInput(val);
    } else {
      processInput(val);
    }
  };

  const handleCompositionStart = () => { 
    isComposing.current = true; 
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => { 
    isComposing.current = false; 
    processInput((e.target as HTMLInputElement).value);
  };

  const handleManualNext = () => {
    clearTimeout(loopTimerRef.current);
    if (soundRef.current) soundRef.current.stop();
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setStatus('idle');
      setShowHint(false);
      setWrongCount(0);
      setWrongDetected(false);
    }
  };

  const handleManualPrev = () => {
    clearTimeout(loopTimerRef.current);
    if (soundRef.current) soundRef.current.stop();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setUserInput('');
      setStatus('idle');
      setShowHint(false);
      setWrongCount(0);
      setWrongDetected(false);
    }
  };

  const handleShowAnswer = () => {
    const currentItem = queue[currentIndex];
    
    if (!wrongDetected) {
      setQueue(prev => [...prev, currentItem]);
      setWrongDetected(true);
    }

    setShowHint(true);
    setStatus('retyping');
    setUserInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const checkAnswer = () => {
    if (finished) return;
    if (status === 'correct') {
      goToNext();
      return;
    }
    const currentItem = queue[currentIndex];
    let finalInput = userInput.trim();

    if (finalInput.endsWith('n')) {
      finalInput = finalInput.slice(0, -1) + 'ん';
    }

    const hasSentenceData = currentItem.sentence && currentItem.sentence.trim() !== '' && currentItem.sentenceStartTime !== undefined && currentItem.sentenceEndTime !== undefined;
    
    const effectiveMode = ((mode === 'hidden_word' || mode === 'full_sentence') && hasSentenceData) ? mode : 'word';

    const cleanText = (str?: string) => {
      if (!str) return '';
      return str.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3005\u30FC]/g, '');
    };

    let isCorrect = false;
    const cleanInput = cleanText(finalInput);

    if (effectiveMode === 'full_sentence') {
      const buildRegexFromFurigana = (str?: string) => {
        if (!str) return null;
        const regex = /\[(.*?)\]\((.*?)\)/g;
        let lastIndex = 0;
        let match;
        let pattern = "^";
        
        while ((match = regex.exec(str)) !== null) {
          if (match.index > lastIndex) {
            pattern += cleanText(str.slice(lastIndex, match.index));
          }
          const base = cleanText(match[1]);
          const ruby = cleanText(match[2]);
          pattern += `(${base}|${ruby})`;
          
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < str.length) {
          pattern += cleanText(str.slice(lastIndex));
        }
        pattern += "$";
        return new RegExp(pattern);
      };

      const sentenceRegex = buildRegexFromFurigana(currentItem.sentence);
      if (sentenceRegex && sentenceRegex.test(cleanInput)) {
        isCorrect = true;
      }
    } else {
      let targetWordBase = '';
      let targetWordRuby = '';

      if (effectiveMode === 'word') {
        targetWordBase = extractBase(currentItem.word);
        targetWordRuby = extractRuby(currentItem.reading);
      } else {
        targetWordBase = extractBase(currentItem.blankWord || currentItem.word);
        targetWordRuby = extractRuby(currentItem.blankReading || currentItem.reading);
      }
      
      isCorrect = (cleanInput === cleanText(targetWordBase)) || (cleanInput === cleanText(targetWordRuby));
    }

    if (status === 'retyping') {
      if (isCorrect) goToNext();
      else {
        setStatus('wrong');
        playCurrentAudio();
        setTimeout(() => setStatus('retyping'), 400);
      }
      return;
    }

    if (isCorrect) {
      setStatus('correct');
      setWrongCount(0); 
      clearTimeout(loopTimerRef.current);
      
      if (isAutoReview) {
        setTimeout(() => playCurrentAudio(), 100);
      } else {
        setTimeout(() => goToNext(), 400);
      }
    } else {
      const newWrongCount = wrongCount + 1;
      setWrongCount(newWrongCount);
      setStatus('wrong');
      playCurrentAudio(); 
      
      if (!wrongDetected) {
        setQueue(prev => [...prev, currentItem]);
        setWrongDetected(true);
      }

      if (newWrongCount >= 5) {
        setTimeout(() => {
          setShowHint(true);
          setStatus('retyping');
          inputRef.current?.focus();
        }, 500);
      } else {
        setTimeout(() => {
          setStatus('idle');
          inputRef.current?.focus(); 
        }, 500); 
      }
    }
  };

  const goToNext = () => {
    clearTimeout(loopTimerRef.current);
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setStatus('idle');
      setShowHint(false);
      setWrongCount(0);
      setWrongDetected(false); 
    } else {
      setFinished(true);
      if (onLessonComplete) onLessonComplete(); 
    }
  };

  const triggerConfetti = useCallback(() => {
    if (typeof confetti === 'undefined') return;
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });
  }, []);

  useEffect(() => { if (finished) triggerConfetti(); }, [finished, triggerConfetti]);

  const renderMaskedSentence = (rawSentence?: string, word?: string, reading?: string, blankWord?: string) => {
    if (!rawSentence || !word) return null;
    
    const wordToMask = extractBase(blankWord || word);
    const readingText = extractRuby(reading);
    
    const tokens: Array<{ type: 'text' | 'ruby'; raw: string; plain: string; kana?: string }> = [];
    const regex = /\[(.*?)\]\((.*?)\)/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(rawSentence)) !== null) {
      if (match.index > lastIndex) {
        const textPart = rawSentence.slice(lastIndex, match.index);
        tokens.push({ type: 'text', raw: textPart, plain: textPart });
      }
      tokens.push({ type: 'ruby', raw: match[0], plain: match[1], kana: match[2] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < rawSentence.length) {
      const textPart = rawSentence.slice(lastIndex);
      tokens.push({ type: 'text', raw: textPart, plain: textPart });
    }

    const fullPlainText = tokens.map(t => t.plain).join('');
    const startIndex = fullPlainText.indexOf(wordToMask);
    if (startIndex === -1) return <span className="font-sans leading-loose text-white">{renderFurigana(rawSentence, true)}</span>;
    const endIndex = startIndex + wordToMask.length;

    let beforeRaw = "";
    let afterRaw = "";
    let currentPlainIndex = 0;
    for (const token of tokens) {
      const tokenStart = currentPlainIndex;
      const tokenEnd = currentPlainIndex + token.plain.length;
      if (tokenEnd <= startIndex) beforeRaw += token.raw;
      else if (tokenStart >= endIndex) afterRaw += token.raw;
      else {
        if (token.type === 'text') {
          for (let i = 0; i < token.plain.length; i++) {
            const charIndex = tokenStart + i;
            if (charIndex < startIndex) beforeRaw += token.plain[i];
            else if (charIndex >= endIndex) afterRaw += token.plain[i];
          }
        }
      }
      currentPlainIndex = tokenEnd;
    }

    const isRevealed = showHint || status === 'retyping' || (status === 'correct' && isAutoReview);

    return (
      <span className="font-sans leading-loose text-white">
        {renderFurigana(beforeRaw, true)}
        <span className={`px-1.5 mx-1 rounded-md transition-all duration-300 inline-block align-baseline min-w-[50px] leading-none pt-1 pb-0.5 ${isRevealed ? 'bg-green-100 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'text-transparent bg-white/20'}`}>
          {isRevealed ? (
            <span className="font-bold animate-in fade-in duration-300 whitespace-nowrap inline-block leading-none">
              <ruby>
                <span className="text-green-900">{wordToMask}</span>
                {wordToMask !== readingText && (
                  <rt className="text-[11px] sm:text-xs text-blue-700 font-bold select-none"><span className="sm:inline-block sm:-translate-y-0.5">{readingText}</span></rt>
                )}
              </ruby>
            </span>
          ) : (
            <span className="select-none font-bold whitespace-nowrap opacity-0 inline-block leading-none">
              <ruby>
                <span>{wordToMask}</span>
                {wordToMask !== readingText && (
                  <rt className="text-[11px] sm:text-xs font-bold select-none"><span className="sm:inline-block sm:-translate-y-0.5">{readingText}</span></rt>
                )}
              </ruby>
            </span>
          )}
        </span>
        {renderFurigana(afterRaw, true)}
      </span>
    );
  };

  if (queue.length === 0) return null;
  const currentItem = queue[currentIndex];

  const hasSentenceText = currentItem.sentence && currentItem.sentence.trim() !== '' && currentItem.sentenceStartTime !== undefined && currentItem.sentenceEndTime !== undefined;
  
  let effectiveMode = mode;
  if ((mode === 'hidden_word' || mode === 'full_sentence') && !hasSentenceText) {
    effectiveMode = 'word';
  }

  const isCorrectReview = status === 'correct' && isAutoReview; 
  const isWrongReview = showHint || status === 'retyping';      
  const isShowingText = effectiveMode === 'hidden_word' || isCorrectReview || isWrongReview;

  let playBtnSize = "w-20 h-20 sm:w-24 sm:h-24"; 
  let playIconSize = "w-8 h-8 sm:w-10 sm:h-10";
  let sideBtnSize = "w-12 h-12 sm:w-14 sm:h-14"; 
  let sideIconSize = "w-5 h-5 sm:w-6 sm:h-6";

  if (isCorrectReview || isWrongReview || (isShowingText && showVi)) {
    playBtnSize = "w-14 h-14 sm:w-16 sm:h-16"; 
    playIconSize = "w-6 h-6 sm:w-7 sm:h-7";
    sideBtnSize = "w-10 h-10 sm:w-12 sm:h-12";
    sideIconSize = "w-4 h-4 sm:w-5 sm:h-5";
  } else if (isShowingText || showVi) {
    playBtnSize = "w-16 h-16 sm:w-20 sm:h-20"; 
    playIconSize = "w-7 h-7 sm:w-8 sm:h-8";
    sideBtnSize = "w-12 h-12 sm:w-14 sm:h-14";
    sideIconSize = "w-5 h-5 sm:w-6 sm:h-6";
  }

  return (
    <div className="flex flex-col h-full bg-blue-900 overflow-hidden relative">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between z-10 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-[#8fb0ce] hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors outline-none cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          QUAY LẠI
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-black text-white/80 tracking-widest bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
          {currentIndex + 1} / {queue.length}
        </span>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-red-500/20 hover:text-red-400 transition-all outline-none cursor-pointer">✕</button>
      </div>

      {!finished ? (
        <div className="flex-1 flex flex-col p-4 sm:p-6 w-full h-full relative pb-6 sm:pb-10">
          <div className={`transition-all duration-300 ${isInputFocused ? 'flex-1 sm:flex-none sm:hidden' : 'hidden'}`}></div>
        
          <div className="w-full mx-auto mb-2 flex flex-col sm:flex-row gap-2 justify-center items-center bg-white/5 p-1.5 sm:p-2 rounded-2xl border border-white/10 shadow-sm shrink-0"> 
            {supportSentence && (
              <div className="flex w-full sm:w-auto justify-between sm:justify-center gap-1 bg-white/10 p-1 rounded-xl">
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => setMode('word')} className={`flex-1 flex items-center justify-center whitespace-nowrap px-1 sm:px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all outline-none cursor-pointer ${mode === 'word' ? 'bg-blue-700 text-white shadow-md border border-blue-700' : 'text-[#8fb0ce] hover:text-white'}`}>
                  TỪ ĐƠN
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => setMode('hidden_word')} className={`flex-1 flex items-center justify-center whitespace-nowrap px-1 sm:px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all outline-none cursor-pointer ${mode === 'hidden_word' ? 'bg-blue-700 text-white shadow-md border border-blue-700' : 'text-[#8fb0ce] hover:text-white'}`}>
                  TỪ BỊ ẨN
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => setMode('full_sentence')} className={`flex-1 flex items-center justify-center whitespace-nowrap px-1 sm:px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all outline-none cursor-pointer ${mode === 'full_sentence' ? 'bg-blue-700 text-white shadow-md border border-blue-700' : 'text-[#8fb0ce] hover:text-white'}`}>
                  CẢ CÂU
                </button>
              </div>
            )}

            <div className="flex w-full sm:w-auto justify-between sm:justify-center gap-1.5 sm:gap-2">
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setShowVi(!showVi)} className={`flex-1 flex items-center justify-center whitespace-nowrap px-1 sm:px-4 py-1.5 rounded-xl text-[10px] font-bold border transition-all shadow-sm outline-none cursor-pointer ${showVi ? 'bg-blue-700 text-white border-blue-700' : 'bg-white/10 text-[#8fb0ce] border-white/10 hover:bg-white/15'}`}>
                DỊCH
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setIsLooping(!isLooping)} className={`flex-1 flex items-center justify-center whitespace-nowrap px-1 sm:px-4 py-1.5 rounded-xl text-[10px] font-bold border transition-all shadow-sm outline-none cursor-pointer ${isLooping ? 'bg-blue-700 text-white border-blue-700' : 'bg-white/10 text-[#8fb0ce] border-white/10 hover:bg-white/15'}`}>
                LẶP
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setIsAutoReview(!isAutoReview)} className={`flex-1 flex items-center justify-center whitespace-nowrap px-1 sm:px-4 py-1.5 rounded-xl text-[10px] font-bold border transition-all shadow-sm outline-none cursor-pointer ${isAutoReview ? 'bg-blue-700 text-white border-blue-700' : 'bg-white/10 text-[#8fb0ce] border-white/10 hover:bg-white/15'}`}>
                XEM LẠI
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={cyclePlaybackRate} className="flex-1 flex items-center justify-center whitespace-nowrap px-1 sm:px-4 py-1.5 rounded-xl text-[10px] font-bold border transition-all shadow-sm outline-none bg-white/10 text-[#8fb0ce] border-white/10 hover:bg-white/15 cursor-pointer">
                {playbackRate}x
              </button>
            </div>
          </div>

          <div className={`flex flex-col items-center w-full max-w-lg mx-auto gap-4 sm:gap-5 transition-all duration-300 ${isInputFocused ? 'flex-none justify-end sm:flex-1 sm:justify-center' : 'flex-1 justify-center'}`}>
            <div className="flex items-center justify-center gap-4 sm:gap-6 w-full transition-all duration-300 shrink-0">
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleManualPrev}
                disabled={currentIndex === 0}
                className={`${sideBtnSize} rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 outline-none ${currentIndex === 0 ? 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed' : 'bg-white/10 border-2 border-white/15 text-[#8fb0ce] hover:border-white/25 hover:bg-white/15 shadow-sm cursor-pointer'}`}
              >
                <svg className={sideIconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>

              <div className={`transition-all duration-300 ${status === 'correct' ? 'scale-110 opacity-50' : status === 'wrong' ? 'animate-shake' : ''}`}>
                <button 
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={playCurrentAudio}
                  className={`${playBtnSize} rounded-full flex items-center justify-center shadow-md transition-all duration-300 active:scale-90 outline-none cursor-pointer ${isAudioLoading ? 'bg-white/20 cursor-wait' : isPlaying ? 'bg-blue-600 text-white' : 'bg-blue-700 text-white hover:bg-blue-600'}`}
                >
                  {isAudioLoading ? (
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                  ) : isPlaying ? (
                    <svg className={playIconSize} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>
                  ) : (
                    <svg className={`${playIconSize} ml-1`} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 19 12 6 20 6 4"></polygon></svg>
                  )}
                </button>
              </div>

              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleManualNext}
                disabled={currentIndex === queue.length - 1}
                className={`${sideBtnSize} rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 outline-none ${currentIndex === queue.length - 1 ? 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed' : 'bg-white/10 border-2 border-white/15 text-[#8fb0ce] hover:border-white/25 hover:bg-white/15 shadow-sm cursor-pointer'}`}
              >
                <svg className={sideIconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>

            {isShowingText && (
              <div className="w-full flex justify-center animate-in fade-in zoom-in-95 duration-300">
                {(effectiveMode === 'hidden_word' || effectiveMode === 'full_sentence') ? (
                  <div className="text-lg sm:text-xl font-bold text-white text-center w-full leading-loose px-2">
                    {(effectiveMode === 'full_sentence' && !showHint && status !== 'retyping' && !(status === 'correct' && isAutoReview)) ? (
                      <span className="text-white/30 font-sans tracking-widest">＿＿＿＿＿＿＿＿＿＿＿＿</span>
                    ) : effectiveMode === 'full_sentence' ? (
                      <div className="font-sans leading-loose text-white w-full pt-2 break-words">
                        {renderFurigana(currentItem.sentence, true)}
                      </div>
                    ) : (
                      renderMaskedSentence(
                        currentItem.sentence, 
                        currentItem.word, 
                        (effectiveMode === 'hidden_word' && currentItem.blankReading) ? currentItem.blankReading : currentItem.reading, 
                        currentItem.blankWord
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-center flex flex-col items-center justify-center bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-lg inline-flex w-auto min-w-[80px]">
                    <span className={`text-lg sm:text-xl font-black text-blue-700 ${currentItem.word !== currentItem.reading ? 'mb-0.5' : ''}`}>
                      {currentItem.word}
                    </span>
                    {currentItem.word !== currentItem.reading && (
                      <span className="text-sm sm:text-base font-bold text-blue-700 tracking-widest">
                        {currentItem.reading}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {(showVi || (status === 'correct' && isAutoReview)) && (
              <p className="text-[13px] sm:text-sm font-medium text-[#dceaf3] text-center px-4 w-full max-w-md animate-in fade-in slide-in-from-bottom-2">
                {(effectiveMode === 'hidden_word' || effectiveMode === 'full_sentence') ? currentItem.sentenceVi : currentItem.meaning}
              </p>
            )}
          </div>

          <div className="w-full max-w-md mx-auto shrink-0 space-y-2 mt-4">
            <input 
              ref={inputRef}
              type="text" 
              value={userInput} 
              onChange={handleInputChange}
              onCompositionStart={handleCompositionStart} 
              onCompositionEnd={handleCompositionEnd}    
              onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
              onFocus={() => setIsInputFocused(true)} 
              onBlur={() => setIsInputFocused(false)}
              placeholder={status === 'retyping' ? "Nhập lại từ vựng" : "Nhập từ vựng"}
              className={`w-full p-3.5 sm:p-4 text-center text-lg sm:text-xl font-bold border-2 rounded-2xl outline-none transition-all shadow-sm ${status === 'correct' ? 'border-green-500 bg-green-50 text-green-700 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : status === 'wrong' || status === 'retyping' ? 'border-red-500 bg-red-50 text-red-700 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-blue-200 focus:border-blue-600 bg-blue-50 text-blue-900'}`}
            />
            
            <div className="flex justify-between items-center px-2">
              <button onMouseDown={(e) => e.preventDefault()} onClick={handleShowAnswer} disabled={showHint || status === 'retyping'} className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 outline-none cursor-pointer ${showHint || status === 'retyping' ? 'text-white/25 cursor-not-allowed' : 'text-[#dceaf3] hover:text-blue-300 active:scale-95'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                ĐÁP ÁN
              </button>
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-all duration-300 ${status === 'correct' ? 'text-red-400/80 animate-pulse' : 'text-[#8fb0ce]'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>
                {status === 'correct' ? (isAutoReview ? 'Bấm Enter để chuyển câu...' : 'Đang tự động chuyển...') : 'Bấm Enter để kiểm tra'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-6xl mb-6 animate-bounce cursor-pointer hover:scale-125 transition-transform" onClick={triggerConfetti}>🎉</div>
          <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">XUẤT SẮC!</h3>
          <p className="text-[#8fb0ce] mb-8 text-sm font-medium">Bạn đã hoàn thành phần luyện tập chép chính tả.</p>
          <div className="space-y-3 w-full max-w-xs">
            <button onClick={() => initLesson(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[11px] tracking-widest uppercase shadow-lg shadow-blue-200 active:scale-95 transition-all outline-none cursor-pointer">
              HỌC LẠI TỪ ĐẦU
            </button>
            <button onClick={onBack} className="w-full py-4 bg-white/10 border-2 border-white/15 text-[#8fb0ce] hover:text-white hover:border-white/25 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 outline-none cursor-pointer">
              VỀ DANH SÁCH BÀI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

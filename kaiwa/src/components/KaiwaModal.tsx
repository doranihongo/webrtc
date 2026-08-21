import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { Mic } from 'lucide-react';

const GITHUB_BASE = "https://cdn.jsdelivr.net/gh/datto02/luyenvietkanji@main";

interface Dialogue {
  speaker: string;
  ja: string;
  vi: string;
  startTime: number;
  endTime: number;
}

interface Conversation {
  context?: string;
  dialogues: Dialogue[];
}

interface Lesson {
  id?: string;
  title: string;
  translation?: string;
  explanation?: string;
  audioPath: string;
  dialogues?: Dialogue[];
  conversations?: Conversation[];
}

interface Part {
  title: string;
  desc: string;
  lessons: Lesson[];
  startIndex: number;
}

interface KaiwaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

let hasWarnedAudioGlobal = false;

export default function KaiwaModal({ isOpen, onClose }: KaiwaModalProps) {
  const playTimeRef = useRef(0);
  const shouldShowAdRef = useRef(false);

  const handleTick = useCallback(() => {
    playTimeRef.current += 1;
    if (playTimeRef.current >= 300 && !shouldShowAdRef.current) {
      shouldShowAdRef.current = true;
    }
  }, []);

  const handleClose = () => {
    onClose();
    if (shouldShowAdRef.current) {
      setTimeout(() => window.dispatchEvent(new CustomEvent('forceTriggerAd')), 500);
      shouldShowAdRef.current = false;
      playTimeRef.current = 0;
    }
  };

  const MANUAL_PARTS_CONFIG: Record<string, Array<{ title: string; desc: string; lessonCount: number }>> = {
    '42baisotrungcap': [
      { title: "Phần 1", desc: "Gồm 10 bài", lessonCount: 10 },
      { title: "Phần 2", desc: "Gồm 9 bài", lessonCount: 9 },
      { title: "Phần 3", desc: "Gồm 8 bài", lessonCount: 8 },
      { title: "Phần 4", desc: "Gồm 8 bài", lessonCount: 8 },
      { title: "Phần 5", desc: "Gồm 7 bài", lessonCount: 7 }
    ],
    'nameraka': [
      { title: "BIẾN ÂM", desc: "Gồm 6 bài", lessonCount: 6 },
      { title: "HÌNH THÁI HỘI THOẠI", desc: "Gồm 6 bài", lessonCount: 6 },
      { title: "MỤC ĐÍCH HỘI THOẠI", desc: "Gồm 11 bài", lessonCount: 11 }
    ],
    '22baitrungthuongcap': [
      { title: "Phần 1", desc: "Gia đình, người yêu", lessonCount: 5 },
      { title: "Phần 2", desc: "Bạn bè", lessonCount: 5 },
      { title: "Phần 3", desc: "Người quen, hàng xóm", lessonCount: 5 },
      { title: "Phần 4", desc: "Bác sĩ, nhân viên cửa hàng...", lessonCount: 5 },
      { title: "Phần 5", desc: "Đồng nghiệp", lessonCount: 5 },
      { title: "Phần 6", desc: "Cấp trên, cấp dưới", lessonCount: 5 },
      { title: "Phần 7", desc: "Người ngoài công ty, người phỏng vấn", lessonCount: 3 },
      { title: "Phần 8", desc: "Hội thoại dài, bài phát biểu", lessonCount: 8 },
    ]
  };

  const [view, setView] = useState<'categories' | 'parts' | 'list' | 'detail'>('categories');
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPartIdx, setSelectedPartIdx] = useState(0);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [courseCache, setCourseCache] = useState<Record<string, { data: Lesson[]; parts: Part[] }>>({});
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  // Popup xác nhận trước khi đóng hẳn tool - tránh bấm nhầm dấu X mất tiến
  // trình đang luyện. Mọi nút X (ở từng màn: categories/parts/list/detail)
  // đều chỉ mở popup này, KHÔNG gọi handleClose() trực tiếp nữa - chỉ có
  // nút "Đóng" trong popup mới thật sự gọi handleClose().
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setView('categories');
      setIsGuideOpen(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const loadCategory = async (level: string) => {
    if (courseCache[level]) {
      setAllLessons(courseCache[level].data);
      setParts(courseCache[level].parts);
      setView('parts');
      return;
    }

    setIsLoading(true);
    setProgress(20);
    try {
      const response = await fetch(`${GITHUB_BASE}/data/sachkaiwa/sachkaiwa${level}.json`);
      if (!response.ok) throw new Error("Chưa có data");
      const data: Lesson[] = await response.json();

      const config = MANUAL_PARTS_CONFIG[level];
      const chunkedParts: Part[] = [];

      if (config) {
        let currentIndex = 0;
        config.forEach((partConfig) => {
          const lessonsInPart = data.slice(currentIndex, currentIndex + partConfig.lessonCount);
          if (lessonsInPart.length > 0) {
            chunkedParts.push({
              title: partConfig.title,
              desc: partConfig.desc,
              lessons: lessonsInPart,
              startIndex: currentIndex
            });
          }
          currentIndex += partConfig.lessonCount;
        });

        if (currentIndex < data.length) {
          chunkedParts.push({
            title: "Phần bổ sung",
            desc: "Các bài còn lại",
            lessons: data.slice(currentIndex),
            startIndex: currentIndex
          });
        }
      } else {
        const CHUNK_SIZE = 10;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          chunkedParts.push({
            title: `Phần ${Math.floor(i / CHUNK_SIZE) + 1}`,
            desc: `Từ bài ${i + 1} đến bài ${Math.min(i + CHUNK_SIZE, data.length)}`,
            lessons: data.slice(i, i + CHUNK_SIZE),
            startIndex: i
          });
        }
      }

      setCourseCache(prev => ({
        ...prev,
        [level]: {
          data: data,
          parts: chunkedParts
        }
      }));

      setAllLessons(data);
      setParts(chunkedParts);

      setProgress(100);
      setTimeout(() => {
        setView('parts');
        setIsLoading(false);
      }, 400);

    } catch (error) {
      alert(`Đang cập nhật bộ dữ liệu ${level.toUpperCase()}!`);
      setIsLoading(false);
    }
  };

  const renderGuideOverlay = () => (
    <div className="absolute inset-0 z-50 bg-blue-900 flex flex-col animate-in slide-in-from-bottom-10 duration-300">
      <div className="flex justify-between items-center px-6 py-5 border-b border-surface-border bg-blue-800 z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsGuideOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-[#8fb0ce] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">Hướng dẫn học Kaiwa</h2>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar ">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 shadow-sm">
            <h3 className="text-base font-black text-blue-700 uppercase mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Shadowing là gì?
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed font-medium">
              <strong className="text-blue-900">Shadowing</strong> là kỹ thuật luyện nghe nói bằng cách nghe một đoạn hội thoại và lặp lại ngay lập tức giống như một cái bóng bám theo âm thanh gốc. Khác với nghe-lặp-lại truyền thống, bạn phải nói song song với audio.
            </p>
          </div>

          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 shadow-sm">
            <h3 className="text-base font-black text-blue-700 uppercase mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Tại sao lại cần Shadowing?
            </h3>
            <ul className="space-y-3 text-sm text-blue-800 font-medium">
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                <span><strong className="text-blue-900">Ngữ điệu chuẩn xác:</strong> Giúp bạn nắm bắt được sự lên xuống giọng và cách ngắt nghỉ tự nhiên của người Nhật.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                <span><strong className="text-blue-900">Luyện cơ miệng:</strong> Quen với tốc độ nói thật, không bị vấp hay "líu lưỡi" khi giao tiếp.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                <span><strong className="text-blue-900">Phản xạ nhanh:</strong> Rèn luyện não bộ xử lý thông tin âm thanh đồng thời với việc phát âm.</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-wide mb-4">PHƯƠNG PHÁP LUYỆN TẬP</h3>
            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-blue-700 text-white font-black flex items-center justify-center shrink-0">1</div>
                <div>
                  <h4 className="font-black text-blue-900 mb-1 uppercase text-sm tracking-wide">Shadowing câm (Silent Shadowing)</h4>
                  <p className="text-sm text-blue-700 font-medium leading-relaxed">Luyện tập không nói thành lời âm thanh nghe được mà chỉ nhẩm trong đầu. Những đoạn hội thoại có tốc độ nhanh, những mẫu câu khó, trước hết hãy thử với phương pháp này.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-blue-700 text-white font-black flex items-center justify-center shrink-0">2</div>
                <div>
                  <h4 className="font-black text-blue-900 mb-1 uppercase text-sm tracking-wide">Nhẩm theo (Whispering)</h4>
                  <p className="text-sm text-blue-700 font-medium leading-relaxed">Luyện tập không phát âm rõ tiếng nghe được mà chỉ nhẩm lại với tiếng thì thầm. Hãy làm quen với cảm giác của ngữ điệu.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-blue-700 text-white font-black flex items-center justify-center shrink-0">3</div>
                <div>
                  <h4 className="font-black text-blue-900 mb-1 uppercase text-sm tracking-wide">Shadowing nhịp điệu (Prosody Shadowing)</h4>
                  <p className="text-sm text-blue-700 font-medium leading-relaxed">Luyện tập chú trọng đặc biệt tới nhịp điệu và ngữ điệu.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-blue-700 text-white font-black flex items-center justify-center shrink-0">4</div>
                <div>
                  <h4 className="font-black text-blue-900 mb-1 uppercase text-sm tracking-wide">Shadowing nội dung (Contents Shadowing)</h4>
                  <p className="text-sm text-blue-700 font-medium leading-relaxed">Luyện tập có chú ý đến việc hiểu ý nghĩa. Khi đã luyện tập kỹ Shadowing theo nhịp điệu và có thể thực hiện tốt rồi, hãy vừa shadowing vừa hình dung ý nghĩa và bối cảnh.</p>
                </div>
              </div>

              <div className="flex gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center shrink-0">5</div>
                <div>
                  <h4 className="font-black text-blue-900 mb-1 uppercase text-sm tracking-wide">Nhập vai thực chiến</h4>
                  <p className="text-sm text-blue-800 font-medium leading-relaxed mb-3">Dùng công cụ của web để tự giao tiếp như nói chuyện với người thật:</p>
                  <ul className="space-y-2 text-xs font-bold text-blue-700">
                    <li className="flex items-center gap-2"><span className="px-2 py-1 bg-white rounded shadow-sm border border-blue-200">Tập vai A/B</span> Tự động tắt tiếng nhân vật bạn chọn để bạn tự đọc.</li>
                    <li className="flex items-center gap-2"><span className="px-2 py-1 bg-white rounded shadow-sm border border-blue-200">Ẩn lời thoại</span> Làm mờ văn bản ép bạn phản xạ bằng trí nhớ.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="flex flex-col h-full overflow-hidden bg-blue-900 relative">
      {isGuideOpen && renderGuideOverlay()}
      
      <div className="flex justify-between items-center px-6 py-5 border-b border-surface-border bg-blue-800 z-10 shadow-sm shrink-0">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Chọn bộ giáo trình</h2>
        <button onClick={() => setShowCloseConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-red-500/20 hover:text-red-400 transition-all">✕</button>
      </div>
      
      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col gap-4">
          {[
            { id: '42baisotrungcap', title: '42 BÀI KAIWA N5-N3', desc: 'Hội thoại hàng ngày' },
            { id: 'nameraka', title: '23 BÀI KAIWA N3', desc: 'Hội thoại tiếng Nhật tự nhiên' },
            { id: '22baitrungthuongcap', title: '22 BÀI KAIWA N3-N1', desc: 'Hội thoại theo các mối quan hệ' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => loadCategory(item.id)}
              className="w-full p-5 sm:p-6 bg-blue-700 border-2 border-transparent rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-start active:scale-95 group relative overflow-hidden cursor-pointer"
            >
              <div className="flex justify-between items-center w-full gap-4">
                <span className="text-lg sm:text-xl font-black text-white uppercase text-left leading-tight">
                  {item.title}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-bold text-blue-100 mt-1.5 text-left">{item.desc}</span>
            </button>
          ))}
        </div>

        <button 
          onClick={() => setIsGuideOpen(true)} 
          className="mt-4 w-full p-4 sm:p-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-between group transition-all hover:border-blue-400 hover:shadow-md active:scale-95 cursor-pointer"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 text-blue-200 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black text-blue-100 uppercase tracking-wide leading-tight">Hướng dẫn học</span>
              <span className="text-xs sm:text-sm font-bold text-blue-200 mt-0.5">Phương pháp Shadowing & Nhập vai</span>
            </div>
          </div>
          <svg className="w-5 h-5 text-blue-300 group-hover:text-blue-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );

  const renderParts = () => (
    <div className="flex flex-col h-full bg-blue-900 overflow-hidden">
      <div className="p-4 bg-blue-800 border-b border-surface-border flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('categories')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-[#8fb0ce] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h2 className="text-sm font-black text-white uppercase">Chọn phần học</h2>
        </div>
        <button onClick={() => setShowCloseConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-red-500/20 hover:text-red-400 transition-all outline-none cursor-pointer">✕</button>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
        {parts.map((part, idx) => (
          <button 
            key={idx}
            onClick={() => { setSelectedPartIdx(idx); setView('list'); }}
            className="w-full p-5 bg-blue-700 border-2 border-transparent rounded-xl text-left md:hover:border-blue-300 md:hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-between group cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="text-lg font-black text-white font-sans transition-colors uppercase tracking-wide">{part.title}</span>
              <span className="text-xs font-bold text-blue-100 mt-1">{part.desc}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center md:group-hover:bg-white/25 transition-colors">
              <svg className="w-4 h-4 text-blue-100 md:group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderList = () => {
    const currentPart = parts[selectedPartIdx];
    if (!currentPart) return null;

    return (
      <div className="flex flex-col h-full bg-blue-900 overflow-hidden">
        <div className="p-4 bg-blue-800 border-b border-surface-border flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('parts')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-[#8fb0ce] transition-colors cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <h2 className="text-sm font-black text-white uppercase">{currentPart.title}</h2>
          </div>
          <button onClick={() => setShowCloseConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer">✕</button>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto custom-scrollbar flex-1">
          {currentPart.lessons.map((lesson, idx) => {
            const globalIdx = currentPart.startIndex + idx; 
            return (
              <button 
                key={lesson.id || globalIdx}
                onClick={() => { setCurrentLessonIdx(globalIdx); setView('detail'); }}
                className="w-full p-4 bg-blue-700 border-2 border-transparent rounded-xl text-left md:hover:border-blue-300 md:hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-between group cursor-pointer"
              >
                <span className="text-base sm:text-lg font-bold text-white font-sans transition-colors">{lesson.title}</span>
                <span className="text-xs font-bold text-blue-100/70">#{idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[500] flex justify-center items-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
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
        {view === 'categories' && renderCategories()}
        {view === 'parts' && renderParts()}
        {view === 'list' && renderList()}
        
        {view === 'detail' && (
          <KaiwaPracticeView 
            lesson={allLessons[currentLessonIdx]} 
            total={allLessons.length}
            currentIndex={currentLessonIdx}
            onBack={() => setView('list')} 
            onClose={() => setShowCloseConfirm(true)} 
            onNext={() => setCurrentLessonIdx(prev => Math.min(prev + 1, allLessons.length - 1))}
            onPrev={() => setCurrentLessonIdx(prev => Math.max(prev - 1, 0))}
            onTick={handleTick} 
          />
        )}
      </div>

      {/* Popup xác nhận đóng tool - tránh bấm nhầm dấu X mất tiến trình
          đang luyện (xem showCloseConfirm ở trên). z-[800] để luôn nổi trên
          mọi lớp phủ khác của tool (kể cả z-[700] của popup "Hướng dẫn
          nhanh" trong màn luyện tập). */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[800] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCloseConfirm(false)}>
          <div className="bg-blue-900 border border-surface-border rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl flex flex-col text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-8 flex items-center justify-center gap-2.5">
              <Mic className="w-5 h-5 text-blue-300 shrink-0" />
              Đóng Shadowing?
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

// ==========================================
// COMPONENT: KAIWA PRACTICE VIEW
// ==========================================
interface KaiwaPracticeViewProps {
  lesson: Lesson;
  total: number;
  currentIndex: number;
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onTick?: () => void;
}

function KaiwaPracticeView({ lesson, total, currentIndex, onBack, onClose, onNext, onPrev, onTick }: KaiwaPracticeViewProps) {
  if (!lesson) return null;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [roleplayMode, setRoleplayMode] = useState<'all' | 'hideA' | 'hideB'>('all'); 
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true); 
  const [activeIndex, setActiveIndex] = useState(-1);  
  const [showAudioWarning, setShowAudioWarning] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const triggerAudioWarning = () => {
    if (!hasWarnedAudioGlobal) {
      setShowAudioWarning(true);
      hasWarnedAudioGlobal = true;
    }
  };

  const closeAudioWarning = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowAudioWarning(false);
  };
  
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const soundRef = useRef<Howl | null>(null); 
  const timerRef = useRef<number | null>(null); 
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stopAtTimeRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        if (onTick) onTick();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, onTick]);

  const getFullAudioUrl = (audioPath: string) => {
    if (!audioPath) return '';
    if (audioPath.startsWith('http://') || audioPath.startsWith('https://')) return audioPath;
    const cleanPath = audioPath.replace(/^\.\//, '');
    return `${GITHUB_BASE}/${cleanPath}`;
  };

  const initAndPlayAudio = (startTime = 0) => {
    if (isAudioLoading) return;
    setIsAudioLoading(true);

    const fullUrl = getFullAudioUrl(lesson.audioPath);

    const howlInstance = new Howl({
      src: [fullUrl],
      html5: false,
      volume: 1.5,
      preload: true,
      onload: function() {
        if (soundRef.current !== howlInstance) {
          howlInstance.unload(); 
          return; 
        }

        this.volume(1.5);
        setDuration(this.duration());
        setIsAudioLoading(false); 
        
        this.rate(playbackRate); 

        if (startTime > 0) {
          this.seek(startTime);
          setCurrentTime(startTime);
        }
        
        this.play();
        setIsPlaying(true);
        triggerAudioWarning();
      },
      onloaderror: function() {
        if (soundRef.current !== howlInstance) return;
        setIsAudioLoading(false);
        alert("Lỗi tải âm thanh!");
      },
      onend: function() {
        if (soundRef.current !== howlInstance) return;
        this.seek(0);
        setCurrentTime(0);
        this.play();
      }
    });

    soundRef.current = howlInstance;
  };
  
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.unload();
      soundRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveIndex(-1);
    setIsAudioLoading(false);

    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    return () => {
      if (soundRef.current) {
        soundRef.current.unload();
        soundRef.current = null;
      }
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [lesson]);

  useEffect(() => {
    if (soundRef.current) { 
      soundRef.current.rate(playbackRate); 
    }
  }, [playbackRate]);

  useEffect(() => {
    const convs = lesson?.conversations || [{ dialogues: lesson?.dialogues || [] }];
    const flatLines: Dialogue[] = [];
    convs.forEach(conv => {
      (conv.dialogues || []).forEach(line => {
        if (line.startTime !== undefined && line.endTime !== undefined) {
          flatLines.push(line);
        }
      });
    });

    const step = () => {
      if (soundRef.current && isPlaying && !isDragging) {
        const seekTime = soundRef.current.seek() as number;
        
        if (typeof seekTime === 'number') {
          setCurrentTime(seekTime);

          if (stopAtTimeRef.current !== null && seekTime >= stopAtTimeRef.current) {
            soundRef.current.pause();
            setIsPlaying(false);
            stopAtTimeRef.current = null;
            return;
          } 
          
          let foundIndex = -1;
          let currentSpeaker: string | null = null;

          for (let i = 0; i < flatLines.length; i++) {
            const line = flatLines[i];
            
            if (seekTime >= line.startTime && seekTime <= line.endTime) {
              foundIndex = i;
            }

            const lookaheadTime = seekTime + 0.05;
            const isMutedCharacter = (roleplayMode === 'hideA' && line.speaker === 'A') || 
                                     (roleplayMode === 'hideB' && line.speaker === 'B');
            
            if (isMutedCharacter && lookaheadTime >= line.startTime && seekTime <= line.endTime) {
              currentSpeaker = line.speaker;
            }
          }

          if (foundIndex !== activeIndex) {
            setActiveIndex(foundIndex);
            if (foundIndex !== -1 && isAutoScroll && lineRefs.current[foundIndex]) {
              lineRefs.current[foundIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }

          const shouldMute = !!currentSpeaker;
          if (shouldMute !== isMutedRef.current) {
            soundRef.current.mute(shouldMute);
            isMutedRef.current = shouldMute;
          }
        }
      } else if (soundRef.current && !isPlaying) {
        if (isMutedRef.current) {
          soundRef.current.mute(false);
          isMutedRef.current = false;
        }
      }
      
      timerRef.current = requestAnimationFrame(step);
    };

    if (isPlaying) {
      timerRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isPlaying, roleplayMode, isAutoScroll, activeIndex, isDragging, lesson]);

  const toggleAudio = () => {
    if (isAudioLoading) return;
    
    if (!soundRef.current) {
      initAndPlayAudio(0);
      return;
    }

    if (isPlaying) {
      soundRef.current.pause();
      setIsPlaying(false);
    } else {
      stopAtTimeRef.current = null; 
      soundRef.current.play();
      setIsPlaying(true);
      triggerAudioWarning();
    }
  };
  
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAudioLoading) return;
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (soundRef.current) { 
      soundRef.current.seek(time); 
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIdx]);
  };

  const renderFurigana = (text: string, isShow: boolean) => {
    if (!text) return null;
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, index) => {
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <ruby key={index} className="leading-loose">
            {match[1]}
            {isShow && <rt className="text-[11px] sm:text-xs text-blue-700 font-bold select-none"><span className="sm:inline-block sm:-translate-y-0.5">{match[2]}</span></rt>}
          </ruby>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderMarkedText = (text: string, isShowFuri: boolean) => {
    if (!text) return null;
    const parts = text.split(/(_[^_]+_)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('_') && part.endsWith('_')) {
        const innerText = part.slice(1, -1);
        return (
          <span key={index} className="text-orange-800">
            {renderFurigana(innerText, isShowFuri)}
          </span>
        );
      }
      return <React.Fragment key={index}>{renderFurigana(part, isShowFuri)}</React.Fragment>;
    });
  };

  let globalLineIndex = 0;

  return (
    <div className="flex flex-col h-full bg-blue-900 overflow-hidden relative">
      <div className="px-4 py-3 bg-blue-800 border-b border-surface-border flex items-center justify-between sticky top-0 z-10 shadow-sm relative">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-[#8fb0ce] hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors relative z-10 cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          QUAY LẠI
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-black text-[#dceaf3] tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/10">
          {currentIndex + 1} / {total}
        </span>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-red-500/20 hover:text-red-400 transition-all relative z-10 cursor-pointer">✕</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-8 custom-scrollbar">
        <div className="mb-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight font-sans">{lesson.title}</h2>
          {lesson.translation && <p className="text-sm sm:text-base font-medium text-[#8fb0ce] italic">{lesson.translation}</p>}
        </div>

        {lesson.explanation && (
          <div className="bg-blue-50 border-l-4 border-blue-600 p-3 sm:p-4 rounded-r-xl mb-6">
            <p className="text-sm text-blue-800 leading-relaxed font-medium">
              <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest block mb-1">💡 Giải thích</span>
              {String(lesson.explanation)
                .replace(/\\n/g, '\n') 
                .split('\n')
                .map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-between items-center mb-6 pb-4 border-b border-surface-border">
          <div className="flex bg-white/10 p-1 rounded-xl">
            <button onClick={() => setRoleplayMode('all')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${roleplayMode === 'all' ? 'bg-blue-700 shadow-md text-white' : 'text-[#8fb0ce] hover:text-white'}`}>Nghe hết</button>
            <button onClick={() => setRoleplayMode('hideA')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${roleplayMode === 'hideA' ? 'bg-blue-700 text-white shadow-md' : 'text-[#8fb0ce] hover:text-white'}`}>Tập vai A</button>
            <button onClick={() => setRoleplayMode('hideB')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${roleplayMode === 'hideB' ? 'bg-blue-700 text-white shadow-md' : 'text-[#8fb0ce] hover:text-white'}`}>Tập vai B</button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {roleplayMode !== 'all' && (
              <label className="flex items-center gap-2 cursor-pointer bg-white/10 px-3 py-1.5 sm:py-2 rounded-lg border border-white/10 hover:bg-white/15 transition-colors animate-in zoom-in-95 duration-200">
                <span className={`text-[10px] sm:text-xs font-bold uppercase transition-colors ${hideText ? 'text-white' : 'text-[#8fb0ce]'}`}>Ẩn lời thoại</span>
                <input type="checkbox" checked={hideText} onChange={() => setHideText(!hideText)} className="accent-blue-800 bg-white/20 border border-white/25 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer bg-white/10 px-3 py-1.5 sm:py-2 rounded-lg border border-white/10 hover:bg-white/15 transition-colors">
              <span className={`text-[10px] sm:text-xs font-bold uppercase transition-colors ${isAutoScroll ? 'text-white' : 'text-[#8fb0ce]'}`}>Tự cuộn</span>
              <input type="checkbox" checked={isAutoScroll} onChange={() => setIsAutoScroll(!isAutoScroll)} className="accent-blue-800 bg-white/20 border border-white/25 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white/10 px-3 py-1.5 sm:py-2 rounded-lg border border-white/10 hover:bg-white/15 transition-colors">
              <span className={`text-[10px] sm:text-xs font-bold uppercase transition-colors ${showFurigana ? 'text-white' : 'text-[#8fb0ce]'}`}>Furigana</span>
              <input type="checkbox" checked={showFurigana} onChange={() => setShowFurigana(!showFurigana)} className="accent-blue-800 bg-white/20 border border-white/25 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white/10 px-3 py-1.5 sm:py-2 rounded-lg border border-white/10 hover:bg-white/15 transition-colors">
              <span className={`text-[10px] sm:text-xs font-bold uppercase transition-colors ${showTranslation ? 'text-white' : 'text-[#8fb0ce]'}`}>Dịch</span>
              <input type="checkbox" checked={showTranslation} onChange={() => setShowTranslation(!showTranslation)} className="accent-blue-800 bg-white/20 border border-white/25 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
            </label>
          </div>
        </div>

        <div className="space-y-8"> 
          {(lesson?.conversations || [{ dialogues: lesson?.dialogues || [] }]).map((conv, convIdx, arr) => (
            <div key={convIdx} className="space-y-4 relative">
              {arr.length > 1 && (
                <div className="flex items-center gap-4 mb-6 mt-2">
                  <div className="h-px bg-white/15 flex-1"></div>
                  <span className="text-[10px] font-black text-[#6f94b8] uppercase tracking-widest bg-blue-800 px-3 py-1 rounded-full border border-surface-border shadow-sm">
                    {conv.context ? conv.context : `Đoạn hội thoại ${convIdx + 1}`}
                  </span>
                  <div className="h-px bg-white/15 flex-1"></div>
                </div>
              )}

              {(conv.dialogues || []).map((line, idx) => {
                const currentFlatIndex = globalLineIndex++; 
                const isActive = activeIndex === currentFlatIndex; 
                
                const isMutedRole = (roleplayMode === 'hideA' && line.speaker === 'A') || 
                                    (roleplayMode === 'hideB' && line.speaker === 'B');
                const isHidden = isMutedRole && hideText; 
                
                const isA = line.speaker === 'A';
                
                let boxClass = isA 
                  ? 'bg-blue-50 border-blue-200 text-blue-900 rounded-2xl rounded-tl-sm' 
                  : 'bg-blue-50 border-blue-600 text-blue-900 rounded-2xl rounded-tr-sm border-2 shadow-md';

                if (isActive) {
                  boxClass = isA 
                    ? 'bg-green-50 border-[2px] border-green-500 text-green-900 rounded-2xl rounded-tl-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]' 
                    : 'bg-green-50 border-[2px] border-green-500 text-green-900 rounded-2xl rounded-tr-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]';
                }

                return (
                  <div 
                    key={`${convIdx}-${idx}`} 
                    ref={(el) => { lineRefs.current[currentFlatIndex] = el; }}
                    className={`flex flex-col w-full ${isA ? 'items-start' : 'items-end'} transition-all duration-300`}
                  >
                    <span className={`text-[9px] font-black uppercase tracking-widest mb-1 px-1 transition-colors ${isActive ? 'text-green-400' : 'text-[#8fb0ce]'}`}>
                      Người {line.speaker}
                    </span>
                    <div 
                      onClick={() => {
                        if (line.startTime === undefined) return;
                        if (isAudioLoading) return;
                        
                        if (!soundRef.current) {
                          stopAtTimeRef.current = line.endTime;
                          initAndPlayAudio(line.startTime);
                          return;
                        }

                        soundRef.current.seek(line.startTime);
                        setCurrentTime(line.startTime);
                        
                        if (isPlaying && stopAtTimeRef.current === null) {
                          stopAtTimeRef.current = null;
                        } else {
                          stopAtTimeRef.current = line.endTime;
                          if (!isPlaying) {
                            soundRef.current.play();
                            setIsPlaying(true);
                            triggerAudioWarning();
                          }
                        }
                      }}
                      title="Bấm để nghe câu này"
                      className={`max-w-[80%] md:max-w-[65%] p-3 sm:p-4 shadow-sm border transition-all duration-300 cursor-pointer hover:shadow-md active:scale-[0.98] ${boxClass}`}
                    >
                      <p className={`text-base sm:text-lg font-bold leading-relaxed font-sans transition-all duration-300 ${isHidden ? 'filter blur-[4px] opacity-40 select-none' : ''}`}>
                        {isHidden ? "（あなたが話す番です）" : renderMarkedText(line.ja, showFurigana)}
                      </p>
                      {showTranslation && (
                        <p className={`text-sm sm:text-base mt-2 font-medium border-t pt-2 transition-colors ${isActive ? 'text-green-700 border-green-300' : 'text-blue-700 border-blue-200'}`}>
                          {line.vi}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full shrink-0 bg-blue-800 border-t border-surface-border px-4 py-3 flex flex-col gap-2 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="flex items-center gap-3 w-full">
          <span className="text-[10px] font-bold text-[#dceaf3] w-8 text-right">{formatTime(currentTime)}</span>
          <input
            type="range" min={0} max={duration || 100} value={currentTime}
            onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)} onTouchEnd={() => setIsDragging(false)}
            onChange={handleSeek}
            className="flex-1 h-1.5 accent-blue-400 bg-white/25 rounded-full appearance-none cursor-pointer"
          />
          <span className="text-[10px] font-bold text-[#dceaf3] w-8">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <button onClick={cyclePlaybackRate} className="w-12 py-1.5 text-[10px] font-black text-[#8fb0ce] bg-white/10 rounded-md hover:bg-white/15 transition-colors active:scale-95 text-center cursor-pointer">
            {playbackRate}x
          </button>
          <div className="flex items-center gap-1 sm:gap-3">
            <button onClick={onPrev} disabled={currentIndex === 0} className={`p-2 rounded-full transition-all active:scale-90 cursor-pointer ${currentIndex === 0 ? 'text-white/25 cursor-not-allowed' : 'text-[#8fb0ce] hover:text-white hover:bg-white/10'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button onClick={() => { if(soundRef.current) { const cur = soundRef.current.seek() as number; soundRef.current.seek(Math.max(0, cur - 3)); setCurrentTime(Math.max(0, cur - 3)); } }} className="p-2 text-[#6f94b8] hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer" title="Lùi 3 giây">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
            <button 
              onClick={toggleAudio} 
              disabled={isAudioLoading} 
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md mx-1 cursor-pointer ${isAudioLoading ? 'bg-white/20 cursor-not-allowed' : 'bg-blue-700 text-white hover:bg-blue-600 active:scale-90'}`}
            >
              {isAudioLoading ? (
                <div className="flex space-x-1 justify-center items-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              ) : isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><polygon points="6 4 19 12 6 20 6 4"></polygon></svg>
              )}
            </button>
            <button onClick={() => { if(soundRef.current) { const cur = soundRef.current.seek() as number; soundRef.current.seek(Math.min(duration, cur + 3)); setCurrentTime(Math.min(duration, cur + 3)); } }} className="p-2 text-[#6f94b8] hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer" title="Tiến 3 giây">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
            <button onClick={onNext} disabled={currentIndex === total - 1} className={`p-2 rounded-full transition-all active:scale-90 cursor-pointer ${currentIndex === total - 1 ? 'text-white/25 cursor-not-allowed' : 'text-[#8fb0ce] hover:text-white hover:bg-white/10'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div className="w-12 flex justify-end">
            <button 
              onClick={() => setIsGuideOpen(true)} 
              className="w-9 h-9 flex items-center justify-center rounded-full text-[#6f94b8] hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
              title="Hướng dẫn nhanh"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showAudioWarning && (
        <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2 w-[90%] max-w-[340px] bg-blue-800/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 border border-surface-border-strong">
          <div className="flex flex-col">
            <span className="text-center text-[11px] font-black text-amber-400 uppercase tracking-widest mb-1">
              Lưu ý âm thanh
            </span>
            <span className="text-left text-[13px] leading-relaxed font-medium text-[#dceaf3] mt-2 mb-4">
              Nếu không nghe thấy tiếng, hãy đảm bảo máy đã tắt <b className="text-white">Chế độ Im lặng</b> và thử <b className="text-white">tăng âm lượng</b> lên nhé!
            </span>
            <button onClick={closeAudioWarning} className="w-full py-2.5 bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all shadow-sm cursor-pointer">
              Đã hiểu
            </button>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-surface-panel"></div>
        </div>
      )}

      {isGuideOpen && (
        <div 
          className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
          onClick={() => setIsGuideOpen(false)}
        >
          <div 
            className="bg-blue-900 rounded-3xl shadow-2xl w-full max-w-[380px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-surface-border cursor-default" 
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-surface-border bg-blue-800 flex justify-between items-center shrink-0">
              <h3 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-[#8fb0ce]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Hướng dẫn nhanh
              </h3>
              <button onClick={() => setIsGuideOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 border border-white/10 text-[#8fb0ce] hover:text-white hover:bg-white/15 transition-all shadow-sm cursor-pointer">✕</button>
            </div>

            <div className="p-5 space-y-5">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                <h4 className="text-xs font-black text-blue-900 uppercase mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  Lưu ý Âm thanh
                </h4>
                <p className="text-sm text-blue-800 font-medium leading-relaxed">
                  Không nghe thấy tiếng? Hãy kiểm tra xem điện thoại có đang bật <b>"Chế độ Im lặng"</b> (Gạt rung) không, nếu có thì hãy tắt nó đi và thử <b>tăng âm lượng</b> nhé.
                </p>
              </div>

              <div>
                <ul className="space-y-3">
                  <li className="flex gap-3 items-start p-3 bg-blue-50 border border-blue-200 rounded-xl shadow-sm hover:border-blue-400 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-blue-900 mb-0.5 leading-tight">Phát lại một câu</span>
                      <span className="block text-xs text-blue-700 font-medium leading-relaxed">Bấm trực tiếp vào <b>câu thoại</b>, hệ thống sẽ tự tua và đọc lại.</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-surface-border bg-blue-800 shrink-0">
              <button 
                onClick={() => setIsGuideOpen(false)}
                className="w-full py-3.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 uppercase tracking-widest cursor-pointer"
              >
                Đã rõ, Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

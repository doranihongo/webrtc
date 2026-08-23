import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, ExternalLink, Languages, ListChecks, ChevronDown, MonitorPlay, Layers, Volume2 } from 'lucide-react';
import { useCourses } from '../context/CoursesContext';
import { useCallEmbed } from '../hooks/useCallEmbed';
import CallControls from './CallControls';
import SlideShow from './SlideShow';
import Blackboard from './Blackboard';
import NotePad from './NotePad';
import FlashcardModal from './FlashcardModal';
import { getVocabAudioUrl, getPooledVocabAudio, preloadLessonVocabAudio } from '../utils/vocabAudioCache';
import { probeSlideImages } from '../utils/probeSlideImages';
import type { VocabWord, GrammarPoint } from '../types';

/**
 * Trang chi tiết 1 bài học.
 *   - "Tài liệu" (học viên): `lesson.lessonFileUrl` - luôn mở ra TAB MỚI
 *     (thường là link Google Drive chia sẻ, không phải file trực tiếp nên
 *     không nhúng được trong app - Drive cần phiên đăng nhập riêng của
 *     Google, không đi kèm cookie đăng nhập của web này).
 *   - "Slide" (chỉ giáo viên/admin): `lesson.slideFolder` - 1 thư mục ảnh
 *     đặt tên tuần tự (1.svg/2.svg/...), hệ thống tự DÒ ra danh sách rồi
 *     hiển thị bằng SlideShow.tsx (component ảnh đơn giản, không PDF.js) -
 *     xem effect dò slide bên dưới, utils/probeSlideImages.ts và types.ts.
 */
export default function LessonView({ courseId, lessonId, onBack, onHome }: {
  courseId: string,
  lessonId: string,
  onBack: () => void,
  onHome: () => void,
  onSelectLesson?: (cId: string, lId: string) => void
}) {
  const { courses, loadedCourseDetails, detailsLoading } = useCourses();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // "NỘI DUNG BUỔI HỌC": Từ vựng/Ngữ pháp thu gọn mặc định, bấm tiêu đề mới
  // trượt ra danh sách - chỉ 1 mục mở tại 1 thời điểm (bố cục/hành vi giống
  // hệt khối "NỘI DUNG BUỔI HỌC" Kanji/Từ vựng của dự án "Xóa mù Kanji").
  const [activeContentTab, setActiveContentTab] = useState<'vocab' | 'grammar' | null>(null);
  // true = đang mở flashcard ôn từ vựng (logic/giao diện y hệt FlashcardModal
  // của dự án "Xóa mù Kanji", xem kaiwa/src/components/FlashcardModal.tsx)
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  // true = đang mở khu vực slide trình chiếu cho giáo viên
  const [teacherSlideOpen, setTeacherSlideOpen] = useState(false);
  // Bảng đen/Ghi chú (chỉ dùng trong lúc trình chiếu Slide, xem SlideShow.tsx)
  // - state giữ Ở ĐÂY (không giữ trong SlideShow) để nội dung KHÔNG mất khi
  // đóng/mở lại Slide (SlideShow unmount/remount mỗi lần bật/tắt, còn
  // LessonView thì không - vẫn 1 instance suốt buổi học, xem lessonKey bên
  // dưới). Chỉ mất khi thực sự sang buổi học khác (lessonKey đổi, xem
  // effect reset bên dưới) - đúng yêu cầu, tránh nội dung buổi này lẫn
  // sang buổi khác.
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const { showCallControls, isPipActive, userRole } = useCallEmbed();
  // Chỉ giaovien/admin mới thấy nút "Slide" - học viên không có.
  const isTeacherOrAdmin = userRole === 'giaovien' || userRole === 'admin';

  // --- Phát audio phát âm khi bấm vào thẻ từ vựng ---
  // Khoá nhận diện 1 buổi học, dùng để tải ngầm/cache audio riêng theo từng
  // buổi (xem utils/vocabAudioCache.ts) - vào lại đúng buổi này thì dùng
  // ngay cache cũ, sang buổi khác mới tải lại + xoá cache buổi trước.
  const lessonKey = `${courseId}_${lessonId}`;

  // Sang buổi học khác (lessonKey đổi) -> xoá nội dung Bảng đen/Ghi chú của
  // buổi cũ (đóng luôn nếu đang mở) - key={lessonKey} truyền cho
  // Blackboard/NotePad bên dưới lo phần remount (xoá canvas/nội dung thật
  // sự), effect này chỉ lo phần state/hiển thị ở LessonView.
  useEffect(() => {
    setIsBoardOpen(false);
    setIsNoteOpen(false);
    setNoteText('');
  }, [lessonKey]);

  // id của từ đang phát (để hiện icon loa nhấp nháy đúng thẻ), null = không phát.
  const [playingVocabId, setPlayingVocabId] = useState<string | null>(null);
  const vocabAudioRef = useRef<HTMLAudioElement | null>(null);

  const playVocabAudio = (v: VocabWord) => {
    if (v.noAudio) return; // từ không có audio, xem types.ts
    // Bấm lại đúng thẻ đang phát -> dừng luôn (toggle).
    if (playingVocabId === v.id) {
      vocabAudioRef.current?.pause();
      setPlayingVocabId(null);
      return;
    }
    vocabAudioRef.current?.pause();
    // Dùng lại audio đã tải ngầm sẵn (phát tức thì) nếu có, không thì tạo
    // mới (vd vừa vào buổi, chưa tải ngầm xong kịp).
    const pooled = getPooledVocabAudio(lessonKey, v.id);
    const audio = pooled || new Audio(getVocabAudioUrl(v.word, v.reading, v.targetKanji));
    if (pooled) {
      try {
        audio.currentTime = 0;
      } catch {
        /* bỏ qua */
      }
    }
    vocabAudioRef.current = audio;
    setPlayingVocabId(v.id);
    audio.onended = () => setPlayingVocabId((cur) => (cur === v.id ? null : cur));
    audio.onerror = () => setPlayingVocabId((cur) => (cur === v.id ? null : cur));
    audio.play().catch(() => setPlayingVocabId((cur) => (cur === v.id ? null : cur)));
  };

  // Dừng audio đang phát khi rời trang buổi học (KHÔNG xoá cache đã tải
  // ngầm - cache sống ở module-level, cố tình giữ nguyên qua unmount).
  useEffect(() => {
    return () => {
      vocabAudioRef.current?.pause();
    };
  }, []);

  const course = courses.find(
    c => String(c.id).trim().normalize('NFC') === String(courseId).trim().normalize('NFC')
  );

  const lessons = loadedCourseDetails?.courseId === courseId ? loadedCourseDetails.lessons : [];

  const lesson = lessons.find(
    (l: any) => String(l.id).trim().normalize('NFC') === String(lessonId).trim().normalize('NFC')
  );

  const vocabulary: VocabWord[] = lesson?.vocabulary || [];
  const grammar: GrammarPoint[] = lesson?.grammar || [];

  // Vào buổi học -> tải ngầm audio phát âm của TOÀN BỘ từ vựng ngay (không
  // cần bấm mới tải). lessonKey đổi (sang buổi khác) mới tải lại + xoá
  // cache buổi trước - xem utils/vocabAudioCache.ts.
  useEffect(() => {
    if (!lesson || vocabulary.length === 0) return;
    preloadLessonVocabAudio(lessonKey, vocabulary);
  }, [lessonKey, lesson, vocabulary]);

  // --- Tài liệu bài học (học viên) ---
  const lessonFileUrl: string | undefined = lesson?.lessonFileUrl?.trim();
  const hasLessonFile = !!lessonFileUrl;

  /** Luôn mở tab mới - xem giải thích ở comment đầu file. */
  const openLessonFile = () => {
    if (!hasLessonFile) return;
    window.open(lessonFileUrl, '_blank', 'noopener,noreferrer');
  };

  // --- Slide trình chiếu (giáo viên/admin) ---
  // Ưu tiên `slideCount` (gõ tay trong Supabase, xem types.ts) - biết sẵn
  // số trang thì sinh thẳng mảng URL, KHÔNG cần dò gì cả, nút "Slide" bật
  // ngay tức thì. Chỉ rơi về dò qua `slideFolder` (probeSlideImages.ts,
  // thử tải 1.svg/2.svg/... tới khi 404 thì dừng - chậm, từng khiến nút
  // "Slide" kẹt ở "Đang tải..." rất lâu với buổi học nhiều trang) khi
  // buổi học đó chưa kịp điền `slideCount`.
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [slideProbing, setSlideProbing] = useState(false);

  useEffect(() => {
    setSlideImages([]);
    if (!lesson || !lesson.slideFolder) return;

    if (lesson.slideCount && lesson.slideCount > 0) {
      const base = lesson.slideFolder.endsWith('/') ? lesson.slideFolder : `${lesson.slideFolder}/`;
      const ext = lesson.slideExt || 'svg';
      setSlideImages(
        Array.from({ length: lesson.slideCount }, (_, i) => `${base}${i + 1}.${ext}`),
      );
      return;
    }

    let cancelled = false;
    setSlideProbing(true);
    probeSlideImages(lesson.slideFolder, { ext: lesson.slideExt })
      .then((urls) => {
        if (!cancelled) setSlideImages(urls);
      })
      .finally(() => {
        if (!cancelled) setSlideProbing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey, lesson?.slideFolder, lesson?.slideExt, lesson?.slideCount]);

  const hasSlideImages = slideImages.length > 0;

  // Preload TRƯỚC toàn bộ ảnh slide ngay khi biết danh sách - KHÔNG đợi
  // giáo viên bấm "Slide" mới bắt đầu tải như trước (SlideShow.tsx chỉ
  // preload lúc mount, tức là sau khi bấm). Chạy sớm nhất có thể (ngay
  // khi vào trang buổi học) cho ảnh có nhiều thời gian nằm sẵn trong cache
  // HTTP của trình duyệt trước khi thực sự cần.
  // Chỉ chạy cho giáo viên/admin (học viên không thấy nút "Slide", preload
  // cho họ chỉ tốn băng thông vô ích).
  // Trang 1 nạp RIÊNG/trước (fetchPriority "high") để chắc chắn có sẵn sớm
  // nhất dù thứ tự trình duyệt xử lý các request khác thế nào; các trang
  // còn lại nạp "low" - trình duyệt tự giới hạn ~6 kết nối song song/domain
  // nên tự động thành từng cụm trước-sau, không cần tự chia lô thủ công.
  //
  // Nút "Slide" bật ngay khi PRELOAD_GATE_COUNT trang ĐẦU đã xong thật sự
  // (xem slideGateReady/hasSlideImages ở nút bên dưới) - không đợi cả buổi
  // học (có thể vài chục trang, rất nặng nếu là SVG Canva xuất ra) mới cho
  // bấm vào, chỉ cần đủ để mở lên là xem mượt ngay từ trang 1. Các trang
  // từ PRELOAD_GATE_COUNT+1 trở đi vẫn được nạp CÙNG LÚC (không đợi mở
  // Slide mới bắt đầu) - chỉ là không tính vào điều kiện bật nút, cứ âm
  // thầm tải tiếp phía sau trong lúc giáo viên đã xem các trang đầu.
  //
  // Dùng img.decode() thay vì chỉ nghe onload: onload chỉ báo đã tải xong
  // BYTE ảnh, chưa chắc trình duyệt đã GIẢI MÃ xong thành bitmap sẵn sàng
  // vẽ - ảnh SVG nặng (Canva xuất ra, cao/nhiều chi tiết) decode có thể mất
  // cả giây dù đã nằm sẵn trong cache, gây khựng 1 nhịp đúng lúc <img> thật
  // sự vẽ ra (SlideShow.tsx) dù coi như đã "tải xong". decode() đợi ĐÚNG
  // bước đó luôn, nên preload xong là vẽ ra tức thì, không còn khựng.
  // Fallback về onload/onerror cho trình duyệt hiếm không hỗ trợ decode().
  const PRELOAD_GATE_COUNT = 5;
  const [preloadedCount, setPreloadedCount] = useState(0);
  const gateCount = Math.min(PRELOAD_GATE_COUNT, slideImages.length);

  useEffect(() => {
    setPreloadedCount(0);
    if (!isTeacherOrAdmin || slideImages.length === 0) return;
    let cancelled = false;
    const markLoaded = () => {
      if (!cancelled) setPreloadedCount((c) => c + 1);
    };

    const preloadOne = (url: string, priority: 'high' | 'low') => {
      const img = new Image();
      (img as any).fetchPriority = priority;
      img.src = url;
      if (typeof img.decode === 'function') {
        img.decode().then(markLoaded).catch(markLoaded);
      } else {
        img.onload = markLoaded;
        img.onerror = markLoaded;
      }
    };

    // PRELOAD_GATE_COUNT trang đầu ưu tiên "high" (đây là nhóm quyết định
    // lúc nào nút bật) - từ đó trở đi "low" (chạy nền, không ai đang chờ).
    slideImages.forEach((url, i) => preloadOne(url, i < PRELOAD_GATE_COUNT ? 'high' : 'low'));

    return () => {
      cancelled = true;
    };
  }, [isTeacherOrAdmin, slideImages]);

  // Đủ PRELOAD_GATE_COUNT trang đầu là bật nút - KHÔNG đợi hết toàn bộ
  // buổi học (xem effect preload phía trên).
  const slideGateReady = hasSlideImages && preloadedCount >= gateCount;
  const slidePreloadPercent =
    gateCount > 0 ? Math.min(100, Math.round((preloadedCount / gateCount) * 100)) : 0;
  // "Đang tải" hiện khi đang dò slideFolder (buổi học chưa có slideCount)
  // HOẶC đã biết danh sách nhưng nhóm trang đầu chưa tải xong.
  const slideButtonBusy = slideProbing || (hasSlideImages && !slideGateReady);

  const toggleContentTab = (tab: 'vocab' | 'grammar') => {
    setActiveContentTab((prev) => (prev === tab ? null : tab));
  };

  if (detailsLoading) {
    return (
      <div className="flex justify-center items-center p-12 min-h-screen">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col font-sans h-full">
      {/* Header Navigation */}
      <nav className="h-16 flex-shrink-0 px-6 flex items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-md z-50 sticky top-0">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="hover:bg-white/10 text-white p-2 rounded-lg transition-colors border border-transparent mr-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img src="https://i.ibb.co/GvC0pFmy/Logo-tr-ng.png" alt="DORA" className="h-8 object-contain -mt-[5px]" />
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            {showCallControls ? (
              <CallControls isPipActive={isPipActive} />
            ) : (
              <button onClick={() => setShowExitConfirm(true)} className="h-10 px-3 sm:px-4 hover:text-blue-200 transition-colors uppercase border border-white/20 rounded-lg hover:border-white/40 text-xs sm:text-sm font-semibold text-white flex items-center justify-center whitespace-nowrap">Trang chủ</button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {/* Không tự cuộn riêng - để #lesson-view-container (bọc ngoài, xem
          App.tsx) là nơi DUY NHẤT cuộn, cuộn toàn trang thay vì chỉ cuộn
          mỗi vùng main này. */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
        <div className="bg-surface-border-strong p-6 md:p-10 rounded-3xl border border-white/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 text-blue-200">
            <BookOpen className="w-6 h-6" />
            <span className="text-sm font-bold uppercase tracking-wider">{course?.title || 'Khóa học'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{lesson?.title || 'Buổi học'}</h1>
        </div>

        {/* NỘI DUNG BUỔI HỌC: Từ vựng/Ngữ pháp - accordion, bấm tiêu đề mới trượt
            ra danh sách, chỉ 1 mục mở tại 1 thời điểm (bố cục giống khối "NỘI
            DUNG BUỔI HỌC" Kanji/Từ vựng của dự án "Xóa mù Kanji"). */}
        {/* shrink-0: main là flex-col cao giới hạn (overflow-y-auto) - item có
            overflow-hidden mặc nhiên có kích thước tối thiểu = 0 theo spec flexbox,
            nên bị flex co bóp nhỏ lại thay vì tràn ra cho main cuộn, nếu không có
            shrink-0 chặn co. */}
        <div className="bg-surface-border-strong rounded-3xl p-5 md:p-6 border border-white/10 shadow-sm shrink-0">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2 text-base md:text-lg uppercase tracking-wide">
            <BookOpen className="w-5 h-5 text-blue-300" />
            Nội dung buổi học
          </h2>

          <div className="flex flex-col gap-3">
            {/* Từ vựng */}
            <div className={`rounded-2xl overflow-hidden border transition-all duration-300 ${activeContentTab === 'vocab' ? 'border-blue-400/50 shadow-sm' : 'border-white/10 hover:border-blue-400/30'}`}>
              <button
                onClick={() => toggleContentTab('vocab')}
                className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 font-bold transition-all duration-300 ${activeContentTab === 'vocab' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}
                aria-expanded={activeContentTab === 'vocab'}
              >
                <span className="flex items-center gap-2 uppercase tracking-wide text-sm">
                  <Languages className="w-4 h-4 shrink-0" />
                  Từ vựng
                  <span className="text-[11px] font-semibold opacity-70 normal-case">({vocabulary.length})</span>
                </span>
                <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-300 ${activeContentTab === 'vocab' ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${activeContentTab === 'vocab' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  {vocabulary.length > 0 ? (
                    <div className="p-4 bg-black/10 border-t border-white/10 grid sm:grid-cols-2 gap-2">
                      {vocabulary.map((v, i) => {
                        const isPlaying = playingVocabId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => playVocabAudio(v)}
                            disabled={v.noAudio}
                            title={v.noAudio ? undefined : 'Bấm để nghe phát âm'}
                            className={`relative p-3 pt-6 rounded-xl text-left w-full border shadow-sm transition-colors ${
                              v.noAudio
                                ? 'bg-blue-50 cursor-default'
                                : isPlaying
                                ? 'bg-white border-blue-400 ring-2 ring-blue-400/50'
                                : 'bg-blue-50 hover:bg-white border-blue-100/70'
                            }`}
                          >
                            <span className="absolute top-2 left-2.5 text-[11px] font-bold text-blue-700/70">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            {!v.noAudio && (
                              <Volume2
                                className={`absolute top-2 right-2.5 w-3.5 h-3.5 ${
                                  isPlaying ? 'text-blue-600 animate-pulse' : 'text-blue-700/40'
                                }`}
                              />
                            )}
                            {/* flex-wrap + break-words: từ dài tự động đẩy cách đọc
                                xuống dòng riêng thay vì đè/tràn ra ngoài thẻ - từ
                                ngắn thì 2 phần vẫn nằm chung 1 hàng như cũ. */}
                            <div className="flex items-baseline justify-between flex-wrap gap-x-2 gap-y-0.5 pr-4">
                              <span className="font-jp text-lg font-bold text-zinc-900 break-words">{v.word}</span>
                              {v.reading && v.reading !== v.word && (
                                <span className="font-jp text-base font-bold text-blue-600 break-words">{v.reading}</span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-700 font-bold mt-1 break-words">{v.meaning}</p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-black/10 border-t border-white/10">
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 py-8 text-center text-sm text-[#8fb0ce] font-medium">
                        Chưa có dữ liệu từ vựng.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ngữ pháp */}
            <div className={`rounded-2xl overflow-hidden border transition-all duration-300 ${activeContentTab === 'grammar' ? 'border-blue-400/50 shadow-sm' : 'border-white/10 hover:border-blue-400/30'}`}>
              <button
                onClick={() => toggleContentTab('grammar')}
                className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 font-bold transition-all duration-300 ${activeContentTab === 'grammar' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}
                aria-expanded={activeContentTab === 'grammar'}
              >
                <span className="flex items-center gap-2 uppercase tracking-wide text-sm">
                  <ListChecks className="w-4 h-4 shrink-0" />
                  Ngữ pháp
                  <span className="text-[11px] font-semibold opacity-70 normal-case">({grammar.length})</span>
                </span>
                <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-300 ${activeContentTab === 'grammar' ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${activeContentTab === 'grammar' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  {grammar.length > 0 ? (
                    <div className="p-4 bg-black/10 border-t border-white/10 flex flex-col gap-2">
                      {grammar.map((g, i) => (
                        <div key={g.id} className="rounded-xl border border-blue-100/70 bg-blue-50 hover:bg-white shadow-sm p-4 flex flex-col gap-1.5 transition-colors">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md w-fit">
                            Mẫu {i + 1}
                          </span>
                          <p className="font-jp text-base md:text-lg font-bold text-blue-800">{g.pattern}</p>
                          <p className="text-sm text-zinc-600 font-medium">{g.meaning}</p>
                          {g.exampleJapanese && (
                            <div className="mt-1.5 pt-2.5 border-t border-blue-100 flex flex-col gap-0.5">
                              <p className="font-jp text-sm text-zinc-800 font-bold">{g.exampleJapanese}</p>
                              {g.exampleVietnamese && (
                                <p className="text-xs text-zinc-600 font-bold">{g.exampleVietnamese}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-black/10 border-t border-white/10">
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 py-8 text-center text-sm text-[#8fb0ce] font-medium">
                        Chưa có dữ liệu ngữ pháp.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nút công cụ: Slide (chỉ giáo viên/admin) / Flashcard / Tài liệu.
            Flashcard: logic/giao diện y hệt FlashcardModal của dự án "Xóa mù
            Kanji" (xem FlashcardModal.tsx), chỉ đổi nguồn dữ liệu sang
            VocabWord của kaiwa. */}
        <div className="bg-surface-border-strong rounded-3xl p-5 md:p-6 border border-white/10 shadow-sm shrink-0">
          <div className={`grid gap-3 ${isTeacherOrAdmin ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
            {isTeacherOrAdmin && (
              <button
                onClick={() => setTeacherSlideOpen(true)}
                disabled={!hasSlideImages || !slideGateReady}
                className="bg-blue-600 border border-blue-400/60 p-3 py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-md shadow-blue-900/30 transition-all hover:bg-blue-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/40 disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0"
              >
                {slideButtonBusy ? (
                  <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <MonitorPlay className="w-6 h-6 text-white" />
                )}
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {slideProbing
                    ? 'Đang tải...'
                    : hasSlideImages && !slideGateReady
                      ? `Slide... ${slidePreloadPercent}%`
                      : 'Slide'}
                </span>
              </button>
            )}

            <button
              onClick={() => setIsFlashcardOpen(true)}
              disabled={vocabulary.length === 0}
              className="bg-blue-600 border border-blue-400/60 p-3 py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-md shadow-blue-900/30 transition-all hover:bg-blue-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/40 disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0"
            >
              <Layers className="w-6 h-6 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Flashcard</span>
            </button>

            <button
              onClick={openLessonFile}
              disabled={!hasLessonFile}
              className="bg-blue-600 border border-blue-400/60 p-3 py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-md shadow-blue-900/30 transition-all hover:bg-blue-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/40 disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0"
            >
              <ExternalLink className="w-6 h-6 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Tài liệu</span>
            </button>
          </div>
          {(() => {
            const missing = [
              vocabulary.length === 0 && 'từ vựng để luyện tập',
              !hasLessonFile && 'tài liệu',
              isTeacherOrAdmin && !hasSlideImages && !slideProbing && 'slide trình chiếu',
            ].filter(Boolean) as string[];
            if (missing.length === 0) return null;
            return (
              <p className="text-xs text-[#8fb0ce] mt-3">
                Buổi học này chưa có {missing.join(', ')}.
              </p>
            );
          })()}
        </div>
      </main>

      {/* Slide trình chiếu cho giáo viên - ảnh, không hiệu ứng, chỉ trước/sau */}
      {teacherSlideOpen && hasSlideImages && (
        <SlideShow
          images={slideImages}
          title={lesson?.title}
          onClose={() => {
            setTeacherSlideOpen(false);
            // Đóng Slide thì ẩn luôn Bảng/Ghi chú (nếu đang mở) - nội dung
            // (canvas/text) vẫn giữ nguyên vì Blackboard/NotePad không bị
            // unmount ở đây, chỉ ẩn qua isOpen.
            setIsBoardOpen(false);
            setIsNoteOpen(false);
          }}
          isBoardOpen={isBoardOpen}
          onToggleBoard={() => setIsBoardOpen((v) => !v)}
          isNoteOpen={isNoteOpen}
          onToggleNote={() => setIsNoteOpen((v) => !v)}
          showCallControls={showCallControls}
          isPipActive={isPipActive}
        />
      )}

      {/* Bảng đen/Ghi chú - render Ở ĐÂY (không phải trong SlideShow) để
          canvas/nội dung không mất khi đóng/mở lại Slide - xem comment ở
          chỗ khai báo state isBoardOpen/isNoteOpen phía trên. key={lessonKey}
          bắt buộc remount (xoá sạch canvas/nội dung) khi sang buổi học khác. */}
      {isTeacherOrAdmin && (
        <>
          <Blackboard key={`board-${lessonKey}`} isOpen={isBoardOpen} onClose={() => setIsBoardOpen(false)} />
          <NotePad key={`note-${lessonKey}`} isOpen={isNoteOpen} onClose={() => setIsNoteOpen(false)} text={noteText} setText={setNoteText} />
        </>
      )}

      {/* Flashcard ôn từ vựng */}
      <FlashcardModal
        isOpen={isFlashcardOpen}
        onClose={() => setIsFlashcardOpen(false)}
        vocabulary={vocabulary}
      />

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 touch-none overscroll-none" onTouchMove={(e) => e.preventDefault()}>
          <div className="bg-surface border border-surface-border rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-xl flex flex-col text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-2">Thoát buổi học</h3>
            <p className="text-[#8fb0ce] font-medium mb-8">Bạn có chắc chắn muốn quay về trang chủ?</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-[#8fb0ce] bg-white/10 hover:bg-white/20 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={onHome}
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

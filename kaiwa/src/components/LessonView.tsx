import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, FileText, Presentation, Expand, ExternalLink, AlertTriangle, Languages, ListChecks, ChevronDown, MonitorPlay, Sparkles, Layers, Volume2 } from 'lucide-react';
import { useCourses } from '../context/CoursesContext';
import { useCallEmbed } from '../hooks/useCallEmbed';
import CallControls from './CallControls';
import PdfSlideShow from './PdfSlideShow';
import FlashcardModal from './FlashcardModal';
import { getVocabAudioUrl, getPooledVocabAudio, preloadLessonVocabAudio } from '../utils/vocabAudioCache';
import type { VocabWord, GrammarPoint } from '../types';

/**
 * Error boundary quanh trình chiếu PDF: nếu PDF.js/component gặp lỗi khi
 * render hoặc khi đóng (unmount), thay vì React sập cả cây -> màn hình
 * trống trơn, hiện màn hình lỗi gọn với nút đóng để quay lại bài học.
 */
class PdfSlideShowErrorBoundary extends Component<
  { onClose: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error('[PdfSlideShow] Lỗi khi hiển thị tài liệu:', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-14 h-14 bg-white/10 text-amber-300 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <p className="text-white text-sm font-medium">Có lỗi khi hiển thị tài liệu bài học.</p>
          <button
            onClick={this.props.onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Đóng
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Trang chi tiết 1 bài học. Khối "Tài liệu bài học":
 *   - File .pdf  -> bấm "Trình chiếu toàn màn hình" mở PdfSlideShow (PDF.js
 *     render từng trang, bấm Next/Prev để lật trang).
 *   - File .ppt/.pptx -> trình duyệt không render natively; dùng Google
 *     Docs Viewer (https://docs.google.com/viewer?embedded=true&url=...)
 *     trong khung toàn màn hình. Lưu ý viewer chỉ hoạt động với URL truy
 *     cập CÔNG KHAI từ trình duyệt người xem - nếu file bắt buộc đăng nhập
 *     (vd Cloudflare) thì dùng nút "Mở tab mới" để tự đăng nhập xem.
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
  // true = đang mở trình chiếu toàn màn hình (tài liệu bài học)
  const [fullscreen, setFullscreen] = useState(false);
  // "NỘI DUNG BUỔI HỌC": Từ vựng/Ngữ pháp thu gọn mặc định, bấm tiêu đề mới
  // trượt ra danh sách - chỉ 1 mục mở tại 1 thời điểm (bố cục/hành vi giống
  // hệt khối "NỘI DUNG BUỔI HỌC" Kanji/Từ vựng của dự án "Xóa mù Kanji").
  const [activeContentTab, setActiveContentTab] = useState<'vocab' | 'grammar' | null>(null);
  // true = đang mở flashcard ôn từ vựng (logic/giao diện y hệt FlashcardModal
  // của dự án "Xóa mù Kanji", xem kaiwa/src/components/FlashcardModal.tsx)
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  // true = đang mở khu vực slide trình chiếu cho giáo viên
  const [teacherSlideOpen, setTeacherSlideOpen] = useState(false);
  const { showCallControls, isPipActive, userRole } = useCallEmbed();
  // Chỉ giaovien/admin mới thấy nút "Slide" - học viên không có.
  const isTeacherOrAdmin = userRole === 'giaovien' || userRole === 'admin';

  // --- Phát audio phát âm khi bấm vào thẻ từ vựng ---
  // Khoá nhận diện 1 buổi học, dùng để tải ngầm/cache audio riêng theo từng
  // buổi (xem utils/vocabAudioCache.ts) - vào lại đúng buổi này thì dùng
  // ngay cache cũ, sang buổi khác mới tải lại + xoá cache buổi trước.
  const lessonKey = `${courseId}_${lessonId}`;
  // id của từ đang phát (để hiện icon loa nhấp nháy đúng thẻ), null = không phát.
  const [playingVocabId, setPlayingVocabId] = useState<string | null>(null);
  const vocabAudioRef = useRef<HTMLAudioElement | null>(null);

  const playVocabAudio = (v: VocabWord) => {
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
    const audio = pooled || new Audio(getVocabAudioUrl(v.word, v.reading));
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

  // --- Tài liệu bài học ---
  const lessonFileUrl: string | undefined = lesson?.lessonFileUrl?.trim();
  const hasLessonFile = !!lessonFileUrl;

  /** Nhận diện loại file từ đuôi URL (không phân biệt hoa thường). */
  function getFileKind(url: string): 'pdf' | 'ppt' | 'other' {
    const clean = url.split('?')[0].split('#')[0].toLowerCase();
    if (clean.endsWith('.pdf')) return 'pdf';
    if (clean.endsWith('.ppt') || clean.endsWith('.pptx') || clean.endsWith('.pps') || clean.endsWith('.ppsx')) return 'ppt';
    return 'other';
  }

  /** URL hiển thị trong iframe cho file PPT (Google Docs viewer). */
  function getPptEmbedUrl(url: string): string {
    return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`;
  }

  const fileKind = hasLessonFile ? getFileKind(lessonFileUrl) : 'other';
  const pptEmbedUrl = hasLessonFile && fileKind === 'ppt' ? getPptEmbedUrl(lessonFileUrl) : '';

  /**
   * .pdf/.ppt(x) -> mở trình chiếu toàn màn hình trong app (PDF.js/Google
   * Docs Viewer). Các link khác (Google Drive, Google Docs...) - viewer
   * trong app không nhúng được (không phải link file trực tiếp, trước đây
   * rơi vào nhánh PPT với iframe rỗng vì không nhận diện được đuôi file) -
   * mở thẳng ra tab mới, đúng link gốc, để trình duyệt/Drive tự xử lý.
   */
  const openLessonFile = () => {
    if (!hasLessonFile) return;
    if (fileKind === 'other') {
      window.open(lessonFileUrl, '_blank', 'noopener,noreferrer');
    } else {
      setFullscreen(true);
    }
  };

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
                            title="Bấm để nghe phát âm"
                            className={`relative p-3 pt-6 rounded-xl text-left w-full border shadow-sm transition-colors ${
                              isPlaying
                                ? 'bg-white border-blue-400 ring-2 ring-blue-400/50'
                                : 'bg-blue-50 hover:bg-white border-blue-100/70'
                            }`}
                          >
                            <span className="absolute top-2 left-2.5 text-[11px] font-bold text-blue-700/70">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <Volume2
                              className={`absolute top-2 right-2.5 w-3.5 h-3.5 ${
                                isPlaying ? 'text-blue-600 animate-pulse' : 'text-blue-700/40'
                              }`}
                            />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {isTeacherOrAdmin && (
              <button
                onClick={() => setTeacherSlideOpen(true)}
                className="bg-blue-600 border border-blue-400/60 p-3 py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-md shadow-blue-900/30 transition-all hover:bg-blue-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/40"
              >
                <MonitorPlay className="w-6 h-6 text-white" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Slide</span>
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
              {fileKind === 'ppt' ? (
                <Presentation className="w-6 h-6 text-white" />
              ) : fileKind === 'pdf' ? (
                <FileText className="w-6 h-6 text-white" />
              ) : (
                <ExternalLink className="w-6 h-6 text-white" />
              )}
              <span className="text-xs font-bold text-white uppercase tracking-wider">Tài liệu</span>
            </button>
          </div>
          {(vocabulary.length === 0 || !hasLessonFile) && (
            <p className="text-xs text-[#8fb0ce] mt-3">
              {vocabulary.length === 0 && !hasLessonFile
                ? 'Buổi học này chưa có từ vựng và chưa có tài liệu.'
                : vocabulary.length === 0
                  ? 'Buổi học này chưa có từ vựng để luyện tập.'
                  : 'Buổi học này chưa có tài liệu.'}
            </p>
          )}
        </div>
      </main>

      {/* Trình chiếu toàn màn hình */}
      {fullscreen && hasLessonFile && (
        fileKind === 'pdf' ? (
          <PdfSlideShowErrorBoundary onClose={() => setFullscreen(false)}>
            <PdfSlideShow
              url={lessonFileUrl}
              title={lesson?.title}
              onClose={() => setFullscreen(false)}
            />
          </PdfSlideShowErrorBoundary>
        ) : (
          <div className="fixed inset-0 z-[300] bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 border-b border-white/10 shrink-0 gap-3">
              <div className="flex items-center gap-2 text-white text-sm font-semibold min-w-0">
                <Presentation className="w-5 h-5 text-blue-300 shrink-0" />
                <span className="truncate uppercase tracking-wide">{lesson?.title || 'Tài liệu bài học'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={lessonFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Mở ở tab mới"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setFullscreen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                >
                  <Expand className="w-4 h-4 rotate-45" />
                  Thu nhỏ
                </button>
              </div>
            </div>
            <div className="flex-1 relative">
              <iframe
                key={lessonFileUrl}
                src={pptEmbedUrl}
                title="Tài liệu bài học"
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
          </div>
        )
      )}

      {/* Slide trình chiếu cho giáo viên - placeholder, chi tiết bổ sung sau */}
      {teacherSlideOpen && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 border-b border-white/10 shrink-0 gap-3">
            <div className="flex items-center gap-2 text-white text-sm font-semibold min-w-0">
              <MonitorPlay className="w-5 h-5 text-blue-300 shrink-0" />
              <span className="truncate uppercase tracking-wide">Slide trình chiếu — {lesson?.title || 'Buổi học'}</span>
            </div>
            <button
              onClick={() => setTeacherSlideOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors shrink-0"
            >
              <Expand className="w-4 h-4 rotate-45" />
              Đóng
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-16 h-16 bg-white/10 text-blue-200 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 opacity-70" />
            </div>
            <p className="text-white font-semibold text-lg">Tính năng đang được phát triển</p>
            <p className="text-[#8fb0ce] text-sm max-w-sm">
              Khu vực trình chiếu slide dành cho giáo viên sẽ sớm ra mắt trong bản cập nhật tiếp theo.
            </p>
          </div>
        </div>
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

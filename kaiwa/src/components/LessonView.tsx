import { Component, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, FileText, Presentation, Expand, ExternalLink, Download, AlertTriangle } from 'lucide-react';
import { useCourses } from '../context/CoursesContext';
import { useCallEmbed } from '../hooks/useCallEmbed';
import CallControls from './CallControls';
import PdfSlideShow from './PdfSlideShow';

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
  // true = đang mở trình chiếu toàn màn hình
  const [fullscreen, setFullscreen] = useState(false);
  const { showCallControls, isPipActive } = useCallEmbed();

  const course = courses.find(
    c => String(c.id).trim().normalize('NFC') === String(courseId).trim().normalize('NFC')
  );

  const lessons = loadedCourseDetails?.courseId === courseId ? loadedCourseDetails.lessons : [];

  const lesson = lessons.find(
    (l: any) => String(l.id).trim().normalize('NFC') === String(lessonId).trim().normalize('NFC')
  );

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
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        <div className="bg-surface-border-strong p-6 md:p-10 rounded-3xl border border-white/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 text-blue-200">
            <BookOpen className="w-6 h-6" />
            <span className="text-sm font-bold uppercase tracking-wider">{course?.title || 'Khóa học'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{lesson?.title || 'Buổi học'}</h1>
        </div>

        {/* Tài liệu bài học - chỉ nút mở trình chiếu toàn màn hình */}
        <div className="bg-surface-border-strong p-6 md:p-8 rounded-3xl border border-white/10 shadow-sm flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/10 text-blue-300 rounded-xl flex items-center justify-center shrink-0">
                {fileKind === 'ppt'
                  ? <Presentation className="w-6 h-6" />
                  : <FileText className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-white uppercase tracking-wide">
                  Tài liệu bài học
                </h2>
                {hasLessonFile ? (
                  <p className="text-xs text-[#8fb0ce] mt-0.5">
                    {fileKind === 'ppt' ? 'Trình chiếu PPT' : fileKind === 'pdf' ? 'Tài liệu PDF' : 'Tài liệu'} —
                    bấm "Trình chiếu" để mở toàn màn hình
                  </p>
                ) : (
                  <p className="text-xs text-[#8fb0ce] mt-0.5">
                    Bài học này chưa được gắn file tài liệu
                  </p>
                )}
              </div>
            </div>

            {hasLessonFile && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFullscreen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-md shadow-blue-600/20"
                >
                  {fileKind === 'ppt' ? <Presentation className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
                  Trình chiếu toàn màn hình
                </button>
                <a
                  href={lessonFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mở tab mới
                </a>
              </div>
            )}
          </div>

          {!hasLessonFile && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 flex flex-col items-center justify-center gap-3 text-center py-10">
              <div className="w-12 h-12 bg-white/10 text-[#8fb0ce] rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6" />
              </div>
              <p className="text-[#8fb0ce] font-medium text-sm">Chưa có tài liệu cho bài học này.</p>
            </div>
          )}
        </div>

        {/* Placeholder nội dung bài học còn lại */}
        <div className="bg-surface-border-strong p-12 md:p-20 rounded-3xl border border-white/10 shadow-sm flex flex-col items-center justify-center text-center flex-1 min-h-[200px]">
          <div className="w-16 h-16 bg-white/10 text-blue-200 rounded-2xl flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 opacity-60" />
          </div>
          <p className="text-[#8fb0ce] font-medium text-base md:text-lg">Nội dung buổi học hiện tại đang được cập nhật...</p>
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

import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, FileText, ExternalLink } from 'lucide-react';

// PDF.js worker - import bằng ?url để Vite copy file worker vào dist và trả
// về URL phục vụ cùng nguồn (không phụ thuộc CDN).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfSlideShowProps {
  url: string;
  title?: string;
  onClose: () => void;
}

/**
 * Trình chiếu PDF toàn màn hình (dạng slide): render từng trang PDF lên
 * canvas bằng PDF.js, bấm nút Next/Prev (hoặc phím mũi tên) để lật trang.
 *
 * Chuyển trang TRỰC TIẾP, không hiệu ứng fade: 2 canvas chồng nhau, trang
 * mới render sẵn vào canvas ẩn rồi hoán đổi ngay lập tức - mượt, không
 * nháy, không giật.
 */
export default function PdfSlideShow({ url, title, onClose }: PdfSlideShowProps) {
  const canvasA = useRef<HTMLCanvasElement>(null);
  const canvasB = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Canvas nào đang hiển thị (trang hiện tại)
  const [activeCanvas, setActiveCanvas] = useState<'A' | 'B'>('A');
  // Đang render trang mới (chặn bấm liên tiếp)
  const [isSwapping, setIsSwapping] = useState(false);
  // Kích thước canvas active (px) - để wrapper căn giữa đúng
  const [canvasSize, setCanvasSize] = useState<{ w: string; h: string } | null>(null);
  // Kích thước khung hiển thị (đo thực tế, để căn canvas vừa chiều rộng)
  const [containerW, setContainerW] = useState(0);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  // .destroy() nằm trên PDFDocumentLoadingTask (trả về từ getDocument()),
  // KHÔNG nằm trên PDFDocumentProxy (giá trị đã resolve từ .promise) - gọi
  // nhầm trên PDFDocumentProxy trước đây bị nuốt lỗi âm thầm bởi try/catch
  // rỗng bên dưới nên tài liệu không bao giờ thực sự được giải phóng.
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  // Component còn mounted hay không - chặn setState/render sau khi đóng
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tải tài liệu PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadingTask = pdfjsLib.getDocument({
      url,
      // File nằm sau lớp chặn auth của server (cookie sb_page_token) -
      // bắt buộc gửi kèm credential để PDF.js tải được file như người
      // dùng đang đăng nhập.
      withCredentials: true,
    });
    loadingTaskRef.current = loadingTask;

    loadingTask.promise
      .then((loadedDoc) => {
        if (cancelled || !mountedRef.current) {
          try {
            loadingTask.destroy();
          } catch {
            /* bỏ qua */
          }
          return;
        }
        setDoc(loadedDoc);
        docRef.current = loadedDoc;
        setNumPages(loadedDoc.numPages);
        setPageNum(1);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled || !mountedRef.current) return;
        console.error('[PdfSlideShow] Không tải được PDF:', err);
        setError(
          'Không tải được file PDF. File có thể bị chặn truy cập (cần đăng nhập) hoặc đường dẫn sai.',
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
      // Hủy render task đang chạy TRƯỚC khi hủy tài liệu, tránh lỗi khi
      // unmount giữa chừng render
      try {
        renderTaskRef.current?.cancel();
      } catch {
        /* bỏ qua */
      }
      try {
        loadingTaskRef.current?.destroy();
      } catch {
        /* bỏ qua */
      }
      loadingTaskRef.current = null;
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Đo chiều rộng khung chứa để căn canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Render 1 trang PDF vào 1 canvas cụ thể (bất đồng bộ). */
  const renderTo = useCallback(
    async (canvas: HTMLCanvasElement | null, page: number, zoomScale: number) => {
      if (!doc || !canvas || !containerW) return;
      const pdfPage = await doc.getPage(page);
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const dpr = window.devicePixelRatio || 1;
      const fitScale = (containerW / baseViewport.width) * zoomScale;
      const viewport = pdfPage.getViewport({ scale: fitScale });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      renderTaskRef.current?.cancel();
      const task = pdfPage.render({
        canvas,
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      renderTaskRef.current = task;
      try {
        await task.promise;
        pdfPage.cleanup();
      } finally {
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      }
    },
    [doc, containerW],
  );

  // Render trang hiện tại vào canvas ACTIVE mỗi khi doc/zoom/kích thước đổi
  // (khi đổi trang, trang mới được render trong luồng changePage rồi).
  useEffect(() => {
    const canvas = activeCanvas === 'A' ? canvasA.current : canvasB.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    (async () => {
      try {
        await renderTo(canvas, pageNum, zoom);
        if (!cancelled && mountedRef.current) {
          setCanvasSize({ w: canvas.style.width, h: canvas.style.height });
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'RenderingCancelledException') return;
        if (!mountedRef.current) return;
        console.error('[PdfSlideShow] Lỗi render trang:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, zoom, containerW]);

  /** Đổi trang - render vào canvas ẩn rồi hoán đổi NGAY, không hiệu ứng. */
  const changePage = useCallback(
    (n: number) => {
      if (isSwapping || !doc || n < 1 || n > numPages || n === pageNum) return;

      const nextIsA = activeCanvas === 'B';
      const nextCanvas = nextIsA ? canvasA.current : canvasB.current;
      const prevCanvas = nextIsA ? canvasB.current : canvasA.current;
      if (!nextCanvas || !prevCanvas) return;

      setIsSwapping(true);

      renderTo(nextCanvas, n, zoom)
        .then(() => {
          if (!mountedRef.current) return;
          // Hoán đổi ngay lập tức - không fade, không transition
          nextCanvas.style.zIndex = '20';
          prevCanvas.style.zIndex = '10';
          setCanvasSize({ w: nextCanvas.style.width, h: nextCanvas.style.height });
          setPageNum(n);
          setActiveCanvas(nextIsA ? 'A' : 'B');
        })
        .catch(() => {
          // Bỏ qua - giữ nguyên trang hiện tại
        })
        .finally(() => {
          if (mountedRef.current) setIsSwapping(false);
        });
    },
    [isSwapping, doc, numPages, pageNum, activeCanvas, zoom, renderTo],
  );

  const goPrev = useCallback(() => changePage(pageNum - 1), [changePage, pageNum]);
  const goNext = useCallback(() => changePage(pageNum + 1), [changePage, pageNum]);

  // Phím mũi tên trái/phải + Space để lật trang
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  const canvasStyleA = {
    opacity: activeCanvas === 'A' ? 1 : 0,
    zIndex: activeCanvas === 'A' ? 20 : 10,
    width: canvasSize?.w,
    height: canvasSize?.h,
  };
  const canvasStyleB = {
    opacity: activeCanvas === 'B' ? 1 : 0,
    zIndex: activeCanvas === 'B' ? 20 : 10,
    width: canvasSize?.w,
    height: canvasSize?.h,
  };

  const navBtn =
    'flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 disabled:pointer-events-none';

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col">
      {/* Thanh trên: tiêu đề + đếm trang + zoom + đóng */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 border-b border-white/10 shrink-0 gap-3">
        <div className="flex items-center gap-2 text-white text-sm font-semibold min-w-0">
          <FileText className="w-5 h-5 text-blue-300 shrink-0" />
          <span className="truncate uppercase tracking-wide">{title || 'Tài liệu bài học'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {numPages > 0 && (
            <span className="text-xs font-mono text-white/70 mr-1">
              Trang {pageNum} / {numPages}
            </span>
          )}
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            aria-label="Thu nhỏ"
            className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            aria-label="Phóng to"
            className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Mở ở tab mới"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            aria-label="Đóng trình chiếu"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
          >
            <X className="w-4 h-4" />
            Đóng
          </button>
        </div>
      </div>

      {/* Vùng trình chiếu */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4 md:p-6 relative"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 text-white/70 py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm">Đang tải tài liệu...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-20 px-6 max-w-md">
            <FileText className="w-10 h-10 text-white/40" />
            <p className="text-sm text-white/80">{error}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Thử mở ở tab mới
            </a>
          </div>
        )}

        {!loading && !error && (
          <div
            className="relative"
            style={{ width: canvasSize?.w, height: canvasSize?.h }}
          >
            {/* Canvas A */}
            <canvas
              ref={canvasA}
              className="absolute top-0 left-0 bg-white shadow-2xl rounded-sm"
              style={canvasStyleA}
            />
            {/* Canvas B - chồng lên canvas A, hoán đổi tức thì khi đổi trang */}
            <canvas
              ref={canvasB}
              className="absolute top-0 left-0 bg-white shadow-2xl rounded-sm"
              style={canvasStyleB}
            />
          </div>
        )}
      </div>

      {/* Thanh dưới: nút Prev / Next */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-slate-900/95 border-t border-white/10 shrink-0">
        <button onClick={goPrev} disabled={pageNum <= 1 || isSwapping} className={navBtn} aria-label="Trang trước">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-white font-semibold text-sm min-w-[120px] text-center">
          {numPages > 0 ? `${pageNum} / ${numPages}` : '...'}
        </span>
        <button onClick={goNext} disabled={pageNum >= numPages || isSwapping} className={navBtn} aria-label="Trang sau">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

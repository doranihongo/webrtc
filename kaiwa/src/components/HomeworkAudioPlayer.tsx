import React from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

/**
 * Thanh nghe lại tự vẽ (nút play/pause + thanh tua + thời gian) cho bài tập
 * về nhà - dùng thay `<audio controls>` mặc định của trình duyệt (mỗi
 * trình duyệt vẽ 1 kiểu, không đồng bộ giao diện với phần còn lại của app).
 * Dùng cho cả bản nháp vừa ghi (draftPreviewUrl - blob URL cục bộ) lẫn bài
 * đã nộp (homeworkAudioUrl(id) - qua server) trong HomeworkModal.tsx.
 *
 * `preload="none"` CỐ Ý - không tự tải byte audio chỉ vì component được
 * render (vd mở popup "Bài tập" lên là thấy ngay bài đã nộp trong danh
 * sách, nhưng KHÔNG được tự tải file về lúc đó). Chỉ thực sự bắt đầu tải
 * khi người dùng bấm nút play lần đầu - xem trạng thái `status` bên dưới.
 */

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export default function HomeworkAudioPlayer({
  src,
  knownDurationSec,
  className,
  onAudioElementReady,
  onPlayingChange,
}: {
  src: string;
  /** Thời lượng đã biết SẴN (giây) - vd từ lúc ghi âm xong (đo bằng
   * Date.now() ở HomeworkModal) hoặc do server lưu lại lúc nộp
   * (HomeworkSubmission.durationMs). Hiện NGAY, không cần đợi bấm play mới
   * tải audio để biết duration thật (đúng tinh thần preload="none" - vẫn
   * không tải byte nào cho tới khi bấm play, chỉ hiện con số đã biết sẵn).
   * Một khi tải xong, duration THẬT từ audio (chính xác hơn) sẽ thay vào. */
  knownDurationSec?: number;
  className?: string;
  /** Gọi 1 lần khi thẻ <audio> bên trong đã gắn vào DOM - dùng ở view giáo
   * viên (HomeworkModal.tsx) để đăng ký vào shareableAudioBus, phát cho cả
   * lớp nghe qua cuộc gọi. Không dùng cho view học viên (chỉ nghe cục bộ). */
  onAudioElementReady?: (el: HTMLAudioElement) => void;
  /** Gọi mỗi khi trạng thái đang phát/dừng đổi - dùng ở view giáo viên để
   * báo trang cha qua postMessage. */
  onPlayingChange?: (isPlaying: boolean) => void;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioCallbackRef = React.useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      if (el) onAudioElementReady?.(el);
    },
    [onAudioElementReady],
  );
  const [status, setStatus] = React.useState<Status>('idle');
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [duration, setDuration] = React.useState(knownDurationSec || 0);
  const [currentTime, setCurrentTime] = React.useState(0);
  // Lúc bắt đầu tải (Date.now()) - dùng để đảm bảo icon xoay tròn hiện đủ
  // lâu để MẮT NGƯỜI kịp thấy (xem markLoadedIfLoading bên dưới). File nhỏ
  // + mạng nhanh (vd chạy local) có thể tải xong trong vài chục ms - không
  // đủ 1 khung hình để mắt nhận ra icon vừa đổi rồi đổi lại ngay.
  const loadingStartRef = React.useRef(0);

  // Đổi nguồn (vd ghi lại bản khác) -> reset hẳn, kể cả về lại "chưa tải" -
  // nhưng vẫn giữ knownDurationSec mới (nếu có) thay vì về 0 rồi hiện "--:--".
  React.useEffect(() => {
    setStatus('idle');
    setIsPlaying(false);
    setDuration(knownDurationSec || 0);
    setCurrentTime(0);
  }, [src, knownDurationSec]);

  const MIN_LOADING_VISIBLE_MS = 400;

  /** Gọi khi audio thật sự đã sẵn sàng phát (canplay/play) - chỉ chuyển
   * status sang 'ready' NGAY nếu đã đủ MIN_LOADING_VISIBLE_MS kể từ lúc bắt
   * đầu tải; chưa đủ thì hẹn giờ chuyển sau (audio vẫn phát bình thường
   * trong lúc chờ - chỉ icon nút là chưa đổi lại thôi). */
  function markLoadedIfLoading() {
    setStatus((s) => {
      if (s !== 'loading') return s;
      const elapsed = Date.now() - loadingStartRef.current;
      if (elapsed >= MIN_LOADING_VISIBLE_MS) return 'ready';
      setTimeout(() => setStatus((s2) => (s2 === 'loading' ? 'ready' : s2)), MIN_LOADING_VISIBLE_MS - elapsed);
      return s;
    });
  }

  function handlePlayButton() {
    const el = audioRef.current;
    if (!el) return;
    if (status === 'idle' || status === 'error') {
      // Lần bấm ĐẦU TIÊN (hoặc thử lại sau lỗi) - đây mới là lúc thật sự
      // bắt đầu tải byte audio (preload="none" nên trước đó chưa tải gì).
      setStatus('loading');
      loadingStartRef.current = Date.now();
      el.play().catch(() => setStatus('error'));
      return;
    }
    if (isPlaying) el.pause();
    else el.play().catch(() => setStatus('error'));
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || status !== 'ready' || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrentTime(el.currentTime);
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isLoading = status === 'loading';

  return (
    <div className={`flex items-center gap-2.5 bg-black/20 rounded-xl px-2.5 py-2 min-w-0 ${className || ''}`}>
      <audio
        ref={audioCallbackRef}
        src={src}
        preload="none"
        className="hidden"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onCanPlay={markLoadedIfLoading}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => {
          setIsPlaying(true);
          onPlayingChange?.(true);
          markLoadedIfLoading();
        }}
        onPause={() => {
          setIsPlaying(false);
          onPlayingChange?.(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          onPlayingChange?.(false);
        }}
        onError={() => setStatus('error')}
      />
      <button
        type="button"
        onClick={handlePlayButton}
        disabled={isLoading}
        className="shrink-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-70 flex items-center justify-center text-white transition-colors"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {status === 'error' ? (
        <span className="text-xs text-red-400 font-semibold">Lỗi tải - bấm để thử lại</span>
      ) : (
        // Giữ nguyên thanh tua + thời gian kể cả lúc đang tải (isLoading) -
        // chỉ riêng icon nút play đổi thành xoay tròn để báo đang tải.
        <>
          <div className="flex-1 min-w-0 h-1.5 rounded-full bg-white/15 cursor-pointer relative" onClick={handleSeek}>
            <div className="absolute inset-y-0 left-0 bg-blue-400 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="shrink-0 text-[11px] text-[#8fb0ce] font-mono tabular-nums">
            {formatTime(currentTime)}/{duration > 0 ? formatTime(duration) : '--:--'}
          </span>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Youtube, X, Loader2, AlertTriangle, Repeat1, Link2, ArrowLeft, PlayCircle, ListVideo, Download,
  Heart, Check, Type, Languages, Crosshair, Play, Pause, Volume2, VolumeX,
} from 'lucide-react';
import {
  ShadowingProgressMap,
  ShadowingDisplayPrefs,
  loadShadowingProgress,
  saveShadowingProgress,
  getShadowingEntry,
  withToggleSaved,
  withProgress,
  isNewVideo,
  loadDisplayPrefs,
  saveDisplayPrefs,
} from '../utils/shadowingProgress';

interface Segment {
  start: number;
  end: number;
  text: string;
  // Làm giàu thủ công (xem cột subtitle_json trong kaiwa_shadowing_videos):
  // admin xuất transcript gốc ra JSON, đem qua AI ngoài thêm romaji + dịch
  // Việt, dán JSON đã làm giàu ngược lại cột đó - segments lấy từ đây (thay
  // vì gọi lại yt-dlp) sẽ có sẵn 2 trường này.
  romaji?: string;
  vi?: string;
}

interface TranscriptResponse {
  ok: boolean;
  videoId?: string;
  segments?: Segment[];
  code?: string;
  message?: string;
}

// Hàng trong bảng Supabase "kaiwa_shadowing_videos" - xem hướng dẫn tạo bảng
// kèm RLS trong ghi chú của tính năng này (không lưu ở đây, chỉ đọc qua
// window.supabaseClient giống các chỗ khác trong kaiwa dùng chung project).
interface PresetVideo {
  id: number | string;
  title: string;
  youtube_url: string;
  // KHÔNG nằm trong kết quả tải danh sách (useEffect tải presetVideos chỉ
  // select cột nhẹ) - field này chỉ có giá trị khi handlePickPreset tự
  // fetch riêng theo id lúc người dùng bấm vào 1 video, khai báo ở đây cho
  // tiện dùng chung type Segment[] chứ object trong presetVideos luôn undefined.
  subtitle_json?: Segment[] | null;
  // Cột "duration" (text) trong kaiwa_shadowing_videos - admin điền tay dạng
  // hiển thị sẵn kiểu YouTube ("5:23", "1:02:10"...), không phải số giây.
  // Không tự suy ra từ subtitle_json/gọi server - đỡ tốn 1 request/video và
  // tránh sai lệch khi video chưa có phụ đề enrich.
  duration?: string | null;
  // Cột có sẵn của Supabase (mọi bảng tự có khi tạo qua dashboard) - dùng
  // để tính badge "Mới" (xem isNewVideo trong utils/shadowingProgress.ts).
  created_at?: string | null;
}

interface YoutubeShadowingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 'list': màn hình mặc định lúc mở tool - danh sách video có sẵn lấy từ
// Supabase. 'input': màn dán link tay (vào từ 'list' hoặc khi danh sách
// rỗng/lỗi).
type Stage = 'list' | 'input' | 'loading' | 'ready' | 'error';

const SPEEDS = [0.75, 1, 1.25];
const POLL_MS = 200;
// Ngưỡng lệch cuối câu khi lặp - tránh lặp ngay tức khắc do sai số polling.
const LOOP_EPSILON = 0.15;

/** Trích video id từ 1 link YouTube (watch/shorts/youtu.be) để lấy thumbnail
 * cho danh sách có sẵn - không cần validate chặt như normalizeYoutubeUrl
 * phía server, chỉ để hiển thị, request thật vẫn được server tự validate lại. */
function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Nạp YouTube IFrame API đúng 1 lần, dùng chung cho mọi lần mở modal (giống
// cách public/js/client.js làm với trình phát chờ giáo viên).
let ytApiPromise: Promise<void> | null = null;
function loadYoutubeIframeApi(): Promise<void> {
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function looksLikeYoutubeLink(value: string): boolean {
  return /youtu\.?be/i.test(value.trim());
}

export default function YoutubeShadowingModal({ isOpen, onClose }: YoutubeShadowingModalProps) {
  // Popup xác nhận trước khi đóng hẳn tool - tránh bấm nhầm dấu X mất tiến
  // trình đang xem/luyện. Nút X chỉ mở popup này, nút "Đóng" trong popup
  // mới thật sự gọi onClose().
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [stage, setStage] = useState<Stage>('list');
  const [linkValue, setLinkValue] = useState('');
  const [inlineHint, setInlineHint] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loopLine, setLoopLine] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  // Trạng thái cho thanh điều khiển tự code (xem "Khoá video nhúng" bên
  // dưới) - KHÔNG dùng UI/nút bấm gốc của YouTube nữa, tất cả tự quản lý
  // qua YT IFrame API rồi đồng bộ vào đây để render.
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  // Giá trị đang kéo dở của thanh tua - null nghĩa là không kéo, hiện
  // currentTime như bình thường (xem effect "commit tua" bên dưới).
  const [scrubDraft, setScrubDraft] = useState<number | null>(null);
  // Tự ẩn thanh điều khiển (tua/play-pause/âm lượng) sau vài giây không rê
  // chuột/chạm vào video - CHỈ lúc đang phát (tạm dừng thì giữ nguyên luôn
  // hiện, không có lý do gì ẩn lúc video đang đứng yên).
  const [controlsVisible, setControlsVisible] = useState(true);

  const [presetVideos, setPresetVideos] = useState<PresetVideo[]>([]);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // "Mới thêm" / "Đã lưu" / "Đã xem" cho danh sách - lưu ở trình duyệt, xem
  // utils/shadowingProgress.ts để biết vì sao không đồng bộ qua Supabase.
  const [progress, setProgress] = useState<ShadowingProgressMap>(() => loadShadowingProgress());
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'saved' | 'watched' | 'unwatched'>('all');
  // Tuỳ chọn hiển thị màn xem chi tiết video (ẩn/hiện romaji, dịch Việt, tự
  // cuộn) - áp dụng chung mọi video, nhớ luôn giữa các lần mở (localStorage).
  const [displayPrefs, setDisplayPrefs] = useState<ShadowingDisplayPrefs>(() => loadDisplayPrefs());

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const subtitleListRef = useRef<HTMLDivElement | null>(null);
  const loopLineRef = useRef(loopLine);
  loopLineRef.current = loopLine;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const segmentsRef = useRef<Segment[]>(segments);
  segmentsRef.current = segments;
  // true trong lúc đang kéo thanh tua - vòng lặp poll (đọc currentTime thật
  // từ player) phải bỏ qua lúc này, không thì giá trị vừa kéo bị đè ngược
  // lại giữa chừng, giật tay cầm. Dùng ref (không phải state) vì phải đọc
  // được giá trị mới nhất ngay trong callback addEventListener gắn 1 lần.
  const scrubbingRef = useRef(false);
  const scrubDraftRef = useRef(0);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Khóa cuộn trang nền lúc modal đang mở (full-screen trên điện thoại) -
  // giữ đúng vị trí cuộn cũ khi đóng lại, cùng cách DictationModal.tsx làm
  // (position:fixed + bù top thay vì overflow:hidden suông, để tránh Safari
  // iOS tự cuộn nền qua lại lúc modal đang mở).
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
    }
  }, [isOpen]);

  // Reset về màn danh sách mỗi lần modal đóng - mở lại luôn bắt đầu sạch.
  useEffect(() => {
    if (!isOpen) {
      setStage('list');
      setLinkValue('');
      setInlineHint(null);
      setVideoId(null);
      setSegments([]);
      setErrorMessage('');
      setActiveIndex(0);
      setLoopLine(false);
      setPlaybackRate(1);
      setActiveFilter('all');
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setVolume(100);
      setIsMuted(false);
      setScrubDraft(null);
      setControlsVisible(true);
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = null;
      }
    }
  }, [isOpen]);

  // Nạp danh sách video có sẵn từ Supabase mỗi lần mở modal - dùng luôn
  // window.supabaseClient (đã có sẵn toàn app, xem kaiwa/index.html +
  // public/js/supabaseClient.js) thay vì tự tạo client riêng.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPresetLoading(true);
    setPresetError(null);

    const supabase = (window as any).supabaseClient;
    if (!supabase) {
      setPresetLoading(false);
      setPresetError('Không kết nối được Supabase để tải danh sách video.');
      return;
    }

    supabase
      .from('kaiwa_shadowing_videos')
      // KHÔNG select subtitle_json ở đây - transcript đầy đủ (romaji+dịch mọi
      // câu) chỉ cần đúng 1 video lúc mở xem, tải hết cho cả danh sách vừa
      // tốn băng thông vừa chậm màn danh sách. Cột này được fetch riêng theo
      // từng video trong handlePickPreset khi người dùng thật sự bấm vào.
      .select('id, title, youtube_url, duration, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }: { data: PresetVideo[] | null; error: any }) => {
        if (cancelled) return;
        if (error) {
          setPresetError('Không tải được danh sách video.');
        } else {
          setPresetVideos(data || []);
        }
        setPresetLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Chỉ admin mới thấy nút "Xuất JSON" (xem __authUser/__authReady trong
  // public/js/common.js - cùng cơ chế Home.tsx dùng để phân biệt
  // giaovien/admin cho nút "Quay lại phòng học").
  useEffect(() => {
    const w = window as any;
    const applyRole = () => setIsAdmin(w.__authUser?.role === 'admin');
    if (w.__authReady && typeof w.__authReady.then === 'function') {
      w.__authReady.then(applyRole);
    } else {
      applyRole();
    }
  }, []);

  // videoId -> đúng hàng PresetVideo tương ứng (dùng lại nhiều chỗ bên dưới,
  // tính 1 lần thay vì gọi extractYoutubeId rải rác).
  const presetsWithYtId = useMemo(
    () => presetVideos.map((video) => ({ video, ytId: extractYoutubeId(video.youtube_url) })),
    [presetVideos],
  );

  const newCount = useMemo(
    () => presetsWithYtId.filter(({ video, ytId }) => isNewVideo(video.created_at, getShadowingEntry(progress, ytId || ''))).length,
    [presetsWithYtId, progress],
  );
  const savedCount = useMemo(
    () => presetsWithYtId.filter(({ ytId }) => getShadowingEntry(progress, ytId || '').saved).length,
    [presetsWithYtId, progress],
  );
  const watchedCount = useMemo(
    () => presetsWithYtId.filter(({ ytId }) => !!getShadowingEntry(progress, ytId || '').lastWatchedAt).length,
    [presetsWithYtId, progress],
  );
  const unwatchedCount = useMemo(
    () => presetsWithYtId.filter(({ ytId }) => !getShadowingEntry(progress, ytId || '').lastWatchedAt).length,
    [presetsWithYtId, progress],
  );

  // Đang xem dở (đã mở nhưng chưa cuộn tới dòng phụ đề cuối) - mới nhất lên
  // đầu, chỉ hiện ở tab "Tất cả" (xem JSX bên dưới) để khỏi lặp lại ý với
  // tab "Đã xem".
  const continueWatching = useMemo(() => {
    return presetsWithYtId
      .filter(({ ytId }) => {
        if (!ytId) return false;
        const entry = getShadowingEntry(progress, ytId);
        return !!entry.lastWatchedAt && !entry.completed;
      })
      .sort((a, b) => {
        const ta = getShadowingEntry(progress, a.ytId || '').lastWatchedAt || 0;
        const tb = getShadowingEntry(progress, b.ytId || '').lastWatchedAt || 0;
        return tb - ta;
      })
      .slice(0, 8);
  }, [presetsWithYtId, progress]);

  // Video nào đã lên dải "Tiếp tục xem" thì bỏ khỏi danh sách bên dưới (tab
  // "Tất cả") - đỡ hiện trùng 2 chỗ. Các tab lọc khác (Mới/Đã lưu/Đã xem)
  // không đụng tới, vì dải "Tiếp tục xem" chỉ hiện ở tab "Tất cả" nên không
  // có gì để trùng.
  const continueWatchingIds = useMemo(
    () => new Set(continueWatching.map(({ ytId }) => ytId)),
    [continueWatching],
  );

  const filteredVideos = useMemo(() => {
    if (activeFilter === 'all') {
      return continueWatchingIds.size === 0
        ? presetVideos
        : presetsWithYtId.filter(({ ytId }) => !continueWatchingIds.has(ytId)).map(({ video }) => video);
    }
    return presetsWithYtId
      .filter(({ video, ytId }) => {
        const entry = getShadowingEntry(progress, ytId || '');
        if (activeFilter === 'new') return isNewVideo(video.created_at, entry);
        if (activeFilter === 'saved') return entry.saved;
        if (activeFilter === 'unwatched') return !entry.lastWatchedAt;
        return !!entry.lastWatchedAt; // 'watched'
      })
      .map(({ video }) => video);
  }, [presetVideos, presetsWithYtId, progress, activeFilter, continueWatchingIds]);

  const handleToggleSaved = (e: React.MouseEvent, ytId: string | null) => {
    e.stopPropagation(); // không mở video, chỉ bật/tắt lưu
    if (!ytId) return;
    setProgress((prev) => {
      const next = withToggleSaved(prev, ytId);
      saveShadowingProgress(next);
      return next;
    });
  };

  const toggleDisplayPref = (key: keyof ShadowingDisplayPrefs) => {
    setDisplayPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveDisplayPrefs(next);
      return next;
    });
  };

  // Thẻ video trong danh sách là <div role="button"> chứ không phải
  // <button> thật (bên trong còn 1 nút ♡ lưu riêng - <button> lồng
  // <button> là HTML không hợp lệ) - tự bù lại kích hoạt bằng bàn phím.
  const handleCardKeyDown = (e: React.KeyboardEvent, video: PresetVideo) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePickPreset(video);
    }
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const destroyPlayer = useCallback(() => {
    stopPolling();
    try {
      playerRef.current?.destroy?.();
    } catch {
      // player đã bị gỡ khỏi DOM trước đó - bỏ qua
    }
    playerRef.current = null;
  }, [stopPolling]);

  // Khởi tạo YT.Player khi vào stage 'ready', dọn dẹp khi rời đi/đổi video.
  useEffect(() => {
    if (stage !== 'ready' || !videoId) return;
    let cancelled = false;

    loadYoutubeIframeApi().then(() => {
      if (cancelled || !playerContainerRef.current) return;
      const YT = (window as any).YT;
      playerRef.current = new YT.Player(playerContainerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          // Khoá hẳn khung nhúng - đi cùng pointer-events-none đặt trên
          // chính div chứa iframe (xem JSX bên dưới, phần "Vùng phát
          // video"): pointer-events-none chặn MỌI click chuột/chạm tới
          // iframe (kể cả khi YouTube đổi UI/DOM nội bộ sau này), còn mấy
          // cờ dưới đây chặn luôn đường vòng qua bàn phím + ẩn hẳn thanh
          // điều khiển/logo gốc của YouTube (kể cả không bị khoá pointer-
          // events, controls:0 vẫn không có gì để bấm vào để mở YouTube).
          controls: 0, // ẩn hẳn thanh điều khiển + logo gốc của YouTube
          disablekb: 1, // chặn phím tắt gốc (space/mũi tên/"f" fullscreen...)
          fs: 0, // ẩn nút fullscreen gốc
          iv_load_policy: 3, // ẩn annotation/card (có thể dẫn sang video khác)
          playsinline: 1, // phát ngay trong trang trên iOS, không nhảy sang trình phát toàn màn hình gốc (nếu không thì mọi khoá ở trên đều vô nghĩa trên iPhone)
        },
        events: {
          onReady: (e: any) => {
            const player = e.target;
            setDuration(player.getDuration?.() || 0);
            // Luôn mặc định 100% mỗi video mới, không đọc lại getVolume() -
            // YT.Player thỉnh thoảng nhớ mức âm lượng của lần phát trước đó
            // (kể cả video khác), muốn mỗi video mới đều bắt đầu ở 100%.
            player.setVolume?.(100);
            player.unMute?.();
            setVolume(100);
            setIsMuted(false);

            pollRef.current = window.setInterval(() => {
              const player = playerRef.current;
              if (!player?.getCurrentTime) return;
              const t = player.getCurrentTime();

              // Đang kéo tay thanh tua thì đừng ghi đè currentTime bằng giá
              // trị thật từ player - không thì tay cầm giật ngược lại giữa
              // chừng kéo (xem scrubbingRef + effect commit tua bên dưới).
              if (!scrubbingRef.current) setCurrentTime(t);
              // Có video getDuration() trả 0 lúc mới onReady (metadata chưa
              // load xong) - tự làm mới cho tới khi có giá trị thật.
              const d = player.getDuration?.();
              if (d) setDuration((prev) => (prev !== d ? d : prev));

              const segs = segmentsRef.current;
              const active = activeIndexRef.current;
              const current = segs[active];
              if (current && t >= current.start - 0.05 && t < current.end) {
                if (loopLineRef.current && t >= current.end - LOOP_EPSILON) {
                  player.seekTo(current.start, true);
                }
                return;
              }
              const found = segs.findIndex((s) => t >= s.start && t < s.end);
              if (found !== -1 && found !== active) {
                setActiveIndex(found);
              }
            }, POLL_MS);
          },
          // YT.PlayerState: -1 chưa phát, 0 đã hết, 1 đang phát, 2 tạm dừng,
          // 3 đang buffer, 5 đã cued - chỉ "1" mới coi là đang phát, còn lại
          // đều hiện lại nút Play to giữa video.
          onStateChange: (e: any) => {
            setIsPlaying(e.data === 1);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      destroyPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, videoId]);

  // Tự cuộn dòng phụ đề đang active vào khung nhìn - tắt được qua nút "Tự
  // cuộn" (displayPrefs.autoScroll) cho ai muốn tự đọc/kéo tay, khỏi bị
  // giật lên xuống theo video. Neo ở khoảng 38% từ trên xuống (lên trên 1
  // xíu so với chính giữa) thay vì scrollIntoView block:'center' (50%) -
  // thấy được nhiều câu sắp tới hơn câu đã qua, tự nhiên hơn khi đọc theo.
  useEffect(() => {
    if (!displayPrefs.autoScroll) return;
    const container = subtitleListRef.current;
    const el = lineRefs.current[activeIndex];
    if (!container || !el) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offsetWithinContainer = elRect.top - containerRect.top + container.scrollTop;
    const anchorRatio = 0.38;
    const targetTop = offsetWithinContainer - container.clientHeight * anchorRatio + el.clientHeight / 2;

    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }, [activeIndex, displayPrefs.autoScroll]);

  // Ghi nhận "đã xem" mỗi khi dòng active đổi lúc đang ở stage 'ready' (kể
  // cả lần đầu mở, activeIndex=0 cũng tính) - đủ để tính badge "Đã xem",
  // dải "Tiếp tục xem" và bỏ badge "Mới" cho video này ở lần mở sau.
  useEffect(() => {
    if (stage !== 'ready' || !videoId || segments.length === 0) return;
    setProgress((prev) => {
      const next = withProgress(prev, videoId, activeIndex, segments.length);
      saveShadowingProgress(next);
      return next;
    });
  }, [stage, videoId, activeIndex, segments.length]);

  const startShadowing = async (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) {
      setInlineHint('Dán link YouTube vào đây đã nhé.');
      return;
    }
    if (!looksLikeYoutubeLink(url)) {
      setInlineHint('Link này không giống link YouTube.');
      return;
    }
    setInlineHint(null);
    setStage('loading');
    try {
      const res = await fetch('/kaiwa/shadowing/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data: TranscriptResponse = await res.json().catch(() => null as any);
      if (!data) {
        setErrorMessage('Không kết nối được máy chủ, thử lại sau.');
        setStage('error');
        return;
      }
      if (!data.ok || !data.videoId || !data.segments?.length) {
        setErrorMessage(data.message || 'Không lấy được phụ đề từ video này.');
        setStage('error');
        return;
      }
      setVideoId(data.videoId);
      setSegments(data.segments);
      setActiveIndex(0);
      setStage('ready');
    } catch {
      setErrorMessage('Không kết nối được máy chủ, thử lại sau.');
      setStage('error');
    }
  };

  const handleLoad = () => {
    startShadowing(linkValue);
  };

  // Video có sẵn đã có subtitle_json (admin làm giàu romaji/vi rồi dán lại
  // Supabase, xem handleExportJson) -> dùng thẳng, khỏi gọi lại yt-dlp.
  // Thiếu/rỗng thì rơi về đường cũ (gọi /kaiwa/shadowing/transcript). Cột
  // này KHÔNG có sẵn trong `video` truyền vào nữa (danh sách chỉ tải cột
  // nhẹ - xem useEffect tải presetVideos ở trên), nên phải tự fetch riêng
  // đúng 1 hàng theo id ngay lúc bấm, chỉ tốn request cho video thật sự mở.
  const handlePickPreset = async (video: PresetVideo) => {
    setInlineHint(null);
    setStage('loading');

    const supabase = (window as any).supabaseClient;
    let subtitleJson: Segment[] | null | undefined;
    if (supabase) {
      const { data, error } = await supabase
        .from('kaiwa_shadowing_videos')
        .select('subtitle_json')
        .eq('id', video.id)
        .single();
      if (!error) subtitleJson = data?.subtitle_json;
    }

    if (Array.isArray(subtitleJson) && subtitleJson.length > 0) {
      const ytId = extractYoutubeId(video.youtube_url);
      if (ytId) {
        setVideoId(ytId);
        setSegments(subtitleJson);
        setActiveIndex(0);
        setStage('ready');
        return;
      }
    }
    startShadowing(video.youtube_url);
  };

  // Quay về màn danh sách (mở lại - chọn video khác/thử lại) - dán link tay
  // vẫn vào được từ đó qua nút "Dán link khác".
  const handleBackToList = () => {
    destroyPlayer();
    setStage('list');
    setVideoId(null);
    setSegments([]);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setControlsVisible(true);
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  };

  // Admin-only: tải transcript hiện tại (JP gốc, chưa romaji/vi) ra file
  // JSON để đem qua AI ngoài làm giàu, rồi dán ngược kết quả vào cột
  // subtitle_json của đúng hàng này trên Supabase (xem hướng dẫn đã đưa).
  const handleExportJson = () => {
    // Để sẵn 2 trường romaji/vi rỗng - AI ngoài chỉ cần điền vào chỗ trống,
    // không cần tự thêm key mới (đỡ sai cấu trúc khi dán ngược lại Supabase).
    const payload = segments.map(({ start, end, text }) => ({
      start,
      end,
      text,
      romaji: '',
      vi: '',
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadowing-${videoId || 'export'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleLineClick = (index: number) => {
    const seg = segments[index];
    if (!seg || !playerRef.current) return;
    setActiveIndex(index);
    playerRef.current.seekTo(seg.start, true);
    playerRef.current.playVideo?.();
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    playerRef.current?.setPlaybackRate?.(rate);
  };

  const HIDE_CONTROLS_MS = 2500;

  // Hiện lại thanh điều khiển + đặt lại đồng hồ đếm ngược ẩn - gọi mỗi khi
  // có tương tác trên vùng video (rê chuột/chạm/bấm). Chỉ thật sự đặt lịch
  // ẩn khi đang phát - lúc tạm dừng thanh điều khiển giữ nguyên luôn hiện
  // (video đứng yên thì không có lý do gì phải ẩn đi).
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    if (isPlaying) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, HIDE_CONTROLS_MS);
    }
  }, [isPlaying]);

  // Vừa chuyển sang phát - tự đặt lịch ẩn sau vài giây; vừa tạm dừng thì
  // hiện lại ngay và huỷ mọi lịch ẩn đang chờ.
  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = null;
      }
      return;
    }
    hideControlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_MS);
    return () => {
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  const handleTogglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) player.pauseVideo?.();
    else player.playVideo?.();
    // Không tự setIsPlaying ở đây - onStateChange (đăng ký lúc tạo player)
    // sẽ tự cập nhật đúng theo trạng thái thật của player, tránh 2 nguồn sự
    // thật lệch nhau nếu play/pauseVideo() không đổi trạng thái kịp.
  };

  // Kéo thanh tua chỉ CẬP NHẬT hiển thị (scrubDraft) - chưa gọi seekTo() ở
  // đây, để khỏi gọi seekTo() dồn dập theo từng pixel kéo (giật/lag). Chỉ
  // thật sự tua khi nhả tay (xem effect commit-tua ngay dưới).
  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    scrubbingRef.current = true;
    scrubDraftRef.current = v;
    setScrubDraft(v);
    showControlsTemporarily(); // đang kéo thì đừng để thanh tự ẩn giữa chừng
  };

  // Nhả tay thanh tua (chuột lẫn cảm ứng) mới thật sự seekTo() - lắng nghe
  // trên window (không phải trên input) vì nhả chuột ngoài phạm vi input
  // lúc đang kéo nhanh vẫn phải tính là nhả tay, không thì tay cầm bị kẹt
  // mãi ở chế độ "đang kéo".
  useEffect(() => {
    const commitSeek = () => {
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      playerRef.current?.seekTo?.(scrubDraftRef.current, true);
      setCurrentTime(scrubDraftRef.current);
      setScrubDraft(null);
    };
    window.addEventListener('mouseup', commitSeek);
    window.addEventListener('touchend', commitSeek);
    return () => {
      window.removeEventListener('mouseup', commitSeek);
      window.removeEventListener('touchend', commitSeek);
    };
  }, []);

  const handleToggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isMuted || volume === 0) {
      player.unMute?.();
      const restored = volume > 0 ? volume : 50;
      player.setVolume?.(restored);
      setVolume(restored);
      setIsMuted(false);
    } else {
      player.mute?.();
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    playerRef.current?.setVolume?.(v);
    if (v === 0) {
      playerRef.current?.mute?.();
      setIsMuted(true);
    } else {
      playerRef.current?.unMute?.();
      setIsMuted(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex justify-center items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-blue-900 w-full h-full sm:h-[92vh] max-w-6xl sm:rounded-3xl shadow-2xl border-b border-surface-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-surface-border bg-blue-800 z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Trở về danh sách video - thay cho nút "Đổi video" cũ, chỉ có
                nghĩa (và chỉ hiện) lúc đang xem 1 video cụ thể. */}
            {stage === 'ready' && (
              <button
                onClick={handleBackToList}
                aria-label="Trở về danh sách video"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-blue-500/20 hover:text-blue-200 transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2.5 truncate">
              <Youtube className="w-6 h-6 text-red-500 shrink-0" />
              Nghe Podcast
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Xuất transcript hiện tại ra JSON - chỉ admin, chỉ có nghĩa khi
                đang xem 1 video (stage 'ready', xem handleExportJson). */}
            {isAdmin && stage === 'ready' && (
              <button
                onClick={handleExportJson}
                aria-label="Xuất transcript hiện tại ra JSON"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-blue-500/20 hover:text-blue-200 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            {/* Dán link YouTube tay - chỉ admin (xem isAdmin ở trên): học viên
                chỉ duyệt danh sách có sẵn, không tự nhét link ngoài vào. */}
            {isAdmin && stage !== 'input' && (
              <button
                onClick={() => { setStage('input'); setInlineHint(null); }}
                aria-label="Dán link YouTube khác (chỉ admin)"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-blue-500/20 hover:text-blue-200 transition-all cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setShowCloseConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-[#8fb0ce] hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* STAGE: list - danh sách video có sẵn (lấy từ Supabase), màn mặc định lúc mở tool */}
        {stage === 'list' && (
          <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto hide-scrollbar">
            {presetLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10">
                <Loader2 className="w-9 h-9 text-blue-700 animate-spin" />
                <span className="text-sm font-bold text-[#8fb0ce]">Đang tải danh sách video...</span>
              </div>
            )}

            {!presetLoading && presetError && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-[#8fb0ce] max-w-sm">{presetError}</p>
              </div>
            )}

            {!presetLoading && !presetError && presetVideos.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center">
                  <ListVideo className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-[#8fb0ce] max-w-sm">Chưa có video nào trong danh sách có sẵn.</p>
              </div>
            )}

            {!presetLoading && presetVideos.length > 0 && (
              <>
                {/* Chip lọc - cuộn ngang, đủ chỗ trên cả điện thoại lẫn máy tính */}
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 shrink-0 hide-scrollbar">
                  {(
                    [
                      { key: 'all' as const, label: 'Tất cả', count: presetVideos.length },
                      { key: 'new' as const, label: 'Mới thêm', count: newCount },
                      { key: 'saved' as const, label: 'Đã lưu', count: savedCount },
                      { key: 'watched' as const, label: 'Đã xem', count: watchedCount },
                      { key: 'unwatched' as const, label: 'Chưa xem', count: unwatchedCount },
                    ]
                  ).map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${
                        activeFilter === f.key
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white/10 border-white/10 text-[#8fb0ce] hover:border-white/20'
                      }`}
                    >
                      {f.label}
                      <span className={`tabular-nums ${activeFilter === f.key ? 'text-blue-600' : 'text-[#8fb0ce]'}`}>{f.count}</span>
                    </button>
                  ))}
                </div>

                {/* Tiếp tục xem - chỉ ở tab "Tất cả" (tránh trùng ý với tab "Đã xem"),
                    chỉ hiện khi có video đang xem dở. */}
                {activeFilter === 'all' && continueWatching.length > 0 && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-[#8fb0ce] uppercase tracking-wider">Tiếp tục xem</span>
                    <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
                      {continueWatching.map(({ video, ytId }) => {
                        const entry = getShadowingEntry(progress, ytId || '');
                        const pct = entry.totalSegments
                          ? Math.round((((entry.lastSegmentIndex ?? 0) + 1) / entry.totalSegments) * 100)
                          : 0;
                        return (
                          <button
                            key={video.id}
                            onClick={() => handlePickPreset(video)}
                            className="shrink-0 w-36 text-left group cursor-pointer"
                          >
                            <div className="relative w-36 h-[81px] rounded-lg overflow-hidden bg-white/10">
                              {ytId && (
                                <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                                <PlayCircle className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
                              </div>
                              <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/50">
                                <span className="block h-full bg-blue-500" style={{ width: `${pct}%` }} />
                              </span>
                            </div>
                            {/* KHÔNG thêm class "block" vào đây: line-clamp-2 cần
                                display:-webkit-box mới cắt được 2 dòng, mà CSS
                                .block sinh ra sau .line-clamp-2 cùng độ ưu tiên
                                nên ghi đè thành display:block -> tiêu đề chạy
                                3+ dòng và lệch hàng. line-clamp-2 tự nó đã là
                                block-level rồi. min-h chừa đúng 2 dòng (33px)
                                để thẻ 1 dòng và 2 dòng thẳng hàng nhau. */}
                            <span className="mt-1.5 min-h-[2.0625rem] text-xs font-bold text-white leading-snug line-clamp-2">{video.title}</span>
                            <span className="block text-[11px] font-semibold text-[#8fb0ce] mt-0.5 tabular-nums">Đã xem {pct}%</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Danh sách video theo bộ lọc đang chọn. Mobile: 1 cột, hàng
                    ngang (thumbnail trái, tiêu đề phải). Desktop (md+): lưới 4
                    video/hàng, thumbnail trên, tiêu đề dưới, tối đa 2 dòng rồi
                    mới "...". */}
                {filteredVideos.length === 0 && !(activeFilter === 'all' && continueWatching.length > 0) ? (
                  // Tab "Tất cả" mà rỗng vì mọi video đều đang nằm trong dải
                  // "Tiếp tục xem" ở trên thì không tính là rỗng thật - khỏi
                  // hiện thông báo (dải phía trên đã hiện đủ hết rồi).
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <p className="text-sm font-semibold text-[#8fb0ce] max-w-sm">
                      {activeFilter === 'saved' && 'Chưa lưu video nào - bấm biểu tượng ♡ trên video để lưu.'}
                      {activeFilter === 'watched' && 'Chưa xem video nào trong danh sách này.'}
                      {activeFilter === 'unwatched' && 'Video nào cũng đã xem hết rồi - không còn video chưa xem.'}
                      {activeFilter === 'new' && 'Không có video nào mới thêm hôm nay.'}
                    </p>
                  </div>
                ) : filteredVideos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4">
                    {filteredVideos.map((video) => {
                      const ytId = extractYoutubeId(video.youtube_url);
                      const entry = getShadowingEntry(progress, ytId || '');
                      const pct = entry.totalSegments
                        ? (((entry.lastSegmentIndex ?? 0) + 1) / entry.totalSegments) * 100
                        : 0;
                      return (
                        <div
                          key={video.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handlePickPreset(video)}
                          onKeyDown={(e) => handleCardKeyDown(e, video)}
                          className="flex items-center gap-3 md:flex-col md:items-stretch md:gap-2 text-left px-3 py-2.5 md:p-2 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer"
                        >
                          <div className="relative w-36 h-[81px] md:w-full md:h-auto md:aspect-video shrink-0 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
                            {ytId ? (
                              <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <PlayCircle className="w-6 h-6 text-[#8fb0ce]" />
                            )}
                            {isNewVideo(video.created_at, entry) && (
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-black uppercase tracking-wide leading-none">
                                Mới
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleToggleSaved(e, ytId)}
                              aria-label={entry.saved ? 'Bỏ lưu video này' : 'Lưu video này'}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 hover:bg-black/70 flex items-center justify-center transition-all cursor-pointer"
                            >
                              <Heart className={`w-3.5 h-3.5 ${entry.saved ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
                            </button>
                            {entry.completed ? (
                              <span className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-emerald-600 ring-2 ring-white flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                              </span>
                            ) : pct > 0 ? (
                              <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/40">
                                <span className="block h-full bg-blue-500" style={{ width: `${pct}%` }} />
                              </span>
                            ) : null}
                            {video.duration && (
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-bold tabular-nums leading-none">
                                {video.duration}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-white leading-snug md:line-clamp-2">{video.title}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {/* STAGE: input */}
        {stage === 'input' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5 overflow-y-auto hide-scrollbar">
            <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center">
              <Link2 className="w-8 h-8" />
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-lg font-black text-white mb-1.5">Dán link YouTube để luyện Shadowing</h3>
              <p className="text-sm text-[#8fb0ce] font-medium leading-relaxed">
                Video sẽ được nhúng lại và phụ đề tiếng Nhật có sẵn trên YouTube (do người tạo thêm hoặc tự động) sẽ chạy đồng bộ theo lời nói.
              </p>
            </div>
            <div className="w-full max-w-md flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkValue}
                  onChange={(e) => { setLinkValue(e.target.value); setInlineHint(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLoad(); }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-white/15 text-sm font-medium text-white placeholder:text-white/40 bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
                <button
                  onClick={handleLoad}
                  className="shrink-0 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Bắt đầu
                </button>
              </div>
              {inlineHint && <span className="text-xs font-semibold text-red-500 px-1">{inlineHint}</span>}
              {presetVideos.length > 0 && (
                <button
                  onClick={() => setStage('list')}
                  className="self-center mt-1 flex items-center gap-1.5 text-xs font-bold text-blue-300 hover:text-blue-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Quay về danh sách có sẵn
                </button>
              )}
            </div>
          </div>
        )}

        {/* STAGE: loading */}
        {stage === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-9 h-9 text-blue-700 animate-spin" />
            <span className="text-sm font-bold text-[#8fb0ce]">Đang lấy phụ đề tiếng Nhật từ video...</span>
          </div>
        )}

        {/* STAGE: error */}
        {stage === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-[#8fb0ce] max-w-sm">{errorMessage}</p>
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              Thử link khác
            </button>
          </div>
        )}

        {/* STAGE: ready - video + phụ đề */}
        {stage === 'ready' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
              {/* Vùng phát video */}
              <div className="md:w-[58%] shrink-0 flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto hide-scrollbar">
                <div
                  className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg group"
                  onMouseMove={showControlsTemporarily}
                  onTouchStart={showControlsTemporarily}
                >
                  {/* Khung nhúng thật - pointer-events-none khoá hẳn, không
                      ai bấm được vào bên trong (logo/tiêu đề mở tab YouTube
                      mới, nút cài đặt gốc...). Toàn bộ thao tác đi qua lớp
                      phủ + thanh điều khiển tự code bên dưới, không đụng gì
                      tới UI gốc của YouTube nữa (đã ẩn qua controls:0). */}
                  <div ref={playerContainerRef} className="w-full h-full pointer-events-none" />

                  {/* Lớp phủ toàn khung hình - bấm vào bất kỳ đâu (ngoài
                      thanh điều khiển bên dưới) để phát/tạm dừng, giống mọi
                      trình phát video chuẩn. Icon to giữa video CHỈ hiện
                      nút Play lúc đang tạm dừng - lúc đang phát bấm vào vẫn
                      tạm dừng bình thường, chỉ là không hiện icon Pause to
                      giữa màn hình nữa (đỡ che video). */}
                  <button
                    type="button"
                    onClick={() => { handleTogglePlay(); showControlsTemporarily(); }}
                    aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                    className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer"
                  >
                    {!isPlaying && (
                      <span className="w-14 h-14 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                      </span>
                    )}
                  </button>

                  {/* Thanh điều khiển tự code: tua / phát-tạm dừng / âm
                      lượng - tự ẩn sau vài giây không rê chuột/chạm lúc
                      đang phát (showControlsTemporarily), hiện lại ngay khi
                      có tương tác hoặc lúc tạm dừng. pointer-events-none
                      lúc ẩn để chạm vào vùng này (dù không thấy gì) vẫn rơi
                      xuống lớp phủ phía dưới, phát/tạm dừng như bình thường
                      thay vì bị chặn bởi 1 thanh vô hình. */}
                  <div
                    className={`absolute inset-x-0 bottom-0 z-20 px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col gap-1.5 transition-opacity duration-300 ${
                      controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.1}
                      value={scrubDraft ?? currentTime}
                      onChange={handleSeekInput}
                      onMouseDown={() => { scrubbingRef.current = true; showControlsTemporarily(); }}
                      onTouchStart={() => { scrubbingRef.current = true; showControlsTemporarily(); }}
                      className="player-range w-full"
                      style={{ ['--fill' as any]: `${duration > 0 ? ((scrubDraft ?? currentTime) / duration) * 100 : 0}%` }}
                      aria-label="Tua video"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                        className="text-white/90 hover:text-white transition-colors"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                      </button>
                      <span className="text-[11px] font-bold text-white/80 tabular-nums shrink-0">
                        {formatTime(scrubDraft ?? currentTime)} / {formatTime(duration)}
                      </span>
                      <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5 shrink-0">
                        {SPEEDS.map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => { handleSpeedChange(rate); showControlsTemporarily(); }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                              playbackRate === rate ? 'bg-white text-blue-700' : 'text-white/70 hover:text-white'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => { handleToggleMute(); showControlsTemporarily(); }}
                        aria-label={isMuted || volume === 0 ? 'Bật tiếng' : 'Tắt tiếng'}
                        className="text-white/90 hover:text-white transition-colors shrink-0"
                      >
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => { handleVolumeChange(e); showControlsTemporarily(); }}
                        className="player-range w-14 sm:w-20 shrink-0"
                        style={{ ['--fill' as any]: `${isMuted ? 0 : volume}%` }}
                        aria-label="Âm lượng"
                      />
                    </div>
                  </div>
                </div>

                {/* Câu đang phát - chỉ máy tính. Ẩn theo THIẾT BỊ CẢM ỨNG THẬT
                    (class .current-sentence-card, xem CSS trong index.css -
                    @media (hover: none) and (pointer: coarse), cùng cách đã
                    dùng cho .fullscreen-corner-btn bên trang gọi điện), KHÔNG
                    theo độ rộng cửa sổ (breakpoint sm/md) nữa - cửa sổ desktop
                    dù hẹp cỡ nào vẫn còn chuột thật nên vẫn hiện, chỉ điện
                    thoại/tablet cảm ứng thật mới ẩn. Cùng tông màu với thẻ
                    active trong khung phụ đề bên cạnh cho dễ liên tưởng là
                    cùng 1 câu. */}
                {segments[activeIndex] && (
                  <div className="current-sentence-card bg-blue-50 rounded-xl px-4 py-4 shrink-0 text-center">
                    <p className="text-lg font-semibold text-blue-900 leading-relaxed">{segments[activeIndex].text}</p>
                    {displayPrefs.showRomaji && segments[activeIndex].romaji && (
                      <p className="text-sm italic text-blue-700 mt-1">{segments[activeIndex].romaji}</p>
                    )}
                    {displayPrefs.showVi && segments[activeIndex].vi && (
                      <p className="text-sm text-emerald-700 mt-1">{segments[activeIndex].vi}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Vùng phụ đề chạy */}
              <div className="flex-1 min-h-0 border-t md:border-t-0 md:border-l border-b border-surface-border flex flex-col">
                <div className="px-4 sm:px-6 py-3 shrink-0 flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  <button
                    onClick={() => setLoopLine((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-white/10 transition-all ${
                      loopLine
                        ? 'border-blue-400 text-blue-300'
                        : 'border-white/10 text-[#8fb0ce] hover:border-white/20'
                    }`}
                  >
                    <Repeat1 className="w-3.5 h-3.5" />
                    Lặp câu
                  </button>
                  <button
                    onClick={() => toggleDisplayPref('showRomaji')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-white/10 transition-all ${
                      displayPrefs.showRomaji
                        ? 'border-blue-400 text-blue-300'
                        : 'border-white/10 text-[#8fb0ce] hover:border-white/20'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" />
                    Romaji
                  </button>
                  <button
                    onClick={() => toggleDisplayPref('showVi')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-white/10 transition-all ${
                      displayPrefs.showVi
                        ? 'border-emerald-400 text-emerald-300'
                        : 'border-white/10 text-[#8fb0ce] hover:border-white/20'
                    }`}
                  >
                    <Languages className="w-3.5 h-3.5" />
                    Dịch
                  </button>
                  <button
                    onClick={() => toggleDisplayPref('autoScroll')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-white/10 transition-all ${
                      displayPrefs.autoScroll
                        ? 'border-blue-400 text-blue-300'
                        : 'border-white/10 text-[#8fb0ce] hover:border-white/20'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    Tự cuộn
                  </button>
                </div>
                <div ref={subtitleListRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-4 pb-8 flex flex-col gap-1.5">
                  {segments.map((seg, idx) => {
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={idx}
                        ref={(el) => { lineRefs.current[idx] = el; }}
                        onClick={() => handleLineClick(idx)}
                        className={`text-left px-4 py-3 rounded-xl border-l-4 transition-all flex items-start gap-3 ${
                          active ? 'bg-blue-50 md:bg-blue-100 border-blue-600 shadow-sm' : 'border-transparent hover:bg-white/5'
                        }`}
                      >
                        <span className={`text-[10px] font-bold mt-1 shrink-0 tabular-nums ${active ? 'text-blue-700' : 'text-[#8fb0ce]'}`}>
                          {formatTime(seg.start)}
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className={`text-[15px] sm:text-base leading-relaxed font-semibold ${active ? 'text-blue-900' : 'text-white/80'}`}>
                            {seg.text}
                          </span>
                          {displayPrefs.showRomaji && seg.romaji && (
                            <span className={`text-xs sm:text-[13px] italic leading-snug ${active ? 'text-blue-700' : 'text-[#8fb0ce]'}`}>
                              {seg.romaji}
                            </span>
                          )}
                          {displayPrefs.showVi && seg.vi && (
                            <span className={`text-xs sm:text-[13px] leading-snug ${active ? 'text-emerald-700' : 'text-emerald-400'}`}>
                              {seg.vi}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Popup xác nhận đóng tool - tránh bấm nhầm dấu X mất tiến trình
          đang xem/luyện (xem showCloseConfirm ở trên). */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[800] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCloseConfirm(false)}>
          <div className="bg-blue-900 border border-surface-border rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl flex flex-col text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-8 flex items-center justify-center gap-2.5">
              <Youtube className="w-5 h-5 text-red-500 shrink-0" />
              Đóng Nghe Podcast?
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-[#8fb0ce] bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => { setShowCloseConfirm(false); onClose(); }}
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

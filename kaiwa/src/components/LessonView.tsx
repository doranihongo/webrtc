import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, ExternalLink, Languages, ListChecks, ChevronDown, MonitorPlay, Layers, Volume2, Mic } from 'lucide-react';
import { useCourses } from '../context/CoursesContext';
import { useCallEmbed } from '../hooks/useCallEmbed';
import CallControls from './CallControls';
import SlideShow from './SlideShow';
import Blackboard from './Blackboard';
import NotePad from './NotePad';
import FlashcardModal from './FlashcardModal';
import HomeworkModal from './HomeworkModal';
import { buildRawSlideUrls } from '../utils/buildRawSlideUrls';
import { signSlideUrls, SignSlideUrlsError } from '../utils/signSlideUrls';
import { readCachedSignedSlides, writeCachedSignedSlides } from '../utils/signedSlideUrlCache';
import { activateSlideBlobCache, getCachedSlideBlob, loadSlideBlob } from '../utils/slideBlobCache';
import { fetchHomeworksForLesson, fetchMySubmissions, subscribeToMySubmissionChanges } from '../utils/supabaseHomework';
import type { VocabWord, GrammarPoint, Homework } from '../types';

/**
 * Khoá dùng cho `slideBlobUrlsRef` (LessonView) - lấy PATHNAME của URL đã
 * ký (bỏ qua query string `exp`/`sig`), để 1 ảnh vẫn nhận diện được đúng
 * Blob đã tải trước đó dù URL vừa được ký LẠI (làm mới token nền, đổi
 * exp/sig nhưng ảnh thật không đổi) - không phải tải+decode lại từ đầu chỉ
 * vì token mới. Parse lỗi (URL không hợp lệ, hiếm) thì dùng nguyên chuỗi
 * URL làm khoá, vẫn đúng chỉ là mất phần tối ưu "sống sót qua làm mới".
 */
function getSlidePathKey(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Trang chi tiết 1 bài học.
 *   - "Tài liệu" (học viên): `lesson.lessonFileUrl` - luôn mở ra TAB MỚI
 *     (thường là link Google Drive chia sẻ, không phải file trực tiếp nên
 *     không nhúng được trong app - Drive cần phiên đăng nhập riêng của
 *     Google, không đi kèm cookie đăng nhập của web này).
 *   - "Slide" (chỉ giáo viên/admin, và chỉ khóa nằm trong allowed_courses
 *     của họ - xem utils/courseAccess.ts): `lesson.slideFolder` - 1 thư mục
 *     ảnh đặt tên tuần tự (1.svg/2.svg/...), sinh URL qua
 *     utils/buildRawSlideUrls.ts rồi PHẢI ký qua server (HMAC + hạn dùng,
 *     utils/signSlideUrls.ts - domain ảnh đứng sau 1 Cloudflare Worker chỉ
 *     phục vụ URL có chữ ký hợp lệ) trước khi hiển thị bằng SlideShow.tsx -
 *     xem effect ký+làm mới slide bên dưới.
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
  const { showCallControls, isPipActive, userRole, isEmbeddedInCall } = useCallEmbed();
  // Chỉ giaovien/admin mới thấy nút "Slide" - học viên không có.
  const isTeacherOrAdmin = userRole === 'giaovien' || userRole === 'admin';
  const isStudent = userRole === 'hocvien';

  // true = đang mở popup "Bài tập về nhà" (xem HomeworkModal.tsx) - học
  // viên tự nộp/xoá bài, giáo viên/admin tra bài học viên qua mã.
  const [isHomeworkOpen, setIsHomeworkOpen] = useState(false);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  // id các đề bài học viên (chính mình) ĐÃ nộp - chỉ để quyết định tiêu đề/
  // ô báo trên NÚT "Bài tập" (xem lưới nút bên dưới). CHỈ tra danh sách đã
  // nộp (nhẹ, qua Supabase) - KHÔNG tải byte audio nào ở đây (xem
  // HomeworkAudioPlayer.tsx, chỉ tải khi bấm play trong popup).
  const [mySubmittedHomeworkIds, setMySubmittedHomeworkIds] = useState<Set<string>>(new Set());
  const allHomeworkSubmitted = homeworks.length > 0 && homeworks.every((hw) => mySubmittedHomeworkIds.has(hw.id));

  // Khoá nhận diện 1 buổi học, dùng cho cache slide theo từng buổi (xem
  // utils/slideBlobCache.ts) và key={lessonKey} của Blackboard/NotePad bên
  // dưới - sang buổi khác mới tải lại/xoá nội dung buổi cũ.
  const lessonKey = `${courseId}_${lessonId}`;

  // Danh sách đề bài tập về nhà của buổi học này (đọc thẳng qua Supabase,
  // RLS cho phép mọi người đã đăng nhập xem - xem utils/supabaseHomework.ts).
  // Cả 2 role đều cần: học viên để hiện khu ghi âm/nộp bài, giáo viên để
  // map homeworkId -> tên đề bài khi hiện danh sách bài học viên đã nộp.
  useEffect(() => {
    let cancelled = false;
    fetchHomeworksForLesson(lessonId).then((list) => {
      if (!cancelled) setHomeworks(list || []);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // Trạng thái "đã nộp đủ chưa" cho riêng NÚT bài tập (chỉ học viên) - danh
  // sách bài nộp (không phải file audio) nên tải ngay, không đợi mở popup;
  // tự cập nhật realtime khi nộp/xoá bên trong HomeworkModal.
  const homeworkIdsForButton = homeworks.map((h) => h.id).join(',');
  useEffect(() => {
    if (!isStudent || homeworks.length === 0) {
      setMySubmittedHomeworkIds(new Set());
      return;
    }
    let cancelled = false;
    const reload = () => {
      fetchMySubmissions(homeworks.map((h) => h.id)).then((subs) => {
        if (!cancelled && subs) setMySubmittedHomeworkIds(new Set(subs.map((s) => s.homeworkId)));
      });
    };
    reload();
    const unsubscribe = subscribeToMySubmissionChanges(reload);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent, homeworkIdsForButton]);

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

  // Tất cả từ vựng đều đọc bằng giọng máy trình duyệt (Web Speech API) -
  // trước đây từ có audio thu sẵn dùng file mp3 thật, từ noAudio mới đọc
  // giọng máy, nhưng đổi thống nhất về 1 nguồn duy nhất cho đồng bộ (không
  // còn phân biệt 2 màu icon loa/2 nguồn phát nữa - xem utils/vocabAudioCache.ts
  // cũ, giờ không còn dùng tới).
  const playVocabAudio = (v: VocabWord) => {
    if (!window.speechSynthesis) return; // trình duyệt không hỗ trợ TTS
    // Bấm lại đúng thẻ đang phát -> dừng luôn (toggle).
    if (playingVocabId === v.id) {
      window.speechSynthesis.cancel();
      setPlayingVocabId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(v.reading || v.word);
    utterance.lang = 'ja-JP';
    setPlayingVocabId(v.id);
    utterance.onend = () => setPlayingVocabId((cur) => (cur === v.id ? null : cur));
    utterance.onerror = () => setPlayingVocabId((cur) => (cur === v.id ? null : cur));
    window.speechSynthesis.speak(utterance);
  };

  // Dừng giọng đọc đang phát khi rời trang buổi học.
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
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

  // --- Tài liệu bài học (học viên) ---
  const lessonFileUrl: string | undefined = lesson?.lessonFileUrl?.trim();
  const hasLessonFile = !!lessonFileUrl;

  /** Luôn mở tab mới - xem giải thích ở comment đầu file. */
  const openLessonFile = () => {
    if (!hasLessonFile) return;
    window.open(lessonFileUrl, '_blank', 'noopener,noreferrer');
  };

  // --- Slide trình chiếu (giáo viên/admin) ---
  // buildRawSlideUrls.ts sinh URL CHƯA KÝ (ưu tiên `slideCount` - biết sẵn
  // số trang thì sinh thẳng mảng URL, KHÔNG cần dò; rơi về probeSlideImages
  // khi buổi học chưa điền `slideCount` - xem file đó để biết chi tiết).
  // signSlideUrls.ts sau đó ký (server kiểm tra role + allowed_courses của
  // ĐÚNG khóa buổi học này trước khi ký, xem app/src/server.js) - domain ảnh
  // đứng sau 1 Cloudflare Worker chỉ phục vụ URL có chữ ký hợp lệ, hạn dùng
  // (mặc định 2 tiếng, SLIDE_URL_SIGNING_TTL_SECONDS) nên cần tự làm mới
  // NGẦM trước khi hết hạn (scheduleRefresh bên dưới) - không ai phải F5.
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [slideProbing, setSlideProbing] = useState(false);
  const [slideSignError, setSlideSignError] = useState<string | null>(null);
  const slideRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // true khi lần cập nhật slideImages KẾ TIẾP là do làm mới token NGẦM
  // (không phải lần tải đầu buổi học) - effect preload bên dưới đọc cờ này
  // để không reset preloadedCount/hiện lại "Slide... x%" chỉ vì token được
  // âm thầm ký lại, ảnh cũ vẫn đang xem bình thường không cần tải lại gì.
  const isBackgroundSlideRefreshRef = useRef(false);

  useEffect(() => {
    setSlideImages([]);
    setSlideSignError(null);
    if (slideRefreshTimerRef.current) {
      clearTimeout(slideRefreshTimerRef.current);
      slideRefreshTimerRef.current = null;
    }
    // Chỉ giáo viên/admin mới cần slide - tránh gọi ký URL (round-trip +
    // luôn bị server từ chối) cho học viên, những người còn không thấy nút
    // "Slide".
    if (!lesson || !lesson.slideFolder || !isTeacherOrAdmin) return;

    // Kích hoạt cache Blob ảnh ĐÚNG buổi học này NGAY (module-level, xem
    // utils/slideBlobCache.ts) - làm ở đây (không phải effect preload bên
    // dưới) để chắc chắn dọn Blob buổi cũ TRƯỚC khi bất kỳ ảnh nào của buổi
    // mới bắt đầu tải, và để không phải thêm lessonKey vào deps effect
    // preload (deps hiện chỉ theo slideImages, gọn hơn).
    activateSlideBlobCache(lessonKey);

    let cancelled = false;

    const scheduleRefresh = (exp: number) => {
      const REFRESH_MARGIN_MS = 10 * 60 * 1000; // ký lại 10' trước khi hết hạn
      const delay = Math.max(30_000, exp * 1000 - Date.now() - REFRESH_MARGIN_MS);
      slideRefreshTimerRef.current = setTimeout(() => {
        if (!cancelled) loadAndSign(true);
      }, delay);
    };

    const loadAndSign = async (isBackgroundRefresh: boolean) => {
      if (!isBackgroundRefresh) setSlideProbing(true);
      try {
        const rawUrls = await buildRawSlideUrls(lesson);
        if (cancelled) return;
        if (rawUrls.length === 0) {
          setSlideImages([]);
          return;
        }
        const { urls: signedUrls, exp } = await signSlideUrls(lessonId, rawUrls);
        if (cancelled) return;
        isBackgroundSlideRefreshRef.current = isBackgroundRefresh;
        setSlideImages(signedUrls);
        setSlideSignError(null);
        writeCachedSignedSlides(lessonId, lesson, { exp, urls: signedUrls });
        scheduleRefresh(exp);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof SignSlideUrlsError ? err.message : 'Không ký được URL slide.';
        setSlideSignError(message);
        // Lỗi lúc làm mới NGẦM (không phải lần tải đầu) - thử lại sau 1
        // phút thay vì bỏ cuộc hẳn (URL cũ còn hạn dùng tạm trong lúc chờ,
        // slideImages hiện có KHÔNG bị xoá).
        if (isBackgroundRefresh) {
          slideRefreshTimerRef.current = setTimeout(() => {
            if (!cancelled) loadAndSign(true);
          }, 60_000);
        }
      } finally {
        if (!cancelled && !isBackgroundRefresh) setSlideProbing(false);
      }
    };

    // F5 lại trang (hay quay lại đúng buổi học này, kể cả sau khi đóng hẳn
    // trình duyệt) trong lúc lần ký trước còn hạn - dùng lại NGUYÊN URL cũ,
    // không ký lại: trình duyệt nhận ra đúng ảnh đã tải trước đó (cùng hệt
    // URL, không đổi query string), hiện gần như tức thì thay vì phải
    // tải+decode lại từ đầu (xem utils/signedSlideUrlCache.ts).
    const cached = readCachedSignedSlides(lessonId, lesson);
    if (cached) {
      setSlideImages(cached.urls);
      setSlideSignError(null);
      scheduleRefresh(cached.exp);
    } else {
      loadAndSign(false);
    }

    return () => {
      cancelled = true;
      if (slideRefreshTimerRef.current) clearTimeout(slideRefreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey, lesson?.slideFolder, lesson?.slideExt, lesson?.slideCount, isTeacherOrAdmin, lessonId]);

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
  // Tải THẬT nội dung ảnh bằng fetch()+Blob() (không phải chỉ new Image())
  // rồi giữ lại làm Blob URL trong slideBlobUrlsRef - để khi SlideShow.tsx
  // mở lên và TỰ preload lại (new Image(), xem effect riêng của nó) chỉ
  // việc đọc thẳng Blob URL này (đã có sẵn trong bộ nhớ JS, không qua
  // mạng) thay vì phải tải lại HTTP lần 2 y hệt (no-store ở Worker chặn
  // trình duyệt tự dùng lại byte đã tải cho request thứ 2 - xem comment ở
  // slideBlobUrlsRef). fetch() cần Worker bật CORS (Access-Control-Allow-
  // Origin) mới đọc được nội dung response cross-origin - <img src> trước
  // đây KHÔNG cần vì không đọc được nội dung, chỉ đưa cho trình duyệt tự vẽ.
  //
  // decode() ảnh dựng từ Blob URL trước khi coi là "xong": onload chỉ báo
  // đã tải xong BYTE, chưa chắc đã GIẢI MÃ xong thành bitmap sẵn sàng vẽ -
  // ảnh SVG nặng (Canva xuất ra) decode có thể mất cả giây, gây khựng 1
  // nhịp đúng lúc SlideShow thật sự vẽ ra dù coi như đã "tải xong".
  // decode() đợi ĐÚNG bước đó, nên preload xong là vẽ ra tức thì.
  const PRELOAD_GATE_COUNT = 5;
  const [preloadedCount, setPreloadedCount] = useState(0);
  const gateCount = Math.min(PRELOAD_GATE_COUNT, slideImages.length);

  useEffect(() => {
    if (!isBackgroundSlideRefreshRef.current) {
      setPreloadedCount(0);
    }
    // Tiêu thụ cờ ngay - lần cập nhật slideImages KẾ TIẾP (không rõ nguyên
    // nhân) mặc định coi là tải thật, an toàn hơn (lỡ sai chỉ hiện lại
    // spinner 1 lần oan, không phải lỗ hổng gì).
    isBackgroundSlideRefreshRef.current = false;
    if (!isTeacherOrAdmin || slideImages.length === 0) return;
    let cancelled = false;
    const markLoaded = () => {
      if (!cancelled) setPreloadedCount((c) => c + 1);
    };

    const preloadOne = async (url: string, priority: 'high' | 'low') => {
      const pathKey = getSlidePathKey(url);
      try {
        // loadSlideBlob tự lo hết: dùng lại Blob đã có (vd quay lại đúng
        // buổi học này sau khi ra Trang chủ, hoặc làm mới token nền - URL
        // đổi exp/sig nhưng cùng pathname), HOẶC dùng chung kết quả nếu
        // đang có 1 lượt tải khác dở dang cho ĐÚNG ảnh này (2 effect chạy
        // gần như đồng thời cho cùng 1 lần vào buổi học - đã gặp thực tế),
        // chỉ thật sự fetch() khi chưa ai tải - xem utils/slideBlobCache.ts.
        const blobUrl = await loadSlideBlob(lessonKey, pathKey, async () => {
          // cache: 'no-store' - KHÔNG bao giờ tin cache HTTP cũ của trình
          // duyệt cho đúng URL này (dù URL đổi exp/sig mỗi lần ký lại nên
          // hiếm khi trùng, nhưng phòng trường hợp trình duyệt từng thấy
          // 1 bản Cache-Control cũ/khác từ trước - đã gặp thực tế lúc test:
          // Worker từng có lúc trả Cache-Control dài hạn TRƯỚC khi đổi sang
          // no-store, trình duyệt lỡ lưu đĩa bản đó thì fetch() sau này bị
          // CHÍNH cache đĩa đó trả lời luôn, không ra mạng nữa - bản cache
          // cũ thiếu header CORS (Access-Control-Allow-Origin) mới thêm sau
          // nên fetch() bị chặn hẳn, dù server đã đúng từ lâu). Server cũng
          // đã gửi Cache-Control: no-store nên về nguyên tắc trình duyệt
          // không tự cache nữa - option này chỉ để chắc chắn tuyệt đối.
          const res = await fetch(url, {
            priority,
            cache: 'no-store',
          } as RequestInit & { priority?: 'high' | 'low' | 'auto' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        });
        if (typeof Image === 'function') {
          const img = new Image();
          img.src = blobUrl;
          if (typeof img.decode === 'function') {
            await img.decode().catch(() => {});
          }
        }
      } catch {
        // Lỗi mạng/CORS - bỏ qua, không giữ Blob cho pathKey này. SlideShow
        // sẽ tự nhận URL ký gốc (slideDisplayImages rơi về url gốc khi
        // không có Blob) và tự tải bằng <img src> như trước khi có tối ưu
        // này - vẫn xem được, chỉ không còn hưởng lợi tránh tải 2 lần.
      } finally {
        markLoaded();
      }
    };

    // Giới hạn số ảnh tải+decode CÙNG LÚC (worker pool, không bắn hết N ảnh
    // 1 lượt như trước) - đã gặp thực tế: 18 ảnh PNG nặng (3-6MB/ảnh) cùng
    // fetch()+blob()+decode() đồng thời (không streaming nhẹ nhàng như
    // <img src> nữa, mà phải đệm NGUYÊN blob vào bộ nhớ rồi giải mã) làm
    // "đơ" hẳn tab (renderer không phản hồi nhiều giây) trên máy yếu/nhiều
    // slide. PRELOAD_CONCURRENCY nhỏ vẫn đủ nhanh (ảnh ưu tiên "high" luôn
    // được xếp trước trong hàng đợi nên vẫn về sớm) mà không dồn tải cùng lúc.
    const PRELOAD_CONCURRENCY = 3;
    const queue = slideImages.map((url, i) => ({
      url,
      priority: i < PRELOAD_GATE_COUNT ? ('high' as const) : ('low' as const),
    }));
    let nextIndex = 0;
    const runWorker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= queue.length) return;
        await preloadOne(queue[i].url, queue[i].priority);
      }
    };
    const workerCount = Math.min(PRELOAD_CONCURRENCY, queue.length);
    for (let w = 0; w < workerCount; w++) runWorker();

    return () => {
      cancelled = true;
    };
  }, [isTeacherOrAdmin, slideImages, lessonKey]);

  // Danh sách URL thật sự đưa cho SlideShow hiển thị: dùng Blob URL đã tải
  // sẵn (tức thì, không qua mạng) nếu có, rơi về URL ký gốc cho ảnh nào
  // chưa preload xong kịp (vd trang cuối buổi học nhiều slide) hoặc preload
  // lỗi - SlideShow tự tải nốt bằng <img src> bình thường trong trường hợp
  // đó. Tính lại mỗi lần render (đọc Map module-level, không tốn gì) - tự
  // động đổi dần từ URL gốc sang Blob URL khi từng ảnh preload xong
  // (preloadedCount tăng kéo theo re-render, xem markLoaded ở trên).
  const slideDisplayImages = slideImages.map(
    (url) => getCachedSlideBlob(lessonKey, getSlidePathKey(url)) || url,
  );

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
    // min-h-full shrink-0 (không phải h-full) - cùng lý do như
    // CourseDetail.tsx: tránh nav sticky bị "hết chỗ bám" và biến mất khi
    // cuộn qua khỏi 1 màn hình, vì div này là con flex trực tiếp của
    // #lesson-view-container (App.tsx, overflow-y-auto + flex flex-col).
    // Đi kèm flex-auto (không phải flex-1) ở <main> bên dưới.
    <div className="flex flex-col font-sans min-h-full shrink-0">
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
          mỗi vùng main này. flex-auto (không phải flex-1): flex-basis auto
          để chiều cao nội dung thật của main truyền lên được div cha ở
          trên (chứa nav sticky) - xem comment ở div cha. */}
      <main className="flex-auto max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
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
                    <div className="p-4 bg-black/10 border-t border-white/10 grid sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto custom-scrollbar">
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
                    <div className="p-4 bg-black/10 border-t border-white/10 flex flex-col gap-2 max-h-96 overflow-y-auto custom-scrollbar">
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
          <div className={`grid gap-3 ${isTeacherOrAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
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

            <button
              onClick={() => setIsHomeworkOpen(true)}
              disabled={homeworks.length === 0}
              // Đã nộp đủ (chỉ học viên) -> mờ đi để báo hiệu "xong rồi",
              // nhưng KHÔNG disabled - vẫn bấm vào được để xem lại/nộp lại.
              className={`p-3 py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-md transition-all hover:-translate-y-1 disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0 ${
                isStudent && allHomeworkSubmitted
                  ? 'bg-blue-800/40 border border-blue-400/20 opacity-60 hover:opacity-90 shadow-blue-900/10'
                  : 'bg-blue-600 border border-blue-400/60 shadow-blue-900/30 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-900/40'
              }`}
            >
              <Mic className="w-6 h-6 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {isStudent && allHomeworkSubmitted ? 'Đã nộp' : 'Bài tập'}
              </span>
            </button>
          </div>
          {isTeacherOrAdmin && slideSignError && (
            <p className="text-xs text-red-400 mt-3">
              Không tải được slide: {slideSignError}
            </p>
          )}
          {(() => {
            const missing = [
              vocabulary.length === 0 && 'từ vựng để luyện tập',
              !hasLessonFile && 'tài liệu',
              homeworks.length === 0 && 'bài tập về nhà',
              isTeacherOrAdmin && !hasSlideImages && !slideProbing && !slideSignError && 'slide trình chiếu',
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

      {/* Slide trình chiếu cho giáo viên - ảnh, crossfade khi trước/sau, trang
          1 hiện rõ dần lúc vừa mở (xem SlideShow.tsx) */}
      {teacherSlideOpen && hasSlideImages && (
        <SlideShow
          images={slideDisplayImages}
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

      {/* Bài tập về nhà - học viên tự nộp/xoá, giáo viên/admin tra qua mã học viên */}
      <HomeworkModal
        isOpen={isHomeworkOpen}
        onClose={() => setIsHomeworkOpen(false)}
        homeworks={homeworks}
        lessonId={lessonId}
        userRole={userRole}
        isEmbeddedInCall={isEmbeddedInCall}
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

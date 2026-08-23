// ---------------------------------------------------------
// Nhớ lại bộ URL slide ĐÃ KÝ của 1 buổi học qua localStorage - để F5 lại
// trang (hoặc quay lại đúng buổi học đó, kể cả sau khi đóng hẳn trình
// duyệt) KHÔNG phải ký lại từ đầu (tức không đổi query string exp/sig) nếu
// vẫn còn hạn dùng. Giữ NGUYÊN URL cũ thì trình duyệt mới thật sự tận dụng
// được cache của chính nó (đã tải/decode ảnh này trước đó) - ký lại luôn
// tạo URL MỚI (khác exp/sig) dù ảnh không đổi, khiến trình duyệt coi là
// tài nguyên khác, phải tải+decode lại từ đầu dù Cloudflare edge vẫn còn
// cache sẵn (xem signSlideUrls.ts/LessonView.tsx).
//
// localStorage (không phải sessionStorage) - sống qua cả việc đóng/mở lại
// trình duyệt, KHÔNG tự dọn theo tab như sessionStorage - nên
// readCachedSignedSlides tự XOÁ entry ngay khi phát hiện đã hết hạn, không
// để tồn đọng dữ liệu chết vô thời hạn.
// ---------------------------------------------------------

interface CachedSignedSlides {
  exp: number;
  urls: string[];
  slideFolder: string;
  slideExt?: string;
  slideCount?: number;
}

const KEY_PREFIX = 'kaiwa_signed_slides_';

export interface CacheableSlideLesson {
  slideFolder?: string;
  slideExt?: string;
  slideCount?: number;
}

/**
 * @returns bộ URL đã ký còn hạn dùng CHO ĐÚNG cấu hình slide hiện tại của
 *   buổi học này, hoặc null nếu chưa có/đã hết hạn/cấu hình đã đổi (vd
 *   giáo viên vừa điền/sửa slideCount) - null thì nơi gọi tự ký mới. Tự XOÁ
 *   khỏi localStorage nếu phát hiện đã hết hạn hoặc lệch cấu hình (dọn
 *   dẹp, không tồn đọng dữ liệu chết).
 */
export function readCachedSignedSlides(
  lessonId: string,
  lesson: CacheableSlideLesson,
): { exp: number; urls: string[] } | null {
  const key = KEY_PREFIX + lessonId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: CachedSignedSlides = JSON.parse(raw);

    // Đệm 1 phút - tránh dùng đúng lúc sắp hết hạn (F5 xong vài giây sau
    // link đã die), cứ ký mới cho chắc thay vì tí nữa lại phải làm mới nền.
    if (parsed.exp * 1000 - 60_000 <= Date.now()) {
      localStorage.removeItem(key);
      return null;
    }

    if (
      parsed.slideFolder !== lesson.slideFolder ||
      parsed.slideExt !== lesson.slideExt ||
      parsed.slideCount !== lesson.slideCount
    ) {
      localStorage.removeItem(key);
      return null;
    }

    return { exp: parsed.exp, urls: parsed.urls };
  } catch {
    return null;
  }
}

export function writeCachedSignedSlides(
  lessonId: string,
  lesson: CacheableSlideLesson,
  data: { exp: number; urls: string[] },
): void {
  try {
    const toStore: CachedSignedSlides = {
      exp: data.exp,
      urls: data.urls,
      slideFolder: lesson.slideFolder || '',
      slideExt: lesson.slideExt,
      slideCount: lesson.slideCount,
    };
    localStorage.setItem(KEY_PREFIX + lessonId, JSON.stringify(toStore));
  } catch {
    // localStorage đầy/bị trình duyệt chặn (chế độ ẩn danh nghiêm ngặt...)
    // - bỏ qua, chỉ mất phần tối ưu F5, không phải lỗi nghiêm trọng.
  }
}

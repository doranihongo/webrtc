/**
 * Trạng thái "đã xem / đã lưu" cho tool Shadowing YouTube (xem
 * YoutubeShadowingModal.tsx) - lưu hẳn ở trình duyệt (localStorage), KHÔNG
 * đồng bộ qua Supabase. Đây là lựa chọn có chủ đích: đơn giản, không cần
 * bảng mới + RLS, đổi lại là đổi máy/trình duyệt thì mất trạng thái. Nếu
 * sau này cần đồng bộ nhiều máy, thay 2 hàm load/save bên dưới bằng gọi
 * Supabase là đủ - phần còn lại của component không cần đổi.
 *
 * Khoá theo videoId của YouTube (11 ký tự, xem extractYoutubeId trong
 * YoutubeShadowingModal.tsx) chứ không theo id hàng Supabase - dán tay 1
 * link (không có hàng nào trong kaiwa_shadowing_videos) vẫn lưu được tiến
 * độ bình thường.
 */

export const SHADOWING_PROGRESS_KEY = 'kaiwa_shadowing_progress_v1';
// "Mới" cần cả 2 điều kiện: (1) thêm trong vòng NEW_BADGE_DAYS ngày lịch gần
// nhất VÀ (2) chưa từng mở xem. Thêm hôm nay mà chưa ai xem thì hiện "Mới"
// liên tục NEW_BADGE_DAYS ngày lịch kế tiếp - qua khỏi mốc đó thì rớt khỏi
// mục này dù chưa xem; còn hễ mở xem là rớt ngay lập tức, không cần đợi hết
// hạn. So ngày theo *ngày lịch*, không phải đủ 24 giờ tròn, nên video thêm
// lúc 23h55 vẫn tính hết "ngày thêm" ngay từ 0h hôm sau chứ không phải chờ
// đủ 24 giờ tròn.
export const NEW_BADGE_DAYS = 7;

export interface ShadowingProgressEntry {
  saved: boolean;
  lastWatchedAt: number | null; // Date.now() lúc gần nhất mở video này
  lastSegmentIndex: number | null;
  totalSegments: number | null;
  completed: boolean; // đã cuộn tới dòng phụ đề cuối cùng
}

export type ShadowingProgressMap = Record<string, ShadowingProgressEntry>;

const EMPTY_ENTRY: ShadowingProgressEntry = {
  saved: false,
  lastWatchedAt: null,
  lastSegmentIndex: null,
  totalSegments: null,
  completed: false,
};

export function loadShadowingProgress(): ShadowingProgressMap {
  try {
    const raw = window.localStorage.getItem(SHADOWING_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // localStorage bị chặn (chế độ ẩn danh nghiêm ngặt...) hoặc JSON hỏng -
    // coi như chưa có gì lưu, không phải lỗi nghiêm trọng phải chặn app.
    return {};
  }
}

export function saveShadowingProgress(map: ShadowingProgressMap): void {
  try {
    window.localStorage.setItem(SHADOWING_PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // Đầy quota hay bị chặn ghi - bỏ qua, đây chỉ là badge trang trí thêm
    // trên danh sách, không phải dữ liệu phải-lưu-được.
  }
}

export function getShadowingEntry(map: ShadowingProgressMap, videoId: string): ShadowingProgressEntry {
  return map[videoId] || EMPTY_ENTRY;
}

/** Bật/tắt "đã lưu" cho 1 video - trả về map mới (không sửa map cũ). */
export function withToggleSaved(map: ShadowingProgressMap, videoId: string): ShadowingProgressMap {
  const entry = getShadowingEntry(map, videoId);
  return { ...map, [videoId]: { ...entry, saved: !entry.saved } };
}

/**
 * Ghi nhận đang xem tới dòng phụ đề nào - gọi mỗi khi dòng active đổi lúc
 * đang ở stage 'ready'. completed = đã cuộn tới dòng cuối cùng (không phải
 * tín hiệu "video đã play hết", chỉ là đã lướt tới dòng cuối trong danh
 * sách phụ đề - đủ dùng làm heuristic "xong" cho shadowing).
 */
export function withProgress(
  map: ShadowingProgressMap,
  videoId: string,
  segmentIndex: number,
  totalSegments: number,
): ShadowingProgressMap {
  const entry = getShadowingEntry(map, videoId);
  const completed = totalSegments > 0 && segmentIndex >= totalSegments - 1;
  return {
    ...map,
    [videoId]: {
      ...entry,
      lastWatchedAt: Date.now(),
      lastSegmentIndex: segmentIndex,
      totalSegments,
      completed,
    },
  };
}

// ---------------------------------------------------------------------
// Tuỳ chọn hiển thị màn xem chi tiết 1 video (ẩn/hiện romaji, ẩn/hiện dịch
// Việt, bật/tắt tự cuộn) - áp dụng chung cho MỌI video, không phải theo
// từng video như ShadowingProgressEntry ở trên, nên tách key riêng. Cũng
// lưu localStorage, cùng lý do đơn giản/không cần bảng Supabase như trên.
// ---------------------------------------------------------------------

const DISPLAY_PREFS_KEY = 'kaiwa_shadowing_display_prefs_v1';

export interface ShadowingDisplayPrefs {
  showRomaji: boolean;
  showVi: boolean;
  autoScroll: boolean;
}

const DEFAULT_DISPLAY_PREFS: ShadowingDisplayPrefs = {
  showRomaji: true,
  showVi: true,
  autoScroll: true,
};

export function loadDisplayPrefs(): ShadowingDisplayPrefs {
  try {
    const raw = window.localStorage.getItem(DISPLAY_PREFS_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_PREFS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DISPLAY_PREFS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_DISPLAY_PREFS };
  }
}

export function saveDisplayPrefs(prefs: ShadowingDisplayPrefs): void {
  try {
    window.localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Chỉ là tuỳ chọn hiển thị - lưu thất bại thì thôi, không chặn app.
  }
}

/**
 * Video được thêm trong vòng NEW_BADGE_DAYS ngày lịch gần nhất VÀ chưa từng
 * mở xem - xem lần nào là rớt khỏi "Mới" ngay lập tức, không cần đợi hết
 * NEW_BADGE_DAYS ngày (khác "Đã xem"/"Đã lưu" là 2 badge dựa hẳn trên hành
 * vi người xem, còn "Mới" là kết hợp cả ngày thêm lẫn hành vi đó).
 */
export function isNewVideo(createdAt: string | null | undefined, entry: ShadowingProgressEntry): boolean {
  if (!createdAt || entry.lastWatchedAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const dayDiff = Math.round((today - createdDay) / (24 * 60 * 60 * 1000));
  return dayDiff >= 0 && dayDiff < NEW_BADGE_DAYS;
}

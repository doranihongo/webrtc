import type { Lesson } from '../types';

/**
 * Chia buổi học của 1 khóa thành các "chặng" hiển thị dạng accordion trên
 * trang chi tiết khóa học (CourseDetail.tsx) - vd "KAIWA SƠ CẤP 1" có 30 buổi,
 * chia làm 3 chặng KHỞI ĐỘNG (buổi 1-6) / TĂNG TỐC (buổi 7-22) / VỀ ĐÍCH
 * (buổi 23-30) để danh sách đỡ dài, học viên bấm vào từng chặng mới thấy
 * buổi bên trong (mặc định cả 3 chặng đóng).
 *
 * Khóa nào KHÔNG có mặt trong bảng dưới đây thì hiển thị phẳng như cũ
 * (getCourseStages trả về null) - thêm dòng mới vào đây khi cần chia chặng
 * cho khóa khác. Khớp theo course.title (đã trim + lowercase), đọc từ cột
 * kaiwa_courses.title trên Supabase - đổi tên khóa trên Supabase thì phải
 * sửa lại key ở đây cho khớp.
 */
const COURSE_STAGE_CONFIG: Record<string, { label: string; count: number }[]> = {
  'kaiwa sơ cấp 1': [
    { label: 'KHỞI ĐỘNG', count: 6 },
    { label: 'TĂNG TỐC', count: 16 },
    { label: 'VỀ ĐÍCH', count: 8 },
  ],
};

export interface CourseStage {
  label: string;
  /**
   * Vị trí (0-based) của buổi đầu tiên trong chặng này, tính trên mảng
   * lessons GỐC của cả khóa - dùng để đánh số thứ tự buổi (STT) liên tục
   * qua các chặng, không bị reset về 1 ở mỗi chặng.
   */
  startIndex: number;
  lessons: Lesson[];
}

/**
 * @returns null nếu khóa chưa được cấu hình chặng (nơi gọi tự fallback về
 *   hiển thị danh sách phẳng), hoặc mảng chặng đã được cắt từ `lessons`.
 */
export function getCourseStages(courseTitle: string, lessons: Lesson[]): CourseStage[] | null {
  const config = COURSE_STAGE_CONFIG[courseTitle.trim().toLowerCase()];
  if (!config || lessons.length === 0) return null;

  const stages: CourseStage[] = [];
  let cursor = 0;
  for (const { label, count } of config) {
    stages.push({ label, startIndex: cursor, lessons: lessons.slice(cursor, cursor + count) });
    cursor += count;
  }
  // Lỡ thêm buổi mới mà quên cập nhật `count` ở trên -> gộp buổi dư vào
  // chặng cuối thay vì để mất khỏi danh sách hiển thị.
  if (cursor < lessons.length) {
    stages[stages.length - 1].lessons.push(...lessons.slice(cursor));
  }
  return stages;
}

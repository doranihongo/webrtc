// ---------------------------------------------------------
// Kiểm tra 1 tài khoản có được học 1 khóa Kaiwa cụ thể hay không - dựa
// vào cột `allowed_courses` (mảng id khóa học, vd ["kaiwa-socap"]) trong
// bảng `profiles`, hiện đang được thêm/sửa TAY qua Supabase Table Editor
// (chưa có trang quản trị riêng để cấp quyền). authGuard trong
// public/js/common.js đọc cột này và gắn vào window.__authUser.allowedCourses
// sau khi xác thực xong (xem __authReady) - dùng lại y hệt object đó ở
// đây, không tự query Supabase riêng.
// ---------------------------------------------------------

export type CourseAccessUser = {
  role?: string;
  allowedCourses?: string[];
};

// Vai trò nhân sự - luôn xem/dạy được MỌI khóa, không bị giới hạn theo
// allowed_courses như học viên (khớp quy ước isTeacherOrAdmin đã dùng ở
// LessonView.tsx/useCallEmbed.ts: chỉ 'giaovien'/'admin' là nhân sự).
const STAFF_ROLES = new Set(["admin", "giaovien"]);

/**
 * @param authUser window.__authUser (undefined nếu authGuard chưa chạy
 *   xong) - undefined thì mặc định KHÓA, an toàn hơn mặc định mở.
 * @param courseId id khóa học cần kiểm tra, vd "kaiwa-trungcap".
 */
export function isCourseAllowed(
  authUser: CourseAccessUser | undefined | null,
  courseId: string,
): boolean {
  if (!authUser) return false;
  if (STAFF_ROLES.has(authUser.role || "")) return true;
  return (
    Array.isArray(authUser.allowedCourses) &&
    authUser.allowedCourses.includes(courseId)
  );
}

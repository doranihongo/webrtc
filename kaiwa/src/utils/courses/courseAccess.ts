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

// CHỈ 'admin' luôn xem/dạy được MỌI khóa, không bị giới hạn theo
// allowed_courses - 'giaovien' KHÔNG còn đặc quyền này nữa (đổi 2026-08-23,
// đi kèm cơ chế ký URL slide - server.js có bản mirror y hệt Set này,
// KAIWA_SLIDE_STAFF_ROLES, sửa 1 bên nhớ sửa bên kia): 1 giáo viên chỉ dạy
// lớp N5 thì cũng chỉ nên xem được đúng khóa N5 trong allowed_courses của
// họ, không tự động thấy được N4/N3... Lưu ý isTeacherOrAdmin
// (LessonView.tsx) là 1 khái niệm KHÁC - chỉ quyết định có thấy các CÔNG CỤ
// của giáo viên (Slide, ghi hình...) hay không, không liên quan gì đến việc
// được xem KHÓA HỌC nào.
const STAFF_ROLES = new Set(["admin"]);

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

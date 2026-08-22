// ---------------------------------------------------------
// Đợi authGuard (public/js/common.js, script <script defer>/module nạp
// cùng trang) chạy xong rồi trả về window.__authUser - dùng chung cho
// Home.tsx, CourseDetail.tsx, useCallEmbed.ts thay vì mỗi nơi tự viết lại
// y hệt.
//
// window.__authReady được common.js gán NGAY khi script đó tới lượt chạy
// - bình thường luôn có sẵn trước khi bất kỳ effect React nào kịp chạy
// (effect luôn lùi lại sau khi toàn bộ script đồng bộ của trang chạy
// xong). NHƯNG trang này còn được tải ngầm trong 1 iframe ẨN
// (kaiwaOverlayIframe, xem setGoHomeCornerBtn trong public/js/client.js) -
// preload ngay lúc vào phòng gọi, cạnh tranh CPU/băng thông trực tiếp với
// WebRTC đang khởi động. Nếu người dùng bấm "Trang chủ" sớm (trước khi
// iframe tải/xác thực xong) hoặc trình duyệt trì hoãn script của iframe
// ẩn, window.__authReady có thể CHƯA kịp gán lúc effect chạy. Trước đây
// gặp trường hợp đó thì coi luôn là "chưa đăng nhập" (window.__authUser
// undefined) và không bao giờ thử lại - vì effect chỉ chạy đúng 1 lần lúc
// mount - khiến khóa học hiện "Đang khóa" vĩnh viễn dù tài khoản là
// admin/giáo viên. Hàm này CHỦ ĐỘNG đợi (poll) cho tới khi
// window.__authReady xuất hiện thay vì bỏ cuộc ngay.
// ---------------------------------------------------------

const POLL_MS = 50;
const WAIT_FOR_SCRIPT_TIMEOUT_MS = 8000;

export function waitForAuthUser(): Promise<any> {
  return new Promise((resolve) => {
    const start = Date.now();

    const tryResolve = () => {
      const w = window as any;
      if (w.__authReady) {
        w.__authReady.then(() => resolve(w.__authUser));
        return;
      }
      if (Date.now() - start >= WAIT_FOR_SCRIPT_TIMEOUT_MS) {
        // Hết giờ đợi - common.js có thể lỗi tải/chưa chạy được. Trả về
        // window.__authUser hiện có (thường vẫn là undefined) thay vì
        // treo mãi - coi như chưa đăng nhập, an toàn hơn mặc định mở.
        resolve(w.__authUser);
        return;
      }
      setTimeout(tryResolve, POLL_MS);
    };

    tryResolve();
  });
}

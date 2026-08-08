"use strict";

/**
 * Capacitor config - bọc giao diện web (public/) thành app iOS thật,
 * đóng gói .ipa cài qua TestFlight.
 *
 * QUAN TRỌNG: server này render HTML động phía server (htmlInjector,
 * gating đăng nhập, redirect /join/:roomId, v.v.) - KHÔNG phải một SPA
 * tĩnh. Vì vậy app KHÔNG bundle public/ vào bên trong app (webDir chỉ
 * khai báo cho đủ, Capacitor CLI yêu cầu trường này tồn tại) - app mở
 * thẳng domain production qua `server.url` bên dưới, y hệt việc mở
 * Safari nhưng đóng gói thành icon/app riêng, xin quyền camera/mic kiểu
 * app thật. Toàn bộ giao diện vẫn load từ server thật, sửa gì trong
 * public/ hay app/src/server.js là app iOS thấy ngay, không cần build
 * lại app.
 *
 * Xem docs/ios-testflight-setup.md để biết các bước còn lại (icon, cấp
 * quyền camera/mic, build, ký, upload TestFlight).
 */
const config = {
  // TODO: đổi bundle ID nếu muốn TRƯỚC khi tạo app trên App Store
  // Connect - sau khi đã tạo thì gần như không đổi lại được nữa.
  appId: "com.dorakaiwa.videocall",
  appName: "DORA NIHONGO",
  // Không dùng thực tế (xem giải thích ở trên) - Capacitor CLI vẫn bắt
  // buộc khai báo 1 thư mục có tồn tại.
  webDir: "public",
  server: {
    // TODO bắt buộc: thay bằng domain HTTPS production thật trước khi
    // build. Domain phải có chứng chỉ TLS hợp lệ (Let's Encrypt/CA thật
    // qua reverse proxy) - iOS (App Transport Security) sẽ chặn thẳng
    // cert tự ký, không có cách nào bật lại cho bản thật. Xem mục "TLS"
    // trong docs/ios-testflight-setup.md.
    url: "https://REPLACE_WITH_YOUR_DOMAIN.example.com",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
};

module.exports = config;

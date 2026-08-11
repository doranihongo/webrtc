"use strict";

// ---------------------------------------------------------
// Supabase project - dùng CHUNG với web "xóa mù kanji" (cùng
// auth.users, cùng bảng public.profiles). Không phải project riêng.
//
// anon key ở đây là public key, được thiết kế để lộ ra phía client -
// không phải secret (được bảo vệ bằng Row Level Security ở Supabase,
// không phải bằng cách giấu key này).
// ---------------------------------------------------------
const SUPABASE_URL = "https://keywwriietabgahtropc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtleXd3cmlpZXRhYmdhaHRyb3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDYzNjMsImV4cCI6MjA5ODEyMjM2M30.ZJY9kDoSNdfik40cehCFblXDE4cFb6uUOtj3Q9zv68I";

// Đuôi email giả để cho đăng nhập bằng "tài khoản" ngắn thay vì email
// đầy đủ (Supabase Auth bắt buộc định dạng email). PHẢI khác đuôi
// "@student.com" mà web kanji đang dùng - nếu trùng, 1 username ở web
// này có thể trùng thẳng vào tài khoản học viên có sẵn bên web kia
// (cùng bảng auth.users, email là khoá duy nhất).
const AUTH_EMAIL_DOMAIN = "@dorakaiwa.com";

// Các role được phép vào web này. Bảng `profiles` dùng chung còn có
// 103 dòng role='student' của web kanji - KHÔNG được thêm 'student'
// vào danh sách này, nếu không toàn bộ học viên kanji sẽ tự nhiên
// đăng nhập được vào web họp luôn.
const ALLOWED_ROLES = ["admin", "giaovien", "hocvien"];

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// ---------------------------------------------------------
// Đồng bộ access token hiện tại ra 1 cookie riêng (KHÔNG phải cơ chế
// đăng nhập chính - session thật vẫn nằm trong localStorage như cũ,
// Supabase SDK tự quản lý). Cookie này CHỈ để server (Express) tự xác
// minh được lúc phục vụ HTML/JS/CSS, chặn người CHƯA đăng nhập tải
// được code của các trang sau /login (xem middleware chặn theo
// "sb_page_token" trong server.js) - trước đây authGuard chỉ là lớp
// chặn giao diện, server vẫn gửi file cho bất kỳ ai gọi tới URL.
//
// Không dùng cookie httpOnly vì không có endpoint đăng nhập phía server
// để set nó - JS phía client (SDK Supabase) là nơi duy nhất biết lúc
// nào session đổi (đăng nhập, tự refresh token, đăng xuất).
// ---------------------------------------------------------
const AUTH_PAGE_COOKIE_NAME = "sb_page_token";

function syncAuthCookieValue(accessToken) {
  if (accessToken) {
    // max-age 1h khớp thời hạn mặc định của access token Supabase -
    // token hết hạn thật thì cookie cũng tự hết theo, không cần đồng bộ
    // ngược mỗi khi hết hạn.
    document.cookie = `${AUTH_PAGE_COOKIE_NAME}=${accessToken}; path=/; max-age=3600; SameSite=Lax`;
  } else {
    document.cookie = `${AUTH_PAGE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

/**
 * Đọc lại session hiện tại và đồng bộ cookie ngay - dùng ở những chỗ
 * cần chắc chắn cookie đã cập nhật TRƯỚC khi điều hướng sang trang khác
 * (vd: login.js ngay trước khi chuyển hướng sau khi đăng nhập xong),
 * không phụ thuộc độ trễ của onAuthStateChange bên dưới.
 */
async function syncAuthCookie() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  syncAuthCookieValue(session?.access_token || null);
}

// Tự đồng bộ mỗi khi trạng thái đăng nhập đổi - đăng nhập, tự refresh
// token (Supabase SDK tự làm ngầm), đăng xuất. Cũng tự fire 1 lần lúc
// mới subscribe với session hiện có (khôi phục từ localStorage nếu có),
// nên hầu hết các trang không cần tự gọi syncAuthCookie() thủ công.
supabaseClient.auth.onAuthStateChange((_event, session) => {
  syncAuthCookieValue(session?.access_token || null);
});

/**
 * true nếu lỗi này nghĩa là Supabase đã XÁC NHẬN RÕ RÀNG token/session
 * không còn hợp lệ (401/403 từ chính server) - KHÔNG phải lỗi mạng/
 * timeout/server lag thoáng qua (những lỗi đó không có status này).
 * Chỉ nên coi là "phiên chết thật" và xoá cứng khi hàm này trả true -
 * dùng sai sẽ khiến 1 lần mất mạng cũng bị bắt đăng nhập lại y như token
 * hỏng thật, dù phiên vẫn còn tốt.
 */
function isAuthInvalidError(err) {
  return err?.status === 401 || err?.status === 403;
}

/**
 * Xoá cứng phiên Supabase khỏi localStorage của trình duyệt (không qua
 * mạng, không phụ thuộc signOut() gọi API có thành công hay không) - chỉ
 * gọi khi đã chắc chắn qua isAuthInvalidError() là token thật sự chết.
 * signOut() bình thường cũng tự dọn localStorage, nhưng nếu chính API
 * logout cũng bị 403 (phiên đã chết từ trước khi kịp đăng xuất) thì
 * không có gì đảm bảo local storage được dọn sạch - dẫn tới F5/đăng nhập
 * lại trên CÙNG trình duyệt đó vẫn đọc phải đúng token hỏng, kẹt lại y
 * hệt (chỉ cửa sổ ẩn danh - không có localStorage cũ - mới thoát được).
 * Hàm này đảm bảo dọn sạch bất kể signOut() có thành công hay không.
 *
 * Không đụng tới "device_id" (khoá riêng, sống vĩnh viễn - xem
 * getDeviceId() dưới) nên đăng nhập lại trên cùng trình duyệt vẫn được
 * tính là cùng 1 thiết bị cũ, không tốn thêm suất max_devices.
 */
function hardResetSupabaseSession() {
  try {
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    localStorage.removeItem(`sb-${projectRef}-auth-token`);
  } catch (err) {
    // best effort - không để lỗi ở đây chặn luồng redirect về login
  }
}

/**
 * Đọc claim "iat" (lúc token được cấp, tính bằng mili-giây) từ access
 * token Supabase - không cần verify chữ ký, vì token đã được chính
 * Supabase xác thực rồi (session đến từ getSession()/
 * signInWithPassword thành công). Dùng ở cả login.js và common.js để
 * phát hiện phiên cũ bị cấp TRƯỚC lần đổi mật khẩu gần nhất
 * (profiles.password_changed_at) - vd: máy A đăng nhập bằng mật khẩu
 * tạm rồi đứng ở màn đổi mật khẩu không làm gì, trong lúc máy B đăng
 * nhập cùng tài khoản và đổi mật khẩu xong - token cũ trên máy A vẫn
 * còn "sống" (Supabase không tự thu hồi phiên khác khi đổi mật khẩu)
 * nên phải tự so sánh mốc thời gian để phát hiện và bắt đăng nhập lại.
 */
// Khoảng đệm khi so sánh iat của token với profiles.password_changed_at
// (xem decodeJwtIssuedAtMs ở trên) - JWT iat chỉ chính xác tới GIÂY,
// còn password_changed_at chính xác tới mili-giây, và refreshSession()
// sau khi đổi mật khẩu diễn ra gần như ngay lập tức nên token mới rất
// hay rơi vào ĐÚNG CÙNG 1 GIÂY với password_changed_at rồi bị làm tròn
// xuống thành "sớm hơn" - không có đệm này thì chính người vừa đổi mật
// khẩu xong cũng bị bắt đăng nhập lại. 10 giây đủ rộng để bù sai số làm
// tròn + độ trễ mạng lúc refresh, nhưng vẫn đủ chặt để loại các phiên
// thật sự cũ (phút/giờ/ngày trước) của thiết bị khác.
const PASSWORD_CHANGE_GRACE_MS = 10000;

function decodeJwtIssuedAtMs(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload));
    return decoded?.iat ? decoded.iat * 1000 : null;
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------
// Hạn sử dụng + giới hạn số thiết bị - port từ AuthContext.tsx bên web
// kanji (bảng public.user_devices dùng CHUNG, không phải bảng riêng
// tạo mới). Dùng cả ở login.js (lúc đăng nhập) và common.js (mỗi lần
// tải landing/phòng) - gọi checkAccountAccess() sau khi đã có profile.
//
// Khác kanji ở 2 điểm, theo đúng yêu cầu:
// 1. Hết hạn -> chỉ CHẶN truy cập, KHÔNG tự xoá tài khoản (xoá cần
//    service_role key - khoá bí mật, cố tình không thêm vào server để
//    tránh rủi ro của 1 khoá admin toàn quyền).
// 2. Thiết bị ĐÃ đăng nhập từ trước luôn được dùng tiếp bình thường,
//    kể cả khi admin giảm max_devices về sau khiến số thiết bị đang có
//    vượt hạn mới - không tự "dọn" bớt thiết bị cũ như kanji làm, chỉ
//    chặn thiết bị MỚI khi đã đầy chỗ.
// ---------------------------------------------------------

// admin dùng chung tài khoản với web kanji, miễn giới hạn thiết bị -
// giống hệt cách kanji đang làm (role === 'student' mới check).
const DEVICE_LIMIT_EXEMPT_ROLES = ["admin"];

/**
 * ID thiết bị - 1 UUID sinh 1 lần, sống vĩnh viễn trong localStorage
 * của trình duyệt. Cùng key "device_id" với web kanji (không phải tên
 * riêng của webrtc) - để tài khoản admin dùng chung 2 app được tính là
 * CÙNG 1 thiết bị khi đăng nhập từ cùng 1 trình duyệt, thay vì bị đếm
 * 2 lần vào cùng 1 giới hạn max_devices dùng chung.
 */
function getDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

/**
 * Kiểm tra hạn sử dụng + giới hạn thiết bị cho 1 tài khoản đã đăng
 * nhập hợp lệ (role/is_first_login/password_changed_at đã pass hết).
 * @param {string} userId
 * @param {{role: string, max_devices: number|null, expires_at: string|null}} profile
 * @returns {Promise<{ok: true} | {ok: false, reason: "expired"|"device_limit"}>}
 */
async function checkAccountAccess(userId, profile) {
  if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
    return { ok: false, reason: "expired" };
  }

  if (
    DEVICE_LIMIT_EXEMPT_ROLES.includes(profile.role) ||
    !profile.max_devices
  ) {
    return { ok: true };
  }

  const deviceId = getDeviceId();
  const { data: devices, error } = await supabaseClient
    .from("user_devices")
    .select("id, device_id")
    .eq("user_id", userId);

  if (error) {
    // Lỗi mạng/RLS tạm thời - không chặn nhầm người dùng thật vì 1 lỗi
    // đọc dữ liệu phụ, chỉ log lại để biết mà kiểm tra sau.
    console.warn(
      "[checkAccountAccess] Không đọc được user_devices:",
      error.message,
    );
    return { ok: true };
  }

  const existing = devices?.find((d) => d.device_id === deviceId);
  if (existing) {
    await supabaseClient
      .from("user_devices")
      .update({ last_active: new Date().toISOString() })
      .eq("id", existing.id);
    return { ok: true };
  }

  if ((devices?.length || 0) >= profile.max_devices) {
    return { ok: false, reason: "device_limit" };
  }

  await supabaseClient.from("user_devices").upsert(
    {
      user_id: userId,
      device_id: deviceId,
      last_active: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id" },
  );
  return { ok: true };
}

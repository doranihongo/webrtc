"use strict";

// ---------------------------------------------------------
// PWA: register the (no-op/no-cache) service worker so mobile browsers
// treat this as an installable app for "Add to Home Screen", instead of
// just bookmarking the page. Shared here since common.js loads on both
// the landing page and the in-room page - only needs to happen once
// regardless of which page the user installs from.
// ---------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// ---------------------------------------------------------
// PWA standalone mode (opened from the home-screen icon, not a normal
// Safari/Chrome tab): iOS still lets the whole page rubber-band/bounce
// on drag at the native WKWebView level even though the page itself has
// overflow:hidden. Block that drag here (normal browser-tab visits are
// untouched); still lets any element that's actually meant to scroll
// (chat log, settings panel, etc.) scroll normally.
// ---------------------------------------------------------
const isStandalonePwa =
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

if (isStandalonePwa) {
  document.addEventListener(
    "touchmove",
    (e) => {
      let el = e.target;
      while (el && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          el.scrollHeight > el.clientHeight
        ) {
          return; // inside a genuinely scrollable element - let it scroll
        }
        el = el.parentElement;
      }
      e.preventDefault();
    },
    { passive: false },
  );
}

// ---------------------------------------------------------
// Auth guard - chạy trên mọi trang có gắn script này (kaiwa, login).
// Chưa đăng nhập / role không hợp lệ -> đá về trang login, kèm đường
// dẫn hiện tại để login xong quay lại đúng chỗ.
//
// LƯU Ý: đây chỉ là lớp chặn ở giao diện, không phải lớp bảo mật thật -
// server vẫn phải tự verify các request nhạy cảm (xem server.js), vì
// HTML/JS phía client luôn có thể bị bỏ qua/sửa được.
// ---------------------------------------------------------
function redirectToLogin() {
  const returnTo = window.location.pathname + window.location.search;
  window.location.href =
    "/login?redirect=" + encodeURIComponent(returnTo);
}

// Trang tự gắn sẵn class "auth-pending" lên <html> + CSS ẩn <body> bằng
// visibility:hidden, để tránh nội dung hiện ra chớp nhoáng rồi mới bị đá
// về /login (authGuard chạy chậm hơn 1 nhịp so với lúc HTML paint lần đầu
// vì phải chờ Supabase). Gỡ ở đây khi xác thực xong. Không gỡ ở nhánh
// redirect - trang sắp điều hướng đi rồi nên cứ để ẩn cho tới lúc đó.
function revealPage() {
  document.documentElement.classList.remove("auth-pending");
}
// Timeout dự phòng: nếu lỡ có lỗi JS bất ngờ khiến authGuard không bao
// giờ chạy xong (và cũng không redirect được), không để trang kẹt màn
// hình trắng mãi mãi.
setTimeout(revealPage, 6000);
// decodeJwtIssuedAtMs() dùng ở đây được định nghĩa chung trong
// supabaseClient.js (load trước common.js).

// Nếu truy vấn "profiles" bị lỗi mạng/timeout thoáng qua, nhánh xử lý lỗi
// bên dưới vốn chủ ý "để lần tải trang sau tự thử lại" (không đăng xuất).
// Tự thử lại vài lần ở đây trước khi coi là lỗi mạng thật sự.
const PROFILE_FETCH_RETRIES = 3;
const PROFILE_FETCH_RETRY_DELAY_MS = 1200;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProfileWithRetry(userId) {
  let result = { data: null, error: null };
  for (let attempt = 1; attempt <= PROFILE_FETCH_RETRIES; attempt++) {
    result = await supabaseClient
      .from("profiles")
      .select(
        "role, display_name, is_first_login, password_changed_at, max_devices, expires_at, allowed_courses",
      )
      .eq("id", userId)
      .single();

    const { data: profile, error } = result;
    // Có profile hợp lệ, hoặc lỗi chắc chắn không phải do mạng (vd token
    // đã chết) - dừng ngay, không cần thử lại.
    if (profile || (error && isAuthInvalidError(error))) break;
    if (attempt < PROFILE_FETCH_RETRIES) await delay(PROFILE_FETCH_RETRY_DELAY_MS);
  }
  return result;
}

window.__authReady = (async function authGuard() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session?.user) {
      redirectToLogin();
      return;
    }

    const { data: profile, error } = await fetchProfileWithRetry(session.user.id);

    if (error || !profile || !ALLOWED_ROLES.includes(profile.role)) {
      // Không lấy được profile (error, chưa chắc role sai) - phân biệt
      // lỗi mạng/timeout thoáng qua với token thật sự đã chết (401/403).
      // Chỉ lỗi mạng thì KHÔNG đăng xuất/xoá phiên - giữ nguyên để lần
      // tải trang sau tự thử lại, tránh 1 lần mất mạng cũng bị bắt đăng
      // nhập lại y như token hỏng thật. profile lấy được nhưng role sai
      // thì chắc chắn là chặn thật, luôn xử lý như cũ.
      if (!profile && error && !isAuthInvalidError(error)) {
        const { error: userErr } = await supabaseClient.auth.getUser();
        if (!isAuthInvalidError(userErr)) {
          console.warn(
            "[authGuard] Không lấy được profile, có thể do mạng - bỏ qua, thử lại ở lần tải sau:",
            error.message,
          );
          return;
        }
      }
      await supabaseClient.auth.signOut();
      hardResetSupabaseSession();
      redirectToLogin();
      return;
    }

    // Chưa đổi mật khẩu lần đầu -> không cho vào thẳng landing/phòng
    // bằng cách gõ URL, phải quay lại /login để hoàn tất màn đổi mật
    // khẩu bắt buộc trước (xem localStorage fallback tương ứng trong
    // login.js -> handleSignedIn).
    const firstLoginDone =
      localStorage.getItem(`first_login_done_${session.user.id}`) === "true";
    if (profile.is_first_login && !firstLoginDone) {
      redirectToLogin();
      return;
    }

    // Phiên này được cấp TRƯỚC lần đổi mật khẩu gần nhất (đổi ở thiết
    // bị khác) -> access token cũ vẫn còn "sống" nhưng không còn đại
    // diện cho mật khẩu hiện tại - bắt đăng nhập lại. Chặn thật ở server
    // (server.js) rồi, đây chỉ là lớp giao diện để không lọt qua chớp
    // nhoáng trước khi socket bị server từ chối.
    if (profile.password_changed_at) {
      const tokenIssuedMs = decodeJwtIssuedAtMs(session.access_token);
      const changedMs = new Date(profile.password_changed_at).getTime();
      if (
        tokenIssuedMs !== null &&
        tokenIssuedMs < changedMs - PASSWORD_CHANGE_GRACE_MS
      ) {
        await supabaseClient.auth.signOut();
        hardResetSupabaseSession();
        redirectToLogin();
        return;
      }
    }

    // Hạn sử dụng + giới hạn số thiết bị (xem checkAccountAccess trong
    // supabaseClient.js) - chặn thật ở server (server.js) rồi, đây chỉ
    // là lớp giao diện để không lọt qua chớp nhoáng.
    const access = await checkAccountAccess(session.user.id, profile);
    if (!access.ok) {
      await supabaseClient.auth.signOut();
      hardResetSupabaseSession();
      redirectToLogin();
      return;
    }

    window.__authToken = session.access_token;
    // Dùng cho icon tài khoản/bảng thông tin ở góc trên phải
    window.__authUser = {
      id: session.user.id,
      email: session.user.email,
      role: profile.role,
      displayName: profile.display_name || session.user.email,
      maxDevices: profile.max_devices,
      expiresAt: profile.expires_at,
      // Danh sách id khóa học (kaiwa-socap, kaiwa-trungcap...) tài khoản
      // này được cấp quyền - cột `allowed_courses` (mảng) trong `profiles`,
      // hiện đang được thêm/sửa TAY qua Supabase Table Editor (chưa có
      // trang quản trị riêng). Dùng ở Home.tsx/CourseDetail.tsx (kaiwa/src)
      // để khóa/mở từng khóa học - KHÔNG áp dụng cho admin/giaovien (staff
      // xem/dạy được mọi khóa, xem isCourseAllowed trong
      // kaiwa/src/utils/courseAccess.ts).
      allowedCourses: Array.isArray(profile.allowed_courses)
        ? profile.allowed_courses
        : [],
    };
    revealPage();
  } catch (err) {
    console.error("[authGuard] Lỗi kiểm tra đăng nhập:", err);
    // Chỉ xoá cứng phiên khi CHẮC CHẮN token đã chết (401/403). Lỗi
    // khác (mất mạng, timeout, Supabase lag) thì giữ nguyên phiên -
    // không đăng xuất, để lần tải trang sau tự thử lại bình thường thay
    // vì bắt đăng nhập lại chỉ vì 1 lần trục trặc mạng.
    if (isAuthInvalidError(err)) {
      hardResetSupabaseSession();
    }
    redirectToLogin();
  }
})();


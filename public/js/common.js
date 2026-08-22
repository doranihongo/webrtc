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
// Auth guard - chạy trên cả landing page lẫn trang phòng (client.html).
// Chưa đăng nhập / role không hợp lệ -> đá về trang login, kèm đường
// dẫn hiện tại để login xong quay lại đúng chỗ.
//
// LƯU Ý: đây chỉ là lớp chặn ở giao diện, không phải lớp bảo mật thật -
// server vẫn phải tự verify token khi client connect Socket.IO (xem
// server.js), vì HTML/JS phía client luôn có thể bị bỏ qua/sửa được.
// window.__authToken được lưu lại ở đây để client.js gắn kèm khi
// connect Socket.IO.
//
// window.__authReady là Promise của lần chạy authGuard này - client.js
// PHẢI await cái này trước khi gọi io(...), nếu không __authToken vẫn
// còn undefined lúc đó (authGuard cần đợi 2 lượt gọi Supabase, còn
// initClientPeer() chạy gần như ngay lập tức lúc DOMContentLoaded) ->
// socket gửi token null -> server từ chối -> client không báo lỗi gì,
// treo mãi ở màn hình vào phòng.
// ---------------------------------------------------------
function redirectToLogin() {
  const returnTo = window.location.pathname + window.location.search;
  window.location.href =
    "/login?redirect=" + encodeURIComponent(returnTo);
}

// Trang (landing.html/client.html) tự gắn sẵn class "auth-pending" lên
// <html> + CSS ẩn <body> bằng visibility:hidden, để tránh nội dung
// hiện ra chớp nhoáng rồi mới bị đá về /login (authGuard chạy chậm hơn
// 1 nhịp so với lúc HTML paint lần đầu vì phải chờ Supabase). Gỡ ở đây
// khi xác thực xong. Không gỡ ở nhánh redirect - trang sắp điều hướng
// đi rồi nên cứ để ẩn cho tới lúc đó.
function revealPage() {
  document.documentElement.classList.remove("auth-pending");
}
// Timeout dự phòng: nếu lỡ có lỗi JS bất ngờ khiến authGuard không bao
// giờ chạy xong (và cũng không redirect được), không để trang kẹt màn
// hình trắng mãi mãi.
setTimeout(revealPage, 6000);
// decodeJwtIssuedAtMs() dùng ở đây được định nghĩa chung trong
// supabaseClient.js (load trước common.js ở cả landing.html/client.html).

window.__authReady = (async function authGuard() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session?.user) {
      redirectToLogin();
      return;
    }

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select(
        "role, display_name, is_first_login, password_changed_at, max_devices, expires_at, allowed_courses",
      )
      .eq("id", session.user.id)
      .single();

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
    // Dùng cho icon tài khoản/bảng thông tin ở góc trên phải (landing.html)
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

/**
 * Phát âm thanh - bản rút gọn dùng riêng cho trang landing (chưa vào
 * phòng nên chưa có bảng cài đặt tắt âm như trong client.js)
 * @param {string} name tên file .mp3 trong thư mục /sounds
 */
async function playSound(name) {
  try {
    const audio = new Audio(`../sounds/${name}.mp3`);
    audio.volume = 0.5;
    await audio.play();
  } catch (err) {
    // Autoplay bị chặn (Safari) hoặc file không tồn tại - bỏ qua
  }
}

/**
 * Tạo mã phòng ngẫu nhiên 10 ký tự: chỉ chữ IN HOA + số, luôn có ít nhất
 * 1 chữ và 1 số (không phải ngẫu nhiên thuần có thể ra toàn chữ/toàn số)
 */
function getRandomRoomCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const all = letters + digits;
  const pick = (chars) => chars.charAt(Math.floor(Math.random() * chars.length));

  const result = [pick(letters), pick(digits)];
  for (let i = result.length; i < 10; i++) {
    result.push(pick(all));
  }
  // Fisher-Yates shuffle so the guaranteed letter/digit aren't always
  // stuck in the first two positions
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.join("");
}

/**
 * Hiệu ứng xáo trộn ký tự (Shuffle text) cho ô nhập tên phòng
 */
function shuffleText(input, finalValue, duration = 600) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const steps = 10;
  const interval = duration / steps;
  let step = 0;

  input.classList.add("shuffle-active");

  const timer = setInterval(() => {
    step++;
    const progress = step / steps;
    let display = "";
    for (let i = 0; i < finalValue.length; i++) {
      if (i < finalValue.length * progress) {
        display += finalValue[i];
      } else {
        display += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    input.value = display;

    if (step >= steps) {
      clearInterval(timer);
      input.value = finalValue;
      setTimeout(() => input.classList.remove("shuffle-active"), 300);
    }
  }, interval);
}

// ---------------------------------------------------------
// 1. Tự động điền tên phòng ngẫu nhiên khi mới vào trang - TRỪ học
//    viên (role "hocvien"): học viên không tự tạo phòng được (server
//    chặn ở handler "join" trong server.js nếu phòng chưa có giáo
//    viên/admin), nên để trống bắt phải tự gõ/dán (Ctrl+V) đúng mã
//    phòng giáo viên gửi - không có nút xáo trộn mã ngẫu nhiên nữa.
//    Phải chờ authGuard (window.__authReady) xong mới biết role, nên
//    khối này giờ chạy async thay vì đồng bộ ngay lúc tải trang.
// ---------------------------------------------------------
const roomName = document.getElementById("roomName");
const genRoomButton = document.getElementById("genRoomButton");

async function setupRoomCodeInput() {
  if (!roomName) return; // trang này không có ô nhập mã phòng (client.html)

  if (window.__authReady) {
    await window.__authReady;
  }
  const isHocvien = window.__authUser?.role === "hocvien";

  if (isHocvien) {
    roomName.value = "";
    // Không có nút xáo trộn/dán gì cho học viên - chỉ tự gõ/dán thủ
    // công (Ctrl+V) mã phòng giáo viên gửi.
    if (genRoomButton) {
      genRoomButton.style.display = "none";
      // Nút đã ẩn nhưng ô input vẫn chừa padding-right cho nó theo CSS
      // mặc định - gắn class này để trả padding về căn giữa lại (xem
      // .room-input-wrap.no-gen-btn trong landing.css).
      genRoomButton.closest(".room-input-wrap")?.classList.add("no-gen-btn");
    }
  } else {
    shuffleText(roomName, getRandomRoomCode());
    setupGenRoomButton();
  }

  // Bấm Enter ở ô nhập tên phòng để truy cập
  roomName.onkeyup = (e) => {
    if (e.keyCode === 13) {
      e.preventDefault();
      joinRoom();
    }
  };
}

/**
 * Nút xáo trộn mã phòng ngẫu nhiên - hành vi gốc, dùng cho
 * admin/giaovien (và khi Supabase chưa cấu hình, chưa có role).
 */
function setupGenRoomButton() {
  if (!genRoomButton) return;
  genRoomButton.onclick = (e) => {
    e.preventDefault();
    playSound("locked");
    genRoomButton.classList.remove("spin");
    void genRoomButton.offsetWidth; // Kích hoạt lại animation
    genRoomButton.classList.add("spin");
    shuffleText(roomName, getRandomRoomCode());
  };
  genRoomButton.addEventListener("animationend", () => {
    genRoomButton.classList.remove("spin");
  });
}


setupRoomCodeInput();

// ---------------------------------------------------------
// 2. Hiển thị phòng truy cập gần nhất (Last Room)
// ---------------------------------------------------------
const lastRoomContainer = document.getElementById("lastRoomContainer");
const lastRoom = document.getElementById("lastRoom");
const lastRoomName = window.localStorage.lastRoom
  ? window.localStorage.lastRoom
  : "";

if (lastRoomContainer && lastRoom && lastRoomName) {
  lastRoom.setAttribute("href", "/join/" + lastRoomName);
  lastRoom.innerText = lastRoomName;
  lastRoomContainer.style.display = "inline-flex"; // Hiển thị nếu có dữ liệu
}

// ---------------------------------------------------------
// 3. Xử lý nút "Tham gia" (nút tạo/xáo trộn mã phòng đã chuyển vào
//    setupRoomCodeInput() ở trên, vì cần biết role trước - trừ khi là
//    học viên, đổi thành nút "Dán")
// ---------------------------------------------------------
const joinRoomButton = document.getElementById("joinRoomButton");

if (joinRoomButton) {
  joinRoomButton.onclick = (e) => {
    e.preventDefault();
    joinRoom();
  };
}

/**
 * Xử lý kiểm tra tên và chuyển hướng người dùng vào phòng
 */
function joinRoom() {
  const inputVal = document.getElementById("roomName").value;
  // Lọc XSS và định dạng lại tên phòng (đổi dấu cách thành gạch ngang)
  const room = filterXSS(inputVal).trim().replace(/\s+/g, "-");

  if (!room) {
    popup("warning", "Tên phòng đang trống!\nVui lòng nhập tên phòng.");
    return;
  }

  // Chặn lỗi Path Traversal
  const pathTraversalPattern = /(\.\.(\/|\\))+/;
  if (pathTraversalPattern.test(room)) {
    popup("warning", "Tên phòng không hợp lệ!");
    return;
  }

  // Lưu phòng vào LocalStorage để lần sau hiển thị ở "Last Room"
  window.localStorage.lastRoom = room;
  // Chuyển hướng người dùng vào URL phòng họp
  window.location.href = "/join/" + room;
}

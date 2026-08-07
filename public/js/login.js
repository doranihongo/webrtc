"use strict";

// ---------------------------------------------------------
// Login page - gắn Supabase Auth thật (dùng chung project với web
// kanji, xem public/js/supabaseClient.js để biết ALLOWED_ROLES /
// AUTH_EMAIL_DOMAIN). Luồng:
//
//   1. Tải trang -> đã có phiên đăng nhập hợp lệ từ trước? Có thì bỏ
//      qua form, xử lý luôn như vừa đăng nhập xong (mục 3).
//   2. Chưa có phiên -> hiện form đăng nhập.
//   3. Đăng nhập (hoặc đã có phiên sẵn) xong -> tra role trong
//      `profiles`:
//        - Không có dòng / role không nằm trong ALLOWED_ROLES -> đăng
//          xuất ngay, báo lỗi (chặn tài khoản của web kanji lọt vào).
//        - role hợp lệ + is_first_login=true -> bắt buộc đổi mật khẩu.
//        - role hợp lệ + is_first_login=false -> vào đúng trang đã yêu
//          cầu trước đó (?redirect=..., do authGuard trong common.js
//          gắn vào khi đá về đây), mặc định landing page ("/").
//
// TODO (bước sau): server-side check khi Socket.IO connect (client.js
// gắn window.__authToken, server.js cần tự verify - common.js/login.js
// mới chỉ là lớp chặn ở giao diện, không phải lớp bảo mật thật).
// ---------------------------------------------------------

const loginLoading = document.getElementById("loginLoading");
const loginView = document.getElementById("loginView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");

const changePasswordView = document.getElementById("changePasswordView");
const changePasswordForm = document.getElementById("changePasswordForm");
const changePasswordError = document.getElementById("changePasswordError");
const changePasswordSubmitBtn = document.getElementById(
  "changePasswordSubmitBtn",
);
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");

function showView(view) {
  loginLoading.classList.add("hidden");
  loginView.classList.add("hidden");
  changePasswordView.classList.add("hidden");
  view.classList.remove("hidden");
}

function showError(el, message) {
  el.textContent = message;
  el.classList.add("is-visible");
}

function hideError(el) {
  el.classList.remove("is-visible");
  el.textContent = "";
}

function translateAuthError(message) {
  if (!message) return "Tài khoản hoặc mật khẩu không chính xác";
  if (message === "Invalid login credentials") {
    return "Tài khoản hoặc mật khẩu không chính xác";
  }
  if (message.toLowerCase().includes("different from the old password")) {
    return "Mật khẩu mới phải khác mật khẩu cũ";
  }
  return message;
}

/**
 * Đường quay lại sau khi đăng nhập xong - lấy từ ?redirect=... (do
 * authGuard trong common.js gắn vào khi đá người dùng chưa đăng nhập
 * về đây). Chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng "/" và không
 * phải "//..." (tránh open-redirect ra domain khác), mặc định "/".
 */
function getRedirectTarget() {
  const raw = new URLSearchParams(window.location.search).get("redirect");
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/";
}

/**
 * Sau khi có 1 session hợp lệ (vừa đăng nhập, hoặc đã có sẵn lúc tải
 * trang) - tra role trong `profiles` và quyết định bước tiếp theo.
 */
async function handleSignedIn(user) {
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, is_first_login")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !ALLOWED_ROLES.includes(profile.role)) {
    await supabaseClient.auth.signOut();
    showView(loginView);
    showError(
      loginError,
      "Tài khoản này không có quyền truy cập hệ thống này.",
    );
    return;
  }

  // localStorage là fallback cho trường hợp update is_first_login=false
  // bị RLS chặn ghi (xem changePasswordForm submit) - không check thêm
  // cái này thì ai lỡ rơi vào trường hợp đó sẽ bị bắt đổi mật khẩu lại
  // mỗi lần đăng nhập, dù đã đổi thành công rồi.
  const firstLoginDone =
    localStorage.getItem(`first_login_done_${user.id}`) === "true";

  if (profile.is_first_login && !firstLoginDone) {
    // Né tránh bằng reload: nếu trang này bị tải lại (F5) trong lúc lẽ
    // ra phải hiện màn đổi mật khẩu, đăng xuất luôn thay vì hiện lại -
    // giống hệt cơ chế bên web kanji.
    const navEntries = performance.getEntriesByType("navigation");
    const isReload =
      navEntries.length > 0 &&
      navEntries[0].type === "reload";
    if (isReload) {
      await supabaseClient.auth.signOut();
      showView(loginView);
      return;
    }
    showView(changePasswordView);
    return;
  }

  window.location.href = getRedirectTarget();
}

async function init() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    await handleSignedIn(session.user);
  } else {
    showView(loginView);
  }
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(loginError);

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    if (!username || !password) {
      showError(loginError, "Vui lòng nhập đầy đủ tài khoản và mật khẩu.");
      return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = "ĐANG XỬ LÝ...";

    try {
      const email = username.includes("@")
        ? username
        : username + AUTH_EMAIL_DOMAIN;

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      await handleSignedIn(data.user);
    } catch (err) {
      showError(loginError, translateAuthError(err.message));
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = "ĐĂNG NHẬP";
    }
  });
}

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(changePasswordError);

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword.length < 6) {
      showError(changePasswordError, "Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError(changePasswordError, "Mật khẩu không khớp.");
      return;
    }

    changePasswordSubmitBtn.disabled = true;
    changePasswordSubmitBtn.textContent = "ĐANG XỬ LÝ...";

    try {
      const { data: updateData, error: updateError } =
        await supabaseClient.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      const userId = updateData.user.id;

      // Có thể bị RLS chặn ghi cột này - không sao, vẫn cho qua bằng
      // fallback localStorage (giống hệt cách web kanji xử lý).
      const { error: profileUpdateError } = await supabaseClient
        .from("profiles")
        .update({ is_first_login: false })
        .eq("id", userId);

      if (profileUpdateError) {
        console.warn(
          "Không cập nhật được is_first_login (có thể do RLS), dùng fallback localStorage:",
          profileUpdateError.message,
        );
      }
      localStorage.setItem(`first_login_done_${userId}`, "true");

      window.location.href = getRedirectTarget();
    } catch (err) {
      showError(changePasswordError, translateAuthError(err.message));
      changePasswordSubmitBtn.disabled = false;
      changePasswordSubmitBtn.textContent = "XÁC NHẬN";
    }
  });
}

init();

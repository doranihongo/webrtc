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
const authCard = document.getElementById("authCard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");

const changePasswordForm = document.getElementById("changePasswordForm");
const changePasswordError = document.getElementById("changePasswordError");
const changePasswordSubmitBtn = document.getElementById(
  "changePasswordSubmitBtn",
);
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");

// Nút hiện/ẩn mật khẩu (icon con mắt) - tự làm vì iOS Safari không có
// sẵn icon "reveal" như Edge.
document.querySelectorAll(".auth-toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    const isVisible = target.type === "text";
    target.type = isVisible ? "password" : "text";
    btn.classList.toggle("is-visible", !isVisible);
    btn.setAttribute("aria-label", isVisible ? "Hiện mật khẩu" : "Ẩn mật khẩu");
  });
});

// Đánh dấu "đang ở màn đổi mật khẩu, chưa đổi xong" - dùng localStorage
// (không phải sessionStorage) vì cần sống sót qua việc thoát hẳn app
// rồi mở lại: trên PWA đã lưu về màn hình chính, mỗi lần mở lại icon
// là một phiên mới với sessionStorage RỖNG (khác hẳn 1 tab trình duyệt
// bình thường), nên trước đây dùng sessionStorage thì mở lại app luôn
// bị coi là "lần đầu" -> tiếp tục hiện màn đổi mật khẩu dở dang mãi,
// không bao giờ bị bắt đăng nhập lại. Không đoán qua
// performance.getEntriesByType("navigation") - cách đó không phải lúc
// nào cũng báo đúng "reload" trên mọi trình duyệt, có thể khiến trang
// bị kẹt ở màn loading mãi nếu logic không khớp thực tế.
// Gắn theo user.id (giống first_login_done_<uid>) để nhiều tài khoản
// dùng chung 1 máy không dẫm lên cờ của nhau.
function changepwPendingKey(userId) {
  return `changepw_pending_${userId}`;
}

/**
 * "login" hoặc "changepw" - đổi class trên thẻ để CSS tự chạy hiệu ứng
 * mảng màu cong trượt qua ("kéo rèm") giữa 2 màn, xem login.css.
 * @param {"login"|"changepw"} state
 */
function showView(state) {
  loginLoading.classList.add("hidden");
  authCard.classList.remove("hidden");
  authCard.classList.toggle("state-login", state === "login");
  authCard.classList.toggle("state-changepw", state === "changepw");
  // Nền trang (2 lớp gradient chéo ngược nhau, xem login.css) crossfade
  // theo class này trên <body> - song song với authCard.
  document.body.classList.toggle("state-changepw", state === "changepw");
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
async function handleSignedIn(user, accessToken) {
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select(
      "role, is_first_login, password_changed_at, max_devices, expires_at",
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !ALLOWED_ROLES.includes(profile.role)) {
    // Không lấy được profile (profileError, chưa chắc role sai) - phân
    // biệt lỗi mạng/timeout thoáng qua với token thật sự không hợp lệ
    // (401/403). Lỗi mạng ngay sau khi vừa đăng nhập thành công thì
    // không nên đăng xuất/báo "không có quyền" nhầm - chỉ báo lỗi mạng,
    // giữ nguyên phiên để bấm thử lại được luôn.
    if (!profile && profileError && !isAuthInvalidError(profileError)) {
      const { error: userErr } = await supabaseClient.auth.getUser();
      if (!isAuthInvalidError(userErr)) {
        showError(loginError, "Lỗi mạng, vui lòng thử lại.");
        return;
      }
    }
    localStorage.removeItem(changepwPendingKey(user.id));
    await supabaseClient.auth.signOut();
    hardResetSupabaseSession();
    showView("login");
    showError(
      loginError,
      "Tài khoản này không có quyền truy cập hệ thống này.",
    );
    return;
  }

  // Phiên này được cấp TRƯỚC lần đổi mật khẩu gần nhất (đổi ở thiết bị
  // khác trong lúc máy này còn đứng dở ở màn đổi mật khẩu) - access
  // token cũ vẫn còn "sống" nhưng không còn đại diện cho mật khẩu hiện
  // tại nữa, không cho vào thẳng, bắt đăng nhập lại bằng mật khẩu mới.
  if (profile.password_changed_at) {
    const tokenIssuedMs = decodeJwtIssuedAtMs(accessToken);
    const changedMs = new Date(profile.password_changed_at).getTime();
    if (
      tokenIssuedMs !== null &&
      tokenIssuedMs < changedMs - PASSWORD_CHANGE_GRACE_MS
    ) {
      localStorage.removeItem(changepwPendingKey(user.id));
      await supabaseClient.auth.signOut();
      hardResetSupabaseSession();
      showView("login");
      showError(
        loginError,
        "Mật khẩu đã được đổi ở thiết bị khác, vui lòng đăng nhập lại.",
      );
      return;
    }
  }

  // Hạn sử dụng + giới hạn số thiết bị (xem checkAccountAccess trong
  // supabaseClient.js) - chặn TRƯỚC cả bước bắt buộc đổi mật khẩu lần
  // đầu, vì hết hạn/quá thiết bị thì không cho vào bất kỳ đâu.
  const access = await checkAccountAccess(user.id, profile);
  if (!access.ok) {
    localStorage.removeItem(changepwPendingKey(user.id));
    await supabaseClient.auth.signOut();
    hardResetSupabaseSession();
    showView("login");
    showError(
      loginError,
      access.reason === "expired"
        ? "Tài khoản đã hết hạn sử dụng."
        : "Tài khoản đã đăng nhập đủ số thiết bị cho phép trên thiết bị khác.",
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
    // Nếu cờ này đã được set từ trước (tức lần load này KHÔNG phải lần
    // đầu tiên đăng nhập xong - mà là quay lại/reload trong lúc màn
    // đổi mật khẩu vẫn còn dang dở) -> bắt đăng nhập lại từ đầu, không
    // cho vào thẳng màn đổi mật khẩu nữa.
    if (localStorage.getItem(changepwPendingKey(user.id)) === "1") {
      localStorage.removeItem(changepwPendingKey(user.id));
      await supabaseClient.auth.signOut();
      showView("login");
      return;
    }
    localStorage.setItem(changepwPendingKey(user.id), "1");
    showView("changepw");
    return;
  }

  localStorage.removeItem(changepwPendingKey(user.id));
  window.location.href = getRedirectTarget();
}

async function init() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (session?.user) {
      await handleSignedIn(session.user, session.access_token);
    } else {
      showView("login");
    }
  } catch (err) {
    // Không để trang bị kẹt mãi ở màn "Đang kiểm tra phiên đăng
    // nhập..." nếu có lỗi bất ngờ (mạng, Supabase lỗi tạm...) - luôn
    // có đường thoát về form đăng nhập.
    console.error("[login] init lỗi:", err);
    showView("login");
    showError(loginError, "Có lỗi xảy ra, vui lòng đăng nhập lại.");
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

      await handleSignedIn(data.user, data.session?.access_token);
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
      // password_changed_at đánh dấu mốc đổi mật khẩu - để authGuard/
      // server.js phát hiện và thu hồi các phiên khác được cấp TRƯỚC
      // mốc này (vd: máy A đăng nhập bằng mật khẩu tạm, đứng ở màn đổi
      // mật khẩu không làm gì, trong lúc máy B đăng nhập cùng tài
      // khoản và đổi mật khẩu xong - máy A không được lọt vào chỉ vì
      // is_first_login đã false).
      const { error: profileUpdateError } = await supabaseClient
        .from("profiles")
        .update({
          is_first_login: false,
          password_changed_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileUpdateError) {
        console.warn(
          "Không cập nhật được is_first_login (có thể do RLS), dùng fallback localStorage:",
          profileUpdateError.message,
        );
      }
      localStorage.setItem(`first_login_done_${userId}`, "true");
      localStorage.removeItem(changepwPendingKey(userId));

      // QUAN TRỌNG: token hiện tại của chính thiết bị này được cấp TỪ
      // TRƯỚC lúc đổi mật khẩu (updateUser() không tự cấp token mới) -
      // nếu không làm mới, cái kiểm tra "token cũ hơn password_changed_at
      // -> bắt đăng nhập lại" (thêm ở authGuard/server.js) sẽ tưởng nhầm
      // CHÍNH thiết bị vừa đổi mật khẩu là 1 phiên cũ rò rỉ, đá ngược
      // lại màn đăng nhập ngay sau khi vừa đổi xong. Refresh để lấy
      // token mới có mốc thời gian SAU lúc đổi.
      const { error: refreshError } = await supabaseClient.auth.refreshSession();
      if (refreshError) {
        console.warn(
          "Không làm mới được session sau khi đổi mật khẩu:",
          refreshError.message,
        );
      }

      window.location.href = getRedirectTarget();
    } catch (err) {
      showError(changePasswordError, translateAuthError(err.message));
      changePasswordSubmitBtn.disabled = false;
      changePasswordSubmitBtn.textContent = "XÁC NHẬN";
    }
  });
}

init();

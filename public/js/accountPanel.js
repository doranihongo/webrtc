"use strict";

// ---------------------------------------------------------
// Icon tài khoản + bảng thông tin ở landing page. Chức năng giống
// UserProfileSidebar.tsx bên web "xóa mù kanji" (xem tên hiển thị,
// vai trò, đổi mật khẩu, đăng xuất) - chỉ khác giao diện, theo đúng
// Ocean theme của web này.
// ---------------------------------------------------------

// Cùng bộ style DiceBear + cùng key localStorage "P2P_SETTINGS" mà
// client.js dùng trong phòng họp - để avatar hiển thị y hệt nhau ở cả
// landing lẫn trong phòng, không phải 2 avatar khác nhau.
const ACCOUNT_AVATAR_STYLES = ["adventurer-neutral", "thumbs"];

function getOrCreateAccountAvatarUrl() {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem("P2P_SETTINGS")) || {};
  } catch (err) {
    settings = {};
  }

  if (settings.peer_avatar) return settings.peer_avatar;

  const seed = Math.random().toString(36).substring(2, 10);
  const style =
    ACCOUNT_AVATAR_STYLES[
      Math.floor(Math.random() * ACCOUNT_AVATAR_STYLES.length)
    ];
  const url = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

  settings.peer_avatar = url;
  settings.peer_avatar_auto = true;
  localStorage.setItem("P2P_SETTINGS", JSON.stringify(settings));
  return url;
}

const ROLE_LABELS = {
  admin: "Quản trị viên",
  giaovien: "Giáo viên",
  hocvien: "Học viên",
};

const accountBtn = document.getElementById("accountBtn");
const accountAvatar = document.getElementById("accountAvatar");
const accountPanelOverlay = document.getElementById("accountPanelOverlay");
const accountPanelClose = document.getElementById("accountPanelClose");
const accountDisplayName = document.getElementById("accountDisplayName");
const accountRole = document.getElementById("accountRole");

const accountInfoView = document.getElementById("accountInfoView");
const accountChangePasswordView = document.getElementById(
  "accountChangePasswordView",
);
const accountChangePasswordBtn = document.getElementById(
  "accountChangePasswordBtn",
);
const accountChangePasswordBack = document.getElementById(
  "accountChangePasswordBack",
);
const accountChangePasswordForm = document.getElementById(
  "accountChangePasswordForm",
);
const accountChangePasswordError = document.getElementById(
  "accountChangePasswordError",
);
const accountChangePasswordSubmit = document.getElementById(
  "accountChangePasswordSubmit",
);
const accountOldPassword = document.getElementById("accountOldPassword");
const accountNewPassword = document.getElementById("accountNewPassword");
const accountConfirmPassword = document.getElementById(
  "accountConfirmPassword",
);
const accountLogoutBtn = document.getElementById("accountLogoutBtn");

if (accountAvatar) {
  accountAvatar.src = getOrCreateAccountAvatarUrl();
}

function openAccountPanel() {
  accountPanelOverlay.classList.remove("hidden");
  // Luôn mở lại ở màn thông tin, không phải màn đổi mật khẩu dở dang
  showAccountInfoView();
}

function closeAccountPanel() {
  accountPanelOverlay.classList.add("hidden");
}

function showAccountInfoView() {
  accountInfoView.classList.remove("hidden");
  accountChangePasswordView.classList.add("hidden");
  hideAccountError();
  accountChangePasswordForm.reset();
}

function showAccountChangePasswordView() {
  accountInfoView.classList.add("hidden");
  accountChangePasswordView.classList.remove("hidden");
}

function showAccountError(message) {
  accountChangePasswordError.textContent = message;
  accountChangePasswordError.classList.add("is-visible");
}

function hideAccountError() {
  accountChangePasswordError.classList.remove("is-visible");
  accountChangePasswordError.textContent = "";
}

if (accountBtn) {
  accountBtn.addEventListener("click", openAccountPanel);
}
if (accountPanelClose) {
  accountPanelClose.addEventListener("click", closeAccountPanel);
}
if (accountPanelOverlay) {
  // Bấm ra ngoài (nền tối) để đóng - giống hệt UserProfileSidebar bên kanji
  accountPanelOverlay.addEventListener("click", (e) => {
    if (e.target === accountPanelOverlay) closeAccountPanel();
  });
}
if (accountChangePasswordBtn) {
  accountChangePasswordBtn.addEventListener(
    "click",
    showAccountChangePasswordView,
  );
}
if (accountChangePasswordBack) {
  accountChangePasswordBack.addEventListener("click", showAccountInfoView);
}

if (accountChangePasswordForm) {
  accountChangePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAccountError();

    const oldPassword = accountOldPassword.value;
    const newPassword = accountNewPassword.value;
    const confirmPassword = accountConfirmPassword.value;

    if (!oldPassword) {
      showAccountError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (newPassword.length < 6) {
      showAccountError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAccountError("Mật khẩu không khớp.");
      return;
    }

    accountChangePasswordSubmit.disabled = true;
    accountChangePasswordSubmit.textContent = "ĐANG XỬ LÝ...";

    try {
      const email = window.__authUser?.email;
      if (!email) throw new Error("Không tìm thấy thông tin tài khoản.");

      // Xác thực mật khẩu cũ trước khi cho đổi - giống hệt cách web kanji làm
      const { error: verifyError } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password: oldPassword,
        });
      if (verifyError) throw new Error("Mật khẩu hiện tại không đúng.");

      const { error: updateError } = await supabaseClient.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      showAccountInfoView();
      closeAccountPanel();
    } catch (err) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("different from the old password")) {
        showAccountError("Mật khẩu mới phải khác mật khẩu cũ.");
      } else {
        showAccountError(msg || "Có lỗi xảy ra khi đổi mật khẩu.");
      }
    } finally {
      accountChangePasswordSubmit.disabled = false;
      accountChangePasswordSubmit.textContent = "Lưu thay đổi";
    }
  });
}

if (accountLogoutBtn) {
  accountLogoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "/login";
  });
}

// Điền thông tin tài khoản ngay khi authGuard (common.js) xác thực xong
if (window.__authReady) {
  window.__authReady.then(() => {
    if (!window.__authUser) return; // authGuard đang redirect về login
    if (accountDisplayName) {
      accountDisplayName.textContent = window.__authUser.displayName;
    }
    if (accountRole) {
      accountRole.textContent =
        ROLE_LABELS[window.__authUser.role] || window.__authUser.role;
    }
  });
}

"use strict";

// ---------------------------------------------------------
// Icon tài khoản + bảng thông tin ở landing page. Port gần như y hệt
// UserProfileSidebar.tsx bên web "xóa mù kanji" (tên hiển thị, vai
// trò, số lượng thiết bị, hạn sử dụng, đổi mật khẩu, đăng xuất, popup
// "Thành công!") - chỉ khác màu sắc, theo đúng Ocean theme của web
// này. Xem topbar.css cho phần CSS (hiệu ứng trượt vào, popup...).
// ---------------------------------------------------------

// Avatar icon tài khoản ở landing - CỐ ĐỊNH, luôn là ảnh này, không
// ngẫu nhiên và không đụng tới localStorage "P2P_SETTINGS.peer_avatar"
// (đó là avatar RIÊNG dùng trong phòng họp, do client.js tự quản lý,
// vẫn ngẫu nhiên như cũ - 2 avatar này độc lập với nhau).
const ACCOUNT_AVATAR_URL = "https://api.dicebear.com/9.x/thumbs/svg?seed=ghm0gmgl";

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
const accountDeviceCount = document.getElementById("accountDeviceCount");
const accountExpiresAt = document.getElementById("accountExpiresAt");
const accountSuccessPopup = document.getElementById("accountSuccessPopup");

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
  accountAvatar.src = ACCOUNT_AVATAR_URL;
}

// Nút hiện/ẩn mật khẩu (icon con mắt, màu trắng - xem topbar.css) ở
// form đổi mật khẩu trong bảng tài khoản.
document.querySelectorAll(".account-toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    const icon = btn.querySelector("i");
    if (!target || !icon) return;
    const isVisible = target.type === "text";
    target.type = isVisible ? "password" : "text";
    icon.classList.toggle("fa-eye", isVisible);
    icon.classList.toggle("fa-eye-slash", !isVisible);
    btn.setAttribute("aria-label", isVisible ? "Hiện mật khẩu" : "Ẩn mật khẩu");
  });
});

function openAccountPanel() {
  accountPanelOverlay.classList.remove("hidden");
  // Khoá cuộn/vuốt trang nền phía sau trong lúc bảng đang mở, trên cả
  // điện thoại lẫn máy tính - overflow:hidden suông trên <body> không ăn
  // chắc trên mọi trình duyệt di động (Safari iOS vẫn có thể cuộn dội qua
  // lớp phủ), nên dùng đúng cách App.tsx (kaiwa/src/App.tsx) đã dùng cho
  // lúc vào khóa học/buổi học: chuyển body sang position:fixed + bù lại
  // đúng vị trí cuộn cũ (scrollY) làm top offset, phục hồi nguyên vị trí
  // lúc đóng. .account-panel-open giữ lại cho CSS (border/touch-action ở
  // trên) chứ bản thân class đó không còn gánh việc khoá cuộn nữa.
  const scrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
  document.body.classList.add("account-panel-open");
  // Luôn mở lại ở màn thông tin, không phải màn đổi mật khẩu dở dang
  showAccountInfoView();
  // Lấy lại số thiết bị/hạn sử dụng mới nhất từ Supabase mỗi lần mở -
  // dữ liệu này không realtime, nếu chỉ dùng window.__authUser (lấy 1
  // lần lúc tải trang ở common.js) thì admin sửa trực tiếp trên Supabase
  // sẽ không thấy phản ánh cho tới khi người dùng tải lại trang.
  refreshAccountInfo();
}

function closeAccountPanel() {
  accountPanelOverlay.classList.add("hidden");
  const scrollY = document.body.style.top;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  document.body.classList.remove("account-panel-open");
  if (scrollY) window.scrollTo(0, parseInt(scrollY || "0", 10) * -1);
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
  // Bấm chuột ra ngoài (nền tối) vẫn đóng bảng như cũ - chỉ khoá
  // cuộn/vuốt trang nền (xem .account-panel-open ở topbar.css), không
  // khoá việc bấm ra ngoài để đóng.
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

      // Đánh dấu mốc đổi mật khẩu - giống hệt luồng bắt buộc lần đầu
      // (login.js), để các phiên cũ ở thiết bị khác bị thu hồi (xem
      // authGuard/server.js). Không có bước này thì đổi mật khẩu qua
      // đường tự nguyện này sẽ không kích hoạt bảo vệ đó.
      const { error: markChangedError } = await supabaseClient
        .from("profiles")
        .update({ password_changed_at: new Date().toISOString() })
        .eq("id", window.__authUser.id);
      if (markChangedError) {
        console.warn(
          "Không cập nhật được password_changed_at (có thể do RLS):",
          markChangedError.message,
        );
      }

      // Làm mới token của chính thiết bị này - nếu không, lần authGuard
      // chạy tiếp theo sẽ tưởng nhầm token hiện tại (cấp từ trước lúc
      // đổi) là phiên cũ rồi tự đăng xuất, y hệt bug đã gặp ở login.js.
      await supabaseClient.auth.refreshSession();

      // Hiện popup "Thành công!" 2.5s rồi mới quay lại màn thông tin,
      // giống hệt showSuccessPopup bên UserProfileSidebar (kanji).
      accountSuccessPopup.classList.remove("hidden");
      setTimeout(() => {
        accountSuccessPopup.classList.add("hidden");
        showAccountInfoView();
      }, 2500);
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

// Điền thông tin tài khoản vào bảng. Gọi lại được nhiều lần (mỗi lần mở
// bảng) để lấy số thiết bị/hạn sử dụng mới nhất từ Supabase, thay vì chỉ
// dùng window.__authUser đã lấy 1 lần lúc tải trang (authGuard trong
// common.js) - nếu không thì admin sửa trực tiếp trên Supabase sẽ không
// thấy phản ánh cho tới khi người dùng tải lại trang.
async function refreshAccountInfo() {
  if (!window.__authUser) return; // authGuard đang redirect về login

  if (accountDisplayName) {
    accountDisplayName.textContent = window.__authUser.displayName;
  }
  if (accountRole) {
    accountRole.textContent =
      ROLE_LABELS[window.__authUser.role] || window.__authUser.role;
  }

  // Lấy lại role/tên/max_devices/expires_at mới nhất - không chỉ số
  // thiết bị. Nếu lỗi mạng thì im lặng giữ nguyên dữ liệu cũ (đã hiện ở
  // trên từ window.__authUser), không làm gián đoạn người dùng.
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, display_name, max_devices, expires_at")
    .eq("id", window.__authUser.id)
    .single();

  if (!profileError && profile) {
    window.__authUser.role = profile.role;
    window.__authUser.displayName =
      profile.display_name || window.__authUser.displayName;
    window.__authUser.maxDevices = profile.max_devices;
    window.__authUser.expiresAt = profile.expires_at;
    if (accountDisplayName) {
      accountDisplayName.textContent = window.__authUser.displayName;
    }
    if (accountRole) {
      accountRole.textContent =
        ROLE_LABELS[window.__authUser.role] || window.__authUser.role;
    }
  }

  if (accountDeviceCount) {
    const maxDevices = window.__authUser.maxDevices || 1;
    // admin miễn giới hạn thiết bị (xem checkAccountAccess trong
    // supabaseClient.js) - không có dữ liệu tracking thật cho role
    // này, hiện "1/tối đa" như trước.
    if (window.__authUser.role === "admin") {
      accountDeviceCount.textContent = `1/${maxDevices}`;
    } else {
      const { data: devices, error } = await supabaseClient
        .from("user_devices")
        .select("id")
        .eq("user_id", window.__authUser.id);
      const activeCount = error ? 1 : devices?.length || 1;
      accountDeviceCount.textContent = `${activeCount}/${maxDevices}`;
    }
  }
  if (accountExpiresAt) {
    accountExpiresAt.textContent = window.__authUser.expiresAt
      ? new Date(window.__authUser.expiresAt).toLocaleDateString("vi-VN")
      : "Vĩnh viễn";
  }
}

// Điền thông tin tài khoản ngay khi authGuard (common.js) xác thực xong
if (window.__authReady) {
  window.__authReady.then(refreshAccountInfo);
}

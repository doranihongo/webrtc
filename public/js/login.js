"use strict";

// ---------------------------------------------------------
// Login page - UI wiring only for now (loading state, error display).
// TODO (bước tiếp theo): gắn Supabase Auth thật vào đây -
// supabase.auth.signInWithPassword({ email, password }) - và xử lý
// redirect sau khi đăng nhập thành công / bắt buộc đổi mật khẩu lần đầu.
// ---------------------------------------------------------

const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.add("is-visible");
}

function hideLoginError() {
  loginError.classList.remove("is-visible");
  loginError.textContent = "";
}

function setLoginLoading(isLoading) {
  loginSubmitBtn.disabled = isLoading;
  loginSubmitBtn.textContent = isLoading ? "ĐANG XỬ LÝ..." : "ĐĂNG NHẬP";
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideLoginError();

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    if (!username || !password) {
      showLoginError("Vui lòng nhập đầy đủ tài khoản và mật khẩu.");
      return;
    }

    setLoginLoading(true);

    // TODO: thay đoạn dưới bằng gọi Supabase Auth thật khi bước sau
    // gắn SDK + cấu hình project vào.
    console.log("[login] submit (chưa gắn Supabase)", { username });
    setLoginLoading(false);
  });
}

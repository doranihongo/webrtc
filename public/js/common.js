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
// 1. Tự động điền tên phòng ngẫu nhiên khi mới vào trang
// ---------------------------------------------------------
const roomName = document.getElementById("roomName");
if (roomName) {
  roomName.value = "";
  shuffleText(roomName, getRandomRoomCode());

  // Bấm Enter ở ô nhập tên phòng để truy cập
  roomName.onkeyup = (e) => {
    if (e.keyCode === 13) {
      e.preventDefault();
      joinRoom();
    }
  };
}

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
// 3. Xử lý các nút bấm (Tạo phòng & Tham gia)
// ---------------------------------------------------------
const genRoomButton = document.getElementById("genRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");

if (genRoomButton) {
  genRoomButton.onclick = (e) => {
    e.preventDefault();
    playSound("switch");
    genRoomButton.classList.remove("spin");
    void genRoomButton.offsetWidth; // Kích hoạt lại animation
    genRoomButton.classList.add("spin");
    shuffleText(document.getElementById("roomName"), getRandomRoomCode());
  };
  genRoomButton.addEventListener("animationend", () => {
    genRoomButton.classList.remove("spin");
  });
}

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

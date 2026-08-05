"use strict";

/**
 * Tạo mã phòng ngẫu nhiên 6 ký tự (bao gồm chữ cái và số)
 */
function getRandomRoomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Hiệu ứng xáo trộn ký tự (Shuffle text) cho ô nhập tên phòng
 */
function shuffleText(input, finalValue, duration = 600) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
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

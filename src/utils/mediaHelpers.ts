// @ts-nocheck
// src/utils/mediaHelpers.ts
export function getPeerInfo() {
  return {
    isDesktopDevice: isDesktopDevice,
    isMobileDevice: isMobileDevice,
    isTabletDevice: isTabletDevice,
    isIPadDevice: isIPadDevice,
    osName: osName,
    osVersion: osVersion,
    browserName: browserName,
    browserVersion: browserVersion,
    extras: {},
  };
}



export function getRoomId() {
  // check if passed as params /join?room=id
  let queryRoomId = getQueryParam("room");

  // skip /join/
  let roomId = queryRoomId
    ? queryRoomId
    : window.location.pathname.split("/join/")[1];

  // if not specified room id or 'random', create one random
  if (roomId == "" || roomId === "random") {
    roomId = makeId(20);
    // Preserve existing query params (audio, video, name, duration, notify, etc.) and set `room` as query param
    const url = new URL(window.location.href);

    // Force join route to query-based format: /join?room=...
    url.pathname = `/join`;

    // Ensure room is in query string
    url.searchParams.set("room", roomId);

    const newUrl = url.toString();
    window.history.pushState({ url: newUrl }, roomId, newUrl);
  }
  console.log("Direct join", { room: roomId });

  // Update Room name in settings
  if (myRoomId) myRoomId.innerText = roomId;

  // Save room name in local storage
  window.localStorage.lastRoom = roomId;
  return roomId;
}

export function getRoomDuration() {
  const roomDuration = getQueryParam("duration");

  if (isValidDuration(roomDuration)) {
    if (roomDuration === "unlimited") {
      console.log("The room has no time limit");
      return roomDuration;
    }
    const timeLimit = timeToMilliseconds(roomDuration);
    setTimeout(() => {
      playSound("eject");
      Swal.fire({
        background: swBg,
        position: "center",
        title: "Time Limit Reached",
        text: "The room has reached its time limit and will close shortly",
        icon: "warning",
        timer: 6000, // 6 seconds
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
        willClose: () => {
          exitRoom();
        },
      });
    }, timeLimit);

    console.log("Direct join", {
      duration: roomDuration,
      timeLimit: timeLimit,
    });
    return roomDuration;
  }
  return "unlimited";
}

export function timeToMilliseconds(timeString) {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

export function isValidDuration(duration) {
  if (duration === "unlimited") return true;
  // Check if the format is HH:MM:SS
  const regex = /^(\d{2}):(\d{2}):(\d{2})$/;
  const match = duration.match(regex);
  if (!match) return false;
  const [hours, minutes, seconds] = match.slice(1).map(Number);
  // Validate ranges: hours, minutes, and seconds
  if (hours < 0 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return false;
  }
  return true;
}

export function makeId(length) {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function getUUID() {
  const uuid4 = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16),
  );
  if (window.localStorage.uuid) {
    return window.localStorage.uuid;
  }
  window.localStorage.uuid = uuid4;
  return uuid4;
}

export function getNotify() {
  let notify = getQueryParam("notify");
  if (notify) {
    let queryNotify = notify === "1" || notify === "true";
    if (queryNotify != null) {
      console.log("Direct join", { notify: queryNotify });
      return queryNotify;
    }
  }
  notify = lsSettings.share_on_join;
  console.log("Direct join", { notify: notify });
  return notify;
}

export function getChat() {
  let chat = getQueryParam("chat");
  if (chat) {
    let queryChat = chat === "1" || chat === "true";
    if (queryChat != null) {
      console.log("Direct join", { chat: queryChat });
      notify = false; // From widget disable notify on join...
      return queryChat;
    }
  }
  console.log("Direct join", { chat: chat });
  return chat;
}

export function getPeerToken() {
  if (window.sessionStorage.peer_token) return window.sessionStorage.peer_token;
  let token = getQueryParam("token");
  let queryToken = false;
  if (token) {
    queryToken = token;
  }
  console.log("Direct join", { token: queryToken });
  return queryToken;
}

export function getPeerName() {
  const name = getQueryParam("name");
  if (isHtml(name)) {
    console.log("Direct join", { name: "Invalid name" });
    return "Invalid name";
  }

  if (name === "random") {
    const randomName = generateRandomName();
    console.log("Direct join", { name: randomName });
    return randomName;
  }

  console.log("Direct join", { name: name });
  return name;
}

export function generateRandomName() {
  const adjectives = [
    "Quick",
    "Lazy",
    "Happy",
    "Sad",
    "Brave",
    "Clever",
    "Witty",
    "Calm",
    "Bright",
    "Charming",
  ];
  const nouns = [
    "Fox",
    "Dog",
    "Cat",
    "Mouse",
    "Lion",
    "Tiger",
    "Bear",
    "Wolf",
    "Eagle",
    "Shark",
  ];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${adjective}${noun}${number}`;
}

export function getPeerAvatar() {
  const avatar = getQueryParam("avatar");
  const avatarDisabled = avatar === "0" || avatar === "false";
  const isBase64Avatar =
    typeof avatar === "string" && avatar.startsWith("data:image/");

  console.log("Direct join", { avatar: avatar });

  if (avatarDisabled || isBase64Avatar || !isValidAvatarURL(avatar)) {
    const saved = lsSettings.peer_avatar;
    if (saved && isValidAvatarURL(saved)) {
      console.log("Restored avatar from localStorage", { avatar: saved });
      return saved;
    }
    return false;
  }
  return avatar;
}

export function getScreenEnabled() {
  let screen = getQueryParam("screen");
  if (screen) {
    screen = screen.toLowerCase();
    let queryPeerScreen = screen === "1" || screen === "true";
    console.log("Direct join", { screen: queryPeerScreen });
    return queryPeerScreen;
  }
  console.log("Direct join", { screen: false });
  return false;
}

export function getHideMeActive() {
  let hide = getQueryParam("hide");
  let queryHideMe = false;
  if (hide) {
    hide = hide.toLowerCase();
    queryHideMe = hide === "1" || hide === "true";
  }
  console.log("Direct join", { hide: queryHideMe });
  return queryHideMe;
}

export function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return filterXSS(urlParams.get(param));
}

export function getVideoConstraints(videoQuality) {
  const frameRate = videoMaxFrameRate || 30;

  const resolutionMap = getResolutionMap();

  // Default HD
  let width = 1280;
  let height = 720;

  if (videoQuality === "default") {
    // Default 4k
    if (forceCamMaxResolutionAndFps) {
      width = 3840;
      height = 2160;
    }
  } else if (resolutionMap[videoQuality]) {
    [width, height] = resolutionMap[videoQuality];
  }

  const constraints = {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: frameRate },
  };

  console.log("Get Video constraints", constraints);
  return constraints;
}

export function isValidAvatarURL(input) {
  if (!input || typeof input !== "string") return false;
  if (input.startsWith("data:")) return false;
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isHtml(str) {
  let a = document.createElement("div");
  a.innerHTML = str;
  for (let c = a.childNodes, i = c.length; i--;) {
    if (c[i].nodeType == 1) return true;
  }
  return false;
}


export function filterXSS(str) {
  return window.filterXSS ? window.filterXSS(str) : str;
}

export function checkWebRTCSupported() {
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

export function getAudioConstraints(deviceId = null) {
  // If custom RNNoise is enabled but not supported, fall back to built-in WebRTC noise suppression
  const useBuiltInNoiseSuppression =
    !buttons.settings.customNoiseSuppression || !isRNNoiseSupported;

  // Enhanced audio constraints for better quality and volume on all devices
  // On mobile, use { ideal: true } so getUserMedia succeeds even if the
  // device's built-in mic cannot honour a constraint (e.g. iOS Safari may
  // silently suppress audio when echoCancellation is strictly required).
  const audioConstraints = {
    echoCancellation: isMobileDevice ? { ideal: true } : true,
    autoGainControl: isMobileDevice ? { ideal: true } : true,
    noiseSuppression: useBuiltInNoiseSuppression,
  };
  /* 
    deviceId handling is platform-dependent:
        - iOS Safari: routing is OS-controlled; ignore deviceId.
        - Mobile (Android): best-effort with `ideal`.
        - Desktop: `exact` is reliable.
    */
  if (deviceId) {
    if (isMobileSafari) {
      // ignore
    } else if (isMobileDevice) {
      audioConstraints.deviceId = { ideal: deviceId };
    } else {
      audioConstraints.deviceId = { exact: deviceId };
    }
  }

  return {
    audio: audioConstraints,
  };
}

export function getVideoConstraints(videoQuality) {
  const frameRate = videoMaxFrameRate || 30;

  const resolutionMap = getResolutionMap();

  // Default HD
  let width = 1280;
  let height = 720;

  if (videoQuality === "default") {
    // Default 4k
    if (forceCamMaxResolutionAndFps) {
      width = 3840;
      height = 2160;
    }
  } else if (resolutionMap[videoQuality]) {
    [width, height] = resolutionMap[videoQuality];
  }

  const constraints = {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: frameRate },
  };

  console.log("Get Video constraints", constraints);
  return constraints;
}

export function getId(id) {
  return document.getElementById(id);
}

export function getQs(selector) {
  return document.querySelector(selector);
}

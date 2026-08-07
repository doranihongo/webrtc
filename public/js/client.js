// SweetAlert2's own built-in default button labels ("OK"/"Cancel") are in
// English and show up on every dialog that doesn't set its own text
// explicitly - override them site-wide here so nothing falls back to
// English by accident.
if (typeof Swal !== "undefined" && typeof Swal.mixin === "function") {
  Swal = Swal.mixin({
    confirmButtonText: "Đồng ý",
    cancelButtonText: "Hủy",
    denyButtonText: "Không",
  });
}

window.setAspectRatio = function () {};

window.resizeVideoMedia = function () {
  const v = document.getElementById("videoMediaContainer");
  if (v) {
    const c = v.childElementCount <= 2;
    document.documentElement.style.setProperty(
      "--vmi-wh",
      (c ? Math.min(200, Math.max(120, v.offsetHeight * 0.25)) : 100) + "px",
    );
  }
};
window.isHideALLVideosActive = false;

/**
 * Truncate a display name to at most 12 characters (spaces included),
 * appending "..." when cut. A name of exactly 12 chars or fewer (e.g.
 * "DORA NIHONGO") is shown in full. Display-only - never use this on a
 * name before storing/matching/sending it, only right before it's
 * rendered into the DOM.
 * @param {string} name
 * @returns {string} truncated name for display
 */
function truncateDisplayName(name) {
  if (!name || typeof name !== "string") return name;
  return name.length > 12 ? name.slice(0, 12) + "..." : name;
}

function setPeerNameHTML(element, name, isMe, peerId = "", isScreen = false) {
  if (!element) return;
  element.setAttribute("data-name", name);
  element.setAttribute("data-isme", isMe);
  element.setAttribute("data-peerid", peerId);
  element.setAttribute("data-isscreen", isScreen);
  refreshPeerNameTag(element);
}

function refreshPeerNameTag(element) {
  if (!element) return;
  const name = element.getAttribute("data-name");
  const isMe = element.getAttribute("data-isme") === "true";
  const peerId = element.getAttribute("data-peerid");
  const isScreenTag = element.getAttribute("data-isscreen") === "true";

  let isVideoOff = false;
  let isAudioMuted = false;
  let isScreenShare = false;

  if (isMe) {
    if (myVideoStatus === false) isVideoOff = true;
    if (myAudioStatus === false) isAudioMuted = true;
    if (isScreenStreaming || isScreenTag) isScreenShare = true;
  } else {
    if (isScreenTag) isScreenShare = true;
    // className is a FontAwesome icon class ("fas fa-video-slash" /
    // "fas fa-microphone-slash") - it never contains the word "Off",
    // so that used to never match and these badges never showed.
    const vStatus = document.getElementById(peerId + "_videoStatus");
    if (vStatus && vStatus.className.includes("-slash")) isVideoOff = true;
    const aStatus = document.getElementById(peerId + "_audioStatus");
    if (aStatus && aStatus.className.includes("-slash")) isAudioMuted = true;
  }

  let html =
    '<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:rgba(var(--ds-brand-600-rgb),0.2);color:var(--ds-brand-500);flex-shrink:0;"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>';
  html +=
    // max-width is just a CSS safety net now that the name itself is
    // already hard-truncated to 12 chars + "..." in JS (truncateDisplayName)
    // - wide enough to fit that in full at normal zoom/font-size.
    '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">' +
    truncateDisplayName(name) +
    "</span>";

  if (isMe) {
    html +=
      '<span style="background:rgba(var(--ds-brand-600-rgb),0.2);color:var(--ds-brand-500);font-size:10px;padding:2px 6px;border-radius:6px;font-family:ui-monospace, monospace;font-weight:500;flex-shrink:0;">(Bạn)</span>';
  }

  if (isScreenShare) {
    html +=
      '<div style="display:flex;align-items:center;padding-left:4px;border-left:1px solid rgba(var(--ds-border-rgb),0.8);flex-shrink:0;"><svg class="w-3.5 h-3.5" style="width:14px;height:14px;color:var(--ds-brand-500);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></div>';
  }

  if (isAudioMuted) {
    html +=
      '<div style="display:flex;align-items:center;padding-left:4px;border-left:1px solid rgba(36,64,107,0.8);flex-shrink:0;"><svg class="w-3.5 h-3.5" style="width:14px;height:14px;color:#fb7185;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg></div>';
  }

  element.innerHTML = html;
}

/**
 * MiroTalk P2P - Client component
 *
 * @link    GitHub: https://github.com/miroslavpejic85/mirotalk
 * @link    Official Live demo: https://p2p.mirotalk.com
 * @license For open source use: AGPLv3
 * @license For commercial use or closed source, contact us at license.mirotalk@gmail.com or purchase directly from CodeCanyon
 * @license CodeCanyon: https://codecanyon.net/item/mirotalk-p2p-webrtc-realtime-video-conferences/38376661
 * @author  Miroslav Pejic - miroslav.pejic.85@gmail.com
 * @version 1.8.75
 *
 */

("use strict");

// https://www.w3schools.com/js/js_strict.asp

// This room
const myRoomId = getId("myRoomId");
const roomSessionDuration = getRoomDuration();
const roomId = getRoomId();
const myRoomUrl = window.location.origin + "/join/" + roomId; // share room url

// Images
const images = {
  confirmation: "../images/image-placeholder.png",
  share: "../images/share.png",
  locked: "../images/locked.png",
  videoOff: "../images/cam-off.png",
  audioOff: "../images/audio-off.png",
  audioGif: "../images/audio.gif",
  screenOff: "../images/screen-off.png",
  delete: "../images/delete.png",
  message: "../images/message.png",
  leave: "../images/leave-room.png",
  vaShare: "../images/va-share.png",
  about: "../images/mirotalk-logo.gif",
  feedback: "../images/feedback.png",
  forbidden: "../images/forbidden.png",
  avatar: "../images/mirotalk-logo.png",
  recording: "../images/recording.png",
  poster: "../images/loader.gif",
  geoLocation: "../images/geolocation.png",
}; // nice free icon: https://www.iconfinder.com

const className = {
  user: "fas fa-user",
  clock: "fas fa-clock",
  hideMeOn: "fas fa-user-slash",
  hideMeOff: "fas fa-user",
  audioOn: "fas fa-microphone",
  audioOff: "fas fa-microphone-slash",
  videoOn: "fas fa-video",
  videoOff: "fas fa-video-slash",
  screenOn: "fas fa-desktop",
  screenOff: "fas fa-stop-circle",
  handPulsate: "fas fa-hand-paper pulsate",
  pinUnpin: "fas fa-map-pin",
  mirror: "fas fa-arrow-right-arrow-left",
  fullScreen: "fas fa-expand",
  fsOn: "fas fa-compress-alt",
  fsOff: "fas fa-expand-alt",
  geoLocation: "fas fa-location-dot",
  shareVideoAudio: "fab fa-youtube",
  kickOut: "fas fa-sign-out-alt",
  chatOn: "fas fa-comment",
  chatOff: "fas fa-comment",
  ghost: "fas fa-ghost",
  undo: "fas fa-undo",
  trash: "fas fa-trash",
  copy: "fas fa-copy",
  speech: "fas fa-volume-high",
  heart: "fas fa-heart",
  pip: "fas fa-images",
  up: "fas fa-chevron-up",
  down: "fas fa-chevron-down",
};
// https://fontawesome.com/search?o=r&m=free

const icons = {
  lock: '<i class="fas fa-lock"></i>',
  unlock: '<i class="fas fa-lock-open"></i>',
  pitchBar: '<i class="fas fa-microphone-lines"></i>',
  sounds: '<i class="fas fa-music"></i>',
  share: '<i class="fas fa-share-alt"></i>',
  user: '<i class="fas fa-user"></i>',
  codecs: '<i class="fa-solid fa-film"></i>',
  theme: '<i class="fas fa-fill-drip"></i>',
  close: '<i class="fas fa-times"></i>',
  infoBrowser: '<i class="fa-solid fa-globe"></i>',
  infoCpu: '<i class="fa-solid fa-microchip"></i>',
  infoDevice: '<i class="fa-solid fa-laptop"></i>',
  infoEngine: '<i class="fa-solid fa-gear"></i>',
  infoOs: '<i class="fa-solid fa-layer-group"></i>',
  infoDefault: '<i class="fa-solid fa-circle-info"></i>',
};

const fileSharingInput = "*"; // allow all file extensions
const Base64Prefix = "data:application/pdf;base64,";
const wbPdfInput = "application/pdf";
const wbImageInput = "image/*";

const wbReferenceWidth = 1920;
const wbReferenceHeight = 1080;

// Peer infos
const extraInfo = getId("extraInfo");
const isWebRTCSupported = checkWebRTCSupported();
const userAgent = navigator.userAgent;
const parser = new UAParser(userAgent);
const parserResult = parser.getResult();
// UAParser leaves device.type undefined for a lot of real phones/webviews
// it doesn't recognize - blindly falling back to "desktop" then silently
// disabled every isMobileDevice-gated feature (auto-hide controls, the
// floating self-view thumbnail, etc.) on those phones. When UAParser
// can't tell, fall back to a touch-primary heuristic instead of assuming
// desktop; leave an explicit UAParser result (mobile/tablet/desktop) untouched.
const isTouchPrimaryDevice =
  typeof matchMedia === "function" &&
  matchMedia("(hover: none) and (pointer: coarse)").matches;
const deviceType =
  parserResult.device.type || (isTouchPrimaryDevice ? "mobile" : "desktop");
const isMobileDevice = deviceType === "mobile";
const isMobileSafari =
  isMobileDevice && parserResult.browser.name.toLowerCase().includes("safari");
const isTabletDevice = deviceType === "tablet";
const isIPadDevice = parserResult.device.model?.toLowerCase() === "ipad";
const isDesktopDevice = deviceType === "desktop";
const osName = parserResult.os.name;
const osVersion = parserResult.os.version;
const browserName = parserResult.browser.name;
const browserVersion = parserResult.browser.version;
const isFirefox = browserName.toLowerCase().includes("firefox");
const peerInfo = getPeerInfo();
const thisInfo = getInfo();

// Local Storage class
const lS = new LocalStorage();
const localStorageSettings = lS.getObjectLocalStorage("P2P_SETTINGS");
const lsSettings = { ...lS.P2P_SETTINGS, ...(localStorageSettings || {}) };
// One-time migration: browsers that already persisted a full settings
// object (from before the default flipped to "contain") would otherwise
// keep re-loading the old "cover" (crop/zoom) value forever, since a saved
// value always wins over a new code default. Force it to "contain" once,
// then get out of the way so a deliberate later choice from the Settings
// dropdown still sticks.
if (
  localStorageSettings &&
  !localStorageSettings._videoObjFitMigrated &&
  localStorageSettings.video_obj_fit !== 1
) {
  lsSettings.video_obj_fit = 1; // contain
}
lsSettings._videoObjFitMigrated = true;
console.log("LOCAL_STORAGE_SETTINGS", lsSettings);

// Check if embedded inside an iFrame
const isEmbedded = window.self !== window.top;

// Check if PIP is supported by this browser
const showVideoPipBtn = document.pictureInPictureEnabled;

// Check if Document PIP is supported by this browser
const showDocumentPipBtn = "documentPictureInPicture" in window;

// Loading div
const loadingBackdrop = getId("loadingBackdrop");

// Video/Audio media container
const videoMediaContainer = getId("videoMediaContainer");
const videoPinMediaContainer = getId("videoPinMediaContainer");
const audioMediaContainer = getId("audioMediaContainer");

// Share Room QR popup
const qrRoomPopupContainer = getId("qrRoomPopupContainer");

// Init audio-video
const initUser = getId("initUser");
const initVideoContainer = getQs(".init-video-container");
const initVideo = getId("initVideo");
const initVideoBtn = getId("initVideoBtn");
const initAudioBtn = getId("initAudioBtn");
const initScreenShareBtn = getId("initScreenShareBtn");
const initVideoMirrorBtn = getId("initVideoMirrorBtn");
const initUsernameEmojiButton = getId("initUsernameEmojiButton");
const initExitBtn = getId("initExitBtn");
const initVideoSelect = getId("initVideoSelect");
const initMicrophoneSelect = getId("initMicrophoneSelect");
const initSpeakerSelect = getId("initSpeakerSelect");
const usernameEmoji = getId("usernameEmoji");

// Buttons bar
const shareRoomBtn = getId("shareRoomBtn");
const recordStreamBtn = getId("recordStreamBtn");
const fullScreenBtn = getId("fullScreenBtn");
const fullScreenCornerBtn = getId("fullScreenCornerBtn");
const chatRoomBtn = getId("chatRoomBtn");

const documentPiPBtn = getId("documentPiPBtn");

// Buttons bottom
const bottomButtons = getId("bottomButtons");
const audioBtn = getId("audioBtn");
const videoBtn = getId("videoBtn");
const videoDropdown = getId("videoDropdown");
const audioDropdown = getId("audioDropdown");
const videoToggle = getId("videoToggle");
const audioToggle = getId("audioToggle");
const videoMenu = getId("videoMenu");
const audioMenu = getId("audioMenu");
const swapCameraBtn = getId("swapCameraBtn");
const hideMeBtn = getId("hideMeBtn");
const screenShareBtn = getId("screenShareBtn");
const myHandBtn = getId("myHandBtn");
const mySettingsBtn = getId("mySettingsBtn");
const settingsSplit = getId("settingsSplit");
const settingsExtraDropdown = getId("settingsExtraDropdown");
const settingsExtraToggle = getId("settingsExtraToggle");
const settingsExtraMenu = getId("settingsExtraMenu");
const leaveRoomBtn = getId("leaveRoomBtn");

const exitDropdown = getId("exitDropdown");
const exitMenu = getId("exitMenu");
const exitLeaveBtn = getId("exitLeaveBtn");

// Room Emoji Picker
const closeEmojiPickerContainer = getId("closeEmojiPickerContainer");
const emojiPickerContainer = getId("emojiPickerContainer");
const userEmoji = getId(`userEmoji`);

// Chat room
const msgerDraggable = getId("msgerDraggable");
const msgerClose = getId("msgerClose");
const msgerHeader = getId("msgerHeader");

const msgerCPBtn = getId("msgerCPBtn") || document.createElement("button");

const msgerSidebarDropDownMenuBtn =
  getId("msgerSidebarDropDownMenuBtn") || document.createElement("button");
const msgerSidebarDropDownContent =
  getId("msgerSidebarDropDownContent") || document.createElement("ul");

const msgerChat = getId("msgerChat");
const msgerEmptyParticipantsNotice = getId("msgerEmptyParticipantsNotice");
const msgerMain = document.querySelector(".msger-main");
const msgerVideoUrlBtn = getId("msgerVideoUrlBtn");

const msgerScrollBottomBtn = getId("msgerScrollBottomBtn");
let isAutoScrollingMsger = false;

/**
 * Show/hide the floating "jump to bottom" arrow based on scroll position -
 * mirrors ChatPanel.tsx's checkScrollState().
 */
function updateMsgerScrollBtn() {
  if (!msgerChat) return;
  const { scrollTop, scrollHeight, clientHeight } = msgerChat;
  const isScrollable = scrollHeight > clientHeight + 10;
  if (!isScrollable) {
    if (msgerScrollBottomBtn) msgerScrollBottomBtn.classList.add("hidden");
    return;
  }
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  if (msgerScrollBottomBtn) {
    msgerScrollBottomBtn.classList.toggle("hidden", distanceFromBottom <= 60);
  }
}

if (msgerChat) {
  msgerChat.addEventListener("scroll", () => {
    if (isAutoScrollingMsger) return;
    updateMsgerScrollBtn();
  });
}

if (msgerScrollBottomBtn) {
  msgerScrollBottomBtn.addEventListener("click", () => {
    isAutoScrollingMsger = true;
    msgerChat.scrollTo({
      top: msgerChat.scrollHeight,
      behavior: "smooth",
    });
    msgerScrollBottomBtn.classList.add("hidden");
    setTimeout(() => {
      isAutoScrollingMsger = false;
    }, 350);
  });
}

function scrollToBottomInstant() {
  if (!msgerChat) return;
  isAutoScrollingMsger = true;
  if (msgerScrollBottomBtn) msgerScrollBottomBtn.classList.add("hidden");
  msgerChat.scrollTop = msgerChat.scrollHeight;
  setTimeout(() => {
    isAutoScrollingMsger = false;
  }, 50);
}

const msgerInput = getId("msgerInput");

const msgerSendBtn = getId("msgerSendBtn");

const roomEmojiBurstState = {
  startedAt: 0,
  anchorX: 0,
  anchorY: 0,
  count: 0,
};

// Chat room connected peers
const msgerCP = getId("msgerCP") || document.createElement("div");
const msgerCPChat = getId("msgerCPChat") || document.createElement("div");
const msgerCPHeader = getId("msgerCPHeader") || document.createElement("div");
const msgerCPCloseBtn =
  getId("msgerCPCloseBtn") || document.createElement("button");
const msgerCPList = getId("msgerCPList") || document.createElement("div");
const searchPeerBarName =
  getId("searchPeerBarName") || document.createElement("input");
const msgerCPDropDownMenuBtn =
  getId("msgerCPDropDownMenuBtn") || document.createElement("button");
const msgerCPDropDownContent =
  getId("msgerCPDropDownContent") || document.createElement("div");

// My settings
const mySettingsBackdrop = getId("mySettingsBackdrop");
const mySettings = getId("mySettings");
const mySettingsHeader = getId("mySettingsHeader");
const mySessionTime = getId("mySessionTime"); // conference session time (no longer shown in settings UI, kept for internal timer bookkeeping)
const tabDevicesBtn = getId("tabDevicesBtn");
const tabProfileBtn = getId("tabProfileBtn");

const tabNetworkBtn = getId("tabNetworkBtn");
const networkIP = getId("networkIP");
const networkHost = getId("networkHost");
const networkStun = getId("networkStun");
const networkTurn = getId("networkTurn");
const tabRoomBtn = getId("tabRoomBtn");
const mySettingsCloseBtn = getId("mySettingsCloseBtn");
const myPeerNameSet = getId("myPeerNameSet");
const myPeerNameSetBtn = getId("myPeerNameSetBtn");
const myProfileAvatarUploadBtn = getId("myProfileAvatarUploadBtn");
const switchSounds = getId("switchSounds");
const switchShare = getId("switchShare");
const switchKeepButtonsVisible = getId("switchKeepButtonsVisible");
const pinChatByDefaultRow = getId("pinChatByDefaultRow");
const switchPinChatByDefault = getId("switchPinChatByDefault");
const keepAwakeButton = getId("keepAwakeButton");
const switchKeepAwake = getId("switchKeepAwake");

const switchPushToTalk = getId("switchPushToTalk");

const audioInputSelect = getId("audioSource");
const audioOutputSelect = getId("audioOutput");
const audioOutputDiv = getId("audioOutputDiv");
const videoSelect = getId("videoSource");
const videoQualitySelect = getId("videoQuality");
const videoFpsSelect = getId("videoFps");
const videoFpsDiv = getId("videoFpsDiv");
const screenFpsSelect = getId("screenFps");
const pushToTalkDiv = getId("pushToTalkDiv");
const recImage = getId("recImage");
const pauseRecBtn = getId("pauseRecBtn");
const resumeRecBtn = getId("resumeRecBtn");
const recordingTime = getId("recordingTime");
const lastRecordingInfo = getId("lastRecordingInfo");
const videoObjFitSelect = getId("videoObjFitSelect");
const pinUnpinGridDiv = getId("pinUnpinGridDiv");
const tabRoomPeerName = getId("tabRoomPeerName");
const tabRoomParticipants = getId("tabRoomParticipants");
const tabRoomSecurity = getId("tabRoomSecurity");

const noiseSuppressionBtn = getId("noiseSuppressionBtn");
const isPeerPresenter = getId("isPeerPresenter");
const peersCount = getId("peersCount");
const screenFpsDiv = getId("screenFpsDiv");

// Audio options
const micOptionsDiv = getId("micOptionsDiv");
const switchNoiseSuppression = getId("switchNoiseSuppression");
const labelNoiseSuppression = getId("labelNoiseSuppression");

// Tab Media
const shareMediaAudioVideoBtn = getId("shareMediaAudioVideoBtn");

const wbDrawingColorEl = getId("wbDrawingColorEl");
const wbBackgroundColorEl = getId("wbBackgroundColorEl");

// Room actions buttons

const lockRoomBtn = getId("lockRoomBtn");
const unlockRoomBtn = getId("unlockRoomBtn");
const roomLockStatusIcon = getId("roomLockStatusIcon");

// Video/audio url player
const videoUrlCont = getId("videoUrlCont");
const videoAudioUrlCont = getId("videoAudioUrlCont");
const videoUrlHeader = getId("videoUrlHeader");
const videoAudioUrlHeader = getId("videoAudioUrlHeader");
const videoUrlCloseBtn = getId("videoUrlCloseBtn");
const videoAudioCloseBtn = getId("videoAudioCloseBtn");
const videoUrlIframe = getId("videoUrlIframe");
const videoAudioUrlElement = getId("videoAudioUrlElement");

// Media
const sinkId = "sinkId" in HTMLMediaElement.prototype;

// Disconnect banner
const banner = getId("disconnectBanner");
const icon = getId("disconnectBannerIcon");
const title = getId("disconnectBannerTitle");
const msg = getId("disconnectBannerMsg");
const spinner = getId("disconnectBannerSpinner");
let disconnectBannerRafId = null;

//....

const isRulesActive = true; // Presenter can do anything, guest is slightly moderate, if false no Rules for the room.
const forceCamMaxResolutionAndFps = false; // This force the webCam to max resolution as default, up to 8k and 60fps (very high bandwidth are required) if false, you can set it from settings
const useAvatarSvg = true; // if false the cam-Off avatar = images.avatar

// Room
let thisMaxRoomParticipants = 2;

// misc
let swBg = "rgba(11, 26, 46, 0.85)"; // swAlert background color
let isDocumentOnFullScreen = false;
let isToggleExtraBtnClicked = false;
// DiceBear styles used for the "Đổi ảnh đại diện" dialog's random avatar
// grid - never a style that renders visible text/letters on the image.
// Declared this early (before myPeerAvatar/getPeerAvatar() run below)
// since it's a `const` - referencing it before this line would throw a
// TDZ error.
const DICEBEAR_AVATAR_STYLES = [
  "bottts-neutral",
  "adventurer-neutral",
  "thumbs",
  "identicon",
  "shapes",
];

// The per-join auto-assigned default avatar only ever uses styles #2 and
// #3 above (never #1 "bottts-neutral", the robot head) - a different,
// narrower look from the dialog's fuller variety.
const JOIN_DEFAULT_AVATAR_STYLES = DICEBEAR_AVATAR_STYLES.slice(1, 3);

// peer
let myPeerId; // This socket.id
let myPeerUUID = getUUID(); // Unique peer id
let myPeerName = getPeerName();
let myPeerAvatar = getPeerAvatar();
let myToken = getPeerToken(); // peer JWT
let isPresenter = false; // True Who init the room (aka first peer joined)
let myHandStatus = false;
let myVideoStatus = false;
let myAudioStatus = false;
let myScreenStatus = false;
let isScreenEnabled = getScreenEnabled();
let notify = getNotify(); // popup room sharing on join
let chat = getChat(); // popup chat on join
let notifyBySound = true; // turn on - off sound notifications
let isPeerReconnected = false;
// Remote peer_ids currently flagged as having a weak/lost P2P connection
// (their RTCPeerConnection.connectionState went to "disconnected"/"failed").
// Tracked so we don't spawn duplicate notices and so we know a "reconnected"
// toast is warranted (vs. the state's normal transition on first join).
let weakConnectionPeers = new Set();

// media
let useAudio = true; // User allow for microphone usage
let useVideo = true; // User allow for camera usage
let isEnumerateVideoDevices = false;
let isEnumerateAudioDevices = false;

// video/audio player
let isVideoUrlPlayerOpen = false;
let pinnedVideoPlayerId = null;

// connection
let signalingSocket; // socket.io connection to our webserver
let peerConnections = {}; // keep track of our peer connections, indexed by peer_id == socket.io id
let chatDataChannels = {}; // keep track of our peer chat data channels
let fileDataChannels = {}; // keep track of our peer file sharing data channels
let allPeers = {}; // keep track of all peers in the room, indexed by peer_id == socket.io id
let pendingIceCandidates = {}; // keep track of pending ICE candidates before the peer connection is ready, indexed by peer_id == socket.io id

let lastStats = null;

// stream
let isRNNoiseSupported = true; // Built in noise supression
let initStream; // initial webcam stream
let localVideoMediaStream; // my webcam
let localScreenMediaStream; // my screen share
let localScreenDisplayStream; // raw getDisplayMedia stream (may include audio)
let screenShareAudioContext; // AudioContext used to mix screen audio + microphone
let localAudioMediaStream; // my microphone
let noiseProcessor = null; // RNNoise audio processing
let peerScreenMediaElements = {}; // keep track of our peer <video> tags, indexed by peer_id_screen
let peerVideoMediaElements = {}; // keep track of our peer <video> tags, indexed by peer_id_video
let peerAudioMediaElements = {}; // keep track of our peer <audio> tags, indexed by peer_id_audio

// main and bottom buttons
let placement = "right"; // https://atomiks.github.io/tippyjs/#placements
let bottomButtonsPlacement = "right";
let isButtonsVisible = false;
let isButtonsBarOver = false;

// video
let myVideo;
let myScreen;
let myAudio;
let myVideoWrap;
let myVideoAvatarImage;
let myVideoPinBtn;
let myScreenPinBtn;
let myVolumeTimer = null;
const peerVolumeTimers = {};
let myVideoPeerName;
let myScreenPeerName;
let myHandStatusIcon;
let myVideoStatusIcon;
let myAudioStatusIcon;
let isVideoPinned = false;
let isVideoFullScreenSupported = true;
let isVideoOnFullScreen = false;
let isScreenSharingSupported = false;
let isScreenStreaming = false;
let isHideMeActive = getHideMeActive();
let remoteMediaControls = false; // enable - disable peers video player controls (default false)
let camera = "user"; // user = front-facing camera on a smartphone. | environment = the back camera on a smartphone.

// chat
let leftChatAvatar;
let rightChatAvatar;
let chatMessagesId = 0;
let showChatOnMessage = true;
let transcriptShowOnMsg = true;
let transcriptSendToAll = true;
let isChatPinned = false;
let isCaptionPinned = false;
let isChatRoomVisible = false;
let chatUnreadCount = 0;
let isParticipantsVisible = false;
let isChatOpenedByParticipantsBtn = false;
let isOpeningParticipants = false;
let isChatPasteTxt = false;
let pinChatByDefault = false;
let chatMessages = []; // collect chat messages to save it later if want

let activeConversation = {
  type: "public",
  peerName: "",
  peerId: "",
};

let activeMsgerParticipantDropdown = null;

// settings
let videoMaxFrameRate = 30;
let screenMaxFrameRate = 30;
let videoQualitySelectedIndex = 0; // default HD and 30fps
let videoFpsSelectedIndex = 1; // 30 fps
let screenFpsSelectedIndex = 1; // 30 fps
let isMySettingsVisible = false;
let thisRoomPassword = null;
let isRoomLocked = false;
let isKeepButtonsVisible = false;

let isPushToTalkActive = false;
let isSpaceDown = false;
let themeCardDebounce = null;

// recording
let mediaRecorder;
let recordedBlobs;
let audioRecorder; // helpers.js
let recScreenStream; // screen media to recording
let recTimer;
let recCodecs;
let recElapsedTime;
let recStartTs = null;
let isStreamRecording = false;
let isStreamRecordingPaused = false;
let isRecScreenStream = false;

let wbCanvas = null;
let wbIsLock = false;
let wbIsDrawing = false;
let wbIsOpen = false;
let wbIsRedoing = false;
let wbIsObject = false;
let wbIsEraser = false;
let wbIsPencil = false;
let wbIsVanishing = false;
let wbIsBgTransparent = false;
let wbPop = [];
let wbVanishingObjects = [];
let wbGridLines = [];
let wbGridSize = 20;
let wbStroke = "#cccccc63";
let wbGridVisible = false;

// file transfer
let fileToSend;
let fileReader;
let receiveBuffer = [];
let receivedSize = 0;
let incomingFileInfo;
let incomingFileData;
let sendInProgress = false;
let receiveInProgress = false;
/**
 * MTU 1kb/s to prevent drop.
 * Note: FireFox seems not supports chunkSize > 1024?
 */
const chunkSize = 1024; // 1024 * 16; // 16kb/s

// server
let isHostProtected = false; // Username and Password required to initialize room
let isPeerAuthEnabled = false; // Username and Password required in the URL params to join room

// survey
let surveyActive = true; // when leaving the room give a feedback, if false will be redirected to newcall page
let surveyURL = "https://www.questionpro.com/t/AUs7VZq00L";

// Redirect on leave room
let redirectActive = false;
let redirectURL = "/";

let needToCreateOfferByPeer = {};

/**
 * Load all Html elements by Id
 */
function getHtmlElementsById() {
  // My video elements
  myVideo = getId("myVideo");
  myScreen = getId("myScreen");
  myAudio = getId("myAudio");
  myVideoWrap = getId("myVideoWrap");
  myVideoAvatarImage = getId("myVideoAvatarImage");
  myVideoPinBtn = getId("myVideoPinBtn");
  myScreenPinBtn = getId("myScreenPinBtn");
  // My username, hand/video/audio status
  myVideoPeerName = getId("myVideoPeerName");
  myScreenPeerName = getId("myScreenPeerName");
  myHandStatusIcon = getId("myHandStatusIcon");
  myVideoStatusIcon = getId("myVideoStatusIcon");
  myAudioStatusIcon = getId("myAudioStatusIcon");
}

/**
 * Using tippy aka very nice tooltip!
 * https://atomiks.github.io/tippyjs/
 */
function setButtonsToolTip() {
  // Not need for mobile
  if (isMobileDevice) return;
  // Init buttons
  setTippy(initScreenShareBtn, "Bật tắt chia sẻ màn hình", "top");
  setTippy(initVideoMirrorBtn, "Lật ngược video", "top");
  setTippy(initUsernameEmojiButton, "Bật tắt emoji tên", "top");
  setTippy(initExitBtn, "Rời cuộc họp", "top");

  // Main buttons
  refreshMainButtonsToolTipPlacement();
  // Chat room buttons
  setTippy(msgerClose, "Đóng", "bottom");

  setTippy(msgerCPBtn, "Người tham gia", "bottom");
  setTippy(msgerSendBtn, "Gửi", "top");
  // Chat participants buttons
  setTippy(msgerCPCloseBtn, "Đóng", "bottom");
  // Caption buttons
  // Settings
  setTippy(mySettingsCloseBtn, "Đóng", "bottom");
  setTippy(myPeerNameSetBtn, "Đổi tên", "top");
  setTippy(myRoomId, "Tên phòng", "right");
  setTippy(mySessionTime, "Thời gian phiên", "right");
  setTippy(
    switchNoiseSuppression,
    "Nếu bật, âm thanh sẽ được xử lý để giảm tiếng ồn nền, giúp giọng nói rõ hơn",
    "right",
  );
  setTippy(switchSounds, "Bật tắt âm báo phòng", "right");
  setTippy(switchShare, "Hiện popup 'Chia sẻ phòng' khi vào phòng.", "right");
  setTippy(switchKeepButtonsVisible, "Luôn hiện nút điều khiển", "right");
  setTippy(switchPinChatByDefault, "Mặc định ghim khung chat khi mở", "right");
  setTippy(
    switchKeepAwake,
    "Ngăn thiết bị tự khóa màn hình (nếu được hỗ trợ)",
    "right",
  );
  setTippy(recImage, "Bật tắt ghi hình", "right");
  setTippy(networkIP, "Địa chỉ IP liên kết với ICE candidate", "right");
  setTippy(videoUrlCloseBtn, "Đóng trình phát video", "bottom");
  setTippy(videoAudioCloseBtn, "Đóng trình phát video", "bottom");
  setTippy(
    msgerVideoUrlBtn,
    "Chia sẻ video hoặc audio tới tất cả người tham gia",
    "top",
  );
}

/**
 * Refresh main buttons tooltips based of they position (vertical/horizontal)
 * @returns void
 */
function refreshMainButtonsToolTipPlacement() {
  // not need for mobile
  if (isMobileDevice) return;

  // ButtonsBar
  placement = true ? "right" : "top";

  // BottomButtons
  bottomButtonsPlacement = true ? "top" : "right";

  setTippy(
    audioBtn,
    useAudio ? "Tắt âm thanh (A)" : "Âm thanh của tôi đang tắt",
    bottomButtonsPlacement,
  );
  setTippy(
    videoBtn,
    useVideo ? "Tắt video (V)" : "Video của tôi đang tắt",
    bottomButtonsPlacement,
  );
  setTippy(screenShareBtn, "Bắt đầu chia sẻ màn hình (S)", bottomButtonsPlacement);
  setTippy(myHandBtn, "Giơ tay (H)", bottomButtonsPlacement);
  setTippy(chatRoomBtn, "Mở khung chat (C)", bottomButtonsPlacement);

  setTippy(mySettingsBtn, "Mở cài đặt (O)", bottomButtonsPlacement);
  setTippy(leaveRoomBtn, "Rời khỏi phòng này", bottomButtonsPlacement);
}

/**
 * Set nice tooltip to element
 * @param {object} element element
 * @param {string} content message to popup
 * @param {string} placement position
 */
function setTippy(element, content, placement) {
  // Tooltips disabled app-wide per user request, EXCEPT for a small
  // curated set of elements (main control bar, the two fullscreen
  // buttons, the chat share-video button) wired independently in
  // client.html's inline script. Kept as a true no-op stub here (rather
  // than deleting every one of the ~100+ call sites across the codebase)
  // - it must NOT destroy an existing tippy instance, since this runs
  // for every button on every (re)connect and would otherwise race with
  // and kill the tooltips set up by that separate code path.
}

/**
 * Get peer info using D
 * @returns {object} peer info
 */
function getPeerInfo() {
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

/**
 * Get Extra info
 * @returns object info
 */
function getInfo() {
  try {
    console.log("Info", parserResult);

    // Filter out properties with 'Unknown' values
    const filterUnknown = (obj) => {
      const filtered = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value && value !== "Unknown") {
          filtered[key] = value;
        }
      }
      return filtered;
    };

    const filteredResult = {
      //ua: parserResult.ua,
      browser: filterUnknown(parserResult.browser),
      cpu: filterUnknown(parserResult.cpu),
      device: filterUnknown(parserResult.device),
      engine: filterUnknown(parserResult.engine),
      os: filterUnknown(parserResult.os),
    };

    const sectionMeta = {
      browser: { iconMarkup: icons.infoBrowser, label: "Browser" },
      cpu: { iconMarkup: icons.infoCpu, label: "CPU info" },
      device: { iconMarkup: icons.infoDevice, label: "Device" },
      engine: { iconMarkup: icons.infoEngine, label: "Engine" },
      os: { iconMarkup: icons.infoOs, label: "OS info" },
    };

    const rows = Object.entries(filteredResult)
      .filter(([, data]) => Object.keys(data).length > 0)
      .map(([section, data]) => {
        const { iconMarkup, label } = sectionMeta[section] || {
          iconMarkup: icons.infoDefault,
          label: section,
        };
        const badges = Object.entries(data)
          .filter(([key]) => key !== "major")
          .map(([, val]) => `<span class="extra-info-badge">${val}</span>`)
          .join("");
        return `
                    <div class="extra-info-row extra-info-row--${section}">
                        <div class="extra-info-label">
                            ${iconMarkup}
                            <span>${label}</span>
                        </div>
                        <div class="extra-info-values">${badges}</div>
                    </div>`;
      })
      .join("");

    extraInfo.innerHTML = renderRoomTemplate("tpl-extra-info-grid", {
      html: {
        rows,
      },
    });

    return parserResult;
  } catch (error) {
    console.error("Error parsing user agent:", error);
  }
}

/**
 * Generate random Room id if not set
 * @returns {string} Room Id
 */
function getRoomId() {
  // check if passed as params /join?room=id
  let queryRoomId = getQueryParam("room");

  // skip /join/
  let roomId = queryRoomId
    ? queryRoomId
    : window.location.pathname.split("/join/")[1];

  // if not specified room id or 'random', create one random
  if (roomId == "" || roomId === "random") {
    roomId = generateRoomCode(10);
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

/**
 * Room Session Duration
 */
function getRoomDuration() {
  const roomDuration = getQueryParam("duration");

  if (isValidDuration(roomDuration)) {
    if (roomDuration === "unlimited") {
      console.log("The room has no time limit");
      return roomDuration;
    }
    const timeLimit = timeToMilliseconds(roomDuration);
    setTimeout(() => {
      playSound("eject");
      exitRoom();
    }, timeLimit);

    console.log("Direct join", {
      duration: roomDuration,
      timeLimit: timeLimit,
    });
    return roomDuration;
  }
  return "unlimited";
}

/**
 * Convert HH:MM:SS to milliseconds
 * @param {string} timeString Time string in HH:MM:SS format
 * @returns {integer} milliseconds
 */
function timeToMilliseconds(timeString) {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/**
 * Validate duration format
 * @param {string} duration Duration string
 * @returns {boolean} true/false
 */
function isValidDuration(duration) {
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

/**
 * Generate a random room code: uppercase letters + digits only (no
 * lowercase), guaranteed to contain at least one letter and one digit.
 * @param {integer} length
 * @returns {string} random room code
 */
function generateRoomCode(length = 10) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const all = letters + digits;
  const pick = (chars) => chars.charAt(Math.floor(Math.random() * chars.length));

  // Guarantee at least one letter and one digit, then fill the rest
  // randomly from the combined set and shuffle so they're not always
  // pinned to the first two positions.
  const chars = [pick(letters), pick(digits)];
  for (let i = chars.length; i < length; i++) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * Generate random Id
 * @param {integer} length
 * @returns {string} random id
 */
function makeId(length) {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * Get UUID4
 * @returns uuid4
 */
function getUUID() {
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

/**
 * Check if notify is set
 * @returns {boolean} true/false (default true)
 */
function getNotify() {
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

/**
 * Check if chat is set
 * @returns {boolean} true/false
 */
function getChat() {
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

/**
 * Get Peer JWT
 * @returns {mixed} boolean false or token string
 */
function getPeerToken() {
  if (window.sessionStorage.peer_token) return window.sessionStorage.peer_token;
  let token = getQueryParam("token");
  let queryToken = false;
  if (token) {
    queryToken = token;
  }
  console.log("Direct join", { token: queryToken });
  return queryToken;
}

/**
 * Check if peer name is set
 * @returns {string} Peer Name
 */
function getPeerName() {
  const name = getQueryParam("name");
  if (isHtml(name)) {
    console.log("Direct join", { name: "Invalid name" });
    return "Tên không hợp lệ";
  }

  if (name === "random") {
    const randomName = generateRandomName();
    console.log("Direct join", { name: randomName });
    return randomName;
  }

  console.log("Direct join", { name: name });
  return name;
}

/**
 * Generate random peer name
 * @returns {string} Random Peer Name
 */
function generateRandomName() {
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

/**
 * Build one random DiceBear avatar URL from a style pool
 * @param {string[]} stylePool which style list to pick from
 * @param {string|null} excludeUrl if set, guarantees the result never
 *   equals this exact URL (retries a few times) - used so the per-join
 *   default avatar is never the same as the previous session's
 * @returns {string} avatar image URL
 */
function pickRandomAvatarUrl(stylePool = DICEBEAR_AVATAR_STYLES, excludeUrl = null) {
  let url;
  let attempts = 0;
  do {
    const seed = Math.random().toString(36).substring(2, 10);
    const style = stylePool[Math.floor(Math.random() * stylePool.length)];
    url = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    attempts++;
  } while (excludeUrl && url === excludeUrl && attempts < 10);
  return url;
}

/**
 * Check if peer avatar is set
 * @returns {string} Peer Avatar
 */
function getPeerAvatar() {
  const avatar = getQueryParam("avatar");
  const avatarDisabled = avatar === "0" || avatar === "false";
  const isBase64Avatar =
    typeof avatar === "string" && avatar.startsWith("data:image/");

  console.log("Direct join", { avatar: avatar });

  if (avatarDisabled || isBase64Avatar || !isValidAvatarURL(avatar)) {
    if (avatarDisabled) return false;
    // Always assign a fresh random default avatar on every join/reload -
    // even an avatar hand-picked via the "Đổi ảnh đại diện" dialog only
    // applies to the current session and is not restored on the next
    // visit. Never the same as the immediately previous session's.
    const saved = lsSettings.peer_avatar;
    const randomAvatar = pickRandomAvatarUrl(
      JOIN_DEFAULT_AVATAR_STYLES,
      saved || null,
    );
    lsSettings.peer_avatar = randomAvatar;
    lsSettings.peer_avatar_auto = true;
    lS.setSettings(lsSettings);
    console.log("Assigned random default avatar", { avatar: randomAvatar });
    return randomAvatar;
  }
  return avatar;
}

/**
 * Is screen enabled on join room
 * @returns {boolean} true/false
 */
function getScreenEnabled() {
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

/**
 * Hide myself from the meeting view
 * @returns {boolean} true/false
 */
function getHideMeActive() {
  let hide = getQueryParam("hide");
  let queryHideMe = false;
  if (hide) {
    hide = hide.toLowerCase();
    queryHideMe = hide === "1" || hide === "true";
  }
  console.log("Direct join", { hide: queryHideMe });
  return queryHideMe;
}

/**
 * Get query parameter from URL
 * @param {string} param parameter name
 * @returns {string} parameter value
 */
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return filterXSS(urlParams.get(param));
}

/**
 * Check if there is peer connections
 * @returns {boolean} true/false
 */
function thereArePeerConnections() {
  if (Object.keys(peerConnections).length === 0) return false;
  return true;
}

/**
 * Count the peer connections
 * @returns peer connections count
 */
function countPeerConnections() {
  return Object.keys(peerConnections).length;
}

/**
 * Get Started...
 */
document.addEventListener("DOMContentLoaded", function () {
  initCursorLightEffect();
  initClientPeer();
  initDocumentListeners();
  initSwipeBackGuard();
});

/**
 * Trap the browser back-navigation entry on mobile so an accidental
 * left-edge swipe (iOS Safari's "go back" gesture, also present on some
 * Android browsers) can't bounce someone out of the meeting back to the
 * loading screen. Paired with the CSS overscroll-behavior-x/touch-action
 * rules on html/body for browsers that honor the gesture at the CSS
 * level instead. Desktop is untouched - this gesture doesn't exist there.
 */
function initSwipeBackGuard() {
  if (!isMobileDevice) return;
  history.pushState(null, "", location.href);
  window.addEventListener("popstate", () => {
    history.pushState(null, "", location.href);
  });
}

/**
 * Document listeners
 */
function initDocumentListeners() {
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar-dropdown")) {
      document
        .querySelectorAll(".navbar-dropdown-content.show")
        .forEach((el) => el.classList.remove("show"));
    }
  });
}

/**
 * Initialize cursor light effect on video container
 */
function initCursorLightEffect() {
  if (!videoMediaContainer || !isDesktopDevice) return;
  videoMediaContainer.classList.add("mouse-light");
  videoMediaContainer.addEventListener("mousemove", function (e) {
    const rect = videoMediaContainer.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    videoMediaContainer.style.setProperty("--mouse-x", x + "%");
    videoMediaContainer.style.setProperty("--mouse-y", y + "%");
  });
}

/**
 * On body load Get started
 */
async function initClientPeer() {
  if (!isWebRTCSupported) {
    console.error("Trình duyệt này có vẻ không hỗ trợ WebRTC!");
    return;
  }

  // Check if video full screen is supported by the browser
  isVideoFullScreenSupported =
    typeof document !== "undefined" &&
    ("fullscreenEnabled" in document ||
      "webkitFullscreenEnabled" in document ||
      "mozFullScreenEnabled" in document ||
      "msFullscreenEnabled" in document);

  console.log("01. Connecting to signaling server");

  // Disable the HTTP long-polling transport
  signalingSocket = io({ transports: ["websocket"] });

  const transport = signalingSocket.io.engine.transport.name; // in most cases, "polling"
  console.log("02. Connection transport", transport);

  // Check upgrade transport
  signalingSocket.io.engine.on("upgrade", () => {
    const upgradedTransport = signalingSocket.io.engine.transport.name; // in most cases, "websocket"
    console.log("Connection upgraded transport", upgradedTransport);
  });

  // async - await requests
  signalingSocket.request = function request(type, data = {}) {
    return new Promise((resolve, reject) => {
      signalingSocket.emit(type, data, (data) => {
        if (data.error) {
          console.error("signalingSocket.request error", data.error);
          reject(data.error);
        } else {
          console.log("signalingSocket.request data", data);
          resolve(data);
        }
      });
    });
  };

  // on receiving data from signaling server...
  signalingSocket.on("connect", handleConnect);
  signalingSocket.on("unauthorized", handleUnauthorized);
  signalingSocket.on("roomIsLocked", handleUnlockTheRoom);
  signalingSocket.on("roomAction", handleRoomAction);
  signalingSocket.on("addPeer", handleAddPeer);
  signalingSocket.on("serverInfo", handleServerInfo);
  signalingSocket.on("sessionDescription", handleSessionDescription);
  signalingSocket.on("iceCandidate", handleIceCandidate);
  signalingSocket.on("peerName", handlePeerName);
  signalingSocket.on("peerStatus", handlePeerStatus);
  signalingSocket.on("peerAction", handlePeerAction);
  signalingSocket.on("cmd", handleCmd);
  signalingSocket.on("message", handleMessage);
  signalingSocket.on("videoPlayer", handleVideoPlayer);
  signalingSocket.on("kickOut", handleKickedOut);
  signalingSocket.on("duplicateSession", handleDuplicateSession);
  signalingSocket.on("disconnect", handleDisconnect);
  signalingSocket.on("removePeer", handleRemovePeer);
} // end [initClientPeer]

/**
 * Send async data to signaling server (server.js)
 * @param {string} msg msg to send to signaling server
 * @param {object} config data to send to signaling server
 */
async function sendToServer(msg, config = {}) {
  await signalingSocket.emit(msg, config);
}

/**
 * Send async data through RTC Data Channels
 * @param {object} config data
 */
async function sendToDataChannel(config) {
  if (
    thereArePeerConnections() &&
    typeof config === "object" &&
    config !== null
  ) {
    for (let peer_id in chatDataChannels) {
      if (chatDataChannels[peer_id].readyState === "open")
        await chatDataChannels[peer_id].send(JSON.stringify(config));
    }
  }
}

/**
 * Connected to Signaling Server. Once the user has given us access to their
 * microphone/cam, join the channel and start peering up
 */
async function handleConnect() {
  console.log("03. Connected to signaling server");

  hideDisconnectBanner();
  myPeerId = signalingSocket.id;
  console.log("04. My peer id [ " + myPeerId + " ]");

  await getButtons();

  // If reconnecting, force rejoin to properly sync with other peers
  if (localVideoMediaStream && localAudioMediaStream) {
    await joinToChannel();
  } else {
    await initEnumerateDevices();
    // setupLocalVideoMedia()/setupLocalAudioMedia() throw (after already
    // showing the "Truy cập bị từ chối" popup via handleMediaError) when
    // permission is denied - catch each independently so a denial on one
    // device doesn't abort the rest of setup below (button wiring etc.),
    // which is what let the mic/cam toggle buttons end up with no click
    // listener at all when permission was denied.
    try {
      await setupLocalVideoMedia();
    } catch (err) {
      console.error("[handleConnect] setupLocalVideoMedia failed", err);
    }
    try {
      await setupLocalAudioMedia();
    } catch (err) {
      console.error("[handleConnect] setupLocalAudioMedia failed", err);
    }
    // Create camera tile (even if no camera, to show avatar)
    if (!useVideo || (!useVideo && !useAudio)) {
      await loadLocalMedia(new MediaStream(), "video");
    }
    getHtmlElementsById();
    setButtonsToolTip();
    manageButtons();
    handleButtonsRule();
    setupMySettings();
    loadSettingsFromLocalStorage();
    setupVideoUrlPlayer();
    handleDropdownHover();
    setupQuickDeviceSwitchDropdowns();
    startSessionTime();
    await whoAreYou();
    initTopHeaderBar();
  }
}

/**
 * Handle some signaling server info
 * @param {object} config data
 */
function handleServerInfo(config) {
  console.log("13. Server info", config);

  const {
    peers_count,
    host_protected,
    user_auth,
    is_presenter,
    survey,
    redirect,
    maxRoomParticipants,
  } = config;

  isHostProtected = host_protected;
  isPeerAuthEnabled = user_auth;

  // Get survey settings from server
  surveyActive = survey.active;
  surveyURL = survey.url;

  // Get redirect settings from server
  redirectActive = redirect.active;
  redirectURL = redirect.url;

  // Limit room to n peers
  if (maxRoomParticipants) thisMaxRoomParticipants = maxRoomParticipants;
  if (peers_count > thisMaxRoomParticipants) {
    return roomIsBusy();
  }

  // Let start with some basic rules
  isPresenter = is_presenter;
  console.log("New connection - presenter status from server:", isPresenter);
  isPeerPresenter.innerText = isPresenter;

  if (isRulesActive) {
    handleRules(isPresenter);
  }

  if (notify && peers_count == 1) {
    shareRoomMeetingURL(true);
  } else {
    checkShareScreen();
  }

  checkChatOnJoin();
}

/**
 * HOST_USER_AUTH enabled and peer not match valid username and password
 */
function handleUnauthorized() {
  playSound("alert");
  Swal.fire({
    allowOutsideClick: false,
    allowEscapeKey: false,
    background: swBg,
    imageUrl: images.forbidden,
    title: "Rất tiếc, không có quyền truy cập",
    text: "Chủ phòng đã bật xác thực người dùng",
    confirmButtonText: `Đăng nhập`,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then(() => {
    // Login required to join room
    openURL(`/login/?room=${roomId}`);
  });
}

/**
 * Room is busy, disconnect me and alert the user that
 * will be redirected to home page
 */
function roomIsBusy() {
  signalingSocket.disconnect();
  playSound("alert");
  Swal.fire({
    allowOutsideClick: false,
    allowEscapeKey: false,
    background: swBg,
    imageUrl: images.forbidden,
    position: "center",
    title: "Phòng đang đầy",
    html: renderRoomTemplate("tpl-room-busy-message", {
      text: {
        maxUsers: String(thisMaxRoomParticipants),
      },
    }),
    showDenyButton: false,
    confirmButtonText: `Đồng ý`,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then((result) => {
    if (result.isConfirmed) {
      openURL("/");
    }
  });
}

/**
 * Presenter can do anything, for others you can limit
 * some functions by hidden the buttons etc.
 *
 * @param {boolean} isPresenter true/false
 */
function handleRules(isPresenter) {
  console.log(
    "14. Peer isPresenter: " +
      isPresenter +
      " Reconnected to signaling server: " +
      isPeerReconnected,
  );
  if (!isPresenter) {
    buttons.settings.showTabRoomParticipants = false;
    buttons.settings.showTabRoomSecurity = false;
    buttons.settings.showTabEmailInvitation = false;
    buttons.remote.showKickOutBtn = false;

    //...
  } else {
    buttons.settings.showMicOptionsBtn = true;
    buttons.settings.showTabRoomParticipants = true;
    buttons.settings.showTabRoomSecurity = true;
    buttons.settings.showTabEmailInvitation = true;
    buttons.settings.showLockRoomBtn = !isRoomLocked;
    buttons.settings.showUnlockRoomBtn = isRoomLocked;
    buttons.remote.audioBtnClickAllowed = true;
    buttons.remote.videoBtnClickAllowed = true;
    buttons.remote.showKickOutBtn = true;
  }

  handleButtonsRule();
}

/**
 * Hide not desired buttons
 */
function handleButtonsRule() {
  const showExtraBtn =
    buttons.main.showExtraBtn &&
    Array.from(settingsExtraMenu.children).filter(
      (el) => el.style.display !== "none",
    ).length > 0;
  if (!showExtraBtn) {
    mySettingsBtn.style.borderRadius = "10px";
  }

  // Main buttons
  displayElements([
    { element: shareRoomBtn, display: buttons.main.showShareRoomBtn },
    { element: hideMeBtn, display: buttons.main.showHideMeBtn },
    { element: fullScreenBtn, display: buttons.main.showFullScreenBtn },
    { element: settingsExtraDropdown, display: showExtraBtn },
    { element: audioBtn, display: buttons.main.showAudioBtn },
    { element: videoBtn, display: buttons.main.showVideoBtn },
    //{ element: screenShareBtn, display: buttons.main.showScreenBtn }, // auto-detected
    { element: recordStreamBtn, display: buttons.main.showRecordStreamBtn },
    { element: recImage, display: buttons.main.showRecordStreamBtn },
    { element: chatRoomBtn, display: buttons.main.showChatRoomBtn },

    {},
    { element: myHandBtn, display: buttons.main.showMyHandBtn },
    {
      element: documentPiPBtn,
      display: showDocumentPipBtn && buttons.main.showDocumentPipBtn,
    },
    { element: mySettingsBtn, display: buttons.main.showMySettingsBtn },
  ]);

  // Chat buttons
  displayElements([
    { element: msgerVideoUrlBtn, display: buttons.chat.showShareVideoAudioBtn },
  ]);

  // Caption buttons
  displayElements([]);

  // Hide settings device rows when corresponding main buttons are disabled
  if (!buttons.main.showVideoBtn) {
    displayElements([
      { element: videoDropdown, display: false },
      { element: getId("videoSourceDiv"), display: false },
      { element: getId("videoFitDiv"), display: false },
      { element: videoFpsDiv, display: false },
    ]);
  }
  if (!buttons.main.showAudioBtn) {
    displayElements([
      { element: getId("audioSourceDiv"), display: false },
      { element: audioOutputDiv, display: false },
      { element: audioDropdown, display: false },
    ]);
  }

  // Settings buttons
  displayElements([
    {
      element: micOptionsDiv,
      display: buttons.settings.showMicOptionsBtn || isPresenter,
    },

    { element: lockRoomBtn, display: buttons.settings.showLockRoomBtn },
    { element: unlockRoomBtn, display: buttons.settings.showUnlockRoomBtn },
    { element: tabRoomPeerName, display: buttons.settings.showTabRoomPeerName },
    {
      element: tabRoomParticipants,
      display: buttons.settings.showTabRoomParticipants,
    },
    {
      element: tabRoomSecurity,
      display: buttons.settings.showTabRoomSecurity,
      mode: "table-row",
    },
    {
      element: noiseSuppressionBtn,
      display: buttons.settings.customNoiseSuppression && isRNNoiseSupported,
      mode: "table-row",
    },
  ]);

  updateRoomLockStatusIcon();
}

/**
 * Get Buttons config from server side and apply to current client
 */
async function getButtons() {
  try {
    const response = await axios.get("/buttons", {
      timeout: 5000,
    });
    const serverButtons = response.data.message;
    if (serverButtons) {
      // Merge serverButtons into BUTTONS, keeping nested keys intact by performing a deep merge
      buttons = mergeConfig(buttons || {}, serverButtons);
      console.log("AXIOS ROOM BUTTONS SETTINGS", {
        serverButtons: serverButtons,
        clientButtons: buttons,
      });
    }
  } catch (error) {
    console.error("AXIOS GET CONFIG ERROR", error.message);
  }
}
/**
 * Deep merge two objects
 * @param {object} target target object
 * @param {object} source source object
 * @returns {object} merged object
 */
function mergeConfig(target, source) {
  if (typeof target !== "object" || target === null) return source;
  if (typeof source !== "object" || source === null) return source;
  const output = Array.isArray(target) ? target.slice() : { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = output[key];
    if (srcVal && typeof srcVal === "object" && !Array.isArray(srcVal)) {
      output[key] = mergeConfig(tgtVal || {}, srcVal);
    } else {
      output[key] = srcVal;
    }
  }
  return output;
}

/**
 * Get user name from OIDC profile
 * @returns {string} Peer Name
 */
async function getUserName() {
  try {
    const { data: profile } = await axios.get("/profile", { timeout: 5000 });
    if (profile && profile.name) {
      console.log("AXIOS GET OIDC Profile retrieved successfully", profile);
      window.localStorage.peer_name = profile.name;
    }
  } catch (error) {
    console.error("AXIOS OIDC Error fetching profile", error.message || error);
  }
  return window.localStorage.peer_name || "";
}

/**
 * set your name for the conference
 */
async function whoAreYou() {
  console.log("11. Who are you?");

  document.body.style.background = "var(--body-bg)";

  if (myPeerName) {
    myPeerName = filterXSS(myPeerName);

    console.log(`11.1 Check if ${myPeerName} exist in the room`, roomId);

    if (await checkUserName()) {
      if (!myToken) return userNameAlreadyInRoom(); // #209 Hack...
    }

    checkPeerAudioVideo();
    // Wait for the join itself to finish before revealing the room -
    // hiding the loading backdrop first (as this used to) exposed the
    // raw, still-empty room UI for however long that took.
    await whoAreYouJoin();
    fadeOutLoadingBackdrop();
    playSound("addPeer");
    return;
  }

  playSound("newMessage");

  // init buttons click events

  initVideoBtn.onclick = async (e) => {
    await handleVideo(e, true);
  };
  initAudioBtn.onclick = (e) => {
    handleAudio(e, true);
  };
  initVideoMirrorBtn.onclick = (e) => {
    toggleInitVideoMirror();
  };

  initExitBtn.onclick = (e) => {
    initExitMeeting();
  };

  await loadLocalStorage();

  // detect low quality bluetooth headset
  detectBluetoothHeadset(true);

  if (!useVideo || !buttons.main.showVideoBtn) {
    displayElements([
      { element: getId("initVideo"), display: false },
      { element: getId("initVideoBtn"), display: false },
      { element: getId("initVideoMirrorBtn"), display: false },
      { element: getId("initVideoSelect"), display: false },
    ]);
    // Disable camera settings, keep screen available
    displayElements([
      { element: getId("videoDropdown"), display: false },
      { element: getId("videoSourceDiv"), display: false },
      { element: getId("videoFitDiv"), display: false },
      { element: getId("videoFpsDiv"), display: false },
    ]);
  }
  if (!useAudio || !buttons.main.showAudioBtn) {
    displayElements([
      { element: getId("initAudioBtn"), display: false },
      { element: getId("initMicrophoneSelect"), display: false },
      { element: getId("initSpeakerSelect"), display: false },
      { element: getId("audioSourceDiv"), display: false },
      { element: audioOutputDiv, display: false },
      { element: getId("audioDropdown"), display: false },
    ]);
  }
  if (!buttons.main.showScreenBtn) {
    elemDisplay(getId("initScreenShareBtn"), false);
  }

  initVideoContainerShow(myVideoStatus);

  window.localStorage.peer_name = await getUserName();

  Swal.fire({
    allowOutsideClick: false,
    allowEscapeKey: false,
    background: swBg,
    position: "center",
    input: "text",
    inputPlaceholder: "Nhập tên của bạn",
    inputAttributes: {
      maxlength: 254,
      id: "usernameInput",
      autocomplete: "off",
      autocorrect: "off",
      autocapitalize: "off",
      spellcheck: "false",
    },
    inputValue: window.localStorage.peer_name
      ? window.localStorage.peer_name
      : "",
    html: initUser, // inject html
    confirmButtonText: `Vào cuộc họp`,
    showCancelButton: true,
    cancelButtonText: `Thoát`,
    customClass: { popup: "init-modal-size", container: "init-swal-backdrop" },
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
    // Fade the loading backdrop out right as the dialog starts its own
    // fadeInDown entrance, so the two crossfade smoothly into each other
    // instead of the backdrop cutting away instantly (which either
    // exposed a blank gap or flashed the raw room UI behind it).
    didOpen: () => {
      fadeOutLoadingBackdrop();

      // "Thoát" doesn't actually navigate away until Swal's own dismiss
      // promise resolves - which only happens after its fadeOutUp exit
      // animation finishes playing (~1s). Two things needed fixing here,
      // not just one: (1) navigate immediately on click instead of
      // waiting for that animation/promise - the .then() below still
      // calls initExitMeeting() too, but the page will already be
      // navigating away by then, so it's a harmless no-op; and (2) even
      // an "immediate" navigation isn't instant pixel-to-pixel - the
      // browser keeps rendering the current page for a brief moment
      // while it loads the next one, which without any cover exposes the
      // (fully joined) room behind the closing dialog for that instant.
      // Snap the opaque loading backdrop up with no transition (so it
      // wins that brief window outright) right as navigation starts.
      const cancelBtn = Swal.getCancelButton();
      if (cancelBtn) {
        cancelBtn.addEventListener(
          "click",
          () => {
            if (loadingBackdrop) {
              loadingBackdrop.style.transition = "none";
              elemDisplay(loadingBackdrop, true, "flex");
              // Force the browser to apply transition:none above before
              // the opacity change below, otherwise it can still animate
              // the two together and the "instant" cover isn't instant.
              void loadingBackdrop.offsetWidth;
              loadingBackdrop.style.opacity = "1";
              // Just a plain solid cover here, not the actual loading
              // screen - hide its spinner/"Đang tải" text so it doesn't
              // read as a loading state, only as the page going blank
              // for an instant on its way out.
              const loadingDiv = getId("loadingDiv");
              if (loadingDiv) loadingDiv.style.display = "none";
            }
            initExitMeeting();
          },
          { once: true },
        );
      }
    },
    inputValidator: async (value) => {
      if (!value) return "Vui lòng nhập tên của bạn";

      // Long email or name
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if ((isEmail && value.length > 254) || (!isEmail && value.length > 32)) {
        return isEmail
          ? "Email tối đa 254 ký tự"
          : "Tên tối đa 32 ký tự";
      }

      // prevent xss execution itself
      myPeerName = filterXSS(value);

      // prevent XSS injection to remote peer
      if (isHtml(myPeerName)) {
        myPeerName = "";
        return "Tên không hợp lệ!";
      }

      // check if peer name is already in use in the room
      if (await checkUserName()) {
        return "Tên người dùng đã được sử dụng!";
      } else {
        // Hide username emoji
        if (!usernameEmoji.classList.contains("hidden")) {
          usernameEmoji.classList.add("hidden");
        }
        window.localStorage.peer_name = myPeerName;
        whoAreYouJoin();
      }
    },
  }).then((result) => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      initExitMeeting();
      return;
    }
    playSound("addPeer");
  });

  // Show initUser injected into Swal html
  initUser.classList.toggle("hidden");

  // select video - audio

  initVideoSelect.onchange = async () => {
    playSound("click");
    await changeInitCamera(initVideoSelect.value);
    await handleLocalCameraMirror();
    videoSelect.selectedIndex = initVideoSelect.selectedIndex;
    refreshLsDevices();
  };
  initMicrophoneSelect.onchange = async () => {
    playSound("click");
    detectBluetoothHeadset(true);
    await changeLocalMicrophone(initMicrophoneSelect.value);
    audioInputSelect.selectedIndex = initMicrophoneSelect.selectedIndex;
    refreshLsDevices();
  };
  initSpeakerSelect.onchange = async () => {
    playSound("click");
    await changeAudioDestination();
    audioOutputSelect.selectedIndex = initSpeakerSelect.selectedIndex;
    refreshLsDevices();
  };

  // init video -audio buttons
  if (!useVideo) {
    initVideoBtn.className = className.videoOff;
    setMyVideoStatus(useVideo, false);
  }
  if (!useAudio) {
    initAudioBtn.className = className.audioOff;
    setMyAudioStatus(useAudio, false);
  }

  setTippy(initAudioBtn, "Tắt âm thanh", "top");
  setTippy(initVideoBtn, "Tắt video", "top");
}

/**
 * Refresh all LS devices
 */
async function refreshLsDevices() {
  lS.setLocalStorageDevices(
    lS.MEDIA_TYPE.video,
    videoSelect.selectedIndex,
    videoSelect.value,
  );
  lS.setLocalStorageDevices(
    lS.MEDIA_TYPE.audio,
    audioInputSelect.selectedIndex,
    audioInputSelect.value,
  );
  lS.setLocalStorageDevices(
    lS.MEDIA_TYPE.speaker,
    audioOutputSelect.selectedIndex,
    audioOutputSelect.value,
  );
}

/**
 * Check if UserName already exist in the room
 * @param {string} peer_name
 * @returns boolean
 */
async function checkUserName(peer_name = null) {
  return signalingSocket
    .request("data", {
      room_id: roomId,
      peer_id: myPeerId,
      peer_name: peer_name ? peer_name : myPeerName,
      method: "checkPeerName",
      params: {},
    })
    .then((response) => response);
}

/**
 * Username already in the room
 */
function userNameAlreadyInRoom() {
  signalingSocket.disconnect();
  playSound("alert");
  openURL("/");
}

/**
 * Load settings from Local Storage
 */
async function loadLocalStorage() {
  const localStorageDevices = lS.getLocalStorageDevices();
  console.log("12. Get Local Storage Devices before", localStorageDevices);
  if (localStorageDevices) {
    //
    const initMicrophoneExist = selectOptionByValueExist(
      initMicrophoneSelect,
      localStorageDevices.audio.select,
    );
    const initSpeakerExist = selectOptionByValueExist(
      initSpeakerSelect,
      localStorageDevices.speaker.select,
    );
    const initVideoExist = selectOptionByValueExist(
      initVideoSelect,
      localStorageDevices.video.select,
    );
    //
    const audioInputExist = selectOptionByValueExist(
      audioInputSelect,
      localStorageDevices.audio.select,
    );
    const audioOutputExist = selectOptionByValueExist(
      audioOutputSelect,
      localStorageDevices.speaker.select,
    );
    const videoExist = selectOptionByValueExist(
      videoSelect,
      localStorageDevices.video.select,
    );

    console.log("Check for audio changes", {
      previous: localStorageDevices.audio.select,
      current: audioInputSelect.value,
    });

    if (!initMicrophoneExist || !audioInputExist) {
      console.log("12.1 Audio devices seems changed, use default index 0");
      initMicrophoneSelect.selectedIndex = 0;
      audioInputSelect.selectedIndex = 0;
      refreshLsDevices();
    }

    console.log("Check for speaker changes", {
      previous: localStorageDevices.speaker.select,
      current: audioOutputSelect.value,
    });

    if (!initSpeakerExist || !audioOutputExist) {
      console.log("12.2 Speaker devices seems changed, use default index 0");
      initSpeakerSelect.selectedIndex = 0;
      audioOutputSelect.selectedIndex = 0;
      refreshLsDevices();
    }

    console.log("Check for video changes", {
      previous: localStorageDevices.video.select,
      current: videoSelect.value,
    });

    if (!initVideoExist || !videoExist) {
      console.log("12.3 Video devices seems changed, use default index 0");
      initVideoSelect.selectedIndex = 0;
      videoSelect.selectedIndex = 0;
      refreshLsDevices();
    }

    //
    console.log(
      "12.4 Get Local Storage Devices after",
      lS.getLocalStorageDevices(),
    );
  }
  // Start init cam
  if (useVideo && initVideoSelect.value) {
    await changeInitCamera(initVideoSelect.value);
    await handleLocalCameraMirror();
  }
  // Refresh audio — skip if the current mic already matches the stored device
  // to avoid tearing down and rebuilding the noise-suppression pipeline unnecessarily.
  if (useAudio && audioInputSelect.value) {
    const currentMicStream =
      noiseProcessor?.originalStream || localAudioMediaStream;
    const currentMicDeviceId =
      getAudioTrack(currentMicStream)?.getSettings?.()?.deviceId;
    if (currentMicDeviceId !== audioInputSelect.value) {
      await changeLocalMicrophone(audioInputSelect.value);
    }
  }
  // Refresh speaker
  if (audioOutputSelect.value) await changeAudioDestination();

  // Check init audio/video
  await checkInitConfig();
}

/**
 * Use the select element to check if a specific option value exists,
 * and if it does, automatically set it as the selected option.
 * @param {object} selectElement
 * @param {string} value
 * @return boolean
 */
function selectOptionByValueExist(selectElement, value) {
  let foundValue = false;
  for (let i = 0; i < selectElement.options.length; i++) {
    if (selectElement.options[i].value === value) {
      selectElement.selectedIndex = i;
      foundValue = true;
      break;
    }
  }
  return foundValue;
}

/**
 * Check int config from local storage
 */
async function checkInitConfig() {
  const initConfig = lS.getInitConfig();
  console.log("Get init config", initConfig);
  if (initConfig) {
    if (useAudio && !initConfig.audio) initAudioBtn.click();
    if (useVideo && !initConfig.video) initVideoBtn.click();
  }
}

/**
 * Detects whether the camera stream is front-facing ('user') or rear-facing ('environment').
 * Defaults to 'user' (front-facing) if detection fails (e.g., desktop cameras).
 * @param {MediaStream} stream - The video stream from `getUserMedia`.
 * @returns {string} 'user' (front) or 'environment' (rear).
 */
function detectCameraFacingMode(stream) {
  if (!stream || !stream.getVideoTracks().length) {
    console.warn("No video track found in the stream. Defaulting to 'user'.");
    return "user";
  }
  const videoTrack = stream.getVideoTracks()[0];
  const settings = videoTrack.getSettings();
  const capabilities = videoTrack.getCapabilities?.() || {};
  // Priority: settings.facingMode (actual) → capabilities.facingMode (possible) → default 'user'
  const facingMode =
    settings.facingMode || capabilities.facingMode?.[0] || "user";
  return facingMode === "environment" ? "environment" : "user"; // Force valid output
}

/**
 * Change init camera by device id
 * @param {string} deviceId
 */
async function changeInitCamera(deviceId) {
  // Show the loader spinner while switching camera
  const initVideoLoader = getId("initVideoLoader");
  if (initVideoLoader) initVideoLoader.style.display = "";

  // Stop media tracks to avoid issue on mobile
  if (initStream) {
    await stopTracks(initStream);
  }
  if (localVideoMediaStream) {
    await stopVideoTracks(localVideoMediaStream);
  }

  // Get video constraints
  const videoConstraints = getVideoConstraints("default");
  videoConstraints["deviceId"] = { exact: deviceId };

  await navigator.mediaDevices
    .getUserMedia({ video: videoConstraints })
    .then((camStream) => {
      updateInitLocalVideoMediaStream(camStream);
    })
    .catch(async (err) => {
      console.error("Error accessing init video device", err);
      console.warn("Fallback to default constraints");
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: {
              exact: deviceId, // Specify the exact device ID you want to access
            },
          },
        }); // Fallback to default constraints
        updateInitLocalVideoMediaStream(camStream);
      } catch (fallbackErr) {
        console.error(
          "Error accessing init video device with default constraints",
          fallbackErr,
        );
        reloadBrowser(err);
      }
    });

  /**
   * Update Init/Local Video Stream
   * @param {MediaStream} camStream
   */
  function updateInitLocalVideoMediaStream(camStream) {
    if (camStream) {
      // Detect camera
      camera = detectCameraFacingMode(camStream);
      console.log("Detect Camera facing mode", camera);
      // We going to update init video stream
      initVideo.srcObject = camStream;
      // Hide the CSS loader overlay once camera stream is attached
      const initVideoLoader = getId("initVideoLoader");
      if (initVideoLoader) initVideoLoader.style.display = "none";
      initStream = camStream;
      const initVideoTrack = getVideoTrack(initStream);
      if (initVideoTrack) {
        console.log(
          "Success attached init video stream",
          initVideoTrack.getSettings(),
        );
      }
      // We going to update also the local video stream
      myVideo.srcObject = camStream;
      localVideoMediaStream = camStream;
      const localVideoTrack = getVideoTrack(localVideoMediaStream);
      if (localVideoTrack) {
        console.log(
          "Success attached local video stream",
          localVideoTrack.getSettings(),
        );
      }
    }
  }

  /**
   * Something going wrong
   * @param {object} err
   */
  function reloadBrowser(err) {
    console.error("[Error] changeInitCamera", err);
    initVideoSelect.selectedIndex = 0;
    videoSelect.selectedIndex = 0;
    refreshLsDevices();
    // Refresh page...
    setTimeout(function () {
      location.reload();
    }, 3000);
  }
}

/**
 * Change local camera by device id
 * @param {string} deviceId
 */
async function changeLocalCamera(deviceId) {
  // Show loading spinner while switching camera
  const myVideoWrap = getId("myVideoWrap");
  const spinner = myVideoWrap
    ? myVideoWrap.querySelector(".video-loading-spinner")
    : null;
  if (spinner) elemDisplay(spinner, true, "flex");

  if (localVideoMediaStream) {
    await stopVideoTracks(localVideoMediaStream);
  }

  // Get video constraints
  const videoConstraints = getVideoConstraints(
    videoQualitySelect.value ? videoQualitySelect.value : "default",
  );
  videoConstraints["deviceId"] = { exact: deviceId };
  console.log("videoConstraints", videoConstraints);

  await navigator.mediaDevices
    .getUserMedia({ video: videoConstraints })
    .then(async (camStream) => {
      await updateLocalVideoMediaStream(camStream);
    })
    .catch(async (err) => {
      console.error("Error accessing local video device:", err);
      console.warn("Fallback to default constraints");
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: {
              exact: deviceId, // Specify the exact device ID you want to access
            },
          },
        });
        await updateLocalVideoMediaStream(camStream);
      } catch (fallbackErr) {
        console.error(
          "Error accessing init video device with default constraints",
          fallbackErr,
        );
        printError(err);
        if (spinner) elemDisplay(spinner, false);
      }
    });

  /**
   * Update Local Video Media Stream
   * @param {MediaStream} camStream
   */
  async function updateLocalVideoMediaStream(camStream) {
    if (camStream) {
      camera = detectCameraFacingMode(camStream);
      console.log("Detect Camera facing mode", camera);
      myVideo.srcObject = camStream;
      localVideoMediaStream = camStream;
      logStreamSettingsInfo("Success attached local video stream", camStream);
      await refreshMyStreamToPeers(camStream);
      setLocalMaxFps(videoMaxFrameRate);
    }
    if (spinner) elemDisplay(spinner, false);
  }

  /**
   * SOmething going wrong
   * @param {object} err
   */
  function printError(err) {
    console.error("[Error] changeLocalCamera", err);
  }
}

/**
 * Change local microphone by device id
 * @param {string} deviceId
 */
async function changeLocalMicrophone(deviceId) {
  // If noise suppression is active, localAudioMediaStream may be the processed stream.
  // Stop the RNNoise pipeline first and stop the *original* microphone tracks.
  const oldMicStream =
    noiseProcessor?.originalStream ||
    noiseProcessor?.mediaStream ||
    localAudioMediaStream;

  stopNoiseSuppressionPipeline();

  if (oldMicStream) {
    await stopAudioTracks(oldMicStream);
  }

  // Get audio constraints
  const audioConstraints = getAudioConstraints(deviceId);
  console.log("audioConstraints", audioConstraints);

  await navigator.mediaDevices
    .getUserMedia(audioConstraints)
    .then(async (micStream) => {
      myAudio.srcObject = micStream;
      localAudioMediaStream = micStream;
      logStreamSettingsInfo(
        "Success attached local microphone stream",
        micStream,
      );

      if (
        lsSettings.mic_noise_suppression &&
        buttons.settings.customNoiseSuppression
      ) {
        const ok = await enableNoiseSuppression();
        if (!ok) {
          await refreshMyStreamToPeers(micStream, true);
        }
      } else {
        await refreshMyStreamToPeers(micStream, true);
      }
    })
    .catch((err) => {
      console.error("[Error] changeLocalMicrophone", err);
    });
}

/**
 * Check peer audio and video &audio=1&video=1
 * 1/true = enabled / 0/false = disabled
 */
function checkPeerAudioVideo() {
  let audio = getQueryParam("audio");
  let video = getQueryParam("video");
  if (audio) {
    audio = audio.toLowerCase();
    let queryPeerAudio =
      useAudio && buttons.main.showAudioBtn
        ? audio === "1" || audio === "true"
        : false;
    if (queryPeerAudio != null)
      handleAudio(audioBtn, false, queryPeerAudio, true);
    //elemDisplay(tabAudioBtn, queryPeerAudio);
    console.log("Direct join", { audio: queryPeerAudio });
  }
  if (video) {
    video = video.toLowerCase();
    let queryPeerVideo =
      useVideo && buttons.main.showVideoBtn
        ? video === "1" || video === "true"
        : false;
    if (queryPeerVideo != null)
      handleVideo(videoBtn, false, queryPeerVideo, true);
    //elemDisplay(tabVideoBtn, queryPeerVideo);
    console.log("Direct join", { video: queryPeerVideo });
  }
}

/**
 * Initialize RNNoise suppression: check availability early and mark
 * the feature as unsupported when the processor class is missing or
 * the browser lacks AudioWorklet / WebAssembly.
 * Call once during startup, before any audio stream is created.
 */
async function initRNNoiseSuppression() {
  if (typeof RNNoiseProcessor === "undefined") {
    console.warn(
      "RNNoiseProcessor class is not available (script not loaded).",
    );
    handleRNNoiseNotSupported();
    return;
  }

  if (!RNNoiseProcessor.isSupported()) {
    console.warn(
      "RNNoise: AudioWorklet or WebAssembly not supported on this device, skipping.",
    );
    handleRNNoiseNotSupported();
    return;
  }

  const supports48k = await RNNoiseProcessor.isSampleRateSupported();
  if (!supports48k) {
    console.warn(
      "RNNoise: device does not support 48 kHz sample rate, skipping.",
    );
    handleRNNoiseNotSupported();
    return;
  }

  // Tear down any leftover processor from a previous session / hot-reload.
  stopNoiseSuppressionPipeline();

  console.log("RNNoise suppression initialized — ready to activate.");
}

/**
 * Noise suppression not supported — hide the UI toggle and flag it.
 */
function handleRNNoiseNotSupported() {
  isRNNoiseSupported = false;
  // Uncheck the toggle so localStorage stays consistent
  if (switchNoiseSuppression) switchNoiseSuppression.checked = false;
  lsSettings.mic_noise_suppression = false;
  lS.setSettings(lsSettings);
  // Hide the custom noise suppression toggle in audio settings
  elemDisplay(noiseSuppressionBtn, false);
}

/**
 * Enable RNNoise audio processing for noise suppression.
 * Returns true on success, false on failure.
 */
async function enableNoiseSuppression() {
  if (
    !localAudioMediaStream ||
    localAudioMediaStream.getAudioTracks().length === 0
  ) {
    console.warn("enableNoiseSuppression: no local audio stream available.");
    return false;
  }

  // Guard: processor class must exist and be supported
  if (
    typeof RNNoiseProcessor === "undefined" ||
    !RNNoiseProcessor.isSupported()
  ) {
    console.warn(
      "RNNoise: not available or not supported on this device, skipping.",
    );
    handleRNNoiseNotSupported();
    return false;
  }

  // Reset any existing pipeline to avoid keeping stale/ended streams.
  stopNoiseSuppressionPipeline();

  try {
    noiseProcessor = new RNNoiseProcessor();
    // Keep a reference to the raw microphone stream for safe restore.
    noiseProcessor.originalStream = localAudioMediaStream;

    const processedStream = await noiseProcessor.startProcessing(
      localAudioMediaStream,
    );

    if (!processedStream || processedStream.getAudioTracks().length === 0) {
      console.warn(
        "Noise suppression returned no usable stream, falling back to raw mic.",
      );
      stopNoiseSuppressionPipeline();
      await refreshMyStreamToPeers(localAudioMediaStream, true);
      return false;
    }

    noiseProcessor.toggleNoiseSuppression();
    localAudioMediaStream = processedStream;
    await refreshMyStreamToPeers(localAudioMediaStream, true);
    return true;
  } catch (err) {
    console.error("enableNoiseSuppression error:", err);
    stopNoiseSuppressionPipeline();
    await refreshMyStreamToPeers(localAudioMediaStream, true);
    return false;
  }
}

/**
 * Disable RNNoise audio processing for noise suppression
 */
async function disableNoiseSuppression(restoreOriginalStream = true) {
  if (noiseProcessor) {
    const originalStream =
      noiseProcessor.originalStream || noiseProcessor.mediaStream;
    if (restoreOriginalStream && originalStream) {
      localAudioMediaStream = originalStream;
    }
    await refreshMyStreamToPeers(localAudioMediaStream, true);
    stopNoiseSuppressionPipeline();
  } else {
    await refreshMyStreamToPeers(localAudioMediaStream, true);
  }
}

/**
 * Stop RNNoise audio processing pipeline and release all references.
 */
function stopNoiseSuppressionPipeline() {
  if (!noiseProcessor) return;
  try {
    noiseProcessor.stopProcessing();
  } catch (err) {
    console.warn("stopNoiseSuppressionPipeline: cleanup error ignored", err);
  }
  // Drop the reference to the original mic stream so it can be GC'd.
  noiseProcessor.originalStream = null;
  noiseProcessor = null;
}

/**
 * Restart noise suppression (e.g. after changing mic)
 */
async function restartNoiseSuppression() {
  if (!lsSettings.mic_noise_suppression) return;
  // Do not restore the old microphone stream when restarting.
  await disableNoiseSuppression(false);
  await enableNoiseSuppression();
}

/**
 * Room and Peer name are ok Join Channel
 */
async function whoAreYouJoin() {
  setPeerNameHTML(myVideoPeerName, myPeerName, true);
  setPeerAvatarImgName("myVideoAvatarImage", myPeerName, myPeerAvatar);
  setPeerAvatarImgName("myProfileAvatar", myPeerName, myPeerAvatar);
  updateSoloCompactAvatar();
  setPeerChatAvatarImgName("right", myPeerName, myPeerAvatar);
  joinToChannel();
  handleHideMe(isHideMeActive);

  // Load screen media if needed
  await loadScreenMedia();

  // Refresh camera if screen streaming
  if (isScreenStreaming && useVideo) {
    await changeLocalCamera(videoSelect.value);
  }
}

/**
 * join to channel and send some peer info
 */
async function joinToChannel() {
  console.log("12. join to channel", roomId);
  sendToServer("join", {
    join_data_time: getDataTimeString(),
    channel: roomId,
    channel_password: thisRoomPassword,
    peer_info: peerInfo,
    peer_uuid: myPeerUUID,
    peer_name: myPeerName,
    peer_avatar: myPeerAvatar,
    peer_token: myToken,
    peer_video: useVideo,
    peer_audio: useAudio,
    peer_video_status: myVideoStatus,
    peer_audio_status: myAudioStatus,
    peer_screen_status: myScreenStatus,
    peer_hand_status: myHandStatus,
    peer_rec_status: isStreamRecording,
    userAgent: userAgent,
  });
  handleBodyOnMouseMove(); // show/hide bottomButtons ...
  makeRoomPopupQR();
}

/**
 * When we join a group, our signaling server will send out 'addPeer' events to each pair of users in the group (creating a fully-connected graph of users,
 * ie if there are 6 people in the channel you will connect directly to the other 5, so there will be a total of 15 connections in the network).
 * @param {object} config data
 */
async function handleAddPeer(config) {
  //console.log("addPeer", JSON.stringify(config));

  const { peer_id, should_create_offer, iceServers, peers } = config;

  const peer_name = peers[peer_id]["peer_name"];
  const peer_video = peers[peer_id]["peer_video"];
  const peer_video_status = peers[peer_id]["peer_video_status"];
  const peer_screen_status = peers[peer_id]["peer_screen_status"];

  if (peer_id in peerConnections) {
    // This could happen if the user joins multiple channels where the other peer is also in.
    console.log("Already connected to peer", peer_id);
    return;
  }

  // Re-broadcast current profile to ensure late joiners receive latest avatar/name.
  // This uses the existing peerName signaling path.
  emitMyPeerProfile();

  console.log("iceServers", iceServers[0]);

  // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection
  const peerConnection = new RTCPeerConnection({ iceServers: iceServers });
  peerConnections[peer_id] = peerConnection;

  // Reference resets/shows controls the moment a remote peer becomes
  // present, then restarts the 5s inactivity countdown from that point.
  if (isMobileDevice) {
    showButtonsBarAndMenu();
    resetMobileIdleTimer();
  }

  allPeers = peers;
  // Ensure extras object exists for every peer to avoid undefined checks later
  try {
    for (const id in allPeers) {
      if (!allPeers[id]) continue;
      if (!allPeers[id].extras) allPeers[id].extras = {};
    }
  } catch (e) {
    console.warn("[INIT EXTRAS] failed to normalize peers extras", e);
  }

  console.log("[RTCPeerConnection] - PEER_ID", peer_id); // the connected peer_id
  console.log("[RTCPeerConnection] - PEER-CONNECTIONS", peerConnections); // all peers connections in the room expect myself
  console.log("[RTCPeerConnection] - PEERS", peers); // all peers in the room

  // As P2P check who I am connected with
  let connectedPeersName = [];
  for (const id in peerConnections) {
    connectedPeersName.push(peers[id]["peer_name"]);
  }
  console.log(
    "[RTCPeerConnection] - CONNECTED TO PEERS",
    JSON.stringify(connectedPeersName),
  );
  // userLog('info', 'Connected to: ' + JSON.stringify(connectedPeersName));

  await handlePeersConnectionStatus(peer_id);
  await msgerAddPeers(peers);
  await handleOnIceCandidate(peer_id);
  await handleRTCDataChannels(peer_id);
  await handleOnTrack(peer_id, peers);

  if (
    (!peer_video_status || !peer_screen_status) &&
    !needToCreateOfferByPeer[peer_id]
  ) {
    needToCreateOfferByPeer[peer_id] = true;
  }
  if (should_create_offer) {
    await handleRtcOffer(peer_id);
    console.log("[RTCPeerConnection] - SHOULD CREATE OFFER", {
      peer_id: peer_id,
      peer_name: peer_name,
      role: "offerer",
    });
  }

  // Add tracks (this will trigger onnegotiationneeded if needed)
  await handleAddTracks(peer_id);

  // Create camera tile for peer without camera to show their avatar or has screen sharing on but camera off
  if (!peer_video || (peer_screen_status && !peer_video_status)) {
    await loadRemoteMediaStream(new MediaStream(), peers, peer_id, "video");
  }

  playSound("addPeer");

  // Announce every peer that shows up here - first-time join or rejoin
  // after a full network drop (new peer_id either way), same message both
  // times.
  // should_create_offer is true only for the addPeer events the NEW joiner
  // gets (one per peer already in the room) - that's "I'm meeting people
  // who were already here", not "someone just joined". Only the reverse
  // case (should_create_offer false - I was already here, this peer_id is
  // the one who just showed up) should announce a join.
  if (peer_name && !should_create_offer) {
    toastMessage("success", `${peer_name} đã vào phòng.`, "", "top-end", 4000);
  }

  updateTopHeaderPeerCount();
}

/**
 * Broadcast my current profile (name + avatar) to room peers
 */
function emitMyPeerProfile() {
  sendToServer("peerName", {
    room_id: roomId,
    peer_name_old: myPeerName,
    peer_name_new: myPeerName,
    peer_avatar: myPeerAvatar,
  });
}

/**
 * Handle peers connection state
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionstatechange_event
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState
 * @param {string} peer_id socket.id
 */
async function handlePeersConnectionStatus(peer_id) {
  peerConnections[peer_id].onconnectionstatechange = function (event) {
    const connectionStatus = event.currentTarget.connectionState;
    const signalingState = event.currentTarget.signalingState;
    const peerName = allPeers[peer_id]["peer_name"];
    console.log("[RTCPeerConnection] - CONNECTION", {
      peer_id: peer_id,
      peer_name: peerName,
      connectionStatus: connectionStatus,
      signalingState: signalingState,
    });

    if (connectionStatus === "disconnected" || connectionStatus === "failed") {
      showPeerWeakConnection(peer_id, peerName);
    } else if (connectionStatus === "connected") {
      showPeerReconnectedIfWasWeak(peer_id, peerName);
    }
  };
}

/**
 * Peer's own P2P link to us dropped (their WebRTC connectionState went to
 * "disconnected"/"failed") - not the same thing as our own connection to
 * the signaling server. Persistent notice, stays up until the link recovers
 * or the peer is actually removed from the room (see hidePeerWeakConnection
 * calls in handleRemovePeer / above).
 * @param {string} peer_id socket.id
 * @param {string} peer_name display name
 */
function showPeerWeakConnection(peer_id, peer_name) {
  if (weakConnectionPeers.has(peer_id)) return; // already showing
  weakConnectionPeers.add(peer_id);
  Swal.fire({
    toast: true,
    position: "top-end",
    background: swBg,
    icon: "warning",
    title: `${peer_name} đang mất mạng...`,
    showConfirmButton: false,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  });
}

/**
 * Close the persistent "weak connection" notice for a peer, if one is open.
 * @param {string} peer_id socket.id
 */
function hidePeerWeakConnection(peer_id) {
  if (!weakConnectionPeers.has(peer_id)) return;
  weakConnectionPeers.delete(peer_id);
  Swal.close();
}

/**
 * Peer's link came back after being flagged weak - swap the persistent
 * notice for a brief auto-dismissing confirmation. No-op if this peer was
 * never flagged (i.e. this is just their normal first-join transition to
 * "connected", not an actual recovery).
 * @param {string} peer_id socket.id
 * @param {string} peer_name display name
 */
function showPeerReconnectedIfWasWeak(peer_id, peer_name) {
  if (!weakConnectionPeers.has(peer_id)) return;
  hidePeerWeakConnection(peer_id);
  toastMessage("success", `${peer_name} đã vào phòng.`, "", "top-end", 4000);
}

/**
 * Handle ICE candidate
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicecandidate
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icecandidateerror_event
 * @param {string} peer_id socket.id
 */
async function handleOnIceCandidate(peer_id) {
  peerConnections[peer_id].onicecandidate = (event) => {
    if (!event.candidate || !event.candidate.candidate) return;

    const { type, candidate, address, sdpMLineIndex } = event.candidate;

    //console.log('[ICE-CANDIDATE] ---->', { type, address, candidate });

    sendToServer("relayICE", {
      peer_id,
      ice_candidate: {
        sdpMLineIndex,
        candidate,
      },
    });

    // Get Ice address
    const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    let addressInfo = candidate.match(ipRegex);
    if (!addressInfo && address) addressInfo = [address];

    // IP
    if (addressInfo) {
      networkIP.innerText = addressInfo;
    }

    // Display network information based on candidate type
    switch (type) {
      case "host":
        networkHost.innerText = "🟢";
        break;
      case "srflx":
        networkStun.innerText = "🟢";
        break;
      case "relay":
        networkTurn.innerText = "🟢";
        break;
      default:
        console.warn(`[ICE candidate] unknown type: ${type}`, candidate);
        break;
    }
  };

  // handle ICE candidate errors
  peerConnections[peer_id].onicecandidateerror = (event) => {
    const { url, errorText } = event;

    console.warn("[ICE candidate] error", { url, error: errorText });

    if (url.startsWith("host:")) networkHost.innerText = "🔴";
    if (url.startsWith("stun:")) networkStun.innerText = "🔴";
    if (url.startsWith("turn:")) networkTurn.innerText = "🔴";

    //msgPopup('warning', `${url}: ${errorText}`, 'top-end', 6000);
  };
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ontrack
 * @param {string} peer_id socket.id
 * @param {object} peers all peers info connected to the same room
 */
async function handleOnTrack(peer_id, peers) {
  peerConnections[peer_id].ontrack = (event) => {
    if (!event.streams?.[0]) {
      console.warn("[ON TRACK] No streams found", event);
      return;
    }

    const kind = event.track?.kind;
    if (!kind) {
      console.warn("[ON TRACK] Unable to determine track kind", event);
      return;
    }

    const peerInfo = allPeers?.[peer_id] || peers?.[peer_id] || {};
    const peer_name = peerInfo.peer_name || "Unknown";
    const inbound = event.streams[0];

    // Helper to load or attach stream
    const handleStream = (elementId, streamType) => {
      const element = getId(`${peer_id}___${elementId}`);

      if (!element) {
        // Tile doesn't exist yet — create everything
        loadRemoteMediaStream(inbound, allPeers || peers, peer_id, streamType);
      } else {
        // Tile already exists (e.g. peer joined with camera off) — just attach the new stream
        attachMediaStream(element, inbound);
        elemDisplay(element, true, "block");
        // Safari requires an explicit play() after srcObject is reassigned
        element.play().catch(() => {});
      }
    };

    if (kind === "audio") {
      const audioElement = getId(`${peer_id}___audio`);

      if (audioElement) {
        attachMediaStream(audioElement, inbound);
        // Always call play() — srcObject was just assigned so the old check (!srcObject) was always false
        audioElement.play().catch((err) => {
          console.warn(
            "[AUDIO] Autoplay not allowed by device, setting up fallback:",
            err,
          );
          handleAudioFallback(audioElement, peer_name);
        });
      } else {
        loadRemoteMediaStream(inbound, allPeers || peers, peer_id, "audio");
      }
      return;
    }

    // Video or screen track
    if (kind === "video") {
      // Determine if the incoming video track is a screen share or camera.
      const extras = peerInfo.extras || {};
      const label = event.track.label || "";
      const settings = event?.track?.getSettings() || {};

      const isDisplayCapture =
        !!settings.displaySurface ||
        settings.mediaSource === "screen" ||
        settings.displaySurface === "monitor";

      const isScreenByExtras =
        extras.screen_track_id === event.track.id ||
        extras.screen_stream_id === inbound.id;

      const isScreenByLabel = /screen|window|monitor|display/i.test(label);

      const isScreenByStatus =
        peerInfo.peer_screen_status && !peerInfo.peer_video_status;

      const isScreen =
        isDisplayCapture ||
        isScreenByExtras ||
        isScreenByLabel ||
        isScreenByStatus;

      handleStream(
        isScreen ? "screen" : "video",
        isScreen ? "screen" : "video",
      );
    }
  };
}

/**
 * Add my localVideoMediaStream, localScreenMediaStream and localAudioMediaStream Tracks to connected peer
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack
 * @param {string} peer_id socket.id
 */
async function handleAddTracks(peer_id) {
  const pc = peerConnections[peer_id];
  const peer_name = allPeers[peer_id]["peer_name"];

  const videoTrack = getVideoTrack(localVideoMediaStream);
  const screenTrack = getVideoTrack(localScreenMediaStream);
  const screenAudioTrack =
    isScreenStreaming && hasAudioTrack(localScreenMediaStream)
      ? getAudioTrack(localScreenMediaStream)
      : null;
  const micAudioTrack = getAudioTrack(localAudioMediaStream);
  const audioTrack = screenAudioTrack || micAudioTrack;
  const audioStream = screenAudioTrack
    ? localScreenMediaStream
    : localAudioMediaStream;

  console.log("handleAddTracks", {
    videoTrack: videoTrack,
    screenTrack: screenTrack,
    screenAudioTrack: screenAudioTrack,
    audioTrack: audioTrack,
  });

  if (videoTrack) {
    console.log("[ADD VIDEO TRACK] to Peer Name [" + peer_name + "]");
    await pc.addTrack(videoTrack, localVideoMediaStream);
  }

  if (screenTrack) {
    console.log("[ADD SCREEN TRACK] to Peer Name [" + peer_name + "]");
    await pc.addTrack(screenTrack, localScreenMediaStream);
  }

  if (audioTrack && audioStream) {
    console.log("[ADD AUDIO TRACK] to Peer Name [" + peer_name + "]");
    await pc.addTrack(audioTrack, audioStream);
  }
}

/**
 * Secure RTC Data Channel
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ondatachannel
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/onmessage
 * @param {string} peer_id socket.id
 */
async function handleRTCDataChannels(peer_id) {
  peerConnections[peer_id].ondatachannel = (event) => {
    console.log("handleRTCDataChannels " + peer_id, event);
    event.channel.onmessage = (msg) => {
      switch (event.channel.label) {
        case "mirotalk_chat_channel":
          try {
            const dataMessage = JSON.parse(msg.data);
            switch (dataMessage.type) {
              case "chat":
                handleDataChannelChat(dataMessage);
                break;
              case "chatReaction":
                handleDataChannelChatReaction(dataMessage);
                break;
              case "micVolume":
                handlePeerVolume(dataMessage);
                break;
              default:
                break;
            }
          } catch (err) {
            console.error("mirotalk_chat_channel", err);
          }
          break;
          break;
        default:
          break;
      }
    };
  };
  createChatDataChannel(peer_id);
}

/**
 * Convert Blob to ArrayBuffer
 * @param {object} blob
 * @returns arrayBuffer
 */
function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      resolve(arrayBuffer);
    };
    reader.onerror = () => {
      reject(new Error("Error reading Blob as ArrayBuffer"));
    };
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Only one side of the peer connection should create the offer, the signaling server picks one to be the offerer.
 * The other user will get a 'sessionDescription' event and will create an offer, then send back an answer 'sessionDescription' to us
 * @param {string} peer_id socket.id
 */
async function handleRtcOffer(peer_id) {
  const pc = peerConnections[peer_id];
  // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onnegotiationneeded
  pc.onnegotiationneeded = () => {
    console.log("Creating RTC offer to " + allPeers[peer_id]["peer_name"]);
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer
    pc.createOffer()
      .then((local_description) => {
        console.log("Local offer description is", local_description);
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setLocalDescription
        pc.setLocalDescription(local_description)
          .then(() => {
            sendToServer("relaySDP", {
              peer_id: peer_id,
              session_description: local_description,
            });
            console.log("Offer setLocalDescription done!");
          })
          .catch((err) => {
            console.error("[Error] offer setLocalDescription", err);
          });
      })
      .catch((err) => {
        console.error("[Error] sending offer", err);
      });
  };
}

/**
 * Peers exchange session descriptions which contains information about their audio / video settings and that sort of stuff. First
 * the 'offerer' sends a description to the 'answerer' (with type "offer"), then the answerer sends one back (with type "answer").
 * @param {object} config data
 */
function handleSessionDescription(config) {
  console.log("Remote Session Description", config);
  const { peer_id, session_description } = config;

  // https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription
  const remote_description = new RTCSessionDescription(session_description);

  const pc = peerConnections[peer_id];

  if (!pc) {
    console.warn("[RTCSessionDescription] peer connection missing, ignoring", {
      peer_id,
    });
    return;
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setRemoteDescription
  pc.setRemoteDescription(remote_description)
    .then(() => {
      console.log("setRemoteDescription done!");

      // Drain any queued ICE now that remoteDescription is set.
      flushIceCandidates(peer_id).catch((err) =>
        console.error("[Error] flushIceCandidates", err),
      );

      if (session_description.type == "offer") {
        console.log("Creating answer");
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createAnswer
        pc.createAnswer()
          .then((local_description) => {
            console.log("Answer description is: ", local_description);
            // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setLocalDescription
            pc.setLocalDescription(local_description)
              .then(() => {
                sendToServer("relaySDP", {
                  peer_id: peer_id,
                  session_description: local_description,
                });
                console.log("Answer setLocalDescription done!");

                // https://github.com/miroslavpejic85/mirotalk/issues/110
                if (needToCreateOfferByPeer[peer_id]) {
                  needToCreateOfferByPeer[peer_id] = false;
                  handleRtcOffer(peer_id);
                  console.log(
                    "[RTCSessionDescription] - NEED TO CREATE OFFER",
                    {
                      peer_id: peer_id,
                    },
                  );
                }
              })
              .catch((err) => {
                console.error("[Error] answer setLocalDescription", err);
              });
          })
          .catch((err) => {
            console.error("[Error] creating answer", err);
          });
      } // end [if type offer]
    })
    .catch((err) => {
      console.error("[Error] setRemoteDescription", err);
    });
}

/**
 * The offerer will send a number of ICE Candidate blobs to the answerer so they
 * can begin trying to find the best path to one another on the net.
 * @param {object} config data
 */
function handleIceCandidate(config) {
  const { peer_id, ice_candidate } = config;
  // https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate
  const pc = peerConnections[peer_id];

  if (!pc) {
    queueIceCandidate(peer_id, ice_candidate);
    return;
  }

  // Queue until remoteDescription is set; otherwise addIceCandidate can fail and the candidate is lost.
  if (!pc.remoteDescription || !pc.remoteDescription.type) {
    queueIceCandidate(peer_id, ice_candidate);
    return;
  }

  pc.addIceCandidate(new RTCIceCandidate(ice_candidate)).catch((err) => {
    console.error("[Error] addIceCandidate", err);
  });
}

/**
 * If addIceCandidate is called before setRemoteDescription, it can fail and the candidate will be lost. To prevent this, we queue candidates until setRemoteDescription is called.
 * @param {string} peer_id socket.id
 * @param {object} ice_candidate RTCIceCandidateInit
 * @returns {void}
 */
function queueIceCandidate(peer_id, ice_candidate) {
  if (!peer_id || !ice_candidate) return;
  if (!pendingIceCandidates[peer_id]) pendingIceCandidates[peer_id] = [];
  pendingIceCandidates[peer_id].push(ice_candidate);
}

/**
 * When setRemoteDescription is called, we can flush any queued ICE candidates for that peer.
 * @param {string} peer_id socket.id
 * @returns {Promise<void>}
 */
async function flushIceCandidates(peer_id) {
  const pc = peerConnections[peer_id];
  const queued = pendingIceCandidates[peer_id];

  if (!pc || !queued || queued.length === 0) return;
  if (!pc.remoteDescription || !pc.remoteDescription.type) return;

  delete pendingIceCandidates[peer_id];

  for (const ice of queued) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(ice));
    } catch (err) {
      console.error("[Error] addIceCandidate (queued)", err);
    }
  }
}

/**
 * Disconnected from Signaling Server.
 * Tear down all of our peer connections and remove all the media divs.
 * @param {object} reason of disconnection
 */
function handleDisconnect(reason) {
  console.log("Disconnected from signaling server", { reason: reason });

  showDisconnectBanner();
  checkRecording();

  for (const peer_id in peerConnections) {
    const peerScreenId = peer_id + "___screen";
    const peerVideoId = peer_id + "___video";
    const peerAudioId = peer_id + "___audio";

    const peerVideo = getId(peerVideoId);
    if (peerVideo) {
      // Peer video in focus mode
      if (peerVideo.hasAttribute("focus-mode")) {
        const remoteVideoFocusBtn = getId(peer_id + "_focusMode");
        if (remoteVideoFocusBtn) {
          remoteVideoFocusBtn.click();
        }
      }
    }

    const screenVideo = getId(peerScreenId);
    if (screenVideo) {
      // Peer screen in focus mode
      if (screenVideo.hasAttribute("focus-mode")) {
        const remoteScreenFocusBtn = getId(peer_id + "_screen_focusMode");
        if (remoteScreenFocusBtn) {
          remoteScreenFocusBtn.click();
        }
      }
    }

    if (
      peerScreenMediaElements[peerScreenId] &&
      peerScreenMediaElements[peerScreenId].parentNode
    ) {
      peerScreenMediaElements[peerScreenId].parentNode.removeChild(
        peerScreenMediaElements[peerScreenId],
      );
    }
    if (
      peerVideoMediaElements[peerVideoId] &&
      peerVideoMediaElements[peerVideoId].parentNode
    ) {
      peerVideoMediaElements[peerVideoId].parentNode.removeChild(
        peerVideoMediaElements[peerVideoId],
      );
    }
    if (
      peerAudioMediaElements[peerAudioId] &&
      peerAudioMediaElements[peerAudioId].parentNode
    ) {
      peerAudioMediaElements[peerAudioId].parentNode.removeChild(
        peerAudioMediaElements[peerAudioId],
      );
    }

    peerConnections[peer_id].close();
    msgerRemovePeer(peer_id);
    removeVideoPinMediaContainer(peer_id);
  }

  adaptAspectRatio();

  chatDataChannels = {};
  fileDataChannels = {};
  peerConnections = {};
  pendingIceCandidates = {};
  peerScreenMediaElements = {};
  peerVideoMediaElements = {};
  peerAudioMediaElements = {};

  // Set reconnection flag to trigger proper rejoin
  isPeerReconnected = true;
  console.log(
    "Set isPeerReconnected=true, will attempt to rejoin on reconnect",
  );
  // Set reconnection flag to trigger proper rejoin
  isPeerReconnected = true;
  console.log(
    "Set isPeerReconnected=true, will attempt to rejoin on reconnect",
  );
  updateTopHeaderPeerCount();
}

/**
 * When a user leaves a channel (or is disconnected from the signaling server) everyone will recieve a 'removePeer' message
 * telling them to trash the media channels they have open for those that peer. If it was this client that left a channel,
 * they'll also receive the removePeers. If this client was disconnected, they wont receive removePeers, but rather the
 * signaling_socket.on('disconnect') code will kick in and tear down all the peer sessions.
 * @param {object} config data
 */
function handleRemovePeer(config) {
  console.log("Signaling server said to remove peer:", config);

  const { peer_id } = config;

  // Peer is actually leaving the room (not just a momentary link hiccup) -
  // don't leave a "weak connection" notice stuck on screen with no peer
  // left to recover.
  hidePeerWeakConnection(peer_id);

  // Grab the name before it's deleted below - covers both a voluntary leave
  // and a network-loss auto-kick (server treats both the same way, sending
  // this same 'removePeer' event either way).
  const removedPeerName = allPeers[peer_id]?.["peer_name"];

  const peerScreenId = peer_id + "___screen";
  const peerVideoId = peer_id + "___video";
  const peerAudioId = peer_id + "___audio";

  if (peerVideoId in peerVideoMediaElements) {
    const peerVideo = getId(peerVideoId);
    if (peerVideo) {
      // Peer video in focus mode
      if (peerVideo.hasAttribute("focus-mode")) {
        const remoteVideoFocusBtn = getId(peer_id + "_focusMode");
        if (remoteVideoFocusBtn) {
          remoteVideoFocusBtn.click();
        }
      }
    }
    // parentNode can already be null if this tile was detached elsewhere
    // (e.g. handleScreenStop()) without the tracking map being updated -
    // guard it so a stale entry can't throw and abort the rest of this
    // peer's cleanup below (that used to leave a dead/black tile behind).
    if (peerVideoMediaElements[peerVideoId].parentNode) {
      peerVideoMediaElements[peerVideoId].parentNode.removeChild(
        peerVideoMediaElements[peerVideoId],
      );
    }
    adaptAspectRatio();
  }

  if (peerScreenId in peerScreenMediaElements) {
    const peerScreen = getId(peerScreenId);
    if (peerScreen) {
      // Peer screen in focus mode
      if (peerScreen.hasAttribute("focus-mode")) {
        const remoteScreenFocusBtn = getId(peer_id + "_screen_focusMode");
        if (remoteScreenFocusBtn) {
          remoteScreenFocusBtn.click();
        }
      }
    }
    if (peerScreenMediaElements[peerScreenId].parentNode) {
      peerScreenMediaElements[peerScreenId].parentNode.removeChild(
        peerScreenMediaElements[peerScreenId],
      );
    }
    adaptAspectRatio();
  }

  if (
    peerAudioId in peerAudioMediaElements &&
    peerAudioMediaElements[peerAudioId].parentNode
  ) {
    peerAudioMediaElements[peerAudioId].parentNode.removeChild(
      peerAudioMediaElements[peerAudioId],
    );
  }

  if (peer_id in peerConnections) peerConnections[peer_id].close();

  // Clean up dropdown menus appended to body
  const dropdownBtn = getId(peer_id + "_videoDropdownBtn");
  if (dropdownBtn && dropdownBtn._dropdownContent) {
    dropdownBtn._dropdownContent.remove();
  }

  msgerRemovePeer(peer_id);
  removeVideoPinMediaContainer(peer_id);

  delete chatDataChannels[peer_id];
  delete fileDataChannels[peer_id];
  delete peerConnections[peer_id];
  delete pendingIceCandidates[peer_id];
  delete peerScreenMediaElements[peerScreenId];
  delete peerVideoMediaElements[peerVideoId];
  delete peerAudioMediaElements[peerAudioId];
  delete allPeers[peer_id];

  playSound("removePeer");

  if (removedPeerName) {
    // Leave notice uses its own red "!" instead of toastMessage()'s default
    // green checkmark - a checkmark reads as "success" which is backwards
    // for someone leaving. didOpen forces the progress bar red too: the
    // shared .swal2-timer-progress-bar CSS rule sets it with !important, so
    // only an inline !important (via setProperty) can override it here
    // without touching that shared rule (which every other toast still uses).
    Swal.fire({
      toast: true,
      position: "top-end",
      background: swBg,
      icon: "warning",
      iconColor: "#ef4444",
      title: `${removedPeerName} đã rời phòng.`,
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
      showClass: { popup: "animate__animated animate__fadeInDown" },
      hideClass: { popup: "animate__animated animate__fadeOutUp" },
      didOpen: (toastEl) => {
        toastEl
          .querySelector(".swal2-timer-progress-bar")
          ?.style.setProperty("background-color", "#ef4444", "important");
      },
    });
  }

  // Screen reader announcement for peer left
  const peer_name =
    allPeers && allPeers[peer_id]
      ? allPeers[peer_id]["peer_name"]
      : "Participant";

  console.log("ALL PEERS", allPeers);
  console.log("ALL PEERS", allPeers);
  updateTopHeaderPeerCount();

  // Reference keeps controls always visible while alone (no remote peer) -
  // once the last remote peer leaves, cancel the countdown and re-show.
  if (isMobileDevice && Object.keys(peerConnections).length === 0) {
    if (mobileIdleTimer) clearTimeout(mobileIdleTimer);
    showButtonsBarAndMenu();
  }
}

/**
  }
  refreshMainButtonsToolTipPlacement();
}

/**
 * Init to enumerate the devices
 */
async function initEnumerateDevices() {
  console.log("05. init Enumerate Video and Audio Devices");
  await initEnumerateVideoDevices();
  await initEnumerateAudioDevices();
}

/**
 * Init to enumerate the audio devices
 * @returns boolean true/false
 */
async function initEnumerateAudioDevices() {
  if (isEnumerateAudioDevices) return;
  // allow the audio
  await navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(async (stream) => {
      await enumerateAudioDevices(stream);
      useAudio = true;
    })
    .catch(() => {
      useAudio = false;
    });
}

/**
 * Init to enumerate the vide devices
 * @returns boolean true/false
 */
async function initEnumerateVideoDevices() {
  if (isEnumerateVideoDevices) return;
  // allow the video
  await navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(async (stream) => {
      await enumerateVideoDevices(stream);
      useVideo = true;
    })
    .catch(() => {
      useVideo = false;
    });
}

/**
 * Enumerate Audio
 * @param {object} stream
 */
async function enumerateAudioDevices(stream) {
  console.log("06. Get Audio Devices");
  await navigator.mediaDevices
    .enumerateDevices()
    .then((devices) =>
      devices.forEach(async (device) => {
        let el,
          eli = null;
        if ("audioinput" === device.kind) {
          el = audioInputSelect;
          eli = initMicrophoneSelect;
          lS.DEVICES_COUNT.audio++;
        } else if ("audiooutput" === device.kind) {
          el = audioOutputSelect;
          eli = initSpeakerSelect;
          lS.DEVICES_COUNT.speaker++;
        }
        if (!el) return;
        await addChild(device, [el, eli]);
      }),
    )
    .then(async () => {
      await stopTracks(stream);
      isEnumerateAudioDevices = true;
      //const sinkId = 'sinkId' in HTMLMediaElement.prototype;
      audioOutputSelect.disabled = !sinkId;
      // Check if there is speakers
      if (!sinkId || initSpeakerSelect.options.length === 0) {
        displayElements([
          { element: initSpeakerSelect, display: false },
          { element: audioOutputDiv, display: false },
        ]);
      }
    });
}

/**
 * Enumerate Video
 * @param {object} stream
 */
async function enumerateVideoDevices(stream) {
  console.log("07. Get Video Devices");
  await navigator.mediaDevices
    .enumerateDevices()
    .then((devices) =>
      devices.forEach(async (device) => {
        let el,
          eli = null;
        if ("videoinput" === device.kind) {
          el = videoSelect;
          eli = initVideoSelect;
          lS.DEVICES_COUNT.video++;
        }
        if (!el) return;
        await addChild(device, [el, eli]);
      }),
    )
    .then(async () => {
      await stopTracks(stream);
      isEnumerateVideoDevices = true;
    });
}

/**
 * Stop tracks from stream
 * @param {object} stream
 */
async function stopTracks(stream) {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * Add child to element
 * @param {object} device
 * @param {object} els
 */
async function addChild(device, els) {
  const { kind, deviceId, label } = device;
  els.forEach((el) => {
    const option = document.createElement("option");
    option.value = deviceId;
    switch (kind) {
      case "videoinput":
        option.innerText = `📹 ` + label || `📹 camera ${el.length + 1}`;
        break;
      case "audioinput":
        option.innerText = `🎤 ` + label || `🎤 microphone ${el.length + 1}`;
        break;
      case "audiooutput":
        option.innerText = `🔈 ` + label || `🔈 speaker ${el.length + 1}`;
        break;
      default:
        break;
    }
    el.appendChild(option);
  });
}

/**
 * Refresh audio/video devices list when hardware changes are detected
 * Preserves the currently selected device if it's still available
 */
async function refreshMyAudioVideoDevices() {
  console.log("Refreshing audio/video devices...");

  // Store currently selected device IDs
  const selectedVideoId = videoSelect?.value;
  const selectedAudioInputId = audioInputSelect?.value;
  const selectedAudioOutputId = audioOutputSelect?.value;

  try {
    // Re-enumerate all devices
    const devices = await navigator.mediaDevices.enumerateDevices();

    // Clear existing options
    if (videoSelect) videoSelect.innerHTML = "";
    if (audioInputSelect) audioInputSelect.innerHTML = "";
    if (audioOutputSelect) audioOutputSelect.innerHTML = "";

    // Reset device counts
    lS.DEVICES_COUNT.video = 0;
    lS.DEVICES_COUNT.audio = 0;
    lS.DEVICES_COUNT.speaker = 0;

    // Populate select elements with new device list
    for (const device of devices) {
      let el = null;
      if (device.kind === "videoinput") {
        el = videoSelect;
        lS.DEVICES_COUNT.video++;
      } else if (device.kind === "audioinput") {
        el = audioInputSelect;
        lS.DEVICES_COUNT.audio++;
      } else if (device.kind === "audiooutput") {
        el = audioOutputSelect;
        lS.DEVICES_COUNT.speaker++;
      }
      if (el) await addChild(device, [el]);
    }

    // Update speaker availability
    audioOutputSelect.disabled = !sinkId || lS.DEVICES_COUNT.speaker === 0;

    // Try to restore previously selected devices
    let videoChanged = false;
    let audioInputChanged = false;
    let audioOutputChanged = false;

    if (videoSelect && selectedVideoId) {
      if (selectOptionByValueExist(videoSelect, selectedVideoId)) {
        videoSelect.value = selectedVideoId;
      } else {
        videoChanged = true;
        console.log("Previously selected camera no longer available");
      }
    }

    if (audioInputSelect && selectedAudioInputId) {
      if (selectOptionByValueExist(audioInputSelect, selectedAudioInputId)) {
        audioInputSelect.value = selectedAudioInputId;
      } else {
        audioInputChanged = true;
        console.log("Previously selected microphone no longer available");
      }
    }

    if (audioOutputSelect && selectedAudioOutputId) {
      if (selectOptionByValueExist(audioOutputSelect, selectedAudioOutputId)) {
        audioOutputSelect.value = selectedAudioOutputId;
      } else {
        audioOutputChanged = true;
        console.log("Previously selected speaker no longer available");
      }
    }

    // If active device was removed, switch to the new default
    if (videoChanged && useVideo && videoSelect?.value) {
      console.log("Switching to new default camera:", videoSelect.value);
      await changeLocalCamera(videoSelect.value);
    }

    if (audioInputChanged && useAudio && audioInputSelect?.value) {
      console.log(
        "Switching to new default microphone:",
        audioInputSelect.value,
      );
      await changeLocalMicrophone(audioInputSelect.value);
    }

    if (audioOutputChanged && audioOutputSelect?.value) {
      console.log("Switching to new default speaker:", audioOutputSelect.value);
      await changeAudioDestination();
    }

    // Update local storage with new selections
    await refreshLsDevices();

    console.log("Device refresh complete:", {
      video: lS.DEVICES_COUNT.video,
      audio: lS.DEVICES_COUNT.audio,
      speaker: lS.DEVICES_COUNT.speaker,
    });
  } catch (err) {
    console.error("Error refreshing devices:", err);
  }
}

/**
 * Detect low quality bluetooth devices
 * @param {boolean} init indicates if it's during inizialization before join room
 */
function detectBluetoothHeadset(init = false) {
  const selectEl = init ? initMicrophoneSelect : audioInputSelect;
  if (!selectEl) return;

  const micName = getSelectedOptionText(selectEl);
  console.log("Selected microphone:", micName);

  const lowQualityBT =
    /(bluetooth|headset|hands[- ]?free|hsp|hfp|sco|airpods)/i;
  if (micName && lowQualityBT.test(micName)) {
    alert(
      "⚠️ Bạn đang dùng tai nghe Bluetooth có chất lượng âm thanh hạn chế. Để có kết quả tốt nhất, hãy dùng micro tích hợp trên thiết bị hoặc tai nghe có dây.",
    );
  }
}

/**
 *  Get selected option text
 * @param {object} selectEl
 * @returns string
 */
function getSelectedOptionText(selectEl) {
  if (!selectEl || !selectEl.options || selectEl.selectedIndex < 0) return "";
  const opt = selectEl.options[selectEl.selectedIndex];
  return opt && opt.text ? opt.text.trim() : "";
}

/**
 * Setup local video media. Ask the user for permission to use the computer's camera,
 * and attach it to a <video> tag if access is granted.
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 */
async function setupLocalVideoMedia() {
  if (!useVideo || localVideoMediaStream) {
    return;
  }

  console.log("Requesting access to video inputs");

  const videoConstraints = useVideo ? getVideoConstraints("default") : false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
    });
    await updateLocalVideoMediaStream(stream);
  } catch (err) {
    console.error("Error accessing video device", err);
    console.warn("Fallback to default constraints");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      await updateLocalVideoMediaStream(stream);
    } catch (fallbackErr) {
      console.error(
        "Error accessing video device with default constraints",
        fallbackErr,
      );
      handleMediaError("video", fallbackErr);
    }
  }

  /**
   * Update Local Media Stream
   * @param {MediaStream} stream
   */
  async function updateLocalVideoMediaStream(stream) {
    if (stream) {
      localVideoMediaStream = stream;
      await loadLocalMedia(stream, "video");
      console.log("Access granted to video device");
    }
  }
}

/**
 * Setup local audio media. Ask the user for permission to use the computer's microphone,
 * and attach it to an <audio> tag if access is granted.
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 */
async function setupLocalAudioMedia() {
  if (!useAudio || localAudioMediaStream) {
    return;
  }

  console.log("Requesting access to audio inputs");

  // Check RNNoise support early, before audio streams are created.
  await initRNNoiseSuppression();

  const audioConstraints = useAudio ? getAudioConstraints() : { audio: false };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
    if (stream) {
      /* 
                Verify the audio track is live – on some mobile devices getUserMedia
                succeeds but the track is muted/ended (e.g. built-in mic restrictions).
            */
      let activeStream = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (
        audioTrack &&
        (audioTrack.readyState === "ended" || audioTrack.muted)
      ) {
        console.warn(
          "Audio track obtained but is " +
            (audioTrack.muted ? "muted" : "ended") +
            ", retrying with relaxed constraints",
        );
        stream.getTracks().forEach((t) => t.stop());
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }

      await loadLocalMedia(activeStream, "audio");
      if (useAudio) {
        localAudioMediaStream = activeStream;
        console.log("10. Access granted to audio device");

        // Auto-enable noise suppression if the user had it active in a previous session.
        if (
          lsSettings.mic_noise_suppression &&
          isRNNoiseSupported &&
          buttons.settings.customNoiseSuppression
        ) {
          const ok = await enableNoiseSuppression();
          if (!ok) {
            console.warn(
              "Auto noise-suppression failed on startup, continuing with raw mic.",
            );
          }
        }
      }
    }
  } catch (err) {
    handleMediaError("audio", err);
  }
}

/**
 * Handle media access error.
 * https://blog.addpipe.com/common-getusermedia-errors/
 *
 * @param {string} mediaType - 'video' or 'audio'
 * @param {object} err - The error object
 */
function handleMediaError(mediaType, err) {
  playSound("alert");
  //
  let errMessage = err;

  switch (err.name) {
    case "NotFoundError":
    case "DevicesNotFoundError":
      errMessage = "Không tìm thấy thiết bị cần thiết";
      break;
    case "NotReadableError":
    case "TrackStartError":
      errMessage = "Thiết bị đang được sử dụng bởi ứng dụng khác";
      break;
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      errMessage = "Không có thiết bị nào đáp ứng được yêu cầu";
      break;
    case "NotAllowedError":
    case "PermissionDeniedError":
      errMessage = "Trình duyệt đã từ chối cấp quyền truy cập";
      break;
    case "TypeError":
      errMessage = "Đối tượng constraints trống";
      break;
    default:
      break;
  }

  // Print message to inform user
  const $html = `
        <ul style="text-align: left">
            <li>Loại thiết bị: ${mediaType}</li>
            <li>Tên lỗi: ${err.name}</li>
            <li>Thông báo lỗi: <p style="color: red">${errMessage}</p></li>
            <li>Thường gặp: <a href="https://blog.addpipe.com/common-getusermedia-errors" target="_blank">Lỗi getUserMedia</a></li>
        </ul>
    `;

  msgHTML(null, images.forbidden, "Truy cập bị từ chối", $html, "center", "/");

  /*
        it immediately stops the execution of the current function and jumps to the nearest enclosing try...catch block or, 
        if none exists, it interrupts the script execution and displays an error message in the console.
    */
  throw new Error(
    `Access denied for ${mediaType} device [${err.name}]: ${errMessage} check the common getUserMedia errors: https://blog.addpipe.com/common-getusermedia-errors/`,
  );
}

/**
 * Load Local Media Stream obj
 * @param {object} stream media stream audio - video
 */
async function loadLocalMedia(stream, kind) {
  if (stream) console.log("LOAD LOCAL MEDIA STREAM TRACKS", stream.getTracks());

  switch (kind) {
    case "video":
      //alert('local video');
      console.log("SETUP LOCAL VIDEO STREAM");

      // local video elements
      const myVideoWrap = document.createElement("div");
      const myLocalMedia = document.createElement("video");

      // html elements
      const myVideoNavBar = document.createElement("div");
      const myCurrentSessionTime = document.createElement("span");
      const myVideoPeerName = document.createElement("p");
      const myHandStatusIcon = document.createElement("button");
      const myVideoStatusIcon = document.createElement("button");
      const myAudioStatusIcon = document.createElement("button");
      const myVideoFullScreenBtn = document.createElement("button");
      const myVideoPinBtn = document.createElement("button");
      const myVideoMirrorBtn = document.createElement("button");
      const myVideoPiPBtn = document.createElement("button");
      const myDropdownDiv = document.createElement("div");
      const myDropdownBtn = document.createElement("button");
      const myDropdownContent = document.createElement("div");
      const myVideoAvatarImage = document.createElement("img");

      //my current session time
      myCurrentSessionTime.setAttribute("id", "myCurrentSessionTime");
      myCurrentSessionTime.className = "notranslate";

      // my peer name
      myVideoPeerName.setAttribute("id", "myVideoPeerName");
      myVideoPeerName.className = "videoPeerName notranslate fadein";

      // my hand status element
      myHandStatusIcon.setAttribute("id", "myHandStatusIcon");
      myHandStatusIcon.className = className.handPulsate;
      myHandStatusIcon.style.setProperty("color", "#FFD700");

      // my video status element
      myVideoStatusIcon.setAttribute("id", "myVideoStatusIcon");
      myVideoStatusIcon.className = className.videoOn;
      myVideoStatusIcon.style.cursor = "default";

      // my audio status element
      myAudioStatusIcon.setAttribute("id", "myAudioStatusIcon");
      myAudioStatusIcon.className = className.audioOn;
      myAudioStatusIcon.style.cursor = "default";

      // my video to image

      // my video full screen mode
      myVideoFullScreenBtn.setAttribute("id", "myVideoFullScreenBtn");
      myVideoFullScreenBtn.className = className.fullScreen;

      // my video Picture in Picture
      myVideoPiPBtn.setAttribute("id", "myVideoPiPBtn");
      myVideoPiPBtn.className = className.pip;

      // my video pin/unpin button
      myVideoPinBtn.setAttribute("id", "myVideoPinBtn");
      myVideoPinBtn.className = className.pinUnpin;

      // my video toggle mirror
      myVideoMirrorBtn.setAttribute("id", "myVideoMirror");
      myVideoMirrorBtn.className = className.mirror;

      // no mobile devices
      if (!isMobileDevice) {
        setTippy(myHandStatusIcon, "Tay tôi đang giơ", "bottom");
        setTippy(myVideoStatusIcon, "Video của tôi đang bật", "bottom");
        setTippy(myAudioStatusIcon, "Âm thanh của tôi đang bật", "bottom");
        setTippy(myVideoFullScreenBtn, "Chế độ toàn màn hình", "bottom");
        setTippy(myVideoPiPBtn, "Bật tắt hình trong hình", "bottom");
        setTippy(myVideoPinBtn, "Bật tắt ghim video", "bottom");
        setTippy(myVideoMirrorBtn, "Lật ngược video", "bottom");
      }

      // my video avatar image
      myVideoAvatarImage.setAttribute("id", "myVideoAvatarImage");
      myVideoAvatarImage.className = "videoAvatarImage"; // pulsate

      // my video nav bar
      myVideoNavBar.className = "navbar fadein";

      myVideoNavBar.appendChild(myCurrentSessionTime);
      !isMobileDevice && myVideoNavBar.appendChild(myVideoPinBtn);

      if (showVideoPipBtn && buttons.local.showVideoPipBtn)
        myVideoNavBar.appendChild(myVideoPiPBtn);

      // Local dropdown menu
      myDropdownDiv.className = "navbar-dropdown";
      myDropdownBtn.id = "myVideoDropdownBtn";
      myDropdownBtn.className = "fas fa-ellipsis-vertical";
      myDropdownContent.className = "navbar-dropdown-content";

      myDropdownContent.appendChild(
        createDropdownItem(myVideoMirrorBtn, "Lật ngược", myDropdownContent),
      );
      isVideoFullScreenSupported &&
        myDropdownContent.appendChild(
          createDropdownItem(
            myVideoFullScreenBtn,
            "Toàn màn hình",
            myDropdownContent,
          ),
        );

      myDropdownDiv.appendChild(myDropdownBtn);
      document.body.appendChild(myDropdownContent);
      myDropdownBtn._dropdownContent = myDropdownContent;
      handleDropdownEvents(myDropdownDiv, myDropdownBtn, myDropdownContent);

      myVideoNavBar.appendChild(myVideoStatusIcon);
      myVideoNavBar.appendChild(myAudioStatusIcon);
      myVideoNavBar.appendChild(myHandStatusIcon);

      myVideoNavBar.appendChild(myDropdownDiv);

      // hand display none on default menad is raised == false
      elemDisplay(myHandStatusIcon, false);

      myLocalMedia.setAttribute("id", "myVideo");
      myLocalMedia.setAttribute("playsinline", true);
      myLocalMedia.className = "mirror";
      myLocalMedia.autoplay = true;
      myLocalMedia.muted = true;
      myLocalMedia.volume = 0;
      myLocalMedia.controls = false;

      myVideoWrap.className = "Camera";
      myVideoWrap.setAttribute("id", "myVideoWrap");

      // add elements to video wrap div
      myVideoWrap.appendChild(myVideoNavBar);
      myVideoWrap.appendChild(myVideoAvatarImage);
      myVideoWrap.appendChild(myLocalMedia);

      myVideoWrap.appendChild(myVideoPeerName);

      createVideoLoadingSpinner(myVideoWrap, myLocalMedia);

      videoMediaContainer.insertBefore(
        myVideoWrap,
        videoMediaContainer.firstChild,
      );
      elemDisplay(myVideoWrap, false);

      logStreamSettingsInfo("localVideoMediaStream", stream);
      attachMediaStream(myLocalMedia, stream);

      adaptAspectRatio();

      handleVideoToggleMirror(myLocalMedia.id, myVideoMirrorBtn.id);

      isVideoFullScreenSupported &&
        handleVideoPlayerFs(myLocalMedia.id, myVideoFullScreenBtn.id);

      handleVideoPinUnpin(
        myLocalMedia.id,
        myVideoPinBtn.id,
        myVideoWrap.id,
        myLocalMedia.id,
      );

      if (showVideoPipBtn && buttons.local.showVideoPipBtn)
        handlePictureInPicture(myVideoPiPBtn.id, myLocalMedia.id, myPeerId);

      refreshMyVideoStatus(stream);

      if (!useVideo) {
        elemDisplay(myVideoAvatarImage, true, "block");
        const spinner = myVideoWrap.querySelector(".video-loading-spinner");
        if (spinner) elemDisplay(spinner, false);
        setMediaButtonsClass([
          { element: myVideoStatusIcon, status: false, mediaType: "video" },
          { element: videoBtn, status: false, mediaType: "video" },
        ]);
        if (!isMobileDevice) {
          setTippy(myVideoStatusIcon, "Video của tôi đang tắt", "bottom");
        }
      }

      if (!useAudio) {
        setMediaButtonsClass([
          { element: myAudioStatusIcon, status: false, mediaType: "audio" },
          { element: audioBtn, status: false, mediaType: "audio" },
        ]);
        if (!isMobileDevice) {
          setTippy(myAudioStatusIcon, "Âm thanh của tôi đang tắt", "bottom");
        }
      }
      break;
    case "screen":
      //alert('local screen');
      console.log("SETUP LOCAL SCREEN STREAM");

      // local screen elements
      const myScreenWrap = document.createElement("div");
      const myScreenMedia = document.createElement("video");

      // html elements
      const myScreenNavBar = document.createElement("div");
      const myScreenPeerName = document.createElement("p");
      const myScreenFullScreenBtn = document.createElement("button");
      const myScreenPinBtn = document.createElement("button");
      const myScreenPiPBtn = document.createElement("button");
      const myScreenAvatarImage = document.createElement("img");

      // my screen peer name
      myScreenPeerName.setAttribute("id", "myScreenPeerName");
      myScreenPeerName.className = "videoPeerName notranslate fadein";
      setPeerNameHTML(myScreenPeerName, myPeerName, true, "", true);

      // my screen to image

      // my screen full screen mode
      myScreenFullScreenBtn.setAttribute("id", "myScreenFullScreenBtn");
      myScreenFullScreenBtn.className = className.fullScreen;

      // my screen Picture in Picture
      myScreenPiPBtn.setAttribute("id", "myScreenPiPBtn");
      myScreenPiPBtn.className = className.pip;

      // my screen pin/unpin button
      myScreenPinBtn.setAttribute("id", "myScreenPinBtn");
      myScreenPinBtn.className = className.pinUnpin;

      // no mobile devices
      if (!isMobileDevice) {
        setTippy(myScreenFullScreenBtn, "Chế độ toàn màn hình", "bottom");
        setTippy(myScreenPiPBtn, "Bật tắt hình trong hình", "bottom");
        setTippy(myScreenPinBtn, "Bật tắt ghim màn hình", "bottom");
      }

      // my screen avatar image
      myScreenAvatarImage.setAttribute("id", "myScreenAvatarImage");
      myScreenAvatarImage.className = "videoAvatarImage"; // pulsate

      // my screen nav bar
      myScreenNavBar.className = "navbar fadein";
      !isMobileDevice && myScreenNavBar.appendChild(myScreenPinBtn);

      // attach to screen nav bar

      myScreenNavBar.appendChild(myScreenPiPBtn);

      isVideoFullScreenSupported &&
        myScreenNavBar.appendChild(myScreenFullScreenBtn);

      myScreenMedia.setAttribute("id", "myScreen");
      myScreenMedia.setAttribute("playsinline", true);
      myScreenMedia.style.objectFit = "contain";
      myScreenMedia.className = "";
      myScreenMedia.autoplay = true;
      myScreenMedia.muted = true;
      myScreenMedia.volume = 0;
      myScreenMedia.controls = false;

      myScreenWrap.className = "Screen";
      myScreenWrap.setAttribute("id", "myScreenWrap");

      // add elements to screen wrap div
      myScreenWrap.appendChild(myScreenNavBar);
      myScreenWrap.appendChild(myScreenAvatarImage);
      myScreenWrap.appendChild(myScreenMedia);
      myScreenWrap.appendChild(myScreenPeerName);

      createVideoLoadingSpinner(myScreenWrap, myScreenMedia);

      // Insert right before the waiting card (not appendChild, which
      // put it last) so my tile keeps the same "first/local slot"
      // position my camera tile occupies - matches the reference,
      // where the local video/screen swap happens in the same slot
      // instead of the screen tile jumping to the far side of the
      // waiting card.
      const waitingCardForScreen = getId("waitingRoomCard");
      if (waitingCardForScreen) {
        videoMediaContainer.insertBefore(myScreenWrap, waitingCardForScreen);
      } else {
        videoMediaContainer.appendChild(myScreenWrap);
      }
      // Show my screen tile immediately when created
      elemDisplay(myScreenWrap, true, "inline-block");

      logStreamSettingsInfo("localScreenMediaStream", stream);
      attachMediaStream(myScreenMedia, stream);

      adaptAspectRatio();

      isVideoFullScreenSupported &&
        handleVideoPlayerFs(myScreenMedia.id, myScreenFullScreenBtn.id);

      handleVideoPinUnpin(
        myScreenMedia.id,
        myScreenPinBtn.id,
        myScreenWrap.id,
        myScreenMedia.id,
        true,
      );

      // Auto-pin is a group-call feature (splits the stage 25/75 to
      // spotlight one tile among several). Alone (0 peers) or in a
      // 1-on-1 call (1 peer) there is at most one other tile anyway,
      // and the reference UI never shows a self screen-share preview
      // at all - skip it so the solo/waiting-room layout (camera tile
      // hidden, screen tile filling the stage normally) stays intact.
      // Was `!== 1`, which only skipped the 1-peer case and still
      // pinned (breaking out into the absolute-positioned
      // #videoPinMediaContainer) when sharing alone with 0 peers.
      if (Object.keys(peerConnections).length > 1) {
        myScreenPinBtn.click();
      }

      if (showVideoPipBtn && buttons.local.showVideoPipBtn)
        handlePictureInPicture(myScreenPiPBtn.id, myScreenMedia.id, myPeerId);
      break;
    case "audio":
      //alert('local audio');
      console.log("SETUP LOCAL AUDIO STREAM");
      // handle remote audio elements
      const localAudioWrap = document.createElement("div");
      const localAudioMedia = document.createElement("audio");
      localAudioMedia.id = "myAudio";
      localAudioMedia.controls = false;
      localAudioMedia.autoplay = true;
      localAudioMedia.muted = true;
      localAudioMedia.volume = 0;
      localAudioWrap.appendChild(localAudioMedia);
      audioMediaContainer.appendChild(localAudioWrap);
      logStreamSettingsInfo("localAudioMediaStream", stream);
      attachMediaStream(localAudioMedia, stream);
      refreshMyAudioStatus(stream);
      break;
    default:
      break;
  }
}

/**
 * Check if screen is shared on join room
 */
function checkShareScreen() {
  if (
    !isMobileDevice &&
    isScreenEnabled &&
    isScreenSharingSupported &&
    buttons.main.showScreenBtn
  ) {
    playSound("newMessage");
    // handle error: getDisplayMedia requires transient activation from a user gesture on Safari - FireFox
    // No confirm dialog here anymore - screenShareBtn's own click handler
    // already shows the "Chia sẻ màn hình?" PP confirm before sharing.
    screenShareBtn.click();
  }
}

/**
 * Open chat on Join
 */
function checkChatOnJoin() {
  if (chat) {
    chatRoomBtn.click();
  }
}

/**
 * Load Remote Media Stream obj
 * @param {MediaStream} stream media stream audio - video
 * @param {object} peers all peers info connected to the same room
 * @param {string} peer_id socket.id
 */
async function loadRemoteMediaStream(stream, peers, peer_id, kind) {
  // get data from peers obj
  console.log("REMOTE PEER INFO", peers[peer_id]);

  const peer_name = peers[peer_id]["peer_name"];
  const peer_avatar = peers[peer_id]["peer_avatar"];
  const peer_audio = peers[peer_id]["peer_audio"];
  const peer_video = peers[peer_id]["peer_video"];
  const peer_video_status = peers[peer_id]["peer_video_status"];
  const peer_audio_status = peers[peer_id]["peer_audio_status"];
  const peer_screen_status = peers[peer_id]["peer_screen_status"];
  const peer_hand_status = peers[peer_id]["peer_hand_status"];
  const peer_rec_status = peers[peer_id]["peer_rec_status"];

  if (stream)
    console.log(
      "LOAD REMOTE MEDIA STREAM TRACKS - PeerName:[" + peer_name + "]",
      stream.getTracks(),
    );

  switch (kind) {
    case "video":
      // alert('remote video');
      console.log("SETUP REMOTE VIDEO STREAM");

      // handle remote video elements
      const remoteVideoWrap = document.createElement("div");
      const remoteMedia = document.createElement("video");

      // html elements
      const remoteVideoNavBar = document.createElement("div");
      const remotePeerName = document.createElement("p");
      const remoteHandStatusIcon = document.createElement("button");
      const remoteVideoStatusIcon = document.createElement("button");
      const remoteAudioStatusIcon = document.createElement("button");
      const remoteVideoAudioUrlBtn = document.createElement("button");

      const remotePeerKickOut = document.createElement("button");
      const remoteVideoFullScreenBtn = document.createElement("button");
      const remoteVideoPinBtn = document.createElement("button");
      const remoteVideoMirrorBtn = document.createElement("button");
      const remoteVideoPiPBtn = document.createElement("button");
      const remoteVideoAvatarImage = document.createElement("img");

      const remoteDropdownDiv = document.createElement("div");
      const remoteDropdownBtn = document.createElement("button");
      const remoteDropdownContent = document.createElement("div");

      // remote peer name element
      remotePeerName.setAttribute("id", peer_id + "_name");
      remotePeerName.className = "videoPeerName notranslate fadein";

      setPeerNameHTML(remotePeerName, peer_name, false, peer_id);

      // remote hand status element
      remoteHandStatusIcon.setAttribute("id", peer_id + "_handStatus");
      remoteHandStatusIcon.style.setProperty("color", "#FFD700");
      remoteHandStatusIcon.className = className.handPulsate;

      // remote video status element
      remoteVideoStatusIcon.setAttribute("id", peer_id + "_videoStatus");
      remoteVideoStatusIcon.className = className.videoOn;
      remoteVideoStatusIcon.style.cursor = "default";

      // remote audio status element
      remoteAudioStatusIcon.setAttribute("id", peer_id + "_audioStatus");
      remoteAudioStatusIcon.className = className.audioOn;
      remoteAudioStatusIcon.style.cursor = "default";

      // remote share file

      // remote peer YouTube video
      remoteVideoAudioUrlBtn.setAttribute("id", peer_id + "_videoAudioUrl");
      remoteVideoAudioUrlBtn.className = className.shareVideoAudio;

      // my video to image

      // remote peer kick out
      remotePeerKickOut.setAttribute("id", peer_id + "_kickOut");
      remotePeerKickOut.className = className.kickOut;

      // remote video Picture in Picture
      remoteVideoPiPBtn.setAttribute("id", peer_id + "videoPIP");
      remoteVideoPiPBtn.className = className.pip;

      // remote video full screen mode
      remoteVideoFullScreenBtn.setAttribute("id", peer_id + "_fullScreen");
      remoteVideoFullScreenBtn.className = className.fullScreen;

      // remote video pin/unpin button
      remoteVideoPinBtn.setAttribute("id", peer_id + "_pinUnpin");
      remoteVideoPinBtn.className = className.pinUnpin;

      // remote video toggle mirror
      remoteVideoMirrorBtn.setAttribute("id", peer_id + "_toggleMirror");
      remoteVideoMirrorBtn.className = className.mirror;

      // tooltips for navbar buttons only (not dropdown items)
      if (!isMobileDevice) {
        setTippy(remotePeerName, "Tên người tham gia", "bottom");
        setTippy(remoteHandStatusIcon, "Người tham gia đang giơ tay", "bottom");
        setTippy(remoteVideoStatusIcon, "Video người tham gia đang bật", "bottom");
        setTippy(remoteAudioStatusIcon, "Âm thanh người tham gia đang bật", "bottom");
        setTippy(remoteVideoPiPBtn, "Bật tắt hình trong hình", "bottom");
        setTippy(remoteVideoPinBtn, "Bật tắt ghim video", "bottom");
      }

      // my video avatar image
      remoteVideoAvatarImage.setAttribute("id", peer_id + "_avatar");
      remoteVideoAvatarImage.className = "videoAvatarImage"; // pulsate

      // remote video nav bar
      remoteVideoNavBar.className = "navbar fadein";

      // remote dropdown menu (replaces old expand-video)
      remoteDropdownDiv.className = "navbar-dropdown";
      remoteDropdownBtn.id = peer_id + "_videoDropdownBtn";
      remoteDropdownBtn.className = "fas fa-ellipsis-vertical";
      remoteDropdownContent.className = "navbar-dropdown-content";

      // Build dropdown items
      remoteDropdownContent.appendChild(
        createDropdownItem(
          remoteVideoMirrorBtn,
          "Lật ngược",
          remoteDropdownContent,
        ),
      );
      isVideoFullScreenSupported &&
        remoteDropdownContent.appendChild(
          createDropdownItem(
            remoteVideoFullScreenBtn,
            "Toàn màn hình",
            remoteDropdownContent,
          ),
        );
      buttons.remote.showShareVideoAudioBtn &&
        remoteDropdownContent.appendChild(
          createDropdownItem(
            remoteVideoAudioUrlBtn,
            "Gửi Video/Audio",
            remoteDropdownContent,
          ),
        );
      buttons.remote.showKickOutBtn &&
        remoteDropdownContent.appendChild(
          createDropdownItem(
            remotePeerKickOut,
            "Mời ra khỏi phòng",
            remoteDropdownContent,
            "red",
          ),
        );

      remoteDropdownDiv.appendChild(remoteDropdownBtn);
      // Append dropdown content to body so it escapes overflow:hidden on .Camera
      document.body.appendChild(remoteDropdownContent);
      // Store reference for cleanup on peer removal
      remoteDropdownBtn._dropdownContent = remoteDropdownContent;

      handleDropdownEvents(
        remoteDropdownDiv,
        remoteDropdownBtn,
        remoteDropdownContent,
      );

      // attach to remote video nav bar

      !isMobileDevice && remoteVideoNavBar.appendChild(remoteVideoPinBtn);

      if (showVideoPipBtn && buttons.remote.showVideoPipBtn)
        remoteVideoNavBar.appendChild(remoteVideoPiPBtn);

      remoteVideoNavBar.appendChild(remoteVideoStatusIcon);
      remoteVideoNavBar.appendChild(remoteAudioStatusIcon);

      remoteVideoNavBar.appendChild(remoteHandStatusIcon);

      remoteVideoNavBar.appendChild(remoteDropdownDiv);

      remoteMedia.setAttribute("id", peer_id + "___video");
      remoteMedia.setAttribute("playsinline", true);
      remoteMedia.autoplay = true;
      remoteMedia.muted = true; // audio is handled by a separate <audio> element; muting allows autoplay on Safari
      remoteMediaControls = isMobileDevice ? false : remoteMediaControls;
      remoteMedia.style.objectFit = "var(--video-object-fit)";
      remoteMedia.style.name = peer_id + "_typeCam";
      remoteMedia.controls = remoteMediaControls;

      remoteVideoWrap.className = "Camera";
      remoteVideoWrap.setAttribute("id", peer_id + "_videoWrap");
      remoteVideoWrap.style.display = isHideALLVideosActive ? "none" : "block";

      // add elements to videoWrap div
      remoteVideoWrap.appendChild(remoteVideoNavBar);
      remoteVideoWrap.appendChild(remoteVideoAvatarImage);
      remoteVideoWrap.appendChild(remoteMedia);
      remoteVideoWrap.appendChild(remotePeerName);

      createVideoLoadingSpinner(remoteVideoWrap, remoteMedia);

      // need later on disconnect or remove peers
      peerVideoMediaElements[remoteMedia.id] = remoteVideoWrap;

      // append all elements to videoMediaContainer
      videoMediaContainer.appendChild(remoteVideoWrap);
      // attachMediaStream is a part of the adapter.js library
      attachMediaStream(remoteMedia, stream);
      // Explicitly play – required on mobile Safari where autoplay alone is not enough
      remoteMedia.play().catch(() => {});
      // Nothing in this app ever calls .pause() on a peer's live stream -
      // if it pauses anyway (mobile Safari's native tap-to-pause gesture
      // on a <video>, even with no `controls` attribute), just resume
      // immediately so a stray tap can never actually stop playback.
      remoteMedia.addEventListener("pause", () => {
        if (!remoteMedia.ended) remoteMedia.play().catch(() => {});
      });
      if (typeof isInPagePip !== "undefined" && isInPagePip) syncPipVideoSource();

      // resize video elements
      adaptAspectRatio();

      // handle video to image

      // handle video pin/unpin
      handleVideoPinUnpin(
        remoteMedia.id,
        remoteVideoPinBtn.id,
        remoteVideoWrap.id,
        peer_id,
      );

      // handle video toggle mirror
      handleVideoToggleMirror(remoteMedia.id, remoteVideoMirrorBtn.id);

      // handle vide picture in picture
      if (showVideoPipBtn && buttons.remote.showVideoPipBtn)
        handlePictureInPicture(remoteVideoPiPBtn.id, remoteMedia.id, peer_id);

      // handle video full screen mode
      isVideoFullScreenSupported &&
        handleVideoPlayerFs(
          remoteMedia.id,
          remoteVideoFullScreenBtn.id,
          peer_id,
        );

      // handle file share drag and drop

      // handle kick out button event
      buttons.remote.showKickOutBtn && handlePeerKickOutBtn(peer_id);

      // refresh remote peers avatar name
      setPeerAvatarImgName(remoteVideoAvatarImage.id, peer_name, peer_avatar);
      // refresh remote peers hand icon status and title
      setPeerHandStatus(peer_id, peer_name, peer_hand_status);
      // refresh remote peers video icon status and title
      setPeerVideoStatus(peer_id, peer_video_status);
      // refresh remote peers audio icon status and title
      setPeerAudioStatus(peer_id, peer_audio_status);
      // handle remote peers audio on-off
      handlePeerAudioBtn(peer_id);
      // handle remote peers video on-off
      handlePeerVideoBtn(peer_id);

      // handle remote send file
      // handle remote video - audio URL
      buttons.remote.showShareVideoAudioBtn &&
        handlePeerVideoAudioUrl(peer_id, remoteVideoAudioUrlBtn.id);

      // show status menu
      toggleClassElements("statusMenu", "inline");

      // notify if peer started to recording own screen + audio
      if (peer_rec_status)
        notifyRecording(peer_id, peer_name, peer_avatar, "Started");

      // Handle different video/screen states
      if (!peer_video_status && !peer_screen_status) {
        // Camera OFF, Screen OFF - show avatar
        console.log("[LOAD REMOTE] Camera OFF, Screen OFF - showing avatar");
        videoIsOff();
      } else if (!peer_video_status && peer_screen_status) {
        // Camera OFF, Screen ON - show avatar on video tile, screen tile will be created when track arrives
        console.log(
          "[LOAD REMOTE] Camera OFF, Screen ON - showing avatar, waiting for screen track",
        );
        videoIsOff();
      } else if (peer_video_status && !peer_screen_status) {
        // Camera ON, Screen OFF - video track will show
        console.log("[LOAD REMOTE] Camera ON, Screen OFF - video track active");
        // Avatar hidden by default, video track will display
      } else {
        // Both camera and screen on
        console.log("[LOAD REMOTE] Both Camera and Screen ON");
      }

      function videoIsOff() {
        displayElements([
          { element: remoteMedia, display: false },
          { element: remoteVideoAvatarImage, display: true, mode: "block" },
        ]);
        setMediaButtonsClass([
          { element: remoteVideoStatusIcon, status: false, mediaType: "video" },
        ]);
        const spinner = remoteVideoWrap.querySelector(".video-loading-spinner");
        if (spinner) elemDisplay(spinner, false);
      }
      break;
    case "screen":
      console.log("SETUP REMOTE SCREEN STREAM");

      // Remote screen elements
      const remoteScreenWrap = document.createElement("div");
      const remoteScreenMedia = document.createElement("video");

      // html elements
      const remoteScreenNavBar = document.createElement("div");
      const remoteScreenPeerName = document.createElement("p");
      const remoteScreenFullScreenBtn = document.createElement("button");
      const remoteScreenPinBtn = document.createElement("button");
      const remoteScreenPiPBtn = document.createElement("button");
      const remoteScreenVideoAudioUrlBtn = document.createElement("button");

      const remoteScreenAvatarImage = document.createElement("img");

      // IDs and classes
      remoteScreenPeerName.setAttribute("id", peer_id + "_screen_name");
      remoteScreenPeerName.className = "videoPeerName notranslate fadein";
      // Plain name + a screen-share icon badge (not literal "(screen)"
      // text) - matches the reference's isScreenSharing badge in the
      // name pill, and mirrors the local screen tile's own name tag.
      setPeerNameHTML(remoteScreenPeerName, peer_name, false, peer_id, true);

      remoteScreenVideoAudioUrlBtn.setAttribute(
        "id",
        peer_id + "_screen_videoAudioUrl",
      );
      remoteScreenVideoAudioUrlBtn.className = className.shareVideoAudio;

      remoteScreenFullScreenBtn.setAttribute(
        "id",
        peer_id + "_screen_fullScreen",
      );
      remoteScreenFullScreenBtn.className = className.fullScreen;

      remoteScreenPiPBtn.setAttribute("id", peer_id + "screenPIP");
      remoteScreenPiPBtn.className = className.pip;

      remoteScreenPinBtn.setAttribute("id", peer_id + "_screen_pinUnpin");
      remoteScreenPinBtn.className = className.pinUnpin;

      if (!isMobileDevice) {
        setTippy(remoteScreenPeerName, "Màn hình người tham gia", "bottom");
        setTippy(remoteScreenVideoAudioUrlBtn, "Gửi Video hoặc Audio", "bottom");

        setTippy(remoteScreenFullScreenBtn, "Chế độ toàn màn hình", "bottom");
        setTippy(remoteScreenPiPBtn, "Bật tắt hình trong hình", "bottom");
        setTippy(remoteScreenPinBtn, "Bật tắt ghim màn hình", "bottom");
      }

      remoteScreenAvatarImage.setAttribute("id", peer_id + "_screen_avatar");
      remoteScreenAvatarImage.className = "videoAvatarImage";

      remoteScreenNavBar.className = "navbar fadein";

      !isMobileDevice && remoteScreenNavBar.appendChild(remoteScreenPinBtn);

      remoteScreenNavBar.appendChild(remoteScreenPiPBtn);
      isVideoFullScreenSupported &&
        remoteScreenNavBar.appendChild(remoteScreenFullScreenBtn);

      buttons.remote.showShareVideoAudioBtn &&
        remoteScreenNavBar.appendChild(remoteScreenVideoAudioUrlBtn);

      remoteScreenMedia.setAttribute("id", peer_id + "___screen");
      remoteScreenMedia.setAttribute("playsinline", true);
      remoteScreenMedia.autoplay = true;
      remoteScreenMedia.muted = true; // audio is handled by a separate <audio> element; muting allows autoplay on Safari
      remoteScreenMedia.controls = remoteMediaControls;
      remoteScreenMedia.style.objectFit = "contain";
      remoteScreenMedia.style.name = peer_id + "_typeScreen";

      remoteScreenWrap.className = "Screen";
      remoteScreenWrap.setAttribute("id", peer_id + "_screenWrap");
      remoteScreenWrap.style.display = isHideALLVideosActive ? "none" : "block";

      remoteScreenWrap.appendChild(remoteScreenNavBar);
      remoteScreenWrap.appendChild(remoteScreenAvatarImage);
      remoteScreenWrap.appendChild(remoteScreenMedia);
      remoteScreenWrap.appendChild(remoteScreenPeerName);

      createVideoLoadingSpinner(remoteScreenWrap, remoteScreenMedia);

      // need later on disconnect or remove peers
      peerScreenMediaElements[remoteScreenMedia.id] = remoteScreenWrap;

      videoMediaContainer.appendChild(remoteScreenWrap);
      attachMediaStream(remoteScreenMedia, stream);
      // Explicitly play – required on mobile Safari where autoplay alone is not enough
      remoteScreenMedia.play().catch(() => {});
      // Same defensive auto-resume as the camera tile above - tapping a
      // shared-screen video was pausing it on mobile even though nothing
      // in this app ever pauses it intentionally.
      remoteScreenMedia.addEventListener("pause", () => {
        if (!remoteScreenMedia.ended) remoteScreenMedia.play().catch(() => {});
      });
      if (typeof isInPagePip !== "undefined" && isInPagePip) syncPipVideoSource();
      adaptAspectRatio();
      // The tile just got created - make sure it doesn't sit stacked
      // next to the camera tile in solo mode (single-video-per-peer UI)
      updateSoloScreenTileVisibility();

      // handle remote send file
      // handle remote video - audio URL
      buttons.remote.showShareVideoAudioBtn &&
        handlePeerVideoAudioUrl(peer_id, remoteScreenVideoAudioUrlBtn.id);

      // screen to image

      // pin/unpin video
      handleVideoPinUnpin(
        remoteScreenMedia.id,
        remoteScreenPinBtn.id,
        remoteScreenWrap.id,
        peer_id,
        true,
      );

      // Auto-pin is a group-call feature (splits the stage 25/75 to
      // spotlight one tile among several). In a 1-on-1 call skip it so
      // the screen tile just fills the stage normally, matching the
      // reference's single swapped video (camera tile hidden via
      // updateSoloScreenTileVisibility above).
      if (Object.keys(peerConnections).length !== 1) {
        remoteScreenPinBtn.click();
      }

      if (showVideoPipBtn && buttons.remote.showVideoPipBtn)
        handlePictureInPicture(
          remoteScreenPiPBtn.id,
          remoteScreenMedia.id,
          peer_id,
        );

      isVideoFullScreenSupported &&
        handleVideoPlayerFs(
          remoteScreenMedia.id,
          remoteScreenFullScreenBtn.id,
          peer_id,
        );
      break;
    case "audio":
      // alert('remote audio');
      console.log("SETUP REMOTE AUDIO STREAM");
      // handle remote audio elements
      const remoteAudioWrap = document.createElement("div");
      const remoteAudioMedia = document.createElement("audio");
      remoteAudioMedia.id = peer_id + "___audio";
      remoteAudioMedia.volume = 1.0;
      remoteAudioMedia.autoplay = true;
      remoteAudioMedia.controls = false;

      if (!hasAudioTrack(stream)) {
        remoteAudioMedia.muted = true;
      }

      remoteAudioWrap.appendChild(remoteAudioMedia);
      audioMediaContainer.appendChild(remoteAudioWrap);
      attachMediaStream(remoteAudioMedia, stream);
      peerAudioMediaElements[remoteAudioMedia.id] = remoteAudioWrap;

      // Explicitly play audio to ensure it starts (handles autoplay policies)
      remoteAudioMedia.play().catch((err) => {
        console.warn(
          "[AUDIO] Autoplay prevented for " +
            peer_name +
            ", waiting for user interaction:",
          err,
        );
        handleAudioFallback(remoteAudioMedia, peer_name);
      });

      // Change audio output if supported and audioOutputSelect is present
      if (sinkId && audioOutputSelect && audioOutputSelect.value) {
        try {
          await changeAudioDestination(remoteAudioMedia, false);
        } catch (e) {
          console.warn(
            "[AUDIO] changeAudioDestination failed for " + peer_name,
            e,
          );
        }
      }
      break;
    default:
      break;
  }
}

/**
 * Create a dropdown item for the navbar dropdown menu
 * @param {HTMLElement} btnEl the button element to trigger the action
 * @param {string} label the text label for the dropdown item
 * @param {HTMLElement} dropdownContent the dropdown content panel (appended to body)
 * @param {string} [color] optional color for the button and label
 */
function createDropdownItem(btnEl, label, dropdownContent, color) {
  const item = document.createElement("div");
  item.className = "navbar-dropdown-item";
  item.appendChild(btnEl);
  const span = document.createElement("span");
  span.textContent = label;
  item.appendChild(span);
  if (color) {
    btnEl.style.setProperty("color", color, "important");
    span.style.setProperty("color", color, "important");
  }
  let dispatching = false;
  item.addEventListener("click", (e) => {
    if (dispatching) return;
    e.stopPropagation();
    dispatching = true;
    btnEl.click();
    dispatching = false;
    if (dropdownContent) dropdownContent.classList.remove("show");
  });
  return item;
}

/**
 * Handle dropdown hover/touch events for navbar dropdown menus
 * @param {HTMLElement} dropdownDiv the wrapper div
 * @param {HTMLElement} dropdownBtn the trigger button
 * @param {HTMLElement} dropdownContent the dropdown content panel (appended to body)
 */
function handleDropdownEvents(dropdownDiv, dropdownBtn, dropdownContent) {
  let closeTimer = null;

  function showDropdown() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    const rect = dropdownBtn.getBoundingClientRect();
    dropdownContent.style.top = rect.bottom + 2 + "px";
    dropdownContent.style.right = window.innerWidth - rect.right + "px";
    dropdownContent.style.left = "auto";
    document.querySelectorAll(".navbar-dropdown-content.show").forEach((el) => {
      if (el !== dropdownContent) el.classList.remove("show");
    });
    dropdownContent.classList.add("show");
  }

  function scheduleClose() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      dropdownContent.classList.remove("show");
      closeTimer = null;
    }, 200);
  }

  // Desktop: open on hover
  dropdownDiv.addEventListener("mouseenter", () => showDropdown());

  // Close with delay when mouse leaves both the button and the dropdown content
  dropdownDiv.addEventListener("mouseleave", (e) => {
    if (!dropdownContent.contains(e.relatedTarget)) {
      scheduleClose();
    }
  });
  dropdownContent.addEventListener("mouseenter", () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  });
  dropdownContent.addEventListener("mouseleave", (e) => {
    if (!dropdownDiv.contains(e.relatedTarget)) {
      scheduleClose();
    }
  });

  // Mobile: toggle on tap
  dropdownBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropdownContent.classList.contains("show")) {
      dropdownContent.classList.remove("show");
    } else {
      showDropdown();
    }
  });
}

/**
 * Handle remote audio fallback
 * @param {object} audioMedia
 * @param {string} peer_name
 */
function handleAudioFallback(audioMedia, peer_name) {
  if (!audioMedia) return;
  // Fallback: play audio on first user interaction
  const playOnInteraction = () => {
    audioMedia
      .play()
      .then(() => {
        console.log(
          "[AUDIO] Audio started after user interaction for " + peer_name,
        );
        document.removeEventListener("click", playOnInteraction);
        document.removeEventListener("touchstart", playOnInteraction);
        document.removeEventListener("keydown", playOnInteraction);
      })
      .catch((e) => console.error("[AUDIO] Failed to play audio:", e));
  };
  document.addEventListener("click", playOnInteraction, { once: true });
  document.addEventListener("touchstart", playOnInteraction, { once: true });
  document.addEventListener("keydown", playOnInteraction, { once: true });
}

/**
 * Log stream settings info
 * @param {string} name function name called from
 * @param {object} stream media stream audio - video
 */
function logStreamSettingsInfo(name, stream) {
  if ((useVideo || isScreenStreaming) && hasVideoTrack(stream)) {
    const videoTrack = getVideoTrack(stream);
    if (videoTrack) {
      console.log(name, {
        video: {
          label: videoTrack.label,
          settings: videoTrack.getSettings(),
        },
      });
    }
  }
  if (useAudio && hasAudioTrack(stream)) {
    const audioTrack = getAudioTrack(stream);
    if (audioTrack) {
      console.log(name, {
        audio: {
          label: audioTrack.label,
          settings: audioTrack.getSettings(),
        },
      });
    }
  }
}

/**
 * Handle aspect ratio
 * ['0:0', '4:3', '16:9', '1:1', '1:2'];
 *    0      1       2      3      4
 */
function adaptAspectRatio() {
  let participantsCount = videoMediaContainer.childElementCount;
  let desktop = 2,
    mobile = 2; // 16:9 for 1-4 people

  if (participantsCount > 4) {
    desktop = 1; // 4:3
    mobile = 1;
  }
  if (participantsCount > 9) {
    desktop = 3; // 1:1
    mobile = 3;
  }

  setAspectRatio(isMobileDevice ? mobile : desktop);
}

/**
 * Get Gravatar from email
 * @param {string} email
 * @param {integer} size
 * @returns object image
 */
function genGravatar(email, size = false) {
  const hash = md5(email.toLowerCase().trim());
  const gravatarURL =
    `https://www.gravatar.com/avatar/${hash}` +
    (size ? `?s=${size}` : "?s=250");
  return gravatarURL;
  function md5(input) {
    return CryptoJS.MD5(input).toString();
  }
}

/**
 * Check if valid email
 * @param {string} email
 * @returns boolean
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Create round svg image with first 2 letters of peerName in center
 * Thank you: https://github.com/phpony
 *
 * @param {string} peerName
 * @param {integer} avatarImgSize width and height in px
 */
function genAvatarSvg(peerName, avatarImgSize) {
  const initial = peerName ? peerName.charAt(0).toUpperCase() : "?";
  // Mobile tiles render this whole SVG much smaller, so the original
  // circle/text spacing (tuned for desktop) reads as the avatar
  // "touching" the name below it. Shrink + shift the circle up and add
  // clearance before the name text, mobile only - desktop keeps the
  // original cy=160/r=50/175/245/275 layout untouched.
  const circleCy = isMobileDevice ? 138 : 160;
  const circleR = isMobileDevice ? 40 : 50;
  const initialY = isMobileDevice ? 152 : 175;
  const nameY = isMobileDevice ? 252 : 245;
  const captionY = isMobileDevice ? 282 : 275;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
    <rect width="100%" height="100%" fill="#0b1a2e" />
    <defs>
      <linearGradient id="grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#16324f" />
        <stop offset="100%" stop-color="#24406b" />
      </linearGradient>
    </defs>
    <circle cx="200" cy="${circleCy}" r="${circleR}" fill="url(#grad)" stroke="#3c6693" stroke-width="4" />
    <text x="200" y="${initialY}" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="bold" fill="#dceaf3" text-anchor="middle">${initial}</text>
    <text x="200" y="${nameY}" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="500" fill="#c7dbec" text-anchor="middle">${truncateDisplayName(peerName)}</text>
    <text x="200" y="${captionY}" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#6f94b8" text-anchor="middle">Camera đang tắt</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/**
 * Refresh video - chat image avatar on name changes: https://eu.ui-avatars.com/
 * @param {string} videoAvatarImageId element id
 * @param {string} peerName
 * @param {string} peerAvatar
 */
function setPeerAvatarImgName(videoAvatarImageId, peerName, peerAvatar) {
  const videoAvatarImageElement = getId(videoAvatarImageId);
  if (!videoAvatarImageElement) return;
  videoAvatarImageElement.style.pointerEvents = "none";

  // If a valid avatar image URL is provided
  if (peerAvatar && isValidAvatarURL(peerAvatar)) {
    videoAvatarImageElement.setAttribute("src", peerAvatar);
    // Generated SVG avatars already draw their own circular badge -
    // an arbitrary external image doesn't, so frame it in a circle
    // (see .videoAvatarImage.is-external-avatar in videoGrid.css).
    videoAvatarImageElement.classList.add("is-external-avatar");
  }
  // If not, use SVG based on the email validity
  else if (useAvatarSvg) {
    const avatarImgSize = isMobileDevice ? 128 : 256;
    const avatarImgSvg = isValidEmail(peerName)
      ? genGravatar(peerName)
      : genAvatarSvg(peerName, avatarImgSize);
    videoAvatarImageElement.setAttribute("src", avatarImgSvg);
    videoAvatarImageElement.classList.remove("is-external-avatar");
  }
  // Default fallback avatar
  else {
    videoAvatarImageElement.setAttribute("src", images.avatar);
    videoAvatarImageElement.classList.remove("is-external-avatar");
  }
}

/**
 * Sync the floating solo self-view's compact camera-off badge with my
 * actual chosen avatar photo (circular). Falls back to the generic user
 * icon when no real avatar is set - the generated name/initial SVG is
 * designed for the big tile treatment and looks wrong cropped this small.
 */
function updateSoloCompactAvatar() {
  const img = getId("mySoloAvatarImg");
  const icon = getId("mySoloAvatarIcon");
  if (!img || !icon) return;

  if (myPeerAvatar && isValidAvatarURL(myPeerAvatar)) {
    img.src = myPeerAvatar;
    img.style.display = "block";
    icon.style.display = "none";
  } else {
    img.style.display = "none";
    icon.style.display = "";
  }
}

/**
 * Set Chat avatar image by peer name
 * @param {string} avatar position left/right
 * @param {string} peerName me or peer name
 * @param {string} peerAvatar me or peer avatar
 */
function setPeerChatAvatarImgName(avatar, peerName, peerAvatar) {
  const avatarImg =
    peerAvatar && isValidAvatarURL(peerAvatar)
      ? peerAvatar
      : isValidEmail(peerName)
        ? genGravatar(peerName)
        : genAvatarSvg(peerName, 32);

  switch (avatar) {
    case "left":
      // console.log("Set Friend chat avatar image");
      leftChatAvatar = avatarImg;
      break;
    case "right":
      // console.log("Set My chat avatar image");
      rightChatAvatar = avatarImg;
      break;
    default:
      break;
  }
}

/**
 * Handle Video Toggle Mirror
 * @param {string} videoId
 * @param {string} videoToggleMirrorBtnId
 */
function handleVideoToggleMirror(videoId, videoToggleMirrorBtnId) {
  const videoPlayer = getId(videoId);
  const videoToggleMirrorBtn = getId(videoToggleMirrorBtnId);
  if (videoPlayer && videoToggleMirrorBtn) {
    // Toggle video mirror
    videoToggleMirrorBtn.addEventListener("click", (e) => {
      videoPlayer.classList.toggle("mirror");
    });
  }
}

/**
 * On video player click, go on full screen mode ||
 * On button click, go on full screen mode.
 * Press Esc to exit from full screen mode, or click again.
 * @param {string} videoId uuid video element
 * @param {string} videoFullScreenBtnId uuid full screen btn
 * @param {string} peer_id socket.id
 */
function handleVideoPlayerFs(videoId, videoFullScreenBtnId, peer_id = null) {
  const videoPlayer = getId(videoId);
  const videoFullScreenBtn = getId(videoFullScreenBtnId);

  if (!videoPlayer || !videoFullScreenBtn) return;

  // Prefer fullscreen on the wrapper tile (.Camera/.Screen) to avoid browser-specific fullscreen video behaviors
  const videoWrap =
    videoPlayer.closest(".Camera, .Screen") || videoPlayer.parentElement;
  const fsTarget = videoWrap || videoPlayer;

  // Detect if this fullscreen handler is attached to a screen-share tile
  const isScreenTile =
    !!videoPlayer.closest(".Screen") ||
    String(videoId).includes("___screen") ||
    String(videoPlayer.style?.name || "").includes("typeScreen");

  const getFsElement = () =>
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null;

  const requestFs = (el) => {
    if (!el) return;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
  };

  const exitFs = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitCancelFullScreen)
      return document.webkitCancelFullScreen();
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
  };

  const sync = () => {
    // if Controls enabled, or document on FS do nothing
    if (videoPlayer.controls || isDocumentOnFullScreen) return;

    const fsEl = getFsElement();
    isVideoOnFullScreen = !!fsEl;

    const isThisTargetFullscreen = fsEl === fsTarget || fsEl === videoPlayer;
    videoPlayer.style.pointerEvents = isThisTargetFullscreen ? "none" : "auto";
  };

  // Attach fullscreen sync listeners once per video element
  if (!videoPlayer.dataset.fsSyncAttached) {
    videoPlayer.dataset.fsSyncAttached = "1";
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    document.addEventListener("mozfullscreenchange", sync);
    document.addEventListener("MSFullscreenChange", sync);
  }

  // on button click go on FS mobile/desktop
  videoFullScreenBtn.addEventListener("click", (e) => {
    gotoFS();
    setTimeout(sync, 0);
  });

  // A plain click on any video (mine or the other person's, mobile or
  // desktop) must never zoom it full-screen - only the dedicated
  // fullscreen button enters FS. Clicking still exits if already FS.
  videoPlayer.addEventListener("click", (e) => {
    if (isVideoOnFullScreen) handleFSVideo();
  });

  function gotoFS() {
    // handle remote peer video/screen fs
    if (peer_id !== null) {
      if (isScreenTile) {
        const remoteScreenStatusBtn = getId(peer_id + "_screenStatus");
        if (
          !remoteScreenStatusBtn ||
          remoteScreenStatusBtn.className === className.videoOn
        ) {
          handleFSVideo();
        } else {
          showMsg();
        }
        return;
      }

      const remoteVideoStatusBtn = getId(peer_id + "_videoStatus");
      if (
        remoteVideoStatusBtn &&
        remoteVideoStatusBtn.className === className.videoOn
      ) {
        handleFSVideo();
      } else {
        showMsg();
      }
    } else {
      // handle local video fs
      if (
        myVideoStatusIcon.className === className.videoOn ||
        isScreenStreaming
      ) {
        handleFSVideo();
      } else {
        showMsg();
      }
    }
  }

  function showMsg() {
    // No-op: fullscreen silently does nothing while video is off.
  }

  function handleFSVideo() {
    // if Controls enabled, or document on FS do nothing
    if (videoPlayer.controls || isDocumentOnFullScreen) return;

    const fsEl = getFsElement();
    const isThisTargetFullscreen = fsEl === fsTarget || fsEl === videoPlayer;

    if (!fsEl) {
      requestFs(fsTarget);
    } else if (isThisTargetFullscreen) {
      exitFs();
    } else {
      // Exit the current fullscreen first, then enter fullscreen for this target
      Promise.resolve(exitFs()).finally(() => requestFs(fsTarget));
    }
  }
}

/**
 * Handle video pin/unpin
 * @param {string} elemId video id
 * @param {string} pnId button pin id
 * @param {string} camId video wrap id
 * @param {string} peerId peer id
 * @param {boolean} isScreen stream
 */
function handleVideoPinUnpin(elemId, pnId, camId, peerId, isScreen = false) {
  const videoPlayer = getId(elemId);
  const btnPn = getId(pnId);
  const cam = getId(camId);
  if (btnPn && videoPlayer && cam) {
    btnPn.addEventListener("click", () => {
      if (isMobileDevice) return;
      playSound("click");
      isVideoPinned = !isVideoPinned;
      if (isVideoPinned) {
        if (!videoPlayer.classList.contains("videoCircle")) {
          videoPlayer.style.objectFit = "contain";
        }
        cam.className = "";
        cam.style.width = "100%";
        cam.style.height = "100%";
        toggleVideoPin("vertical");
        videoPinMediaContainer.appendChild(cam);
        elemDisplay(videoPinMediaContainer, true, "block");
        pinnedVideoPlayerId = elemId;
        setColor(btnPn, "lime");
      } else {
        if (pinnedVideoPlayerId != videoPlayer.id) {
          isVideoPinned = true;
          return;
        }
        if (!isScreenStreaming)
          videoPlayer.style.objectFit = "var(--video-object-fit)";
        if (isScreen || videoPlayer.style.name == peerId + "_typeScreen")
          videoPlayer.style.objectFit = "contain";
        videoPinMediaContainer.removeChild(cam);
        cam.className = isScreen ? "Screen" : "Camera";
        videoMediaContainer.appendChild(cam);
        removeVideoPinMediaContainer(peerId, true);
        setColor(btnPn, "white");
      }
      adaptAspectRatio();
    });
  }
}

function toggleVideoPin(position) {
  if (!isVideoPinned) return;
  switch (position) {
    case "top":
      videoPinMediaContainer.style.top = "25%";
      videoPinMediaContainer.style.width = "100%";
      videoPinMediaContainer.style.height = "70%";
      videoMediaContainer.style.top = 0;
      videoMediaContainer.style.width = "100%";
      videoMediaContainer.style.height = "25%";
      videoMediaContainer.style.right = 0;
      break;
    case "vertical":
      videoPinMediaContainer.style.top = 0;
      videoPinMediaContainer.style.width = "75%";
      videoPinMediaContainer.style.height = "100%";
      videoMediaContainer.style.top = 0;
      videoMediaContainer.style.width = "25%";
      videoMediaContainer.style.height = "100%";
      videoMediaContainer.style.right = 0;
      break;
    case "horizontal":
      videoPinMediaContainer.style.top = 0;
      videoPinMediaContainer.style.width = "100%";
      videoPinMediaContainer.style.height = "75%";
      videoMediaContainer.style.top = "75%";
      videoMediaContainer.style.right = null;
      videoMediaContainer.style.width = null;
      videoMediaContainer.style.width = "100% !important";
      videoMediaContainer.style.height = "25%";
      break;
    default:
      break;
  }
  resizeVideoMedia();
}

/**
 * Handle Video Picture in Picture mode
 *
 * @param {string} btnId
 * @param {string} videoId
 * @param {string} peerId
 */
function handlePictureInPicture(btnId, videoId, peerId) {
  const btnPiP = getId(btnId);
  const video = getId(videoId);
  const myVideoStatus = getId("myVideoStatusIcon");
  const remoteVideoStatus = getId(peerId + "_videoStatus");
  btnPiP.addEventListener("click", () => {
    if (video.pictureInPictureElement) {
      video.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      if (
        (myVideoStatus && myVideoStatus.className === className.videoOff) ||
        (remoteVideoStatus &&
          remoteVideoStatus.className === className.videoOff)
      ) {
        return;
      }
      video.requestPictureInPicture().catch((error) => {
        console.error("Failed to enter Picture-in-Picture mode:", error);
        msgPopup("warning", error.message, "top-end", 6000);
        elemDisplay(btnPiP, false);
      });
    }
  });
  if (video) {
    video.addEventListener("leavepictureinpicture", (event) => {
      console.log("Exited PiP mode");
      // Check if the video is paused
      if (video.paused) {
        // Play the video again
        video.play().catch((error) => {
          console.error("Error playing video after exit PIP mode:", error);
        });
      }
    });
  }
}

/**
 * Remove video pin media container
 * @param {string} peer_id aka socket.id
 * @param {boolean} force_remove force to remove
 */
function removeVideoPinMediaContainer(peer_id, force_remove = false) {
  //alert(pinnedVideoPlayerId + '==' + peer_id);
  if (
    (isVideoPinned &&
      (pinnedVideoPlayerId == peer_id + "___video" ||
        pinnedVideoPlayerId == peer_id + "___screen" ||
        pinnedVideoPlayerId == peer_id)) ||
    force_remove
  ) {
    elemDisplay(videoPinMediaContainer, false);
    isVideoPinned = false;
    pinnedVideoPlayerId = null;
    videoMediaContainerUnpin();
    if (isChatPinned) {
      chatPin();
    }
    if (isCaptionPinned) {
    }
    resizeVideoMedia();
  }
}

/**
 * Pin videoMediaContainer
 */
function videoMediaContainerPin() {
  if (!isVideoPinned) {
    videoMediaContainer.style.top = 0;
    videoMediaContainer.style.width = "75%";
    videoMediaContainer.style.height = "100%";
  }
}

/**
 * Unpin videoMediaContainer
 */
function videoMediaContainerUnpin() {
  if (!isVideoPinned) {
    videoMediaContainer.style.top = 0;
    videoMediaContainer.style.right = null;
    videoMediaContainer.style.width = "100%";
    videoMediaContainer.style.height = "100%";
  }
}

/**
 * Handle Video to Img click event
/**
 * Start session time
 */
function startSessionTime() {
  let callStartTime = Date.now();
  let callElapsedSecondsTime = 0;
  if (mySessionTime) elemDisplay(mySessionTime, true);
  setInterval(function printTime() {
    callElapsedSecondsTime++;
    let callElapsedTime = Date.now() - callStartTime;
    if (mySessionTime) mySessionTime.innerText = getTimeToString(callElapsedTime);
    const myCurrentSessionTime = getId("myCurrentSessionTime");
    if (myCurrentSessionTime) {
      myCurrentSessionTime.innerText = secondsToHms(callElapsedSecondsTime);
    }
  }, 1000);
}

/**
 * Refresh my localVideoMediaStream video status
 * @param {MediaStream} localVideoMediaStream
 */
function refreshMyVideoStatus(localVideoMediaStream) {
  if (!localVideoMediaStream) return;
  // check Track video status
  localVideoMediaStream.getTracks().forEach((track) => {
    if (track.kind === "video") {
      myVideoStatus = track.enabled;
    }
  });
}

/**
 * Refresh my localAudioMediaStream audio status
 * @param {MediaStream} localAudioMediaStream
 */
function refreshMyAudioStatus(localAudioMediaStream) {
  if (!localAudioMediaStream) return;
  // check Track audio status
  localAudioMediaStream.getTracks().forEach((track) => {
    if (track.kind === "audio") {
      myAudioStatus = track.enabled;
    }
  });
}

/**
 * Handle WebRTC left buttons
 */
function manageButtons() {
  // Buttons bar
  setShareRoomBtn();
  setRecordStreamBtn();
  setScreenShareBtn();
  setFullScreenBtn();
  setChatRoomBtn();

  // setRoomEmojiButton();

  setDocumentPiPBtn();
  setMySettingsBtn();
  setMySettingsExtraBtns();
  // setAboutBtn();

  // Buttons bottom
  setAudioBtn();
  setVideoBtn();
  setSwapCameraBtn();
  setHideMeButton();
  setMyHandBtn();
  setLeaveRoomBtn();
}

/**
 * Copy - share room url button click event
 */
function setShareRoomBtn() {
  shareRoomBtn.addEventListener("click", async (e) => {
    shareRoomUrl();
  });
  shareRoomBtn.addEventListener("mouseenter", () => {
    if (isMobileDevice || !buttons.main.showShareQr) return;
    elemDisplay(qrRoomPopupContainer, true);
  });
  shareRoomBtn.addEventListener("mouseleave", () => {
    if (isMobileDevice || !buttons.main.showShareQr) return;
    elemDisplay(qrRoomPopupContainer, false);
  });
}

/**
 * Hide myself from room view
 */
function setHideMeButton() {
  hideMeBtn.addEventListener("click", (e) => {
    if (isHideALLVideosActive) {
      return;
    }
    isHideMeActive = !isHideMeActive;
    handleHideMe(isHideMeActive);
  });
}

/**
 * Audio mute - unmute button click event
 */
function setAudioBtn() {
  audioBtn.addEventListener("click", (e) => {
    handleAudio(e, false);
  });

  document.onkeydown = (e) => {
    if (!isPushToTalkActive || isChatRoomVisible) return;
    if (e.code === "Space") {
      if (isSpaceDown) return; // prevent multiple call
      handleAudio(audioBtn, false, true);
      isSpaceDown = true;
      console.log("Push-to-talk: audio ON");
    }
  };
  document.onkeyup = (e) => {
    e.preventDefault();
    if (!isPushToTalkActive || isChatRoomVisible) return;
    if (e.code === "Space") {
      handleAudio(audioBtn, false, false);
      isSpaceDown = false;
      console.log("Push-to-talk: audio OFF");
    }
  };
}

/**
 * Video hide - show button click event
 */
function setVideoBtn() {
  videoBtn.addEventListener("click", async (e) => {
    await handleVideo(e, false);
  });
}

/**
 * Check if can swap or not the cam, if yes show the button else hide it
 */
function setSwapCameraBtn() {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    const videoInput = devices.filter((device) => device.kind === "videoinput");
    if (videoInput.length > 1 && isMobileDevice) {
      swapCameraBtn.addEventListener("click", (e) => {
        swapCamera();
      });
    } else {
      elemDisplay(swapCameraBtn, false);
    }
  });
}

/**
 * Check if i can share the screen, if yes show button else hide it
 */
function setScreenShareBtn() {
  if (
    !isMobileDevice &&
    (navigator.getDisplayMedia || navigator.mediaDevices.getDisplayMedia) &&
    buttons.main.showScreenBtn
  ) {
    isScreenSharingSupported = true;
    initScreenShareBtn.addEventListener("click", async (e) => {
      await toggleScreenSharing(true);
    });
    screenShareBtn.addEventListener("click", async (e) => {
      if (!isScreenStreaming) {
        showPP({
          icon: "screen-share",
          title: "Chia sẻ màn hình?",
          desc: "Bạn có chắc muốn chia sẻ màn hình của mình với mọi người trong phòng không?",
          confirmText: "Chia sẻ",
          cancelText: "Hủy",
          onConfirm: async () => {
            await toggleScreenSharing();
          },
        });
      } else {
        showPP({
          icon: "circle-help",
          title: "Dừng chia sẻ màn hình?",
          desc: "Bạn có chắc muốn dừng chia sẻ màn hình không?",
          confirmText: "Dừng",
          cancelText: "Hủy",
          onConfirm: async () => {
            await toggleScreenSharing();
          },
        });
      }
    });
  } else {
    displayElements([
      { element: initScreenShareBtn, display: false },
      { element: screenShareBtn, display: false },
      { element: screenFpsDiv, display: false },
    ]);
  }
}

/**
 * Start - Stop Stream recording
 */
function setRecordStreamBtn() {
  recordStreamBtn.addEventListener("click", (e) => {
    isStreamRecording ? stopStreamRecording() : startStreamRecording();
  });
  recImage.addEventListener("click", (e) => {
    recordStreamBtn.click();
  });
}

/**
 * Full screen button click event
 */
function setFullScreenBtn() {
  const fsSupported =
    buttons.main.showFullScreenBtn &&
    (document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled);

  if (fsSupported) {
    // detect esc from full screen mode
    document.addEventListener("fullscreenchange", (e) => {
      const fullScreenIcon = fullScreenBtn.querySelector("i");

      let fullscreenElement = document.fullscreenElement;
      if (!fullscreenElement) {
        fullScreenIcon.className = className.fsOff;
        isDocumentOnFullScreen = false;
        if (fullScreenCornerBtn) {
          const cornerIcon = fullScreenCornerBtn.querySelector("i");
          if (cornerIcon) cornerIcon.className = className.fsOff;
        }
      }
    });
    fullScreenBtn.addEventListener("click", (e) => {
      toggleFullScreen();
    });
    // Desktop-only floating twin of fullScreenBtn, fixed at the
    // bottom-right corner of the page instead of tucked in the "..." menu.
    if (fullScreenCornerBtn && !isMobileDevice) {
      elemDisplay(fullScreenCornerBtn, true, "flex");
      fullScreenCornerBtn.addEventListener("click", (e) => {
        toggleFullScreen();
      });
    }
  } else {
    elemDisplay(fullScreenBtn, false);
    elemDisplay(fullScreenCornerBtn, false);
  }
}
function setChatRoomBtn() {
  // Mặc định luôn là chat public
  setActiveConversation("public");

  window.addEventListener("resize", () => {
    if (isChatRoomVisible) {
      if (isMobileDevice) {
        setSP("--msger-width", "99%");
        setSP("--msger-height", "99%");
      } else if (canBePinned() && !isCaptionPinned) {
        if (!isChatPinned) chatPin();
      } else {
        if (isChatPinned) chatUnpin();
        chatCenter();
      }
    }
  });

  // Mở/Đóng khung chat
  chatRoomBtn.addEventListener("click", (e) => {
    !isChatRoomVisible ? showChatRoomDraggable() : hideChatRoomAndEmojiPicker();
  });

  // Nút đóng khung chat
  msgerClose.addEventListener("click", (e) => {
    chatMinimize();
    hideChatRoomAndEmojiPicker();
    showButtonsBarAndMenu();
  });

  // Gửi Link Video/Audio
  if (msgerVideoUrlBtn) {
    msgerVideoUrlBtn.addEventListener("click", (e) => {
      const shareTarget = getConversationShareTarget("video or audio");
      if (!shareTarget) return;
      sendVideoUrl(
        shareTarget.videoPeerId,
        shareTarget.peerName,
        shareTarget.broadcast,
      );
    });
  }

  // Nhấn Enter để gửi - must be keydown (not keyup): a textarea inserts
  // the newline as part of Enter's default action before keyup ever
  // fires, so preventDefault() there is too late to stop it.
  msgerInput.addEventListener("keydown", (e) => {
    if (e.keyCode === 13 && (isMobileDevice || !e.shiftKey)) {
      e.preventDefault();
      msgerSendBtn.click();
    }
  });

  // Tự động điều chỉnh độ cao khung nhập text
  msgerInput.oninput = function () {
    checkLineBreaks();
  };
  msgerInput.onpaste = () => {
    checkLineBreaks();
  };

  // Bấm nút gửi tin nhắn
  if (isMobileDevice) {
    // Tapping a button normally steals focus from the textarea first
    // (on the preceding mousedown/touch), which closes the mobile
    // keyboard. Blocking mousedown's default action keeps focus on
    // msgerInput so the keyboard stays open across sends.
    msgerSendBtn.addEventListener("mousedown", (e) => e.preventDefault());
  }
  msgerSendBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await sendChatMessage();
    if (isMobileDevice) msgerInput.focus();
  });
}

async function sendChatMessage() {
  try {
    if (!msgerInput) return;
    msgerInput.value = filterXSS(msgerInput.value.trim());
    const msg = checkMsg(msgerInput.value);
    if (!msg) {
      msgerInput.value = "";
      isChatPasteTxt = false;
      return;
    }

    myPeerName = filterXSS(myPeerName);

    if (isHtml(myPeerName)) {
      msgerInput.value = "";
      isChatPasteTxt = false;
      return;
    }

    const msgId = createChatMessageId();
    emitMsg(myPeerName, myPeerAvatar, "all", msg, false, myPeerId, msgId);

    appendMessage(myPeerName, rightChatAvatar, "right", msg, false, msgId);

    msgerInput.value = "";
    isChatPasteTxt = false;
    checkLineBreaks();
  } catch (err) {
    console.error("Send error: " + err.message);
  }
}

/**
 * Set my hand button click event
 */
function setMyHandBtn() {
  myHandBtn.addEventListener("click", async (e) => {
    setMyHandStatus();
  });
}

/**

 */
function setDocumentPiPBtn() {
  documentPiPBtn.addEventListener("click", async () => {
    if (!showDocumentPipBtn) return;
    if (documentPictureInPicture.window) {
      documentPictureInPicture.window.close();
      console.log("DOCUMENT PIP close");
      return;
    }
    await documentPictureInPictureOpen();
  });
}

/**
 * Restart documentPictureInPicture
 * @returns void
 */
async function documentPictureInPictureRestart() {
  if (!showDocumentPipBtn || !documentPictureInPicture.window) return;
  documentPictureInPictureClose();
  setTimeout(async () => {
    await documentPictureInPictureOpen();
  }, 300);
}

/**
 *  Close documentPictureInPicture
 */
async function documentPictureInPictureClose() {
  if (!showDocumentPipBtn) return;
  if (documentPictureInPicture.window) {
    documentPictureInPicture.window.close();
    console.log("DOCUMENT PIP close");
  }
}

/**
 * Open documentPictureInPicture
 */
async function documentPictureInPictureOpen() {
  if (!showDocumentPipBtn) return;
  try {
    const pipWindow = await documentPictureInPicture.requestWindow({
      width: 300,
      height: 720,
    });

    function updateCustomProperties() {
      const documentStyle = getComputedStyle(document.documentElement);

      pipWindow.document.documentElement.style = `
                --body-bg: ${documentStyle.getPropertyValue("--body-bg")};
            `;
    }

    updateCustomProperties();

    const pipStylesheet = document.createElement("link");
    const pipVideoContainer = document.createElement("div");

    pipStylesheet.type = "text/css";
    pipStylesheet.rel = "stylesheet";
    pipStylesheet.href = "../css/documentPiP.css";

    pipVideoContainer.className = "pipVideoContainer";

    pipWindow.document.head.append(pipStylesheet);
    pipWindow.document.body.append(pipVideoContainer);

    function cloneVideoElements() {
      let foundVideo = false;

      pipVideoContainer.innerHTML = "";

      [...getSlALL("video")].forEach((video) => {
        console.log("DOCUMENT PIP found video id -----> " + video.id);

        // No video stream detected or is video share from URL...
        if (!video.srcObject || video.id === "videoAudioUrlElement") return;

        // get video element
        const videoPlayer = getId(video.id);

        const isLocalVideo = video.id === "myVideo";

        const isPIPAllowed = !videoPlayer.classList.contains("videoCircle"); // not in privacy mode

        // Check if video can be add on pipVideo
        isLocalVideo
          ? console.log(
              "DOCUMENT PIP LOCAL: PiP allowed? -----> " + isPIPAllowed,
            )
          : console.log(
              "DOCUMENT PIP REMOTE: PiP allowed? -----> " + isPIPAllowed,
            );

        if (!isPIPAllowed) return;

        // Video is ON and not in privacy mode continue....

        foundVideo = true;

        const pipVideo = document.createElement("video");

        pipVideo.classList.add("pipVideo");
        pipVideo.classList.toggle("mirror", video.classList.contains("mirror"));
        pipVideo.srcObject = video.srcObject;
        pipVideo.autoplay = true;
        pipVideo.muted = true;

        pipVideoContainer.append(pipVideo);

        function observeElementClassChanges(element, observerName) {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (
                mutation.type === "attributes" &&
                mutation.attributeName === "class"
              ) {
                console.log(
                  `${observerName}: Element ${mutation.target.id} class changed:`,
                  mutation.target.className,
                );
                cloneVideoElements(); // Or other desired function
              }
            });
          });

          observer.observe(element, {
            attributes: true,
            attributeFilter: ["class"],
          });
          return observer;
        }

        // Start observing for new videos and class changes (Video Privacy ON/OFF)
        if (video) observeElementClassChanges(video, "Video");

        // Get videoStatus...
        const parts = video.id.split("___");
        const peer_id = parts[0];
        const videoStatus = getId(
          isLocalVideo ? "myVideoStatusIcon" : peer_id + "_videoStatus",
        );

        // Start observing for new videosStatus and class changes (video ON/OFF)
        if (videoStatus) observeElementClassChanges(videoStatus, "VideoStatus");
      });

      return foundVideo;
    }

    if (!cloneVideoElements()) {
      documentPictureInPictureClose();
      return;
    }

    const videoObserver = new MutationObserver(() => {
      cloneVideoElements();
    });

    videoObserver.observe(videoMediaContainer, {
      childList: true,
    });

    if (videoMediaContainer) {
      const ro = new ResizeObserver(() => {
        if (typeof resizeVideoMedia === "function") {
          resizeVideoMedia();
        }
      });
      ro.observe(videoMediaContainer);
    }

    const documentObserver = new MutationObserver(() => {
      updateCustomProperties();
    });

    documentObserver.observe(document.documentElement, {
      attributeFilter: ["style"],
    });

    pipWindow.addEventListener("unload", () => {
      videoObserver.disconnect();
      documentObserver.disconnect();
    });
  } catch (err) {
    userLog("warning", err.message, 6000);
  }
}

/**
 * My settings button click event
 */
function setMySettingsBtn() {
  mySettingsBtn.addEventListener("click", (e) => {
    if (isMobileDevice) {
      elemDisplay(bottomButtons, false);
      isButtonsVisible = false;
    }
    hideShowMySettings();
  });
  mySettingsCloseBtn.addEventListener("click", (e) => {
    hideShowMySettings();
  });
  myPeerNameSetBtn.addEventListener("click", (e) => {
    updateMyPeerName();
  });
  myPeerNameSet.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      updateMyPeerName();
    }
  });
  myProfileAvatarUploadBtn.addEventListener("click", async () => {
    await updateMyPeerAvatarByUrl();
  });
  // Sounds
  switchSounds.addEventListener("change", (e) => {
    notifyBySound = e.currentTarget.checked;
    lsSettings.sounds = notifyBySound;
    lS.setSettings(lsSettings);
    playSound("switch");
  });
  switchShare.addEventListener("change", (e) => {
    notify = e.currentTarget.checked;
    lsSettings.share_on_join = notify;
    lS.setSettings(lsSettings);
    playSound("switch");
  });
  switchKeepButtonsVisible.addEventListener("change", (e) => {
    isButtonsBarOver = isKeepButtonsVisible = e.currentTarget.checked;
    lsSettings.keep_buttons_visible = isButtonsBarOver;
    lS.setSettings(lsSettings);
    playSound("switch");
  });

  if (!isDesktopDevice) {
    elemDisplay(pinChatByDefaultRow, false);
  } else {
    switchPinChatByDefault.addEventListener("change", (e) => {
      pinChatByDefault = e.currentTarget.checked;
      lsSettings.pin_chat_by_default = pinChatByDefault;
      lS.setSettings(lsSettings);
      playSound("switch");
    });
  }

  // WakeLock for mobile/tablet - "Không tắt màn hình" is now on by
  // default and the toggle row is hidden entirely (nothing left for the
  // user to choose there). Desktop was already hidden/no-op here.
  if (!isDesktopDevice && isWakeLockSupported()) {
    switchKeepAwake.checked = true;
    applyKeepAwake(true);
    switchKeepAwake.addEventListener("change", (e) => {
      applyKeepAwake(e.currentTarget.checked);
      playSound("switch");
    });
  }
  elemDisplay(keepAwakeButton, false);

  // No IP address row in the "Mạng" tab on mobile - not something
  // people need to see there on a phone.
  if (isMobileDevice) elemDisplay(getId("networkIpRow"), false);

  // Push-to-talk setting row was removed - isPushToTalkActive stays false,
  // so the spacebar shortcut in setAudioBtn() just never activates.

  // Recording pause/resume
  pauseRecBtn.addEventListener("click", (e) => {
    pauseRecording();
  });
  resumeRecBtn.addEventListener("click", (e) => {
    resumeRecording();
  });
}
/**
 * Settings extra buttons
 */
function setMySettingsExtraBtns() {
  // Settings Split Dropdown logic (desktop hover support)
  if (
    settingsSplit &&
    settingsExtraDropdown &&
    settingsExtraToggle &&
    settingsExtraMenu
  ) {
    let showTimeout;
    let hideTimeout;
    function showMenu() {
      clearTimeout(hideTimeout);
      updateSettingsExtraGroups();
      settingsExtraMenu.style.setProperty("display", "block", "important");
    }
    function hideMenu() {
      clearTimeout(showTimeout);

      settingsExtraMenu.style.setProperty("display", "none", "important");
    }
    // Toggle on click (arrow button)
    settingsExtraToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      settingsExtraMenu.style.display === "block" ? hideMenu() : showMenu();
    });

    // Desktop hover support
    const supportsHover = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    if (supportsHover) {
      let closeTimeout;
      const cancelClose = () => {
        if (!closeTimeout) return;
        clearTimeout(closeTimeout);
        closeTimeout = null;
      };
      const scheduleClose = () => {
        cancelClose();
        closeTimeout = setTimeout(() => hideMenu(), 180);
      };
      settingsExtraToggle.addEventListener("mouseenter", () => {
        cancelClose();
        showMenu();
      });
      settingsExtraToggle.addEventListener("mouseleave", scheduleClose);
      settingsExtraMenu.addEventListener("mouseenter", cancelClose);
      settingsExtraMenu.addEventListener("mouseleave", scheduleClose);
    }

    // Optional: close on click outside
    document.addEventListener("click", function (e) {
      if (
        !settingsExtraToggle.contains(e.target) &&
        !settingsExtraMenu.contains(e.target)
      ) {
        hideMenu();
      }
    });
  }
}

function updateSettingsExtraGroups() {
  settingsExtraMenu.querySelectorAll(".extra-menu-group").forEach((header) => {
    const ids = (header.dataset.buttons || "").split(",");
    const anyVisible = ids.some((id) => {
      const btn = document.getElementById(id.trim());
      return (
        btn && !btn.classList.contains("hidden") && btn.style.display !== "none"
      );
    });
    header.style.display = anyVisible ? "" : "none";
  });
  settingsExtraMenu.querySelectorAll(".extra-menu-divider").forEach((div) => {
    let prev = div.previousElementSibling;
    while (prev && !prev.classList.contains("extra-menu-group")) {
      prev = prev.previousElementSibling;
    }
    let next = div.nextElementSibling;
    while (next && !next.classList.contains("extra-menu-group")) {
      next = next.nextElementSibling;
    }
    const prevVisible = prev && prev.style.display !== "none";
    const nextVisible = next && next.style.display !== "none";
    div.style.display = prevVisible && nextVisible ? "" : "none";
  });
}

/**
 * Leave room button click event
 */
function setLeaveRoomBtn() {
  leaveRoomBtn.addEventListener("click", (e) => {
    if (e && e.shiftKey) return leaveRoom(true); // Shift-click: skip confirm
    if (!isPresenter) return leaveRoom();
    toggleExitMenu();
  });
  if (exitLeaveBtn) exitLeaveBtn.onclick = handleExitLeave;

  document.addEventListener("click", handleExitMenuOutsideClick);
}

/**
 * Toggle the exit dropdown menu. The "End room for all" entry is
 * only available to the presenter.
 */
function toggleExitMenu() {
  if (!exitMenu) return leaveRoom();

  exitMenu.classList.toggle("hidden");
}

function handleExitLeave() {
  if (exitMenu) exitMenu.classList.add("hidden");
  leaveRoom();
}

function handleExitMenuOutsideClick(e) {
  if (!exitDropdown || !exitMenu) return;
  if (exitMenu.classList.contains("hidden")) return;
  if (!exitDropdown.contains(e.target)) exitMenu.classList.add("hidden");
}

/**
 * Handle left buttons - status menù show - hide on body mouse move
 */
function handleBodyOnMouseMove() {
  document.body.addEventListener("mousemove", () => {
    showButtonsBarAndMenu();
    resetMobileIdleTimer();
  });
  document.body.addEventListener("touchstart", () => {
    showButtonsBarAndMenu();
    resetMobileIdleTimer();
  });

  const newControlBar = document.getElementById("newControlBar");
  if (newControlBar) {
    // Real mouse hover only - "mouseover"/"mouseout" fire unreliably on
    // touch (a tap can synthesize "mouseover" with no matching "mouseout"),
    // which used to latch isButtonsBarOver=true forever after any tap on
    // the control bar and permanently break mobile auto-hide.
    newControlBar.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      isButtonsBarOver = true;
      resetMobileIdleTimer();
    });
    newControlBar.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      isButtonsBarOver = false;
      resetMobileIdleTimer();
    });
  }

  // Initial call
  resetMobileIdleTimer();
}

let mobileIdleTimer = null;
function resetMobileIdleTimer() {
  if (!isMobileDevice) return; // Only apply auto-hide on mobile
  if (mobileIdleTimer) clearTimeout(mobileIdleTimer);
  mobileIdleTimer = setTimeout(() => {
    // Reference only starts the inactivity-hide countdown once a remote
    // peer is actually in the call (`isInCall && remotePeer`); while still
    // alone waiting for someone to join, controls always stay visible.
    const hasRemotePeer = Object.keys(peerConnections).length > 0;
    if (
      hasRemotePeer &&
      !isButtonsBarOver &&
      isMobileDevice &&
      !isChatRoomVisible &&
      !isMySettingsVisible
    ) {
      hideButtonsBarAndMenu();
    }
  }, 5000); // 5 seconds idle time
}

/**
 * Setup local audio - video devices - theme ...
 */
/**
 * Drive a device-selector widget (truncated label + prev/next buttons)
 * on top of a hidden native <select>, keeping both in sync.
 * @param {HTMLSelectElement} selectEl - the hidden native select (video/audio source/output)
 * @param {HTMLElement} wrapEl - the .device-selector wrapper element
 */
function setupDeviceSelectorUI(selectEl, wrapEl) {
  if (!selectEl || !wrapEl) return;

  const labelEl = wrapEl.querySelector(".device-selector-label");
  const prevBtn = wrapEl.querySelector('[data-dir="prev"]');
  const nextBtn = wrapEl.querySelector('[data-dir="next"]');
  if (!labelEl || !prevBtn || !nextBtn) return;

  const sync = () => {
    const options = selectEl.options;
    const count = options.length;
    const disabled = selectEl.disabled || count === 0;
    const idx = selectEl.selectedIndex;
    const current = idx >= 0 && idx < count ? options[idx] : null;

    labelEl.textContent = current ? current.textContent : "Không có thiết bị";

    // Hide (not just dim) prev/next at the edges: no left arrow at the
    // first device, no right arrow at the last, neither when there's
    // only one device to pick from.
    const hidePrev = disabled || idx <= 0;
    const hideNext = disabled || idx < 0 || idx >= count - 1;
    prevBtn.disabled = hidePrev;
    nextBtn.disabled = hideNext;
    prevBtn.style.display = hidePrev ? "none" : "";
    nextBtn.style.display = hideNext ? "none" : "";
    wrapEl.classList.toggle("disabled", disabled);
  };

  const selectPrev = () => {
    if (selectEl.disabled) return;
    if (selectEl.selectedIndex > 0) {
      selectEl.selectedIndex -= 1;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  const selectNext = () => {
    if (selectEl.disabled) return;
    if (selectEl.selectedIndex < selectEl.options.length - 1) {
      selectEl.selectedIndex += 1;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  prevBtn.addEventListener("click", selectPrev);
  nextBtn.addEventListener("click", selectNext);

  // Keep the widget in sync whenever the underlying select changes,
  // including programmatic repopulation elsewhere in the app that
  // may not always fire a native "change" event.
  selectEl.addEventListener("change", sync);
  new MutationObserver(sync).observe(selectEl, {
    childList: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
  setInterval(sync, 1000);

  sync();
}

function setupMySettings() {
  // device selector widgets (mic/camera/speaker prev/next pickers)
  setupDeviceSelectorUI(videoSelect, getId("videoSourceDeviceSelector"));
  setupDeviceSelectorUI(audioInputSelect, getId("audioSourceDeviceSelector"));
  setupDeviceSelectorUI(audioOutputSelect, getId("audioOutputDeviceSelector"));

  // tab buttons
  tabRoomBtn.addEventListener("click", (e) => {
    openTab(e, "tabRoom");
  });
  tabProfileBtn.addEventListener("click", (e) => {
    openTab(e, "tabProfile");
  });
  tabDevicesBtn.addEventListener("click", (e) => {
    openTab(e, "tabDevices");
  });
  tabNetworkBtn.addEventListener("click", (e) => {
    openTab(e, "tabNetwork");
  });

  // tab media
  shareMediaAudioVideoBtn.addEventListener("click", (e) => {
    const shareTarget = getConversationShareTarget("video or audio");
    if (!shareTarget) return;
    sendVideoUrl(
      shareTarget.videoPeerId,
      shareTarget.peerName,
      shareTarget.broadcast,
    );
  });
  // select audio input
  audioInputSelect.addEventListener("change", async () => {
    playSound("click");
    detectBluetoothHeadset();
    await changeLocalMicrophone(audioInputSelect.value);
    refreshLsDevices();
  });

  // audio options
  switchNoiseSuppression.onchange = async (e) => {
    if (!buttons.settings.customNoiseSuppression) return;
    const desired = e.currentTarget.checked;

    if (desired) {
      lsSettings.mic_noise_suppression = true;
      lS.setSettings(lsSettings);

      const ok = await enableNoiseSuppression();
      if (!ok) {
        lsSettings.mic_noise_suppression = false;
        lS.setSettings(lsSettings);
        switchNoiseSuppression.checked = false;
      } else {
        playSound("switch");
      }
    } else {
      lsSettings.mic_noise_suppression = false;
      lS.setSettings(lsSettings);
      await disableNoiseSuppression(true);
      playSound("switch");
    }
    switchNoiseSuppression.blur();
  };

  // select audio output
  audioOutputSelect.addEventListener("change", async () => {
    playSound("click");
    await changeAudioDestination();
    refreshLsDevices();
  });
  // select video input
  videoSelect.addEventListener("change", async () => {
    playSound("click");
    await changeLocalCamera(videoSelect.value);
    await handleLocalCameraMirror();
    await documentPictureInPictureRestart();
    refreshLsDevices();
  });
  // select video quality
  videoQualitySelect.addEventListener("change", async (e) => {
    await setLocalVideoQuality();
  });

  // Firefox may not handle well...
  if (isFirefox) {
    elemDisplay(videoFpsDiv, false);
  }

  // select video fps
  videoFpsSelect.addEventListener("change", (e) => {
    videoMaxFrameRate = parseInt(videoFpsSelect.value, 10);
    setLocalMaxFps(videoMaxFrameRate);
    lsSettings.video_fps = e.currentTarget.selectedIndex;
    lS.setSettings(lsSettings);
  });
  // select screen fps
  screenFpsSelect.addEventListener("change", (e) => {
    screenMaxFrameRate = parseInt(screenFpsSelect.value, 10);
    if (isScreenStreaming) setLocalMaxFps(screenMaxFrameRate, "screen");
    lsSettings.screen_fps = e.currentTarget.selectedIndex;
    lS.setSettings(lsSettings);
  });

  // Mobile not support screen sharing
  if (isMobileDevice) {
    screenFpsSelect.value = null;
    screenFpsSelect.disabled = true;
  }
  // video object fit
  videoObjFitSelect.addEventListener("change", (e) => {
    lsSettings.video_obj_fit = videoObjFitSelect.selectedIndex;
    lS.setSettings(lsSettings);
    setSP("--video-object-fit", videoObjFitSelect.value);
  });

  lockRoomBtn.addEventListener("click", (e) => {
    handleRoomAction({ action: "lock" }, true);
  });
  unlockRoomBtn.addEventListener("click", (e) => {
    handleRoomAction({ action: "unlock" }, true);
  });
}

/**
 * Load settings from local storage
 */
function loadSettingsFromLocalStorage() {
  showChatOnMessage = lsSettings.show_chat_on_msg;
  transcriptShowOnMsg =
    lsSettings.transcript_show_on_msg !== undefined
      ? lsSettings.transcript_show_on_msg
      : true;
  transcriptSendToAll =
    lsSettings.transcript_send_to_all !== undefined
      ? lsSettings.transcript_send_to_all
      : true;

  pinChatByDefault = lsSettings.pin_chat_by_default;
  screenFpsSelect.selectedIndex = lsSettings.screen_fps;

  videoFpsSelect.selectedIndex = lsSettings.video_fps;
  screenFpsSelectedIndex = screenFpsSelect.selectedIndex;
  videoFpsSelectedIndex = videoFpsSelect.selectedIndex;
  screenMaxFrameRate = parseInt(getSelectedIndexValue(screenFpsSelect), 10);
  videoMaxFrameRate = parseInt(getSelectedIndexValue(videoFpsSelect), 10);
  notifyBySound = lsSettings.sounds;
  isKeepButtonsVisible = lsSettings.keep_buttons_visible;

  switchSounds.checked = notifyBySound;
  switchShare.checked = notify;
  switchKeepButtonsVisible.checked = isKeepButtonsVisible;
  switchPinChatByDefault.checked = pinChatByDefault;

  switchNoiseSuppression.checked = lsSettings.mic_noise_suppression;

  videoObjFitSelect.selectedIndex = lsSettings.video_obj_fit;
  setSP("--video-object-fit", videoObjFitSelect.value);
  toggleVideoPin("vertical");
}

/**
 * Get value from element selected index
 * @param {object} elem
 * @returns any value
 */
function getSelectedIndexValue(elem) {
  return elem.options[elem.selectedIndex].value;
}

/**
 * Make video Url player draggable
 */
function setupVideoUrlPlayer() {
  if (isMobileDevice) {
    // adapt video player iframe for mobile
    setSP("--iframe-width", "320px");
    setSP("--iframe-height", "240px");
  } else {
    dragElement(videoUrlCont, videoUrlHeader);
    dragElement(videoAudioUrlCont, videoAudioUrlHeader);
  }
  videoUrlCloseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeVideoUrlPlayer();
    emitVideoPlayer("close");
  });
  videoAudioCloseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeVideoUrlPlayer();
    emitVideoPlayer("close");
  });
}

/**
 * Handle Camera mirror logic
 */
async function handleLocalCameraMirror() {
  if (camera === "environment") {
    // Back camera → No mirror
    initVideo.classList.remove("mirror");
    myVideo.classList.remove("mirror");
  } else {
    // Disable mirror for rear camera
    initVideo.classList.add("mirror");
    myVideo.classList.add("mirror");
  }
}

/**
 * Toggle vide mirror
 */
function toggleInitVideoMirror() {
  initVideo.classList.toggle("mirror");
  // myVideo may not exist yet before joining/creating local tile
  if (typeof myVideo !== "undefined" && myVideo) {
    myVideo.classList.toggle("mirror");
  }
}

/**
 * Get audio - video constraints
 * @returns {object} audio - video constraints
 */
function getAudioVideoConstraints() {
  const audioSource = audioInputSelect.value;
  const videoSource = videoSelect.value;
  let videoConstraints = useVideo;
  if (videoConstraints) {
    videoConstraints = getVideoConstraints(
      videoQualitySelect.value ? videoQualitySelect.value : "default",
    );
    videoConstraints["deviceId"] = videoSource
      ? { exact: videoSource }
      : undefined;
  }
  let audioConstraints = { audio: false };
  if (useAudio) {
    audioConstraints = getAudioConstraints(audioSource);
  }
  return {
    audioConstraints,
    video: videoConstraints,
  };
}

/**
 * Get Resolution Map
 * https://webrtc.github.io/samples/src/content/getusermedia/resolution/
 */
function getResolutionMap() {
  return {
    qvga: [320, 240],
    vga: [640, 480],
    hd: [1280, 720],
    fhd: [1920, 1080],
    "2k": [2560, 1440],
    "4k": [3840, 2160],
    "6k": [6144, 3456],
    "8k": [7680, 4320],
  };
}

/**
 * Get safe cross-browser video constraints
 * @param {string} videoQuality desired video quality
 * @returns {object} video constraints
 */
function getVideoConstraints(videoQuality) {
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

/**
 * Get audio constraints
 * @param {string} deviceId audio input device ID
 * @returns {object} audio constraints
 */
function getAudioConstraints(deviceId = null) {
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

/**
 * Set local max fps: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/applyConstraints
 * @param {string} maxFrameRate desired max frame rate
 * @param {string} type camera/screen default camera
 */
async function setLocalMaxFps(maxFrameRate, type = "camera") {
  if (!useVideo || isFirefox) return;

  const videoTrack = getVideoTrack(localVideoMediaStream);
  const screenTrack = getVideoTrack(localScreenMediaStream);

  if (!videoTrack && !screenTrack) return;

  (isScreenStreaming ? screenTrack : videoTrack)
    .applyConstraints({ frameRate: maxFrameRate })
    .then(() => {
      logStreamSettingsInfo(
        "setLocalMaxFps",
        videoTrack ? localVideoMediaStream : localScreenMediaStream,
      );
      type === "camera"
        ? (videoFpsSelectedIndex = videoFpsSelect.selectedIndex)
        : (screenFpsSelectedIndex = screenFpsSelect.selectedIndex);
    })
    .catch((err) => {
      console.error("setLocalMaxFps", err);
      type === "camera"
        ? (videoFpsSelect.selectedIndex = videoFpsSelectedIndex)
        : (screenFpsSelect.selectedIndex = screenFpsSelectedIndex);
    });
}

/**
 * Set local video quality: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/applyConstraints
 */
async function setLocalVideoQuality() {
  const videoTrack = getVideoTrack(localVideoMediaStream);
  const screenTrack = getVideoTrack(localScreenMediaStream);

  if (!videoTrack && !screenTrack) return;

  const videoQuality = videoQualitySelect.value
    ? videoQualitySelect.value
    : "default";
  const videoConstraints = getVideoConstraints(videoQuality);

  (isScreenStreaming ? screenTrack : videoTrack)
    .applyConstraints(videoConstraints)
    .then(() => {
      logStreamSettingsInfo(
        "setLocalVideoQuality",
        videoTrack ? localVideoMediaStream : localScreenMediaStream,
      );
      videoQualitySelectedIndex = videoQualitySelect.selectedIndex;
    })
    .catch((err) => {
      videoQualitySelect.selectedIndex = videoQualitySelectedIndex;
      console.error("setLocalVideoQuality", err);
    });
}

/**
 * Change audio output (Speaker)
 */
async function changeAudioDestination(
  audioElement = false,
  deferUntilUserActivation = true,
) {
  const audioDestination = audioOutputSelect.value;
  if (audioElement) {
    // change audio output to specified participant audio
    await attachSinkId(
      audioElement,
      audioDestination,
      deferUntilUserActivation,
    );
  } else {
    const audioElements = audioMediaContainer.querySelectorAll("audio");
    // change audio output for all participants audio
    const promises = [];
    audioElements.forEach((audioElement) => {
      // discard my own audio on this device, so I won't hear myself.
      if (audioElement.id != "myAudio") {
        promises.push(
          attachSinkId(
            audioElement,
            audioDestination,
            deferUntilUserActivation,
          ),
        );
      }
    });
    // Wait for all audio outputs to be changed
    await Promise.allSettled(promises);
  }
}

/**
 * Attach audio output device to audio element using device/sink ID.
 * @param {object} element audio element to attach the audio output
 * @param {string} sinkId uuid audio output device
 * @param {boolean} deferUntilUserActivation when true, defer applying setSinkId() until the next user gesture if no user activation is present
 */
async function attachSinkId(element, sinkId, deferUntilUserActivation = true) {
  if (typeof element.sinkId === "undefined") {
    console.warn("Browser does not support output device selection.");
    return;
  }

  // Helper to actually set the sinkId and handle errors uniformly
  const doSetSinkId = async () => {
    try {
      await element.setSinkId(sinkId);
      console.log(`Success, audio output device attached: ${sinkId}`);
    } catch (err) {
      let errorMessage = err;
      if (err.name === "SecurityError") {
        errorMessage =
          "SecurityError: You need to use HTTPS for selecting audio output device";
      } else if (err.name === "NotAllowedError") {
        errorMessage =
          "NotAllowedError: Permission to use audio output device is not granted";
      } else if (err.name === "NotFoundError") {
        errorMessage =
          "NotFoundError: The specified audio output device was not found";
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      } else {
        errorMessage = `Error: ${err}`;
      }
      console.error(`attachSinkId error: ${errorMessage}`);
      // Jump back to first output device in the list as it's the default.
      if (typeof audioOutputSelect !== "undefined" && audioOutputSelect) {
        audioOutputSelect.selectedIndex = 0;
      }
      throw err;
    }
  };

  // If a user gesture is required (Chrome policy), defer until the next interaction
  const needsUserGesture = !!(
    navigator.userActivation && !navigator.userActivation.isActive
  );
  if (needsUserGesture) {
    // Automatic calls (e.g. on new audio consumer) must NOT register a global
    // user-activation listener: applying setSinkId() on an unrelated click resets
    // the audio pipeline and breaks echo cancellation. The selected speaker is
    // re-applied the next time the user explicitly interacts with the speaker select.
    if (!deferUntilUserActivation) return;
    // Show a single notification prompting the user to click
    if (!window.__sinkGestureNotified) {
      window.__sinkGestureNotified = true;
      console.warn("Click anywhere to apply the speaker change");
    }

    return new Promise((resolve) => {
      const applyOnGesture = async () => {
        try {
          await doSetSinkId();
          resolve(true);
        } catch (e) {
          resolve(false);
        } finally {
          // Clean up all event listeners
          window.removeEventListener("pointerdown", applyOnGesture);
          window.removeEventListener("keydown", applyOnGesture);
          window.removeEventListener("touchstart", applyOnGesture);
          window.__sinkGestureNotified = false;
        }
      };
      const opts = { once: true };
      // Use pointerdown (covers mouse/touch/pen), touchstart (fallback for older browsers), and keydown
      window.addEventListener("pointerdown", applyOnGesture, opts);
      window.addEventListener("keydown", applyOnGesture, opts);
      window.addEventListener("touchstart", applyOnGesture, opts);
    });
  }

  // Otherwise, set immediately
  return doSetSinkId();
}

/**
 * AttachMediaStream stream to element
 * @param {object} element element to attach the stream
 * @param {object} stream media stream audio - video
 */
function attachMediaStream(element, stream) {
  if (!element || !stream) return;
  //console.log("DEPRECATED, attachMediaStream will soon be removed.");
  element.srcObject = stream;
  console.log("Success, media stream attached", stream.getTracks());
}

/**
 * Create a loading spinner overlay inside a video wrap element.
 * The spinner is automatically hidden once the video starts playing.
 * @param {HTMLElement} wrap - The parent wrapper div (.Camera or .Screen)
 * @param {HTMLVideoElement} videoEl - The video element to monitor
 */
function createVideoLoadingSpinner(wrap, videoEl) {
  const spinnerWrap = document.createElement("div");
  spinnerWrap.className = "video-loading-spinner";

  const loadingSpinner = document.createElement("div");
  loadingSpinner.className = "loading-spinner";

  const spinnerRing = document.createElement("div");
  spinnerRing.className = "spinner-ring";

  const spinnerLogo = document.createElement("img");
  spinnerLogo.className = "spinner-logo";
  spinnerLogo.src = "../images/logo.svg";
  spinnerLogo.alt = "logo";

  loadingSpinner.appendChild(spinnerRing);
  loadingSpinner.appendChild(spinnerLogo);
  spinnerWrap.appendChild(loadingSpinner);
  wrap.appendChild(spinnerWrap);

  let fallbackTimer = null;

  function hideSpinner() {
    if (spinnerWrap.style.display === "none") return;
    spinnerWrap.style.display = "none";
    videoEl.removeEventListener("playing", hideSpinner);
    videoEl.removeEventListener("loadeddata", hideSpinner);
    videoEl.removeEventListener("loadedmetadata", hideSpinner);
    videoEl.removeEventListener("canplay", hideSpinner);
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }

  videoEl.addEventListener("playing", hideSpinner);
  videoEl.addEventListener("loadeddata", hideSpinner);
  videoEl.addEventListener("loadedmetadata", hideSpinner);
  videoEl.addEventListener("canplay", hideSpinner);

  fallbackTimer = window.setInterval(() => {
    if (
      videoEl.readyState >= HTMLMediaElement.HAVE_METADATA ||
      videoEl.videoWidth > 0 ||
      videoEl.currentTime > 0
    ) {
      hideSpinner();
    }
  }, 250);

  // If the video is already playing or has data, hide immediately
  if (
    videoEl.readyState >= HTMLMediaElement.HAVE_METADATA ||
    videoEl.videoWidth > 0
  ) {
    hideSpinner();
  }
}

/**
 * Show left buttons & status
 * if buttons visible or I'm on hover do nothing return
 * if mobile and chatroom open do nothing return
 * if mobile and myCaption visible do nothing
 * if mobile and mySettings open do nothing return
 */
function showButtonsBarAndMenu() {
  if (wbIsBgTransparent || isButtonsVisible) return;

  const topHeaderBar = document.getElementById("topHeaderBar");
  const newControlBar = document.getElementById("newControlBar");

  if (topHeaderBar) {
    topHeaderBar.style.transform = "translateY(0)";
    topHeaderBar.style.opacity = "1";
    topHeaderBar.style.pointerEvents = "auto";
  }
  if (newControlBar) {
    newControlBar.style.transform = "translate(-50%, 0)";
    newControlBar.style.opacity = "1";
    newControlBar.style.pointerEvents = "auto";
  }

  const videoMediaContainer = document.getElementById("videoMediaContainer");
  if (videoMediaContainer && isMobileDevice) {
    videoMediaContainer.classList.remove("expanded");
    setTimeout(() => {
      if (typeof resizeVideoMedia === "function") resizeVideoMedia();
    }, 500);
  }

  document.body.classList.remove("controls-idle");

  isButtonsVisible = true;
}

function hideButtonsBarAndMenu() {
  const topHeaderBar = document.getElementById("topHeaderBar");
  const newControlBar = document.getElementById("newControlBar");

  if (topHeaderBar) {
    topHeaderBar.style.transform = "translateY(-100%)";
    topHeaderBar.style.opacity = "0";
    topHeaderBar.style.pointerEvents = "none";
  }
  if (newControlBar) {
    newControlBar.style.transform = "translate(-50%, 100%)";
    newControlBar.style.opacity = "0";
    newControlBar.style.pointerEvents = "none";
  }

  const videoMediaContainer = document.getElementById("videoMediaContainer");
  if (videoMediaContainer && isMobileDevice) {
    videoMediaContainer.classList.add("expanded");
    setTimeout(() => {
      if (typeof resizeVideoMedia === "function") resizeVideoMedia();
    }, 500);
  }

  // Dim (not hide) the peer's name tag along with the controls.
  document.body.classList.add("controls-idle");

  isButtonsVisible = false;
}

/**
 * Empty loop since we replaced it with resetMobileIdleTimer
 */
function checkButtonsBarAndMenu() {
  // Logic replaced by resetMobileIdleTimer
}

/**
 * Copy room url to clipboard and share it with navigator share if supported
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
 */
async function shareRoomUrl() {
  // navigator share
  if (navigator.share) {
    try {
      // not add title and description to load metadata from url
      const roomURL = getRoomURL();
      await navigator.share({ url: roomURL });
    } catch (err) {
      /*
            This feature is available only in secure contexts (HTTPS),
            in some or all supporting browsers and mobile devices
            console.error("navigator.share", err); 
            */
      console.error("Navigator share error", err);

      shareRoomMeetingURL();
    }
  } else {
    shareRoomMeetingURL();
  }
}

/**
 * Share meeting room
 * @param {boolean} checkScreen check screen share
 */
function shareRoomMeetingURL(checkScreen = false) {
  playSound("newMessage");
  const roomURL = getRoomURL();
  Swal.fire({
    background: swBg,
    position: "center",
    title: "Chia sẻ phòng",
    html: renderRoomTemplate("tpl-share-room-modal", {
      text: {
        roomURL,
      },
    }),
    showCancelButton: true,
    cancelButtonColor: "red",
    confirmButtonText: `Sao chép URL`,
    cancelButtonText: `Đóng`,
    cancelButtonText: `Đóng`,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then((result) => {
    if (result.isConfirmed) {
      copyRoomURL();
    }
    // share screen on join room
    if (checkScreen) checkShareScreen();
  });
  makeRoomQR();
}

/**
 * Make Room QR
 * https://github.com/neocotic/qrious
 */
function makeRoomQR() {
  const qr = new QRious({
    element: getId("qrRoom"),
    value: myRoomUrl,
  });
  qr.set({
    size: 256,
  });
}

/**
 * Make Room Popup QR
 */
function makeRoomPopupQR() {
  const qr = new QRious({
    element: document.getElementById("qrRoomPopup"),
    value: myRoomUrl,
  });
  qr.set({
    size: 256,
  });
}

/**
 * Copy Room URL to clipboard
 * navigator.clipboard.writeText() can silently reject (permissions,
 * focus, insecure context, etc.) - it was previously fired without
 * await/catch, so the success toast/log fired unconditionally even when
 * nothing was actually copied. Await it and fall back to the legacy
 * execCommand('copy') on the selected tmpInput (already set up below)
 * before reporting failure.
 */
async function copyRoomURL() {
  const roomURL = getRoomURL();
  const tmpInput = document.createElement("input");
  document.body.appendChild(tmpInput);
  tmpInput.value = roomURL;
  tmpInput.select();
  tmpInput.setSelectionRange(0, 99999); // For mobile devices

  let copied = false;
  try {
    await navigator.clipboard.writeText(roomURL);
    copied = true;
  } catch (err) {
    console.warn("navigator.clipboard.writeText failed, falling back", err);
    try {
      copied = document.execCommand("copy");
    } catch (fallbackErr) {
      console.error("execCommand('copy') fallback failed", fallbackErr);
    }
  }

  document.body.removeChild(tmpInput);

  if (copied) {
    console.log("Copied to clipboard Join Link ", roomURL);
  } else {
    console.error("Copy to clipboard failed for", roomURL);
  }
}

/**
 * Get Room URL
 * @returns {url} roomURL
 */
function getRoomURL() {
  return myRoomUrl;
  // return isHostProtected && isPeerAuthEnabled
  //     ? window.location.origin + '/join/?room=' + roomId + '&token=' + myToken
  //     : myRoomUrl;
}

/**
 * Handle Audio ON - OFF
 * @param {object} e event
 * @param {boolean} init on join room
 * @param {null|boolean} force audio off (default null can be true/false)
 * @param {boolean} silent true to suppress the toggle sound - for
 *   automatic/programmatic calls (e.g. the ?audio= query param), not a
 *   real user click on the mic button
 */
async function handleAudio(e, init, force = null, silent = false) {
  // https://developer.mozilla.org/en-US/docs/Web/API/MediaStream/getAudioTracks

  const audioStatus = force !== null ? force : !myAudioStatus;
  let audioTrack = getAudioTrack(localAudioMediaStream);

  // Trying to turn the mic ON but there's no usable track - almost always
  // means the browser never got mic permission. Checked before the
  // !useAudio guard below so this still fires from the in-room control
  // bar even when useAudio is false (permission was denied) - the
  // pre-join screen's own mic button is hidden in that case (also via
  // useAudio), so this path only ever runs from the in-room button there.
  if (audioStatus && !audioTrack) {
    // Permission may have been granted since the last attempt (e.g. the
    // user allowed it via the browser's own address-bar/site-settings
    // prompt after seeing the warning below once already) - try again
    // before assuming it's still blocked.
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        getAudioConstraints(),
      );
      await loadLocalMedia(stream, "audio");
      localAudioMediaStream = stream;
      useAudio = true;
      audioTrack = getAudioTrack(localAudioMediaStream);
    } catch (err) {
      console.warn("[handleAudio] No audio track found", err);
      showPP({
        icon: "triangle-alert",
        variant: "warn",
        title: "Chưa được cấp quyền truy cập micro",
        desc: "Trình duyệt chưa cho phép ứng dụng dùng micro (hoặc không tìm thấy thiết bị). Vui lòng cấp quyền micro trong cài đặt trình duyệt rồi thử lại.",
        confirmText: "Đã hiểu",
        hideCancel: true,
      });
      return;
    }
  }

  if (!useAudio) return;

  myAudioStatus = audioStatus;
  if (audioTrack) audioTrack.enabled = audioStatus;

  // Update button classes
  if (force != null) {
    setMediaButtonsClass([
      { element: e, status: audioStatus, mediaType: "audio" },
    ]);
  } else {
    setMediaButtonsClass([
      { element: e.target, status: audioStatus, mediaType: "audio" },
    ]);
  }

  setMediaButtonsClass([
    { element: audioBtn, status: audioStatus, mediaType: "audio" },
  ]);

  if (init) {
    setMediaButtonsClass([
      { element: initAudioBtn, status: audioStatus, mediaType: "audio" },
    ]);
    setTippy(
      initAudioBtn,
      audioStatus ? "Tắt âm thanh" : "Bật âm thanh",
      "right",
    );
    initMicrophoneSelect.disabled = !audioStatus;
    initSpeakerSelect.disabled = !audioStatus;
    lS.setInitConfig(lS.MEDIA_TYPE.audio, audioStatus);
  } else {
    applyKeepAwake(myAudioStatus);
  }

  setMyAudioStatus(myAudioStatus, !silent);
}

/**
 * Stop audio track from MediaStream
 * @param {MediaStream} stream
 */
async function stopAudioTracks(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    if (track.kind === "audio") track.stop();
  });
}

/**
 * Handle Video ON - OFF
 * @param {object} e event
 * @param {boolean} init on join room
 * @param {null|boolean} force video off (default null can be true/false)
 * @param {boolean} silent true to suppress the toggle sound - for
 *   automatic/programmatic calls (e.g. the ?video= query param), not a
 *   real user click on the camera button
 */
async function handleVideo(e, init, force = null, silent = false) {
  // https://developer.mozilla.org/en-US/docs/Web/API/MediaStream/getVideoTracks

  const videoStatus = force !== null ? force : !myVideoStatus;

  // Turning the camera OFF fully stops the track (camera LED off), so
  // turning it back ON always needs a fresh getUserMedia call below - it
  // can't just be re-enabled like a muted mic. Do that first, before
  // touching any UI state, so a still-blocked permission doesn't
  // optimistically flip the button to "on" while nothing is actually
  // enabled. changeInitCamera/changeLocalCamera always attempt a fresh
  // request, so this also naturally retries if the browser denied access
  // earlier (e.g. on first page load) but was granted since.
  if (videoStatus) {
    // changeInitCamera/changeLocalCamera below request a SPECIFIC
    // device (videoSelect.value / initVideoSelect.value). If the
    // browser had denied access when the page first loaded, that
    // dropdown was never populated with real devices (enumerateDevices
    // only returns usable deviceIds once permission is granted), so
    // .value is still "" - passing that as an exact deviceId fails with
    // OverconstrainedError no matter how many times it's retried, even
    // after permission is granted mid-session. Re-run the enumeration
    // first so there's an actual device to ask for.
    if (!isEnumerateVideoDevices) {
      await initEnumerateVideoDevices();
    }
    init
      ? await changeInitCamera(initVideoSelect.value)
      : await changeLocalCamera(videoSelect.value);
    if (!getVideoTrack(localVideoMediaStream)) {
      console.warn("[handleVideo] No video track found");
      showPP({
        icon: "triangle-alert",
        variant: "warn",
        title: "Chưa được cấp quyền truy cập camera",
        desc: "Trình duyệt chưa cho phép ứng dụng dùng camera (hoặc không tìm thấy thiết bị). Vui lòng cấp quyền camera trong cài đặt trình duyệt rồi thử lại.",
        confirmText: "Đã hiểu",
        hideCancel: true,
      });
      return;
    }
    useVideo = true;
  }

  const videoTrack = getVideoTrack(localVideoMediaStream);
  myVideoStatus = videoStatus;
  if (videoTrack) videoTrack.enabled = videoStatus;

  // Update button classes
  if (force != null) {
    setMediaButtonsClass([
      { element: e, status: videoStatus, mediaType: "video" },
    ]);
  } else {
    setMediaButtonsClass([
      { element: e.target, status: videoStatus, mediaType: "video" },
    ]);
  }

  setMediaButtonsClass([
    { element: videoBtn, status: videoStatus, mediaType: "video" },
  ]);

  if (init) {
    setMediaButtonsClass([
      { element: initVideoBtn, status: videoStatus, mediaType: "video" },
    ]);
    setTippy(
      initVideoBtn,
      videoStatus ? "Tắt video" : "Bật video",
      "top",
    );
    displayElements([{ element: initVideo, display: videoStatus, mode: "block" }]);
    initVideoSelect.disabled = !videoStatus;
    lS.setInitConfig(lS.MEDIA_TYPE.video, videoStatus);
    initVideoContainerShow(videoStatus);
  } else {
    applyKeepAwake(myVideoStatus);
  }

  if (!videoStatus && !isScreenStreaming) {
    // Stop the video track based on the condition
    init
      ? await stopVideoTracks(initStream) // Stop init video track (camera LED off)
      : await stopVideoTracks(localVideoMediaStream); // Stop local video track (camera LED off)
  }

  setMyVideoStatus(videoStatus, !silent);
}

/**
 * Handle initVideoContainer
 * @param {boolean} show
 */
function initVideoContainerShow(show = true) {
  initVideoContainer.style.width = show ? "100%" : "auto";
  initVideoContainer.style.padding = show ? "10px" : "0px";
}

/**
 * Stop video track from MediaStream
 * @param {MediaStream} stream
 */
async function stopVideoTracks(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    if (track.kind === "video") track.stop();
  });
}

/**
 * SwapCamera front (user) - rear (environment)
 */
async function swapCamera() {
  // setup camera
  let camVideo = false;
  camera = camera == "user" ? "environment" : "user";
  camVideo = camera == "user" ? true : { facingMode: { exact: camera } };

  // Show loading spinner while switching camera
  const myVideoWrap = getId("myVideoWrap");
  const spinner = myVideoWrap
    ? myVideoWrap.querySelector(".video-loading-spinner")
    : null;
  if (spinner) elemDisplay(spinner, true, "flex");

  // some devices can't swap the cam, if have Video Track already in execution.
  await stopLocalVideoTrack();

  try {
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    const camStream = await navigator.mediaDevices.getUserMedia({
      video: camVideo,
    });
    if (camStream) {
      await refreshMyLocalStream(camStream);
      await refreshMyStreamToPeers(camStream);
      await setLocalMaxFps(videoMaxFrameRate);
      await handleLocalCameraMirror();
      await setMyVideoStatusTrue();
    }
  } catch (err) {
    console.log("[Error] to swapping camera", err);
    // https://blog.addpipe.com/common-getusermedia-errors/
  } finally {
    if (spinner) elemDisplay(spinner, false);
  }
}

/**
 * Stop Local Video Track
 */
async function stopLocalVideoTrack() {
  if (useVideo || !isScreenStreaming) {
    const localVideoTrack = getVideoTrack(localVideoMediaStream);
    if (localVideoTrack) {
      console.log("stopLocalVideoTrack", localVideoTrack);
      localVideoTrack.stop();
    }
  }
}

/**
 * Stop Local Audio Track
 */
async function stopLocalAudioTrack() {
  const localAudioTrack = getAudioTrack(localAudioMediaStream);
  if (localAudioTrack) {
    console.log("stopLocalAudioTrack", localAudioTrack);
    localAudioTrack.stop();
  }
}

/**
 * Load Screen media to video element
 */
async function loadScreenMedia() {
  // If user started screen sharing before joining, create the screen tile now
  if (myScreenStatus && localScreenMediaStream) {
    await loadLocalMedia(localScreenMediaStream, "screen");
  }
}

/**
 * Toggle screen sharing and handle related actions
 * @param {boolean} init - Indicates if it's the initial screen share state
 */
async function toggleScreenSharing(init = false) {
  try {
    screenMaxFrameRate = parseInt(screenFpsSelect.value, 10);
    const constraints = getScreenShareConstraints();

    !isScreenStreaming
      ? await startScreenSharing(constraints, init)
      : await stopScreenSharing(init);

    updateScreenSharingUI(isScreenStreaming, init);
  } catch (err) {
    if (err && err.name === "NotAllowedError") {
      console.error(
        "[ScreenShare] Screen sharing permission was denied by the user.",
      );
    } else {
      await handleToggleScreenException(
        `[Warning] Unable to share the screen: ${err}`,
        init,
      );
    }
    if (init) return;
  }
}

/**
 * Get screen share constraints
 */
function getScreenShareConstraints() {
  return {
    audio: true,
    video: { frameRate: screenMaxFrameRate },
  };
}

/**
 * Start screen sharing with given constraints
 * @param {object} constraints - MediaStreamConstraints for screen sharing
 * @param {boolean} init - Indicates if it's the initial screen share
 */
async function startScreenSharing(constraints, init) {
  const displayStream =
    await navigator.mediaDevices.getDisplayMedia(constraints);
  if (!displayStream) return;
  localScreenDisplayStream = displayStream;
  const screenVideoTrack = getVideoTrack(displayStream);
  if (!screenVideoTrack) {
    console.error("[ScreenShare] No video track in display stream");
    return;
  }
  const screenAudioTrack = getAudioTrack(displayStream);
  const micAudioTrack =
    myAudioStatus && hasAudioTrack(localAudioMediaStream)
      ? getAudioTrack(localAudioMediaStream)
      : null;
  if (screenShareAudioContext) {
    try {
      await screenShareAudioContext.close();
    } catch (_) {}
    screenShareAudioContext = null;
  }
  const outgoingAudioTrack = await mixScreenAndMicAudio(
    screenAudioTrack,
    micAudioTrack,
  );
  localScreenMediaStream = outgoingAudioTrack
    ? new MediaStream([screenVideoTrack, outgoingAudioTrack])
    : new MediaStream([screenVideoTrack]);
  isScreenStreaming = true;
  myScreenStatus = true;
  const extras = getLocalScreenExtras();
  if (extras) {
    try {
      peerInfo.extras = { ...(peerInfo.extras || {}), ...extras };
    } catch (_) {}
    await emitPeerStatus("screen", true, extras);
  }
  if (!init) {
    emitPeersAction("screenStart", extras);
    await loadScreenMedia();
    await refreshMyStreamToPeers(undefined, true);
    // Suggest opening PiP right after a successful share - mirrors
    // App.tsx: `if (!isInPagePip && remotePeer) setShowPipSuggestion(true);`
    if (
      typeof isInPagePip !== "undefined" &&
      !isInPagePip &&
      Object.keys(peerConnections).length >= 1
    ) {
      showPipSuggestionModal();
    }
  }
  screenVideoTrack.onended = () => {
    if (isScreenStreaming) toggleScreenSharing(init);
  };
  if (init) {
    if (initStream) await stopTracks(initStream);
    initStream = displayStream;
    const initVideoTrack = getVideoTrack(initStream);
    if (initVideoTrack) {
      const newInitStream = new MediaStream([initVideoTrack]);
      elemDisplay(initVideo, true, "block");
      initVideo.classList.toggle("mirror");
      initVideo.srcObject = newInitStream;
      const initVideoLoader = getId("initVideoLoader");
      if (initVideoLoader) initVideoLoader.style.display = "none";
      disable(initVideoSelect, true);
      disable(initVideoBtn, true);
    } else {
      elemDisplay(initVideo, false);
    }
    initVideoContainerShow();
  }
}

/**
 * Stop screen sharing and clean up resources
 * @param {boolean} init - Indicates if it's the initial screen share
 */
async function stopScreenSharing(init) {
  if (!init) hidePipSuggestionModal();
  const myScreenWrap = getId("myScreenWrap");
  const myScreenPinBtn = getId("myScreenPinBtn");
  if (
    !init &&
    myScreenWrap &&
    isVideoPinned &&
    pinnedVideoPlayerId === "myScreen"
  ) {
    console.log("[ScreenShare] Unpinning my screen before removal");
    if (myScreenPinBtn) myScreenPinBtn.click();
  }
  if (!init && myScreenWrap) myScreenWrap.remove();
  if (localScreenMediaStream) {
    localScreenMediaStream.getTracks().forEach((t) => t.stop());
  }
  if (localScreenDisplayStream) {
    localScreenDisplayStream.getTracks().forEach((t) => t.stop());
  }
  localScreenDisplayStream = null;
  if (screenShareAudioContext) {
    try {
      await screenShareAudioContext.close();
    } catch (_) {}
    screenShareAudioContext = null;
  }
  localScreenMediaStream = null;
  if (!init) adaptAspectRatio();
  isScreenStreaming = false;
  myScreenStatus = false;
  if (!init) {
    emitPeersAction("screenStop");
    try {
      peerInfo.extras = {};
    } catch (_) {}
    await emitPeerStatus("screen", false, {});
    const micTrack = getAudioTrack(localAudioMediaStream);
    if (useAudio && (!micTrack || micTrack.readyState === "ended")) {
      try {
        await changeLocalMicrophone(audioInputSelect.value);
        console.log("[ScreenShare] Require microphone after screen share stop");
      } catch (err) {
        console.error(
          "[ScreenShare] Failed to reacquire microphone after screen share stop:",
          err,
        );
      }
    } else {
      if (micTrack) {
        micTrack.enabled = true;
        await refreshMyStreamToPeers(localAudioMediaStream, true);
        console.log(
          "[ScreenShare] Refreshing mic audio after screen share stop",
        );
      }
    }
  }
  if (init) {
    if (initStream) await stopTracks(initStream);
    if (useVideo && myVideoStatus) {
      try {
        await changeInitCamera(initVideoSelect.value);
        initVideo.classList.toggle("mirror");
      } catch (err) {
        console.error(
          "[ScreenShare] Error restarting camera after screen share stop:",
          err,
        );
        initStream = null;
        elemDisplay(initVideo, false);
      }
    } else {
      initStream = null;
      elemDisplay(initVideo, false);
      initVideoContainerShow(false);
    }
    disable(initVideoSelect, false);
    disable(initVideoBtn, false);
  }
}

/**
 * Mix screen and microphone audio tracks into a single audio track
 * @param {MediaStreamTrack} screenAudioTrack - The audio track from the screen share
 * @param {MediaStreamTrack} micAudioTrack - The audio track from the microphone
 * @returns {Promise<MediaStreamTrack|null>} - The mixed audio track or null if none available
 */
async function mixScreenAndMicAudio(screenAudioTrack, micAudioTrack) {
  if (screenAudioTrack && micAudioTrack) {
    try {
      screenShareAudioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const destination =
        screenShareAudioContext.createMediaStreamDestination();
      const screenSource = screenShareAudioContext.createMediaStreamSource(
        new MediaStream([screenAudioTrack]),
      );
      screenSource.connect(destination);
      const micSource = screenShareAudioContext.createMediaStreamSource(
        new MediaStream([micAudioTrack]),
      );
      micSource.connect(destination);
      try {
        await screenShareAudioContext.resume();
      } catch (_) {}
      return destination.stream.getAudioTracks()[0] || null;
    } catch (err) {
      console.warn(
        "[ScreenShare] Unable to mix screen+mic audio, falling back to screen audio only:",
        err,
      );
      return screenAudioTrack;
    }
  } else if (screenAudioTrack) {
    return screenAudioTrack;
  } else if (micAudioTrack) {
    return micAudioTrack;
  }
  return null;
}

/**
 * Update Screen Sharing UI
 * @param {boolean} isScreenStreaming - Indicates if screen sharing is active
 * @param {boolean} init - Indicates if it's the initial screen share
 */
function updateScreenSharingUI(isScreenStreaming, init) {
  // Only for an actual toggle, not the initial pre-join screen-share setup
  // (mirrors the addPeer/removePeer sounds, which also skip that case).
  if (!init) playSound("eject");
  setScreenSharingStatus(isScreenStreaming);
  if (!init && myVideoAvatarImage && !useVideo) {
    elemDisplay(myVideo, false);
    elemDisplay(myVideoAvatarImage, true, "block");
  }

  // The floating self-view thumbnail has no equivalent while I'm
  // screen sharing (the reference never previews your own share)
  if (!init) syncSoloVisibilityForLocalScreenShare(isScreenStreaming);

  isScreenStreaming
    ? setColor(init ? initScreenShareBtn : screenShareBtn, "orange")
    : setColor(init ? initScreenShareBtn : screenShareBtn, "white");

  if (typeof isInPagePip !== "undefined" && isInPagePip) {
    updatePipLocalControlButtons();
    updatePipStagePlaceholderText();
  }
}

/**
 *  Get local screen extras for deterministic routing
 */
function getLocalScreenExtras() {
  try {
    const track = getVideoTrack(localScreenMediaStream);
    return track
      ? {
          screen_track_id: track.id,
          screen_stream_id: localScreenMediaStream.id,
        }
      : undefined;
  } catch (e) {
    return undefined;
  }
}

/**
 * Handle exception and actions when toggling screen sharing
 * @param {string} reason - The reason message
 * @param {boolean} init - Indicates whether it's an initial state
 */
async function handleToggleScreenException(reason, init) {
  try {
    console.warn("handleToggleScreenException", reason);

    // Inform peers about screen sharing stop
    emitPeersAction("screenStop");

    // Turn off your video
    setMyVideoOff(myPeerName);

    // Toggle screen streaming status
    isScreenStreaming = !isScreenStreaming;
    myScreenStatus = isScreenStreaming;

    // Update screen sharing status
    setScreenSharingStatus(isScreenStreaming);

    // Emit screen status to peers
    peerInfo.extras = {};
    await emitPeerStatus("screen", false, {});

    // Stop the local video track
    await stopLocalVideoTrack();

    // Toggle the 'mirror' class on myVideo (guard if not yet created)
    if (typeof myVideo !== "undefined" && myVideo) {
      myVideo.classList.toggle("mirror");
    }

    // Handle video avatar image and privacy button visibility
    if (myVideoAvatarImage && !useVideo) {
      isScreenStreaming
        ? elemDisplay(myVideoAvatarImage, false)
        : elemDisplay(myVideoAvatarImage, true, "block");
    }

    // Automatically pin the video if screen sharing or video is pinned
    if (
      (isScreenStreaming || isVideoPinned) &&
      typeof myScreenPinBtn !== "undefined" &&
      myScreenPinBtn
    ) {
      myScreenPinBtn.click();
    }
  } catch (error) {
    console.error("[Error] An unexpected error occurred", error);
  }
}

/**
 * Set Screen Sharing Status
 * @param {boolean} status of screen sharing
 */
function setScreenSharingStatus(status) {
  setMediaButtonsClass([
    { element: initScreenShareBtn, status, mediaType: "screen" },
    { element: screenShareBtn, status, mediaType: "screen" },
  ]);
  setTippy(
    screenShareBtn,
    status ? "Dừng chia sẻ màn hình (S)" : "Bắt đầu chia sẻ màn hình (S)",
    placement,
  );
  if (screenShareBtn && screenShareBtn.setAttribute)
    screenShareBtn.setAttribute("aria-pressed", String(!!status));

  // Keep the screen-share badge next to my name in sync — without this,
  // stopping the share leaves the badge stuck on from the last refresh.
  refreshPeerNameTag(document.getElementById("myVideoPeerName"));
  refreshPeerNameTag(document.getElementById("myScreenPeerName"));
}

/**
 * Set myVideoStatus true
 */
async function setMyVideoStatusTrue() {
  if (myVideoStatus || !useVideo) return;

  // Enable video track
  const videoTrack = getVideoTrack(localVideoMediaStream);
  if (videoTrack) {
    videoTrack.enabled = true;
  }

  myVideoStatus = true;

  // Update multiple buttons
  setMediaButtonsClass([
    { element: initVideoBtn, status: true, mediaType: "video" },
    { element: videoBtn, status: true, mediaType: "video" },
    { element: myVideoStatusIcon, status: true, mediaType: "video" },
  ]);

  // Update display elements
  displayElements([
    { element: myVideoAvatarImage, display: false },
    { element: myVideo, display: true, mode: "block" },
  ]);

  // Update tooltips
  setTippy(videoBtn, "Tắt video", placement);
  setTippy(initVideoBtn, "Tắt video", "top");

  emitPeerStatus("video", myVideoStatus);
}

/**
 * Enter - esc on full screen mode
 * https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
 */
function toggleFullScreen() {
  playSound("click");
  const fullScreenIcon = fullScreenBtn.querySelector("i");
  const cornerIcon = fullScreenCornerBtn?.querySelector("i");
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    fullScreenIcon.className = className.fsOn;
    if (cornerIcon) cornerIcon.className = className.fsOn;
    isDocumentOnFullScreen = true;
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
      fullScreenIcon.className = className.fsOff;
      if (cornerIcon) cornerIcon.className = className.fsOff;
      isDocumentOnFullScreen = false;
    }
  }
}

/**
 * Refresh my stream changes to connected peers in the room
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getSenders
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack
 *
 * @param {MediaStream} stream - Media stream (audio/video) to refresh to peers.
 * @param {boolean} localAudioTrackChange - Indicates whether there's a change in the local audio track (default false).
 */
async function refreshMyStreamToPeers(stream, localAudioTrackChange = false) {
  if (!thereArePeerConnections()) return;

  // Enable/disable local audio as requested by caller
  if (useAudio && localAudioTrackChange && localAudioMediaStream) {
    const audioTrack = getAudioTrack(localAudioMediaStream);
    if (audioTrack) {
      audioTrack.enabled = myAudioStatus;
    }
  }

  // Current local tracks
  const cameraTrack = getVideoTrack(localVideoMediaStream);
  const screenTrack = getVideoTrack(localScreenMediaStream);

  // Determine which audio track to use.
  // While screen sharing, prefer the screen-share audio track (which may be mixed screen+mic).
  // Always prefer mic audio when not screen sharing
  let audioTrack, audioStream;
  if (isScreenStreaming && hasAudioTrack(localScreenMediaStream)) {
    audioTrack = getAudioTrack(localScreenMediaStream);
    audioStream = localScreenMediaStream;
  } else {
    audioTrack = getAudioTrack(localAudioMediaStream);
    audioStream = localAudioMediaStream;
  }

  // Push tracks to every peer
  for (const peer_id in peerConnections) {
    const pc = peerConnections[peer_id];
    const peer_name = allPeers[peer_id]["peer_name"];

    const senders = pc.getSenders();
    const videoSenders = senders.filter(
      (s) => s.track && s.track.kind === "video",
    );
    const audioSender = senders.find(
      (s) => s.track && s.track.kind === "audio",
    );

    // Camera track management (sender index 0)
    if (cameraTrack) {
      if (videoSenders.length >= 1) {
        await videoSenders[0].replaceTrack(cameraTrack);
        console.log("REPLACE CAMERA TRACK TO", {
          peer_id,
          peer_name,
          cameraTrack,
        });
      } else {
        pc.addTrack(cameraTrack, localVideoMediaStream);
        await handleRtcOffer(peer_id);
        console.log("ADD CAMERA TRACK TO", { peer_id, peer_name, cameraTrack });
      }
    } else {
      if (videoSenders.length >= 1 && !screenTrack) {
        try {
          await videoSenders[0].replaceTrack(null);
          console.log("REMOVE CAMERA TRACK FROM", { peer_id, peer_name });
        } catch (e) {
          console.warn("REMOVE CAMERA TRACK FAILED", e);
        }
      }
    }

    // Screen track management (sender index 1)
    if (screenTrack) {
      if (videoSenders.length >= 2) {
        await videoSenders[1].replaceTrack(screenTrack);
        console.log("REPLACE SCREEN TRACK TO", {
          peer_id,
          peer_name,
          screenTrack,
        });
      } else {
        pc.addTrack(screenTrack, localScreenMediaStream);
        await handleRtcOffer(peer_id);
        console.log("ADD SCREEN TRACK TO", { peer_id, peer_name, screenTrack });
      }
    } else {
      if (videoSenders.length >= 2) {
        try {
          pc.removeTrack(videoSenders[1]);
          await handleRtcOffer(peer_id);
          console.log("REMOVE SCREEN SENDER FROM", { peer_id, peer_name });
        } catch (e) {
          console.warn("REMOVE SCREEN SENDER FAILED", e);
        }
      }
    }

    // Audio track management
    if (audioTrack) {
      if (audioSender) {
        await audioSender.replaceTrack(audioTrack);
        console.log("REPLACE AUDIO TRACK TO", {
          peer_id,
          peer_name,
          audioTrack,
        });
      } else {
        pc.addTrack(audioTrack, audioStream || new MediaStream([audioTrack]));
        await handleRtcOffer(peer_id);
        console.log("ADD AUDIO TRACK TO", { peer_id, peer_name, audioTrack });
      }
    }
  }
}

/**
 * Refresh my local stream
 * @param {object} stream media stream audio - video
 * @param {boolean} localAudioTrackChange default false
 */
async function refreshMyLocalStream(stream, localAudioTrackChange = false) {
  // enable video
  if (stream && (useVideo || isScreenStreaming)) {
    const videoTrack = getVideoTrack(stream);
    if (videoTrack) {
      videoTrack.enabled = true;
    }
  }

  const tracksToInclude = [];

  const videoTrack =
    stream && hasVideoTrack(stream)
      ? getVideoTrack(stream)
      : getVideoTrack(localVideoMediaStream);

  const audioTrack =
    hasAudioTrack(stream) && localAudioTrackChange
      ? getAudioTrack(stream)
      : getAudioTrack(localAudioMediaStream);

  // https://developer.mozilla.org/en-US/docs/Web/API/MediaStream
  if (useVideo || isScreenStreaming) {
    console.log("Refresh my local media stream VIDEO - AUDIO", {
      isScreenStreaming: isScreenStreaming,
    });
    if (videoTrack) {
      tracksToInclude.push(videoTrack);
      // Avoid overwriting camera when screen sharing uses a separate tile
      if (!isScreenStreaming) {
        localVideoMediaStream = new MediaStream([videoTrack]);
        attachMediaStream(myVideo, localVideoMediaStream);
        logStreamSettingsInfo(
          "refreshMyLocalStream-localVideoMediaStream",
          localVideoMediaStream,
        );
      }
    }
    if (audioTrack) {
      tracksToInclude.push(audioTrack);
      localAudioMediaStream = new MediaStream([audioTrack]);
      attachMediaStream(myAudio, localAudioMediaStream);

      logStreamSettingsInfo(
        "refreshMyLocalStream-localAudioMediaStream",
        localAudioMediaStream,
      );
    }
  } else {
    console.log("Refresh my local media stream AUDIO");
    if (useAudio && audioTrack) {
      tracksToInclude.push(audioTrack);
      localAudioMediaStream = new MediaStream([audioTrack]);

      logStreamSettingsInfo(
        "refreshMyLocalStream-localAudioMediaStream",
        localAudioMediaStream,
      );
    }
  }

  // Keep camera tile object-fit consistent with the selected theme setting
  myVideo.style.objectFit = "var(--video-object-fit)";
}

/**
 * Check if MediaStream has audio track
 * @param {MediaStream} mediaStream
 * @returns boolean
 */
function hasAudioTrack(mediaStream) {
  if (!mediaStream) return false;
  const audioTracks = mediaStream.getAudioTracks();
  return audioTracks.length > 0;
}

/**
 * Check if MediaStream has video track
 * @param {MediaStream} mediaStream
 * @returns boolean
 */
function hasVideoTrack(mediaStream) {
  if (!mediaStream) return false;
  const videoTracks = mediaStream.getVideoTracks();
  return videoTracks.length > 0;
}

/**
 * Safely get first video track from MediaStream
 * @param {MediaStream} mediaStream
 * @returns {MediaStreamTrack|null}
 */
function getVideoTrack(mediaStream) {
  if (!mediaStream) return null;
  const tracks = mediaStream.getVideoTracks();
  return tracks.length > 0 ? tracks[0] : null;
}

/**
 * Safely get first audio track from MediaStream
 * @param {MediaStream} mediaStream
 * @returns {MediaStreamTrack|null}
 */
function getAudioTrack(mediaStream) {
  if (!mediaStream) return null;
  const tracks = mediaStream.getAudioTracks();
  return tracks.length > 0 ? tracks[0] : null;
}

/**
 * Check if recording is active, if yes,
 * on disconnect, remove peer, kick out or leave room, we going to save it
 */
function checkRecording() {
  if (isStreamRecording || myVideoPeerName.innerText.includes("REC")) {
    console.log("Going to save recording");
    stopStreamRecording();
  }
}

/**
 * Handle recording errors
 * @param {string} error
 */
function handleRecordingError(error, popupLog = true) {
  console.error("Recording error", error);
}

/**
 * Get time to string HH:MM:SS
 * @param {number} time in milliseconds
 * @return {string} format HH:MM:SS
 */
function getTimeToString(time) {
  let diffInHrs = time / 3600000;
  let hh = Math.floor(diffInHrs);
  let diffInMin = (diffInHrs - hh) * 60;
  let mm = Math.floor(diffInMin);
  let diffInSec = (diffInMin - mm) * 60;
  let ss = Math.floor(diffInSec);
  let formattedHH = hh.toString().padStart(2, "0");
  let formattedMM = mm.toString().padStart(2, "0");
  let formattedSS = ss.toString().padStart(2, "0");
  return `${formattedHH}:${formattedMM}:${formattedSS}`;
}

/**
 * Seconds to HMS
 * @param {number} d
 * @return {string} format HH:MM:SS
 */
function secondsToHms(d) {
  d = Number(d);
  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = Math.floor((d % 3600) % 60);
  const hDisplay = h > 0 ? h + "h" : "";
  const mDisplay = m > 0 ? m + "m" : "";
  const sDisplay = s > 0 ? s + "s" : "";
  return hDisplay + " " + mDisplay + " " + sDisplay;
}

/**
 * Start/Stop recording timer
 */
function startRecordingTimer() {
  resumeRecButtons();
  recElapsedTime = 0;
  recTimer = setInterval(function printTime() {
    if (!isStreamRecordingPaused) {
      recElapsedTime++;
      let recTimeElapsed = secondsToHms(recElapsedTime);
      myVideoPeerName.innerText = myPeerName + " 🔴 REC " + recTimeElapsed;
      recordingTime.innerText = "🔴 REC " + recTimeElapsed;
    }
  }, 1000);
}
function stopRecordingTimer() {
  clearInterval(recTimer);
  resetRecButtons();
}

/**
 * Get MediaRecorder MimeTypes
 * @returns {boolean} is mimeType supported by media recorder
 */
function getSupportedMimeTypes() {
  const possibleTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/mp4",
  ];
  console.log("POSSIBLE CODECS", possibleTypes);
  return possibleTypes.filter((mimeType) => {
    return MediaRecorder.isTypeSupported(mimeType);
  });
}

/**
 * Start Recording
 * https://github.com/webrtc/samples/tree/gh-pages/src/content/getusermedia/record
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaStream
 */
function startStreamRecording() {
  recordedBlobs = [];

  // Get supported MIME types and set options
  const supportedMimeTypes = getSupportedMimeTypes();
  console.log("MediaRecorder supported options", supportedMimeTypes);
  const options = { mimeType: supportedMimeTypes[0] };

  recCodecs = supportedMimeTypes[0];

  try {
    audioRecorder = new MixedAudioRecorder();
    const audioStreams = getAudioStreamFromAudioElements();
    console.log("Audio streams tracks --->", audioStreams.getTracks());

    const audioMixerStreams = audioRecorder.getMixedAudioStream(
      audioStreams
        .getTracks()
        .filter((track) => track.kind === "audio")
        .map((track) => new MediaStream([track])),
    );

    const audioMixerTracks = audioMixerStreams.getTracks();
    console.log("Audio mixer tracks --->", audioMixerTracks);

    isMobileDevice
      ? startMobileRecording(options, audioMixerTracks)
      : recordingOptions(options, audioMixerTracks);
  } catch (err) {
    handleRecordingError("Exception while creating MediaRecorder: " + err);
  }
}

/**
 * Recording options Camera or Screen/Window for Desktop devices
 * @param {MediaRecorderOptions} options - MediaRecorder options.
 * @param {array} audioMixerTracks - Array of audio tracks from the audio mixer.
 */
function recordingOptions(options, audioMixerTracks) {
  Swal.fire({
    background: swBg,
    position: "top",
    imageUrl: images.recording,
    title: "Tùy chọn ghi hình",
    text: "Chọn loại ghi hình bạn muốn bắt đầu. Âm thanh sẽ được ghi từ tất cả người tham gia.",
    showDenyButton: true,
    showCancelButton: true,
    cancelButtonColor: "red",
    denyButtonColor: "green",
    confirmButtonText: `Camera`,
    denyButtonText: `Màn hình/Cửa sổ`,
    cancelButtonText: `Hủy`,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then((result) => {
    if (result.isConfirmed) {
      startMobileRecording(options, audioMixerTracks);
    } else if (result.isDenied) {
      startDesktopRecording(options, audioMixerTracks);
    }
  });
}

/**
 * Starts mobile recording with the specified options and audio mixer tracks.
 * @param {MediaRecorderOptions} options - MediaRecorder options.
 * @param {array} audioMixerTracks - Array of audio tracks from the audio mixer.
 */
function startMobileRecording(options, audioMixerTracks) {
  try {
    // Combine audioMixerTracks and videoTracks into a single array
    const combinedTracks = [];

    // Add audio mixer tracks to the combinedTracks array if available
    if (Array.isArray(audioMixerTracks)) {
      combinedTracks.push(...audioMixerTracks);
    }

    // Check if there's a local media stream (presumably for the camera)
    if (useVideo && localVideoMediaStream !== null) {
      const videoTracks = localVideoMediaStream.getVideoTracks();
      console.log("Cam video tracks --->", videoTracks);

      // Add video tracks from the local media stream to combinedTracks if available
      if (Array.isArray(videoTracks)) {
        combinedTracks.push(...videoTracks);
      }
    }

    // Create a new MediaStream using the combinedTracks
    const recCamStream = new MediaStream(combinedTracks);
    console.log("New Cam Media Stream tracks  --->", recCamStream.getTracks());

    // Create a MediaRecorder instance with the combined stream and specified options
    mediaRecorder = new MediaRecorder(recCamStream, options);
    console.log(
      "Created MediaRecorder",
      mediaRecorder,
      "with options",
      options,
    );

    // Call a function to handle the MediaRecorder
    handleMediaRecorder(mediaRecorder);
  } catch (err) {
    // Handle any errors that occur during the recording setup
    handleRecordingError("Unable to record the camera + audio: " + err, false);
  }
}

/**
 * Starts desktop recording with the specified options and audio mixer tracks.
 * On desktop devices, it records the screen or window along with all audio tracks.
 * @param {MediaRecorderOptions} options - MediaRecorder options.
 * @param {array} audioMixerTracks - Array of audio tracks from the audio mixer.
 */
function startDesktopRecording(options, audioMixerTracks) {
  // Get the desired frame rate for screen recording
  // screenMaxFrameRate = parseInt(screenFpsSelect.value, 10);

  // Define constraints for capturing the screen
  const constraints = {
    video: { frameRate: { max: 30 } }, // Recording max 30fps
  };

  // Request access to screen capture using the specified constraints
  navigator.mediaDevices
    .getDisplayMedia(constraints)
    .then((screenStream) => {
      // Get video tracks from the screen capture stream
      const screenTracks = screenStream.getVideoTracks();
      console.log("Screen video tracks --->", screenTracks);

      // Create an array to combine screen tracks and audio mixer tracks
      const combinedTracks = [];

      // Add screen video tracks to combinedTracks if available
      if (Array.isArray(screenTracks)) {
        combinedTracks.push(...screenTracks);
      }

      // Add audio mixer tracks to combinedTracks if available
      if (useAudio && Array.isArray(audioMixerTracks)) {
        combinedTracks.push(...audioMixerTracks);
      }

      // Create a new MediaStream using the combinedTracks
      recScreenStream = new MediaStream(combinedTracks);
      console.log(
        "New Screen/Window Media Stream tracks  --->",
        recScreenStream.getTracks(),
      );

      // Create a MediaRecorder instance with the combined stream and specified options
      mediaRecorder = new MediaRecorder(recScreenStream, options);
      console.log(
        "Created MediaRecorder",
        mediaRecorder,
        "with options",
        options,
      );

      // Set a flag to indicate that screen recording is active
      isRecScreenStream = true;

      // Call a function to handle the MediaRecorder
      handleMediaRecorder(mediaRecorder);
    })
    .catch((err) => {
      // Handle any errors that occur during screen recording setup
      handleRecordingError(
        "Unable to record the screen + audio: " + err,
        false,
      );
    });
}

/**
 * Get a MediaStream containing audio tracks from audio elements on the page.
 * @returns {MediaStream} A MediaStream containing audio tracks.
 */
function getAudioStreamFromAudioElements() {
  const audioElements = getSlALL("audio");
  const audioStream = new MediaStream();
  audioElements.forEach((audio) => {
    if (audio.srcObject) {
      const audioTrack = getAudioTrack(audio.srcObject);
      if (audioTrack) {
        audioStream.addTrack(audioTrack);
      }
    }
  });
  return audioStream;
}

/**
 * Notify me if someone start to recording they camera/screen/window + audio
 * @param {string} fromId peer_id
 * @param {string} from peer_name
 * @param {string} fromAvatar peer_avatar
 * @param {string} action recording action
 */
function notifyRecording(fromId, from, fromAvatar, action) {
  // "action" itself ("Start"/"Stop"/"Started") stays as-is - it's only
  // ever compared against "Stop" below, never shown directly; only the
  // display label needs translating.
  const actionLabel = action === "Stop" ? "Dừng" : "Bắt đầu";
  const msg = "🔴 " + actionLabel + " ghi hình cuộc họp";
  const chatMessage = {
    from: from,
    fromAvatar: fromAvatar,
    fromId: fromId,
    to: myPeerName,
    msg: msg,
    privateMsg: false,
  };
  handleDataChannelChat(chatMessage);
  if (!showChatOnMessage) {
    const recAgree =
      action != "Stop"
        ? "Sự có mặt của bạn đồng nghĩa với việc bạn đồng ý được ghi hình"
        : "";
    toastMessage(
      null,
      null,
      `${from}
            <br /><br />
            <span>${msg}</span>
            <br /><br />
            ${recAgree}`,
      "top-end",
      6000,
    );
  }
}

/**
 * Toggle the Devices (video/audio) settings tab
 * @param {boolean} disabled - If true, disable the tab; otherwise, enable it
 */
function toggleVideoAudioTabs(disabled = false) {
  tabDevicesBtn.disabled = disabled;
}

/**
 * Handle Media Recorder
 * @param {object} mediaRecorder
 */
function handleMediaRecorder(mediaRecorder) {
  // Always pass a timeslice so the browser flushes encoded chunks into
  // recordedBlobs periodically instead of buffering the entire recording
  // in renderer memory. This makes long (>1h) recordings stable and
  // avoids MediaRecorder auto-stops caused by memory pressure.
  mediaRecorder.start(1000);
  mediaRecorder.addEventListener("start", handleMediaRecorderStart);
  mediaRecorder.addEventListener("dataavailable", handleMediaRecorderData);
  mediaRecorder.addEventListener("stop", handleMediaRecorderStop);
}

/**
 * Handle Media Recorder onstart event
 * @param {object} event of media recorder
 */
function handleMediaRecorderStart(event) {
  toggleVideoAudioTabs(true);
  startRecordingTimer();
  emitPeersAction("recStart");
  emitPeerStatus("rec", true);
  console.log("MediaRecorder started: ", event);
  isStreamRecording = true;
  const recordStreamIcon = recordStreamBtn.querySelector("i");
  recordStreamIcon.style.setProperty("color", "#ff4500");
  if (isMobileDevice) elemDisplay(swapCameraBtn, false);
  recStartTs = performance.now();
  playSound("recStart");
}

/**
 * Handle Media Recorder ondata event
 * @param {object} event of media recorder
 */
function handleMediaRecorderData(event) {
  console.log("MediaRecorder data: ", event);
  if (event.data && event.data.size > 0) recordedBlobs.push(event.data);
}

/**
 * Handle Media Recorder onstop event
 * @param {object} event of media recorder
 */
function handleMediaRecorderStop(event) {
  toggleVideoAudioTabs(false);
  console.log("MediaRecorder stopped: ", event);
  console.log("MediaRecorder Blobs: ", recordedBlobs);
  stopRecordingTimer();
  emitPeersAction("recStop");
  emitPeerStatus("rec", false);
  isStreamRecording = false;
  setPeerNameHTML(myVideoPeerName, myPeerName, true);
  if (isRecScreenStream) {
    recScreenStream.getTracks().forEach((track) => {
      if (track.kind === "video") track.stop();
    });
    isRecScreenStream = false;
  }

  const recordStreamIcon = recordStreamBtn.querySelector("i");
  recordStreamIcon.style.setProperty("color", "#ffffff");
  downloadRecordedStream();

  if (isMobileDevice) elemDisplay(swapCameraBtn, true, "block");

  playSound("recStop");
}

/**
 * Stop recording
 */
function stopStreamRecording() {
  mediaRecorder.stop();
  audioRecorder.stopMixedAudioStream();
}

/**
 * Pause recording display buttons
 */
function pauseRecButtons() {
  displayElements([
    { element: pauseRecBtn, display: false },
    { element: resumeRecBtn, display: true },
  ]);
}
/**
 * Resume recording display buttons
 */
function resumeRecButtons() {
  displayElements([
    { element: resumeRecBtn, display: false },
    { element: pauseRecBtn, display: true },
  ]);
}
/**
 * Reset recording display buttons
 */
function resetRecButtons() {
  displayElements([
    { element: pauseRecBtn, display: false },
    { element: resumeRecBtn, display: false },
  ]);
}

/**
 * Pause recording
 */
function pauseRecording() {
  if (mediaRecorder) {
    isStreamRecordingPaused = true;
    mediaRecorder.pause();
    pauseRecButtons();
    console.log("Pause recording");
  }
}

/**
 * Resume recording
 */
function resumeRecording() {
  if (mediaRecorder) {
    mediaRecorder.resume();
    isStreamRecordingPaused = false;
    resumeRecButtons();
    console.log("Resume recording");
  }
}

/**
 * Get WebM duration fixer function
 * @returns {Function|null}
 */
function getWebmFixerFn() {
  const fn = window.FixWebmDuration;
  return typeof fn === "function" ? fn : null;
}

/**
 * Download recorded stream
 */
async function downloadRecordedStream() {
  try {
    // Check if we have recorded data
    if (!recordedBlobs || recordedBlobs.length === 0) {
      console.error("No recorded data available");
      userLog("error", "Ghi hình thất bại: không có dữ liệu được ghi", 6000);
      return;
    }

    const type = recordedBlobs[0].type.includes("mp4") ? "mp4" : "webm";
    const rawBlob = new Blob(recordedBlobs, { type: "video/" + type });
    const recFileName = getDataTimeString() + "-REC." + type;
    const currentDevice = isMobileDevice ? "ĐIỆN THOẠI" : "MÁY TÍNH";
    const blobFileSize = bytesToSize(rawBlob.size);

    const recordingInfo = `
        <br/>
        <br/>
            <ul>
                <li>Thời gian: ${recordingTime.innerText}</li>
                <li>File: ${recFileName}</li>
                <li>Codec: ${recCodecs}</li>
                <li>Dung lượng: ${blobFileSize}</li>
            </ul>
        <br/>
        `;
    lastRecordingInfo.innerHTML = renderRoomTemplate(
      "tpl-last-recording-info",
      {
        html: {
          recordingInfo,
        },
      },
    );
    recordingTime.innerText = "";

    msgHTML(
      null,
      null,
      "Ghi hình",
      `<div style="text-align: left;">
                🔴 &nbsp; Thông tin bản ghi:
                ${recordingInfo}
                Vui lòng đợi xử lý, sau đó sẽ được tải xuống thiết bị ${currentDevice} của bạn.
            </div>`,
      "top",
    );

    // Fix WebM duration to make it seekable
    const fixWebmDuration = async (blob) => {
      if (type !== "webm") return blob;
      try {
        const fix = getWebmFixerFn();
        const durationMs = recStartTs
          ? performance.now() - recStartTs
          : undefined;
        const fixed = await fix(blob, durationMs);
        return fixed || blob;
      } catch (e) {
        console.warn("WEBM duration fix failed, saving original blob:", e);
        return blob;
      } finally {
        recStartTs = null;
      }
    };

    (async () => {
      const finalBlob = await fixWebmDuration(rawBlob);
      saveBlobToFile(finalBlob, recFileName);
    })();
  } catch (err) {
    userLog("error", "Lưu bản ghi thất bại: " + err);
  }
}

/**
 * Create Chat Room Data Channel
 * @param {string} peer_id socket.id
 */
function createChatDataChannel(peer_id) {
  chatDataChannels[peer_id] = peerConnections[peer_id].createDataChannel(
    "mirotalk_chat_channel",
  );
  chatDataChannels[peer_id].onopen = (event) => {
    console.log("chatDataChannels created", event);
  };
}

/**
 * Update the unread-message badge on the bottom control bar's chat
 * button (99+ cap), mirroring ControlBar.tsx's unreadCount pill.
 */
function updateChatUnreadBadge() {
  const badge = getId("newChatBadge");
  if (!badge) return;
  if (chatUnreadCount <= 0 || isChatRoomVisible) {
    badge.classList.add("hidden");
    badge.textContent = "0";
    return;
  }
  badge.textContent = chatUnreadCount > 99 ? "99+" : String(chatUnreadCount);
  badge.classList.remove("hidden");
}

/**
 * Show msger draggable on center screen position
 */
function showChatRoomDraggable() {
  playSound("newMessage");

  // Snapshot the unread count BEFORE clearing it - reference
  // (ChatPanel.tsx) uses it to compute which message to land on:
  // `Math.max(0, messages.length - unreadCount)`.
  const unreadCountAtOpen = chatUnreadCount;

  // Mark all messages as read when the panel opens
  chatUnreadCount = 0;
  updateChatUnreadBadge();

  if (isMobileDevice) {
    elemDisplay(bottomButtons, false);
    isButtonsVisible = false;
    if (isChatPinned) {
      chatUnpin();
    }
    setSP("--msger-width", "99%");
    setSP("--msger-height", "99%");
  }
  isChatRoomVisible = true;

  const msgerDraggableEl = getId("msgerDraggable");
  if (msgerDraggableEl) elemDisplay(msgerDraggableEl, true, "flex");

  if (!isMobileDevice && canBePinned() && !isCaptionPinned) {
    // Desktop landscape: dock the chat as a sidebar (matches reference layout)
    chatPin();
  } else {
    // Mobile / narrow / portrait: full-screen centered modal
    if (isChatPinned) chatUnpin();
    chatCenter();
    applyChatViewportStyle();
  }

  syncParticipantsPanelVisibility();
  syncChatToolbarButtons();

  setTippy(chatRoomBtn, "Đóng khung chat (C)", bottomButtonsPlacement);

  // Reference (ChatPanel.tsx): on open, jump straight to the first unread
  // message (top of it) if there were unread messages queued, otherwise
  // land on the bottom - never just leave the scroll wherever it was.
  requestAnimationFrame(() => {
    if (!msgerChat) return;
    const visibleMsgs = Array.from(msgerChat.querySelectorAll(".msg")).filter(
      (m) => m.style.display !== "none",
    );
    if (unreadCountAtOpen > 0 && visibleMsgs.length > 0) {
      const targetIdx = Math.max(0, visibleMsgs.length - unreadCountAtOpen);
      const targetEl = visibleMsgs[targetIdx];
      if (targetEl) {
        isAutoScrollingMsger = true;
        targetEl.scrollIntoView({ behavior: "auto", block: "start" });
        setTimeout(() => {
          isAutoScrollingMsger = false;
          updateMsgerScrollBtn();
        }, 50);
        return;
      }
    }
    scrollToBottomInstant();
  });

  // Desktop: land the cursor straight in the message box so typing can
  // start right away (skip on mobile - it would pop the on-screen keyboard).
  if (!isMobileDevice && msgerInput) {
    setTimeout(() => msgerInput.focus(), 0);
  }
}

/**
 * Sync the active visual state of the chat / participants toolbar buttons
 * with the current chat & participants panel visibility.
 */
function syncChatToolbarButtons() {
  const participantsActive =
    isOpeningParticipants ||
    !!(msgerCPBtn && msgerCPBtn.classList.contains("active"));
  const chatActive = !!isChatRoomVisible && !participantsActive;
  if (chatRoomBtn) {
    chatRoomBtn.classList.toggle("is-active", chatActive);
    chatRoomBtn.setAttribute("aria-pressed", chatActive ? "true" : "false");
  }
  if (typeof participantsBtn !== "undefined" && participantsBtn) {
    participantsBtn.classList.toggle("is-active", participantsActive);
    participantsBtn.setAttribute(
      "aria-pressed",
      participantsActive ? "true" : "false",
    );
    participantsBtn.setAttribute(
      "aria-expanded",
      participantsActive ? "true" : "false",
    );
  }
}

function shouldDockParticipantsPanel() {
  return;
}

function syncParticipantsListContainer() {
  return;
}

function syncParticipantsPanelVisibility() {
  return;
}

/**
 * Escape Special Chars
 * @param {string} regex string to replace
 */
function escapeSpecialChars(regex) {
  return regex.replace(/([()[{*+.$^\\|?])/g, "\\$1");
}

/**
 * Append Message to msger chat room
 * @param {string} from peer name
 * @param {string} img images url
 * @param {string} side left/right
 * @param {string} msg message to append
 * @param {boolean} privateMsg if is private message
 * @param {string} msgId peer id
 * @param {string} to peer name
 */
function appendMessage(
  from,
  img,
  side,
  msg,
  privateMsg,
  msgId = null,
  to = "",
) {
  let time = getFormatDate(new Date());

  // sanitize all params
  const getFrom = filterXSS(from);
  const getTo = filterXSS(to);
  const getSide = filterXSS(side);
  // img is always internally computed (isValidAvatarURL / genAvatarSvg / genGravatar) and is
  // set via setAttribute — no XSS risk. filterXSS must NOT be applied here because it encodes
  // '<', '>' and '&' which breaks SVG data URIs produced by genAvatarSvg.
  const getImg =
    isValidAvatarURL(img) ||
    (typeof img === "string" && img.startsWith("data:image/"))
      ? img
      : "";
  const getMsg = filterXSS(msg);
  const getPrivateMsg = filterXSS(privateMsg);
  const normalizedMsgId = normalizeChatMessageId(msgId);

  // collect chat messages to save it later
  const conversationPeer = getPrivateMsg
    ? getSide === "left"
      ? getFrom
      : getTo
    : "";
  chatMessages.push({
    time: time,
    from: getFrom,
    to: getTo,
    msg: getMsg,
    privateMsg: getPrivateMsg,
    conversationPeer: conversationPeer,
  });

  // check if i receive a private message
  let msgBubble = getPrivateMsg ? "private-msg-bubble" : "msg-bubble";

  // getImg is a user-controlled URL; use a temporary id and setAttribute
  // after insertion to avoid double-decode XSS via insertAdjacentHTML.
  const msgAvatarTmpId = `msg-av-${chatMessagesId}`;
  let messageActionsHTML = ``;

  const msgHTML = renderRoomTemplate("tpl-msger-chat-message", {
    text: {
      senderName: truncateDisplayName(getFrom),
      messageTime: time,
    },
    html: {
      messageActions: messageActionsHTML,
    },
    attrs: {
      messageContainerId: `msg-${chatMessagesId}`,
      messageContainerClass: `msg ${getSide}-msg`,
      chatType: getPrivateMsg ? "private" : "public",
      chatPeer: conversationPeer,
      messageId: normalizedMsgId,
      messageAvatarTmpId: msgAvatarTmpId,
      messageBubbleClass: msgBubble,
      messageTextId: `message-${chatMessagesId}`,
      messageTimeAttr: time,
    },
  });

  const emptyState = document.getElementById("msgerEmptyState");
  if (emptyState) {
    emptyState.remove();
  }

  msgerChat.insertAdjacentHTML("beforeend", msgHTML);
  const msgAvatarEl = document.getElementById(msgAvatarTmpId);
  if (msgAvatarEl) {
    msgAvatarEl.setAttribute("src", getImg);
    msgAvatarEl.removeAttribute("id");
  }

  const message = getId(`message-${chatMessagesId}`);
  if (message) {
    // Process the message for other senders
    message.innerHTML = processMessage(getMsg);
    hljs.highlightAll();
  }

  // Reference (ChatPanel.tsx) only force-scrolls to the bottom on a new
  // message when it's the panel owner's own message or the view is already
  // near the bottom (<140px) - otherwise it leaves the scroll position
  // alone and just re-evaluates the "jump to bottom" arrow. While the
  // panel is closed, don't touch scroll position at all - the open
  // handler (showChatRoomDraggable) decides where to land.
  if (isChatRoomVisible) {
    const isScrollable = msgerChat.scrollHeight > msgerChat.clientHeight + 15;
    if (!isScrollable) {
      if (msgerScrollBottomBtn) msgerScrollBottomBtn.classList.add("hidden");
    } else {
      const distanceFromBottom =
        msgerChat.scrollHeight - msgerChat.scrollTop - msgerChat.clientHeight;
      if (getSide === "right" || distanceFromBottom < 140) {
        scrollToBottomInstant();
      } else {
        updateMsgerScrollBtn();
      }
    }
  }
  filterMessagesByConversation();
  refreshMessageGrouping();
  if (!isMobileDevice) {
    setTippy(getId("msg-delete-" + chatMessagesId), "Xóa", "top");
    setTippy(getId("msg-copy-" + chatMessagesId), "Sao chép", "top");
    setTippy(getId("msg-reaction-" + chatMessagesId), "Thả cảm xúc", "top");
  }
  chatMessagesId++;
}

function refreshMessageGrouping() {
  const messages = Array.from(msgerChat.querySelectorAll(".msg")).filter(
    (message) => message.style.display !== "none",
  );
  let previousKey = "";

  messages.forEach((message, index) => {
    const sender = message.dataset.sender || "";
    const chatType = message.dataset.chatType || "public";
    const chatPeer = message.dataset.chatPeer || "";
    const side = message.classList.contains("right-msg") ? "right" : "left";
    const currentKey = `${side}:${sender}:${chatType}:${chatPeer}`;
    const isGrouped = currentKey === previousKey;

    message.classList.toggle("msg-grouped", isGrouped);
    previousKey = currentKey;

    // Only show the timestamp on the last message of a same-minute
    // run (mirrors ChatPanel.tsx's isLastInGroup check).
    const footer = message.querySelector(".msg-footer");
    if (footer) {
      const nextMessage = messages[index + 1];
      const isLastInGroup =
        !nextMessage || nextMessage.dataset.time !== message.dataset.time;
      footer.style.display = isLastInGroup ? "" : "none";
    }
  });
}

function getConversationMeta() {
  if (activeConversation.type === "private" && activeConversation.peerName) {
    const displayName = truncateDisplayName(activeConversation.peerName);
    return {
      label: "Private chat",
      title: displayName,
      meta: `Direct messages with ${displayName}.`,
      placeholder: `Nhắn tin cho ${displayName}...`,
    };
  }

  return {
    label: "Current view",
    title: "All messages",
    meta: "Public messages appear here.",
    placeholder: "Nhập tin nhắn...",
  };
}

function updateConversationUi() {
  const conversation = getConversationMeta();

  if (msgerInput) msgerInput.placeholder = conversation.placeholder;

  msgerCPList.querySelectorAll(".msger-chat-item").forEach((item) => {
    const isActive =
      activeConversation.type === "private" &&
      item.value &&
      item.value.toLowerCase() === activeConversation.peerName.toLowerCase();
    item.classList.toggle("active", isActive);
  });
}

function filterMessagesByConversation() {
  const conversationPeer = activeConversation.peerName.toLowerCase();

  msgerChat.querySelectorAll(".msg").forEach((message) => {
    const chatType = message.dataset.chatType || "public";
    const chatPeer = (message.dataset.chatPeer || "").toLowerCase();
    const shouldShow =
      activeConversation.type === "private"
        ? chatType === "private" && chatPeer === conversationPeer
        : chatType === "public";

    elemDisplay(message, shouldShow, "flex");
  });

  refreshMessageGrouping();
  msgerChat.scrollTop = msgerChat.scrollHeight;
}

function setActiveConversation(type = "public", peerName = "", peerId = "") {
  activeConversation = {
    type,
    peerName: filterXSS(peerName || ""),
    peerId: peerId || "",
  };

  updateConversationUi();
  filterMessagesByConversation();
}

function resolvePeerNameById(peerId = "") {
  if (!peerId) return "";

  const privateChatButton = getId(peerId + "_pMsgBtn");
  const privatePeerName =
    privateChatButton?.dataset?.value ||
    privateChatButton?.getAttribute("data-value");
  if (privatePeerName) {
    return privatePeerName;
  }

  return allPeers[peerId]?.peer_name || "";
}

function getConversationShareTarget(actionLabel = "this item") {
  if (activeConversation.type !== "private") {
    return {
      broadcast: true,
      peerId: myPeerId,
      videoPeerId: null,
      peerName: "",
    };
  }

  if (!activeConversation.peerId) {
    userLog("info", `Chuyển sang khung chat riêng để chia sẻ ${actionLabel}`);
    return null;
  }

  return {
    broadcast: false,
    peerId: activeConversation.peerId,
    videoPeerId: activeConversation.peerId,
    peerName:
      activeConversation.peerName ||
      resolvePeerNameById(activeConversation.peerId),
  };
}

/**
 * Toggle empty participants notice
 */
function toggleMsgerParticipantsEmptyNotice() {
  return;
}

/**
 * Escape a value for safe embedding inside a single-quoted JavaScript string
 * literal that lives in an HTML attribute (e.g. an inline onclick handler).
 *
 * filterXSS() / DOMPurify do NOT encode characters that break out of a JS
 * string context (single-quote, backslash, newline). Embedding user-controlled
 * data such as a peer name directly in an inline handler without this escape
 * allows a stored XSS where a crafted name like `X', alert(1), '` would close
 * the string argument and inject an arbitrary JS expression as a new argument.
 *
 * @param {*} value
 * @returns {string}
 */
function escapeJsString(value) {
  return String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/</g, "\\x3C")
    .replace(/>/g, "\\x3E")
    .replace(/&/g, "\\x26");
}

/**
 * Process Messages
 * @param {string} message
 * @returns string message processed
 */
function processMessage(message) {
  const codeBlockRegex = /```([a-zA-Z0-9]+)?\n([\s\S]*?)```/g;
  let parts = [];
  let lastIndex = 0;

  message.replace(codeBlockRegex, (match, lang, code, offset) => {
    if (offset > lastIndex) {
      parts.push({ type: "text", value: message.slice(lastIndex, offset) });
    }
    parts.push({ type: "code", lang, value: code });
    lastIndex = offset + match.length;
  });

  if (lastIndex < message.length) {
    parts.push({ type: "text", value: message.slice(lastIndex) });
  }

  return parts
    .map((part) => {
      if (part.type === "text") {
        return part.value;
      } else if (part.type === "code") {
        return `<pre><code class="language-${part.lang || ""}">${part.value}</code></pre>`;
      }
    })
    .join("");
}

/**
 * Stream message
 * @param {string} element
 * @param {string} message
 * @param {integer} speed
 */
function streamMessage(element, message, speed = 100) {
  const parts = processMessage(message);
  const words = parts.split(" ");

  let textBuffer = "";
  let wordIndex = 0;

  const interval = setInterval(() => {
    if (wordIndex < words.length) {
      textBuffer += words[wordIndex] + " ";
      element.innerHTML = textBuffer;
      wordIndex++;
    } else {
      clearInterval(interval);
      highlightCodeBlocks(element);
    }
  }, speed);

  function highlightCodeBlocks(element) {
    const codeBlocks = element.querySelectorAll("pre code");
    codeBlocks.forEach((block) => {
      hljs.highlightElement(block);
    });
  }
}

function closeAllMsgerParticipantDropdownMenus() {
  return;
}

function positionMsgerParticipantDropdownMenu(toggleEl, menuEl) {
  if (!toggleEl || !menuEl) return;

  const gap = 8;
  const viewportPadding = 12;

  if (!menuEl._msgerDropdownPlaceholder && menuEl.parentNode) {
    const placeholder = document.createElement("span");
    placeholder.style.display = "none";
    menuEl.parentNode.insertBefore(placeholder, menuEl);
    menuEl._msgerDropdownPlaceholder = placeholder;
  }

  menuEl._msgerDropdownToggle = toggleEl;
  document.body.appendChild(menuEl);

  menuEl.classList.add("show", "floating");
  menuEl.style.visibility = "hidden";
  menuEl.style.left = "0px";
  menuEl.style.top = "0px";
  menuEl.style.maxHeight = `${Math.max(260, window.innerHeight - viewportPadding * 2)}px`;

  const toggleRect = toggleEl.getBoundingClientRect();
  const menuWidth = Math.max(menuEl.offsetWidth, 220);
  const menuHeight = menuEl.offsetHeight;

  const maxLeft = window.innerWidth - menuWidth - viewportPadding;
  const preferredLeft = toggleRect.right - menuWidth;
  const left = Math.max(viewportPadding, Math.min(preferredLeft, maxLeft));

  const fitsBelow =
    toggleRect.bottom + gap + menuHeight <=
    window.innerHeight - viewportPadding;
  const top = fitsBelow
    ? toggleRect.bottom + gap
    : Math.max(viewportPadding, toggleRect.top - menuHeight - gap);

  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
  menuEl.style.visibility = "";
}

function supportsHoverPointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function openMsgerParticipantDropdownMenu(toggleEl, menuEl) {
  if (!toggleEl || !menuEl) return;

  if (activeMsgerParticipantDropdown?.menuEl === menuEl) {
    return;
  }

  closeAllMsgerParticipantDropdownMenus();
  positionMsgerParticipantDropdownMenu(toggleEl, menuEl);
  toggleEl.setAttribute("aria-expanded", "true");
  activeMsgerParticipantDropdown = { toggleEl, menuEl };
}

function toggleMsgerParticipantDropdownMenu(toggleEl, menuEl) {
  if (!toggleEl || !menuEl) return;

  const isOpen = menuEl.classList.contains("show");
  closeAllMsgerParticipantDropdownMenus();

  if (isOpen) return;

  openMsgerParticipantDropdownMenu(toggleEl, menuEl);
}

function handleMsgerDropdownOutsidePress(e) {
  if (
    !msgerCPDropDownMenuBtn?.contains(e.target) &&
    !msgerCPDropDownContent?.contains(e.target) &&
    !msgerSidebarDropDownMenuBtn?.contains(e.target) &&
    !msgerSidebarDropDownContent?.contains(e.target)
  ) {
    elemDisplay(msgerCPDropDownContent, false);
    elemDisplay(msgerSidebarDropDownContent, false);
  }
}

function handleMsgerParticipantDropdownDocumentClick(event) {
  if (!activeMsgerParticipantDropdown) return;

  const { toggleEl, menuEl } = activeMsgerParticipantDropdown;
  if (toggleEl?.contains(event.target) || menuEl?.contains(event.target)) {
    return;
  }

  closeAllMsgerParticipantDropdownMenus();
}

function getMsgerParticipantDropdownActionMarkup(
  buttonId,
  iconClass,
  label,
  variant = "default",
) {
  const actionClass =
    variant === "danger"
      ? "dropdown-item app-dropdown-action msger-participant-action msger-participant-action-danger"
      : "dropdown-item app-dropdown-action msger-participant-action";

  return `
        <li>
            <button id="${buttonId}" class="${actionClass}">
                <span class="msger-participant-action-icon"><i class="${iconClass}"></i></span>
                <span class="msger-participant-action-label">${label}</span>
            </button>
        </li>
    `;
}

function getMsgerParticipantDropdownDividerMarkup() {
  return `<li class="msger-dropdown-divider" aria-hidden="true"></li>`;
}

/**
 * Add participants in the chat room lists
 * @param {object} peers all peers info connected to the same room
 */
function msgerAddPeers() {
  return;
}

/**
 * Search peer by name in chat room lists to send the private messages
 */
function searchPeer() {
  return;
}

/**
 * Remove participant from chat room lists
 * @param {string} peer_id socket.id
 */
function msgerRemovePeer() {
  return;
}

/**
 * Check Message
 * @param {string} txt passed text
 * @returns {string} html format
 */
function checkMsg(txt) {
  const text = filterXSS(txt);
  if (text.trim().length == 0) return;
  if (isHtml(text)) return sanitizeHtml(text);
  if (isValidHttpURL(text)) {
    if (isImageURL(text)) return getImage(text);
    //if (isVideoTypeSupported(text)) return getIframe(text);
    return getLink(text);
  }
  if (isChatPasteTxt && getLineBreaks(text) > 1) {
    isChatPasteTxt = false;
    return getPre(text);
  }
  if (getLineBreaks(text) > 1) return getPre(text);
  console.log("CheckMsg", text);
  return text;
}

/**
 * Sanitize Html
 * @param {string} input code
 * @returns Html as string
 */
function sanitizeHtml(input) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
    "/": "&#x2F;",
  };
  return input.replace(/[&<>"'/]/g, (m) => map[m]);
}

/**
 * Check if string contain html
 * @param {string} str
 * @returns
 */
function isHtml(str) {
  let a = document.createElement("div");
  a.innerHTML = str;
  for (let c = a.childNodes, i = c.length; i--;) {
    if (c[i].nodeType == 1) return true;
  }
  return false;
}

/**
 * Check if valid URL
 * @param {string} str to check
 * @returns boolean true/false
 */
function isValidHttpURL(input) {
  try {
    new URL(input);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Check if url passed is a image
 * @param {string} url to check
 * @returns {boolean} true/false
 */
function isImageURL(input) {
  if (!input || typeof input !== "string") return false;
  // Data URLs can still be valid images for generic content handling.
  if (input.startsWith("data:image/")) return true;
  try {
    const url = new URL(input);
    return [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".tiff",
      ".svg",
    ].some((ext) => url.pathname.toLowerCase().endsWith(ext));
  } catch (e) {
    return false;
  }
}

/**
 * Check if a URL is a valid HTTP/HTTPS avatar URL.
 * Unlike isImageURL, this does NOT require a file extension,
 * so it accepts dynamic avatar endpoints (e.g. GitHub, Gravatar, DiceBear).
 * @param {string} input
 * @returns {boolean}
 */
function isValidAvatarURL(input) {
  if (!input || typeof input !== "string") return false;
  if (input.startsWith("data:")) return false;
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Check if Image File
 * @return boolean
 */
function isImageFile(filename) {
  return /(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp|\.tiff|\.svg)$/i.test(
    filename,
  );
}

/**
 * Get image
 * @param {string} text
 * @returns img
 */
function getImage(text) {
  const url = filterXSS(text);
  const div = document.createElement("div");
  const img = document.createElement("img");
  img.setAttribute("src", url);
  img.setAttribute("width", "200px");
  img.setAttribute("height", "auto");
  div.appendChild(img);
  console.log("GetImg", div.firstChild.outerHTML);
  return div.firstChild.outerHTML;
}

/**
 * Get Link
 * @param {string} text
 * @returns a href
 */
function getLink(text) {
  const url = filterXSS(text);
  const a = document.createElement("a");
  const div = document.createElement("div");
  const linkText = document.createTextNode(url);
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.appendChild(linkText);
  div.appendChild(a);
  console.log("GetLink", div.firstChild.outerHTML);
  return div.firstChild.outerHTML;
}

/**
 * Get pre
 * @param {string} txt
 * @returns pre
 */
function getPre(txt) {
  const text = filterXSS(txt);
  const pre = document.createElement("pre");
  const div = document.createElement("div");
  pre.textContent = text;
  div.appendChild(pre);
  console.log("GetPre", div.firstChild.outerHTML);
  return div.firstChild.outerHTML;
}

/**
 * Get IFrame from URL
 * @param {string} text
 * @returns html iframe
 */
function getIframe(text) {
  const url = filterXSS(text);
  const iframe = document.createElement("iframe");
  const div = document.createElement("div");
  const is_youtube = getVideoType(url) == "na" ? true : false;
  const video_audio_url = is_youtube ? getYoutubeEmbed(url) : url;
  iframe.setAttribute("src", video_audio_url);
  iframe.setAttribute("width", "auto");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute(
    "allow",
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
  );
  iframe.setAttribute("allowfullscreen", "allowfullscreen");
  div.appendChild(iframe);
  console.log("GetIFrame", div.firstChild.outerHTML);
  return div.firstChild.outerHTML;
}

/**
 * Get text Line breaks
 * @param {string} text
 * @returns integer lines
 */
function getLineBreaks(text) {
  return (text.match(/\n/g) || []).length;
}

/**
 * Check chat input line breaks and value length
 */
function checkLineBreaks() {
  if (!msgerInput) return;

  msgerInput.style.height = "auto";

  const minHeight = 52;
  const maxHeight = 160;
  const nextHeight = Math.min(
    Math.max(msgerInput.scrollHeight, minHeight),
    maxHeight,
  );

  msgerInput.style.height = `${nextHeight}px`;
}

/**
 * Format date
 * @param {object} date
 * @returns {string} date format h:m:s
 */
function getFormatDate(date) {
  // HH:MM only (no seconds) - matches the reference chat timestamp format
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Send message over Secure dataChannels
 * @param {string} from peer name
 * @param {string} fromAvatar peer avatar
 * @param {string} to peer name
 * @param {string} msg message to send
 * @param {boolean} privateMsg if is a private message
 * @param {string} id peer_id
 */
function emitMsg(from, fromAvatar, to, msg, privateMsg, id, msgId = "") {
  if (!msg) return;

  // sanitize all params
  const getFrom = filterXSS(from);
  const getFromAvatar = filterXSS(fromAvatar);
  const getFromId = filterXSS(myPeerId);
  const getTo = filterXSS(to);
  const getMsg = filterXSS(msg);
  const getPrivateMsg = filterXSS(privateMsg);
  const getId = filterXSS(id);
  const getMsgId = normalizeChatMessageId(filterXSS(msgId));

  const chatMessage = {
    type: "chat",
    from: getFrom,
    fromAvatar: getFromAvatar,
    fromId: getFromId,
    id: getId,
    msg_id: getMsgId,
    to: getTo,
    msg: getMsg,
    privateMsg: getPrivateMsg,
  };
  console.log("Send msg", chatMessage);
  sendToDataChannel(chatMessage);
}

/**
 * Handle incoming chat message received via RTC Data Channel
 * @param {object} dataMessage message received from a peer
 */
function handleDataChannelChat(dataMessage) {
  const { from, fromAvatar, fromId, msg, msg_id, privateMsg } = dataMessage;

  appendMessage(from, fromAvatar, "left", msg, privateMsg, msg_id, from);

  // The reference NEVER auto-opens the chat panel on an incoming message -
  // it only bumps the unread-count badge (a saved `show_chat_on_msg: true`
  // from an older localStorage could otherwise still force this open, so
  // this no longer depends on that setting at all).
  if (!isChatRoomVisible) {
    chatUnreadCount++;
    updateChatUnreadBadge();
  }
  playSound("raiseHand");
}

/**
 * Show AI typing indicator animation in the chat
 * @param {string} aiName
 */
function showAITypingIndicator(aiName) {
  const existing = getId(`ai-typing-${aiName}`);
  if (existing) return;
  const typingHTML = renderRoomTemplate("tpl-ai-typing-indicator", {
    attrs: {
      typingIndicatorId: `ai-typing-${aiName}`,
    },
  });
  msgerChat.insertAdjacentHTML("beforeend", typingHTML);
  msgerChat.scrollTop = msgerChat.scrollHeight;
}

/**
 * Hide AI typing indicator animation from the chat
 * @param {string} aiName
 */
function hideAITypingIndicator(aiName) {
  const indicator = getId(`ai-typing-${aiName}`);
  if (indicator) indicator.remove();
}

/**
 * Hide - show my settings
 */
function hideShowMySettings() {
  if (!isMySettingsVisible) {
    playSound("newMessage");
    if (isMobileDevice) setSP("--mySettings-select-w", "99%");
    // my current peer name
    myPeerNameSet.placeholder = myPeerName;
    // backdrop locks/dims the background and centers the fixed-size panel
    elemDisplay(mySettingsBackdrop, true, "flex");
    setTippy(mySettingsBtn, "Đóng cài đặt", bottomButtonsPlacement);
    isMySettingsVisible = true;

    return;
  }
  elemDisplay(mySettingsBackdrop, false);
  setTippy(mySettingsBtn, "Mở cài đặt", bottomButtonsPlacement);
  isMySettingsVisible = false;
}

/**
 * Handle html tab settings
 * https://www.w3schools.com/howto/howto_js_tabs.asp
 * @param {object} evt event
 * @param {string} tabName name of the tab to open
 */
function openTab(evt, tabName) {
  const tabN = getId(tabName);
  const tabContent = getEcN("tabcontent");
  const tabLinks = getEcN("tablinks");
  let i;
  for (i = 0; i < tabContent.length; i++) {
    elemDisplay(tabContent[i], false);
  }
  for (i = 0; i < tabLinks.length; i++) {
    tabLinks[i].className = tabLinks[i].className.replace(" active", "");
  }
  elemDisplay(tabN, true, "block");
  evt.currentTarget.className += " active";
}

let peerNameSuccessIconTimeout = null;
/**
 * Briefly flash a green checkmark next to the rename input to confirm
 * the rename succeeded (fades in, holds ~3s, fades out).
 */
function showPeerNameSuccessIcon() {
  const icon = getId("myPeerNameSuccessIcon");
  if (!icon) return;
  playSound("click");
  if (peerNameSuccessIconTimeout) clearTimeout(peerNameSuccessIconTimeout);
  icon.style.display = "inline-flex";
  void icon.offsetWidth; // force reflow so the fade-in re-triggers on repeat renames
  icon.classList.add("visible");
  peerNameSuccessIconTimeout = setTimeout(() => {
    icon.classList.remove("visible");
    peerNameSuccessIconTimeout = setTimeout(() => {
      icon.style.display = "none";
    }, 250);
  }, 3000);
}

/**
 * Update myPeerName to other peers in the room
 */
async function updateMyPeerName() {
  // myNewPeerName empty
  if (!myPeerNameSet.value) return;

  // check if peer name is already in use in the room
  if (await checkUserName(myPeerNameSet.value)) {
    myPeerNameSet.value = "";
    return userLog("warning", "Tên người dùng đã được sử dụng!");
  }

  // prevent xss execution itself
  myPeerNameSet.value = filterXSS(myPeerNameSet.value);

  // prevent XSS injection to remote peer
  if (isHtml(myPeerNameSet.value)) {
    myPeerNameSet.value = "";
    return userLog("warning", "Tên không hợp lệ!");
  }

  const myNewPeerName = myPeerNameSet.value;
  const myOldPeerName = myPeerName;

  myPeerName = myNewPeerName;
  setPeerNameHTML(myVideoPeerName, myPeerName, true);

  myScreenPeerName = getId("myScreenPeerName");
  if (myScreenPeerName)
    setPeerNameHTML(myScreenPeerName, myPeerName, true, "", true);

  sendToServer("peerName", {
    room_id: roomId,
    peer_name_old: myOldPeerName,
    peer_name_new: myPeerName,
    peer_avatar: myPeerAvatar,
  });

  myPeerNameSet.value = "";
  myPeerNameSet.placeholder = myPeerName;

  window.localStorage.peer_name = myPeerName;

  setPeerAvatarImgName("myVideoAvatarImage", myPeerName, myPeerAvatar);
  setPeerAvatarImgName("myProfileAvatar", myPeerName, myPeerAvatar);
  updateSoloCompactAvatar();
  setPeerChatAvatarImgName("right", myPeerName, myPeerAvatar);
  showPeerNameSuccessIcon();
}

/**
 * Update my avatar from URL in-memory only (cleared on page refresh)
 */
async function updateMyPeerAvatarByUrl() {
  const RANDOM_AVATAR_COUNT = 10; // 5x2 grid

  function buildRandomAvatarUrls() {
    const urls = [];
    for (let i = 0; i < RANDOM_AVATAR_COUNT; i++) {
      const seed = Math.random().toString(36).substring(2, 10);
      const style = DICEBEAR_AVATAR_STYLES[i % DICEBEAR_AVATAR_STYLES.length];
      urls.push(
        `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`,
      );
    }
    return urls;
  }

  // Only carry the current avatar into the confirm value if it's a real
  // (non-generated) URL - the DOM preview can still show the generated
  // data: fallback, but that's never a valid confirmable avatar value.
  let selectedAvatarUrl =
    myPeerAvatar && isValidAvatarURL(myPeerAvatar) ? myPeerAvatar : "";

  const result = await Swal.fire({
    background: swBg,
    title: isMobileDevice ? "ĐỔI AVATAR" : "ĐỔI ẢNH ĐẠI DIỆN",
    html: '<div id="avatarPickerRoot"></div>',
    confirmButtonText: "Áp dụng",
    showCancelButton: true,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
    didOpen: () => {
      playSound("newMessage");

      const root = document.getElementById("avatarPickerRoot");
      if (!root) return;

      // Big round avatar preview
      const preview = document.createElement("img");
      preview.src = getId("myProfileAvatar")?.src || "";
      preview.style.cssText =
        "display:block;width:96px;height:96px;border-radius:50%;object-fit:cover;border:2px solid var(--ds-brand-500);margin:4px auto 16px;background:var(--ds-bg-1);";
      root.appendChild(preview);

      const grid = document.createElement("div");
      grid.style.cssText =
        "display:grid;grid-template-columns:repeat(5,1fr);gap:10px;justify-items:center;margin-bottom:14px;";

      function renderGrid(urls) {
        grid.innerHTML = "";
        urls.forEach((url) => {
          const img = document.createElement("img");
          img.src = url;
          img.style.cssText =
            "width:48px;height:48px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:border-color 0.2s;object-fit:cover;background:var(--ds-bg-1);";
          img.addEventListener("mouseover", () => {
            if (url !== selectedAvatarUrl) img.style.borderColor = "var(--ds-brand-500)";
          });
          img.addEventListener("mouseout", () => {
            if (url !== selectedAvatarUrl) img.style.borderColor = "transparent";
          });
          img.addEventListener("click", () => {
            selectedAvatarUrl = url;
            preview.src = url;
            Array.from(grid.children).forEach(
              (c) => (c.style.borderColor = "transparent"),
            );
            img.style.borderColor = "var(--ds-brand-500)";
          });
          grid.appendChild(img);
        });
      }

      renderGrid(buildRandomAvatarUrls());
      root.appendChild(grid);

      // Refresh button - reshuffles the random avatar list. Placed in the
      // same row as Áp dụng/Hủy (Swal's own actions bar), not its own row.
      const refreshBtn = document.createElement("button");
      refreshBtn.type = "button";
      refreshBtn.setAttribute("aria-label", "Đổi danh sách ảnh đại diện");
      refreshBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">' +
        '<path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>';
      refreshBtn.style.cssText =
        "display:flex;align-items:center;justify-content:center;width:36px;height:36px;margin:0.3125em;border-radius:50%;border:1px solid var(--ds-border);background:transparent;color:var(--ds-border-strong);cursor:pointer;";
      refreshBtn.addEventListener(
        "mouseover",
        () => (refreshBtn.style.borderColor = "var(--ds-brand-500)"),
      );
      refreshBtn.addEventListener(
        "mouseout",
        () => (refreshBtn.style.borderColor = "var(--ds-border)"),
      );
      refreshBtn.addEventListener("click", () => {
        playSound("locked");
        renderGrid(buildRandomAvatarUrls());
      });

      const actions = Swal.getActions();
      if (actions) {
        actions.insertBefore(refreshBtn, actions.firstChild);
      } else {
        root.appendChild(refreshBtn);
      }
    },
    preConfirm: () => selectedAvatarUrl,
  });

  if (!result.isConfirmed || !result.value) return;

  try {
    myPeerAvatar = result.value;
    lsSettings.peer_avatar = myPeerAvatar;
    lsSettings.peer_avatar_auto = false; // hand-picked now, not auto-assigned
    lS.setSettings(lsSettings);

    setPeerAvatarImgName("myVideoAvatarImage", myPeerName, myPeerAvatar);
    setPeerAvatarImgName("myProfileAvatar", myPeerName, myPeerAvatar);
    updateSoloCompactAvatar();
    setPeerChatAvatarImgName("right", myPeerName, myPeerAvatar);

    emitMyPeerProfile();
    playSound("click");
  } catch (err) {
    console.error("Failed to set avatar URL", err);
  }
}

/**
 * Append updated peer name to video player
 * @param {object} config data
 */
function handlePeerName(config) {
  const peer_id = config.peer_id;
  const peer_name = filterXSS(config.peer_name);
  const peer_avatar = filterXSS(config.peer_avatar);

  // Keep the latest profile in memory so late DOM creation still uses updated data.
  if (allPeers && allPeers[peer_id]) {
    allPeers[peer_id]["peer_name"] = peer_name;
    allPeers[peer_id]["peer_avatar"] = peer_avatar;
  }

  const videoName = getId(peer_id + "_name");
  const screenName = getId(peer_id + "_screen_name");
  // Rebuild via setPeerNameHTML (not innerText) so the icon/mic-badge
  // pill structure survives a name change instead of being wiped down
  // to plain text.
  if (videoName) setPeerNameHTML(videoName, peer_name, false, peer_id);
  if (screenName)
    setPeerNameHTML(screenName, peer_name, false, peer_id, true);
  // change also avatar and btn value - name on chat lists....
  const msgerPeerName = getId(peer_id + "_pMsgBtn");
  const msgerPeerAvatar = getId(peer_id + "_pMsgAvatar");
  if (msgerPeerName) msgerPeerName.value = peer_name;

  if (msgerPeerAvatar) {
    msgerPeerAvatar.src =
      peer_avatar && isValidAvatarURL(peer_avatar)
        ? peer_avatar
        : isValidEmail(peer_name)
          ? genGravatar(peer_name)
          : genAvatarSvg(peer_name, 32);
  }

  // refresh also peer video avatar name
  setPeerAvatarImgName(peer_id + "_avatar", peer_name, peer_avatar);
}

/**
 * Send my Video-Audio-Hand... status
 * @param {string} element typo
 * @param {boolean} status true/false
 */
async function emitPeerStatus(element, status, extras = {}) {
  sendToServer("peerStatus", {
    room_id: roomId,
    peer_name: myPeerName,
    peer_id: myPeerId,
    element: element,
    status: status,
    extras: extras,
  });
}

/**
 * Handle hide myself from room view
 * @param {boolean} isHideMeActive
 */
function handleHideMe(isHideMeActive) {
  const hideMeIcon = hideMeBtn.querySelector("i");
  if (isHideMeActive) {
    if (isVideoPinned && myVideoPinBtn) myVideoPinBtn.click();
    elemDisplay(myVideoWrap, false);
    setColor(hideMeIcon, "red");
    hideMeIcon.className = className.hideMeOn;
    playSound("off");
  } else {
    elemDisplay(myVideoWrap, true, "inline-block");
    hideMeIcon.className = className.hideMeOff;
    setColor(hideMeIcon, "var(--btn-bar-bg-color)");
    playSound("on");
  }
  resizeVideoMedia();
}

/**
 * Set my Hand Status and Icon
 */
function setMyHandStatus() {
  myHandStatus = !myHandStatus;
  if (myHandStatus) {
    // Raise hand
    setColor(myHandBtn, "#FFD700");
    elemDisplay(myHandStatusIcon, true);
    setTippy(myHandBtn, "Hạ tay (H)", bottomButtonsPlacement);
    playSound("raiseHand");
  } else {
    // Lower hand
    setColor(myHandBtn, "var(--btn-bar-bg-color)");
    elemDisplay(myHandStatusIcon, false);
    setTippy(myHandBtn, "Giơ tay (H)", bottomButtonsPlacement);
  }
  if (myHandBtn && myHandBtn.setAttribute)
    myHandBtn.setAttribute("aria-pressed", String(!!myHandStatus));
  emitPeerStatus("hand", myHandStatus);
}

/**
 * Set My Audio Status Icon and Title
 * @param {boolean} status of my audio
 * @param {boolean} playToggleSound false for automatic/programmatic status
 *   changes (init defaults, ?audio= query param, etc.) - only a real user
 *   click on the mic button should make a sound.
 */
function setMyAudioStatus(status, playToggleSound = true) {
  setTimeout(() => {
    refreshPeerNameTag(document.getElementById("myVideoPeerName"));
    refreshPeerNameTag(document.getElementById("myScreenPeerName"));
  }, 100);
  console.log("My audio status", status);
  const audioClassName = status ? className.audioOn : className.audioOff;
  audioBtn.className = audioClassName;
  myAudioStatusIcon.className = audioClassName;

  // Mic-off badge on the floating self-view thumbnail (top-right)
  const soloWrapForAudio = getId("myVideoWrap");
  if (soloWrapForAudio) {
    soloWrapForAudio.classList.toggle("solo-audio-off", !status);
  }

  // send my audio status to all peers in the room
  emitPeerStatus("audio", status);
  const audioStatusLabel = status
    ? "Âm thanh của tôi đang bật"
    : "Âm thanh của tôi đang tắt";
  setTippy(myAudioStatusIcon, audioStatusLabel, "bottom");
  setTippy(
    audioBtn,
    status ? "Tắt âm thanh (A)" : "Bật âm thanh (A)",
    bottomButtonsPlacement,
  );
  if (audioBtn && audioBtn.setAttribute)
    audioBtn.setAttribute("aria-pressed", String(!!status));
  if (playToggleSound) playSound("click");

  if (typeof isInPagePip !== "undefined" && isInPagePip)
    updatePipLocalControlButtons();
}

/**
 * Set My Video Status Icon and Title
 * @param {boolean} status of my video
 * @param {boolean} playToggleSound false for automatic/programmatic status
 *   changes (init defaults, ?video= query param, etc.) - only a real user
 *   click on the camera button should make a sound.
 */
function setMyVideoStatus(status, playToggleSound = true) {
  setTimeout(() => {
    refreshPeerNameTag(document.getElementById("myVideoPeerName"));
    refreshPeerNameTag(document.getElementById("myScreenPeerName"));
  }, 100);
  console.log("My video status", status);

  // On video OFF display my video avatar name
  if (myVideoAvatarImage) {
    elemDisplay(
      myVideoAvatarImage,
      status ? false : true,
      status ? undefined : "block",
    );
  }

  if (myVideoStatusIcon) {
    setMediaButtonsClass([
      { element: myVideoStatusIcon, status, mediaType: "video" },
    ]);
  }

  // Swap the floating self-view thumbnail to its compact camera-off
  // placeholder. Note: this is unrelated to the "hide preview" eye
  // button, which only hides the widget locally and never touches
  // the real camera track.
  const soloWrapForVideo = getId("myVideoWrap");
  if (soloWrapForVideo) {
    soloWrapForVideo.classList.toggle("solo-cam-off", !status);
  }

  // send my video status to all peers in the room
  emitPeerStatus("video", status);

  const videoStatusLabel = status
    ? "Video của tôi đang bật"
    : "Video của tôi đang tắt";

  if (!isMobileDevice) {
    if (myVideoStatusIcon)
      setTippy(myVideoStatusIcon, videoStatusLabel, "bottom");
    setTippy(
      videoBtn,
      status ? "Tắt video (V)" : "Bật video (V)",
      bottomButtonsPlacement,
    );
  }
  if (videoBtn && videoBtn.setAttribute)
    videoBtn.setAttribute("aria-pressed", String(!!status));

  if (status) {
    displayElements([
      { element: myVideo, display: true, mode: "block" },
      { element: initVideo, display: true, mode: "block" },
    ]);
    if (playToggleSound) playSound("click");
  } else {
    displayElements([
      { element: myVideo, display: false },
      { element: initVideo, display: false },
    ]);
    const myVideoWrap = getId("myVideoWrap");
    const spinner = myVideoWrap
      ? myVideoWrap.querySelector(".video-loading-spinner")
      : null;
    if (spinner) elemDisplay(spinner, false);
    if (playToggleSound) playSound("click");
  }

  if (typeof isInPagePip !== "undefined" && isInPagePip)
    updatePipLocalControlButtons();
}

/**
 * Handle peer audio - video - hand - privacy status
 * @param {object} config data
 */
function handlePeerStatus(config) {
  //
  const { peer_id, peer_name, element, status, extras } = config;

  switch (element) {
    case "video":
      setPeerVideoStatus(peer_id, status);
      break;
    case "screen":
      setPeerScreenStatus(peer_id, status, extras);
      break;
    case "audio":
      setPeerAudioStatus(peer_id, status);
      break;
    case "hand":
      setPeerHandStatus(peer_id, peer_name, status);
      break;
    default:
      break;
  }
}

/**
 * Set Participant Hand Status Icon and Title
 * @param {string} peer_id socket.id
 * @param {string} peer_name peer name
 * @param {boolean} status of the hand
 */
function setPeerHandStatus(peer_id, peer_name, status) {
  const peerHandStatus = getId(peer_id + "_handStatus");
  if (status) {
    elemDisplay(peerHandStatus, true);
    userLog("toast", `${icons.user} ${peer_name} \n đã giơ tay!`);
    playSound("raiseHand");
  } else {
    elemDisplay(peerHandStatus, false);
  }
}

/**
 * Set Participant Audio Status and toggle Audio Volume
 * @param {string} peer_id socket.id
 * @param {boolean} status of peer audio
 */
function setPeerAudioStatus(peer_id, status) {
  setTimeout(() => {
    refreshPeerNameTag(document.getElementById(peer_id + "_name"));
    // The screen tile has its own separate name pill (peer_id+"_screen_name")
    // that never got a refresh here before, so muting/unmuting while
    // already screen sharing (or vice versa) never showed the mic-off icon.
    refreshPeerNameTag(document.getElementById(peer_id + "_screen_name"));
    if (typeof isInPagePip !== "undefined" && isInPagePip)
      updatePipStatusBadges();
  }, 100);
  const peerAudioStatus = getId(peer_id + "_audioStatus");

  if (peerAudioStatus) {
    setMediaButtonsClass([
      { element: peerAudioStatus, status, mediaType: "audio" },
    ]);
    setTippy(
      peerAudioStatus,
      status
        ? "Âm thanh người tham gia đang bật"
        : "Âm thanh người tham gia đang tắt",
      "bottom",
    );
    status ? playSound("on") : playSound("off");
  }
}

/**
 * Mute Audio to specific user in the room
 * @param {string} peer_id socket.id
 */
function handlePeerAudioBtn(peer_id) {
  if (!buttons.remote.audioBtnClickAllowed) return;
  const peerAudioBtn = getId(peer_id + "_audioStatus");
  peerAudioBtn.onclick = () => {
    if (peerAudioBtn.className === className.audioOn && isPresenter) {
      disablePeer(peer_id, "audio");
    }
  };
}

/**
 * Hide Video to specified peer in the room
 * @param {string} peer_id socket.id
 */
function handlePeerVideoBtn(peer_id) {
  if (!useVideo || !buttons.remote.videoBtnClickAllowed) return;
  const peerVideoBtn = getId(peer_id + "_videoStatus");
  peerVideoBtn.onclick = () => {
    if (peerVideoBtn.className === className.videoOn && isPresenter) {
      disablePeer(peer_id, "video");
    }
  };
}

/**
 * Send video - audio URL to specific peer
 * @param {string} peer_id socket.id
 * @param {string} peerYoutubeBtnId youtube button id
 */
function handlePeerVideoAudioUrl(peer_id, peerYoutubeBtnId) {
  const peerYoutubeBtn = getId(peerYoutubeBtnId);
  peerYoutubeBtn.onclick = () => {
    sendVideoUrl(peer_id);
  };
}

/**
 * Set Participant Video Status Icon and Title
 * @param {string} peer_id socket.id
 * @param {boolean} status of peer video
 */
function setPeerVideoStatus(peer_id, status) {
  setTimeout(() => {
    refreshPeerNameTag(document.getElementById(peer_id + "_name"));
    if (typeof isInPagePip !== "undefined" && isInPagePip)
      updatePipStatusBadges();
  }, 100);
  const peerVideoPlayer = getId(peer_id + "___video");
  const peerVideoAvatarImage = getId(peer_id + "_avatar");
  const peerVideoStatus = getId(peer_id + "_videoStatus");
  const peerVideoWrap = getId(peer_id + "_videoWrap");

  if (status) {
    displayElements([
      { element: peerVideoPlayer, display: true, mode: "block" },
      { element: peerVideoAvatarImage, display: false },
    ]);
    // Safari requires explicit play() when a video element becomes visible again
    if (peerVideoPlayer) peerVideoPlayer.play().catch(() => {});
    if (peerVideoStatus) {
      setMediaButtonsClass([
        { element: peerVideoStatus, status: true, mediaType: "video" },
      ]);
      setTippy(peerVideoStatus, "Video người tham gia đang bật", "bottom");
      playSound("on");
    }
  } else {
    displayElements([
      { element: peerVideoPlayer, display: false },
      { element: peerVideoAvatarImage, display: true, mode: "block" },
    ]);
    const spinner = peerVideoWrap
      ? peerVideoWrap.querySelector(".video-loading-spinner")
      : null;
    if (spinner) elemDisplay(spinner, false);
    if (peerVideoStatus) {
      setMediaButtonsClass([
        { element: peerVideoStatus, status: false, mediaType: "video" },
      ]);
      setTippy(peerVideoStatus, "Video người tham gia đang tắt", "bottom");
      playSound("off");
    }
    // Can't draw a custom avatar/caption inside iOS's native fullscreen
    // video player (#newFullscreenBtn's webkitEnterFullscreen) - that
    // surface is owned by the OS, not our DOM. Next best thing: drop
    // back out of it automatically, which lands on the normal in-app
    // tile that already shows the peer's round avatar + "Camera đang
    // tắt" caption for a generated avatar.
    if (peerVideoPlayer?.webkitDisplayingFullscreen) {
      peerVideoPlayer.webkitExitFullscreen();
    }
  }

  // Ask the new control bar to re-sync (#newFullscreenBtn only enables
  // once the peer has camera or screen visible - see updateUI() in
  // client.html), same bridge setPeerScreenStatus already uses.
  if (typeof window.updateNewControlBarUI === "function") {
    window.updateNewControlBarUI();
  }
}

function setPeerScreenStatus(peer_id, status, extras) {
  // Track screen status on the peer model
  if (!allPeers[peer_id]) allPeers[peer_id] = {};
  allPeers[peer_id]["peer_screen_status"] = !!status;

  // Same as setPeerVideoStatus's camera-off case: if their screen share
  // just stopped while its native fullscreen player was open, exit it
  // rather than leave a frozen/blank video stuck in fullscreen.
  if (!status) {
    const peerScreenPlayer = getId(peer_id + "___screen");
    if (peerScreenPlayer?.webkitDisplayingFullscreen) {
      peerScreenPlayer.webkitExitFullscreen();
    }
  }

  // Exposed for the control-bar bridge (client.html) so it can disable
  // "Chia sẻ màn hình" while a peer is already sharing theirs.
  window.isRemoteScreenSharing = !!status;
  // The bridge's MutationObserver only watches the OLD hidden buttons'
  // class/style, so it never notices this flag changing on its own -
  // ask it to re-render its button states right now.
  if (typeof window.updateNewControlBarUI === "function") {
    window.updateNewControlBarUI();
  }

  // In a 1-on-1 call, force-hide/show my floating self-view thumbnail
  // whenever the remote peer starts/stops screen sharing (overrides
  // any manual hide - mirrors the isRemoteScreenSharing effect).
  syncSoloVisibilityForRemoteScreenShare(!!status);

  // Show only ONE tile per participant in solo mode (camera OR screen,
  // never both stacked) - matches the reference's single swapped video.
  updateSoloScreenTileVisibility();

  // Initialize extras object if not already present
  if (!allPeers[peer_id]["extras"]) {
    allPeers[peer_id]["extras"] = {};
  }
  // Merge provided extras if any
  if (extras && (extras.screen_track_id || extras.screen_stream_id)) {
    allPeers[peer_id]["extras"].screen_track_id = extras.screen_track_id;
    allPeers[peer_id]["extras"].screen_stream_id = extras.screen_stream_id;
  }
}

/**
 * Emit actions to all peers in the same room except yourself
 * @param {object} peerAction to all peers
 * @param {object} extras additional data
 */
async function emitPeersAction(peerAction, extras = {}) {
  if (!thereArePeerConnections()) return;

  sendToServer("peerAction", {
    room_id: roomId,
    peer_name: myPeerName,
    peer_avatar: myPeerAvatar,
    peer_id: myPeerId,
    peer_uuid: myPeerUUID,
    peer_use_video: useVideo,
    peer_action: peerAction,
    extras: extras,
    send_to_all: true,
  });
}

/**
 * Emit actions to specified peer in the same room
 * @param {string} peer_id socket.id
 * @param {object} peerAction to specified peer
 * @param {object} extras additional data
 */
async function emitPeerAction(peer_id, peerAction, extras = {}) {
  if (!thereArePeerConnections()) return;

  sendToServer("peerAction", {
    room_id: roomId,
    peer_id: peer_id,
    peer_avatar: myPeerAvatar,
    peer_use_video: useVideo,
    peer_name: myPeerName,
    peer_action: peerAction,
    extras: extras,
    send_to_all: false,
  });
}

/**
 * Handle received peer actions
 * @param {object} config data
 */
function handlePeerAction(config) {
  console.log("Handle peer action: ", config);
  const {
    peer_id,
    peer_name,
    peer_avatar,
    peer_use_video,
    peer_action,
    extras,
  } = config;

  switch (peer_action) {
    case "muteAudio":
      setMyAudioOff(peer_name);
      break;
    case "hideVideo":
      setMyVideoOff(peer_name);
      break;
    case "stopScreen":
      setMyScreenOff(peer_name);
      break;
    case "recStart":
      notifyRecording(peer_id, peer_name, peer_avatar, "Start");
      break;
    case "recStop":
      notifyRecording(peer_id, peer_name, peer_avatar, "Stop");
      break;
    case "screenStart":
      handleScreenStart(peer_id, extras);
      break;
    case "screenStop":
      handleScreenStop(peer_id, peer_use_video);
      break;
    case "ejectAll":
      handleKickedOut(config);
      break;
    default:
      break;
  }
}

/**
 * Handle commands from the server
 * @param {object} config data
 */
function handleCmd(config) {
  console.log("Handle cmd: ", config);

  const { action, data } = config;

  switch (action) {
    default:
      break;
  }
}

/**
 * Handle incoming message
 * @param {object} message
 */
function handleMessage(message) {
  console.log("Got message", message);

  switch (message.type) {
    case "roomEmoji":
      handleEmoji(message);
      break;
    //....
    default:
      break;
  }
}

/**
 * Handle incoming chat reactions.
 * @param {object} data
 */
function handleChatReaction(data) {
  if (!data) return;

  const rawMsgId = String(data.msg_id || "").trim();
  const msgId = rawMsgId.replace(/[^a-zA-Z0-9:_-]/g, "");
  const emoji = filterXSS(data.emoji || "");
  const peerName = filterXSS(data.peer_name || "");
  const action = data.action === "remove" ? "remove" : "add";

  if (!msgId || !emoji || !peerName) return;
  if (!CHAT_REACTION_EMOJIS.includes(emoji)) return;

  const messageElement = getChatMessageElement(msgId);
  if (!messageElement) return;

  applyReactionToElement(messageElement, emoji, peerName, action);
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (
    target?.closest(".reaction-picker") ||
    target?.closest(".reaction-toggle-btn")
  )
    return;
  msgerChat
    ?.querySelectorAll(".reaction-picker")
    .forEach((picker) => picker.remove());
});

function getRoomEmojiPlacement() {
  const viewportWidth = Math.max(window.innerWidth || 0, 320);
  const viewportHeight = Math.max(window.innerHeight || 0, 320);
  const isCompactViewport = viewportWidth < 640;
  const now = Date.now();
  const burstWindow = 900;
  const maxBurstSize = isCompactViewport ? 4 : 6;
  const marginX = isCompactViewport ? 18 : 34;
  const marginY = isCompactViewport ? 96 : 124;
  const minAnchorX = viewportWidth * 0.2;
  const maxAnchorX = viewportWidth * 0.8;
  const minAnchorY = viewportHeight * 0.42;
  const maxAnchorY = viewportHeight * 0.76;

  if (
    now - roomEmojiBurstState.startedAt > burstWindow ||
    roomEmojiBurstState.count >= maxBurstSize
  ) {
    roomEmojiBurstState.startedAt = now;
    roomEmojiBurstState.count = 0;
    roomEmojiBurstState.anchorX =
      minAnchorX + Math.random() * Math.max(1, maxAnchorX - minAnchorX);
    roomEmojiBurstState.anchorY =
      minAnchorY + Math.random() * Math.max(1, maxAnchorY - minAnchorY);
  }

  const burstIndex = roomEmojiBurstState.count;
  roomEmojiBurstState.count += 1;

  const baseAngle =
    -90 + (burstIndex - (maxBurstSize - 1) / 2) * (isCompactViewport ? 24 : 18);
  const jitterAngle = Math.random() * 12 - 6;
  const angle = ((baseAngle + jitterAngle) * Math.PI) / 180;
  const radius =
    (isCompactViewport ? 18 : 24) +
    burstIndex * (isCompactViewport ? 14 : 18) +
    Math.random() * 14;
  const left = Math.min(
    viewportWidth - marginX,
    Math.max(marginX, roomEmojiBurstState.anchorX + Math.cos(angle) * radius),
  );
  const top = Math.min(
    viewportHeight - marginY,
    Math.max(
      marginY,
      roomEmojiBurstState.anchorY + Math.sin(angle) * radius * 0.6,
    ),
  );
  const drift = `${(Math.cos(angle) * (radius * 0.95) + (Math.random() * 18 - 9)).toFixed(0)}px`;
  const rise = `-${(Math.abs(Math.sin(angle)) * 70 + Math.random() * 70 + (isCompactViewport ? 120 : 165)).toFixed(0)}px`;
  const rotation = `${(Math.random() * 16 - 8).toFixed(1)}deg`;

  return {
    left,
    top,
    drift,
    rise,
    rotation,
  };
}

/**
 * Handle room emoji reaction
 * @param {object} message
 * @param {integer} duration time in ms
 */
function handleEmoji(message, duration = 5000) {
  if (userEmoji) {
    const emojiDisplay = document.createElement("div");
    const placement = getRoomEmojiPlacement();
    const label = message.peer_name || "Guest";
    const emojiIcon = document.createElement("span");
    const emojiName = document.createElement("span");

    emojiDisplay.className = "user-emoji-burst";
    emojiDisplay.style.left = `${placement.left}px`;
    emojiDisplay.style.top = `${placement.top}px`;
    emojiDisplay.style.setProperty("--emoji-drift", placement.drift);
    emojiDisplay.style.setProperty("--emoji-rise", placement.rise);
    emojiDisplay.style.setProperty("--emoji-rotation", placement.rotation);
    emojiIcon.className = "user-emoji-burst__icon";
    emojiIcon.textContent = message.emoji;
    emojiName.className = "user-emoji-burst__name";
    emojiName.textContent = label;
    emojiDisplay.appendChild(emojiIcon);
    emojiDisplay.appendChild(emojiName);
    userEmoji.appendChild(emojiDisplay);

    setTimeout(() => {
      emojiDisplay.remove();
    }, duration);

    handleEmojiSound(message);
  }
}

/**
 * Play emoji sound
 * https://freesound.org/
 * https://cloudconvert.com
 * @param {object} message
 */
function handleEmojiSound(message) {
  const path = "../sounds/emoji/";
  const force = true; // play even if sound effects are off
  switch (message.shortcodes) {
    case ":+1:":
    case ":ok_hand:":
      playSound("ok", force, path);
      break;
    case ":-1:":
      playSound("boo", force, path);
      break;
    case ":clap:":
      playSound("applause", force, path);
      break;
    case ":smiley:":
    case ":grinning:":
      playSound("smile", force, path);
      break;
    case ":joy:":
      playSound("laughs", force, path);
      break;
    case ":tada:":
      playSound("congrats", force, path);
      break;
    case ":open_mouth:":
      playSound("woah", force, path);
      break;
    case ":trumpet:":
      playSound("trombone", force, path);
      break;
    case ":kissing_heart:":
      playSound("kiss", force, path);
      break;
    case ":heart:":
    case ":hearts:":
      playSound("heart", force, path);
      break;
    case ":rocket:":
      playSound("rocket", force, path);
      break;
    case ":sparkles:":
    case ":star:":
    case ":star2:":
    case ":dizzy:":
      playSound("tinkerbell", force, path);
      break;
    // ...
    default:
      break;
  }
}

/**
 * Handle Screen Start
 * @param {string} peer_id
 * @param {object} extras
 */
function handleScreenStart(peer_id, extras) {
  const remoteScreenAvatarImage = getId(peer_id + "_screen_avatar");
  const remoteScreenStatusBtn = getId(peer_id + "_screenStatus");

  if (extras) {
    // Initialize extras object if not already present
    if (!allPeers[peer_id]) allPeers[peer_id] = {};
    if (!allPeers[peer_id]["extras"]) {
      allPeers[peer_id]["extras"] = {};
    }

    allPeers[peer_id]["extras"]["screen_track_id"] = extras.screen_track_id;
    allPeers[peer_id]["extras"]["screen_stream_id"] = extras.screen_stream_id;

    // Also update peer screen status flag for fallback classification
    allPeers[peer_id]["peer_screen_status"] = true;

    console.log("[HANDLE SCREEN START] Stored screen IDs for", peer_id, extras);
  }

  if (remoteScreenStatusBtn) {
    remoteScreenStatusBtn.className = className.videoOn;
    setTippy(remoteScreenStatusBtn, "Người tham gia đang chia sẻ màn hình", "bottom");
  }
  if (remoteScreenAvatarImage) elemDisplay(remoteScreenAvatarImage, false);
}

/**
 * Handle Screen Stop
 * @param {string} peer_id
 * @param {boolean} peer_use_video
 */
function handleScreenStop(peer_id, peer_use_video) {
  const remoteScreenStream = getId(peer_id + "___screen");
  const remoteScreenWrap = getId(peer_id + "_screenWrap");
  const remoteScreenAvatarImage = getId(peer_id + "_screen_avatar");
  const remoteScreenStatusBtn = getId(peer_id + "_screenStatus");
  const remoteScreenPinUnpin = getId(peer_id + "_screen_pinUnpin");

  if (remoteScreenStatusBtn) {
    remoteScreenStatusBtn.className = className.videoOff;
    setTippy(
      remoteScreenStatusBtn,
      "Người tham gia đã dừng chia sẻ màn hình",
      "bottom",
    );
  }

  // If the screen is pinned, unpin it first to restore grid layout
  if (
    remoteScreenWrap &&
    isVideoPinned &&
    pinnedVideoPlayerId === (remoteScreenStream ? remoteScreenStream.id : null)
  ) {
    console.log(
      "[STOP SCREEN] Unpinning remote screen before removal",
      peer_id,
    );
    if (remoteScreenPinUnpin) remoteScreenPinUnpin.click();
  }

  // Remove dedicated remote screen tile if present
  if (remoteScreenWrap) {
    remoteScreenWrap.remove();
    // Also drop the stale tracking entry - handleRemovePeer() later does
    // `peerScreenMediaElements[key].parentNode.removeChild(...)` if this
    // key still exists; parentNode is null on an already-.remove()'d node,
    // which throws and aborts the rest of that peer's cleanup (leaving a
    // dead/black tile behind) when this same peer later leaves the room.
    delete peerScreenMediaElements[peer_id + "___screen"];
    adaptAspectRatio();
  }
  // Bring their camera tile back as the sole solo-mode tile
  if (allPeers[peer_id]) allPeers[peer_id]["peer_screen_status"] = false;
  updateSoloScreenTileVisibility();
  if (remoteScreenAvatarImage && remoteScreenStream && !peer_use_video) {
    elemDisplay(remoteScreenAvatarImage, true, "block");
    remoteScreenStream.srcObject.getVideoTracks().forEach((track) => {
      track.stop();
      // track.enabled = false;
    });
    elemDisplay(remoteScreenStream, false);
  } else {
    if (remoteScreenAvatarImage) elemDisplay(remoteScreenAvatarImage, false);
  }
  // Clean up screen extras from allPeers
  if (allPeers[peer_id]) {
    if (allPeers[peer_id]["extras"]) {
      delete allPeers[peer_id]["extras"]["screen_track_id"];
      delete allPeers[peer_id]["extras"]["screen_stream_id"];
    }
    // Update screen status flag
    allPeers[peer_id]["peer_screen_status"] = false;

    console.log("[HANDLE SCREEN STOP] Cleared screen IDs for", peer_id);
  }
}

function confirmAudioOn(config) {
  const { peer_name } = config;
}

function confirmVideoOn(config) {
  const { peer_name } = config;
}

function confirmScreenOn(config) {
  const { peer_name } = config;
}

/**
 * Set my Audio off and Popup the peer name that performed this action
 * @param {string} peer_name peer name
 */
function setMyAudioOff(peer_name) {
  if (myAudioStatus === false || !useAudio) return;
  const audioTrack = getAudioTrack(localAudioMediaStream);
  if (audioTrack) {
    audioTrack.enabled = false;
    myAudioStatus = audioTrack.enabled;
  } else {
    myAudioStatus = false;
  }
  audioBtn.className = className.audioOff;
  setMyAudioStatus(myAudioStatus, false);
  playSound("off");
}

/**
 * Set my Audio on and Popup the peer name that performed this action
 * @param {string} peer_name peer name
 */
function setMyAudioOn(peer_name) {
  if (myAudioStatus === true || !useAudio) return;
  const audioTrack = getAudioTrack(localAudioMediaStream);
  if (audioTrack) {
    audioTrack.enabled = true;
    myAudioStatus = audioTrack.enabled;
  } else {
    myAudioStatus = false;
  }
  audioBtn.className = className.audioOn;
  setMyAudioStatus(myAudioStatus, false);
  playSound("on");
}

/**
 * Set my Video off and Popup the peer name that performed this action
 * @param {string} peer_name peer name
 */
function setMyVideoOff(peer_name) {
  if (!useVideo) return;
  //if (myVideoStatus === false || !useVideo) return;
  const videoTrack = getVideoTrack(localVideoMediaStream);
  if (videoTrack) {
    videoTrack.enabled = false;
    myVideoStatus = videoTrack.enabled;
  } else {
    myVideoStatus = false;
  }
  videoBtn.className = className.videoOff;
  setMyVideoStatus(myVideoStatus, false);
  playSound("off");
}

/**
 * Set my Screen off and Popup the peer name that performed this action
 * @param {string} peer_name peer name
 */
function setMyScreenOff(peer_name) {
  if (isScreenStreaming) {
    toggleScreenSharing();
    playSound("off");
  }
}

/**
 * Mute or Hide specific peer
 * @param {string} peer_id socket.id
 * @param {string} element type audio/video/screen
 */
function disablePeer(peer_id, element) {
  if (!thereArePeerConnections()) {
    return toastMessage("info", "Không phát hiện người tham gia nào", "", "top");
  }
  // No confirmation prompt - act immediately.
  switch (element) {
    case "audio":
      emitPeerAction(peer_id, "muteAudio");
      break;
    case "video":
      emitPeerAction(peer_id, "hideVideo");
      break;
    case "screen":
      emitPeerAction(peer_id, "stopScreen");
      break;
    default:
      break;
  }
}

/**
 * Handle Room action
 * @param {object} config data
 * @param {boolean} emit data to signaling server
 */
function handleRoomAction(config, emit = false) {
  const { action } = config;
  if (emit) {
    const thisConfig = {
      room_id: roomId,
      peer_id: myPeerId,
      peer_name: myPeerName,
      peer_uuid: myPeerUUID,
      action: action,
      password: null,
    };
    switch (action) {
      case "lock":
        playSound("newMessage");

        Swal.fire({
          allowOutsideClick: false,
          allowEscapeKey: false,
          showDenyButton: true,
          background: swBg,
          imageUrl: images.locked,
          input: "text",
          inputPlaceholder: "Đặt mật khẩu phòng",
          confirmButtonText: `Đồng ý`,
          denyButtonText: `Hủy`,
          showClass: { popup: "animate__animated animate__fadeInDown" },
          hideClass: { popup: "animate__animated animate__fadeOutUp" },
          inputValidator: (pwd) => {
            if (!pwd) return "Vui lòng nhập mật khẩu phòng";
            thisRoomPassword = pwd;
          },
        }).then((result) => {
          if (result.isConfirmed) {
            thisConfig.password = thisRoomPassword;
            sendToServer("roomAction", thisConfig);
            handleRoomStatus(thisConfig);
          }
        });
        break;
      case "unlock":
        sendToServer("roomAction", thisConfig);
        handleRoomStatus(thisConfig);
        break;
      default:
        break;
    }
  } else {
    // data coming from signaling server
    handleRoomStatus(config);
  }
}

/**
 * Handle room status
 * @param {object} config data
 */
function handleRoomStatus(config) {
  const { action, peer_name, password } = config;

  switch (action) {
    case "lock":
      playSound("locked");
      elemDisplay(lockRoomBtn, false);
      elemDisplay(unlockRoomBtn, true);
      isRoomLocked = true;
      updateRoomLockStatusIcon();

      break;
    case "unlock":
      elemDisplay(unlockRoomBtn, false);
      elemDisplay(lockRoomBtn, true);
      isRoomLocked = false;
      updateRoomLockStatusIcon();

      break;
    case "checkPassword":
      isRoomLocked = true;
      updateRoomLockStatusIcon();
      password == "OK" ? joinToChannel() : handleRoomLocked();
      break;
    default:
      break;
  }
}

/**
 * Sync the "Khóa phòng" row icon (left of the lock/unlock buttons) with
 * the room's actual lock state - shows an open padlock (orange) when
 * unlocked, a closed padlock (red) when locked.
 */
function updateRoomLockStatusIcon() {
  if (!roomLockStatusIcon) return;
  roomLockStatusIcon.classList.toggle("fa-lock", isRoomLocked);
  roomLockStatusIcon.classList.toggle("fa-lock-open", !isRoomLocked);
  roomLockStatusIcon.classList.toggle("red", isRoomLocked);
  roomLockStatusIcon.classList.toggle("orange", !isRoomLocked);
}

/**
 * Room is locked you provide a wrong password, can't access!
 */
function handleRoomLocked() {
  playSound("eject");

  console.log("Room is Locked, try with another one");
  Swal.fire({
    allowOutsideClick: false,
    background: swBg,
    position: "center",
    imageUrl: images.locked,
    title: "Rất tiếc, sai mật khẩu phòng",
    text: "Phòng đang bị khóa, hãy thử mật khẩu khác.",
    showDenyButton: false,
    confirmButtonText: `Đồng ý`,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then((result) => {
    if (result.isConfirmed) openURL("/");
  });
}

/**
 * Try to unlock the room by providing a valid password
 */
function handleUnlockTheRoom() {
  playSound("alert");

  Swal.fire({
    allowOutsideClick: false,
    allowEscapeKey: false,
    background: swBg,
    imageUrl: images.locked,
    title: "Rất tiếc, phòng đang bị khóa",
    input: "text",
    inputPlaceholder: "Nhập mật khẩu phòng",
    confirmButtonText: `Đồng ý`,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
    inputValidator: (pwd) => {
      if (!pwd) return "Vui lòng nhập mật khẩu phòng";
      thisRoomPassword = pwd;
    },
  }).then(() => {
    const config = {
      room_id: roomId,
      peer_name: myPeerName,
      action: "checkPassword",
      password: thisRoomPassword,
    };
    sendToServer("roomAction", config);
    elemDisplay(lockRoomBtn, false);
    elemDisplay(unlockRoomBtn, true);
  });
}

/**
 * Opend and send Video URL to all peers in the room
 * @param {string} peer_id socket.id
 */
function sendVideoUrl(peer_id = null, peer_name = "", broadcast = !peer_id) {
  playSound("newMessage");

  const targetPeerName = !broadcast
    ? filterXSS(peer_name || resolvePeerNameById(peer_id) || "Người tham gia")
    : "";
  const targetLabel =
    !broadcast && targetPeerName ? ` với ${targetPeerName}` : "";

  Swal.fire({
    background: swBg,
    position: "center",
    imageUrl: images.vaShare,
    title: `Chia sẻ Video hoặc Audio${targetLabel}`,
    text: `Dán URL Video hoặc audio${targetLabel}`,
    input: "text",
    showCancelButton: true,
    confirmButtonText: `Chia sẻ`,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then((result) => {
    if (result.value) {
      result.value = filterXSS(result.value);
      if (!thereArePeerConnections()) {
        return toastMessage("info", "Không phát hiện người tham gia nào", "", "top");
      }
      console.log("Video URL: " + result.value);
      /*
                https://www.youtube.com/watch?v=RT6_Id5-7-s
                http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
                https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3
            */
      if (!isVideoTypeSupported(result.value)) {
        return userLog(
          "warning",
          "URL không hợp lệ, vui lòng thử một URL Video hoặc audio khác",
        );
      }
      const is_youtube = getVideoType(result.value) == "na" ? true : false;
      const video_url = is_youtube
        ? getYoutubeEmbed(result.value)
        : result.value;
      const config = {
        peer_id: peer_id,
        video_src: video_url,
        broadcast: broadcast,
      };
      openVideoUrlPlayer(config);
      emitVideoPlayer("open", config);
      appendMessage(
        myPeerName,
        rightChatAvatar,
        "right",
        `${icons.share} Shared media: <br/><a href="${video_url}" target="_blank" rel="noopener noreferrer">${video_url}</a>`,
        !broadcast,
        null,
        targetPeerName,
      );
    }
  });

  // Take URL from clipboard ex:
  // https://www.youtube.com/watch?v=1ZYbU82GVz4
  //
  // Mobile-only skip: iOS shows its own native "Dán"/Paste permission
  // bubble on top of the dialog the instant this Clipboard API call
  // fires, so the dialog looks like it needs a second tap before it's
  // actually usable. Mobile users can still paste normally (long-press)
  // straight into the input, so just skip the auto-fill there.
  if (!isMobileDevice) {
    navigator.clipboard
      .readText()
      .then((clipboardText) => {
        if (!clipboardText) return false;
        const sanitizedText = filterXSS(clipboardText);
        const inputElement = Swal.getInput();
        if (isVideoTypeSupported(sanitizedText) && inputElement) {
          inputElement.value = sanitizedText;
        }
        return false;
      })
      .catch(() => {
        return false;
      });
  }
}

/**
 * Open video url Player
 */
function openVideoUrlPlayer(config) {
  console.log("Open video Player", config);
  const videoSrc = config.video_src;
  const videoType = getVideoType(videoSrc);
  const videoEmbed = getYoutubeEmbed(videoSrc);
  console.log("Video embed", videoEmbed);
  //
  if (!isVideoUrlPlayerOpen) {
    if (videoEmbed) {
      playSound("newMessage");
      console.log("Load element type: iframe");
      videoUrlIframe.src = videoEmbed;
      elemDisplay(videoUrlCont, true, "flex");
      isVideoUrlPlayerOpen = true;
    } else {
      playSound("newMessage");
      console.log("Load element type: Video");
      elemDisplay(videoAudioUrlCont, true, "flex");
      videoAudioUrlElement.setAttribute("src", videoSrc);
      videoAudioUrlElement.type = videoType;
      if (videoAudioUrlElement.type == "video/mp3") {
        videoAudioUrlElement.poster = images.audioGif;
      }
      isVideoUrlPlayerOpen = true;
    }
  } else {
    // video player seems open
    if (videoEmbed) {
      videoUrlIframe.src = videoEmbed;
    } else {
      videoAudioUrlElement.src = videoSrc;
    }
  }
}

/**
 * Get video type
 * @param {string} url
 * @returns string video type
 */
function getVideoType(url) {
  if (url.endsWith(".mp4")) return "video/mp4";
  if (url.endsWith(".mp3")) return "video/mp3";
  if (url.endsWith(".webm")) return "video/webm";
  if (url.endsWith(".ogg")) return "video/ogg";
  return "na";
}

/**
 * Check if video URL is supported
 * @param {string} url
 * @returns boolean true/false
 */
function isVideoTypeSupported(url) {
  if (
    url.endsWith(".mp4") ||
    url.endsWith(".mp3") ||
    url.endsWith(".webm") ||
    url.endsWith(".ogg") ||
    url.includes("youtube.com")
  )
    return true;
  return false;
}

/**
 * Get youtube embed URL
 * @param {string} url of YouTube video
 * @returns {string} YouTube Embed URL
 */
function getYoutubeEmbed(url) {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length == 11
    ? "https://www.youtube.com/embed/" + match[7] + "?autoplay=1"
    : false;
}

/**
 * Close Video Url Player
 */
function closeVideoUrlPlayer() {
  console.log("Close video Player", {
    videoUrlIframe: videoUrlIframe.src,
    videoAudioUrlElement: videoAudioUrlElement.src,
  });
  if (videoUrlIframe.src != "") videoUrlIframe.setAttribute("src", "");
  if (videoAudioUrlElement.src != "")
    videoAudioUrlElement.setAttribute("src", "");
  elemDisplay(videoUrlCont, false);
  elemDisplay(videoAudioUrlCont, false);
  isVideoUrlPlayerOpen = false;
}

/**
 * Emit video palyer to peers
 * @param {string} video_action type
 * @param {object} config data
 */
function emitVideoPlayer(video_action, config = {}) {
  sendToServer("videoPlayer", {
    room_id: roomId,
    peer_name: myPeerName,
    video_action: video_action,
    video_src: config.video_src,
    peer_id: config.peer_id,
    broadcast: config.broadcast,
  });
}

/**
 * Handle Video Player
 * @param {object} config data
 */
function handleVideoPlayer(config) {
  const { peer_name, video_action, video_src, broadcast } = config;
  //
  switch (video_action) {
    case "open":
      userLog("toast", `${icons.user} ${peer_name} \n đã mở trình phát video`);
      openVideoUrlPlayer(config);
      appendMessage(
        peer_name,
        leftChatAvatar,
        "left",
        `${icons.share} Media đã chia sẻ: <br/><a href="${video_src}" target="_blank" rel="noopener noreferrer">${video_src}</a>`,
        !broadcast,
        null,
        peer_name,
      );
      break;
    case "close":
      userLog("toast", `${icons.user} ${peer_name} \n đã đóng trình phát video`);
      closeVideoUrlPlayer();
      break;
    default:
      break;
  }
}

/**
 * Handle peer kick out event button
 * @param {string} peer_id socket.id
 */
function handlePeerKickOutBtn(peer_id) {
  if (!buttons.remote.showKickOutBtn) return;
  const peerKickOutBtn = getId(peer_id + "_kickOut");
  peerKickOutBtn.addEventListener("click", (e) => {
    if (isPresenter) kickOut(peer_id);
  });
}

/**
 * Eject peer, confirm before
 * @param {string} peer_id socket.id
 */
function kickOut(peer_id) {
  const pName = getId(peer_id + "_name").innerText;

  Swal.fire({
    background: swBg,
    position: "top",
    imageUrl: images.leave,
    title: "Mời ra khỏi phòng",
    text: `Bạn có chắc muốn mời ${pName} ra khỏi phòng?`,
    showDenyButton: true,
    confirmButtonText: `Có`,
    denyButtonText: `Không`,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then((result) => {
    if (result.isConfirmed) {
      // send peer to kick out from room
      sendToServer("kickOut", {
        room_id: roomId,
        peer_id: peer_id,
        peer_uuid: myPeerUUID,
        peer_name: myPeerName,
      });
    }
  });
}

/**
 * The same peer_uuid (this browser/device) opened the room again elsewhere
 * (another tab, or a reconnect after a network drop that raced ahead of the
 * old connection's own timeout). The server evicted this tab's session to
 * avoid double-counting one person as two. Tell the user plainly instead of
 * leaving them stuck on a "reconnecting…" banner that will never resolve
 * (a server-initiated disconnect does not auto-retry), then send them home.
 */
function handleDuplicateSession() {
  signalingSocket.disconnect();

  Swal.fire({
    allowOutsideClick: false,
    background: swBg,
    position: "center",
    imageUrl: images.leave,
    title: "Phòng đã được mở ở nơi khác",
    text: "Bạn vừa vào phòng này từ một tab hoặc thiết bị khác, nên tab này đã ngắt kết nối.",
    confirmButtonText: "Về trang chủ",
    timer: 6000,
    timerProgressBar: true,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then(() => {
    openURL("/");
  });
}

/**
 * You will be kicked out from the room and popup the peer name that performed this action
 * @param {object} config data
 */
function handleKickedOut(config) {
  signalingSocket.disconnect();

  const { peer_name } = config;

  playSound("eject");

  let timerInterval;

  Swal.fire({
    allowOutsideClick: false,
    background: swBg,
    position: "center",
    imageUrl: images.leave,
    title: "Bạn đã bị mời ra khỏi phòng!",
    html: renderRoomTemplate("tpl-kicked-out-modal", {
      text: {
        peerName: peer_name,
      },
    }),
    timer: 5000,
    timerProgressBar: true,
    didOpen: () => {
      Swal.showLoading();
      timerInterval = setInterval(() => {
        const content = Swal.getHtmlContainer();
        if (content) {
          const b = content.querySelector("b");
          if (b) b.textContent = Swal.getTimerLeft();
        }
      }, 100);
    },
    willClose: () => {
      clearInterval(timerInterval);
    },
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then(() => {
    checkRecording();
    openURL("/");
  });
}

/**
 * MiroTalk about info
 */
function showAbout() {
  // No-op: about popup removed.
}

/**
 * Init Exit Meeting
 */
function initExitMeeting() {
  openURL("/");
}

/**
 * Leave the Room and create a new one
 */
function leaveRoom(skipConfirm = false) {
  if (skipConfirm) {
    checkRecording();
    redirectOnLeave();
    return;
  }
  showPP({
    icon: "log-out",
    variant: "danger",
    title: "Rời cuộc gọi?",
    desc: "Bạn có chắc muốn rời khỏi cuộc gọi này không?",
    confirmText: "Rời phòng",
    cancelText: "Hủy",
    onConfirm: () => {
      checkRecording();
      redirectOnLeave();
    },
  });
}

/**
 * Exit the Room
 */
function exitRoom() {
  checkRecording();
  redirectOnLeave();
}

function redirectOnLeave() {
  playSound("removePeer");
  // Give the sound a moment to actually be heard before the page
  // navigates away and cuts it off.
  setTimeout(() => {
    redirectActive ? openURL(redirectURL) : openURL("/");
  }, 250);
}

/**
 * Make Obj draggable: https://www.w3schools.com/howto/howto_js_draggable.asp
 * @param {object} elmnt father element
 * @param {object} dragObj children element to make father draggable (click + mouse move)
 */
function dragElement(elmnt, dragObj) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  if (dragObj) {
    // if present, the header is where you move the DIV from:
    dragObj.onmousedown = dragMouseDown;
  } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position with top boundary check (min 0px):
    let newTop = elmnt.offsetTop - pos2;
    if (newTop < 0) newTop = 0;
    elmnt.style.top = newTop + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

/**
 * Make Obj Undraggable
 * @param {object} elmnt father element
 * @param {object} dragObj children element to make father undraggable
 */
function undragElement(elmnt, dragObj) {
  if (dragObj) {
    dragObj.onmousedown = null;
  } else {
    elmnt.onmousedown = null;
  }
  elmnt.style.top = "";
  elmnt.style.left = "";
}

/**
 * Date Format: https://convertio.co/it/
 * @returns {string} date string format: DD-MM-YYYY-H_M_S
 */
function getDataTimeString() {
  const d = new Date();
  const date = d.toISOString().split("T")[0];
  const time = d.toTimeString().split(" ")[0];
  return `${date}-${time}`;
}

/**
 * Convert bytes to KB-MB-GB-TB
 * @param {object} bytes to convert
 * @returns {string} converted size
 */
function bytesToSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes == 0) return "0 Byte";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

/**
 * Map volume level to a display color
 * @param {number} volume 0-100
 * @returns {string} hex color
 */
function getVolumeColor(volume) {
  if (volume >= 80) return "#FF0000"; // Red
  if (volume >= 50) return "#FFA500"; // Orange
  return "#19bb5c"; // Green
}

/**
 * Handle peer audio volume
 * @param {object} data peer audio
 */
function handlePeerVolume(data) {
  const { peer_id, volume } = data;

  if (volume === 0) return;

  const audioColorTmp = getVolumeColor(volume);

  if (!isAudioPitchBar) {
    const remotePeerAvatarImg = getId(peer_id + "_avatar");
    if (remotePeerAvatarImg) {
      applyBoxShadowEffect(remotePeerAvatarImg, audioColorTmp, 100);
    }
    const remotePeerVideo = getId(peer_id + "___video");
    if (remotePeerVideo && remotePeerVideo.classList.contains("videoCircle")) {
      applyBoxShadowEffect(remotePeerVideo, audioColorTmp, 100);
    }
    return;
  }

  const remotePitchBar = getId(peer_id + "_pitch_bar");
  //let remoteVideoWrap = getId(peer_id + '_videoWrap');
  if (!remotePitchBar) return;
  remotePitchBar.style.backgroundColor = audioColorTmp;
  remotePitchBar.style.height = volume + "%";
  //remoteVideoWrap.classList.toggle('speaking');
  clearTimeout(peerVolumeTimers[peer_id]);
  peerVolumeTimers[peer_id] = setTimeout(function () {
    remotePitchBar.style.backgroundColor = "#19bb5c";
    remotePitchBar.style.height = "0%";
    //remoteVideoWrap.classList.toggle('speaking');
  }, 100);
}

/**
 * Handle my audio volume
 * @param {object} data my audio
 */
function handleMyVolume(data) {
  const { volume } = data;

  if (volume === 0) return;

  const audioColorTmp = getVolumeColor(volume);

  if (!isAudioPitchBar || !myPitchBar) {
    const localPeerAvatarImg = getId("myVideoAvatarImage");
    if (localPeerAvatarImg) {
      applyBoxShadowEffect(localPeerAvatarImg, audioColorTmp, 100);
    }
    if (myVideo && myVideo.classList.contains("videoCircle")) {
      applyBoxShadowEffect(myVideo, audioColorTmp, 100);
    }
    return;
  }
  myPitchBar.style.backgroundColor = audioColorTmp;
  myPitchBar.style.height = volume + "%";
  //myVideoWrap.classList.toggle('speaking');
  clearTimeout(myVolumeTimer);
  myVolumeTimer = setTimeout(function () {
    myPitchBar.style.backgroundColor = "#19bb5c";
    myPitchBar.style.height = "0%";
    //myVideoWrap.classList.toggle('speaking');
  }, 100);
}

/**
 * Apply Box Shadow effect to element
 * @param {object} element
 * @param {string} color
 * @param {integer} delay ms
 */
function applyBoxShadowEffect(element, color, delay = 200) {
  if (element) {
    element.style.boxShadow = `0 0 20px ${color}`;
    setTimeout(() => {
      element.style.boxShadow = "none";
    }, delay);
  }
}

/**
 * Show a persistent banner indicating the signaling server connection was lost.
 */
function showDisconnectBanner() {
  if (!banner) return;
  banner.classList.remove("reconnected");
  icon.className = "fa-solid fa-wifi-exclamation";
  title.textContent = "M\u1ea5t k\u1ebft n\u1ed1i";
  msg.innerHTML = "\u0110ang k\u1ebft n\u1ed1i l\u1ea1i v\u1edbi m\u00e1y ch\u1ee7\u2026";
  spinner.style.opacity = "1";
  if (disconnectBannerRafId) cancelAnimationFrame(disconnectBannerRafId);
  disconnectBannerRafId = requestAnimationFrame(() => {
    disconnectBannerRafId = null;
    banner.classList.add("visible");
  });
}

/**
 * Hide the disconnect banner (or briefly show a reconnected confirmation).
 */
function hideDisconnectBanner() {
  if (!banner) return;
  if (disconnectBannerRafId) {
    cancelAnimationFrame(disconnectBannerRafId);
    disconnectBannerRafId = null;
  }
  if (!banner.classList.contains("visible")) return;
  banner.classList.add("reconnected");
  icon.className = "fa-solid fa-circle-check";
  title.textContent = "Đã kết nối lại";
  msg.textContent = "Kết nối được khôi phục thành công";
  setTimeout(() => {
    banner.classList.remove("visible");
    setTimeout(() => banner.classList.remove("reconnected"), 420);
  }, 2800);
}

/**
 * Basic user logging using https://sweetalert2.github.io & https://animate.style/
 * @param {string} type of popup
 * @param {string} message to popup
 * @param {integer} timer toast duration ms
 */
function userLog(type, message, timer = 3000) {
  // "icon" must stay the literal SweetAlert2 icon keyword (warning/error/
  // info/success) - it's a controlled enum, not display text. "title" is
  // the actual on-screen text, translated here.
  const typeTitles = {
    warning: "Cảnh báo",
    error: "Lỗi",
    info: "Thông tin",
    success: "Thành công",
  };
  switch (type) {
    case "warning":
    case "error":
      Swal.fire({
        background: swBg,
        position: "center",
        icon: type,
        title: typeTitles[type],
        text: message,
        showClass: { popup: "animate__animated animate__fadeInDown" },
        hideClass: { popup: "animate__animated animate__fadeOutUp" },
      });
      playSound("alert");
      break;
    case "info":
    case "success":
      Swal.fire({
        background: swBg,
        position: "center",
        icon: type,
        title: typeTitles[type],
        text: message,
        showClass: { popup: "animate__animated animate__fadeInDown" },
        hideClass: { popup: "animate__animated animate__fadeOutUp" },
      });
      break;
    case "success-html":
      Swal.fire({
        background: swBg,
        position: "center",
        icon: "success",
        title: "Thành công",
        html: message,
        showClass: { popup: "animate__animated animate__fadeInDown" },
        hideClass: { popup: "animate__animated animate__fadeOutUp" },
      });
      break;
    case "toast":
      const Toast = Swal.mixin({
        background: swBg,
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: timer,
        timerProgressBar: true,
      });
      Toast.fire({
        html: message,
        showClass: { popup: "animate__animated animate__fadeInDown" },
        hideClass: { popup: "animate__animated animate__fadeOutUp" },
      });
      break;
    // ......
    default:
      alert(message);
      break;
  }
}

/**
 * Popup Toast message
 * @param {string} icon info, success, alert, warning
 * @param {string} title message title
 * @param {string} html message in html format
 * @param {string} position message position
 * @param {integer} duration time popup in ms
 */
function toastMessage(
  icon,
  title,
  html,
  position = "top-end",
  duration = 3000,
) {
  if (["warning", "error"].includes(icon)) playSound("alert");

  const Toast = Swal.mixin({
    background: swBg,
    position: position,
    icon: icon,
    showConfirmButton: false,
    timerProgressBar: true,
    toast: true,
    timer: duration,
  });
  Toast.fire({
    title: title,
    html: html,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  });
}

/**
 * Popup html message
 * @param {string} icon info, success, alert, warning
 * @param {string} imageUrl image path
 * @param {string} title message title
 * @param {string} html message in html format
 * @param {string} position message position
 * @param {string} redirectURL if set on press ok will be redirected to the URL
 */
function msgHTML(
  icon,
  imageUrl,
  title,
  html,
  position = "center",
  redirectURL = false,
) {
  if (["warning", "error"].includes(icon)) playSound("alert");

  Swal.fire({
    allowOutsideClick: false,
    allowEscapeKey: false,
    background: swBg,
    position: position,
    icon: icon,
    imageUrl: imageUrl,
    title: title,
    html: html,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  }).then((result) => {
    if (result.isConfirmed && redirectURL) {
      openURL(redirectURL);
    }
  });
}

/**
 * Message popup
 * @param {string} icon info, success, warning, error
 * @param {string} message to show
 * @param {string} position of the toast
 * @param {integer} timer ms before to hide
 */
function msgPopup(icon, message, position, timer = 1000) {
  if (["warning", "error"].includes(icon)) playSound("alert");

  const Toast = Swal.mixin({
    background: swBg,
    toast: true,
    position: position,
    showConfirmButton: false,
    timer: timer,
    timerProgressBar: true,
  });
  Toast.fire({
    icon: icon,
    title: message,
    showClass: { popup: "animate__animated animate__fadeInDown" },
    hideClass: { popup: "animate__animated animate__fadeOutUp" },
  });
}

/**
 * https://notificationsounds.com/notification-sounds
 * @param {string} name audio to play
 * @param {boolean} force audio
 * @param {string} path of sound files
 */
async function playSound(name, force = false, path = "../sounds/") {
  if (!notifyBySound && !force) return;
  const sound = path + name + ".mp3";
  const audioToPlay = new Audio(sound);
  try {
    audioToPlay.volume = 0.5;
    await audioToPlay.play();
  } catch (err) {
    // console.error("Cannot play sound", err);
    // Automatic playback failed. (safari)
    return;
  }
}

/**
 * Test speaker by playing a sound through the selected audio output device
 * @param {string} deviceId - Optional audio output device ID. If not provided, uses the currently selected speaker
 * @param {string} name audio to play
 * @param {string} path od sound files
 */
async function playSpeaker(deviceId = null, name, path = "../sounds/") {
  const selectedDeviceId = deviceId || audioOutputSelect?.value;
  if (selectedDeviceId) {
    const sound = path + name + ".mp3";
    const audioToPlay = new Audio(sound);
    try {
      if (typeof audioToPlay.setSinkId === "function") {
        await audioToPlay.setSinkId(selectedDeviceId);
      }
      audioToPlay.volume = 0.5;
      await audioToPlay.play();
    } catch (err) {
      console.error("Cannot play test sound:", err);
    }
  } else {
    playSound(name, true);
  }
}

/**
 * Open specified URL
 * @param {string} url to open
 * @param {boolean} blank if true opne url in the new tab
 */
function openURL(url, blank = false) {
  blank ? window.open(url, "_blank") : (window.location.href = url);
}

/**
 * Show-Hide all elements grp by class name
 * @param {string} className to toggle
 * @param {string} displayState of the element
 */
function toggleClassElements(className, displayState) {
  const elements = getEcN(className);
  for (let i = 0; i < elements.length; i++) {
    elements[i].style.display = displayState;
  }
}

/**
 * Check if valid filename
 * @param {string} fileName
 * @returns boolean
 */
function isValidFileName(fileName) {
  const invalidChars = /[\\\/\?\*\|:"<>]/;
  return !invalidChars.test(fileName);
}

/**
 * Check if WebRTC supported
 * @return {boolean} true/false
 */
function checkWebRTCSupported() {
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/**
 * Get Html element by Id
 * @param {string} id of the element
 * @returns {object} element
 */
function getId(id) {
  return document.getElementById(id);
}

/**
 * Get all element descendants of node
 * @param {string} selectors
 * @returns all element descendants of node that match selectors.
 */
function getQsA(selectors) {
  return document.querySelectorAll(selectors);
}

/**
 * Get element by selector
 * @param {string} selector
 * @returns element
 */
function getQs(selector) {
  return document.querySelector(selector);
}

/**
 * Set document style property
 * @param {string} key
 * @param {string} value
 * @returns {objects} element
 */
function setSP(key, value) {
  return document.documentElement.style.setProperty(key, value);
}

/**
 * Get Html element by selector
 * @param {string} selector of the element
 * @returns {object} element
 */
function getSl(selector) {
  return document.querySelector(selector);
}

/**
 * Get ALL Html elements by selector
 * @param {string} selector of the element
 * @returns {object} element
 */
function getSlALL(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Get Html element by class name
 * @param {string} className of the element
 * @returns {object} element
 */
function getEcN(className) {
  return document.getElementsByClassName(className);
}

/**
 * Get html element by name
 * @param {string} name
 * @returns element
 */
function getName(name) {
  return document.getElementsByName(name);
}

/**
 * Element style display
 * @param {object} elem
 * @param {boolean} yes true/false
 */
function elemDisplay(element, display, mode = "inline") {
  element.style.display = display ? mode : "none";
}

/**
 * Fade the loading backdrop out (opacity transition, see .loading-backdrop
 * in client.css) instead of yanking it away instantly, so whatever's
 * appearing underneath (the name-entry dialog, or the room itself) has
 * time to crossfade in smoothly rather than cutting over abruptly.
 */
function fadeOutLoadingBackdrop() {
  if (!loadingBackdrop) return;
  loadingBackdrop.style.opacity = "0";
  loadingBackdrop.style.pointerEvents = "none";
  loadingBackdrop.addEventListener(
    "transitionend",
    () => elemDisplay(loadingBackdrop, false),
    { once: true },
  );
}

/**
 * Sanitize XSS scripts
 * @param {object} src object
 * @returns sanitized object
 */
function sanitizeXSS(src) {
  return JSON.parse(filterXSS(JSON.stringify(src)));
}

/**
 * Disable element
 * @param {object} elem
 * @param {boolean} disabled
 */
function disable(elem, disabled) {
  elem.disabled = disabled;
}

/**
 * Remove Border Radius
 */
function restoreSplitButtonsBorderRadius() {
  // On mobile we skip dropdown behavior, but ensure split buttons still look rounded.
  document.querySelectorAll("#bottomButtons .split-btn").forEach((group) => {
    group.querySelectorAll("button").forEach((button) => {
      // Hack: Exclude settingsExtraToggle extra buttons...
      if (button.id != "settingsExtraToggle" && button.id != "mySettingsBtn") {
        button.style.setProperty("border-radius", "10px", "important");
      }
    });
    const toggle = group.querySelector(".device-dropdown-toggle");
    if (toggle) toggle.style.setProperty("border-left", "none", "important");
  });
}

/**
 * Setup Quick audio/video device switch dropdowns
 */
function setupQuickDeviceSwitchDropdowns() {
  // For now keep this feature only for desktop devices
  if (!isDesktopDevice) {
    restoreSplitButtonsBorderRadius();
    return;
  }

  if (
    !videoBtn ||
    !audioBtn ||
    !videoDropdown ||
    !audioDropdown ||
    !videoToggle ||
    !audioToggle
  ) {
    return;
  }

  function syncVisibility() {
    // Keep dropdown visible while the corresponding button is visible
    const showVideo =
      !!videoBtn && window.getComputedStyle(videoBtn).display !== "none";
    const showAudio =
      !!audioBtn && window.getComputedStyle(audioBtn).display !== "none";
    videoDropdown.classList.toggle("hidden", !showVideo);
    audioDropdown.classList.toggle("hidden", !showAudio);
  }

  function isMenuOpen(menuEl) {
    return !!menuEl && menuEl.classList.contains("show");
  }

  function closeMenu(toggleEl, menuEl) {
    if (!toggleEl || !menuEl) return;
    menuEl.classList.remove("show");
    toggleEl.setAttribute("aria-expanded", "false");
  }

  function openMenu(toggleEl, menuEl, rebuildFn) {
    if (!toggleEl || !menuEl) return;
    if (typeof rebuildFn === "function") rebuildFn();
    menuEl.classList.add("show");
    toggleEl.setAttribute("aria-expanded", "true");
  }

  function toggleMenu(toggleEl, menuEl, rebuildFn) {
    const open = isMenuOpen(menuEl);
    // only one open at a time
    closeMenu(videoToggle, videoMenu);
    closeMenu(audioToggle, audioMenu);
    if (!open) openMenu(toggleEl, menuEl, rebuildFn);
  }

  function appendMenuHeader(menuEl, iconClass, title) {
    if (!menuEl) return;
    const header = document.createElement("div");
    header.className = "device-menu-header";

    const icon = document.createElement("i");
    icon.className = iconClass;

    const text = document.createElement("span");
    text.textContent = title;

    header.appendChild(icon);
    header.appendChild(text);
    menuEl.appendChild(header);
  }

  function appendMenuDivider(menuEl) {
    if (!menuEl) return;
    const divider = document.createElement("div");
    divider.className = "device-menu-divider";
    menuEl.appendChild(divider);
  }

  function appendSelectOptions(menuEl, selectEl, emptyLabel, rebuildFn) {
    if (!menuEl || !selectEl) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-dropdown-action";
      btn.disabled = true;
      btn.textContent = emptyLabel;
      menuEl.appendChild(btn);
      return;
    }

    const options = Array.from(selectEl.options || []).filter(
      (o) => o && o.value,
    );

    if (options.length === 0) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-dropdown-action";
      btn.disabled = true;
      btn.textContent = emptyLabel;
      menuEl.appendChild(btn);
      return;
    }

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-dropdown-action";

      const isSelected = opt.value === selectEl.value;
      const label = opt.textContent || opt.label || opt.value;

      btn.replaceChildren();
      if (isSelected) {
        const icon = document.createElement("i");
        icon.className = "fas fa-check";
        icon.style.marginRight = "0.5em";
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode(` ${label}`));
      } else {
        const spacer = document.createElement("span");
        spacer.style.display = "inline-block";
        spacer.style.width = "1.25em";
        btn.appendChild(spacer);
        btn.appendChild(document.createTextNode(label));
      }

      btn.addEventListener("click", () => {
        if (selectEl.value === opt.value) return;
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event("change"));
        if (typeof rebuildFn === "function") rebuildFn();
      });

      menuEl.appendChild(btn);
    });
  }

  function rebuildVideoMenu() {
    if (!videoMenu) return;
    videoMenu.innerHTML = "";

    appendMenuHeader(videoMenu, "fas fa-video", "Camera");
    appendSelectOptions(
      videoMenu,
      videoSelect,
      "Không tìm thấy camera",
      rebuildVideoMenu,
    );

    // Add settings button
    appendMenuDivider(videoMenu);
    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.className = "app-dropdown-action device-menu-action-btn";
    const settingsIcon = document.createElement("i");
    settingsIcon.className = "fas fa-cog";
    settingsBtn.appendChild(settingsIcon);
    settingsBtn.appendChild(document.createTextNode(" Mở cài đặt Video"));
    settingsBtn.addEventListener("click", () => {
      hideShowMySettings();
      // Simulate tab click to open the devices tab
      setTimeout(() => {
        tabDevicesBtn.click();
      }, 100);
    });
    videoMenu.appendChild(settingsBtn);
  }

  function rebuildAudioMenu() {
    if (!audioMenu) return;
    audioMenu.innerHTML = "";

    appendMenuHeader(audioMenu, "fas fa-microphone", "Micro");
    appendSelectOptions(
      audioMenu,
      audioInputSelect,
      "Không tìm thấy micro",
      rebuildAudioMenu,
    );

    appendMenuDivider(audioMenu);

    appendMenuHeader(audioMenu, "fas fa-volume-high", "Loa");
    if (!audioOutputSelect || audioOutputSelect.disabled) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-dropdown-action";
      btn.disabled = true;
      btn.textContent = "Không hỗ trợ chọn loa";
      audioMenu.appendChild(btn);
      return;
    }
    appendSelectOptions(
      audioMenu,
      audioOutputSelect,
      "Không tìm thấy loa",
      rebuildAudioMenu,
    );

    // Add action buttons
    appendMenuDivider(audioMenu);

    // Test speaker button
    const testBtn = document.createElement("button");
    testBtn.type = "button";
    testBtn.className = "app-dropdown-action device-menu-action-btn";
    const testIcon = document.createElement("i");
    testIcon.className = "fa-solid fa-circle-play";
    testBtn.appendChild(testIcon);
    testBtn.appendChild(document.createTextNode(" Kiểm tra loa"));
    testBtn.addEventListener("click", () =>
      playSpeaker(audioOutputSelect?.value, "speaker"),
    );
    audioMenu.appendChild(testBtn);

    // Settings button
    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.className = "app-dropdown-action device-menu-action-btn";
    const settingsIcon = document.createElement("i");
    settingsIcon.className = "fas fa-cog";
    settingsBtn.appendChild(settingsIcon);
    settingsBtn.appendChild(document.createTextNode(" Mở cài đặt Âm thanh"));
    settingsBtn.addEventListener("click", () => {
      hideShowMySettings();
      // Simulate tab click to open the devices tab
      setTimeout(() => {
        tabDevicesBtn.click();
      }, 100);
    });
    audioMenu.appendChild(settingsBtn);
  }

  // Hover behavior (desktop only). Note: rebuilding alone is invisible if the menu isn't opened.
  const supportsHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;
  if (supportsHover) {
    const attachHoverDropdown = (toggleEl, menuEl, rebuildFn, closeOtherFn) => {
      if (!toggleEl || !menuEl) return;

      let closeTimeout;
      const cancelClose = () => {
        if (!closeTimeout) return;
        clearTimeout(closeTimeout);
        closeTimeout = null;
      };
      const scheduleClose = () => {
        cancelClose();
        closeTimeout = setTimeout(() => closeMenu(toggleEl, menuEl), 180);
      };

      toggleEl.addEventListener("mouseenter", () => {
        cancelClose();
        if (typeof closeOtherFn === "function") closeOtherFn();
        openMenu(toggleEl, menuEl, rebuildFn);
      });
      toggleEl.addEventListener("mouseleave", scheduleClose);
      menuEl.addEventListener("mouseenter", cancelClose);
      menuEl.addEventListener("mouseleave", scheduleClose);
    };

    attachHoverDropdown(videoToggle, videoMenu, rebuildVideoMenu, () =>
      closeMenu(audioToggle, audioMenu),
    );
    attachHoverDropdown(audioToggle, audioMenu, rebuildAudioMenu, () =>
      closeMenu(videoToggle, videoMenu),
    );
  }

  videoToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu(videoToggle, videoMenu, rebuildVideoMenu);
  });

  audioToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu(audioToggle, audioMenu, rebuildAudioMenu);
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    const t = e.target;
    const inVideo =
      videoDropdown && (videoDropdown === t || videoDropdown.contains(t));
    const inAudio =
      audioDropdown && (audioDropdown === t || audioDropdown.contains(t));
    if (!inVideo) closeMenu(videoToggle, videoMenu);
    if (!inAudio) closeMenu(audioToggle, audioMenu);
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeMenu(videoToggle, videoMenu);
    closeMenu(audioToggle, audioMenu);
  });

  // Close after selecting an item
  if (videoMenu)
    videoMenu.addEventListener("click", () =>
      closeMenu(videoToggle, videoMenu),
    );
  if (audioMenu)
    audioMenu.addEventListener("click", () =>
      closeMenu(audioToggle, audioMenu),
    );

  // Keep UI synced when settings panel changes device
  if (videoSelect) videoSelect.addEventListener("change", rebuildVideoMenu);
  if (audioInputSelect)
    audioInputSelect.addEventListener("change", rebuildAudioMenu);
  if (audioOutputSelect)
    audioOutputSelect.addEventListener("change", rebuildAudioMenu);

  // Keep arrow buttons visible only when Start buttons are visible
  syncVisibility();
  const observer = new MutationObserver(syncVisibility);
  observer.observe(videoBtn, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  observer.observe(audioBtn, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  // Re-enumerate & refresh lists on hardware changes
  if (navigator.mediaDevices) {
    let deviceChangeFrame;
    let lastChangeTime = 0;

    navigator.mediaDevices.addEventListener("devicechange", async () => {
      const now = Date.now();

      // Debounce: ignore rapid-fire changes
      if (now - lastChangeTime < 1000) return;
      lastChangeTime = now;

      if (deviceChangeFrame) cancelAnimationFrame(deviceChangeFrame);
      deviceChangeFrame = requestAnimationFrame(async () => {
        console.log("🔄 Audio devices changed - refreshing...");
        // Give OS time to finish routing (especially important on mobile)
        await new Promise((resolve) =>
          setTimeout(resolve, isMobileDevice ? 1500 : 500),
        );
        try {
          await refreshMyAudioVideoDevices();
        } catch (err) {
          console.warn("Device refresh failed:", err);
        }
        setTimeout(() => {
          rebuildVideoMenu();
          rebuildAudioMenu();
        }, 50);
      });
    });
  }
}

/**
 * Handle dropdown menus on hover (for non-touch devices)
 */
function handleDropdownHover() {
  // Detect if device supports hover (pointer: fine) - works on desktop, tablets with mouse, etc.
  const supportsHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;

  if (!supportsHover) {
    // Touch-only devices - use click behavior only (already handled elsewhere)
    return;
  }

  // Handle Chat dropdown menu hover

  // Handle MsgerCP dropdown menu hover
  if (msgerCPDropDownMenuBtn && msgerCPDropDownContent) {
    let msgerCPTimeoutId;

    const showMsgerCPDropdown = () => {
      clearTimeout(msgerCPTimeoutId);
      elemDisplay(msgerCPDropDownContent, true, "block");
      elemDisplay(msgerSidebarDropDownContent, false);
    };

    const hideMsgerCPDropdown = () => {
      msgerCPTimeoutId = setTimeout(() => {
        elemDisplay(msgerCPDropDownContent, false);
      }, 200);
    };

    msgerCPDropDownMenuBtn.addEventListener("mouseenter", showMsgerCPDropdown);
    msgerCPDropDownMenuBtn.addEventListener("mouseleave", hideMsgerCPDropdown);
    msgerCPDropDownContent.addEventListener("mouseenter", () =>
      clearTimeout(msgerCPTimeoutId),
    );
    msgerCPDropDownContent.addEventListener("mouseleave", hideMsgerCPDropdown);
  }

  if (msgerSidebarDropDownMenuBtn && msgerSidebarDropDownContent) {
    let msgerSidebarTimeoutId;

    const showMsgerSidebarDropdown = () => {
      clearTimeout(msgerSidebarTimeoutId);
      elemDisplay(msgerSidebarDropDownContent, true, "block");
      elemDisplay(msgerCPDropDownContent, false);
    };

    const hideMsgerSidebarDropdown = () => {
      msgerSidebarTimeoutId = setTimeout(() => {
        elemDisplay(msgerSidebarDropDownContent, false);
      }, 200);
    };

    msgerSidebarDropDownMenuBtn.addEventListener(
      "mouseenter",
      showMsgerSidebarDropdown,
    );
    msgerSidebarDropDownMenuBtn.addEventListener(
      "mouseleave",
      hideMsgerSidebarDropdown,
    );
    msgerSidebarDropDownContent.addEventListener("mouseenter", () =>
      clearTimeout(msgerSidebarTimeoutId),
    );
    msgerSidebarDropDownContent.addEventListener(
      "mouseleave",
      hideMsgerSidebarDropdown,
    );
  }
}

/**
 * Handle click outside of an element
 * @param {object} targetElement
 * @param {object} triggerElement
 * @param {function} callback
 * @param {number} minWidth
 */
function handleClickOutside(
  targetElement,
  triggerElement,
  callback,
  minWidth = 0,
) {
  document.addEventListener("click", (e) => {
    if (minWidth && window.innerWidth > minWidth) return;
    let el = e.target;
    let shouldExclude = false;
    while (el) {
      if (
        el instanceof HTMLElement &&
        (el === targetElement || el === triggerElement)
      ) {
        shouldExclude = true;
        break;
      }
      el = el.parentElement;
    }
    if (!shouldExclude) callback();
  });
}

/**
 * Set media button class based on status
 * @param {object} button - Button element
 * @param {boolean} status - Media status (on/off)
 * @param {string} mediaType - 'audio', 'video', or 'screen'
 */
function setMediaButtonClass(button, status, mediaType) {
  if (!button) return;
  const classMap = {
    audio: status ? className.audioOn : className.audioOff,
    video: status ? className.videoOn : className.videoOff,
    screen: status ? className.screenOff : className.screenOn,
  };
  button.className = classMap[mediaType] || button.className;
}

/**
 * Set multiple media button classes at once
 * @param {Array} buttons - Array of {element, status, mediaType}
 */
function setMediaButtonsClass(buttons) {
  buttons.forEach(({ element, status, mediaType }) => {
    setMediaButtonClass(element, status, mediaType);
  });
}

/**
 * Display multiple elements at once
 * @param {Array} elements - Array of {element, display, mode}
 */
function displayElements(elements) {
  elements.forEach(({ element, display, mode = "inline" }) => {
    if (element) elemDisplay(element, display, mode);
  });
}

/**
 * Sleep in ms
 * @param {integer} ms milleseconds
 * @returns Promise
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderRoomTemplate(templateId, data = {}) {
  const template = document.getElementById(templateId);
  if (!template) {
    console.error("Template not found: " + templateId);
    return "";
  }

  // Clone the template content
  const clone = template.content.cloneNode(true);

  // Process attrs
  if (data.attrs) {
    for (const [key, value] of Object.entries(data.attrs)) {
      const elements = clone.querySelectorAll(
        `[data-template-attr-${key.toLowerCase()}]`,
      );
      elements.forEach((el) => {
        // find all attributes that start with data-template-attr-
        Array.from(el.attributes).forEach((attr) => {
          if (
            attr.name.startsWith("data-template-attr-") &&
            attr.value === key
          ) {
            const targetAttr = attr.name.replace("data-template-attr-", "");
            if (value !== undefined) {
              el.setAttribute(targetAttr, value);
            }
            el.removeAttribute(attr.name);
          }
        });
      });
      // also check direct matches just in case
      const els = clone.querySelectorAll(
        `[data-template-attr-id="${key}"], [data-template-attr-class="${key}"], [data-template-attr-data-sender="${key}"], [data-template-attr-data-chat-type="${key}"], [data-template-attr-data-chat-peer="${key}"], [data-template-attr-data-msg-id="${key}"]`,
      );
      els.forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          if (
            attr.name.startsWith("data-template-attr-") &&
            attr.value === key
          ) {
            const targetAttr = attr.name.replace("data-template-attr-", "");
            el.setAttribute(targetAttr, value);
            el.removeAttribute(attr.name);
          }
        });
      });
    }
  }

  // Process text
  if (data.text) {
    for (const [key, value] of Object.entries(data.text)) {
      const elements = clone.querySelectorAll(`[data-template-text="${key}"]`);
      elements.forEach((el) => {
        el.textContent = value;
        el.removeAttribute("data-template-text");
      });
    }
  }

  // Process html
  if (data.html) {
    for (const [key, value] of Object.entries(data.html)) {
      const elements = clone.querySelectorAll(`[data-template-html="${key}"]`);
      elements.forEach((el) => {
        el.innerHTML = value;
        el.removeAttribute("data-template-html");
      });
    }
  }

  // Return outerHTML of the children
  let result = "";
  clone.childNodes.forEach((node) => {
    if (node.nodeType === 1) {
      result += node.outerHTML;
    }
  });
  return result;
}

function setColor(el, color) {
  if (el) el.style.color = color;
}
function chatCenter() {
  const msgerDraggable = getId("msgerDraggable");
  if (msgerDraggable) {
    elemDisplay(msgerDraggable, true, "flex");
    // #msgerDraggable is already "fixed inset-0 ... flex items-center
    // justify-center" (mirrors reference's chat wrapper exactly) - it
    // centers its child via flexbox on its own. Setting top/left/transform
    // here (leftover from before that Tailwind rewrite) fights the
    // inset-0 sizing: with top/left overridden but right/bottom still 0
    // from inset-0, the box's used width/height shrink to satisfy every
    // inset at once, so the panel renders as a small centered box instead
    // of covering the screen - that's the "near-full but not full" bug.
    // Clear any earlier drag/keyboard-avoidance inline overrides instead.
    msgerDraggable.style.top = "";
    msgerDraggable.style.left = "";
    msgerDraggable.style.right = "";
    msgerDraggable.style.bottom = "";
    msgerDraggable.style.width = "";
    msgerDraggable.style.height = "";
    msgerDraggable.style.transform = "";
    msgerDraggable.style.position = "";
  }
}
/**
 * Keep the chat panel tracking the actual visible viewport (not the full
 * layout viewport) on mobile/tablet - mirrors App.tsx's visualViewport
 * effect. When the on-screen keyboard opens, the visual viewport shrinks
 * and its offsetTop can grow; without this, the panel keeps the layout
 * viewport's height and the keyboard just covers the input instead of the
 * whole panel shrinking to stay above it.
 */
function applyChatViewportStyle() {
  const msgerDraggable = getId("msgerDraggable");
  if (!msgerDraggable || !isChatRoomVisible) return;
  if (window.innerWidth < 1024 && window.visualViewport) {
    const vv = window.visualViewport;
    // client.html has a `#msgerDraggable { top/left/width/height: ... !important }`
    // rule (a blunt fix for the old JS-centering bug that chatCenter() now
    // fixes properly) - a plain inline style can't win against an
    // !important class rule, so this must set `!important` too via
    // setProperty to actually be able to track the visual viewport.
    const set = (prop, val) =>
      msgerDraggable.style.setProperty(prop, val, "important");
    set("position", "fixed");
    set("height", vv.height + "px");
    set("top", vv.offsetTop + "px");
    set("width", "100%");
    set("left", "0");
    set("right", "auto");
    set("bottom", "auto");
    set("transform", "none");
  } else {
    const remove = (prop) => msgerDraggable.style.removeProperty(prop);
    remove("position");
    remove("height");
    remove("top");
    remove("width");
    remove("left");
    remove("right");
    remove("bottom");
    remove("transform");
  }
}
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", applyChatViewportStyle);
  window.visualViewport.addEventListener("scroll", applyChatViewportStyle);
}

function canBePinned() {
  return (
    window.innerWidth >= 1024 &&
    window.matchMedia("(orientation: landscape)").matches
  );
}
function chatPin() {
  const msgerDraggable = getId("msgerDraggable");
  if (msgerDraggable) {
    msgerDraggable.classList.add("msger-pinned");
    isChatPinned = true;
  }
}

function chatUnpin() {
  const msgerDraggable = getId("msgerDraggable");
  if (msgerDraggable) {
    msgerDraggable.classList.remove("msger-pinned");
    isChatPinned = false;
  }
}

function hideChatRoomAndEmojiPicker() {
  const msgerDraggable = getId("msgerDraggable");

  if (msgerDraggable) {
    elemDisplay(msgerDraggable, false);
    // Clear any keyboard-avoidance/drag inline overrides so the next open
    // starts clean (chatCenter()/chatPin() decide positioning from there).
    msgerDraggable.style.position = "";
    msgerDraggable.style.height = "";
    msgerDraggable.style.top = "";
    msgerDraggable.style.width = "";
    msgerDraggable.style.left = "";
  }
  isChatRoomVisible = false;

  syncChatToolbarButtons();
  if (typeof chatRoomBtn !== "undefined" && chatRoomBtn) {
    setTippy(chatRoomBtn, "Mở khung chat (C)", bottomButtonsPlacement);
  }
}

const msgerPrivateChatsEmpty =
  getId("msgerPrivateChatsEmpty") || document.createElement("div");
const msgerSidebarCloseBtn =
  getId("msgerSidebarCloseBtn") || document.createElement("button");

function chatMinimize() {
  setSP("--msger-width", "min(1120px, 92vw)");
  setSP("--msger-height", "min(760px, 92vh)");
  chatCenter();
}

function createChatMessageId() {
  return "msg-" + Math.random().toString(36).substr(2, 9) + "-" + Date.now();
}

function normalizeChatMessageId(id) {
  return id ? id.toString() : "";
}

/*--------------------------------------------------------------
# Top Header Bar Custom Logic
--------------------------------------------------------------*/
let topHeaderBarTimer = 0;
let topHeaderBarInterval = null;

function initTopHeaderBar() {
  const headerRoomId = getId("headerRoomId");
  if (headerRoomId) headerRoomId.innerText = roomId;
  const waitingRoomIdSpan = getId("waitingRoomIdSpan");
  if (waitingRoomIdSpan) waitingRoomIdSpan.innerText = roomId;

  const headerTimer = getId("headerTimer");
  if (headerTimer && !topHeaderBarInterval) {
    topHeaderBarInterval = setInterval(() => {
      topHeaderBarTimer++;
      // Math.floor(topHeaderBarTimer / 60) sẽ tự động tăng lên 60, 99, 100,... mà không bị reset
      const mins = Math.floor(topHeaderBarTimer / 60)
        .toString()
        .padStart(2, "0");
      const secs = (topHeaderBarTimer % 60).toString().padStart(2, "0");
      headerTimer.innerText = `${mins}:${secs}`;
    }, 1000);
  }

  const headerCopyBtn = getId("headerCopyBtn");
  const headerCopyIcon = getId("headerCopyIcon");
  if (headerCopyBtn) {
    headerCopyBtn.addEventListener("click", () => {
      playSound("switch");
      navigator.clipboard.writeText(roomId);
      // Hiện icon check xanh lá khi copy thành công
      headerCopyBtn.innerHTML =
        '<i data-lucide="check" class="w-3 h-3 text-emerald-400"></i>';
      if (window.lucide) window.lucide.createIcons({ root: headerCopyBtn });

      setTimeout(() => {
        // Trả về icon copy cũ sau 2 giây
        headerCopyBtn.innerHTML =
          '<i id="headerCopyIcon" data-lucide="copy" class="w-3 h-3"></i>';
        if (window.lucide) window.lucide.createIcons({ root: headerCopyBtn });
      }, 3000);
    });
  }

  const waitingCopyRoomLink = getId("waitingCopyRoomLink");
  if (waitingCopyRoomLink) {
    waitingCopyRoomLink.addEventListener("click", () => {
      playSound("switch");
      navigator.clipboard.writeText(roomId);

      const text = getId("waitingCopyText");
      if (text) text.innerText = "Đã sao chép mã phòng";
      waitingCopyRoomLink.innerHTML =
        '<i data-lucide="check" class="w-4 h-4 text-emerald-400" id="waitingCopyIcon"></i> <span id="waitingCopyText">Đã sao chép mã phòng</span>';
      if (window.lucide)
        window.lucide.createIcons({ root: waitingCopyRoomLink });

      setTimeout(() => {
        waitingCopyRoomLink.innerHTML =
          '<i data-lucide="copy" class="w-4 h-4 text-blue-400" id="waitingCopyIcon"></i> <span id="waitingCopyText">Sao chép mã phòng</span>';
        if (window.lucide)
          window.lucide.createIcons({ root: waitingCopyRoomLink });
      }, 3000);
    });
  }

  updateTopHeaderPeerCount();
}

function updateTopHeaderPeerCount() {
  const dot = getId("headerStatusDot");
  const countText = getId("headerPeerCount");
  if (!dot || !countText) return;

  // Tính tổng số lượng người (Bạn + những người cùng phòng)
  const totalPeers = Object.keys(peerConnections).length + 1;

  let waitingCard = getId("waitingRoomCard");

  if (totalPeers > 1) {
    // Cập nhật trạng thái màu Xanh (Có người)
    dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
    countText.className = "text-emerald-400";
    countText.innerText = `${totalPeers}/2`; // Sẽ linh hoạt hiện 2/2, 3/2 tuỳ lượng người
    if (waitingCard) {
      waitingCard.style.display = "none";
      waitingCard.className =
        "bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-2xl flex-col items-center justify-center p-6 text-center w-full h-full";
      const pipBtn = document.getElementById("newPipBtn");
      if (pipBtn) {
        pipBtn.style.opacity = "1";
        pipBtn.style.pointerEvents = "auto";
        pipBtn.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }
  } else {
    // Cập nhật trạng thái màu Vàng (Đang chờ)
    dot.className = "w-2 h-2 rounded-full bg-amber-500";
    countText.className = "text-amber-400";
    countText.innerText = `1/2`;
    if (waitingCard) {
      waitingCard.style.display = "flex";
      waitingCard.className =
        "Camera bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 text-center w-full h-full";
      const pipBtn = document.getElementById("newPipBtn");
      if (pipBtn) {
        pipBtn.style.opacity = "0.5";
        pipBtn.style.pointerEvents = "none";
        pipBtn.classList.add("opacity-50", "cursor-not-allowed");
      }
    }
  }

  // Native-fullscreen-video button (#newFullscreenBtn, wired in
  // client.html) - mobile only, always sits in the bar like every other
  // button there (same shell). Its enabled/disabled look is driven by
  // whether the peer actually has camera/screen visible right now, not
  // just peer count - that's updateUI()'s job in client.html (see the
  // updateNewControlBarUI bridge call below), since it needs to react
  // to camera/screen toggles mid-call too, not only join/leave.
  const newFullscreenBtn = getId("newFullscreenBtn");
  if (newFullscreenBtn) {
    elemDisplay(newFullscreenBtn, isMobileDevice, "flex");
  }
  if (typeof window.updateNewControlBarUI === "function") {
    window.updateNewControlBarUI();
  }

  if (typeof resizeVideoMedia === "function") {
    resizeVideoMedia();
  }

  // 1 remote peer connected (2 total incl. me): switch my tile to the
  // small floating draggable self-view, matching the reference layout.
  toggleSoloSelfView(totalPeers === 2);

  // Re-sync camera-tile-vs-screen-tile visibility whenever the peer
  // count changes (e.g. the peer leaves mid-share) - toggleSoloSelfView
  // above may have just reset myVideoWrap's inline display, which would
  // otherwise leave the camera tile visible again even though screen
  // sharing is still active.
  syncSoloVisibilityForLocalScreenShare(isScreenStreaming);
}

// ---- Solo self-view (1-on-1 floating local video) state ----
// Mirrors FloatingLocalVideo.tsx: corner snap position, independent
// "hidden" flag (never touches the real camera), and the 5s idle fade.
let soloCorner = "bottom-right";
let soloHidden = false;
let soloDragging = false;
let soloFadeTimer = null;
let soloPointerStart = { x: 0, y: 0 };

/**
 * Toggle the floating draggable self-view thumbnail used when exactly
 * one other participant is in the room, so the remote peer's tile
 * fills the main stage - mirrors FloatingLocalVideo.tsx.
 * @param {boolean} enable
 */
function toggleSoloSelfView(enable) {
  const wrap = getId("myVideoWrap");
  if (!wrap) return;

  ensureSoloWidgets(wrap);

  if (videoMediaContainer) {
    videoMediaContainer.classList.toggle("solo-active", enable);
  }

  const isSolo = wrap.classList.contains("solo-self");
  if (enable && !isSolo) {
    // Fresh default each time solo mode (re)starts, same as the
    // reference's useState(...) evaluated on mount.
    soloCorner = window.innerWidth < 1024 ? "top-right" : "bottom-right";
    soloHidden = false;
    wrap.classList.add("solo-self", `corner-${soloCorner}`);
    wrap.classList.remove("solo-hidden", "solo-faded");
    // Sync compact-avatar/mic-badge state in case setMyVideoStatus /
    // setMyAudioStatus haven't run since the actual current status
    // was established (avoids a stale placeholder on first solo entry).
    wrap.classList.toggle("solo-cam-off", !myVideoStatus);
    wrap.classList.toggle("solo-audio-off", !myAudioStatus);
    resetSoloFadeTimer(wrap);
    updateRemoteNameTagPosition();
    updateSoloScreenTileVisibility();
  } else if (!enable && isSolo) {
    clearTimeout(soloFadeTimer);
    wrap.classList.remove(
      "solo-self",
      "solo-hidden",
      "solo-faded",
      "solo-dragging",
      "corner-top-left",
      "corner-top-right",
      "corner-bottom-left",
      "corner-bottom-right",
    );
    wrap.style.transform = "";
    wrap.style.display = "";
    updateRemoteNameTagPosition();
    resetSoloScreenTileVisibility();
    // PiP only makes sense in the 1-on-1 view it was opened from -
    // force it closed if we just left solo mode (peer left, or a 3rd
    // participant joined and the grid takes over).
    if (typeof isInPagePip !== "undefined" && isInPagePip) {
      togglePagePip("close");
    }
  }
}

/**
 * Lazily build the extra elements the floating thumbnail needs (the
 * eye-off "hide preview" button, the "show camera" pill shown while
 * hidden, the mic-off badge, and the compact camera-off placeholder)
 * and wire up pointer drag-to-corner + the idle fade timer. Runs once
 * per call (guarded by a data attribute).
 * @param {HTMLElement} wrap myVideoWrap element
 */
function ensureSoloWidgets(wrap) {
  if (wrap.dataset.soloReady) return;
  wrap.dataset.soloReady = "1";

  // Eye-off: hides the floating preview locally only - the outgoing
  // camera track and the remote peer's view are never affected.
  const eyeBtn = document.createElement("button");
  eyeBtn.id = "mySoloEyeBtn";
  eyeBtn.className = "solo-eye-btn";
  eyeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"></path>' +
    '<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"></path>' +
    '<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"></path>' +
    '<path d="m2 2 20 20"></path></svg>';
  eyeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  eyeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSoloHidden(wrap, true);
  });
  wrap.appendChild(eyeBtn);

  // "Show camera" pill, shown only while hidden
  const showBtn = document.createElement("button");
  showBtn.id = "mySoloShowBtn";
  showBtn.className = "solo-show-btn";
  showBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>' +
    '<circle cx="12" cy="12" r="3"></circle></svg>';
  showBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  showBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSoloHidden(wrap, false);
  });
  wrap.appendChild(showBtn);

  // Mic-off badge (top-right), independent of hover/fade
  const badges = document.createElement("div");
  badges.className = "solo-status-badges";
  badges.innerHTML =
    '<span class="solo-mic-off-badge">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 19v3"></path><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path>' +
    '<path d="M16.95 16.95A7 7 0 0 1 5 12v-2"></path><path d="M18.89 13.23A7 7 0 0 0 19 12v-2"></path>' +
    '<path d="m2 2 20 20"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path></svg></span>';
  wrap.appendChild(badges);

  // Compact camera-off placeholder: shows the actual chosen avatar photo
  // (circular) when one is set, falling back to a generic user icon
  // otherwise - see updateSoloCompactAvatar().
  const avatar = document.createElement("div");
  avatar.className = "solo-compact-avatar";
  avatar.innerHTML =
    '<div class="solo-compact-avatar-ring"><div class="solo-compact-avatar-circle">' +
    '<img id="mySoloAvatarImg" class="solo-compact-avatar-img" style="display:none" />' +
    '<svg id="mySoloAvatarIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' +
    "</div></div>";
  wrap.appendChild(avatar);
  updateSoloCompactAvatar();

  // Drag-to-corner (pointer events cover mouse + touch + pen)
  wrap.addEventListener("pointerdown", (e) => {
    if (
      !wrap.classList.contains("solo-self") ||
      wrap.classList.contains("solo-hidden")
    )
      return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    soloDragging = true;
    wrap.classList.add("solo-dragging");
    resetSoloFadeTimer(wrap);
    soloPointerStart = { x: e.clientX, y: e.clientY };
    try {
      wrap.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  });

  wrap.addEventListener("pointermove", (e) => {
    resetSoloFadeTimer(wrap);
    if (!soloDragging) return;
    const dx = e.clientX - soloPointerStart.x;
    const dy = e.clientY - soloPointerStart.y;
    wrap.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  });

  const endSoloDrag = (e) => {
    if (!soloDragging) return;
    soloDragging = false;
    try {
      wrap.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    // Compute the corner/hidden target FIRST, while "solo-dragging" is
    // still applied (transform has no transition), so the box's actual
    // dragged position is read correctly. Only then remove the class
    // and clear the transform, so the snap-to-corner animates smoothly
    // via the top/left/right/bottom transition.
    snapSoloToNearestCorner(wrap);
    wrap.classList.remove("solo-dragging");
    wrap.style.transform = "";
  };
  wrap.addEventListener("pointerup", endSoloDrag);
  wrap.addEventListener("pointercancel", endSoloDrag);
}

/**
 * On drag release, snap the thumbnail to whichever quadrant of the
 * video stage its center now falls in, or hide it entirely (showing
 * the small "Eye" pill in that corner) if it was dragged mostly out
 * of the stage bounds - mirrors handlePointerUp in FloatingLocalVideo.tsx.
 * @param {HTMLElement} wrap
 */
function snapSoloToNearestCorner(wrap) {
  const container = videoMediaContainer;
  if (!container) return;

  const boxRect = wrap.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const boxCenterX = boxRect.left + boxRect.width / 2;
  const boxCenterY = boxRect.top + boxRect.height / 2;
  const isLeft = boxCenterX < containerRect.left + containerRect.width / 2;
  const isTop = boxCenterY < containerRect.top + containerRect.height / 2;

  let newCorner = "bottom-right";
  if (isTop && isLeft) newCorner = "top-left";
  else if (isTop && !isLeft) newCorner = "top-right";
  else if (!isTop && isLeft) newCorner = "bottom-left";

  const isOutOfBoundsX =
    boxRect.left > containerRect.right - (boxRect.width * 2) / 3 ||
    boxRect.right < containerRect.left + (boxRect.width * 2) / 3;
  const isOutOfBoundsY =
    boxRect.top > containerRect.bottom - (boxRect.height * 2) / 3 ||
    boxRect.bottom < containerRect.top + (boxRect.height * 2) / 3;

  setSoloCorner(wrap, newCorner);

  if (isOutOfBoundsX || isOutOfBoundsY) {
    setSoloHidden(wrap, true);
  }
}

/**
 * @param {HTMLElement} wrap
 * @param {"top-left"|"top-right"|"bottom-left"|"bottom-right"} corner
 */
function setSoloCorner(wrap, corner) {
  wrap.classList.remove(
    "corner-top-left",
    "corner-top-right",
    "corner-bottom-left",
    "corner-bottom-right",
  );
  wrap.classList.add(`corner-${corner}`);
  soloCorner = corner;
  updateRemoteNameTagPosition();
}

/**
 * @param {HTMLElement} wrap
 * @param {boolean} hidden
 */
function setSoloHidden(wrap, hidden) {
  soloHidden = hidden;
  wrap.classList.toggle("solo-hidden", hidden);
  resetSoloFadeTimer(wrap);
}

/**
 * Resets the 5s idle fade timer (any pointer activity keeps the
 * eye-off/show button at full opacity; after 5s of no activity it
 * dims to 30%, same as isFadedOut in FloatingLocalVideo.tsx).
 * @param {HTMLElement} wrap
 */
function resetSoloFadeTimer(wrap) {
  wrap.classList.remove("solo-faded");
  clearTimeout(soloFadeTimer);
  soloFadeTimer = setTimeout(() => {
    wrap.classList.add("solo-faded");
  }, 5000);
}

/**
 * Force the floating self-view thumbnail hidden while the remote peer
 * is screen sharing, and restore it once they stop - overrides any
 * manual hidden state, mirroring the isRemoteScreenSharing effect.
 * @param {boolean} isRemoteSharing
 */
function syncSoloVisibilityForRemoteScreenShare(isRemoteSharing) {
  const wrap = getId("myVideoWrap");
  if (!wrap || !wrap.classList.contains("solo-self")) return;
  setSoloHidden(wrap, isRemoteSharing);
}

/**
 * Hide my own camera tile entirely while I'm screen sharing (the
 * reference's single video slot swaps content instead of showing both),
 * restoring it when I stop. Applies whether or not a peer is connected -
 * previously this bailed out unless the floating solo self-view was
 * active (peer connected), so sharing alone in the waiting room, or a
 * peer leaving mid-share, left BOTH the camera tile and the screen tile
 * visible next to the waiting card (3-way split instead of the
 * reference's 2-cell layout).
 * @param {boolean} isSharing
 */
function syncSoloVisibilityForLocalScreenShare(isSharing) {
  const wrap = getId("myVideoWrap");
  if (!wrap) return;
  // Also stays hidden while the in-page PiP window is open - matches
  // FloatingLocalVideo.tsx: `if (isScreenSharing || isPipActive) return null;`
  const pipOpen = typeof isInPagePip !== "undefined" && isInPagePip;
  wrap.style.display = isSharing || pipOpen ? "none" : "";
}

/**
 * Keep the remote peer's name-tag out of the way of my floating
 * thumbnail: move it to top-left only when my corner is bottom-left,
 * otherwise keep the default bottom-left position (mirrors App.tsx's
 * nameTagPosition={pipCorner === 'bottom-left' ? 'top-left' : 'bottom-left'}).
 */
function updateRemoteNameTagPosition() {
  if (!videoMediaContainer) return;
  const shouldMoveUp = soloCorner === "bottom-left";
  videoMediaContainer
    .querySelectorAll(".videoPeerName")
    .forEach((tag) => {
      if (tag.closest("#myVideoWrap") || tag.closest("#waitingRoomCard"))
        return;
      tag.classList.toggle("name-pos-top-left", shouldMoveUp);
    });
}

/**
 * In solo/1-on-1 mode each participant must show as a SINGLE tile,
 * never their camera and screen tiles stacked side by side - matches
 * the reference, where one <video> element's content swaps between
 * camera and screen instead of a second element appearing alongside it.
 * Call whenever a peer's screen-share flag changes, and right after a
 * screen tile is created/removed, so there is no frame where both (or
 * neither) tile is visible.
 */
function updateSoloScreenTileVisibility() {
  if (
    !videoMediaContainer ||
    !videoMediaContainer.classList.contains("solo-active")
  )
    return;

  Object.keys(peerConnections).forEach((peer_id) => {
    const isSharing = !!(
      allPeers[peer_id] && allPeers[peer_id]["peer_screen_status"]
    );
    const camWrap = getId(peer_id + "_videoWrap");
    const screenWrap = getId(peer_id + "_screenWrap");
    // "" reverts to the .Camera/.Screen class default (flex) instead
    // of hardcoding a value that could drift from the base stylesheet.
    if (camWrap) camWrap.style.display = isSharing ? "none" : "";
    if (screenWrap) screenWrap.style.display = isSharing ? "" : "none";
  });

  if (typeof isInPagePip !== "undefined" && isInPagePip) {
    syncPipVideoSource();
    updatePipStatusBadges();
  }
}

/**
 * Undo any inline display overrides updateSoloScreenTileVisibility left
 * behind, so tiles render normally again once solo mode ends (e.g. a
 * 3rd participant joins and the grid takes over).
 */
function resetSoloScreenTileVisibility() {
  Object.keys(peerConnections).forEach((peer_id) => {
    const camWrap = getId(peer_id + "_videoWrap");
    const screenWrap = getId(peer_id + "_screenWrap");
    if (camWrap) camWrap.style.display = "";
    if (screenWrap) screenWrap.style.display = "";
  });
}

// ---------------------------------------------------------------
// In-page Picture-in-Picture (mirrors FloatingRemoteVideo.tsx)
//
// This is a draggable/resizable overlay INSIDE the page, not the real
// browser documentPictureInPicture window - the control-bar button
// only checks 'documentPictureInPicture' in window as a capability
// GATE (matching ControlBar.tsx's supportsPip), same as the reference.
// The older real-PiP feature (documentPiPBtn in Settings) is untouched.
// ---------------------------------------------------------------

let isInPagePip = false;
let pipSize = { width: 240, height: 135 };
let pipPos = { x: 0, y: 0 };
let pipDragging = false;
let pipDragStart = { x: 0, y: 0 };
let pipPosStart = { x: 0, y: 0 };
let pipResizing = false;
let pipResizeCorner = null;
let pipSizeStart = { w: 0, h: 0 };

const PIP_MIN_WIDTH = 160;

/**
 * @param {"toggle"|"open"|"close"} [action]
 */
function togglePagePip(action = "toggle") {
  if (action === "close") {
    setPagePip(false);
    return;
  }
  if (action === "open") {
    setPagePip(true);
    return;
  }
  setPagePip(!isInPagePip);
}

/**
 * @param {boolean} enable
 */
function setPagePip(enable) {
  if (enable === isInPagePip) return;
  // disablePip={!remotePeer} in ControlBar.tsx
  if (enable && Object.keys(peerConnections).length < 1) return;

  isInPagePip = enable;
  window.isInPagePip = enable; // read by the control-bar bridge in client.html
  playSound("click");

  const overlay = getId("pipOverlay");
  const placeholder = getId("pipStagePlaceholder");

  if (enable) {
    initPipOverlayInteractions();
    // Fresh default position/size every open, same as the reference
    // remounting <FloatingRemoteVideo> each time isInPagePip flips true.
    pipSize = { width: 240, height: 135 };
    pipPos = {
      x: window.innerWidth - pipSize.width - 20,
      y: window.innerHeight - pipSize.height - 20,
    };
    applyPipTransform();
    if (overlay) overlay.style.display = "flex";
    if (placeholder) placeholder.classList.add("pip-active");
    updatePipStagePlaceholderText();
    syncPipVideoSource();
    updatePipStatusBadges();
    updatePipLocalControlButtons();
  } else {
    if (overlay) overlay.style.display = "none";
    if (placeholder) placeholder.classList.remove("pip-active");
  }

  // Floating self-view has no equivalent while PiP is open, same as
  // while screen sharing
  syncSoloVisibilityForLocalScreenShare(isScreenStreaming);

  if (typeof window.updateNewControlBarUI === "function") {
    window.updateNewControlBarUI();
  }
}

function applyPipTransform() {
  const overlay = getId("pipOverlay");
  if (!overlay) return;
  overlay.style.width = pipSize.width + "px";
  overlay.style.height = pipSize.height + "px";
  overlay.style.transform = `translate3d(${pipPos.x}px, ${pipPos.y}px, 0)`;
}

function updatePipStagePlaceholderText() {
  const title = getId("pipStagePlaceholderTitle");
  const iconPip = getId("pipStageIconPip");
  const iconScreen = getId("pipStageIconScreen");
  const sharing = !!isScreenStreaming;
  if (title) {
    title.textContent = sharing
      ? "Đang chia sẻ màn hình"
      : "Đang phát trong Hình trong hình";
  }
  if (iconPip) iconPip.style.display = sharing ? "none" : "";
  if (iconScreen) iconScreen.style.display = sharing ? "" : "none";
}

/**
 * Mirror whichever remote tile is currently the "main stage" video
 * (camera or screen, whichever is visible) into the PiP <video> - the
 * same MediaStream can play in more than one <video> element at once.
 */
function syncPipVideoSource() {
  const pipVideo = getId("pipVideo");
  if (!pipVideo || !videoMediaContainer) return;
  let sourceVideo = null;
  for (const child of videoMediaContainer.children) {
    if (child.id === "myVideoWrap" || child.id === "waitingRoomCard") continue;
    if (getComputedStyle(child).display === "none") continue;
    const v = child.querySelector("video");
    if (v && v.srcObject) {
      sourceVideo = v;
      break;
    }
  }
  if (sourceVideo && pipVideo.srcObject !== sourceVideo.srcObject) {
    pipVideo.srcObject = sourceVideo.srcObject;
    pipVideo.play().catch(() => {});
  }
}

/**
 * Reflect the remote peer's camera-off/mic-off/screen-sharing state on
 * the PiP window (placeholder text + top-left badges) - mirrors
 * VideoPlayer.tsx's isPipMode branch.
 */
function updatePipStatusBadges() {
  const overlay = getId("pipOverlay");
  if (!overlay) return;
  const peerId = Object.keys(peerConnections)[0];
  const isScreenActive = !!(
    peerId &&
    allPeers[peerId] &&
    allPeers[peerId]["peer_screen_status"]
  );
  const vStatusEl = peerId ? getId(peerId + "_videoStatus") : null;
  const aStatusEl = peerId ? getId(peerId + "_audioStatus") : null;
  // className is a FontAwesome icon class ("fas fa-video-slash" etc.),
  // never the literal word "Off".
  const isVideoOff = !!(vStatusEl && vStatusEl.className.includes("-slash"));
  const isAudioOff = !!(aStatusEl && aStatusEl.className.includes("-slash"));

  overlay.classList.toggle("pip-video-off", isVideoOff && !isScreenActive);
  overlay.classList.toggle("pip-remote-screen-sharing", isScreenActive);
  overlay.classList.toggle("pip-remote-audio-off", isAudioOff);
}

/**
 * Sync the PiP window's own bottom control bar (controls MY media,
 * same as the main ControlBar) - mirrors FloatingRemoteVideo.tsx's
 * localAudioMuted/localVideoOff/localScreenSharing button states.
 */
function updatePipLocalControlButtons() {
  const audioBtnEl = getId("pipAudioBtn");
  const videoBtnEl = getId("pipVideoBtn");
  const screenBtnEl = getId("pipScreenBtn");
  if (audioBtnEl) {
    audioBtnEl.classList.toggle("pip-active-state", !myAudioStatus);
  }
  if (videoBtnEl) {
    videoBtnEl.classList.toggle("pip-disabled-state", !!isScreenStreaming);
    videoBtnEl.classList.toggle(
      "pip-active-state",
      !isScreenStreaming && !myVideoStatus,
    );
  }
  if (screenBtnEl) {
    screenBtnEl.classList.toggle("pip-active-state", !!isScreenStreaming);
  }
}

/**
 * Wire up drag/resize/buttons for the PiP overlay once (idempotent).
 */
function initPipOverlayInteractions() {
  const overlay = getId("pipOverlay");
  if (!overlay || overlay.dataset.pipReady) return;
  overlay.dataset.pipReady = "1";

  overlay.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".no-drag")) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pipDragging = true;
    overlay.classList.add("pip-dragging");
    pipDragStart = { x: e.clientX, y: e.clientY };
    pipPosStart = { x: pipPos.x, y: pipPos.y };
    try {
      overlay.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  });

  overlay.addEventListener("pointermove", (e) => {
    if (pipDragging) {
      const dx = e.clientX - pipDragStart.x;
      const dy = e.clientY - pipDragStart.y;
      let newX = pipPosStart.x + dx;
      let newY = pipPosStart.y + dy;
      newX = Math.max(0, Math.min(newX, window.innerWidth - pipSize.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - pipSize.height));
      pipPos = { x: newX, y: newY };
      applyPipTransform();
    } else if (pipResizing) {
      handlePipResizeMove(e);
    }
  });

  const endPipInteraction = (e) => {
    if (pipDragging) {
      pipDragging = false;
      overlay.classList.remove("pip-dragging");
    }
    if (pipResizing) {
      pipResizing = false;
      pipResizeCorner = null;
      overlay.classList.remove("pip-resizing");
    }
    try {
      overlay.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  };
  overlay.addEventListener("pointerup", endPipInteraction);
  overlay.addEventListener("pointercancel", endPipInteraction);

  overlay.querySelectorAll(".pip-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      pipResizing = true;
      pipResizeCorner = handle.dataset.corner;
      overlay.classList.add("pip-resizing");
      pipDragStart = { x: e.clientX, y: e.clientY };
      pipSizeStart = { w: pipSize.width, h: pipSize.height };
      pipPosStart = { x: pipPos.x, y: pipPos.y };
      try {
        overlay.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    });
  });

  getId("pipCloseBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePagePip("close");
  });
  getId("pipStageCloseBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePagePip("close");
  });
  getId("pipAudioBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    audioBtn?.click();
  });
  getId("pipVideoBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    videoBtn?.click();
  });
  getId("pipScreenBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    screenShareBtn?.click();
  });
  getId("pipLeaveBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const newLeave = document.getElementById("newLeaveBtn");
    if (newLeave) newLeave.click();
    else if (typeof leaveRoom === "function") leaveRoom();
  });
}

/**
 * @param {PointerEvent} e
 */
function handlePipResizeMove(e) {
  const dx = e.clientX - pipDragStart.x;
  const MAX_WIDTH = Math.min(400, window.innerWidth - 40);
  let newW = pipSizeStart.w;
  let newX = pipPosStart.x;
  let newY = pipPosStart.y;

  if (pipResizeCorner === "se") {
    newW = Math.min(MAX_WIDTH, Math.max(PIP_MIN_WIDTH, pipSizeStart.w + dx));
  } else if (pipResizeCorner === "sw") {
    newW = Math.min(MAX_WIDTH, Math.max(PIP_MIN_WIDTH, pipSizeStart.w - dx));
    newX = pipPosStart.x - (newW - pipSizeStart.w);
  } else if (pipResizeCorner === "nw") {
    newW = Math.min(MAX_WIDTH, Math.max(PIP_MIN_WIDTH, pipSizeStart.w - dx));
    newX = pipPosStart.x - (newW - pipSizeStart.w);
    const newH = newW * (9 / 16);
    newY = pipPosStart.y - (newH - pipSizeStart.h);
  }

  if (newX < 0) {
    newW += newX;
    newX = 0;
  } else if (newX > window.innerWidth - newW) {
    newW = window.innerWidth - newX;
  }

  const newH = newW * (9 / 16);
  if (newY < 0) newY = 0;

  pipSize = { width: newW, height: newH };
  if (pipResizeCorner !== "se") {
    pipPos = { x: newX, y: newY };
  }
  applyPipTransform();
}

// ---------------------------------------------------------------
// PiP suggestion modal (mirrors App.tsx's showPipSuggestion)
// ---------------------------------------------------------------

function showPipSuggestionModal() {
  const modal = getId("pipSuggestionModal");
  if (!modal) return;
  ensurePipSuggestionInteractions();
  modal.style.display = "flex";
  if (window.lucide) window.lucide.createIcons({ root: modal });
}

function hidePipSuggestionModal() {
  const modal = getId("pipSuggestionModal");
  if (modal) modal.style.display = "none";
}

function ensurePipSuggestionInteractions() {
  const modal = getId("pipSuggestionModal");
  if (!modal || modal.dataset.pipSuggestionReady) return;
  modal.dataset.pipSuggestionReady = "1";

  getId("pipSuggestionLaterBtn")?.addEventListener("click", () => {
    hidePipSuggestionModal();
  });
  getId("pipSuggestionOpenBtn")?.addEventListener("click", () => {
    hidePipSuggestionModal();
    togglePagePip("open");
  });
}

// ---------------------------------------------------------------
// Generic confirm/warn popup ("PP") - same visual component as the PiP
// suggestion modal above, reused for mic/cam permission warnings and
// screen-share/leave-call confirmations.
// ---------------------------------------------------------------

/**
 * Show the generic "PP" popup.
 * @param {object} opts
 * @param {string} opts.icon lucide icon name
 * @param {"default"|"warn"|"danger"} [opts.variant] icon color variant
 * @param {string} opts.title
 * @param {string} opts.desc
 * @param {string} [opts.confirmText]
 * @param {string} [opts.cancelText]
 * @param {boolean} [opts.hideCancel] hide the cancel button (info-only popup)
 * @param {Function} [opts.onConfirm]
 * @param {Function} [opts.onCancel]
 */
function showPP({
  icon,
  variant = "default",
  title,
  desc,
  confirmText = "Đồng ý",
  cancelText = "Hủy",
  hideCancel = false,
  onConfirm = null,
  onCancel = null,
}) {
  const modal = getId("ppModal");
  if (!modal) return;

  const iconWrap = getId("ppIconWrap");
  const iconEl = getId("ppIcon");
  iconWrap.className =
    "pip-suggestion-icon" + (variant !== "default" ? ` icon-${variant}` : "");
  iconEl.setAttribute("data-lucide", icon);

  getId("ppTitle").textContent = title;
  getId("ppDesc").textContent = desc;

  // Re-clone the buttons each time so previous calls' listeners never stack.
  const oldConfirm = getId("ppConfirmBtn");
  const oldCancel = getId("ppCancelBtn");
  const confirmBtn = oldConfirm.cloneNode(true);
  const cancelBtn = oldCancel.cloneNode(true);
  oldConfirm.replaceWith(confirmBtn);
  oldCancel.replaceWith(cancelBtn);

  confirmBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;
  cancelBtn.style.display = hideCancel ? "none" : "";

  confirmBtn.addEventListener("click", () => {
    hidePP();
    if (onConfirm) onConfirm();
  });
  cancelBtn.addEventListener("click", () => {
    hidePP();
    if (onCancel) onCancel();
  });

  modal.style.display = "flex";
  if (window.lucide) window.lucide.createIcons({ root: modal });
}

function hidePP() {
  const modal = getId("ppModal");
  if (modal) modal.style.display = "none";
}

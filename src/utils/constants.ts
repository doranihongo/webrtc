// src/utils/constants.ts
import { getRoomDuration, getRoomId, getPeerName, getPeerAvatar, getScreenEnabled, getNotify, getChat, getPeerToken, getHideMeActive, checkWebRTCSupported, getId, getQs, getUUID } from './mediaHelpers.ts';

declare var UAParser: any;
declare var LocalStorage: any;


export const images = {
  caption: "../images/caption.png",
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
};
export const className = {
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
  privacy: "far fa-circle",
  pinUnpin: "fas fa-map-pin",
  mirror: "fas fa-arrow-right-arrow-left",
  zoomIn: "fas fa-magnifying-glass-plus",
  zoomOut: "fas fa-magnifying-glass-minus",
  fullScreen: "fas fa-expand",
  fsOn: "fas fa-compress-alt",
  fsOff: "fas fa-expand-alt",
  msgPrivate: "fas fa-paper-plane",
  geoLocation: "fas fa-location-dot",
  shareFile: "fas fa-upload",
  shareVideoAudio: "fab fa-youtube",
  kickOut: "fas fa-sign-out-alt",
  chatOn: "fas fa-comment",
  chatOff: "fas fa-comment",
  ghost: "fas fa-ghost",
  undo: "fas fa-undo",
  captionOn: "fas fa-closed-captioning",
  trash: "fas fa-trash",
  copy: "fas fa-copy",
  speech: "fas fa-volume-high",
  heart: "fas fa-heart",
  pip: "fas fa-images",
  hideAll: "fas fa-eye",
  up: "fas fa-chevron-up",
  down: "fas fa-chevron-down",
};
export const icons = {
  lock: '<i class="fas fa-lock"></i>',
  unlock: '<i class="fas fa-lock-open"></i>',
  pitchBar: '<i class="fas fa-microphone-lines"></i>',
  sounds: '<i class="fas fa-music"></i>',
  share: '<i class="fas fa-share-alt"></i>',
  user: '<i class="fas fa-user"></i>',
  fileSend: '<i class="fas fa-file-export"></i>',
  fileReceive: '<i class="fas fa-file-import"></i>',
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
export const fileSharingInput = "*";
export const Base64Prefix = "data:application/pdf;base64,";
export const wbPdfInput = "application/pdf";
export const wbImageInput = "image/*";
export const wbReferenceWidth = 1920;
export const wbReferenceHeight = 1080;
export const isWebRTCSupported = checkWebRTCSupported();
export const userAgent = navigator.userAgent;
export const parser = new UAParser(userAgent);
export const parserResult = parser.getResult();
export const deviceType = parserResult.device.type || "desktop";
export const isMobileDevice = deviceType === "mobile";
export const isMobileSafari =
  isMobileDevice && parserResult.browser.name.toLowerCase().includes("safari");
export const isTabletDevice = deviceType === "tablet";
export const isIPadDevice = parserResult.device.model?.toLowerCase() === "ipad";
export const isDesktopDevice = deviceType === "desktop";
export const osName = parserResult.os.name;
export const osVersion = parserResult.os.version;
export const browserName = parserResult.browser.name;
export const browserVersion = parserResult.browser.version;
export const isFirefox = browserName.toLowerCase().includes("firefox");
export const peerInfo = {
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
export const thisInfo = (() => {
  try {
    const filterUnknown = (obj) => {
      const filtered = {};
      for (const [key, value] of Object.entries(obj || {})) {
        if (value && value !== "Unknown") {
          filtered[key] = value;
        }
      }
      return filtered;
    };
    return {
      browser: filterUnknown(parserResult?.browser),
      cpu: filterUnknown(parserResult?.cpu),
      device: filterUnknown(parserResult?.device),
      engine: filterUnknown(parserResult?.engine),
      os: filterUnknown(parserResult?.os),
    };
  } catch (err) {
    return {};
  }
})();
export const lS = new LocalStorage();
export const localStorageSettings = lS.getObjectLocalStorage("P2P_SETTINGS");
export const lsSettings = { ...lS.P2P_SETTINGS, ...(localStorageSettings || {}) };
export const isEmbedded = window.self !== window.top;
export const showVideoPipBtn = document.pictureInPictureEnabled;
export const showDocumentPipBtn = !isEmbedded && "documentPictureInPicture" in window;
export const isRulesActive = true;
export const forceCamMaxResolutionAndFps = false;
export const useAvatarSvg = true;
export const ZOOM_CENTER_MODE = false;
export const ZOOM_IN_OUT_ENABLED = true;
export const chunkSize = 1024;
export const myRoomId = getId("myRoomId");
export const roomSessionDuration = getRoomDuration();
export const roomId = getRoomId();
export const myRoomUrl = window.location.origin + "/join/" + roomId;
export const extraInfo = getId("extraInfo");


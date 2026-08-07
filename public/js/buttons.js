"use strict";

/**
 * Configuration for controlling the visibility of buttons in the MiroTalk P2P client.
 * Set properties to true to show the corresponding buttons, or false to hide them.
 * captionBtn, showSwapCameraBtn, showScreenShareBtn, showFullScreenBtn, showVideoPipBtn, showDocumentPipBtn -> (auto-detected).
 */
let buttons = {
  main: {
    showShareQr: true,
    showShareRoomBtn: false, // For guests
    showHideMeBtn: true,
    showFullScreenBtn: true,
    showAudioBtn: true,
    showVideoBtn: true,
    showScreenBtn: true, // autodetected
    showRecordStreamBtn: true,
    showChatRoomBtn: true,
    showParticipantsBtn: true,
    showMyHandBtn: true,
    showDocumentPipBtn: true,
    showMySettingsBtn: true,
    showAboutBtn: true, // Please keep me always true, Thank you!
    showExtraBtn: true,
  },
  chat: {
    showMaxBtn: true,
    showShareVideoAudioBtn: true,
    showParticipantsBtn: true,
  },
  caption: {
    showTogglePinBtn: true,
    showMaxBtn: true,
  },
  settings: {
    showMicOptionsBtn: true,
    showTabRoomPeerName: true,
    showTabRoomParticipants: true,
    showTabRoomSecurity: true,
    showTabEmailInvitation: true,
    showLockRoomBtn: true,
    showUnlockRoomBtn: true,
    customNoiseSuppression: true,
  },
  remote: {
    audioBtnClickAllowed: true,
    videoBtnClickAllowed: true,
    showVideoPipBtn: true,
    showKickOutBtn: true,
    showShareVideoAudioBtn: true,
    showGeoLocationBtn: true,
  },
  local: {
    showVideoPipBtn: true,
  },
};

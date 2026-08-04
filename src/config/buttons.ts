/**
 * buttons.ts
 *
 * Configuration for controlling the visibility of buttons in the MiroTalk P2P client.
 * Set properties to true to show the corresponding buttons, or false to hide them.
 * captionBtn, showSwapCameraBtn, showScreenShareBtn, showFullScreenBtn, showVideoPipBtn,
 * showDocumentPipBtn -> (auto-detected).
 *
 * Pure config data — no behavior changed from the original `buttons.js`.
 * Ported to a typed ES6 module so it can be imported directly in App.tsx
 * (and get autocomplete/type-checking on every flag).
 *
 * Usage in App.tsx:
 *   import { buttons } from './buttons';
 *   if (buttons.main.showAudioBtn) { ... }
 */

export interface MainButtonsConfig {
  showShareQr: boolean;
  showShareRoomBtn: boolean; // For guests
  showHideMeBtn: boolean;
  showFullScreenBtn: boolean;
  showAudioBtn: boolean;
  showVideoBtn: boolean;
  showScreenBtn: boolean; // autodetected
  showRecordStreamBtn: boolean;
  showChatRoomBtn: boolean;
  showParticipantsBtn: boolean;
  showCaptionRoomBtn: boolean;
  showRoomEmojiPickerBtn: boolean;
  showMyHandBtn: boolean;
  showFileShareBtn: boolean;
  showDocumentPipBtn: boolean;
  showMySettingsBtn: boolean;
  showAboutBtn: boolean; // Please keep me always true, Thank you!
  showExtraBtn: boolean;
}

export interface ChatButtonsConfig {
  showTogglePinBtn: boolean;
  showMaxBtn: boolean;
  showSaveMessageBtn: boolean;
  showMarkDownBtn: boolean;
  showFileShareBtn: boolean;
  showShareVideoAudioBtn: boolean;
  showParticipantsBtn: boolean;
}

export interface CaptionButtonsConfig {
  showTogglePinBtn: boolean;
  showMaxBtn: boolean;
}

export interface SettingsButtonsConfig {
  showActiveRoomsBtn: boolean;
  showMicOptionsBtn: boolean;
  showTabRoomPeerName: boolean;
  showTabRoomParticipants: boolean;
  showTabRoomSecurity: boolean;
  showTabEmailInvitation: boolean;
  showCaptionEveryoneBtn: boolean;
  showMuteEveryoneBtn: boolean;
  showHideEveryoneBtn: boolean;
  showEjectEveryoneBtn: boolean;
  showLockRoomBtn: boolean;
  showUnlockRoomBtn: boolean;
  showShortcutsBtn: boolean;
  customNoiseSuppression: boolean;
}

export interface RemoteButtonsConfig {
  showAudioVolume: boolean;
  audioBtnClickAllowed: boolean;
  videoBtnClickAllowed: boolean;
  showVideoPipBtn: boolean;
  showKickOutBtn: boolean;
  showFileShareBtn: boolean;
  showShareVideoAudioBtn: boolean;
  showGeoLocationBtn: boolean;
  showPrivateMessageBtn: boolean;
  showZoomInOutBtn: boolean;
  showVideoFocusBtn: boolean;
}

export interface LocalButtonsConfig {
  showVideoPipBtn: boolean;
  showVideoCircleBtn: boolean;
  showZoomInOutBtn: boolean;
  showVideoFocusBtn: boolean;
}

export interface ButtonsConfig {
  main: MainButtonsConfig;
  chat: ChatButtonsConfig;
  caption: CaptionButtonsConfig;
  settings: SettingsButtonsConfig;
  remote: RemoteButtonsConfig;
  local: LocalButtonsConfig;
}

export const buttons: ButtonsConfig = {
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
    showCaptionRoomBtn: true,
    showRoomEmojiPickerBtn: true,
    showMyHandBtn: true,
    showFileShareBtn: false,
    showDocumentPipBtn: true,
    showMySettingsBtn: true,
    showAboutBtn: true, // Please keep me always true, Thank you!
    showExtraBtn: true,
  },
  chat: {
    showTogglePinBtn: true,
    showMaxBtn: true,
    showSaveMessageBtn: true,
    showMarkDownBtn: true,
    showFileShareBtn: false,
    showShareVideoAudioBtn: true,
    showParticipantsBtn: true,
  },
  caption: {
    showTogglePinBtn: true,
    showMaxBtn: true,
  },
  settings: {
    showActiveRoomsBtn: true,
    showMicOptionsBtn: true,
    showTabRoomPeerName: true,
    showTabRoomParticipants: true,
    showTabRoomSecurity: true,
    showTabEmailInvitation: true,
    showCaptionEveryoneBtn: true,
    showMuteEveryoneBtn: true,
    showHideEveryoneBtn: true,
    showEjectEveryoneBtn: true,
    showLockRoomBtn: true,
    showUnlockRoomBtn: true,
    showShortcutsBtn: true,
    customNoiseSuppression: true,
  },
  remote: {
    showAudioVolume: true,
    audioBtnClickAllowed: true,
    videoBtnClickAllowed: true,
    showVideoPipBtn: true,
    showKickOutBtn: true,
    showFileShareBtn: false,
    showShareVideoAudioBtn: true,
    showGeoLocationBtn: true,
    showPrivateMessageBtn: true,
    showZoomInOutBtn: false,
    showVideoFocusBtn: false,
  },
  local: {
    showVideoPipBtn: true,
    showVideoCircleBtn: true,
    showZoomInOutBtn: false,
    showVideoFocusBtn: false,
  },
};

export default buttons;

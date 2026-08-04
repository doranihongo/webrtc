/**
 * localStorage.ts
 *
 * TypeScript ES6 module port of the vanilla `LocalStorage` class.
 * Logic is preserved 1:1 with the original — including its existing
 * quirks (see NOTE comments below) — so behavior does not change.
 *
 * Usage in App.tsx:
 *
 *   import { localStorageService } from './localStorage';
 *   // or: import { LocalStorage } from './localStorage';
 *
 *   const settings = localStorageService.getSettings();
 *   localStorageService.setInitConfig(localStorageService.MEDIA_TYPE.audio, false);
 */

export type MediaKind = "audio" | "video" | "speaker";

export interface MediaTypeMap {
  audio: "audio";
  video: "video";
  speaker: "speaker";
}

export interface P2PInitConfig {
  audio: boolean;
  video: boolean;
}

export interface P2PSettings {
  share_on_join: boolean;
  show_chat_on_msg: boolean;
  transcript_show_on_msg: boolean;
  transcript_send_to_all: boolean;
  speech_in_msg: boolean;
  pin_chat_by_default: boolean;
  mic_noise_suppression: boolean; // Noise suppression using RNNoise
  video_fps: number; // default 30fps
  screen_fps: number; // default 30fps
  pitch_bar: boolean;
  sounds: boolean;
  keep_buttons_visible: boolean;
  keyboard_shortcuts: boolean;
  video_obj_fit: number; // cover
  theme: number; // dark
  theme_color: string; // custom theme color
  theme_custom: boolean; // keep custom theme
  buttons_bar: number; // vertical
  pin_grid: number; // vertical
  peer_avatar: string; // persisted avatar URL
}

export interface DevicesCount {
  audio: number;
  speaker: number;
  video: number;
}

export interface DeviceEntry {
  count: number;
  index: number;
  select: string | null;
}

export interface LocalStorageDevices {
  audio: DeviceEntry;
  speaker: DeviceEntry;
  video: DeviceEntry;
}

export class LocalStorage {
  MEDIA_TYPE: MediaTypeMap;
  P2P_INIT_CONFIG: P2PInitConfig;
  P2P_SETTINGS: P2PSettings;
  DEVICES_COUNT: DevicesCount;
  LOCAL_STORAGE_DEVICES: LocalStorageDevices;

  constructor() {
    this.MEDIA_TYPE = {
      audio: "audio",
      video: "video",
      speaker: "speaker",
    };

    this.P2P_INIT_CONFIG = {
      audio: true,
      video: true,
    };

    this.P2P_SETTINGS = {
      share_on_join: true,
      show_chat_on_msg: true,
      transcript_show_on_msg: true,
      transcript_send_to_all: true,
      speech_in_msg: false,
      pin_chat_by_default: false,
      mic_noise_suppression: true, // Noise suppression using RNNoise
      video_fps: 1, // default 30fps
      screen_fps: 1, // default 30fps
      pitch_bar: true,
      sounds: true,
      keep_buttons_visible: false,
      keyboard_shortcuts: false,
      video_obj_fit: 2, // cover
      theme: 0, // dark
      theme_color: "#000000", // custom theme color
      theme_custom: false, // keep custom theme
      buttons_bar: 0, // vertical
      pin_grid: 0, // vertical
      peer_avatar: "", // persisted avatar URL
    };

    this.DEVICES_COUNT = {
      audio: 0,
      speaker: 0,
      video: 0,
    };

    this.LOCAL_STORAGE_DEVICES = {
      audio: {
        count: 0,
        index: 0,
        select: null,
      },
      speaker: {
        count: 0,
        index: 0,
        select: null,
      },
      video: {
        count: 0,
        index: 0,
        select: null,
      },
    };
  }

  // ####################################################
  // SET LOCAL STORAGE
  // ####################################################

  setItemLocalStorage(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  setObjectLocalStorage(name: string, object: unknown): void {
    localStorage.setItem(name, JSON.stringify(object));
  }

  setSettings(settings: P2PSettings): void {
    this.P2P_SETTINGS = settings;
    this.setObjectLocalStorage("P2P_SETTINGS", this.P2P_SETTINGS);
  }

  setInitConfig(type: MediaKind, status: boolean): void {
    switch (type) {
      case this.MEDIA_TYPE.audio:
        this.P2P_INIT_CONFIG.audio = status;
        break;
      case this.MEDIA_TYPE.video:
        this.P2P_INIT_CONFIG.video = status;
        break;
      default:
        break;
    }
    this.setObjectLocalStorage("P2P_INIT_CONFIG", this.P2P_INIT_CONFIG);
  }

  setLocalStorageDevices(type: MediaKind, index: number, select: string | null): void {
    switch (type) {
      case this.MEDIA_TYPE.audio:
        this.LOCAL_STORAGE_DEVICES.audio.count = this.DEVICES_COUNT.audio;
        this.LOCAL_STORAGE_DEVICES.audio.index = index;
        this.LOCAL_STORAGE_DEVICES.audio.select = select;
        break;
      case this.MEDIA_TYPE.video:
        this.LOCAL_STORAGE_DEVICES.video.count = this.DEVICES_COUNT.video;
        this.LOCAL_STORAGE_DEVICES.video.index = index;
        this.LOCAL_STORAGE_DEVICES.video.select = select;
        break;
      case this.MEDIA_TYPE.speaker:
        this.LOCAL_STORAGE_DEVICES.speaker.count = this.DEVICES_COUNT.speaker;
        this.LOCAL_STORAGE_DEVICES.speaker.index = index;
        this.LOCAL_STORAGE_DEVICES.speaker.select = select;
        break;
      default:
        break;
    }
    this.setObjectLocalStorage("LOCAL_STORAGE_DEVICES", this.LOCAL_STORAGE_DEVICES);
  }

  // ####################################################
  // GET LOCAL STORAGE
  // ####################################################

  getInitConfig(): P2PInitConfig {
    return this.getObjectLocalStorage("P2P_INIT_CONFIG") as P2PInitConfig;
  }

  getSettings(): P2PSettings {
    return this.getObjectLocalStorage("P2P_SETTINGS") as P2PSettings;
  }

  getLocalStorageDevices(): LocalStorageDevices {
    return this.getObjectLocalStorage("LOCAL_STORAGE_DEVICES") as LocalStorageDevices;
  }

  // NOTE: preserved as-is from the original — this method does not
  // `return` the value (same as the source file). Kept unchanged to
  // guarantee 100% identical behavior; use getObjectLocalStorage or
  // localStorage.getItem directly if you need the raw string value.
  getItemLocalStorage(key: string): void {
    localStorage.getItem(key);
  }

  getObjectLocalStorage(name: string): unknown {
    const raw = localStorage.getItem(name);
    return JSON.parse(raw as string);
  }
}

// Singleton instance mirroring how the original vanilla-JS class was
// typically used (one shared instance holding in-memory config that's
// mirrored to localStorage). Import this directly, or import the
// `LocalStorage` class if you need a fresh/isolated instance instead.
export const localStorageService = new LocalStorage();

export default localStorageService;

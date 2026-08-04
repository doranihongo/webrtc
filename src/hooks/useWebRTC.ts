// @ts-nocheck
import axios from "axios";
import { io } from "socket.io-client";
import { useState, useEffect, useRef } from 'react';
import { getPeerInfo, getInfo, getRoomId, getRoomDuration, timeToMilliseconds, isValidDuration, makeId, getUUID, getNotify, getChat, getPeerToken, getPeerName, generateRandomName, getPeerAvatar, getScreenEnabled, getHideMeActive, getQueryParam, filterXSS, checkWebRTCSupported, isValidAvatarURL, isHtml } from '../utils/mediaHelpers';
import { images, className, icons, fileSharingInput, Base64Prefix, wbPdfInput, wbImageInput, wbReferenceWidth, wbReferenceHeight, isWebRTCSupported, userAgent, parser, parserResult, deviceType, isMobileDevice, isMobileSafari, isTabletDevice, isIPadDevice, isDesktopDevice, osName, osVersion, browserName, browserVersion, isFirefox, peerInfo, thisInfo, lS, localStorageSettings, lsSettings, isEmbedded, showVideoPipBtn, showDocumentPipBtn, isRulesActive, forceCamMaxResolutionAndFps, useAvatarSvg, ZOOM_CENTER_MODE, ZOOM_IN_OUT_ENABLED, chunkSize, myRoomId, roomSessionDuration, roomId, myRoomUrl, extraInfo } from '../utils/constants';

export function useWebRTC() {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [isEngineReady, setIsEngineReady] = useState(false);

  const initialized = useRef(false);
  const engineRef = useRef<any>({});

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Local state variables for closure
    let myPeerName = null;
    let set_myPeerName = (v) => myPeerName = v;

    let myPeerAvatar = null;
    let set_myPeerAvatar = (v) => myPeerAvatar = v;

    let myPeerId = null;
    let set_myPeerId = (v) => myPeerId = v;

    let myPeerUUID = null;
    let set_myPeerUUID = (v) => myPeerUUID = v;

    let myToken = null;
    let set_myToken = (v) => myToken = v;

    let isPresenter = false;
    let set_isPresenter = (v) => isPresenter = v;

    let myHandStatus = false;
    let set_myHandStatus = (v) => myHandStatus = v;

    let myVideoStatus = true;
    let set_myVideoStatus = (v) => myVideoStatus = v;

    let myAudioStatus = true;
    let set_myAudioStatus = (v) => myAudioStatus = v;

    let myScreenStatus = false;
    let set_myScreenStatus = (v) => myScreenStatus = v;

    let isScreenEnabled = false;
    let set_isScreenEnabled = (v) => isScreenEnabled = v;

    let notify = true;
    let set_notify = (v) => notify = v;

    let chat = true;
    let set_chat = (v) => chat = v;

    let notifyBySound = true;
    let set_notifyBySound = (v) => notifyBySound = v;

    let isPeerReconnected = false;
    let set_isPeerReconnected = (v) => isPeerReconnected = v;

    let useAudio = true;
    let set_useAudio = (v) => useAudio = v;

    let useVideo = true;
    let set_useVideo = (v) => useVideo = v;

    let isEnumerateVideoDevices = false;
    let set_isEnumerateVideoDevices = (v) => isEnumerateVideoDevices = v;

    let isEnumerateAudioDevices = false;
    let set_isEnumerateAudioDevices = (v) => isEnumerateAudioDevices = v;

    let isScreenStreaming = false;
    let needToCreateOfferByPeer = {};
    let isStreamRecording = false;
    let isVideoPrivacyActive = false;
    let thisRoomPassword = null; 
    let buttons = {};
    let videoMaxFrameRate = 30;

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

    function getVideoConstraints(videoQuality) {
      const frameRate = videoMaxFrameRate || 30;
      const resolutionMap = getResolutionMap();
      let width = 1280;
      let height = 720;
      if (videoQuality === "default") {
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
      return constraints;
    }

    function getAudioConstraints(deviceId = null) {
      const useBuiltInNoiseSuppression = !buttons?.settings?.customNoiseSuppression || !isRNNoiseSupported;
      const audioConstraints = {
        echoCancellation: isMobileDevice ? { ideal: true } : true,
        autoGainControl: isMobileDevice ? { ideal: true } : true,
        noiseSuppression: useBuiltInNoiseSuppression,
      };
      if (deviceId) {
        if (isMobileSafari) {
          // ignore
        } else if (isMobileDevice) {
          audioConstraints.deviceId = { ideal: deviceId };
        } else {
          audioConstraints.deviceId = { exact: deviceId };
        }
      }
      return { audio: audioConstraints };
    }



    // Start of webrtc-core.js code
    
    /**
     * webrtc-core.js
     * ---------------------------------------------------------
     * Bước 1: tách STATE (kết nối + stream) và các hàm LOGIC THUẦN
     * (không đụng DOM) ra khỏi client.js.
     * File này KHÔNG dùng module import/export - vẫn là script
     * thường, dùng chung global scope với client.js (đúng kiến trúc
     * hiện tại). Nhớ load file này TRƯỚC client.js trong HTML:
     *
     *   <script src="webrtc-core.js"></script>
     *   <script src="client.js"></script>
     *
     * Mỗi khối bên dưới ghi rõ số dòng gốc trong client.js để đối chiếu.
     * ---------------------------------------------------------
     */
    
    // ===== [MOVED FROM client.js: line 424-442] STATE_BLOCK_connection_and_stream =====
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
    let camera = "user"; // [MOVED FROM client.js: line 459] user = front-facing camera on a smartphone. | environment = the back camera on a smartphone.
    
    // ===== [MOVED FROM client.js: line 1141-1144] thereArePeerConnections =====
    function thereArePeerConnections() {
      if (Object.keys(peerConnections).length === 0) return false;
      return true;
    }
    
    // ===== [MOVED FROM client.js: line 1261-1263] sendToServer =====
    async function sendToServer(msg, config = {}) {
      await signalingSocket.emit(msg, config);
    }
    
    // ===== [EXTENSION POINTS] Điểm nối UI - do client.js (hoặc sau này 1 React hook) gán =====
    // handleConnect() KHÔNG được gọi thẳng hàm UI nữa. Thay vào đó nó gọi qua 2 "hook" dưới đây.
    // Mặc định là no-op để file này vẫn chạy độc lập/test được kể cả khi chưa ai gán hook.
    var onReconnected = function () {}; // gọi mỗi lần signaling socket connect (kể cả reconnect)
    var onFirstLocalMediaReady = async function () {}; // gọi 1 lần duy nhất, sau khi setup xong local media lần đầu (chưa từng join)
    var onJoinedChannel = function () {}; // gọi ngay sau khi đã emit "join" lên server thành công (setup UI phòng họp: nút bấm, QR code...)
    var onIceCandidateInfo = function (info) {}; // gọi mỗi khi có ICE candidate mới hợp lệ. info = { type, addressInfo, candidate }
    var onIceCandidateError = function (info) {}; // gọi khi có lỗi ICE candidate. info = { url, errorText }
    var onDisconnected = function (peerIds, reason) {}; // gọi sau khi đã đóng + reset xong toàn bộ peer connections trong bộ nhớ do mất kết nối signaling server; cần dọn UI/DOM cho các peer_id này
    var onPeerRemoved = function(peer_id) { setPeers(prev => { const next = {...prev}; delete next[peer_id]; return next; }); }; // gọi sau khi đã đóng peer connection + xóa state ngầm cho 1 peer_id (server báo removePeer); cần dọn UI/DOM tương ứng
    var getSelectedVideoQuality = function () { return "default"; }; // client.js gán để đọc videoQualitySelect.value (thay vì changeLocalCamera đọc DOM trực tiếp)
    var onCameraSwitchStart = function () {}; // gọi ngay khi bắt đầu đổi camera, trước getUserMedia (show spinner)
    var onCameraSwitchEnd = function () {}; // gọi khi luồng đổi camera kết thúc, dù thành công hay thất bại (hide spinner) - tương đương finally
    var onLocalCameraStreamReady = function(camStream) { setLocalStream(camStream); }; // gọi khi đã có stream camera mới, cần gán vào <video> element
    var onCameraSwitchError = function (err) {}; // gọi khi đổi camera thất bại hoàn toàn (cả getUserMedia chính lẫn fallback đều lỗi)
    var onLocalMicrophoneStreamReady = function (micStream) {}; // gọi khi đã có stream mic mới, cần gán vào <audio> element
    var onMicrophoneSwitchError = function (err) {}; // gọi khi đổi mic thất bại
    var onMediaError = function (mediaType, err, errMessage) {}; // gọi khi getUserMedia thất bại hoàn toàn (video hoặc audio) - cần phát âm thanh cảnh báo + hiện popup cho người dùng, TRƯỚC khi handleMediaError throw Error để dừng luồng setup
    var onRtcOfferError = function (err) {}; // gọi khi pc.setLocalDescription() thất bại lúc tạo RTC offer
    var onRtcAnswerError = function (err) {}; // gọi khi pc.setLocalDescription() thất bại lúc tạo RTC answer
    var onCameraSwapped = function () {}; // gọi khi swapCamera hoàn tất thành công
    
    var onNoiseSuppressionNotSupported = function () {}; // gọi khi device không support RNNoise
    var onNoiseSuppressionFailed = function (message) {}; // gọi khi enable noise suppression thất bại
    
    var onLocalMaxFpsSuccess = function (type, track) {};
    var onLocalMaxFpsError = function (type, err) {};
    var onLocalVideoQualitySuccess = function (track) {};
    var onLocalVideoQualityError = function (err) {};
    var getSelectedVideoQuality = function () { return "default"; };
    
    // ===== [MOVED FROM client.js: line 5889-5923] setLocalMaxFps =====
    async function setLocalMaxFps(maxFrameRate, type = "camera") {
      if (!useVideo || isFirefox) return;
    
      const videoTrack = getVideoTrack(localVideoMediaStream);
      const screenTrack = getVideoTrack(localScreenMediaStream);
    
      if (!videoTrack && !screenTrack) return;
    
      (isScreenStreaming ? screenTrack : videoTrack)
        .applyConstraints({ frameRate: maxFrameRate })
        .then(() => {
          onLocalMaxFpsSuccess(type, videoTrack ? localVideoMediaStream : localScreenMediaStream);
        })
        .catch((err) => {
          console.error("setLocalMaxFps", err);
          onLocalMaxFpsError(type, err);
        });
    }
    
    // ===== [MOVED FROM client.js: line 5925-5956] setLocalVideoQuality =====
    async function setLocalVideoQuality() {
      const videoTrack = getVideoTrack(localVideoMediaStream);
      const screenTrack = getVideoTrack(localScreenMediaStream);
    
      if (!videoTrack && !screenTrack) return;
    
      const videoQuality = getSelectedVideoQuality();
      const videoConstraints = getVideoConstraints(videoQuality);
    
      (isScreenStreaming ? screenTrack : videoTrack)
        .applyConstraints(videoConstraints)
        .then(() => {
          onLocalVideoQualitySuccess(videoTrack ? localVideoMediaStream : localScreenMediaStream);
        })
        .catch((err) => {
          console.error("setLocalVideoQuality", err);
          onLocalVideoQualityError(err);
        });
    }
    
    // ===== [MOVED FROM client.js: line 1167-1227] initClientPeer =====
    async function initClientPeer() {
      if (!isWebRTCSupported) {
        return onWebRTCNotSupported();
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
      signalingSocket.on("disconnect", handleDisconnect);
      signalingSocket.on("removePeer", handleRemovePeer);
    } // end [initClientPeer]
    
    // ===== [MOVED FROM client.js: line 1286-1318] handleConnect (đã tách UI ra 2 hook ở trên) =====
    async function handleConnect() {
      console.log("03. Connected to signaling server");
    
      onReconnected();
      set_myPeerId(signalingSocket.id);
      console.log("04. My peer id [ " + myPeerId + " ]");
    
      await getButtons();
    
      // If reconnecting, force rejoin to properly sync with other peers
      if (localVideoMediaStream && localAudioMediaStream) {
        await joinToChannel();
      } else {
        await initEnumerateDevices();
        await setupLocalVideoMedia();
        await setupLocalAudioMedia();
        // Create camera tile (even if no camera, to show avatar)
        if (!useVideo || (!useVideo && !useAudio)) {
          await loadLocalMedia(new MediaStream(), "video");
        }
        await onFirstLocalMediaReady();
      }
    }
    
    // ===== [MOVED FROM client.js: line 2347-2367] joinToChannel (đã tách UI ra hook onJoinedChannel) =====
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
        peer_privacy_status: isVideoPrivacyActive,
        userAgent: userAgent,
      });
      onJoinedChannel();
    }
    
    // ===== [MOVED FROM client.js: line 1489-1509] getButtons =====
    // Get Buttons config from server side and apply to current client.
    // Phụ thuộc `buttons` (biến config toàn cục) và `mergeConfig()` - cả 2 vẫn đang ở client.js,
    // hoạt động bình thường vì 2 file share chung global scope (xem đầu file).
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
    
    // ===== [MOVED FROM client.js: line 1806-1816] checkUserName =====
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
    
    // ===== [MOVED FROM client.js: line 2062-2095] initRNNoiseSuppression =====
    async function initRNNoiseSuppression() {
      if (typeof RNNoiseProcessor === "undefined") {
        console.warn(
          "RNNoiseProcessor class is not available (script not loaded).",
        );
        onNoiseSuppressionNotSupported();
        return;
      }
    
      if (!RNNoiseProcessor.isSupported()) {
        console.warn(
          "RNNoise: AudioWorklet or WebAssembly not supported on this device, skipping.",
        );
        onNoiseSuppressionNotSupported();
        return;
      }
    
      const supports48k = await RNNoiseProcessor.isSampleRateSupported();
      if (!supports48k) {
        console.warn(
          "RNNoise: device does not support 48 kHz sample rate, skipping.",
        );
        onNoiseSuppressionNotSupported();
        return;
      }
    
      console.log("RNNoise: processor is supported.");
      isRNNoiseSupported = true;
    }
    
    // ===== [MOVED FROM client.js: line 2111-2167] enableNoiseSuppression =====
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
        onNoiseSuppressionNotSupported();
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
          onNoiseSuppressionFailed("Noise suppression is not supported on this device. Using default WebRTC noise suppression instead.");
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
    
    // ===== [MOVED FROM client.js: line 2177-2187] stopNoiseSuppressionPipeline =====
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
    
    // ===== [MOVED FROM client.js: line 2192-2197] restartNoiseSuppression =====
    async function restartNoiseSuppression() {
      if (!lsSettings.mic_noise_suppression) return;
      // Do not restore the old microphone stream when restarting.
      await disableNoiseSuppression(false);
      await enableNoiseSuppression();
    }
    
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
    
    // ===== [MOVED FROM client.js: line 2548-2555] emitMyPeerProfile =====
    function emitMyPeerProfile() {
      sendToServer("peerName", {
        room_id: roomId,
        peer_name_old: myPeerName,
        peer_name_new: myPeerName,
        peer_avatar: myPeerAvatar,
      });
    }
    
    // ===== [MOVED FROM client.js: line 2563-2575] handlePeersConnectionStatus =====
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
      };
    }
    
    // ===== [MOVED FROM client.js: line 2464-2519] handleOnIceCandidate (đã tách UI ra 2 hook onIceCandidateInfo/onIceCandidateError) =====
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
    
        onIceCandidateInfo({ type, addressInfo, candidate });
      };
    
      // handle ICE candidate errors
      peerConnections[peer_id].onicecandidateerror = (event) => {
        const { url, errorText } = event;
    
        console.warn("[ICE candidate] error", { url, error: errorText });
    
        onIceCandidateError({ url, errorText });
    
        //msgPopup('warning', `${url}: ${errorText}`, 'top-end', 6000);
      };
    }
    
    // ===== [EXTRACTED FROM client.js handleOnTrack: phần logic phân loại track screen-share vs camera, không đụng DOM] =====
    // Phần còn lại của handleOnTrack (gắn stream vào <video>/<audio> element) vẫn ở client.js vì chủ yếu là DOM.
    function isIncomingVideoTrackScreenShare(peerInfo, track, inboundStreamId) {
      const extras = (peerInfo && peerInfo.extras) || {};
      const label = (track && track.label) || "";
      const settings = (track && track.getSettings && track.getSettings()) || {};
    
      const isDisplayCapture =
        !!settings.displaySurface ||
        settings.mediaSource === "screen" ||
        settings.displaySurface === "monitor";
    
      const isScreenByExtras =
        extras.screen_track_id === track.id ||
        extras.screen_stream_id === inboundStreamId;
    
      const isScreenByLabel = /screen|window|monitor|display/i.test(label);
    
      const isScreenByStatus =
        peerInfo.peer_screen_status && !peerInfo.peer_video_status;
    
      return isDisplayCapture || isScreenByExtras || isScreenByLabel || isScreenByStatus;
    }
    
    // ===== [MOVED FROM client.js: line 2759-2837] handleDisconnect (đã tách UI dọn DOM ra hook onDisconnected) =====
    function handleDisconnect(reason) {
      console.log("Disconnected from signaling server", { reason: reason });
    
      const peerIds = Object.keys(peerConnections);
    
      for (const peer_id of peerIds) {
        peerConnections[peer_id].close();
      }
    
      chatDataChannels = {};
      fileDataChannels = {};
      peerConnections = {};
      pendingIceCandidates = {};
    
      // Set reconnection flag to trigger proper rejoin
      set_isPeerReconnected(true);
      console.log(
        "Set isPeerReconnected = true, will attempt to rejoin on reconnect"
      );
    
      onDisconnected(peerIds, reason);
    }
    
    // ===== [MOVED FROM client.js: line 2846-2925] handleRemovePeer (đã tách UI dọn DOM ra hook onPeerRemoved) =====
    // Khi server báo có 1 peer rời phòng: đóng peer connection + xóa state ngầm cho peer đó.
    function handleRemovePeer(config) {
      console.log("Signaling server said to remove peer:", config);
    
      const { peer_id } = config;
    
      if (peer_id in peerConnections) peerConnections[peer_id].close();
    
      delete chatDataChannels[peer_id];
      delete fileDataChannels[peer_id];
      delete peerConnections[peer_id];
      delete pendingIceCandidates[peer_id];
      delete allPeers[peer_id];
    
      onPeerRemoved(peer_id);
    }
    
    // ===== [MOVED FROM client.js: line 2737-2774] handleAddTracks =====
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
    
    // ===== [MOVED FROM client.js: line 2784-2816] handleRTCDataChannels =====
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
    
    // ===== [MOVED FROM client.js: line 2949-2968] handleIceCandidate =====
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
    
    // ===== [MOVED FROM client.js: line 2976-2980] queueIceCandidate =====
    function queueIceCandidate(peer_id, ice_candidate) {
      if (!peer_id || !ice_candidate) return;
      if (!pendingIceCandidates[peer_id]) pendingIceCandidates[peer_id] = [];
      pendingIceCandidates[peer_id].push(ice_candidate);
    }
    
    // ===== [MOVED FROM client.js: line 2987-3003] flushIceCandidates =====
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
    
    // ===== [MOVED FROM client.js: line 3196-3208] initEnumerateAudioDevices =====
    async function initEnumerateAudioDevices() {
      if (isEnumerateAudioDevices) return;
      // allow the audio
      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(async (stream) => {
          await enumerateAudioDevices(stream);
          set_useAudio(true);
        })
        .catch(() => {
          set_useAudio(false);
        });
    }
    
    // ===== [MOVED FROM client.js: line 3214-3226] initEnumerateVideoDevices =====
    async function initEnumerateVideoDevices() {
      if (isEnumerateVideoDevices) return;
      // allow the video
      await navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(async (stream) => {
          await enumerateVideoDevices(stream);
          set_useVideo(true);
        })
        .catch(() => {
          set_useVideo(false);
        });
    }
    
    // ===== [MOVED FROM client.js: line 3466-3470] getSelectedOptionText =====
    function getSelectedOptionText(selectEl) {
      if (!selectEl || !selectEl.options || selectEl.selectedIndex < 0) return "";
      const opt = selectEl.options[selectEl.selectedIndex];
      return opt && opt.text ? opt.text.trim() : "";
    }
    
    // ===== [MOVED FROM client.js: line 3477-3517] setupLocalVideoMedia =====
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
    
    // ===== [MOVED FROM client.js: line 3524-3583] setupLocalAudioMedia =====
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
    
    // ===== [MOVED FROM client.js: line 3592-3640] handleMediaError (đã tách UI ra hook onMediaError) =====
    // Bản gốc gọi playSound("alert") + msgHTML(...) TRƯỚC khi throw Error để dừng luồng setup.
    // Giữ đúng thứ tự: tính errMessage → gọi hook UI → throw. Hook chạy đồng bộ (playSound là async
    // nhưng không await ở bản gốc, msgHTML cũng không await) nên throw ngay sau vẫn đúng behavior gốc.
    function handleMediaError(mediaType, err) {
      let errMessage = err;
    
      switch (err.name) {
        case "NotFoundError":
        case "DevicesNotFoundError":
          errMessage = "Required track is missing";
          break;
        case "NotReadableError":
        case "TrackStartError":
          errMessage = "Already in use";
          break;
        case "OverconstrainedError":
        case "ConstraintNotSatisfiedError":
          errMessage = "Constraints cannot be satisfied by available devices";
          break;
        case "NotAllowedError":
        case "PermissionDeniedError":
          errMessage = "Permission denied in browser";
          break;
        case "TypeError":
          errMessage = "Empty constraints object";
          break;
        default:
          break;
      }
    
      onMediaError(mediaType, err, errMessage);
    
      /*
            it immediately stops the execution of the current function and jumps to the nearest enclosing try...catch block or, 
            if none exists, it interrupts the script execution and displays an error message in the console.
        */
      throw new Error(
        `Access denied for ${mediaType} device [${err.name}]: ${errMessage} check the common getUserMedia errors: https://blog.addpipe.com/common-getusermedia-errors/`,
      );
    }
    
    // ===== [MOVED FROM client.js: line 5704-5712] refreshMyVideoStatus =====
    function refreshMyVideoStatus(localVideoMediaStream) {
      if (!localVideoMediaStream) return;
      // check Track video status
      localVideoMediaStream.getTracks().forEach((track) => {
        if (track.kind === "video") {
          set_myVideoStatus(track.enabled);
        }
      });
    }
    
    // ===== [MOVED FROM client.js: line 5718-5726] refreshMyAudioStatus =====
    function refreshMyAudioStatus(localAudioMediaStream) {
      if (!localAudioMediaStream) return;
      // check Track audio status
      localAudioMediaStream.getTracks().forEach((track) => {
        if (track.kind === "audio") {
          set_myAudioStatus(track.enabled);
        }
      });
    }
    
    // ===== [MOVED FROM client.js: line 6788-6821] getAudioConstraints =====
    
    
    // ===== [MOVED FROM client.js: line 7453-7461] stopLocalVideoTrack =====
    async function stopLocalVideoTrack() {
      if (useVideo || !isScreenStreaming) {
        const localVideoTrack = getVideoTrack(localVideoMediaStream);
        if (localVideoTrack) {
          console.log("stopLocalVideoTrack", localVideoTrack);
          localVideoTrack.stop();
        }
      }
    }
    
    // ===== [MOVED FROM client.js: line 7466-7472] stopLocalAudioTrack =====
    async function stopLocalAudioTrack() {
      const localAudioTrack = getAudioTrack(localAudioMediaStream);
      if (localAudioTrack) {
        console.log("stopLocalAudioTrack", localAudioTrack);
        localAudioTrack.stop();
      }
    }
    
    // ===== [MOVED FROM client.js: line 7477-7482] loadScreenMedia =====
    async function loadScreenMedia() {
      // If user started screen sharing before joining, create the screen tile now
      if (myScreenStatus && localScreenMediaStream) {
        await loadLocalMedia(localScreenMediaStream, "screen");
      }
    }
    
    // ===== [MOVED FROM client.js: line 7518-7523] getScreenShareConstraints =====
    function getScreenShareConstraints() {
      return {
        audio: true,
        video: { frameRate: screenMaxFrameRate },
      };
    }
    
    // ===== [MOVED FROM client.js: line 7688-7721] mixScreenAndMicAudio =====
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
    
    // ===== [MOVED FROM client.js: line 7744-7756] getLocalScreenExtras =====
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
    
    // ===== [MOVED FROM client.js: line 2111-2197] handleAddPeer =====
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
      onPeerAdded(peer_id, peers); // UI hook
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
        onPeerTileCreationNeeded(peer_id, peers); // UI hook
      }
      
      onPeerAddedSound();
    }
    
    var getSelectedAudioInput = function () { return "default"; };
    
    var onScreenShareStarted = async function (init, displayStream) {};
    var onScreenShareStopped = async function (init) {};
    var onScreenShareStopInitCameraChange = async function () {};
    var onScreenShareStopInit = async function (useVideo, myVideoStatus) {};
    
    // ===== [MOVED FROM client.js: line 6521-6591] startScreenSharing =====
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
      set_myScreenStatus(true);
      const extras = getLocalScreenExtras();
      if (extras) {
        try {
          peerInfo.extras = { ...(peerInfo.extras || {}), ...extras };
        } catch (_) {}
        await emitPeerStatus("screen", true, extras);
      }
      if (!init) {
        emitPeersAction("screenStart", extras);
        await refreshMyStreamToPeers(undefined, true);
      }
      screenVideoTrack.onended = () => {
        if (isScreenStreaming) toggleScreenSharing(init);
      };
      await onScreenShareStarted(init, displayStream);
    }
    
    // ===== [MOVED FROM client.js: line 6592-6677] stopScreenSharing =====
    async function stopScreenSharing(init) {
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
      
      isScreenStreaming = false;
      set_myScreenStatus(false);
      if (!init) {
        emitPeersAction("screenStop");
        try {
          peerInfo.extras = {};
        } catch (_) {}
        await emitPeerStatus("screen", false, {});
        const micTrack = getAudioTrack(localAudioMediaStream);
        if (useAudio && (!micTrack || micTrack.readyState === "ended")) {
          try {
            await changeLocalMicrophone(getSelectedAudioInput());
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
      await onScreenShareStopped(init);
    }
    
    // ===== [MOVED FROM client.js: line 6853-6921] refreshMyLocalStream =====
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
            onLocalVideoMediaStreamRefreshed(localVideoMediaStream, isScreenStreaming);
          }
        }
        if (audioTrack) {
          tracksToInclude.push(audioTrack);
          localAudioMediaStream = new MediaStream([audioTrack]);
          onLocalAudioMediaStreamRefreshed(localAudioMediaStream);
        }
      } else {
        console.log("Refresh my local media stream AUDIO");
        if (useAudio && audioTrack) {
          tracksToInclude.push(audioTrack);
          localAudioMediaStream = new MediaStream([audioTrack]);
        }
      }
    }
    
    // ===== [MOVED FROM client.js: line 2498-2564] handleSessionDescription (đã tách UI ra hook) =====
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
                    onRtcAnswerError(err);
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
    
    // ===== [MOVED FROM client.js: line 7900-8007] refreshMyStreamToPeers =====
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
    
    // ===== [MOVED FROM client.js: line 8084-8088] hasAudioTrack =====
    function hasAudioTrack(mediaStream) {
      if (!mediaStream) return false;
      const audioTracks = mediaStream.getAudioTracks();
      return audioTracks.length > 0;
    }
    
    // ===== [MOVED FROM client.js: line 8095-8099] hasVideoTrack =====
    function hasVideoTrack(mediaStream) {
      if (!mediaStream) return false;
      const videoTracks = mediaStream.getVideoTracks();
      return videoTracks.length > 0;
    }
    
    // ===== [MOVED FROM client.js: line 8106-8110] getVideoTrack =====
    function getVideoTrack(mediaStream) {
      if (!mediaStream) return null;
      const tracks = mediaStream.getVideoTracks();
      return tracks.length > 0 ? tracks[0] : null;
    }
    
    // ===== [MOVED FROM client.js: line 8201-8211] getSupportedMimeTypes =====
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
    
    // ===== [MOVED FROM client.js: line 8219-8250] startStreamRecording =====
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
    
    // ===== [MOVED FROM client.js: line 8287-8327] startMobileRecording =====
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
    
    // ===== [MOVED FROM client.js: line 8684-8691] createChatDataChannel =====
    function createChatDataChannel(peer_id) {
      chatDataChannels[peer_id] = peerConnections[peer_id].createDataChannel(
        "mirotalk_chat_channel",
      );
      chatDataChannels[peer_id].onopen = (event) => {
        console.log("chatDataChannels created", event);
      };
    }
    
    // ===== [MOVED FROM client.js: line 11850-11855] checkWebRTCSupported =====
    
    
    // ===== [MOVED FROM client.js: line 1129-1131] countPeerConnections =====
    /**
     * Count the peer connections
     * @returns peer connections count
     */
    function countPeerConnections() {
      return Object.keys(peerConnections).length;
    }
    
    // ===== [MOVED FROM client.js: line 6815-6820] stopVideoTracks (đóng leak: đã được gọi trực tiếp từ webrtc-core.js trước khi có bản thân trong file này) =====
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
    
    // ===== [MOVED FROM client.js: line 6724-6729] stopAudioTracks (đóng leak tương tự stopVideoTracks) =====
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
    
    // ===== [MOVED FROM client.js: line 1240-1251] sendToDataChannel =====
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
    
    // ===== [MOVED FROM client.js: line 2498-2525] handleRtcOffer (đã tách UI ra hook onRtcOfferError) =====
    // Đóng leak: hàm này đã bị refreshMyStreamToPeers (core) gọi trực tiếp như global từ trước khi có bản thân ở đây.
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
                onRtcOfferError(err);
              });
          })
          .catch((err) => {
            console.error("[Error] sending offer", err);
          });
      };
    }
    
    // ===== [MOVED FROM client.js: line 8619-8645] emitMsg =====
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
      const getMsgIdParam = filterXSS(id);
      const getMsgId = normalizeChatMessageId(filterXSS(msgId));
    
      const chatMessage = {
        type: "chat",
        from: getFrom,
        fromAvatar: getFromAvatar,
        fromId: getFromId,
        id: getMsgIdParam,
        msg_id: getMsgId,
        to: getTo,
        msg: getMsg,
        privateMsg: getPrivateMsg,
      };
      console.log("Send msg", chatMessage);
      sendToDataChannel(chatMessage);
    }
    
    // ===== [MOVED FROM client.js: line 1906-1924] detectCameraFacingMode =====
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
    
    // ===== [MOVED FROM client.js: line 2025-2100] changeLocalCamera (đã tách UI ra hook) =====
    // UI (spinner myVideoWrap, đọc videoQualitySelect.value, gán myVideo.srcObject, báo lỗi userLog)
    // được nối qua các hook: getSelectedVideoQuality, onCameraSwitchStart/End, onLocalCameraStreamReady, onCameraSwitchError.
    // Lưu ý giữ đúng 1 chi tiết dễ nhầm của bản gốc: khi cả getUserMedia chính lẫn fallback đều lỗi,
    // lỗi báo cho người dùng là `err` (lỗi của lần gọi CHÍNH), không phải `fallbackErr` (lỗi của lần gọi fallback).
    /**
     * Change local camera by device id
     * @param {string} deviceId
     */
    async function changeLocalCamera(deviceId) {
      onCameraSwitchStart();
    
      try {
        if (localVideoMediaStream) {
          await stopVideoTracks(localVideoMediaStream);
        }
    
        // Get video constraints
        const videoConstraints = getVideoConstraints(getSelectedVideoQuality());
        videoConstraints["deviceId"] = { exact: deviceId };
        console.log("videoConstraints", videoConstraints);
    
        let camStream;
        try {
          camStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
          });
        } catch (err) {
          console.error("Error accessing local video device:", err);
          console.warn("Fallback to default constraints");
          try {
            camStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: {
                  exact: deviceId, // Specify the exact device ID you want to access
                },
              },
            });
          } catch (fallbackErr) {
            console.error(
              "Error accessing init video device with default constraints",
              fallbackErr,
            );
            onCameraSwitchError(err); // giữ nguyên hành vi gốc: dùng err ngoài, không phải fallbackErr
            return;
          }
        }
    
        await updateLocalVideoMediaStream(camStream);
      } finally {
        onCameraSwitchEnd();
      }
    
      /**
       * Update Local Video Media Stream
       * @param {MediaStream} camStream
       */
      async function updateLocalVideoMediaStream(camStream) {
        if (camStream) {
          camera = detectCameraFacingMode(camStream);
          console.log("Detect Camera facing mode", camera);
          onLocalCameraStreamReady(camStream);
          localVideoMediaStream = camStream;
          logStreamSettingsInfo("Success attached local video stream", camStream);
          await refreshMyStreamToPeers(camStream);
          setLocalMaxFps(videoMaxFrameRate);
        }
      }
    }
    
    // ===== [MOVED FROM client.js: line 6775-6810] swapCamera =====
    async function swapCamera() {
      onCameraSwitchStart();
    
      let camVideo = false;
      camera = camera == "user" ? "environment" : "user";
      camVideo = camera == "user" ? true : { facingMode: { exact: camera } };
    
      // some devices can't swap the cam, if have Video Track already in execution.
      await stopLocalVideoTrack();
    
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: camVideo,
        });
        if (camStream) {
          onLocalCameraStreamReady(camStream);
          localVideoMediaStream = camStream;
          await refreshMyStreamToPeers(camStream);
          setLocalMaxFps(videoMaxFrameRate);
          onCameraSwapped();
        }
      } catch (err) {
        onCameraSwitchError(err);
      } finally {
        onCameraSwitchEnd();
      }
    }
    
    // UI (gán myAudio.srcObject, báo lỗi userLog) được nối qua hook: onLocalMicrophoneStreamReady, onMicrophoneSwitchError.
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
    
      try {
        const micStream = await navigator.mediaDevices.getUserMedia(
          audioConstraints,
        );
        onLocalMicrophoneStreamReady(micStream);
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
      } catch (err) {
        onMicrophoneSwitchError(err);
      }
    }
    
    
    // ===== [MOVED FROM client.js: line 8532] emitPeerStatus =====
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
    
    // ===== [MOVED FROM client.js: line 8886] emitPeersAction =====
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
    
    // ===== [MOVED FROM client.js: line 8908] emitPeerAction =====
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
    
    var onPeerTrackAdded = function (peer_id, peerInfo, inbound, kind, isScreen) {
      setPeers(prev => {
        const peer = prev[peer_id] || {...peerInfo};
        // inbound is the stream
        if (isScreen) {
          peer.screenStream = inbound;
        } else if (kind === 'video') {
          peer.videoStream = inbound;
        } else if (kind === 'audio') {
          peer.audioStream = inbound;
        }
        return {...prev, [peer_id]: peer};
      });
    };
    
    // ===== [MOVED FROM client.js: line 2128-2187] handleOnTrack =====
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
        const peerInfo = peers?.[peer_id] || {}; // will use provided peers dict
        const inbound = event.streams[0];
        let isScreen = false;
        
        // Video or screen track
        if (kind === "video") {
          // Determine if the incoming video track is a screen share or camera.
          isScreen = isIncomingVideoTrackScreenShare(
            peerInfo,
            event.track,
            inbound.id,
          );
        }
        
        onPeerTrackAdded(peer_id, peerInfo, inbound, kind, isScreen);
      };
    }
    
    // ===== [MOVED FROM client.js: line 2550-2560] stopTracks =====
    async function stopTracks(stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    
    // Expose methods to the window or return them from the hook?
    // We should return the engine API.
    
    // For now, let's expose some methods to window so the component can call them.

    setIsEngineReady(true);
    engineRef.current = {
      toggleCamera: typeof changeLocalCamera !== "undefined" ? changeLocalCamera : undefined,
      initClientPeer: typeof initClientPeer !== 'undefined' ? initClientPeer : undefined,
      joinToChannel: typeof joinToChannel !== 'undefined' ? joinToChannel : undefined,
      setupLocalVideoMedia: typeof setupLocalVideoMedia !== 'undefined' ? setupLocalVideoMedia : undefined,
      setupLocalAudioMedia: typeof setupLocalAudioMedia !== 'undefined' ? setupLocalAudioMedia : undefined,
      loadScreenMedia: typeof loadScreenMedia !== 'undefined' ? loadScreenMedia : undefined,
      stopLocalVideoTrack: typeof stopLocalVideoTrack !== 'undefined' ? stopLocalVideoTrack : undefined,
      stopLocalAudioTrack: typeof stopLocalAudioTrack !== 'undefined' ? stopLocalAudioTrack : undefined,
      enableNoiseSuppression: typeof enableNoiseSuppression !== 'undefined' ? enableNoiseSuppression : undefined,
      disableNoiseSuppression: typeof disableNoiseSuppression !== 'undefined' ? disableNoiseSuppression : undefined,
      startWebRTC: typeof startWebRTC !== 'undefined' ? startWebRTC : undefined
    };


    return () => {
      // cleanup
    };
  }, []);

  return { localStream, peers, engine: engineRef.current, isEngineReady };
}

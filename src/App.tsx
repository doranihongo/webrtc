import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import { ChatMessage, PeerInfo, UserMediaStatus } from './types';
import { AudioNoiseProcessor } from './utils/noiseFilter';
import { ScreenShareIcon } from './components/CustomIcons';
import { JoinRoomForm } from './components/JoinRoomForm';
import { CallHeader } from './components/CallHeader';
import { VideoPlayer } from './components/VideoPlayer';
import { FloatingLocalVideo } from './components/FloatingLocalVideo';
import { FloatingRemoteVideo } from './components/FloatingRemoteVideo';
import { ControlBar } from './components/ControlBar';
import { ChatPanel } from './components/ChatPanel';
import { SettingsModal } from './components/SettingsModal';
import { UserCheck, Clock, Share2, Copy, Check, Maximize2, Minimize2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, VideoOff, MicOff, Mic, Video, PhoneOff, PictureInPicture, PictureInPicture2 } from 'lucide-react';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export default function App() {
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionModalOpen, setPermissionModalOpen] = useState<'camera' | 'microphone' | null>(null);

  // Streams State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remotePeer, setRemotePeer] = useState<PeerInfo | null>(null);

  // Local Controls State
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showPipSuggestion, setShowPipSuggestion] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // PIP Corner State
  const [pipCorner, setPipCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>(
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'top-right' : 'bottom-right'
  );

  const [viewportStyle, setViewportStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      // Only apply on mobile/tablet to fix keyboard pushing issue
      if (window.innerWidth < 1024) {
        setViewportStyle({
          height: `${window.visualViewport!.height}px`,
          top: `${window.visualViewport!.offsetTop}px`,
          position: 'fixed',
          width: '100%',
          left: 0
        });
      } else {
        setViewportStyle({});
      }
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Controls Visibility State (for mobile landscape auto-hide)
  const [showControls, setShowControls] = useState(true);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(
    localStorage.getItem('webrtc_audio_device') || null
  );
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(
    localStorage.getItem('webrtc_video_device') || null
  );
  const [noiseLevel, setNoiseLevel] = useState<'off' | 'medium' | 'high'>(
    (localStorage.getItem('webrtc_noise_level') as 'off' | 'medium' | 'high') || 'medium'
  );
  const [isInPagePip, setIsInPagePip] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (!remotePeer && isInPagePip) {
      setIsInPagePip(false);
    }
  }, [remotePeer, isInPagePip]);

  useEffect(() => {
    if (selectedAudioDeviceId) localStorage.setItem('webrtc_audio_device', selectedAudioDeviceId);
    else localStorage.removeItem('webrtc_audio_device');
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    if (selectedVideoDeviceId) localStorage.setItem('webrtc_video_device', selectedVideoDeviceId);
    else localStorage.removeItem('webrtc_video_device');
  }, [selectedVideoDeviceId]);

  useEffect(() => {
    localStorage.setItem('webrtc_noise_level', noiseLevel);
  }, [noiseLevel]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Error entering fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Error exiting fullscreen:', err);
        });
      }
    }
  };

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const noiseProcessorRef = useRef<AudioNoiseProcessor>(new AudioNoiseProcessor());
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const microphoneTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenAudioSenderRef = useRef<RTCRtpSender | null>(null);
  const wasVideoOnBeforeShareRef = useRef<boolean>(true);
  const wakeLockRef = useRef<any>(null);

  // Default room ID from URL search param
  const [urlRoomId, setUrlRoomId] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setUrlRoomId(roomParam.trim());
    }
  }, []);

  // Initialize Socket connection
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server with socket ID:', socket.id);
    });

    socket.on('room-full', ({ message }: { message: string }) => {
      setErrorMessage(message);
      handleLeaveCall();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Prevent accidental reload/close when in a call
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isInCall) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isInCall]);

  // Screen Wake Lock
  useEffect(() => {
    if (!isInCall) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.warn);
        wakeLockRef.current = null;
      }
      return;
    }

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('Screen Wake Lock acquired');
        }
      } catch (err) {
        console.warn('Wake Lock error:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.warn);
        wakeLockRef.current = null;
      }
    };
  }, [isInCall]);

  // Inactivity Timer for Controls
  useEffect(() => {
    // Global gesture listener to resume paused videos on iOS Safari
    const resumeVideos = () => {
      document.querySelectorAll('video').forEach(vid => {
        if (vid.paused && vid.srcObject) {
          vid.play().catch(() => {});
        }
      });
    };
    window.addEventListener('touchstart', resumeVideos, { passive: true });
    window.addEventListener('click', resumeVideos, { passive: true });

    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 5000);
    };

    if (isInCall && remotePeer) {
      resetTimer();
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('touchstart', resetTimer, { passive: true });
      window.addEventListener('click', resetTimer);
      window.addEventListener('keydown', resetTimer);

      return () => {
        clearTimeout(timeout);
        window.removeEventListener('mousemove', resetTimer);
        window.removeEventListener('touchstart', resetTimer);
        window.removeEventListener('click', resetTimer);
        window.removeEventListener('keydown', resetTimer);
        window.removeEventListener('touchstart', resumeVideos);
        window.removeEventListener('click', resumeVideos);
      };
    } else {
      setShowControls(true);
      return () => {
        window.removeEventListener('touchstart', resumeVideos);
        window.removeEventListener('click', resumeVideos);
      };
    }
  }, [isInCall, remotePeer]);

  // WebRTC PeerConnection Helper
  const createPeerConnection = useCallback((targetSocketId: string) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    videoSenderRef.current = null;
    audioSenderRef.current = null;

    // Send local tracks
    const currentStream = localStreamRef.current || localStream;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, currentStream);
        if (track.kind === 'video') {
          videoSenderRef.current = sender;
        } else if (track.kind === 'audio') {
          audioSenderRef.current = sender;
        }
      });
    }

    // ICE Candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        console.log('Negotiation needed, creating offer...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socketRef.current) {
          socketRef.current.emit('offer', {
            targetSocketId,
            sdp: pc.localDescription,
          });
        }
      } catch (err) {
        console.error('Error in onnegotiationneeded:', err);
      }
    };

    // Remote Stream Track Received
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, event.track.id);

      event.track.onunmute = () => {
        console.log('Remote track unmuted:', event.track.kind);
        setRemoteStream((prev) => {
          if (!prev) return new MediaStream([event.track]);
          if (!prev.getTracks().some(t => t.id === event.track.id)) {
            const newStream = new MediaStream(prev.getTracks());
            newStream.addTrack(event.track);
            return newStream;
          }
          return prev;
        });
      };

      setRemoteStream((prev) => {
        if (!prev) {
          return event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
        }
        if (!prev.getTracks().some((t) => t.id === event.track.id)) {
          const newStream = new MediaStream(prev.getTracks());
          newStream.addTrack(event.track);
          return newStream;
        }
        return prev;
      });
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC Connection State:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStream(null);
      }
    };

    return pc;
  }, [localStream]);

  // Handle Socket Events inside Call
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Triggered when joining room - contains list of existing users
    const handleRoomJoined = async ({
      yourSocketId,
      usersInRoom,
    }: {
      yourSocketId: string;
      usersInRoom: Array<{ socketId: string; userName: string; isAudioEnabled: boolean; isVideoEnabled: boolean; isScreenSharing: boolean; isNoiseSuppressed: boolean }>;
    }) => {
      console.log('Room joined successfully. Your ID:', yourSocketId, 'Users in room:', usersInRoom);

      if (usersInRoom.length > 0) {
        const peer = usersInRoom[0]; // 1-on-1 call: taking the single other participant
        setRemotePeer({
          socketId: peer.socketId,
          userName: peer.userName,
          mediaStatus: {
            isAudioMuted: !peer.isAudioEnabled,
            isVideoOff: !peer.isVideoEnabled,
            isScreenSharing: peer.isScreenSharing,
            isNoiseSuppressed: peer.isNoiseSuppressed,
          },
        });
      }
    };

    // Triggered when a remote user joins after you
    const handleUserJoined = async ({
      user,
    }: {
      user: { socketId: string; userName: string; isAudioEnabled: boolean; isVideoEnabled: boolean; isScreenSharing: boolean; isNoiseSuppressed: boolean };
    }) => {
      console.log('New peer joined:', user);
      setRemotePeer({
        socketId: user.socketId,
        userName: user.userName,
        mediaStatus: {
          isAudioMuted: !user.isAudioEnabled,
          isVideoOff: !user.isVideoEnabled,
          isScreenSharing: user.isScreenSharing,
          isNoiseSuppressed: user.isNoiseSuppressed,
        },
      });

      // Caller creates Offer
      const pc = createPeerConnection(user.socketId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', {
          targetSocketId: user.socketId,
          sdp: offer,
        });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    };

    // Handle incoming Offer
    const ensureRemoteTracks = (pc: RTCPeerConnection) => {
      const tracks = pc.getReceivers().map(r => r.track).filter(Boolean);
      
      tracks.forEach(track => {
        if (!track.onunmute) {
          track.onunmute = () => {
            console.log('Remote track unmuted (ensure):', track.kind);
            setRemoteStream((prev) => {
              if (!prev) return new MediaStream([track]);
              if (!prev.getTracks().some(t => t.id === track.id)) {
                const newStream = new MediaStream(prev.getTracks());
                newStream.addTrack(track);
                return newStream;
              }
              return prev;
            });
          };
        }
      });

      if (tracks.length > 0) {
        setRemoteStream(prev => {
          if (!prev) return new MediaStream(tracks);
          const existing = prev.getTracks();
          const newTracks = tracks.filter(t => !existing.some(ext => ext.id === t.id));
          newTracks.forEach(t => prev.addTrack(t));
          return prev;
        });
      }
    };

    const handleOffer = async ({
      senderSocketId,
      sdp,
    }: {
      senderSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      console.log('Received offer from:', senderSocketId);
      let pc = pcRef.current;
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        pc = createPeerConnection(senderSocketId);
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        ensureRemoteTracks(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', {
          targetSocketId: senderSocketId,
          sdp: answer,
        });
      } catch (err) {
        console.error('Error handling offer, recreating connection:', err);
        const freshPc = createPeerConnection(senderSocketId);
        await freshPc.setRemoteDescription(new RTCSessionDescription(sdp));
        ensureRemoteTracks(freshPc);
        const answer = await freshPc.createAnswer();
        await freshPc.setLocalDescription(answer);
        socket.emit('answer', {
          targetSocketId: senderSocketId,
          sdp: answer,
        });
      }
    };

    // Handle incoming Answer
    const handleAnswer = async ({
      sdp,
    }: {
      senderSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      console.log('Received answer');
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          ensureRemoteTracks(pcRef.current);
        } catch (err) {
          console.error('Error setting remote description from answer:', err);
        }
      }
    };

    // Handle incoming ICE Candidate
    const handleIceCandidate = async ({
      candidate,
    }: {
      senderSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    };

    // Handle Peer Media Status Changes
    const handlePeerMediaToggled = ({
      type,
      enabled,
    }: {
      socketId: string;
      type: 'audio' | 'video' | 'screen' | 'noiseSuppression';
      enabled: boolean;
    }) => {
      setRemotePeer((prev) => {
        if (!prev) return null;
        const newStatus: UserMediaStatus = { ...prev.mediaStatus };
        if (type === 'audio') newStatus.isAudioMuted = !enabled;
        if (type === 'video') {
          newStatus.isVideoOff = !enabled;
        }
        if (type === 'screen') {
          newStatus.isScreenSharing = enabled;
        }
        if (type === 'noiseSuppression') newStatus.isNoiseSuppressed = enabled;
        return { ...prev, mediaStatus: newStatus };
      });
    };

    // Handle Chat Messages
    const handleReceiveMessage = (msg: {
      id: string;
      senderSocketId: string;
      senderName: string;
      text: string;
      timestamp?: string;
      createdAt?: number;
    }) => {
      const isMe = msg.senderSocketId === socket.id;
      const createdAtMs = msg.createdAt || Date.now();
      const d = new Date(createdAtMs);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const localTimestamp = `${hours}:${minutes}`;

      const chatMsg: ChatMessage = {
        id: msg.id,
        senderSocketId: msg.senderSocketId,
        senderName: msg.senderName,
        text: msg.text,
        timestamp: localTimestamp,
        createdAt: createdAtMs,
        isMe,
      };

      setMessages((prev) => [...prev, chatMsg]);
      if (!isMe && !isChatOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    // Handle User Leaving
    const handleUserLeft = ({ userName }: { socketId: string; userName: string }) => {
      console.log('Remote user left:', userName);
      setRemotePeer(null);
      setRemoteStream(null);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      videoSenderRef.current = null;
    };

    const handlePeerNameUpdated = ({ socketId, userName }: { socketId: string; userName: string }) => {
      setRemotePeer((prev) => {
        if (prev && prev.socketId === socketId) {
          return { ...prev, userName };
        }
        return prev;
      });
    };

    socket.on('room-joined', handleRoomJoined);
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('peer-media-toggled', handlePeerMediaToggled);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('user-left', handleUserLeft);
    socket.on('peer-name-updated', handlePeerNameUpdated);

    return () => {
      socket.off('room-joined', handleRoomJoined);
      socket.off('user-joined', handleUserJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('peer-media-toggled', handlePeerMediaToggled);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('user-left', handleUserLeft);
      socket.off('peer-name-updated', handlePeerNameUpdated);
    };
  }, [createPeerConnection, isChatOpen]);

  // Join Call Logic
  const handleJoinRoom = async (
    targetRoomId: string,
    targetUserName: string,
    initialAudioMuted: boolean = false,
    initialVideoOff: boolean = false
  ) => {
    setErrorMessage(null);

    try {
      // Get User Media Stream with 1080p high quality constraints
      let stream: MediaStream;
      if (initialVideoOff && initialAudioMuted) {
        stream = new MediaStream();
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: initialVideoOff ? false : {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30 },
            ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {}),
          },
          audio: initialAudioMuted ? false : {
            echoCancellation: true,
            noiseSuppression: noiseLevel === 'medium',
            autoGainControl: noiseLevel === 'medium',
            ...(selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {}),
          },
        });
      }

      // Process audio with DSP noise processor (always ON by default)
      const processedStream = await noiseProcessorRef.current.processAudioStream(stream, noiseLevel);

      const rawAudioTrack = stream.getAudioTracks()[0];
      if (rawAudioTrack) {
        if (initialAudioMuted) {
          rawAudioTrack.stop();
          stream.removeTrack(rawAudioTrack);
          microphoneTrackRef.current = null;
        } else {
          microphoneTrackRef.current = rawAudioTrack;
        }
      } else {
        microphoneTrackRef.current = null;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        if (initialVideoOff) {
          videoTrack.stop();
          stream.removeTrack(videoTrack);
          cameraTrackRef.current = null;
        } else {
          cameraTrackRef.current = videoTrack;
        }
      } else {
        cameraTrackRef.current = null;
      }

      localStreamRef.current = processedStream;
      setLocalStream(processedStream);

      setIsAudioMuted(initialAudioMuted);
      setIsVideoOff(initialVideoOff);

      setRoomId(targetRoomId);
      setUserName(targetUserName);
      setIsInCall(true);

      // Notify socket server
      if (socketRef.current) {
        let clientId = sessionStorage.getItem('mirotalk_client_id');
        if (!clientId) {
          clientId = Math.random().toString(36).substring(2, 15);
          sessionStorage.setItem('mirotalk_client_id', clientId);
        }

        socketRef.current.emit('join-room', {
          roomId: targetRoomId,
          userName: targetUserName,
          clientId: clientId,
        });

        if (initialAudioMuted) {
          socketRef.current.emit('toggle-media', {
            roomId: targetRoomId,
            type: 'audio',
            enabled: false,
          });
        }

        if (initialVideoOff) {
          socketRef.current.emit('toggle-media', {
            roomId: targetRoomId,
            type: 'video',
            enabled: false,
          });
        }
      }
    } catch (err) {
      console.warn('Camera/Microphone access error:', err);
      setErrorMessage('Không thể truy cập Camera hoặc Microphone. Vui lòng cấp quyền trong trình duyệt.');
    }
  };

  // Leave Call Logic
  const handleLeaveCall = () => {
    if (socketRef.current && roomId) {
      socketRef.current.emit('leave-room');
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    videoSenderRef.current = null;
    audioSenderRef.current = null;

    if (cameraTrackRef.current) {
      cameraTrackRef.current.stop();
      cameraTrackRef.current = null;
    }
    if (microphoneTrackRef.current) {
      microphoneTrackRef.current.stop();
      microphoneTrackRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    noiseProcessorRef.current.cleanup();

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      screenStreamRef.current = null;
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    if (isInPagePip) {
      setIsInPagePip(false);
    }

    setRemoteStream(null);
    setRemotePeer(null);
    setIsInCall(false);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setShowPipSuggestion(false);
    setMessages([]);
    setUnreadCount(0);
  };

  // Toggle PiP
  const handleTogglePip = async (action: 'toggle' | 'open' | 'close' = 'toggle') => {
    if (action === 'close') {
      setIsInPagePip(false);
      return;
    }
    if (action === 'open' && isInPagePip) {
      return;
    }
    if (isInPagePip && action === 'toggle') {
      setIsInPagePip(false);
      return;
    }
    setIsInPagePip(true);
  };

  // Toggle Mic Audio
  const handleToggleAudio = async () => {
    if (isAudioMuted) {
      let rawAudioTrack = microphoneTrackRef.current;
      
      if (!rawAudioTrack || rawAudioTrack.readyState === 'ended') {
        try {
          const freshAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: noiseLevel === 'medium',
              autoGainControl: noiseLevel === 'medium',
              ...(selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {}),
            },
          });
          rawAudioTrack = freshAudioStream.getAudioTracks()[0];
          microphoneTrackRef.current = rawAudioTrack;
        } catch (err) {
          console.warn('Không thể bật lại micro:', err);
          setPermissionModalOpen('microphone');
          return;
        }
      }

      if (rawAudioTrack) {
        const rawStream = new MediaStream([rawAudioTrack]);
        const processedStream = await noiseProcessorRef.current.processAudioStream(rawStream, noiseLevel);
        const processedAudioTrack = processedStream.getAudioTracks()[0];

        setLocalStream((prevStream) => {
          if (!prevStream) {
            localStreamRef.current = processedStream;
            return processedStream;
          }
          const newStream = new MediaStream(prevStream.getTracks());
          const oldAudioTrack = newStream.getAudioTracks()[0];
          if (oldAudioTrack) {
            oldAudioTrack.stop();
            newStream.removeTrack(oldAudioTrack);
          }
          newStream.addTrack(processedAudioTrack);
          localStreamRef.current = newStream;
          return newStream;
        });

        setIsAudioMuted(false);
        await safeReplaceAudioTrack(processedAudioTrack);

        if (socketRef.current && roomId) {
          socketRef.current.emit('toggle-media', {
            roomId,
            type: 'audio',
            enabled: true,
          });
        }
      }
    } else {
      if (microphoneTrackRef.current) {
        microphoneTrackRef.current.stop();
        microphoneTrackRef.current = null;
      }
      noiseProcessorRef.current.cleanup();
      
      setLocalStream((prevStream) => {
        if (!prevStream) return null;
        const newStream = new MediaStream(prevStream.getTracks());
        const audioTrack = newStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.stop();
          newStream.removeTrack(audioTrack);
        }
        localStreamRef.current = newStream;
        return newStream;
      });

      setIsAudioMuted(true);
      await safeReplaceAudioTrack(null);

      if (socketRef.current && roomId) {
        socketRef.current.emit('toggle-media', {
          roomId,
          type: 'audio',
          enabled: false,
        });
      }
    }
  };

  // Helper to safely replace track on active peer connection
  const safeReplaceTrack = async (newTrack: MediaStreamTrack | null) => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed' || pc.connectionState === 'closed') {
      videoSenderRef.current = null;
      return;
    }
    if (videoSenderRef.current) {
      try {
        await videoSenderRef.current.replaceTrack(newTrack);
      } catch (err) {
        console.warn('replaceTrack failed safely:', err);
      }
    } else if (newTrack) {
      try {
        const transceiver = pc.getTransceivers().find(t => t.receiver.track.kind === newTrack.kind);
        if (transceiver && !transceiver.sender.track) {
          await transceiver.sender.replaceTrack(newTrack);
          transceiver.direction = 'sendrecv';
          videoSenderRef.current = transceiver.sender;
        } else {
          videoSenderRef.current = pc.addTrack(newTrack, localStreamRef.current || new MediaStream());
        }
      } catch (err) {
        console.warn('addTrack failed safely:', err);
      }
    }
  };

  const safeReplaceAudioTrack = async (newTrack: MediaStreamTrack | null) => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed' || pc.connectionState === 'closed') {
      audioSenderRef.current = null;
      return;
    }
    if (audioSenderRef.current) {
      try {
        await audioSenderRef.current.replaceTrack(newTrack);
      } catch (err) {
        console.warn('replaceTrack audio failed safely:', err);
      }
    } else if (newTrack) {
      try {
        const transceiver = pc.getTransceivers().find(t => t.receiver.track.kind === newTrack.kind);
        if (transceiver && !transceiver.sender.track) {
          await transceiver.sender.replaceTrack(newTrack);
          transceiver.direction = 'sendrecv';
          audioSenderRef.current = transceiver.sender;
        } else {
          audioSenderRef.current = pc.addTrack(newTrack, localStreamRef.current || new MediaStream());
        }
      } catch (err) {
        console.warn('addTrack audio failed safely:', err);
      }
    }
  };

  // Toggle Camera Video (Fully releases camera hardware when OFF, re-acquires HD stream when ON)
  const handleToggleVideo = async () => {
    if (isVideoOff) {
      // Re-enable Camera
      let videoTrack = cameraTrackRef.current;

      if (!videoTrack || videoTrack.readyState === 'ended') {
        try {
          const freshVideoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30 },
              ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {}),
            },
          });
          videoTrack = freshVideoStream.getVideoTracks()[0];
          cameraTrackRef.current = videoTrack;
        } catch (err) {
          console.warn('Không thể bật lại camera:', err);
          setPermissionModalOpen('camera');
          return;
        }
      }

      if (videoTrack) {
        videoTrack.enabled = true;

        if (!isScreenSharing) {
          // Safely replace track on existing WebRTC video sender only if not screen sharing
          await safeReplaceTrack(videoTrack);

          // Update local stream
          const currentLocal = localStreamRef.current || localStream;
          if (currentLocal) {
            const newStream = new MediaStream(currentLocal.getTracks());
            newStream.getVideoTracks().forEach((t) => {
              if (t !== screenTrackRef.current) newStream.removeTrack(t);
            });
            newStream.addTrack(videoTrack);
            localStreamRef.current = newStream;
            setLocalStream(newStream);
          } else {
            const newStream = new MediaStream([videoTrack]);
            localStreamRef.current = newStream;
            setLocalStream(newStream);
          }
        } else {
          // If we are currently screen sharing, update the intended state for when we stop sharing
          wasVideoOnBeforeShareRef.current = true;
        }

        setIsVideoOff(false);

        if (socketRef.current && roomId) {
          socketRef.current.emit('toggle-media', {
            roomId,
            type: 'video',
            enabled: true,
          });
        }
      }
    } else {
      // Turn Camera OFF and STOP hardware track (turns off hardware camera LED light!)
      if (cameraTrackRef.current) {
        cameraTrackRef.current.stop();
        cameraTrackRef.current = null;
      }

      if (!isScreenSharing) {
        const currentLocal = localStreamRef.current || localStream;
        if (currentLocal) {
          currentLocal.getVideoTracks().forEach((t) => {
            if (t !== screenTrackRef.current) {
              t.stop();
            }
          });
        }

        // Detach track from WebRTC video sender without destroying sender reference
        await safeReplaceTrack(null);

        // Update local stream state without video
        if (currentLocal) {
          const newStream = new MediaStream(currentLocal.getTracks());
          newStream.getVideoTracks().forEach((t) => {
            if (t !== screenTrackRef.current) {
              newStream.removeTrack(t);
            }
          });
          localStreamRef.current = newStream;
          setLocalStream(newStream);
        }
      } else {
        wasVideoOnBeforeShareRef.current = false;
      }

      setIsVideoOff(true);

      if (socketRef.current && roomId) {
        socketRef.current.emit('toggle-media', {
          roomId,
          type: 'video',
          enabled: false,
        });
      }
    }
  };

  // Toggle Screen Share (Full HD 1080p 30fps)
  const handleToggleScreenShare = async () => {
    if (!isInCall || !localStream) return;
    if (remotePeer?.mediaStatus?.isScreenSharing && !isScreenSharing) {
      return; // Khong the share neu nguoi kia dang share
    }

    if (!isScreenSharing) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 60 },
            displaySurface: 'browser'
          },
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
          audio: {
            suppressLocalAudioPlayback: false,
          },
          systemAudio: 'include',
        } as any);

        const screenVideoTrack = displayStream.getVideoTracks()[0];
        const screenAudioTrack = displayStream.getAudioTracks()[0];
        screenTrackRef.current = screenVideoTrack;
        screenStreamRef.current = displayStream;

        if (screenVideoTrack && screenVideoTrack.applyConstraints) {
          try {
            await screenVideoTrack.applyConstraints({
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30 },
            });
          } catch (err) {
            console.warn('Screen track applyConstraints warning:', err);
          }
        }

        // Replace video sender track in RTCPeerConnection
        await safeReplaceTrack(screenVideoTrack);
        
        if (screenAudioTrack && pcRef.current) {
          try {
            screenAudioSenderRef.current = pcRef.current.addTrack(screenAudioTrack, displayStream);
          } catch (err) {
            console.warn('Failed to add screen audio track:', err);
          }
        }

        // Remember previous camera state
        wasVideoOnBeforeShareRef.current = !isVideoOff;

        // Turn off camera if it is on
        if (!isVideoOff) {
          if (cameraTrackRef.current) {
            cameraTrackRef.current.stop();
            cameraTrackRef.current = null;
          }
          setIsVideoOff(true);
          if (socketRef.current && roomId) {
            socketRef.current.emit('toggle-media', {
              roomId,
              type: 'video',
              enabled: false,
            });
          }
        }

        // Update local stream state with screen track for local display
        if (localStream) {
          const newLocalStream = new MediaStream(localStream.getTracks());
          newLocalStream.getVideoTracks().forEach((t) => newLocalStream.removeTrack(t));
          newLocalStream.addTrack(screenVideoTrack);
          if (screenAudioTrack) {
            newLocalStream.addTrack(screenAudioTrack);
          }
          localStreamRef.current = newLocalStream;
          setLocalStream(newLocalStream);
        } else {
          const tracks = [screenVideoTrack];
          if (screenAudioTrack) tracks.push(screenAudioTrack);
          const newLocalStream = new MediaStream(tracks);
          localStreamRef.current = newLocalStream;
          setLocalStream(newLocalStream);
        }
        setIsScreenSharing(true);
        if (!isInPagePip && remotePeer) {
          setShowPipSuggestion(true);
        }
        
        if (socketRef.current && roomId) {
          socketRef.current.emit('toggle-media', { roomId, type: 'screen', enabled: true });
        }

        // Handle when user stops sharing via browser bar button
        screenVideoTrack.onended = () => {
          revertFromScreenShare();
        };
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
      }
    } else {
      revertFromScreenShare();
    }
  };

  const revertFromScreenShare = async () => {
    setShowPipSuggestion(false);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      screenStreamRef.current = null;
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    
    if (screenAudioSenderRef.current && pcRef.current) {
      try {
        pcRef.current.removeTrack(screenAudioSenderRef.current);
      } catch (e) {}
      screenAudioSenderRef.current = null;
    }

    setIsScreenSharing(false);

    if (socketRef.current && roomId) {
      socketRef.current.emit('toggle-media', { roomId, type: 'screen', enabled: false });
    }

    if (wasVideoOnBeforeShareRef.current) {
      // Re-enable camera if it was on before screen sharing
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30 },
            ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {}),
          },
        });
        const camTrack = camStream.getVideoTracks()[0];
        cameraTrackRef.current = camTrack;
        setIsVideoOff(false);

        await safeReplaceTrack(camTrack);

        if (localStream) {
          const newStream = new MediaStream(localStream.getTracks());
          newStream.getVideoTracks().forEach((t) => newStream.removeTrack(t));
          newStream.addTrack(camTrack);
          localStreamRef.current = newStream;
          setLocalStream(newStream);
        }

        if (socketRef.current && roomId) {
          socketRef.current.emit('toggle-media', { roomId, type: 'video', enabled: true });
        }
      } catch (err) {
        console.warn('Failed to restore camera after screen sharing:', err);
        await fallbackToAudioOnly();
      }
    } else {
      // Keep camera off if it was off before screen sharing
      await fallbackToAudioOnly();
    }
  };

  const fallbackToAudioOnly = async () => {
    await safeReplaceTrack(null);
    if (localStream) {
      const newStream = new MediaStream(localStream.getTracks());
      newStream.getVideoTracks().forEach((t) => newStream.removeTrack(t));
      localStreamRef.current = newStream;
      setLocalStream(newStream);
    }
  };

  // Send Chat Message
  const handleSendMessage = (text: string) => {
    if (socketRef.current && roomId && text.trim()) {
      socketRef.current.emit('send-message', {
        roomId,
        text,
        senderName: userName,
      });
    }
  };

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    if (socketRef.current && roomId && newName.trim()) {
      socketRef.current.emit('update-user-name', {
        roomId,
        userName: newName.trim(),
      });
    }
  };

  // Apply Audio Settings Changes
  useEffect(() => {
    if (!isInCall) return;
    const applyAudioSettings = async () => {
      if (!isAudioMuted) {
        if (microphoneTrackRef.current) {
          microphoneTrackRef.current.stop();
        }
        try {
          const freshAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: noiseLevel === 'medium',
              autoGainControl: noiseLevel === 'medium',
              ...(selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {}),
            },
          });
          const rawAudioTrack = freshAudioStream.getAudioTracks()[0];
          microphoneTrackRef.current = rawAudioTrack;
          
          const rawStream = new MediaStream([rawAudioTrack]);
          const processedStream = await noiseProcessorRef.current.processAudioStream(rawStream, noiseLevel);
          const processedAudioTrack = processedStream.getAudioTracks()[0];
          
          setLocalStream((prevStream) => {
            if (!prevStream) return processedStream;
            const newStream = new MediaStream(prevStream.getTracks());
            const oldAudioTrack = newStream.getAudioTracks()[0];
            if (oldAudioTrack) {
              oldAudioTrack.stop();
              newStream.removeTrack(oldAudioTrack);
            }
            newStream.addTrack(processedAudioTrack);
            localStreamRef.current = newStream;
            return newStream;
          });

          // Replace track in RTCPeerConnection safely
          const pc = pcRef.current;
          if (pc && audioSenderRef.current && pc.signalingState !== 'closed' && pc.connectionState !== 'closed') {
            audioSenderRef.current.replaceTrack(processedAudioTrack).catch((err) => {
              console.warn('Failed to replace audio track:', err);
            });
          }
        } catch (err) {
          console.warn('Error applying audio settings:', err);
        }
      }
    };
    applyAudioSettings();
  }, [selectedAudioDeviceId, noiseLevel]);

  // Apply Video Settings Changes
  useEffect(() => {
    if (!isInCall) return;
    const applyVideoSettings = async () => {
      if (!isVideoOff && !isScreenSharing) {
        if (cameraTrackRef.current) {
          cameraTrackRef.current.stop();
        }
        try {
          const freshVideoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30 },
              ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {}),
            },
          });
          const videoTrack = freshVideoStream.getVideoTracks()[0];
          cameraTrackRef.current = videoTrack;

          setLocalStream((prevStream) => {
            if (!prevStream) {
              localStreamRef.current = freshVideoStream;
              return freshVideoStream;
            }
            const newStream = new MediaStream(prevStream.getTracks());
            const oldVideoTracks = newStream.getVideoTracks();
            oldVideoTracks.forEach((t) => {
              t.stop();
              newStream.removeTrack(t);
            });
            newStream.addTrack(videoTrack);
            localStreamRef.current = newStream;
            return newStream;
          });

          const pc = pcRef.current;
          if (pc && videoSenderRef.current && pc.signalingState !== 'closed' && pc.connectionState !== 'closed') {
            videoSenderRef.current.replaceTrack(videoTrack).catch((err) => {
              console.warn('Failed to replace video track:', err);
            });
          }
        } catch (err) {
          console.warn('Error applying video settings:', err);
        }
      }
    };
    applyVideoSettings();
  }, [selectedVideoDeviceId]);

  // Dynamic Video Quality Adaptation
  useEffect(() => {
    const updateVideoQuality = async () => {
      if (!videoSenderRef.current) return;
      
      try {
        const params = videoSenderRef.current.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }

        if (isScreenSharing) {
          params.encodings[0].scaleResolutionDownBy = 1.0;
          params.encodings[0].maxBitrate = 3000000;
          if (screenTrackRef.current) screenTrackRef.current.contentHint = 'detail';
        } else if (remotePeer?.mediaStatus?.isScreenSharing) {
          params.encodings[0].scaleResolutionDownBy = 1.5;
          params.encodings[0].maxBitrate = 1000000;
          if (cameraTrackRef.current) cameraTrackRef.current.contentHint = 'motion';
        } else {
          params.encodings[0].scaleResolutionDownBy = 1.0;
          params.encodings[0].maxBitrate = 2500000;
          if (cameraTrackRef.current) cameraTrackRef.current.contentHint = 'motion';
        }

        await videoSenderRef.current.setParameters(params);
      } catch (err) {
        console.warn('Cannot update video sender parameters', err);
      }
    };
    
    updateVideoQuality();
  }, [isScreenSharing, remotePeer?.mediaStatus?.isScreenSharing]);

  // Audio priority adaptation
  useEffect(() => {
    const updateAudioPriority = async () => {
      if (!audioSenderRef.current) return;
      
      try {
        const params = audioSenderRef.current.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].priority = 'high';
        // @ts-ignore
        params.encodings[0].networkPriority = 'high';
        await audioSenderRef.current.setParameters(params);
      } catch (err) {
        console.warn('Cannot update audio sender priority', err);
      }
    };
    
    updateAudioPriority();
  }, [isInCall, remotePeer]);

  const [copiedLink, setCopiedLink] = useState(false);

  // Copy Room Link
  const handleCopyRoomLink = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-screen h-[100dvh] bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden select-none">
      {!isInCall ? (
        /* Landing / Homepage Form */
        <JoinRoomForm
          onJoin={handleJoinRoom}
          defaultRoomId={urlRoomId}
          errorMessage={errorMessage}
        />
      ) : (
        /* In-Call Room View */
        <div className={`relative w-full h-full flex flex-col pt-10 sm:pt-11 max-lg:landscape:pt-1 ${(showControls || !remotePeer) ? 'pb-[96px] sm:pb-20 max-lg:landscape:pb-16' : 'pb-6 sm:pb-20 max-lg:landscape:pb-2'} px-2 sm:px-6 max-lg:landscape:px-2 overflow-hidden transition-all duration-500`}>
          {/* Header */}
          <CallHeader
            roomId={roomId}
            hasPeerConnected={!!remotePeer}
            peerName={remotePeer?.userName}
            onCopyRoomLink={handleCopyRoomLink}
            showControls={showControls}
          />

          {/* Main Stage & Chat Container */}
          <div className={`flex-1 w-full max-w-7xl px-2 sm:px-4 mx-auto flex gap-2 sm:gap-4 items-center justify-center h-full max-h-[calc(100vh-90px)] sm:max-h-[calc(100vh-100px)] max-lg:landscape:max-h-full overflow-hidden`}>
            <>
              {remotePeer ? (
                /* Connected Room View: Remote video main stage + floating draggable local video PIP */
                <div className="relative w-full h-full max-h-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center">
                  {/* Keep VideoPlayer always mounted to prevent WebRTC black screen bugs */}
                  <div className={`w-full h-full ${isInPagePip ? 'absolute inset-0 opacity-0 pointer-events-none z-0' : 'relative z-10'}`}>
                    <VideoPlayer
                      videoId="remote-video"
                      stream={remoteStream}
                      userName={remotePeer.userName}
                      isAudioMuted={remotePeer.mediaStatus.isAudioMuted}
                      isVideoOff={remotePeer.mediaStatus.isVideoOff}
                      isScreenSharing={remotePeer.mediaStatus.isScreenSharing}
                      nameTagPosition={pipCorner === 'bottom-left' ? 'top-left' : 'bottom-left'}
                      pipCorner={pipCorner}
                      className="w-full h-full max-h-full"
                      showControls={showControls}
                    />
                  </div>

                  {isInPagePip && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-6 text-center relative z-20">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-inner">
                        {isScreenSharing ? (
                          <ScreenShareIcon className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
                        ) : (
                          <PictureInPicture2 className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
                        )}
                      </div>
                      <p className="text-slate-200 font-semibold text-lg sm:text-xl mb-2">
                        {isScreenSharing ? "Đang chia sẻ màn hình" : "Đang phát trong Hình trong hình"}
                      </p>
                      <p className="text-slate-400 text-sm max-w-sm">
                        Video của {remotePeer.userName} đang được hiển thị ở cửa sổ thu nhỏ.
                      </p>
                      <button onClick={() => handleTogglePip('close')} className="mt-6 cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors">
                        Đóng cửa sổ thu nhỏ
                      </button>
                    </div>
                  )}

               <FloatingLocalVideo
  stream={localStream}
  userName={userName}
  isAudioMuted={isAudioMuted}
  isVideoOff={isVideoOff}
  isScreenSharing={isScreenSharing}
  isRemoteScreenSharing={remotePeer.mediaStatus.isScreenSharing}
  isPipActive={isInPagePip}
  onCornerChange={setPipCorner}
/>
                </div>
              ) : (
                /* Waiting Room View: Split view with local video + waiting card */
                <div className="flex-1 grid grid-cols-1 grid-rows-2 max-lg:landscape:grid-cols-2 max-lg:landscape:grid-rows-1 md:grid-cols-2 md:grid-rows-1 gap-2 sm:gap-4 items-center justify-center h-full max-h-full">
                  <VideoPlayer
                    stream={localStream}
                    userName={userName}
                    isLocal
                    isAudioMuted={isAudioMuted}
                    isVideoOff={isVideoOff}
                    isScreenSharing={isScreenSharing}
                    className="w-full h-full max-h-full"
                  />

                  <div className="w-full h-full max-h-full bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                    <div className="hidden md:flex w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl items-center justify-center mb-4 border border-blue-500/20 animate-pulse">
                      <UserCheck className="w-8 h-8" />
                    </div>
                    
                    <h3 className="hidden md:block text-lg font-semibold text-slate-200 mb-1">
                      Đang chờ người tham gia...
                    </h3>
                    <h3 className="md:hidden text-lg font-semibold text-slate-200 mb-4">
                      Đang chờ người tham gia...
                    </h3>
                    
                    <p className="hidden md:block text-xs text-slate-400 max-w-xs mb-4">
                      Gửi mã phòng <span className="font-mono text-blue-400 font-bold uppercase">{roomId}</span> để mời người tham gia.
                    </p>
                    
                    <button
                      onClick={handleCopyRoomLink}
                      className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-2 transition-all"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
                      {copiedLink ? 'Đã sao chép mã phòng' : 'Sao chép mã phòng'}
                    </button>
                  </div>
                </div>
              )}

              {/* Dedicated Chat Panel */}
              {isChatOpen && (
                <div
                  style={window.innerWidth < 1024 ? viewportStyle : {}}
                  className="fixed inset-0 z-50 p-2 sm:p-3 bg-slate-950/85 backdrop-blur-md flex items-center justify-center portrait:fixed portrait:inset-0 portrait:z-50 portrait:p-2 portrait:bg-slate-950/85 portrait:backdrop-blur-md lg:landscape:relative lg:landscape:inset-auto lg:landscape:z-auto lg:landscape:p-0 lg:landscape:bg-transparent lg:landscape:backdrop-blur-none lg:landscape:w-80 xl:landscape:w-96 lg:landscape:h-full shrink-0 pointer-events-auto"
                >
                  <div className="w-full h-full max-w-lg lg:landscape:max-w-none flex flex-col">
                    <ChatPanel
                      isOpen={isChatOpen}
                      onClose={() => setIsChatOpen(false)}
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      onClearMessages={() => setMessages([])}
                      unreadCount={unreadCount}
                      onMarkAsRead={() => setUnreadCount(0)}
                    />
                  </div>
                </div>
              )}
            </>
          </div>

          {/* Bottom Controls Bar */}
          <ControlBar
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            isRemoteScreenSharing={remotePeer?.mediaStatus?.isScreenSharing || false}
            isChatOpen={isChatOpen}
            unreadCount={unreadCount}
            roomId={roomId}
            showControls={showControls || !remotePeer}
            isPipActive={isInPagePip}
            disablePip={!remotePeer}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
            onToggleChat={() => {
              setIsChatOpen((prev) => !prev);
            }}
            onLeaveCall={() => setShowLeaveConfirm(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onTogglePip={() => handleTogglePip('toggle')}
            onToggleFullscreen={() => {
              const videoEl = document.getElementById('remote-video-video') as HTMLVideoElement;
              if (!videoEl) return;
              if (videoEl.requestFullscreen) {
                videoEl.requestFullscreen().catch(e => console.warn(e));
              } else if ((videoEl as any).webkitEnterFullscreen) {
                (videoEl as any).webkitEnterFullscreen();
              } else if ((videoEl as any).webkitRequestFullscreen) {
                (videoEl as any).webkitRequestFullscreen();
              }
            }}
          />
        </div>
      )}

      {/* Permission Denied Modal */}
      {permissionModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-700 p-6 sm:p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500">
              {permissionModalOpen === 'camera' ? <VideoOff className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Không thể truy cập {permissionModalOpen === 'camera' ? 'Camera' : 'Microphone'}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed px-2">
                Trình duyệt đã chặn quyền truy cập {permissionModalOpen === 'camera' ? 'camera' : 'microphone'} của bạn. Vui lòng cấp quyền, sau đó thử lại.
              </p>
            </div>
            <button
              onClick={() => setPermissionModalOpen(null)}
              className="cursor-pointer w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all active:scale-[0.98]"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* PiP Suggestion Modal */}
      {showPipSuggestion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-700 p-6 sm:p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-500">
              <PictureInPicture className="w-10 h-10" />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Đang chia sẻ màn hình
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed px-2">
                Bạn có thể bật hình thu nhỏ để xem video và điều khiển cuộc gọi ngay cả khi chuyển sang tab khác.
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowPipSuggestion(false)}
                className="flex-1 cursor-pointer py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all"
              >
                Để sau
              </button>
              <button
                onClick={() => {
                  setShowPipSuggestion(false);
                  handleTogglePip('open');
                }}
                className="flex-1 cursor-pointer py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all active:scale-[0.98]"
              >
                Bật ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userName={userName}
        setUserName={handleUpdateUserName}
        selectedAudioDeviceId={selectedAudioDeviceId}
        setSelectedAudioDeviceId={setSelectedAudioDeviceId}
        selectedVideoDeviceId={selectedVideoDeviceId}
        setSelectedVideoDeviceId={setSelectedVideoDeviceId}
        noiseLevel={noiseLevel}
        setNoiseLevel={setNoiseLevel}
      />

      {/* Picture-in-Picture Portal */}
      {isInPagePip && (
        <FloatingRemoteVideo
          stream={remoteStream}
          userName={remotePeer?.userName || 'Đang đợi người tham gia...'}
          isAudioMuted={remotePeer?.mediaStatus?.isAudioMuted}
          isVideoOff={remotePeer?.mediaStatus?.isVideoOff}
          isScreenSharing={remotePeer?.mediaStatus?.isScreenSharing}
          onClose={() => handleTogglePip('close')}
          localAudioMuted={isAudioMuted}
          localVideoOff={isVideoOff}
          localScreenSharing={isScreenSharing}
          onToggleAudio={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onLeaveCall={() => setShowLeaveConfirm(true)}
        />
      )}

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-700 p-6 sm:p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500">
              <PhoneOff className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Rời khỏi phòng?
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed px-2">
                Bạn có chắc chắn muốn rời khỏi cuộc gọi này không?
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 cursor-pointer py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
                  handleLeaveCall();
                }}
                className="flex-1 cursor-pointer py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition-all active:scale-[0.98]"
              >
                Rời khỏi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
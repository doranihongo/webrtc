"use strict";

/**
 * ==============================================
 * MiroTalk P2P v.1.8.75 - Configuration File
 * ==============================================
 *
 * This file is the central configuration source.
 * All environment variables are read here so the
 * rest of the codebase imports config values
 * instead of reading process.env directly.
 *
 * Setup:
 *   cp app/src/config.template.js app/src/config.js
 *   Then edit config.js to match your environment.
 *
 * Docker/container environments inject values via
 * environment variables which are read at startup.
 *
 * Branding and customizations require a license:
 * https://codecanyon.net/item/mirotalk-p2p-webrtc-realtime-video-conferences/38376661
 */

require("dotenv").config();

const path = require("path");

const packageJson = require("../../package.json");

// Helper: parse env string to boolean
function getEnvBoolean(key, force_true_if_undefined = false) {
  // Treat "unset" and "present but blank" (e.g. `KEY=` in .env) the same -
  // a .env copied from the template lists every key, so an intentionally
  // blank value must still fall through to the default, not read as false.
  if ((key == undefined || key === "") && force_true_if_undefined) return true;
  return key == "true" ? true : false;
}

// Helper: safely parse JSON env vars with a fallback
function parseJsonEnv(envValue, fallback) {
  if (!envValue) return fallback;
  try {
    return JSON.parse(envValue);
  } catch (e) {
    return fallback;
  }
}

const port = 3000;

module.exports = {
  // ==========================================
  // Server
  // ==========================================
  server: {
    port: port,
    host: process.env.HOST || `http://localhost:${port}`,
    environment: process.env.NODE_ENV || "development",
    trustProxy: !!getEnvBoolean(process.env.TRUST_PROXY),

    /**
     * Embed (iframe) Restrictions
     * ---------------------------
     * Controls which origins are allowed to embed MiroTalk P2P in an <iframe>
     * via the HTTP `Content-Security-Policy: frame-ancestors` header
     * (also mirrored to `X-Frame-Options` when possible for legacy browsers).
     *
     * Behavior:
     * - Empty / unset  → header NOT set, embedding allowed anywhere (default).
     * - 'none'         → block ALL embedding (frame-ancestors 'none' + X-Frame-Options: DENY).
     * - 'self'         → only same-origin embedding (frame-ancestors 'self' + X-Frame-Options: SAMEORIGIN).
     * - list           → comma-separated origins, 'self' is always implicitly included.
     *                    Wildcards like https://*.example.com are valid in CSP.
     *
     * IMPORTANT: This affects the widget too — the MiroTalk widget embeds
     * the room in an iframe on the host site, so every site that should
     * load the widget must be listed here.
     */
    embed: {
      allowedOrigins: process.env.ALLOWED_EMBED_ORIGINS
        ? process.env.ALLOWED_EMBED_ORIGINS.split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
    },
  },

  // ==========================================
  // CORS
  // ==========================================
  cors: {
    origin: parseJsonEnv(process.env.CORS_ORIGIN, "*"),
    methods: parseJsonEnv(process.env.CORS_METHODS, ["GET", "POST"]),
  },

  // ==========================================
  // Host Protection
  // ==========================================
  host: {
    protected: getEnvBoolean(process.env.HOST_PROTECTED),
    userAuth: getEnvBoolean(process.env.HOST_USER_AUTH),
    users: parseJsonEnv(process.env.HOST_USERS, [
      { username: "MiroTalk", password: "P2P" },
    ]),
    maxLoginAttempts: parseInt(process.env.HOST_MAX_LOGIN_ATTEMPTS) || 5,
    minLoginBlockTime: parseInt(process.env.HOST_MIN_LOGIN_BLOCK_TIME) || 15, // in minutes
    maxRoomParticipants: 2,
    showActiveRooms: getEnvBoolean(process.env.SHOW_ACTIVE_ROOMS) || false,
  },

  // ==========================================
  // JWT
  // ==========================================
  jwt: {
    key: process.env.JWT_KEY || "mirotalk_jwt_secret",
    exp: process.env.JWT_EXP || "1h",
  },

  // ==========================================
  // Presenters
  // ==========================================
  presenters: parseJsonEnv(process.env.PRESENTERS, ["MiroTalk P2P"]),

  // ==========================================
  // API
  // ==========================================
  api: {
    keySecret: process.env.API_KEY_SECRET,
    disabled: parseJsonEnv(process.env.API_DISABLED, ["token", "meetings"]),
  },

  // ==========================================
  // Ngrok
  // ==========================================
  ngrok: {
    enabled: getEnvBoolean(process.env.NGROK_ENABLED),
    authToken: process.env.NGROK_AUTH_TOKEN,
  },

  // ==========================================
  // Supabase (account gating - đăng nhập bắt buộc)
  // Dùng chung project Supabase với web "xóa mù kanji", cùng bảng
  // public.profiles. anon key là public key, không phải secret.
  // ==========================================
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    allowedRoles: parseJsonEnv(process.env.SUPABASE_ALLOWED_ROLES, [
      "admin",
      "giaovien",
      "hocvien",
    ]),
    // admin dùng chung tài khoản với web kanji, miễn giới hạn số thiết
    // bị (max_devices) - giống hệt cách kanji đang làm.
    deviceLimitExemptRoles: parseJsonEnv(
      process.env.SUPABASE_DEVICE_LIMIT_EXEMPT_ROLES,
      ["admin"],
    ),
  },

  // ==========================================
  // WebRTC ICE Servers
  // ==========================================
  webrtc: {
    stun: {
      enabled: getEnvBoolean(process.env.STUN_SERVER_ENABLED),
      url: process.env.STUN_SERVER_URL,
    },
    turn: {
      enabled: getEnvBoolean(process.env.TURN_SERVER_ENABLED),
      // Có thể là 1 url dạng string, hoặc JSON array nhiều url
      // (vd nhiều transport: udp/tcp/443/turns) dùng chung username/credential.
      url: parseJsonEnv(process.env.TURN_SERVER_URL, process.env.TURN_SERVER_URL),
      username: process.env.TURN_SERVER_USERNAME,
      credential: process.env.TURN_SERVER_CREDENTIAL,
    },
  },

  // ==========================================
  // IP Lookup
  // ==========================================
  ipLookup: {
    enabled: getEnvBoolean(process.env.IP_LOOKUP_ENABLED),
  },

  // ==========================================
  // Recording (teacher-only, relayed through VPS, uploaded to Drive)
  // ==========================================
  recording: {
    enabled: getEnvBoolean(process.env.RECORDING_ENABLED, true), // ops kill-switch
    tempDir:
      process.env.RECORDING_TEMP_DIR ||
      path.join(__dirname, "../../recordings-tmp"),
    idleTimeoutMs: parseInt(process.env.RECORDING_IDLE_TIMEOUT_MS, 10) || 5 * 60 * 1000,
    minFreeDiskGB: parseFloat(process.env.RECORDING_MIN_FREE_DISK_GB) || 5,
    warnFreeDiskGB: parseFloat(process.env.RECORDING_WARN_FREE_DISK_GB) || 8,
    maxChunkBytes:
      parseInt(process.env.RECORDING_MAX_CHUNK_BYTES, 10) || 8 * 1024 * 1024,
    maxConcurrentSessions:
      parseInt(process.env.RECORDING_MAX_CONCURRENT_SESSIONS, 10) || 5,
  },

  // ==========================================
  // Shadowing YouTube (kaiwa tool - pulls JA captions via yt-dlp)
  // ==========================================
  shadowing: {
    enabled: getEnvBoolean(process.env.SHADOWING_ENABLED, true), // ops kill-switch
    tempDir:
      process.env.SHADOWING_TEMP_DIR ||
      path.join(__dirname, "../../recordings-tmp/shadowing"),
    // Path/command for yt-dlp on this host - override if it's not on PATH
    // (e.g. a venv install: /opt/venvs/ytdlp/bin/yt-dlp).
    ytDlpPath: process.env.SHADOWING_YTDLP_PATH || "yt-dlp",
    timeoutMs: parseInt(process.env.SHADOWING_TIMEOUT_MS, 10) || 25000,
  },

  // ==========================================
  // Google Drive (personal account - recording uploads)
  // ==========================================
  googleDrive: {
    clientId: process.env.GDRIVE_CLIENT_ID,
    clientSecret: process.env.GDRIVE_CLIENT_SECRET,
    refreshToken: process.env.GDRIVE_REFRESH_TOKEN,
    folderId: process.env.GDRIVE_FOLDER_ID || null, // blank = My Drive root
  },

  // ==========================================
  // Kaiwa slide URL signing (HMAC) - verified by a Cloudflare Worker in
  // front of the dedicated slide-image bucket/domain (not part of this
  // repo). Secret here MUST exactly match the Worker's SLIDE_SIGNING_SECRET
  // binding, or every signed link will fail verification.
  // ==========================================
  kaiwaSlideSigning: {
    secret: process.env.SLIDE_URL_SIGNING_SECRET || null, // null = signing disabled, route refuses to hand out URLs
    ttlSeconds: parseInt(process.env.SLIDE_URL_SIGNING_TTL_SECONDS, 10) || 2 * 60 * 60, // 2h
  },

  // ==========================================
  // Survey
  // ==========================================
  survey: {
    enabled: getEnvBoolean(process.env.SURVEY_ENABLED),
    url: process.env.SURVEY_URL || "https://www.questionpro.com/t/AUs7VZq00L",
  },

  // ==========================================
  // Redirect
  // ==========================================
  redirect: {
    enabled: getEnvBoolean(process.env.REDIRECT_ENABLED),
    url: process.env.REDIRECT_URL || "/newcall",
  },

  // ==========================================
  // Sentry
  // ==========================================
  sentry: {
    enabled: getEnvBoolean(process.env.SENTRY_ENABLED),
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE || "0.0",
    ),
    logLevels: process.env.SENTRY_LOG_LEVELS
      ? process.env.SENTRY_LOG_LEVELS.split(",").map((level) => level.trim())
      : ["error"],
  },

  // ==========================================
  // Slack
  // ==========================================
  slack: {
    enabled: getEnvBoolean(process.env.SLACK_ENABLED),
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },

  // ==========================================
  // IP Whitelist
  // ==========================================
  ipWhitelist: {
    enabled: getEnvBoolean(process.env.IP_WHITELIST_ENABLED),
    allowed: parseJsonEnv(process.env.IP_WHITELIST_ALLOWED, []),
  },

  // ==========================================
  // OIDC - OpenID Connect
  // ==========================================
  oidc: {
    enabled: process.env.OIDC_ENABLED
      ? getEnvBoolean(process.env.OIDC_ENABLED)
      : false,
    allowRoomCreationForAuthUsers: process.env
      .OIDC_ALLOW_ROOMS_CREATION_FOR_AUTH_USERS
      ? getEnvBoolean(process.env.OIDC_ALLOW_ROOMS_CREATION_FOR_AUTH_USERS)
      : false,
    baseUrlDynamic: process.env.OIDC_BASE_URL_DYNAMIC
      ? getEnvBoolean(process.env.OIDC_BASE_URL_DYNAMIC)
      : false,
    /*
     * When `baseUrlDynamic` is true, the OIDC baseURL (and therefore the redirect_uri
     * sent to the IdP) is derived from the incoming `Host` header. To prevent
     * Host-header injection from redirecting authorization codes to an attacker,
     * list every origin the server is allowed to serve here (full origin, no path).
     * The static `config.baseURL` is always trusted and does not need to be repeated.
     * Example: ['https://p2p.mirotalk.com', 'https://meet.example.com']
     */
    allowedDynamicBaseURLs: process.env.OIDC_ALLOWED_DYNAMIC_BASE_URLS
      ? process.env.OIDC_ALLOWED_DYNAMIC_BASE_URLS.split(",")
          .map((u) => u.trim())
          .filter(Boolean)
      : [],
    config: {
      issuerBaseURL: process.env.OIDC_ISSUER_BASE_URL,
      clientID: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      baseURL: process.env.OIDC_BASE_URL,
      secret: process.env.SESSION_SECRET,
      authorizationParams: {
        response_type: "code",
        scope: "openid profile email",
      },
      authRequired: process.env.OIDC_AUTH_REQUIRED
        ? getEnvBoolean(process.env.OIDC_AUTH_REQUIRED)
        : false,
      auth0Logout: process.env.OIDC_AUTH_LOGOUT
        ? getEnvBoolean(process.env.OIDC_AUTH_LOGOUT)
        : true,
      routes: {
        callback: "/auth/callback",
        login: false,
        logout: "/logout",
      },
    },
  },

  // ==========================================
  // Mattermost
  // ==========================================
  mattermost: {
    enabled: getEnvBoolean(process.env.MATTERMOST_ENABLED),
    serverUrl: process.env.MATTERMOST_SERVER_URL,
    username: process.env.MATTERMOST_USERNAME,
    password: process.env.MATTERMOST_PASSWORD,
    token: process.env.MATTERMOST_TOKEN,
    roomTokenExpire: process.env.MATTERMOST_ROOM_TOKEN_EXPIRE,
  },

  // ==========================================
  // Stats / Analytics
  // ==========================================
  stats: {
    enabled: getEnvBoolean(process.env.STATS_ENABLED), // default off - internal app, no external analytics
    src: process.env.STATS_SCR || "https://stats.mirotalk.com/script.js",
    id: process.env.STATS_ID || "c7615aa7-ceec-464a-baba-54cb605d7261",
  },

  // ==========================================
  // Email
  // ==========================================
  email: {
    alert: process.env.EMAIL_ALERT === "true" || false,
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    username: process.env.EMAIL_USERNAME,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
    sendTo: process.env.EMAIL_SEND_TO,
    https: process.env.HTTPS === "true" || false,
    serverPort: process.env.PORT || 3000,
  },

  // ==========================================
  // Branding (UI customizations)
  // ==========================================
  brand: {
    htmlInjection: true,
    app: {
      language: "en", // https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
      name: "MiroTalk",
      title:
        "<h1>MiroTalk</h1>Free browser based Real-time video calls.<br />Simple, Secure, Fast.",
      description:
        "Start your next video call with a single click. No download, plug-in, or login is required. Just get straight to talking, messaging, and sharing your screen.",
      joinDescription: "Pick a room name.<br />How about this one?",
      joinButtonLabel: "JOIN ROOM",
      customizeRoomButtonLabel: "CUSTOMIZE ROOM",
      joinLastLabel: "Your recent room:",
    },
    og: {
      type: "app-webrtc",
      siteName: "DORA ONLINE",
      title: "Phòng học DORA ONLINE",
      description:
        "DORA ONLINE",
      image: "https://doranihongo.com/images/dora-logo.png",
      url: "https://doranihongo.com",
    },
    site: {
      shortcutIcon: "../images/logo.svg",
      appleTouchIcon: "../images/logo.svg",
      landingTitle:
        "MiroTalk a Free Secure Video Calls, Chat & Screen Sharing.",
      newCallTitle:
        "MiroTalk a Free Secure Video Calls, Chat & Screen Sharing.",
      newCallRoomTitle: "Pick name. <br />Share URL. <br />Start conference.",
      newCallRoomDescription:
        "Each room has its disposable URL. Just pick a room name and share your custom URL. It's that easy.",
      loginTitle: "MiroTalk - Host Protected login required.",
      loginHeading: "Welcome back",
      loginDescription: "Enter your credentials to continue.",
      loginButtonLabel: "Login",
      joinRoomTitle: "Pick name.<br />Share URL.<br />Start conference.",
      joinRoomButtonLabel: "JOIN ROOM",
      clientTitle: "MiroTalk WebRTC Video call, Chat Room & Screen Sharing.",
      privacyPolicyTitle: "MiroTalk - privacy and policy.",
      stunTurnTitle: "Test Stun/Turn Servers.",
      notFoundTitle: "MiroTalk - 404 Page not found.",
    },
    html: {
      topSponsors: true,
      features: true,
      browsers: true,
      teams: true, // please keep me always true ;)
      tryEasier: true,
      poweredBy: true,
      sponsors: true,
      pastSponsors: true,
      advertisers: true,
      supportUs: true,
      footer: true,
    },
    about: {
      imageUrl: "../images/mirotalk-logo.gif",
      title: `WebRTC P2P v${packageJson.version}`,
      html: `
                <button 
                    id="support-button" 
                    data-umami-event="Support button" 
                    onclick="window.open('https://codecanyon.net/user/miroslavpejic85')">
                    <i class="fas fa-heart" ></i>&nbsp;Support
                </button>
                <br /><br /><br />
                Author:<a 
                    id="linkedin-button" 
                    data-umami-event="Linkedin button" 
                    href="https://www.linkedin.com/in/miroslav-pejic-976a07101/" target="_blank"> 
                    Miroslav Pejic
                </a>
                <br />
                Email:<a 
                    id="email-button" 
                    data-umami-event="Email button" 
                    href="mailto:miroslav.pejic.85@gmail.com?subject=MiroTalk P2P info"> 
                    miroslav.pejic.85@gmail.com
                </a>
                <br /><br />
                <hr />
                <span>&copy; 2025 MiroTalk P2P, all rights reserved</span>
                <hr />
            `,
    },
    // https://docs.mirotalk.com/mirotalk-p2p/integration/#widgets-integration
    widget: {
      enabled: false,
      roomId: "support-room",
      theme: "dark",
      widgetState: "minimized",
      widgetType: "support",
      supportWidget: {
        position: "top-right",
        expertImages: [
          "https://photo.cloudron.pocketsolution.net/uploads/original/95/7d/a5f7f7a2c89a5fee7affda5f013c.jpeg",
        ],
        buttons: {
          audio: true,
          video: true,
          screen: true,
          chat: true,
          join: true,
        },
        checkOnlineStatus: false,
        isOnline: true,
        customMessages: {
          heading: "Need Help?",
          subheading: "Get instant support from our expert team!",
          connectText: "connect in < 5 seconds",
          onlineText: "We are online",
          offlineText: "We are offline",
          poweredBy: "Powered by MiroTalk",
        },
      },
    },
    //...
  },
  // ==========================================
  buttons: {
    main: {
      showAudioBtn: true,
      showVideoBtn: true,
      showScreenBtn: true, // autodetected
      showMyHandBtn: true,
      showChatRoomBtn: true,
      showParticipantsBtn: true,
      showMySettingsBtn: true,
      showExtraBtn: true,
      showShareQr: true,
      showShareRoomBtn: false, // For guests
      showHideMeBtn: true,
      showRecordStreamBtn: true,
      showFullScreenBtn: true,
      showDocumentPipBtn: true,
      showAboutBtn: true, // Please keep me always true, Thank you!
    },
    chat: {
      showMaxBtn: true,
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
      customNoiseSuppression: getEnvBoolean(
        process.env.CUSTOM_NOISE_SUPPRESSION_ENABLED,
        true,
      ),
    },
    remote: {
      audioBtnClickAllowed: true,
      videoBtnClickAllowed: true,
      showVideoPipBtn: true,
      showKickOutBtn: true,
    },
    local: {
      showVideoPipBtn: true,
    },
  },
  // ==========================================
  // Webhook
  // ==========================================
  webhook: {
    enabled: false, // Enable webhook functionality
    url: "http://localhost:8888/webhook-endpoint", // Webhook server URL
  },
};

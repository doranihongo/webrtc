/*
http://patorjk.com/software/taag/#p=display&f=ANSI%20Regular&t=Server

███████ ███████ ██████  ██    ██ ███████ ██████  
██      ██      ██   ██ ██    ██ ██      ██   ██ 
███████ █████   ██████  ██    ██ █████   ██████  
     ██ ██      ██   ██  ██  ██  ██      ██   ██ 
███████ ███████ ██   ██   ████   ███████ ██   ██                                           

dependencies: {
    @mattermost/client      : https://www.npmjs.com/package/@mattermost/client
    @ngrok/ngrok            : https://www.npmjs.com/package/@ngrok/ngrok
    @sentry/node            : https://www.npmjs.com/package/@sentry/node
    axios                   : https://www.npmjs.com/package/axios
    chokidar                : https://www.npmjs.com/package/chokidar
    colors                  : https://www.npmjs.com/package/colors
    compression             : https://www.npmjs.com/package/compression
    cors                    : https://www.npmjs.com/package/cors
    crypto-js               : https://www.npmjs.com/package/crypto-js
    dompurify               : https://www.npmjs.com/package/dompurify
    dotenv                  : https://www.npmjs.com/package/dotenv
    express                 : https://www.npmjs.com/package/express
    express-openid-connect  : https://www.npmjs.com/package/express-openid-connect
    he                      : https://www.npmjs.com/package/he
    helmet                  : https://www.npmjs.com/package/helmet
    httpolyglot             : https://www.npmjs.com/package/httpolyglot
    jsdom                   : https://www.npmjs.com/package/jsdom
    jsonwebtoken            : https://www.npmjs.com/package/jsonwebtoken
    js-yaml                 : https://www.npmjs.com/package/js-yaml
    nodemailer              : https://www.npmjs.com/package/nodemailer
    qs                      : https://www.npmjs.com/package/qs
    socket.io               : https://www.npmjs.com/package/socket.io
    swagger-ui-express      : https://www.npmjs.com/package/swagger-ui-express
    uuid                    : https://www.npmjs.com/package/uuid
}
*/

/**
 * MiroTalk P2P - Server component
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

"use strict"; // https://www.w3schools.com/js/js_strict.asp

require("dotenv").config();

const { auth, requiresAuth } = require("express-openid-connect");
const { Server } = require("socket.io");
const httpolyglot = require("httpolyglot");
const compression = require("compression");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const app = express();
const fs = require("fs");
const checkXSS = require("./xss.js");
const ServerApi = require("./api");
const MattermostController = require("./mattermost");
const Recording = require("./recording");
const Validate = require("./validate");
const HtmlInjector = require("./htmlInjector");
const Host = require("./host");
const Logs = require("./logs");
const {
  applyEmbedHeaders,
  embedAllowedOrigins,
  embedCsp,
} = require("./middleware/embedHeaders");
const log = new Logs("server");

// Central configuration (reads .env via dotenv internally)
const config = require("./config");

// Email alerts and notifications
const nodemailer = require("./lib/nodemailer");

const packageJson = require("../../package.json");

// Login attempts limit
const rateLimit = require("express-rate-limit");
const maxAttempts = config.host.maxLoginAttempts;
const minBlockTime = config.host.minLoginBlockTime; // in minutes
const loginLimiter = rateLimit({
  windowMs: minBlockTime * 60 * 1000, // 15 minutes default
  max: maxAttempts,
  message: {
    message: `Too many login attempts. Please try again after ${minBlockTime} minute${minBlockTime == 1 ? "" : "s"}.`,
  },
  keyGenerator: (req) => req.body?.username || getIP(req),
});

const port = config.server.port;
const host = config.server.host;

const authHost = new Host(); // Authenticated IP by Login

// Define paths to the SSL key and certificate files
const keyPath = path.join(__dirname, "../ssl/key.pem");
const certPath = path.join(__dirname, "../ssl/cert.pem");

// Read SSL key and certificate files securely
const options = {
  key: fs.readFileSync(keyPath, "utf-8"),
  cert: fs.readFileSync(certPath, "utf-8"),
};

// Server both http and https
const server = httpolyglot.createServer(options, app);

// Handle client errors (malformed/incomplete HTTP requests) gracefully
server.on("clientError", (err, socket) => {
  err.code === "HPE_HEADER_OVERFLOW" || err.message === "Parse Error"
    ? log.warn("Client HTTP parse error", {
        error: err.message,
        code: err.code,
      })
    : log.warn("Client connection error", {
        error: err.message,
        code: err.code,
      });
  if (socket && !socket.destroyed) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  }
});

// Trust Proxy
const trustProxy = config.server.trustProxy;

// Cors
const corsOptions = {
  origin: config.cors.origin,
  methods: config.cors.methods,
};

/*  
    Set maxHttpBufferSize from 1e6 (1MB) to 1e7 (10MB)
*/
const io = new Server({
  maxHttpBufferSize: 1e7,
  transports: ["websocket"],
  cors: corsOptions,
}).listen(server);

// console.log(io);

/**
 * Account gating (Supabase) - lớp bảo mật thật, không phải chỉ chặn ở
 * giao diện. Client (client.js) gắn token Supabase vào lúc connect
 * (socket.handshake.auth.token, xem window.__authToken trong
 * common.js). Ở đây verify lại token đó với chính Supabase, rồi tra
 * role trong bảng `profiles` dùng chung với web "xóa mù kanji" -
 * không hợp lệ thì từ chối kết nối luôn, không cho vào io.sockets.on
 * "connect" ở dưới.
 *
 * Bỏ qua hoàn toàn (cho kết nối như cũ) nếu SUPABASE_URL/ANON_KEY
 * chưa được cấu hình trong .env - tránh khoá cứng app của người khác
 * dùng lại code này mà chưa set up Supabase.
 */
const supabaseCfg = config.supabase;
if (supabaseCfg.url && supabaseCfg.anonKey) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("unauthorized"));
    }
    try {
      const { data: user } = await axios.get(
        `${supabaseCfg.url}/auth/v1/user`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseCfg.anonKey,
          },
          timeout: 8000,
        },
      );
      if (!user?.id) {
        return next(new Error("unauthorized"));
      }

      const { data: profiles } = await axios.get(
        `${supabaseCfg.url}/rest/v1/profiles`,
        {
          params: {
            id: `eq.${user.id}`,
            select:
              "role,is_first_login,password_changed_at,max_devices,expires_at",
          },
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseCfg.anonKey,
          },
          timeout: 8000,
        },
      );
      const role = profiles?.[0]?.role;
      if (!role || !supabaseCfg.allowedRoles.includes(role)) {
        return next(new Error("unauthorized"));
      }
      // Chưa hoàn tất đổi mật khẩu lần đầu -> chặn luôn ở lớp bảo mật
      // thật (không chỉ dựa vào authGuard phía client, có thể bị bỏ
      // qua). is_first_login=false đã được set khi đổi mật khẩu xong
      // (public/js/login.js) - nếu lệch do RLS chặn ghi, client vẫn có
      // fallback localStorage riêng ở lớp giao diện, nhưng ở đây ta chỉ
      // tin dữ liệu thật trong DB.
      if (profiles?.[0]?.is_first_login) {
        return next(new Error("unauthorized"));
      }

      // Phiên (token) được cấp TRƯỚC lần đổi mật khẩu gần nhất -> từ
      // chối, bắt đăng nhập lại bằng mật khẩu mới. Không có bước này
      // thì: máy A đăng nhập bằng mật khẩu tạm -> đứng ở màn đổi mật
      // khẩu không làm gì -> máy B đăng nhập CÙNG tài khoản và đổi mật
      // khẩu xong -> máy A vẫn còn access token cũ (Supabase không tự
      // thu hồi token khác khi đổi mật khẩu) -> is_first_login lúc này
      // đã false (đổi ở máy B) nên máy A lọt vào thẳng, dù chưa hề tự
      // đổi mật khẩu trên chính nó. token.iat (giây) so với
      // password_changed_at (mốc do login.js set lúc đổi mật khẩu
      // thành công) - null thì bỏ qua kiểm tra này (tài khoản cũ chưa
      // từng qua luồng đổi mật khẩu, không có gì để so).
      // Khoảng đệm 10s: JWT iat chỉ chính xác tới giây còn
      // password_changed_at chính xác tới mili-giây, và client tự
      // refreshSession() ngay sau khi đổi mật khẩu nên token mới hay
      // rơi vào ĐÚNG CÙNG 1 GIÂY với password_changed_at rồi bị làm
      // tròn xuống thành "sớm hơn" - không có đệm này thì chính người
      // vừa đổi mật khẩu xong cũng bị từ chối.
      const passwordChangedAt = profiles?.[0]?.password_changed_at;
      if (passwordChangedAt) {
        const decoded = jwt.decode(token);
        const tokenIssuedMs = decoded?.iat ? decoded.iat * 1000 : 0;
        const PASSWORD_CHANGE_GRACE_MS = 10000;
        if (
          tokenIssuedMs <
          new Date(passwordChangedAt).getTime() - PASSWORD_CHANGE_GRACE_MS
        ) {
          return next(new Error("unauthorized"));
        }
      }

      // Hạn sử dụng + giới hạn số thiết bị - port từ checkAccountAccess
      // trong public/js/supabaseClient.js sang Node cho lớp bảo mật
      // thật (client-side chỉ là UX, có thể bị bỏ qua). Hết hạn -> chỉ
      // chặn, KHÔNG tự xoá tài khoản (xoá cần service_role key, cố
      // tình không thêm vào server - xem giải thích trong
      // checkAccountAccess). Thiết bị đã đăng nhập từ trước luôn được
      // dùng tiếp bình thường, chỉ chặn thiết bị MỚI khi đã đầy chỗ.
      const profileRow = profiles?.[0] || {};
      if (
        profileRow.expires_at &&
        new Date(profileRow.expires_at) < new Date()
      ) {
        return next(new Error("unauthorized"));
      }

      if (!supabaseCfg.deviceLimitExemptRoles.includes(role)) {
        try {
          const maxDevices = profileRow.max_devices;
          if (maxDevices) {
            const deviceId = socket.handshake.auth?.deviceId;
            if (!deviceId) {
              return next(new Error("unauthorized"));
            }
            const { data: devices } = await axios.get(
              `${supabaseCfg.url}/rest/v1/user_devices`,
              {
                params: { user_id: `eq.${user.id}`, select: "id,device_id" },
                headers: {
                  Authorization: `Bearer ${token}`,
                  apikey: supabaseCfg.anonKey,
                },
                timeout: 8000,
              },
            );
            const existing = devices?.find((d) => d.device_id === deviceId);
            const restHeaders = {
              Authorization: `Bearer ${token}`,
              apikey: supabaseCfg.anonKey,
            };
            if (existing) {
              // Không chặn connect để chờ ghi xong - chỉ để cập nhật
              // "lần cuối hoạt động", không phải điều kiện cho vào.
              axios
                .patch(
                  `${supabaseCfg.url}/rest/v1/user_devices`,
                  { last_active: new Date().toISOString() },
                  { params: { id: `eq.${existing.id}` }, headers: restHeaders },
                )
                .catch(() => {});
            } else if ((devices?.length || 0) >= maxDevices) {
              return next(new Error("unauthorized"));
            } else {
              axios
                .post(
                  `${supabaseCfg.url}/rest/v1/user_devices`,
                  {
                    user_id: user.id,
                    device_id: deviceId,
                    last_active: new Date().toISOString(),
                  },
                  {
                    params: { on_conflict: "user_id,device_id" },
                    headers: {
                      ...restHeaders,
                      Prefer: "resolution=merge-duplicates",
                    },
                  },
                )
                .catch(() => {});
            }
          }
        } catch (deviceErr) {
          // Lỗi mạng/RLS tạm thời khi đọc user_devices - không chặn
          // nhầm người dùng thật vì 1 lỗi đọc dữ liệu phụ, chỉ log lại.
          log.warn(
            "[Auth] Không kiểm tra được giới hạn thiết bị",
            deviceErr.message,
          );
        }
      }

      // Dùng ở phần phân quyền trong phòng (ai tự động là "presenter" -
      // xem isPresenterRole/chỗ gán presenters[channel] lúc join, và
      // presenterActions bên dưới cho screenStart).
      socket.supabaseRole = role;

      next();
    } catch (err) {
      log.warn("[Auth] Socket rejected - token verify failed", err.message);
      next(new Error("unauthorized"));
    }
  });
} else {
  log.warn(
    "[Auth] SUPABASE_URL/SUPABASE_ANON_KEY chưa được cấu hình trong .env - bỏ qua kiểm tra đăng nhập cho Socket.IO",
  );
}

/**
 * Role nào tự động là "chủ phòng" (presenter) - admin và giáo viên có
 * đầy đủ quyền chủ phòng (khoá/mở phòng, kick, chia sẻ màn hình, ghi
 * hình...); học viên thì không, kể cả khi vào phòng đầu tiên.
 * @param {string} role
 * @returns {boolean}
 */
function isPresenterRole(role) {
  return role === "admin" || role === "giaovien";
}

// Host protection (disabled by default)
const hostCfg = {
  protected: config.host.protected,
  user_auth: config.host.userAuth,
  users: config.host.users,
  authenticated: !config.host.protected,
  maxRoomParticipants: config.host.maxRoomParticipants,
  showActiveRooms: config.host.showActiveRooms,
};

// JWT config
const jwtCfg = {
  JWT_KEY: config.jwt.key,
  JWT_EXP: config.jwt.exp,
};

// Room presenters
const roomPresenters = config.presenters;

// Swagger config
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = yaml.load(
  fs.readFileSync(path.join(__dirname, "/../api/swagger.yaml"), "utf8"),
);

// Api config
const { v4: uuidV4 } = require("uuid");
const apiBasePath = "/api/v1"; // api endpoint path
const api_docs = host + apiBasePath + "/docs"; // api docs
const api_key_secret = config.api.keySecret;
const api_disabled = config.api.disabled;

// Ngrok config
const ngrok = require("@ngrok/ngrok");
const ngrokEnabled = config.ngrok.enabled;
const ngrokAuthToken = config.ngrok.authToken;

// Handle WebHook
const webhook = {
  enabled: config.webhook?.enabled || false,
  url: config.webhook?.url || "http://localhost:8888/webhook-endpoint",
};

// Stun (https://bloggeek.me/webrtcglossary/stun/)
// Turn (https://bloggeek.me/webrtcglossary/turn/)
const iceServers = [];
const stunServerUrl = config.webrtc.stun.url;
const turnServerUrl = config.webrtc.turn.url;
const turnServerUsername = config.webrtc.turn.username;
const turnServerCredential = config.webrtc.turn.credential;
const stunServerEnabled = config.webrtc.stun.enabled;
const turnServerEnabled = config.webrtc.turn.enabled;
// Stun is mandatory for not internal network
if (stunServerEnabled && stunServerUrl)
  iceServers.push({ urls: stunServerUrl });
// Turn is recommended if direct peer to peer connection is not possible
if (
  turnServerEnabled &&
  turnServerUrl &&
  turnServerUsername &&
  turnServerCredential
) {
  iceServers.push({
    urls: turnServerUrl,
    username: turnServerUsername,
    credential: turnServerCredential,
  });
}

// Test Stun and Turn connection with query params
// const testStunTurn = host + '/icetest?iceServers=' + JSON.stringify(iceServers);
const testStunTurn = host + "/icetest";

// IP Lookup
const IPLookupEnabled = config.ipLookup.enabled;

// Survey URL
const surveyEnabled = config.survey.enabled;
const surveyURL = config.survey.url;

// Redirect URL
const redirectEnabled = config.redirect.enabled;
const redirectURL = config.redirect.url;

// Sentry config
const Sentry = require("@sentry/node");
const sentryEnabled = config.sentry.enabled;
const sentryDSN = config.sentry.dsn;
const sentryTracesSampleRate = config.sentry.tracesSampleRate;

// Slack API
const CryptoJS = require("crypto-js");
const qS = require("qs");
const slackEnabled = config.slack.enabled;
const slackSigningSecret = config.slack.signingSecret;

// Setup sentry client
if (sentryEnabled && typeof sentryDSN === "string" && sentryDSN.trim()) {
  log.info("Sentry monitoring started...");

  Sentry.init({
    dsn: sentryDSN,
    tracesSampleRate: sentryTracesSampleRate,
  });

  const logLevels = config.sentry.logLevels;

  const stripAnsi = (str) =>
    typeof str === "string" ? str.replace(/\u001b\[[0-9;]*m/g, "") : str;

  const originalConsole = {};
  logLevels.forEach((level) => {
    originalConsole[level] = console[level];
    console[level] = function (...args) {
      const cleanArgs = args.map(stripAnsi);
      switch (level) {
        case "warn":
          Sentry.captureMessage(cleanArgs.join(" "), "warning");
          break;
        case "error":
          args[0] instanceof Error
            ? Sentry.captureException(args[0])
            : Sentry.captureException(new Error(cleanArgs.join(" ")));
          break;
      }
      originalConsole[level].apply(console, args);
    };
  });

  // log.error('Sentry error', { foo: 'bar' });
  // log.warn('Sentry warning');
}

// IP Whitelist
const ipWhitelist = config.ipWhitelist;

// OIDC - Open ID Connect
const OIDC = config.oidc;

// Custom middleware function for OIDC authentication
function OIDCAuth(req, res, next) {
  if (OIDC.enabled) {
    function handleHostProtected(req) {
      if (!hostCfg.protected) return;

      const ip = authHost.getIP(req);
      hostCfg.authenticated = true;
      authHost.setAuthorizedIP(ip, true);
      // Check...
      log.debug("OIDC ------> Host protected", {
        authenticated: hostCfg.authenticated,
        authorizedIPs: authHost.getAuthorizedIPs(),
      });
    }

    if (req.oidc.isAuthenticated()) {
      log.debug("OIDC ------> User already Authenticated");
      handleHostProtected(req);
      return next();
    }

    // Apply requiresAuth() middleware conditionally
    requiresAuth()(req, res, function () {
      log.debug("OIDC ------> requiresAuth");
      // Check if user is authenticated
      if (req.oidc.isAuthenticated()) {
        log.debug("[OIDC] ------> User isAuthenticated");
        handleHostProtected(req);
        next();
      } else {
        // User is not authenticated
        res.status(401).send("Unauthorized");
      }
    });
  } else {
    next();
  }
}

// Mattermost config
const mattermostCfg = {
  enabled: config.mattermost.enabled,
  server_url: config.mattermost.serverUrl,
  username: config.mattermost.username,
  password: config.mattermost.password,
  token: config.mattermost.token,
  roomTokenExpire: config.mattermost.roomTokenExpire,
  encryptionKey: config.jwt.key,
  security: hostCfg.protected || OIDC.enabled,
  api_disabled: api_disabled,
};

// stats configuration
const statsData = config.stats;

// directory
const dir = {
  public: path.join(__dirname, "../../", "public"),
};
// html views
const views = {
  client: path.join(__dirname, "../../", "public/views/client.html"),
  landing: path.join(__dirname, "../../", "public/views/landing.html"),
  login: path.join(__dirname, "../../", "public/views/login.html"),
  stunTurn: path.join(__dirname, "../../", "public/views/testStunTurn.html"),
};

// Branding configuration
const brandHtmlInjection = config.brand?.htmlInjection ?? true;

// File to cache and inject custom HTML data like OG tags and any other elements.
const filesPath = [views.landing, views.client];
const htmlInjector = new HtmlInjector(filesPath, config.brand || null);

const channels = {}; // collect channels
const sockets = {}; // collect sockets
const peers = {}; // collect peers info grp by channels
const presenters = {}; // collect presenters grp by channels
// Server-only lookup of peer_uuid grp by channel, used to detect a peer
// reconnecting under a new socket.id (e.g. after a network drop) so it isn't
// miscounted as a second person. Never sent to clients - unlike `peers`,
// which is broadcast wholesale via "addPeer".
const peerUUIDs = {};

// Học viên không được tự "tạo phòng" (vào phòng trống) - chỉ vào được
// phòng đang có giáo viên/admin, hoặc phòng giáo viên/admin vừa rời đi
// / mất kết nối chưa quá 15 phút (roomTeacherGraceEnter/Evict bên
// dưới, trong handler "join"). roomLastTeacherSeenAt: channel -> lúc
// giáo viên/admin cuối cùng rời phòng (ms). roomEvictionTimers: channel
// -> hẹn giờ tự đuổi học viên còn sót lại nếu hết 15 phút mà giáo viên
// chưa quay lại - huỷ hẹn giờ cũ mỗi khi có giáo viên/admin vào lại
// trước khi nó kịp chạy.
const roomLastTeacherSeenAt = {};
const roomEvictionTimers = {};
const HOCVIEN_ROOM_GRACE_MS = 15 * 60 * 1000;

// Học viên bị chặn (phòng chưa có giáo viên/admin) không bị ngắt kết
// nối - đứng chờ ở màn hình "vui lòng đợi", vẫn giữ socket sống. channel
// -> { [socket.id]: socket }. Ngay khi có giáo viên/admin vào phòng đó,
// server báo cho từng socket đang chờ để client tự thử "join" lại (xem
// io.use "join" - phát hiện waiting qua socket.waitingChannel để dọn
// dẹp đúng chỗ lúc disconnect).
const roomWaitingSockets = {};

const roomMetaKeys = new Set(["lock", "password"]);

function getPeerCount(roomId) {
  if (!peers[roomId]) return 0;
  return Object.keys(peers[roomId]).filter((k) => !roomMetaKeys.has(k)).length;
}

/**
 * Huỷ hẹn giờ tự đuổi học viên đang chờ (nếu có) cho 1 phòng - gọi khi
 * có giáo viên/admin vào lại trước khi hết 15 phút, hoặc khi phòng đã
 * trống hẳn (không còn gì để đuổi).
 * @param {string} channel
 */
function clearTeacherGraceState(channel) {
  if (roomEvictionTimers[channel]) {
    clearTimeout(roomEvictionTimers[channel]);
    delete roomEvictionTimers[channel];
  }
  delete roomLastTeacherSeenAt[channel];
}

/**
 * Hẹn giờ 15 phút - nếu hết giờ mà phòng vẫn chưa có giáo viên/admin
 * nào quay lại, tự đuổi hết học viên còn sót lại trong phòng. Chỉ emit
 * sự kiện báo cho client - client tự disconnect() chính nó rồi mới
 * chuyển hướng (y hệt cách "kickOut"/"duplicateSession" đang làm ở
 * public/js/client.js), không tự gọi removePeerFrom ở đây vì hàm đó là
 * closure riêng theo từng kết nối, không gọi được từ setTimeout module-
 * level này - handler "disconnect" client tự kích hoạt sẽ lo phần đó.
 * @param {string} channel
 */
function scheduleTeacherGraceEviction(channel) {
  if (roomEvictionTimers[channel]) {
    clearTimeout(roomEvictionTimers[channel]);
  }
  roomEvictionTimers[channel] = setTimeout(() => {
    delete roomEvictionTimers[channel];
    // Luôn dọn mốc thời gian khi hết giờ, DÙ phòng lúc này trống hẳn
    // hay không - nếu không xoá ở đây, phòng trống hẳn trước khi hết
    // giờ (channels[channel] đã bị xoá, return sớm bên dưới) sẽ khiến
    // roomLastTeacherSeenAt nằm lại trong bộ nhớ mãi mãi.
    delete roomLastTeacherSeenAt[channel];

    // Giáo viên/admin đã quay lại trước khi hết giờ - không đuổi ai
    // (clearTeacherGraceState() lẽ ra đã huỷ timer này rồi, nhưng
    // phòng hờ trường hợp race).
    if (Object.keys(presenters[channel] || {}).length > 0) return;

    const roomSockets = channels[channel];
    if (!roomSockets) return; // phòng đang trống, không có ai để đuổi

    for (const peerSocket of Object.values(roomSockets)) {
      if (!peerSocket || peerSocket.supabaseRole !== "hocvien") continue;
      peerSocket.emit("teacherGraceExpired");
    }
  }, HOCVIEN_ROOM_GRACE_MS);
}

app.set("trust proxy", trustProxy); // Enables trust for proxy headers (e.g., X-Forwarded-For) based on the trustProxy setting

// Guardrail: IP_WHITELIST_ENABLED=true without TRUST_PROXY=true is almost always a
// misconfiguration. Refuse to start unless explicitly acknowledged via
// IP_WHITELIST_ALLOW_UNTRUSTED_PROXY=true (then only the direct socket IP is matched).
if (ipWhitelist.enabled && !trustProxy) {
  const optIn =
    String(
      process.env.IP_WHITELIST_ALLOW_UNTRUSTED_PROXY || "",
    ).toLowerCase() === "true";
  if (!optIn) {
    log.error(
      "IP_WHITELIST_ENABLED=true requires TRUST_PROXY=true so that the real client IP can be resolved from a trusted reverse proxy. " +
        "Without it, X-Forwarded-For is attacker-controlled and the allow-list can be bypassed. " +
        "If this instance has no proxy in front and you understand that only direct socket addresses will be evaluated, " +
        "set IP_WHITELIST_ALLOW_UNTRUSTED_PROXY=true to acknowledge.",
      { trustProxy, ipWhitelist },
    );
    process.exit(1);
  }
  log.warn(
    "IP_WHITELIST_ENABLED=true with TRUST_PROXY=false (acknowledged): X-Forwarded-For will be ignored and only the direct socket address is checked.",
  );
}

app.use(helmet.noSniff()); // Enable content type sniffing prevention
app.use(applyEmbedHeaders); // Apply iframe embedding restrictions (CSP frame-ancestors / X-Frame-Options)

// Use all static files from the public folder
const staticOptions = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
    }
    // Add other headers if needed...
  },
};

// Serve static files from root (/)
app.use(express.static(dir.public, staticOptions));

// Also serve the same files under /mattermost
app.use("/mattermost", express.static(dir.public, staticOptions));

app.use(cors(corsOptions)); // Enable CORS with options
app.use(compression()); // Compress all HTTP responses using GZip
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(
  apiBasePath + "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument),
); // api docs

// Restrict access to specified IP
app.use((req, res, next) => {
  if (!ipWhitelist.enabled) return next();
  const clientIP = getIP(req);
  log.debug("Check IP", clientIP);
  if (ipWhitelist.allowed.includes(clientIP)) {
    next();
  } else {
    log.info("Forbidden: Access denied from this IP address", {
      clientIP: clientIP,
    });
    res.status(403).json({
      error: "Forbidden",
      message: "Access denied from this IP address.",
    });
  }
});

app.use((req, res, next) => {
  const ipAddress = getIP(req);
  log.debug("New request:", {
    ip: ipAddress,
    method: req.method,
    path: req.originalUrl,
    body: req.body,
    //headers: req.headers,
  });
  next();
});

// Mattermost
const mattermost = new MattermostController(
  app,
  mattermostCfg,
  htmlInjector,
  views.client,
);

// Remove trailing slashes in url handle bad requests
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    log.error("Request Error", {
      header: req.headers,
      body: req.body,
      error: err.message,
    });
    return res.status(400).send({ status: 400, message: "Invalid JSON" }); // Bad request
  }
  if (req.path.substr(-1) === "/" && req.path.length > 1) {
    let query = req.url.slice(req.path.length);
    res.redirect(301, req.path.slice(0, -1) + query);
  } else {
    next();
  }
});

// OpenID Connect - Cache auth() middleware instead of re-creating per request
if (OIDC.enabled) {
  if (OIDC.baseUrlDynamic) {
    // Build an allowlist of origins permitted to be used as the OIDC baseURL.
    // This prevents Host-header injection from rewriting the redirect_uri
    // (see: https://portswigger.net/web-security/host-header).
    // Sources, in order of precedence:
    //   1. config.oidc.allowedDynamicBaseURLs (string[] of full origins)
    //   2. config.oidc.config.baseURL (always trusted)
    const configuredAllowlist = Array.isArray(OIDC.allowedDynamicBaseURLs)
      ? OIDC.allowedDynamicBaseURLs
      : [];
    const allowedOrigins = new Set(
      [OIDC.config?.baseURL, ...configuredAllowlist]
        .filter(Boolean)
        .map((u) => {
          try {
            return new URL(u).origin;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    );

    // Cache a middleware instance per host
    const authMiddlewareCache = new Map();

    app.use((req, res, next) => {
      const host = req.headers.host;
      const protocol = req.protocol === "https" ? "https" : "http";
      const cacheKey = `${protocol}://${host}`;

      // Reject Host headers that are not in the configured allowlist.
      // Without this, an attacker can force the OIDC library to emit a
      // redirect_uri pointing to an attacker-controlled domain.
      if (!allowedOrigins.has(cacheKey)) {
        log.warn("OIDC Host header not in allowlist - rejecting request", {
          host,
          origin: cacheKey,
          allowed: [...allowedOrigins],
        });
        return res.status(400).send("Bad Request: invalid Host header");
      }

      if (!authMiddlewareCache.has(cacheKey)) {
        const config = { ...OIDC.config, baseURL: cacheKey };
        authMiddlewareCache.set(cacheKey, auth(config));
      }

      try {
        authMiddlewareCache.get(cacheKey)(req, res, next);
      } catch (err) {
        log.error("OIDC Auth Middleware Error", err);
        process.exit(1);
      }
    });
  } else {
    // Static baseURL: create the middleware once
    app.use(auth(OIDC.config));
  }
}

// Route to display user information
app.get("/profile", OIDCAuth, (req, res) => {
  if (OIDC.enabled) {
    log.debug("OIDC User profile requested", req.oidc.user);
    return res.json(req.oidc.user); // Send user information as JSON
  }
  return res.json({ profile: false });
});

// Authentication Callback Route
app.get("/auth/callback", (req, res, next) => {
  next(); // Let express-openid-connect handle this route
});

// Logout Route
app.get("/logout", (req, res) => {
  if (OIDC.enabled) {
    //
    if (hostCfg.protected) {
      const ip = authHost.getIP(req);
      if (authHost.isAuthorizedIP(ip)) {
        authHost.deleteIP(ip);
      }
      hostCfg.authenticated = false;
      //
      log.debug("[OIDC] ------> Logout", {
        authenticated: hostCfg.authenticated,
        authorizedIPs: authHost.getAuthorizedIPs(),
      });
    }
    req.logout(); // Logout user
  }
  res.redirect("/"); // Redirect to the home page after logout
});

// Trang đăng nhập - link ngắn cho /views/login.html
app.get("/login", (req, res) => {
  res.sendFile(views.login);
});

// main page
app.get("/", OIDCAuth, (req, res) => {
  if (!OIDC.enabled && hostCfg.protected) {
    hostCfg.authenticated = false;
    res.redirect("/login");
  } else {
    return htmlInjector.injectHtml(views.landing, res);
  }
});

// Get stats endpoint
app.get("/stats", (req, res) => {
  //log.debug('Send stats', statsData);
  res.send(statsData);
});

// test Stun and Turn connections
app.get(["/icetest"], (req, res) => {
  if (Object.keys(req.query).length > 0) {
    log.debug("Request Query", req.query);
  }
  res.sendFile(views.stunTurn);
});

// Check if room active (exists)
app.post("/isRoomActive", (req, res) => {
  const { roomId } = checkXSS(req.body);

  if (roomId && (hostCfg.protected || hostCfg.user_auth || OIDC.enabled)) {
    const roomActive = Object.prototype.hasOwnProperty.call(peers, roomId);
    if (roomActive) log.debug("isRoomActive", { roomId, roomActive });
    res.status(200).json({ message: roomActive });
  } else {
    res.status(400).json({ message: "Unauthorized" });
  }
});

// Receive a ~30s recording chunk from the presenter's browser and append it
// (in order) to that session's temp file on disk. Auth is via the opaque
// token minted by the "recordingSessionStart" socket handshake below - a
// plain HTTP POST has no socket.id to check isPeerPresenter against directly.
app.post(
  "/recording/chunk",
  express.raw({
    type: "application/octet-stream",
    limit: config.recording.maxChunkBytes,
  }),
  async (req, res) => {
    const token = req.get("X-Recording-Session-Token");
    const chunkIndex = parseInt(req.get("X-Recording-Chunk-Index"), 10);
    const isFinal = req.get("X-Recording-Final") === "1";
    const result = await Recording.appendChunk(
      token,
      chunkIndex,
      isFinal,
      req.body,
    );
    res.status(result.ok ? 200 : 409).json(result);
  },
);

// Check if Widget room active (exists)
app.post("/isWidgetRoomActive", (req, res) => {
  const { roomId } = checkXSS(req.body);
  const roomWidgetActive =
    roomId &&
    roomId === config.brand?.widget?.roomId &&
    Object.prototype.hasOwnProperty.call(peers, roomId);
  log.debug("isWidgetRoomActive", { roomId, roomWidgetActive });
  res.status(200).json({ message: roomWidgetActive });
});

// Handle Direct join room with params
app.get("/join/", async (req, res) => {
  if (Object.keys(req.query).length > 0) {
    log.debug("Request Query", req.query);
    /* 
            http://localhost:3000/join?room=test&name=mirotalk&audio=1&video=1&screen=0&chat=1&notify=0&hide=0
            https://p2p.mirotalk.com/join?room=test&name=mirotalk&audio=1&video=1&screen=0&chat=1&notify=0&hide=0&duration=00:00:30
            https://mirotalk.up.railway.app/join?room=test&name=mirotalk&audio=1&video=1&screen=0&chat=1&notify=0&hide=0
        */
    const {
      room,
      name,
      audio,
      video,
      screen,
      chat,
      notify,
      hide,
      duration,
      token,
    } = checkXSS(req.query);

    if (!room) {
      log.warn("/join/params room empty", room);
      return res.status(401).json({
        message: "Direct Room Join: Missing mandatory room parameter!",
      });
    }

    if (!Validate.isValidRoomName(room)) {
      return res.status(400).json({
        message: "Invalid Room name!\nPath traversal pattern detected!",
      });
    }

    const allowRoomAccess = isAllowedRoomAccess(
      "/join/params",
      req,
      hostCfg,
      peers,
      room,
    );

    if (!allowRoomAccess && !token) {
      return res.status(401).json({ message: "Direct Room Join Unauthorized" });
    }

    let peerUsername,
      peerPassword = "";
    let isPeerValid = false;
    let isPeerPresenter = false;

    if (token) {
      try {
        // Check if valid JWT token
        const validToken = await isValidToken(token);

        // Not valid token
        if (!validToken) {
          return res.status(401).json({ message: "Invalid Token" });
        }

        const { username, password, presenter } = checkXSS(decodeToken(token));
        // Peer credentials
        peerUsername = username;
        peerPassword = password;
        // Check if valid peer
        isPeerValid = isAuthPeer(username, password);
        // Check if presenter
        isPeerPresenter = presenter === "1" || presenter === "true";
      } catch (err) {
        // Invalid token
        log.error("Direct Join JWT error", err.message);
        return htmlInjector.injectHtml(views.landing, res);
      }
    }

    const OIDCUserAuthenticated = OIDC.enabled && req.oidc.isAuthenticated();

    // Peer valid going to auth as host
    if (
      (hostCfg.protected &&
        isPeerValid &&
        isPeerPresenter &&
        !hostCfg.authenticated) ||
      OIDCUserAuthenticated
    ) {
      const ip = getIP(req);
      hostCfg.authenticated = true;
      authHost.setAuthorizedIP(ip, true);
      log.debug("Direct Join user auth as host done", {
        ip: ip,
        username: peerUsername,
        password: peerPassword,
      });
    }

    // Check if peer authenticated or valid
    if (room && (hostCfg.authenticated || isPeerValid)) {
      // only room mandatory
      return htmlInjector.injectHtml(views.client, res);
    } else {
      return htmlInjector.injectHtml(views.landing, res);
    }
  }
});

// Join Room by id
app.get("/join/:roomId", function (req, res) {
  //
  const { roomId } = req.params;

  if (!roomId) {
    log.warn("/join/:roomId empty", roomId);
    return res.redirect("/");
  }

  if (!Validate.isValidRoomName(roomId)) {
    log.warn("/join/:roomId invalid", roomId);
    return res.redirect("/");
  }

  const allowRoomAccess = isAllowedRoomAccess(
    "/join/:roomId",
    req,
    hostCfg,
    peers,
    roomId,
  );

  if (allowRoomAccess) {
    htmlInjector.injectHtml(views.client, res);
  } else if (OIDC.enabled || hostCfg.protected) {
    htmlInjector.injectHtml(views.login, res);
  } else {
    res.redirect("/");
  }
});

// Not specified correctly the room id
app.get("/join/\\*", function (req, res) {
  res.redirect("/");
});

// UI buttons configuration
app.get("/buttons", (req, res) => {
  res.status(200).json({ message: config.buttons ? config.buttons : false });
});

// UI brand configuration
app.get("/brand", (req, res) => {
  res.status(200).json({
    message: config.brand && brandHtmlInjection ? config.brand : false,
  });
});

// Link lỗi/không xác định (không phải /join/xxx, /api/..., v.v.) -> về
// landing page. KHÔNG tự hiểu path lạ là tên phòng nữa (hành vi gốc
// của MiroTalk là redirect sang /join/:roomId, nhưng web này giờ là hệ
// thống đóng, chỉ vào phòng qua đúng link /join/... hoặc từ landing).
app.get("/:roomId", (req, res) => {
  log.debug("Unknown top-level path --> redirect to landing", req.params);
  res.redirect("/");
});

/**
    MiroTalk API v1
    For api docs we use: https://swagger.io/
*/

// request stats list
app.get(`${apiBasePath}/stats`, (req, res) => {
  // Check if endpoint allowed
  if (api_disabled.includes("stats")) {
    return res.status(403).json({
      error:
        "This endpoint has been disabled. Please contact the administrator for further information.",
    });
  }
  // check if user was authorized for the api call
  const { host, authorization } = req.headers;
  const api = new ServerApi(host, authorization, api_key_secret);
  if (!api.isAuthorized()) {
    log.debug("MiroTalk get stats - Unauthorized", {
      header: req.headers,
      body: req.body,
    });
    return res.status(403).json({ error: "Unauthorized!" });
  }
  // Get stats
  const { timestamp, totalRooms, totalPeers } = api.getStats(peers);
  res.json({
    success: true,
    timestamp,
    totalRooms,
    totalPeers,
  });
  // log.debug the output if all done
  log.debug("MiroTalk get stats - Authorized", {
    header: req.headers,
    body: req.body,
    timestamp,
    totalRooms,
    totalPeers,
  });
});

// request token endpoint
app.post(`${apiBasePath}/token`, (req, res) => {
  // Check if endpoint allowed
  if (api_disabled.includes("token")) {
    return res.status(403).json({
      error:
        "This endpoint has been disabled. Please contact the administrator for further information.",
    });
  }
  // check if user was authorized for the api call
  const { host, authorization } = req.headers;
  const api = new ServerApi(host, authorization, api_key_secret);
  if (!api.isAuthorized()) {
    log.debug("MiroTalk get token - Unauthorized", {
      header: req.headers,
      body: req.body,
    });
    return res.status(403).json({ error: "Unauthorized!" });
  }
  // Get Token
  const token = api.getToken(req.body);
  res.json({ token: token });
  // log.debug the output if all done
  log.debug("MiroTalk get token - Authorized", {
    header: req.headers,
    body: req.body,
    token: token,
  });
});

// request meetings list
app.get(`${apiBasePath}/meetings`, (req, res) => {
  // Check if endpoint allowed
  if (api_disabled.includes("meetings")) {
    return res.status(403).json({
      error:
        "This endpoint has been disabled. Please contact the administrator for further information.",
    });
  }
  // check if user was authorized for the api call
  const { host, authorization } = req.headers;
  const api = new ServerApi(host, authorization, api_key_secret);
  if (!api.isAuthorized()) {
    log.debug("MiroTalk get meetings - Unauthorized", {
      header: req.headers,
      body: req.body,
    });
    return res.status(403).json({ error: "Unauthorized!" });
  }
  // Get meetings
  const meetings = api.getMeetings(peers);
  res.json({ meetings: meetings });
  // log.debug the output if all done
  log.debug("MiroTalk get meetings - Authorized", {
    header: req.headers,
    body: req.body,
    meetings: meetings,
  });
});

// API request meeting room endpoint
app.post(`${apiBasePath}/meeting`, (req, res) => {
  // Check if endpoint allowed
  if (api_disabled.includes("meeting")) {
    return res.status(403).json({
      error:
        "This endpoint has been disabled. Please contact the administrator for further information.",
    });
  }
  const { host, authorization } = req.headers;
  const api = new ServerApi(host, authorization, api_key_secret);
  if (!api.isAuthorized()) {
    log.debug("MiroTalk get meeting - Unauthorized", {
      header: req.headers,
      body: req.body,
    });
    return res.status(403).json({ error: "Unauthorized!" });
  }
  const meetingURL = api.getMeetingURL();
  res.json({ meeting: meetingURL });
  log.debug("MiroTalk get meeting - Authorized", {
    header: req.headers,
    body: req.body,
    meeting: meetingURL,
  });
});

// API request join room endpoint
app.post(`${apiBasePath}/join`, (req, res) => {
  // Check if endpoint allowed
  if (api_disabled.includes("join")) {
    return res.status(403).json({
      error:
        "This endpoint has been disabled. Please contact the administrator for further information.",
    });
  }
  const { host, authorization } = req.headers;
  const api = new ServerApi(host, authorization, api_key_secret);
  if (!api.isAuthorized()) {
    log.debug("MiroTalk get join - Unauthorized", {
      header: req.headers,
      body: req.body,
    });
    return res.status(403).json({ error: "Unauthorized!" });
  }
  const joinURL = api.getJoinURL(req.body);
  res.json({ join: joinURL });
  log.debug("MiroTalk get join - Authorized", {
    header: req.headers,
    body: req.body,
    join: joinURL,
  });
});

/*
    MiroTalk Slack app v1
    https://api.slack.com/authentication/verifying-requests-from-slack
*/

// Slack request meeting room endpoint
app.post("/slack", (req, res) => {
  if (!slackEnabled)
    return res.end("`Under maintenance` - Please check back soon.");

  // Check if endpoint allowed
  if (api_disabled.includes("slack")) {
    return res.end(
      "`This endpoint has been disabled`. Please contact the administrator for further information.",
    );
  }

  log.debug("Slack", req.headers);

  if (!slackSigningSecret) return res.end("`Slack Signing Secret is empty!`");

  const slackSignature = req.headers["x-slack-signature"];
  const requestBody = qS.stringify(req.body, { format: "RFC1738" });
  const timeStamp = req.headers["x-slack-request-timestamp"];
  const time = Math.floor(new Date().getTime() / 1000);

  // The request timestamp is more than five minutes from local time. It could be a replay attack, so let's ignore it.
  if (Math.abs(time - timeStamp) > 300)
    return res.end("`Wrong timestamp` - Ignore this request.");

  // Get Signature to compare it later
  const sigBaseString = "v0:" + timeStamp + ":" + requestBody;
  const mySignature =
    "v0=" + CryptoJS.HmacSHA256(sigBaseString, slackSigningSecret);

  // Valid Signature return a meetingURL
  if (mySignature == slackSignature) {
    const host = req.headers.host;
    const meetingURL = getMeetingURL(host);
    log.debug("Slack", { meeting: meetingURL });
    return res.end(meetingURL);
  }
  // Something wrong
  return res.end("`Wrong signature` - Verification failed!");
});

/**
 * Request meeting room endpoint
 * @returns  entrypoint / Room URL for your meeting.
 */
function getMeetingURL(host) {
  return (
    "http" +
    (host.includes("localhost") ? "" : "s") +
    "://" +
    host +
    "/join/" +
    uuidV4()
  );
}

// end of MiroTalk API v1

// Không tìm thấy trang, tự động đẩy về trang chủ
app.use((req, res) => {
  res.redirect("/");
});

// Global error handler for URIError and other errors
app.use((err, req, res, next) => {
  if (err instanceof URIError) {
    log.warn("Malformed URI detected", {
      url: req.url,
      ip: getIP(req),
      error: err.message,
    });
    return res
      .status(400)
      .send({ status: 400, message: "Invalid URL encoding" });
  }
  // Handle other errors
  log.error("Unhandled error", {
    url: req.url,
    error: err.message,
    stack: err.stack,
  });
  res.status(500).send({ status: 500, message: "Internal server error" });
});

/**
 * Get Server config
 * @param {string} tunnel
 * @returns server config
 */
function getServerConfig(tunnel = false) {
  return {
    // General Server Information
    server: host,
    server_tunnel: tunnel,
    trust_proxy: trustProxy,
    api_docs: api_docs,

    // Core Configurations
    jwtCfg: jwtCfg,
    cors: corsOptions,
    embed: {
      allowedOrigins: embedAllowedOrigins.length ? embedAllowedOrigins : "any",
      csp: embedCsp
        ? embedCsp.csp
        : "not set (embedding allowed from any origin)",
    },
    iceServers: iceServers,
    test_ice_servers: testStunTurn,
    email: nodemailer.emailCfg.alert ? nodemailer.emailCfg : false,

    // Security, Authorization, and User Management
    oidc: OIDC.enabled ? OIDC : false,
    host_protected: hostCfg.protected || hostCfg.user_auth ? hostCfg : false,
    presenters: roomPresenters,
    ip_whitelist: ipWhitelist.enabled ? ipWhitelist : false,
    api_key_secret: api_key_secret,

    // Media and Connection Settings
    turn_enabled: turnServerEnabled,
    ip_lookup_enabled: IPLookupEnabled,

    // Integrations
    slack_enabled: slackEnabled,
    mattermost_enabled: mattermostCfg.enabled ? mattermostCfg : false,
    webhook: webhook.enabled ? webhook : false,

    // Monitoring and Logging
    sentry_enabled: sentryEnabled,
    stats: statsData.enabled ? statsData : false,

    // Ngrok Configuration
    ngrok: ngrokEnabled
      ? {
          enabled: ngrokEnabled,
          token: ngrokAuthToken,
        }
      : false,

    // URLs for Redirection and Survey
    survey: surveyEnabled ? surveyURL : false,
    redirect: redirectEnabled ? redirectURL : false,

    // Widget Configuration
    widget: config.brand?.widget?.enabled ? config.brand.widget : false,

    // Versions and environment information
    environment: config.server.environment,
    app_version: packageJson.version,
    node_version: process.versions.node,
  };
}

/**
 * Expose server to external with https tunnel using ngrok
 * https://ngrok.com
 */
async function ngrokStart() {
  try {
    await ngrok.authtoken(ngrokAuthToken);
    const listener = await ngrok.forward({ addr: port });
    const tunnelUrl = listener.url();
    log.info("Server config", getServerConfig(tunnelUrl));
  } catch (err) {
    log.warn("[Error] ngrokStart", err);
    await ngrok.kill();
    process.exit(1);
  }
}

/**
 * Start Local Server with ngrok https tunnel (optional)
 */
server.listen(port, "0.0.0.0", async () => {
  log.debug(
    `%c

	███████╗██╗ ██████╗ ███╗   ██╗      ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ 
	██╔════╝██║██╔════╝ ████╗  ██║      ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗
	███████╗██║██║  ███╗██╔██╗ ██║█████╗███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝
	╚════██║██║██║   ██║██║╚██╗██║╚════╝╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗
	███████║██║╚██████╔╝██║ ╚████║      ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║
	╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝      ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝ started...

	`,
    "font-family:monospace",
  );

  // Pick back up any recording temp files left behind by an ungraceful
  // restart (no SIGTERM handler exists in this codebase - a `pm2 restart`
  // mid-recording is a real scenario) and finish finalizing/uploading them.
  Recording.recoverOnStartup();

  // https tunnel
  if (ngrokEnabled) {
    await ngrokStart();
  } else {
    log.info("Server config", getServerConfig());
  }

  // Warn if default secrets are still in use
  if (api_key_secret === "mirotalkp2p_default_secret") {
    log.warn(
      "WARNING: API_KEY_SECRET is set to the default value. Change it before deploying!",
    );
  }
  if (jwtCfg.JWT_KEY === "mirotalk_jwt_secret") {
    log.warn(
      "WARNING: JWT_SECRET is set to the default value. Change it before deploying!",
    );
  }
});

/**
 * On peer connected
 * Users will connect to the signaling server, after which they'll issue a "join"
 * to join a particular channel. The signaling server keeps track of all sockets
 * who are in a channel, and on join will send out 'addPeer' events to each pair
 * of users in a channel. When clients receive the 'addPeer' even they'll begin
 * setting up an RTCPeerConnection with one another. During this process they'll
 * need to relay ICECandidate information to one another, as well as SessionDescription
 * information. After all of that happens, they'll finally be able to complete
 * the peer connection and will be in streaming audio/video between eachother.
 */
io.sockets.on("connect", async (socket) => {
  log.debug("[" + socket.id + "] connection accepted", {
    host: socket.handshake.headers.host.split(":")[0],
    time: socket.handshake.time,
  });

  socket.channels = {};
  sockets[socket.id] = socket;

  const transport = socket.conn.transport.name; // in most cases, "polling"
  log.debug("[" + socket.id + "] Connection transport", transport);

  /**
   * Check upgrade transport
   */
  socket.conn.on("upgrade", () => {
    const upgradedTransport = socket.conn.transport.name; // in most cases, "websocket"
    log.debug(
      "[" + socket.id + "] Connection upgraded transport",
      upgradedTransport,
    );
  });

  /**
   * On peer disconnected
   */
  socket.on("disconnect", async (reason) => {
    removeIP(socket);
    // Finalize any recording session this socket owned right away, instead
    // of waiting out the full idle timeout - the idle timeout remains the
    // safety net for crashes/power-loss where no disconnect ever fires.
    Recording.finalizeForPeer(socket.id);
    for (let channel in socket.channels) {
      await removePeerFrom(channel, socket, reason);
    }
    // Học viên đang đứng chờ (chưa vào phòng thật) đóng tab/mất mạng -
    // dọn khỏi danh sách chờ, không phải channel nào cũng nằm trong
    // socket.channels vì họ chưa từng "vào" được phòng.
    if (socket.waitingChannel) {
      delete roomWaitingSockets[socket.waitingChannel]?.[socket.id];
      delete socket.waitingChannel;
    }
    log.debug("[" + socket.id + "] disconnected", { reason: reason });
    delete sockets[socket.id];
  });

  /**
   * Handle incoming data, res with a callback
   */
  socket.on("data", async (dataObj, cb) => {
    const data = checkXSS(dataObj);

    log.debug("Socket Promise", data);

    if (!Validate.isValidData(data)) return;

    //...
    const { room_id, peer_id, peer_name, method, params } = data;

    switch (method) {
      case "checkPeerName":
        log.debug("Check if peer name exists", {
          peer_name: peer_name,
          room_id: room_id,
        });
        for (let id in peers[room_id]) {
          if (peer_id != id && peers[room_id][id]["peer_name"] == peer_name) {
            log.debug("Peer name found", {
              peer_name: peer_name,
              room_id: room_id,
            });
            cb(true);
            break;
          }
        }
        break;
      //....
      default:
        cb(false);
        break;
    }
    cb(false);
  });

  /**
   * On peer join
   */
  socket.on("join", async (cfg) => {
    // Get peer IPv4 (::1 Its the loopback address in ipv6, equal to 127.0.0.1 in ipv4)
    const peer_ip = getSocketIP(socket);

    // Get peer Geo Location
    if (IPLookupEnabled && peer_ip != "::1") {
      cfg.peer_geo = await getPeerGeoLocation(peer_ip);
    }

    // Prevent XSS injection
    const config = checkXSS(cfg);

    if (!Validate.isValidData(config)) return;

    // log.debug('Join room', config);
    log.debug("[" + socket.id + "] join ", config);

    const {
      channel,
      channel_password,
      peer_uuid,
      peer_name,
      peer_avatar,
      peer_token,
      peer_video,
      peer_audio,
      peer_video_status,
      peer_audio_status,
      peer_screen_status,
      peer_hand_status,
      peer_rec_status,
      peer_info,
    } = config;

    if (!Validate.isValidRoomName(channel)) {
      log.warn("[" + socket.id + "] - Invalid room name", channel);
      return socket.emit("unauthorized");
    }

    if (channel in socket.channels) {
      return log.debug("[" + socket.id + "] [Warning] already joined", channel);
    }
    // no channel aka room in channels init
    if (!(channel in channels)) channels[channel] = {};

    // no channel aka room in peers init
    if (!(channel in peers)) peers[channel] = {};

    // no presenter aka host in presenters init
    if (!(channel in presenters)) presenters[channel] = {};

    let is_presenter = true;

    // User Auth required, we check if peer valid
    if (hostCfg.user_auth || peer_token) {
      // Check JWT
      if (peer_token) {
        try {
          const validToken = await isValidToken(peer_token);

          if (!validToken) {
            // redirect peer to login page
            return socket.emit("unauthorized");
          }

          const { username, password, presenter } = checkXSS(
            decodeToken(peer_token),
          );

          const isPeerValid = isAuthPeer(username, password);

          if (!isPeerValid) {
            // redirect peer to login page
            return socket.emit("unauthorized");
          }

          // Presenter if token 'presenter' is '1'/'true' or first to join room
          is_presenter =
            presenter === "1" ||
            presenter === "true" ||
            Object.keys(presenters[channel]).length === 0;

          log.debug("[" + socket.id + "] JOIN ROOM - USER AUTH check peer", {
            ip: peer_ip,
            peer_username: username,
            peer_password: password,
            peer_valid: isPeerValid,
            peer_presenter: is_presenter,
          });
        } catch (err) {
          // redirect peer to login page
          log.error(
            "[" + socket.id + "] [Warning] Join Room JWT error",
            err.message,
          );
          return socket.emit("unauthorized");
        }
      } else {
        // redirect peer to login page
        return socket.emit("unauthorized");
      }
    }

    // room locked by the participants can't join
    if (
      peers[channel]["lock"] === true &&
      peers[channel]["password"] != channel_password
    ) {
      log.debug("[" + socket.id + "] [Warning] Room Is Locked", channel);
      return socket.emit("roomIsLocked");
    }

    // Phòng đã đủ người - chặn NGAY tại đây, TRƯỚC khi đưa vào
    // peers/channels và trước khi báo "addPeer" cho ai khác trong
    // phòng. Trước đây việc này chỉ bị phát hiện Ở PHÍA CLIENT
    // (handleServerInfo), sau khi server đã cho vào hẳn và đã báo cho
    // những người có sẵn trong phòng rằng có người mới tới - rồi client
    // tự ngắt kết nối ngay sau đó, khiến những người có sẵn lại thấy
    // thông báo người đó "rời phòng" dù họ chưa từng thực sự ở trong
    // phòng - rất vô lý. Chặn ở đây thì không ai khác biết gì về lượt
    // vào hụt này cả.
    //
    // Trừ đi entry cũ trùng peer_uuid của CHÍNH người đang join (nếu có)
    // trước khi so với maxRoomParticipants - đây là fix cho bug "mất
    // mạng giữa cuộc gọi -> kết nối lại -> Phòng đã đầy": Socket.IO có
    // thể mất tới ~45s (pingInterval 25s + pingTimeout 20s mặc định) để
    // phát hiện 1 kết nối đã chết, nên nếu người dùng kết nối lại trong
    // lúc đó, entry cũ của chính họ vẫn còn nằm trong peers[channel] và
    // vô tình tính vào giới hạn phòng. Việc evict entry cũ thật sự vẫn
    // để nguyên chỗ cũ (peer_uuid dedupe bên dưới, chạy SAU khi đã thêm
    // peer mới) - ở đây chỉ sửa công thức đếm cho đúng, không đụng gì
    // tới state, nên không ảnh hưởng tới race "peer count dip về 0"
    // mà đoạn dedupe bên dưới đang tránh.
    const staleSelfCount = peer_uuid
      ? Object.values(peerUUIDs[channel] || {}).filter((u) => u === peer_uuid)
          .length
      : 0;
    if (getPeerCount(channel) - staleSelfCount >= hostCfg.maxRoomParticipants) {
      log.debug("[" + socket.id + "] [Warning] Room Is Busy", channel);
      return socket.emit("roomIsBusy");
    }

    // Học viên không được tự "tạo phòng" (vào phòng chưa từng có ai) -
    // chỉ vào được phòng đang có giáo viên/admin, hoặc còn trong 15
    // phút ân hạn kể từ lúc giáo viên/admin cuối cùng rời phòng (xem
    // roomLastTeacherSeenAt/scheduleTeacherGraceEviction). Chỉ áp dụng
    // khi đăng nhập bắt buộc đang bật - không có khái niệm role nếu
    // Supabase chưa cấu hình.
    if (
      supabaseCfg.url &&
      supabaseCfg.anonKey &&
      socket.supabaseRole === "hocvien"
    ) {
      const hasTeacherPresent =
        Object.keys(presenters[channel]).length > 0;
      const lastTeacherSeenAt = roomLastTeacherSeenAt[channel];
      const inGracePeriod =
        lastTeacherSeenAt &&
        Date.now() - lastTeacherSeenAt <= HOCVIEN_ROOM_GRACE_MS;
      if (!hasTeacherPresent && !inGracePeriod) {
        log.debug(
          "[" + socket.id + "] [Warning] hocvien waiting - no teacher/admin in room",
          channel,
        );
        // KHÔNG disconnect - giữ socket sống, đứng chờ. Ngay khi có
        // giáo viên/admin vào phòng này, server sẽ báo cho client tự
        // gửi lại "join" (xem chỗ gán presenters[channel] bên dưới).
        if (!(channel in roomWaitingSockets)) roomWaitingSockets[channel] = {};
        roomWaitingSockets[channel][socket.id] = socket;
        socket.waitingChannel = channel;
        return socket.emit("roomWaitingForTeacher");
      }
    }

    // Set the presenters
    const presenter = {
      peer_ip: peer_ip,
      peer_name: peer_name,
      peer_uuid: peer_uuid,
      is_presenter: is_presenter,
    };

    // Recover presenter status on reconnect: if a stale presenter entry
    // exists for this user (same peer_name AND same peer_uuid) under a
    // previous socket.id, migrate it to the current socket.id. peer_uuid
    // is never broadcast to other peers, so it cannot be spoofed by
    // someone who only learned the display name.
    for (const [existingPeerID, existingPresenter] of Object.entries(
      presenters[channel],
    )) {
      if (
        existingPeerID !== socket.id &&
        existingPresenter &&
        existingPresenter.peer_name === peer_name &&
        existingPresenter.peer_uuid === peer_uuid
      ) {
        delete presenters[channel][existingPeerID];
        presenters[channel][socket.id] = presenter;
        log.debug("[" + socket.id + "] Presenter recovered on reconnect", {
          previous_peer_id: existingPeerID,
          peer_name: peer_name,
        });
        break;
      }
    }

    if (supabaseCfg.url && supabaseCfg.anonKey) {
      // Đăng nhập bắt buộc đang bật - presenter hoàn toàn theo role
      // (admin/giáo viên), KHÔNG dùng quy tắc "vào đầu tiên là chủ
      // phòng" nữa - nếu không học viên vào phòng trống trước sẽ tự
      // thành presenter, sai với yêu cầu học viên không được các
      // quyền đó dù vào lúc nào.
      if (isPresenterRole(socket.supabaseRole)) {
        presenters[channel][socket.id] = presenter;
        // Giáo viên/admin vừa vào (lại) - huỷ đếm giờ ân hạn 15 phút
        // nếu đang chạy, phòng không còn "thiếu giáo viên" nữa.
        clearTeacherGraceState(channel);

        // Báo ngay cho các học viên đang đứng chờ (màn "Giáo viên chưa
        // mở phòng") - client tự gửi lại "join", lần này sẽ qua vì đã
        // có giáo viên/admin trong phòng.
        const waiting = roomWaitingSockets[channel];
        if (waiting) {
          for (const waitingSocket of Object.values(waiting)) {
            // Kèm tên giáo viên/admin vừa vào - học viên hiện thông báo
            // "(tên) đã vào phòng." đúng người, không phải tên chính họ.
            waitingSocket.emit("roomTeacherJoined", {
              peer_name: presenter.peer_name,
            });
            delete waitingSocket.waitingChannel;
          }
          delete roomWaitingSockets[channel];
        }
      }
    } else if (roomPresenters && roomPresenters.includes(peer_name)) {
      // Hành vi gốc (không đổi) khi chưa cấu hình Supabase - dựa theo
      // username khớp PRESENTERS hoặc người vào đầu tiên.
      presenters[channel][socket.id] = presenter;
    } else {
      // if not match the presenters username, the first one join room is the presenter
      if (Object.keys(presenters[channel]).length === 0) {
        presenters[channel][socket.id] = presenter;
      }
    }

    // Check if peer is presenter, if token check the presenter key
    const isPresenter = peer_token
      ? is_presenter
      : isPeerPresenter(channel, socket.id, peer_name, peer_uuid);

    // Some peer info data
    const { osName, osVersion, browserName, browserVersion, extras } =
      peer_info;

    // Track this peer's uuid server-side only, for reconnect dedupe on the
    // next join (see above). Never included in peers[channel], which is
    // broadcast to other clients as-is.
    if (peer_uuid) {
      if (!(channel in peerUUIDs)) peerUUIDs[channel] = {};
      peerUUIDs[channel][socket.id] = peer_uuid;
    }

    // collect peers info grp by channels
    peers[channel][socket.id] = {
      peer_name: peer_name,
      peer_avatar: peer_avatar,
      peer_presenter: isPresenter,
      peer_video: peer_video,
      peer_audio: peer_audio,
      peer_video_status: peer_video_status,
      peer_audio_status: peer_audio_status,
      peer_screen_status: peer_screen_status,
      peer_hand_status: peer_hand_status,
      peer_rec_status: peer_rec_status,
      os: osName ? `${osName} ${osVersion}` : "",
      browser: browserName ? `${browserName} ${browserVersion}` : "",
      extras: extras,
    };

    // Deduplicate reconnects: peer_uuid is a stable id the client keeps in
    // localStorage across page reloads, unlike socket.id which changes on
    // every reconnect. If a network drop hasn't been detected yet (Socket.IO
    // relies on a ping-timeout, which can take up to ~45s) and the same
    // person reconnects in the meantime, the room would otherwise show two
    // entries for one real person and could wrongly count against
    // maxRoomParticipants. Evict the stale entry immediately instead of
    // waiting for the timeout, so the peer count always reflects real people.
    // Run this AFTER adding the new peer above (not before), so the peer
    // count never dips to 0 mid-eviction when this is the only occupant -
    // that would otherwise make removePeerFrom() think the room just went
    // empty and wipe peers[channel]/presenters[channel] (incl. lock state)
    // out from under this very join.
    if (peer_uuid) {
      for (const [existingId, existingUUID] of Object.entries(
        peerUUIDs[channel],
      )) {
        if (existingId === socket.id || existingUUID !== peer_uuid) continue;
        log.debug(
          "[" + socket.id + "] Duplicate peer_uuid, evicting stale peer",
          { stale_peer_id: existingId, peer_name: peer_name },
        );
        const staleSocket = sockets[existingId];
        if (staleSocket) {
          // Tell the stale tab why it's being cut off *before* tearing down
          // its connection, so its UI can show a clear message and redirect
          // instead of getting stuck on a generic "reconnecting…" banner
          // that a server-initiated disconnect will never actually resolve.
          staleSocket.emit("duplicateSession", { peer_name: peer_name });
          await removePeerFrom(channel, staleSocket, "duplicate_session");
          staleSocket.disconnect(true);
        } else {
          delete peers[channel]?.[existingId];
          delete channels[channel]?.[existingId];
          delete peerUUIDs[channel][existingId];
        }
        break;
      }
    }

    const activeRooms = getActiveRooms();

    log.debug("[Join] - active rooms and peers count", activeRooms);

    log.debug("[Join] - connected presenters grp by roomId", presenters);

    log.debug("[Join] - connected peers grp by roomId", peers);

    await addPeerTo(channel);

    channels[channel][socket.id] = socket;
    socket.channels[channel] = channel;

    const peerCounts = getPeerCount(channel);

    // Send some server info to joined peer
    await sendToPeer(socket.id, sockets, "serverInfo", {
      peers_count: peerCounts,
      host_protected: hostCfg.protected,
      user_auth: hostCfg.user_auth,
      is_presenter: isPresenter,
      survey: {
        active: surveyEnabled,
        url: surveyURL,
      },
      redirect: {
        active: redirectEnabled,
        url: redirectURL,
      },
      maxRoomParticipants: hostCfg.maxRoomParticipants,
      //...
    });

    // SCENARIO: Notify when the first user join room and is awaiting assistance...
    if (peerCounts === 1) {
      nodemailer.sendEmailAlert("join", {
        room_id: channel,
        peer_name: peer_name,
        domain: socket.handshake.headers.host.split(":")[0],
        os: osName ? `${osName} ${osVersion}` : "",
        browser: browserName ? `${browserName} ${browserVersion}` : "",
      }); // .env EMAIL_ALERT=true
    }

    // Handle WebHook
    if (webhook.enabled) {
      // Trigger a POST request when a user joins
      config.timestamp = log.getDateTime(false);
      axios
        .post(webhook.url, { event: "join", data: config }, { timeout: 5000 }) // 5 second timeout
        .then((response) => log.debug("Join event tracked:", response.data))
        .catch((error) =>
          log.error("Error tracking join event:", error.message),
        );
    }
  });

  /**
   * Relay ICE to peers
   */
  socket.on("relayICE", async (config) => {
    if (!Validate.isValidData(config)) return;
    const { peer_id, ice_candidate } = config;

    // log.debug('[' + socket.id + '] relay ICE-candidate to [' + peer_id + '] ', {
    //     address: config.ice_candidate,
    // });

    await sendToPeer(peer_id, sockets, "iceCandidate", {
      peer_id: socket.id,
      ice_candidate: ice_candidate,
    });
  });

  /**
   * Relay SDP to peers
   */
  socket.on("relaySDP", async (config) => {
    if (!Validate.isValidData(config)) return;
    const { peer_id, session_description } = config;

    log.debug(
      "[" + socket.id + "] relay SessionDescription to [" + peer_id + "] ",
      {
        type: session_description.type,
      },
    );

    await sendToPeer(peer_id, sockets, "sessionDescription", {
      peer_id: socket.id,
      session_description: session_description,
    });
  });

  /**
   * Handle Room action
   */
  socket.on("roomAction", async (cfg) => {
    // Prevent XSS injection
    const config = checkXSS(cfg);

    if (!Validate.isValidData(config)) {
      log.warn("Room action invalid data", {
        peer_id: socket.id,
        room_id: socket.room_id,
      });
      return;
    }

    //log.debug('[' + socket.id + '] Room action:', config);
    const { room_id, peer_name, peer_uuid, password, action } = config;

    if (!peers[room_id]) {
      log.warn("Room action room not found", { peer_id: socket.id, room_id });
      return;
    }

    // Check if peer is presenter using the server-controlled socket.id
    // (NOT the client-supplied peer_id) to prevent role spoofing.
    const isPresenter = isPeerPresenter(
      room_id,
      socket.id,
      peer_name,
      peer_uuid,
    );

    let room_is_locked = false;
    //
    try {
      switch (action) {
        case "lock":
          if (!isPresenter) return;
          peers[room_id]["lock"] = true;
          peers[room_id]["password"] = password;
          await sendToRoom(room_id, socket.id, "roomAction", {
            peer_name: peer_name,
            action: action,
          });
          room_is_locked = true;
          break;
        case "unlock":
          if (!isPresenter) return;
          delete peers[room_id]["lock"];
          delete peers[room_id]["password"];
          await sendToRoom(room_id, socket.id, "roomAction", {
            peer_name: peer_name,
            action: action,
          });
          break;
        case "checkPassword":
          const data = {
            peer_name: peer_name,
            action: action,
            password: password == peers[room_id]["password"] ? "OK" : "KO",
          };
          await sendToPeer(socket.id, sockets, "roomAction", data);
          break;
        default:
          break;
      }
    } catch (err) {
      log.error("Room action", toJson(err));
    }
    log.debug("[" + socket.id + "] Room " + room_id, {
      locked: room_is_locked,
      password: password,
    });
  });

  /**
   * Relay NAME to peers
   */
  socket.on("peerName", async (cfg) => {
    // Prevent XSS injection
    const config = checkXSS(cfg);

    if (!Validate.isValidData(config)) return;

    // log.debug('Peer name', config);
    const { room_id, peer_name_old, peer_name_new, peer_avatar } = config;

    let peer_id_to_update = null;

    for (let peer_id in peers[room_id]) {
      if (peer_id == socket.id) {
        peers[room_id][peer_id]["peer_name"] = peer_name_new;
        peers[room_id][peer_id]["peer_avatar"] = peer_avatar;
        // presenter
        if (presenters && presenters[room_id] && presenters[room_id][peer_id]) {
          presenters[room_id][peer_id]["peer_name"] = peer_name_new;
        }
        peer_id_to_update = peer_id;
        log.debug("[" + socket.id + "] Peer profile changed", {
          peer_name_old: peer_name_old,
          peer_name_new: peer_name_new,
        });
        break;
      }
    }

    if (peer_id_to_update) {
      const data = {
        peer_id: peer_id_to_update,
        peer_name: peer_name_new,
        peer_avatar: peer_avatar,
      };
      log.debug(
        "[" + socket.id + "] emit peerName to [room_id: " + room_id + "]",
        data,
      );

      await sendToRoom(room_id, socket.id, "peerName", data);
    }
  });

  /**
   * Handle messages
   */
  socket.on("message", async (message) => {
    const data = checkXSS(message);

    log.debug("Got message", data);

    if (!Validate.isValidData(data)) return;

    await sendToRoom(data.room_id, socket.id, "message", data);
  });

  /**
   * Relay commands to peers or specific peer in the same room
   * @param {Object} cfg - The configuration object containing command details.
   * @param {string} cfg.action - The action to be performed (e.g., 'geoLocation').
   * @param {boolean} cfg.send_to_all - Whether to send the command to all peers in the room.
   * @param {Object} cfg.data - The data associated with the command.
   */
  socket.on("cmd", async (cfg) => {
    const config = checkXSS(cfg);

    if (!Validate.isValidData(config)) return;

    const { action, send_to_all, data } = config;

    const { room_id, peer_name, peer_uuid, to_peer_id } = data;

    log.debug("cmd", config);

    // Only the presenter can do this actions
    const presenterActions = ["geoLocation"];
    if (presenterActions.some((v) => action === v)) {
      // Authorize using the server-controlled socket.id, not the
      // client-supplied peer_id, to prevent role spoofing.
      const isPresenter = isPeerPresenter(
        room_id,
        socket.id,
        peer_name,
        peer_uuid,
      );
      // if not presenter do nothing
      if (!isPresenter) return;
    }

    if (send_to_all) {
      log.debug(
        "[" + socket.id + "] emit cmd to [room_id: " + room_id + "]",
        config,
      );

      await sendToRoom(room_id, socket.id, "cmd", config);
    } else {
      log.debug(
        "[" +
          socket.id +
          "] emit cmd to [" +
          to_peer_id +
          "] from room_id [" +
          room_id +
          "]",
      );

      await sendToPeer(to_peer_id, sockets, "cmd", config);
    }
  });

  /**
   * Relay Audio Video Hand ... Status to peers
   */
  socket.on("peerStatus", async (cfg) => {
    // Prevent XSS injection
    const config = checkXSS(cfg);

    if (!Validate.isValidData(config)) return;

    // log.debug('Peer status', config);
    const { room_id, peer_name, peer_id, element, status, extras } = config;

    const data = {
      peer_id: peer_id,
      peer_name: peer_name,
      element: element,
      status: status,
      extras: extras,
    };

    try {
      for (let peer_id in peers[room_id]) {
        if (
          peers[room_id][peer_id]["peer_name"] == peer_name &&
          peer_id == socket.id
        ) {
          switch (element) {
            case "video":
              peers[room_id][peer_id]["peer_video_status"] = status;
              break;
            case "audio":
              peers[room_id][peer_id]["peer_audio_status"] = status;
              break;
            case "screen":
              peers[room_id][peer_id]["peer_screen_status"] = status;
              if (extras) peers[room_id][peer_id]["extras"] = extras;
              break;
            case "hand":
              peers[room_id][peer_id]["peer_hand_status"] = status;
              break;
            case "rec":
              peers[room_id][peer_id]["peer_rec_status"] = status;
              break;
            default:
              break;
          }
        }
      }

      log.debug(
        "[" + socket.id + "] emit peerStatus to [room_id: " + room_id + "]",
        data,
      );

      await sendToRoom(room_id, socket.id, "peerStatus", data);
    } catch (err) {
      log.error("Peer Status", toJson(err));
    }
  });

  /**
   * Relay actions to peers or specific peer in the same room
   */
  socket.on("peerAction", async (cfg) => {
    // Prevent XSS injection
    const config = checkXSS(cfg);

    if (!Validate.isValidData(config)) return;

    // log.debug('Peer action', config);
    const {
      room_id,
      peer_id,
      peer_uuid,
      peer_name,
      peer_avatar,
      peer_use_video,
      peer_action,
      extras,
      send_to_all,
    } = config;

    // Only the presenter can do this actions
    // "screenStart" thêm vào để chặn học viên tự chia sẻ màn hình -
    // chỉ chặn được thông báo/relay qua signaling ở đây, xem thêm
    // guard phía client (toggleScreenSharing) vì đây là app P2P nên
    // server không thấy/chặn được thẳng luồng media thật.
    const presenterActions = [
      "muteAudio",
      "hideVideo",
      "ejectAll",
      "stopScreen",
      "screenStart",
      "recStart",
      "recStop",
    ];
    if (presenterActions.some((v) => peer_action === v)) {
      // Authorize using the server-controlled socket.id, not the
      // client-supplied peer_id, to prevent role spoofing.
      const isPresenter = isPeerPresenter(
        room_id,
        socket.id,
        peer_name,
        peer_uuid,
      );
      // if not presenter do nothing
      if (!isPresenter) return;
    }

    const data = {
      peer_id: peer_id,
      peer_name: peer_name,
      peer_avatar: peer_avatar,
      peer_action: peer_action,
      peer_use_video: peer_use_video,
      extras: extras,
    };

    if (send_to_all) {
      log.debug(
        "[" + socket.id + "] emit peerAction to [room_id: " + room_id + "]",
        data,
      );

      await sendToRoom(room_id, socket.id, "peerAction", data);
    } else {
      log.debug(
        "[" +
          socket.id +
          "] emit peerAction to [" +
          peer_id +
          "] from room_id [" +
          room_id +
          "]",
      );

      await sendToPeer(peer_id, sockets, "peerAction", data);
    }
  });

  /**
   * Authorize the presenter to start a recording session and mint a
   * short-lived token for the HTTP chunk-upload endpoint. Presenter check
   * uses the real, server-controlled socket.id - see isPeerPresenter().
   */
  socket.on("recordingSessionStart", async (cfg, cb) => {
    const config_ = checkXSS(cfg);
    if (!Validate.isValidData(config_)) return cb?.({ ok: false, reason: "invalid_data" });

    const { room_id, peer_name, peer_uuid, mode, mimeType } = config_;
    const result = await Recording.startSession(
      { room_id, peer_id: socket.id, peer_name, peer_uuid, mode, mimeType },
      isPeerPresenter,
    );
    cb?.(result);
  });

  /**
   * Relay Kick out peer from room
   */
  socket.on("kickOut", async (cfg) => {
    // Prevent XSS injection
    const config = checkXSS(cfg);

    if (!Validate.isValidData(config)) return;

    // peer_id here is the TARGET to kick; the caller's identity is the
    // server-controlled socket.id, not anything the client supplies.
    const { room_id, peer_id, peer_uuid, peer_name } = config;

    // Authorize the caller using socket.id to prevent role spoofing.
    const isPresenter = isPeerPresenter(
      room_id,
      socket.id,
      peer_name,
      peer_uuid,
    );

    // Only the presenter can kickOut others
    if (isPresenter) {
      log.debug(
        "[" +
          socket.id +
          "] kick out peer [" +
          peer_id +
          "] from room_id [" +
          room_id +
          "]",
      );

      await sendToPeer(peer_id, sockets, "kickOut", {
        peer_name: peer_name,
      });
    }
  });

  /**
   * Relay video player action
   */
  socket.on("videoPlayer", async (cfg) => {
    // Prevent XSS injection
    const config = checkXSS(cfg);

    if (!Validate.isValidData(config)) return;

    // log.debug('Video player', config);
    const { room_id, peer_id, peer_name, video_action, video_src, broadcast } =
      config;

    // Check if valid video src url
    if (video_action == "open" && !isValidHttpURL(video_src)) {
      log.debug("[" + socket.id + "] Video src not valid", config);
      return;
    }

    const data = {
      peer_id: socket.id,
      peer_name: peer_name,
      video_action: video_action,
      video_src: video_src,
      broadcast: broadcast,
    };

    if (peer_id) {
      log.debug(
        "[" +
          socket.id +
          "] emit videoPlayer to [" +
          peer_id +
          "] from room_id [" +
          room_id +
          "]",
        data,
      );

      await sendToPeer(peer_id, sockets, "videoPlayer", data);
    } else {
      log.debug(
        "[" + socket.id + "] emit videoPlayer to [room_id: " + room_id + "]",
        data,
      );

      await sendToRoom(room_id, socket.id, "videoPlayer", data);
    }
  });

  /**
   * Add peers to channel
   * @param {string} channel room id
   */
  async function addPeerTo(channel) {
    for (let id in channels[channel]) {
      // offer false
      await channels[channel][id].emit("addPeer", {
        peer_id: socket.id,
        peers: peers[channel],
        should_create_offer: false,
        iceServers: iceServers,
      });
      // offer true
      socket.emit("addPeer", {
        peer_id: id,
        peers: peers[channel],
        should_create_offer: true,
        iceServers: iceServers,
      });
      log.debug("[" + socket.id + "] emit addPeer [" + id + "]");
    }
  }

  /**
   * Remove peers from channel
   * @param {string} channel room id
   */
  async function removePeerFrom(channel, socket, reason = "unknown") {
    if (!(channel in socket.channels)) {
      return log.debug("[" + socket.id + "] [Warning] not in ", channel);
    }
    try {
      // Handle WebHook
      if (webhook.enabled) {
        const data = {
          timestamp: log.getDateTime(false),
          room_id: channel,
          peer: socket.channels[channel],
          reason: reason,
        };
        // Trigger a POST request when a user disconnects
        axios
          .post(webhook.url, { event: "disconnect", data }, { timeout: 5000 }) // 5 second timeout
          .then((response) =>
            log.debug("Disconnect event tracked:", response.data),
          )
          .catch((error) =>
            log.error("Error tracking disconnect event:", error.message),
          );
      }

      delete socket.channels[channel];
      delete channels[channel][socket.id];
      delete peers[channel][socket.id]; // delete peer data from the room
      delete peerUUIDs[channel]?.[socket.id];

      // Trước đây presenters[channel][socket.id] chỉ bị xoá khi CẢ
      // phòng trống hẳn (bên dưới) - nghĩa là 1 giáo viên/admin rời đi
      // nhưng học viên còn ở lại thì entry cũ vẫn nằm lì trong
      // presenters[channel], khiến không bao giờ phát hiện được đúng
      // lúc "phòng vừa mất hết giáo viên/admin". Xoá ngay tại đây để
      // presenters[channel] luôn phản ánh đúng ai đang THẬT SỰ kết nối.
      const wasPresenter = presenters[channel]?.[socket.id] !== undefined;
      delete presenters[channel]?.[socket.id];

      // 2 điều kiện độc lập (không phải if/else if) - giáo viên/admin
      // cuối cùng rời đi VÀ phòng trống hẳn có thể xảy ra CÙNG LÚC (vd:
      // chỉ có đúng 1 giáo viên trong phòng, không ai khác).
      if (
        wasPresenter &&
        Object.keys(presenters[channel] || {}).length === 0
      ) {
        // Giáo viên/admin cuối cùng vừa rời phòng - bắt đầu/làm mới 15
        // phút ân hạn (xem scheduleTeacherGraceEviction()). Set mốc này
        // DÙ phòng có trống hẳn ngay sau đó hay không - học viên (kể cả
        // người vừa thoát ra) vẫn phải vào lại được trong 15 phút này.
        roomLastTeacherSeenAt[channel] = Date.now();
        scheduleTeacherGraceEviction(channel);
      }

      if (getPeerCount(channel) === 0) {
        delete peers[channel];
        delete presenters[channel];
        delete channels[channel]; // Clean up channels to prevent memory leak
        delete peerUUIDs[channel];
        // CHÚ Ý: không xoá roomLastTeacherSeenAt/roomEvictionTimers ở
        // đây - phải sống sót qua việc phòng trống tạm thời để học
        // viên vào lại được trong 15 phút ân hạn.
        // scheduleTeacherGraceEviction() tự dọn khi hết giờ (hoặc
        // clearTeacherGraceState() dọn khi có giáo viên/admin vào lại).
      }
    } catch (err) {
      log.error("Remove Peer", toJson(err));
    }

    const activeRooms = getActiveRooms();

    log.debug("[removePeerFrom] - active rooms and peers count", activeRooms);

    log.debug(
      "[removePeerFrom] - connected presenters grp by roomId",
      presenters,
    );

    log.debug("[removePeerFrom] - connected peers grp by roomId", peers);

    for (let id in channels[channel]) {
      await channels[channel][id].emit("removePeer", { peer_id: socket.id });
      socket.emit("removePeer", { peer_id: id });
      log.debug("[" + socket.id + "] emit removePeer [" + id + "]");
    }

    if (!OIDC.enabled && hostCfg.protected) {
      hostCfg.authenticated = false;
      removeIP(socket);
    }
  }

  /**
   * Object to Json
   * @param {object} data object
   * @returns {json} indent 4 spaces
   */
  function toJson(data) {
    return JSON.stringify(data, null, 4); // "\t"
  }

  /**
   * Send async data to all peers in the same room except yourself
   * @param {string} room_id id of the room to send data
   * @param {string} socket_id socket id of peer that send data
   * @param {string} msg message to send to the peers in the same room
   * @param {object} config data to send to the peers in the same room
   */
  async function sendToRoom(room_id, socket_id, msg, config = {}) {
    for (let peer_id in channels[room_id]) {
      // not send data to myself
      if (peer_id != socket_id) {
        await channels[room_id][peer_id].emit(msg, config);
        //console.log('Send to room', { msg: msg, config: config });
      }
    }
  }

  /**
   * Send async data to specified peer
   * @param {string} peer_id id of the peer to send data
   * @param {object} sockets all peers connections
   * @param {string} msg message to send to the peer in the same room
   * @param {object} config data to send to the peer in the same room
   */
  async function sendToPeer(peer_id, sockets, msg, config = {}) {
    if (peer_id in sockets) {
      await sockets[peer_id].emit(msg, config);
      //console.log('Send to peer', { msg: msg, config: config });
    }
  }
}); // end [sockets.on-connect]

/**
 * Check if valid URL
 * @param {string} str to check
 * @returns boolean true/false
 */
function isValidHttpURL(input) {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/**
 * get Peer geo Location using GeoJS
 * https://www.geojs.io/docs/v1/endpoints/geo/
 *
 * @param {string} ip
 * @returns json
 */
async function getPeerGeoLocation(ip) {
  const endpoint = `https://get.geojs.io/v1/ip/geo/${ip}.json`;
  log.debug("Get peer geo", { ip: ip, endpoint: endpoint });
  return axios
    .get(endpoint)
    .then((response) => response.data)
    .catch((error) => log.error(error));
}

/**
 * Check if peer is Presenter
 * @param {string} room_id
 * @param {string} peer_id
 * @param {string} peer_name
 * @param {string} peer_uuid
 * @returns boolean
 */
function isPeerPresenter(room_id, peer_id, peer_name, peer_uuid) {
  try {
    // peer_id MUST be the server-controlled socket.id of the caller.
    // Never trust a client-supplied peer_id, peer_name, or peer_uuid for
    // authorization decisions: look up the stored presenter entry by
    // socket.id and require both peer_name and peer_uuid to match what
    // was recorded at join time.
    const roomPresentersMap = presenters[room_id];
    const stored = roomPresentersMap && roomPresentersMap[peer_id];

    if (!stored) {
      log.debug(
        "[" +
          peer_id +
          "] isPeerPresenter - no stored presenter entry for caller",
        {
          peer_name: peer_name,
        },
      );
      return false;
    }

    const isPresenter =
      typeof stored === "object" &&
      Object.keys(stored).length > 1 &&
      stored.peer_name === peer_name &&
      stored.peer_uuid === peer_uuid;

    log.debug("[" + peer_id + "] isPeerPresenter", { stored, isPresenter });

    return isPresenter;
  } catch (err) {
    log.error("isPeerPresenter", err);
    return false;
  }
}

/**
 * Check if peer is present in the host users
 * @param {string} username
 * @param {string} password
 * @returns Boolean true/false
 */
function isAuthPeer(username, password) {
  return (
    hostCfg.users &&
    hostCfg.users.some(
      (user) => user.username === username && user.password === password,
    )
  );
}

/**
 * Check if valid JWT token
 * @param {string} token
 * @returns boolean
 */
async function isValidToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtCfg.JWT_KEY, (err, decoded) => {
      if (err) {
        // Token is invalid
        resolve(false);
      } else {
        // Token is valid
        resolve(true);
      }
    });
  });
}

/**
 * Encode JWT token payload
 * @param {object} token
 * @returns
 */
function encodeToken(token) {
  if (!token) return "";

  const {
    username = "username",
    password = "password",
    presenter = false,
    expire,
  } = token;

  const expireValue = expire || jwtCfg.JWT_EXP;

  // Constructing payload
  const payload = {
    username: String(username),
    password: String(password),
    presenter: String(presenter),
  };

  // Encrypt payload using AES encryption
  const payloadString = JSON.stringify(payload);
  const encryptedPayload = CryptoJS.AES.encrypt(
    payloadString,
    jwtCfg.JWT_KEY,
  ).toString();

  // Constructing JWT token
  const jwtToken = jwt.sign({ data: encryptedPayload }, jwtCfg.JWT_KEY, {
    expiresIn: expireValue,
  });

  return jwtToken;
}

/**
 * Decode JWT Payload data
 * @param {object} jwtToken
 * @returns mixed
 */
function decodeToken(jwtToken) {
  if (!jwtToken) return null;

  // Verify and decode the JWT token
  const decodedToken = jwt.verify(jwtToken, jwtCfg.JWT_KEY);
  if (!decodedToken || !decodedToken.data) {
    throw new Error("Invalid token");
  }

  // Decrypt the payload using AES decryption
  const decryptedPayload = CryptoJS.AES.decrypt(
    decodedToken.data,
    jwtCfg.JWT_KEY,
  ).toString(CryptoJS.enc.Utf8);

  // Parse the decrypted payload as JSON
  const payload = JSON.parse(decryptedPayload);

  return payload;
}

/**
 * Get All connected peers count grouped by roomId
 * @return {object} array
 */
function getActiveRooms() {
  const roomPeersArray = [];
  // Iterate through each room
  for (const roomId in peers) {
    if (peers.hasOwnProperty(roomId)) {
      // Get the count of peers in the current room
      const peersCount = getPeerCount(roomId);
      roomPeersArray.push({
        roomId: roomId,
        peersCount: peersCount,
      });
    }
  }
  return roomPeersArray;
}

/**
 * Check if Allowed Room Access
 * @param {string} logMessage
 * @param {object} req
 * @param {object} hostCfg
 * @param {object} peers
 * @param {string} roomId
 * @returns boolean true/false
 */
function isAllowedRoomAccess(logMessage, req, hostCfg, peers, roomId) {
  const OIDCUserAuthenticated = OIDC.enabled && req.oidc.isAuthenticated();
  const OIDCAllowRoomCreationForAuthUsers = OIDC.allowRoomCreationForAuthUsers;
  const hostUserAuthenticated = hostCfg.protected && hostCfg.authenticated;
  const roomExist = roomId in peers;
  const roomCount = Object.keys(peers).length;

  const allowRoomAccess =
    (!hostCfg.protected && !OIDC.enabled) || // No host protection and OIDC mode enabled (default)
    (OIDCUserAuthenticated && roomExist) || // User authenticated via OIDC and room Exist
    (hostUserAuthenticated && roomExist) || // User authenticated via Login and room Exist
    ((OIDCUserAuthenticated || hostUserAuthenticated) && roomCount === 0) || // User authenticated joins the first room
    (OIDCUserAuthenticated && OIDCAllowRoomCreationForAuthUsers) || // Allow room creation if authenticated via OIDC
    roomExist; // User Or Guest join an existing Room

  log.debug(logMessage, {
    OIDCUserAuthenticated: OIDCUserAuthenticated,
    hostUserAuthenticated: hostUserAuthenticated,
    roomExist: roomExist,
    roomCount: roomCount,
    extraInfo: {
      roomId: roomId,
      OIDCUserEnabled: OIDC.enabled,
      hostProtected: hostCfg.protected,
      hostAuthenticated: hostCfg.authenticated,
      OIDCAllowRoomCreationForAuthUsers,
    },
    allowRoomAccess: allowRoomAccess,
  });

  return allowRoomAccess;
}

/**
 * Get ip
 * Honours the X-Forwarded-For header only when Express has been configured
 * with a `trust proxy` setting that matches the deployment topology. Reading
 * the header directly from req.headers would let any client spoof its source
 * address and bypass security controls such as the IP allow-list.
 * @param {object} req
 * @returns string ip
 */
function getIP(req) {
  return req.ip || req.socket?.remoteAddress;
}

/**
 * Get IP from socket
 * Same rationale as getIP(): rely on the address that the underlying
 * transport observed and only trust X-Forwarded-For when explicitly enabled
 * via the trust proxy configuration.
 * @param {object} socket
 * @returns string
 */
function getSocketIP(socket) {
  if (trustProxy) {
    const forwarded =
      socket.handshake.headers["x-forwarded-for"] ||
      socket.handshake.headers["X-Forwarded-For"];
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
  }
  return socket.handshake.address;
}

/**
 * Check if auth ip
 * @param {string} ip
 * @returns boolean
 */
function allowedIP(ip) {
  const authorizedIPs = authHost.getAuthorizedIPs();
  const authorizedIP = authHost.isAuthorizedIP(ip);
  log.info("Allowed IPs", {
    ip: ip,
    authorizedIP: authorizedIP,
    authorizedIPs: authorizedIPs,
  });
  return authHost != null && authorizedIP;
}

/**
 * Remove hosts auth ip on socket disconnect
 * @param {object} socket
 */
function removeIP(socket) {
  if (hostCfg.protected) {
    const ip = getSocketIP(socket);
    log.debug("[removeIP] - Host protected check ip", { ip: ip });
    if (ip && allowedIP(ip)) {
      authHost.deleteIP(ip);
      hostCfg.authenticated = false;
      log.info("[removeIP] - Remove IP from auth", {
        ip: ip,
        authorizedIps: authHost.getAuthorizedIPs(),
      });
    }
  }
}

/**
 * Cleanup HTML injector when the application is shutting down
 */
process.on("SIGINT", () => {
  log.debug("PROCESS", "SIGINT");
  htmlInjector.cleanup();
  process.exit();
});

process.on("SIGTERM", () => {
  log.debug("PROCESS", "SIGTERM");
  htmlInjector.cleanup();
  process.exit();
});

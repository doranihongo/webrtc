/*
http://patorjk.com/software/taag/#p=display&f=ANSI%20Regular&t=Server

███████ ███████ ██████  ██    ██ ███████ ██████  
██      ██      ██   ██ ██    ██ ██      ██   ██ 
███████ █████   ██████  ██    ██ █████   ██████  
     ██ ██      ██   ██  ██  ██  ██      ██   ██ 
███████ ███████ ██   ██   ████   ███████ ██   ██                                           

dependencies: {
    @sentry/node            : https://www.npmjs.com/package/@sentry/node
    axios                   : https://www.npmjs.com/package/axios
    colors                  : https://www.npmjs.com/package/colors
    compression             : https://www.npmjs.com/package/compression
    cors                    : https://www.npmjs.com/package/cors
    dompurify               : https://www.npmjs.com/package/dompurify
    dotenv                  : https://www.npmjs.com/package/dotenv
    express                 : https://www.npmjs.com/package/express
    express-openid-connect  : https://www.npmjs.com/package/express-openid-connect
    he                      : https://www.npmjs.com/package/he
    helmet                  : https://www.npmjs.com/package/helmet
    httpolyglot             : https://www.npmjs.com/package/httpolyglot
    jsdom                   : https://www.npmjs.com/package/jsdom
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
const httpolyglot = require("httpolyglot");
const compression = require("compression");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const axios = require("axios");
const app = express();
const fs = require("fs");
const { Readable } = require("stream");
const checkXSS = require("./xss.js");
const Homework = require("./homework");
const ShadowingYoutube = require("./shadowingYoutube");
const Logs = require("./logs");
const {
  applyEmbedHeaders,
  embedAllowedOrigins,
  embedCsp,
} = require("./embedHeaders");
const log = new Logs("server");

// Central configuration (reads .env via dotenv internally)
const config = require("./config");

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

// Shadowing YouTube (kaiwa tool) - each request shells out to yt-dlp, so
// cap how often one IP can trigger that regardless of login state.
const shadowingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: { ok: false, code: "rate_limited", message: "Thử lại sau ít phút." },
  keyGenerator: (req) => getIP(req),
});

// Kaiwa homework "tra mã học viên" - mã không phải bí mật cấp cao nhưng vẫn
// nên giới hạn tốc độ thử (đoán/dò mã hàng loạt).
const homeworkTeacherLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: { error: "rate_limited" },
  keyGenerator: (req) => getIP(req),
});

const port = config.server.port;
const host = config.server.host;

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

/**
 * Supabase project config - shared by the kaiwa slide-signing and homework
 * endpoints below, each of which authenticates its own requests directly
 * against Supabase (see getKaiwaSlideAuthUser/getKaiwaHomeworkAuthUser).
 */
const supabaseCfg = config.supabase;

// Sentry config
const Sentry = require("@sentry/node");
const sentryEnabled = config.sentry.enabled;
const sentryDSN = config.sentry.dsn;
const sentryTracesSampleRate = config.sentry.tracesSampleRate;

// Kaiwa slide URL signing (HMAC) - Node built-in, no extra dependency.
const crypto = require("crypto");

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
    if (req.oidc.isAuthenticated()) {
      log.debug("OIDC ------> User already Authenticated");
      return next();
    }

    // Apply requiresAuth() middleware conditionally
    requiresAuth()(req, res, function () {
      log.debug("OIDC ------> requiresAuth");
      // Check if user is authenticated
      if (req.oidc.isAuthenticated()) {
        log.debug("[OIDC] ------> User isAuthenticated");
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

// directory
const dir = {
  public: path.join(__dirname, "../../", "public"),
  dist: path.join(__dirname, "../../", "public/dist"),
};
// html views
const views = {
  login: path.join(__dirname, "../../", "public/login.html"),
  kaiwa: path.join(__dirname, "../../", "public/kaiwa/index.html"),
};

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

/**
 * Chặn người CHƯA đăng nhập tải được HTML/JS/CSS của các trang sau
 * /login (kaiwa, phòng học...) - trước đây các file này được
 * express.static (đăng ký ngay dưới đây) phục vụ công khai cho BẤT KỲ
 * ai gọi tới URL, authGuard phía client (common.js) chỉ redirect SAU
 * khi trang đã tải xong - người chưa có tài khoản vẫn xem được toàn bộ
 * source (View Source/curl) trước khi bị đá đi. Đây là lớp chặn thật ở
 * server, dựa vào cookie "sb_page_token" mà supabaseClient.js tự đồng
 * bộ từ access token Supabase (xem syncAuthCookie ở đó) mỗi khi trạng
 * thái đăng nhập đổi.
 *
 * Nhẹ hơn lớp verify đầy đủ của Socket.IO (phía trên) - chỉ xác minh
 * token còn hợp lệ với Supabase (đúng là 1 tài khoản thật, đang đăng
 * nhập), KHÔNG tra lại role/hạn dùng/giới hạn thiết bị - những cái đó
 * đã được lớp Socket.IO lo cho tính năng thật rồi, ở đây chỉ cần biết
 * "có phải người có tài khoản không" để quyết định có cho tải code hay
 * không. Kết quả được cache vài chục giây để không phải gọi Supabase
 * cho MỌI request JS/CSS/ảnh của cùng 1 lần tải trang.
 *
 * Chỉ áp cho GET/HEAD (tải trang/asset) - không đụng tới các route
 * POST/API khác, những route đó đã có cơ chế auth riêng của nó.
 *
 * Bỏ qua hoàn toàn nếu SUPABASE_URL/ANON_KEY chưa cấu hình - giống hệt
 * lớp Socket.IO ở trên, tránh khoá cứng app của người khác dùng lại
 * code này mà chưa set up Supabase.
 */
const PAGE_AUTH_WHITELIST_EXACT = new Set([
  "/login",
  "/manifest.json",
  "/sw.js",
  "/favicon.ico",
  "/robots.txt",
]);
const PAGE_AUTH_WHITELIST_PREFIXES = [
  "/css/login.css",
  "/css/_tokens.css",
  "/js/supabaseClient.js",
  "/js/login.js",
  "/images/", // logo/icon dùng trên cả trang login - không phải "code"
];

function isPageAuthWhitelisted(urlPath) {
  if (PAGE_AUTH_WHITELIST_EXACT.has(urlPath)) return true;
  return PAGE_AUTH_WHITELIST_PREFIXES.some((prefix) =>
    urlPath.startsWith(prefix),
  );
}

function getCookieValue(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

// token -> { ok: boolean, validUntil: ms epoch }
const pageAuthCache = new Map();
const PAGE_AUTH_CACHE_TTL_MS = 60 * 1000;

async function isPageAuthTokenValid(token) {
  const now = Date.now();
  const cached = pageAuthCache.get(token);
  if (cached && cached.validUntil > now) return cached.ok;

  let ok = false;
  try {
    const { data: user } = await axios.get(`${supabaseCfg.url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseCfg.anonKey,
      },
      timeout: 5000,
    });
    ok = !!user?.id;
  } catch (err) {
    ok = false;
  }

  // Dọn bớt entry hết hạn mỗi khi cache hơi lớn - app nhỏ, không cần
  // cấu trúc cache phức tạp hơn (LRU...) cho việc này.
  if (pageAuthCache.size > 500) {
    for (const [key, val] of pageAuthCache) {
      if (val.validUntil <= now) pageAuthCache.delete(key);
    }
  }
  pageAuthCache.set(token, { ok, validUntil: now + PAGE_AUTH_CACHE_TTL_MS });
  return ok;
}

if (supabaseCfg.url && supabaseCfg.anonKey) {
  app.use(async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (isPageAuthWhitelisted(req.path)) return next();

    const token = getCookieValue(req, "sb_page_token");
    const ok = token ? await isPageAuthTokenValid(token) : false;
    if (ok) return next();

    // Điều hướng trình duyệt thật (gõ URL/bấm link) -> đá về /login kèm
    // đường quay lại, giống hệt authGuard phía client vẫn làm. Các
    // request khác (JS/CSS/ảnh do <script>/<link> tự tải) -> 401 gọn,
    // không cần trải nghiệm đẹp vì lẽ ra không xảy ra với người đã đăng
    // nhập thật (cookie luôn có sẵn từ lúc đó).
    //
    // Dùng Sec-Fetch-Mode trước (mọi trình duyệt hiện đại đều gửi,
    // phân biệt CHÍNH XÁC "navigate" với "cors"/"no-cors" của
    // script/link/img) - chỉ fallback về Accept header (đòi hỏi có
    // "text/html" cụ thể, không chỉ chấp nhận "*/*" như curl mặc định)
    // cho request không có header đó (curl, trình duyệt rất cũ...).
    const secFetchMode = req.headers["sec-fetch-mode"];
    const isNavigation = secFetchMode
      ? secFetchMode === "navigate"
      : (req.headers.accept || "").includes("text/html");
    if (isNavigation) {
      return res.redirect(
        "/login?redirect=" + encodeURIComponent(req.originalUrl),
      );
    }
    return res.status(401).end();
  });
} else {
  log.warn(
    "[Auth] SUPABASE_URL/SUPABASE_ANON_KEY chưa được cấu hình - bỏ qua chặn tải trang/code cho người chưa đăng nhập.",
  );
}

// Use all static files from the public folder
const staticOptions = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
    }
    // Add other headers if needed...
  },
};

// Serve minified js/css from public/dist first if present (npm run build output),
// falling back to the original public/ files below when a dist file doesn't exist
// (e.g. build was never run). Same URLs, no markup changes needed.
app.use(express.static(dir.dist, staticOptions));

// Serve static files from root (/)
app.use(express.static(dir.public, staticOptions));

app.use(cors(corsOptions)); // Enable CORS with options
app.use(compression()); // Compress all HTTP responses using GZip
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies

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
    req.logout(); // Logout user
  }
  res.redirect("/"); // Redirect to the home page after logout
});

// Trang đăng nhập
app.get("/login", (req, res) => {
  res.sendFile(views.login);
});

// main page - trang kaiwa (trang chủ sau đăng nhập)
app.get("/", OIDCAuth, (req, res) => {
  if (!fs.existsSync(views.kaiwa)) {
    // public/kaiwa/ chưa được build (npm run build:kaiwa) - báo rõ thay vì 404 khó hiểu
    res
      .status(503)
      .send(
        "Trang kaiwa chưa được build. Chạy `npm run build:kaiwa` rồi tải lại trang.",
      );
  } else {
    res.sendFile(views.kaiwa);
  }
});


// Kaiwa tool "Shadowing YouTube": given a YouTube link, return whatever
// Japanese captions the video already has (manual first, YouTube's own
// auto-generated captions as fallback), with per-line timestamps so the
// client can highlight the current line in sync with video playback. Gated
// by the same OIDCAuth as the rest of kaiwa - not a public endpoint.
app.post(
  "/kaiwa/shadowing/transcript",
  OIDCAuth,
  shadowingLimiter,
  async (req, res) => {
    const { url } = checkXSS(req.body || {});
    const result = await ShadowingYoutube.getTranscript(url);
    if (result.ok) {
      res.status(200).json(result);
    } else {
      const status =
        result.code === "invalid_url"
          ? 400
          : result.code === "no_captions" || result.code === "empty_captions"
            ? 404
            : result.code === "ytdlp_missing"
              ? 503
              : 502;
      res.status(status).json(result);
    }
  },
);

/**
 * Kaiwa slide URL signing - see kaiwa/src/utils/signSlideUrls.ts (client) and
 * the Cloudflare Worker in front of the dedicated slide bucket/domain (not
 * part of this repo) which verifies the exp/sig this route produces before
 * ever serving a file. Auth here is intentionally SEPARATE from pageAuthCache
 * (isPageAuthTokenValid, ~line 776) - that one doesn't select allowed_courses,
 * and this is a POST route (not covered by the GET/HEAD-only page-auth-guard
 * middleware either), so it needs its own token -> role/allowed_courses check.
 */
const kaiwaSlideAuthCache = new Map(); // token -> { ok, role, allowedCourses, validUntil }
const KAIWA_SLIDE_AUTH_CACHE_TTL_MS = 60 * 1000;

async function getKaiwaSlideAuthUser(token) {
  const now = Date.now();
  const cached = kaiwaSlideAuthCache.get(token);
  if (cached && cached.validUntil > now) return cached.ok ? cached : null;

  let result = { ok: false, validUntil: now + KAIWA_SLIDE_AUTH_CACHE_TTL_MS };
  try {
    const { data: user } = await axios.get(`${supabaseCfg.url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
      timeout: 5000,
    });
    if (user?.id) {
      const { data: profiles } = await axios.get(
        `${supabaseCfg.url}/rest/v1/profiles`,
        {
          params: { id: `eq.${user.id}`, select: "role,allowed_courses" },
          headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
          timeout: 5000,
        },
      );
      const role = profiles?.[0]?.role;
      if (role) {
        result = {
          ok: true,
          role,
          allowedCourses: Array.isArray(profiles?.[0]?.allowed_courses)
            ? profiles[0].allowed_courses
            : [],
          validUntil: now + KAIWA_SLIDE_AUTH_CACHE_TTL_MS,
        };
      }
    }
  } catch (err) {
    result = { ok: false, validUntil: now + KAIWA_SLIDE_AUTH_CACHE_TTL_MS };
  }

  if (kaiwaSlideAuthCache.size > 500) {
    for (const [key, val] of kaiwaSlideAuthCache) {
      if (val.validUntil <= now) kaiwaSlideAuthCache.delete(key);
    }
  }
  kaiwaSlideAuthCache.set(token, result);
  return result.ok ? result : null;
}

// Mirror of STAFF_ROLES in kaiwa/src/utils/courseAccess.ts - keep in sync.
// Only 'admin' bypasses allowed_courses; 'giaovien' is scoped just like
// học viên (đổi 2026-08-23, đi kèm cơ chế ký URL slide - trước đó giaovien
// từng được xem hết mọi khóa).
const KAIWA_SLIDE_STAFF_ROLES = new Set(["admin"]);
function isKaiwaSlideCourseAllowed(authUser, courseId) {
  if (!authUser) return false;
  if (KAIWA_SLIDE_STAFF_ROLES.has(authUser.role)) return true;
  return (
    Array.isArray(authUser.allowedCourses) &&
    authUser.allowedCourses.includes(courseId)
  );
}

async function getKaiwaLessonForSigning(token, lessonId) {
  try {
    const { data } = await axios.get(`${supabaseCfg.url}/rest/v1/kaiwa_lessons`, {
      params: { id: `eq.${lessonId}`, select: "course_id,slide_folder" },
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
      timeout: 5000,
    });
    return data?.[0] || null;
  } catch (err) {
    return null;
  }
}

function signKaiwaSlideUrl(rawUrl, expEpochSeconds, secret) {
  const parsed = new URL(rawUrl);
  const stringToSign = `${parsed.pathname}:${expEpochSeconds}`;
  const sig = crypto.createHmac("sha256", secret).update(stringToSign).digest("hex");
  parsed.searchParams.set("exp", String(expEpochSeconds));
  parsed.searchParams.set("sig", sig);
  return parsed.toString();
}

app.post("/kaiwa/sign-slide-urls", async (req, res) => {
  const slideSigningCfg = config.kaiwaSlideSigning;
  if (!slideSigningCfg.secret) {
    log.error(
      "[Kaiwa] SLIDE_URL_SIGNING_SECRET chưa được cấu hình - từ chối ký URL slide (không bao giờ trả URL chưa ký).",
    );
    return res.status(500).json({ error: "signing_not_configured" });
  }

  const token = getCookieValue(req, "sb_page_token");
  if (!token) return res.status(401).json({ error: "unauthorized" });

  const authUser = await getKaiwaSlideAuthUser(token);
  if (!authUser) return res.status(401).json({ error: "unauthorized" });

  const { lessonId, urls } = checkXSS(req.body || {});
  if (!lessonId || typeof lessonId !== "string") {
    return res
      .status(400)
      .json({ error: "invalid_request", message: "Thiếu lessonId." });
  }
  if (!Array.isArray(urls) || urls.length === 0 || urls.some((u) => typeof u !== "string")) {
    return res
      .status(400)
      .json({ error: "invalid_request", message: "urls phải là mảng chuỗi không rỗng." });
  }
  if (urls.length > 200) {
    return res
      .status(400)
      .json({ error: "invalid_request", message: "Quá nhiều URL trong 1 lần ký." });
  }

  const lesson = await getKaiwaLessonForSigning(token, lessonId);
  if (!lesson || !lesson.slide_folder) {
    return res.status(404).json({ error: "lesson_not_found" });
  }

  if (!isKaiwaSlideCourseAllowed(authUser, lesson.course_id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const base = lesson.slide_folder.endsWith("/")
    ? lesson.slide_folder
    : `${lesson.slide_folder}/`;
  let parsedBase;
  try {
    parsedBase = new URL(base);
  } catch (err) {
    log.error("[Kaiwa] slide_folder không phải URL hợp lệ", {
      lessonId,
      slideFolder: lesson.slide_folder,
    });
    return res.status(500).json({ error: "invalid_slide_folder" });
  }

  for (const u of urls) {
    let parsedUrl;
    try {
      parsedUrl = new URL(u);
    } catch (err) {
      return res
        .status(400)
        .json({ error: "invalid_url", message: `URL không hợp lệ: ${u}` });
    }
    // Chặn dùng 1 lessonId hợp lệ để ký URL của thư mục KHÁC (buổi học/khóa
    // khác) - mỗi URL gửi lên PHẢI nằm trong đúng slide_folder của lessonId
    // đã xin quyền ở trên.
    if (
      parsedUrl.origin !== parsedBase.origin ||
      !parsedUrl.pathname.startsWith(parsedBase.pathname)
    ) {
      return res
        .status(400)
        .json({ error: "url_outside_lesson", message: `URL không thuộc buổi học: ${u}` });
    }
  }

  const exp = Math.floor(Date.now() / 1000) + slideSigningCfg.ttlSeconds;
  const signedUrls = urls.map((u) => signKaiwaSlideUrl(u, exp, slideSigningCfg.secret));

  return res.status(200).json({ exp, urls: signedUrls });
});

/**
 * ============================================================
 * Kaiwa "Bài tập về nhà" (homework audio submissions)
 * ============================================================
 * Auth follows the exact same shape as /kaiwa/sign-slide-urls above (cookie
 * sb_page_token, {error,message?} JSON responses) - see homework.js's top
 * comment for why upload is synchronous (one request, no background retry
 * queue: this module writes Supabase rows using the caller's own short-lived
 * token, so a retry running much later could hit a stale/expired token).
 */
const kaiwaHomeworkAuthCache = new Map(); // token -> { ok, role, userId, allowedCourses, validUntil }
const KAIWA_HOMEWORK_AUTH_CACHE_TTL_MS = 60 * 1000;

async function getKaiwaHomeworkAuthUser(token) {
  const now = Date.now();
  const cached = kaiwaHomeworkAuthCache.get(token);
  if (cached && cached.validUntil > now) return cached.ok ? cached : null;

  let result = { ok: false, validUntil: now + KAIWA_HOMEWORK_AUTH_CACHE_TTL_MS };
  try {
    const { data: user } = await axios.get(`${supabaseCfg.url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
      timeout: 5000,
    });
    if (user?.id) {
      const { data: profiles } = await axios.get(
        `${supabaseCfg.url}/rest/v1/profiles`,
        {
          params: { id: `eq.${user.id}`, select: "role,allowed_courses" },
          headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
          timeout: 5000,
        },
      );
      const role = profiles?.[0]?.role;
      if (role) {
        result = {
          ok: true,
          role,
          userId: user.id,
          allowedCourses: Array.isArray(profiles?.[0]?.allowed_courses)
            ? profiles[0].allowed_courses
            : [],
          validUntil: now + KAIWA_HOMEWORK_AUTH_CACHE_TTL_MS,
        };
      }
    }
  } catch (err) {
    result = { ok: false, validUntil: now + KAIWA_HOMEWORK_AUTH_CACHE_TTL_MS };
  }

  if (kaiwaHomeworkAuthCache.size > 500) {
    for (const [key, val] of kaiwaHomeworkAuthCache) {
      if (val.validUntil <= now) kaiwaHomeworkAuthCache.delete(key);
    }
  }
  kaiwaHomeworkAuthCache.set(token, result);
  return result.ok ? result : null;
}

const KAIWA_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getKaiwaHomeworkById(token, homeworkId) {
  try {
    const { data } = await axios.get(`${supabaseCfg.url}/rest/v1/kaiwa_homeworks`, {
      params: { id: `eq.${homeworkId}`, select: "id,lesson_id,title,deadline" },
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
      timeout: 5000,
    });
    return data?.[0] || null;
  } catch (err) {
    return null;
  }
}

function toClientHomeworkSubmission(row) {
  return {
    id: row.id,
    homeworkId: row.homework_id,
    studentId: row.student_id,
    driveFileName: row.drive_file_name,
    mimeType: row.mime_type,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

// Học viên nộp bài - ghi âm/chọn file, gửi NGUYÊN 1 lần trong 1 request
// (không chia chunk như /recording/chunk bên dưới - xem lý do ở đầu
// homework.js). Upload lên Drive xảy ra ĐỒNG BỘ trong request này.
app.post(
  "/kaiwa/homework/submissions",
  express.raw({ type: "*/*", limit: config.homework.maxUploadBytes }),
  async (req, res) => {
    const token = getCookieValue(req, "sb_page_token");
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const authUser = await getKaiwaHomeworkAuthUser(token);
    if (!authUser) return res.status(401).json({ error: "unauthorized" });
    if (authUser.role !== "hocvien") return res.status(403).json({ error: "forbidden" });

    const homeworkId = String(req.query.homeworkId || "");
    if (!KAIWA_UUID_RE.test(homeworkId)) {
      return res.status(400).json({ error: "invalid_request", message: "Thiếu/sai homeworkId." });
    }
    const mimeType = req.get("Content-Type") || "application/octet-stream";
    const durationMs = parseInt(req.get("X-Homework-Duration-Ms"), 10);

    const homework = await getKaiwaHomeworkById(token, homeworkId);
    if (!homework) return res.status(404).json({ error: "homework_not_found" });
    if (Homework.isPastDeadline(homework)) {
      return res.status(409).json({ error: "deadline_passed" });
    }

    // Tên hiển thị của học viên cho tên file Drive - đọc dòng của chính họ
    // (RLS cho phép), fallback về userId nếu chưa có display_name.
    let studentDisplayName = authUser.userId;
    try {
      const { data: me } = await axios.get(`${supabaseCfg.url}/rest/v1/profiles`, {
        params: { id: `eq.${authUser.userId}`, select: "display_name" },
        headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
        timeout: 5000,
      });
      if (me?.[0]?.display_name) studentDisplayName = me[0].display_name;
    } catch (err) {
      // giữ fallback userId - không chặn nộp bài chỉ vì không lấy được tên
    }

    const result = await Homework.submitHomework({
      token,
      homeworkId,
      studentId: authUser.userId,
      studentDisplayName,
      homeworkTitle: homework.title,
      mimeType,
      buffer: req.body,
      durationMs,
    });
    if (!result.ok) return res.status(result.status || 502).json({ error: result.reason });
    return res.status(200).json({ ok: true, submission: result.submission });
  },
);

// Học viên xoá bài đã nộp (để nộp lại) - chỉ bài của chính mình, chỉ khi
// còn hạn.
app.delete("/kaiwa/homework/submissions/:id", async (req, res) => {
  const token = getCookieValue(req, "sb_page_token");
  if (!token) return res.status(401).json({ error: "unauthorized" });
  const authUser = await getKaiwaHomeworkAuthUser(token);
  if (!authUser) return res.status(401).json({ error: "unauthorized" });
  if (authUser.role !== "hocvien") return res.status(403).json({ error: "forbidden" });

  const submissionId = req.params.id;
  if (!KAIWA_UUID_RE.test(submissionId)) {
    return res.status(400).json({ error: "invalid_request" });
  }

  let submissionRow;
  try {
    const { data } = await axios.get(`${supabaseCfg.url}/rest/v1/kaiwa_homework_submissions`, {
      params: { id: `eq.${submissionId}`, select: "homework_id" },
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
      timeout: 5000,
    });
    submissionRow = data?.[0] || null;
  } catch (err) {
    submissionRow = null;
  }
  if (!submissionRow) return res.status(404).json({ error: "not_found" });

  const homework = await getKaiwaHomeworkById(token, submissionRow.homework_id);
  if (homework && Homework.isPastDeadline(homework)) {
    return res.status(409).json({ error: "deadline_passed" });
  }

  const result = await Homework.deleteHomeworkSubmission({
    token,
    submissionId,
    studentId: authUser.userId,
  });
  if (!result.ok) return res.status(result.status || 502).json({ error: result.reason });
  return res.status(200).json({ ok: true });
});

// Giáo viên: tra bài nộp của 1 học viên (qua mã, xem kaiwa_resolve_student_code
// trong SQL bàn giao) cho 1 buổi học cụ thể - hoạt động bất kỳ lúc nào,
// không cần học viên đang trong phòng gọi.
app.get(
  "/kaiwa/homework/teacher-submissions",
  homeworkTeacherLimiter,
  async (req, res) => {
    const token = getCookieValue(req, "sb_page_token");
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const authUser = await getKaiwaHomeworkAuthUser(token);
    if (!authUser) return res.status(401).json({ error: "unauthorized" });
    if (authUser.role === "hocvien") return res.status(403).json({ error: "forbidden" });

    const lessonId = String(req.query.lessonId || "");
    const studentCode = String(req.query.studentCode || "").trim();
    // kaiwa_lessons.id là text (không phải uuid) - vd slug gõ tay - nên chỉ
    // kiểm tra không rỗng, giống hệt cách /kaiwa/sign-slide-urls đang làm
    // với lessonId (không đòi định dạng cụ thể nào).
    if (!lessonId || lessonId.length > 200) {
      return res.status(400).json({ error: "invalid_request", message: "Thiếu/sai lessonId." });
    }
    if (!studentCode || studentCode.length > 64) {
      return res.status(400).json({ error: "invalid_request", message: "Thiếu mã học viên." });
    }

    let student;
    try {
      const { data } = await axios.post(
        `${supabaseCfg.url}/rest/v1/rpc/kaiwa_resolve_student_code`,
        { p_code: studentCode },
        { headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey }, timeout: 5000 },
      );
      student = data?.[0] || null;
    } catch (err) {
      log.error("[Homework] kaiwa_resolve_student_code RPC failed", { error: err.message });
      return res.status(502).json({ error: "lookup_failed" });
    }
    if (!student) return res.status(404).json({ error: "student_not_found" });

    const lesson = await getKaiwaLessonForSigning(token, lessonId);
    if (!lesson) return res.status(404).json({ error: "lesson_not_found" });
    if (!isKaiwaSlideCourseAllowed(authUser, lesson.course_id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    let submissions;
    try {
      const { data } = await axios.post(
        `${supabaseCfg.url}/rest/v1/rpc/kaiwa_homework_submissions_for_teacher`,
        { p_lesson_id: lessonId, p_student_id: student.id },
        { headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey }, timeout: 5000 },
      );
      submissions = Array.isArray(data) ? data : [];
    } catch (err) {
      log.error("[Homework] kaiwa_homework_submissions_for_teacher RPC failed", { error: err.message });
      return res.status(502).json({ error: "lookup_failed" });
    }

    return res.status(200).json({
      studentName: student.display_name || null,
      submissions: submissions.map(toClientHomeworkSubmission),
    });
  },
);

// Nghe 1 bài nộp - proxy bytes từ Drive, KHÔNG bao giờ lộ URL/credential
// Drive ra ngoài. hocvien: chỉ bài của chính mình (RLS chặn thẳng). giaovien/
// admin: qua RPC phạm vi hẹp (RLS chặn SELECT dòng không phải của họ) rồi tự
// check lại allowed_courses ở đây - chạy lại từ đầu trên MỌI request, không
// tin trạng thái nào từ route danh sách phía trên.
app.get("/kaiwa/homework/submissions/:id/audio", async (req, res) => {
  const token = getCookieValue(req, "sb_page_token");
  if (!token) return res.status(401).json({ error: "unauthorized" });
  const authUser = await getKaiwaHomeworkAuthUser(token);
  if (!authUser) return res.status(401).json({ error: "unauthorized" });

  const submissionId = req.params.id;
  if (!KAIWA_UUID_RE.test(submissionId)) return res.status(400).json({ error: "invalid_request" });

  let row;
  if (authUser.role === "hocvien") {
    try {
      const { data } = await axios.get(`${supabaseCfg.url}/rest/v1/kaiwa_homework_submissions`, {
        params: {
          id: `eq.${submissionId}`,
          select: "id,student_id,drive_file_id,mime_type,homework_id",
        },
        headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey },
        timeout: 5000,
      });
      row = data?.[0] || null;
    } catch (err) {
      row = null;
    }
    if (!row) return res.status(404).json({ error: "not_found" });
  } else {
    try {
      const { data } = await axios.post(
        `${supabaseCfg.url}/rest/v1/rpc/kaiwa_homework_submission_for_teacher`,
        { p_submission_id: submissionId },
        { headers: { Authorization: `Bearer ${token}`, apikey: supabaseCfg.anonKey }, timeout: 5000 },
      );
      row = data?.[0] || null;
    } catch (err) {
      return res.status(502).json({ error: "lookup_failed" });
    }
    if (!row) return res.status(404).json({ error: "not_found" });

    const homework = await getKaiwaHomeworkById(token, row.homework_id);
    const lesson = homework ? await getKaiwaLessonForSigning(token, homework.lesson_id) : null;
    if (!lesson || !isKaiwaSlideCourseAllowed(authUser, lesson.course_id)) {
      return res.status(403).json({ error: "forbidden" });
    }
  }

  if (!row.drive_file_id) return res.status(404).json({ error: "not_found" });

  let upstream;
  try {
    upstream = await Homework.drive.downloadFile(row.drive_file_id, {
      range: req.headers.range,
    });
  } catch (err) {
    log.error("[Homework] Drive downloadFile failed", { submissionId, error: err.message });
    return res.status(502).json({ error: "download_failed" });
  }
  if (!upstream.ok) {
    return res.status(upstream.status === 404 ? 404 : 502).json({ error: "download_failed" });
  }

  res.status(upstream.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (!upstream.headers.get("content-type") && row.mime_type) {
    res.setHeader("content-type", row.mime_type);
  }
  Readable.fromWeb(upstream.body).pipe(res);
});


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
 * @returns server config
 */
function getServerConfig() {
  return {
    // General Server Information
    server: host,
    trust_proxy: trustProxy,

    // Core Configurations
    cors: corsOptions,
    embed: {
      allowedOrigins: embedAllowedOrigins.length ? embedAllowedOrigins : "any",
      csp: embedCsp
        ? embedCsp.csp
        : "not set (embedding allowed from any origin)",
    },

    // Security, Authorization, and User Management
    oidc: OIDC.enabled ? OIDC : false,
    ip_whitelist: ipWhitelist.enabled ? ipWhitelist : false,

    // Monitoring and Logging
    sentry_enabled: sentryEnabled,

    // Versions and environment information
    environment: config.server.environment,
    app_version: packageJson.version,
    node_version: process.versions.node,
  };
}

/**
 * Start Local Server
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

  log.info("Server config", getServerConfig());
});

/**
 * get Peer geo Location using GeoJS
 * https://www.geojs.io/docs/v1/endpoints/geo/
 *
 * @param {string} ip
 * @returns json
 */
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

process.on("SIGINT", () => {
  log.debug("PROCESS", "SIGINT");
  process.exit();
});

process.on("SIGTERM", () => {
  log.debug("PROCESS", "SIGTERM");
  process.exit();
});

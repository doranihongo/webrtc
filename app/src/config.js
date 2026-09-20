"use strict";

/**
 * ==============================================
 * Kaiwa - Configuration File
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
 */

require("dotenv").config();

const path = require("path");

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

const port = process.env.PORT || 3000;

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
  // Login rate limiting (shared by /login and the kaiwa API endpoints)
  // ==========================================
  host: {
    maxLoginAttempts: parseInt(process.env.HOST_MAX_LOGIN_ATTEMPTS) || 5,
    minLoginBlockTime: parseInt(process.env.HOST_MIN_LOGIN_BLOCK_TIME) || 15, // in minutes
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
  // Homework audio submissions (kaiwa "Bài tập về nhà" - student records/
  // uploads a short audio clip, teacher looks it up by student_code and can
  // play it back). Reuses the same Google Drive OAuth account as
  // `googleDrive` above - only the destination folder differs.
  // ==========================================
  homework: {
    enabled: getEnvBoolean(process.env.HOMEWORK_ENABLED, true), // ops kill-switch
    maxUploadBytes:
      parseInt(process.env.HOMEWORK_MAX_UPLOAD_BYTES, 10) || 75 * 1024 * 1024, // ~75MB, generous for 15min opus/AAC
    maxDurationSeconds:
      parseInt(process.env.HOMEWORK_MAX_DURATION_SECONDS, 10) || 15 * 60,
    driveFolderId: process.env.GDRIVE_HOMEWORK_FOLDER_ID || null,
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
};

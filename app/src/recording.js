"use strict";

/**
 * Teacher-initiated call recording: browser sends ~30s MediaRecorder chunks
 * sequentially to this server, which appends them in arrival order to a
 * per-session temp file, then (on explicit stop, 5-minute inactivity, or
 * peer disconnect) patches the WebM duration metadata and uploads the
 * finished file to the teacher's personal Google Drive.
 *
 * Auth model: a plain HTTP POST has no socket.id, so presenter authorization
 * happens once, up front, over a Socket.IO event (where socket.id is
 * server-controlled and trustworthy) - see startSession(). That mints a
 * short-lived, high-entropy token which the client then attaches to every
 * chunk POST; appendChunk() only ever trusts the token, never anything else
 * the client claims about itself.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const config = require("./config");
const Logs = require("./logs");
const Validate = require("./validate");
const webmDurationFix = require("./webmDurationFix");
const GoogleDrive = require("./googleDrive");

const log = new Logs("recording");

const TEMP_DIR = config.recording.tempDir;
const IDLE_TIMEOUT_MS = config.recording.idleTimeoutMs;
const MIN_FREE_DISK_GB = config.recording.minFreeDiskGB;
const WARN_FREE_DISK_GB = config.recording.warnFreeDiskGB;
const MAX_CONCURRENT_SESSIONS = config.recording.maxConcurrentSessions;
const MAX_RETRY_ATTEMPTS = 8;
const RETRY_SWEEP_MS = 10 * 60 * 1000;
const DISK_WARN_CHECK_MS = 60 * 1000;
const TOKEN_RE = /^[0-9a-f]{64}$/;

const drive = new GoogleDrive(
  config.googleDrive.clientId,
  config.googleDrive.clientSecret,
  config.googleDrive.refreshToken,
  config.googleDrive.folderId,
  log,
);

// token -> session record (active, still receiving chunks)
const sessions = {};
// socket.id -> Set(token), for fast lookup on disconnect
const sessionsByPeer = {};
// failed Drive uploads waiting for retry: { finalizedPath, driveFileName, mimeType, attempts, nextAttemptAt }
const pendingUploads = [];

function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function tempPathFor(sessionId, ext) {
  return path.join(TEMP_DIR, `${sessionId}.${ext}.part`);
}
function finalizedPathFor(sessionId, ext) {
  return path.join(TEMP_DIR, `${sessionId}.${ext}.finalized`);
}

function checkDiskSpace() {
  try {
    ensureTempDir();
    const stat = fs.statfsSync(TEMP_DIR);
    const freeBytes = stat.bavail * stat.bsize;
    const freeGB = freeBytes / 1024 / 1024 / 1024;
    return {
      freeGB,
      ok: freeGB >= MIN_FREE_DISK_GB,
      warn: freeGB < WARN_FREE_DISK_GB,
    };
  } catch (err) {
    log.error("checkDiskSpace failed", { error: err.message });
    // Fail safe: if we can't even check, refuse new sessions rather than risk filling the disk.
    return { freeGB: 0, ok: false, warn: true };
  }
}

function activeSessionCount() {
  return Object.keys(sessions).length;
}

/**
 * Authorize (via the real socket.id, passed in from the Socket.IO handler)
 * and open a new recording session.
 * @param {object} params room_id, peer_id (MUST be socket.id), peer_name, peer_uuid, mode, mimeType, driveFolderId
 * @param {Function} isPeerPresenterFn server.js's isPeerPresenter(room_id, peer_id, peer_name, peer_uuid)
 * @returns {Promise<{ok:true, token:string, sessionId:string}|{ok:false, reason:string}>}
 */
async function startSession(
  { room_id, peer_id, peer_name, peer_uuid, mode, mimeType, driveFolderId },
  isPeerPresenterFn,
) {
  if (!config.recording.enabled) return { ok: false, reason: "disabled" };
  if (!Validate.isValidRoomName(room_id)) {
    return { ok: false, reason: "room_invalid" };
  }
  if (!isPeerPresenterFn(room_id, peer_id, peer_name, peer_uuid)) {
    log.warn("startSession refused - not presenter", { room_id, peer_id, peer_name });
    return { ok: false, reason: "not_presenter" };
  }
  if (activeSessionCount() >= MAX_CONCURRENT_SESSIONS) {
    log.warn("startSession refused - too many concurrent sessions", {
      active: activeSessionCount(),
    });
    return { ok: false, reason: "too_many_sessions" };
  }
  const disk = checkDiskSpace();
  if (!disk.ok) {
    log.warn("startSession refused - disk space low", disk);
    return { ok: false, reason: "disk_low" };
  }
  if (disk.warn) log.warn("Recording disk space getting low", disk);

  const token = crypto.randomBytes(32).toString("hex");
  const sessionId = crypto.randomUUID();
  const safeMimeType =
    typeof mimeType === "string" && mimeType.startsWith("video/")
      ? mimeType
      : "video/webm";
  const ext = safeMimeType.includes("mp4") ? "mp4" : "webm";

  const session = {
    token,
    sessionId,
    room_id,
    peer_id,
    peer_name,
    peer_uuid,
    mode,
    mimeType: safeMimeType,
    ext,
    // Presenter's personal Drive folder (profiles.drive_folder_id), if set -
    // see runFinalizeAndUpload/uploadFinalizedFile. null -> upload falls
    // back to the shared default folder (GDRIVE_FOLDER_ID in .env).
    driveFolderId: typeof driveFolderId === "string" && driveFolderId ? driveFolderId : null,
    tempPath: tempPathFor(sessionId, ext),
    nextChunkIndex: 0,
    bytesWritten: 0,
    startedAt: Date.now(),
    lastChunkAt: Date.now(),
    idleTimer: null,
    finalized: false,
    writeQueue: Promise.resolve(),
  };

  sessions[token] = session;
  if (!sessionsByPeer[peer_id]) sessionsByPeer[peer_id] = new Set();
  sessionsByPeer[peer_id].add(token);

  scheduleIdleFinalize(token);

  log.info("Recording session started", { sessionId, room_id, peer_name, mode });

  return { ok: true, token, sessionId };
}

function scheduleIdleFinalize(token) {
  const session = sessions[token];
  if (!session) return;
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => {
    finalizeSession(token, { reason: "idle" }).catch((err) =>
      log.error("finalizeSession(idle) failed", { token, error: err.message }),
    );
  }, IDLE_TIMEOUT_MS);
}

/**
 * Append a chunk to a session's temp file, in order.
 * @param {string} token
 * @param {number} chunkIndex
 * @param {boolean} isFinal
 * @param {Buffer} buffer
 */
async function appendChunk(token, chunkIndex, isFinal, buffer) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    return { ok: false, reason: "invalid_token" };
  }
  const session = sessions[token];
  if (!session || session.finalized) {
    return { ok: false, reason: "session_not_found" };
  }
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return { ok: false, reason: "invalid_chunk_index" };
  }
  if (!buffer || !buffer.length) {
    return { ok: false, reason: "empty_chunk" };
  }

  // Ack from a previous attempt was lost and the client retried the same
  // chunk - acknowledge again without re-appending (idempotent).
  if (chunkIndex === session.nextChunkIndex - 1) {
    return { ok: true, receivedBytes: session.bytesWritten, duplicate: true };
  }

  if (chunkIndex !== session.nextChunkIndex) {
    log.error("Recording chunk out of order, aborting session", {
      sessionId: session.sessionId,
      expected: session.nextChunkIndex,
      got: chunkIndex,
    });
    finalizeSession(token, { reason: "out_of_order" }).catch((err) =>
      log.error("finalizeSession(out_of_order) failed", { token, error: err.message }),
    );
    return { ok: false, reason: "out_of_order" };
  }

  try {
    // Serialize writes per session (client already sends sequentially and
    // awaits each ack, so this is a defensive guarantee, not the primary one).
    session.writeQueue = session.writeQueue.then(async () => {
      await fs.promises.appendFile(session.tempPath, buffer);
      session.nextChunkIndex++;
      session.bytesWritten += buffer.length;
      session.lastChunkAt = Date.now();
    });
    await session.writeQueue;
  } catch (err) {
    log.error("appendChunk write failed", { sessionId: session.sessionId, error: err.message });
    return { ok: false, reason: "write_failed" };
  }

  if (isFinal) {
    // Resolve the HTTP response as soon as the bytes are durable - the
    // Drive-upload portion runs in the background, not awaited here.
    finalizeSession(token, { reason: "explicit" }).catch((err) =>
      log.error("finalizeSession(explicit) failed", { token, error: err.message }),
    );
  } else {
    scheduleIdleFinalize(token);
  }

  return { ok: true, receivedBytes: session.bytesWritten };
}

/**
 * Idempotent: closes the session, patches duration, and kicks off the Drive
 * upload (not awaited by callers that don't need to block on it).
 */
async function finalizeSession(token, { reason } = {}) {
  const session = sessions[token];
  if (!session || session.finalized) return;
  session.finalized = true;

  if (session.idleTimer) clearTimeout(session.idleTimer);
  delete sessions[token];
  sessionsByPeer[session.peer_id]?.delete(token);

  log.info("Finalizing recording session", {
    sessionId: session.sessionId,
    room_id: session.room_id,
    reason,
    bytesWritten: session.bytesWritten,
  });

  if (session.bytesWritten === 0) {
    fs.promises.unlink(session.tempPath).catch(() => {});
    return;
  }

  const finalizedPath = finalizedPathFor(session.sessionId, session.ext);
  const durationMs = Math.max(0, session.lastChunkAt - session.startedAt);
  await runFinalizeAndUpload(session.tempPath, finalizedPath, {
    ext: session.ext,
    mimeType: session.mimeType,
    room_id: session.room_id,
    startedAt: session.startedAt,
    durationMs,
    driveFolderId: session.driveFolderId,
  });
}

// Recording file names always show Vietnam local time, regardless of the
// server's own TZ (blank/UTC in .env) - the audience is always in Vietnam,
// unlike server logs which follow LOGS' own TZ setting.
const RECORDING_NAME_TZ = "Asia/Ho_Chi_Minh";

/**
 * @param {number} ms epoch ms
 * @returns {{datePart: string, timePart: string}} e.g. { datePart: "10/8/26", timePart: "10:46AM" }
 */
function formatVnDateTime(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: RECORDING_NAME_TZ,
      year: "2-digit",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return {
    datePart: `${parts.day}/${parts.month}/${parts.year}`,
    timePart: `${parts.hour}:${parts.minute}${parts.dayPeriod}`, // dayPeriod is "AM"/"PM" for en-US
  };
}

/**
 * Builds "10/8/26 10:46AM (1).webm" - the trailing (n) is one past the
 * highest sequence number already used for that same calendar day (Vietnam
 * time) in the destination Drive folder, so a 2nd recording the same day
 * becomes (2) and stays (3) even if (2) gets deleted from Drive afterwards
 * (see maxSequenceWithNamePrefix's doc comment). Resets to (1) the next day
 * since the date prefix itself changes. Falls back to (1) if the Drive
 * lookup fails (offline, API error, no folder configured) - never blocks
 * the upload over a cosmetic detail.
 */
async function buildDriveFileName(startedAt, ext, driveFolderId) {
  const { datePart, timePart } = formatVnDateTime(startedAt);
  const datePrefix = `${datePart} `;
  let n = 1;
  if (drive.isConfigured()) {
    try {
      n = (await drive.maxSequenceWithNamePrefix(driveFolderId, datePrefix)) + 1;
    } catch (err) {
      log.warn("buildDriveFileName: maxSequenceWithNamePrefix failed, defaulting to (1)", {
        error: err.message,
      });
    }
  }
  return `${datePart} ${timePart} (${n}).${ext}`;
}

/**
 * Patch duration metadata then upload. Shared by finalizeSession() and
 * recoverOnStartup() (for files orphaned by an ungraceful process restart).
 */
async function runFinalizeAndUpload(partPath, finalizedPath, meta) {
  try {
    webmDurationFix.fixWebmDurationFile(partPath, finalizedPath, meta.durationMs);
  } catch (err) {
    log.error("fixWebmDurationFile failed, uploading raw file instead", {
      partPath,
      error: err.message,
    });
    fs.copyFileSync(partPath, finalizedPath);
  }
  fs.promises.unlink(partPath).catch(() => {});

  const driveFileName = await buildDriveFileName(meta.startedAt, meta.ext, meta.driveFolderId);

  await uploadFinalizedFile(finalizedPath, driveFileName, meta.mimeType, meta.driveFolderId);
}

async function uploadFinalizedFile(finalizedPath, driveFileName, mimeType, driveFolderId) {
  if (!drive.isConfigured()) {
    log.error(
      "Google Drive not configured (missing GDRIVE_* env vars) - keeping file on disk",
      { finalizedPath },
    );
    return;
  }
  try {
    const localSize = fs.statSync(finalizedPath).size;
    const result = await drive.uploadFile(finalizedPath, driveFileName, mimeType, driveFolderId);
    if (result.size !== localSize) {
      throw new Error(`size mismatch after upload: local=${localSize} drive=${result.size}`);
    }
    fs.promises.unlink(finalizedPath).catch(() => {});
    log.info("Recording uploaded to Drive", {
      driveFileName,
      driveId: result.id,
      size: result.size,
    });
  } catch (err) {
    log.error("Drive upload failed, keeping local file for retry", {
      finalizedPath,
      error: err.message,
    });
    enqueueRetry(finalizedPath, driveFileName, mimeType, driveFolderId);
  }
}

function backoffMs(attempts) {
  return Math.min(10 * 60 * 1000 * 2 ** attempts, 6 * 60 * 60 * 1000); // cap 6h
}

function enqueueRetry(finalizedPath, driveFileName, mimeType, driveFolderId, attempts = 0) {
  pendingUploads.push({
    finalizedPath,
    driveFileName,
    mimeType,
    driveFolderId,
    attempts,
    nextAttemptAt: Date.now() + backoffMs(attempts),
  });
}

async function sweepRetryQueue() {
  const now = Date.now();
  const due = pendingUploads.filter((p) => p.nextAttemptAt <= now);
  for (const item of due) {
    const idx = pendingUploads.indexOf(item);
    if (idx !== -1) pendingUploads.splice(idx, 1);

    if (!fs.existsSync(item.finalizedPath)) continue; // uploaded/removed by other means

    item.attempts++;
    if (item.attempts > MAX_RETRY_ATTEMPTS) {
      log.error(
        "Recording upload permanently failed after max retries - file kept on disk for manual recovery",
        item,
      );
      continue;
    }
    try {
      const localSize = fs.statSync(item.finalizedPath).size;
      const result = await drive.uploadFile(
        item.finalizedPath,
        item.driveFileName,
        item.mimeType,
        item.driveFolderId,
      );
      if (result.size !== localSize) throw new Error("size mismatch on retry");
      fs.promises.unlink(item.finalizedPath).catch(() => {});
      log.info("Recording upload retry succeeded", { driveFileName: item.driveFileName });
    } catch (err) {
      log.error("Recording upload retry failed", { attempts: item.attempts, error: err.message });
      enqueueRetry(
        item.finalizedPath,
        item.driveFileName,
        item.mimeType,
        item.driveFolderId,
        item.attempts,
      );
    }
  }
}

/**
 * Best-effort: finalize any active sessions owned by a socket that just
 * disconnected, instead of waiting out the full idle timeout. The idle
 * timeout remains the authoritative safety net for cases with no
 * disconnect event at all (crash, power loss).
 */
function finalizeForPeer(peerId) {
  const tokens = sessionsByPeer[peerId];
  if (!tokens || !tokens.size) return;
  for (const token of Array.from(tokens)) {
    finalizeSession(token, { reason: "peer_disconnect" }).catch((err) =>
      log.error("finalizeForPeer failed", { token, error: err.message }),
    );
  }
  delete sessionsByPeer[peerId];
}

/**
 * Call once at server boot: recovers any temp files left behind by an
 * ungraceful process restart (no SIGTERM handler exists in this codebase,
 * so a `pm2 restart` mid-recording is a real scenario) and feeds them back
 * into the finalize/upload pipeline.
 */
function recoverOnStartup() {
  ensureTempDir();
  let files;
  try {
    files = fs.readdirSync(TEMP_DIR);
  } catch (err) {
    log.error("recoverOnStartup: cannot read temp dir", { error: err.message });
    return;
  }

  for (const file of files) {
    const full = path.join(TEMP_DIR, file);

    if (file.endsWith(".finalized")) {
      const mimeType = file.endsWith(".mp4.finalized") ? "video/mp4" : "video/webm";
      log.info("recoverOnStartup: orphaned finalized recording, queuing upload", { file });
      // Which teacher's folder this belonged to is lost across a restart
      // (same known limitation as room_id/durationMs below) - falls back to
      // the shared default folder, same as before this feature existed.
      enqueueRetry(full, file.replace(/\.finalized$/, ""), mimeType, null);
      continue;
    }

    if (file.endsWith(".part")) {
      const mimeType = file.endsWith(".mp4.part") ? "video/mp4" : "video/webm";
      const ext = mimeType === "video/mp4" ? "mp4" : "webm";
      const sessionId = file.replace(new RegExp(`\\.${ext}\\.part$`), "");
      const finalizedPath = finalizedPathFor(sessionId, ext);
      log.info("recoverOnStartup: orphaned in-progress recording, finalizing", { file });
      runFinalizeAndUpload(full, finalizedPath, {
        ext,
        mimeType,
        room_id: "recovered",
        startedAt: Date.now(),
        durationMs: 0, // unknown after a restart - duration fix is best-effort here
      }).catch((err) =>
        log.error("recoverOnStartup: finalize failed", { file, error: err.message }),
      );
    }
  }
}

setInterval(() => {
  sweepRetryQueue().catch((err) => log.error("sweepRetryQueue failed", { error: err.message }));
}, RETRY_SWEEP_MS);

setInterval(() => {
  if (activeSessionCount() === 0) return;
  const disk = checkDiskSpace();
  if (disk.warn) log.warn("Recording disk space low", disk);
}, DISK_WARN_CHECK_MS);

module.exports = {
  startSession,
  appendChunk,
  finalizeSession,
  finalizeForPeer,
  recoverOnStartup,
  checkDiskSpace,
};

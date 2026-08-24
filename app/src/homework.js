"use strict";

/**
 * Student "Bài tập về nhà" (homework) audio submissions - student
 * records/uploads a short clip (a few minutes, capped by
 * config.homework.maxDurationSeconds/maxUploadBytes) for a given
 * kaiwa_homeworks assignment, uploaded to a single shared Google Drive
 * folder. Teacher looks submissions up by student_code (see server.js's
 * /kaiwa/homework/* routes) and can play them back, incl. mixed into a live
 * call so both peers hear it (public/js/client.js).
 *
 * Deliberately NOT modeled after recording.js's chunked-session/background-
 * retry-queue design: homework clips are short (≤ maxDurationSeconds) and
 * arrive as one already-complete buffer (client records the whole thing into
 * a Blob with MediaRecorder, then does a single POST) - so the whole upload
 * happens synchronously within that one HTTP request, awaited before
 * responding. This also sidesteps a real correctness problem a background
 * retry queue would have here: unlike recording.js (which never touches
 * Supabase at all), submitHomework/deleteHomeworkSubmission write rows to
 * Supabase using the STUDENT'S OWN forwarded access token (no service_role
 * key in this codebase - see server.js's comment on that near the profiles
 * lookup in io.use()). That token is short-lived; a retry running minutes/
 * hours later on a stale token would just fail with 401. Failing the
 * request immediately and letting the client re-POST the Blob it already
 * has in memory is simpler and more honest than a retry queue that can't
 * actually guarantee eventual consistency.
 */

const config = require("./config");
const Logs = require("./logs");
const GoogleDrive = require("./googleDrive");

const log = new Logs("homework");

const drive = new GoogleDrive(
  config.googleDrive.clientId,
  config.googleDrive.clientSecret,
  config.googleDrive.refreshToken,
  config.homework.driveFolderId,
  log,
);

const SUPABASE_URL = config.supabase.url;
const SUPABASE_ANON_KEY = config.supabase.anonKey;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY };
}

// Recording file/folder names always show Vietnam local time, regardless of
// the server's own TZ - same rationale/format as recording.js's
// formatVnDateTime (the audience is always in Vietnam).
const NAME_TZ = "Asia/Ho_Chi_Minh";

function formatVnDateTime(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: NAME_TZ,
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
    timePart: `${parts.hour}:${parts.minute}${parts.dayPeriod}`,
  };
}

/**
 * Builds "Tên học viên - Tên đề bài - 10/8/26 10:46AM (1).webm" - all
 * homework audio lives in ONE shared Drive folder (unlike recording.js,
 * which gets a separate folder per teacher), so the name itself has to
 * carry who/what it is. The trailing "(n)" reuses
 * GoogleDrive.maxSequenceWithNamePrefix exactly like recording.js's
 * buildDriveFileName - see that function's doc comment for why it's the
 * MAX seen, not a count.
 */
async function buildDriveFileName(studentDisplayName, homeworkTitle, ext) {
  const { datePart, timePart } = formatVnDateTime(Date.now());
  const safe = (s) => String(s || "").replace(/[\\/]/g, "-").trim();
  const prefix = `${safe(studentDisplayName)} - ${safe(homeworkTitle)} - ${datePart} `;
  let n = 1;
  if (drive.isConfigured()) {
    try {
      n = (await drive.maxSequenceWithNamePrefix(config.homework.driveFolderId, prefix)) + 1;
    } catch (err) {
      log.warn("buildDriveFileName: maxSequenceWithNamePrefix failed, defaulting to (1)", {
        error: err.message,
      });
    }
  }
  return `${prefix}${timePart} (${n}).${ext}`;
}

function extFromMimeType(mimeType) {
  if (typeof mimeType === "string" && mimeType.includes("mp4")) return "mp4";
  return "webm";
}

/**
 * @param {object} params
 * @param {string} params.token student's own sb_page_token (Supabase access
 *   token) - used for every Supabase REST call so RLS (student_id =
 *   auth.uid()) enforces ownership; this module never uses a service_role key.
 * @param {string} params.homeworkId
 * @param {string} params.studentId caller's own auth.uid(), from
 *   getKaiwaHomeworkAuthUser - passed separately (not re-derived here) so
 *   this module never has to talk to Supabase Auth itself.
 * @param {string} params.studentDisplayName for the Drive filename only.
 * @param {string} params.homeworkTitle for the Drive filename only.
 * @param {string} params.mimeType
 * @param {Buffer} params.buffer
 * @param {number|null} params.durationMs
 * @returns {Promise<{ok:true, submission:object}|{ok:false, reason:string, status:number}>}
 */
async function submitHomework({
  token,
  homeworkId,
  studentId,
  studentDisplayName,
  homeworkTitle,
  mimeType,
  buffer,
  durationMs,
}) {
  if (!config.homework.enabled) return { ok: false, reason: "disabled", status: 503 };
  if (!buffer || !buffer.length) return { ok: false, reason: "empty_upload", status: 400 };
  if (buffer.length > config.homework.maxUploadBytes) {
    return { ok: false, reason: "too_large", status: 413 };
  }
  if (!drive.isConfigured()) {
    log.error("submitHomework refused - Google Drive not configured (missing GDRIVE_* env vars)");
    return { ok: false, reason: "drive_not_configured", status: 503 };
  }

  const ext = extFromMimeType(mimeType);
  const fileName = await buildDriveFileName(studentDisplayName, homeworkTitle, ext);

  let uploaded;
  try {
    uploaded = await drive.uploadBuffer(buffer, fileName, mimeType, config.homework.driveFolderId);
  } catch (err) {
    log.error("submitHomework: Drive upload failed", { homeworkId, studentId, error: err.message });
    return { ok: false, reason: "upload_failed", status: 502 };
  }

  // Existing submission for this (homework, student)? Re-upload replaces it
  // - delete the old Drive file (best-effort; an orphaned old file is a far
  // lesser problem than blocking the student's re-submit over it) then
  // upsert the row. `Prefer: resolution=merge-duplicates` relies on the
  // `unique (homework_id, student_id)` constraint from the schema.
  let existing;
  try {
    const { getJson } = await supabaseGet(
      token,
      "kaiwa_homework_submissions",
      { homework_id: `eq.${homeworkId}`, student_id: `eq.${studentId}`, select: "id,drive_file_id" },
    );
    existing = getJson?.[0] || null;
  } catch (err) {
    log.warn("submitHomework: lookup of existing submission failed (continuing as new)", {
      error: err.message,
    });
  }

  if (existing?.drive_file_id) {
    try {
      await drive.deleteFile(existing.drive_file_id);
    } catch (err) {
      log.warn("submitHomework: failed to delete previous Drive file (orphaned, non-fatal)", {
        driveFileId: existing.drive_file_id,
        error: err.message,
      });
    }
  }

  const row = {
    homework_id: homeworkId,
    student_id: studentId,
    drive_file_id: uploaded.id,
    drive_file_name: uploaded.name,
    mime_type: mimeType,
    duration_ms: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
    size_bytes: uploaded.size,
    updated_at: new Date().toISOString(),
  };

  try {
    const submission = await supabaseUpsertSubmission(token, row);
    return { ok: true, submission: toClientSubmission(submission) };
  } catch (err) {
    // Drive upload succeeded but we couldn't record it in Supabase - flag
    // loudly (orphaned Drive file, student will see "nộp thất bại" and can
    // just retry from the UI; the old file, if any, is already gone above).
    log.error("submitHomework: Drive upload succeeded but Supabase row write failed", {
      homeworkId,
      studentId,
      driveFileId: uploaded.id,
      error: err.message,
    });
    return { ok: false, reason: "save_failed", status: 502 };
  }
}

/**
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.submissionId
 * @param {string} params.studentId caller's own auth.uid() - the row is
 *   fetched and its `student_id` compared against this before anything is
 *   deleted (defense in depth; RLS would refuse the row-level DELETE below
 *   anyway if they didn't match, but failing fast with a clear reason is
 *   more useful to the route than a generic "0 rows affected").
 * @returns {Promise<{ok:true}|{ok:false, reason:string, status:number}>}
 */
async function deleteHomeworkSubmission({ token, submissionId, studentId }) {
  let row;
  try {
    const { getJson } = await supabaseGet(token, "kaiwa_homework_submissions", {
      id: `eq.${submissionId}`,
      select: "id,student_id,drive_file_id",
    });
    row = getJson?.[0] || null;
  } catch (err) {
    return { ok: false, reason: "lookup_failed", status: 502 };
  }
  if (!row) return { ok: false, reason: "not_found", status: 404 };
  if (row.student_id !== studentId) return { ok: false, reason: "forbidden", status: 403 };

  if (row.drive_file_id) {
    try {
      await drive.deleteFile(row.drive_file_id);
    } catch (err) {
      log.warn("deleteHomeworkSubmission: Drive delete failed (continuing to delete row)", {
        driveFileId: row.drive_file_id,
        error: err.message,
      });
    }
  }

  try {
    await supabaseDelete(token, "kaiwa_homework_submissions", { id: `eq.${submissionId}` });
  } catch (err) {
    log.error("deleteHomeworkSubmission: row delete failed after Drive delete", {
      submissionId,
      error: err.message,
    });
    return { ok: false, reason: "delete_failed", status: 502 };
  }
  return { ok: true };
}

function isPastDeadline(homework) {
  return !!(homework && homework.deadline && new Date(homework.deadline).getTime() < Date.now());
}

// ---- small Supabase REST helpers (no service_role key - always the
// caller's own forwarded token, RLS is the real enforcement) ----

async function supabaseGet(token, table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url, { headers: authHeaders(token) });
  const getJson = await resp.json();
  if (!resp.ok) throw new Error(`Supabase GET ${table} failed: ${resp.status} ${JSON.stringify(getJson)}`);
  return { getJson };
}

async function supabaseUpsertSubmission(token, row) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/kaiwa_homework_submissions`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`Supabase upsert submission failed: ${resp.status} ${JSON.stringify(json)}`);
  return Array.isArray(json) ? json[0] : json;
}

async function supabaseDelete(token, table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url, { method: "DELETE", headers: authHeaders(token) });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Supabase DELETE ${table} failed: ${resp.status} ${text}`);
  }
}

/** Never leak drive_file_id to the browser - only what the client needs. */
function toClientSubmission(row) {
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

module.exports = {
  submitHomework,
  deleteHomeworkSubmission,
  isPastDeadline,
  drive, // exported so server.js's audio-listen route can call drive.downloadFile directly
};

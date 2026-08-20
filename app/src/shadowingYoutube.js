"use strict";

/**
 * Shadowing YouTube (kaiwa tool): given a YouTube link, pull whatever
 * Japanese captions the video already has (creator-uploaded first, YouTube's
 * own auto-generated captions as fallback) via yt-dlp, and hand back a plain
 * transcript with per-line timestamps. No audio is transcribed by us - this
 * only reuses captions that already exist on YouTube.
 *
 * yt-dlp is invoked with --skip-download; nothing but the tiny .vtt caption
 * file is downloaded. The URL is restricted to youtube.com/youtu.be hosts
 * (see normalizeYoutubeUrl) before it ever reaches yt-dlp, since yt-dlp
 * itself supports hundreds of extractors and would otherwise turn this
 * endpoint into an arbitrary-URL fetch proxy.
 *
 * Sentences are split on punctuation (segmentStream()) - videos whose
 * captions don't have any won't segment well, so pick ones that do.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const config = require("./config");
const Logs = require("./logs");

const log = new Logs("shadowingYoutube");

const TEMP_DIR = config.shadowing.tempDir;
const YTDLP_PATH = config.shadowing.ytDlpPath;
const TIMEOUT_MS = config.shadowing.timeoutMs;

const ALLOWED_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Accepts watch/shorts/embed/live/youtu.be URLs, rejects anything whose
 * host isn't YouTube, and returns a canonical watch URL + bare video id.
 */
function normalizeYoutubeUrl(input) {
  if (!input || typeof input !== "string") return null;
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  let videoId = null;
  if (host === "youtu.be") {
    videoId = url.pathname.slice(1).split("/")[0];
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v");
  } else if (url.pathname.startsWith("/shorts/")) {
    videoId = url.pathname.split("/")[2];
  } else if (url.pathname.startsWith("/embed/")) {
    videoId = url.pathname.split("/")[2];
  } else if (url.pathname.startsWith("/live/")) {
    videoId = url.pathname.split("/")[2];
  }

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;
  return { videoId, cleanUrl: `https://www.youtube.com/watch?v=${videoId}` };
}

function toSeconds(timestamp) {
  const [h, m, s] = timestamp.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/**
 * Some caption sources leave stray spaces around Japanese/CJK characters
 * (e.g. between a <c> tag boundary and the next kanji). Japanese doesn't
 * use spaces, so strip them at the source, while leaving spacing inside
 * runs of Latin text (e.g. "NEWS WEB EASY") alone.
 */
function collapseSpacesAroundCjk(text) {
  return text.replace(/([^\x00-\x7F])\s+/g, "$1").replace(/\s+([^\x00-\x7F])/g, "$1");
}

/**
 * Parses a .vtt file into raw {start, end, text} cues, stripping the inline
 * karaoke tags YouTube's auto-captions embed (<00:00:01.200> word timing,
 * <c>...</c> word wrappers). Japanese has no spaces between words, so a
 * cue's (up to 2) physical lines are joined with no separator.
 */
function parseVttCues(raw) {
  const lines = raw.replace(/\r/g, "").split("\n");
  const timeRe = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/;
  const cues = [];

  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(timeRe);
    if (m) {
      const start = toSeconds(m[1]);
      const end = toSeconds(m[2]);
      i++;
      const rawTextLines = [];
      while (i < lines.length && lines[i].trim() !== "") {
        rawTextLines.push(lines[i]);
        i++;
      }
      const text = collapseSpacesAroundCjk(
        rawTextLines
          .map((l) =>
            l
              .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")
              .replace(/<\/?c[^>]*>/g, "")
              .trim(),
          )
          .join("")
          .trim(),
      );
      if (text) cues.push({ start, end, text });
    }
    i++;
  }
  return cues;
}

/**
 * YouTube's auto-generated captions scroll a 2-line teleprompter window:
 * each new cue repeats the still-visible tail of the previous one and
 * appends more, so consecutive cues overlap and there is no cue-per-sentence
 * structure to rely on - a sentence can straddle several cues, or a cue can
 * straddle two sentences. Creator-uploaded captions don't do this (each cue
 * is already a finished, standalone line).
 *
 * This reconstructs one continuous, correctly-ordered text stream by
 * matching, for each cue, how much of its text already overlaps the tail of
 * what's been emitted so far and only appending the new remainder - with a
 * timing "mark" recorded at the moment each remainder appeared. A cue that
 * shares nothing with what came before (the normal case for clean,
 * non-rolling captions) also records a hard break, so those boundaries are
 * preserved even where there's no sentence-ending punctuation to split on.
 */
function reconstructStream(cues) {
  let emitted = "";
  const marks = []; // { index: charOffset into `emitted`, time: seconds }
  const hardBreaks = new Set(); // charOffsets that must start a new segment

  for (const cue of cues) {
    const full = cue.text;
    if (!full) continue;

    const maxOverlap = Math.min(emitted.length, full.length);
    let overlap = 0;
    for (let k = maxOverlap; k > 0; k--) {
      if (emitted.slice(emitted.length - k) === full.slice(0, k)) {
        overlap = k;
        break;
      }
    }

    const newPart = full.slice(overlap);
    if (!newPart) continue;

    if (overlap === 0 && emitted.length > 0) hardBreaks.add(emitted.length);
    marks.push({ index: emitted.length, time: cue.start });
    emitted += newPart;
  }

  return { emitted, marks, hardBreaks };
}

/** Latest mark at-or-before `offset`, falling back to the first mark. */
function timeAtOffset(marks, offset) {
  let time = marks[0]?.time ?? 0;
  for (const mark of marks) {
    if (mark.index > offset) break;
    time = mark.time;
  }
  return time;
}

/**
 * Splits the reconstructed stream into shadowing-sized lines: after every
 * Japanese sentence-ending punctuation mark, and at every hard break from
 * reconstructStream(). Each resulting line gets a start/end time from the
 * marks that cover its character range.
 */
function segmentStream({ emitted, marks, hardBreaks }, fallbackEnd) {
  if (!emitted) return [];

  const breakPoints = new Set(hardBreaks);
  // ↓/↑ are included as sentence enders too: some creator captions use them
  // as a standalone pitch-intonation mark right where a quote closes (e.g.
  // "「何なんですか?↓」" for a falling tone) with no other punctuation, so
  // without them a quote like that never gets a break point and bleeds into
  // whatever quote follows it on the same cue.
  const sentenceEndRe = /[。！？!?↓↑]/g;
  // A closing quote/bracket (or a trailing ↓/↑ mark) right after the
  // punctuation (「…？」 / 「…?↓」) belongs with the sentence it closes, not
  // on its own line - swallow any run of these before placing the break
  // point.
  const closingChars = new Set([
    "」", "』", "”", "’", ")", "）", "】", "》", "〉", "↓", "↑",
  ]);
  let m;
  while ((m = sentenceEndRe.exec(emitted))) {
    let idx = m.index + 1;
    while (idx < emitted.length && closingChars.has(emitted[idx])) idx++;
    breakPoints.add(idx);
  }
  breakPoints.add(emitted.length);

  const sortedBreaks = [...breakPoints].filter((n) => n > 0).sort((a, b) => a - b);

  const rawSegments = [];
  let cursor = 0;
  for (const brk of sortedBreaks) {
    if (brk <= cursor) continue;
    const text = emitted.slice(cursor, brk).trim();
    if (text) rawSegments.push({ startOffset: cursor, endOffset: brk, text });
    cursor = brk;
  }

  return rawSegments.map((seg, idx) => {
    const start = timeAtOffset(marks, seg.startOffset);
    const nextStart =
      idx + 1 < rawSegments.length
        ? timeAtOffset(marks, rawSegments[idx + 1].startOffset)
        : fallbackEnd;
    const end = nextStart > start ? nextStart : start + 1;
    return { start, end, text: seg.text };
  });
}

function cleanupJob(jobId) {
  try {
    for (const f of fs.readdirSync(TEMP_DIR)) {
      if (f.startsWith(`${jobId}.`)) {
        fs.unlinkSync(path.join(TEMP_DIR, f));
      }
    }
  } catch (err) {
    log.debug("cleanupJob: nothing to remove", { jobId, err: err.message });
  }
}

function runYtDlp(args) {
  return new Promise((resolve) => {
    let settled = false;
    let child;
    try {
      child = spawn(YTDLP_PATH, args, { windowsHide: true });
    } catch (err) {
      resolve({ ok: false, code: "ytdlp_missing", message: err.message });
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({ ok: false, code: "timeout" });
    }, TIMEOUT_MS);

    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, code: "ytdlp_missing", message: err.message });
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: exitCode === 0,
        code: exitCode === 0 ? "ok" : "ytdlp_error",
        stderr,
      });
    });
  });
}

function errorMessageFor(code) {
  switch (code) {
    case "invalid_url":
      return "Link YouTube không hợp lệ.";
    case "ytdlp_missing":
      return "Server chưa cài yt-dlp (hoặc SHADOWING_YTDLP_PATH sai đường dẫn).";
    case "timeout":
      return "Lấy phụ đề quá lâu, thử lại sau.";
    case "no_captions":
      return "Video này chưa có phụ đề tiếng Nhật (thủ công hoặc tự động) trên YouTube.";
    case "empty_captions":
      return "Phụ đề tiếng Nhật của video này rỗng.";
    case "parse_error":
      return "Không đọc được phụ đề tải về.";
    default:
      return "Không lấy được phụ đề từ YouTube.";
  }
}

/**
 * @param {string} rawUrl
 * @returns {Promise<{ok:true, videoId:string, segments:{start:number,end:number,text:string}[]}
 *                  | {ok:false, code:string, message:string}>}
 */
async function getTranscript(rawUrl) {
  const parsed = normalizeYoutubeUrl(rawUrl);
  if (!parsed) {
    return { ok: false, code: "invalid_url", message: errorMessageFor("invalid_url") };
  }

  ensureTempDir();
  const jobId = crypto.randomBytes(8).toString("hex");
  const outBase = path.join(TEMP_DIR, jobId);

  const args = [
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    // Exact codes only - NOT "ja.*" (yt-dlp treats sub-langs as a regex,
    // and "." matches any char). Some videos carry a pile of differently
    // -suffixed tracks like "ja-ar", "ja-my", "ja-zh"... (unclear why -
    // possibly per-viewer-locale auto-translate variants); a wildcard here
    // matches all of them, yt-dlp tries to download every one, and YouTube
    // 429s partway through, failing the whole request even though the one
    // real "ja" track had already been fetched successfully by then.
    "--sub-langs",
    "ja-orig,ja",
    "--sub-format",
    "vtt",
    "--no-playlist",
    "--no-warnings",
    "--socket-timeout",
    "15",
    // Plain "web" extraction gets YouTube's "Sign in to confirm you're not
    // a bot" wall increasingly often (datacenter/shared IPs especially).
    // The android client isn't subject to that same anti-bot check.
    "--extractor-args",
    "youtube:player_client=android,web",
    "-o",
    `${outBase}.%(ext)s`,
    parsed.cleanUrl,
  ];

  log.debug("Fetching YouTube captions", { videoId: parsed.videoId });
  const result = await runYtDlp(args);

  if (!result.ok) {
    cleanupJob(jobId);
    if (result.code === "ytdlp_missing") {
      log.error("yt-dlp not available on this server", result.message);
    } else {
      log.warn("yt-dlp failed", {
        videoId: parsed.videoId,
        code: result.code,
        stderr: result.stderr?.slice(-500),
      });
    }
    return { ok: false, code: result.code, message: errorMessageFor(result.code) };
  }

  let files = [];
  try {
    files = fs
      .readdirSync(TEMP_DIR)
      .filter((f) => f.startsWith(`${jobId}.`) && f.endsWith(".vtt"));
  } catch (err) {
    log.error("Failed to read shadowing temp dir", err);
  }

  if (files.length === 0) {
    cleanupJob(jobId);
    return { ok: false, code: "no_captions", message: errorMessageFor("no_captions") };
  }

  // yt-dlp may write both "<id>.ja.vtt" and a "<id>.ja-orig.vtt"/regional
  // variant for the same track - prefer the plain "ja" file when present.
  files.sort((a, b) => a.length - b.length);

  let cues = [];
  let lastCueEnd = 0;
  try {
    const raw = fs.readFileSync(path.join(TEMP_DIR, files[0]), "utf-8");
    cues = parseVttCues(raw);
    lastCueEnd = cues.length ? cues[cues.length - 1].end : 0;
  } catch (err) {
    log.error("Failed to parse VTT", err);
    cleanupJob(jobId);
    return { ok: false, code: "parse_error", message: errorMessageFor("parse_error") };
  }

  cleanupJob(jobId);

  const segments = segmentStream(reconstructStream(cues), lastCueEnd);

  if (segments.length === 0) {
    return { ok: false, code: "empty_captions", message: errorMessageFor("empty_captions") };
  }

  return { ok: true, videoId: parsed.videoId, segments };
}

module.exports = { getTranscript, normalizeYoutubeUrl };

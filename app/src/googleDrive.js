"use strict";

// Minimal Google Drive resumable-upload client for a single personal
// account (OAuth refresh token, not a service account). Uses the global
// `fetch` (Node 18+) - no `googleapis` dependency needed. This flow was
// prototyped and validated end-to-end before being wired in here.

const fs = require("fs");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
const LIST_URL = "https://www.googleapis.com/drive/v3/files";

module.exports = class GoogleDrive {
  /**
   * @param {string} clientId
   * @param {string} clientSecret
   * @param {string} refreshToken
   * @param {string|null} folderId optional Drive folder to upload into
   * @param {import('./logs')} [log]
   */
  constructor(clientId, clientSecret, refreshToken, folderId, log) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.folderId = folderId || null;
    this.log = log;
    this._accessToken = null;
    this._accessTokenExpiresAt = 0; // ms epoch
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.refreshToken);
  }

  async _getAccessToken() {
    // small safety margin so we don't hand out a token that expires mid-upload
    if (this._accessToken && Date.now() < this._accessTokenExpiresAt - 30_000) {
      return this._accessToken;
    }
    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      throw new Error(
        "GoogleDrive: failed to refresh access token - " + JSON.stringify(json),
      );
    }
    this._accessToken = json.access_token;
    this._accessTokenExpiresAt = Date.now() + (json.expires_in || 3600) * 1000;
    return this._accessToken;
  }

  async _createResumableSession(fileName, mimeType, sizeBytes, folderId) {
    const accessToken = await this._getAccessToken();
    const metadata = { name: fileName };
    const effectiveFolderId = folderId || this.folderId;
    if (effectiveFolderId) metadata.parents = [effectiveFolderId];

    const resp = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(sizeBytes),
      },
      body: JSON.stringify(metadata),
    });
    if (!resp.ok) {
      throw new Error(
        "GoogleDrive: failed to init resumable session - " +
          resp.status +
          " " +
          (await resp.text()),
      );
    }
    const uploadUrl = resp.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("GoogleDrive: resumable session had no Location header");
    }
    return uploadUrl;
  }

  /**
   * Highest "(n)" sequence number already used among files directly inside a
   * folder whose name starts with `prefix` - used to number same-day
   * recordings ("10/8/26 10:46AM (1)", "(2)", ...). Deliberately the MAX
   * seen, not a count: if "(1)" gets deleted from Drive later, a fresh count
   * of remaining files would drop back to 1 and hand out "(2)" again -
   * colliding with the "(2)" that already exists. Reading back the highest
   * number actually used keeps numbering monotonic regardless of deletions.
   *
   * The Drive API only offers substring `contains` in query strings (no
   * `startsWith`), which is unsafe alone - e.g. prefix "1/8/26 " is a
   * substring of "11/8/26 10:00AM" too. So `contains` is used only to
   * narrow the server-side result set (cheap), then every candidate name is
   * re-checked with a real `startsWith` here before it's considered.
   * @param {string|null} folderId falls back to the constructor's default folderId when falsy
   * @param {string} prefix
   * @returns {Promise<number>} 0 if nothing matched (or no folder scope)
   */
  async maxSequenceWithNamePrefix(folderId, prefix) {
    const effectiveFolderId = folderId || this.folderId;
    if (!effectiveFolderId) return 0; // no folder scope to check within - caller treats as "no prior recordings today"

    const accessToken = await this._getAccessToken();
    // Drive query strings escape backslash and single-quote with a backslash.
    const escapedPrefix = prefix.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const q = `'${effectiveFolderId}' in parents and trashed = false and name contains '${escapedPrefix}'`;

    let maxN = 0;
    let pageToken;
    do {
      const params = new URLSearchParams({
        q,
        fields: "nextPageToken, files(name)",
        pageSize: "1000",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const resp = await fetch(`${LIST_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error("GoogleDrive: list failed - " + resp.status + " " + JSON.stringify(json));
      }
      for (const f of json.files || []) {
        if (!f.name.startsWith(prefix)) continue;
        const m = f.name.match(/\((\d+)\)\.\w+$/);
        if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
      }
      pageToken = json.nextPageToken;
    } while (pageToken);

    return maxN;
  }

  /**
   * Uploads a local file to the configured personal Drive account.
   * @param {string} filePath
   * @param {string} fileName name to give the file on Drive
   * @param {string} mimeType
   * @param {string|null} [folderId] per-account override (profiles.drive_folder_id)
   *   - falls back to the constructor's default folderId when omitted/falsy.
   * @returns {Promise<{id: string, name: string, size: number}>}
   */
  async uploadFile(filePath, fileName, mimeType, folderId) {
    if (!this.isConfigured()) {
      throw new Error("GoogleDrive: not configured (missing client id/secret/refresh token)");
    }
    const stat = fs.statSync(filePath);
    const fileBuf = fs.readFileSync(filePath);

    const uploadUrl = await this._createResumableSession(fileName, mimeType, stat.size, folderId);

    const putResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(stat.size),
      },
      body: fileBuf,
    });
    const putJson = await putResp.json();
    if (!putResp.ok) {
      throw new Error(
        "GoogleDrive: upload failed - " + putResp.status + " " + JSON.stringify(putJson),
      );
    }
    return { id: putJson.id, name: putJson.name, size: Number(putJson.size ?? stat.size) };
  }
};

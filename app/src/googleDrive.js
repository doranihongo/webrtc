"use strict";

// Minimal Google Drive resumable-upload client for a single personal
// account (OAuth refresh token, not a service account). Uses the global
// `fetch` (Node 18+) - no `googleapis` dependency needed. This flow was
// prototyped and validated end-to-end before being wired in here.

const fs = require("fs");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";

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

  async _createResumableSession(fileName, mimeType, sizeBytes) {
    const accessToken = await this._getAccessToken();
    const metadata = { name: fileName };
    if (this.folderId) metadata.parents = [this.folderId];

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
   * Uploads a local file to the configured personal Drive account.
   * @param {string} filePath
   * @param {string} fileName name to give the file on Drive
   * @param {string} mimeType
   * @returns {Promise<{id: string, name: string, size: number}>}
   */
  async uploadFile(filePath, fileName, mimeType) {
    if (!this.isConfigured()) {
      throw new Error("GoogleDrive: not configured (missing client id/secret/refresh token)");
    }
    const stat = fs.statSync(filePath);
    const fileBuf = fs.readFileSync(filePath);

    const uploadUrl = await this._createResumableSession(fileName, mimeType, stat.size);

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

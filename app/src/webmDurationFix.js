"use strict";

// Node port of public/js/fixWebmDuration.js — same VINT/EBML parsing logic,
// only the I/O boundary changes (Buffer/fs instead of Blob). Keep the two
// files in sync if the parsing logic ever needs a fix.

const fs = require("fs");

const ID = {
  Segment: 0x8538067,
  Info: 0x549a966,
  TimecodeScale: 0xad7b1,
  Duration: 0x489,
};

/* ---- small-scale EBML container decompose/rebuild - only ever applied to
 * an already-isolated, fully definite-size byte range (Info's own content).
 * Never applied to Segment as a whole - see findInfoRange() for why. ---- */
function WebmBase(name, type) {
  this.name = name || "Unknown";
  this.type = type || "Unknown";
}
WebmBase.prototype.updateBySource = function () {};
WebmBase.prototype.setSource = function (source) {
  this.source = source;
  this.updateBySource();
};
WebmBase.prototype.updateByData = function () {};
WebmBase.prototype.setData = function (data) {
  this.data = data;
  this.updateByData();
};

function WebmUint() {
  WebmBase.call(this, "Uint", "Uint");
}
WebmUint.prototype = Object.create(WebmBase.prototype);
WebmUint.prototype.constructor = WebmUint;
const padHex = (h) => (h.length % 2 === 1 ? "0" + h : h);
WebmUint.prototype.updateBySource = function () {
  this.data = "";
  for (let i = 0; i < this.source.length; i++)
    this.data += padHex(this.source[i].toString(16));
};
WebmUint.prototype.updateByData = function () {
  const len = this.data.length / 2;
  this.source = new Uint8Array(len);
  for (let i = 0; i < len; i++)
    this.source[i] = parseInt(this.data.substr(i * 2, 2), 16);
};
WebmUint.prototype.getValue = function () {
  return parseInt(this.data, 16);
};
WebmUint.prototype.setValue = function (v) {
  this.setData(padHex(v.toString(16)));
};

function WebmFloat() {
  WebmBase.call(this, "Float", "Float");
}
WebmFloat.prototype = Object.create(WebmBase.prototype);
WebmFloat.prototype.constructor = WebmFloat;
WebmFloat.prototype._arrType = function () {
  return this.source && this.source.length === 4 ? Float32Array : Float64Array;
};
WebmFloat.prototype.updateBySource = function () {
  const bytes = this.source.slice().reverse();
  const T = this._arrType();
  this.data = new T(bytes.buffer)[0];
};
WebmFloat.prototype.updateByData = function () {
  const T = this._arrType();
  const fa = new T([this.data]);
  const bytes = new Uint8Array(fa.buffer);
  this.source = bytes.reverse();
};
WebmFloat.prototype.getValue = function () {
  return this.data;
};
WebmFloat.prototype.setValue = function (v) {
  this.setData(v);
};

function WebmContainer(name) {
  WebmBase.call(this, name || "Container", "Container");
}
WebmContainer.prototype = Object.create(WebmBase.prototype);
WebmContainer.prototype.constructor = WebmContainer;
WebmContainer.prototype.readByte = function () {
  return this.source[this.offset++];
};
WebmContainer.prototype.readVint = function () {
  const b0 = this.readByte();
  const bytes = 8 - b0.toString(2).length;
  let v = b0 - (1 << (7 - bytes));
  for (let i = 0; i < bytes; i++) {
    v = v * 256 + this.readByte();
  }
  return v;
};
WebmContainer.prototype.updateBySource = function () {
  // NOTE: only ever called on an isolated, fully-definite-size slice (an
  // Info element's content) - the swallow-to-end-of-source fallback below
  // is a defensive no-op there, not a load-bearing behavior. Never call
  // this on a whole Segment; see findInfoRange()'s doc comment for why.
  this.data = [];
  for (this.offset = 0; this.offset < this.source.length; ) {
    const id = this.readVint();
    const len = this.readVint();
    const end = Math.min(this.offset + len, this.source.length);
    const bytes = this.source.slice(this.offset, end);

    let ctor = WebmBase;
    if (id === ID.Segment || id === ID.Info) ctor = WebmContainer;
    else if (id === ID.TimecodeScale) ctor = WebmUint;
    else if (id === ID.Duration) ctor = WebmFloat;

    const elem = new ctor();
    elem.setSource(bytes);
    this.data.push({ id, data: elem });
    this.offset = end;
  }
};
WebmContainer.prototype.writeVint = function (x, draft) {
  let bytes = 1,
    flag = 0x80;
  while (x >= flag && bytes < 8) {
    bytes++;
    flag *= 0x80;
  }
  if (!draft) {
    let val = flag + x;
    for (let i = bytes - 1; i >= 0; i--) {
      const c = val % 256;
      this.source[this.offset + i] = c;
      val = (val - c) / 256;
    }
  }
  this.offset += bytes;
};
WebmContainer.prototype.writeSections = function (draft) {
  this.offset = 0;
  for (const s of this.data) {
    const content = s.data.source;
    const len = content.length;
    this.writeVint(s.id, draft);
    this.writeVint(len, draft);
    if (!draft) this.source.set(content, this.offset);
    this.offset += len;
  }
  return this.offset;
};
WebmContainer.prototype.updateByData = function () {
  const len = this.writeSections(true);
  this.source = new Uint8Array(len);
  this.writeSections(false);
};
WebmContainer.prototype.getSectionById = function (id) {
  for (const s of this.data) if (s.id === id) return s.data;
  return null;
};

/* ---- low-level VINT header reader used ONLY for the targeted top-level /
 * Segment-children walk below. Distinguishes a definite size from the EBML
 * "unknown size" reserved bit-pattern (all value-bits = 1) by inspecting
 * raw bytes directly - never by comparing the decoded numeric value, which
 * loses precision past 2^53 for an 8-byte VINT long before reaching the
 * unknown-size sentinel (~7.2e16). ---- */
function readVintHeader(buf, offset) {
  const b0 = buf[offset];
  const extraBytes = 8 - b0.toString(2).length;
  const totalBytes = 1 + extraBytes;
  const markerBitValue = 1 << (7 - extraBytes);
  const valueMaskInB0 = markerBitValue - 1; // bits below the marker bit within b0
  let unknown = (b0 & valueMaskInB0) === valueMaskInB0;
  if (unknown) {
    for (let i = 1; i < totalBytes; i++) {
      if (buf[offset + i] !== 0xff) {
        unknown = false;
        break;
      }
    }
  }
  let value = b0 - markerBitValue;
  for (let i = 1; i < totalBytes; i++) value = value * 256 + buf[offset + i];
  return { value, totalBytes, unknown };
}

/**
 * Finds where the Info element lives inside Segment, WITHOUT ever
 * decomposing Segment's other children (Clusters). Chrome's MediaRecorder
 * writes each Cluster with "unknown size" (meaning: spans until the next
 * sibling, not until EOF) - naively decomposing the whole Segment tree the
 * way this file used to would swallow every Cluster after the first one
 * into that first Cluster's raw bytes, since only the OUTERMOST
 * unknown-size element (Segment itself) is actually meant to span to true
 * EOF. That corrupted the recording's structure past the first Cluster
 * boundary - playable only up to wherever that boundary happened to fall
 * (a few seconds in), unrelated to anything the user did mid-recording.
 * Per the Matroska spec, Info always precedes every Cluster, so walking
 * Segment's children in declaration order and stopping at the first Info
 * is always safe - Clusters are never inspected at all.
 * @param {Uint8Array} buf
 * @returns {{segmentIsUnknownSize:boolean, segmentDefiniteLen:number, segmentLenHeaderStart:number, segmentLenHeaderBytes:number, infoStart:number, infoTotalBytes:number, infoContentStart:number, infoContentLen:number}|null}
 */
function findInfoRange(buf) {
  let offset = 0;
  let segment = null;
  while (offset < buf.length) {
    const idHeader = readVintHeader(buf, offset);
    offset += idHeader.totalBytes;
    const lenHeaderStart = offset;
    const lenHeader = readVintHeader(buf, offset);
    offset += lenHeader.totalBytes;
    if (idHeader.value === ID.Segment) {
      segment = {
        contentStart: offset,
        isUnknownSize: lenHeader.unknown,
        definiteLen: lenHeader.unknown ? 0 : lenHeader.value,
        lenHeaderStart,
        lenHeaderBytes: lenHeader.totalBytes,
      };
      break;
    }
    if (lenHeader.unknown) return null; // shouldn't happen at top level before Segment
    offset += lenHeader.value;
  }
  if (!segment) return null;

  offset = segment.contentStart;
  while (offset < buf.length) {
    const elStart = offset;
    const idHeader = readVintHeader(buf, offset);
    offset += idHeader.totalBytes;
    const lenHeader = readVintHeader(buf, offset);
    offset += lenHeader.totalBytes;
    const contentStart = offset;

    if (idHeader.value === ID.Info) {
      if (lenHeader.unknown) return null; // Info is never unknown-size in real files
      return {
        segmentIsUnknownSize: segment.isUnknownSize,
        segmentDefiniteLen: segment.definiteLen,
        segmentLenHeaderStart: segment.lenHeaderStart,
        segmentLenHeaderBytes: segment.lenHeaderBytes,
        infoStart: elStart,
        infoTotalBytes: contentStart + lenHeader.value - elStart,
        infoContentStart: contentStart,
        infoContentLen: lenHeader.value,
      };
    }
    if (lenHeader.unknown) return null; // hit a Cluster (or similar) before Info - bail out safely
    offset = contentStart + lenHeader.value;
  }
  return null; // Info not found
}

function concatBytes(arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

/**
 * Writes a definite-size VINT of exactly byteLength bytes in place. Caller
 * guarantees value fits (checked via maxDefiniteValue() below) - used only
 * to patch Segment's own length field when Segment is (unusually) definite
 * size and Info's byte length changed.
 */
function encodeVint(value, byteLength) {
  const out = new Uint8Array(byteLength);
  const flag = 1 << (8 - byteLength);
  let val = value;
  for (let i = byteLength - 1; i >= 0; i--) {
    out[i] = val % 256;
    val = Math.floor(val / 256);
  }
  out[0] |= flag;
  return out;
}
function maxDefiniteValue(byteLength) {
  // one less than the reserved "unknown size" sentinel for this width
  return Math.pow(2, 7 * byteLength) - 2;
}

/**
 * Patches Duration/TimecodeScale in place, touching only the Info element -
 * every byte belonging to Clusters (before or after Info) is copied
 * verbatim, never reinterpreted.
 * @param {Uint8Array} inputBuf
 * @param {number} durationMs
 * @returns {{ fixed: boolean, bytes: Uint8Array }}
 */
function fixWebmDurationBytes(inputBuf, durationMs) {
  const range = findInfoRange(inputBuf);
  if (!range) return { fixed: false, bytes: inputBuf };

  const infoContainer = new WebmContainer("Info");
  infoContainer.setSource(
    inputBuf.slice(range.infoContentStart, range.infoContentStart + range.infoContentLen),
  );

  const scale = infoContainer.getSectionById(ID.TimecodeScale);
  if (!scale) return { fixed: false, bytes: inputBuf };
  // Ensure 1ms scale for a simple duration (ms) value
  scale.setValue(1000000);

  let dur = infoContainer.getSectionById(ID.Duration);
  if (dur) {
    if (dur.getValue() > 0) return { fixed: false, bytes: inputBuf }; // already valid
    dur.setValue(durationMs);
  } else {
    dur = new WebmFloat();
    dur.setValue(durationMs);
    infoContainer.data.push({ id: ID.Duration, data: dur });
  }
  infoContainer.updateByData(); // rebuilds infoContainer.source = Info's children bytes

  // Wrap the rebuilt content back into a full Info element (id+len+content),
  // reusing writeSections' existing, already-proven id/len serialization.
  const infoWrapper = new WebmContainer("InfoWrapper");
  infoWrapper.data = [{ id: ID.Info, data: infoContainer }];
  infoWrapper.updateByData();
  const newInfoBytes = infoWrapper.source;

  const sizeDelta = newInfoBytes.length - range.infoTotalBytes;

  let segmentLenPatch = null;
  if (sizeDelta !== 0 && !range.segmentIsUnknownSize) {
    const newSegLen = range.segmentDefiniteLen + sizeDelta;
    if (newSegLen < 0 || newSegLen > maxDefiniteValue(range.segmentLenHeaderBytes)) {
      // Can't represent the new size without widening the length field
      // (which would shift every offset after it) - safer to skip the fix
      // than risk corrupting a rare definite-size file.
      return { fixed: false, bytes: inputBuf };
    }
    segmentLenPatch = encodeVint(newSegLen, range.segmentLenHeaderBytes);
  }

  const before = inputBuf.slice(0, range.infoStart);
  const after = inputBuf.slice(range.infoStart + range.infoTotalBytes);
  const outBuf = concatBytes([before, newInfoBytes, after]);

  if (segmentLenPatch) {
    outBuf.set(segmentLenPatch, range.segmentLenHeaderStart);
  }

  return { fixed: true, bytes: outBuf };
}

/**
 * Reads a WebM file, patches its Duration/TimecodeScale metadata so the
 * result is seekable (mirrors window.FixWebmDuration client-side), and
 * writes the result to outputPath. Clusters are never touched - see
 * findInfoRange()'s doc comment.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} durationMs
 * @returns {{ fixed: boolean }}
 */
function fixWebmDurationFile(inputPath, outputPath, durationMs) {
  const inputBuf = fs.readFileSync(inputPath);
  const src = new Uint8Array(inputBuf.buffer, inputBuf.byteOffset, inputBuf.byteLength);
  let fixed = false;
  let outBytes = src;
  try {
    const result = fixWebmDurationBytes(src, Math.max(0, Number(durationMs) || 0));
    fixed = result.fixed;
    outBytes = result.bytes;
  } catch (_) {
    fixed = false;
    outBytes = src;
  }
  fs.writeFileSync(outputPath, Buffer.from(outBytes.buffer, outBytes.byteOffset, outBytes.byteLength));
  return { fixed };
}

module.exports = { fixWebmDurationFile };

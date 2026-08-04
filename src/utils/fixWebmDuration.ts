/**
 * fixWebmDuration.ts
 *
 * Minimal WebM duration fixer (no deps), ported to a TypeScript ES6 module.
 *
 * Chrome's MediaRecorder writes WebM files with an invalid/zero Duration
 * field in the Segment > Info element. This utility patches the EBML
 * structure in-memory and rewrites the Duration (and forces a 1ms
 * TimecodeScale so the duration value can be expressed directly in ms).
 *
 * Usage:
 *   import { fixWebmDuration } from './fixWebmDuration';
 *   const fixedBlob = await fixWebmDuration(recordedBlob, durationMs);
 */

// EBML element IDs (as parsed by the simplified VINT reader below)
const ID = {
  Segment: 0x8538067,
  Info: 0x549a966,
  TimecodeScale: 0xad7b1,
  Duration: 0x489,
} as const;

type ElementId = number;

interface WebmSection {
  id: ElementId;
  data: WebmBase;
}

/** Base EBML element: holds raw bytes (`source`) and a parsed/derived value (`data`). */
class WebmBase {
  name: string;
  type: string;
  source!: Uint8Array;
  data: any;

  constructor(name = "Unknown", type = "Unknown") {
    this.name = name;
    this.type = type;
  }

  updateBySource(): void {
    /* overridden by subclasses */
  }

  setSource(source: Uint8Array): void {
    this.source = source;
    this.updateBySource();
  }

  updateByData(): void {
    /* overridden by subclasses */
  }

  setData(data: any): void {
    this.data = data;
    this.updateByData();
  }
}

const padHex = (h: string): string => (h.length % 2 === 1 ? "0" + h : h);

/** Unsigned integer element, internally stored as a hex string. */
class WebmUint extends WebmBase {
  declare data: string;

  constructor() {
    super("Uint", "Uint");
  }

  override updateBySource(): void {
    this.data = "";
    for (let i = 0; i < this.source.length; i++) {
      this.data += padHex(this.source[i].toString(16));
    }
  }

  override updateByData(): void {
    const len = this.data.length / 2;
    this.source = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      this.source[i] = parseInt(this.data.substr(i * 2, 2), 16);
    }
  }

  getValue(): number {
    return parseInt(this.data, 16);
  }

  setValue(v: number): void {
    this.setData(padHex(v.toString(16)));
  }
}

/** IEEE-754 float element (4 or 8 bytes, big-endian on the wire). */
class WebmFloat extends WebmBase {
  declare data: number;

  constructor() {
    super("Float", "Float");
  }

  private arrType(): Float32ArrayConstructor | Float64ArrayConstructor {
    return this.source && this.source.length === 4 ? Float32Array : Float64Array;
  }

  override updateBySource(): void {
    const bytes = this.source.slice().reverse();
    const T = this.arrType();
    this.data = new T(bytes.buffer)[0];
  }

  override updateByData(): void {
    const T = this.arrType();
    const fa = new T([this.data]);
    const bytes = new Uint8Array(fa.buffer);
    this.source = bytes.reverse();
  }

  getValue(): number {
    return this.data;
  }

  setValue(v: number): void {
    this.setData(v);
  }
}

/** Container element: a sequence of child (id, element) sections with VINT-encoded lengths. */
class WebmContainer extends WebmBase {
  declare data: WebmSection[];
  offset = 0;

  constructor(name = "Container") {
    super(name, "Container");
  }

  private readByte(): number {
    return this.source[this.offset++];
  }

  private readVint(): number {
    const b0 = this.readByte();
    const bytes = 8 - b0.toString(2).length;
    let v = b0 - (1 << (7 - bytes));
    for (let i = 0; i < bytes; i++) {
      v = v * 256 + this.readByte();
    }
    return v;
  }

  override updateBySource(): void {
    this.data = [];
    for (this.offset = 0; this.offset < this.source.length; ) {
      const id = this.readVint();
      const len = this.readVint();
      const end = Math.min(this.offset + len, this.source.length);
      const bytes = this.source.slice(this.offset, end);

      let ElemCtor: new () => WebmBase = WebmBase;
      if (id === ID.Segment || id === ID.Info) ElemCtor = WebmContainer;
      else if (id === ID.TimecodeScale) ElemCtor = WebmUint;
      else if (id === ID.Duration) ElemCtor = WebmFloat;

      const elem = new ElemCtor();
      elem.setSource(bytes);
      this.data.push({ id, data: elem });
      this.offset = end;
    }
  }

  private writeVint(x: number, draft: boolean): void {
    let bytes = 1;
    let flag = 0x80;
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
  }

  private writeSections(draft: boolean): number {
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
  }

  override updateByData(): void {
    const len = this.writeSections(true);
    this.source = new Uint8Array(len);
    this.writeSections(false);
  }

  getSectionById(id: ElementId): WebmBase | null {
    for (const s of this.data) if (s.id === id) return s.data;
    return null;
  }
}

/** Top-level container representing the whole WebM file. */
class WebmFile extends WebmContainer {
  constructor(src: Uint8Array) {
    super("File");
    this.setSource(src);
  }

  toBlob(mime?: string): Blob {
    return new Blob([this.source.buffer as ArrayBuffer], { type: mime || "video/webm" });
  }

  fixDuration(durationMs: number): boolean {
    const segment = this.getSectionById(ID.Segment) as WebmContainer | null;
    if (!segment) return false;
    const info = segment.getSectionById(ID.Info) as WebmContainer | null;
    if (!info) return false;
    const scale = info.getSectionById(ID.TimecodeScale) as WebmUint | null;
    if (!scale) return false;
    // Ensure 1ms scale so the duration value can be expressed directly in ms
    scale.setValue(1000000);

    let dur = info.getSectionById(ID.Duration) as WebmFloat | null;
    if (dur) {
      if (dur.getValue() > 0) return false; // already valid
      dur.setValue(durationMs);
    } else {
      dur = new WebmFloat();
      dur.setValue(durationMs);
      info.data.push({ id: ID.Duration, data: dur });
    }
    // Rebuild buffers up the tree
    info.updateByData();
    segment.updateByData();
    this.updateByData();
    return true;
  }
}

/**
 * Patches a recorded WebM Blob's Duration field.
 * Returns a new Blob on success, or the original blob unchanged if
 * it's not a WebM blob, already has a valid duration, or parsing fails.
 */
export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (!blob || blob.type.indexOf("webm") === -1) return blob;
  try {
    const buf = await blob.arrayBuffer();
    const file = new WebmFile(new Uint8Array(buf));
    if (file.fixDuration(Math.max(0, Number(durationMs) || 0))) {
      return file.toBlob(blob.type);
    }
  } catch {
    /* ignore, fallback to original */
  }
  return blob;
}

export default fixWebmDuration;

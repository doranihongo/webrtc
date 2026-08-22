"use strict";

const RNNOISE_FRAME_SIZE = 480;
const SHIFT_16_BIT_NR = 32768;
// RNNoise only ever runs at 48kHz (gated by isSampleRateSupported() before
// this worklet is even started), so 1 frame = 480/48000s = 10ms of audio.
const FRAME_DURATION_MS = 10;
// How many frames to sample before deciding whether the CPU can keep up.
// ~1s of audio - long enough to get past WASM warm-up jitter, short enough
// that a struggling device doesn't stay garbled for long before we bail out.
const PERF_CHECK_WINDOW_FRAMES = 100;
// If at least this fraction of sampled frames individually took longer to
// process than the audio they represent, the device can't keep up in real
// time (that's exactly what produces the audible glitches) - report back
// to the main thread so it can fall back to the browser's built-in noise
// suppression instead.
const PERF_OVERRUN_RATIO_THRESHOLD = 0.2;
// AudioWorkletGlobalScope exposes performance.now() in every browser that
// supports AudioWorklet at all (Chrome/Firefox/Safari 14.1+) - but guard
// anyway so a future/unusual engine without it just skips the self-test
// instead of throwing on every single frame.
const HAS_PERF_TIMING =
  typeof performance !== "undefined" && typeof performance.now === "function";

// Handle WASM module initialization
class WasmModuleInitializer {
  constructor(messagePort) {
    this.messagePort = messagePort;
    this.Module = null;
  }

  async initSyncModule(jsContent) {
    try {
      if (!jsContent) throw new Error("Missing sync module JS content");

      const createFunction = new Function(
        jsContent + "; return createRNNWasmModuleSync;",
      )();
      this.Module = await createFunction();

      if (this.Module.ready) {
        await this.Module.ready;
      }
      this.messagePort.postMessage({ type: "wasm-ready" });
      return this.Module;
    } catch (error) {
      console.error("Sync module initialization error:", error);
      this.messagePort.postMessage({
        type: "wasm-error",
        error: error.message,
      });
      throw error;
    }
  }

  getModule() {
    return this.Module;
  }
}

// Handle RNNoise context and buffer management
class RNNoiseContextManager {
  constructor(module, messagePort) {
    this.module = module;
    this.messagePort = messagePort;
    this.rnnoiseContext = null;
    this.wasmPcmInput = null;
    this.wasmPcmInputF32Index = null;
    // Real-time self-test bookkeeping - see PERF_* constants above.
    this.framesObserved = 0;
    this.overrunCount = 0;
    this.perfReported = false;
    this.setupWasm();
  }

  setupWasm() {
    this.wasmPcmInput = this.module._malloc(RNNOISE_FRAME_SIZE * 4);
    this.wasmPcmInputF32Index = this.wasmPcmInput >> 2;
    if (!this.wasmPcmInput) throw new Error("Failed to allocate WASM buffer");

    this.rnnoiseContext = this.module._rnnoise_create();
    if (!this.rnnoiseContext)
      throw new Error("Failed to create RNNoise context");

    console.log("WASM setup complete:", {
      wasmPcmInput: this.wasmPcmInput,
      rnnoiseContext: this.rnnoiseContext,
      heapF32Available: !!this.module.HEAPF32,
    });
  }

  processFrame(frameBuffer, processedBuffer, messagePort, throttledVadSend) {
    if (!this.rnnoiseContext || !this.module || !this.module.HEAPF32) return;

    try {
      for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
        this.module.HEAPF32[this.wasmPcmInputF32Index + i] =
          frameBuffer[i] * SHIFT_16_BIT_NR;
      }

      const processStart = HAS_PERF_TIMING ? performance.now() : 0;
      const vadScore = this.module._rnnoise_process_frame(
        this.rnnoiseContext,
        this.wasmPcmInput,
        this.wasmPcmInput,
      );
      if (HAS_PERF_TIMING) {
        this.recordFrameTiming(performance.now() - processStart);
      }

      for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
        processedBuffer[i] =
          this.module.HEAPF32[this.wasmPcmInputF32Index + i] / SHIFT_16_BIT_NR;
      }

      // Throttle VAD messages to reduce postMessage overhead (mobile perf)
      if (throttledVadSend) {
        messagePort.postMessage({
          type: "vad",
          probability: vadScore,
          isSpeech: vadScore > 0.5,
        });
      }
    } catch (error) {
      console.error("Frame processing failed:", error);
      for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
        processedBuffer[i] = frameBuffer[i];
      }
    }
  }

  /**
   * Real-time self-test: track how many of the first PERF_CHECK_WINDOW_FRAMES
   * frames took longer to process than the audio they represent (that's
   * exactly what causes audible glitches/silence). Report once, after the
   * window fills, so the main thread can fall back to the browser's
   * built-in noise suppression on devices that can't keep up.
   */
  recordFrameTiming(elapsedMs) {
    if (this.perfReported) return;

    this.framesObserved++;
    if (elapsedMs > FRAME_DURATION_MS) this.overrunCount++;

    if (this.framesObserved >= PERF_CHECK_WINDOW_FRAMES) {
      this.perfReported = true;
      const overrunRatio = this.overrunCount / this.framesObserved;
      if (overrunRatio >= PERF_OVERRUN_RATIO_THRESHOLD) {
        this.messagePort.postMessage({ type: "performance-slow", overrunRatio });
      }
    }
  }

  destroy() {
    if (this.wasmPcmInput && this.module?._free) {
      this.module._free(this.wasmPcmInput);
      this.wasmPcmInput = null;
    }
    if (this.rnnoiseContext && this.module?._rnnoise_destroy) {
      this.module._rnnoise_destroy(this.rnnoiseContext);
      this.rnnoiseContext = null;
    }
  }
}

// Handle audio frame buffering
class AudioFrameBuffer {
  constructor() {
    this.frameBuffer = new Float32Array(RNNOISE_FRAME_SIZE);
    this.bufferIndex = 0;
    this.hasProcessedFrame = false;
    this.processedBuffer = new Float32Array(RNNOISE_FRAME_SIZE);
    this.processedIndex = 0;
  }

  addSample(sample) {
    this.frameBuffer[this.bufferIndex++] = sample;
    return this.bufferIndex === RNNOISE_FRAME_SIZE;
  }

  resetBuffer() {
    this.bufferIndex = 0;
    this.hasProcessedFrame = true;
    this.processedIndex = 0;
  }

  getProcessedSample() {
    return this.processedBuffer[this.processedIndex++];
  }

  getFrameBuffer() {
    return this.frameBuffer;
  }

  getProcessedBuffer() {
    return this.processedBuffer;
  }

  hasProcessed() {
    return this.hasProcessedFrame;
  }
}

// Handle volume analysis (throttled to reduce postMessage overhead on mobile)
class VolumeAnalyzer {
  constructor() {
    this.lastSendTime = 0;
    this.throttleMs = 100; // Send at most every 100ms
  }

  calculateVolume(input, output, messagePort) {
    const now = currentTime * 1000; // AudioWorklet currentTime is in seconds
    if (now - this.lastSendTime < this.throttleMs) return;
    this.lastSendTime = now;

    const originalVolume = Math.sqrt(
      input.reduce((sum, v) => sum + v * v, 0) / input.length,
    );
    const processedVolume = Math.sqrt(
      output.reduce((sum, v) => sum + v * v, 0) / output.length,
    );

    messagePort.postMessage({
      type: "volume",
      original: originalVolume,
      processed: processedVolume,
    });
  }
}

// Handle audio worklet processing
class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.initialized = false;
    this.enabled = false;
    this._destroyed = false;
    this.sampleRate = sampleRate || 48000;

    console.log(
      "AudioWorklet processor initialized with sample rate:",
      this.sampleRate,
    );

    this.wasmInitializer = new WasmModuleInitializer(this.port);
    this.contextManager = null;
    this.frameBuffer = new AudioFrameBuffer();
    this.volumeAnalyzer = new VolumeAnalyzer();
    this.lastVadSendTime = 0;
    this.vadThrottleMs = 100; // Send VAD at most every 100ms

    this.setupMessageHandler();
    this.port.postMessage({ type: "request-wasm" });
  }

  setupMessageHandler() {
    this.port.onmessage = async (event) => {
      const { type, jsContent, enabled } = event.data;
      switch (type) {
        case "sync-module":
          try {
            const module = await this.wasmInitializer.initSyncModule(jsContent);
            this.contextManager = new RNNoiseContextManager(module, this.port);
            this.initialized = true;
          } catch (error) {
            console.error("Failed to initialize sync module:", error);
          }
          break;
        case "enable":
          this.enabled = enabled;
          break;
        case "destroy":
          this.destroy();
          break;
        default:
          console.warn("Unknown message type:", type);
          break;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!output) return true;

    // Always fill output with something valid
    if (!input || input.length === 0) {
      output.fill(0); // Silence if no input
      return true;
    }

    // If not initialized or not enabled, just pass through input safely
    if (!this.initialized || !this.enabled) {
      for (let i = 0; i < output.length; i++) {
        output[i] = Number.isFinite(input[i]) ? input[i] : 0;
      }
      return true;
    }

    for (let i = 0; i < input.length; i++) {
      const isFrameReady = this.frameBuffer.addSample(input[i]);

      if (isFrameReady) {
        const now = currentTime * 1000;
        const shouldSendVad = now - this.lastVadSendTime >= this.vadThrottleMs;
        this.contextManager.processFrame(
          this.frameBuffer.getFrameBuffer(),
          this.frameBuffer.getProcessedBuffer(),
          this.port,
          shouldSendVad,
        );
        if (shouldSendVad) this.lastVadSendTime = now;
        this.frameBuffer.resetBuffer();
      }

      // Output processed sample if available, else fallback to input (with safety)
      let sample = this.frameBuffer.hasProcessed()
        ? this.frameBuffer.getProcessedSample()
        : input[i];
      output[i] = Number.isFinite(sample) ? sample : 0;
    }

    this.volumeAnalyzer.calculateVolume(input, output, this.port);
    return true;
  }

  destroy() {
    if (this._destroyed) return;

    if (this.contextManager) {
      this.contextManager.destroy();
      this.contextManager = null;
    }

    this._destroyed = true;
  }
}

registerProcessor("noiseSuppressionProcessor", RNNoiseProcessor);

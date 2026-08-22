"use strict";

const RNNOISE_FRAME_SIZE = 480;
const SHIFT_16_BIT_NR = 32768;

// --- Real-time self-test (see recordCallbackTiming() on RNNoiseProcessor) ---
// AudioWorklet always calls process() once per 128-sample render quantum
// (fixed by spec) while a track is connected - timing the *gap between
// successive calls* while RNNoise is actively enabled is a more direct
// signal of "will the user hear glitches" than timing just the RNNoise WASM
// call: it also catches the audio thread simply being starved by other work
// on the device (e.g. video encoding), not only RNNoise itself being slow -
// and since _rnnoise_process_frame runs synchronously inside process(), a
// slow WASM call still shows up here too, as a late *next* callback.
const RENDER_QUANTUM_SAMPLES = 128;
// A callback gap more than this many times the expected quantum duration
// counts as "late" - generous enough to not flag normal OS/browser
// scheduling jitter on a healthy device.
const PERF_LATE_CALLBACK_MULTIPLIER = 2.5;
// Skip this many calls right after RNNoise is (re-)enabled before
// evaluating anything, so WASM/JIT warm-up jitter can't cause a false
// trigger.
const PERF_WARMUP_CALLS = 100;
// Re-evaluate every this many calls (~1s at 48kHz) for as long as RNNoise
// stays enabled - not just once at the start, so a device that starts fine
// but degrades later (thermal throttling, other apps ramping up CPU use)
// still gets caught.
const PERF_WINDOW_CALLS = 400;
// If at least this fraction of calls in a window were late, this device
// can't keep the pipeline on schedule - fall back to the browser's
// built-in noise suppression instead.
const PERF_LATE_RATIO_THRESHOLD = 0.12;
// AudioWorkletGlobalScope exposes performance.now() in every browser that
// supports AudioWorklet at all (Chrome/Firefox/Safari 14.1+) - but guard
// anyway so a future/unusual engine without it just skips the self-test
// instead of throwing on every single callback.
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
  constructor(module) {
    this.module = module;
    this.rnnoiseContext = null;
    this.wasmPcmInput = null;
    this.wasmPcmInputF32Index = null;
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

      const vadScore = this.module._rnnoise_process_frame(
        this.rnnoiseContext,
        this.wasmPcmInput,
        this.wasmPcmInput,
      );

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

    // Real-time self-test state - see PERF_* constants above.
    this.perfExpectedQuantumMs =
      (RENDER_QUANTUM_SAMPLES / this.sampleRate) * 1000;
    this.perfLastCallTime = null;
    this.perfWarmupRemaining = PERF_WARMUP_CALLS;
    this.perfWindowCalls = 0;
    this.perfWindowLateCalls = 0;
    this.perfReported = false;

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
            this.contextManager = new RNNoiseContextManager(module);
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
      // Not actively processing right now - don't let this idle gap count
      // toward the self-test once RNNoise is (re-)enabled.
      this.perfLastCallTime = null;
      for (let i = 0; i < output.length; i++) {
        output[i] = Number.isFinite(input[i]) ? input[i] : 0;
      }
      return true;
    }

    this.recordCallbackTiming();

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

  /**
   * Real-time self-test: called once per process() callback while RNNoise
   * is actively enabled. Tracks the wall-clock gap since the previous call
   * against how long a render quantum is *supposed* to take - a device
   * that can't keep this pipeline on schedule will show a growing fraction
   * of "late" calls, which is exactly what produces the audible glitches
   * reported on weak devices. Runs in repeating windows for as long as
   * RNNoise stays enabled (not just once at start), and reports back to
   * the main thread the first time a window crosses the threshold, so it
   * can fall back to the browser's built-in noise suppression instead.
   */
  recordCallbackTiming() {
    if (this.perfReported || !HAS_PERF_TIMING) return;

    const now = performance.now();
    const previous = this.perfLastCallTime;
    this.perfLastCallTime = now;
    if (previous === null) return; // first call after (re-)enabling - no gap to measure yet

    if (this.perfWarmupRemaining > 0) {
      this.perfWarmupRemaining--;
      return;
    }

    const gap = now - previous;
    this.perfWindowCalls++;
    if (gap > this.perfExpectedQuantumMs * PERF_LATE_CALLBACK_MULTIPLIER) {
      this.perfWindowLateCalls++;
    }

    if (this.perfWindowCalls >= PERF_WINDOW_CALLS) {
      const lateRatio = this.perfWindowLateCalls / this.perfWindowCalls;
      if (lateRatio >= PERF_LATE_RATIO_THRESHOLD) {
        this.perfReported = true;
        this.port.postMessage({ type: "performance-slow", lateRatio });
      } else {
        this.perfWindowCalls = 0;
        this.perfWindowLateCalls = 0;
      }
    }
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

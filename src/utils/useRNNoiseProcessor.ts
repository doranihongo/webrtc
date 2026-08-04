/**
 * useRNNoiseProcessor.ts
 *
 * React custom hook port of the vanilla `RNNoiseProcessor` (+ its
 * internal `UIManager`, `MessageHandler`, `WasmLoader` collaborators).
 *
 * IMPORTANT: All internal logic/behavior is preserved 1:1 from the
 * original vanilla-JS file — same method bodies, same DOM element ids
 * (`labelNoiseSuppression`, `switchNoiseSuppression`), same worklet
 * message shapes, same status strings, same try/catch/cleanup order.
 * The only things added are: TypeScript types, and a thin React hook
 * wrapper (`useRNNoiseProcessor`) that owns the class instance's
 * lifecycle via `useRef`/`useEffect` and exposes its public API plus
 * a couple of mirrored `useState` values for convenient rendering.
 *
 * Usage in App.tsx:
 *
 *   const {
 *     startProcessing,
 *     stopProcessing,
 *     toggleProcessing,
 *     toggleNoiseSuppression,
 *     isProcessing,
 *     noiseSuppressionEnabled,
 *   } = useRNNoiseProcessor();
 *
 *   const handleStart = async () => {
 *     const processedStream = await startProcessing(localStream);
 *     // pass processedStream (with noise suppression) into your peer connection
 *   };
 *
 * Note: like the original, this still expects DOM elements with ids
 * `labelNoiseSuppression` / `switchNoiseSuppression` to exist for the
 * label color side-effect in `UIManager.updateUI` to have any visible
 * effect (kept as-is to match original behavior exactly).
 */

import { useCallback, useEffect, useRef, useState } from "react";

type StatusType = "info" | "error" | "success" | "warning";

interface UIElements {
  labelNoiseSuppression: HTMLElement | null;
  switchNoiseSuppression: HTMLElement | null;
}

interface WorkletMessageEvent extends MessageEvent {
  data: {
    type: string;
    error?: string;
    isSpeech?: boolean;
    probability?: number;
    [key: string]: unknown;
  };
}

// Vendor-prefixed AudioContext for older WebKit browsers.
interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// ####################################################
// UIManager — handles UI updates and interactions
// ####################################################
class UIManager {
  elements: UIElements;

  constructor(elements: UIElements) {
    this.elements = elements;
  }

  updateStatus(message: string, type: StatusType = "info"): void {
    const timestamp = new Date().toLocaleTimeString();
    const printMessage = `[${timestamp}] ${message}`;
    switch (type) {
      case "error":
        console.error(printMessage);
        break;
      case "success":
        console.info(printMessage);
        break;
      case "warning":
        console.warn(printMessage);
        break;
      default:
        console.log(printMessage);
        break;
    }
  }

  updateUI(isProcessing: boolean, noiseSuppressionEnabled: boolean): void {
    this.updateStatus(
      `Audio processing ${isProcessing ? "started" : "stopped"}`,
      isProcessing ? "success" : "info",
    );

    if (this.elements.labelNoiseSuppression) {
      this.elements.labelNoiseSuppression.style.color = noiseSuppressionEnabled
        ? "lime"
        : "white";
    }
  }
}

// ####################################################
// WasmLoader — handles only WASM module loading
// ####################################################
class WasmLoader {
  uiManager: UIManager;
  getWorkletNode: () => AudioWorkletNode | null;

  constructor(uiManager: UIManager, getWorkletNode: () => AudioWorkletNode | null) {
    this.uiManager = uiManager;
    this.getWorkletNode = getWorkletNode;
  }

  async loadWasmBuffer(): Promise<void> {
    try {
      const workletNode = this.getWorkletNode();
      if (!workletNode) {
        this.uiManager.updateStatus(
          "⚠️ Worklet node not available, skipping WASM load",
          "warning",
        );
        return;
      }

      this.uiManager.updateStatus("📦 Loading RNNoise sync module...", "info");

      const jsResponse = await fetch("../js/rnnoiseSync.js");

      if (!jsResponse.ok) {
        throw new Error("Failed to load rnnoiseSync.js");
      }

      const jsContent = await jsResponse.text();
      this.uiManager.updateStatus("📦 Sending sync module to worklet...", "info");

      const node = this.getWorkletNode();
      if (!node) {
        this.uiManager.updateStatus(
          "⚠️ Worklet node disconnected before WASM could be sent",
          "warning",
        );
        return;
      }

      node.port.postMessage({
        type: "sync-module",
        jsContent: jsContent,
      });

      this.uiManager.updateStatus("📦 Sync module sent to worklet", "info");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.uiManager.updateStatus("❌ Failed to load sync module: " + message, "error");
      console.error("Sync module loading error:", error);
    }
  }
}

// ####################################################
// MessageHandler — handles audio worklet message processing
// ####################################################
class MessageHandler {
  uiManager: UIManager;
  wasmLoader: WasmLoader;

  constructor(uiManager: UIManager, wasmLoader: WasmLoader) {
    this.uiManager = uiManager;
    this.wasmLoader = wasmLoader;
  }

  handleMessage(event: WorkletMessageEvent): void {
    if (event.data.type === "request-wasm") {
      this.wasmLoader.loadWasmBuffer();
    } else if (event.data.type === "wasm-ready") {
      this.uiManager.updateStatus("✅ RNNoise WASM initialized successfully", "success");
    } else if (event.data.type === "wasm-error") {
      this.uiManager.updateStatus("❌ RNNoise WASM error: " + event.data.error, "error");
    } else if (event.data.type === "vad") {
      if (event.data.isSpeech) {
        //this.uiManager.updateStatus(`🗣️ Speech detected (VAD: ${event.data.probability.toFixed(2)})`, 'info');
      }
    }
  }
}

// ####################################################
// RNNoiseProcessor — handles RNNoise processing
// ####################################################
class RNNoiseProcessor {
  audioContext: AudioContext | null = null;
  workletNode: AudioWorkletNode | null = null;
  mediaStream: MediaStream | null = null;
  sourceNode: MediaStreamAudioSourceNode | null = null;
  destinationNode: MediaStreamAudioDestinationNode | null = null;
  isProcessing = false;
  noiseSuppressionEnabled = false;

  elements!: UIElements;
  uiManager!: UIManager;
  wasmLoader!: WasmLoader;
  messageHandler!: MessageHandler;

  constructor() {
    this.initializeUI();
    this.initializeDependencies();
  }

  /**
   * Check if AudioWorklet and WebAssembly are supported.
   * Mobile browsers may lack AudioWorklet or restrict synchronous WASM compilation.
   */
  static isSupported(): boolean {
    try {
      const AudioCtx =
        window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      const hasAudioWorklet = !!AudioCtx && "audioWorklet" in AudioCtx.prototype;
      const hasWebAssembly =
        typeof WebAssembly === "object" &&
        typeof WebAssembly.Module === "function" &&
        typeof WebAssembly.Instance === "function";
      return !!(hasAudioWorklet && hasWebAssembly);
    } catch (e) {
      return false;
    }
  }

  /**
   * Probe whether the device actually supports a 48 kHz sample rate.
   * Creates a temporary AudioContext, checks the real rate, then closes it.
   */
  static async isSampleRateSupported(): Promise<boolean> {
    try {
      const AudioCtx =
        window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      if (!AudioCtx) return false;
      const ctx = new AudioCtx({ sampleRate: 48000 });
      const actual = ctx.sampleRate;
      await ctx.close();
      return actual === 48000;
    } catch (e) {
      return false;
    }
  }

  initializeUI(): void {
    this.elements = {
      labelNoiseSuppression: document.getElementById("labelNoiseSuppression"),
      switchNoiseSuppression: document.getElementById("switchNoiseSuppression"),
    };
  }

  initializeDependencies(): void {
    this.uiManager = new UIManager(this.elements);
    this.wasmLoader = new WasmLoader(this.uiManager, () => this.workletNode);
    this.messageHandler = new MessageHandler(this.uiManager, this.wasmLoader);
  }

  async toggleProcessing(mediaStream: MediaStream | null = null): Promise<void> {
    this.isProcessing
      ? this.stopProcessing()
      : await this.startProcessing(mediaStream);
  }

  async startProcessing(mediaStream: MediaStream | null = null): Promise<MediaStream | null> {
    if (!mediaStream) {
      throw new Error("No media stream provided to startProcessing");
    }
    try {
      this.uiManager.updateStatus("🎤 Starting audio processing...", "info");

      if (!RNNoiseProcessor.isSupported()) {
        this.uiManager.updateStatus(
          "⚠️ AudioWorklet or WebAssembly not supported, skipping RNNoise",
          "warning",
        );
        return null;
      }

      // 48 kHz support is verified by isSampleRateSupported() at init.
      const AudioCtx =
        window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("AudioContext is not supported in this browser");
      }
      this.audioContext = new AudioCtx({ sampleRate: 48000 });
      this.uiManager.updateStatus(
        `🎵 Audio context created with sample rate: ${this.audioContext.sampleRate}Hz`,
        "info",
      );

      if (this.audioContext.state === "suspended") {
        try {
          await this.audioContext.resume();
          this.uiManager.updateStatus("🎵 AudioContext resumed after suspend", "info");
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          this.uiManager.updateStatus(
            "⚠️ AudioContext could not be resumed: " + message,
            "warning",
          );
        }
      }

      this.mediaStream = mediaStream;
      if (!this.mediaStream.getAudioTracks().length) {
        throw new Error("No audio tracks found in the provided media stream");
      }

      await this.audioContext.audioWorklet.addModule("../js/noiseSuppressionProcessor.js");

      this.workletNode = new AudioWorkletNode(this.audioContext, "noiseSuppressionProcessor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });

      this.workletNode.port.onmessage = (event: MessageEvent) =>
        this.messageHandler.handleMessage(event as WorkletMessageEvent);

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.destinationNode);

      this.isProcessing = true;
      this.uiManager.updateUI(this.isProcessing, this.noiseSuppressionEnabled);
      this.uiManager.updateStatus("🎤 Audio processing started", "success");

      // Return the processed MediaStream (with noise suppression)
      return this.destinationNode.stream;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.uiManager.updateStatus("❌ Error: " + message, "error");
      console.error("RNNoise startProcessing error:", error);
      this.stopProcessing();
      return null;
    }
  }

  stopProcessing(): void {
    this.mediaStream = null;

    // Signal the worklet to free WASM memory before disconnecting
    try {
      this.workletNode?.port?.postMessage({ type: "destroy" });
    } catch (e) {
      /* ignore */
    }

    try {
      this.sourceNode?.disconnect();
    } catch (e) {
      /* ignore */
    }
    try {
      this.workletNode?.disconnect();
    } catch (e) {
      /* ignore */
    }
    try {
      this.destinationNode?.stream?.getTracks?.().forEach((t) => t.stop());
    } catch (e) {
      /* ignore */
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.workletNode = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.isProcessing = false;
    this.noiseSuppressionEnabled = false;

    this.uiManager.updateUI(this.isProcessing, this.noiseSuppressionEnabled);
    this.uiManager.updateStatus("🛑 Audio processing stopped", "info");
  }

  toggleNoiseSuppression(): void {
    this.noiseSuppressionEnabled = !this.noiseSuppressionEnabled;

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "enable",
        enabled: this.noiseSuppressionEnabled,
      });
    }

    this.noiseSuppressionEnabled
      ? this.uiManager.updateStatus(
          "🔊 RNNoise enabled - background noise will be suppressed",
          "success",
        )
      : this.uiManager.updateStatus(
          "🔇 RNNoise disabled - audio passes through unchanged",
          "info",
        );

    this.uiManager.updateUI(this.isProcessing, this.noiseSuppressionEnabled);
  }
}

// ####################################################
// React hook wrapper
// ####################################################

export interface UseRNNoiseProcessorResult {
  startProcessing: (mediaStream: MediaStream | null) => Promise<MediaStream | null>;
  stopProcessing: () => void;
  toggleProcessing: (mediaStream?: MediaStream | null) => Promise<void>;
  toggleNoiseSuppression: () => void;
  isProcessing: boolean;
  noiseSuppressionEnabled: boolean;
}

/**
 * Owns an `RNNoiseProcessor` instance for the lifetime of the component,
 * exposing its methods plus two mirrored `useState` values so consumers
 * can render based on `isProcessing` / `noiseSuppressionEnabled` without
 * reaching into the class instance directly. The underlying logic of
 * every method is identical to the original vanilla-JS class.
 */
export function useRNNoiseProcessor(): UseRNNoiseProcessorResult {
  const processorRef = useRef<RNNoiseProcessor | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(false);

  const getProcessor = useCallback((): RNNoiseProcessor => {
    if (!processorRef.current) {
      processorRef.current = new RNNoiseProcessor();
    }
    return processorRef.current;
  }, []);

  const startProcessing = useCallback(
    async (mediaStream: MediaStream | null): Promise<MediaStream | null> => {
      const processor = getProcessor();
      const result = await processor.startProcessing(mediaStream);
      setIsProcessing(processor.isProcessing);
      setNoiseSuppressionEnabled(processor.noiseSuppressionEnabled);
      return result;
    },
    [getProcessor],
  );

  const stopProcessing = useCallback((): void => {
    const processor = processorRef.current;
    if (!processor) return;
    processor.stopProcessing();
    setIsProcessing(processor.isProcessing);
    setNoiseSuppressionEnabled(processor.noiseSuppressionEnabled);
  }, []);

  const toggleProcessing = useCallback(
    async (mediaStream: MediaStream | null = null): Promise<void> => {
      const processor = getProcessor();
      await processor.toggleProcessing(mediaStream);
      setIsProcessing(processor.isProcessing);
      setNoiseSuppressionEnabled(processor.noiseSuppressionEnabled);
    },
    [getProcessor],
  );

  const toggleNoiseSuppression = useCallback((): void => {
    const processor = processorRef.current;
    if (!processor) return;
    processor.toggleNoiseSuppression();
    setNoiseSuppressionEnabled(processor.noiseSuppressionEnabled);
  }, []);

  // Safety net: stop processing and release the AudioContext on unmount.
  useEffect(() => {
    return () => {
      if (processorRef.current) {
        processorRef.current.stopProcessing();
        processorRef.current = null;
      }
    };
  }, []);

  return {
    startProcessing,
    stopProcessing,
    toggleProcessing,
    toggleNoiseSuppression,
    isProcessing,
    noiseSuppressionEnabled,
  };
}

export { RNNoiseProcessor };
export default useRNNoiseProcessor;

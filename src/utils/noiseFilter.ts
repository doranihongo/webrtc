export class AudioNoiseProcessor {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private isProcessing = false;

  public async processAudioStream(inputStream: MediaStream, noiseLevel: 'off' | 'medium' | 'high'): Promise<MediaStream> {
    const audioTrack = inputStream.getAudioTracks()[0];
    if (!audioTrack) return inputStream;

    if (noiseLevel === 'off' || noiseLevel === 'medium') {
      this.cleanup();
      return inputStream;
    }

    try {
      if (!this.audioCtx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioCtxClass({ sampleRate: 48000 });
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.cleanupNodes();

      const rawStream = new MediaStream([audioTrack]);
      this.sourceNode = this.audioCtx.createMediaStreamSource(rawStream);
      this.destinationNode = this.audioCtx.createMediaStreamDestination();

      await this.audioCtx.audioWorklet.addModule('/noiseSuppressionProcessor.js');

      this.workletNode = new AudioWorkletNode(this.audioCtx, 'noiseSuppressionProcessor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
      });

      // Fetch rnnoiseSync.js content and send it to worklet
      const jsResponse = await fetch('/rnnoiseSync.js');
      const jsContent = await jsResponse.text();
      
      this.workletNode.port.postMessage({
          type: 'sync-module',
          jsContent: jsContent,
      });

      this.workletNode.port.postMessage({
          type: 'enable',
          enabled: true,
      });

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.destinationNode);

      this.isProcessing = true;
      const processedAudioTrack = this.destinationNode.stream.getAudioTracks()[0];
      const videoTrack = inputStream.getVideoTracks()[0];

      const tracks: MediaStreamTrack[] = [processedAudioTrack];
      if (videoTrack) tracks.push(videoTrack);

      return new MediaStream(tracks);
    } catch (err) {
      console.warn('Web Audio Noise Filter error, falling back to raw stream:', err);
      return inputStream;
    }
  }

  private cleanupNodes() {
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.workletNode) {
      try { 
        this.workletNode.port.postMessage({ type: 'destroy' });
        this.workletNode.disconnect(); 
      } catch {}
      this.workletNode = null;
    }
    this.destinationNode = null;
  }

  public cleanup() {
    this.cleanupNodes();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }
    this.isProcessing = false;
  }

  public getIsProcessing(): boolean {
    return this.isProcessing;
  }
}

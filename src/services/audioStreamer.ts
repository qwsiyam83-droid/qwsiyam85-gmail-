/**
 * AudioStreamer: Handles real-time microphone capture (16kHz PCM),
 * output playback queue (24kHz PCM), sequential scheduling, interruption,
 * and audio diagnostic tests.
 */

export interface AudioStreamerCallbacks {
  onInputLevel?: (level: number) => void;
  onOutputLevel?: (level: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onError?: (err: Error | string) => void;
}

export class AudioStreamer {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private outputGainNode: GainNode | null = null;

  private isCapturing: boolean = false;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private callbacks: AudioStreamerCallbacks = {};

  private animFrameId: number | null = null;

  constructor(callbacks: AudioStreamerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: AudioStreamerCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Initializes or resumes the persistent Output AudioContext.
   * Essential on mobile browsers (Chrome / Safari) on user gesture.
   */
  public async ensureOutputAudioContext(): Promise<AudioContext> {
    console.log('[AudioStreamer] Ensuring Output AudioContext...');
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      console.log('[AudioStreamer] Created Output AudioContext at 24000Hz. State:', this.outputAudioCtx.state);

      this.outputGainNode = this.outputAudioCtx.createGain();
      this.outputGainNode.gain.setValueAtTime(1.0, this.outputAudioCtx.currentTime);

      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.5;

      this.outputGainNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
      console.log('[AudioStreamer] Output audio graph connected: Source -> GainNode -> AnalyserNode -> Destination');
    }

    if (this.outputAudioCtx.state === 'suspended') {
      console.log('[AudioStreamer] Output AudioContext is suspended. Resuming...');
      await this.outputAudioCtx.resume();
      console.log('[AudioStreamer] Output AudioContext resumed. State is now:', this.outputAudioCtx.state);
    }

    this.startLevelMonitoring();
    return this.outputAudioCtx;
  }

  /**
   * Starts microphone capture at 16kHz mono and streams Base64 PCM chunks.
   */
  public async startMicrophone(onAudioChunk: (base64Chunk: string) => void): Promise<void> {
    if (this.isCapturing) {
      console.warn('[AudioStreamer] Microphone already capturing');
      return;
    }

    console.log('[AudioStreamer] Requesting microphone permission...');
    await this.ensureOutputAudioContext();

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log('[AudioStreamer] Microphone permission granted and stream started');

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      console.log('[AudioStreamer] Created Input AudioContext at sampleRate:', this.inputAudioCtx.sampleRate);

      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
        console.log('[AudioStreamer] Input AudioContext resumed to running');
      }

      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);

      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.micSource.connect(this.inputAnalyser);

      // ScriptProcessorNode bufferSize = 2048 samples (~128ms at 16kHz)
      this.processorNode = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isCapturing) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Calculate RMS for logging & visual feedback
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / inputData.length);
        if (this.callbacks.onInputLevel) {
          this.callbacks.onInputLevel(Math.min(1.0, rms * 5));
        }

        // Convert Float32Array [-1.0, 1.0] to signed 16-bit PCM little-endian
        const pcm16Buffer = new ArrayBuffer(inputData.length * 2);
        const pcm16View = new DataView(pcm16Buffer);

        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          const val = s < 0 ? s * 0x8000 : s * 0x7fff;
          pcm16View.setInt16(i * 2, val, true); // true = little-endian
        }

        // Convert ArrayBuffer to Base64
        const uint8 = new Uint8Array(pcm16Buffer);
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Chunk = btoa(binary);

        onAudioChunk(base64Chunk);
      };

      this.micSource.connect(this.processorNode);
      // Connect processor to destination to keep it alive (silent because no audio drawn from output)
      this.processorNode.connect(this.inputAudioCtx.destination);

      this.isCapturing = true;
      console.log('[AudioStreamer] Microphone audio pipeline running and streaming PCM chunks');
    } catch (err: any) {
      console.error('[AudioStreamer] Microphone start failed:', err);
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
      throw err;
    }
  }

  /**
   * Stops microphone capture and cleans up nodes.
   */
  public stopMicrophone(): void {
    console.log('[AudioStreamer] Stopping microphone...');
    this.isCapturing = false;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {}
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => {
        track.stop();
        console.log('[AudioStreamer] Mic track stopped');
      });
      this.micStream = null;
    }

    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }

    if (this.callbacks.onInputLevel) {
      this.callbacks.onInputLevel(0);
    }
  }

  /**
   * Enqueues and schedules a 24kHz raw PCM chunk from Gemini Live.
   * Handles Base64 decode -> Int16 PCM -> Float32 -> AudioBuffer -> gapless scheduling.
   */
  public async playAudioChunk(base64Data: string, sampleRate: number = 24000): Promise<void> {
    if (!base64Data || base64Data.length === 0) return;

    try {
      const ctx = await this.ensureOutputAudioContext();

      // Decode Base64 to binary
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM little endian to Float32 [-1, 1]
      const int16Samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      const float32Samples = new Float32Array(int16Samples.length);

      for (let i = 0; i < int16Samples.length; i++) {
        float32Samples[i] = int16Samples[i] / 32768.0;
      }

      // Create AudioBuffer
      const audioBuffer = ctx.createBuffer(1, float32Samples.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Samples);

      // Create source node
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputGainNode!);

      // Schedule gapless sequential playback
      const currentTime = ctx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      const scheduleTime = this.nextStartTime;
      source.start(scheduleTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.add(source);

      if (!this.isPlaying) {
        this.isPlaying = true;
        if (this.callbacks.onPlaybackStateChange) {
          this.callbacks.onPlaybackStateChange(true);
        }
      }

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.activeSources.size === 0) {
          this.isPlaying = false;
          if (this.callbacks.onPlaybackStateChange) {
            this.callbacks.onPlaybackStateChange(false);
          }
          if (this.callbacks.onOutputLevel) {
            this.callbacks.onOutputLevel(0);
          }
        }
      };

      console.log(
        `[AudioStreamer] Scheduled audio chunk (${int16Samples.length} samples, ${(audioBuffer.duration * 1000).toFixed(1)}ms) at ${scheduleTime.toFixed(3)}s. Active sources: ${this.activeSources.size}`
      );
    } catch (err: any) {
      console.error('[AudioStreamer] Error decoding or scheduling audio chunk:', err);
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
    }
  }

  /**
   * Immediately stops all currently playing audio and resets the schedule queue.
   * Invoked on user interruption or manual stop.
   */
  public stopPlayback(): void {
    console.log('[AudioStreamer] Stopping all audio playback and clearing queue. Active sources:', this.activeSources.size);

    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    this.activeSources.clear();

    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    } else {
      this.nextStartTime = 0;
    }

    if (this.isPlaying) {
      this.isPlaying = false;
      if (this.callbacks.onPlaybackStateChange) {
        this.callbacks.onPlaybackStateChange(false);
      }
    }

    if (this.callbacks.onOutputLevel) {
      this.callbacks.onOutputLevel(0);
    }
  }

  /**
   * Speaker Diagnostic Test (Requirement 15):
   * Generates a 440Hz sine wave tone for 0.6 seconds through the exact same
   * output AudioContext, GainNode, and destination.
   */
  public async testSpeakerTone(): Promise<{ success: boolean; message: string }> {
    console.log('[AudioStreamer] Running Speaker Diagnostic Test (440Hz tone)...');
    try {
      const ctx = await this.ensureOutputAudioContext();

      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // Standard concert A 440Hz

      // Smooth attack and release envelope to prevent click/pop
      toneGain.gain.setValueAtTime(0, ctx.currentTime);
      toneGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      toneGain.gain.setValueAtTime(0.5, ctx.currentTime + 0.5);
      toneGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.6);

      osc.connect(toneGain);
      toneGain.connect(this.outputGainNode!);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);

      console.log('[AudioStreamer] Diagnostic tone (440Hz) successfully started on AudioContext state:', ctx.state);
      return {
        success: true,
        message: `440Hz diagnostic tone played successfully (AudioContext: ${ctx.state}, sampleRate: ${ctx.sampleRate}Hz)`,
      };
    } catch (err: any) {
      console.error('[AudioStreamer] Speaker Diagnostic Test failed:', err);
      return {
        success: false,
        message: `Diagnostic test failed: ${err?.message || 'Web Audio API error'}`,
      };
    }
  }

  /**
   * Real-time level monitoring loop for UI animations.
   */
  private startLevelMonitoring() {
    if (this.animFrameId) return;

    const buffer = new Uint8Array(128);

    const check = () => {
      if (this.outputAnalyser && this.isPlaying) {
        this.outputAnalyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length / 255;
        if (this.callbacks.onOutputLevel) {
          this.callbacks.onOutputLevel(avg);
        }
      }

      this.animFrameId = requestAnimationFrame(check);
    };

    this.animFrameId = requestAnimationFrame(check);
  }

  public cleanup(): void {
    console.log('[AudioStreamer] Cleaning up audio streamer resources');
    this.stopMicrophone();
    this.stopPlayback();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
  }
}

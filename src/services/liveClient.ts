import { AssistantState, ActionLogItem, LiveClientCallbacks, ToolExecutionResult } from '../types/assistant';
import { AudioStreamer } from './audioStreamer';
import { deviceBridge } from './deviceBridge';

export class LiveClient {
  private ws: WebSocket | null = null;
  private audioStreamer: AudioStreamer;
  private callbacks: LiveClientCallbacks;
  private state: AssistantState = 'idle';
  private isUserConnected: boolean = false;
  private pingInterval: any = null;

  constructor(audioStreamer: AudioStreamer, callbacks: LiveClientCallbacks) {
    this.audioStreamer = audioStreamer;
    this.callbacks = callbacks;

    // Listen to playback state changes to transition between 'speaking' and 'listening'
    this.audioStreamer.setCallbacks({
      onPlaybackStateChange: (isPlaying) => {
        if (!this.isUserConnected) return;
        if (isPlaying) {
          this.updateState('speaking');
        } else {
          this.updateState('listening');
        }
      },
      onInputLevel: (lvl) => this.callbacks.onAudioLevel(lvl),
      onOutputLevel: (lvl) => this.callbacks.onArushiAudioLevel(lvl),
      onError: (err) => {
        const msg = typeof err === 'string' ? err : err.message;
        this.logAction('system', `Audio Error: ${msg}`, 'error');
        this.callbacks.onError(msg);
      },
    });
  }

  public getState(): AssistantState {
    return this.state;
  }

  private updateState(newState: AssistantState) {
    if (this.state === newState) return;
    console.log(`[LiveClient] State transition: ${this.state} -> ${newState}`);
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  private logAction(
    type: 'tool' | 'system' | 'speech' | 'diagnostic',
    text: string,
    status?: 'success' | 'warning' | 'error' | 'pending',
    details?: string
  ) {
    const item: ActionLogItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      type,
      text,
      status,
      details,
    };
    this.callbacks.onActionLog(item);
  }

  /**
   * Connects to the Gemini Live session via WebSocket and starts microphone streaming.
   */
  public async connect(): Promise<void> {
    if (this.isUserConnected) {
      console.warn('[LiveClient] Already connected or connecting');
      return;
    }

    console.log('[LiveClient] Initializing connection to Arushi Live session...');
    this.updateState('connecting');
    this.isUserConnected = true;

    try {
      // 1. Resume / unlock output AudioContext (vital for mobile browsers)
      await this.audioStreamer.ensureOutputAudioContext();

      // 2. Establish WebSocket connection to backend server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;
      console.log(`[LiveClient] Connecting WebSocket: ${wsUrl}`);
      this.logAction('system', 'Connecting to Arushi voice server...', 'pending');

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        console.log('[LiveClient] WebSocket connection established with server');
        this.logAction('system', 'Connected to Gemini Live session. Initializing microphone...', 'success');

        // Start keepalive ping
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);

        try {
          // 3. Start microphone capture
          await this.audioStreamer.startMicrophone((base64Chunk) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(
                JSON.stringify({
                  type: 'audio',
                  data: base64Chunk,
                })
              );
            }
          });

          this.updateState('listening');
          this.logAction('system', 'Arushi is listening! Speak in Hindi, English, Hinglish, etc.', 'success');
        } catch (micErr: any) {
          console.error('[LiveClient] Microphone permission denied or failed:', micErr);
          this.updateState('error');
          this.logAction('system', `Microphone access denied: ${micErr.message}`, 'error');
          this.callbacks.onError('Microphone access is required for Arushi voice conversation.');
          this.disconnect();
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle audio chunk from Gemini Live
          if (msg.type === 'audio' && msg.data) {
            console.log(`[LiveClient] Audio chunk received (${msg.data.length} chars base64, rate=${msg.sampleRate || 24000})`);
            await this.audioStreamer.playAudioChunk(msg.data, msg.sampleRate || 24000);
          }

          // Handle interruption event
          if (msg.type === 'interrupted') {
            console.log('[LiveClient] User interrupted Arushi! Stopping playback.');
            this.audioStreamer.stopPlayback();
            this.updateState('listening');
            this.logAction('speech', 'Interruption detected — stopping playback', 'warning');
          }

          // Handle tool call from Gemini Live
          if (msg.type === 'toolCall' && Array.isArray(msg.calls)) {
            console.log('[LiveClient] Received tool calls from Gemini Live:', msg.calls);
            await this.handleToolCalls(msg.calls);
          }

          // Handle transcript/text
          if (msg.type === 'transcript') {
            if (msg.speaker && msg.text && this.callbacks.onTranscript) {
              this.callbacks.onTranscript(msg.speaker, msg.text);
            }
          }

          // Handle server-side status/info
          if (msg.type === 'status') {
            console.log(`[LiveClient] Status from server: ${msg.message}`);
            this.logAction('system', msg.message, 'success');
          }

          // Handle server-side error
          if (msg.type === 'error') {
            console.error('[LiveClient] Server error:', msg.message);
            this.logAction('system', `Server error: ${msg.message}`, 'error');
            this.callbacks.onError(msg.message);
          }
        } catch (err: any) {
          console.error('[LiveClient] Error parsing WebSocket message:', err, event.data);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[LiveClient] WebSocket error:', event);
        this.logAction('system', 'Connection error with Arushi voice server', 'error');
        this.updateState('error');
      };

      this.ws.onclose = (event) => {
        console.log(`[LiveClient] WebSocket closed (code=${event.code}, reason=${event.reason})`);
        if (this.isUserConnected) {
          this.logAction('system', 'Session disconnected', 'warning');
          this.disconnect();
        }
      };
    } catch (err: any) {
      console.error('[LiveClient] Connection initialization error:', err);
      this.updateState('error');
      this.logAction('system', `Connection failure: ${err.message}`, 'error');
      this.callbacks.onError(err.message || 'Failed to connect to Arushi');
      this.disconnect();
    }
  }

  /**
   * Executes tool calls and returns structured responses to Gemini Live.
   */
  private async handleToolCalls(calls: Array<{ id: string; name: string; args: any }>) {
    const responses: Array<{ id: string; name: string; response: Record<string, any> }> = [];

    for (const call of calls) {
      console.log(`[LiveClient] Executing tool: ${call.name} with args:`, call.args);
      let result: ToolExecutionResult;

      try {
        switch (call.name) {
          case 'openWhatsApp': {
            this.logAction('tool', 'Opening WhatsApp...', 'pending');
            result = await deviceBridge.openWhatsApp(call.args?.message);
            break;
          }
          case 'openApp': {
            const app = call.args?.appName || '';
            this.logAction('tool', `Opening ${app}...`, 'pending');
            result = await deviceBridge.openApp(app);
            break;
          }
          case 'openWebsite': {
            const url = call.args?.url || '';
            this.logAction('tool', `Navigating to ${url}...`, 'pending');
            result = await deviceBridge.openWebsite(url);
            break;
          }
          case 'makeCall': {
            const phone = call.args?.phoneNumber || '';
            this.logAction('tool', `Dialing ${phone}...`, 'pending');
            result = await deviceBridge.makeCall(phone);
            break;
          }
          case 'callContact': {
            const contactName = call.args?.contactName || '';
            this.logAction('tool', `Searching contact "${contactName}"...`, 'pending');
            result = await deviceBridge.callContact(contactName);
            break;
          }
          default: {
            result = {
              success: false,
              action: call.name,
              error: `Tool "${call.name}" is not recognized or not allowed.`,
            };
          }
        }
      } catch (toolErr: any) {
        result = {
          success: false,
          action: call.name,
          error: `Error executing ${call.name}: ${toolErr.message || 'Execution error'}`,
        };
      }

      console.log(`[LiveClient] Tool "${call.name}" execution result:`, result);
      this.callbacks.onToolExecuted(call.name, result);

      if (result.success) {
        this.logAction('tool', result.message || `Action ${call.name} succeeded`, 'success');
      } else {
        this.logAction('tool', result.error || `Action ${call.name} failed`, 'warning');
      }

      responses.push({
        id: call.id,
        name: call.name,
        response: {
          output: result,
        },
      });
    }

    // Send tool responses back to Gemini Live via server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[LiveClient] Sending tool responses back to Gemini Live:', responses);
      this.ws.send(
        JSON.stringify({
          type: 'toolResponse',
          responses,
        })
      );
    }
  }

  /**
   * Disconnects the session, stops microphone, audio, and cleans up.
   */
  public disconnect(): void {
    console.log('[LiveClient] Disconnecting Arushi session...');
    this.isUserConnected = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.audioStreamer.stopMicrophone();
    this.audioStreamer.stopPlayback();

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'close' }));
        }
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.updateState('idle');
    this.logAction('system', 'Session ended. Arushi is idle.', 'success');
  }

  public cleanup(): void {
    this.disconnect();
    this.audioStreamer.cleanup();
  }
}

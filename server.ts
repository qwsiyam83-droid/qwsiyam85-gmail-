import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
  FunctionDeclaration,
} from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/live-ws' });

// System instruction for Arushi AI Voice Assistant
const ARUSHI_SYSTEM_INSTRUCTION = `You are Arushi, a young, confident, witty, playful, and emotionally responsive virtual assistant. Talk naturally and casually like a close friend. Be expressive, slightly teasing, funny, and smart when appropriate. Use light sarcasm and witty responses. Never sound robotic. Adapt your tone to the user's emotions and conversation. Automatically understand and respond in the language the user is speaking. Supported languages include Hindi, English, Hinglish, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Urdu, and others.

Rules:
1. If the user speaks Hindi, respond in Hindi.
2. If the user speaks English, respond in English.
3. If the user speaks Hinglish, respond naturally in Hinglish.
4. Keep responses natural, engaging, witty, and concise enough for real-time voice conversation.
5. You can execute safe supported device actions through available tools:
   - openWhatsApp: open WhatsApp (e.g., "WhatsApp kholo", "open WhatsApp")
   - openApp: open supported apps (YouTube, Instagram, Spotify, Google Maps, Gmail, Twitter, etc.)
   - openWebsite: open web URLs
   - makeCall: dial a phone number
   - callContact: call a contact by name (Mom, Mummy, Dad, Papa, Rahul, etc.)
6. When calling a contact, if the tool indicates multiple matches, ask the user to clarify which one to call.
7. Never claim that an action was completed unless the tool execution succeeded.
8. Avoid explicit, dangerous, or inappropriate content while maintaining your charm, confidence, and personality.`;

// Predefined safe function declarations for device actions
const openWhatsAppDeclaration: FunctionDeclaration = {
  name: 'openWhatsApp',
  description:
    'Opens WhatsApp. Triggered for requests like "Open WhatsApp", "WhatsApp kholo", "WhatsApp open karo", "WhatsApp chalao", or "Can you open WhatsApp?".',
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: {
        type: Type.STRING,
        description: 'Optional pre-filled message text to send in WhatsApp.',
      },
    },
  },
};

const openAppDeclaration: FunctionDeclaration = {
  name: 'openApp',
  description:
    'Opens a supported application such as YouTube, Instagram, Spotify, Maps, Gmail, Twitter/X, Telegram, Calculator, or Clock.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      appName: {
        type: Type.STRING,
        description:
          'Name of the application to open (e.g., YouTube, Instagram, Spotify, Maps, Gmail).',
      },
    },
    required: ['appName'],
  },
};

const openWebsiteDeclaration: FunctionDeclaration = {
  name: 'openWebsite',
  description: 'Opens a validated HTTP/HTTPS website URL in the browser.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: 'The website URL to navigate to (e.g. https://google.com).',
      },
    },
    required: ['url'],
  },
};

const makeCallDeclaration: FunctionDeclaration = {
  name: 'makeCall',
  description:
    'Initiates a phone call or opens the dialer with the specified phone number.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      phoneNumber: {
        type: Type.STRING,
        description: 'The phone number to call (e.g. +919876543210).',
      },
    },
    required: ['phoneNumber'],
  },
};

const callContactDeclaration: FunctionDeclaration = {
  name: 'callContact',
  description:
    'Searches for a saved contact by name (e.g. Mom, Mummy, Dad, Papa, Rahul, Priya) and initiates a phone call. If multiple contacts match the query, the tool returns the list so you can ask the user for clarification.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      contactName: {
        type: Type.STRING,
        description: 'The name or relationship of the contact to call (e.g., "Mom", "Rahul").',
      },
    },
    required: ['contactName'],
  },
};

// Simple diagnostic route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    assistant: 'Arushi',
    model: 'gemini-3.8-live',
    voice: 'Kore',
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// WebSocket connection handling for Gemini Live session
wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[Server] Client connected to /api/live-ws');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Server] GEMINI_API_KEY is not defined in environment!');
    clientWs.send(
      JSON.stringify({
        type: 'error',
        message: 'GEMINI_API_KEY is not configured on the server.',
      })
    );
    clientWs.close();
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let liveSession: any = null;
  let isClosing = false;

  try {
    console.log('[Server] Connecting to Gemini Live API with model: gemini-3.8-live...');
    liveSession = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
        systemInstruction: ARUSHI_SYSTEM_INSTRUCTION,
        tools: [
          {
            functionDeclarations: [
              openWhatsAppDeclaration,
              openAppDeclaration,
              openWebsiteDeclaration,
              makeCallDeclaration,
              callContactDeclaration,
            ],
          },
        ],
      },
      callbacks: {
        onopen: () => {
          console.log('[Server] Gemini Live WebSocket session opened successfully');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'status',
                message: 'Arushi Live session connected and ready',
              })
            );
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (isClosing || clientWs.readyState !== WebSocket.OPEN) return;

          // 1. Check for audio chunks and transcript parts
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                console.log(
                  `[Server] Forwarding Gemini audio chunk (${part.inlineData.data.length} chars base64, mime=${part.inlineData.mimeType})`
                );
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                    sampleRate: 24000,
                  })
                );
              }
              if (part.text) {
                console.log(`[Server] Gemini text part: "${part.text}"`);
                clientWs.send(
                  JSON.stringify({
                    type: 'transcript',
                    speaker: 'arushi',
                    text: part.text,
                  })
                );
              }
            }
          }

          // 2. Check for interruption
          if (message.serverContent?.interrupted) {
            console.log('[Server] Gemini detected interruption! Notifying client.');
            clientWs.send(
              JSON.stringify({
                type: 'interrupted',
              })
            );
          }

          // 3. Check for tool calls
          if (message.toolCall?.functionCalls) {
            console.log(
              '[Server] Gemini requested tool calls:',
              message.toolCall.functionCalls
            );
            clientWs.send(
              JSON.stringify({
                type: 'toolCall',
                calls: message.toolCall.functionCalls,
              })
            );
          }
        },
        onerror: (err: any) => {
          console.error('[Server] Gemini Live session error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message: `Gemini Live error: ${err?.message || 'Connection error'}`,
              })
            );
          }
        },
        onclose: () => {
          console.log('[Server] Gemini Live session closed');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'status',
                message: 'Gemini Live session closed',
              })
            );
          }
        },
      },
    });

    console.log('[Server] Gemini Live session initialized');
  } catch (connectErr: any) {
    console.error('[Server] Failed to connect to Gemini Live:', connectErr);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: `Failed to initialize Gemini Live session: ${connectErr.message}`,
        })
      );
      clientWs.close();
    }
    return;
  }

  // Handle messages from the browser client
  clientWs.on('message', async (data: Buffer | string) => {
    try {
      const payload = JSON.parse(data.toString());

      if (payload.type === 'ping') {
        clientWs.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (payload.type === 'audio' && payload.data && liveSession) {
        // Realtime 16kHz PCM audio chunk from microphone
        liveSession.sendRealtimeInput({
          audio: {
            data: payload.data,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      }

      if (payload.type === 'toolResponse' && payload.responses && liveSession) {
        console.log('[Server] Returning tool responses to Gemini Live:', payload.responses);
        liveSession.sendToolResponse({
          functionResponses: payload.responses,
        });
      }

      if (payload.type === 'close') {
        isClosing = true;
        if (liveSession) {
          try {
            liveSession.close();
          } catch {}
        }
      }
    } catch (err: any) {
      console.error('[Server] Error processing client message:', err);
    }
  });

  clientWs.on('close', () => {
    console.log('[Server] Client disconnected from /api/live-ws');
    isClosing = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch {}
      liveSession = null;
    }
  });

  clientWs.on('error', (err) => {
    console.error('[Server] Client WebSocket error:', err);
    isClosing = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch {}
    }
  });
});

// Setup Vite middlewares in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Arushi Voice Assistant server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start server:', err);
});

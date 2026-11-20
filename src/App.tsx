import React, { useState, useEffect, useRef } from 'react';
import { AssistantState, ActionLogItem, ToolExecutionResult } from './types/assistant';
import { AudioStreamer } from './services/audioStreamer';
import { LiveClient } from './services/liveClient';
import { deviceBridge } from './services/deviceBridge';
import { VoiceOrb } from './components/VoiceOrb';
import { ActionBanner } from './components/ActionBanner';
import { SpeakerDiagnosticModal } from './components/SpeakerDiagnosticModal';
import { ContactManagerModal } from './components/ContactManagerModal';
import { ActivityDrawer } from './components/ActivityDrawer';
import { QuickCommands } from './components/QuickCommands';
import { Volume2, Users, Smartphone, ShieldCheck, RefreshCw } from 'lucide-react';

export default function App() {
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [outputLevel, setOutputLevel] = useState<number>(0);
  const [activeAction, setActiveAction] = useState<ToolExecutionResult | null>(null);
  const [logs, setLogs] = useState<ActionLogItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSpeakerModalOpen, setIsSpeakerModalOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveClientRef = useRef<LiveClient | null>(null);

  useEffect(() => {
    // Initialize audio streamer and live client
    const streamer = new AudioStreamer();
    audioStreamerRef.current = streamer;

    const client = new LiveClient(streamer, {
      onStateChange: (newState) => {
        setAssistantState(newState);
        if (newState !== 'error') {
          setErrorMessage(null);
        }
      },
      onAudioLevel: (lvl) => setInputLevel(lvl),
      onArushiAudioLevel: (lvl) => setOutputLevel(lvl),
      onActionLog: (logItem) => {
        setLogs((prev) => [logItem, ...prev.slice(0, 49)]);
      },
      onToolExecuted: (name, result) => {
        setActiveAction(result);
      },
      onError: (err) => {
        setErrorMessage(err);
      },
    });

    liveClientRef.current = client;

    // Check platform mode
    const platform = deviceBridge.getPlatformMode();
    console.log(`[Arushi] Platform detected: ${platform}`);

    return () => {
      client.cleanup();
    };
  }, []);

  const handleOrbClick = async () => {
    const client = liveClientRef.current;
    if (!client) return;

    if (assistantState === 'idle' || assistantState === 'error') {
      await client.connect();
    } else {
      client.disconnect();
    }
  };

  const isAndroidNative = deviceBridge.isNativeAndroidAvailable();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-fuchsia-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background atmospheric glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-fuchsia-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-4xl mx-auto px-4 py-3 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-indigo-600 flex items-center justify-center shadow-md shadow-fuchsia-600/20">
            <span className="text-white font-black text-base tracking-wider">A</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold tracking-tight text-white">Arushi</h1>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-fuchsia-950 text-fuchsia-400 border border-fuchsia-800/40">
                Live Voice
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Multilingual Real-Time Voice Assistant</p>
          </div>
        </div>

        {/* Action Controls & Diagnostics */}
        <div className="flex items-center gap-2">
          {/* Platform Badge */}
          <div
            className={`hidden sm:flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${
              isAndroidNative
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
            title={isAndroidNative ? 'Android Native Bridge active' : 'Browser mode with deep links and dialer'}
          >
            <Smartphone className="w-3 h-3 text-cyan-400" />
            <span>{isAndroidNative ? 'Android APK' : 'Web & Mobile'}</span>
          </div>

          {/* Test Speaker Button (Requirement 15) */}
          <button
            onClick={() => setIsSpeakerModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            title="Speaker Diagnostic Test"
          >
            <Volume2 className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden sm:inline">Test Speaker</span>
          </button>

          {/* Contacts Manager Button */}
          <button
            onClick={() => setIsContactsModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            title="View & Edit Phone Contacts"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Contacts</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-xl mx-auto w-full">
        {/* Error Notification */}
        {errorMessage && (
          <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between animate-in fade-in">
            <span>{errorMessage}</span>
            <button
              onClick={() => handleOrbClick()}
              className="px-2 py-1 rounded bg-rose-900 hover:bg-rose-800 text-white font-medium flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Active Tool Execution Banner */}
        <ActionBanner
          action={activeAction}
          onDismiss={() => setActiveAction(null)}
        />

        {/* Glowing Interactive Voice Orb */}
        <div className="my-auto py-6">
          <VoiceOrb
            state={assistantState}
            inputLevel={inputLevel}
            outputLevel={outputLevel}
            onClick={handleOrbClick}
          />
        </div>

        {/* Voice Prompts Suggestions */}
        <QuickCommands />

        {/* Subtle Security & Architecture Guarantee */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 mt-2">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Real Gemini Live Native Audio • Safe Allowlisted Device Actions</span>
        </div>
      </main>

      {/* Bottom Live Activity Drawer */}
      <footer className="relative z-20 w-full max-w-4xl mx-auto px-4 pb-3">
        <ActivityDrawer
          logs={logs}
          isOpen={isActivityDrawerOpen}
          onToggle={() => setIsActivityDrawerOpen((prev) => !prev)}
          onClear={() => setLogs([])}
        />
      </footer>

      {/* Modals */}
      {audioStreamerRef.current && (
        <SpeakerDiagnosticModal
          isOpen={isSpeakerModalOpen}
          onClose={() => setIsSpeakerModalOpen(false)}
          audioStreamer={audioStreamerRef.current}
        />
      )}

      <ContactManagerModal
        isOpen={isContactsModalOpen}
        onClose={() => setIsContactsModalOpen(false)}
      />
    </div>
  );
}

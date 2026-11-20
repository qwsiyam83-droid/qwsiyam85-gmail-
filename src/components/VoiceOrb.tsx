import React from 'react';
import { AssistantState } from '../types/assistant';
import { Mic, Volume2, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

interface VoiceOrbProps {
  state: AssistantState;
  inputLevel: number; // 0.0 - 1.0 (user voice)
  outputLevel: number; // 0.0 - 1.0 (Arushi voice)
  onClick: () => void;
  disabled?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  inputLevel,
  outputLevel,
  onClick,
  disabled = false,
}) => {
  // Compute dynamic scale and glow based on audio amplitude
  const activeLevel = state === 'speaking' ? outputLevel : state === 'listening' ? inputLevel : 0;
  const pulseScale = 1 + activeLevel * 0.35;
  const outerRingScale = 1 + activeLevel * 0.7;

  // State-specific color palettes
  const getGlowColor = () => {
    switch (state) {
      case 'listening':
        return 'from-teal-400 via-cyan-500 to-emerald-400 shadow-[0_0_80px_rgba(20,184,166,0.6)]';
      case 'speaking':
        return 'from-fuchsia-500 via-purple-600 to-pink-500 shadow-[0_0_100px_rgba(217,70,239,0.7)]';
      case 'connecting':
        return 'from-amber-400 via-orange-500 to-rose-500 shadow-[0_0_60px_rgba(245,158,11,0.5)]';
      case 'error':
        return 'from-red-500 via-rose-600 to-orange-500 shadow-[0_0_60px_rgba(239,68,68,0.5)]';
      case 'idle':
      default:
        return 'from-violet-600 via-indigo-600 to-sky-600 shadow-[0_0_50px_rgba(99,102,241,0.35)]';
    }
  };

  const getStatusLabel = () => {
    switch (state) {
      case 'listening':
        return 'Listening to you...';
      case 'speaking':
        return 'Arushi is speaking...';
      case 'connecting':
        return 'Connecting to Gemini Live...';
      case 'error':
        return 'Connection error';
      case 'idle':
      default:
        return 'Tap to talk to Arushi';
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'connecting':
        return <Loader2 className="w-12 h-12 text-white animate-spin" />;
      case 'listening':
        return <Mic className="w-12 h-12 text-white animate-pulse" />;
      case 'speaking':
        return <Volume2 className="w-12 h-12 text-white animate-bounce" />;
      case 'error':
        return <AlertCircle className="w-12 h-12 text-white" />;
      case 'idle':
      default:
        return <Sparkles className="w-12 h-12 text-white/90" />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center relative">
      {/* Outer audio energy rings */}
      <div
        className={`absolute rounded-full transition-transform duration-75 pointer-events-none ${
          state === 'speaking'
            ? 'w-72 h-72 border-2 border-fuchsia-400/40 animate-ping opacity-60'
            : state === 'listening'
            ? 'w-72 h-72 border-2 border-cyan-400/40 opacity-70'
            : 'w-64 h-64 border border-indigo-500/10'
        }`}
        style={{
          transform: `scale(${outerRingScale})`,
        }}
      />

      <div
        className={`absolute rounded-full transition-transform duration-100 pointer-events-none ${
          state === 'speaking'
            ? 'w-80 h-80 bg-fuchsia-500/10 blur-2xl'
            : state === 'listening'
            ? 'w-80 h-80 bg-cyan-500/15 blur-2xl'
            : 'w-64 h-64 bg-indigo-500/5 blur-xl'
        }`}
      />

      {/* Main Interactive Button / Orb */}
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={getStatusLabel()}
        className={`relative z-10 w-44 h-44 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-400/30 group active:scale-95 bg-gradient-to-tr ${getGlowColor()}`}
        style={{
          transform: `scale(${pulseScale})`,
        }}
      >
        {/* Core sphere shading */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/25 via-transparent to-black/40 pointer-events-none" />

        {/* Ambient swirling shimmer */}
        <div
          className={`absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent_60%)] pointer-events-none ${
            state === 'connecting' || state === 'speaking' ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '6s' }}
        />

        {/* Center Icon */}
        <div className="relative z-20 flex flex-col items-center justify-center pointer-events-none drop-shadow-md">
          {getIcon()}
        </div>
      </button>

      {/* Status Pill Badge */}
      <div className="mt-8 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            state === 'listening'
              ? 'bg-cyan-400 animate-ping'
              : state === 'speaking'
              ? 'bg-fuchsia-400 animate-pulse'
              : state === 'connecting'
              ? 'bg-amber-400 animate-pulse'
              : state === 'error'
              ? 'bg-red-500'
              : 'bg-slate-500'
          }`}
        />
        <span className="text-sm font-medium tracking-wide text-slate-200">
          {getStatusLabel()}
        </span>
      </div>
    </div>
  );
};

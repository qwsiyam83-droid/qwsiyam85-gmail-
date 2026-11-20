import React, { useState } from 'react';
import { Volume2, X, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import { AudioStreamer } from '../services/audioStreamer';

interface SpeakerDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioStreamer: AudioStreamer;
}

export const SpeakerDiagnosticModal: React.FC<SpeakerDiagnosticModalProps> = ({
  isOpen,
  onClose,
  audioStreamer,
}) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestSpeaker = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await audioStreamer.testSpeakerTone();
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || 'Failed to execute speaker test',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Speaker Diagnostic Test</h3>
            <p className="text-xs text-slate-400">Web Audio API & hardware output validation</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Plays a pure <strong>440Hz test tone</strong> directly through Arushi's exact output AudioContext,
          GainNode, and device speaker to verify device audio playback.
        </p>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1 mb-5">
          <div className="flex justify-between">
            <span>Audio Graph:</span>
            <span className="font-mono text-cyan-400">Oscillator → GainNode → Analyser → Destination</span>
          </div>
          <div className="flex justify-between">
            <span>Target Sample Rate:</span>
            <span className="font-mono text-cyan-400">24,000 Hz</span>
          </div>
          <div className="flex justify-between">
            <span>Tone Frequency:</span>
            <span className="font-mono text-cyan-400">440 Hz (Concert A)</span>
          </div>
        </div>

        <button
          onClick={handleTestSpeaker}
          disabled={testing}
          className="w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-600/25 active:scale-98 transition-all disabled:opacity-50"
        >
          <Volume2 className="w-5 h-5" />
          <span>{testing ? 'Playing 440Hz Tone...' : 'Test Speaker (Play 440Hz Tone)'}</span>
        </button>

        {result && (
          <div
            className={`mt-4 p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in duration-150 ${
              result.success
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            {result.success ? (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            )}
            <div>
              <p className="font-semibold">{result.success ? 'Speaker Hardware Verified' : 'Speaker Test Failed'}</p>
              <p className="mt-0.5 text-slate-300">{result.message}</p>
              {result.success && (
                <p className="mt-1 text-slate-400">
                  Did you hear the chime? If yes, Web Audio playback on this device is fully functional!
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

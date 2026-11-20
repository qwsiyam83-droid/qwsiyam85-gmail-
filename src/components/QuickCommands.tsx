import React from 'react';
import { Sparkles, MessageCircle, Phone, Globe, Play } from 'lucide-react';

interface QuickCommandsProps {
  onSelectPrompt?: (text: string) => void;
}

export const QuickCommands: React.FC<QuickCommandsProps> = () => {
  const commands = [
    { text: 'Hello Arushi, how are you?', lang: 'English', icon: <Sparkles className="w-3.5 h-3.5 text-violet-400" /> },
    { text: 'WhatsApp kholo', lang: 'Hindi', icon: <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> },
    { text: 'Call Mom', lang: 'Dialer', icon: <Phone className="w-3.5 h-3.5 text-sky-400" /> },
    { text: 'Call Rahul', lang: 'Disambiguation', icon: <Phone className="w-3.5 h-3.5 text-amber-400" /> },
    { text: 'Arushi, mere se Hinglish mein baat karo', lang: 'Hinglish', icon: <Globe className="w-3.5 h-3.5 text-pink-400" /> },
    { text: 'Open YouTube', lang: 'App', icon: <Play className="w-3.5 h-3.5 text-rose-400" /> },
  ];

  return (
    <div className="w-full max-w-xl mx-auto my-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
          Try saying to Arushi
        </span>
        <span className="text-[11px] text-cyan-400">Natural Multilingual Voice</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {commands.map((cmd, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700/80 transition-all text-left"
          >
            <div className="p-1.5 rounded-lg bg-slate-800 shrink-0">
              {cmd.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">
                "{cmd.text}"
              </p>
              <span className="text-[10px] text-slate-400 block font-mono">
                {cmd.lang}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import { ActionLogItem } from '../types/assistant';
import { ChevronDown, ChevronUp, Activity, CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';

interface ActivityDrawerProps {
  logs: ActionLogItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({
  logs,
  isOpen,
  onToggle,
  onClear,
}) => {
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />;
      case 'pending':
        return <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0 mt-0.5" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto mt-auto">
      {/* Drawer Header Toggle */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-t-xl text-xs text-slate-300">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 font-medium hover:text-white transition-colors cursor-pointer"
        >
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Live Activity & Tool Feed</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
            {logs.length}
          </span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>

        {isOpen && logs.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div className="bg-slate-950/90 backdrop-blur-md border-x border-b border-slate-800 rounded-b-xl p-3 max-h-48 overflow-y-auto space-y-2 text-xs">
          {logs.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No activity yet. Speak to Arushi or try a voice command!
            </div>
          ) : (
            logs.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80"
              >
                {getStatusIcon(item.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-200 truncate">{item.text}</span>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  {item.details && (
                    <p className="text-[11px] text-slate-400 mt-0.5 break-all">{item.details}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

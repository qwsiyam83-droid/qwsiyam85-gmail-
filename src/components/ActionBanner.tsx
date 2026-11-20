import React from 'react';
import { ToolExecutionResult } from '../types/assistant';
import { MessageSquare, Phone, ExternalLink, AppWindow, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ActionBannerProps {
  action: ToolExecutionResult | null;
  onDismiss: () => void;
}

export const ActionBanner: React.FC<ActionBannerProps> = ({ action, onDismiss }) => {
  if (!action) return null;

  const getIcon = () => {
    switch (action.action) {
      case 'openWhatsApp':
        return <MessageSquare className="w-5 h-5 text-emerald-400" />;
      case 'makeCall':
      case 'callContact':
        return <Phone className="w-5 h-5 text-sky-400" />;
      case 'openWebsite':
        return <ExternalLink className="w-5 h-5 text-violet-400" />;
      case 'openApp':
        return <AppWindow className="w-5 h-5 text-amber-400" />;
      default:
        return action.success ? (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div
        className={`p-3.5 rounded-xl border backdrop-blur-md shadow-xl flex items-start gap-3 transition-colors ${
          action.success
            ? 'bg-slate-900/90 border-emerald-500/30'
            : action.multipleMatches
            ? 'bg-slate-900/90 border-amber-500/40'
            : 'bg-slate-900/90 border-rose-500/30'
        }`}
      >
        <div className="p-2 rounded-lg bg-slate-800/80 shrink-0">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              {action.action}
            </span>
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm font-medium text-slate-100 mt-0.5 leading-snug">
            {action.message || action.error || 'Action executed'}
          </p>

          {/* Multiple matches disambiguation helper */}
          {action.multipleMatches && action.matches && (
            <div className="mt-2 text-xs text-amber-200/90 bg-amber-950/40 p-2 rounded border border-amber-500/20">
              <span className="font-semibold">Matching contacts:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {action.matches.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick link if URL available */}
          {action.url && (
            <a
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-xs text-cyan-400 hover:underline"
            >
              <span>{action.url}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

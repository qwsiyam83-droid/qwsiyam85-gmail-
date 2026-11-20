export type AssistantState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  action: string;
  message?: string;
  error?: string;
  multipleMatches?: boolean;
  matches?: string[];
  contactName?: string;
  phoneNumber?: string;
  url?: string;
  appName?: string;
  rawDetails?: Record<string, any>;
}

export interface ActionLogItem {
  id: string;
  timestamp: number;
  type: 'tool' | 'system' | 'speech' | 'diagnostic';
  text: string;
  status?: 'success' | 'warning' | 'error' | 'pending';
  details?: string;
}

export interface LiveClientCallbacks {
  onStateChange: (state: AssistantState) => void;
  onAudioLevel: (level: number) => void;
  onArushiAudioLevel: (level: number) => void;
  onActionLog: (item: ActionLogItem) => void;
  onToolExecuted: (toolName: string, result: ToolExecutionResult) => void;
  onError: (message: string) => void;
  onTranscript?: (speaker: 'user' | 'arushi', text: string) => void;
}

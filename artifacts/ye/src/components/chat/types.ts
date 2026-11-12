export type ChatSource = {
  title: string;
  url: string;
};

export type ChatAction = {
  id: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  kind?: string;
  payload?: Record<string, unknown>;
  result?: unknown;
  status?: 'pending' | 'prepared' | 'confirmed' | 'succeeded' | 'failed';
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  sources?: ChatSource[];
  actions?: ChatAction[];
  handoff?: boolean;
  /** Live-only flag: reply came from the verified fallback, not the AI model. */
  providerUnavailable?: boolean;
};

export type ChatSession = {
  id: string;
  title?: string;
  updatedAt?: string;
};
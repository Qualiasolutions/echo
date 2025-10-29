export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  confidence?: number;
  sentiment?: number;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  sessionId: string;
  status: 'active' | 'ended';
  messages: Message[];
  startedAt: Date;
  endedAt?: Date;
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  error?: string;
}

export interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  avgConfidence: number;
  avgSentiment: number;
  handoffRate: number;
  responseTime: number;
}

export interface ChatResponse {
  response: string;
  intent: string;
  confidence: number;
  sentiment: number;
  handoffNeeded: boolean;
  suggestions: string[];
}

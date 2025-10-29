import { useState, useCallback } from 'react';
import { Message, ChatResponse } from '../types';
import { supabase } from '../lib/supabase';

export const useConversation = (sessionId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string): Promise<ChatResponse | null> => {
    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Call edge function
      const { data, error: functionError } = await supabase.functions.invoke('chat-response', {
        body: {
          message: content,
          sessionId,
          conversationHistory: messages
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      const response = data?.data as ChatResponse;

      if (!response) {
        throw new Error('No response from AI');
      }

      // Add AI message
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        intent: response.intent,
        confidence: response.confidence,
        sentiment: response.sentiment,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

      setIsLoading(false);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      setIsLoading(false);
      
      // Add error message
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or contact support if the problem persists.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      
      return null;
    }
  }, [sessionId, messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages
  };
};

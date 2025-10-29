import { useEffect, useRef } from 'react';
import { Message } from '../types';
import { Bot, User } from 'lucide-react';

interface ConversationViewProps {
  messages: Message[];
  isLoading: boolean;
}

export const ConversationView = ({ messages, isLoading }: ConversationViewProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Bot className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-lg font-medium text-slate-700">Start your conversation</p>
        <p className="text-sm mt-2 text-slate-500">Use voice or type your message to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start space-x-4 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {message.role === 'assistant' && (
            <div className="flex-shrink-0 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
          )}

          <div
            className={`max-w-xs md:max-w-md lg:max-w-lg ${
              message.role === 'user' ? 'order-first' : ''
            }`}
          >
            <div
              className={`rounded-2xl px-5 py-4 ${
                message.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-900 border border-slate-200'
              }`}
            >
              <p className="text-sm md:text-base leading-relaxed">{message.content}</p>
            </div>
            <p className="text-xs text-slate-500 mt-2 px-1">
              {new Date(message.timestamp).toLocaleTimeString()}
            </p>
          </div>

          {message.role === 'user' && (
            <div className="flex-shrink-0 w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center order-last">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex items-start space-x-4 justify-start">
          <div className="flex-shrink-0 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce animation-delay-100" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce animation-delay-200" />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

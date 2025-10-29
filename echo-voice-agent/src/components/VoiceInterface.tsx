import { Mic, MicOff, Loader2, AlertCircle, Info } from 'lucide-react';
import { VoiceState } from '../types';

interface VoiceInterfaceProps {
  voiceState: VoiceState;
  onMicClick: () => void;
  onStopClick: () => void;
}

export const VoiceInterface = ({ voiceState, onMicClick, onStopClick }: VoiceInterfaceProps) => {
  const { isListening, isSpeaking, isProcessing, error } = voiceState;

  const getButtonState = () => {
    if (isProcessing) return 'processing';
    if (isListening) return 'listening';
    if (isSpeaking) return 'speaking';
    return 'idle';
  };

  const buttonState = getButtonState();

  const buttonStyles = {
    idle: 'bg-slate-900 hover:bg-slate-800',
    listening: 'bg-red-600 hover:bg-red-700 animate-pulse',
    processing: 'bg-slate-700',
    speaking: 'bg-green-600 hover:bg-green-700 animate-pulse'
  };

  const statusText = {
    idle: 'Click to start conversation',
    listening: 'Listening to your voice...',
    processing: 'Processing your request...',
    speaking: 'Echo is responding...'
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-8">
      {/* Voice Wave Visualization */}
      <div className="relative flex items-center justify-center">
        {/* Animated rings */}
        {(isListening || isSpeaking) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-slate-900 opacity-10 animate-ping" />
            <div className="absolute w-36 h-36 rounded-full bg-slate-700 opacity-10 animate-ping animation-delay-200" />
          </div>
        )}

        {/* Main microphone button */}
        <button
          onClick={isListening || isSpeaking ? onStopClick : onMicClick}
          disabled={isProcessing}
          className={`relative z-10 w-24 h-24 rounded-2xl ${buttonStyles[buttonState]} 
            shadow-xl transition-all duration-300 transform hover:scale-105 
            disabled:opacity-70 disabled:cursor-not-allowed
            flex items-center justify-center`}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : isListening || isSpeaking ? (
            <MicOff className="w-10 h-10 text-white" />
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}
        </button>
      </div>

      {/* Status text */}
      <div className="text-center">
        <p className="text-lg font-medium text-slate-900">
          {statusText[buttonState]}
        </p>
        {error && (
          <p className="text-sm text-red-600 mt-3 max-w-md bg-red-50 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}
      </div>

      {/* Voice activity indicator */}
      {isListening && (
        <div className="flex items-end space-x-1 h-8">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-slate-900 rounded-full animate-pulse"
              style={{
                height: `${16 + Math.random() * 24}px`,
                animationDelay: `${i * 80}ms`,
                animationDuration: '1000ms'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

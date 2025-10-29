import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { VoiceInterface } from './components/VoiceInterface';
import { ConversationView } from './components/ConversationView';
import { ControlPanel } from './components/ControlPanel';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { useVoice } from './hooks/useVoice';
import { useConversation } from './hooks/useConversation';
import { Send, Keyboard, BarChart3 } from 'lucide-react';
import './App.css';

function App() {
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const { voiceState, isSupported, startListening, stopListening, speak, stopSpeaking, setProcessing } = useVoice();
  const { messages, isLoading, sendMessage } = useConversation(sessionId);

  // Handle voice transcript
  const handleTranscript = useCallback(async (transcript: string) => {
    console.log('Transcript:', transcript);
    setProcessing(true);
    
    const response = await sendMessage(transcript);
    
    setProcessing(false);
    
    if (response) {
      // Speak the response
      speak(response.response);
      
      // Check if handoff is needed
      if (response.handoffNeeded) {
        setHandoffRequested(true);
      }
    }
  }, [sendMessage, speak, setProcessing]);

  // Handle microphone click
  const handleMicClick = () => {
    if (voiceState.isSpeaking) {
      stopSpeaking();
    }
    startListening(handleTranscript);
  };

  // Handle stop click
  const handleStopClick = () => {
    stopListening();
    stopSpeaking();
  };

  // Handle text input submit
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isLoading) return;

    const message = textInput.trim();
    setTextInput('');
    setProcessing(true);

    const response = await sendMessage(message);
    
    setProcessing(false);

    if (response) {
      speak(response.response);
      
      if (response.handoffNeeded) {
        setHandoffRequested(true);
      }
    }
  };

  // Handle handoff request
  const handleHandoffRequest = () => {
    setHandoffRequested(true);
    speak("I'm connecting you with a human agent now. They'll be with you shortly.");
  };

  // Show text input fallback if voice not supported
  useEffect(() => {
    if (!isSupported) {
      setShowTextInput(true);
    }
  }, [isSupported]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header sessionId={sessionId} />

      {/* View Toggle */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowAnalytics(false)}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              !showAnalytics
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Voice Agent
          </button>
          <button
            onClick={() => setShowAnalytics(true)}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
              showAnalytics
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      <main className="container mx-auto px-4 pb-8">
        {showAnalytics ? (
          /* Analytics Dashboard */
          <AnalyticsDashboard />
        ) : (
          /* Voice Agent Interface */
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                Where Consciousness Meets Technology
              </h1>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Echo delivers intelligent customer support through advanced AI voice technology, 
                understanding context and providing solutions in real-time.
              </p>
            </div>

            {/* Main Voice Interface */}
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-8">
              <VoiceInterface
                voiceState={voiceState}
                onMicClick={handleMicClick}
                onStopClick={handleStopClick}
              />

              {/* Toggle text input */}
              {!showTextInput && isSupported && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setShowTextInput(true)}
                    className="text-sm text-slate-500 hover:text-slate-700 flex items-center space-x-2 transition-colors"
                  >
                    <Keyboard className="w-4 h-4" />
                    <span>Use text input instead</span>
                  </button>
                </div>
              )}
            </div>

            {/* Conversation History */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">Conversation</h2>
                {messages.length > 0 && (
                  <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <ConversationView messages={messages} isLoading={isLoading} />

              {/* Text Input */}
              {showTextInput && (
                <form onSubmit={handleTextSubmit} className="mt-6">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type your message to Echo..."
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!textInput.trim() || isLoading}
                      className="px-8 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Control Panel */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
              <ControlPanel
                onHandoffRequest={handleHandoffRequest}
                handoffRequested={handoffRequested}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Echo AI Assistant</h3>
            <p className="text-slate-400 mb-4">Architected with in the Realm of Consciousness</p>
            <div className="flex items-center justify-center space-x-6 text-sm text-slate-400">
              <span>qualiasolutions.net</span>
              <span>•</span>
              <span>Production-Ready AI Voice Agent</span>
              <span>•</span>
              <span>Real-time Analytics</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

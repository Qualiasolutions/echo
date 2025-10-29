import { Volume2, Settings, Phone } from 'lucide-react';
import { useState } from 'react';

interface ControlPanelProps {
  onHandoffRequest: () => void;
  handoffRequested: boolean;
}

export const ControlPanel = ({ onHandoffRequest, handoffRequested }: ControlPanelProps) => {
  const [volume, setVolume] = useState(100);
  const [showSettings, setShowSettings] = useState(false);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    
    // Update speech synthesis volume
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel(); // Reset to apply new volume
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h3 className="text-xl font-semibold text-slate-900 mb-6">Audio Controls</h3>

        {/* Volume Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
              <Volume2 className="w-4 h-4" />
              <span>Output Volume</span>
            </label>
            <span className="text-sm font-medium text-slate-600">{volume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
          />
        </div>

        {/* Settings Section */}
        <div className="pt-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium text-slate-700">Voice Settings</span>
          </button>

          {showSettings && (
            <div className="mt-4 space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Language</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
                  <option value="en-US">English (United States)</option>
                  <option value="en-GB">English (United Kingdom)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="it-IT">Italian</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Speech Rate</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
                  <option value="0.75">Slow</option>
                  <option value="1.0" selected>Normal</option>
                  <option value="1.25">Fast</option>
                  <option value="1.5">Very Fast</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Human Handoff Section */}
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h3 className="text-xl font-semibold text-slate-900 mb-4">Human Support</h3>
        
        <button
          onClick={onHandoffRequest}
          disabled={handoffRequested}
          className={`w-full flex items-center justify-center space-x-3 px-6 py-4 rounded-xl font-medium transition-all ${
            handoffRequested
              ? 'bg-green-50 text-green-700 border-2 border-green-200 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl'
          }`}
        >
          <Phone className="w-5 h-5" />
          <span>{handoffRequested ? 'Agent Connected' : 'Connect to Human Agent'}</span>
        </button>

        {handoffRequested && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-sm text-green-700 text-center">
              A human agent has been notified and will join your conversation shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

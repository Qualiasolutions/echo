interface HeaderProps {
  sessionId: string;
}

export const Header = ({ sessionId }: HeaderProps) => {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Logo and Branding */}
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Echo
              </h1>
              <p className="text-sm text-slate-600 font-medium">Voice Agent</p>
            </div>
          </div>

          {/* Session Info */}
          <div className="hidden md:block text-right">
            <p className="text-sm text-slate-600">Session</p>
            <p className="text-sm font-mono text-slate-500">{sessionId.substring(0, 8)}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

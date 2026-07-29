import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBanner({ error, onRetry }) {
  if (!error) return null;

  return (
    <div className="bg-error/10 border border-error/50 rounded-lg p-4 flex items-center justify-between mb-6 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center gap-3 text-error">
        <AlertTriangle size={20} />
        <div>
          <h3 className="font-semibold">Network Connection Issue</h3>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      </div>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-error/20 hover:bg-error/30 text-error rounded-md transition-colors text-sm font-medium"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      )}
    </div>
  );
}

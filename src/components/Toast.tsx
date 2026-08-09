import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
  hasPlayer?: boolean;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, hasPlayer = false }) => {
  if (!message) return null;

  return (
    <div data-has-player={hasPlayer ? 'true' : 'false'} className="toast-banner fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/15 bg-[#28282e]/95 px-4 py-2.5 text-center text-xs font-bold text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200 select-none pointer-events-none sm:rounded-full">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D946EF]" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
};

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-4 py-2.5 bg-[#28282e]/95 text-white border border-white/15 rounded-full shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200 select-none text-xs font-bold pointer-events-none">
      <CheckCircle2 className="w-4 h-4 text-[#D946EF]" />
      <span>{message}</span>
    </div>
  );
};

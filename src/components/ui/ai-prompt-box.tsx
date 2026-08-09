import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, BrainCog, Globe, Sparkles, Square } from 'lucide-react';

interface AiPromptBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  webSearchEnabled: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  highReasoningEnabled: boolean;
  onHighReasoningChange: (enabled: boolean) => void;
  modelLabel?: string;
  className?: string;
}

const ToolDivider = () => <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden="true" />;

export const AiPromptBox = React.forwardRef<HTMLDivElement, AiPromptBoxProps>(({
  value,
  onValueChange,
  onSubmit,
  onCancel,
  isLoading = false,
  disabled = false,
  placeholder = 'Ask about music, artists, genres or your next playlist...',
  webSearchEnabled,
  onWebSearchChange,
  highReasoningEnabled,
  onHighReasoningChange,
  modelLabel = 'GPT-OSS 120B',
  className = '',
}, forwardedRef) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasContent = value.trim().length > 0;
  const controlsDisabled = disabled || isLoading;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [value]);

  const submit = () => {
    if (!hasContent || disabled || isLoading) return;
    onSubmit();
  };

  const activePlaceholder = webSearchEnabled && highReasoningEnabled
    ? 'Search the web and reason carefully...'
    : webSearchEnabled
      ? 'Search the web...'
      : highReasoningEnabled
        ? 'Ask with high reasoning...'
        : placeholder;

  return (
    <div
      ref={forwardedRef}
      className={`rounded-[24px] border bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-colors ${
        isLoading ? 'border-[#D946EF]/60' : 'border-white/10 focus-within:border-[#D946EF]/55'
      } ${className}`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        rows={1}
        maxLength={20_000}
        disabled={controlsDisabled}
        placeholder={isLoading ? 'AI DJ is responding...' : activePlaceholder}
        aria-label="Message AI DJ"
        className="custom-scrollbar min-h-11 max-h-[180px] w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-55"
      />

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => onWebSearchChange(!webSearchEnabled)}
            disabled={controlsDisabled}
            aria-pressed={webSearchEnabled}
            title="Search current web sources"
            className={`control-press flex h-8 flex-none items-center gap-1 overflow-hidden rounded-full border px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              webSearchEnabled
                ? 'border-[#D946EF]/55 bg-[#D946EF]/15 text-[#F0ABFC]'
                : 'border-transparent text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
            }`}
          >
            <motion.span
              animate={{ rotate: webSearchEnabled ? 360 : 0, scale: webSearchEnabled ? 1.06 : 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="flex h-5 w-5 items-center justify-center"
            >
              <Globe className="h-4 w-4" />
            </motion.span>
            <AnimatePresence initial={false}>
              {webSearchEnabled && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="overflow-hidden whitespace-nowrap text-[11px] font-black"
                >
                  Web search
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <ToolDivider />

          <button
            type="button"
            onClick={() => onHighReasoningChange(!highReasoningEnabled)}
            disabled={controlsDisabled}
            aria-pressed={highReasoningEnabled}
            title="Use NVIDIA high reasoning effort"
            className={`control-press flex h-8 flex-none items-center gap-1 overflow-hidden rounded-full border px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              highReasoningEnabled
                ? 'border-[#D946EF]/55 bg-[#D946EF]/15 text-[#F0ABFC]'
                : 'border-transparent text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
            }`}
          >
            <motion.span
              animate={{ rotate: highReasoningEnabled ? 360 : 0, scale: highReasoningEnabled ? 1.06 : 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="flex h-5 w-5 items-center justify-center"
            >
              <BrainCog className="h-4 w-4" />
            </motion.span>
            <AnimatePresence initial={false}>
              {highReasoningEnabled && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="overflow-hidden whitespace-nowrap text-[11px] font-black"
                >
                  High reasoning
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <span className="ml-1 hidden flex-none items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-600 sm:flex">
            <Sparkles className="h-3 w-3 text-[#D946EF]" /> {modelLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={isLoading ? onCancel : submit}
          disabled={!isLoading && (!hasContent || disabled)}
          aria-label={isLoading ? 'Cancel AI request' : 'Send message'}
          title={isLoading ? 'Cancel request' : 'Send message'}
          className={`control-press flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors ${
            isLoading || hasContent
              ? 'bg-[#D946EF] text-white hover:bg-[#C026D3]'
              : 'bg-white/5 text-zinc-600'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isLoading ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
});

AiPromptBox.displayName = 'AiPromptBox';

export default AiPromptBox;

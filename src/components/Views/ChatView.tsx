import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Sparkles, Play, Music, Globe, Search, ChevronDown, BrainCircuit } from 'lucide-react';
import { Track, ChatMessage, ReasoningTimelineEntry } from '../../types';
import { DEFAULT_AVATAR_URL } from '../../utils/profilePlaceholders';
import { AgentPlanning, type PlanStep } from '../ui/ai-planning';
import { AiPromptBox } from '../ui/ai-prompt-box';
import { Hero } from '../ui/tailwind-css-background-snippet';

interface ChatViewProps {
  messages: ChatMessage[];
  onUpdateMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onPlayTrack: (track: Track) => void;
  userId?: string;
  userAvatarUrl?: string;
  userDisplayName?: string;
}

type LiveChatActivity = {
  id: string;
  kind: 'model' | 'web_search';
  status: 'active' | 'success' | 'error';
  title: string;
  detail?: string;
  query?: string;
  resultCount?: number;
};

const AI_HIGH_DEMAND_MESSAGE = 'AI is in high demand right now. Please try again later.';

const createMessageId = (prefix: 'user' | 'ai' | 'err'): string => {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId}`;
};

// The NVIDIA API returns the model's real chain-of-thought as
// `reasoning_content`. That text is often long, raw, and not meant for an
// end user, so it's never shown as-is. Instead we condense each chunk down
// to a short, natural sentence or two — a user-facing gist of what the
// model was doing, not its literal internal monologue.
const summarizeReasoningChunk = (text: string, relatedAction = '', maxLength = 220): string => {
  const cleaned = text
    .replace(/<\/?(?:think|analysis)>/gi, ' ')
    .replace(/(?:^|\s)[*-]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  // Prefer sentences describing a decision, data check, calculation, search,
  // or response action. Raw reasoning often opens by merely restating what
  // the user said; showing only that sentence makes the summary misleading.
  const sentences = cleaned.split(/(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜ0-9])/).filter(Boolean);
  const actionPattern = /\b(?:need(?:s|ed)?|should|will|plan(?:s|ned)?|decid(?:e|ed|ing)|search(?:ed|ing)?|browse|look(?:ed|ing)? up|check(?:ed|ing)?|verif(?:y|ied|ying)|compar(?:e|ed|ing)|review(?:ed|ing)?|use(?:d|ing)?|calculat(?:e|ed|ing)|determin(?:e|ed|ing)|answer(?:ed|ing)?|respond(?:ed|ing)?|cite(?:d|ing)?|gerek(?:iyor|ti)?|arama|ara(?:yacağım|mak|dı|yor)|kontrol|doğrula|karşılaştır|incele|hesapla|belirle|yanıtla|cevapla|kullan)\b/i;
  const decisionPattern = /\b(?:so|therefore|because|however|instead|then|next|bu yüzden|dolayısıyla|çünkü|ancak|yerine|ardından|sonra)\b/i;
  const restatementPattern = /^(?:the\s+)?user\b|^kullanıcı\b/i;
  const scored = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: (actionPattern.test(sentence) ? 4 : 0)
      + (decisionPattern.test(sentence) ? 2 : 0)
      - (restatementPattern.test(sentence) ? 3 : 0),
  }));
  const selected = scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 2)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);
  const fallback = sentences.filter((sentence) => !restatementPattern.test(sentence)).slice(0, 2);
  let summary = (selected.length > 0 ? selected : fallback.length > 0 ? fallback : sentences.slice(0, 1)).join(' ') || cleaned;
  if (relatedAction && !/\b(?:search(?:ed|ing)?|web|arama|ara(?:dı|yor|mak))\b/i.test(summary)) {
    const contextLimit = Math.max(40, maxLength - relatedAction.length - 2);
    const context = summary.length > contextLimit
      ? `${summary.slice(0, contextLimit - 1).trimEnd()}…`
      : summary;
    summary = `${context} ${relatedAction}`;
  }

  if (summary.length > maxLength) {
    summary = `${summary.slice(0, maxLength - 1).trimEnd()}…`;
  } else if (!/[.!?…]$/.test(summary)) {
    summary = `${summary}…`;
  }
  return summary;
};

const reasoningStepContent = (summary: string) => (
  <div className="flex items-start gap-2 rounded-xl border border-[#D946EF]/15 bg-[#D946EF]/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400">
    <BrainCircuit className="mt-0.5 h-3.5 w-3.5 flex-none text-[#F0ABFC]" />
    <span>{summary}</span>
  </div>
);

const createReasonedStep = (id: string, summary: string): PlanStep => ({
  id,
  title: 'Reasoning',
  status: 'success',
  icon: <BrainCircuit className="h-3.5 w-3.5" />,
  content: reasoningStepContent(summary),
});

// Renders a real tool call as one activity line inside the thought flow.
const createToolActivitySteps = (id: string, entry: Extract<ReasoningTimelineEntry, { type: 'tool' }>): PlanStep[] => {
  if (entry.tool !== 'web_search') return [];
  const resultLabel = entry.resultCount > 0
    ? `Found ${entry.resultCount} source${entry.resultCount === 1 ? '' : 's'}`
    : 'No results found';

  return [
    {
      id: `${id}-search`,
      title: `Searched the web · ${resultLabel}`,
      status: 'success',
      icon: <Search className="h-3.5 w-3.5" />,
      content: (
        <div className="flex items-center gap-1.5 rounded-xl border border-[#D946EF]/15 bg-[#D946EF]/[0.06] px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
          <Search className="h-3 w-3 flex-none text-[#F0ABFC]" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">&ldquo;{entry.query}&rdquo;</span>
        </div>
      ),
    },
  ];
};

// Builds the "Reasoned" + tool-activity timeline shown under a completed
// message. Prefers the structured, chronological `reasoningTimeline` from
// the server; falls back to summarizing the flat `reasoning` string for
// older messages that don't have one.
const createRealReasoningSteps = (reasoningText: string, timeline?: ReasoningTimelineEntry[]): PlanStep[] => {
  if (timeline && timeline.length > 0) {
    const steps: PlanStep[] = [];
    timeline.forEach((entry, index) => {
      if (entry.type === 'reasoning') {
        const previousEntry = timeline[index - 1];
        const nextEntry = timeline[index + 1];
        const nextQuery = nextEntry?.type === 'tool'
          ? `${nextEntry.query.slice(0, 90)}${nextEntry.query.length > 90 ? '…' : ''}`
          : '';
        const previousQuery = previousEntry?.type === 'tool'
          ? `${previousEntry.query.slice(0, 90)}${previousEntry.query.length > 90 ? '…' : ''}`
          : '';
        const relatedAction = nextEntry?.type === 'tool' && nextEntry.tool === 'web_search'
          ? `I then searched the live web for “${nextQuery}”.`
          : previousEntry?.type === 'tool' && previousEntry.tool === 'web_search'
            ? `I used the live results for “${previousQuery}” to prepare the answer.`
            : '';
        const summary = summarizeReasoningChunk(entry.text, relatedAction);
        if (summary) steps.push(createReasonedStep(`reasoned-${index}`, summary));
      } else {
        steps.push(...createToolActivitySteps(`tool-${index}`, entry));
      }
    });
    if (steps.length > 0) return steps;
  }

  const chunks = reasoningText
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const rawSteps = chunks.length > 0 ? chunks : [reasoningText.trim()];

  return rawSteps
    .map((chunk) => summarizeReasoningChunk(chunk))
    .filter(Boolean)
    .map((summary, index) => createReasonedStep(`reasoning-${index}`, summary));
};

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onUpdateMessages,
  onPlayTrack,
  userId,
  userAvatarUrl,
  userDisplayName,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [quotaNotice, setQuotaNotice] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [highReasoningEnabled, setHighReasoningEnabled] = useState(false);
  const [liveActivities, setLiveActivities] = useState<LiveChatActivity[]>([]);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRequestAbortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, liveActivities]);
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timeout = window.setTimeout(() => {
      setRateLimitSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearTimeout(timeout);
  }, [rateLimitSeconds]);

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const suggestionPrompts = [
    { label: 'New releases', prompt: 'Recommend some exciting new music releases ✨' },
    { label: 'Night drive', prompt: 'Recommend synthwave tracks for night driving 🌙' },
    { label: 'Study mix', prompt: 'Suggest a lofi playlist for studying 📚' },
    { label: 'Genre guide', prompt: 'Explain the difference between Synthwave and Cyberpunk ⚡' },
  ];

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading || rateLimitSeconds > 0) return;

    const userMsg: ChatMessage = {
      id: createMessageId('user'),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    onUpdateMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput('');
    const webSearchForced = webSearchEnabled;
    const highReasoningRequested = highReasoningEnabled;
    setWebSearchEnabled(false);
    setHighReasoningEnabled(false);
    setLiveActivities([]);
    setIsLoading(true);
    const requestController = new AbortController();
    chatRequestAbortRef.current = requestController;

    try {
      // Build conversation history for API
      const historyPayload = messages
        .filter((message) => !(
          message.sender === 'ai'
          && (message.isError === true || /^(?:⚠️|⏳)/.test(message.text))
        ))
        .slice(-20)
        .map((message) => ({
          role: message.sender === 'user' ? 'user' : 'assistant',
          text: message.text.slice(0, 8_000),
        }));

      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: textToSend.trim(),
          history: historyPayload,
          userId,
          forceWebSearch: webSearchForced,
          reasoningEffort: highReasoningRequested ? 'high' : 'medium',
          streamActivity: true,
        }),
        signal: requestController.signal,
      });

      const createResponseError = (payload: any) => {
        const responseError = new Error(payload?.error || 'Failed to communicate with AI');
        (responseError as any).rateLimited = !!payload?.rateLimited;
        (responseError as any).quotaExhausted = !!payload?.quotaExhausted;
        (responseError as any).configurationError = !!payload?.configurationError;
        (responseError as any).retryAfterSeconds = Number(payload?.retryAfterSeconds || res.headers.get('Retry-After') || 0);
        return responseError;
      };

      let data: any = {};
      const isActivityStream = res.headers.get('Content-Type')?.includes('application/x-ndjson') === true;

      if (res.ok && isActivityStream) {
        if (!res.body) throw new Error('The AI activity stream was unavailable.');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processEventLine = (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line);
          if (event?.type === 'activity' && event.activity?.id) {
            const activity = event.activity as LiveChatActivity;
            setLiveActivities((current) => {
              const existingIndex = current.findIndex((item) => item.id === activity.id);
              if (existingIndex < 0) return [...current, activity];
              return current.map((item, index) => index === existingIndex ? { ...item, ...activity } : item);
            });
          } else if (event?.type === 'result') {
            data = event.data || {};
          } else if (event?.type === 'error') {
            throw createResponseError(event);
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          lines.forEach(processEventLine);
          if (done) {
            if (buffer.trim()) processEventLine(buffer);
            break;
          }
        }
      } else {
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        throw createResponseError(data);
      }

      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('The AI provider returned no text response.');
      }
      const aiReplyText = data.reply.trim();

      const aiMsg: ChatMessage = {
        id: createMessageId('ai'),
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toISOString(),
        webSearchUsed: !!data.webSearchUsed,
        searchProvider: data.searchProvider === 'tavily' ? 'tavily' : undefined,
        reasoningEffort: data.reasoningEffort === 'high' ? 'high' : 'medium',
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : undefined,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
        reasoning: typeof data.reasoning === 'string' && data.reasoning.trim() ? data.reasoning.trim() : undefined,
        reasoningTimeline: Array.isArray(data.reasoningTimeline) ? data.reasoningTimeline : undefined,
        thinkingSeconds: Number.isFinite(data.thinkingSeconds) ? Number(data.thinkingSeconds) : undefined,
      };

      onUpdateMessages((prev) => [...prev, aiMsg]);
      setQuotaNotice('');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        const cancelledMsg: ChatMessage = {
          id: createMessageId('err'),
          sender: 'ai',
          text: 'Request cancelled.',
          timestamp: new Date().toISOString(),
          isError: true,
        };
        onUpdateMessages((prev) => [...prev, cancelledMsg]);
        return;
      }
      console.error('AI chat request failed.');
      const isRateLimited = !!err?.rateLimited;
      const retryAfterSeconds = Math.max(0, Math.min(300, Math.ceil(Number(err?.retryAfterSeconds || 0))));
      if (isRateLimited) {
        setRateLimitSeconds(retryAfterSeconds || 15);
        if (err?.quotaExhausted) setQuotaNotice(AI_HIGH_DEMAND_MESSAGE);
      }
      const errorMsg: ChatMessage = {
        id: createMessageId('err'),
        sender: 'ai',
        text: typeof err?.message === 'string' && (err.configurationError || !isRateLimited)
          ? err.message
          : AI_HIGH_DEMAND_MESSAGE,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      onUpdateMessages((prev) => [...prev, errorMsg]);
    } finally {
      if (chatRequestAbortRef.current === requestController) chatRequestAbortRef.current = null;
      setIsLoading(false);
    }
  };

  const handleCancelRequest = () => {
    chatRequestAbortRef.current?.abort();
  };

  const handleClearHistory = async () => {
    const previousMessages = messages;
    onUpdateMessages([]);
    setExpandedSources({});

    if (!userId) {
      return;
    }

    try {
      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`/api/chat-history/${userId}`, { method: 'DELETE', headers });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `History clear failed (${response.status})`);
      }
    } catch (err) {
      console.error('Error clearing remote chat history:', err);
      onUpdateMessages((currentMessages) => (
        currentMessages.length === 0 ? previousMessages : currentMessages
      ));
    }
  };

  // Basic markdown bold formatter parser
  const renderFormattedText = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*|\n)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-bold text-[#E879F9]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part === '\n') {
        return <br key={idx} />;
      }
      return part;
    });
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const liveReasoningSteps: PlanStep[] = liveActivities.map((activity) => {
    const ActivityIcon = activity.kind === 'web_search' ? Search : BrainCircuit;
    const detail = activity.kind === 'web_search' && activity.status === 'success'
      ? `${activity.resultCount ?? 0} live source${activity.resultCount === 1 ? '' : 's'} returned for “${activity.query || activity.detail || ''}”.`
      : activity.detail;

    return {
      id: activity.id,
      title: activity.title,
      status: activity.status,
      duration: activity.status === 'success' ? 'Done' : activity.status === 'active' ? 'Now' : undefined,
      icon: <ActivityIcon className="h-3.5 w-3.5" />,
      defaultExpanded: activity.status === 'active',
      content: detail ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#D946EF]/15 bg-[#D946EF]/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400">
          <ActivityIcon className={`mt-0.5 h-3.5 w-3.5 flex-none text-[#F0ABFC] ${
            activity.status === 'active' ? 'animate-pulse' : ''
          }`} />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{detail}</span>
        </div>
      ) : undefined,
    };
  });

  return (
    <section className="workspace-screen flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#121212] text-white select-none md:rounded-3xl">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Hero />
          <div className="custom-scrollbar relative z-10 h-full min-h-0 space-y-4 overflow-y-auto px-3 py-4 overscroll-contain sm:px-5 sm:py-4 lg:px-6">
          {messages.length === 0 && !isLoading && (
            <div className="flex min-h-full items-center justify-center py-5 sm:py-8">
              <div className="max-w-lg text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D946EF]/30 bg-[#D946EF]/10 text-[#F0ABFC] shadow-[0_18px_50px_rgba(217,70,239,0.12)] sm:h-16 sm:w-16 sm:rounded-3xl">
                  <Bot className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <p className="mt-4 text-[9px] font-black uppercase tracking-[0.18em] text-[#D8B4FE] sm:mt-5 sm:text-[10px] sm:tracking-[0.22em]">VERTEX Music intelligence</p>
                <h2 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">What should we listen to?</h2>
                <p className="mx-auto mt-2 max-w-md px-3 text-xs leading-relaxed text-zinc-500 sm:px-0 sm:text-sm">
                  Ask about artists and genres, discover music, or build a listening plan.
                </p>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.26, ease: 'easeOut' }}
                className={`flex items-start gap-2 sm:gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-md sm:h-9 sm:w-9 sm:rounded-2xl ${
                    msg.sender === 'user'
                      ? 'border-white/20 bg-[#242424]'
                      : 'border-[#D946EF]/40 bg-[#D946EF] text-white'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <img
                      key={userAvatarUrl || DEFAULT_AVATAR_URL}
                      src={userAvatarUrl || DEFAULT_AVATAR_URL}
                      alt={userDisplayName ? `${userDisplayName}'s profile` : 'Your profile'}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = DEFAULT_AVATAR_URL;
                      }}
                    />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={`max-w-[calc(100%_-_40px)] rounded-2xl border p-3 text-[13px] leading-relaxed shadow-lg sm:max-w-[76%] sm:rounded-2xl sm:p-4 sm:text-[13px] ${
                    msg.sender === 'user'
                      ? 'rounded-tr-md border-[#F0ABFC]/25 bg-[#D946EF] text-white'
                      : 'rounded-tl-md border-white/[0.08] bg-[#202020] text-zinc-100'
                  }`}
                >
                  {msg.sender === 'ai' && (Boolean(msg.reasoning?.trim()) || Boolean(msg.reasoningTimeline?.length)) && (
                    <AgentPlanning
                      title={typeof msg.thinkingSeconds === 'number' ? `Thought for ${msg.thinkingSeconds}s` : 'How this answer was prepared'}
                      steps={createRealReasoningSteps(msg.reasoning || '', msg.reasoningTimeline)}
                      defaultExpanded={false}
                      className="mb-3"
                    />
                  )}

                  {msg.sender === 'ai' && msg.webSearchUsed && (
                    <div className="mb-3">
                      <button
                        onClick={() => toggleSources(msg.id)}
                        className="control-press flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 hover:bg-emerald-500/15"
                      >
                        <Globe className="h-3 w-3" />
                        Web Search{msg.sources?.length ? ` · ${msg.sources.length} sources` : ''}
                        <ChevronDown className={`h-3 w-3 transition-transform ${expandedSources[msg.id] ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {expandedSources[msg.id] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 space-y-3 rounded-2xl border border-white/[0.08] bg-black/25 p-3">
                              {msg.searchQueries && msg.searchQueries.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {msg.searchQueries.map((query, index) => (
                                    <span key={index} className="flex max-w-full items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-300">
                                      <Search className="h-2.5 w-2.5 shrink-0" /> <span className="min-w-0 break-words [overflow-wrap:anywhere]">{query}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {msg.sources && msg.sources.length > 0 && (
                                <div className="space-y-1.5">
                                  {msg.sources.map((source, index) => (
                                    <a
                                      key={index}
                                      href={source.uri}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-[#E879F9]"
                                    >
                                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                                      <span className="truncate">{source.title}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className={`min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${msg.sender === 'ai' ? 'text-[14px]' : ''}`}>{renderFormattedText(msg.text)}</div>

                  {msg.matchedTracks && msg.matchedTracks.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#D8B4FE]">
                        <Music className="h-3.5 w-3.5" /> Tracks from your library
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {msg.matchedTracks.map((track) => (
                          <button
                            key={track.id}
                            data-track-id={track.id}
                            data-context-type="track"
                            onClick={() => onPlayTrack(track)}
                            className="control-press group flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-2.5 text-left hover:border-[#A855F7]/35 hover:bg-black/30"
                          >
                            <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black text-white group-hover:text-[#E879F9]">{track.title}</span>
                              <span className="block truncate text-xs text-zinc-500">{track.artist}</span>
                            </span>
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-black">
                              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className={`mt-3 block text-right text-[9px] font-bold ${msg.sender === 'user' ? 'text-white/60' : 'text-zinc-600'}`}>
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-start gap-2 sm:gap-3"
              >
                <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-[#D946EF] text-white shadow-md">
                  <Bot className="h-4 w-4" />
                  <span className="absolute -inset-1 animate-ping rounded-2xl border border-[#D946EF]/35" />
                </div>
                <div className="min-w-0 max-w-[calc(100%_-_40px)] flex-1 sm:max-w-lg sm:flex-none">
                  {liveReasoningSteps.length > 0 ? (
                    <AgentPlanning title="Reasoning" steps={liveReasoningSteps} />
                  ) : (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#202020] px-4 py-3 text-[13px] font-black text-zinc-300">
                      Reasoning
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>

        {messages.length === 0 && (
          <div className="custom-scrollbar flex flex-shrink-0 gap-2 overflow-x-auto border-t border-white/[0.06] px-3 pt-2.5 sm:px-6 sm:pt-3">
            {suggestionPrompts.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSendMessage(suggestion.prompt)}
                disabled={isLoading || rateLimitSeconds > 0}
                className="control-press flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[11px] font-bold text-zinc-400 hover:border-[#A855F7]/30 hover:bg-[#A855F7]/10 hover:text-white disabled:opacity-40 sm:h-auto sm:py-1.5"
              >
                <Sparkles className="h-3 w-3 text-[#D946EF]" />
                <span className="md:hidden">{suggestion.label}</span>
                <span className="hidden md:inline">{suggestion.prompt}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-shrink-0 border-t border-white/[0.06] p-2.5 sm:p-3 md:border-t-0">
          {quotaNotice && (
            <div className="mb-2 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2.5 text-[11px] leading-relaxed text-amber-100">
              <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
              <span>
                {quotaNotice}
                {rateLimitSeconds > 0 && ` Requests are paused for ${rateLimitSeconds}s to prevent repeated failures.`}
              </span>
            </div>
          )}
          <AiPromptBox
            value={input}
            onValueChange={setInput}
            onSubmit={() => handleSendMessage()}
            onCancel={handleCancelRequest}
            onClear={handleClearHistory}
            canClear={messages.length > 0}
            isLoading={isLoading}
            disabled={rateLimitSeconds > 0}
            placeholder={rateLimitSeconds > 0
              ? `AI paused · retry in ${rateLimitSeconds}s`
              : 'Ask about music, artists, genres or your next playlist...'}
            webSearchEnabled={webSearchEnabled}
            onWebSearchChange={setWebSearchEnabled}
            highReasoningEnabled={highReasoningEnabled}
            onHighReasoningChange={setHighReasoningEnabled}
          />
          <p className="mt-2 hidden px-2 text-center text-[9px] font-medium text-zinc-600 sm:block">
            AI responses can be inaccurate. Verify important music and artist information.
          </p>
        </div>
      </div>
    </section>
  );
};

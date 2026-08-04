import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, Sparkles, User, Play, Trash2, Music, Globe, Search, ChevronDown, BrainCircuit } from 'lucide-react';
import { Track, Playlist, ChatMessage } from '../../types';

interface ChatViewProps {
  playlists: Playlist[];
  messages: ChatMessage[];
  onUpdateMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onPlayTrack: (track: Track) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onTrackAdded?: (track: Track) => void;
  userId?: string;
}

// Generic pending-state labels. They deliberately avoid claiming that a
// specific backend operation is currently happening because this endpoint
// does not stream internal execution stages to the client.
const THINKING_PHASES = [
  { text: 'Processing your request...', Icon: BrainCircuit },
  { text: 'Preparing a response...', Icon: Sparkles },
];

const AI_HIGH_DEMAND_MESSAGE = 'AI is in high demand right now. Please try again later.';

const createMessageId = (prefix: 'user' | 'ai' | 'err'): string => {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId}`;
};

export const ChatView: React.FC<ChatViewProps> = ({
  playlists,
  messages,
  onUpdateMessages,
  onPlayTrack,
  onSelectPlaylist,
  onTrackAdded,
  userId,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [quotaNotice, setQuotaNotice] = useState('');
  const [thinkingPhaseIdx, setThinkingPhaseIdx] = useState(0);
  const [showAiGenPanel, setShowAiGenPanel] = useState(false);
  const [aiGenPrompt, setAiGenPrompt] = useState('Chill lofi beat with rainy atmosphere and soft piano');
  const [aiGenModel, setAiGenModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>('lyria-3-clip-preview');
  const [isGeneratingTrack, setIsGeneratingTrack] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, showAiGenPanel]);

  // Cycle through the "thinking" status phases while a request is pending.
  useEffect(() => {
    if (!isLoading) {
      setThinkingPhaseIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingPhaseIdx((i) => Math.min(i + 1, THINKING_PHASES.length - 1));
    }, 950);
    return () => clearInterval(interval);
  }, [isLoading]);

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
    { label: '30s synthwave', prompt: '✨ Generate a 30s synthwave beat with heavy bass 🎧' },
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
    setIsLoading(true);

    try {
      // Build conversation history for API
      const historyPayload = messages
        .filter((message) => !(message.sender === 'ai' && /^(?:⚠️|⏳)/.test(message.text)))
        .slice(-20)
        .map((message) => ({
          role: message.sender === 'user' ? 'user' : 'model',
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
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = new Error(data.error || 'Failed to communicate with AI');
        (err as any).rateLimited = !!data.rateLimited;
        (err as any).quotaExhausted = !!data.quotaExhausted;
        (err as any).retryAfterSeconds = Number(data.retryAfterSeconds || res.headers.get('Retry-After') || 0);
        throw err;
      }

      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('The AI provider returned no text response.');
      }
      const aiReplyText = data.reply.trim();
      const matched: Track[] = [];

      if (data.generatedTrack) {
        onTrackAdded?.(data.generatedTrack);
        if (!matched.some((t) => t.id === data.generatedTrack.id)) {
          matched.unshift(data.generatedTrack);
        }
      }

      const aiMsg: ChatMessage = {
        id: createMessageId('ai'),
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toISOString(),
        matchedTracks: matched.length > 0 ? matched : undefined,
        webSearchUsed: !!data.webSearchUsed,
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : undefined,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
      };

      onUpdateMessages((prev) => [...prev, aiMsg]);
      setQuotaNotice('');
    } catch (err: any) {
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
        text: AI_HIGH_DEMAND_MESSAGE,
        timestamp: new Date().toISOString(),
      };
      onUpdateMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectGenerateMusic = async (overridePrompt?: string) => {
    const promptToUse = overridePrompt || aiGenPrompt;
    if (!promptToUse.trim() || isGeneratingTrack) return;

    setIsGeneratingTrack(true);
    const userMsg: ChatMessage = {
      id: createMessageId('user'),
      sender: 'user',
      text: `🎵 AI Music Generation request: "${promptToUse}"`,
      timestamp: new Date().toISOString(),
    };
    onUpdateMessages((prev) => [...prev, userMsg]);

    try {
      const token = localStorage.getItem('vertex_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: promptToUse.trim(),
          model: aiGenModel,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.audioUrl || !Number.isFinite(Number(data.duration))) {
        throw new Error(data.error || 'The provider returned no valid playable audio.');
      }

      const generatedTitle = String(data.suggestedTitle || promptToUse).trim().slice(0, 160);
      const createResponse = await fetch('/api/tracks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          title: generatedTitle,
          album: 'Single',
          releaseType: 'SINGLE',
          releaseTitle: generatedTitle,
          releaseId: crypto.randomUUID(),
          genre: '',
          duration: Number(data.duration),
          audioUrl: data.audioUrl,
        }),
      });
      const createData = await createResponse.json();
      if (!createResponse.ok || !createData.success || !createData.track) {
        throw new Error(createData.error || 'Generated audio could not be saved as a real track.');
      }

      const newTrack: Track = createData.track;
      onTrackAdded?.(newTrack);

      const aiMsg: ChatMessage = {
        id: createMessageId('ai'),
        sender: 'ai',
        text: `✨ **AI Music Composed with Lyria-3!**\n\nI've generated a custom audio track based on your prompt: **"${newTrack.title}"**. Click play below to listen immediately or find it in your Music Library.`,
        timestamp: new Date().toISOString(),
        matchedTracks: [newTrack],
      };
      onUpdateMessages((prev) => [...prev, aiMsg]);
      setShowAiGenPanel(false);
    } catch {
      console.error('AI music generation request failed.');
      const errorMsg: ChatMessage = {
        id: createMessageId('err'),
        sender: 'ai',
        text: AI_HIGH_DEMAND_MESSAGE,
        timestamp: new Date().toISOString(),
      };
      onUpdateMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGeneratingTrack(false);
    }
  };

  const handleClearHistory = async () => {
    if (!userId) {
      onUpdateMessages([]);
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
      onUpdateMessages([]);
    } catch (err) {
      console.error('Error clearing remote chat history:', err);
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

  const ActivePhase = THINKING_PHASES[thinkingPhaseIdx];

  return (
    <section className="workspace-screen mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_38%),#121212] text-white select-none md:bg-[#121212]">
      <header className="workspace-header flex flex-shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:items-start sm:gap-4 sm:px-0 sm:pb-5 sm:pt-0">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#A855F7] to-[#D946EF] shadow-[0_12px_34px_rgba(168,85,247,0.28)] sm:h-12 sm:w-12 sm:rounded-2xl">
            <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#121212] bg-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 hidden items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#D8B4FE] sm:flex">
              <Sparkles className="h-3.5 w-3.5" /> Intelligent listening
            </div>
            <h1 className="truncate text-lg font-black tracking-tight sm:text-3xl">AI DJ Chat</h1>
            <div className="mt-0.5 hidden flex-wrap items-center gap-2 text-xs text-zinc-400 sm:flex">
              <span>Recommendations, music knowledge and AI composition.</span>
              <span className="hidden items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300 sm:flex">
                <Globe className="h-2.5 w-2.5" /> Web search ready
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowAiGenPanel((open) => !open)}
            className={`control-press flex h-11 w-11 items-center justify-center gap-2 rounded-2xl border text-xs font-black transition-colors sm:h-10 sm:w-auto sm:px-4 ${
              showAiGenPanel
                ? 'border-[#D946EF]/60 bg-[#D946EF]/20 text-white'
                : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
            }`}
          >
            <Sparkles className="h-4 w-4 text-[#E879F9]" />
            <span className="hidden sm:inline">Generate music</span>
          </button>
          <button
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            className="control-press flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-35 sm:h-10 sm:w-10 sm:rounded-full"
            title="Clear chat history"
            aria-label="Clear chat history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {showAiGenPanel && (
          <motion.section
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="custom-scrollbar max-h-[46dvh] overflow-y-auto border-b border-[#A855F7]/30 bg-gradient-to-r from-[#211827] to-[#181818] p-3 shadow-xl sm:mt-5 sm:max-h-none sm:rounded-3xl sm:border sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#E879F9]">
                        <Music className="h-4 w-4" /> Lyria composer
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">Describe the sound, mood and instruments you want.</p>
                    </div>
                    <div className="grid w-full grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1 sm:flex sm:w-auto">
                      <button
                        onClick={() => setAiGenModel('lyria-3-clip-preview')}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition-colors ${
                          aiGenModel === 'lyria-3-clip-preview'
                            ? 'bg-white text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        30s Clip
                      </button>
                      <button
                        onClick={() => setAiGenModel('lyria-3-pro-preview')}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition-colors ${
                          aiGenModel === 'lyria-3-pro-preview'
                            ? 'bg-white text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Full Track
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={aiGenPrompt}
                    onChange={(event) => setAiGenPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleDirectGenerateMusic();
                    }}
                    placeholder="Upbeat synthwave with heavy bass and ambient pads"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#C084FC]/70 focus:bg-black/30 focus:ring-4 focus:ring-[#A855F7]/10"
                  />
                </div>
                <button
                  disabled={isGeneratingTrack || !aiGenPrompt.trim()}
                  onClick={() => handleDirectGenerateMusic()}
                  className="control-press flex h-12 w-full flex-shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] px-6 text-xs font-black text-white shadow-[0_14px_36px_rgba(168,85,247,0.24)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 md:w-auto"
                >
                  {isGeneratingTrack ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Composing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Compose track
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="workspace-card flex min-h-0 flex-1 flex-col overflow-hidden border-white/10 bg-[#171717] shadow-2xl sm:mt-5 sm:rounded-3xl sm:border">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Conversation</span>
          </div>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-500">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 overscroll-contain sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
          {messages.length === 0 && !isLoading && (
            <div className="flex min-h-full items-center justify-center py-5 sm:py-8">
              <div className="max-w-lg text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#A855F7]/30 bg-gradient-to-br from-[#A855F7]/25 to-[#D946EF]/10 text-[#E879F9] shadow-[0_18px_50px_rgba(168,85,247,0.14)] sm:h-16 sm:w-16 sm:rounded-3xl">
                  <Bot className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <p className="mt-4 text-[9px] font-black uppercase tracking-[0.18em] text-[#D8B4FE] sm:mt-5 sm:text-[10px] sm:tracking-[0.22em]">VERTEX Music intelligence</p>
                <h2 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">What should we listen to?</h2>
                <p className="mx-auto mt-2 max-w-md px-3 text-xs leading-relaxed text-zinc-500 sm:px-0 sm:text-sm">
                  Ask about artists and genres, get listening ideas, or create a new track with AI.
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
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border shadow-md sm:h-9 sm:w-9 sm:rounded-2xl ${
                    msg.sender === 'user'
                      ? 'border-white/20 bg-white text-black'
                      : 'border-[#D946EF]/30 bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-white'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div
                  className={`max-w-[calc(100%_-_40px)] rounded-2xl border p-3 text-[13px] leading-relaxed shadow-lg sm:max-w-[78%] sm:rounded-3xl sm:p-5 sm:text-sm ${
                    msg.sender === 'user'
                      ? 'rounded-tr-md border-[#D946EF]/30 bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-white'
                      : 'rounded-tl-md border-white/[0.08] bg-[#202020] text-zinc-100'
                  }`}
                >
                  {msg.sender === 'ai' && msg.webSearchUsed && (
                    <div className="mb-3">
                      <button
                        onClick={() => toggleSources(msg.id)}
                        className="control-press flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 hover:bg-emerald-500/15"
                      >
                        <Globe className="h-3 w-3" />
                        Web search{msg.sources?.length ? ` · ${msg.sources.length} sources` : ''}
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
                                    <span key={index} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-300">
                                      <Search className="h-2.5 w-2.5" /> {query}
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

                  <div className="whitespace-pre-wrap">{renderFormattedText(msg.text)}</div>

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
                <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-white shadow-md">
                  <Bot className="h-4 w-4" />
                  <span className="absolute -inset-1 animate-ping rounded-2xl border border-[#D946EF]/35" />
                </div>
                <div className="relative flex min-w-0 max-w-[calc(100%_-_40px)] flex-1 items-center gap-2 overflow-hidden rounded-2xl rounded-tl-md border border-white/[0.08] bg-[#202020] px-4 py-3 sm:max-w-sm sm:flex-none sm:gap-3 sm:rounded-3xl sm:px-5 sm:py-3.5 md:min-w-[220px]">
                  <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={thinkingPhaseIdx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="relative z-10 flex items-center gap-2"
                    >
                      <ActivePhase.Icon className="h-4 w-4 animate-pulse text-[#E879F9]" />
                      <span className="text-xs font-bold text-zinc-300">{ActivePhase.text}</span>
                    </motion.div>
                  </AnimatePresence>
                  <span className="relative z-10 ml-auto flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D946EF]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D946EF] [animation-delay:0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D946EF] [animation-delay:0.3s]" />
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 2 && (
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

        <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#141414] p-2.5 sm:p-4 md:border-t-0">
          {quotaNotice && (
            <div className="mb-2 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2.5 text-[11px] leading-relaxed text-amber-100">
              <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
              <span>
                {quotaNotice}
                {rateLimitSeconds > 0 && ` Requests are paused for ${rateLimitSeconds}s to prevent repeated failures.`}
              </span>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-1.5 transition-all focus-within:border-[#C084FC]/60 focus-within:bg-white/[0.06] focus-within:ring-4 focus-within:ring-[#A855F7]/10 sm:p-2"
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={rateLimitSeconds > 0 ? `Gemini paused · retry in ${rateLimitSeconds}s` : 'Ask about music, artists, genres or your next playlist...'}
              disabled={isLoading || rateLimitSeconds > 0}
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 disabled:opacity-50 sm:px-3"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || rateLimitSeconds > 0}
            className="control-press flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#A855F7] to-[#D946EF] text-white shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 sm:h-10 sm:w-10 sm:rounded-xl"
              aria-label="Send message"
            >
              <Send className="ml-0.5 h-4 w-4 fill-current" />
            </button>
          </form>
          <p className="mt-2 hidden px-2 text-center text-[9px] font-medium text-zinc-600 sm:block">
            AI responses can be inaccurate. Verify important music and artist information.
          </p>
        </div>
      </div>
    </section>
  );
};

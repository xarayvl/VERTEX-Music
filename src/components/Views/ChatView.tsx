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
  { text: 'İstek işleniyor...', Icon: BrainCircuit },
  { text: 'Model yanıt hazırlıyor...', Icon: Sparkles },
];

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

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const suggestionPrompts = [
    '✨ Generate a 30s synthwave beat with heavy bass 🎧',
    'Recommend synthwave tracks for night driving 🌙',
    'Suggest a lofi playlist for studying 📚',
    'Explain the difference between Synthwave and Cyberpunk ⚡',
  ];

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading) return;

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
      const historyPayload = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
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

      const data = await res.json();

      if (!res.ok) {
        const err = new Error(data.error || 'Failed to communicate with AI');
        (err as any).rateLimited = !!data.rateLimited;
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
    } catch (err: any) {
      console.error('Chat error:', err);
      const isRateLimited = !!err?.rateLimited;
      const errorMsg: ChatMessage = {
        id: createMessageId('err'),
        sender: 'ai',
        text: isRateLimited
          ? `⏳ ${err.message}`
          : `⚠️ Sorry, I encountered an issue: ${err.message || 'Unable to reach VERTEX Music AI server'}. Please try asking again!`,
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
    } catch (err: any) {
      console.error('AI Music Gen Error:', err);
      const errorMsg: ChatMessage = {
        id: createMessageId('err'),
        sender: 'ai',
        text: `⚠️ Lyria AI Music Generation Error: ${err.message || 'Could not compose track.'}`,
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
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto select-none">
      {/* Top Header Card */}
      <div className="relative flex items-center justify-between p-4 bg-[#181818]/90 backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-2xl mb-4 flex-shrink-0 overflow-hidden">
        <div
          className="pointer-events-none absolute -inset-24 opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle at 20% 20%, #A855F7, transparent 60%), radial-gradient(circle at 80% 80%, #D946EF, transparent 60%)' }}
        />
        <div className="relative flex items-center space-x-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#A855F7] to-[#D946EF] p-[2px] shadow-lg shadow-[#A855F7]/30">
            <div className="w-full h-full rounded-full bg-[#181818] flex items-center justify-center relative">
              <Bot className="w-5 h-5 text-[#E9D5FF]" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#181818] animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold text-white tracking-tight">VERTEX Music AI DJ</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/40 text-[#C084FC] text-[10px] font-bold uppercase tracking-wider">
                Gemini 3.5 Flash Lite + LYRIA AI
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                <Globe className="w-2.5 h-2.5" />
                Live Web Search
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Ask for recommendations, playlist ideas & generate AI music</p>
          </div>
        </div>

        <div className="relative flex items-center space-x-2">
          <button
            onClick={() => setShowAiGenPanel(!showAiGenPanel)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center space-x-1.5 transition-all shadow ${
              showAiGenPanel
                ? 'bg-[#D946EF] border-[#D946EF] text-white shadow-[#D946EF]/20'
                : 'bg-[#A855F7]/20 border-[#A855F7]/40 text-[#C084FC] hover:bg-[#A855F7]/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Music</span>
          </button>

          <button
            onClick={handleClearHistory}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lyria AI Music Generator Panel */}
      {showAiGenPanel && (
        <div className="mb-4 p-4 bg-[#201c29] border border-[#A855F7]/40 rounded-2xl shadow-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#D946EF]">
              <Sparkles className="w-4 h-4" />
              <span>Lyria AI Music Composer</span>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => setAiGenModel('lyria-3-clip-preview')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all ${
                  aiGenModel === 'lyria-3-clip-preview'
                    ? 'bg-[#D946EF] text-white'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                30s Clip
              </button>
              <button
                onClick={() => setAiGenModel('lyria-3-pro-preview')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all ${
                  aiGenModel === 'lyria-3-pro-preview'
                    ? 'bg-[#D946EF] text-white'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                Full Track
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={aiGenPrompt}
              onChange={(e) => setAiGenPrompt(e.target.value)}
              placeholder="e.g. Upbeat synthwave beat with heavy bassline and ambient pads"
              className="flex-1 px-3 py-2 bg-[#181818] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
            />
            <button
              disabled={isGeneratingTrack}
              onClick={() => handleDirectGenerateMusic()}
              className="px-4 py-2 bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
            >
              {isGeneratingTrack ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Composing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Compose</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar min-h-0 mb-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className={`flex items-start gap-3 ${
                msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-white text-black font-bold'
                    : 'bg-gradient-to-tr from-[#A855F7] to-[#D946EF] text-white font-bold'
                }`}
              >
                {msg.sender === 'user' ? (
                  <User className="w-4 h-4 text-black" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[82%] rounded-3xl p-5 text-sm leading-relaxed shadow-lg ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-[#A855F7] to-[#D946EF] text-white font-medium rounded-tr-md'
                    : 'bg-[#181818]/95 backdrop-blur border border-white/[0.08] text-zinc-100 rounded-tl-md'
                }`}
              >
                {/* Web search grounding chip */}
                {msg.sender === 'ai' && msg.webSearchUsed && (
                  <div className="mb-3">
                    <button
                      onClick={() => toggleSources(msg.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/20 transition-colors"
                    >
                      <Globe className="w-3 h-3" />
                      <span>Web'de arandı{msg.sources?.length ? ` · ${msg.sources.length} kaynak` : ''}</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${expandedSources[msg.id] ? 'rotate-180' : ''}`}
                      />
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
                          <div className="mt-2 p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
                            {msg.searchQueries && msg.searchQueries.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {msg.searchQueries.map((q, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300 flex items-center gap-1"
                                  >
                                    <Search className="w-2.5 h-2.5" />
                                    {q}
                                  </span>
                                ))}
                              </div>
                            )}
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="space-y-1">
                                {msg.sources.map((s, i) => (
                                  <a
                                    key={i}
                                    href={s.uri}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-[#D946EF] transition-colors truncate"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                    <span className="truncate">{s.title}</span>
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

                {/* Matched Tracks Recommendations inside AI message */}
                {msg.matchedTracks && msg.matchedTracks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C084FC] flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      Recommended Tracks Found In Library:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.matchedTracks.map((tr) => (
                        <div
                          key={tr.id}
                          onClick={() => onPlayTrack(tr)}
                          className="bg-[#242424] hover:bg-[#2e2e2e] p-2 rounded-lg flex items-center justify-between cursor-pointer border border-white/5 transition-all group"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <img
                              src={tr.coverUrl}
                              alt={tr.title}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-white truncate group-hover:text-[#D946EF]">
                                {tr.title}
                              </h5>
                              <p className="text-[10px] text-zinc-400 truncate">{tr.artist}</p>
                            </div>
                          </div>

                          <button className="w-7 h-7 rounded-full bg-[#A855F7] text-white flex items-center justify-center shadow group-hover:scale-105 transition-transform flex-shrink-0 ml-1">
                            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <span
                  className={`block text-[10px] mt-3 opacity-60 text-right ${
                    msg.sender === 'user' ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* "Thinking / Searching" Status Indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#A855F7] to-[#D946EF] text-white flex items-center justify-center font-bold shadow-md flex-shrink-0 relative">
                <Bot className="w-4 h-4" />
                <span className="absolute -inset-1 rounded-full border-2 border-[#D946EF]/40 animate-ping" />
              </div>
              <div className="relative bg-[#181818]/95 backdrop-blur border border-white/[0.08] px-5 py-3.5 rounded-3xl rounded-tl-md flex items-center gap-3 overflow-hidden min-w-[220px]">
                {/* Scanning shimmer sweep - reinforces the "searching" feel */}
                <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

                <AnimatePresence mode="wait">
                  <motion.div
                    key={thinkingPhaseIdx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                    className="flex items-center gap-2 relative z-10"
                  >
                    <ActivePhase.Icon className="w-4 h-4 text-[#D946EF] animate-pulse" />
                    <span className="text-sm text-zinc-300 font-medium">{ActivePhase.text}</span>
                  </motion.div>
                </AnimatePresence>

                <span className="flex items-center gap-1 relative z-10 ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D946EF] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D946EF] animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D946EF] animate-bounce [animation-delay:0.3s]" />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Quick Chips */}
      {messages.length <= 2 && (
        <div className="mb-3 flex flex-wrap gap-2 flex-shrink-0">
          {suggestionPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1.5 rounded-full bg-[#181818] hover:bg-[#242424] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D946EF]" />
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Field & Submit Button */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="relative flex items-center gap-2 bg-[#181818]/90 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl flex-shrink-0 focus-within:border-[#D946EF]/50 transition-colors"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask VERTEX Music AI anything about music, artists, genres..."
          disabled={isLoading}
          className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#D946EF] hover:opacity-90 disabled:bg-zinc-800 disabled:text-zinc-600 text-white flex items-center justify-center transition-all shadow-md active:scale-95 flex-shrink-0"
        >
          <Send className="w-4 h-4 fill-current ml-0.5" />
        </button>
      </form>
    </div>
  );
};

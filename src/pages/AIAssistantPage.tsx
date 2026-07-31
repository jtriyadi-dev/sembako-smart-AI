import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { useToast } from '../context/ToastContext';
import { askGeminiAssistant, ChatHistoryMessage, FirestoreDataContext } from '../services/geminiService';
import { subscribeProducts } from '../services/productService';
import { subscribeTransactions } from '../services/transaksiService';
import { ProdukItem, TransaksiItem } from '../types';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Mic,
  MicOff,
  Plus,
  MessageSquare,
  Trash2,
  Copy,
  Check,
  TrendingUp,
  Boxes,
  DollarSign,
  AlertTriangle,
  Lightbulb,
  Clock,
  RefreshCw,
  Database,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface LocalChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isTyping?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: LocalChatMessage[];
}

export const AIAssistantPage: React.FC = () => {
  const { success, error: toastError, info } = useToast();

  // Firestore Realtime Data
  const [products, setProducts] = useState<ProdukItem[]>([]);
  const [transactions, setTransactions] = useState<TransaksiItem[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Chat Sessions & History State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('sembako_ai_chat_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved chat sessions:', e);
      }
    }
    return [
      {
        id: 'session-default',
        title: 'Percakapan AI Baru',
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: [],
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    sessions[0]?.id || 'session-default'
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  // Input & Voice State
  const [input, setInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto Scroll Ref
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Subscribe to Realtime Firestore Data
  useEffect(() => {
    let untermProd: (() => void) | null = null;
    let untermTx: (() => void) | null = null;

    untermProd = subscribeProducts((data) => {
      setProducts(data);
      setIsDataLoaded(true);
    }, (err) => console.error('AI page prod sub error:', err));

    untermTx = subscribeTransactions((data) => {
      setTransactions(data);
      setIsDataLoaded(true);
    }, (err) => console.error('AI page tx sub error:', err));

    return () => {
      if (untermProd) untermProd();
      if (untermTx) untermTx();
    };
  }, []);

  // Save Sessions to localStorage
  useEffect(() => {
    localStorage.setItem('sembako_ai_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiLoading]);

  // Voice Recognition Setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'id-ID';

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toastError('Suara Tidak Terdeteksi', 'Silakan coba bicara kembali dengan jelas.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      info('Suara Tidak Didukung', 'Browser Anda tidak mendukung fitur Web Speech Input.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        info('Mendengarkan...', 'Silakan ucapkan pertanyaan Anda (misal: "Barang apa paling laris?")');
      } catch (err) {
        console.error('Error starting recognition:', err);
      }
    }
  };

  // Helper to append message to active session
  const updateActiveSessionMessages = (newMsgs: LocalChatMessage[], newTitle?: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === activeSessionId) {
          return {
            ...session,
            title: newTitle || session.title,
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            messages: newMsgs,
          };
        }
        return session;
      })
    );
  };

  // Create New Session Thread
  const handleCreateNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'Percakapan Baru',
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [
        {
          id: `welcome-${Date.now()}`,
          sender: 'assistant',
          text:
            'Halo! Percakapan baru telah dimulai. Silakan ajukan pertanyaan analisis data toko Anda.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  // Delete Session
  const handleDeleteSession = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      info('Batas Minimal', 'Minimal harus menyisakan 1 sesi percakapan.');
      return;
    }

    const filtered = sessions.filter((s) => s.id !== idToDelete);
    setSessions(filtered);
    if (activeSessionId === idToDelete) {
      setActiveSessionId(filtered[0].id);
    }
  };

  // Send Message Handler
  const handleSend = async (promptTextOverride?: string) => {
    const textToSend = promptTextOverride || input;
    if (!textToSend.trim() || isAiLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsgId = `usr-${Date.now()}`;
    const userMsg: LocalChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentMessages = [...messages, userMsg];

    // Determine session title if this is first query
    let newTitle: string | undefined = undefined;
    if (activeSession.title === 'Percakapan Baru' || activeSession.title === 'Analisis Bisnis Sembako') {
      newTitle = textToSend.slice(0, 24) + (textToSend.length > 24 ? '...' : '');
    }

    updateActiveSessionMessages(currentMessages, newTitle);
    if (!promptTextOverride) setInput('');
    setIsAiLoading(true);

    // Prepare Context Memory (History format for Gemini API)
    const historyMemory: ChatHistoryMessage[] = currentMessages.slice(-6).map((m) => ({
      role: m.sender === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.text }],
    }));

    const firestoreData: FirestoreDataContext = {
      products,
      transactions,
    };

    try {
      const fullResponse = await askGeminiAssistant({
        prompt: textToSend,
        history: historyMemory,
        contextData: firestoreData,
      });

      // Simulate character-by-character typing effect
      const aiMsgId = `ai-${Date.now()}`;
      const placeholderAiMsg: LocalChatMessage = {
        id: aiMsgId,
        sender: 'assistant',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isTyping: true,
      };

      const messagesWithPlaceholder = [...currentMessages, placeholderAiMsg];
      updateActiveSessionMessages(messagesWithPlaceholder);

      // Typing animation interval
      let index = 0;
      const stepSize = Math.max(1, Math.floor(fullResponse.length / 30));
      const interval = setInterval(() => {
        index += stepSize;
        if (index >= fullResponse.length) {
          clearInterval(interval);
          const finalAiMsg: LocalChatMessage = {
            id: aiMsgId,
            sender: 'assistant',
            text: fullResponse,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isTyping: false,
          };
          updateActiveSessionMessages([...currentMessages, finalAiMsg]);
          setIsAiLoading(false);
        } else {
          const currentTyped = fullResponse.slice(0, index);
          const typingAiMsg: LocalChatMessage = {
            id: aiMsgId,
            sender: 'assistant',
            text: currentTyped,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isTyping: true,
          };
          updateActiveSessionMessages([...currentMessages, typingAiMsg]);
        }
      }, 15);

    } catch (err: any) {
      console.error('Error generating AI answer:', err);
      toastError('Gagal AI Assistant', err.message || 'Terjadi kesalahan sistem.');
      setIsAiLoading(false);
    }
  };

  // Copy Message Text
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    success('Disalin', 'Teks jawaban AI disalin ke clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick Suggested Prompts List
  const quickSuggestedPrompts = [
    {
      title: 'Barang paling laris?',
      prompt: 'Barang apa paling laris?',
      desc: 'Ranking produk terlaris',
      icon: TrendingUp,
      color: 'from-emerald-500/20 to-emerald-700/20 text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Barang hampir habis?',
      prompt: 'Barang apa hampir habis?',
      desc: 'Daftar produk stok kritis',
      icon: AlertTriangle,
      color: 'from-amber-500/20 to-amber-700/20 text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Omzet hari ini?',
      prompt: 'Omzet hari ini?',
      desc: 'Rekap total pendapatan harian',
      icon: DollarSign,
      color: 'from-blue-500/20 to-blue-700/20 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Produk mati / tidak laku?',
      prompt: 'Produk mati?',
      desc: 'Analisis stok tidak bergerak',
      icon: Boxes,
      color: 'from-rose-500/20 to-rose-700/20 text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)] min-h-[600px] overflow-hidden">
      
      {/* Sidebar: Chat Sessions History (ChatGPT style) */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20, width: 0 }}
            animate={{ opacity: 1, x: 0, width: '280px' }}
            exit={{ opacity: 0, x: -20, width: 0 }}
            className="hidden lg:flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl p-4 shrink-0 overflow-hidden"
          >
            {/* New Chat Button */}
            <button
              onClick={handleCreateNewSession}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all mb-4"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>Percakapan Baru</span>
            </button>

            {/* Firestore Context Status */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4 flex items-center gap-2 text-xs">
              <Database className="w-4 h-4 text-emerald-500 animate-pulse" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                  Firestore Realtime
                </span>
                <span className="text-[10px] text-slate-500">
                  {products.length} SKU | {transactions.length} TRX
                </span>
              </div>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Riwayat Chat AI
              </span>

              {sessions.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className={`group p-3 rounded-2xl text-xs cursor-pointer flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="truncate">
                        <p className="truncate text-xs font-semibold">{s.title}</p>
                        <span className="text-[9px] text-slate-400">{s.updatedAt}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-emerald-500/20 shadow-2xl overflow-hidden relative">
        
        {/* Chat Top Header */}
        <div className="p-4 bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-500/20 cursor-pointer hidden lg:flex"
              title="Toggle Sidebar Riwayat"
            >
              {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-950 to-slate-900 text-amber-400 border border-amber-500/30">
              <Bot className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Sembako Smart AI Assistant
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>Gemini 2.5 Flash</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Data terhubung langsung ke Firestore Sembako
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNewSession}
              className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer text-xs font-bold lg:hidden flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Chat Baru</span>
            </button>
          </div>
        </div>

        {/* Chat Stream Window */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          
          {/* Default Starter Cards when messages are few */}
          {messages.length <= 1 && (
            <div className="my-4 space-y-4 max-w-2xl mx-auto">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Pertanyaan Populer Pemilik Toko:
                </h4>
                <p className="text-xs text-slate-500">
                  Klik pertanyaan contoh di bawah untuk langsung memperoleh jawaban AI real-time
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quickSuggestedPrompts.map((q, idx) => {
                  const IconComp = q.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(q.prompt)}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition-all cursor-pointer group shadow-sm flex items-start gap-3"
                    >
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${q.color} shrink-0`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors block">
                          {q.title}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {q.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages Stream */}
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 max-w-[90%] sm:max-w-[80%] ${
                  isUser ? 'ml-auto flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                    isUser
                      ? 'bg-emerald-700 text-white'
                      : 'bg-gradient-to-tr from-emerald-950 via-emerald-900 to-slate-900 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
                </div>

                {/* Bubble Content */}
                <div
                  className={`group relative p-4 rounded-2xl text-xs leading-relaxed space-y-2 shadow-md ${
                    isUser
                      ? 'bg-emerald-700 text-white rounded-tr-none font-medium'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-tl-none'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <div className="markdown-body text-xs space-y-2">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}

                  {/* Footer & Copy Action */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/5 dark:border-white/5 text-[10px] opacity-70">
                    <span>{msg.timestamp}</span>

                    {!isUser && (
                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="opacity-0 group-hover:opacity-100 hover:text-emerald-500 transition-opacity flex items-center gap-1 cursor-pointer"
                        title="Salin jawaban"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === msg.id ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* AI Thinking / Processing Indicator */}
          {isAiLoading && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-fit text-xs text-emerald-600 dark:text-emerald-400 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span className="font-bold">Sembako Smart AI sedang menganalisis data Firestore...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Controls Bar */}
        <div className="p-4 bg-slate-100/90 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 space-y-2">
          
          {/* Quick Prompts Horizontal Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {['Apakah toko sehat?', 'Barang paling laris?', 'Barang hampir habis?', 'Omzet hari ini?', 'Produk mati?'].map(
              (pText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(pText)}
                  className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 shrink-0 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{pText}</span>
                </button>
              )
            )}
          </div>

          {/* Form & Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`p-3 rounded-2xl transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-bounce shadow-lg ring-4 ring-rose-500/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-500/20'
              }`}
              title={isListening ? 'Mendengarkan... Klik untuk stop' : 'Gunakan Suara (Voice Input)'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-500" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? 'Bicara sekarang... suara Anda akan dikonversi ke teks'
                  : 'Tanyakan stok, omzet harian, atau produk paling laris...'
              }
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
            />

            <button
              type="submit"
              disabled={isAiLoading || !input.trim()}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>

        </div>

      </div>

    </div>
  );
};

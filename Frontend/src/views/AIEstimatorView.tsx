/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Gem,
  Layers,
  Search,
  FileText,
} from 'lucide-react';
import {
  ChatMessage,
  Estimation,
  EstimationCalculation,
  EstimationSession,
  Game,
  RecognizedItem,
  UnknownItemPrompt,
  User,
} from '../types';
import {
  calculateAccountValuation,
  formatGameCurrency,
  formatIDR,
  formatNumberID,
} from '../services/pricingCalculationService';
import { repository } from '../services/repository';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ItemReviewModal } from '../components/ItemReviewModal';
import { SaveEstimationModal } from '../components/SaveEstimationModal';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface AIEstimatorViewProps {
  currentUser: User;
  onNavigateToHistory: () => void;
  preloadedItems?: RecognizedItem[];
  preloadedGameId?: string;
}

export const AIEstimatorView: React.FC<AIEstimatorViewProps> = ({
  currentUser,
  onNavigateToHistory,
  preloadedItems,
  preloadedGameId,
}) => {
  const { showToast } = useToast();
  const games = repository.getGames().filter((g) => g.status === 'active');

  // Selected game
  const [selectedGameId, setSelectedGameId] = useState<string>(() => {
    return preloadedGameId || games[0]?.id || 'GAME-FF';
  });
  const selectedGame = repository.getGameById(selectedGameId) || games[0] || {
    id: '', name: '', slug: '', icon: 'Gamepad2', currencyName: 'Currency', currencySymbol: '',
    defaultConversionRate: 0, lowPercentage: 0, mediumPercentage: 0, highPercentage: 0,
    status: 'inactive' as const, createdAt: '', updatedAt: '',
  };
  const pricingSetting = repository.getPricingSettingByGame(selectedGameId);

  // Draft Items & Sessions
  const [draftItems, setDraftItems] = useState<RecognizedItem[]>(() => preloadedItems || []);
  const [sessions, setSessions] = useState<EstimationSession[]>(() => repository.getSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [sessionSearch, setSessionSearch] = useState('');

  // Chat conversation
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Modals & Panels
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [gameSwitchConfirm, setGameSwitchConfirm] = useState<{ open: boolean; nextGameId: string }>({
    open: false,
    nextGameId: '',
  });

  // Manual Unknown Item Form states
  const [unknownFormValues, setUnknownFormValues] = useState<
    Record<string, { currency: string; name?: string }>
  >({});

  // Recalculate valuation on items/game/settings change
  const calculation: EstimationCalculation = calculateAccountValuation(
    draftItems,
    selectedGame,
    pricingSetting
  );

  // Auto-scroll chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Handle preloaded items (from duplicate history or external quick load)
  useEffect(() => {
    if (preloadedItems && preloadedItems.length > 0) {
      setDraftItems(preloadedItems);
      if (preloadedGameId) {
        setSelectedGameId(preloadedGameId);
      }
      addInitialAssistantGreeting(preloadedItems);
    } else if (messages.length === 0) {
      addInitialAssistantGreeting();
    }
  }, [preloadedItems, preloadedGameId]);

  const addInitialAssistantGreeting = (initialItems: RecognizedItem[] = []) => {
    const greetingMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      content:
        'Halo! Selamat datang di Johen Price Estimator.\n\nSaya bisa membantu menghitung estimasi harga akun berdasarkan spesifikasi koleksi skin dan item yang dimiliki. Silakan pilih game dan masukkan spesifikasi akun Anda dalam bahasa santai atau terstruktur.',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      parsedItems: initialItems.length > 0 ? initialItems : undefined,
      calculation: initialItems.length > 0 ? calculateAccountValuation(initialItems, selectedGame, pricingSetting) : undefined,
    };
    setMessages([greetingMsg]);
  };

  // Handle changing game selector
  const handleGameChange = (newGameId: string) => {
    if (newGameId === selectedGameId) return;

    const hasUserMessage = messages.some((message) => message.sender === 'user');

    // Like ChatGPT, selecting a model/game before the first prompt only changes
    // the context. A new conversation starts only after this chat has content.
    if (!hasUserMessage) {
      setSelectedGameId(newGameId);
      if (activeSessionId) {
        const emptySession = repository.getSessionById(activeSessionId);
        if (emptySession) {
          emptySession.gameId = newGameId;
          emptySession.updatedAt = new Date().toISOString();
          repository.saveSession(emptySession);
          setSessions(repository.getSessions());
        }
      }
      return;
    }

    if (draftItems.length > 0) {
      setGameSwitchConfirm({ open: true, nextGameId: newGameId });
    } else {
      setSelectedGameId(newGameId);
      handleNewSession(newGameId);
    }
  };

  const confirmGameSwitch = () => {
    const nextId = gameSwitchConfirm.nextGameId;
    setSelectedGameId(nextId);
    setDraftItems([]);
    setGameSwitchConfirm({ open: false, nextGameId: '' });
    handleNewSession(nextId);
    showToast('Game dialihkan', `Katalog aktif telah diganti ke ${repository.getGameById(nextId)?.name}`, 'info');
  };

  // Create new session
  const handleNewSession = (gameIdToUse: string = selectedGameId) => {
    setSelectedGameId(gameIdToUse);
    setActiveSessionId('');
    setDraftItems([]);
    setMessages([]);
    addInitialAssistantGreeting();
  };

  // Switch session
  const handleSelectSession = (session: EstimationSession) => {
    setActiveSessionId(session.id);
    setSelectedGameId(session.gameId);
    setDraftItems(session.currentItems || []);
    setMessages(session.messages.length > 0 ? session.messages : []);
  };

  // Delete session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    repository.deleteSession(sessionId);
    setSessions(repository.getSessions());
    if (activeSessionId === sessionId) {
      handleNewSession();
    }
    showToast('Sesi dihapus', 'Sesi estimasi telah dihapus', 'info');
  };

  // Send Chat Message
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!messageContent || !selectedGame.id) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const result = await api<{ message: string; items: RecognizedItem[]; unknown: string[] }>('/ai/estimate', {
        method: 'POST',
        body: JSON.stringify({
          gameId: selectedGame.id,
          message: messageContent,
          history: messages.slice(-8).map((message) => ({
            role: message.sender === 'assistant' ? 'assistant' : 'user',
            content: message.content,
          })),
        }),
      });
      const updatedDraft = [...draftItems, ...result.items];
      setDraftItems(updatedDraft);

      const calc = calculateAccountValuation(updatedDraft, selectedGame, pricingSetting);
      const hasNewItems = result.items.length > 0;
      const assistantResponse = hasNewItems
        ? `${result.message}\n\nTotal estimasi saat ini adalah ${formatGameCurrency(calc.totalCurrency, selectedGame.currencySymbol)} dengan estimasi nilai dasar ${formatIDR(calc.baseValue)}.`
        : result.message;

      const assistantMsg: ChatMessage = {
        id: `msg-resp-${Date.now()}`,
        sender: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        parsedItems: hasNewItems ? updatedDraft : undefined,
        calculation: hasNewItems ? calc : undefined,
        hasUnknownItems: result.unknown.length > 0,
        unknownItemsList: result.unknown.map((rawText) => ({ rawText })),
        actionType: 'item_detected',
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);

      // A session is saved only after the user has sent a prompt.
      if (activeSessionId) {
        const session = repository.getSessionById(activeSessionId);
        if (session) {
          session.messages = [...messages, userMsg, assistantMsg];
          session.currentItems = updatedDraft;
          session.updatedAt = new Date().toISOString();
          repository.saveSession(session);
          setSessions(repository.getSessions());
        }
      } else {
        const newSession: EstimationSession = {
          id: crypto.randomUUID(),
          title: messageContent.length > 42 ? `${messageContent.slice(0, 42)}...` : messageContent,
          gameId: selectedGame.id,
          messages: [...messages, userMsg, assistantMsg],
          currentItems: updatedDraft,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        repository.saveSession(newSession);
        setActiveSessionId(newSession.id);
        setSessions(repository.getSessions());
      }
    } catch (error) {
      const assistantMsg: ChatMessage = {
        id: `msg-error-${Date.now()}`,
        sender: 'assistant',
        content: error instanceof Error ? error.message : 'Estimasi AI belum dapat diproses.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        actionType: 'error',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Manual unknown item confirmation
  const handleConfirmUnknownItem = (prompt: UnknownItemPrompt, index: number) => {
    const key = `${prompt.rawText}_${index}`;
    const entered = unknownFormValues[key];
    const currencyVal = parseInt(entered?.currency?.replace(/\D/g, '') || '0', 10);

    if (isNaN(currencyVal) || currencyVal <= 0) {
      showToast('Nilai mata uang tidak valid', `Harap masukkan estimasi ${selectedGame.currencyName} lebih dari 0`, 'warning');
      return;
    }

    const manualName = entered?.name?.trim() || prompt.rawText;
    const qty = prompt.quantity || 1;

    const manualItem: RecognizedItem = {
      tempId: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      gameId: selectedGame.id,
      categoryName: prompt.categoryGuess || 'Custom Category',
      rarityName: prompt.rarityGuess || 'Custom Rarity',
      itemName: manualName,
      itemType: 'manual',
      quantity: qty,
      unitCurrency: currencyVal,
      totalCurrency: currencyVal * qty,
      matchSource: 'manual',
      confidence: 'manual',
      isManual: true,
      originalRawText: prompt.rawText,
    };

    const newDraft = [...draftItems, manualItem];
    setDraftItems(newDraft);

    // Clean form state
    setUnknownFormValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    const newCalc = calculateAccountValuation(newDraft, selectedGame, pricingSetting);

    // Add confirmation assistant message
    const confirmMsg: ChatMessage = {
      id: `msg-manual-${Date.now()}`,
      sender: 'assistant',
      content: `Item "${manualName}" berhasil ditambahkan secara manual (${formatGameCurrency(currencyVal, selectedGame.currencySymbol)}). Total estimasi diperbarui.`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      parsedItems: newDraft,
      calculation: newCalc,
    };

    setMessages((prev) => [...prev, confirmMsg]);
    showToast('Item manual ditambahkan', `${manualName} telah dimasukkan ke dalam draft kalkulasi`, 'success');
  };

  // Copy full result to clipboard
  const handleCopyResult = () => {
    if (draftItems.length === 0) {
      showToast('Tidak ada data', 'Draft estimasi masih kosong untuk disalin', 'warning');
      return;
    }

    const itemsSummary = draftItems
      .map((i) => `• ${i.itemName} (${i.quantity}x) = ${formatGameCurrency(i.totalCurrency, selectedGame.currencySymbol)}`)
      .join('\n');

    const textToCopy = `JOHEN GAMING — ACCOUNT PRICE ESTIMATION
========================================
Game: ${selectedGame.name}
Total Currency: ${formatGameCurrency(calculation.totalCurrency, selectedGame.currencySymbol)}
Conversion Rate: Rp${calculation.conversionRate} / ${selectedGame.currencySymbol}
Base Account Value: ${formatIDR(calculation.baseValue)}

ESTIMASI HARGA JUAL:
• Low Price (${calculation.lowPercentage}%): ${formatIDR(calculation.lowPrice)}
• Medium Price (${calculation.mediumPercentage}%): ${formatIDR(calculation.mediumPrice)} [Recommended]
• High Price (${calculation.highPercentage}%): ${formatIDR(calculation.highPrice)}

Koleksi Item:
${itemsSummary}

Diestimasi oleh: ${currentUser.name} (${currentUser.role})
Tanggal: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedResult(true);
    showToast('Hasil disalin!', 'Ringkasan estimasi akun siap dibagikan', 'success');
    setTimeout(() => setCopiedResult(false), 2500);
  };

  return (
    <div className="estimator-layout flex-1 flex overflow-hidden">
      {/* 1. LEFT PANEL: Estimation Sessions */}
      <div
        className={`estimator-sessions border-r border-blue-100/80 flex flex-col transition-all duration-200 shrink-0 ${
          isLeftPanelCollapsed ? 'w-0 overflow-hidden' : 'w-60 md:w-64'
        }`}
      >
        <div className="p-4 border-b border-blue-100/70 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-900">AI Estimator</span>
              <span className="block text-[11px] leading-relaxed text-slate-500">Hitung estimasi akun bersama AI</span>
            </div>
          </div>
          <button
            onClick={() => handleNewSession()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition-colors"
            title="Mulai sesi estimasi baru"
          >
            <Plus className="w-3.5 h-3.5" />
            Baru Estimasi
          </button>
        </div>

        {/* Search Sesi */}
        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Cari percakapan..."
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions
            .filter((s) => s.title.toLowerCase().includes(sessionSearch.toLowerCase()))
            .map((s) => {
              const isSelected = s.id === activeSessionId;
              const sGame = repository.getGameById(s.gameId);
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s)}
                  className={`group p-2.5 rounded-lg text-xs cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-900 font-medium ring-1 ring-blue-100 shadow-sm'
                      : 'hover:bg-blue-50/70 text-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="truncate font-semibold">{s.title}</p>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {sGame?.name || 'Game'} · {s.currentItems?.length || 0} item
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                    title="Hapus sesi"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      {/* Collapse toggle left */}
      <button
        onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
        className="hidden md:flex items-center justify-center w-4 hover:w-5 bg-blue-50/70 border-r border-blue-100 text-blue-300 hover:text-blue-600 transition-all cursor-pointer"
        title={isLeftPanelCollapsed ? 'Tampilkan panel sesi' : 'Sembunyikan panel sesi'}
      >
        {isLeftPanelCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* 2. CENTER PANEL: AI Chat Conversation */}
      <div className="estimator-chat flex-1 flex flex-col min-w-0">
        {/* Game Selector & Status Bar */}
        <div className="estimator-chat-header min-h-[72px] px-4 py-2 border-b border-blue-100/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-[0_7px_16px_rgba(79,70,229,0.2)] shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-bold text-slate-900 truncate">Johen Price Estimator</span>
              <span className="block text-[11px] text-slate-500 truncate">AI siap membantu estimasi harga akun game Anda</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedGameId}
              onChange={(e) => handleGameChange(e.target.value)}
              aria-label="Pilih game"
              className="max-w-[120px] sm:max-w-[220px] px-3 py-2 text-xs font-semibold rounded-xl border border-blue-200 bg-white text-blue-800 shadow-sm focus:ring-2 focus:ring-blue-200 cursor-pointer"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.currencySymbol} - Rp{g.defaultConversionRate})
                </option>
              ))}
            </select>
            {draftItems.length > 0 && (
              <span className="hidden sm:inline text-xs text-slate-500">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{draftItems.length}</span> item aktif
              </span>
            )}
            <button
              onClick={() => handleSendMessage('reset')}
              className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Kosongkan draft kalkulasi"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="estimator-chat-waves" aria-hidden="true">
          <svg viewBox="0 0 600 350" preserveAspectRatio="none" focusable="false">
            <defs>
              <linearGradient id="chat-wave-back" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f4f9ff" />
                <stop offset="100%" stopColor="#e8f2ff" />
              </linearGradient>
              <linearGradient id="chat-wave-front" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#edf6ff" />
                <stop offset="100%" stopColor="#dceaff" />
              </linearGradient>
            </defs>
            <path d="M600 0 C495 43 525 168 404 218 C284 268 186 212 82 350 L600 350 Z" fill="url(#chat-wave-back)" />
            <path d="M600 139 C518 151 524 251 397 290 C295 322 203 279 155 350 L600 350 Z" fill="url(#chat-wave-front)" />
          </svg>
        </div>

        {/* Chat Messages Stream */}
        <div className="estimator-chat-stream flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${
                    isUser
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
                      : 'bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white ring-2 ring-indigo-100'
                  }`}
                >
                  {isUser ? (
                    currentUser.name.charAt(0)
                  ) : (
                    <img src="/chatbot.gif" alt="Chatbot" className="w-full h-full rounded-full object-cover" />
                  )}
                </div>

                {/* Message Body */}
                <div className={`space-y-2 max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-none shadow-[0_8px_22px_rgba(37,99,235,0.15)]'
                        : 'bg-gradient-to-br from-[#f0f5ff] to-[#e8f0ff] text-slate-800 rounded-tl-none border border-blue-100 shadow-[0_8px_22px_rgba(36,73,146,0.06)]'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.content}</div>

                    {/* Structured Item Cards Table inside Assistant message */}
                    {!isUser && msg.parsedItems && msg.parsedItems.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-700">
                        <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-between">
                          <span>Rincian Item Dikenali:</span>
                          <span className="font-mono text-blue-600 dark:text-blue-400">
                            {formatGameCurrency(
                              msg.calculation?.totalCurrency || 0,
                              selectedGame.currencySymbol
                            )}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {msg.parsedItems.map((item) => (
                            <div
                              key={item.tempId}
                              className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px]"
                            >
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                  {item.itemName}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Kategori: {item.categoryName} · Rarity: {item.rarityName} · {item.quantity}x @ {formatNumberID(item.unitCurrency)}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {formatGameCurrency(item.totalCurrency, selectedGame.currencySymbol)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {msg.calculation && (
                              <div className="mt-3 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <span className="block text-[11px] font-bold text-blue-900">Hasil estimasi akun</span>
                                <span className="text-[10px] text-blue-700">Total {formatGameCurrency(msg.calculation.totalCurrency, selectedGame.currencySymbol)} · Nilai dasar {formatIDR(msg.calculation.baseValue)}</span>
                              </div>
                              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">SELESAI</span>
                            </div>
                            <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                              <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2">
                                <span className="block text-[9px] font-bold tracking-wide text-slate-500">HARGA RENDAH</span>
                                <span className="mt-0.5 block font-mono text-xs font-bold text-slate-800">{formatIDR(msg.calculation.lowPrice)}</span>
                              </div>
                              <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 px-2.5 py-2 shadow-sm shadow-blue-600/20">
                                <span className="block text-[9px] font-bold tracking-wide text-blue-100">REKOMENDASI</span>
                                <span className="mt-0.5 block font-mono text-xs font-extrabold text-white">{formatIDR(msg.calculation.mediumPrice)}</span>
                              </div>
                              <div className="rounded-lg border border-blue-100 bg-white px-2.5 py-2">
                                <span className="block text-[9px] font-bold tracking-wide text-slate-500">HARGA TINGGI</span>
                                <span className="mt-0.5 block font-mono text-xs font-bold text-slate-800">{formatIDR(msg.calculation.highPrice)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Inline Actions inside assistant response */}
                        <div className="mt-3 pt-2.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsReviewModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            <Layers className="w-3 h-3" />
                            Review item
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyResult}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            {copiedResult ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            {copiedResult ? 'Tersalin' : 'Salin hasil'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSaveModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition-colors"
                          >
                            <Bookmark className="w-3 h-3" />
                            Simpan estimasi
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Unknown Item Manual Mini-Form inside Assistant Message */}
                    {!isUser && msg.hasUnknownItems && msg.unknownItemsList && (
                      <div className="mt-3.5 pt-3 border-t border-amber-200 dark:border-amber-900/60">
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 space-y-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Perlu Konfirmasi Nilai {selectedGame.currencyName} Manual:</span>
                          </div>

                          {msg.unknownItemsList.map((unk, idx) => {
                            const key = `${unk.rawText}_${idx}`;
                            const currentVal = unknownFormValues[key]?.currency || '';

                            return (
                              <div
                                key={key}
                                className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                    {unk.rawText}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    Kategori: {unk.categoryGuess || 'Umum'} · {unk.quantity || 1}x
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <input
                                    type="number"
                                    placeholder={`Biaya ${selectedGame.currencyName}`}
                                    value={currentVal}
                                    onChange={(e) =>
                                      setUnknownFormValues((prev) => ({
                                        ...prev,
                                        [key]: { currency: e.target.value, name: unk.rawText },
                                      }))
                                    }
                                    className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-md w-28 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmUnknownItem(unk, idx)}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold whitespace-nowrap transition-colors"
                                  >
                                    Konfirmasi
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 max-w-md items-center text-slate-400 text-xs py-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 ring-2 ring-indigo-100">
                <img src="/chatbot.gif" alt="Chatbot sedang mengetik" className="w-full h-full rounded-full object-cover" />
              </div>
              <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse delay-150" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse delay-300" />
                <span className="text-[11px] ml-1 text-slate-500">Mencocokkan database...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Sticky Chat Composer */}
        <div className="estimator-composer p-3 md:p-4 border-t border-blue-100 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 relative">
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder={`Tulis spesifikasi akun ${selectedGame.name}...`}
                className="w-full max-h-32 min-h-[42px] px-3.5 py-2.5 text-xs rounded-xl border border-blue-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none leading-relaxed"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSendMessage()}
              disabled={!inputText.trim() || isTyping}
              className="h-[42px] px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-[0_8px_18px_rgba(37,99,235,0.22)] transition-colors flex items-center justify-center gap-1.5 shrink-0"
              title="Kirim pesan (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
        </div>
      </div>

      {/* Item Review Modal */}
      {isReviewModalOpen && (
        <ItemReviewModal
          isOpen={isReviewModalOpen}
          game={selectedGame}
          items={draftItems}
          onClose={() => setIsReviewModalOpen(false)}
          onUpdateItems={(updated) => {
            setDraftItems(updated);
            showToast('Draft diperbarui', `${updated.length} item aktif dalam kalkulasi`, 'success');
          }}
        />
      )}

      {/* Save Estimation Modal */}
      {isSaveModalOpen && (
        <SaveEstimationModal
          isOpen={isSaveModalOpen}
          game={selectedGame}
          items={draftItems}
          calculation={calculation}
          currentUser={currentUser}
          onClose={() => setIsSaveModalOpen(false)}
          onSaved={(saved) => {
            showToast('Estimasi Tersimpan', `Nomor ${saved.id} berhasil dicatat ke dalam database riwayat`, 'success');
          }}
        />
      )}

      {/* Switch Game Confirmation Modal */}
      {gameSwitchConfirm.open && (
        <ConfirmationModal
          isOpen={gameSwitchConfirm.open}
          title="Ganti Katalog Game?"
          message="Draft estimasi saat ini masih memiliki item. Mengganti game akan mengosongkan draft untuk mencegah percampuran item antar-game."
          confirmLabel="Ganti Game & Bersihkan Draft"
          variant="warning"
          onConfirm={confirmGameSwitch}
          onCancel={() => setGameSwitchConfirm({ open: false, nextGameId: '' })}
        />
      )}
    </div>
  );
};

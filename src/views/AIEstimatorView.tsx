/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Sliders,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  Gamepad2,
  AlertCircle,
  Gem,
  Layers,
  Search,
  MessageSquare,
  HelpCircle,
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
import {
  applyParsedItemsToDraft,
  parseConversationalAccountSpec,
} from '../services/itemParserService';
import { repository } from '../services/repository';
import { useToast } from '../context/ToastContext';
import { ItemReviewModal } from '../components/ItemReviewModal';
import { SaveEstimationModal } from '../components/SaveEstimationModal';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface AIEstimatorViewProps {
  currentUser: User;
  onNavigateToHistory: () => void;
  onNavigateToSettings: () => void;
  preloadedItems?: RecognizedItem[];
  preloadedGameId?: string;
}

export const AIEstimatorView: React.FC<AIEstimatorViewProps> = ({
  currentUser,
  onNavigateToHistory,
  onNavigateToSettings,
  preloadedItems,
  preloadedGameId,
}) => {
  const { showToast } = useToast();
  const games = repository.getGames().filter((g) => g.status === 'active');

  // Selected game
  const [selectedGameId, setSelectedGameId] = useState<string>(() => {
    return preloadedGameId || games[0]?.id || 'GAME-FF';
  });
  const selectedGame = repository.getGameById(selectedGameId) || games[0];
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
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
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
    const targetGame = repository.getGameById(gameIdToUse) || selectedGame;
    const newSession: EstimationSession = {
      id: `sess-${Date.now()}`,
      title: `Estimasi Baru ${targetGame.name}`,
      gameId: gameIdToUse,
      messages: [],
      currentItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    repository.saveSession(newSession);
    setSessions(repository.getSessions());
    setActiveSessionId(newSession.id);
    setDraftItems([]);
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
  const handleSendMessage = (textToSend?: string) => {
    const messageContent = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!messageContent) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Simulate realistic lightweight assistant delay
    setTimeout(() => {
      const parseResult = parseConversationalAccountSpec(selectedGame.id, messageContent, draftItems);
      const updatedDraft = applyParsedItemsToDraft(draftItems, parseResult);
      setDraftItems(updatedDraft);

      const calc = calculateAccountValuation(updatedDraft, selectedGame, pricingSetting);

      let assistantResponse = parseResult.message;
      if (parseResult.action === 'replace' || parseResult.action === 'add') {
        if (updatedDraft.length > 0) {
          assistantResponse = `Berhasil! Saya menemukan ${parseResult.recognizedItems.length} item dari database ${selectedGame.name}.\n\nTotal estimasi saat ini adalah ${formatGameCurrency(calc.totalCurrency, selectedGame.currencySymbol)} dengan estimasi nilai dasar ${formatIDR(calc.baseValue)}.`;
        }
      }

      const assistantMsg: ChatMessage = {
        id: `msg-resp-${Date.now()}`,
        sender: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        parsedItems: updatedDraft,
        calculation: calc,
        hasUnknownItems: parseResult.unknownItems.length > 0,
        unknownItemsList: parseResult.unknownItems,
        actionType: 'item_detected',
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);

      // Update current session storage
      if (activeSessionId) {
        const session = repository.getSessionById(activeSessionId);
        if (session) {
          session.messages = [...messages, userMsg, assistantMsg];
          session.currentItems = updatedDraft;
          session.updatedAt = new Date().toISOString();
          repository.saveSession(session);
          setSessions(repository.getSessions());
        }
      }
    }, 450);
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

  // Clickable example prompts
  const samplePrompts = [
    {
      label: 'Format 1: Melee & Shotgun (Test 1)',
      prompt: 'Melee: special, heroic\nShotgun: special',
    },
    {
      label: 'Format 2: Typo Handling (Test 2)',
      prompt: 'Mele spesial sama heroik, terus shotgun spesial.',
    },
    {
      label: 'Format 3: Multi Quantity (Test 3)',
      prompt: 'Melee special 2x, shotgun special 3x',
    },
    {
      label: 'Format 4: Specific Skin Crimson (Test 4)',
      prompt: 'Saya punya Crimson Blade 1',
    },
    {
      label: 'Format 5: Unknown Item (Test 5)',
      prompt: 'Melee Skin Misterius 1',
    },
    {
      label: 'Format 6: Add Command (Test 6)',
      prompt: 'Tambahkan shotgun special 2',
    },
  ];

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* 1. LEFT PANEL: Estimation Sessions */}
      <div
        className={`border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all duration-200 shrink-0 ${
          isLeftPanelCollapsed ? 'w-0 overflow-hidden' : 'w-60 md:w-64'
        }`}
      >
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Sesi Estimasi
            </span>
          </div>
          <button
            onClick={() => handleNewSession()}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-md text-xs font-semibold transition-colors"
            title="Mulai sesi estimasi baru"
          >
            <Plus className="w-3.5 h-3.5" />
            Baru
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
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 font-medium'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
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
        className="hidden md:flex items-center justify-center w-4 hover:w-5 bg-slate-100 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
        title={isLeftPanelCollapsed ? 'Tampilkan panel sesi' : 'Sembunyikan panel sesi'}
      >
        {isLeftPanelCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* 2. CENTER PANEL: AI Chat Conversation */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
        {/* Game Selector & Status Bar */}
        <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              Pilih Game:
            </span>
            <select
              value={selectedGameId}
              onChange={(e) => handleGameChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.currencySymbol} - Rp{g.defaultConversionRate})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-indigo-600 text-white ring-2 ring-indigo-100 dark:ring-indigo-950'
                  }`}
                >
                  {isUser ? currentUser.name.charAt(0) : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div className={`space-y-2 max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60'
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
                                  {item.categoryName} · {item.quantity}x @ {formatNumberID(item.unitCurrency)}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {formatGameCurrency(item.totalCurrency, selectedGame.currencySymbol)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Inline Actions inside assistant response */}
                        <div className="mt-3 pt-2.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsReviewModalOpen(true)}
                            className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            Review & Edit Item
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSaveModalOpen(true)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition-colors"
                          >
                            Simpan Estimasi
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
                            <span>Perlu Konfirmasi Nilai Diamond Manual:</span>
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
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 animate-spin" />
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

        {/* Suggested Quick Prompt Pills */}
        <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900/60 border-t border-slate-200/70 dark:border-slate-800 overflow-x-auto flex items-center gap-2 shrink-0 no-scrollbar">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> Contoh:
          </span>
          {samplePrompts.map((p) => (
            <button
              key={p.label}
              onClick={() => handleSendMessage(p.prompt)}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Sticky Chat Composer */}
        <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
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
                    handleSendMessage();
                  }
                }}
                placeholder={`Tulis spesifikasi akun ${selectedGame.name} (contoh: "Melee: special, heroic. Shotgun: special")...`}
                className="w-full max-h-32 min-h-[42px] px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="h-[42px] px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
              title="Kirim pesan (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
        </div>
      </div>

      {/* Collapse toggle right */}
      <button
        onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
        className="hidden md:flex items-center justify-center w-4 hover:w-5 bg-slate-100 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
        title={isRightPanelCollapsed ? 'Tampilkan panel valuasi harga' : 'Sembunyikan panel valuasi'}
      >
        {isRightPanelCollapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* 3. RIGHT PANEL: Live Price Estimation */}
      <div
        className={`border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between transition-all duration-200 shrink-0 ${
          isRightPanelCollapsed ? 'w-0 overflow-hidden' : 'w-72 md:w-84'
        }`}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-blue-600" />
                Account Valuation
              </h3>
              <span className="text-[10px] text-slate-500">
                Preset Kalkulasi Johen Gaming
              </span>
            </div>
            <button
              onClick={onNavigateToSettings}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              title="Pengaturan harga"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Metric Overview Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Game Aktif:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedGame.name}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Recognized Items:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{draftItems.length} item</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Total {selectedGame.currencyName}:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatGameCurrency(calculation.totalCurrency, selectedGame.currencySymbol)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Conversion Rate:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                Rp{calculation.conversionRate} / {selectedGame.currencySymbol}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <span className="font-medium text-slate-700 dark:text-slate-300">Base Account Value:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                {formatIDR(calculation.baseValue)}
              </span>
            </div>
          </div>

          {/* 3 Pricing Cards */}
          <div className="space-y-2.5">
            {/* LOW PRICE */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  LOW PRICE
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {calculation.lowPercentage}% of base
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
                {formatIDR(calculation.lowPrice)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Harga cepat untuk perputaran modal kilat.
              </p>
            </div>

            {/* MEDIUM PRICE (Recommended) */}
            <div className="p-3.5 rounded-xl border-2 border-blue-500/80 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
                  MEDIUM PRICE
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-semibold">
                  {calculation.mediumPercentage}% of base
                </span>
              </div>
              <div className="text-xl font-extrabold font-mono text-blue-900 dark:text-blue-100">
                {formatIDR(calculation.mediumPrice)}
              </div>
              <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 mt-1">
                Preset estimasi standar internal yang disarankan.
              </p>
            </div>

            {/* HIGH PRICE */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  HIGH PRICE
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {calculation.highPercentage}% of base
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
                {formatIDR(calculation.highPrice)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Target pasar premium atau buyer kolektor.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Layers className="w-3.5 h-3.5" />
            Review & Edit Items ({draftItems.length})
          </button>

          <button
            onClick={handleCopyResult}
            disabled={draftItems.length === 0}
            className="w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {copiedResult ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedResult ? 'Hasil Disalin!' : 'Copy Ringkasan Harga'}
          </button>

          <button
            onClick={() => setIsSaveModalOpen(true)}
            disabled={draftItems.length === 0}
            className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Simpan Hasil Estimasi
          </button>
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

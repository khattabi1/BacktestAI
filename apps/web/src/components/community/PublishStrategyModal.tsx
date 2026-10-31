'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Lock,
  Globe,
  Loader2,
  Check,
  Layers,
  Image as ImageIcon,
  Search,
  AlertTriangle,
} from 'lucide-react';
import {
  verify5YearBenchmark,
  publishCommunityPost,
  BrokerSymbolsCatalog,
  BrokerSymbolItem,
} from '@/lib/api/community';
import staticBrokerCatalog from '@/data/broker_symbols.json';

export interface PublishStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategyName: string;
  versionNum: number;
  initialCode?: string;
  initialMetrics?: any;
  testedSymbol?: string;
  onPublished?: (post: any) => void;
}

export interface Verified5YMetrics {
  netProfit: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  sharpeRatio: number;
  period: string;
  verifiedAt: string;
}

const STRATEGY_CATEGORIES = ['Scalp', 'Intraday', 'Swing', 'Position'];

interface AvailableStrategy {
  name: string;
  version: number;
  category: string;
  pairs: string[];
}

const DEFAULT_AVAILABLE_STRATEGIES: AvailableStrategy[] = [
  { name: 'gold_fvg_scalper', version: 4, category: 'Scalp', pairs: ['XAUUSD'] },
  { name: 'titan_momentum_engine', version: 2, category: 'Intraday', pairs: ['EURUSD', 'GBPUSD'] },
  { name: 'smart_money_breaker', version: 1, category: 'Intraday', pairs: ['EURUSD'] },
  { name: 'mean_reversion_pro', version: 3, category: 'Swing', pairs: ['USDCHF', 'USDCAD'] },
  { name: 'liquidity_sweep_ea', version: 1, category: 'Scalp', pairs: ['XAUUSD', 'BTCUSD'] },
  { name: 'macro_regime_allocator', version: 1, category: 'Position', pairs: ['US500', 'XAUUSD'] },
];

export function PublishStrategyModal({
  isOpen,
  onClose,
  strategyName,
  versionNum,
  initialCode,
  initialMetrics,
  testedSymbol,
  onPublished,
}: PublishStrategyModalProps) {
  // Strategy Selection State
  const [activeStrategyName, setActiveStrategyName] = useState<string>(strategyName || 'gold_fvg_scalper');
  const [activeVersionNum, setActiveVersionNum] = useState<number>(versionNum || 1);

  // Strategy Details
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Scalp');
  const [licenseType, setLicenseType] = useState<'open_source' | 'pro_ea'>('open_source');
  const [price, setPrice] = useState<number>(149);

  // Strategy Notes Images
  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // Broker Symbols State (Static JSON, no network delay)
  const catalog: BrokerSymbolsCatalog = staticBrokerCatalog as BrokerSymbolsCatalog;
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [pairSearchQuery, setPairSearchQuery] = useState('');
  const [isPairDropdownOpen, setIsPairDropdownOpen] = useState(false);

  // 5Y Benchmark Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [verifyStepText, setVerifyStepText] = useState('');
  const [verifiedMetrics, setVerifiedMetrics] = useState<Verified5YMetrics | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Cache key per (activeStrategyName, activeVersionNum)
  const cacheKey = `btest_5y_cache_${activeStrategyName}_v${activeVersionNum}`;

  // Keep strategy in sync when props update
  useEffect(() => {
    if (strategyName) {
      setActiveStrategyName(strategyName);
      setActiveVersionNum(versionNum || 1);
    }
  }, [strategyName, versionNum]);

  // Compute available strategies
  const availableStrategies = useMemo(() => {
    const list = [...DEFAULT_AVAILABLE_STRATEGIES];
    if (strategyName && !list.some((s) => s.name === strategyName)) {
      list.unshift({
        name: strategyName,
        version: versionNum || 1,
        category: 'Scalp',
        pairs: testedSymbol ? [testedSymbol] : ['XAUUSD'],
      });
    }
    return list;
  }, [strategyName, versionNum, testedSymbol]);

  // Initialize selected pairs
  useEffect(() => {
    if (!isOpen) return;
    const initialSym = (testedSymbol || 'XAUUSD').toUpperCase();
    setSelectedPairs((prev) => (prev.length > 0 ? prev : [initialSym]));
  }, [isOpen, testedSymbol]);

  // Check version-level 5Y verification cache
  useEffect(() => {
    if (!isOpen || !activeStrategyName) return;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setVerifiedMetrics(parsed);
      } else {
        setVerifiedMetrics(null);
      }
    } catch {
      setVerifiedMetrics(null);
    }
  }, [isOpen, activeStrategyName, activeVersionNum, cacheKey]);

  // Filtered symbols catalog for search bar
  const filteredCatalog = useMemo(() => {
    if (!pairSearchQuery.trim()) return catalog;
    const q = pairSearchQuery.toLowerCase();
    const result: BrokerSymbolsCatalog = {};
    for (const [catName, items] of Object.entries(catalog) as [string, BrokerSymbolItem[]][]) {
      const matched = items.filter(
        (it) => it.symbol.toLowerCase().includes(q) || it.description.toLowerCase().includes(q)
      );
      if (matched.length > 0) {
        result[catName] = matched;
      }
    }
    return result;
  }, [catalog, pairSearchQuery]);

  if (!isOpen) return null;

  const handleStrategyChange = (newStratName: string) => {
    const strat = availableStrategies.find((s) => s.name === newStratName);
    if (strat) {
      setActiveStrategyName(strat.name);
      setActiveVersionNum(strat.version);
      setCategory(strat.category);
      if (strat.pairs && strat.pairs.length > 0) {
        setSelectedPairs(strat.pairs);
      }
    } else {
      setActiveStrategyName(newStratName);
    }
  };

  const removePair = (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedPairs.length > 1) {
      setSelectedPairs((prev) => prev.filter((s) => s !== sym));
    }
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNoteImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageFiles(e.target.files);
  };

  const removeNoteImage = (idxToRemove: number) => {
    setNoteImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const run5YearVerification = async () => {
    setIsVerifying(true);
    setVerifyError(null);
    setVerifyProgress(20);
    setVerifyStepText('Executing causal logic audit across DuckDB historical parquet...');

    const timer1 = setTimeout(() => {
      setVerifyProgress(55);
      setVerifyStepText(`Benchmarking 5Y execution fills on ${selectedPairs[0]}...`);
    }, 600);

    const timer2 = setTimeout(() => {
      setVerifyProgress(85);
      setVerifyStepText('Auditing drawdown and equity stability...');
    }, 1200);

    try {
      const result = await verify5YearBenchmark({
        strategy_name: activeStrategyName,
        version_num: activeVersionNum,
        code: initialCode,
        symbols: selectedPairs,
        initial_metrics: initialMetrics,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      setVerifyProgress(100);
      setIsVerifying(false);

      if (result.status === 'VERIFIED') {
        setVerifyError(null);
        setVerifiedMetrics(result.metrics);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result.metrics));
        } catch (err) {
          console.error('Failed to cache 5Y benchmark:', err);
        }
      } else {
        setVerifiedMetrics(null);
        setVerifyError(result.ai_report);
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsVerifying(false);
      setVerifiedMetrics(null);
      setVerifyError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    }
  };

  const handlePublishSubmit = async () => {
    if (!verifiedMetrics) return;

    setIsPublishing(true);
    const newPost = {
      id: `post_${Date.now()}`,
      author: {
        username: 'SeniorQuant',
        displayName: 'Senior Quantitative Trader',
        avatarUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
        reputation: 'Elite Contributor',
        followersCount: 145,
        isFollowing: false,
      },
      content:
        description ||
        `Published ${activeStrategyName} (v${activeVersionNum}) with institutional 5-year verified track record on ${selectedPairs.join(', ')}.`,
      chartImageUrl: noteImages.length > 0 ? noteImages[0] : undefined,
      createdAt: 'Just now',
      likesCount: 1,
      isLiked: false,
      commentsCount: 0,
      strategy: {
        id: `strat_${Date.now()}`,
        name: activeStrategyName,
        version: `v${activeVersionNum}`,
        type: licenseType,
        price: licenseType === 'pro_ea' ? price : 0,
        category,
        supportedSymbols: selectedPairs,
        metrics: verifiedMetrics,
        starsAverage: 5.0,
        starsCount: 1,
        forksCount: 0,
        codeSnippet: initialCode || '// High-performance algorithmic engine',
      },
    };

    await publishCommunityPost({
      author_username: newPost.author.username,
      author_display_name: newPost.author.displayName,
      content: newPost.content,
      strategy: newPost.strategy,
    });

    try {
      const stored = localStorage.getItem('backtest_community_feed_posts');
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newPost);
      localStorage.setItem('backtest_community_feed_posts', JSON.stringify(list));
    } catch (e) {
      console.error('Failed saving post:', e);
    }

    setIsPublishing(false);
    setPublishSuccess(true);
    if (onPublished) onPublished(newPost);

    setTimeout(() => {
      setPublishSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-sans select-none overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-2xl bg-[#090D14] border border-[#1C2638] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.95)] overflow-hidden my-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal Pro Header (No strategy badge at top) */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[#162030] bg-[#0C121D]/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#141C2B] border border-[#202D40] flex items-center justify-center text-slate-300 shrink-0">
              {licenseType === 'pro_ea' ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-100 font-mono tracking-tight">
              Publish Strategy
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#141C2B] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          {/* 1. Licensing Model Selection */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Open Source Tile */}
            <button
              type="button"
              onClick={() => setLicenseType('open_source')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer relative ${
                licenseType === 'open_source'
                  ? 'bg-[#121B2A] border-slate-500 text-slate-100'
                  : 'bg-[#0E1522] border-[#1A2538] hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs font-mono text-slate-200">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Open Source</span>
                </div>
                {licenseType === 'open_source' && (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#1C283B]">
                <span className="text-[10px] font-mono text-slate-400">Forkable Code</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  FREE
                </span>
              </div>
            </button>

            {/* Pro EA Tile */}
            <button
              type="button"
              onClick={() => setLicenseType('pro_ea')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer relative ${
                licenseType === 'pro_ea'
                  ? 'bg-[#121B2A] border-slate-500 text-slate-100'
                  : 'bg-[#0E1522] border-[#1A2538] hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs font-mono text-slate-200">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Pro EA (.ex5)</span>
                </div>
                {licenseType === 'pro_ea' && (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#1C283B]">
                <span className="text-[10px] font-mono text-slate-400">Binary License</span>
                <div
                  className="flex items-center gap-1 bg-[#090D14] border border-[#232F42] px-2 py-0.2 rounded text-[11px] font-mono text-emerald-400 font-bold"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>$</span>
                  <input
                    type="number"
                    value={price}
                    min={1}
                    max={9999}
                    onChange={(e) => setPrice(Math.max(1, Number(e.target.value)))}
                    className="w-12 bg-transparent outline-none text-emerald-400"
                  />
                </div>
              </div>
            </button>
          </div>

          {/* 2. Strategy Selector Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-semibold tracking-wider text-slate-300">
              STRATEGY
            </label>
            <div className="w-full max-w-full overflow-hidden">
              <select
                value={activeStrategyName}
                onChange={(e) => handleStrategyChange(e.target.value)}
                className="w-full max-w-full bg-[#0D1522] hover:bg-[#121D2F] border border-[#223147] hover:border-slate-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none cursor-pointer transition-colors truncate"
              >
                {availableStrategies.map((strat) => (
                  <option key={strat.name} value={strat.name} className="bg-[#090D15] text-slate-200 py-1 font-mono">
                    {strat.name} (v{strat.version}) · {strat.category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Working Pairs Selection with Search Bar (No Broker Catalog label, no overflow) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-semibold tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>WORKING PAIRS ({selectedPairs.length})</span>
            </label>

            {/* Picked Pairs Chips */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#080D15] border border-[#1A2538] flex flex-wrap items-center gap-1.5 min-h-[42px]">
              {selectedPairs.map((sym) => (
                <span
                  key={sym}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#141C2B] text-slate-200 border border-[#223147]"
                >
                  <span>{sym}</span>
                  {selectedPairs.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => removePair(sym, e)}
                      className="hover:text-rose-400 transition-colors ml-0.5 cursor-pointer text-slate-400 hover:text-rose-300 font-bold"
                      title="Remove pair"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>

            {/* Search Bar for Symbol Selection */}
            <div className="relative w-full">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search pairs to add (e.g. XAUUSD, EURUSD, BTC, US30)..."
                  value={pairSearchQuery}
                  onChange={(e) => {
                    setPairSearchQuery(e.target.value);
                    setIsPairDropdownOpen(true);
                  }}
                  onFocus={() => setIsPairDropdownOpen(true)}
                  className="w-full bg-[#0D1522] hover:bg-[#121D2F] focus:bg-[#121D2F] border border-[#223147] focus:border-cyan-500/50 rounded-lg pl-9 pr-8 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-500 outline-none transition-colors"
                />
                {pairSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPairSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Filtered Dropdown Popover */}
              {isPairDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsPairDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-[#090D15] border border-[#223147] rounded-xl shadow-2xl z-40 p-1.5 space-y-2">
                    {Object.keys(filteredCatalog).length === 0 ? (
                      <div className="p-3 text-center text-xs font-mono text-slate-500">
                        No symbols matching &quot;{pairSearchQuery}&quot;
                      </div>
                    ) : (
                      (Object.entries(filteredCatalog) as [string, BrokerSymbolItem[]][]).map(([categoryName, items]) => (
                        <div key={categoryName} className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-slate-500 tracking-wider">
                            {categoryName}
                          </div>
                          {items.map((item) => {
                            const isPicked = selectedPairs.includes(item.symbol);
                            return (
                              <button
                                key={item.symbol}
                                type="button"
                                disabled={isPicked}
                                onClick={() => {
                                  if (!isPicked) {
                                    setSelectedPairs((prev) => [...prev, item.symbol]);
                                    setPairSearchQuery('');
                                    setIsPairDropdownOpen(false);
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-mono transition-colors ${
                                  isPicked
                                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                                    : 'hover:bg-[#141C2B] text-slate-200 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="font-bold text-slate-100 shrink-0">
                                    {item.symbol}
                                  </span>
                                  <span className="text-[11px] text-slate-400 truncate">
                                    {item.description}
                                  </span>
                                </div>
                                {isPicked ? (
                                  <span className="text-[10px] text-cyan-400 shrink-0 font-medium">Added ✓</span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 hover:text-cyan-400 shrink-0">+ Add</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 4. Strategy Notes (Image icon INSIDE textarea + drag-and-drop support, no extra row) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono font-semibold tracking-wider text-slate-300">
                STRATEGY NOTES
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500">Category:</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-[#0B101A] border border-[#1A2538] rounded px-2 py-0.5 text-[10px] font-mono text-slate-300 outline-none cursor-pointer"
                >
                  {STRATEGY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Integrated Textarea Card with Image Upload Icon & Drag-and-Drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingImage(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingImage(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingImage(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleImageFiles(e.dataTransfer.files);
                }
              }}
              className={`rounded-xl border bg-[#0B101A] p-2.5 transition-all ${
                isDraggingImage
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : 'border-[#1A2538] focus-within:border-slate-500'
              }`}
            >
              <textarea
                rows={2}
                placeholder="Strategy hypothesis, optimal sessions, regime edge, risk constraints..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent border-0 outline-none text-xs text-slate-200 placeholder:text-slate-600 font-sans resize-none"
              />

              {/* Bottom Toolbar inside Textarea: Attached Images + Image Icon */}
              <div className="flex items-center justify-between pt-1.5 border-t border-[#141E2E] mt-1">
                {/* Image Previews */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {noteImages.map((imgSrc, idx) => (
                    <div
                      key={idx}
                      className="relative group w-10 h-8 rounded overflow-hidden border border-[#223147] bg-[#080D15] shrink-0"
                    >
                      <img
                        src={imgSrc}
                        alt={`Attachment ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeNoteImage(idx)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-300 text-[10px] font-bold transition-opacity cursor-pointer"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Image Upload Icon inside Textarea */}
                <label
                  className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-[#141C2B] transition-colors cursor-pointer shrink-0 ml-auto"
                  title="Upload image"
                >
                  <ImageIcon className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 5. 5-Year Cloud Audit Card (Meaningful Green & Red Colors) */}
          <div className="rounded-xl border border-[#1A2538] bg-[#0B0F16] p-3.5 space-y-3">
            {/* Header Line */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-medium text-slate-200">
                  5-Year Cloud Audit (2021–2026)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  verifiedMetrics
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#141C2B] text-slate-400 border border-[#223147]'
                }`}>
                  {verifiedMetrics ? '5Y Verified' : 'Audit Required'}
                </span>
              </div>

              {!verifiedMetrics && !isVerifying && (
                <button
                  type="button"
                  onClick={run5YearVerification}
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm shadow-cyan-500/20 active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>Run 5Y Audit</span>
                </button>
              )}
            </div>

            {/* In-Progress Progress Bar */}
            {isVerifying && (
              <div className="space-y-2 py-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    {verifyStepText}
                  </span>
                  <span className="text-slate-400 font-bold">{verifyProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#080C14] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-300 rounded-full"
                    style={{ width: `${verifyProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Verification failed or was rejected: show the reason, never placeholder metrics */}
            {!isVerifying && !verifiedMetrics && verifyError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}

            {/* Verified Metrics KPI Grid (Meaningful Green/Red/Cyan Financial Semantics) */}
            {verifiedMetrics && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 py-1 border-b border-[#141E2E]">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Causal execution verified across {selectedPairs.join(', ')}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">0 lookahead artifacts</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-[#080D15] p-2.5 rounded-lg border border-[#162130]">
                    <div className="text-[9.5px] uppercase text-slate-500">5Y Profit</div>
                    <div className="text-sm font-bold text-emerald-400">
                      +${verifiedMetrics.netProfit.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="bg-[#080D15] p-2.5 rounded-lg border border-[#162130]">
                    <div className="text-[9.5px] uppercase text-slate-500">Max DD</div>
                    <div className="text-sm font-bold text-rose-400">
                      -{verifiedMetrics.maxDrawdown}%
                    </div>
                  </div>
                  <div className="bg-[#080D15] p-2.5 rounded-lg border border-[#162130]">
                    <div className="text-[9.5px] uppercase text-slate-500">Win Rate</div>
                    <div className="text-sm font-bold text-cyan-300">
                      {verifiedMetrics.winRate}%
                    </div>
                  </div>
                  <div className="bg-[#080D15] p-2.5 rounded-lg border border-[#162130]">
                    <div className="text-[9.5px] uppercase text-slate-500">Profit Factor</div>
                    <div className="text-sm font-bold text-slate-100">
                      {verifiedMetrics.profitFactor}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-500 pt-0.5">
                  <span>Period: {verifiedMetrics.period}</span>
                  <button
                    type="button"
                    onClick={run5YearVerification}
                    className="text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    Re-run Audit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-t border-[#162030] bg-[#0C121D]/80 shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="px-3.5 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-[#141C2B] transition-colors cursor-pointer min-h-[44px] flex items-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handlePublishSubmit}
            disabled={!verifiedMetrics || isPublishing || isVerifying}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm min-h-[44px] ${
              verifiedMetrics && !isPublishing
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20 active:scale-95'
                : 'bg-[#141C2B] text-slate-600 border border-[#1E2838] opacity-50 cursor-not-allowed'
            }`}
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                <span>Publishing...</span>
              </>
            ) : publishSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-slate-950" />
                <span>Published!</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-slate-950" />
                <span>Publish to Community</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

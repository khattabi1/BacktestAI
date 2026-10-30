'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Globe,
  Lock,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Filter,
  Plus,
  Send,
  Image as ImageIcon,
  Layers,
  Star,
  CheckCircle2,
  Activity,
  Award,
  ArrowRight,
  Flame,
  MessageSquare,
  Compass,
} from 'lucide-react';
import { CommunityStrategyCard, CommunityPost, AttachedStrategy, PostAuthor } from '@/components/community/CommunityStrategyCard';
import { PublishStrategyModal } from '@/components/community/PublishStrategyModal';
import { SandboxPreviewModal } from '@/components/community/SandboxPreviewModal';
import { DirectMessagesDrawer } from '@/components/community/DirectMessagesDrawer';
import { fetchCommunityPosts, publishCommunityPost, togglePostLike } from '@/lib/api/community';

// Initial Institutional Seed Posts

const INITIAL_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'post_1',
    author: {
      username: 'KarimQuant',
      displayName: 'Karim Al-Husseini',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
      reputation: 'Lead Quant',
      followersCount: 320,
      isFollowing: false,
    },
    content: 'Just deployed our verified Gold FVG Scalper v4 to the community! Calibrated on London / New York overlap volatility. The strategy uses pure institutional Fair Value Gap mitigation with strict fixed 25-pip stop loss and zero martingale. Passed the 5-year cloud benchmark with +$18,450 net gain and 6.8% max drawdown. Open source for all quant lab members—feel free to fork and test!',
    chartImageUrl: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=900&q=80',
    createdAt: '25m ago',
    likesCount: 34,
    isLiked: false,
    commentsCount: 6,
    strategy: {
      id: 'strat_1',
      name: 'gold_fvg_scalper',
      version: 'v4',
      type: 'open_source',
      price: 0,
      category: 'Scalping / SMC',
      supportedSymbols: ['XAUUSD'],
      metrics: {
        netProfit: 18450,
        maxDrawdown: 6.8,
        winRate: 62.4,
        profitFactor: 2.18,
        totalTrades: 412,
        sharpeRatio: 1.88,
        period: '2021-01-01 → 2026-01-01 (5 Years)',
        verifiedAt: '2026-10-15T18:00:00Z',
      },
      starsAverage: 4.9,
      starsCount: 28,
      forksCount: 45,
      codeSnippet: `//+------------------------------------------------------------------+
//| Gold FVG Scalper v4 - Institutional Open Source                 |
//+------------------------------------------------------------------+
#property copyright "Backtest-AI Community"
#property version   "4.00"

input double InpRiskPercent    = 1.0;     // Risk per trade %
input int    InpMinFvgPips     = 15;      // Min FVG threshold (pips)
input int    InpFixedSlPips    = 25;      // Fixed Stop Loss (pips)
input double InpTrailingAtr    = 1.5;     // ATR Trailing Stop multiplier`,
    },
  },
  {
    id: 'post_2',
    author: {
      username: 'ElenaV',
      displayName: 'Elena Voronova, CFA',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80',
      reputation: 'Prop Fund Manager',
      followersCount: 512,
      isFollowing: true,
    },
    content: 'Releasing Titan Momentum Engine (v3) as a protected Pro EA license. This algorithm targets structural breakouts during high liquidity windows on EURUSD. Zero grid, zero curve-fitting. Every prospective buyer can test it on our zero-leak cloud sandbox with your own custom out-of-sample dates (3 free runs/day) before buying. Check the verified 5Y metrics below!',
    createdAt: '2h ago',
    likesCount: 89,
    isLiked: true,
    commentsCount: 14,
    strategy: {
      id: 'strat_2',
      name: 'titan_momentum_engine',
      version: 'v3',
      type: 'pro_ea',
      price: 149,
      category: 'Breakout Momentum',
      supportedSymbols: ['EURUSD', 'GBPUSD'],
      metrics: {
        netProfit: 24600,
        maxDrawdown: 5.2,
        winRate: 66.8,
        profitFactor: 2.45,
        totalTrades: 580,
        sharpeRatio: 2.12,
        period: '2021-01-01 → 2026-01-01 (5 Years)',
        verifiedAt: '2026-10-15T16:30:00Z',
      },
      starsAverage: 5.0,
      starsCount: 42,
      forksCount: 0,
    },
  },
  {
    id: 'post_3',
    author: {
      username: 'DavidChen',
      displayName: 'David Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80',
      reputation: 'Quant Researcher',
      followersCount: 189,
      isFollowing: false,
    },
    content: 'Quick market dispatch on London Breakout Pro v2: When testing 2022 Fed rate hike cycles, the 8-period EMA volatility filter reduced max drawdown by nearly 40% compared to vanilla breakout models. The strategy is 100% open-source for community inspection.',
    createdAt: '5h ago',
    likesCount: 22,
    isLiked: false,
    commentsCount: 3,
    strategy: {
      id: 'strat_3',
      name: 'london_breakout_pro',
      version: 'v2',
      type: 'open_source',
      price: 0,
      category: 'Trend Following',
      supportedSymbols: ['GBPUSD'],
      metrics: {
        netProfit: 12180,
        maxDrawdown: 7.4,
        winRate: 58.2,
        profitFactor: 1.95,
        totalTrades: 360,
        sharpeRatio: 1.68,
        period: '2021-01-01 → 2026-01-01 (5 Years)',
        verifiedAt: '2026-10-15T12:00:00Z',
      },
      starsAverage: 4.8,
      starsCount: 19,
      forksCount: 31,
      codeSnippet: `// London Session High/Low Breakout System v2
#property version "2.00"
input int LondonOpenHour = 8; // UTC`,
    },
  },
];

type FeedTab = 'all' | 'open_source' | 'pro_ea' | 'top_rated';

export default function QuantCommunityPage() {
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Feed Posts State
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_COMMUNITY_POSTS);

  // Composer State
  const [composerText, setComposerText] = useState('');
  const [composerImageUrl, setComposerImageUrl] = useState('');
  const [isAttachingImage, setIsAttachingImage] = useState(false);

  // Modals
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [activeSandboxStrategy, setActiveSandboxStrategy] = useState<AttachedStrategy | null>(null);
  const [activeDmAuthor, setActiveDmAuthor] = useState<PostAuthor | null>(null);

  // Load posts from FastAPI backend with localStorage fallback
  useEffect(() => {
    let isMounted = true;
    let excludedIds = new Set<string>();
    try {
      const deleted: string[] = JSON.parse(localStorage.getItem('backtest_community_deleted_post_ids') || '[]');
      const hidden: string[] = JSON.parse(localStorage.getItem('backtest_community_hidden_post_ids') || '[]');
      excludedIds = new Set([...deleted, ...hidden]);
    } catch {}

    fetchCommunityPosts(activeTab, categoryFilter, searchQuery).then((backendPosts: CommunityPost[]) => {
      if (!isMounted) return;
      if (backendPosts && backendPosts.length > 0) {
        setPosts(backendPosts.filter((p: CommunityPost) => !excludedIds.has(p.id)));
      } else {
        try {
          const stored = localStorage.getItem('backtest_community_feed_posts');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const ids = new Set(parsed.map((p: any) => p.id));
              const unshared = INITIAL_COMMUNITY_POSTS.filter((p) => !ids.has(p.id));
              const allMerged = [...parsed, ...unshared];
              setPosts(allMerged.filter((p: CommunityPost) => !excludedIds.has(p.id)));
              return;
            }
          }
          setPosts(INITIAL_COMMUNITY_POSTS.filter((p: CommunityPost) => !excludedIds.has(p.id)));
        } catch {}
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      // 1. Tab filter
      if (activeTab === 'open_source' && p.strategy?.type !== 'open_source') return false;
      if (activeTab === 'pro_ea' && p.strategy?.type !== 'pro_ea') return false;
      if (activeTab === 'top_rated') {
        const stars = p.strategy?.starsAverage || 0;
        if (stars < 4.8) return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'ALL' && p.strategy?.category !== categoryFilter) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inContent = p.content.toLowerCase().includes(q);
        const inAuthor = p.author.displayName.toLowerCase().includes(q) || p.author.username.toLowerCase().includes(q);
        const inStrat = p.strategy?.name.toLowerCase().includes(q);
        const inSymbols = p.strategy?.supportedSymbols.some((s) => s.toLowerCase().includes(q));
        if (!inContent && !inAuthor && !inStrat && !inSymbols) return false;
      }

      return true;
    });
  }, [posts, activeTab, categoryFilter, searchQuery]);

  // Social Handlers
  const handleLikeToggle = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.isLiked;
          return {
            ...p,
            isLiked,
            likesCount: isLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
          };
        }
        return p;
      })
    );
    togglePostLike(postId).catch(() => {});
  };

  const handleFollowToggle = (username: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.author.username === username) {
          const isFollowing = !p.author.isFollowing;
          return {
            ...p,
            author: {
              ...p.author,
              isFollowing,
              followersCount: isFollowing ? p.author.followersCount + 1 : Math.max(0, p.author.followersCount - 1),
            },
          };
        }
        return p;
      })
    );
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => {
      const updated = prev.filter((p) => p.id !== postId);
      try {
        localStorage.setItem('backtest_community_feed_posts', JSON.stringify(updated));
        const deletedIds: string[] = JSON.parse(localStorage.getItem('backtest_community_deleted_post_ids') || '[]');
        if (!deletedIds.includes(postId)) {
          deletedIds.push(postId);
          localStorage.setItem('backtest_community_deleted_post_ids', JSON.stringify(deletedIds));
        }
      } catch {}
      return updated;
    });
  };

  const handleEditPost = (targetPost: CommunityPost, newContent: string) => {
    setPosts((prev) => {
      const updated = prev.map((p) => (p.id === targetPost.id ? { ...p, content: newContent } : p));
      try {
        localStorage.setItem('backtest_community_feed_posts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleHidePost = (postId: string) => {
    setPosts((prev) => {
      const updated = prev.filter((p) => p.id !== postId);
      try {
        const hiddenIds: string[] = JSON.parse(localStorage.getItem('backtest_community_hidden_post_ids') || '[]');
        if (!hiddenIds.includes(postId)) {
          hiddenIds.push(postId);
          localStorage.setItem('backtest_community_hidden_post_ids', JSON.stringify(hiddenIds));
        }
      } catch {}
      return updated;
    });
  };

  const handleComposerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim()) return;

    const newPost: CommunityPost = {
      id: `post_${Date.now()}`,
      author: {
        username: 'SeniorQuant',
        displayName: 'Senior Quantitative Trader',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
        reputation: 'Elite Contributor',
        followersCount: 142,
        isFollowing: false,
      },
      content: composerText.trim(),
      chartImageUrl: composerImageUrl || undefined,
      createdAt: 'Just now',
      likesCount: 1,
      isLiked: false,
      commentsCount: 0,
    };

    const updated = [newPost, ...posts];
    setPosts(updated);
    const contentToPublish = composerText.trim();
    const imageToPublish = composerImageUrl;
    setComposerText('');
    setComposerImageUrl('');
    setIsAttachingImage(false);

    try {
      localStorage.setItem('backtest_community_feed_posts', JSON.stringify(updated));
    } catch {}

    await publishCommunityPost({
      author_username: 'SeniorQuant',
      author_display_name: 'Senior Quantitative Trader',
      content: contentToPublish,
      chart_image_url: imageToPublish || null,
    });
  };


  return (
    <div className="space-y-4 pb-20 font-sans select-none animate-fadeIn">

      {/* 1. AUTHENTIC SOCIAL COMMUNITY HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#0B0F16] border border-[#1A2538] shadow-hud relative overflow-hidden">
        {/* Subtle ambient glow */}
        <div className="absolute top-0 right-1/3 w-64 h-32 bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 font-mono tracking-tight">
                Quant Alpha Network
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                4,850 Online
              </span>
              <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-[#121A26] border border-[#1E2B3E]">
                5Y Cloud Audited
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Peer-to-peer quant alpha stream & 5-year server-verified algorithm marketplace
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2.5 relative z-10 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsPublishModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shadow-cyan-500/20 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Publish Strategy / EA</span>
          </button>
        </div>
      </div>

      {/* 2. TRENDING ALPHA TOPICS & QUICK TAGS RIBBON */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono no-scrollbar">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 shrink-0 font-bold flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>Trending:</span>
        </span>
        {[
          { tag: 'XAUUSD', label: 'Gold FVG' },
          { tag: 'EURUSD', label: 'Titan Breakout' },
          { tag: 'GBPUSD', label: 'London Open' },
          { tag: 'Scalping', label: 'SMC Setups' },
          { tag: 'Momentum', label: 'Breakouts' },
        ].map((item) => (
          <button
            key={item.tag}
            type="button"
            onClick={() => setSearchQuery(item.tag)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              searchQuery.toLowerCase() === item.tag.toLowerCase()
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-[#0B0F16] hover:bg-[#121A26] border-[#1A2538] hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300'
            }`}
          >
            <span className="text-cyan-400 font-bold">#{item.tag}</span>
            <span className="text-slate-500 text-[10px]">· {item.label}</span>
          </button>
        ))}
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-[11px] text-rose-400 hover:text-rose-300 underline font-mono shrink-0 ml-1 cursor-pointer"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* 3. SOCIAL FEED TABS & SEARCH CONTROLLER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#182334] pb-3">
        {/* Segmented Feed Tabs */}
        <div className="flex items-center gap-1 bg-[#090D14] p-1 rounded-xl border border-[#162130] overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>All Feed</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('open_source')}
            className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'open_source'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Open Source</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pro_ea')}
            className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'pro_ea'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Pro EAs (.ex5)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('top_rated')}
            className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'top_rated'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Top Rated (4.8+)</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search feed, pairs, quants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#090D14] border border-[#1E293B] rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50 font-mono min-h-[42px]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#090D14] border border-[#1E293B] rounded-xl px-2.5 py-2 text-xs font-mono text-slate-300 outline-none cursor-pointer min-h-[42px]"
          >
            <option value="ALL">All Categories</option>
            <option value="Scalping / SMC">Scalping / SMC</option>
            <option value="Breakout Momentum">Breakout Momentum</option>
            <option value="Trend Following">Trend Following</option>
            <option value="Mean Reversion">Mean Reversion</option>
          </select>
        </div>
      </div>

      {/* 4. MAIN FEED LAYOUT WITH BALANCED SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">
        {/* Left Column: Feed Composer + Post List (2 Cols on Desktop) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Feed Post Composer Card */}
          <div className="rounded-2xl bg-[#0B0F16] border border-[#1A2538] p-4 sm:p-5 shadow-hud space-y-3">
            <div className="flex items-start gap-3">
              <div className="relative shrink-0 mt-0.5">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=80"
                  alt="You"
                  className="w-9 h-9 rounded-full object-cover border border-cyan-500/40"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B0F16]" />
              </div>
              <textarea
                rows={2}
                placeholder="Share a quant hypothesis, trading session insight, or strategy breakdown..."
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                className="flex-1 bg-[#080C12] border border-[#1A2538] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50 font-sans resize-none transition-all"
              />
            </div>

            {/* Optional Image URL Input */}
            {isAttachingImage && (
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Paste chart image URL (TradingView or chart capture)..."
                  value={composerImageUrl}
                  onChange={(e) => setComposerImageUrl(e.target.value)}
                  className="flex-1 bg-[#080C12] border border-[#1A2538] rounded-xl px-3 py-1.5 text-xs font-mono text-slate-300 placeholder:text-slate-600 outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#141E2E]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAttachingImage((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isAttachingImage
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#121A26] border-[#1E2B3E] text-slate-400 hover:text-slate-200'
                  }`}
                  title="Attach chart image screenshot"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Chart</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#121A26] hover:bg-[#1A2538] border border-[#1E2B3E] text-slate-300 hover:text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Publish EA with 5Y verification"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Attach Strategy EA</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleComposerSubmit}
                disabled={!composerText.trim()}
                className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm shadow-cyan-500/20 active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </div>
          </div>

          {/* Posts Stream */}
          <div className="space-y-4">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <CommunityStrategyCard
                  key={post.id}
                  post={post}
                  currentUserUsername="SeniorQuant"
                  onLikeToggle={handleLikeToggle}
                  onFollowToggle={handleFollowToggle}
                  onOpenSandboxPreview={(strat) => setActiveSandboxStrategy(strat)}
                  onOpenDirectMessage={(author) => setActiveDmAuthor(author)}
                  onDeletePost={handleDeletePost}
                  onEditPost={handleEditPost}
                  onHidePost={handleHidePost}
                />
              ))
            ) : (
              <div className="rounded-2xl bg-[#0B0F16] border border-[#1A2538] p-8 text-center space-y-2 font-mono">
                <p className="text-slate-400 text-sm">No community algorithms matched your filter criteria.</p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('all');
                    setSearchQuery('');
                    setCategoryFilter('ALL');
                  }}
                  className="text-cyan-400 text-xs hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Community Telemetry, Leaderboard & Anti-Scam Guarantee */}
        <div className="space-y-4">
          {/* 1. Community Telemetry / Pulse Card */}
          <div className="rounded-2xl bg-[#0B0F16] border border-[#1A2538] p-4 shadow-hud space-y-3">
            <div className="flex items-center justify-between border-b border-[#162130] pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Community Telemetry
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Network
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="p-2.5 rounded-xl bg-[#080C12] border border-[#162130]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Verified Algos</div>
                <div className="text-sm sm:text-base font-bold text-cyan-300 mt-0.5">1,280+</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#080C12] border border-[#162130]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">5Y Audited</div>
                <div className="text-sm sm:text-base font-bold text-amber-400 mt-0.5">100%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#080C12] border border-[#162130]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Active Quants</div>
                <div className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5">4,850+</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#080C12] border border-[#162130]">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Cloud Volume</div>
                <div className="text-sm sm:text-base font-bold text-violet-400 mt-0.5">$14.2M</div>
              </div>
            </div>
          </div>

          {/* 2. Leaderboard: Top Community Creators */}
          <div className="rounded-2xl bg-[#0B0F16] border border-[#1A2538] p-4 shadow-hud space-y-3">
            <div className="flex items-center justify-between border-b border-[#162130] pb-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-400" />
                <span>Top Quant Creators</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500">5Y Score</span>
            </div>

            <div className="space-y-2.5">
              {[
                { name: 'Karim Al-Husseini', handle: 'KarimQuant', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&h=80&q=80', score: '99.4', algos: 4, followers: 320 },
                { name: 'Elena Voronova, CFA', handle: 'ElenaV', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=80&h=80&q=80', score: '98.8', algos: 6, followers: 512 },
                { name: 'David Chen', handle: 'DavidChen', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&h=80&q=80', score: '96.2', algos: 2, followers: 189 },
              ].map((creator, i) => (
                <div key={creator.handle} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-slate-500 font-bold w-3">{i + 1}</span>
                    <img src={creator.avatar} alt={creator.name} className="w-7 h-7 rounded-full object-cover border border-[#1F2B3E]" />
                    <div>
                      <div className="font-semibold text-slate-200 text-xs">{creator.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">@{creator.handle} · {creator.algos} algos</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFollowToggle(creator.handle)}
                    className="px-2 py-0.5 rounded-lg bg-[#121A26] hover:bg-[#1A2538] border border-[#1E2B3E] text-slate-300 hover:text-cyan-300 text-[10.5px] font-mono transition-colors cursor-pointer"
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </div>


          {/* 3. Institutional 5Y Verification Shield */}
          <div className="rounded-2xl bg-[#0B0F16] border border-amber-500/25 p-4 shadow-hud space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#162130] pb-2">
              <div className="flex items-center gap-1.5 text-amber-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                  5Y Verification Shield
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/25">
                ACTIVE
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#080C12] border border-[#162130]">
                <span className="text-slate-400">5Y Benchmark</span>
                <span className="text-emerald-400 font-bold">2021 – 2026</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#080C12] border border-[#162130]">
                <span className="text-slate-400">Anti-Cheat Scan</span>
                <span className="text-cyan-300 font-bold">0 Lookahead</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#080C12] border border-[#162130]">
                <span className="text-slate-400">Execution Node</span>
                <span className="text-amber-300 font-bold">Isolated DuckDB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {/* 1. Publish Strategy Modal */}
      <PublishStrategyModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        strategyName="gold_fvg_scalper"
        versionNum={4}
        initialCode={`// Gold FVG Scalper v4\n#property version "4.00"\ninput double RiskPercent = 1.0;`}
        initialMetrics={{ netProfit: 18450, winRate: 62.4, maxDrawdown: 6.8 }}
        testedSymbol="XAUUSD"
        onPublished={(newPost) => {
          setPosts((prev) => [newPost, ...prev]);
        }}
      />

      {/* 2. Cloud Sandbox Preview Modal (Pro EA Zero-Leak) */}
      <SandboxPreviewModal
        strategy={activeSandboxStrategy}
        onClose={() => setActiveSandboxStrategy(null)}
      />

      {/* 3. Direct Message Live Chat Drawer */}
      <DirectMessagesDrawer
        isOpen={Boolean(activeDmAuthor)}
        onClose={() => setActiveDmAuthor(null)}
        targetAuthor={activeDmAuthor}
      />
    </div>
  );
}

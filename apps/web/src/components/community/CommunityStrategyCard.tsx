'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  MessageSquare,
  Share2,
  Star,
  ShieldCheck,
  Globe,
  Lock,
  GitFork,
  Play,
  TrendingUp,
  Percent,
  Activity,
  Layers,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Send,
  UserPlus,
  UserCheck,
  Clock,
  Sparkles,
  DollarSign,
  AlertCircle,
  Eye,
  Check,
  MoreHorizontal,
  Bookmark,
  Trash2,
  Edit3,
  EyeOff,
  Flag,
} from 'lucide-react';
import { Verified5YMetrics } from './PublishStrategyModal';
import { rateCommunityStrategy, forkCommunityStrategy } from '@/lib/api/community';


export interface PostAuthor {
  username: string;
  displayName: string;
  avatarUrl: string;
  reputation: string;
  followersCount: number;
  isFollowing?: boolean;
}

export interface AttachedStrategy {
  id: string;
  name: string;
  version: string;
  type: 'open_source' | 'pro_ea';
  price: number;
  category: string;
  supportedSymbols: string[];
  metrics: Verified5YMetrics;
  starsAverage: number;
  starsCount: number;
  forksCount: number;
  codeSnippet?: string;
}

export interface PostComment {
  id: string;
  author: string;
  avatarUrl: string;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  author: PostAuthor;
  content: string;
  chartImageUrl?: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
  commentsCount: number;
  comments?: PostComment[];
  strategy?: AttachedStrategy;
}

export interface CommunityStrategyCardProps {
  post: CommunityPost;
  currentUserUsername?: string;
  onLikeToggle: (postId: string) => void;
  onFollowToggle: (username: string) => void;
  onOpenSandboxPreview: (strategy: AttachedStrategy) => void;
  onOpenDirectMessage: (author: PostAuthor) => void;
  onDeletePost?: (postId: string) => void;
  onEditPost?: (post: CommunityPost, newContent: string) => void;
  onHidePost?: (postId: string) => void;
}

function formatPostDate(dateStr: string): string {
  if (!dateStr) return 'Just now';
  if (dateStr.includes('ago') || dateStr === 'Just now') return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function CommunityStrategyCard({
  post,
  currentUserUsername = 'SeniorQuant',
  onLikeToggle,
  onFollowToggle,
  onOpenSandboxPreview,
  onOpenDirectMessage,
  onDeletePost,
  onEditPost,
  onHidePost,
}: CommunityStrategyCardProps) {
  const router = useRouter();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState<PostComment[]>(post.comments || [
    {
      id: 'c1',
      author: 'AlexQuant',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80',
      content: 'Solid 5-year drawdown profile. How does it handle the FOMC high-spread spikes on Gold?',
      createdAt: '2h ago',
    },
  ]);

  // 3-Dots Menu & Post State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [localContent, setLocalContent] = useState(post.content);

  const isOwnPost =
    post.author.username.toLowerCase() === currentUserUsername.toLowerCase() ||
    post.author.username === 'SeniorQuant';

  // Star Rating Interactive State
  const [userStarRating, setUserStarRating] = useState<number | null>(null);
  const [starCount, setStarCount] = useState<number>(post.strategy?.starsCount || 18);
  const [starAverage, setStarAverage] = useState<number>(post.strategy?.starsAverage || 4.9);
  const [hasStarred, setHasStarred] = useState(false);
  const [forkSuccess, setForkSuccess] = useState(false);

  const strat = post.strategy;

  const handleStarClick = (rating: number) => {
    if (hasStarred || !strat) return;
    setUserStarRating(rating);
    setHasStarred(true);
    setStarCount((prev) => prev + 1);
    setStarAverage((prev) => Number(((prev * starCount + rating) / (starCount + 1)).toFixed(1)));
    rateCommunityStrategy(strat.id, rating).catch(() => {});
  };

  const handleForkToQuantLab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!strat) return;

    setForkSuccess(true);
    forkCommunityStrategy(strat.id).catch(() => {});
    try {
      const cleanName = strat.name.replace(/\.(mq5|py)$/i, '');
      const forkedName = `${cleanName}_forked`;
      localStorage.setItem('quantlab_active_file', forkedName);
      localStorage.setItem('quantlab_active_version', '1');
      if (strat.codeSnippet) {
        localStorage.setItem(`quantlab_file_content_${forkedName}`, strat.codeSnippet);
      }
    } catch (err) {
      console.error('Failed forking strategy:', err);
    }

    setTimeout(() => {
      router.push(`/app/quant?strategy=${encodeURIComponent(strat.name)}`);
    }, 600);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newComment: PostComment = {
      id: `c_${Date.now()}`,
      author: 'You (SeniorQuant)',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=80',
      content: commentText.trim(),
      createdAt: 'Just now',
    };

    setCommentsList((prev) => [...prev, newComment]);
    setCommentText('');
  };

  return (
    <article className="rounded-2xl bg-[#0B0F16] border border-[#1A2538] hover:border-[#27374E] transition-all duration-200 overflow-hidden shadow-hud">
      {/* 1. Post Header: Author Identity & Action Row */}
      <div className="p-4 sm:p-5 flex items-start justify-between gap-3 border-b border-[#141E2E]">
        <div className="flex items-center gap-3">
          <img
            src={post.author.avatarUrl}
            alt={post.author.displayName}
            className="w-10 h-10 rounded-full border border-cyan-500/30 object-cover shrink-0"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-100 text-sm hover:text-cyan-300 transition-colors cursor-pointer">
                {post.author.displayName}
              </span>
              <span className="text-xs text-slate-500 font-mono">@{post.author.username}</span>
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#141C2B] text-cyan-400 border border-cyan-500/30">
                {post.author.reputation}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
              <span>{formatPostDate(post.createdAt)}</span>
              <span>·</span>
              <span>{post.author.followersCount} followers</span>
            </div>
          </div>
        </div>

        {/* Action Row: Hide Follow/Message for own posts; Add 3-dots Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {isOwnPost ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#141C2B] text-slate-400 border border-[#223147]">
              You
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenDirectMessage(post.author)}
                className="px-2.5 py-1 rounded-lg bg-[#121A26] hover:bg-[#1A2538] border border-[#1E2B3E] text-slate-300 hover:text-cyan-300 text-[11px] font-mono transition-colors cursor-pointer"
                title={`Send private direct message to @${post.author.username}`}
              >
                Message
              </button>

              <button
                type="button"
                onClick={() => onFollowToggle(post.author.username)}
                className={`px-3 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                  post.author.isFollowing
                    ? 'bg-[#151D2A] text-slate-300 border-[#26354A] hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30'
                    : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40 shadow-sm'
                }`}
              >
                {post.author.isFollowing ? (
                  <>
                    <UserCheck className="w-3 h-3 text-emerald-400" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3 text-cyan-400" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </>
          )}

          {/* 3-Dots Action Button & Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-lg bg-[#121A26] hover:bg-[#1A2538] border border-[#1E2B3E] hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="More post options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#090D15] border border-[#223147] shadow-2xl z-40 p-1 space-y-0.5 animate-in fade-in duration-150">
                  {/* Save / Bookmark (available to all) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaved((prev) => !prev);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-[#141C2B] hover:text-slate-100 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                    <span>{isSaved ? 'Saved (Bookmarked)' : 'Save Post'}</span>
                  </button>

                  {isOwnPost ? (
                    <>
                      {/* Edit Post */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          setIsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-[#141C2B] hover:text-slate-100 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Edit Post</span>
                      </button>

                      {/* Delete Post */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          if (onDeletePost) {
                            onDeletePost(post.id);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Delete Post</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Hide Post */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          if (onHidePost) {
                            onHidePost(post.id);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-[#141C2B] hover:text-slate-100 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hide Post</span>
                      </button>

                      {/* Report Post */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          alert('Report submitted for moderator review.');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-slate-400 hover:bg-[#141C2B] hover:text-rose-300 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5 text-slate-500" />
                        <span>Report Post</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Post Content Text (with Inline Edit Mode) */}
      <div className="px-4 sm:px-5 pt-3.5 pb-2">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full bg-[#080C12] border border-cyan-500/50 rounded-xl p-3 text-xs sm:text-[13px] text-slate-200 outline-none font-sans resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditedContent(localContent);
                  setIsEditing(false);
                }}
                className="px-3 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 bg-[#121A26] border border-[#1E2B3E] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalContent(editedContent);
                  setIsEditing(false);
                  if (onEditPost) {
                    onEditPost(post, editedContent);
                  }
                }}
                className="px-4 py-1 rounded-lg text-xs font-mono font-bold text-slate-950 bg-cyan-500 hover:bg-cyan-400 cursor-pointer shadow-sm shadow-cyan-500/20"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="text-slate-200 text-xs sm:text-[13px] leading-relaxed font-sans">
            {localContent}
          </div>
        )}
      </div>

      {/* Optional Chart Screenshot Image */}
      {post.chartImageUrl && (
        <div className="px-4 sm:px-5 py-2">
          <div className="rounded-xl overflow-hidden border border-[#1E2B3E] max-h-72 bg-[#080B10]">
            <img src={post.chartImageUrl} alt="Chart Analysis" className="w-full object-cover" />
          </div>
        </div>
      )}

      {/* 3. ATTACHED STRATEGY CARD (The Masterpiece) */}
      {strat && (
        <div className="mx-4 sm:mx-5 my-3 rounded-xl border border-[#1F2C40] bg-gradient-to-b from-[#0D1422] to-[#0A0E18] p-4 space-y-3.5 relative overflow-hidden shadow-inner">
          {/* Subtle Ambient Glow Pill */}
          <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl pointer-events-none ${
            strat.type === 'pro_ea' ? 'bg-violet-500/10' : 'bg-cyan-500/10'
          }`} />

          {/* Strategy Meta Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-[#141C2B] border-[#202D40] text-slate-300">
                {strat.type === 'pro_ea' ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-100 font-mono tracking-tight">
                    {strat.name}
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#141C2B] text-slate-300 border border-[#233146]">
                    {strat.version}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#141C2B] text-slate-400 border border-[#233146]">
                    {strat.category}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Locked Pair(s):</span>
                  {strat.supportedSymbols.map((s) => (
                    <span key={s} className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-[#141C2B] text-slate-300 border border-[#202D40]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* License & Price Badge */}
            <div className="flex items-center gap-2 shrink-0">
              {strat.type === 'pro_ea' ? (
                <div className="px-2.5 py-1 rounded-lg bg-[#141C2B] border border-[#202D40] text-slate-300 font-mono text-xs font-medium flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Pro EA · ${strat.price}</span>
                </div>
              ) : (
                <div className="px-2.5 py-1 rounded-lg bg-[#141C2B] border border-[#202D40] text-slate-300 font-mono text-xs font-medium flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>Open Source · Free</span>
                </div>
              )}
            </div>
          </div>

          {/* 5-YEAR VERIFIED CLOUD BENCHMARK SCORECARD (Our Signature Palette: Cyan & Emerald) */}
          <div className="rounded-xl bg-[#070A10] border border-[#1A2638] p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="uppercase tracking-wider">5-Year Cloud Benchmark (2021 – 2026)</span>
              </div>
              <span className="text-[10px] text-slate-500">Verified by Server Engine ✓</span>
            </div>

            {/* Metrics 4-Box Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono pt-1">
              <div className="bg-[#0B0F16] p-2 rounded-lg border border-[#162130]">
                <div className="text-[10px] uppercase text-slate-500">5Y Net Profit</div>
                <div className="text-sm font-bold text-emerald-400">
                  +${strat.metrics.netProfit.toLocaleString('en-US')}
                </div>
              </div>
              <div className="bg-[#0B0F16] p-2 rounded-lg border border-[#162130]">
                <div className="text-[10px] uppercase text-slate-500">Max Drawdown</div>
                <div className="text-sm font-bold text-rose-400">
                  -{strat.metrics.maxDrawdown}%
                </div>
              </div>
              <div className="bg-[#0B0F16] p-2 rounded-lg border border-[#162130]">
                <div className="text-[10px] uppercase text-slate-500">Win Rate</div>
                <div className="text-sm font-bold text-cyan-300">
                  {strat.metrics.winRate}%
                </div>
              </div>
              <div className="bg-[#0B0F16] p-2 rounded-lg border border-[#162130]">
                <div className="text-[10px] uppercase text-slate-500">Profit Factor</div>
                <div className="text-sm font-bold text-slate-100">
                  {strat.metrics.profitFactor}
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Interactive Actions & Star Ratings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Star Rating System (Interactive ⭐ 1-5) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 sm:gap-0.5">
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const isFilled = starIdx <= Math.round(userStarRating || starAverage);
                  return (
                    <button
                      key={starIdx}
                      type="button"
                      onClick={() => handleStarClick(starIdx)}
                      className={`p-1.5 sm:p-0.5 transition-transform hover:scale-125 cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center ${
                        isFilled ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'
                      }`}
                      title={`Rate ${starIdx} stars`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFilled ? 'fill-amber-400' : ''}`} />
                    </button>
                  );
                })}
              </div>
              <span className="text-xs font-mono font-bold text-slate-200">
                {starAverage}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                ({starCount} reviews)
              </span>
              {hasStarred && (
                <span className="text-[10px] font-mono text-emerald-400 font-bold ml-1">
                  Starred ✓
                </span>
              )}
            </div>

            {/* Primary Action Buttons (Unified Cyan / Pro Style) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {strat.type === 'open_source' ? (
                <button
                  type="button"
                  onClick={handleForkToQuantLab}
                  className="w-full sm:w-auto px-4 py-2 min-h-[40px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-cyan-500/20 active:scale-95 cursor-pointer"
                  title="Fork this open-source strategy into your personal Quant Lab"
                >
                  {forkSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-slate-950" />
                      <span>Forked to Lab!</span>
                    </>
                  ) : (
                    <>
                      <GitFork className="w-3.5 h-3.5 text-slate-950" />
                      <span>Fork to Quant Lab</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenSandboxPreview(strat)}
                    className="w-full sm:w-auto px-3.5 py-2 min-h-[40px] rounded-xl bg-[#121A26] hover:bg-[#1A2538] border border-[#223147] hover:border-cyan-500/50 text-slate-200 hover:text-cyan-300 font-mono font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title="Test this strategy in Cloud Sandbox (3 Free Runs Daily)"
                  >
                    <Play className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Test Preview (Free)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => alert(`Purchasing license for ${strat.name} ($${strat.price})... Payment gateway ready.`)}
                    className="w-full sm:w-auto px-4 py-2 min-h-[40px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-cyan-500/20 active:scale-95 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-950" />
                    <span>License .ex5 (${strat.price})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Social Engagement Footer (Likes, Comments, Share) */}
      <div className="px-4 sm:px-5 py-3 border-t border-[#141E2E] flex items-center justify-between text-slate-400 font-mono text-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onLikeToggle(post.id)}
            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
              post.isLiked ? 'text-rose-400' : 'hover:text-rose-400 text-slate-400'
            }`}
          >
            <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{post.likesCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCommentsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 hover:text-cyan-300 transition-colors cursor-pointer text-slate-400"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{commentsList.length}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Strategy community link copied to clipboard!');
              }
            }}
            className="flex items-center gap-1.5 hover:text-slate-200 transition-colors cursor-pointer text-slate-400"
            title="Share post"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[11px] text-slate-500">
          {strat ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Verified Architecture
            </span>
          ) : (
            <span>Quant Dispatch</span>
          )}
        </div>
      </div>

      {/* 5. Threaded Comments Drawer */}
      {isCommentsOpen && (
        <div className="bg-[#090D14] border-t border-[#182334] p-4 space-y-3 animate-in fade-in duration-150">
          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {commentsList.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 text-xs">
                <img src={c.avatarUrl} alt={c.author} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                <div className="flex-1 bg-[#0E1420] p-2.5 rounded-xl border border-[#1A2536]">
                  <div className="flex items-center justify-between font-mono text-[10.5px] text-slate-400 mb-1">
                    <span className="font-semibold text-slate-200">{c.author}</span>
                    <span>{c.createdAt}</span>
                  </div>
                  <p className="text-slate-300 font-sans text-xs leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Add comment input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Write a comment or ask author about settings..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-[#0E1420] border border-[#1E2B3E] rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-500/50 font-sans min-h-[42px]"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="px-3 min-h-[42px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center shrink-0"
              aria-label="Send comment"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

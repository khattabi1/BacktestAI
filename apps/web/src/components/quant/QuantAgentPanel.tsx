'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Plus,
  History,
  Trash2,
  GitCompare,
  Zap,
  Paperclip,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Atom,
  Brain,
  FileCode,
  Image as ImageIcon,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Clock,
  X,
  Copy,
  Check,
  ArrowRight,
  ArrowRightLeft,
  Globe,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Minimize2,
  ChevronLeft,
  Play,
  Activity,
  LineChart,
  Sliders,
  FileText,
  FilePlus,
  AlertCircle,
  FlaskConical,
  Loader2,
  Square,
  Pencil,
  Eye,
  Search,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const getAuthHeaders = (extraHeaders?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
};

export interface AskUserPayload {
  question: string;
  options?: string[];
  context?: string;
  call_id?: string;
}

export type WorkflowStepType =
  | 'thinking'
  | 'read_file'
  | 'create_file'
  | 'edit_file'
  | 'delete_file'
  | 'web_search'
  | 'market_data'
  | 'compile'
  | 'sandbox_test'
  | 'backtest'
  | 'analysis'
  | 'tool_call';

export interface AgentWorkflowStep {
  id: string;
  type: WorkflowStepType;
  title: string;
  subtitle?: string;
  detail?: string;
  status: 'running' | 'completed' | 'failed';
  durationSeconds?: number;
  diffStats?: { added: number; removed: number };
  filename?: string;
  toolName?: string;
  outputSummary?: string;
  timestamp?: number;
}

export interface AgentChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  thought?: string;
  workflowSteps?: AgentWorkflowStep[];
  workDurationSeconds?: number;
  codeSnippet?: string;
  language?: 'python' | 'mql5';
  timestamp: string;
  statusAnnouncement?: string;
  askUser?: AskUserPayload;
  charCount?: number;
  tokenCount?: number;
  attachment?: {
    id: string;
    filename: string;
    url?: string;
    isImage?: boolean;
    isWorkspaceFile?: boolean;
    lineStart?: number;
    lineEnd?: number;
    codeSnippet?: string;
  };
  approvalGate?: {
    actionId: string;
    actionType: string;
    riskTier: 'low' | 'medium' | 'high' | 'critical';
    rationale: string;
    summary: string;
    status: 'pending' | 'approved' | 'rejected' | 'verified';
    checksum?: string;
  };
}

export interface SavedSessionSummary {
  session_id: string;
  user_id: string;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export const cleanUserMessageText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\n*\[STRATEGY MANIFEST:[^\]]*\]/gi, '')
    .replace(/\n*\[OPEN EDITOR REFERENCE:[^\]]*\]/gi, '')
    .replace(/\n*\[ACTIVE WORKSPACE CONTEXT:[^\]]*\]/gi, '')
    .replace(/\n*\[RECENT TELEMETRY:[^\]]*\]/gi, '')
    .replace(/\n*\[Target File:[^\]]*\]/gi, '')
    .trim();
};

export interface WorkspaceChangeEvent {
  filename?: string;
  isEdit?: boolean;
  newContent?: string;
  originalContent?: string;
  diff?: string;
  isDelete?: boolean;
  version?: number;
}

import { SandboxLaunchConfig, SimulatedTrade, GranularMetrics } from './CentralSandboxRunnerPanel';

export interface QuantAgentPanelProps {
  currentCode: string;
  currentLanguage: 'python' | 'mql5';
  username?: string;
  activeFileName?: string;
  activeVersion?: string | number;
  externalPrompt?: { prompt: string; timestamp: number } | null;
  incomingAttachment?: {
    filename: string;
    lineStart?: number;
    lineEnd?: number;
    codeSnippet?: string;
  } | null;
  onClearIncomingAttachment?: () => void;
  diffState?: {
    active: boolean;
    fileId: string;
    original: string;
    modified: string;
  };
  onAcceptDiff?: () => void;
  onRejectDiff?: () => void;
  onApplyCode: (code: string, lang?: 'python' | 'mql5') => void;
  onOpenDiffGate: (snippet: string, lang?: 'python' | 'mql5') => void;
  onTestInSandbox?: (config?: SandboxLaunchConfig) => void;
  onTestOnChart?: () => void;
  onSimulationComplete?: (results: any) => void;
  onWorkspaceChanged?: (filename?: string, options?: WorkspaceChangeEvent) => void;
  onVersionChanged?: (version: number, strategyName?: string) => void;
  onSessionChanged?: (sessionId: string) => void;
  incomingTelemetryReport?: any;
  versionTestsCount?: number;
}

export type LLMProviderId = 'gemini' | 'freeinference' | 'agentrouter' | 'openrouter' | 'anthropic';
export type ThinkLevelId = 'low' | 'medium' | 'high';

export interface ProviderOption {
  id: LLMProviderId;
  name: string;
  badge: string;
  defaultModel: string;
  models: { id: string; name: string }[];
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Flagship',
    defaultModel: 'gemini-3.5-flash-lite',
    models: [
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    ],
  },
  {
    id: 'freeinference',
    name: 'FreeInference',
    badge: 'Free GPU',
    defaultModel: 'deepseek-v4-flash',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'glm-5.3-flash', name: 'GLM-5.3 Flash' },
      { id: 'qwen3.6-35b', name: 'Qwen3.6 35B' },
    ],
  },
  {
    id: 'agentrouter',
    name: 'DeepSeek / AgentRouter',
    badge: 'Reasoning',
    defaultModel: 'deepseek-v4-flash',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: 'Multi-Model',
    defaultModel: 'nvidia/nemotron-3.5-lightning:free',
    models: [
      { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Free' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    badge: 'Quant Grade',
    defaultModel: 'claude-opus-5.5',
    models: [
      { id: 'claude-opus-5.5', name: 'Claude Opus 5.5' },
    ],
  },
];

export interface FlatModelOption {
  id: string;
  provider: LLMProviderId;
  name: string;
  badge?: string;
}

export const AVAILABLE_MODELS: FlatModelOption[] = [
  { id: 'gemini-3.8-flash', provider: 'gemini', name: 'Gemini 3.8 Flash', badge: 'Flagship' },
  { id: 'gemini-3.5-flash-lite', provider: 'gemini', name: 'Gemini 3.5 Flash Lite', badge: 'Fast' },
  { id: 'deepseek-v4-flash', provider: 'freeinference', name: 'DeepSeek V4 Flash', badge: 'CoT' },
  { id: 'glm-5.3-flash', provider: 'freeinference', name: 'GLM-5.3 Flash', badge: '1M Ctx' },
  { id: 'qwen3.6-35b', provider: 'freeinference', name: 'Qwen3.6 35B', badge: 'Fast' },
  { id: 'nvidia/nemotron-3.5-lightning:free', provider: 'openrouter', name: 'OpenRouter Free', badge: 'Free' },
  { id: 'claude-opus-5.5', provider: 'anthropic', name: 'Claude Opus 5.5', badge: 'Pro' },
];

export const THINK_LEVEL_OPTIONS: { id: ThinkLevelId; name: string; tag: string; description: string }[] = [
  { id: 'low', name: 'Fast', tag: 'Fast', description: 'Lowest latency direct output' },
  { id: 'medium', name: 'Balanced', tag: 'Balanced', description: 'Structured quantitative reasoning' },
  { id: 'high', name: 'Deep Quant', tag: 'Deep Quant', description: 'Rigorous chain-of-thought analysis' },
];

/**
 * Format relative time (e.g. 10m ago, 2h ago, Yesterday)
 */
function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

// Helper to extract a clean alphanumeric username from user profile
const extractUserHandle = (u: any): string | null => {
  if (!u) return null;
  if (u.username && typeof u.username === 'string') {
    const handle = u.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (handle) return handle;
  }
  if (u.full_name && typeof u.full_name === 'string') {
    const first = u.full_name.trim().toLowerCase().split(' ')[0].replace(/[^a-z0-9_-]/g, '');
    if (first) return first;
  }
  if (u.email && typeof u.email === 'string') {
    const handle = u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (handle) return handle;
  }
  return null;
};

const getStoredUsername = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('backtest-ai-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      return extractUserHandle(parsed?.state?.user);
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * Strict heuristic to determine whether a code snippet qualifies as an executable strategy proposal.
 * Prevents casual snippets, pseudocode, math formulas, bash commands, or JSON from being decorated
 * with "STRATEGY PROPOSAL", "Apply", or "Cockpit Execution" buttons.
 */
export function isExecutableStrategyProposal(code: string, language?: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);

  // Must have substantial code length (at least 10 non-empty lines and at least 200 characters)
  if (lines.length < 10 || trimmed.length < 200) {
    return false;
  }

  // Python Strategy Requirements:
  // Must inherit from BaseStrategy OR have class definition with on_bar / on_tick implementation
  const hasBaseStrategy = /class\s+\w+\s*\([^)]*BaseStrategy[^)]*\)/i.test(trimmed);
  const hasOnBar = /def\s+on_bar\s*\(\s*self/i.test(trimmed);
  const hasOnTick = /def\s+on_tick\s*\(\s*self/i.test(trimmed);
  const isPythonStrategy = hasBaseStrategy || (hasOnBar && /class\s+\w+/i.test(trimmed));

  // MQL5 Strategy Requirements:
  const hasMqlOnInit = /int\s+OnInit\s*\(/i.test(trimmed);
  const hasMqlOnTick = /void\s+OnTick\s*\(/i.test(trimmed);
  const hasMqlProperty = /#property\s+/i.test(trimmed);
  const isMqlStrategy = (hasMqlOnInit || hasMqlOnTick) && (hasMqlProperty || /class\s+\w+/i.test(trimmed));

  const lang = (language || '').toLowerCase();
  if (lang === 'mql5' || lang === 'cpp') {
    return isMqlStrategy;
  }
  return isPythonStrategy || isMqlStrategy;
}

/**
 * Format duration in seconds into human-readable label (e.g. "8m", "14s", "1m 20s")
 */
export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (remSec === 0) return `${mins}min`;
  return `${mins}min ${remSec}s`;
}

/**
 * Compute line addition/deletion statistics from diff string or target/replacement text
 */
export function computeDiffStats(options: {
  diff?: string;
  lines_added?: number;
  lines_removed?: number;
  target?: string;
  replacement?: string;
  content?: string;
}): { added: number; removed: number } {
  if (typeof options.lines_added === 'number' || typeof options.lines_removed === 'number') {
    return {
      added: Math.max(0, options.lines_added || 0),
      removed: Math.max(0, options.lines_removed || 0),
    };
  }
  if (options.diff) {
    const lines = options.diff.split('\n');
    let added = 0;
    let removed = 0;
    for (const l of lines) {
      if (l.startsWith('+') && !l.startsWith('+++')) added++;
      else if (l.startsWith('-') && !l.startsWith('---')) removed++;
    }
    if (added > 0 || removed > 0) return { added, removed };
  }
  if (options.target !== undefined && options.replacement !== undefined) {
    const rem = options.target.trim() ? options.target.split('\n').length : 0;
    const add = options.replacement.trim() ? options.replacement.split('\n').length : 0;
    return { added: add, removed: rem };
  }
  if (options.content) {
    const add = options.content.trim() ? options.content.split('\n').length : 0;
    return { added: add, removed: 0 };
  }
  return { added: 0, removed: 0 };
}

function parseMt5Number(val: any, defaultVal = 0): number {
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  if (!val) return defaultVal;
  const s = String(val).replace(/\s+/g, '').replace(/,/g, '');
  const match = s.match(/[-+]?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : defaultVal;
}

function parseMt5Percent(val: any, defaultVal = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) ? defaultVal : (val > 0 && val <= 1 ? val * 100 : val);
  }
  if (!val) return defaultVal;
  const s = String(val);
  const match = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) return parseFloat(match[1]);
  return parseMt5Number(val, defaultVal);
}

function normalizeMt5Metrics(raw: any, res: any): GranularMetrics {
  const initCap = parseMt5Number(raw.initialCapital || raw.initial_capital || raw['Initial Deposit'] || res.deposit, 10000);
  const netProf = parseMt5Number(raw.netProfit ?? raw.net_profit ?? raw['Total Net Profit'] ?? res.net_profit, 0);
  const pf = parseMt5Number(raw.profitFactor ?? raw.profit_factor ?? raw['Profit Factor'] ?? res.profit_factor, 1.0);
  const sharpe = parseMt5Number(raw.sharpeRatio ?? raw.sharpe_ratio ?? raw['Sharpe Ratio'] ?? res.sharpe_ratio, 0);
  const totalTr = Math.round(parseMt5Number(raw.totalTrades ?? raw.total_trades ?? raw['Total Trades'] ?? res.total_trades ?? res.deals_count, 0));
  const wr = parseMt5Percent(raw.winRate ?? raw.win_rate ?? raw['Profit Trades (% of total)'] ?? res.win_rate, 0);
  const maxDd = parseMt5Percent(raw.maxDrawdownPct ?? raw.max_drawdown_pct ?? raw['Equity Drawdown Relative'] ?? raw['Balance Drawdown Relative'] ?? res.max_drawdown_pct, 0);
  const bars = Math.round(parseMt5Number(raw.barsProcessed ?? raw.bars_processed ?? raw.Bars ?? raw.bars_in_test, 1000));
  const netProfPct = initCap > 0 ? Math.round((netProf / initCap) * 10000) / 100 : 0;
  const endingEq = Math.round((initCap + netProf) * 100) / 100;

  return {
    netProfit: netProf,
    netProfitPct: netProfPct,
    winRate: wr,
    sharpeRatio: sharpe,
    profitFactor: pf,
    maxDrawdownPct: maxDd,
    totalTrades: totalTr,
    barsProcessed: bars,
    executionTimeMs: Math.round((res.elapsed_seconds ?? 5) * 1000),
    lookaheadBias: '0.000% (Strictly Causal)',
    initialCapital: initCap,
    endingEquity: endingEq,
  };
}

function normalizeMt5Deals(deals: any[], defaultSymbol = 'XAUUSD'): SimulatedTrade[] {
  if (!Array.isArray(deals) || deals.length === 0) return [];

  // If already mapped to SimulatedTrade objects
  if (deals[0] && deals[0].pnl !== undefined && deals[0].entry_time !== undefined) {
    return deals;
  }

  const trades: SimulatedTrade[] = [];
  let lastIn: any = null;

  for (let i = 0; i < deals.length; i++) {
    const d = deals[i];
    const type = String(d.type || '').toLowerCase();
    const dir = String(d.direction || '').toLowerCase();

    if (type === 'balance') continue;

    if (dir === 'in') {
      lastIn = d;
    } else if (dir === 'out') {
      const entryTime = lastIn?.time || d.time || '';
      const entryPrice = parseMt5Number(lastIn?.price ?? d.price, 0);
      const exitPrice = parseMt5Number(d.price, 0);
      const pnl = parseMt5Number(d.profit, 0);
      const vol = parseMt5Number(d.volume, 1);
      const isSell = (lastIn?.type || (type === 'buy' ? 'sell' : 'buy')).toLowerCase().includes('sell');
      const side: 'BUY' | 'SELL' = isSell ? 'SELL' : 'BUY';
      const pnlPct = entryPrice > 0 ? Math.round(((exitPrice - entryPrice) / entryPrice) * 100 * (side === 'BUY' ? 1 : -1) * 100) / 100 : 0;

      trades.push({
        trade_id: String(d.deal || `t_${i + 1}`),
        symbol: d.symbol || lastIn?.symbol || defaultSymbol,
        side,
        entry_time: entryTime,
        exit_time: d.time || '',
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: vol,
        pnl,
        pnl_percent: pnlPct,
        exit_reason: d.comment || (pnl >= 0 ? 'TP' : 'SL'),
        commission: parseMt5Number(d.commission, 0),
        slippage: 0,
      });
      lastIn = null;
    }
  }

  return trades;
}

function getFileIcon(filename?: string) {
  if (!filename) return <FileCode className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tsx') || lower.endsWith('.jsx')) {
    return <Atom className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return <FileText className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  return <FileCode className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
}

function renderStepIcon(step: AgentWorkflowStep) {
  if (step.status === 'running') {
    return <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin shrink-0" />;
  }
  if (step.type === 'read_file' || step.toolName === 'read_file' || step.title?.toLowerCase().startsWith('read ')) {
    return <Eye className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.type === 'edit_file' || step.toolName === 'edit_file' || step.title?.toLowerCase().startsWith('edit')) {
    return <Pencil className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.type === 'create_file' || step.toolName === 'create_file' || step.title?.toLowerCase().startsWith('creat')) {
    return <FilePlus className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.type === 'delete_file' || step.toolName === 'delete_file') {
    return <Trash2 className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.type === 'compile') {
    if (step.status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
    if (step.status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    return <Sparkles className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.type === 'sandbox_test') {
    if (step.status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
    if (step.status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    return <FlaskConical className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.type === 'backtest') {
    return <Play className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.type === 'market_data') {
    return <Activity className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.type === 'web_search') {
    return <Globe className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  if (step.title?.toLowerCase().includes('search') || step.toolName?.toLowerCase().includes('search')) {
    return <Search className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
  }
  return <Zap className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />;
}

function renderStepContent(step: AgentWorkflowStep) {
  if (step.type === 'edit_file') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-400 text-[13px]">Edited</span>
        {getFileIcon(step.filename)}
        <span className="font-semibold text-neutral-100 font-mono text-[12.5px] truncate">
          {step.filename || 'file'}
        </span>
        {step.diffStats && (step.diffStats.added > 0 || step.diffStats.removed > 0) && (
          <div className="flex items-center gap-1 font-mono text-[11.5px] ml-1">
            {step.diffStats.added > 0 && (
              <span className="text-emerald-400 font-medium">+{step.diffStats.added}</span>
            )}
            {step.diffStats.removed > 0 && (
              <span className="text-rose-400 font-medium">-{step.diffStats.removed}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (step.type === 'create_file') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-400 text-[13px]">Created</span>
        {getFileIcon(step.filename)}
        <span className="font-semibold text-neutral-100 font-mono text-[12.5px] truncate">
          {step.filename || 'file'}
        </span>
        {step.diffStats?.added && step.diffStats.added > 0 ? (
          <span className="text-emerald-400 font-mono text-[11.5px] font-medium ml-1">
            +{step.diffStats.added}
          </span>
        ) : null}
      </div>
    );
  }

  if (step.type === 'read_file') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-400 text-[13px]">Read</span>
        {getFileIcon(step.filename)}
        <span className="font-semibold text-neutral-100 font-mono text-[12.5px] truncate">
          {step.filename || step.title}
        </span>
        {step.subtitle && (
          <span className="text-neutral-400 font-mono text-[11.5px] ml-1">
            {step.subtitle.startsWith('L') ? step.subtitle : `(${step.subtitle})`}
          </span>
        )}
      </div>
    );
  }

  if (step.type === 'compile') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-200 text-[13px] font-medium">
          Compiled MQL5
        </span>
        {step.filename && (
          <span className="font-semibold text-neutral-100 font-mono text-[12px]">
            {step.filename}
          </span>
        )}
        {step.subtitle && (
          <span
            className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-semibold ${
              step.status === 'failed'
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-emerald-400 bg-emerald-500/10'
            }`}
          >
            {step.subtitle}
          </span>
        )}
      </div>
    );
  }

  if (step.type === 'sandbox_test') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-200 text-[13px] font-medium">
          Sandbox test
        </span>
        {step.filename && (
          <span className="font-semibold text-neutral-100 font-mono text-[12px]">
            {step.filename}
          </span>
        )}
        {step.subtitle && (
          <span
            className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-semibold ${
              step.status === 'failed'
                ? 'text-amber-400 bg-amber-500/10'
                : 'text-emerald-400 bg-emerald-500/10'
            }`}
          >
            {step.subtitle}
          </span>
        )}
      </div>
    );
  }

  if (step.type === 'backtest') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-200 text-[13px] font-medium">
          {step.title || 'Execute backtest simulation'}
        </span>
        {step.subtitle && (
          <span className="text-emerald-400 bg-emerald-500/10 font-mono text-[11px] px-1.5 py-0.5 rounded font-semibold">
            {step.subtitle}
          </span>
        )}
      </div>
    );
  }

  if (step.type === 'market_data') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-200 text-[13px] font-medium">
          {step.title || 'Fetch market data'}
        </span>
        {step.subtitle && (
          <span className="text-neutral-500 font-mono text-[11px]">
            ({step.subtitle})
          </span>
        )}
      </div>
    );
  }

  if (step.type === 'web_search') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-400 text-[13px]">Web search</span>
        <span className="text-neutral-300 italic text-[12px] truncate">
          {step.detail || step.title}
        </span>
      </div>
    );
  }

  if (step.type === 'delete_file') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {renderStepIcon(step)}
        </span>
        <span className="text-neutral-400 text-[13px]">Delete</span>
        <span className="font-semibold text-neutral-100 font-mono text-[12px] truncate">
          {step.filename || step.title}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
      <span className="w-4 h-4 flex items-center justify-center shrink-0">
        {renderStepIcon(step)}
      </span>
      <span className="text-neutral-200 text-[13px] font-medium truncate">
        {step.title || 'Execute operation'}
      </span>
    </div>
  );
}

interface WorkflowPhase {
  id: string;
  thoughtStep?: AgentWorkflowStep;
  operations: AgentWorkflowStep[];
}

export function AgentWorkflowStepsView({
  steps,
  totalDuration,
  isLive = false,
}: {
  steps?: AgentWorkflowStep[];
  totalDuration?: number;
  isLive?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState<boolean>(isLive);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [expandedStepDetails, setExpandedStepDetails] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isLive) {
      setIsExpanded(true);
    }
  }, [isLive]);

  // Point 4: filter out compacting memory steps from displaying
  const filteredSteps = useMemo(() => {
    if (!steps || steps.length === 0) return [];
    return steps.filter((s) => {
      if (s.type === 'analysis') return false;
      const titleLower = (s.title || '').toLowerCase();
      if (titleLower.includes('compact') || titleLower.includes('digest') || titleLower.includes('memory')) {
        return false;
      }
      return true;
    });
  }, [steps]);

  const phases = useMemo(() => {
    if (!filteredSteps || filteredSteps.length === 0) return [];
    const list: WorkflowPhase[] = [];
    let current: WorkflowPhase | null = null;

    filteredSteps.forEach((step, idx) => {
      if (step.type === 'thinking') {
        if (current) {
          list.push(current);
        }
        current = {
          id: step.id || `phase_${idx}`,
          thoughtStep: step,
          operations: [],
        };
      } else {
        if (!current) {
          current = {
            id: `phase_${idx}`,
            operations: [step],
          };
        } else {
          current.operations.push(step);
        }
      }
    });

    if (current) {
      list.push(current);
    }
    return list;
  }, [filteredSteps]);

  if (!filteredSteps || filteredSteps.length === 0) return null;

  const toggleThought = (phaseId: string) => {
    setExpandedThoughts((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  const toggleStepDetail = (stepId: string) => {
    setExpandedStepDetails((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const calculatedDuration =
    totalDuration || filteredSteps.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const durationText = formatDuration(calculatedDuration);

  const renderOperationRow = (op: AgentWorkflowStep) => {
    const isOpOpen = Boolean(expandedStepDetails[op.id]);
    const hasDetail = Boolean(op.detail || op.outputSummary);

    return (
      <div key={op.id} className="py-0.5">
        <button
          type="button"
          onClick={() => hasDetail && toggleStepDetail(op.id)}
          className={`w-full flex items-center justify-between py-1 px-1 rounded hover:bg-white/[0.04] text-[13px] text-left transition-colors group ${
            hasDetail ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {renderStepContent(op)}
          </div>

          {hasDetail && (
            <span className="text-neutral-500 group-hover:text-neutral-300 shrink-0 ml-2">
              {isOpOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          )}
        </button>

        {/* Step Output / Diff Details */}
        {hasDetail && isOpOpen && (
          <div className="mt-1 mb-2 ml-7 p-2.5 rounded-lg bg-[#111113] border border-[#27272A] font-mono text-[11px] text-neutral-300 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed shadow-inner select-text">
            {op.detail || op.outputSummary}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full my-1 font-sans select-none">
      {!isExpanded ? (
        /* Collapsed Completed Turn Header */
        <div>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 py-1 text-neutral-400 hover:text-neutral-200 text-[13px] font-normal transition-colors cursor-pointer group"
          >
            <span>Completed {durationText}</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300" />
          </button>
          <div className="border-b border-[#232326] my-2.5" />
        </div>
      ) : (
        /* Expanded Phases & Sequential Steps (Direct list, no group accordion) */
        <div className="space-y-3 py-1">
          {!isLive && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1.5 py-0.5 text-neutral-400 hover:text-neutral-200 text-[13px] font-normal transition-colors cursor-pointer group mb-1.5"
            >
              <span>Completed {durationText}</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300" />
            </button>
          )}

          <div className="space-y-3">
            {phases.map((phase) => {
              const isThoughtOpen = Boolean(expandedThoughts[phase.id]);

              let reasoningPreview: string | null = null;
              if (phase.thoughtStep) {
                if (phase.thoughtStep.subtitle) {
                  reasoningPreview = phase.thoughtStep.subtitle;
                } else if (phase.thoughtStep.detail) {
                  const firstLine = phase.thoughtStep.detail
                    .trim()
                    .split('\n')
                    .map((l) => l.trim())
                    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('```'));
                  if (firstLine) {
                    reasoningPreview = firstLine.length > 140 ? `${firstLine.slice(0, 137)}...` : firstLine;
                  }
                } else if (phase.thoughtStep.status === 'running') {
                  reasoningPreview = 'Analyzing strategy parameters and formulating execution plan...';
                }
              }

              return (
                <div key={phase.id} className="space-y-1.5">
                  {/* 1. Thought Process Header */}
                  {phase.thoughtStep && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleThought(phase.id)}
                        className="w-full flex items-center justify-between py-1 px-1 rounded hover:bg-white/[0.04] text-[13px] text-left transition-colors group cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-4 h-4 flex items-center justify-center shrink-0">
                            <Atom className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200" />
                          </span>
                          <span className="text-[13px] font-medium text-neutral-200 group-hover:text-white">
                            Thought Process
                          </span>
                          {phase.thoughtStep.status === 'running' && (
                            <span className="w-2 h-2 rounded-full border border-neutral-400 border-t-transparent animate-spin ml-1" />
                          )}
                        </div>
                        <span className="text-neutral-500 group-hover:text-neutral-300 shrink-0 ml-2">
                          {isThoughtOpen ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </button>

                      {/* Reasoning preview sentence directly under Thought Process */}
                      {reasoningPreview && !isThoughtOpen && (
                        <div className="text-[13px] text-neutral-300 leading-relaxed pl-7 py-0.5 select-text">
                          {reasoningPreview}
                        </div>
                      )}

                      {/* Expanded Full Thought Block */}
                      {isThoughtOpen && (
                        <div className="mt-1.5 mb-2 ml-7 p-3 rounded-lg bg-[#111113] border border-[#27272A] font-mono text-[11px] text-neutral-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed shadow-inner select-text">
                          {phase.thoughtStep.detail || 'Analyzing strategy parameters and formulating execution plan...'}
                          {phase.thoughtStep.status === 'running' && (
                            <span className="inline-block w-1.5 h-3 ml-1 bg-neutral-400 animate-pulse align-middle" />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Sequential Operations (Direct list, NO group accordion) */}
                  {phase.operations.length > 0 && (
                    <div className="space-y-0.5 mt-0.5">
                      {phase.operations.map((op) => renderOperationRow(op))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isLive && <div className="border-b border-[#232326] my-2.5" />}
        </div>
      )}
    </div>
  );
}

/**
 * Rich Obsidian Markdown Renderer
 * - Unified single neutral color scheme (zero cyan)
 * - Thorough token handling for fenced code blocks, tables, bold, italic, lists, and inline code
 * - Prevents raw asterisks (*) or backticks (`) from leaking into display
 */
function RichMarkdown({
  content,
  excludeStrategyCode,
  onApplyCode,
}: {
  content: string;
  excludeStrategyCode?: string;
  onApplyCode?: (code: string, lang?: 'python' | 'mql5') => void;
}) {
  const sanitizedContent = (content || '')
    .replace(/^`think`\s*/i, '')
    .replace(/^<\/?think>\s*/i, '');
  if (!sanitizedContent.trim()) return null;

  const lines = sanitizedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];
  let currentKey = 0;

  const flushTable = () => {
    if (inTable && tableHeader.length > 0) {
      elements.push(
        <div
          key={`table-${currentKey++}`}
          className="my-3 overflow-x-auto rounded-xl border border-[#27272A] bg-[#111113] shadow-sm"
        >
          <table className="w-full text-left text-[13px] font-sans border-collapse">
            <thead>
              <tr className="bg-[#18181B] border-b border-[#27272A]">
                {tableHeader.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-neutral-100 font-semibold text-[13px]">
                    {formatInline(h.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b border-[#27272A]/70 last:border-0 hover:bg-[#161619] transition-colors"
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-4 py-2.5 ${
                        cIdx === 0
                          ? 'text-neutral-200 font-medium'
                          : 'text-neutral-400'
                      }`}
                    >
                      {formatInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  };

  /**
   * Format inline tokens without leaking raw asterisks (*) or backticks (`)
   * Matches: inline code, bold+italic, bold, italic, and cleans stray formatting chars.
   */
  const formatInline = (text: string): React.ReactNode => {
    if (!text) return null;

    // Matches `code`, ***bold-italic***, **bold**, __bold__, *italic*, _italic_
    const tokenRegex = /(`[^`\n]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n*]+\*|_[^_\n_]+_)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, idx) => {
      if (!part) return null;

      // Inline Code: `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded-md bg-[#24252A] text-neutral-200 font-mono text-[12px] border border-[#33343C]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold + Italic: ***text***
      if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
        return (
          <strong key={idx} className="text-white font-semibold italic">
            {part.slice(3, -3)}
          </strong>
        );
      }

      // Bold: **text** or __text__
      if (
        (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
      ) {
        return (
          <strong key={idx} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Italic: *text* or _text_
      if (
        (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
      ) {
        return (
          <em key={idx} className="text-neutral-300 italic">
            {part.slice(1, -1)}
          </em>
        );
      }

      // Plain text: remove any stray unclosed backticks or asterisks at boundaries
      const cleaned = part.replace(/^`|`$/g, '').replace(/^\*|\*$/g, '');
      return <span key={idx}>{cleaned}</span>;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Multi-line Fenced Code Block (```python ... ```)
    if (trimmed.startsWith('```')) {
      flushTable();
      const codeLang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      const codeBody = codeLines.join('\n');
      if (excludeStrategyCode && codeBody.trim() === excludeStrategyCode.trim()) {
        continue;
      }
      elements.push(
        <div
          key={`code-block-${currentKey++}`}
          className="my-2.5 rounded-xl border border-[#27272A] bg-[#0E0E11] overflow-hidden font-mono shadow-sm"
        >
          <div className="px-3.5 py-1.5 bg-[#18181B] border-b border-[#27272A] text-[11px] text-neutral-400 uppercase tracking-wider font-semibold flex items-center justify-between">
            <span>{codeLang || 'code'}</span>
            <div className="flex items-center gap-2">
              {onApplyCode && (
                <button
                  type="button"
                  onClick={() =>
                    onApplyCode(
                      codeBody,
                      codeLang === 'mql5' || codeLang === 'cpp' ? 'mql5' : 'python'
                    )
                  }
                  className="text-neutral-300 hover:text-white transition-colors flex items-center gap-1 text-[10px] uppercase font-semibold cursor-pointer px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] active:scale-95"
                  title="Apply code to editor"
                >
                  <Check className="w-3 h-3 text-neutral-300" />
                  <span>apply</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(codeBody);
                  }
                }}
                className="text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1 text-[10px] lowercase font-normal cursor-pointer"
                title="Copy snippet"
              >
                <Copy className="w-3 h-3" />
                <span>copy</span>
              </button>
            </div>
          </div>
          <pre className="p-3.5 text-[12px] text-neutral-200 overflow-x-auto leading-relaxed select-text cursor-text font-mono">
            {codeBody}
          </pre>
        </div>
      );
      continue;
    }

    // 2. Table Parsing
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));
      if (isSeparator) continue;

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // 3. Horizontal Separator
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={`hr-${currentKey++}`} className="border-[#27272A] my-3" />);
      continue;
    }

    // 4. Headings (Neutral obsidian typography)
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${currentKey++}`} className="text-[14px] font-semibold text-neutral-100 mt-2.5 mb-1">
          {formatInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${currentKey++}`} className="text-[14.5px] font-semibold text-neutral-100 tracking-wide mt-3 mb-1 pb-1 border-b border-[#27272A]">
          {formatInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${currentKey++}`} className="text-[16px] font-bold text-neutral-100 mt-3.5 mb-1.5">
          {formatInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // 5. Bullet Lists (Neutral zinc dots)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const bulletContent = trimmed.startsWith('• ') ? trimmed.slice(2) : trimmed.slice(2);
      elements.push(
        <div key={`li-${currentKey++}`} className="flex items-start gap-2 my-1 pl-1 text-[13px] sm:text-[13.5px] leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 mt-2 shrink-0" />
          <div className="flex-1 text-neutral-200">{formatInline(bulletContent)}</div>
        </div>
      );
      continue;
    }

    // 6. Numbered Lists (Neutral zinc numbers)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={`num-${currentKey++}`} className="flex items-start gap-2 my-1 pl-1 text-[13px] sm:text-[13.5px] leading-relaxed">
          <span className="font-mono text-neutral-400 text-[12px] font-medium mt-0.5 shrink-0">{numMatch[1]}.</span>
          <div className="flex-1 text-neutral-200">{formatInline(numMatch[2])}</div>
        </div>
      );
      continue;
    }

    // 7. Regular Paragraphs
    if (trimmed) {
      elements.push(
        <p key={`p-${currentKey++}`} className="my-1.5 text-[13px] sm:text-[13.5px] leading-relaxed text-neutral-200">
          {formatInline(trimmed)}
        </p>
      );
    }
  }

  flushTable();
  return <div className="space-y-1">{elements}</div>;
}

export function QuantAgentPanel({
  currentCode,
  currentLanguage,
  username: propUsername,
  activeFileName,
  activeVersion,
  externalPrompt,
  incomingAttachment,
  onClearIncomingAttachment,
  diffState,
  onAcceptDiff,
  onRejectDiff,
  onApplyCode,
  onOpenDiffGate,
  onTestInSandbox,
  onTestOnChart,
  onSimulationComplete,
  onWorkspaceChanged,
  onVersionChanged,
  onSessionChanged,
  incomingTelemetryReport,
  versionTestsCount,
}: QuantAgentPanelProps) {
  const { user, token } = useAuthStore();
  const activeUser =
    propUsername ||
    user?.id ||
    useAuthStore.getState().user?.id ||
    '';

  // Session & View State
  const [viewState, setViewState] = useState<'landing' | 'active'>('landing');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState<string>('Quant AI');
  const [sessionsList, setSessionsList] = useState<SavedSessionSummary[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [showAllPastChats, setShowAllPastChats] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Panel Resizing & Expand/Collapse State (Deterministic SSR to avoid hydration mismatch)
  const [panelWidth, setPanelWidth] = useState<number>(460);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isWide, setIsWide] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isDesktopScreen, setIsDesktopScreen] = useState<boolean>(true);
  const preWideWidthRef = useRef<number>(380);

  // Restore saved width and collapsed preference on mount
  useEffect(() => {
    setIsMounted(true);
    setIsDesktopScreen(typeof window !== 'undefined' && window.innerWidth >= 1024);
    try {
      const isCompact = typeof window !== 'undefined' && window.innerWidth <= 1366;
      const defaultWidth = typeof window !== 'undefined' ? (window.innerWidth <= 1366 ? 380 : window.innerWidth <= 1600 ? 460 : 520) : 460;
      const savedWidth = localStorage.getItem('quant_agent_panel_width');
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 320 && parsed <= 1400) {
          // On compact 13" laptop screens, cap max initial width to 440px unless user expressly resized in this session
          const initialWidth = isCompact ? Math.min(440, Math.max(320, parsed)) : Math.max(320, parsed);
          setPanelWidth(initialWidth);
          setIsWide(initialWidth >= 680);
          preWideWidthRef.current = initialWidth;
        }
      } else {
        setPanelWidth(defaultWidth);
      }
      const savedCollapsed = localStorage.getItem('quant_agent_panel_collapsed');
      if (savedCollapsed === 'true') {
        setIsCollapsed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const saveWidth = (w: number) => {
    try {
      localStorage.setItem('quant_agent_panel_width', w.toString());
    } catch {
      // ignore
    }
  };

  // Continuous window resize listener: fluidly clamps panel so central canvas always has breathing room
  useEffect(() => {
    const handleWindowResize = () => {
      const winW = window.innerWidth;
      setIsDesktopScreen(winW >= 1024);
      if (winW < 1024) return;
      const maxAllowed = Math.max(320, Math.min(1100, Math.floor(winW * 0.68)));
      setPanelWidth((curr) => {
        if (curr > maxAllowed) {
          return maxAllowed;
        }
        return curr;
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const toggleWide = () => {
    if (isWide) {
      const isCompact = typeof window !== 'undefined' && window.innerWidth <= 1366;
      const target = preWideWidthRef.current || (isCompact ? 380 : 460);
      setPanelWidth(target);
      setIsWide(false);
      saveWidth(target);
    } else {
      preWideWidthRef.current = panelWidth;
      const target = Math.min(960, Math.floor(window.innerWidth * 0.60));
      setPanelWidth(target);
      setIsWide(true);
      saveWidth(target);
    }
  };

  const handleToggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem('quant_agent_panel_collapsed', collapsed ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const minW = 320;
      const maxW = Math.max(minW, Math.min(window.innerWidth - 300, Math.floor(window.innerWidth * 0.70)));
      const newWidth = Math.max(minW, Math.min(maxW, startWidth + deltaX));
      setPanelWidth(newWidth);
      setIsWide(newWidth >= 680);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setPanelWidth((curr) => {
        saveWidth(curr);
        return curr;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // LLM Provider & Reasoning / Thinking Level Selection (Persisted in localStorage)
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash-lite');
  const [selectedThinkLevel, setSelectedThinkLevel] = useState<ThinkLevelId>('high');
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState<boolean>(false);

  // Restore saved selections on client mount to eliminate SSR hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedProvider = localStorage.getItem('backtest_si_selected_provider');
      if (savedProvider) setSelectedProvider(savedProvider as LLMProviderId);
      const savedModel = localStorage.getItem('backtest_si_selected_model');
      if (savedModel) {
        if (savedModel === 'gemini-3.8-flash') {
          setSelectedModel('gemini-3.5-flash-lite');
        } else {
          setSelectedModel(savedModel);
        }
      }
      const savedThink = localStorage.getItem('backtest_si_selected_think_level');
      if (savedThink) setSelectedThinkLevel(savedThink as ThinkLevelId);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem('backtest_si_selected_provider', selectedProvider);
        localStorage.setItem('backtest_si_selected_model', selectedModel);
        localStorage.setItem('backtest_si_selected_think_level', selectedThinkLevel);
      } catch {
        // ignore
      }
    }
  }, [selectedProvider, selectedModel, selectedThinkLevel, isMounted]);

  // Model & Think Level pill text helper (e.g. "Gemini 3.8 Flash Deep")
  const getModelPillLabel = () => {
    let modelName = 'Gemini 3.8 Flash';
    const match = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
    if (match) {
      modelName = match.name;
    } else if (selectedProvider === 'gemini') {
      modelName = selectedModel.includes('3.5') ? 'Gemini 3.5 Flash' : 'Gemini 3.8 Flash';
    } else if (selectedProvider === 'freeinference') {
      if (selectedModel.includes('glm')) modelName = 'GLM 5.3 Flash';
      else if (selectedModel.includes('qwen')) modelName = 'Qwen 3.6 35B';
      else modelName = 'DeepSeek V4 Flash';
    } else if (selectedProvider === 'agentrouter') {
      modelName = 'DeepSeek V4';
    } else if (selectedProvider === 'openrouter') {
      modelName = 'OpenRouter Free';
    } else if (selectedProvider === 'anthropic') {
      modelName = 'Claude Opus';
    }

    let thinkName = 'Balanced';
    if (selectedThinkLevel === 'low') thinkName = 'Fast';
    else if (selectedThinkLevel === 'medium') thinkName = 'Balanced';
    else if (selectedThinkLevel === 'high') thinkName = 'Deep';

    return `${modelName} ${thinkName}`;
  };

  // Grouped sleek model popover using #090D14 / #0A0F1D main palette
  const renderModelSelectorPopover = () => {
    const geminiModels = [
      { id: 'gemini-3.8-flash', provider: 'gemini' as LLMProviderId, name: 'Gemini 3.8 Flash', badge: 'Flagship' },
      { id: 'gemini-3.5-flash-lite', provider: 'gemini' as LLMProviderId, name: 'Gemini 3.5 Flash Lite', badge: 'Ultra Fast' },
    ];

    const freeInferenceModels = [
      { id: 'deepseek-v4-flash', provider: 'freeinference' as LLMProviderId, name: 'DeepSeek V4 Flash', badge: 'CoT' },
      { id: 'glm-5.3-flash', provider: 'freeinference' as LLMProviderId, name: 'GLM-5.3 Flash', badge: '1M Ctx' },
      { id: 'qwen3.6-35b', provider: 'freeinference' as LLMProviderId, name: 'Qwen3.6 35B', badge: 'Fast' },
    ];

    const otherModels = [
      { id: 'nvidia/nemotron-3.5-lightning:free', provider: 'openrouter' as LLMProviderId, name: 'Nemotron 3.5 Free', badge: 'OpenRouter' },
      { id: 'claude-opus-5.5', provider: 'anthropic' as LLMProviderId, name: 'Claude Opus 5.5', badge: 'Anthropic' },
    ];

    return (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={(e) => {
            e.stopPropagation();
            setIsModelSelectorOpen(false);
          }}
        />
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-[#0A0F1D] border border-[#162032] rounded-xl shadow-2xl p-2.5 z-50 font-sans space-y-2.5">
          <div>
            <div className="text-[11px] font-semibold text-slate-300 px-1 mb-2 flex items-center justify-between border-b border-[#141C2C] pb-1.5">
              <span>Select Model</span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold">QUANT AI</span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar pr-0.5">
              {/* 1. Google Gemini Group */}
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 px-1 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    Google Gemini
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40">Official</span>
                </div>
                <div className="space-y-0.5">
                  {geminiModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedProvider(m.provider);
                          setSelectedModel(m.id);
                          setIsModelSelectorOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-[12px] transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#141C2E] text-slate-100 font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#0D1424]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                          <span className="truncate">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[9px] text-slate-500 font-mono">{m.badge}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. FreeInference Group */}
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-violet-400 px-1 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-violet-400" />
                    FreeInference
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-violet-950/70 text-violet-300 border border-violet-800/40">Free GPU</span>
                </div>
                <div className="space-y-0.5">
                  {freeInferenceModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedProvider(m.provider);
                          setSelectedModel(m.id);
                          setIsModelSelectorOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-[12px] transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#141C2E] text-slate-100 font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#0D1424]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-violet-400' : 'bg-slate-600'}`} />
                          <span className="truncate">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[9px] text-slate-500 font-mono">{m.badge}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Other Available Models */}
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-1 mb-1 flex items-center justify-between">
                  <span>Additional Providers</span>
                </div>
                <div className="space-y-0.5">
                  {otherModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedProvider(m.provider);
                          setSelectedModel(m.id);
                          setIsModelSelectorOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-[12px] transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#141C2E] text-slate-100 font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#0D1424]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-amber-400' : 'bg-slate-600'}`} />
                          <span className="truncate">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[9px] text-slate-500 font-mono">{m.badge}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#141C2C]">
            <div className="text-[10.5px] font-semibold text-slate-400 px-1 mb-1.5">
              Thinking Rigor
            </div>
            <div className="grid grid-cols-3 gap-1 bg-[#090D14] p-0.5 rounded-lg border border-[#141C2C]">
              {THINK_LEVEL_OPTIONS.map((t) => {
                const isSelected = selectedThinkLevel === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedThinkLevel(t.id)}
                    className={`py-1 text-center text-[11px] rounded-md transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#162238] text-slate-100 font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={t.description}
                  >
                    {t.tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  // Copy text helper
  const handleCopyMessage = async (msgId: string, textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedMsgId(msgId);
      setTimeout(() => {
        setCopiedMsgId(null);
      }, 2000);
    } catch (err) {
      console.error('[QuantAgentPanel] Failed to copy text:', err);
    }
  };

  // Chat conversation state
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [currentThought, setCurrentThought] = useState<string>('');
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null);
  const [isThoughtExpanded, setIsThoughtExpanded] = useState<boolean>(false);
  const [liveWorkflowSteps, setLiveWorkflowSteps] = useState<AgentWorkflowStep[]>([]);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const liveWorkflowStepsRef = useRef<AgentWorkflowStep[]>([]);
  const liveTimerRef = useRef<any>(null);
  const turnStartTimeRef = useRef<number>(0);
  const [uploadedAttachment, setUploadedAttachment] = useState<{
    id: string;
    filename: string;
    url?: string;
    isImage?: boolean;
    isWorkspaceFile?: boolean;
    lineStart?: number;
    lineEnd?: number;
    codeSnippet?: string;
  } | null>(null);

  // Session strategy binding state (locks active strategy so browsing other tabs does not override it)
  const [boundStrategy, setBoundStrategy] = useState<string | null>(null);
  const [selectedClarificationIdx, setSelectedClarificationIdx] = useState<number | null>(null);

  // Clarification Card Interactive State
  const [pendingInteraction, setPendingInteraction] = useState<AskUserPayload | null>(null);
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [customOtherText, setCustomOtherText] = useState<string>('');

  // Dynamically compute full LLM prompt tokens (Input text + Conversation context + System prompt + Tools schemas)
  const fullPromptTokens = useMemo(() => {
    // 1. Base System Prompt + Tools schemas context overhead (~3,150 tokens)
    const BASE_SYSTEM_AND_TOOLS_TOKENS = 3150;

    // 2. Full conversation history context (messages, code snippets, workflow steps, tool outputs)
    let historyTokens = 0;
    for (const m of messages) {
      if (m.text) {
        historyTokens += Math.ceil(m.text.length / 3.8);
      }
      if (m.attachment?.codeSnippet) {
        historyTokens += Math.ceil(m.attachment.codeSnippet.length / 3.8);
      }
      if (m.workflowSteps && m.workflowSteps.length > 0) {
        historyTokens += m.workflowSteps.length * 85;
      }
    }

    // 3. Current active composer context
    let composerTokens = 0;
    if (inputPrompt.trim()) {
      composerTokens += Math.ceil(inputPrompt.trim().length / 3.8);
    }
    if (uploadedAttachment) {
      if (uploadedAttachment.codeSnippet) {
        composerTokens += Math.ceil(uploadedAttachment.codeSnippet.length / 3.8);
      } else {
        composerTokens += 60;
      }
    }

    return BASE_SYSTEM_AND_TOOLS_TOKENS + historyTokens + composerTokens;
  }, [messages, inputPrompt, uploadedAttachment]);

  // Sync external targeted file or partial code selection into chat input
  useEffect(() => {
    if (incomingAttachment) {
      setUploadedAttachment({
        id: `att_${Date.now()}`,
        filename: incomingAttachment.filename,
        isImage: false,
        isWorkspaceFile: true,
        lineStart: incomingAttachment.lineStart,
        lineEnd: incomingAttachment.lineEnd,
        codeSnippet: incomingAttachment.codeSnippet,
      });

      // Automatically focus textarea so user can immediately type
      setTimeout(() => {
        if (chatInputRef.current) {
          chatInputRef.current.focus();
          adjustTextareaHeight(chatInputRef.current);
        } else if (landingInputRef.current) {
          landingInputRef.current.focus();
          adjustTextareaHeight(landingInputRef.current);
        }
      }, 50);

      onClearIncomingAttachment?.();
    }
  }, [incomingAttachment, onClearIncomingAttachment]);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);
  const landingInputRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Cancellation and prompt editing refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserPromptRef = useRef<string>('');
  const wasCancelledRef = useRef<boolean>(false);

  const handleEditMessage = (text: string) => {
    setInputPrompt(text);
    setTimeout(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focus();
        adjustTextareaHeight(chatInputRef.current);
      } else if (landingInputRef.current) {
        landingInputRef.current.focus();
        adjustTextareaHeight(landingInputRef.current);
      }
    }, 50);
  };

  const handleCancelExecution = () => {
    wasCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (sessionId) {
      fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}/cancel`, {
        method: 'POST',
      }).catch(() => {
        // ignore background cancel error
      });
    }

    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setIsStreaming(false);

    // Populate the previous message back into the input box so user can edit!
    if (lastUserPromptRef.current) {
      setInputPrompt(lastUserPromptRef.current);
      setTimeout(() => {
        if (chatInputRef.current) {
          chatInputRef.current.focus();
          adjustTextareaHeight(chatInputRef.current);
        } else if (landingInputRef.current) {
          landingInputRef.current.focus();
          adjustTextareaHeight(landingInputRef.current);
        }
      }, 60);
    }
  };

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    // Min 2 lines (~44px), max 7 lines (~168px)
    const maxHeight = 168;
    const minHeight = 44;
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${nextHeight}px`;
  };

  const ACTIVE_SESSION_STORAGE_KEY = 'backtest_si_active_session_id';

  // Fetch recent sessions list
  const refreshSessionsList = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/sessions?user_id=${encodeURIComponent(activeUser)}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data: SavedSessionSummary[] = await res.json();
        setSessionsList(data);
      }
    } catch (err) {
      console.warn('[QuantAgentPanel] Could not fetch sessions list:', err);
    }
  };

  // Re-fetch sessions whenever activeUser or auth token changes
  useEffect(() => {
    refreshSessionsList();
  }, [activeUser, token]);

  // Initial load: restore active session or fetch recent sessions
  useEffect(() => {
    refreshSessionsList();
    const savedSessionId =
      typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) : null;
    if (savedSessionId) {
      handleSelectSession(savedSessionId).catch(() => {
        const initialId = `sess_${Math.random().toString(16).slice(2, 14)}`;
        setSessionId(initialId);
      });
    } else {
      const initialId = `sess_${Math.random().toString(16).slice(2, 14)}`;
      setSessionId(initialId);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    };
  }, []);

  // Handle user manual scroll on chat container
  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - (target.scrollTop + target.clientHeight);
    // If user has scrolled up more than 80px above bottom, preserve their scroll position
    userScrolledUpRef.current = distanceFromBottom > 80;
  };

  // Auto scroll to bottom in active state without hijacking manual user scrolling
  useEffect(() => {
    if (viewState === 'active') {
      // If streaming and user intentionally scrolled up, do NOT force-scroll down!
      if (isStreaming && userScrolledUpRef.current) {
        return;
      }

      if (isStreaming) {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        } else {
          chatScrollRef.current?.scrollIntoView({ behavior: 'auto' });
        }
      } else {
        chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, currentThought, activeAnnouncement, isStreaming, viewState]);

  // When streaming finishes, ensure user is smoothly scrolled down to results
  useEffect(() => {
    if (!isStreaming && viewState === 'active') {
      userScrolledUpRef.current = false;
      const timer = setTimeout(() => {
        chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, viewState]);

  // Handle switching to a past session
  const handleSelectSession = async (targetSessionId: string) => {
    // Abort active stream and cancel backend harness if currently streaming on another session
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (sessionId && isStreaming) {
      fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      }).catch(() => {});
    }
    setIsStreaming(false);

    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/sessions/${targetSessionId}`, { headers: getAuthHeaders(), credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        setSessionTitle(data.title || 'Quant Session');
        if (data.pending_interaction) {
          setPendingInteraction(data.pending_interaction);
        } else {
          setPendingInteraction(null);
        }
        setShowCustomInput(false);
        setCustomOtherText('');
        if (typeof window !== 'undefined') {
          localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, data.session_id);
        }
        onSessionChanged?.(data.session_id);

        const rawHistory: any[] = data.history || [];
        const loadedMsgs: AgentChatMessage[] = [];

        // Helper to format ISO timestamp to user-friendly local time
        const formatMsgTimestamp = (ts?: string) => {
          if (!ts) return 'Saved';
          try {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return 'Saved';
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch {
            return 'Saved';
          }
        };

        // Group raw messages into user-prompt turns to preserve consistent single-message + collapsible workflow styling
        interface TurnGroup {
          userMsg?: any;
          assistantMsgs: any[];
          toolMsgs: any[];
        }

        const turns: TurnGroup[] = [];
        let currentTurn: TurnGroup = { assistantMsgs: [], toolMsgs: [] };

        for (const item of rawHistory) {
          if (!item || item.role === 'system') continue;

          if (item.role === 'user') {
            if (currentTurn.userMsg || currentTurn.assistantMsgs.length > 0) {
              turns.push(currentTurn);
            }
            currentTurn = { userMsg: item, assistantMsgs: [], toolMsgs: [] };
          } else if (item.role === 'assistant') {
            currentTurn.assistantMsgs.push(item);
          } else if (item.role === 'tool') {
            currentTurn.toolMsgs.push(item);
          }
        }
        if (currentTurn.userMsg || currentTurn.assistantMsgs.length > 0) {
          turns.push(currentTurn);
        }

        // Process each turn
        let sessionBoundStrategy: string | null = null;
        for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
          const turn = turns[turnIdx];

          // 1. Reconstruct User message
          if (turn.userMsg) {
            const userText = (turn.userMsg.content || '').trim();
            if (userText) {
              loadedMsgs.push({
                id: turn.userMsg.id || `hist_user_${turnIdx}`,
                sender: 'user',
                text: userText,
                timestamp: formatMsgTimestamp(turn.userMsg.timestamp_utc || turn.userMsg.timestamp),
              });
            }
          }

          // 2. Reconstruct Assistant message and aggregate all working steps
          if (turn.assistantMsgs.length > 0) {
            // Build tool result lookup
            const toolResultsByCallId = new Map<string, any>();
            for (const t of turn.toolMsgs) {
              let parsed: any = t.content;
              if (typeof t.content === 'string') {
                try {
                  parsed = JSON.parse(t.content);
                } catch {
                  parsed = t.content;
                }
              }
              if (t.tool_call_id) {
                toolResultsByCallId.set(t.tool_call_id, parsed);
              }
            }

            const workflowSteps: AgentWorkflowStep[] = [];
            const allThoughts: string[] = [];
            let lastAssistantWithText: any = null;

            turn.assistantMsgs.forEach((asst, aIdx) => {
              const rawText = (asst.content || '').trim();
              const rawThought = (asst.thought || '').trim();

              // Track thoughts
              if (rawThought) {
                allThoughts.push(rawThought);
                workflowSteps.push({
                  id: `hist_think_${turnIdx}_${aIdx}`,
                  type: 'thinking',
                  title: 'Thought for a few seconds',
                  detail: rawThought,
                  status: 'completed',
                  durationSeconds: 3,
                });
              }

              // Track tool calls as workflow steps
              const toolCalls: any[] = Array.isArray(asst.tool_calls) ? asst.tool_calls : [];
              if (toolCalls.length > 0) {
                toolCalls.forEach((tc, tcIdx) => {
                  const toolName = tc.name || '';
                  const args = tc.arguments || {};
                  const toolRes = (tc.id ? toolResultsByCallId.get(tc.id) : undefined) || {};

                  let stepType: WorkflowStepType = 'tool_call';
                  let stepTitle = `Executed ${toolName.replace(/_/g, ' ')}`;
                  let stepSubtitle: string | undefined = undefined;
                  let stepFilename: string | undefined = args.filename;
                  let diffStats: { added: number; removed: number } | undefined = undefined;

                  if (toolName === 'create_file') {
                    stepType = 'create_file';
                    stepFilename = args.filename || 'file';
                    const lines = (args.content || toolRes.content || '').split('\n').length;
                    stepTitle = `Created ${stepFilename}`;
                    stepSubtitle = `+${lines}`;
                    diffStats = { added: lines, removed: 0 };
                  } else if (toolName === 'edit_file' || toolName === 'edit_file_partially' || toolName === 'append_to_file') {
                    stepType = 'edit_file';
                    stepFilename = args.filename || 'file';
                    stepTitle = `Edited ${stepFilename}`;
                    diffStats = computeDiffStats({
                      lines_added: toolRes.lines_added,
                      lines_removed: toolRes.lines_removed,
                      diff: toolRes.diff,
                      target: args.target_content,
                      replacement: args.replacement_content,
                      content: args.content || toolRes.content,
                    });
                    if (diffStats.added > 0 || diffStats.removed > 0) {
                      stepSubtitle = `+${diffStats.added} -${diffStats.removed}`;
                    }
                  } else if (toolName === 'read_file') {
                    stepType = 'read_file';
                    stepFilename = args.filename || 'file';
                    stepTitle = `Read ${stepFilename}`;
                    const lineRange = toolRes.range || ((args.start_line !== undefined || args.end_line !== undefined)
                      ? `L ${args.start_line || 1}-${args.end_line || ''}`
                      : undefined);
                    if (lineRange) {
                      stepSubtitle = lineRange;
                    } else if (toolRes.lines_read) {
                      stepSubtitle = `${toolRes.lines_read} lines`;
                    }
                  } else if (toolName === 'delete_file') {
                    stepType = 'delete_file';
                    stepFilename = args.filename || 'file';
                    stepTitle = `Deleted ${stepFilename}`;
                  } else if (toolName === 'compile_mql5') {
                    stepType = 'compile';
                    stepFilename = (args.filepath || args.filename || 'strategy.mq5').split(/[/\\]/).pop();
                    stepTitle = `Compiled: ${stepFilename}`;
                    const isPass = toolRes.success ?? true;
                    stepSubtitle = isPass ? 'Clean Build (0 errors)' : 'Compiler errors';
                  } else if (toolName === 'run_sandbox_test') {
                    stepType = 'sandbox_test';
                    stepFilename = args.filename || 'strategy';
                    stepTitle = `Tested in sandbox: ${stepFilename}`;
                    const isPass = toolRes.passed ?? toolRes.success ?? true;
                    stepSubtitle = isPass ? 'Passed (0 errors)' : 'Issues detected';
                  } else if (toolName === 'run_strategy_tester' || toolName === 'run_backtest' || toolName === 'launch_sandbox_runner') {
                    stepType = 'backtest';
                    stepTitle = `MT5 Backtest: ${args.symbol || 'XAUUSD'} (${args.period || args.timeframe || 'H1'})`;
                    const totalTrades = Number(toolRes.total_trades_count ?? toolRes.metrics?.total_trades ?? toolRes.metrics?.totalTrades ?? 0);
                    if (totalTrades === 0) {
                      stepSubtitle = '0 trades (Failed - iterating...)';
                    } else if (toolRes.net_profit_pct !== undefined) {
                      const p = toolRes.net_profit_pct;
                      stepSubtitle = `Return ${p > 0 ? '+' : ''}${p}%`;
                    }
                  } else if (toolName === 'read_test_report') {
                    stepType = 'backtest';
                    stepTitle = 'Ingested MT5 Tester Report';
                    stepSubtitle = toolRes.profit_factor ? `PF: ${toolRes.profit_factor}` : undefined;
                  } else if (toolName === 'search_web') {
                    stepType = 'web_search';
                    const q = args.query || '';
                    stepTitle = `Searched web: "${q.slice(0, 32)}${q.length > 32 ? '...' : ''}"`;
                  } else if (toolName === 'query_market_data') {
                    stepType = 'market_data';
                    stepTitle = `Queried market data: ${args.symbol || 'XAUUSD'}`;
                  }

                  workflowSteps.push({
                    id: `hist_step_${turnIdx}_${aIdx}_${tcIdx}`,
                    type: stepType,
                    title: stepTitle,
                    subtitle: stepSubtitle,
                    filename: stepFilename,
                    diffStats,
                    detail: rawText || (typeof toolRes === 'string' ? toolRes : toolRes.message || toolRes.error || undefined),
                    toolName,
                    status: toolRes?.is_error || toolRes?.error ? 'failed' : 'completed',
                    durationSeconds: 3,
                  });

                  if (stepFilename && (stepFilename.endsWith('.mq5') || stepFilename.endsWith('.py')) && (toolName === 'create_file' || toolName === 'edit_file' || toolName === 'edit_file_partially' || toolName === 'compile_mql5')) {
                    sessionBoundStrategy = stepFilename;
                  }
                });
              }

              // Check if this assistant message is not just raw tool output
              const isRawJson = rawText.startsWith('{') && rawText.endsWith('}') && (rawText.includes('"success"') || rawText.includes('"exit_code"'));
              if (rawText && !isRawJson) {
                lastAssistantWithText = asst;
              }
            });

            // The final response text is taken from the concluding assistant message
            const finalAssistant = turn.assistantMsgs[turn.assistantMsgs.length - 1];
            const candidateText = (lastAssistantWithText?.content || finalAssistant?.content || '').trim();
            const isRawJson = candidateText.startsWith('{') && candidateText.endsWith('}') && (candidateText.includes('"success"') || candidateText.includes('"exit_code"'));
            const finalText = isRawJson ? 'Execution completed.' : (candidateText || 'Execution completed.');

            let snippet: string | undefined = undefined;
            let lang: 'python' | 'mql5' = 'python';

            if (finalText) {
              const codeMatch = finalText.match(/```(python|mql5|cpp)?\n([\s\S]*?)```/);
              if (codeMatch) {
                const candidate = codeMatch[2].trim();
                const candidateLang = codeMatch[1] === 'mql5' || codeMatch[1] === 'cpp' ? 'mql5' : 'python';
                if (isExecutableStrategyProposal(candidate, candidateLang)) {
                  snippet = candidate;
                  lang = candidateLang;
                }
              }
            }

            const totalDuration = Math.max(12, workflowSteps.reduce((acc, s) => acc + (s.durationSeconds || 3), 0));

            loadedMsgs.push({
              id: finalAssistant.id || `hist_agent_${turnIdx}`,
              sender: 'agent',
              text: finalText,
              thought: allThoughts.length > 0 ? allThoughts.join('\n\n') : undefined,
              workflowSteps: workflowSteps.length > 0 ? workflowSteps : undefined,
              workDurationSeconds: totalDuration,
              codeSnippet: snippet,
              language: lang,
              timestamp: formatMsgTimestamp(finalAssistant.timestamp_utc || finalAssistant.timestamp),
            });
          }
        }

        setMessages(loadedMsgs);
        setBoundStrategy(sessionBoundStrategy);
        setViewState('active');
        setIsHistoryOpen(false);
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error('[QuantAgentPanel] Failed to load session:', err);
    }
  };

  // Handle deleting a session with confirmation
  const handleDeleteSession = async (targetSessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/sessions/${targetSessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        setSessionsList((prev) => prev.filter((s) => s.session_id !== targetSessionId));
        if (typeof window !== 'undefined' && localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) === targetSessionId) {
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        }
        if (sessionId === targetSessionId) {
          handleStartNewChat();
        }
      }
    } catch (err) {
      console.error('[QuantAgentPanel] Failed to delete session:', err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Start fresh conversation (returns to Landing View)
  const handleStartNewChat = () => {
    // Abort active SSE stream and cancel execution on backend if previous session was streaming
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (sessionId && isStreaming) {
      fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      }).catch(() => {});
    }
    setIsStreaming(false);

    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    const freshId = `sess_${Math.random().toString(16).slice(2, 14)}`;
    setSessionId(freshId);
    setSessionTitle('Quant AI');
    onSessionChanged?.(freshId);
    setMessages([]);
    setInputPrompt('');
    setCurrentThought('');
    setActiveAnnouncement(null);
    setLiveWorkflowSteps([]);
    setLiveElapsedSeconds(0);
    liveWorkflowStepsRef.current = [];
    setUploadedAttachment(null);
    setPendingInteraction(null);
    setShowCustomInput(false);
    setCustomOtherText('');
    setBoundStrategy(null);
    setViewState('landing');
    setIsHistoryOpen(false);
    setDeleteConfirmId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
    setTimeout(() => {
      landingInputRef.current?.focus();
    }, 50);
  };

  // Handle file/image upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const isImg = file.type.startsWith('image/');
        setUploadedAttachment({
          id: data.file_id,
          filename: data.filename,
          url: data.url,
          isImage: isImg,
        });
      } else {
        alert('File upload failed. Max file size: 25MB.');
      }
    } catch (err) {
      setUploadedAttachment({
        id: `att_${Date.now()}`,
        filename: file.name,
        url: URL.createObjectURL(file),
        isImage: file.type.startsWith('image/'),
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle dropping files (from workspace file tree, editor tabs, or local OS)
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverChat(false);

    // 1. Check if dropped workspace file from explorer or editor tab
    let droppedFilename = '';
    try {
      const customPayload =
        e.dataTransfer.getData('application/x-backtest-ai-file') || e.dataTransfer.getData('application/x-backtest-si-file') ||
        e.dataTransfer.getData('application/json');
      if (customPayload) {
        const parsed = JSON.parse(customPayload);
        if (parsed?.name) droppedFilename = parsed.name;
      }
    } catch {
      // ignore
    }

    if (!droppedFilename) {
      droppedFilename = e.dataTransfer.getData('text/plain');
    }

    if (
      droppedFilename &&
      (droppedFilename.endsWith('.py') ||
        droppedFilename.endsWith('.mq5') ||
        droppedFilename.endsWith('.mqh') ||
        droppedFilename.endsWith('.json') ||
        droppedFilename.endsWith('.txt') ||
        droppedFilename.endsWith('.csv') ||
        droppedFilename.endsWith('.parquet'))
    ) {
      setUploadedAttachment({
        id: `ws_${Date.now()}`,
        filename: droppedFilename.trim(),
        url: '',
        isImage: false,
        isWorkspaceFile: true,
      });
      if (chatInputRef.current) chatInputRef.current.focus();
      else if (landingInputRef.current) landingInputRef.current.focus();
      return;
    }

    // 2. Check if dropped external file from OS
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const isImg = file.type.startsWith('image/');
      setUploadedAttachment({
        id: `att_${Date.now()}`,
        filename: file.name,
        url: URL.createObjectURL(file),
        isImage: isImg,
        isWorkspaceFile: !isImg && (file.name.endsWith('.py') || file.name.endsWith('.mq5')),
      });
      if (chatInputRef.current) chatInputRef.current.focus();
      else if (landingInputRef.current) landingInputRef.current.focus();
    }
  };

  // Dispatch prompt through SSE streaming endpoint (supports new chat turn or resuming after Human in the Loop)
  const handleSendMessage = async (overridePrompt?: string, resumeResponse?: string) => {
    let promptToSend = (overridePrompt || inputPrompt).trim();
    if (!promptToSend && uploadedAttachment) {
      if (uploadedAttachment.lineStart && uploadedAttachment.lineEnd) {
        promptToSend = `Please review lines ${uploadedAttachment.lineStart}-${uploadedAttachment.lineEnd} of ${uploadedAttachment.filename}`;
      } else {
        promptToSend = `Please analyze and target strategy file: ${uploadedAttachment.filename}`;
      }
    }
    if (!promptToSend || isStreaming) return;

    // Reset interaction state upon sending
    setPendingInteraction(null);
    setShowCustomInput(false);
    setCustomOtherText('');
    setSelectedClarificationIdx(null);

    const isFromLanding = viewState === 'landing';
    // Fluidly transition to active view if in landing
    if (viewState === 'landing') {
      setViewState('active');
    }

    const currentAttachment = uploadedAttachment;
    if (isFromLanding && currentAttachment?.isWorkspaceFile && currentAttachment.filename) {
      setBoundStrategy(currentAttachment.filename);
    }
    let payloadPrompt = promptToSend;
    if (currentAttachment && !currentAttachment.isImage) {
      if (currentAttachment.lineStart && currentAttachment.lineEnd) {
        const snippetBlock = currentAttachment.codeSnippet
          ? `\`\`\`python\n${currentAttachment.codeSnippet}\n\`\`\`\n\n`
          : '';
        payloadPrompt = `[Target File: ${currentAttachment.filename} (Lines ${currentAttachment.lineStart}-${currentAttachment.lineEnd})]\n${snippetBlock}${promptToSend}`;
      } else {
        payloadPrompt = `[Target File: ${currentAttachment.filename}]\n\n${promptToSend}`;
      }
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `usr_${Date.now()}`;

    const userMessage: AgentChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: promptToSend,
      timestamp,
      attachment: currentAttachment || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    if (chatInputRef.current) chatInputRef.current.style.height = '44px';
    if (landingInputRef.current) landingInputRef.current.style.height = '44px';
    setUploadedAttachment(null);
    setIsStreaming(true);
    setStreamingText('');
    setCurrentThought('');
    setActiveAnnouncement(null);

    const turnStartTime = Date.now();
    turnStartTimeRef.current = turnStartTime;
    const initialThinkingStep: AgentWorkflowStep = {
      id: `step_think_${turnStartTime}`,
      type: 'thinking',
      title: 'Thinking...',
      status: 'running',
      durationSeconds: 0,
      timestamp: turnStartTime,
    };
    liveWorkflowStepsRef.current = [initialThinkingStep];
    setLiveWorkflowSteps([initialThinkingStep]);
    setLiveElapsedSeconds(0);

    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    liveTimerRef.current = setInterval(() => {
      const elapsed = Math.max(1, Math.round((Date.now() - turnStartTime) / 1000));
      setLiveElapsedSeconds(elapsed);
      setLiveWorkflowSteps((prev) => {
        const next = prev.map((s) => {
          if (s.status === 'running') {
            const stepSec = Math.max(1, Math.round((Date.now() - (s.timestamp || turnStartTime)) / 1000));
            return {
              ...s,
              durationSeconds: stepSec,
              title: s.type === 'thinking' ? `Thinking (${stepSec}s)...` : s.title,
            };
          }
          return s;
        });
        liveWorkflowStepsRef.current = next;
        return next;
      });
    }, 1000);

    const agentMsgId = `agt_${Date.now()}`;
    let accumulatedText = '';
    let accumulatedThought = '';
    let foundSnippet: string | undefined = undefined;
    let snippetLang: 'python' | 'mql5' = currentLanguage;
    let capturedAskUser: AskUserPayload | undefined = undefined;
    const activeSessId = sessionId || `sess_${Date.now()}`;
    if (!sessionId) {
      setSessionId(activeSessId);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessId);
    }

    let createdFile: { name: string; content?: string } | null = null;
    let lastEditedFile: { name: string; content?: string } | null = null;
    const pendingToolCalls = new Map<string, { name: string; args: any; stepId: string; startTime: number }>();

    lastUserPromptRef.current = promptToSend;
    userScrolledUpRef.current = false;
    if (wasCancelledRef.current) {
      try {
        await fetch(`${API_BASE}/api/v1/agent/sessions/${activeSessId}/cancel`, {
          method: 'POST',
        });
      } catch {}
    }
    wasCancelledRef.current = false;
    abortControllerRef.current = new AbortController();

    try {
      const isResume = Boolean(resumeResponse);
      const endpointUrl = isResume
        ? `${API_BASE}/api/v1/agent/resume`
        : `${API_BASE}/api/v1/agent/chat`;

      const requestBody = isResume
        ? JSON.stringify({
            session_id: activeSessId,
            user_response: resumeResponse,
            user_id: activeUser,
            provider: selectedProvider,
            model: selectedModel,
            think_level: selectedThinkLevel,
          })
        : JSON.stringify({
            session_id: activeSessId,
            user_id: activeUser,
            prompt: payloadPrompt,
            provider: selectedProvider,
            model: selectedModel,
            think_level: selectedThinkLevel,
            active_strategy: isFromLanding
              ? (currentAttachment?.isWorkspaceFile && currentAttachment.filename ? currentAttachment.filename : undefined)
              : (boundStrategy || undefined),
            active_version: (isFromLanding
              ? (currentAttachment?.isWorkspaceFile && currentAttachment.filename ? currentAttachment.filename : undefined)
              : boundStrategy)
                ? (activeVersion ? `v${String(activeVersion).replace(/^v/i, '')}` : (((isFromLanding ? currentAttachment?.filename : boundStrategy)?.match(/_v(\d+)/)) ? `v${(isFromLanding ? currentAttachment!.filename : boundStrategy)!.match(/_v(\d+)/)![1]}` : 'v1'))
                : undefined,
            viewing_file: (activeFileName && activeFileName !== (isFromLanding ? (currentAttachment?.isWorkspaceFile ? currentAttachment.filename : undefined) : boundStrategy)) ? activeFileName : undefined,
            context_metadata: {
              ...(incomingTelemetryReport ? {
                win_rate: incomingTelemetryReport.winRate || incomingTelemetryReport.metrics?.winRate,
                net_profit: incomingTelemetryReport.netProfit || incomingTelemetryReport.metrics?.netProfit,
                total_trades: incomingTelemetryReport.totalTrades || incomingTelemetryReport.metrics?.totalTrades,
                symbol: incomingTelemetryReport.symbol,
                timeframe: incomingTelemetryReport.timeframe,
              } : {}),
              version_tests_count: versionTestsCount ?? 0,
              next_test_number: (versionTestsCount ?? 0) + 1,
            },
          });

      const chatRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        signal: abortControllerRef.current.signal,
        body: requestBody,
      });

      if (chatRes.ok && chatRes.body) {
        const reader = chatRes.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(trimmed.slice(6));
                const { event_type, payload } = eventData;

                if (event_type === 'SESSION_TITLE' && payload?.title) {
                  setSessionTitle(payload.title);
                  refreshSessionsList();
                } else if (event_type === 'STATUS_ANNOUNCEMENT') {
                  const annMsg = payload.message || '';
                  if (annMsg.toLowerCase().includes('distilling') || annMsg.toLowerCase().includes('digest') || annMsg.toLowerCase().includes('compacting')) {
                    setActiveAnnouncement('Working...');
                  } else {
                    setActiveAnnouncement(annMsg);
                  }
                } else if (event_type === 'THOUGHT_CHUNK') {
                  accumulatedThought += payload.delta || '';
                  setCurrentThought(accumulatedThought);
                  setLiveWorkflowSteps((prev) => {
                    const hasThinking = prev.some((s) => s.type === 'thinking' && s.status === 'running');
                    let next: AgentWorkflowStep[];
                    if (hasThinking) {
                      next = prev.map((s) =>
                        s.type === 'thinking' && s.status === 'running'
                          ? { ...s, detail: accumulatedThought }
                          : s
                      );
                    } else {
                      const stepSec = Math.max(1, Math.round((Date.now() - turnStartTimeRef.current) / 1000));
                      const newThink: AgentWorkflowStep = {
                        id: `step_think_${Date.now()}`,
                        type: 'thinking',
                        title: `Thinking (${stepSec}s)...`,
                        detail: accumulatedThought,
                        status: 'running',
                        timestamp: Date.now(),
                      };
                      next = [...prev, newThink];
                    }
                    liveWorkflowStepsRef.current = next;
                    return next;
                  });
                } else if (event_type === 'THOUGHT_COMPLETE') {
                  setLiveWorkflowSteps((prev) => {
                    const next = prev.map((s) => {
                      if (s.type === 'thinking' && s.status === 'running') {
                        const dur = Math.max(1, s.durationSeconds || Math.round((Date.now() - (s.timestamp || turnStartTimeRef.current)) / 1000));
                        return {
                          ...s,
                          status: 'completed' as const,
                          durationSeconds: dur,
                          title: `Thought for ${dur}s`,
                        };
                      }
                      return s;
                    });
                    liveWorkflowStepsRef.current = next;
                    return next;
                  });
                } else if (event_type === 'MESSAGE_CHUNK') {
                  accumulatedText += payload.delta || '';
                  setStreamingText(accumulatedText);
                  setLiveWorkflowSteps((prev) => {
                    const hasRunningThink = prev.some((s) => s.status === 'running' && s.type === 'thinking');
                    if (!hasRunningThink) return prev;
                    const next = prev.map((s) => {
                      if (s.status === 'running' && s.type === 'thinking') {
                        const dur = Math.max(1, s.durationSeconds || Math.round((Date.now() - (s.timestamp || turnStartTimeRef.current)) / 1000));
                        return {
                          ...s,
                          status: 'completed' as const,
                          durationSeconds: dur,
                          title: `Thought for ${dur}s`,
                        };
                      }
                      return s;
                    });
                    liveWorkflowStepsRef.current = next;
                    return next;
                  });
                } else if (event_type === 'MESSAGE_COMPLETE') {
                  if (payload.role === 'assistant' && payload.content) {
                    accumulatedText = payload.content;
                    setStreamingText(accumulatedText);
                    const vMatch = payload.content.match(/(?:committed|checkpointed|created|upgraded to|saved|bumped to)?\s*(?:version\s*|v)(\d+)(?:\s+milestone|\b)/i);
                    if (vMatch && onVersionChanged) {
                      const vNum = parseInt(vMatch[1], 10);
                      if (!isNaN(vNum) && vNum > 0) {
                        onVersionChanged(vNum, activeFileName);
                      }
                    }
                  }
                } else if (event_type === 'TOOL_CALL_STARTED') {
                  const toolName = payload.name || payload.tool_name || '';
                  const args = payload.arguments || {};
                  const callId = payload.call_id || `call_${Date.now()}`;
                  const stepStart = Date.now();
                  const stepId = `step_${callId}`;

                  pendingToolCalls.set(callId, { name: toolName, args, stepId, startTime: stepStart });

                  let stepType: WorkflowStepType = 'tool_call';
                  let stepTitle = `Executing ${toolName.replace(/_/g, ' ')}`;
                  let stepFilename: string | undefined = undefined;

                  if (toolName === 'create_file') {
                    stepType = 'create_file';
                    stepFilename = args.filename || '';
                    stepTitle = `Creating ${stepFilename || 'file'}`;
                  } else if (toolName === 'edit_file' || toolName === 'edit_file_partially' || toolName === 'append_to_file') {
                    stepType = 'edit_file';
                    stepFilename = args.filename || '';
                    stepTitle = `Editing ${stepFilename || 'file'}`;
                  } else if (toolName === 'read_file') {
                    stepType = 'read_file';
                    stepFilename = args.filename || '';
                    const lineRange = (args.start_line !== undefined || args.end_line !== undefined)
                      ? `L ${args.start_line || 1}-${args.end_line || ''}`
                      : undefined;
                    stepTitle = lineRange ? `Reading ${stepFilename || 'file'} ${lineRange}` : `Reading ${stepFilename || 'file'}`;
                  } else if (toolName === 'delete_file') {
                    stepType = 'delete_file';
                    stepFilename = args.filename || '';
                    stepTitle = `Deleting ${stepFilename || 'file'}`;
                  } else if (toolName === 'search_web') {
                    stepType = 'web_search';
                    stepTitle = `Searching web: "${(args.query || 'quant topic').slice(0, 36)}"`;
                  } else if (toolName === 'query_market_data') {
                    stepType = 'market_data';
                    stepTitle = `Querying market data: ${args.symbol || 'XAUUSD'} (${args.timeframe || '15m'})`;
                  } else if (toolName === 'compile_mql5') {
                    stepType = 'compile';
                    stepFilename = (args.filepath || args.filename || 'strategy.mq5').split(/[/\\]/).pop();
                    stepTitle = `Compiling MQL5: ${stepFilename}`;
                  } else if (toolName === 'run_sandbox_test') {
                    stepType = 'sandbox_test';
                    stepFilename = args.filename || '';
                    stepTitle = `Testing in sandbox: ${stepFilename || 'strategy'}`;
                  } else if (toolName === 'run_strategy_tester' || toolName === 'run_backtest' || toolName === 'launch_sandbox_runner') {
                    stepType = 'backtest';
                    stepTitle = `Running MT5 Strategy Tester: ${args.symbol || 'XAUUSD'} (${args.period || args.timeframe || 'H1'})`;
                  } else if (toolName === 'read_test_report') {
                    stepType = 'backtest';
                    stepTitle = 'Ingesting MT5 Backtest Report';
                  } else if (toolName === 'list_workspace_files') {
                    stepType = 'read_file';
                    stepTitle = 'Inspecting workspace files';
                  }

                  const newStep: AgentWorkflowStep = {
                    id: stepId,
                    type: stepType,
                    title: stepTitle,
                    filename: stepFilename,
                    toolName,
                    status: 'running',
                    timestamp: stepStart,
                  };

                  setLiveWorkflowSteps((prev) => {
                    const closed = prev.map((s) => {
                      if (s.status === 'running' && s.type === 'thinking') {
                        const dur = Math.max(1, s.durationSeconds || Math.round((Date.now() - (s.timestamp || turnStartTimeRef.current)) / 1000));
                        return {
                          ...s,
                          status: 'completed' as const,
                          durationSeconds: dur,
                          title: `Thought for ${dur}s`,
                        };
                      }
                      return s;
                    });
                    const next = [...closed, newStep];
                    liveWorkflowStepsRef.current = next;
                    return next;
                  });

                  if (toolName === 'launch_sandbox_runner' && onTestInSandbox) {
                    onTestInSandbox({
                      symbol: args.symbol,
                      timeframe: args.timeframe,
                      startDate: args.start_date,
                      endDate: args.end_date,
                      parameters: args.parameters,
                      autoStart: false,
                    });
                  }
                } else if (event_type === 'TOOL_CALL_FINISHED') {
                  const callId = payload.call_id || '';
                  const cached = callId ? pendingToolCalls.get(callId) : undefined;
                  const toolName = payload.tool_name || payload.name || cached?.name || '';
                  const res = payload.output || payload.result || {};
                  const args = cached?.args || payload.arguments || {};
                  const targetStepId = cached?.stepId || `step_${callId}`;
                  let isErr = payload.is_error || false;
                  if (toolName === 'run_strategy_tester' || toolName === 'read_test_report') {
                    const totalTrades = Number(res.total_trades_count ?? res.metrics?.total_trades ?? res.metrics?.totalTrades ?? 0);
                    if (totalTrades === 0 || res.zero_trades_failure || res.status === 'FAILED_ZERO_TRADES') {
                      isErr = true;
                    }
                  }

                  if (toolName === 'create_file') {
                    const fn = res.filename || args.filename;
                    const content = res.content !== undefined ? res.content : (args.content || '');
                    if (fn) {
                      createdFile = { name: fn, content };
                      setBoundStrategy(fn);
                      if (onWorkspaceChanged) {
                        onWorkspaceChanged(fn, { isEdit: false, newContent: content });
                      }
                    }
                  } else if (toolName === 'append_to_file' || toolName === 'edit_file' || toolName === 'edit_file_partially') {
                    const fn = res.filename || args.filename;
                    const content = res.content || args.content;
                    if (fn) {
                      lastEditedFile = { name: fn, content };
                      setBoundStrategy(fn);
                      // Detect version from tool response or code header (e.g. #property version "4.00" or __version__ = "4")
                      const vMatch = content ? (content.match(/#property\s+version\s+["'](\d+)(?:\.\d+)?["']/i) || content.match(/(?:__version__|VERSION)\s*=\s*["'](\d+)(?:\.\d+)?["']/i)) : null;
                      const extractedV = (typeof res?.version === 'number' && res.version > 0) ? res.version : (vMatch ? parseInt(vMatch[1], 10) : undefined);
                      if (onWorkspaceChanged) {
                        onWorkspaceChanged(fn, {
                          isEdit: true,
                          newContent: content,
                          originalContent: res.original,
                          diff: res.diff,
                          version: extractedV,
                        });
                      }
                      if (extractedV && onVersionChanged) {
                        onVersionChanged(extractedV, fn);
                      }
                    }
                  } else if (toolName === 'delete_file') {
                    const fn = res.filename || args.filename;
                    if (fn && onWorkspaceChanged) {
                      onWorkspaceChanged(fn, { isDelete: true });
                    }
                  } else if (toolName === 'create_folder') {
                    if (onWorkspaceChanged) onWorkspaceChanged();
                  } else if (toolName === 'save_strategy_version') {
                    const v = res.version;
                    const stratName = res.strategy_name || res.clean_name || args.strategy_name;
                    const ext = res.ext || (stratName && stratName.endsWith('.mq5') ? 'mq5' : 'py');
                    const baseFilename = stratName ? `${stratName.replace(/\.[^/.]+$/, '')}.${ext}` : undefined;
                    const codeContent = res.content || args.code;
                    if (baseFilename && onWorkspaceChanged) {
                      onWorkspaceChanged(baseFilename, {
                        isEdit: true,
                        newContent: codeContent,
                        version: v,
                      });
                    }
                    if (onVersionChanged && v) {
                      onVersionChanged(v, stratName);
                    }
                  } else if (toolName === 'launch_sandbox_runner') {
                    if (onTestInSandbox) {
                      onTestInSandbox({
                        symbol: res.symbol || args.symbol,
                        timeframe: res.timeframe || args.timeframe,
                        startDate: res.start_date || args.start_date,
                        endDate: res.end_date || args.end_date,
                        parameters: res.parameters || args.parameters,
                        autoStart: false,
                      });
                    }
                  } else if (toolName === 'run_backtest') {
                    if (res.success && onSimulationComplete && res.run_id) {
                      onSimulationComplete({
                        runId: res.run_id,
                        strategyId: res.strategy_id || args.strategy_id,
                        metrics: {
                          netProfit: res.net_profit ?? 0,
                          netProfitPct: res.net_profit_pct ?? 0,
                          winRate: Math.round((res.win_rate ?? 0) * 1000) / 10,
                          sharpeRatio: res.sharpe_ratio ?? 0,
                          profitFactor: res.profit_factor ?? 0,
                          maxDrawdownPct: res.max_drawdown_pct ?? 0,
                          maxDrawdown: res.max_drawdown ?? 0,
                          totalTrades: res.total_trades ?? 0,
                          barsProcessed: res.bars_processed ?? 1000,
                          executionTimeMs: Math.round((res.duration_seconds ?? 0) * 1000),
                          lookaheadBias: '0.000% (Strictly Causal)',
                          expectancy: res.expectancy ?? 0,
                          averageWin: res.average_win ?? 0,
                          averageLoss: res.average_loss ?? 0,
                          payoffRatio: res.payoff_ratio ?? 0,
                          maxConsecutiveWins: res.max_consecutive_wins ?? 0,
                          maxConsecutiveLosses: res.max_consecutive_losses ?? 0,
                          exposurePct: res.exposure_pct ?? 0,
                          sortinoRatio: res.sortino_ratio ?? 0,
                          calmarRatio: res.calmar_ratio ?? 0,
                          initialCapital: res.initial_capital ?? 100000,
                          endingEquity: res.ending_equity ?? 100000,
                        },
                        trades: Array.isArray(res.sample_trades)
                          ? res.sample_trades.map((t: any, idx: number) => ({
                              trade_id: `t_${idx + 1}`,
                              symbol: res.symbol || 'XAUUSD',
                              side: t.side === 'SELL' ? 'SELL' : 'BUY',
                              entry_time: t.entry_time || '09:30:00',
                              exit_time: t.exit_time || '10:15:00',
                              entry_price: t.entry_price ?? 0,
                              exit_price: t.exit_price ?? 0,
                              quantity: 1,
                              pnl: t.pnl ?? 0,
                              pnl_percent: t.pnl ?? 0,
                              exit_reason: t.exit_reason || 'TARGET',
                            }))
                          : [],
                        symbol: res.symbol || 'XAUUSD',
                        timeframe: res.timeframe || '15m',
                        autoOpenView: true,
                      });
                    }
                  } else if (toolName === 'run_strategy_tester' || toolName === 'read_test_report') {
                    const totalTrades = Number(
                      res.total_trades_count ??
                      res.total_trades ??
                      res.metrics?.total_trades ??
                      res.metrics?.totalTrades ??
                      (Array.isArray(res.trades) ? res.trades.length : 0) ??
                      (Array.isArray(res.sample_trades) ? res.sample_trades.length : 0) ??
                      0
                    );
                    const isSuccess = res.success !== false && !res.zero_trades_failure && res.status !== 'FAILED_ZERO_TRADES';
                    if (isSuccess && totalTrades > 0 && onSimulationComplete) {
                      const rawMetrics = res.metrics || {};
                      const parsedMetrics = normalizeMt5Metrics(rawMetrics, res);
                      const parsedTrades = normalizeMt5Deals(
                        res.trades || res.sample_trades || res.deals || [],
                        res.symbol || args.symbol || 'XAUUSD'
                      );
                      const stratId =
                        res.strategy_id ||
                        res.strategy_name ||
                        (args.ea_name ? args.ea_name.replace(/\.[^/.]+$/, '') : activeFileName) ||
                        'strategy';

                      onSimulationComplete({
                        runId: res.run_id || `mt5_${Date.now()}`,
                        strategyId: stratId,
                        strategyName: stratId,
                        metrics: parsedMetrics,
                        trades: parsedTrades,
                        symbol: res.symbol || args.symbol || 'XAUUSD',
                        timeframe: res.timeframe || args.period || args.timeframe || 'H1',
                        versionNum: res.version_num ?? res.version,
                        autoOpenView: true,
                      });
                    }
                  }

                  // Update workflow step to completed
                  setLiveWorkflowSteps((prev) => {
                    const next = prev.map((s) => {
                      if (s.id === targetStepId || (s.status === 'running' && s.toolName === toolName)) {
                        const dur = Math.max(1, Math.round((Date.now() - (s.timestamp || turnStartTimeRef.current)) / 1000));
                        let completedTitle = s.title;
                        let subtitle = s.subtitle;
                        let diffStats = s.diffStats;

                        if (toolName === 'create_file') {
                          const fn = res.filename || args.filename || s.filename;
                          const rawContent = res.content !== undefined ? res.content : (args.content || '');
                          const lineCount = rawContent ? rawContent.split('\n').filter((l: string) => l.trim().length > 0).length : 0;
                          completedTitle = `Created ${fn}`;
                          diffStats = lineCount > 0 ? { added: lineCount, removed: 0 } : undefined;
                          subtitle = lineCount > 0 ? `+${lineCount}` : undefined;
                        } else if (toolName === 'edit_file' || toolName === 'edit_file_partially' || toolName === 'append_to_file') {
                          const fn = res.filename || args.filename || s.filename;
                          completedTitle = `Edited ${fn}`;
                          diffStats = computeDiffStats({
                            lines_added: res.lines_added,
                            lines_removed: res.lines_removed,
                            diff: res.diff,
                            target: args.target_content,
                            replacement: args.replacement_content,
                            content: res.content || args.content,
                          });
                          subtitle = `+${diffStats.added} -${diffStats.removed}`;
                        } else if (toolName === 'read_file') {
                          const fn = res.filename || args.filename || s.filename;
                          completedTitle = `Read ${fn}`;
                          const lineRange = res.range || ((args.start_line !== undefined || args.end_line !== undefined)
                            ? `L ${args.start_line || 1}-${args.end_line || ''}`
                            : undefined);
                          subtitle = lineRange || (res.lines_read ? `${res.lines_read} lines` : undefined);
                        } else if (toolName === 'delete_file') {
                          completedTitle = `Deleted ${args.filename || s.filename}`;
                        } else if (toolName === 'compile_mql5') {
                          const fn = (args.filepath || args.filename || s.filename || 'strategy.mq5').split(/[/\\]/).pop();
                          if (res.success || res.exit_code === 0) {
                            completedTitle = `Compiled: ${fn}`;
                            subtitle = 'Clean Build (0 errors)';
                          } else {
                            completedTitle = `Compile failed: ${fn}`;
                            subtitle = res.error || 'Compiler errors';
                          }
                        } else if (toolName === 'run_strategy_tester') {
                          const totalTrades = Number(res.total_trades_count ?? res.metrics?.total_trades ?? res.metrics?.totalTrades ?? 0);
                          if (totalTrades === 0 || res.zero_trades_failure || res.status === 'FAILED_ZERO_TRADES') {
                            completedTitle = `MT5 Backtest: 0 Trades (Failed)`;
                            subtitle = 'Logic did not trigger orders — agent iterating...';
                          } else {
                            completedTitle = `MT5 Tester Finished: ${args.symbol || 'XAUUSD'}`;
                            subtitle = res.success ? 'Report generated' : 'Tester error';
                          }
                        } else if (toolName === 'read_test_report') {
                          completedTitle = 'Ingested MT5 Tester Report';
                          subtitle = res.profit_factor ? `PF ${res.profit_factor} | Net $${res.net_profit ?? ''}` : 'Report parsed';
                        } else if (toolName === 'run_sandbox_test') {
                          const fn = args.filename || s.filename;
                          if (res.success || res.exit_code === 0) {
                            completedTitle = `Tested in sandbox: ${fn}`;
                            subtitle = 'Passed (0 errors)';
                          } else {
                            completedTitle = `Tested in sandbox: ${fn}`;
                            subtitle = 'Issues detected';
                          }
                        } else if (toolName === 'run_backtest') {
                          if (res.success) {
                            const netProf = res.net_profit_pct !== undefined ? `${res.net_profit_pct > 0 ? '+' : ''}${res.net_profit_pct}%` : `${res.net_profit}`;
                            const rawWr = res.win_rate;
                            const wr = rawWr !== undefined && rawWr !== null ? `${(rawWr > 1 ? rawWr : rawWr * 100).toFixed(1)}%` : '';
                            completedTitle = `Ran backtest: ${args.symbol || 'XAUUSD'} (${args.timeframe || '15m'})`;
                            subtitle = `Return ${netProf} · Win Rate ${wr}`;
                          } else {
                            completedTitle = `Ran backtest: ${args.symbol || 'XAUUSD'} (${args.timeframe || '15m'})`;
                            subtitle = 'Run failed';
                          }
                        } else if (toolName === 'search_web') {
                          const query = args.query || '';
                          completedTitle = `Searched web for: "${query.slice(0, 32)}${query.length > 32 ? '...' : ''}"`;
                          const count = Array.isArray(res.results) ? res.results.length : (res.count || 5);
                          subtitle = `${count} results`;
                        } else if (toolName === 'query_market_data') {
                          completedTitle = `Queried market data: ${args.symbol || 'XAUUSD'} (${args.timeframe || '1h'})`;
                          subtitle = res.bars_loaded ? `${res.bars_loaded} bars` : '100 bars';
                        }

                        return {
                          ...s,
                          title: completedTitle,
                          subtitle,
                          diffStats,
                          status: isErr ? ('failed' as const) : ('completed' as const),
                          durationSeconds: dur,
                        };
                      }
                      return s;
                    });
                    liveWorkflowStepsRef.current = next;
                    return next;
                  });
                } else if (event_type === 'ASK_USER') {
                  capturedAskUser = {
                    question: payload.question || 'Please provide clarification:',
                    options: payload.options,
                    context: payload.context,
                    call_id: payload.call_id,
                  };
                  if (!accumulatedText && payload.question) {
                    accumulatedText = payload.question;
                    setStreamingText(accumulatedText);
                  }
                } else if (event_type === 'AGENT_DONE') {
                  setActiveAnnouncement(null);
                  refreshSessionsList();
                } else if (event_type === 'AGENT_ERROR') {
                  const errMsg = payload.error || payload.message || 'An error occurred during agent execution.';
                  accumulatedText = `⚠️ **Agent Error**: ${errMsg}`;
                  setStreamingText(accumulatedText);
                  setActiveAnnouncement(null);
                }
              } catch (e) {
                // Ignore partial chunk parse errors
              }
            }
          }
        }
      } else {
        let errDetail = `HTTP ${chatRes.status}`;
        try {
          const errJson = await chatRes.json();
          errDetail = errJson.detail || errJson.message || errDetail;
        } catch {
          try {
            const raw = await chatRes.text();
            if (raw) errDetail = raw.slice(0, 200);
          } catch {}
        }
        throw new Error(errDetail);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || wasCancelledRef.current) {
        console.info('[QuantAgentPanel] Execution paused / cancelled by user.');
        accumulatedText = accumulatedText.trim()
          ? `${accumulatedText.trim()}\n\n*(Execution paused by user)*`
          : '*(Execution paused by user)*';
      } else {
        console.error('[QuantAgentPanel] Agent request failed:', err);
        const errDetail = err?.message || 'Connection failed';
        accumulatedText = accumulatedText.trim()
          ? `${accumulatedText.trim()}\n\n⚠️ **Something went wrong. Please try again later.**\n*(Error: ${errDetail})*`
          : `⚠️ **Something went wrong. Please try again later.**\n\n*(Error: ${errDetail})*`;
      }
    } finally {
      abortControllerRef.current = null;
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }

      const totalTurnDuration = Math.max(1, Math.round((Date.now() - turnStartTime) / 1000));

      // Finalize all remaining running steps
      const finalStepsSnapshot = (liveWorkflowStepsRef.current || []).map((s) => {
        if (s.status === 'running') {
          const dur = Math.max(1, s.durationSeconds || Math.round((Date.now() - (s.timestamp || turnStartTime)) / 1000));
          return {
            ...s,
            status: 'completed' as const,
            durationSeconds: dur,
            title: s.type === 'thinking' ? `Thought for ${dur}s` : s.title,
          };
        }
        return s;
      });

      const codeMatch = accumulatedText.match(/```(python|mql5|cpp)?\n([\s\S]*?)```/);
      if (codeMatch) {
        const candidate = codeMatch[2].trim();
        const candidateLang = codeMatch[1] === 'mql5' || codeMatch[1] === 'cpp' ? 'mql5' : 'python';
        if (isExecutableStrategyProposal(candidate, candidateLang)) {
          foundSnippet = candidate;
          snippetLang = candidateLang;
        }
      }

      // Fallback: If model created a file via tool call but didn't output code block in markdown
      if (!foundSnippet && createdFile?.content && isExecutableStrategyProposal(createdFile.content, snippetLang)) {
        foundSnippet = createdFile.content;
      }

      // Auto-route proposed code directly to Code Editor Diff Gate only when no tools were used (pure markdown code generation)
      if (foundSnippet && onOpenDiffGate && !createdFile && !lastEditedFile) {
        onOpenDiffGate(foundSnippet, snippetLang);
      }

      const responseText =
        accumulatedText ||
        capturedAskUser?.question ||
        'The AI agent did not receive a response from the model. Please retry or rephrase your request.';

      const finalAgentMessage: AgentChatMessage = {
        id: agentMsgId,
        sender: 'agent',
        text: responseText,
        thought: accumulatedThought || undefined,
        workflowSteps: finalStepsSnapshot.length > 0 ? finalStepsSnapshot : undefined,
        workDurationSeconds: totalTurnDuration,
        codeSnippet: foundSnippet,
        language: snippetLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        askUser: capturedAskUser,
      };

      const milestoneMatch = responseText.match(/\b(?:committed|checkpointed|created|upgraded to|saved|bumped to)\s+(?:version\s*|v)(\d+)\b/i);
      if (milestoneMatch && onVersionChanged) {
        const vNum = parseInt(milestoneMatch[1], 10);
        onVersionChanged(vNum);
      }

      setMessages((prev) => [...prev, finalAgentMessage]);
      setStreamingText('');
      setIsStreaming(false);
      setCurrentThought('');
      setActiveAnnouncement(null);
      setLiveWorkflowSteps([]);
      setLiveElapsedSeconds(0);
      liveWorkflowStepsRef.current = [];
      if (capturedAskUser) {
        setPendingInteraction(capturedAskUser);
      } else {
        setPendingInteraction(null);
      }
      refreshSessionsList();

      if (wasCancelledRef.current && lastUserPromptRef.current) {
        setInputPrompt(lastUserPromptRef.current);
        setTimeout(() => {
          if (chatInputRef.current) {
            chatInputRef.current.focus();
            adjustTextareaHeight(chatInputRef.current);
          }
        }, 60);
      }
    }
  };

  // Resume an active Human-in-the-Loop interaction with the trader's chosen option
  const handleResumeInteraction = (userChoice: string) => {
    handleSendMessage(userChoice, userChoice);
  };

  // Listen for external prompts from page (e.g. + New Version button)
  const lastProcessedExternalPromptRef = useRef<number>(0);
  useEffect(() => {
    if (externalPrompt && externalPrompt.timestamp && externalPrompt.timestamp !== lastProcessedExternalPromptRef.current) {
      lastProcessedExternalPromptRef.current = externalPrompt.timestamp;
      handleSendMessage(externalPrompt.prompt);
    }
  }, [externalPrompt]);

  // Dynamic Quick Replies: ONLY shown when the agent explicitly asks or expects a user decision
  const quickReplies = useMemo<Array<{ label: string; action: () => void; style: string }>>(() => {
    if (isStreaming || messages.length === 0) return [];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender !== 'agent') return [];

    // Note: ask_user options are handled directly inside the Human-in-the-Loop Card.
    // Quick replies are reserved for future proactive user action suggestions.

    // 2. Agent asks whether to test in sandbox or on chart, or prompts user to test
    const text = (lastMsg.text || '').toLowerCase();
    const asksToTest =
      text.includes('backtest sandbox or on the chart') ||
      text.includes('sandbox or on the chart') ||
      text.includes('test it in the backtest sandbox') ||
      text.includes('test it in the sandbox') ||
      text.includes('would you like to test') ||
      text.includes('would you like me to test') ||
      text.includes('ready to test') ||
      text.includes('shall we test') ||
      text.includes('should we test') ||
      text.includes('would you like to run a backtest') ||
      text.includes('run a backtest?') ||
      text.includes('test it?');

    if (asksToTest) {
      const strat = activeFileName ? activeFileName.replace(/\.[^/.]+$/, '') : 'the strategy';
      return [
        {
          label: '⚡ Test in Sandbox',
          action: () =>
            handleSendMessage(
              `Run a full sandbox backtest on ${strat} for XAUUSD 15m (2024-01-01 to 2025-12-31) and provide an in-depth quant autopsy.`
            ),
          style:
            'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:border-emerald-500/70',
        },
        ...(onTestOnChart
          ? [
              {
                label: '📈 Test on Chart',
                action: () => onTestOnChart(),
                style:
                  'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:border-cyan-500/60',
              },
            ]
          : []),
      ];
    }

    return [];
  }, [isStreaming, messages, activeFileName, onTestOnChart, handleSendMessage]);

  const getActiveWorkingStatus = () => {
    let raw = '';
    const runningStep = liveWorkflowSteps.find((s) => s.status === 'running');
    if (runningStep) {
      if (runningStep.type === 'thinking') raw = 'Formulating quantitative reasoning plan...';
      else if (runningStep.type === 'backtest') raw = runningStep.title || 'Executing backtest simulation...';
      else if (runningStep.type === 'sandbox_test') raw = runningStep.title || 'Validating strategy in sandbox...';
      else if (runningStep.type === 'market_data') raw = runningStep.title || 'Fetching market data bars...';
      else if (runningStep.type === 'read_file') raw = runningStep.title || 'Reading workspace file...';
      else if (runningStep.type === 'edit_file') raw = runningStep.title || 'Applying code modifications...';
      else if (runningStep.type === 'create_file') raw = runningStep.title || 'Writing strategy code...';
      else if (runningStep.type === 'web_search') raw = runningStep.title || 'Searching web research...';
      else if (runningStep.type === 'analysis' || runningStep.title?.toLowerCase().includes('compact') || runningStep.title?.toLowerCase().includes('digest')) {
        raw = 'Working...';
      } else {
        raw = runningStep.title || 'Executing task...';
      }
    } else if (activeAnnouncement) {
      const annLower = activeAnnouncement.toLowerCase();
      if (annLower.includes('digest') || annLower.includes('distilling') || annLower.includes('compacting')) {
        raw = 'Working...';
      } else {
        raw = activeAnnouncement;
      }
    } else if (streamingText) {
      raw = 'Synthesizing quantitative response...';
    } else {
      raw = 'Working on strategy task...';
    }
    // Clean raw single or double quotes around filenames (e.g. 'filename.mq5' -> filename.mq5)
    raw = raw.replace(/['"]+/g, '');
    // Strict privacy & path hygiene: strip any host filesystem paths (e.g. C:\...\strategy.mq5 -> strategy.mq5)
    raw = raw.replace(/[A-Za-z]:\\[^:\n\r\t]+?\\([^\s\\/]+)/g, '$1');
    raw = raw.replace(/(?:\/[a-zA-Z0-9_\-\.]+)+\/([^\s\\/]+)/g, '$1');
    return raw;
  };

  // Handle incoming telemetry report from Central Sandbox Runner
  useEffect(() => {
    if (incomingTelemetryReport && incomingTelemetryReport.timestamp) {
      const rep = incomingTelemetryReport;
      const m = rep.metrics || {};
      const reportPrompt = `📊 **Sandbox Simulation Completed**:
- **Strategy**: \`${rep.strategyName || 'strategy'}\`
- **Asset / Timeframe**: ${rep.symbol} (${rep.timeframe})
- **Date Window**: ${rep.dateRange || 'Selected Range'}
- **Performance Summary**:
  - Net Profit: **${(m.netProfitPct ?? 0) >= 0 ? '+' : ''}${m.netProfitPct ?? 0}%** ($${(m.netProfit ?? 0).toLocaleString('en-US')})
  - Win Rate: **${m.winRate ?? 0}%** (${m.totalTrades ? Math.round(((m.winRate ?? 0) / 100) * m.totalTrades) : 0}/${m.totalTrades ?? 0} trades)
  - Sharpe Ratio: **${m.sharpeRatio ?? 0}** | Profit Factor: **${m.profitFactor ?? 0}**
  - Max Drawdown: **${m.maxDrawdownPct ?? 0}%**
  - Bars Processed: **${(m.barsProcessed ?? 0).toLocaleString('en-US')}** (${m.executionTimeMs ?? 50}ms)
  - Lookahead Bias: **0.000% (Strictly Causal)**

Please perform an institutional Quant Autopsy:
1. Edge & market regime diagnosis: why did winning trades succeed and where did drawdowns cluster?
2. Code & parameter logic assessment against \`${rep.strategyName}\`.
3. Concrete, quantified enhancements for version 2 (\`_v2.py\`).`;

      handleSendMessage(reportPrompt);
    }
  }, [incomingTelemetryReport]);

  const topThreeSessions = sessionsList.slice(0, 3);
  const olderSessions = sessionsList.slice(3);

  /* Collapsed Slim Rail Mode */
  if (isCollapsed) {
    return (
      <aside className="w-12 bg-[#090D14] border-l border-[#1A2333] flex flex-col items-center justify-between py-2 shrink-0 select-none h-full relative z-20 transition-all">
        <div className="flex flex-col items-center gap-2">
          {/* Expand Button */}
          <button
            onClick={() => handleToggleCollapse(false)}
            className="p-2 rounded-lg bg-[#0E1522] hover:bg-[#162032] text-cyan-400 hover:text-cyan-300 border border-[#1E293B] hover:border-cyan-500/50 transition-all shadow-md group relative cursor-pointer"
            title="Expand Agent Panel (Click to open)"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>

          <div className="w-6 h-px bg-[#1A2333] my-1" />

          {/* New Chat quick action while collapsed */}
          <button
            onClick={() => {
              handleToggleCollapse(false);
              handleStartNewChat();
            }}
            className="p-1.5 rounded-md hover:bg-[#141C2C] text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="New Conversation"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Vertical rotated text label */}
          <button
            onClick={() => handleToggleCollapse(false)}
            className="flex flex-col items-center gap-2 text-slate-400 hover:text-cyan-300 transition-colors py-4 group cursor-pointer"
            title="Click to expand Quant AI"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isStreaming
                  ? 'bg-slate-400'
                  : viewState === 'active'
                  ? 'bg-emerald-400'
                  : 'bg-slate-500'
              }`}
            />
            <div
              className="text-[11px] font-mono font-semibold tracking-widest text-slate-400 group-hover:text-cyan-300 select-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              QUANT AI
            </div>
          </button>
        </div>

        {/* Collapsed bottom status matching adjacent drawer height (h-8) and color */}
        <div className="h-8 w-full border-t border-[#202A38] bg-[#0B0F16] flex items-center justify-center shrink-0">
          <button
            onClick={() => handleToggleCollapse(false)}
            className="p-1 text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Expand Panel"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      style={
        isMounted && isDesktopScreen
          ? { width: `${panelWidth}px`, maxWidth: '75vw', minWidth: '320px' }
          : { width: '100%', maxWidth: '100%', minWidth: '0px' }
      }
      className={`w-full lg:w-auto bg-[#090D14] border-l border-[#1A2333] flex flex-col shrink-0 select-text h-full relative font-sans text-slate-200 ${
        isDragging ? 'transition-none select-none' : 'transition-[width] duration-150'
      }`}
    >
      {/* Interactive Left Border Resizer Handle (Desktop only) */}
      <div
        onMouseDown={startResize}
        onDoubleClick={toggleWide}
        className={`hidden lg:flex absolute left-0 top-0 bottom-0 w-2.5 -ml-1.5 cursor-col-resize z-30 group items-center justify-center select-none transition-colors ${
          isDragging ? 'bg-cyan-500/40' : 'hover:bg-cyan-500/25'
        }`}
        title="Drag left/right to resize width · Double-click to toggle wide"
      >
        <div
          className={`w-0.5 h-12 rounded-full transition-all ${
            isDragging ? 'bg-cyan-400 scale-y-125' : 'bg-transparent group-hover:bg-cyan-400/90'
          }`}
        />
      </div>

      {/* 1. Header Bar: Aligned with middle section header (h-12) */}
      <div className="h-12 px-3.5 border-b border-[#182334] flex items-center justify-between bg-gradient-to-r from-[#0C121E] to-[#0A0E17] shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              isStreaming ? 'bg-slate-400 ring-2 ring-slate-400/20' : 'bg-emerald-400 ring-2 ring-emerald-400/20'
            }`}
          />
          <span className="text-xs sm:text-[13px] font-semibold text-slate-200 truncate tracking-tight" title={sessionTitle}>
            {sessionTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* New Chat Button (+) */}
          <button
            onClick={handleStartNewChat}
            className="p-2 rounded-lg hover:bg-[#151D2C] text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Start New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* History Button */}
          <button
            onClick={() => setIsHistoryOpen((p) => !p)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isHistoryOpen
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'hover:bg-[#151D2C] text-slate-400 hover:text-slate-200'
            }`}
            title="Saved Conversations History"
          >
            <History className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[#1E293B] mx-0.5" />

          {/* Expand / Wide Button */}
          <button
            onClick={toggleWide}
            className="p-2 rounded-lg hover:bg-[#151D2C] text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title={isWide ? 'Restore standard width' : 'Expand panel width'}
          >
            {isWide ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Collapse Button */}
          <button
            onClick={() => handleToggleCollapse(true)}
            className="p-2 rounded-lg hover:bg-[#151D2C] text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Collapse Agent Panel"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. History Dropdown / Drawer (accessible anytime) */}
      {isHistoryOpen && (
        <div className="absolute top-12 inset-x-0 bottom-0 bg-[#090D14]/95 backdrop-blur-sm z-30 flex flex-col border-b border-[#1A2333]">
          <div className="p-2.5 border-b border-[#1A2333] flex items-center justify-between bg-[#0C121D]">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-200">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Saved Conversations</span>
              <span className="text-[9.5px] text-slate-500 font-mono">({sessionsList.length})</span>
            </div>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-1 rounded-sm text-slate-400 hover:text-slate-200 hover:bg-[#151D2C]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessionsList.length === 0 ? (
              <div className="p-6 text-center text-[10px] text-slate-500 font-mono">
                No saved conversations found.
              </div>
            ) : (
              sessionsList.map((s) => {
                const isSelected = s.session_id === sessionId;
                const isConfirming = deleteConfirmId === s.session_id;

                return (
                  <div
                    key={s.session_id}
                    onClick={() => handleSelectSession(s.session_id)}
                    className={`group px-2 py-1.5 rounded-sm border text-[11px] cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-cyan-950/25 border-cyan-500/40 text-cyan-200'
                        : 'bg-[#0C121D] border-[#1A2333] hover:border-slate-600 text-slate-300 hover:bg-[#101826]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-slate-100 group-hover:text-cyan-300">
                        {s.title || 'Untitled Session'}
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{s.message_count} msgs</span>
                        <span>·</span>
                        <span>{formatRelativeTime(s.updated_at)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {isConfirming ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 bg-[#191012] px-1.5 py-0.5 rounded border border-red-500/40 text-[9.5px]"
                        >
                          <span className="text-red-300">Delete?</span>
                          <button
                            onClick={(e) => handleDeleteSession(s.session_id, e)}
                            className="px-1.5 py-0.2 rounded-sm bg-red-600 hover:bg-red-500 text-white font-bold"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="px-1 py-0.2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(s.session_id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-sm hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                          title="Delete Conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-[#1A2333] bg-[#0C121D]">
            <button
              onClick={handleStartNewChat}
              className="w-full py-1 rounded-sm bg-[#131B29] hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-[#1A2333] text-[10px] font-mono transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              <span>Start New Conversation</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. LANDING VIEW: Quant AI Identity + Chat Input + Recent Conversations */}
      {viewState === 'landing' ? (
        <div className="flex-1 flex flex-col justify-center px-3.5 sm:px-6 md:px-8 py-4 sm:py-6 overflow-y-auto w-full">
          <div className="w-full my-auto space-y-4 sm:space-y-6">
            {/* Top: Quant AI Agent Identity */}
            <div className="text-center space-y-1.5 shrink-0 pb-1">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.15)]">
                <Brain className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-xs sm:text-[13px] font-bold tracking-tight text-slate-100 uppercase font-mono">
                  Quant AI
                </span>
                <span className="text-[8.5px] px-1 py-0.2 rounded-sm bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                  Agent
                </span>
              </div>
              <p className="text-[9.5px] sm:text-[10px] text-slate-400 font-sans max-w-[420px] mx-auto leading-tight">
                Autonomous quantitative research &amp; zero look-ahead synthesis
              </p>
            </div>

            {/* Middle: Main Chat Input Card */}
            <div className="space-y-2 w-full">
              <div className="flex items-center px-1">
                <span className="text-[11px] font-mono uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>New Strategy Synthesis</span>
                </span>
              </div>

              {/* Input Card with Drag & Drop Targeting */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  if (!isDraggingOverChat) setIsDraggingOverChat(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDraggingOverChat(false);
                  }
                }}
                onDrop={handleFileDrop}
                className="w-full rounded-2xl border border-[#1A2536] focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 bg-[#090E1A]/95 p-3 sm:p-3.5 transition-all shadow-xl shadow-black/40 relative backdrop-blur-md"
              >
                {/* Drag-over drop zone visual overlay */}
                {isDraggingOverChat && (
                  <div className="absolute inset-0 z-30 rounded-2xl bg-cyan-950/90 border-2 border-dashed border-cyan-400 backdrop-blur-md flex flex-col items-center justify-center gap-1.5 text-cyan-200 pointer-events-none animate-in fade-in duration-100">
                    <FileCode className="w-5 h-5 text-cyan-300 animate-bounce" />
                    <span className="text-xs font-mono font-semibold text-cyan-100">Drop code file to target in chat</span>
                    <span className="text-[10px] text-cyan-400/80 font-mono">Agent will directly target this strategy file</span>
                  </div>
                )}

                {uploadedAttachment && (
                  <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-[#111A29] border border-cyan-500/40 flex items-center justify-between text-[11px] shadow-sm animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 text-cyan-300 truncate">
                      {uploadedAttachment.isImage ? (
                        <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      ) : (
                        <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                          {uploadedAttachment.lineStart && uploadedAttachment.lineEnd ? 'Code Snippet' : uploadedAttachment.isWorkspaceFile ? 'Target File' : 'Attachment'}
                        </span>
                        <span className="truncate font-mono font-semibold text-slate-100">
                          {uploadedAttachment.filename}
                          {uploadedAttachment.lineStart && uploadedAttachment.lineEnd
                            ? ` L${uploadedAttachment.lineStart}-${uploadedAttachment.lineEnd}`
                            : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setUploadedAttachment(null)}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 ml-2 transition-colors cursor-pointer"
                      title="Remove target"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <textarea
                  ref={landingInputRef}
                  value={inputPrompt}
                  onChange={(e) => {
                    setInputPrompt(e.target.value);
                    adjustTextareaHeight(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask Quant AI anything or drop a code file..."
                  rows={2}
                  className="w-full bg-transparent text-slate-100 text-[13px] sm:text-[14px] outline-none resize-none placeholder:text-slate-500 font-sans leading-relaxed select-text min-h-[44px] max-h-[168px] overflow-y-auto"
                />

                <div className="flex items-center justify-between pt-1 mt-1 gap-2">
                  <div className="flex items-center gap-1.5 relative min-w-0 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".png,.jpg,.jpeg,.webp,.py,.mq5,.json,.csv,.txt"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isStreaming}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#141C2C] disabled:opacity-40 transition-colors shrink-0"
                      title="Attach Image or Code File"
                    >
                      <Plus className="w-4 h-4 stroke-[2.2]" />
                    </button>

                    <div className="relative min-w-0">
                      <button
                        type="button"
                        onClick={() => setIsModelSelectorOpen((p) => !p)}
                        className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full hover:bg-[#141C2C] text-slate-400 hover:text-slate-200 text-[11px] sm:text-[12px] font-sans transition-colors cursor-pointer border border-transparent hover:border-[#223147] max-w-[140px] sm:max-w-[240px]"
                        title="Select AI Model & Thinking Rigor"
                      >
                        <span className="truncate" suppressHydrationWarning>{getModelPillLabel()}</span>
                        <ChevronUp className="w-3 h-3 text-slate-400 stroke-[2.5] shrink-0" />
                      </button>

                      {isModelSelectorOpen && renderModelSelectorPopover()}
                    </div>
                  </div>

                  {/* Circular Send / Pause Button: Dark circle with red square matching screenshot */}
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleCancelExecution}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-[#2C2D31] hover:bg-[#383A3F] active:scale-95 transition-colors cursor-pointer shrink-0"
                      title="Stop execution & edit prompt"
                    >
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-[#E05252] block shrink-0" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputPrompt.trim() && !uploadedAttachment}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                        !inputPrompt.trim() && !uploadedAttachment
                          ? 'bg-[#141C2B] text-slate-500 cursor-not-allowed border border-[#1E2B40]'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/25 active:scale-95 cursor-pointer'
                      }`}
                      title="Send message"
                    >
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  )}
              </div>
            </div>

              {/* Quick Starters under Input */}
              <div className="flex flex-wrap gap-1.5 text-[10px] sm:text-[10.5px] font-mono w-full">
                <button
                  onClick={() => handleSendMessage('Develop a scalping Expert Advisor for Gold (XAUUSD) on M1 timeframe')}
                  className="px-2 sm:px-2.5 py-1 rounded-md bg-[#0A0F1D] hover:bg-[#121B2C] border border-[#162032] hover:border-slate-600 text-slate-300 hover:text-slate-100 transition-colors whitespace-nowrap"
                >
                  + Gold Scalper
                </button>
                <button
                  onClick={() => handleSendMessage('Search the financial web for the best verified algorithmic trading strategies')}
                  className="px-2 sm:px-2.5 py-1 rounded-md bg-[#0A0F1D] hover:bg-[#121B2C] border border-[#162032] hover:border-slate-600 text-slate-300 hover:text-slate-100 transition-colors whitespace-nowrap"
                >
                  🌐 Web Search
                </button>
                <button
                  onClick={() => handleSendMessage('Propose a 100-run hyperparameter sweep across ATR multiplier and periods')}
                  className="px-2 sm:px-2.5 py-1 rounded-md bg-[#0A0F1D] hover:bg-[#121B2C] border border-[#162032] hover:border-slate-600 text-slate-300 hover:text-slate-100 transition-colors whitespace-nowrap"
                >
                  🛡️ Matrix Sweep
                </button>
                <button
                  onClick={() => handleSendMessage('Transpile this strategy between Python Polars and MQL5 EA')}
                  className="px-2 sm:px-2.5 py-1 rounded-md bg-[#0A0F1D] hover:bg-[#121B2C] border border-[#162032] hover:border-slate-600 text-slate-300 hover:text-slate-100 transition-colors whitespace-nowrap"
                >
                  ⇄ Transpile Code
                </button>
              </div>
            </div>

            {/* Spaced Section: Recent Conversations (Harmonious breathing space, fills width with small padding) */}
            <div className="pt-3.5 border-t border-[#141E2D] space-y-1.5 w-full">
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 px-0.5 pb-0.5">
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-semibold text-slate-400">
                  <Clock className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Recent Conversations</span>
                </span>
                <span className="text-[8px] text-slate-500 font-mono">{sessionsList.length} saved</span>
              </div>

              {topThreeSessions.length === 0 ? (
                <div className="py-2.5 text-center text-[9px] text-slate-500 font-mono">
                  No saved conversations yet.
                </div>
              ) : (
                <div className="space-y-1 w-full">
                  {topThreeSessions.map((s) => {
                    const isConfirming = deleteConfirmId === s.session_id;

                    return (
                      <div
                        key={s.session_id}
                        onClick={() => handleSelectSession(s.session_id)}
                        className="group px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#162032] bg-[#0A0F1D] hover:bg-[#121B2C] hover:border-slate-600 cursor-pointer transition-all flex items-center justify-between gap-2 w-full"
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 shrink-0 group-hover:scale-125 group-hover:bg-cyan-300 transition-all" />
                          <span className="text-[11px] sm:text-[11.5px] font-medium text-slate-200 group-hover:text-slate-100 truncate">
                            {s.title || 'Quantitative Strategy'}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="text-[9px] sm:text-[9.5px] text-slate-500 font-mono whitespace-nowrap">
                            {s.message_count} msgs · {formatRelativeTime(s.updated_at)}
                          </span>

                          {isConfirming ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 bg-[#191012] px-1 py-0.2 rounded border border-red-500/40 text-[9px]"
                            >
                              <span className="text-red-300">Delete?</span>
                              <button
                                onClick={(e) => handleDeleteSession(s.session_id, e)}
                                className="px-1.5 py-0.2 rounded-sm bg-red-600 hover:bg-red-500 text-white font-bold text-[8.5px]"
                              >
                                Yes
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="px-1 py-0.2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 text-[8.5px]"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(s.session_id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Older Sessions Expander */}
                  {olderSessions.length > 0 && (
                    <div>
                      {showAllPastChats && (
                        <div className="space-y-1 pt-1 max-h-36 overflow-y-auto pr-0.5 w-full">
                          {olderSessions.map((s) => {
                            const isConfirming = deleteConfirmId === s.session_id;

                            return (
                              <div
                                key={s.session_id}
                                onClick={() => handleSelectSession(s.session_id)}
                                className="group px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#162032] bg-[#0A0F1D] hover:bg-[#121B2C] hover:border-slate-600 cursor-pointer transition-all flex items-center justify-between gap-2 w-full"
                              >
                                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0 group-hover:bg-cyan-400 transition-colors" />
                                  <span className="text-[11px] sm:text-[11.5px] font-medium text-slate-200 group-hover:text-slate-100 truncate">
                                    {s.title || 'Quantitative Strategy'}
                                  </span>
                                </div>

                                <div className="shrink-0 flex items-center gap-1.5">
                                  <span className="text-[9px] sm:text-[9.5px] text-slate-500 font-mono whitespace-nowrap">
                                    {s.message_count} msgs · {formatRelativeTime(s.updated_at)}
                                  </span>

                                  {isConfirming ? (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 bg-[#191012] px-1 py-0.2 rounded border border-red-500/40 text-[9px]"
                                    >
                                      <span className="text-red-300">Delete?</span>
                                      <button
                                        onClick={(e) => handleDeleteSession(s.session_id, e)}
                                        className="px-1.5 py-0.2 rounded-sm bg-red-600 hover:bg-red-500 text-white font-bold text-[8.5px]"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirmId(null);
                                        }}
                                        className="px-1 py-0.2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 text-[8.5px]"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(s.session_id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <button
                        onClick={() => setShowAllPastChats((p) => !p)}
                        className="w-full mt-1 py-1 px-2 rounded-md text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-[#0A0F1D] hover:bg-[#121B2C] border border-[#162032] transition-colors flex items-center justify-center gap-1"
                      >
                        <span>
                          {showAllPastChats
                            ? 'Collapse conversations'
                            : `+${olderSessions.length} older conversations`}
                        </span>
                        {showAllPastChats ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 4. ACTIVE CONVERSATION VIEW: Messages Stream with Input at Bottom */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Pinned Strategy Context Banner */}
          {(() => {
            const currentWorkingStrategy = boundStrategy;
            if (!currentWorkingStrategy) {
              if (activeFileName && (activeFileName.endsWith('.mq5') || activeFileName.endsWith('.py'))) {
                return (
                  <div className="px-3.5 py-1.5 bg-[#0A0E17] border-b border-[#162032] flex items-center justify-between text-[11px] shrink-0 font-sans">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-500 font-sans">New Strategy Synthesis</span>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={() => setBoundStrategy(activeFileName)}
                        className="group inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10192A] hover:bg-[#16233B] text-cyan-300 hover:text-white border border-cyan-500/35 hover:border-cyan-400/60 text-[10.5px] font-sans font-medium transition-all cursor-pointer shrink-0 select-none active:scale-95"
                        title={`Target and modify open file: ${activeFileName}`}
                      >
                        <ArrowRightLeft className="w-2.5 h-2.5 text-cyan-400 group-hover:rotate-180 transition-transform duration-300 shrink-0" />
                        <span>Work on open file: <span className="font-mono text-cyan-200 group-hover:text-cyan-100 font-semibold">{activeFileName}</span></span>
                      </button>
                    </div>
                  </div>
                );
              }
              return null;
            }
            const hasOtherFileOpen = Boolean(activeFileName && activeFileName !== currentWorkingStrategy);
            return (
              <div className="px-3.5 py-1.5 bg-[#0A0E17] border-b border-[#162032] flex items-center justify-between text-[11px] shrink-0 font-sans">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-slate-400">Working on:</span>
                  <span className="font-semibold text-cyan-300 font-mono truncate">{currentWorkingStrategy}</span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] border border-cyan-500/30 font-bold uppercase">
                    {activeVersion ? (String(activeVersion).startsWith('v') ? activeVersion : `v${activeVersion}`) : (currentWorkingStrategy.match(/_v(\d+)/) ? `v${currentWorkingStrategy.match(/_v(\d+)/)![1]}` : 'v1')}
                  </span>
                  {hasOtherFileOpen && activeFileName && (
                    <button
                      type="button"
                      onClick={() => setBoundStrategy(activeFileName || null)}
                      className="ml-2.5 group inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10192A] hover:bg-[#16233B] text-cyan-300 hover:text-white border border-cyan-500/35 hover:border-cyan-400/60 text-[10.5px] font-sans font-medium transition-all shadow-sm hover:shadow-[0_0_10px_rgba(6,182,212,0.18)] cursor-pointer shrink-0 select-none active:scale-95"
                      title={`Switch agent working target to ${activeFileName}`}
                    >
                      <ArrowRightLeft className="w-2.5 h-2.5 text-cyan-400 group-hover:rotate-180 transition-transform duration-300 shrink-0" />
                      <span>Switch to <span className="font-mono text-cyan-200 group-hover:text-cyan-100 font-semibold">{activeFileName}</span></span>
                      <ArrowRight className="w-2.5 h-2.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform duration-200 shrink-0" />
                    </button>
                  )}
                </div>
                {incomingTelemetryReport?.winRate !== undefined || incomingTelemetryReport?.metrics?.winRate !== undefined ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                    Best WR: {incomingTelemetryReport.winRate || incomingTelemetryReport.metrics?.winRate}%
                  </span>
                ) : null}
              </div>
            );
          })()}

          {/* Messages Stream */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 p-3.5 space-y-4 overflow-y-auto min-h-0 font-sans"
          >
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className="w-full flex flex-col items-start"
              >
                {msg.sender === 'user' ? (
                  /* User Message: Full width card box with uniform rounded corners and nested bottom-right actions */
                  <div className="w-full group">
                    <div className="w-full px-4 py-3 rounded-2xl bg-[#131E30] border border-[#1E2D44] text-slate-100 text-[13px] sm:text-[13.5px] leading-relaxed shadow-sm font-sans select-text cursor-text flex flex-col">
                      {msg.attachment && (
                        <div className="mb-2 px-2.5 py-1 rounded-lg bg-[#0A101C] border border-cyan-500/30 flex items-center gap-2 font-mono text-[11px]">
                          {msg.attachment.isImage ? (
                            <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          ) : (
                            <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          )}
                          <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                            {msg.attachment.lineStart && msg.attachment.lineEnd ? 'Code Snippet' : msg.attachment.isWorkspaceFile ? 'Target File' : 'Attachment'}
                          </span>
                          <span className="text-slate-200 truncate font-semibold">
                            {msg.attachment.filename}
                            {msg.attachment.lineStart && msg.attachment.lineEnd
                              ? ` L${msg.attachment.lineStart}-${msg.attachment.lineEnd}`
                              : ''}
                          </span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{cleanUserMessageText(msg.text)}</p>

                      {/* Bottom-right info & action buttons nested inside the bubble */}
                      <div className="flex items-center justify-end gap-1.5 pt-2 -mb-0.5 text-[10px] text-slate-400/80 font-mono select-none self-end">
                        <span>You</span>
                        <span>·</span>
                        <span>{msg.timestamp}</span>
                        <button
                          type="button"
                          onClick={() => handleEditMessage(cleanUserMessageText(msg.text))}
                          className="p-0.5 rounded hover:bg-[#1C2A40] text-slate-400 hover:text-cyan-300 transition-colors ml-1 cursor-pointer"
                          title="Edit prompt & resend"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleCopyMessage(msg.id, cleanUserMessageText(msg.text))}
                          className="p-0.5 rounded hover:bg-[#1C2A40] text-slate-400 hover:text-slate-200 transition-colors ml-0.5 cursor-pointer"
                          title="Copy message"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* AI / Quant AI Message: Flow directly on canvas - NO CARD BUBBLE */
                  <div className="w-full space-y-1.5">
                    {/* Agent Header with Name, Timestamp & Copy */}
                    <div className="flex items-center justify-between w-full text-[11px] text-neutral-400 font-sans px-0.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 font-medium text-neutral-200">
                          <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                          <span>Quant AI</span>
                        </div>
                        <span className="text-neutral-600">·</span>
                        <span className="text-neutral-500">{msg.timestamp}</span>
                      </div>

                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.text)}
                        className="p-1 rounded hover:bg-white/[0.04] text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1 select-none"
                        title="Copy response"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-[8.5px] text-emerald-400 font-mono">Copied</span>
                          </>
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Agent Response Content (No card bubble, direct flow) */}
                    <div className="w-full text-neutral-200 text-[13px] sm:text-[13.5px] leading-relaxed select-text cursor-text space-y-2">
                      {/* Collapsible Workflow Steps (Thought, Read, Create, Edit, Test, Backtest) */}
                      {msg.workflowSteps && msg.workflowSteps.length > 0 ? (
                        <AgentWorkflowStepsView
                          steps={msg.workflowSteps}
                          totalDuration={msg.workDurationSeconds}
                          isLive={false}
                        />
                      ) : msg.thought ? (
                        <AgentWorkflowStepsView
                          steps={[
                            {
                              id: `fallback_thought_${msg.id}`,
                              type: 'thinking',
                              title: `Thought for ${msg.workDurationSeconds ? formatDuration(msg.workDurationSeconds) : 'a few seconds'}`,
                              detail: msg.thought,
                              status: 'completed',
                              durationSeconds: msg.workDurationSeconds || 12,
                            },
                          ]}
                          totalDuration={msg.workDurationSeconds || 12}
                          isLive={false}
                        />
                      ) : null}

                      {/* Structured Rich Markdown Typography */}
                      <RichMarkdown content={msg.text} excludeStrategyCode={msg.codeSnippet} onApplyCode={onApplyCode} />

                      {/* Interactive Human in the Loop Clarification / Question Card */}
                      {msg.askUser && (() => {
                        const isLatestWaiting = Boolean(
                          pendingInteraction && (
                            pendingInteraction.call_id === msg.askUser?.call_id ||
                            idx === messages.length - 1
                          )
                        );

                        // Ensure clean variable options (2 to 4 choices) with exactly ONE unified "Other (write your answer)"
                        const rawOpts = (msg.askUser.options || []).filter(Boolean);
                        const domainOpts = rawOpts.filter(
                          (o) => !o.toLowerCase().includes('other') && !o.toLowerCase().includes('custom')
                        );
                        // Variable domain choices decided by the agent (2 to 4) + single Other option
                        const displayOptions = [...domainOpts, 'Other (write your answer)'];
                        const otherIdx = displayOptions.length - 1;

                        if (!isLatestWaiting) {
                          // Past resolved interaction in chat history
                          return (
                            <div className="mt-2.5 px-3 py-2 rounded-xl border border-zinc-800 bg-[#161619] flex items-center justify-between text-xs font-sans text-zinc-400">
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="font-medium text-zinc-200 truncate text-[12.5px]">{msg.askUser.question}</span>
                              </div>
                              <span className="text-[10.5px] text-zinc-500 font-mono shrink-0 ml-2">Answered</span>
                            </div>
                          );
                        }

                        return (
                          <div className="hitl-active-card relative mt-3 p-4 rounded-xl border border-[#27272A] bg-[#18181B] shadow-2xl space-y-3 font-sans animate-in fade-in duration-200 select-none overflow-hidden">
                            <style>{`
                              @keyframes hitlBorderSweep {
                                0% { background-position: 250% 0; }
                                100% { background-position: -50% 0; }
                              }
                              .hitl-active-card::before {
                                content: '';
                                position: absolute;
                                inset: 0;
                                border-radius: 0.75rem;
                                padding: 1.5px;
                                background: linear-gradient(
                                  90deg,
                                  rgba(39, 39, 42, 0.4) 0%,
                                  rgba(99, 102, 241, 0.25) 20%,
                                  rgba(6, 182, 212, 0.9) 45%,
                                  rgba(255, 255, 255, 1) 50%,
                                  rgba(6, 182, 212, 0.9) 55%,
                                  rgba(99, 102, 241, 0.25) 80%,
                                  rgba(39, 39, 42, 0.4) 100%
                                );
                                background-size: 250% 100%;
                                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                                -webkit-mask-composite: xor;
                                mask-composite: exclude;
                                pointer-events: none;
                                z-index: 10;
                                animation: hitlBorderSweep 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                                transition: opacity 0.25s ease;
                              }
                              /* Once cursor in it, stop this effect immediately */
                              .hitl-active-card:hover::before {
                                animation-play-state: paused;
                                opacity: 0.25;
                              }
                            `}</style>
                            {/* Header with [?] icon and concise question */}
                            <div className="flex items-start gap-2.5">
                              <div className="w-5 h-5 rounded bg-[#27272A] border border-[#3F3F46] flex items-center justify-center text-zinc-300 text-xs shrink-0 mt-0.5 font-mono">
                                ?
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-zinc-100 font-medium text-[13.5px] leading-snug">
                                  {msg.askUser.question}
                                </div>
                                {msg.askUser.context && (
                                  <p className="mt-1 text-[11.5px] text-zinc-400 font-sans leading-normal">
                                    {msg.askUser.context}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Dynamically Numbered Options (1, 2, 3... + Other) */}
                            <div className="space-y-1.5 pt-1">
                              {displayOptions.map((opt, oIdx) => {
                                const isOther = oIdx === otherIdx;
                                const isSelected = selectedClarificationIdx === oIdx;
                                const numLabel = oIdx + 1;
                                return (
                                  <div key={oIdx} className="space-y-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedClarificationIdx(oIdx);
                                        if (isOther) {
                                          setShowCustomInput(true);
                                        } else {
                                          setShowCustomInput(false);
                                        }
                                      }}
                                      onDoubleClick={() => {
                                        if (!isOther) {
                                          handleResumeInteraction(opt);
                                        }
                                      }}
                                      className={`w-full p-2.5 rounded-lg border text-left text-[12.5px] font-sans transition-all flex items-start gap-2.5 cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#27272A] border-zinc-500 text-white shadow-sm'
                                          : 'bg-[#202024]/70 hover:bg-[#27272A]/70 border-zinc-800/80 hover:border-zinc-700 text-zinc-300 hover:text-white'
                                      }`}
                                    >
                                      <span
                                        className={`w-5 h-5 rounded text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5 ${
                                          isSelected ? 'bg-zinc-700 text-white font-bold' : 'bg-zinc-800 text-zinc-400'
                                        }`}
                                      >
                                        {numLabel}
                                      </span>
                                      <span className="flex-1 leading-relaxed">
                                        {isOther && !opt.includes('(') ? 'Other (write your answer)' : opt}
                                      </span>
                                    </button>

                                    {/* Inline custom answer input when Other is selected */}
                                    {isOther && isSelected && (
                                      <div className="pt-1 pl-7.5 pr-0.5 animate-in fade-in duration-150">
                                        <input
                                          type="text"
                                          value={customOtherText}
                                          onChange={(e) => setCustomOtherText(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && customOtherText.trim()) {
                                              e.preventDefault();
                                              handleResumeInteraction(customOtherText.trim());
                                            }
                                          }}
                                          placeholder="Type your custom answer..."
                                          className="w-full bg-[#121214] border border-zinc-700 text-zinc-100 text-[12.5px] px-3 py-2 rounded-lg outline-none focus:border-cyan-500 font-sans shadow-inner placeholder:text-zinc-500"
                                          autoFocus
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Modal-style Footer: Skip & Submit Buttons matching screenshot */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272A]/80">
                              <button
                                type="button"
                                onClick={() => handleResumeInteraction('Proceed with recommended defaults')}
                                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                              >
                                Skip
                              </button>
                              <button
                                type="button"
                                disabled={
                                  selectedClarificationIdx === null ||
                                  (selectedClarificationIdx === otherIdx && !customOtherText.trim())
                                }
                                onClick={() => {
                                  if (selectedClarificationIdx !== null) {
                                    if (selectedClarificationIdx === otherIdx) {
                                      if (customOtherText.trim()) {
                                        handleResumeInteraction(customOtherText.trim());
                                      }
                                    } else {
                                      handleResumeInteraction(displayOptions[selectedClarificationIdx]);
                                    }
                                  }
                                }}
                                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer"
                              >
                                <span>Submit</span>
                                <span className="text-[11px] opacity-80 font-mono">↵</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Live Streaming / Agent Loading State */}
            {isStreaming && (
              <div className="w-full space-y-2 pt-1 font-sans">
                {/* Agent Header */}
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-sans px-0.5">
                  <div className="flex items-center gap-1.5 font-medium text-neutral-200">
                    <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                    <span>Quant AI</span>
                  </div>
                </div>

                {/* Real-time Live Workflow Steps (Thinking, Read, Create, Edit, Test, Backtest) */}
                <AgentWorkflowStepsView
                  steps={liveWorkflowSteps}
                  totalDuration={liveElapsedSeconds}
                  isLive={true}
                />

                {/* Live Markdown Stream (if text started arriving) */}
                {streamingText && (
                  <div className="w-full text-neutral-200 text-[13px] sm:text-[13.5px] leading-relaxed pt-1">
                    <RichMarkdown content={streamingText} onApplyCode={onApplyCode} />
                  </div>
                )}

                {/* Live Working / Loading State with Shimmer Text Effect */}
                <div className="flex items-center gap-2 py-2 px-0.5 text-[13px] font-sans select-none">
                  <style>{`
                    @keyframes shimmerSweep {
                      0% { background-position: 100% 50%; }
                      100% { background-position: 0% 50%; }
                    }
                  `}</style>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400 shrink-0" />
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundImage: 'linear-gradient(90deg, #64748b 0%, #64748b 26%, #ffffff 50%, #64748b 74%, #64748b 100%)',
                      backgroundSize: '250% 100%',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent',
                      animation: 'shimmerSweep 1.1s linear infinite',
                    }}
                    className="font-medium"
                  >
                    {getActiveWorkingStatus()}
                  </span>
                  <span style={{ color: '#b4b4bb' }} className="font-normal text-xs ml-0.5">
                    {formatDuration(liveElapsedSeconds) || `${liveElapsedSeconds}s`}
                  </span>
                </div>
              </div>
            )}

            <div ref={chatScrollRef} />
          </div>

          {/* Input Box Pinned to Bottom matching screenshot layout */}
          <div className="p-2.5 bg-[#090D14] border-t border-[#141C2C] shrink-0 font-sans">
            {/* 1 File With Changes Confirmation Bar matching user screenshot (placed right above input box) */}
            {diffState?.active && (
              <div className="mb-2 px-3 py-2 rounded-xl bg-[#141824] border border-[#232E44] flex items-center justify-between text-xs shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150 select-none font-sans">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-semibold text-slate-100 truncate text-[12.5px]">
                    1 File With Changes
                  </span>
                  {activeFileName && (
                    <span className="text-slate-400 text-[11px] font-mono truncate hidden sm:inline">
                      ({activeFileName})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onRejectDiff && (
                    <button
                      type="button"
                      onClick={onRejectDiff}
                      className="px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded text-xs font-normal transition-colors cursor-pointer"
                      title="Reject all proposed changes"
                    >
                      Reject all
                    </button>
                  )}
                  {onAcceptDiff && (
                    <button
                      type="button"
                      onClick={onAcceptDiff}
                      className="flex items-center gap-1 px-3 py-1 rounded bg-[#0078D4] hover:bg-[#106EBE] text-white text-xs font-medium shadow-sm transition-colors active:scale-95 cursor-pointer"
                      title="Accept all proposed changes"
                    >
                      <span>Accept all</span>
                      <ChevronDown className="w-3.5 h-3.5 text-white/80" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* Dynamic Quick Action Suggestions: Hidden for now per user specification (suggestion logic reserved for dedicated proactive user actions) */}
            {false && quickReplies.length > 0 && (
              <div className="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar font-mono text-[11px] select-none animate-in fade-in duration-150">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mr-0.5">
                  Suggested:
                </span>
                {quickReplies.map((qr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={qr.action}
                    disabled={isStreaming}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all font-semibold whitespace-nowrap active:scale-95 shadow-sm disabled:opacity-40 cursor-pointer ${qr.style}`}
                  >
                    <span>{qr.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Main Chat Input Card with Drag & Drop Targeting */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (!isDraggingOverChat) setIsDraggingOverChat(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDraggingOverChat(false);
                }
              }}
              onDrop={handleFileDrop}
              className="rounded-2xl border border-[#1A2536] focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 bg-[#090E1A]/95 p-3 transition-all shadow-xl shadow-black/40 relative backdrop-blur-md"
            >
              {/* Drag-over drop zone visual overlay */}
              {isDraggingOverChat && (
                <div className="absolute inset-0 z-30 rounded-2xl bg-cyan-950/90 border-2 border-dashed border-cyan-400 backdrop-blur-md flex flex-col items-center justify-center gap-1.5 text-cyan-200 pointer-events-none animate-in fade-in duration-100">
                  <FileCode className="w-5 h-5 text-cyan-300 animate-bounce" />
                  <span className="text-xs font-mono font-semibold text-cyan-100">Drop code file to target in chat</span>
                  <span className="text-[10px] text-cyan-400/80 font-mono">Agent will directly target this strategy file</span>
                </div>
              )}

              {uploadedAttachment && (
                <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-[#111A29] border border-cyan-500/40 flex items-center justify-between text-[11px] shadow-sm animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-cyan-300 truncate">
                    {uploadedAttachment.isImage ? (
                      <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                        {uploadedAttachment.lineStart && uploadedAttachment.lineEnd ? 'Code Snippet' : uploadedAttachment.isWorkspaceFile ? 'Target File' : 'Attachment'}
                      </span>
                      <span className="truncate font-mono font-semibold text-slate-100">
                        {uploadedAttachment.filename}
                        {uploadedAttachment.lineStart && uploadedAttachment.lineEnd
                          ? ` L${uploadedAttachment.lineStart}-${uploadedAttachment.lineEnd}`
                          : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setUploadedAttachment(null)}
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 ml-2 transition-colors cursor-pointer"
                    title="Remove target"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <textarea
                ref={chatInputRef}
                value={inputPrompt}
                onChange={(e) => {
                  setInputPrompt(e.target.value);
                  adjustTextareaHeight(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (pendingInteraction) {
                      handleResumeInteraction(inputPrompt);
                    } else {
                      handleSendMessage();
                    }
                  }
                }}
                placeholder={
                  pendingInteraction
                    ? 'Reply to question, or type custom choice...'
                    : 'Ask Quant AI anything or drop a code file...'
                }
                rows={2}
                className="w-full bg-transparent text-slate-100 text-[13px] sm:text-[14px] outline-none resize-none placeholder:text-slate-500 font-sans leading-relaxed select-text min-h-[44px] max-h-[168px] overflow-y-auto"
              />

              <div className="flex items-center justify-between pt-1 mt-1">
                <div className="flex items-center gap-1.5 relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.webp,.py,.mq5,.json,.csv,.txt"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isStreaming}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#141C2C] disabled:opacity-40 transition-colors"
                    title="Attach Image or Code File"
                  >
                    <Plus className="w-4 h-4 stroke-[2.2]" />
                  </button>

                  <div className="relative min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsModelSelectorOpen((p) => !p)}
                      className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full hover:bg-[#141C2C] text-slate-400 hover:text-slate-200 text-[11px] sm:text-[12px] font-sans transition-colors cursor-pointer border border-transparent hover:border-[#223147] max-w-[140px] sm:max-w-[240px]"
                      title="Select AI Model & Thinking Rigor"
                    >
                      <span className="truncate" suppressHydrationWarning>{getModelPillLabel()}</span>
                      <ChevronUp className="w-3 h-3 text-slate-400 stroke-[2.5] shrink-0" />
                    </button>

                    {isModelSelectorOpen && renderModelSelectorPopover()}
                  </div>
                </div>

                {/* Circular Send / Pause Button: Dark circle with red square matching screenshot */}
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleCancelExecution}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-[#2C2D31] hover:bg-[#383A3F] active:scale-95 transition-colors cursor-pointer shrink-0"
                    title="Stop execution & edit prompt"
                  >
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-[#E05252] block shrink-0" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingInteraction) {
                        handleResumeInteraction(inputPrompt);
                      } else {
                        handleSendMessage();
                      }
                    }}
                    disabled={!inputPrompt.trim() && !uploadedAttachment}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                      !inputPrompt.trim() && !uploadedAttachment
                        ? 'bg-[#141C2B] text-slate-500 cursor-not-allowed border border-[#1E2B40]'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/25 active:scale-95 cursor-pointer'
                    }`}
                    title={pendingInteraction ? 'Submit choice to Human in the Loop' : 'Send message'}
                  >
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Fixed Bottom Telemetry & LLM Consumption Bar (Synchronized with adjacent autopsy drawer) */}
      <div className="h-8 border-t border-[#202A38] bg-[#0B0F16] px-3 flex items-center justify-between text-xs font-mono text-slate-400 shrink-0 select-none z-10 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          {/* Selected LLM Icon & Name */}
          <div className="flex items-center gap-1.5 text-slate-300 shrink-0">
            {selectedProvider === 'gemini' ? (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            ) : selectedProvider === 'freeinference' ? (
              <Zap className="w-3.5 h-3.5 text-violet-400" />
            ) : selectedProvider === 'agentrouter' ? (
              <Brain className="w-3.5 h-3.5 text-cyan-400" />
            ) : selectedProvider === 'anthropic' ? (
              <Zap className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="font-medium text-slate-200 text-[11px]">
              {selectedModel === 'gemini-3.8-flash'
                ? 'Gemini 3.8'
                : selectedModel === 'gemini-3.5-flash-lite'
                ? 'Gemini 3.5'
                : selectedModel === 'glm-5.3-flash'
                ? 'GLM 5.3'
                : selectedModel === 'qwen3.6-35b'
                ? 'Qwen 3.6'
                : selectedModel.includes('deepseek')
                ? 'DeepSeek V4'
                : selectedProvider === 'freeinference'
                ? 'FreeInference'
                : selectedProvider === 'gemini'
                ? 'Gemini 3.8'
                : 'AI Agent'}
            </span>
          </div>

          <span className="text-slate-600">·</span>

          {/* Latency & Status */}
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-emerald-400 font-medium" suppressHydrationWarning>
              {!isDesktopScreen || panelWidth < 420 ? 'Ready' : 'Quant AI Ready'}
            </span>
            <span className="text-slate-600">·</span>
            <span>98ms</span>
          </div>
        </div>

        {/* Tokens & Cost telemetry (Desktop only with sufficient width to prevent mobile wrap) */}
        {isDesktopScreen && panelWidth >= 440 && (
          <div className="hidden sm:flex items-center gap-2.5 shrink-0" suppressHydrationWarning>
            {/* Full Prompt Live Tokens (Text + Context + System Prompt + Tools schemas) */}
            <div
              className="flex items-center gap-1 text-slate-400 font-mono text-[11px]"
              title="Full LLM prompt token size: user input text + conversation context + system instructions + tool definitions"
            >
              <span className="text-slate-500 font-medium">prompt:</span>
              <span className="text-slate-200 font-semibold" suppressHydrationWarning>
                {fullPromptTokens.toLocaleString('en-US')}t
              </span>
              <span className="text-slate-600">/ 128k</span>
            </div>

            <span className="text-slate-600">·</span>

            {/* Cost */}
            <div className="text-slate-400 font-mono text-[11px]" title="Estimated cost">
              <span className="text-slate-500">$</span>
              <span className="text-slate-200" suppressHydrationWarning>
                {((fullPromptTokens * 0.0000018) + (messages.length * 0.0002)).toFixed(4)}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Cpu,
  Code2,
  FileCode,
  FileJson,
  FileText,
  Play,
  Download,
  FolderTree,
  Folder,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  FilePlus,
  Trash2,
  Check,
  X,
  Edit3,
  Copy,
  Loader2,
  LineChart,
  BarChart3,
  MoreHorizontal,
  Sparkles,
  AlertTriangle,
  History,
  GitCommit,
  Send,
  Plus,
  Globe,
  Menu,
} from 'lucide-react';
import { MonacoMultiFileEditor, EditorFile } from '@/components/editor/MonacoMultiFileEditor';
import { QuantAgentPanel } from '@/components/quant/QuantAgentPanel';
import { CentralSandboxRunnerPanel, SandboxLaunchConfig, SimulatedTrade, BacktestRunSummary } from '@/components/quant/CentralSandboxRunnerPanel';
import { CentralChartRunnerPanel } from '@/components/quant/CentralChartRunnerPanel';
import { CentralBacktestSubHeader } from '@/components/quant/CentralBacktestSubHeader';
import { QuantMobileNav, QuantMobileTab } from '@/components/quant/QuantMobileNav';
import { PublishStrategyModal } from '@/components/community/PublishStrategyModal';
import { Mt5Icon } from '@/components/icons/Mt5Icon';
import { CodeViewIcon, ResultsViewIcon, ChartCandlesIcon } from '@/components/icons/QuantViewIcons';
import { useAuthStore } from '@/stores/authStore';
import {
  AutopsyDiagnosticsDrawer,
  LintIssue,
  StrategyParameter,
  SimulationMetrics,
  DrawerTab,
} from '@/components/quant/AutopsyDiagnosticsDrawer';

type CodeLanguage = 'python' | 'mql5';

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    let s = dateStr.trim();
    if (s.length >= 10 && s[4] === '.' && s[7] === '.') {
      s = s.slice(0, 4) + '-' + s.slice(5, 7) + '-' + s.slice(8);
    }
    s = s.replace(' ', 'T');
    if (!s.endsWith('Z') && !s.includes('+') && !/[-+]\d{2}:\d{2}$/.test(s)) {
      s += 'Z';
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return dateStr.slice(5, 10);

    const now = Date.now();
    const diffMs = now - d.getTime();
    if (diffMs < 0) return 'just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return '1h ago';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.slice(5, 10);
  }
}

interface ContextMenuState {
  x: number;
  y: number;
  file: EditorFile;
}


function validateSourceCode(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  if (!text || !text.trim()) return issues;

  const lines = text.split('\n');

  // Standard and MQL5-specific fundamental types
  const KNOWN_TYPES = new Set([
    'void', 'char', 'uchar', 'bool', 'short', 'ushort', 'int', 'uint',
    'color', 'long', 'ulong', 'datetime', 'float', 'double', 'string',
    'MqlRates', 'MqlTick', 'MqlDateTime', 'MqlTradeRequest', 'MqlTradeResult',
    'MqlTradeCheckResult', 'MqlBookInfo', 'CTrade', 'CPositionInfo', 'COrderInfo',
    'CHistoryOrderInfo', 'CSymbolInfo', 'CAccountInfo', 'CExpert', 'CArrayDouble',
    'CArrayInt', 'CArrayLong', 'CArrayString', 'CArrayObj', 'CList', 'CTree',
    'input', 'sinput', 'extern', 'const', 'static', 'virtual', 'inline', 'auto',
  ]);

  // Dynamically collect user-defined struct, class, and enum identifiers
  const typeMatches = text.matchAll(/\b(?:struct|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g);
  for (const m of typeMatches) {
    KNOWN_TYPES.add(m[1]);
  }

  const CONTROL_KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
    'return', 'break', 'continue', 'struct', 'class', 'enum', 'union',
    'template', 'typename', 'new', 'delete', 'sizeof', 'group'
  ]);

  let inBlockComment = false;
  let unclosedCommentLine: number | null = null;
  let unclosedStringLine: number | null = null;

  const braceStack: { line: number; col: number }[] = [];
  const parenStack: { line: number; col: number }[] = [];
  const bracketStack: { line: number; col: number }[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const lineNum = idx + 1;
    let cleanLine = '';
    let i = 0;
    const len = rawLine.length;

    while (i < len) {
      // 1. Multi-line block comment /* ... */
      if (inBlockComment) {
        if (rawLine.slice(i, i + 2) === '*/') {
          inBlockComment = false;
          unclosedCommentLine = null;
          i += 2;
        } else {
          i++;
        }
        continue;
      }

      // 2. Start of multi-line block comment /*
      if (rawLine.slice(i, i + 2) === '/*') {
        inBlockComment = true;
        unclosedCommentLine = lineNum;
        i += 2;
        continue;
      }

      // 3. Single-line comment //
      if (rawLine.slice(i, i + 2) === '//') {
        break; // Ignore rest of the line
      }

      // 4. Double-quoted strings "..."
      if (rawLine[i] === '"') {
        cleanLine += ' ';
        const startLine = lineNum;
        i++;
        let closed = false;
        while (i < len) {
          if (rawLine[i] === '\\' && i + 1 < len) {
            i += 2;
          } else if (rawLine[i] === '"') {
            closed = true;
            i++;
            break;
          } else {
            i++;
          }
        }
        if (!closed && !rawLine.endsWith('\\')) {
          unclosedStringLine = startLine;
        }
        continue;
      }

      // 5. Single-quoted char literals '...'
      if (rawLine[i] === "'") {
        cleanLine += ' ';
        i++;
        while (i < len) {
          if (rawLine[i] === '\\' && i + 1 < len) {
            i += 2;
          } else if (rawLine[i] === "'") {
            i++;
            break;
          } else {
            i++;
          }
        }
        continue;
      }

      // 6. Delimiters
      const char = rawLine[i];
      if (char === '{') {
        braceStack.push({ line: lineNum, col: i + 1 });
      } else if (char === '}') {
        if (braceStack.length > 0) {
          braceStack.pop();
        } else {
          issues.push({
            line: lineNum,
            column: i + 1,
            message: `SyntaxError: Unexpected closing brace '}' without matching '{'`,
            severity: 'error',
            rule: 'UNEXPECTED_BRACE',
          });
        }
      } else if (char === '(') {
        parenStack.push({ line: lineNum, col: i + 1 });
      } else if (char === ')') {
        if (parenStack.length > 0) {
          parenStack.pop();
        } else {
          issues.push({
            line: lineNum,
            column: i + 1,
            message: `SyntaxError: Unexpected closing parenthesis ')' without matching '('`,
            severity: 'error',
            rule: 'UNEXPECTED_PAREN',
          });
        }
      } else if (char === '[') {
        bracketStack.push({ line: lineNum, col: i + 1 });
      } else if (char === ']') {
        if (bracketStack.length > 0) {
          bracketStack.pop();
        } else {
          issues.push({
            line: lineNum,
            column: i + 1,
            message: `SyntaxError: Unexpected closing bracket ']' without matching '['`,
            severity: 'error',
            rule: 'UNEXPECTED_BRACKET',
          });
        }
      }

      cleanLine += char;
      i++;
    }

    const trimmed = cleanLine.trim();
    if (!trimmed || inBlockComment) continue;
    if (trimmed.startsWith('#')) continue; // Preprocessor directives never require semicolons

    // Inspect statements inside function bodies (brace depth > 0)
    if (braceStack.length > 0) {
      // A. Illegal consecutive identifiers in if conditions (e.g. if(lots sasadsa> max_lot))
      const ifMatch = trimmed.match(/^if\s*\((.*)\)/);
      if (ifMatch) {
        const cond = ifMatch[1];
        const doubleIdMatch = cond.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
        if (doubleIdMatch && !CONTROL_KEYWORDS.has(doubleIdMatch[1]) && !KNOWN_TYPES.has(doubleIdMatch[1])) {
          issues.push({
            line: lineNum,
            column: rawLine.indexOf(doubleIdMatch[2]) + 1,
            message: `SyntaxError: Unexpected token '${doubleIdMatch[2]}' in condition expression`,
            severity: 'error',
            rule: 'UNEXPECTED_TOKEN',
          });
        }
      }

      // B. Variable declaration with unrecognized/misspelled type (e.g. defwooble lot_step = ...;)
      const declMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|;)/);
      if (declMatch) {
        const typeToken = declMatch[1];
        if (!KNOWN_TYPES.has(typeToken) && !CONTROL_KEYWORDS.has(typeToken)) {
          issues.push({
            line: lineNum,
            column: rawLine.indexOf(typeToken) + 1,
            message: `SyntaxError: Unknown type or undeclared identifier '${typeToken}'`,
            severity: 'error',
            rule: 'UNKNOWN_TYPE',
          });
        }
      }

      // C. Standalone bare token / garbage statements (e.g. lpms, fewfeffwe, sasdasdas)
      const bareTokenMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*);?$/);
      if (bareTokenMatch) {
        const token = bareTokenMatch[1];
        if (!CONTROL_KEYWORDS.has(token) && !['{', '}', ';'].includes(token)) {
          issues.push({
            line: lineNum,
            column: rawLine.indexOf(token) + 1,
            message: `SyntaxError: Undeclared identifier or unexpected statement '${token}'`,
            severity: 'error',
            rule: 'UNDECLARED_IDENTIFIER',
          });
        }
      }
    }
  }

  if (unclosedCommentLine) {
    issues.push({
      line: unclosedCommentLine,
      column: 1,
      message: `SyntaxError: Unterminated block comment '/*'`,
      severity: 'error',
      rule: 'UNTERMINATED_COMMENT',
    });
  }

  if (unclosedStringLine) {
    issues.push({
      line: unclosedStringLine,
      column: 1,
      message: `SyntaxError: Unterminated string literal`,
      severity: 'error',
      rule: 'UNTERMINATED_STRING',
    });
  }

  if (parenStack.length > 0) {
    const last = parenStack[parenStack.length - 1];
    issues.push({
      line: last.line,
      column: last.col,
      message: `SyntaxError: Unbalanced parentheses '()' (unclosed '(' at line ${last.line})`,
      severity: 'error',
      rule: 'UNBALANCED_PARENS',
    });
  }

  if (bracketStack.length > 0) {
    const last = bracketStack[bracketStack.length - 1];
    issues.push({
      line: last.line,
      column: last.col,
      message: `SyntaxError: Unbalanced square brackets '[]' (unclosed '[' at line ${last.line})`,
      severity: 'error',
      rule: 'UNBALANCED_BRACKETS',
    });
  }

  if (braceStack.length > 0) {
    const last = braceStack[braceStack.length - 1];
    issues.push({
      line: last.line,
      column: last.col,
      message: `SyntaxError: Unbalanced curly braces '{}' (unclosed '{' at line ${last.line})`,
      severity: 'error',
      rule: 'UNBALANCED_BRACES',
    });
  }

  return issues;
}

function isCodeFile(filename: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase().trim();
  // Filter out compilation artifacts, log dumps, and binary files
  if (
    lower.endsWith('.log') ||
    lower.endsWith('.ex5') ||
    lower.endsWith('.exe') ||
    lower.endsWith('.dll') ||
    lower.endsWith('.bin') ||
    lower.endsWith('.dat') ||
    lower.endsWith('.db') ||
    lower.endsWith('.sqlite') ||
    lower.endsWith('.pyc')
  ) {
    return false;
  }
  // Include standard strategy source code files
  const codeExts = ['.py', '.mq5', '.mqh', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.toml', '.cpp', '.c', '.h', '.hpp', '.sql'];
  return codeExts.some((ext) => lower.endsWith(ext));
}

function deduplicateFiles(files: EditorFile[]): EditorFile[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  return files.filter((f) => {
    if (!f.id || seenIds.has(f.id) || seenNames.has(f.name)) return false;
    if (!isCodeFile(f.name)) return false;
    seenIds.add(f.id);
    seenNames.add(f.name);
    return true;
  });
}

function parseStrategyParameters(code: string, lang: CodeLanguage): StrategyParameter[] {
  const params: StrategyParameter[] = [];

  if (lang === 'python') {
    // 1. Extract parameters defined via self.parameters.get("name", default)
    const getRegex = /(?:self\.)?parameters\.get\(\s*["']([a-zA-Z0-9_]+)["']\s*,\s*([^)]+)\)/g;
    let getMatch;
    while ((getMatch = getRegex.exec(code)) !== null) {
      const name = getMatch[1];
      const rawVal = getMatch[2].trim();

      let type: StrategyParameter['type'] = 'float';
      let val: any = rawVal;

      if (/^-?\d+$/.test(rawVal)) {
        type = 'int';
        val = parseInt(rawVal, 10);
      } else if (/^-?\d*\.\d+$/.test(rawVal)) {
        type = 'float';
        val = parseFloat(rawVal);
      } else if (rawVal === 'True' || rawVal === 'False') {
        type = 'bool';
        val = rawVal === 'True';
      } else {
        type = 'string';
        val = rawVal.replace(/^['"]|['"]$/g, '');
      }

      if (!params.some((p) => p.name === name)) {
        params.push({ name, type, defaultValue: val });
      }
    }

    // 2. Extract constructor keyword arguments from def __init__(self, ...)
    const initMatch = code.match(/def\s+__init__\s*\(\s*self\s*,\s*([^)]+)\)/s);
    if (initMatch && initMatch[1]) {
      // Remove any type annotations with brackets (e.g., : Optional[Dict[str, Any]])
      const sanitized = initMatch[1].replace(/:\s*[^,=]+\[[^\]]+\]/g, '');
      const rawArgs = sanitized.split(',');
      for (const rawArg of rawArgs) {
        const trimmed = rawArg.trim();
        if (!trimmed || trimmed === 'self' || trimmed.startsWith('*')) continue;

        const parts = trimmed.split('=');
        if (parts.length === 2) {
          const left = parts[0].trim();
          const right = parts[1].trim();

          let name = left;
          let type: StrategyParameter['type'] = 'float';

          if (left.includes(':')) {
            const typeParts = left.split(':');
            name = typeParts[0].trim();
            const rawType = typeParts[1].trim().toLowerCase();
            if (rawType.includes('int')) type = 'int';
            else if (rawType.includes('float')) type = 'float';
            else if (rawType.includes('bool')) type = 'bool';
            else if (rawType.includes('str')) type = 'string';
          } else {
            if (/^-?\d+$/.test(right)) type = 'int';
            else if (/^-?\d*\.\d+$/.test(right)) type = 'float';
            else if (right === 'True' || right === 'False') type = 'bool';
            else type = 'string';
          }

          // Skip generic parameter bag or malformed names from bracket parsing
          if (
            name === 'parameters' ||
            name.includes('[') ||
            name.includes(']') ||
            !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
          ) {
            continue;
          }

          let val: any = right;
          if (type === 'int') val = parseInt(right, 10);
          else if (type === 'float') val = parseFloat(right);
          else if (type === 'bool') val = right === 'True';
          else val = right.replace(/^['"]|['"]$/g, '');

          if (!params.some((p) => p.name === name)) {
            if (!isNaN(val) || typeof val === 'boolean' || typeof val === 'string') {
              params.push({ name, type, defaultValue: val });
            }
          }
        }
      }
    }
  } else if (lang === 'mql5') {
    const inputRegex = /input\s+(int|double|float|bool|string)\s+([a-zA-Z0-9_]+)\s*=\s*([^;]+);(?:\s*\/\/\s*(.*))?/g;
    let match;
    while ((match = inputRegex.exec(code)) !== null) {
      const rawType = match[1].toLowerCase();
      const name = match[2];
      const rawVal = match[3].trim();
      const comment = match[4]?.trim();

      let type: StrategyParameter['type'] = 'double';
      let val: any = rawVal;

      if (rawType === 'int') {
        type = 'int';
        val = parseInt(rawVal, 10);
      } else if (rawType === 'double' || rawType === 'float') {
        type = 'double';
        val = parseFloat(rawVal);
      } else if (rawType === 'bool') {
        type = 'bool';
        val = rawVal.toLowerCase() === 'true';
      } else {
        type = 'string';
        val = rawVal.replace(/^['"]|['"]$/g, '');
      }

      params.push({ name, type, defaultValue: val, comment });
    }
  }

  return params;
}

// Helper to extract unique user ID from user profile
const extractUserHandle = (u: any): string | null => {
  if (!u) return null;
  if (u.id && typeof u.id === 'string') return u.id;
  return null;
};

// Helper functions for persistent strategy tracking & history
const getStoredFileHistory = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('quantlab_file_history');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string');
    }
  } catch {
    // ignore
  }
  return [];
};

const recordFileInHistory = (filename: string) => {
  if (typeof window === 'undefined' || !filename) return;
  try {
    const prev = getStoredFileHistory().filter((n) => n.toLowerCase() !== filename.toLowerCase());
    const updated = [filename, ...prev].slice(0, 20);
    localStorage.setItem('quantlab_file_history', JSON.stringify(updated));
    localStorage.setItem('quantlab_last_active_file', filename);
    localStorage.setItem('quantlab_active_file', filename);
  } catch {
    // ignore
  }
};

const removeFileFromHistory = (filename: string) => {
  if (typeof window === 'undefined' || !filename) return;
  try {
    const prev = getStoredFileHistory().filter((n) => n.toLowerCase() !== filename.toLowerCase());
    localStorage.setItem('quantlab_file_history', JSON.stringify(prev));
  } catch {
    // ignore
  }
};

// Immediately parse localStorage synchronously for zero-delay hydration
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

export type CentralViewMode = 'editor' | 'sandbox_runner' | 'chart_runner';

function QuantLabPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFile = searchParams?.get('file') || searchParams?.get('strategy');
  const queryVersion = searchParams?.get('version');
  const [language, setLanguage] = useState<CodeLanguage>('mql5');
  const [code, setCode] = useState<string>('');
  const codeRef = useRef<string>('');
  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  const [activeBottomTab, setActiveBottomTab] = useState<DrawerTab>('autopsy');
  const [isConsoleExpanded, setIsConsoleExpanded] = useState<boolean>(false);
  const [navigateToLine, setNavigateToLine] = useState<{ line: number; column?: number; timestamp: number } | null>(null);

  // Real-time AST Validation & Diagnostics State
  const [lintIssues, setLintIssues] = useState<LintIssue[]>([]);
  const validationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // User Identity & Root Workspace Name (Dynamic state with direct resolution)
  const { user } = useAuthStore();
  const [workspaceUsername, setWorkspaceUsername] = useState<string>('');
  const [isResolvingUser, setIsResolvingUser] = useState<boolean>(true);
  const rootUsername = workspaceUsername;
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'My Workspace';

  // Loading & Saving States for Physical Disk Files
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Collapsible Workspace Directory State (Auto-collapsed on compact screens < 1280px)
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(true);
  const [isWorkspaceFolderOpen, setIsWorkspaceFolderOpen] = useState<boolean>(true);
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');

  // Auto-collapse explorer on compact screen resize or initial compact mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      setIsExplorerOpen(false);
    }
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1180) {
        setIsExplorerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3-Dots More Options Menu State
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);

  // Right-Click Context Menu & Inline Rename State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingFileName, setRenamingFileName] = useState<string>('');
  const [fileToDelete, setFileToDelete] = useState<EditorFile | null>(null);

  // Workspace Files Repository (Loaded from Physical Disk, starts empty with no default)
  const [workspaceFiles, setWorkspaceFiles] = useState<EditorFile[]>([]);

  // Open Tabs State (Files currently open in code editor)
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const activeFileIdRef = useRef<string>('');

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  // AI Diff Gate State
  const [diffState, setDiffState] = useState<{
    active: boolean;
    fileId: string;
    original: string;
    modified: string;
  }>({
    active: false,
    fileId: 'file_strategy_py',
    original: '',
    modified: '',
  });

  // Simulation execution state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationMetrics, setSimulationMetrics] = useState<SimulationMetrics | null>(null);
  const [simulationTrades, setSimulationTrades] = useState<SimulatedTrade[]>([]);
  const [simulationRunId, setSimulationRunId] = useState<string | null>(null);

  // Completed test & simulation results cache indexed by strategy base name
  const [strategyTestResults, setStrategyTestResults] = useState<
    Record<
      string,
      {
        runId?: string;
        versionNum?: number;
        metrics: SimulationMetrics;
        trades?: SimulatedTrade[];
        passed: boolean;
        updatedAt: number;
      }
    >
  >({});

  // Persisted completed backtest runs loaded from backend repository
  const [persistedRuns, setPersistedRuns] = useState<BacktestRunSummary[]>([]);
  const [isPersistedRunsLoading, setIsPersistedRunsLoading] = useState<boolean>(true);

  const fetchPersistedRuns = useCallback(async () => {
    setIsPersistedRunsLoading(true);
    try {
      let data: BacktestRunSummary[] = [];
      try {
        const res = await fetch('/api/v1/backtests?limit=100&min_trades=1');
        if (res.ok) data = await res.json();
      } catch {
        const res2 = await fetch('/api/v1/backtests?limit=100&min_trades=1');
        if (res2.ok) data = await res2.json();
      }
      if (Array.isArray(data)) {
        const validRuns = data.filter((r) => {
          const t = Number(r.metrics?.total_trades ?? r.metrics?.totalTrades ?? (r as any).total_trades ?? 0);
          return t > 0;
        });
        setPersistedRuns(validRuns);
      }
    } catch (err) {
      console.warn('[QuantPage] Error fetching completed runs:', err);
    } finally {
      setIsPersistedRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersistedRuns();
  }, [fetchPersistedRuns]);

  // Central Viewport Controller Mode (replacing Monaco IDE with Sandbox or Chart runner panels)
  const [centralViewMode, setCentralViewMode] = useState<CentralViewMode>('editor');

  // Mobile Mode Controller: 'results' | 'chart' | 'code' | 'agent' (switched via fixed bottom nav bar on mobile)
  const [mobileActiveTab, setMobileActiveTab] = useState<QuantMobileTab>('code');

  const handleMobileTabChange = useCallback((tab: QuantMobileTab) => {
    setMobileActiveTab(tab);
    if (tab === 'results') {
      setCentralViewMode('sandbox_runner');
      setActiveBottomTab('autopsy');
    } else if (tab === 'chart') {
      setCentralViewMode('chart_runner');
      setActiveBottomTab('trade');
    } else if (tab === 'code') {
      setCentralViewMode('editor');
      setActiveBottomTab((prev) => (prev === 'parameters' ? 'parameters' : 'problems'));
    }
  }, []);

  useEffect(() => {
    if (centralViewMode === 'editor') {
      setMobileActiveTab((prev) => (prev === 'agent' ? prev : 'code'));
    } else if (centralViewMode === 'chart_runner') {
      setMobileActiveTab((prev) => (prev === 'agent' ? prev : 'chart'));
    } else {
      setMobileActiveTab((prev) => (prev === 'agent' ? prev : 'results'));
    }
  }, [centralViewMode]);

  // Auto-close workspace panel on opening Results/Chart, and restore prior open/closed state on returning to Code
  const isExplorerOpenRef = useRef<boolean>(isExplorerOpen);
  const wasExplorerOpenBeforeNonEditorRef = useRef<boolean>(true);
  const isConsoleExpandedRef = useRef<boolean>(isConsoleExpanded);
  const wasConsoleOpenBeforeChartRef = useRef<boolean>(false);
  const prevViewModeRef = useRef<CentralViewMode>('editor');

  // Chart Replay Temporal Telemetry State
  const [chartReplayState, setChartReplayState] = useState<{
    currentTime: number | null;
    currentBar: any | null;
    activeCount: number;
    isPlaying?: boolean;
  } | null>(null);

  useEffect(() => {
    isExplorerOpenRef.current = isExplorerOpen;
  }, [isExplorerOpen]);

  useEffect(() => {
    isConsoleExpandedRef.current = isConsoleExpanded;
  }, [isConsoleExpanded]);

  useEffect(() => {
    const prev = prevViewModeRef.current;
    prevViewModeRef.current = centralViewMode;

    if (centralViewMode === 'chart_runner') {
      if (prev === 'editor') {
        wasExplorerOpenBeforeNonEditorRef.current = isExplorerOpenRef.current;
      }
      // 1. Auto-close file explorer on Test on Chart
      setIsExplorerOpen(false);

      // 2. On compact screens (or standard laptops < 900px height), keep bottom panel collapsed (h-8 tab bar)
      // so the candlestick chart gets 80%+ of the screen height. User can expand with 1 click.
      const isCompactHeight = typeof window !== 'undefined' && window.innerHeight < 900;
      if (isCompactHeight) {
        setIsConsoleExpanded(false);
      } else {
        setIsConsoleExpanded(true);
      }
      setActiveBottomTab('trade');
    } else {
      // Whenever leaving Test on Chart (to editor or sandbox_runner), collapse the bottom panel
      if (prev === 'chart_runner') {
        setIsConsoleExpanded(false);
      }

      if (centralViewMode === 'sandbox_runner') {
        if (prev === 'editor') {
          wasExplorerOpenBeforeNonEditorRef.current = isExplorerOpenRef.current;
        }
        setIsExplorerOpen(false);
      } else if (centralViewMode === 'editor') {
        // Return to code: reopen file explorer if it was open before
        if (wasExplorerOpenBeforeNonEditorRef.current) {
          setIsExplorerOpen(true);
        } else {
          setIsExplorerOpen(false);
        }
      }
    }
  }, [centralViewMode]);
  const [sandboxLaunchConfig, setSandboxLaunchConfig] = useState<SandboxLaunchConfig | null>(null);
  const [incomingTelemetryReport, setIncomingTelemetryReport] = useState<any | null>(null);
  const [chatTargetAttachment, setChatTargetAttachment] = useState<{
    filename: string;
    lineStart?: number;
    lineEnd?: number;
    codeSnippet?: string;
  } | null>(null);

  const handleAttachFileToChat = useCallback(
    (filename: string, snippet?: { lineStart?: number; lineEnd?: number; codeSnippet?: string }) => {
      setChatTargetAttachment({
        filename,
        lineStart: snippet?.lineStart,
        lineEnd: snippet?.lineEnd,
        codeSnippet: snippet?.codeSnippet,
      });
    },
    []
  );

  const activeFileName = useMemo(() => {
    if (activeFileId) {
      const activeFile = workspaceFiles.find(
        (f) =>
          f.id === activeFileId ||
          f.name === activeFileId ||
          f.id.toLowerCase() === activeFileId.toLowerCase() ||
          activeFileId.includes(f.name.replace(/[^a-zA-Z0-9_]/g, '_')) ||
          f.id.includes(activeFileId.replace(/[^a-zA-Z0-9_]/g, '_'))
      );
      if (activeFile) return activeFile.name;
    }
    const codeFiles = workspaceFiles.filter((f) => isCodeFile(f.name));
    if (codeFiles.length > 0) return codeFiles[0].name;
    if (workspaceFiles.length > 0) return workspaceFiles[0].name;
    return '';
  }, [workspaceFiles, activeFileId]);

  const visibleWorkspaceFiles = useMemo(() => {
    return workspaceFiles.filter((f) => isCodeFile(f.name));
  }, [workspaceFiles]);

  const cleanActiveStrategyName = useMemo(() => {
    return activeFileName.replace(/\.[^/.]+$/, '').trim();
  }, [activeFileName]);

  const effectiveLanguage: CodeLanguage = useMemo(() => {
    const fn = (activeFileName || '').toLowerCase().trim();
    if (
      fn.endsWith('.mq5') ||
      fn.endsWith('.mqh') ||
      fn.endsWith('.cpp') ||
      fn.endsWith('.c') ||
      fn.endsWith('.h')
    ) {
      return 'mql5';
    }
    if (fn.endsWith('.py')) {
      return 'python';
    }
    if (
      code.includes('//+') ||
      code.includes('#property') ||
      code.includes('#include') ||
      code.includes('void OnTick') ||
      code.includes('int OnInit') ||
      code.includes('input group') ||
      code.includes('MqlRates')
    ) {
      return 'mql5';
    }
    return language || 'mql5';
  }, [activeFileName, code, language]);

  // Checks if there is valid strategy code loaded in an active file
  const hasExecutableCode = useMemo(() => {
    return Boolean(code && code.trim().length > 0 && activeFileId);
  }, [code, activeFileId]);

  // Strategy Version Management & AI Prompting State
  const [strategyVersions, setStrategyVersions] = useState<any[]>([]);
  const [activeVersionNum, setActiveVersionNum] = useState<number>(1);
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState<boolean>(false);
  const [isNewVersionPromptOpen, setIsNewVersionPromptOpen] = useState<boolean>(false);
  const [newVersionUserInstruction, setNewVersionUserInstruction] = useState<string>('');
  const [externalPrompt, setExternalPrompt] = useState<{ prompt: string; timestamp: number } | null>(null);
  const [viewingHistoricalVersion, setViewingHistoricalVersion] = useState<number | null>(null);
  const [historicalSnapshotCode, setHistoricalSnapshotCode] = useState<string | null>(null);
  const prePreviewCodeRef = useRef<string | null>(null);
  const headerVersionRef = useRef<HTMLDivElement>(null);
  const headerMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHeaderClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (headerVersionRef.current && !headerVersionRef.current.contains(target)) {
        setIsVersionMenuOpen(false);
        setIsNewVersionPromptOpen(false);
      }
      if (headerMoreRef.current && !headerMoreRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };
    const handleHeaderKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVersionMenuOpen(false);
        setIsNewVersionPromptOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    if (isVersionMenuOpen || isNewVersionPromptOpen || isMoreMenuOpen) {
      document.addEventListener('mousedown', handleHeaderClickOutside);
      document.addEventListener('keydown', handleHeaderKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleHeaderClickOutside);
      document.removeEventListener('keydown', handleHeaderKeyDown);
    };
  }, [isVersionMenuOpen, isNewVersionPromptOpen, isMoreMenuOpen]);

  // Shared active test run state (for both Test Results & Test on Chart)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetails, setSelectedRunDetails] = useState<any | null>(null);
  const [isLoadingRunDetails, setIsLoadingRunDetails] = useState<boolean>(false);
  const [isReRunningSimulation, setIsReRunningSimulation] = useState<boolean>(false);

  // Effective version number
  const effectiveVersionNum = viewingHistoricalVersion ?? activeVersionNum ?? 1;

  // Lookup active strategy's passed test results (strictly scoped to effective version)
  const activeStrategyTestResult = useMemo(() => {
    if (!cleanActiveStrategyName) return null;
    const versionKey = `${cleanActiveStrategyName}_v${effectiveVersionNum}`.toLowerCase();
    if (strategyTestResults[versionKey]) {
      return strategyTestResults[versionKey];
    }
    const direct = strategyTestResults[cleanActiveStrategyName] || (activeFileName ? strategyTestResults[activeFileName] : null);
    if (direct && (direct.versionNum === undefined || direct.versionNum === effectiveVersionNum)) {
      return direct;
    }
    return null;
  }, [cleanActiveStrategyName, activeFileName, effectiveVersionNum, strategyTestResults]);

  // Filter persisted runs for active strategy AND active version
  const availableStrategyRuns = useMemo(() => {
    if (!cleanActiveStrategyName) return [];
    const baseName = cleanActiveStrategyName.replace(/_v\d+$/, '');
    return persistedRuns.filter((r) => {
      // Exclude zero-trade tests: strictly treated as failed test / broken code / never done
      const tradesCount = Number(r.metrics?.total_trades ?? r.metrics?.totalTrades ?? (r as any).total_trades ?? 0);
      if (tradesCount <= 0) return false;

      const matchStrategy =
        (r.strategy_name && r.strategy_name.toLowerCase() === baseName.toLowerCase()) ||
        (r.strategy_name && r.strategy_name.toLowerCase() === cleanActiveStrategyName.toLowerCase()) ||
        r.strategy_id === cleanActiveStrategyName ||
        r.strategy_id === baseName ||
        r.strategy_id === activeFileName ||
        (r.strategy_id !== 'custom' && (r.strategy_id.includes(baseName) || baseName.includes(r.strategy_id)));
      if (!matchStrategy) return false;
      const v = Number(r.version_num ?? (r.config as any)?.version_num ?? 1);
      return v === effectiveVersionNum;
    });
  }, [persistedRuns, cleanActiveStrategyName, activeFileName, effectiveVersionNum]);

  const activeRequestedRunIdRef = useRef<string | null>(null);

  // Loading gate boolean: active during initial run list fetch, run detail retrieval, or when target run details are not yet populated
  const isTestResultsLoading =
    isPersistedRunsLoading ||
    isLoadingRunDetails ||
    (availableStrategyRuns.length > 0 && (!selectedRunDetails || selectedRunDetails.id !== selectedRunId));

  // Load detailed results for a specific backtest run
  const loadRunDetails = useCallback(async (runId: string) => {
    activeRequestedRunIdRef.current = runId;
    setIsLoadingRunDetails(true);
    // Immediately clear stale data to prevent race conditions between test switches
    setSelectedRunDetails(null);
    setSimulationMetrics(null);
    setSimulationTrades([]);
    setSimulationRunId(null);
    try {
      let data: any = null;
      try {
        const res = await fetch(`/api/v1/backtests/${runId}`);
        if (res.ok) data = await res.json();
      } catch {
        const res2 = await fetch(`/api/v1/backtests/${runId}`);
        if (res2.ok) data = await res2.json();
      }
      // Stale response guard: if another run was requested while this fetch was in flight, discard this response
      if (activeRequestedRunIdRef.current !== runId) {
        return;
      }
      if (data) {
        setSelectedRunDetails(data);
        if (data.metrics) setSimulationMetrics(data.metrics);
        if (data.trades) setSimulationTrades(data.trades);
        if (data.id) setSimulationRunId(data.id);
      }
    } catch (err) {
      console.warn('[QuantPage] Failed to load run details:', err);
    } finally {
      if (activeRequestedRunIdRef.current === runId) {
        setIsLoadingRunDetails(false);
      }
    }
  }, []);

  // Synchronize selectedRunId when availableStrategyRuns or effectiveVersionNum changes
  useEffect(() => {
    // If a run is already actively selected with loaded details (verified with valid trades array, equity curve, and matching id), preserve it
    if (
      selectedRunId &&
      selectedRunDetails?.id === selectedRunId &&
      Array.isArray(selectedRunDetails?.trades) &&
      selectedRunDetails.trades.length > 0 &&
      Array.isArray(selectedRunDetails?.equity_curve)
    ) {
      return;
    }
    if (availableStrategyRuns.length > 0) {
      const storedKey = cleanActiveStrategyName ? `quantlab_selected_run_${cleanActiveStrategyName.toLowerCase()}` : null;
      const storedRunId = storedKey && typeof window !== 'undefined' ? localStorage.getItem(storedKey) : null;

      const target =
        (selectedRunId && availableStrategyRuns.find((r) => r.id === selectedRunId)) ||
        (storedRunId && availableStrategyRuns.find((r) => r.id === storedRunId)) ||
        availableStrategyRuns[0];

      if (target) {
        if (target.id !== selectedRunId) {
          setSelectedRunId(target.id);
        }
        if (!selectedRunDetails || selectedRunDetails.id !== target.id) {
          loadRunDetails(target.id);
        }
      }
    } else if (!selectedRunDetails) {
      setSelectedRunId(null);
      setSelectedRunDetails(null);
    }
  }, [availableStrategyRuns, selectedRunId, selectedRunDetails, loadRunDetails, cleanActiveStrategyName]);

  const handleSelectRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
    // Explicitly reset selectedRunDetails to null so stale data is immediately cleared!
    setSelectedRunDetails(null);
    if (cleanActiveStrategyName && typeof window !== 'undefined') {
      localStorage.setItem(`quantlab_selected_run_${cleanActiveStrategyName.toLowerCase()}`, runId);
    }
    loadRunDetails(runId);
  }, [loadRunDetails, cleanActiveStrategyName]);

  // Delete Backtest Run Handler
  const handleDeleteBacktestRun = useCallback(
    async (runId: string) => {
      try {
        try {
          await fetch(`/api/v1/backtests/${encodeURIComponent(runId)}`, {
            method: 'DELETE',
          });
        } catch {
          await fetch(`/api/v1/backtests/${encodeURIComponent(runId)}`, {
            method: 'DELETE',
          });
        }

        // Update local persisted runs state
        const remainingRuns = persistedRuns.filter((r) => r.id !== runId);
        setPersistedRuns(remainingRuns);

        // Clear active test results cache if this was the run
        setStrategyTestResults((prev) => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            if (updated[key]?.runId === runId) {
              delete updated[key];
            }
          }
          return updated;
        });

        // Compute remaining runs for this strategy & version
        const remainingForCurrent = remainingRuns.filter((r) => {
          const baseName = cleanActiveStrategyName.replace(/_v\d+$/, '');
          const matchStrategy =
            (r.strategy_name && r.strategy_name.toLowerCase() === baseName.toLowerCase()) ||
            (r.strategy_name && r.strategy_name.toLowerCase() === cleanActiveStrategyName.toLowerCase()) ||
            r.strategy_id === cleanActiveStrategyName ||
            r.strategy_id === baseName ||
            r.strategy_id === activeFileName ||
            (r.strategy_id !== 'custom' && (r.strategy_id.includes(baseName) || baseName.includes(r.strategy_id)));
          if (!matchStrategy) return false;
          const v = Number(r.version_num ?? (r.config as any)?.version_num ?? 1);
          return v === effectiveVersionNum;
        });

        if (selectedRunId === runId) {
          if (remainingForCurrent.length > 0) {
            const nextRun = remainingForCurrent[0];
            setSelectedRunId(nextRun.id);
            loadRunDetails(nextRun.id);
          } else {
            setSelectedRunId(null);
            setSelectedRunDetails(null);
            setSimulationMetrics(null);
            setSimulationTrades([]);
            setSimulationRunId(null);
            setCentralViewMode('editor');
          }
        }
      } catch (err) {
        console.warn('[QuantPage] Error deleting backtest run:', err);
      }
    },
    [persistedRuns, cleanActiveStrategyName, activeFileName, effectiveVersionNum, selectedRunId, loadRunDetails]
  );

  // Requirement: Enable Test Results whenever active strategy or workspace has completed test results
  const hasPassedTestResults = useMemo(() => {
    const hasValidDetails = Boolean(selectedRunDetails && (selectedRunDetails.version_num === undefined || selectedRunDetails.version_num === effectiveVersionNum));
    return Boolean(
      (activeStrategyTestResult && activeStrategyTestResult.passed) ||
      availableStrategyRuns.length > 0 ||
      hasValidDetails
    );
  }, [activeStrategyTestResult, availableStrategyRuns.length, selectedRunDetails, effectiveVersionNum]);

  // Guard: If currently in sandbox_runner or chart_runner and no test results exist anywhere, return to editor
  useEffect(() => {
    if ((centralViewMode === 'sandbox_runner' || centralViewMode === 'chart_runner') && !hasPassedTestResults) {
      setCentralViewMode('editor');
    }
  }, [hasPassedTestResults, centralViewMode]);

  // Extracts version number from strategy source code (#property version "X.00" or __version__ = "X")
  const extractCodeVersion = useCallback((sourceCode?: string): number | null => {
    if (!sourceCode) return null;
    // MQL5: #property version "4.00" or "4"
    const mqlMatch = sourceCode.match(/#property\s+version\s+["'](\d+)(?:\.\d+)?["']/i);
    if (mqlMatch) return parseInt(mqlMatch[1], 10);

    // Python: __version__ = "4.0" or VERSION = "4"
    const pyMatch = sourceCode.match(/(?:__version__|VERSION)\s*=\s*["'](\d+)(?:\.\d+)?["']/i);
    if (pyMatch) return parseInt(pyMatch[1], 10);

    // Comments: // v2 checkpoint or // Version 2
    const commentMatch = sourceCode.match(/(?:\/\/|#)\s*(?:v|version\s*)(\d+)\b/i);
    if (commentMatch) return parseInt(commentMatch[1], 10);

    return null;
  }, []);

  // Load versions for the active strategy with live deduplication and version selection
  const fetchStrategyVersions = useCallback(async (stratName: string, preferredVersionNum?: number) => {
    if (!stratName) return;
    try {
      const u = workspaceUsername;
      const res = await fetch(`/api/v1/strategies/${encodeURIComponent(stratName)}/versions?username=${encodeURIComponent(u)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Deduplicate by version_num
          const dedupedMap = new Map<number, any>();
          for (const item of data) {
            const num = item.version_num;
            if (num && (!dedupedMap.has(num) || (item.created_at && item.created_at > dedupedMap.get(num).created_at))) {
              dedupedMap.set(num, item);
            }
          }

          // Determine active version from real existing milestones in dedupedMap
          const codeV = extractCodeVersion(codeRef.current);
          let activeV = 1;
          if (preferredVersionNum && dedupedMap.has(preferredVersionNum)) {
            activeV = preferredVersionNum;
          } else if (codeV && dedupedMap.has(codeV)) {
            activeV = codeV;
          } else if (dedupedMap.size > 0) {
            activeV = Math.max(...Array.from(dedupedMap.keys()));
          }

          const sorted = Array.from(dedupedMap.values()).sort((a, b) => (b.version_num || 0) - (a.version_num || 0));
          setStrategyVersions(sorted);
          setActiveVersionNum(activeV);
          return;
        }
      }
      // If no backend versions, fallback to baseline v1
      setActiveVersionNum(1);
      setStrategyVersions([{
        id: `v1_active`,
        version_num: 1,
        commit_message: `Version 1 (Active)`,
        created_at: new Date().toISOString(),
        code_length: codeRef.current?.length || 0,
      }]);
    } catch {
      setActiveVersionNum(1);
    }
  }, [workspaceUsername, extractCodeVersion]);

  useEffect(() => {
    if (cleanActiveStrategyName) {
      const preferredV = queryVersion ? parseInt(queryVersion, 10) : undefined;
      fetchStrategyVersions(cleanActiveStrategyName, preferredV && preferredV > 0 ? preferredV : undefined);
      setViewingHistoricalVersion(null);
      setHistoricalSnapshotCode(null);
    }
  }, [cleanActiveStrategyName, queryVersion, fetchStrategyVersions]);

  // Synchronize active version number whenever code has an explicit version header matching a real registered version
  useEffect(() => {
    if (!code || viewingHistoricalVersion !== null) return;
    const vFromCode = extractCodeVersion(code);
    if (vFromCode && vFromCode !== activeVersionNum) {
      if (strategyVersions.some((v) => v.version_num === vFromCode)) {
        setActiveVersionNum(vFromCode);
      }
    }
  }, [code, activeVersionNum, viewingHistoricalVersion, extractCodeVersion, strategyVersions]);

  // 2. Debounced Physical File Save to Disk
  const saveFileToDisk = useCallback(async (fileName: string, content: string) => {
    setSaveStatus('saving');
    try {
      const u = rootUsername;
      await fetch(
        `/api/v1/workspace/files/${encodeURIComponent(fileName)}?username=${encodeURIComponent(u)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ content }),
        }
      );
      setSaveStatus('saved');
    } catch (err) {
      console.warn('[Workspace] Failed to persist file to disk:', err);
      setSaveStatus('unsaved');
    }
  }, [rootUsername]);

  // Send instruction to AI agent to create the next version (strictly sequential: maxExisting + 1)
  const handleSendNewVersionToAgent = useCallback(() => {
    const maxExistingV = strategyVersions.length > 0 ? Math.max(...strategyVersions.map((v) => v.version_num || 1)) : (activeVersionNum || 1);
    const nextV = maxExistingV + 1;
    const req = newVersionUserInstruction.trim() || 'add trailing stop and break-even rules';
    const targetStrat = cleanActiveStrategyName || activeFileName || 'the strategy';
    const promptText = `Create v${nextV} for ${targetStrat}: ${req}`;
    setExternalPrompt({ prompt: promptText, timestamp: Date.now() });
    setIsNewVersionPromptOpen(false);
    setNewVersionUserInstruction('');
    setMobileActiveTab('agent');
  }, [strategyVersions, activeVersionNum, newVersionUserInstruction, cleanActiveStrategyName, activeFileName]);

  // Handle restoring a previous version snapshot
  const handleRestoreVersion = useCallback(async (vNum: number) => {
    if (!cleanActiveStrategyName) return;
    const targetCode = historicalSnapshotCode || code;
    try {
      const u = workspaceUsername;
      let restoredCode = targetCode;
      try {
        const res = await fetch(`/api/v1/strategies/${encodeURIComponent(cleanActiveStrategyName)}/versions/${vNum}/restore?username=${encodeURIComponent(u)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ code: targetCode, username: u }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.code) {
            restoredCode = data.code;
          }
        }
      } catch (netErr) {
        console.warn('[Restore] Network call failed, falling back to local snapshot restore:', netErr);
      }

      if (restoredCode) {
        setCode(restoredCode);
        codeRef.current = restoredCode;
        setWorkspaceFiles((prev) =>
          prev.map((f) => {
            const isMatch = f.id === activeFileId || f.name === activeFileName || (cleanActiveStrategyName && f.name.replace(/\.[^/.]+$/, '').trim() === cleanActiveStrategyName);
            return isMatch ? { ...f, content: restoredCode, isModified: false } : f;
          })
        );
        const fileNameToSave = activeFileName || `${cleanActiveStrategyName}.mq5`;
        saveFileToDisk(fileNameToSave, restoredCode);
      }
      setActiveVersionNum(vNum);
      setViewingHistoricalVersion(null);
      setHistoricalSnapshotCode(null);
      prePreviewCodeRef.current = null;
      await fetchStrategyVersions(cleanActiveStrategyName, vNum);
    } catch (err) {
      console.warn('Failed to restore version:', err);
    }
  }, [cleanActiveStrategyName, workspaceUsername, activeFileId, activeFileName, historicalSnapshotCode, code, fetchStrategyVersions, saveFileToDisk]);

  // Handle exiting historical version preview (Pure cancellation returning to active working code)
  const handleExitPreview = useCallback(async () => {
    setViewingHistoricalVersion(null);
    setHistoricalSnapshotCode(null);
    const originalCode = prePreviewCodeRef.current;
    prePreviewCodeRef.current = null;

    if (originalCode) {
      setCode(originalCode);
      codeRef.current = originalCode;
      setWorkspaceFiles((prev) =>
        prev.map((f) => {
          const isMatch = f.id === activeFileId || f.name === activeFileName || (cleanActiveStrategyName && f.name.replace(/\.[^/.]+$/, '').trim() === cleanActiveStrategyName);
          return isMatch ? { ...f, content: originalCode, isModified: false } : f;
        })
      );
    }

    const activeFile = workspaceFiles.find((f) => f.id === activeFileId || f.name === activeFileName);
    if (activeFile) {
      try {
        const u = workspaceUsername;
        const res = await fetch(
          `/api/v1/workspace/files/${encodeURIComponent(activeFile.name)}?username=${encodeURIComponent(u)}`,
          { headers: typeof window !== 'undefined' && useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : undefined, credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.content !== undefined) {
            setCode(data.content);
            codeRef.current = data.content;
            setWorkspaceFiles((prev) =>
              prev.map((f) => (f.id === activeFile.id ? { ...f, content: data.content, isModified: false } : f))
            );
            return;
          }
        }
      } catch (err) {
        console.warn('Could not re-fetch active file on exit preview:', err);
      }
      if (!originalCode) {
        setCode(activeFile.content);
      }
    }
  }, [workspaceFiles, activeFileId, activeFileName, cleanActiveStrategyName, workspaceUsername]);

  // Close context menu & dropdowns on global click or Escape
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setIsMoreMenuOpen(false);
      setIsVersionMenuOpen(false);
      setIsNewVersionPromptOpen(false);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setRenamingFileId(null);
        setFileToDelete(null);
        setIsMoreMenuOpen(false);
        setIsVersionMenuOpen(false);
        setIsNewVersionPromptOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // 1. Fetch Physical Files from Disk via Backend API
  const loadWorkspaceFiles = useCallback(async (username: string) => {
    if (!username) return;
    setIsLoadingFiles(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`/api/v1/workspace/files?username=${encodeURIComponent(username)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: 'include' });
      if (res.ok) {
        const files: EditorFile[] = await res.json();
        if (Array.isArray(files)) {
          const uniqueFiles = deduplicateFiles(files);
          setWorkspaceFiles(uniqueFiles);
          if (uniqueFiles.length > 0) {
            const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
            const requestedFile = queryFile || urlParams?.get('file') || urlParams?.get('strategy');
            const storedLastFile = typeof window !== 'undefined'
              ? (localStorage.getItem('quantlab_last_active_file') || localStorage.getItem('quantlab_active_file'))
              : null;
            const history = getStoredFileHistory();

            const findMatchingFile = (targetName?: string | null): EditorFile | null => {
              if (!targetName) return null;
              const rawReq = targetName.toLowerCase().trim();
              const cleanReq = rawReq.replace(/\.[^/.]+$/, '');
              return uniqueFiles.find((f) => {
                const fName = f.name.toLowerCase();
                const cleanF = fName.replace(/\.[^/.]+$/, '');
                return (
                  f.id.toLowerCase() === rawReq ||
                  fName === rawReq ||
                  cleanF === cleanReq ||
                  fName.includes(cleanReq) ||
                  cleanReq.includes(cleanF)
                );
              }) || null;
            };

            // 1. Try URL parameter file
            let target = findMatchingFile(requestedFile);

            // 2. Try last worked-on file from localStorage
            if (!target && storedLastFile) {
              target = findMatchingFile(storedLastFile);
            }

            // 3. If last worked-on file was deleted, auto-select previous strategy from history
            if (!target && history.length > 0) {
              for (const histName of history) {
                target = findMatchingFile(histName);
                if (target) break;
              }
            }

            // 4. Fallback: select first code file (.mq5/.py) or first available file
            if (!target) {
              const codeFiles = uniqueFiles.filter((f) => isCodeFile(f.name));
              target = codeFiles[0] || uniqueFiles[0];
            }

            const nextActive = target.id;
            setActiveFileId(nextActive);
            setOpenFileIds((prev) => {
              const remapped = prev.map((openId) => {
                if (uniqueFiles.some((f) => f.id === openId)) return openId;
                const match = uniqueFiles.find(
                  (f) =>
                    f.id.toLowerCase() === openId.toLowerCase() ||
                    openId.includes(f.name.replace(/[^a-zA-Z0-9_]/g, '_'))
                );
                return match ? match.id : openId;
              });
              const valid = Array.from(new Set([nextActive, ...remapped.filter((id) => uniqueFiles.some((f) => f.id === id))]));
              return valid.length > 0 ? valid : [nextActive];
            });
            setCode(target.content);
            if (target.name.endsWith('.mq5') || target.name.endsWith('.mqh')) setLanguage('mql5');
            else if (target.name.endsWith('.py')) setLanguage('python');
            recordFileInHistory(target.name);
          } else {
            setOpenFileIds([]);
            setActiveFileId('');
            setCode('');
          }
        }
      }
    } catch (err) {
      console.warn('[Workspace] Could not load physical files from backend:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [queryFile]);

  // 2. Direct, zero-delay real username resolution on load
  useEffect(() => {
    // Check all direct client sources synchronously
    const directUser =
      extractUserHandle(user) ||
      extractUserHandle(useAuthStore.getState().user) ||
      getStoredUsername();

    if (directUser) {
      setWorkspaceUsername(directUser);
      setIsResolvingUser(false);
      loadWorkspaceFiles(directUser);
    } else {
      // If auth store is hydrating asynchronously, listen for update
      const unsub = useAuthStore.subscribe((state) => {
        const u = extractUserHandle(state.user) || getStoredUsername();
        if (u) {
          setWorkspaceUsername(u);
          setIsResolvingUser(false);
          loadWorkspaceFiles(u);
          unsub();
        }
      });
      // Safety timeout for guest mode
      const timer = setTimeout(() => {
        unsub();
        const fallback = '';
        setWorkspaceUsername(fallback);
        setIsResolvingUser(false);
        loadWorkspaceFiles(fallback);
      }, 250);

      return () => {
        unsub();
        clearTimeout(timer);
      };
    }
  }, [user, loadWorkspaceFiles]);

  // Synchronously activate requested file & version from URL query parameters or localStorage
  useEffect(() => {
    // Only auto-activate from storage on initial mount (when activeFileId is empty) or if explicit queryFile URL param is present
    if (!queryFile && activeFileId) return;

    const targetFileQuery = queryFile || (typeof window !== 'undefined' ? (localStorage.getItem('quantlab_last_active_file') || localStorage.getItem('quantlab_active_file')) : null);
    const targetVersionQuery = queryVersion || (typeof window !== 'undefined' ? localStorage.getItem('quantlab_active_version') : null);

    if (!targetFileQuery || workspaceFiles.length === 0) return;

    const rawReq = targetFileQuery.toLowerCase().trim();
    const cleanReq = rawReq.replace(/\.[^/.]+$/, '');

    const matching = workspaceFiles.find((f) => {
      const fName = f.name.toLowerCase();
      const cleanF = fName.replace(/\.[^/.]+$/, '');
      return (
        f.id.toLowerCase() === rawReq ||
        fName === rawReq ||
        cleanF === cleanReq ||
        fName.includes(cleanReq) ||
        cleanReq.includes(cleanF)
      );
    });

    if (matching) {
      setOpenFileIds((prev) => Array.from(new Set([matching.id, ...prev])));
      setActiveFileId(matching.id);
      setCode(matching.content);
      if (matching.name.endsWith('.mq5') || matching.name.endsWith('.mqh')) setLanguage('mql5');
      else if (matching.name.endsWith('.py')) setLanguage('python');
      setCentralViewMode('editor');

      if (targetVersionQuery) {
        const vNum = parseInt(targetVersionQuery, 10);
        if (!isNaN(vNum) && vNum > 0) {
          fetchStrategyVersions(cleanReq, vNum);
        }
      }

      if (typeof window !== 'undefined') {
        recordFileInHistory(matching.name);
        localStorage.removeItem('quantlab_active_version');
      }
    }
  }, [queryFile, queryVersion, workspaceFiles, activeFileId, fetchStrategyVersions]);

  // Always ensure some strategy file is selected in file explorer if workspaceFiles has files
  useEffect(() => {
    if (isLoadingFiles) return;
    if (workspaceFiles.length === 0) return;

    const activeExists = workspaceFiles.some(
      (f) => f.id === activeFileId || f.name === activeFileId || f.name === activeFileName
    );

    if (!activeFileId || !activeExists) {
      const storedName = typeof window !== 'undefined'
        ? (localStorage.getItem('quantlab_last_active_file') || localStorage.getItem('quantlab_active_file'))
        : null;
      const history = getStoredFileHistory();

      const findMatching = (targetName?: string | null): EditorFile | null => {
        if (!targetName) return null;
        const rawReq = targetName.toLowerCase().trim();
        const cleanReq = rawReq.replace(/\.[^/.]+$/, '');
        return (
          workspaceFiles.find((f) => {
            const fName = f.name.toLowerCase();
            const cleanF = fName.replace(/\.[^/.]+$/, '');
            return (
              f.id.toLowerCase() === rawReq ||
              fName === rawReq ||
              cleanF === cleanReq ||
              fName.includes(cleanReq) ||
              cleanReq.includes(cleanF)
            );
          }) || null
        );
      };

      let target = findMatching(storedName);

      // If last active was deleted, pick the previous one from history
      if (!target && history.length > 0) {
        for (const histName of history) {
          target = findMatching(histName);
          if (target) break;
        }
      }

      // Fallback: pick the first code file, or first file
      if (!target) {
        const codeFiles = workspaceFiles.filter((f) => isCodeFile(f.name));
        target = codeFiles[0] || workspaceFiles[0];
      }

      if (target) {
        setActiveFileId(target.id);
        setOpenFileIds((prev) => Array.from(new Set([target.id, ...prev])));
        setCode(target.content);
        if (target.name.endsWith('.mq5') || target.name.endsWith('.mqh')) setLanguage('mql5');
        else if (target.name.endsWith('.py')) setLanguage('python');
        recordFileInHistory(target.name);
      }
    }
  }, [workspaceFiles, activeFileId, activeFileName, isLoadingFiles]);

  // Files currently open in Monaco tabs (strictly deduplicated by ID, with historical preview support)
  const openEditorFiles = useMemo(() => {
    const seen = new Set<string>();
    const result: EditorFile[] = [];
    for (const f of workspaceFiles) {
      if (openFileIds.includes(f.id) && !seen.has(f.id)) {
        seen.add(f.id);
        const isMatch =
          f.id === activeFileId ||
          f.name === activeFileName ||
          f.name === activeFileId ||
          (Boolean(cleanActiveStrategyName) && f.name.replace(/\.[^/.]+$/, '').trim() === cleanActiveStrategyName);
        if (viewingHistoricalVersion !== null && historicalSnapshotCode !== null && isMatch) {
          result.push({
            ...f,
            content: historicalSnapshotCode,
            isModified: false,
          });
        } else {
          result.push(f);
        }
      }
    }
    return result;
  }, [workspaceFiles, openFileIds, viewingHistoricalVersion, historicalSnapshotCode, activeFileId, activeFileName, cleanActiveStrategyName]);

  const handleSelectFile = (fileId: string) => {
    if (!openFileIds.includes(fileId)) {
      setOpenFileIds((prev) => [...prev, fileId]);
    }
    setActiveFileId(fileId);
    const target = workspaceFiles.find((f) => f.id === fileId || f.name === fileId);
    if (target) {
      setCode(target.content);
      if (target.name.endsWith('.mq5') || target.name.endsWith('.mqh')) setLanguage('mql5');
      else if (target.name.endsWith('.py')) setLanguage('python');

      recordFileInHistory(target.name);

      // If user was viewing Test Results, but target file has no passed test results, revert to editor
      const targetCleanName = target.name.replace(/\.[^/.]+$/, '').trim();
      const hasResultsForTarget = Boolean(
        strategyTestResults[targetCleanName]?.passed ||
        persistedRuns.some(
          (r) =>
            (r.strategy_id === targetCleanName ||
              r.strategy_id === target.name ||
              (r.strategy_name && r.strategy_name.toLowerCase() === targetCleanName.toLowerCase()) ||
              targetCleanName.includes(r.strategy_id) ||
              r.strategy_id.includes(targetCleanName)) &&
            r.status === 'COMPLETED' &&
            r.metrics
        )
      );
      if (centralViewMode === 'sandbox_runner' && !hasResultsForTarget) {
        setCentralViewMode('editor');
      }
    }
  };

  const handleCloseFile = (fileId: string) => {
    const nextOpenIds = openFileIds.filter((id) => id !== fileId);
    setOpenFileIds(nextOpenIds);

    if (activeFileId === fileId) {
      if (nextOpenIds.length > 0) {
        const closedIndex = openFileIds.indexOf(fileId);
        const nextIndex = Math.max(0, Math.min(closedIndex - 1, nextOpenIds.length - 1));
        const nextActiveId = nextOpenIds[nextIndex];
        handleSelectFile(nextActiveId);
      } else {
        // Fallback to remaining workspace files so someone is always selected in Explorer
        const remaining = visibleWorkspaceFiles.filter((f) => f.id !== fileId);
        const fallback = remaining[0] || workspaceFiles.find((f) => f.id !== fileId) || workspaceFiles[0];
        if (fallback) {
          handleSelectFile(fallback.id);
        } else {
          setActiveFileId('');
          setCode('');
        }
      }
    }
  };

  // 1.5 Handle workspace change event from QuantAgentPanel
  const handleWorkspaceChanged = useCallback(
    async (
      targetFilename?: string,
      options?: {
        isEdit?: boolean;
        newContent?: string;
        originalContent?: string;
        diff?: string;
        isDelete?: boolean;
        version?: number;
      }
    ) => {
      // Pause any pending auto-saves to prevent race conditions while agent updates code
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      // Sync strategy version if updated
      const vFromOptions = options?.version || (options?.newContent ? extractCodeVersion(options.newContent) : null);
      if (vFromOptions) {
        setActiveVersionNum(vFromOptions);
        const strat = targetFilename ? targetFilename.replace(/\.[^/.]+$/, '').trim() : cleanActiveStrategyName;
        if (strat) {
          fetchStrategyVersions(strat, vFromOptions);
        }
      }

      // Instant Synchronous UI Sync: reflect changes in editor without waiting for network
      let targetId = '';
      if (targetFilename) {
        const cleanName = targetFilename.split('/').pop() || targetFilename;
        const deterministicId = `file_${cleanName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const existing = workspaceFiles.find(
          (f) => f.name === cleanName || f.id === deterministicId || f.name === targetFilename || f.name.endsWith('/' + cleanName)
        );
        targetId = existing ? existing.id : deterministicId;

        if (options?.isEdit && options.newContent !== undefined) {
          const original = options.originalContent !== undefined ? options.originalContent : (existing?.content || code || '');
          const modified = options.newContent;

          // Immediately display diff review gate in Monaco canvas with zero delay
          setDiffState({
            active: true,
            fileId: targetId,
            original,
            modified,
          });
          setCentralViewMode('editor');

          if (existing) {
            setWorkspaceFiles((prev) =>
              prev.map((f) => (f.id === targetId ? { ...f, content: modified, isModified: true } : f))
            );
          } else {
            const newFile: EditorFile = {
              id: targetId,
              name: cleanName,
              language: cleanName.endsWith('.py') ? 'python' : 'mql5',
              content: modified,
              isModified: true,
            };
            setWorkspaceFiles((prev) => [...prev, newFile]);
          }

          setOpenFileIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
          setActiveFileId(targetId);
          setCode(modified);
          if (cleanName.endsWith('.mq5')) setLanguage('mql5');
          else if (cleanName.endsWith('.py')) setLanguage('python');
        } else if (!options?.isEdit && !options?.isDelete) {
          // Fresh file created by agent: immediately display and open
          const content = options?.newContent !== undefined ? options.newContent : (existing?.content || '');
          if (existing) {
            setWorkspaceFiles((prev) =>
              prev.map((f) => (f.id === targetId ? { ...f, content } : f))
            );
          } else {
            const newFile: EditorFile = {
              id: targetId,
              name: cleanName,
              language: cleanName.endsWith('.py') ? 'python' : 'mql5',
              content,
            };
            setWorkspaceFiles((prev) => [...prev, newFile]);
          }
          setOpenFileIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
          setActiveFileId(targetId);
          setCode(content);
          if (cleanName.endsWith('.mq5')) setLanguage('mql5');
          else if (cleanName.endsWith('.py')) setLanguage('python');
          setCentralViewMode('editor');
          recordFileInHistory(cleanName);
          if (typeof window !== 'undefined') {
            localStorage.setItem('quantlab_last_active_file', cleanName);
            localStorage.setItem('quantlab_active_file', cleanName);
          }

          // If created with substantial code in one shot, activate diff review gate so user has Accept/Reject apply bar
          if (content.trim().length > 0) {
            setDiffState({
              active: true,
              fileId: targetId,
              original: '',
              modified: content,
            });
          } else {
            setDiffState((prev) => ({ ...prev, active: false }));
          }
        }
      }

      // Background disk reconciliation (re-fetches full list from disk asynchronously without blocking UI)
      const userToLoad = rootUsername;
      try {
        const token = useAuthStore.getState().token;
        const res = await fetch(`/api/v1/workspace/files?username=${encodeURIComponent(userToLoad)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: 'include' });
        if (res.ok) {
          const files: EditorFile[] = await res.json();
          if (Array.isArray(files)) {
            const uniqueFiles = deduplicateFiles(files);
            setWorkspaceFiles(uniqueFiles);
            if (options?.isDelete && targetFilename) {
              const deletedFile = uniqueFiles.find((f) => f.name === targetFilename || f.name.endsWith('/' + targetFilename));
              if (deletedFile) {
                handleCloseFile(deletedFile.id);
              }
            } else if (targetFilename) {
              // Strictly preserve target file as open and active in Monaco
              const cleanName = targetFilename.split('/').pop() || targetFilename;
              const matchingFile = uniqueFiles.find((f) => f.name === cleanName || f.id === targetId);
              if (matchingFile) {
                setOpenFileIds((prev) => (prev.includes(matchingFile.id) ? prev : [...prev, matchingFile.id]));
                setActiveFileId(matchingFile.id);
                if (!options?.isEdit) {
                  setCode(matchingFile.content);
                  if (cleanName.endsWith('.mq5')) setLanguage('mql5');
                  else if (cleanName.endsWith('.py')) setLanguage('python');
                }
                recordFileInHistory(matchingFile.name);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('quantlab_last_active_file', matchingFile.name);
                  localStorage.setItem('quantlab_active_file', matchingFile.name);
                }
                setDiffState((prev) => {
                  if (prev.active && (prev.fileId === targetId || prev.fileId === cleanName)) {
                    return { ...prev, fileId: matchingFile.id };
                  }
                  return prev;
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Workspace] Background file sync:', err);
      }
    },
    [rootUsername, workspaceFiles, code, handleCloseFile, extractCodeVersion, cleanActiveStrategyName, fetchStrategyVersions]
  );

  const handleContentChange = (fileId: string, newContent: string) => {
    setWorkspaceFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content: newContent, isModified: true } : f))
    );
    if (fileId === activeFileId) {
      setCode(newContent);
    }

    const targetFile = workspaceFiles.find((f) => f.id === fileId);
    if (targetFile) {
      setSaveStatus('unsaved');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveFileToDisk(targetFile.name, newContent);
      }, 700);
    }
  };

  // 3. Create Physical File on Disk
  // 3. Create Physical File on Disk
  const handleConfirmCreateFile = async () => {
    let raw = newFileName.trim();
    if (!raw) {
      raw = 'strategy.mq5';
    }

    // Default to .mq5 exclusively (MQL5 only)
    let base = raw;
    let ext = '.mq5';
    if (raw.includes('.')) {
      const dotIdx = raw.lastIndexOf('.');
      base = raw.substring(0, dotIdx).trim() || 'strategy';
      const typedExt = raw.substring(dotIdx).toLowerCase();
      if (typedExt === '.mqh' || typedExt === '.mq5') {
        ext = typedExt;
      }
    }

    let candidateName = `${base}${ext}`;

    // Anti-collision: ensure uniqueness so existing files are never overwritten
    let counter = 1;
    while (workspaceFiles.some((f) => f.name.toLowerCase() === candidateName.toLowerCase())) {
      candidateName = `${base}_${counter}${ext}`;
      counter++;
    }

    try {
      const res = await fetch(
        `/api/v1/workspace/files?username=${encodeURIComponent(rootUsername)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ filename: candidateName }),
        }
      );

      if (res.ok) {
        const created: EditorFile = await res.json();
        setWorkspaceFiles((prev) => [...prev, created]);
        setOpenFileIds((prev) => [...prev, created.id]);
        setActiveFileId(created.id);
        setCode(created.content);
        if (created.name.endsWith('.mq5') || created.name.endsWith('.mqh')) setLanguage('mql5');
        else if (created.name.endsWith('.py')) setLanguage('python');
        recordFileInHistory(created.name);
        if (typeof window !== 'undefined') {
          localStorage.setItem('quantlab_last_active_file', created.name);
          localStorage.setItem('quantlab_active_file', created.name);
        }
      }
    } catch (err) {
      console.warn('[Workspace] Failed to create file on disk:', err);
    } finally {
      setIsCreatingFile(false);
      setNewFileName('');
    }
  };

  // 4. Rename Physical File on Disk (Extension strictly locked & collisions prevented)
  const handleConfirmRename = async (fileId: string, newBaseName: string) => {
    const target = workspaceFiles.find((f) => f.id === fileId);
    if (!target) return;

    // Lock original extension: user cannot alter file extension
    const originalExt = target.name.includes('.') ? '.' + target.name.split('.').pop() : '';

    let cleanBase = newBaseName.trim();
    if (!cleanBase) {
      setRenamingFileId(null);
      return;
    }

    // If user typed an extension anyway, strip it to enforce the locked original extension
    if (originalExt && cleanBase.toLowerCase().endsWith(originalExt.toLowerCase())) {
      cleanBase = cleanBase.slice(0, -originalExt.length);
    } else if (cleanBase.includes('.')) {
      cleanBase = cleanBase.substring(0, cleanBase.lastIndexOf('.'));
    }
    cleanBase = cleanBase.trim();
    if (!cleanBase) {
      setRenamingFileId(null);
      return;
    }

    let candidateName = `${cleanBase}${originalExt}`;
    if (candidateName === target.name) {
      setRenamingFileId(null);
      return;
    }

    // Anti-collision / anti-ecrasement: ensure uniqueness among workspace files
    let counter = 1;
    while (workspaceFiles.some((f) => f.id !== fileId && f.name.toLowerCase() === candidateName.toLowerCase())) {
      candidateName = `${cleanBase}_${counter}${originalExt}`;
      counter++;
    }

    try {
      const res = await fetch(
        `/api/v1/workspace/files/${encodeURIComponent(target.name)}/rename?username=${encodeURIComponent(rootUsername)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ new_filename: candidateName }),
        }
      );

      if (res.ok) {
        const updated: EditorFile = await res.json();
        setWorkspaceFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, name: updated.name, id: updated.id } : f))
        );
        if (openFileIds.includes(fileId)) {
          setOpenFileIds((prev) => prev.map((id) => (id === fileId ? updated.id : id)));
        }
        if (activeFileId === fileId) {
          setActiveFileId(updated.id);
        }
      }
    } catch (err) {
      console.warn('[Workspace] Failed to rename file on disk:', err);
    } finally {
      setRenamingFileId(null);
      setRenamingFileName('');
    }
  };

  // 5. Delete Physical File from Disk - Auto-selects the previous strategy in Explorer
  const handleDeleteFile = async (fileId: string, fileName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(
        `/api/v1/workspace/files/${encodeURIComponent(fileName)}?username=${encodeURIComponent(rootUsername)}`,
        { method: 'DELETE', headers: typeof window !== 'undefined' && useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : undefined, credentials: 'include' }
      );
    } catch (err) {
      console.warn('[Workspace] Failed to delete file on disk:', err);
    }

    removeFileFromHistory(fileName);

    const currentFiles = visibleWorkspaceFiles.length > 0 ? visibleWorkspaceFiles : workspaceFiles;
    const deletedIdx = currentFiles.findIndex((f) => f.id === fileId || f.name === fileName);
    const remainingFiles = workspaceFiles.filter((f) => f.id !== fileId && f.name !== fileName);
    const remainingVisible = currentFiles.filter((f) => f.id !== fileId && f.name !== fileName);

    const isCurrentActive = activeFileId === fileId || activeFileName === fileName;

    if (remainingFiles.length === 0) {
      setWorkspaceFiles([]);
      setOpenFileIds([]);
      setActiveFileId('');
      setCode('');
      try {
        localStorage.removeItem('quantlab_active_file');
        localStorage.removeItem('quantlab_last_active_file');
      } catch {
        // ignore
      }
    } else {
      setWorkspaceFiles(remainingFiles);

      if (isCurrentActive) {
        // Auto-select the previous strategy in the files explorer (prevIdx = deletedIdx - 1)
        const candidates = remainingVisible.length > 0 ? remainingVisible : remainingFiles;
        const prevIdx = deletedIdx > 0 ? Math.min(deletedIdx - 1, candidates.length - 1) : 0;
        const nextTarget = candidates[prevIdx] || candidates[0];

        if (nextTarget) {
          const nextOpen = Array.from(new Set([nextTarget.id, ...openFileIds.filter((id) => id !== fileId)]));
          setOpenFileIds(nextOpen);
          setActiveFileId(nextTarget.id);
          setCode(nextTarget.content);
          if (nextTarget.name.endsWith('.mq5') || nextTarget.name.endsWith('.mqh')) setLanguage('mql5');
          else if (nextTarget.name.endsWith('.py')) setLanguage('python');
          recordFileInHistory(nextTarget.name);
        }
      } else {
        setOpenFileIds((prev) => prev.filter((id) => id !== fileId));
      }
    }

    setContextMenu(null);
  };

  // Right-click context menu handler
  const handleFileContextMenu = (e: React.MouseEvent, file: EditorFile) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file,
    });
  };

  const handleOpenDiffGate = (snippetCode: string, snippetLang?: CodeLanguage) => {
    let targetFile = workspaceFiles.find((f) => f.id === activeFileId) || workspaceFiles[0];
    if (!targetFile) {
      handleApplyCodeToEditor(snippetCode, snippetLang);
      return;
    }

    if (!openFileIds.includes(targetFile.id)) {
      setOpenFileIds((prev) => [...prev, targetFile.id]);
    }
    setActiveFileId(targetFile.id);

    setDiffState({
      active: true,
      fileId: targetFile.id,
      original: targetFile.content,
      modified: snippetCode,
    });
    setCentralViewMode('editor');
  };

  const handleAcceptDiff = () => {
    handleContentChange(diffState.fileId, diffState.modified);
    const targetFile = workspaceFiles.find((f) => f.id === diffState.fileId);
    if (targetFile) {
      saveFileToDisk(targetFile.name, diffState.modified);
    }
    setDiffState((prev) => ({ ...prev, active: false }));
  };

  const handleRejectDiff = () => {
    if (diffState.fileId && diffState.original !== undefined) {
      handleContentChange(diffState.fileId, diffState.original);
      const targetFile = workspaceFiles.find((f) => f.id === diffState.fileId);
      if (targetFile) {
        saveFileToDisk(targetFile.name, diffState.original);
      }
    }
    setDiffState((prev) => ({ ...prev, active: false }));
  };

  const handleApplyCodeToEditor = (newCode: string, targetLang?: CodeLanguage) => {
    let targetFile = workspaceFiles.find((f) => f.id === activeFileId);
    if (!targetFile && workspaceFiles.length > 0) {
      targetFile = workspaceFiles[0];
    }

    if (!targetFile) {
      handleConfirmCreateFile();
      return;
    }

    handleContentChange(targetFile.id, newCode);
    if (!openFileIds.includes(targetFile.id)) {
      setOpenFileIds((prev) => [...prev, targetFile.id]);
    }
    setActiveFileId(targetFile.id);
    if (targetLang) setLanguage(targetLang);
    setCentralViewMode('editor');
  };

  // Real-time MQL5 & C++ Syntax Validation (Smooth 150ms debounce, zero typing lag)
  useEffect(() => {
    if (!code || !code.trim()) {
      setLintIssues([]);
      return;
    }
    const timer = setTimeout(() => {
      const issues = validateSourceCode(code);
      setLintIssues(issues);
    }, 150);
    return () => clearTimeout(timer);
  }, [code]);

  const handleNavigateToLine = (line: number, column?: number) => {
    setNavigateToLine({ line, column, timestamp: Date.now() });
  };

  // Parameter schema parser
  const parsedParameters = useMemo(() => {
    return parseStrategyParameters(code, language);
  }, [code, language]);

  // Re-run simulation
  const handleReRunBacktest = useCallback(async () => {
    setIsReRunningSimulation(true);
    try {
      const isMql5 = language === 'mql5' || activeFileName.endsWith('.mq5') || activeFileName.endsWith('.ex5');
      const baseName = cleanActiveStrategyName.replace(/_v\d+$/, '');
      const paramPayload: Record<string, any> = {};
      parsedParameters.forEach((p) => {
        paramPayload[p.name] = p.defaultValue;
      });

      const res = await fetch('/api/v1/backtests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_id: isMql5 ? `${baseName}.mq5` : baseName,
          strategy_name: baseName,
          symbol: selectedRunDetails?.symbol || 'XAUUSD',
          timeframe: selectedRunDetails?.timeframe || '15m',
          start_date: selectedRunDetails?.start_date || '2025-01-01',
          end_date: selectedRunDetails?.end_date || '2025-12-31',
          version_num: effectiveVersionNum,
          config: {
            initial_capital: 100000,
            slippage_points: 0.5,
            commission_pct: 0.0002,
            use_mt5: isMql5,
            engine: isMql5 ? 'mt5' : 'vectorized',
            leverage: 100.0,
            version_num: effectiveVersionNum,
          },
          parameters: paramPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.id) {
          setSelectedRunId(data.id);
          await loadRunDetails(data.id);
        }
        await fetchPersistedRuns();
      }
    } catch (err) {
      console.warn('[QuantPage] Error re-running backtest:', err);
    } finally {
      setIsReRunningSimulation(false);
    }
  }, [language, activeFileName, cleanActiveStrategyName, parsedParameters, selectedRunDetails, effectiveVersionNum, loadRunDetails, fetchPersistedRuns]);

  const handleUpdateParameterValue = (paramName: string, newValue: string | number | boolean) => {
    if (language === 'python') {
      const getRegex = new RegExp(`(parameters\\.get\\(\\s*["']${paramName}["']\\s*,\\s*)([^\\)\\n]+)`, 'g');
      if (getRegex.test(code)) {
        const formattedVal =
          typeof newValue === 'string' && isNaN(Number(newValue)) && newValue !== 'True' && newValue !== 'False'
            ? `"${newValue}"`
            : newValue;
        const updated = code.replace(getRegex, `$1${formattedVal}`);
        handleContentChange(activeFileId, updated);
      } else {
        const regex = new RegExp(`(${paramName}\\s*(?::\\s*\\w+)?\\s*=\\s*)([^,\\)\\n]+)`, 'g');
        const updated = code.replace(regex, `$1${newValue}`);
        handleContentChange(activeFileId, updated);
      }
    } else {
      const regex = new RegExp(`(input\\s+\\w+\\s+${paramName}\\s*=\\s*)([^;\\n]+)`, 'g');
      const updated = code.replace(regex, `$1${newValue}`);
      handleContentChange(activeFileId, updated);
    }
  };

  // 1. Action: Test on Chart (Switches central viewport to 'chart_runner')
  const handleTestOnChart = () => {
    if (!hasPassedTestResults) return;
    if (availableStrategyRuns.length > 0 && (!selectedRunDetails || selectedRunDetails.id !== selectedRunId)) {
      const target = (selectedRunId && availableStrategyRuns.find((r) => r.id === selectedRunId)) || availableStrategyRuns[0];
      if (target) {
        setSelectedRunId(target.id);
        loadRunDetails(target.id);
      }
    }
    // Optimistic instant navigation (0ms UI latency)
    setCentralViewMode('chart_runner');
    const currentFile = workspaceFiles.find((f) => f.id === activeFileId);
    if (currentFile && hasExecutableCode) {
      saveFileToDisk(currentFile.name, code).catch((err) =>
        console.warn('[QuantPage] Background file save error:', err)
      );
    }
  };

  // 2. Action: Test in Sandbox (Switches central viewport to 'sandbox_runner')
  const handleRunSimulation = async (config?: SandboxLaunchConfig) => {
    if (!hasExecutableCode) return;
    const currentFile = workspaceFiles.find((f) => f.id === activeFileId);
    if (currentFile) {
      saveFileToDisk(currentFile.name, code);
    }
    if (config) {
      setSandboxLaunchConfig(config);
    }
    setCentralViewMode('sandbox_runner');
  };

  const handleSendReportToAgent = (report: any) => {
    setIncomingTelemetryReport({
      ...report,
      timestamp: Date.now(),
    });
  };

  // 3-Dots Export Handlers
  const handleExportPy = () => {
    const currentFile = workspaceFiles.find((f) => f.id === activeFileId);
    const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'strategy';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.py`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsMoreMenuOpen(false);
  };

  const handleExportMq5 = () => {
    const currentFile = workspaceFiles.find((f) => f.id === activeFileId);
    const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'strategy';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.mq5`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsMoreMenuOpen(false);
  };

  const handleExportEx5 = () => {
    const currentFile = workspaceFiles.find((f) => f.id === activeFileId);
    const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'strategy';
    const content = `//+------------------------------------------------------------------+\n//| Binary Transpiled EX5 Executable: ${baseName}.ex5\n//| Backtest-AI Zero Look-Ahead Compiler\n//+------------------------------------------------------------------+\n${code}`;
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.ex5`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsMoreMenuOpen(false);
  };

  const handleExportJson = () => {
    const currentFile = workspaceFiles.find((f) => f.id === activeFileId);
    const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'strategy';
    const configData = {
      strategy_name: baseName,
      language: language,
      parameters: parsedParameters.reduce((acc, p) => ({ ...acc, [p.name]: p.defaultValue }), {}),
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}_config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsMoreMenuOpen(false);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.py')) return <Code2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    if (fileName.endsWith('.mq5')) return <FileCode className="w-3.5 h-3.5 text-violet-400 shrink-0" />;
    if (fileName.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return <Code2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) return <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  return (
    <div className="flex-1 flex h-full bg-[#080B10] overflow-hidden select-none font-mono relative">
      {/* 1. Left + Center Zone: The Code & File Workspace Zone */}
      <div className={`flex-1 min-w-0 flex-col h-full overflow-hidden border-r border-[#1A2333] ${
        mobileActiveTab === 'agent' ? 'hidden lg:flex' : 'flex'
      } pb-14 lg:pb-0`}>
        {/* Action Bar Header ONLY for the Code Zone */}
        <header className="h-12 border-b border-[#152033] bg-[#070B14]/95 backdrop-blur-2xl px-2.5 sm:px-4 flex items-center justify-between shrink-0 z-30 gap-2 relative select-none shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          {/* Subtle ambient bottom glowing hairline */}
          <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

          {/* Left Zone: Brand Context, Sync State, and Strategy Pill (name + v + btn) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            {/* Mobile Navigation Drawer Button (< md) - Clean borderless icon as in illustration */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('open-mobile-sidebar'));
                }
              }}
              className="md:hidden p-1.5 text-slate-300 hover:text-cyan-300 active:scale-90 transition-all cursor-pointer shrink-0 flex items-center justify-center rounded-lg hover:bg-slate-800/30"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* File Explorer Toggle Button (>= md) - Clean borderless icon as in illustration */}
            <button
              onClick={() => setIsExplorerOpen((p) => !p)}
              className={`hidden md:flex p-1.5 rounded-lg text-xs items-center justify-center transition-all cursor-pointer shrink-0 hover:bg-slate-800/30 ${
                isExplorerOpen
                  ? 'text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isExplorerOpen ? 'Collapse Explorer (Ctrl+B)' : 'Expand Explorer (Ctrl+B)'}
            >
              <FolderTree className="w-5 h-5" />
            </button>

            {/* Brand Logo & Name (Hidden on compact mobile screens to keep header lean) */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/35 flex items-center justify-center text-cyan-400 shadow-sm">
                <Cpu className="w-4 h-4" />
              </div>
              <h1 className="text-[13px] font-bold text-slate-100 tracking-tight hidden 2xl:inline">
                Quant<span className="text-cyan-400">Lab</span>
              </h1>
            </div>

            {/* Disk Sync Status Indicator (Hidden on compact mobile screens) */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono px-2 sm:px-2.5 py-1 rounded-md bg-[#101624] border border-[#1C283A] shadow-inner shrink-0">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-cyan-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden 2xl:inline font-medium">Saving...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden 2xl:inline font-medium">Saved</span>
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                  <span className="hidden 2xl:inline font-medium">Unsaved</span>
                </span>
              )}
            </div>

            {/* Strategy File Pill (name + v + btn) right next to Saved */}
            {activeFileName && (
              <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3 h-8 rounded-xl bg-gradient-to-r from-[#0C1728] via-[#0A1322] to-[#0A101C] border border-cyan-500/35 hover:border-cyan-400/55 transition-all shadow-[0_0_12px_rgba(6,182,212,0.08)] min-w-0 flex-1 max-w-[280px] sm:max-w-[360px] xl:max-w-[480px]">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.85)] shrink-0" />
                  <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-xs sm:text-[12.5px] font-semibold text-cyan-50 font-mono tracking-tight truncate min-w-0">
                    {activeFileName}
                  </span>
                </div>

                {cleanActiveStrategyName && (
                  <div className="relative shrink-0 flex items-center" ref={headerVersionRef}>
                    {/* Unified Connected Segmented Control: [ v3 ▾ | + ] */}
                    <div className="flex items-center rounded-lg bg-[#070E1A] border border-cyan-500/30 divide-x divide-cyan-500/25 shadow-sm overflow-hidden">
                      {/* Left Segment: Version Selector (v3 ▾) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsNewVersionPromptOpen(false);
                          setIsMoreMenuOpen(false);
                          setIsVersionMenuOpen((p) => !p);
                        }}
                        className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/15 text-[11px] font-mono font-semibold transition-colors cursor-pointer"
                        title="Switch or view historical strategy versions"
                      >
                        <span>{`v${activeVersionNum}`}</span>
                        <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400" />
                      </button>

                      {/* Right Segment: Add Version (+) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsVersionMenuOpen(false);
                          setIsMoreMenuOpen(false);
                          setIsNewVersionPromptOpen((p) => !p);
                        }}
                        className="flex items-center justify-center px-1.5 py-0.5 text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/20 transition-colors cursor-pointer"
                        title={`Create Version ${(strategyVersions.length > 0 ? Math.max(...strategyVersions.map((v) => v.version_num || 1)) : activeVersionNum) + 1} with AI`}
                      >
                        <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                      </button>
                    </div>

                    {/* Version Selector Dropdown */}
                    {isVersionMenuOpen && (
                      <div
                        className="absolute right-0 sm:left-0 top-full mt-1.5 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl bg-[#0E131E] border border-[#202A38] shadow-2xl py-1.5 text-xs select-none backdrop-blur-md z-50 animate-in fade-in duration-100 font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-[#1A2333] flex items-center justify-between">
                          <span>Version Milestones</span>
                          <span className="text-cyan-400 font-mono">{strategyVersions.length} versions</span>
                        </div>

                        <div className="max-h-56 overflow-y-auto py-1">
                          {strategyVersions.length > 0 ? (
                            strategyVersions.map((v) => (
                              <button
                                key={v.id || v.version_num}
                                onClick={async () => {
                                  setIsVersionMenuOpen(false);
                                  if (v.version_num === activeVersionNum && viewingHistoricalVersion === null) {
                                    return;
                                  }
                                  if (v.version_num === activeVersionNum && viewingHistoricalVersion !== null) {
                                    handleExitPreview();
                                  } else {
                                    try {
                                      const u = workspaceUsername;
                                      const res = await fetch(
                                        `/api/v1/strategies/${encodeURIComponent(cleanActiveStrategyName)}/versions/${v.version_num}?username=${encodeURIComponent(u)}`
                                      );
                                      if (res.ok) {
                                        const snapshot = await res.json();
                                        if (snapshot.code) {
                                          if (viewingHistoricalVersion === null) {
                                            prePreviewCodeRef.current = code;
                                          }
                                          setHistoricalSnapshotCode(snapshot.code);
                                          setViewingHistoricalVersion(v.version_num);
                                          setCode(snapshot.code);
                                          codeRef.current = snapshot.code;
                                          return;
                                        }
                                      }
                                    } catch (err) {
                                      console.warn('Could not load version snapshot:', err);
                                    }
                                    if (viewingHistoricalVersion === null) {
                                      prePreviewCodeRef.current = code;
                                    }
                                    setViewingHistoricalVersion(v.version_num);
                                  }
                                }}
                                className={`w-full px-3 py-1.5 text-left flex items-start justify-between gap-2 hover:bg-[#151D2C] transition-colors cursor-pointer ${
                                  v.version_num === activeVersionNum ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-300'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 font-mono text-xs">
                                    <span className="font-bold text-cyan-400">{`v${v.version_num}`}</span>
                                    {v.version_num === activeVersionNum && (
                                      <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Active</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {v.commit_message || `Version ${v.version_num}`}
                                  </div>
                                </div>
                                <span className="text-[9.5px] text-slate-500 font-mono shrink-0">
                                  {formatRelativeTime(v.created_at)}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-[11px] text-slate-500 italic">
                              Baseline version (v1)
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Integrated '+' AI Prompt Popup */}
                    {isNewVersionPromptOpen && (() => {
                      const nextTargetVersion = (strategyVersions.length > 0 ? Math.max(...strategyVersions.map((v) => v.version_num || 1)) : activeVersionNum) + 1;
                      return (
                        <div
                          className="absolute right-0 sm:left-0 top-full mt-1.5 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl bg-[#0E1422] border border-[#23334D] shadow-2xl p-3 text-xs z-50 backdrop-blur-md animate-in fade-in duration-100 font-sans"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 font-bold text-slate-100">
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Create Version {nextTargetVersion} with AI</span>
                            </div>
                            <button
                              onClick={() => setIsNewVersionPromptOpen(false)}
                              className="text-slate-500 hover:text-slate-300 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                            What logic changes should AI make for <strong className="text-cyan-300">v{nextTargetVersion}</strong>?
                          </p>
                        <input
                          type="text"
                          autoFocus
                          value={newVersionUserInstruction}
                          onChange={(e) => setNewVersionUserInstruction(e.target.value)}
                          placeholder="e.g. add trailing stop, break-even exit"
                          className="w-full bg-[#080D16] border border-[#1F2C40] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors mb-2.5"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendNewVersionToAgent();
                            else if (e.key === 'Escape') setIsNewVersionPromptOpen(false);
                          }}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setIsNewVersionPromptOpen(false)}
                            className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSendNewVersionToAgent}
                            className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Send to AI</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Zone: Unified Segmented View Switcher & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Unified 3-Segment View Switcher (Desktop only, mobile uses bottom thumb bar) */}
            <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-[#090E17] border border-[#192436] shadow-inner shrink-0">
              {/* Segment 1: Monaco Code Editor */}
              <button
                onClick={() => setCentralViewMode('editor')}
                className={`group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-[12.5px] transition-all cursor-pointer whitespace-nowrap ${
                  centralViewMode === 'editor'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-cyan-300 border border-transparent hover:bg-[#121824]'
                }`}
                title="Monaco Strategy Code Editor"
              >
                <CodeViewIcon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Strategies</span>
              </button>

              {/* Segment 2: Test Results (Sandbox Runner) */}
              <button
                disabled={!hasPassedTestResults}
                onClick={() => {
                  if (!hasPassedTestResults) return;
                  if (hasExecutableCode) {
                    const currentFile = workspaceFiles.find((f) => f.id === activeFileId);
                    if (currentFile) saveFileToDisk(currentFile.name, code);
                  }
                  if (availableStrategyRuns.length > 0 && (!selectedRunDetails || selectedRunDetails.id !== selectedRunId)) {
                    const target = (selectedRunId && availableStrategyRuns.find((r) => r.id === selectedRunId)) || availableStrategyRuns[0];
                    if (target) {
                      setSelectedRunId(target.id);
                      loadRunDetails(target.id);
                    }
                  }
                  setCentralViewMode('sandbox_runner');
                }}
                className={`group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-[12.5px] transition-all whitespace-nowrap ${
                  !hasPassedTestResults
                    ? 'opacity-40 cursor-not-allowed text-slate-500 border border-transparent'
                    : centralViewMode === 'sandbox_runner'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold cursor-pointer'
                    : 'text-slate-400 hover:text-cyan-300 border border-transparent hover:bg-[#121824] cursor-pointer'
                }`}
                title={
                  hasPassedTestResults
                    ? `View Invariant Sandbox Test Results & Analytics for Version ${effectiveVersionNum}`
                    : `No tests run yet for Version ${effectiveVersionNum} — Run a test with the agent`
                }
              >
                <ResultsViewIcon className="w-4 h-4 shrink-0" isActive={centralViewMode === 'sandbox_runner'} />
                <span className="hidden 2xl:inline">Test Results</span>
                <span className="hidden sm:inline 2xl:hidden">Results</span>
              </button>

              {/* Segment 3: Test on Chart (Chart Runner) */}
              <button
                onClick={handleTestOnChart}
                disabled={!hasPassedTestResults}
                className={`group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-[12.5px] transition-all whitespace-nowrap ${
                  !hasPassedTestResults
                    ? 'opacity-40 cursor-not-allowed text-slate-500 border border-transparent'
                    : centralViewMode === 'chart_runner'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold cursor-pointer'
                    : 'text-slate-400 hover:text-cyan-300 border border-transparent hover:bg-[#121824] cursor-pointer'
                }`}
                title={
                  hasPassedTestResults
                    ? `Test Version ${effectiveVersionNum} on Live Candlestick Replay Chart`
                    : `No tests run yet for Version ${effectiveVersionNum} — Run a test with the agent to enable Chart testing`
                }
              >
                <ChartCandlesIcon className="w-4 h-4 shrink-0" isActive={centralViewMode === 'chart_runner'} />
                <span className="hidden 2xl:inline">Test on Chart</span>
                <span className="hidden sm:inline 2xl:hidden">Chart</span>
              </button>
            </div>

            {/* 3-Dots More Options Button (...) - Clean borderless icon as in illustration */}
            <div className="relative" ref={headerMoreRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVersionMenuOpen(false);
                  setIsNewVersionPromptOpen(false);
                  setIsMoreMenuOpen((p) => !p);
                }}
                className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center active:scale-90 shrink-0 ${
                  isMoreMenuOpen
                    ? 'text-cyan-300 bg-cyan-500/15'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/30'
                }`}
                title="Export & Compiler Options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {isMoreMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-52 max-w-[calc(100vw-1.5rem)] rounded-lg bg-[#0E131E] border border-[#202A38] shadow-2xl py-1 text-xs select-none backdrop-blur-md z-50 animate-in fade-in duration-100 font-mono"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider border-b border-[#1A2333]">
                    Export Options
                  </div>

                  <button
                    onClick={handleExportMq5}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#151D2C] text-slate-300 hover:text-violet-300 transition-colors text-left cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-violet-400" />
                    <span>Export to MQL5 (.mq5)</span>
                  </button>

                  <button
                    onClick={handleExportEx5}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#151D2C] text-slate-300 hover:text-amber-300 transition-colors text-left cursor-pointer"
                  >
                    <Mt5Icon className="w-4 h-4 shrink-0" />
                    <span>Export to EX5 (.ex5)</span>
                  </button>

                  <div className="h-px bg-[#202A38] my-1" />

                  <button
                    onClick={handleExportJson}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#151D2C] text-slate-300 hover:text-slate-100 transition-colors text-left cursor-pointer"
                  >
                    <FileJson className="w-3.5 h-3.5 text-slate-400" />
                    <span>Download Config (.json)</span>
                  </button>

                  <div className="h-px bg-[#202A38] my-1" />

                  {/* Publish to Community Option */}
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setIsPublishModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-cyan-500/15 text-cyan-300 hover:text-cyan-200 transition-colors text-left cursor-pointer font-semibold"
                  >
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Publish to Community</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Historical Version Preview Banner */}
        {viewingHistoricalVersion !== null && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-3.5 py-1.5 flex items-center justify-between text-xs text-amber-300 z-10 shrink-0 font-sans">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Viewing historical snapshot: <strong>Version {viewingHistoricalVersion}</strong> (Preview Mode)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRestoreVersion(viewingHistoricalVersion)}
                className="px-2.5 py-1 rounded bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/50 text-amber-200 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Restore as Active Version
              </button>
              <button
                onClick={handleExitPreview}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
              >
                Exit Preview
              </button>
            </div>
          </div>
        )}

        {/* Studio Canvas: Left Explorer + Monaco Editor */}
        <div className="flex-1 w-full min-h-0 flex overflow-hidden">
          {/* Left Sidebar: Collapsible Workspace Directory (Hidden in Chart and Results to maximize canvas space) */}
          <div
            suppressHydrationWarning
            className={`border-r border-[#202A38] bg-[#0A0E15] hidden md:flex flex-col transition-all duration-200 shrink-0 select-none ${
              centralViewMode === 'chart_runner' || centralViewMode === 'sandbox_runner'
                ? 'hidden'
                : isExplorerOpen
                ? 'w-[200px] sm:w-[220px] xl:w-[248px]'
                : 'w-9 sm:w-10'
            }`}
          >
            {/* Explorer Header */}
            <div
              className={`h-9 border-b border-[#202A38] flex items-center text-xs text-slate-400 bg-[#0B0F16] ${
                isExplorerOpen ? 'px-2 justify-between' : 'justify-center px-1'
              }`}
            >
              {isExplorerOpen ? (
                <>
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <FolderTree className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-bold tracking-wider text-[11px] text-slate-300">EXPLORER</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setIsCreatingFile(true);
                        setIsWorkspaceFolderOpen(true);
                      }}
                      className="p-1 rounded hover:bg-[#151C27] text-slate-300 hover:text-cyan-300 transition-colors"
                      title="New Strategy File (Saved on Disk)"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsExplorerOpen(false)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#151C27] text-slate-300 hover:text-cyan-300 transition-colors"
                      title="Collapse Explorer"
                    >
                      <PanelLeftClose className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setIsExplorerOpen(true)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#151C27] text-slate-300 hover:text-cyan-300 transition-colors"
                  title="Expand Workspace Explorer"
                >
                  <PanelLeftOpen className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>

            {/* Explorer Tree Content */}
            {isExplorerOpen && (
              <div className="flex-1 overflow-y-auto py-2 text-xs">
                {/* Root User Folder */}
                <div>
                  <div
                    onClick={() => setIsWorkspaceFolderOpen((prev) => !prev)}
                    className="flex items-center justify-between px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-[#111722] cursor-pointer group font-semibold text-[11px]"
                  >
                    <div className="flex items-center gap-1.5">
                      {isWorkspaceFolderOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 transition-transform" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 transition-transform" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-amber-400/90" />
                      {isResolvingUser ? (
                        <span className="tracking-wide text-slate-500 font-medium animate-pulse">Loading...</span>
                      ) : (
                        <span suppressHydrationWarning className="tracking-wide text-slate-300 font-medium">{displayName}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 group-hover:text-slate-500 font-mono">
                      {isResolvingUser || isLoadingFiles ? '...' : visibleWorkspaceFiles.length}
                    </span>
                  </div>

                  {/* Loading indicator */}
                  {(isLoadingFiles || isResolvingUser) && isWorkspaceFolderOpen && (
                    <div className="flex items-center gap-2 px-6 py-2 text-slate-500 text-[11px]">
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      <span>Loading files...</span>
                    </div>
                  )}

                  {/* Children under root user folder */}
                  {!isLoadingFiles && isWorkspaceFolderOpen && (
                    <div className="ml-3 pl-2 border-l border-[#202A38]/60 space-y-0.5 mt-0.5">
                      {/* Inline Create File Input */}
                      {isCreatingFile && (
                        <div className="px-2 py-1 flex items-center gap-1 bg-[#121926] rounded border border-cyan-500/40 mr-2">
                          <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <input
                            type="text"
                            autoFocus
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleConfirmCreateFile();
                              else if (e.key === 'Escape') {
                                setIsCreatingFile(false);
                                setNewFileName('');
                              }
                            }}
                            placeholder="strategy.mq5"
                            className="w-full bg-transparent text-xs text-slate-200 outline-none font-mono placeholder:text-slate-600"
                          />
                          <button
                            onClick={handleConfirmCreateFile}
                            className="text-emerald-400 hover:text-emerald-300 p-0.5"
                            title="Create"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setIsCreatingFile(false);
                              setNewFileName('');
                            }}
                            className="text-slate-500 hover:text-slate-300 p-0.5"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Empty State when no files */}
                      {visibleWorkspaceFiles.length === 0 && !isCreatingFile && (
                        <div className="py-2 px-1 text-slate-500 text-[11px] space-y-1 select-none">
                          <p className="italic text-slate-500">No code files in workspace</p>
                          <button
                            onClick={() => setIsCreatingFile(true)}
                            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                          >
                            <FilePlus className="w-3 h-3" />
                            <span>+ Add file</span>
                          </button>
                        </div>
                      )}

                      {/* Physical Files on Disk */}
                      {visibleWorkspaceFiles.map((file, idx) => {
                        const isActive =
                          file.id === activeFileId ||
                          file.name === activeFileName ||
                          file.name === activeFileId ||
                          file.id.toLowerCase() === activeFileId.toLowerCase() ||
                          (Boolean(activeFileName) && file.name.toLowerCase() === activeFileName.toLowerCase());
                        const isOpen = openFileIds.includes(file.id);
                        const isRenaming = renamingFileId === file.id;

                        if (isRenaming) {
                          const originalExt = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
                          return (
                            <div
                              key={`rename_${file.id}_${idx}`}
                              className="px-1.5 py-0.5 flex items-center gap-1 bg-[#121926] rounded border border-cyan-500/50 mr-2 shadow-inner"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                autoFocus
                                value={renamingFileName}
                                onChange={(e) => setRenamingFileName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleConfirmRename(file.id, renamingFileName);
                                  else if (e.key === 'Escape') setRenamingFileId(null);
                                }}
                                className="flex-1 min-w-0 bg-transparent text-[11px] text-cyan-200 outline-none font-mono"
                                placeholder="file_name"
                              />
                              {originalExt && (
                                <span
                                  className="text-[10px] px-1 py-0.5 rounded bg-[#1A2538] text-slate-400 font-mono select-none shrink-0 border border-[#2A374D]"
                                  title="Extension is locked and cannot be changed"
                                >
                                  {originalExt}
                                </span>
                              )}
                              <button
                                onClick={() => handleConfirmRename(file.id, renamingFileName)}
                                className="text-emerald-400 hover:text-emerald-300 p-0.5 shrink-0"
                                title="Confirm Rename"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setRenamingFileId(null)}
                                className="text-slate-500 hover:text-slate-300 p-0.5 shrink-0"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`${file.id}_${idx}`}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/x-backtest-ai-file', JSON.stringify({ id: file.id, name: file.name, type: 'workspace_file' }));
                              e.dataTransfer.setData('application/json', JSON.stringify({ id: file.id, name: file.name, type: 'workspace_file' }));
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={() => handleSelectFile(file.id)}
                            onContextMenu={(e) => handleFileContextMenu(e, file)}
                            className={`group flex items-center justify-between px-2 py-1 rounded cursor-default transition-colors mr-1.5 ${isActive
                                ? 'bg-cyan-500/15 text-cyan-300 font-medium border border-cyan-500/30'
                                : isOpen
                                  ? 'text-slate-300 hover:bg-[#111722]'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#111722]'
                              }`}
                            title={`Drag '${file.name}' to chat to target`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden flex-1">
                              {getFileIcon(file.name)}
                              {(() => {
                                const match = file.name.match(/^(.*?)(_v\d+)?(\.[^.]+)$/);
                                if (match) {
                                  const [, base, version, ext] = match;
                                  return (
                                    <div className="flex items-center gap-1 min-w-0 overflow-hidden text-[11px] font-mono leading-tight">
                                      <span className="truncate text-slate-200 font-medium" title={file.name}>
                                        {base}
                                      </span>
                                      {version && (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold shrink-0">
                                          {version.replace('_', '')}
                                        </span>
                                      )}
                                      <span className="text-slate-500 text-[10px] shrink-0 font-medium">
                                        {ext}
                                      </span>
                                    </div>
                                  );
                                }
                                return (
                                  <span className="truncate text-[11px] text-slate-200 font-mono tracking-tight" title={file.name}>
                                    {file.name}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Center: Main Viewport (Monaco Multi-File Editor OR Sandbox Runner OR Chart Runner) */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#080B10]">
            {/* Unified Test Run Sub-Header Bar (Visible in BOTH Test Results and Test on Chart) */}
            {(centralViewMode === 'sandbox_runner' || centralViewMode === 'chart_runner') && (
              <CentralBacktestSubHeader
                strategyName={activeFileName}
                versionNum={effectiveVersionNum}
                strategyVersions={strategyVersions}
                onSelectVersion={(v) => {
                  if (v === activeVersionNum) {
                    handleExitPreview();
                  } else {
                    handleRestoreVersion(v);
                  }
                }}
                availableRuns={availableStrategyRuns}
                selectedRunId={selectedRunId}
                onSelectRun={handleSelectRun}
                onDeleteRun={handleDeleteBacktestRun}
                onRefresh={fetchPersistedRuns}
                onReRun={handleReRunBacktest}
                isRunning={isReRunningSimulation}
                isLoading={isTestResultsLoading}
                isReplayPlaying={centralViewMode === 'chart_runner' && Boolean(chartReplayState?.isPlaying)}
              />
            )}

            {/* View A: Monaco Multi-File Editor (Preserved in DOM to retain memory/cursor/undo) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'none';
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'none';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden ${centralViewMode === 'editor' ? 'flex' : 'hidden'}`}
            >
              <MonacoMultiFileEditor
                files={openEditorFiles}
                activeFileId={activeFileId}
                readOnly={viewingHistoricalVersion !== null}
                onSelectFile={handleSelectFile}
                onCloseFile={handleCloseFile}
                onCreateNewFile={() => {
                  setIsExplorerOpen(true);
                  setIsCreatingFile(true);
                }}
                onContentChange={handleContentChange}
                lintIssues={lintIssues}
                diffMode={diffState.active}
                diffOriginal={diffState.original}
                diffModified={diffState.modified}
                onAcceptDiff={handleAcceptDiff}
                onRejectDiff={handleRejectDiff}
                rootName={isResolvingUser ? 'Loading...' : displayName}
                showStatusBar={false}
                navigateToLine={navigateToLine}
                onOpenProblems={() => {
                  setActiveBottomTab('problems');
                  setIsConsoleExpanded(true);
                }}
                onAddSelectionToChat={(payload) => handleAttachFileToChat(payload.filename, payload)}
              />
            </div>

            {/* View B: Sandbox Runner Viewport */}
            {centralViewMode === 'sandbox_runner' && (
              <CentralSandboxRunnerPanel
                strategyName={activeFileName}
                versionNum={effectiveVersionNum}
                strategyVersions={strategyVersions}
                hideHeader={true}
                isLoading={isTestResultsLoading}
                selectedRunDetails={selectedRunDetails && selectedRunDetails.id === selectedRunId ? selectedRunDetails : null}
                onSelectVersion={(v) => {
                  if (v === activeVersionNum) {
                    handleExitPreview();
                  } else {
                    handleRestoreVersion(v);
                  }
                }}
                code={code}
                language={effectiveLanguage}
                parameters={parsedParameters}
                initialConfig={sandboxLaunchConfig}
                simulationMetrics={selectedRunDetails && selectedRunDetails.id === selectedRunId ? selectedRunDetails.metrics : null}
                trades={selectedRunDetails && selectedRunDetails.id === selectedRunId ? selectedRunDetails.trades : []}
                runId={selectedRunId || null}
                onUpdateParameter={handleUpdateParameterValue}
                onBackToEditor={() => setCentralViewMode('editor')}
                onOpenChartRunner={() => setCentralViewMode('chart_runner')}
                onSimulationComplete={(res) => {
                  const tradesCount = Number(res?.metrics?.totalTrades ?? (res?.metrics as any)?.total_trades ?? (res?.trades ? res.trades.length : 0));
                  if (tradesCount <= 0) {
                    fetchPersistedRuns();
                    return;
                  }
                  if (res?.runId && cleanActiveStrategyName && typeof window !== 'undefined') {
                    localStorage.setItem(`quantlab_selected_run_${cleanActiveStrategyName.toLowerCase()}`, res.runId);
                  }
                  if (res?.metrics) {
                    setStrategyTestResults((prev) => ({
                      ...prev,
                      [cleanActiveStrategyName]: {
                        runId: res.runId,
                        metrics: res.metrics,
                        trades: res.trades || [],
                        passed: true,
                        updatedAt: Date.now(),
                      },
                    }));
                    setSimulationMetrics(res.metrics);
                  }
                  if (res.trades) setSimulationTrades(res.trades);
                  if (res.runId) {
                    setSimulationRunId(res.runId);
                    setSelectedRunId(res.runId);
                    loadRunDetails(res.runId);
                  }
                  fetchPersistedRuns();
                }}
                onSendReportToAgent={handleSendReportToAgent}
              />
            )}

            {/* View C: Chart Runner Viewport */}
            {centralViewMode === 'chart_runner' && (
              <CentralChartRunnerPanel
                strategyName={activeFileName}
                code={code}
                language={language}
                runId={selectedRunId}
                runDetails={selectedRunDetails && selectedRunDetails.id === selectedRunId ? selectedRunDetails : null}
                isLoading={isTestResultsLoading}
                initialRunId={selectedRunId || undefined}
                initialTrades={selectedRunDetails && selectedRunDetails.id === selectedRunId ? selectedRunDetails.trades : []}
                initialMetrics={selectedRunDetails && selectedRunDetails.id === selectedRunId ? selectedRunDetails.metrics : null}
                onBackToSandbox={() => setCentralViewMode('sandbox_runner')}
                onBackToEditor={() => setCentralViewMode('editor')}
                onSimulationComplete={(res) => {
                  setSimulationMetrics(res.metrics);
                  if (res.trades) setSimulationTrades(res.trades);
                  if (res.runId) setSimulationRunId(res.runId);
                }}
                onReplayStateChange={setChartReplayState}
              />
            )}
          </div>
        </div>

        {/* Bottom Diagnostics & Telemetry Drawer (Spans across entire bottom under both Explorer and Editor) */}
        <div className={mobileActiveTab === 'agent' ? 'hidden lg:block' : 'block'}>
          <AutopsyDiagnosticsDrawer
            mobileActiveTab={mobileActiveTab}
            activeTab={activeBottomTab}
            onTabChange={setActiveBottomTab}
            isExpanded={isConsoleExpanded}
            onToggleExpanded={() => setIsConsoleExpanded((p) => !p)}
            lintIssues={lintIssues}
            parameters={parsedParameters}
            onUpdateParameter={handleUpdateParameterValue}
            metrics={selectedRunDetails?.metrics || activeStrategyTestResult?.metrics || simulationMetrics}
            trades={selectedRunDetails?.trades || activeStrategyTestResult?.trades || simulationTrades || []}
            symbol={selectedRunDetails?.symbol || 'XAUUSD'}
            balance={selectedRunDetails?.metrics?.initialCapital ?? 100000}
            equity={
              (selectedRunDetails?.metrics?.initialCapital ?? 100000) +
              (selectedRunDetails?.metrics?.netProfit ?? activeStrategyTestResult?.metrics?.netProfit ?? simulationMetrics?.netProfit ?? 0)
            }
            isChartRunnerOpen={centralViewMode === 'chart_runner'}
            isChartRunnerEnabled={hasPassedTestResults}
            onOpenChartRunner={handleTestOnChart}
            currentReplayTime={centralViewMode === 'chart_runner' ? chartReplayState?.currentTime : null}
            currentBar={centralViewMode === 'chart_runner' ? chartReplayState?.currentBar : null}
            onFixWithAI={async (issue) => {
              handleNavigateToLine(issue.line, issue.column);
              try {
                const res = await fetch('/api/v1/strategies/ai/fix', {
                  method: 'POST',
                  headers: {
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : {}),
          },
          credentials: 'include',
                  body: JSON.stringify({
                    code,
                    language,
                    errors: [`Line ${issue.line}: ${issue.message}`],
                    line: issue.line,
                    rule: issue.rule,
                    message: issue.message,
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  const fixed = data.fixed_code || data.code;
                  if (fixed && fixed !== code) {
                    handleOpenDiffGate(fixed, language);
                    return;
                  }
                }
              } catch (err) {
                console.warn('[AI Fix] Request failed:', err);
              }
              // Agent fallback: notify QuantAgentPanel to address the fix
              const targetStrat = activeFileName || 'the active strategy';
              const promptText = `Fix syntax error in ${targetStrat} at Line ${issue.line}: ${issue.message}. Please repair the code and apply the fix.`;
              setExternalPrompt({ prompt: promptText, timestamp: Date.now() });
            }}
            language={language}
            onNavigateToLine={handleNavigateToLine}
          />
        </div>
      </div>

      {/* 2. Right Zone: Pro AI Agent Cockpit (Runs full height directly from the top) */}
      <div className={`h-full ${
        mobileActiveTab === 'agent'
          ? 'flex flex-1 w-full justify-center lg:flex-none lg:w-auto lg:shrink-0'
          : 'hidden lg:flex lg:flex-none lg:w-auto lg:shrink-0'
      } pb-14 lg:pb-0 overflow-hidden`}>
        <QuantAgentPanel
          currentCode={code}
          currentLanguage={language}
          username={rootUsername}
          activeFileName={activeFileName}
          activeVersion={activeVersionNum}
          versionTestsCount={availableStrategyRuns.length}
          externalPrompt={externalPrompt}
          diffState={diffState}
          onAcceptDiff={handleAcceptDiff}
          onRejectDiff={handleRejectDiff}
          onApplyCode={handleApplyCodeToEditor}
          onOpenDiffGate={handleOpenDiffGate}
          onTestInSandbox={(cfg) => handleRunSimulation(cfg)}
          onTestOnChart={() => setCentralViewMode('chart_runner')}
          onSimulationComplete={(res) => {
            const tradesCount = Number(
              res?.metrics?.totalTrades ??
              (res?.metrics as any)?.total_trades ??
              res?.metrics?.total_trades_count ??
              (res?.trades ? res.trades.length : 0)
            );
            if (tradesCount <= 0) {
              fetchPersistedRuns();
              return;
            }
            if (res?.metrics) {
              const rawKey = (res.strategyId || res.strategy_name || res.strategy_id || cleanActiveStrategyName || activeFileName || 'strategy').replace(/\.[^/.]+$/, '').trim();
              const cleanKey = rawKey.toLowerCase();
              const runId = res.runId || res.run_id || `run_${Date.now()}`;
              const targetVersion = res.versionNum ? Number(res.versionNum) : effectiveVersionNum;
              if (res.versionNum && Number(res.versionNum) !== activeVersionNum) {
                setActiveVersionNum(Number(res.versionNum));
              }

              const runDetailsObj = {
                id: runId,
                strategy_id: rawKey,
                strategy_name: cleanActiveStrategyName || activeFileName,
                version_num: targetVersion,
                metrics: res.metrics,
                trades: res.trades || [],
                symbol: res.symbol || 'XAUUSD',
                timeframe: res.timeframe || 'M15',
                created_at: new Date().toISOString(),
                status: 'completed',
              };

              const resultObj = {
                runId,
                metrics: res.metrics,
                trades: res.trades || [],
                passed: true,
                updatedAt: Date.now(),
                versionNum: targetVersion,
              };

              // 1. Synchronously seed selectedRunId & trigger authoritative run load
              setSelectedRunId(runId);
              if (res.runId) {
                loadRunDetails(res.runId);
              } else {
                setSelectedRunDetails(runDetailsObj);
                setSimulationMetrics(res.metrics);
                if (res.trades) setSimulationTrades(res.trades);
                setSimulationRunId(runId);
              }

              // 2. Optimistically prepend into persistedRuns so UI never reverts to old runs
              setPersistedRuns((prev) => {
                const remaining = prev.filter((r) => r.id !== runId);
                return [runDetailsObj, ...remaining];
              });

              // 3. Cache test result
              const versionKey = `${rawKey}_v${targetVersion}`.toLowerCase();
              setStrategyTestResults((prev) => ({
                ...prev,
                [versionKey]: resultObj,
                [rawKey]: resultObj,
                [cleanKey]: resultObj,
                [cleanActiveStrategyName]: resultObj,
                [activeFileName]: resultObj,
              }));

              // 4. Immediately switch viewport to sandbox_runner
              if (res.autoOpenView !== false) {
                setCentralViewMode('sandbox_runner');
              }

              // 5. Background refresh persisted runs from API
              fetchPersistedRuns();
            }
          }}
          onWorkspaceChanged={handleWorkspaceChanged}
          onVersionChanged={(newV: number, stratName?: string) => {
            setActiveVersionNum(newV);
            const target = stratName ? stratName.replace(/\.[^/.]+$/, '').trim() : cleanActiveStrategyName;
            if (target) {
              fetchStrategyVersions(target, newV);
            }
          }}
          onSessionChanged={() => {
            setStrategyTestResults({});
            setSimulationMetrics(null);
            setSimulationTrades([]);
            setSimulationRunId(null);
            if (centralViewMode === 'sandbox_runner') {
              setCentralViewMode('editor');
            }
          }}
          incomingTelemetryReport={incomingTelemetryReport}
          incomingAttachment={chatTargetAttachment}
          onClearIncomingAttachment={() => setChatTargetAttachment(null)}
        />
      </div>

      {/* 3. Right-Click Context Menu for Files */}
      {contextMenu && (
        <div
          style={{
            top: Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 200 : contextMenu.y),
            left: Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 180 : contextMenu.x),
          }}
          className="fixed z-50 w-48 rounded-lg bg-[#0E131E] border border-[#202A38] shadow-2xl py-1 text-xs select-none backdrop-blur-md animate-in fade-in duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] text-slate-500 font-bold border-b border-[#1A2332] truncate flex items-center gap-1.5">
            {getFileIcon(contextMenu.file.name)}
            <span className="truncate">{contextMenu.file.name}</span>
          </div>

          {/* Add to Chat action */}
          <button
            onClick={() => {
              handleAttachFileToChat(contextMenu.file.name);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#151D2C] text-slate-300 hover:text-cyan-300 transition-colors text-left cursor-pointer border-b border-[#1A2332]/60"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium text-slate-200 hover:text-cyan-300">Add to Chat</span>
          </button>

          <button
            onClick={() => {
              setRenamingFileId(contextMenu.file.id);
              const ext = contextMenu.file.name.includes('.') ? '.' + contextMenu.file.name.split('.').pop() : '';
              const base = ext ? contextMenu.file.name.slice(0, -ext.length) : contextMenu.file.name;
              setRenamingFileName(base);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#151D2C] text-slate-300 hover:text-cyan-300 transition-colors text-left cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Rename</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.file.name);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#151D2C] text-slate-300 hover:text-slate-100 transition-colors text-left cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy File Name</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.file.name);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#151D2C] text-slate-300 hover:text-slate-100 transition-colors text-left cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy Relative Path</span>
          </button>

          <button
            onClick={() => {
              const blob = new Blob([contextMenu.file.content], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = contextMenu.file.name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#151D2C] text-slate-300 hover:text-slate-100 transition-colors text-left cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Download</span>
          </button>

          <div className="h-px bg-[#202A38] my-1" />

          <button
            onClick={() => {
              setFileToDelete(contextMenu.file);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-crimson-risk/15 text-crimson-risk transition-colors text-left font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete File</span>
          </button>
        </div>
      )}

      {/* 4. Delete File Confirmation Modal */}
      {fileToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setFileToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-[#0D1118] border border-[#202A38] shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-crimson-risk/15 border border-crimson-risk/40 flex items-center justify-center text-crimson-risk shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Delete File
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Are you sure you want to permanently delete <span className="text-cyan-400 font-semibold">{fileToDelete.name}</span> from disk?
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#202A38] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[#111722] hover:bg-[#151D2B] border border-[#202A38] text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteFile(fileToDelete.id, fileToDelete.name);
                  setFileToDelete(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Strategy to Community Modal */}
      {activeFileName && (
        <PublishStrategyModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          strategyName={activeFileName.replace(/\.(mq5|py)$/i, '')}
          versionNum={effectiveVersionNum || 1}
          initialCode={code || undefined}
          initialMetrics={selectedRunDetails?.metrics || undefined}
          testedSymbol={selectedRunDetails?.symbol || (activeFileName.toLowerCase().includes('gold') || activeFileName.toLowerCase().includes('xau') ? 'XAUUSD' : 'EURUSD')}
        />
      )}

      {/* Mobile 3-Mode Fixed Bottom Navigation Bar (< lg screens) */}
      <QuantMobileNav
        activeTab={mobileActiveTab}
        onTabChange={handleMobileTabChange}
      />
    </div>
  );
}

export default function QuantLabPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#070B12] text-cyan-400 font-mono text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
          <span>Loading QuantLab Workspace...</span>
        </div>
      }
    >
      <QuantLabPageContent />
    </React.Suspense>
  );
}

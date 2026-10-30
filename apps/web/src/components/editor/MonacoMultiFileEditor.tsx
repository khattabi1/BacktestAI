'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  FileCode,
  Code2,
  FileJson,
  FileText,
  FilePlus,
  Check,
  X,
  Sparkles,
  GitCompare,
  Copy,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  SplitSquareVertical,
  Sliders,
  ChevronDown,
  Zap,
} from 'lucide-react';

// Dynamic import with SSR disabled for Monaco Editor
const Editor = dynamic(() => import('@monaco-editor/react').then((mod) => mod.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#080B10] text-slate-500 font-mono text-xs">
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span>Initializing Monaco Engine...</span>
      </div>
    </div>
  ),
});

const DiffEditor = dynamic(() => import('@monaco-editor/react').then((mod) => mod.DiffEditor), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#080B10] text-slate-500 font-mono text-xs">
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading Diff View...</span>
      </div>
    </div>
  ),
});

export interface EditorFile {
  id: string;
  name: string;
  language: string;
  content: string;
  isModified?: boolean;
}

export interface LintIssue {
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning';
  rule?: string;
  fixSuggestion?: string;
}

export interface MonacoMultiFileEditorProps {
  files: EditorFile[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onCloseFile?: (fileId: string) => void;
  onCreateNewFile?: () => void;
  onContentChange: (fileId: string, content: string) => void;
  lintIssues?: LintIssue[];
  diffMode?: boolean;
  diffOriginal?: string;
  diffModified?: string;
  onAcceptDiff?: () => void;
  onRejectDiff?: () => void;
  readOnly?: boolean;
  rootName?: string;
  showStatusBar?: boolean;
  navigateToLine?: { line: number; column?: number; timestamp: number } | null;
  onOpenProblems?: () => void;
  onAddSelectionToChat?: (payload: {
    filename: string;
    lineStart?: number;
    lineEnd?: number;
    codeSnippet?: string;
  }) => void;
}

export function MonacoMultiFileEditor({
  files,
  activeFileId,
  onSelectFile,
  onCloseFile,
  onCreateNewFile,
  onContentChange,
  lintIssues = [],
  diffMode = false,
  diffOriginal = '',
  diffModified = '',
  onAcceptDiff,
  onRejectDiff,
  readOnly = false,
  rootName = 'root',
  showStatusBar = false,
  navigateToLine = null,
  onOpenProblems,
  onAddSelectionToChat,
}: MonacoMultiFileEditorProps) {
  const editorRef = useRef<any>(null);
  const diffEditorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isUserTypingRef = useRef<boolean>(false);
  const typingTimerRef = useRef<any>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [copied, setCopied] = useState(false);
  const [isSideBySide, setIsSideBySide] = useState(false);

  // Clean up DiffEditor models and typing timer on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (diffEditorRef.current) {
        try {
          diffEditorRef.current.setModel(null);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const activeFileRef = useRef<EditorFile | undefined>(activeFile);
  activeFileRef.current = activeFile;
  const onAddSelectionToChatRef = useRef(onAddSelectionToChat);
  onAddSelectionToChatRef.current = onAddSelectionToChat;

  // External content sync (e.g., version restore, agent diff accept, file switch)
  // Strictly guards against overwriting the buffer while user is typing
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    if (isUserTypingRef.current) return;

    const incoming = activeFile.content || '';
    if (model.getValue() !== incoming) {
      const pos = editorRef.current.getPosition();
      model.setValue(incoming);
      if (pos) {
        try {
          editorRef.current.setPosition(pos);
        } catch {
          // ignore
        }
      }
    }
  }, [activeFile?.content, activeFile?.id]);

  // Helper to get file icon
  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.py')) return <Code2 className="w-3.5 h-3.5 text-cyan-400" />;
    if (fileName.endsWith('.mq5')) return <FileCode className="w-3.5 h-3.5 text-violet-400" />;
    if (fileName.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-amber-400" />;
    return <FileText className="w-3.5 h-3.5 text-slate-400" />;
  };

  // Configure custom Obsidian theme on Monaco mount
  const handleEditorWillMount = useCallback((monaco: any) => {
    monacoRef.current = monaco;

    monaco.editor.defineTheme('obsidian-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
        { token: 'keyword', foreground: '22D3EE', fontStyle: 'bold' },
        { token: 'string', foreground: '34D399' },
        { token: 'number', foreground: 'F59E0B' },
        { token: 'type', foreground: 'A78BFA' },
        { token: 'function', foreground: '38BDF8' },
        { token: 'identifier', foreground: 'E2E8F0' },
        { token: 'delimiter', foreground: '94A3B8' },
      ],
      colors: {
        'editor.background': '#080B10',
        'editor.foreground': '#E2E8F0',
        'editor.lineHighlightBackground': '#111722',
        'editor.selectionBackground': '#22D3EE25',
        'editorCursor.foreground': '#22D3EE',
        'editorWhitespace.foreground': '#1E293B',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#22D3EE',
        'editorGutter.background': '#080B10',
        'editorIndentGuide.background': '#151C27',
        'editorIndentGuide.activeBackground': '#202A38',
        'editorBracketMatch.background': '#22D3EE30',
        'editorBracketMatch.border': '#22D3EE',
        'minimap.background': '#080B10',
        'scrollbarSlider.background': '#202A3880',
        'scrollbarSlider.hoverBackground': '#334155',
        'scrollbarSlider.activeBackground': '#475569',
        'diffEditor.insertedTextBackground': '#10B98133',
        'diffEditor.insertedLineBackground': '#10B98114',
        'diffEditor.removedTextBackground': '#F43F5E33',
        'diffEditor.removedLineBackground': '#F43F5E14',
        'diffEditor.diagonalFill': '#151C2780',
        'diffEditor.border': '#1E293B',
        'diffEditorGutter.insertedLineGutterBackground': '#10B98125',
        'diffEditorGutter.removedLineGutterBackground': '#F43F5E25',
        'diffEditorOverview.insertedForeground': '#10B98180',
        'diffEditorOverview.removedForeground': '#F43F5E80',
      },
    });
  }, []);

  // Update inline error squiggles with accurate column and suggestion tooltips
  const updateSyntaxMarkers = useCallback(
    (editor: any, monaco: any, issues: LintIssue[]) => {
      if (!editor || !monaco) return;
      const model = editor.getModel();
      if (!model) return;

      const markers = issues.map((issue) => {
        const line = Math.max(1, Math.min(issue.line, model.getLineCount()));
        const maxCol = model.getLineMaxColumn(line) || 100;
        const startCol = issue.column ? Math.max(1, Math.min(issue.column, maxCol)) : 1;
        const endCol = issue.endColumn ? Math.min(issue.endColumn, maxCol) : maxCol;

        let msg = issue.message;
        if (issue.fixSuggestion) {
          msg += `\nSuggestion: ${issue.fixSuggestion}`;
        }

        return {
          severity:
            issue.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : monaco.MarkerSeverity.Warning,
          message: msg,
          startLineNumber: line,
          startColumn: startCol,
          endLineNumber: issue.endLine || line,
          endColumn: endCol,
          source: issue.rule || 'backtest-ai',
        };
      });

      monaco.editor.setModelMarkers(model, 'backtest-ai-validator', markers);
    },
    []
  );

  // Setup editor instance on mount
  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Reject and disable dropping any files or text into the code editor buffer
    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'none';
        }
      });
      domNode.addEventListener('dragenter', (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'none';
        }
      });
      domNode.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }

    // Only track cursor movements if status bar is active to avoid unnecessary component renders
    if (showStatusBar) {
      editor.onDidChangeCursorPosition((e: any) => {
        setCursorPos({
          line: e.position.lineNumber,
          col: e.position.column,
        });
      });
    }

    // Register "Add to Chat" action in Monaco right-click context menu and Ctrl+L
    editor.addAction({
      id: 'add-selection-to-chat',
      label: 'Add to Chat',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 0.5,
      run: (ed: any) => {
        const selection = ed.getSelection();
        const model = ed.getModel();
        if (!model) return;
        const currentFile = activeFileRef.current;
        const currentFilename = currentFile?.name || 'strategy.py';

        if (selection && !selection.isEmpty()) {
          const startLine = selection.startLineNumber;
          const endLine = selection.endLineNumber;
          const selectedText = model.getValueInRange(selection);
          onAddSelectionToChatRef.current?.({
            filename: currentFilename,
            lineStart: startLine,
            lineEnd: endLine,
            codeSnippet: selectedText,
          });
        } else {
          const fullText = model.getValue();
          onAddSelectionToChatRef.current?.({
            filename: currentFilename,
            codeSnippet: fullText,
          });
        }
      },
    });

    // Apply syntax markers if available
    updateSyntaxMarkers(editor, monaco, lintIssues);
  }, [showStatusBar, lintIssues, updateSyntaxMarkers]);

  // Navigate to specific line when triggered from problems
  useEffect(() => {
    if (!editorRef.current || !navigateToLine) return;
    try {
      editorRef.current.revealLineInCenter(navigateToLine.line);
      editorRef.current.setPosition({
        lineNumber: navigateToLine.line,
        column: navigateToLine.column || 1,
      });
      editorRef.current.focus();
    } catch {
      // ignore
    }
  }, [navigateToLine]);

  useEffect(() => {
    if (editorRef.current) {
      try {
        editorRef.current.updateOptions({ readOnly });
      } catch {
        // ignore
      }
    }
  }, [readOnly]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      updateSyntaxMarkers(editorRef.current, monacoRef.current, lintIssues);
    }
  }, [lintIssues, updateSyntaxMarkers]);

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const errorCount = lintIssues.filter((i) => i.severity === 'error').length;
  const warningCount = lintIssues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080B10] overflow-hidden select-none font-mono">
      {/* 1. VS Code Multi-File Tab Bar */}
      <div className="h-9 bg-[#0B0F16] border-b border-[#202A38] flex items-center justify-between px-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1 overflow-x-auto">
          {files.map((file, idx) => {
            const isActive = file.id === activeFileId;
            return (
              <div
                key={`${file.id}_${idx}`}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-backtest-ai-file', JSON.stringify({ id: file.id, name: file.name, type: 'workspace_file' }));
                  e.dataTransfer.setData('application/json', JSON.stringify({ id: file.id, name: file.name, type: 'workspace_file' }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onSelectFile(file.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onAddSelectionToChatRef.current?.({
                    filename: file.name,
                    codeSnippet: file.content,
                  });
                }}
                title={`Click to open ${file.name}`}
                className={`group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-t-md text-xs font-medium border-t-2 cursor-grab active:cursor-grabbing transition-all ${
                  isActive
                    ? 'bg-[#0C1524] border-cyan-400 text-slate-100 shadow-sm'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#111722]'
                }`}
              >
                {getFileIcon(file.name)}
                <span className={`tracking-tight select-none ${isActive ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>{file.name}</span>
                {file.isModified && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
                {onCloseFile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseFile(file.id);
                    }}
                    className="ml-1 p-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 opacity-60 group-hover:opacity-100 transition-all shrink-0"
                    title={`Close ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          {diffMode && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-[11px] text-violet-300 font-semibold mr-2 animate-pulse">
              <GitCompare className="w-3 h-3" />
              <span>AI Diff Mode</span>
            </div>
          )}

          {activeFile && (
            <>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded hover:bg-[#151C27] text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy file contents"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 rounded hover:bg-[#151C27] text-slate-400 hover:text-slate-200 transition-colors"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Breadcrumbs & Diagnostics Bar */}
      <div className="h-7 bg-[#090D13] border-b border-[#1A2332] px-3 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span suppressHydrationWarning className="text-slate-500 font-medium">{rootName}</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-cyan-300 font-medium">
            {activeFile ? activeFile.name : 'No file open'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Clickable Diagnostics Pills */}
          {errorCount > 0 && (
            <button
              onClick={onOpenProblems}
              className="flex items-center gap-1 text-crimson-risk hover:opacity-80 transition-opacity cursor-pointer font-semibold"
              title="Click to view errors in Problems panel"
            >
              <AlertCircle className="w-3 h-3" />
              <span>{errorCount}</span>
            </button>
          )}
          {warningCount > 0 && (
            <button
              onClick={onOpenProblems}
              className="flex items-center gap-1 text-amber-400 hover:opacity-80 transition-opacity cursor-pointer font-semibold"
              title="Click to view warnings in Problems panel"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{warningCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Monaco Main Canvas */}
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
        className="flex-1 min-h-0 relative"
      >

        {!activeFile ? (
          <div className="h-full flex flex-col items-center justify-center bg-[#080B10] text-slate-500 font-mono text-xs p-8 text-center select-none">
            <div className="w-12 h-12 rounded-xl bg-[#0D121B] border border-[#202A38] flex items-center justify-center text-slate-400 mb-3 shadow-sm">
              <Code2 className="w-6 h-6 text-cyan-400/60" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300 mb-1">No Files Open</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              Select a file from the workspace explorer on the left or create a new strategy file to start coding.
            </p>
            {onCreateNewFile && (
              <button
                onClick={onCreateNewFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-all shadow-sm"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>New Strategy File</span>
              </button>
            )}
          </div>
        ) : (() => {
          const lowerName = (activeFile?.name || '').toLowerCase();
          const editorLanguage =
            activeFile?.language === 'mql5' ||
            lowerName.endsWith('.mq5') ||
            lowerName.endsWith('.mqh') ||
            lowerName.endsWith('.cpp') ||
            lowerName.endsWith('.c') ||
            lowerName.endsWith('.h')
              ? 'cpp'
              : activeFile?.language === 'python' || lowerName.endsWith('.py')
              ? 'python'
              : activeFile?.language || 'cpp';

          return diffMode ? (
            <DiffEditor
              key={`diff_${activeFile?.id || 'diff'}`}
              original={diffOriginal}
              modified={diffModified}
              language={editorLanguage}
              theme="obsidian-dark"
              beforeMount={handleEditorWillMount}
              onMount={(diffEditor) => {
                diffEditorRef.current = diffEditor;
              }}
              options={{
                readOnly: true,
                dragAndDrop: false,
                renderSideBySide: isSideBySide,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                minimap: { enabled: true },
                lineNumbers: 'on',
                folding: true,
                diffWordWrap: 'on',
                ignoreTrimWhitespace: false,
              }}
            />
          ) : (
            <Editor
              key={activeFile?.id}
              path={activeFile?.name}
              language={editorLanguage}
              defaultValue={activeFile?.content || ''}
              onChange={(val) => {
                isUserTypingRef.current = true;
                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                typingTimerRef.current = setTimeout(() => {
                  isUserTypingRef.current = false;
                }, 800);
                onContentChange(activeFile.id, val || '');
              }}
              theme="obsidian-dark"
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
              options={{
                readOnly,
                dragAndDrop: false,
                dropIntoEditor: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                lineHeight: 20,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                glyphMargin: true,
                lineNumbersMinChars: 3,
                minimap: {
                  enabled: true,
                  maxColumn: 80,
                  renderCharacters: false,
                },
                renderLineHighlight: 'all',
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true,
                },
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                autoClosingDelete: 'always',
                autoSurround: 'languageDefined',
                wordBasedSuggestions: 'currentDocument',
                quickSuggestions: { other: true, comments: false, strings: false },
                lineNumbers: 'on',
                lineDecorationsWidth: 10,
                padding: { top: 12, bottom: 12 },
                tabSize: 4,
              }}
            />
        );
      })()}
      </div>

      {/* 5. VS Code Status Bar */}
      {showStatusBar && (
        <footer className="h-6 bg-[#0B0F16] border-t border-[#1E293B] px-3 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-cyan-400 font-semibold">Backtest-AI Engine</span>
            <span>·</span>
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span>·</span>
            <span>Spaces: 4</span>
            <span>·</span>
            <span>UTF-8</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="uppercase text-slate-400 font-medium">
              {activeFile?.language || 'plaintext'}
            </span>
            <span>·</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Deterministic Sandboxed
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Plus,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Play,
  Database,
  Code2,
  Sliders,
  History,
  ShieldAlert,
  Zap,
  Terminal,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ToolExecution {
  call_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  output?: any;
  is_error?: boolean;
  status: 'running' | 'completed' | 'failed';
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thought?: string;
  tools?: ToolExecution[];
  timestamp: string;
}

interface PendingInteraction {
  call_id: string;
  tool_name: string;
  question: string;
  options: string[];
  context: string;
}

interface SessionSummary {
  session_id: string;
  user_id: string;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

const STARTER_PROMPTS = [
  {
    icon: '⚡',
    label: 'Backtest Trend Following',
    prompt: 'Run a backtest on BTCUSDT with SMA Crossover (fast_period=10, slow_period=30) and 0.05% slippage.',
  },
  {
    icon: '📊',
    label: 'Market Volatility Regime',
    prompt: 'Query market data and analyze volatility regime for BTCUSDT on 1-hour timeframe.',
  },
  {
    icon: '🛠️',
    label: 'Generate MQL5 EA',
    prompt: 'Generate a compile-ready MT5 Expert Advisor for RSI Reversal with 1% fixed risk per trade.',
  },
  {
    icon: '🔍',
    label: 'Compare SMA vs RSI',
    prompt: 'Compare performance of SMA crossover against RSI mean reversion on Bitcoin.',
  },
];

export default function SIAgentWorkspacePage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState<string>('Quantitative Research Session');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [promptInput, setPromptInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modelProvider, setModelProvider] = useState<'openrouter' | 'anthropic'>('openrouter');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [pendingInteraction, setPendingInteraction] = useState<PendingInteraction | null>(null);
  const [interactionResponse, setInteractionResponse] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingInteraction]);

  // Load existing sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/v1/agent/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !currentSessionId) {
          loadSession(data[0].session_id);
        } else if (data.length === 0) {
          createNewSession();
        }
      }
    } catch (err) {
      console.error('Failed to fetch agent sessions:', err);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/v1/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Alpha Lab Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(data.session_id);
        setSessionTitle(data.title);
        setMessages([]);
        setPendingInteraction(null);
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to create new session:', err);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/agent/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(data.session_id);
        setSessionTitle(data.title);

        // Convert backend history to frontend messages
        const formattedMessages: MessageItem[] = (data.history || [])
          .filter((m: any) => m.role !== 'system')
          .map((m: any, idx: number) => ({
            id: `msg_${idx}`,
            role: m.role,
            content: m.content || '',
            thought: m.thought,
            tools: (m.tool_calls || []).map((tc: any) => ({
              call_id: tc.id,
              tool_name: tc.name,
              arguments: tc.arguments,
              status: 'completed',
            })),
            timestamp: m.timestamp_utc || new Date().toISOString(),
          }));

        setMessages(formattedMessages);
        setPendingInteraction(data.pending_interaction || null);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/agent/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const remaining = sessions.filter((s) => s.session_id !== sessionId);
        setSessions(remaining);
        if (currentSessionId === sessionId) {
          if (remaining.length > 0) {
            loadSession(remaining[0].session_id);
          } else {
            createNewSession();
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleSendPrompt = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt || promptInput).trim();
    if (!textToSend || isLoading) return;

    if (!currentSessionId) {
      await createNewSession();
    }

    setPromptInput('');
    const userMsgId = `usr_${Date.now()}`;
    const assistantMsgId = `asst_${Date.now()}`;

    // Append user message immediately
    const newMessages: MessageItem[] = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: textToSend,
        timestamp: new Date().toISOString(),
      },
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        thought: '',
        tools: [],
        timestamp: new Date().toISOString(),
      },
    ];

    setMessages(newMessages);
    setIsLoading(true);
    setPendingInteraction(null);

    // Auto-expand reasoning for the new turn
    setExpandedThoughts((prev) => ({ ...prev, [assistantMsgId]: true }));

    try {
      const response = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          prompt: textToSend,
          provider: modelProvider,
        }),
      });

      if (!response.body) throw new Error('Response body missing');

      await readSSEStream(response.body, assistantMsgId);
    } catch (err) {
      console.error('Streaming error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: m.content + '\n\n*(Error connecting to Quant Reasoning Engine)*' }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      fetchSessions();
    }
  };

  const handleResumeInteraction = async (responseOption?: string) => {
    const reply = responseOption || interactionResponse;
    if (!reply.trim() || !currentSessionId || !pendingInteraction) return;

    setInteractionResponse('');
    setIsLoading(true);
    const resumeMsgId = `asst_res_${Date.now()}`;

    // Add user reply as a bubble
    setMessages((prev) => [
      ...prev,
      {
        id: `usr_rep_${Date.now()}`,
        role: 'user',
        content: `Decision / Response: ${reply}`,
        timestamp: new Date().toISOString(),
      },
      {
        id: resumeMsgId,
        role: 'assistant',
        content: '',
        thought: '',
        tools: [],
        timestamp: new Date().toISOString(),
      },
    ]);

    setPendingInteraction(null);
    setExpandedThoughts((prev) => ({ ...prev, [resumeMsgId]: true }));

    try {
      const res = await fetch('/api/v1/agent/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          user_response: reply,
        }),
      });

      if (!res.body) throw new Error('Resume response stream missing');

      await readSSEStream(res.body, resumeMsgId);
    } catch (err) {
      console.error('Resume streaming error:', err);
    } finally {
      setIsLoading(false);
      fetchSessions();
    }
  };

  const readSSEStream = async (body: ReadableStream<Uint8Array>, targetMsgId: string) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        const trimmed = block.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const eventData = JSON.parse(jsonStr);
          const { event_type, payload } = eventData;

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== targetMsgId) return m;

              if (event_type === 'THOUGHT_CHUNK') {
                return { ...m, thought: (m.thought || '') + (payload.delta || '') };
              }
              if (event_type === 'THOUGHT_COMPLETE') {
                return { ...m, thought: payload.thought || m.thought };
              }
              if (event_type === 'MESSAGE_CHUNK') {
                return { ...m, content: (m.content || '') + (payload.delta || '') };
              }
              if (event_type === 'TOOL_CALL_STARTED') {
                const tools = m.tools || [];
                return {
                  ...m,
                  tools: [
                    ...tools,
                    {
                      call_id: payload.call_id,
                      tool_name: payload.tool_name,
                      arguments: payload.arguments || {},
                      status: 'running',
                    },
                  ],
                };
              }
              if (event_type === 'TOOL_CALL_COMPLETED') {
                const tools = (m.tools || []).map((t) =>
                  t.call_id === payload.call_id
                    ? { ...t, output: payload.output, is_error: payload.is_error, status: 'completed' as const }
                    : t
                );
                return { ...m, tools };
              }
              return m;
            })
          );

          if (event_type === 'ASK_USER') {
            setPendingInteraction({
              call_id: payload.call_id,
              tool_name: payload.tool_name,
              question: payload.question,
              options: payload.options || [],
              context: payload.context || '',
            });
          }
        } catch (e) {
          console.warn('Failed to parse SSE payload:', e);
        }
      }
    }
  };

  const toggleThought = (msgId: string) => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-obsidian-base font-sans antialiased text-slate-text relative">
      {/* Sessions Drawer Backdrop on Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sessions Drawer Sidebar */}
      <div
        className={`fixed md:relative inset-y-0 left-0 z-40 md:z-auto border-r border-obsidian-border bg-obsidian-secondary transition-all duration-300 flex flex-col ${
          isSidebarOpen ? 'w-72 sm:w-80 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 overflow-hidden'
        }`}
      >
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-cyan-primary" />
            <span className="text-sm font-semibold text-slate-heading">Research Sessions</span>
          </div>
          <button
            onClick={createNewSession}
            className="p-1.5 rounded-md hover:bg-obsidian-card text-slate-subtle hover:text-cyan-primary transition-colors"
            title="New Session"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <div
              key={s.session_id}
              onClick={() => loadSession(s.session_id)}
              className={`p-3 rounded-lg cursor-pointer text-xs transition-all flex items-center justify-between group ${
                currentSessionId === s.session_id
                  ? 'bg-cyan-primary/10 border border-cyan-primary/30 text-cyan-primary'
                  : 'hover:bg-obsidian-card text-slate-body border border-transparent'
              }`}
            >
              <div className="flex-1 truncate mr-2">
                <p className="font-medium truncate">{s.title || 'Untitled Session'}</p>
                <div className="flex items-center space-x-2 mt-1 text-[10px] text-slate-subtle">
                  <span className="font-mono">{new Date(s.updated_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{s.message_count || 0} messages</span>
                </div>
              </div>
              <button
                onClick={(e) => deleteSession(s.session_id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-crimson-primary transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Conversation Canvas */}
      <div className="flex-1 flex flex-col min-w-0 bg-obsidian-base">
        {/* Top Control Bar HUD */}
        <div className="h-14 border-b border-obsidian-border bg-obsidian-secondary/50 px-3 sm:px-6 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-obsidian-card text-slate-subtle hover:text-slate-text transition-colors"
              title="Toggle Sessions Drawer"
              aria-label="Toggle Sessions Drawer"
            >
              <History className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-primary animate-pulse shrink-0" />
              <h1 className="text-xs sm:text-sm font-semibold text-slate-heading tracking-wide truncate max-w-[120px] sm:max-w-xs md:max-w-none">
                {sessionTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
            {/* Model Provider Selector */}
            <div className="flex items-center bg-obsidian-card border border-obsidian-border rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setModelProvider('openrouter')}
                className={`px-2 sm:px-2.5 py-1 rounded-md font-mono text-[10px] sm:text-[11px] transition-colors ${
                  modelProvider === 'openrouter'
                    ? 'bg-cyan-primary/20 text-cyan-primary font-semibold'
                    : 'text-slate-subtle hover:text-slate-text'
                }`}
              >
                Nemotron
              </button>
              <button
                onClick={() => setModelProvider('anthropic')}
                className={`px-2 sm:px-2.5 py-1 rounded-md font-mono text-[10px] sm:text-[11px] transition-colors ${
                  modelProvider === 'anthropic'
                    ? 'bg-violet-primary/20 text-violet-primary font-semibold'
                    : 'text-slate-subtle hover:text-slate-text'
                }`}
              >
                Claude Opus
              </button>
            </div>

            <button
              onClick={createNewSession}
              className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 min-h-[36px] rounded-lg border border-obsidian-border hover:border-cyan-primary/40 text-xs text-slate-body hover:text-cyan-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">New</span>
            </button>
          </div>
        </div>

        {/* Messages Stream Viewport */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6 py-12">
              <div className="w-16 h-16 rounded-2xl bg-cyan-primary/10 border border-cyan-primary/20 flex items-center justify-center text-cyan-primary shadow-glow-cyan">
                <Bot className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-heading">SI Agent Intelligence</h2>
                <p className="text-sm text-slate-subtle mt-1.5 max-w-md mx-auto">
                  Powered by DeepSeek Harness (DSH) CoT reasoning and deterministic Python & MQL5 quant engines.
                </p>
              </div>

              {/* Starter Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left mt-4">
                {STARTER_PROMPTS.map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendPrompt(starter.prompt)}
                    className="p-4 rounded-xl border border-obsidian-border bg-obsidian-card hover:border-cyan-primary/40 hover:bg-obsidian-elevated transition-all group"
                  >
                    <div className="flex items-center space-x-2 text-slate-heading group-hover:text-cyan-primary font-medium text-xs">
                      <span>{starter.icon}</span>
                      <span>{starter.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-subtle mt-1.5 line-clamp-2 leading-relaxed">
                      {starter.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* User Message */}
                {msg.role === 'user' ? (
                  <div className="max-w-2xl bg-obsidian-card border border-cyan-primary/30 rounded-2xl rounded-tr-sm px-5 py-3.5 text-slate-heading text-sm shadow-sm">
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <span className="block text-[10px] font-mono text-cyan-primary/70 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div className="max-w-3xl w-full space-y-3">
                    {/* Collapsible Chain-of-Thought (CoT) DeepSeek Card */}
                    {msg.thought && (
                      <div className="rounded-xl border border-obsidian-border bg-obsidian-secondary/60 overflow-hidden text-xs">
                        <button
                          onClick={() => toggleThought(msg.id)}
                          className="w-full px-4 py-2 flex items-center justify-between text-slate-subtle hover:text-cyan-primary transition-colors bg-obsidian-secondary/40"
                        >
                          <div className="flex items-center space-x-2 font-mono text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-primary animate-pulse" />
                            <span>DeepSeek Reasoning Trace</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-obsidian-card border border-obsidian-border text-slate-muted">
                              CoT Active
                            </span>
                          </div>
                          {expandedThoughts[msg.id] ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {expandedThoughts[msg.id] && (
                          <div className="p-4 border-t border-obsidian-border bg-[#070A0F] font-mono text-[11px] leading-relaxed text-slate-subtle whitespace-pre-wrap max-h-72 overflow-y-auto border-l-2 border-l-cyan-primary">
                            {msg.thought}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tool Execution Badges */}
                    {msg.tools && msg.tools.length > 0 && (
                      <div className="space-y-2">
                        {msg.tools.map((tool) => (
                          <div
                            key={tool.call_id}
                            className="rounded-lg border border-obsidian-border bg-obsidian-card p-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 font-mono">
                                <Terminal className="w-3.5 h-3.5 text-emerald-primary" />
                                <span className="font-semibold text-slate-heading">
                                  {tool.tool_name}()
                                </span>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                                  tool.status === 'running'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    : tool.is_error
                                    ? 'bg-crimson-primary/10 text-crimson-primary border border-crimson-primary/30'
                                    : 'bg-emerald-primary/10 text-emerald-primary border border-emerald-primary/30'
                                }`}
                              >
                                {tool.status === 'running' ? 'EXECUTING' : 'SUCCESS'}
                              </span>
                            </div>

                            {/* Arguments Preview */}
                            {tool.arguments && Object.keys(tool.arguments).length > 0 && (
                              <div className="mt-2 text-[11px] font-mono text-slate-subtle bg-obsidian-secondary/50 p-2 rounded border border-obsidian-border/50 overflow-x-auto">
                                <code>{JSON.stringify(tool.arguments)}</code>
                              </div>
                            )}

                            {/* Tool Quant Digest Output */}
                            {tool.output && (
                              <div className="mt-2 text-[11px] font-mono bg-obsidian-base p-2.5 rounded border border-obsidian-border text-slate-body overflow-x-auto">
                                <pre className="whitespace-pre-wrap">{typeof tool.output === 'object' ? JSON.stringify(tool.output, null, 2) : tool.output}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assistant Visible Text Content */}
                    {msg.content && (
                      <div className="bg-obsidian-card border border-obsidian-border rounded-2xl rounded-tl-sm p-5 text-slate-heading text-sm leading-relaxed whitespace-pre-wrap shadow-sm">
                        {msg.content}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Human-in-the-Loop Interaction Card */}
          {pendingInteraction && (
            <div className="max-w-2xl mx-auto rounded-2xl border-2 border-cyan-primary/50 bg-obsidian-card p-5 shadow-glow-cyan space-y-4">
              <div className="flex items-center space-x-2 text-cyan-primary font-semibold text-sm">
                <ShieldAlert className="w-5 h-5 text-cyan-primary" />
                <span>Agent Requires Human Clarification / Decision</span>
              </div>

              <div className="bg-obsidian-secondary p-3.5 rounded-xl border border-obsidian-border text-xs text-slate-heading">
                <p className="font-medium text-sm text-cyan-primary mb-1">
                  {pendingInteraction.question}
                </p>
                {pendingInteraction.context && (
                  <p className="text-slate-subtle mt-1">{pendingInteraction.context}</p>
                )}
              </div>

              {/* Quick Select Options */}
              {pendingInteraction.options && pendingInteraction.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingInteraction.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleResumeInteraction(opt)}
                      className="px-3 py-1.5 rounded-lg border border-cyan-primary/40 bg-cyan-primary/10 hover:bg-cyan-primary/20 text-cyan-primary text-xs font-mono transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Written Reply */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  value={interactionResponse}
                  onChange={(e) => setInteractionResponse(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResumeInteraction()}
                  placeholder="Or enter custom instruction..."
                  className="flex-1 bg-obsidian-base border border-obsidian-border rounded-lg px-3.5 py-2 text-xs text-slate-heading focus:outline-none focus:border-cyan-primary"
                />
                <button
                  onClick={() => handleResumeInteraction()}
                  className="px-4 py-2 bg-cyan-primary text-obsidian-base rounded-lg font-semibold text-xs hover:bg-cyan-primary/90 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Console */}
        <div className="p-3 sm:p-4 border-t border-obsidian-border bg-obsidian-secondary/40 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto flex flex-col space-y-2">
            <div className="relative flex items-center bg-obsidian-card border border-obsidian-border rounded-xl focus-within:border-cyan-primary/60 transition-colors p-1">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
                disabled={isLoading}
                rows={2}
                placeholder="Instruct quantitative agent (e.g., 'Backtest SMA Crossover on BTCUSDT with 0.05% slippage')..."
                className="w-full bg-transparent px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-heading placeholder-slate-subtle resize-none focus:outline-none"
              />
              <button
                onClick={() => handleSendPrompt()}
                disabled={isLoading || !promptInput.trim()}
                className={`mr-1 sm:mr-2 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-obsidian-base transition-colors shrink-0 ${
                  promptInput.trim() && !isLoading
                    ? 'bg-cyan-primary hover:bg-cyan-primary/90 cursor-pointer shadow-glow-cyan active:scale-95'
                    : 'bg-obsidian-border text-slate-subtle cursor-not-allowed'
                }`}
                title="Send Command"
                aria-label="Send Command"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-subtle" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-subtle px-1">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-primary shrink-0" />
                <span className="truncate">Real Historical Feeds & SQLite Memory</span>
              </div>
              <div className="hidden sm:block font-mono text-[10px]">
                Enter to submit • Shift+Enter for newline
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

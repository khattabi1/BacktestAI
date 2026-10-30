'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquare,
  ShieldCheck,
  Check,
  CheckCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { PostAuthor } from './CommunityStrategyCard';
import { fetchDirectMessages, sendDirectMessage } from '@/lib/api/community';


interface DirectMessagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetAuthor: PostAuthor | null;
}

interface Message {
  id: string;
  sender: 'me' | 'them';
  content: string;
  timestamp: string;
}

export function DirectMessagesDrawer({
  isOpen,
  onClose,
  targetAuthor,
}: DirectMessagesDrawerProps) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'them',
      content: 'Hey! Thanks for checking out my strategy. Are you testing it on Gold or FX majors?',
      timestamp: '10:42 AM',
    },
    {
      id: 'm2',
      sender: 'me',
      content: 'Hey! I looked at your 5Y verified drawdown (-6.8%) on XAUUSD M15, looks very stable. Does it use dynamic ATR trailing stop?',
      timestamp: '10:45 AM',
    },
    {
      id: 'm3',
      sender: 'them',
      content: 'Yes exactly! It scales out 50% at 1:1.5 RR, then activates a 1.2x ATR trailing stop so profits are locked before reversals.',
      timestamp: '10:46 AM',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && targetAuthor) {
      fetchDirectMessages('SeniorQuant', targetAuthor.username).then((backendMsgs: any) => {
        if (backendMsgs && backendMsgs.length > 0) {
          setMessages(
            backendMsgs.map((m: any) => ({
              id: m.id,
              sender: m.sender,
              content: m.content,
              timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }))
          );
        }
      });
    }
  }, [isOpen, targetAuthor]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  if (!isOpen || !targetAuthor) return null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText.trim();
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: 'me',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    sendDirectMessage('SeniorQuant', targetAuthor.username, content).catch(() => {});

    // Simulated reply after 1.5 seconds if local conversation
    setTimeout(() => {
      const replyMsg: Message = {
        id: `reply_${Date.now()}`,
        sender: 'them',
        content: 'Appreciate the question! You can fork the strategy directly to Quant Lab and test with your custom risk settings.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, replyMsg]);
    }, 1500);
  };


  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0B0F16] border-l border-[#1A2538] shadow-2xl flex flex-col font-sans select-none">
          {/* Drawer Top Header */}
          <div className="p-4 border-b border-[#182334] bg-[#0E1420] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={targetAuthor.avatarUrl}
                  alt={targetAuthor.displayName}
                  className="w-9 h-9 rounded-full object-cover border border-cyan-500/30"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#0B0F16]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  <span>{targetAuthor.displayName}</span>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">
                    @{targetAuthor.username}
                  </span>
                </h3>
                <p className="text-[10.5px] text-emerald-400 font-mono">
                  Online · Verified Creator
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#151D2A] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#080B10]">
            <div className="text-center py-2">
              <span className="px-2.5 py-1 rounded-full bg-[#111724] border border-[#1C2638] text-[10px] font-mono text-slate-500">
                End-to-end encrypted quant peer discussion
              </span>
            </div>

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'me' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.sender === 'me'
                      ? 'bg-cyan-500 text-slate-950 font-medium rounded-br-xs shadow-sm shadow-cyan-500/10'
                      : 'bg-[#121A28] text-slate-200 border border-[#1E2B3E] rounded-bl-xs'
                  }`}
                >
                  {m.content}
                </div>
                <div className="flex items-center gap-1 text-[9.5px] font-mono text-slate-500 mt-1 px-1">
                  <span>{m.timestamp}</span>
                  {m.sender === 'me' && <CheckCheck className="w-3 h-3 text-cyan-400" />}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Drawer Message Input Bar */}
          <div className="p-3 border-t border-[#182334] bg-[#0E1420]">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Message @${targetAuthor.username}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-[#090D14] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-500/50 font-sans"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { LineChart, BarChart2, Bot, Code2 } from 'lucide-react';

export type QuantMobileTab = 'results' | 'chart' | 'code' | 'agent';

interface QuantMobileNavProps {
  activeTab: QuantMobileTab;
  onTabChange: (tab: QuantMobileTab) => void;
  hasUnreadAgent?: boolean;
}

export function QuantMobileNav({
  activeTab,
  onTabChange,
  hasUnreadAgent = false,
}: QuantMobileNavProps) {
  const tabs = [
    {
      id: 'results' as QuantMobileTab,
      label: 'Test Results',
      shortLabel: 'Results',
      icon: LineChart,
      badge: null,
    },
    {
      id: 'chart' as QuantMobileTab,
      label: 'Test on Chart',
      shortLabel: 'Chart',
      icon: BarChart2,
      badge: null,
    },
    {
      id: 'code' as QuantMobileTab,
      label: 'Strategies',
      shortLabel: 'Strategies',
      icon: Code2,
      badge: null,
    },
    {
      id: 'agent' as QuantMobileTab,
      label: 'Quant AI Agent',
      shortLabel: 'Quant AI',
      icon: Bot,
      badge: hasUnreadAgent ? 'dot' : null,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#070B14]/95 backdrop-blur-2xl border-t border-[#162235] px-2 pt-1.5 shadow-[0_-8px_32px_rgba(0,0,0,0.6)] select-none"
      style={{ paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom))' }}
    >
      {/* Subtle ambient cyan top hairline */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

      <div className="w-full grid grid-cols-4 gap-1 items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center py-1 px-1 transition-all cursor-pointer min-h-[46px] group active:scale-95"
              title={tab.label}
            >
              {/* Modern Icon Capsule / Selection Pill */}
              <div
                className={`relative flex items-center justify-center px-3.5 py-1 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                    : 'bg-transparent border border-transparent text-slate-400 group-hover:text-slate-200 group-hover:bg-[#121A28]/50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-all duration-200 ${
                    isActive
                      ? 'scale-110 text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {tab.badge === 'dot' && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#070B14] shadow-[0_0_6px_rgba(34,211,238,0.8)] animate-pulse" />
                )}
              </div>

              {/* Tab Label */}
              <span
                className={`text-[10px] font-mono tracking-tight mt-1 leading-none truncate max-w-full transition-colors duration-200 ${
                  isActive
                    ? 'text-cyan-300 font-bold drop-shadow-[0_0_6px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 group-hover:text-slate-300'
                }`}
              >
                {tab.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

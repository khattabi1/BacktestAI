'use client';

import React, { useState } from 'react';

interface SymbolLogoProps {
  symbol: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function SymbolLogo({ symbol, size = 'sm', className = '' }: SymbolLogoProps) {
  const [imgError, setImgError] = useState(false);
  const clean = (symbol || '').toUpperCase().trim();

  // Determine size classes
  const sizeClasses = {
    xs: 'w-4 h-4 min-w-4 min-h-4 text-[8px]',
    sm: 'w-5 h-5 min-w-5 min-h-5 text-[9px]',
    md: 'w-6 h-6 min-w-6 min-h-6 text-[10px]',
    lg: 'w-8 h-8 min-w-8 min-h-8 text-xs',
  }[size];

  // Map known symbols to TradingView / AtomicLabs CDN vector logos
  const getCdnUrl = (sym: string): string | null => {
    if (sym.includes('XAU') || sym.includes('GOLD')) {
      return 'https://s3-symbol-logo.tradingview.com/metal/gold.svg';
    }
    if (sym.includes('BTC')) {
      return 'https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg';
    }
    if (sym.includes('ETH')) {
      return 'https://s3-symbol-logo.tradingview.com/crypto/XTVCETH.svg';
    }
    if (sym.includes('SOL')) {
      return 'https://s3-symbol-logo.tradingview.com/crypto/XTVCSOL.svg';
    }
    if (sym.includes('USDT') || sym === 'USDT') {
      return 'https://s3-symbol-logo.tradingview.com/crypto/XTVCUSDT.svg';
    }
    if (
      sym.includes('US30') ||
      sym.includes('DJI') ||
      sym.includes('DOW') ||
      sym.includes('US500') ||
      sym.includes('SPX') ||
      sym.includes('NAS100') ||
      sym.includes('NDX') ||
      sym.includes('US100')
    ) {
      return 'https://s3-symbol-logo.tradingview.com/country/US.svg';
    }
    if (sym.includes('EUR')) {
      return 'https://s3-symbol-logo.tradingview.com/country/EU.svg';
    }
    if (sym.includes('GBP')) {
      return 'https://s3-symbol-logo.tradingview.com/country/GB.svg';
    }
    if (sym.includes('JPY')) {
      return 'https://s3-symbol-logo.tradingview.com/country/JP.svg';
    }
    if (sym.includes('AUD')) {
      return 'https://s3-symbol-logo.tradingview.com/country/AU.svg';
    }
    if (sym.includes('CAD')) {
      return 'https://s3-symbol-logo.tradingview.com/country/CA.svg';
    }
    if (sym.includes('CHF')) {
      return 'https://s3-symbol-logo.tradingview.com/country/CH.svg';
    }
    if (sym.includes('USD')) {
      return 'https://s3-symbol-logo.tradingview.com/country/US.svg';
    }
    return null;
  };

  const cdnUrl = getCdnUrl(clean);

  // If CDN image loads successfully, render it
  if (cdnUrl && !imgError) {
    return (
      <div
        className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-[#0C121D] border border-[#1E2E44] shadow-sm ${className}`}
      >
        <img
          src={cdnUrl}
          alt={symbol}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // High-Quality Embedded Vector Fallbacks (Works offline / zero network delay)
  if (clean.includes('XAU') || clean.includes('GOLD')) {
    // Gold Ingot / Bullion SVG
    return (
      <div
        className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-600/30 border border-amber-500/40 shadow-sm text-amber-300 font-mono font-bold ${className}`}
        title="Gold (XAUUSD)"
      >
        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10l2-4h12l2 4-2 8H6l-2-8z" fill="#F59E0B" fillOpacity="0.4" stroke="#F59E0B" />
          <line x1="6" y1="6" x2="18" y2="6" stroke="#FBBF24" />
          <line x1="8" y1="10" x2="16" y2="10" stroke="#F59E0B" />
          <line x1="7" y1="14" x2="17" y2="14" stroke="#D97706" />
        </svg>
      </div>
    );
  }

  if (clean.includes('BTC')) {
    // Bitcoin SVG
    return (
      <div
        className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-orange-500/15 border border-orange-500/40 text-orange-400 font-mono font-bold ${className}`}
        title="Bitcoin (BTC)"
      >
        <span className="text-[10px] font-extrabold text-orange-400 leading-none">₿</span>
      </div>
    );
  }

  if (clean.includes('ETH')) {
    // Ethereum Diamond SVG
    return (
      <div
        className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-indigo-500/15 border border-indigo-500/40 text-indigo-400 font-mono font-bold ${className}`}
        title="Ethereum (ETH)"
      >
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current">
          <polygon points="12,2 4,14 12,18 20,14" opacity="0.9" />
          <polygon points="12,18 4,14 12,22 20,14" opacity="0.6" />
        </svg>
      </div>
    );
  }

  // Generic Currency / Ticker Badge
  return (
    <div
      className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-[#121A28] border border-[#1E2E44] text-cyan-300 font-mono font-bold tracking-tight ${className}`}
    >
      {clean.slice(0, 3)}
    </div>
  );
}

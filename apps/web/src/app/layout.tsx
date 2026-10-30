import type { Metadata } from 'next';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';

export const metadata: Metadata = {
  title: 'BacktestAI — Autonomous Quantitative Trading Agent & Smart Backtesting Platform',
  description: 'Institutional quant research platform powered by Meta Muse models, deterministic simulation, and MT5 Strategy Tester execution.',
  keywords: ['backtesting', 'quant', 'trading', 'forex', 'crypto', 'algorithmic trading', 'claude', 'polars'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-obsidian-base text-slate-text min-h-screen antialiased selection:bg-cyan-accent/20 selection:text-cyan-accent">
        <NextTopLoader
          color="#22D3EE"
          initialPosition={0.08}
          crawlSpeed={200}
          height={2.5}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #22D3EE,0 0 5px #22D3EE"
          zIndex={99999}
        />
        {children}
      </body>
    </html>
  );
}

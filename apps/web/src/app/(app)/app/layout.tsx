import type { Metadata } from 'next';
import { AppLayoutShell } from '@/components/layout/AppLayoutShell';

export const metadata: Metadata = {
  title: {
    template: '%s | BacktestAI Quant Research',
    default: 'Command Dashboard | BacktestAI',
  },
  description: 'Deterministic trading research, algorithmic backtesting, and quantitative strategy engineering.',
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayoutShell>{children}</AppLayoutShell>;
}

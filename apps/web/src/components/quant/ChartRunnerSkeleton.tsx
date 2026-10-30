'use client';

import React from 'react';
import { QuantLoader } from '@/components/common/QuantLoader';

interface ChartRunnerSkeletonProps {
  symbol?: string;
  timeframe?: string;
}

export function ChartRunnerSkeleton({
  symbol,
  timeframe,
}: ChartRunnerSkeletonProps) {
  return (
    <div className="w-full h-full relative flex items-center justify-center bg-[#080B10] select-none">
      <QuantLoader size="md" label="Loading..." />
    </div>
  );
}

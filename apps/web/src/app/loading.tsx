import React from 'react';

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B10]/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#202A38]" />
          <div className="absolute inset-0 rounded-full border-2 border-cyan-accent border-t-transparent animate-spin" />
        </div>
        <span className="text-[11px] font-mono tracking-widest text-cyan-accent uppercase">
          Loading Enclave...
        </span>
      </div>
    </div>
  );
}

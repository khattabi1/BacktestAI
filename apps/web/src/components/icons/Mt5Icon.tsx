import React from 'react';

export function Mt5Icon({
  className = 'w-3.5 h-3.5',
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <img
      src="/assets/metatrader-5.png"
      alt="MetaTrader 5"
      className={`${className} object-contain shrink-0 select-none inline-block`}
      draggable={false}
    />
  );
}

export default Mt5Icon;

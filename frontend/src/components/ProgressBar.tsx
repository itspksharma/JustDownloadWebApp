// ProgressBar.tsx
import React from "react";

export default function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value || 0) * 100)));

  return (
    <div className="w-full flex items-center gap-2">
      <div
        className="flex-1 bg-slate-200 rounded-2xl h-3 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-3 bg-sky-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-600 w-10 text-right">{pct}%</span>
    </div>
  );
}

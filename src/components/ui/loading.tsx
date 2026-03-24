"use client";

import { cn } from "@/lib/utils";

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("typing-indicator", className)}>
      <span />
      <span />
      <span />
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-brand-400",
        className
      )}
    />
  );
}

export function AnalysisLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/10 border-t-brand-500" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-pulse rounded-full bg-brand-500/20" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/80">
          Analisando com IA...
        </p>
        <p className="mt-1 text-xs text-white/40">
          Isso pode levar alguns segundos
        </p>
      </div>
    </div>
  );
}

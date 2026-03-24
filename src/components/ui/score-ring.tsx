"use client";

import { cn, getScoreColor, getScoreLabel } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function ScoreRing({
  score,
  size = "md",
  showLabel = true,
  className,
}: ScoreRingProps) {
  const sizeClasses = {
    sm: { outer: "h-16 w-16", inner: "h-12 w-12 text-lg" },
    md: { outer: "h-24 w-24", inner: "h-20 w-20 text-2xl" },
    lg: { outer: "h-32 w-32", inner: "h-28 w-28 text-3xl" },
  };

  const scoreColor =
    score >= 90
      ? "#22c55e"
      : score >= 70
        ? "#eab308"
        : score >= 50
          ? "#f97316"
          : "#ef4444";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full",
          sizeClasses[size].outer
        )}
        style={{
          background: `conic-gradient(${scoreColor} ${score * 3.6}deg, #2a2a3a ${score * 3.6}deg)`,
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-[#0a0a0f] font-bold",
            sizeClasses[size].inner
          )}
        >
          <span className={getScoreColor(score)}>{score}</span>
        </div>
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium", getScoreColor(score))}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}

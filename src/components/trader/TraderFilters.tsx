"use client";

import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

interface TraderFiltersProps {
  riskFilter: string;
  setRiskFilter: (value: string) => void;
  minScore: number;
  setMinScore: (value: number) => void;
}

const riskLevels = [
  { value: "all", label: "All Risk Levels" },
  { value: "low", label: "Low Risk" },
  { value: "medium", label: "Medium Risk" },
  { value: "high", label: "High Risk" },
];

export function TraderFilters({
  riskFilter,
  setRiskFilter,
  minScore,
  setMinScore,
}: TraderFiltersProps) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Filters
        </h3>
        <button
          onClick={() => {
            setRiskFilter("all");
            setMinScore(0);
          }}
          className="text-xs text-brand-500 hover:text-brand-400 transition-colors"
        >
          Reset All
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {riskLevels.map((level) => (
          <button
            key={level.value}
            onClick={() => setRiskFilter(level.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              riskFilter === level.value
                ? "bg-brand-600/20 text-brand-500 border border-brand-500/30"
                : "bg-surface-elevated text-muted-foreground border border-border hover:bg-surface",
            )}
          >
            {level.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Min AI Score</span>
          <span className="text-xs font-mono font-semibold">{minScore}</span>
        </div>
        <input
          type="range"
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          min={0}
          max={100}
          step={5}
          className="w-full accent-brand-500"
        />
      </div>
    </div>
  );
}

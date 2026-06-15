"use client";

import { cn, formatCSPR } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Position {
  id: string;
  traderName: string;
  pnl: string;
  pnlPercentage: number;
}

interface PnLDistributionProps {
  positions: Position[];
}

export function PnLDistribution({ positions }: PnLDistributionProps) {
  const profitable = positions.filter(
    (p) => BigInt(p.pnl || "0") >= 0n,
  ).length;
  const lossMaking = positions.length - profitable;
  const profitTotal = positions
    .filter((p) => BigInt(p.pnl || "0") > 0n)
    .reduce((sum, p) => sum + BigInt(p.pnl), 0n);
  const lossTotal = positions
    .filter((p) => BigInt(p.pnl || "0") < 0n)
    .reduce((sum, p) => sum + BigInt(p.pnl), 0n);

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
        No positions to analyze
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 rounded-lg bg-profit/5 border border-profit/20">
          <TrendingUp className="w-4 h-4 text-profit mx-auto mb-1" />
          <div className="text-lg font-bold font-mono text-profit">
            {profitable}
          </div>
          <div className="text-[10px] text-profit/70">Profitable</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-loss/5 border border-loss/20">
          <TrendingDown className="w-4 h-4 text-loss mx-auto mb-1" />
          <div className="text-lg font-bold font-mono text-loss">
            {lossMaking}
          </div>
          <div className="text-[10px] text-loss/70">Loss Making</div>
        </div>
      </div>

      {/* Bar visualization */}
      <div className="space-y-2">
        {positions.slice(0, 6).map((pos) => {
          const pnl = BigInt(pos.pnl || "0");
          const isPositive = pnl >= 0n;
          const maxAbsPnl = Math.max(
            ...positions.map((p) =>
              Number(BigInt(p.pnl || "0") > 0n ? BigInt(p.pnl) : -BigInt(p.pnl)),
            ),
            1,
          );
          const barWidth = Math.min(
            Math.abs(Number(pnl)) / maxAbsPnl * 100,
            100,
          );

          return (
            <div key={pos.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">
                  {pos.traderName}
                </span>
                <span
                  className={cn(
                    "font-mono font-medium",
                    isPositive ? "text-profit" : "text-loss",
                  )}
                >
                  {isPositive ? "+" : ""}
                  {formatCSPR(pos.pnl)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isPositive ? "bg-profit" : "bg-loss",
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {positions.length > 6 && (
        <p className="text-[10px] text-center text-muted-foreground">
          +{positions.length - 6} more positions
        </p>
      )}

      {/* Totals */}
      <div className="pt-2 border-t border-border space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-profit">Total Profit</span>
          <span className="font-mono text-profit">+{formatCSPR(profitTotal.toString())}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-loss">Total Loss</span>
          <span className="font-mono text-loss">{formatCSPR(lossTotal.toString())}</span>
        </div>
      </div>
    </div>
  );
}

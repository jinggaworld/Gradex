"use client";

import { cn, formatCSPR } from "@/lib/utils";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";

interface Trade {
  date: string;
  action: "buy" | "sell";
  token: string;
  amount: string;
  pnl: string;
  dex?: string;
}

interface TradeHistoryProps {
  trades: Trade[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6 text-center space-y-3">
        <Clock className="w-8 h-8 text-muted-foreground/50 mx-auto" />
        <p className="text-sm text-muted-foreground">
          No recent trade history available.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Trade history will appear once the trader executes trades on-chain.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 space-y-3">
      <h3 className="text-sm font-semibold">Recent Trades</h3>
      <div className="space-y-2">
        {trades.slice(0, 20).map((trade, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated/50 border border-border"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  trade.action === "buy"
                    ? "bg-profit/10"
                    : "bg-loss/10",
                )}
              >
                {trade.action === "buy" ? (
                  <TrendingUp className="w-4 h-4 text-profit" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-loss" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {trade.action.toUpperCase()} {trade.token}
                </p>
                <p className="text-xs text-muted-foreground">
                  {trade.dex ? `${trade.dex} • ` : ""}
                  {trade.date}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono">{formatCSPR(trade.amount)}</p>
              {trade.pnl && (
                <p
                  className={cn(
                    "text-xs font-mono",
                    BigInt(trade.pnl) >= 0n ? "text-profit" : "text-loss",
                  )}
                >
                  {BigInt(trade.pnl) >= 0n ? "+" : ""}
                  {formatCSPR(trade.pnl)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

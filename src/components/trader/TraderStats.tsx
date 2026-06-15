"use client";

import { cn, formatCSPR, formatPercentage } from "@/lib/utils";
import { TrendingUp, Shield, Activity, Globe } from "lucide-react";

interface TraderStatsProps {
  trader: {
    totalTrades: number;
    winRate: number;
    totalVolume: string;
    totalPnL: string;
    avgTradeSize: string;
    maxDrawdown: number;
    sharpeRatio: number;
    tradeFrequency: number;
    riskManagementScore: number;
    preferredDexes?: string[];
  };
}

interface StatRowProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

function StatRow({ label, value, icon, trend }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold font-mono",
          trend === "up" && "text-profit",
          trend === "down" && "text-loss",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TraderStats({ trader }: TraderStatsProps) {
  return (
    <div className="glass-card rounded-xl p-6 space-y-1">
      <h3 className="text-sm font-semibold mb-3">Performance Stats</h3>

      <StatRow
        label="Total Trades"
        value={trader.totalTrades.toString()}
        icon={<Activity className="w-3.5 h-3.5" />}
      />
      <StatRow
        label="Win Rate"
        value={`${trader.winRate}%`}
        icon={<Shield className="w-3.5 h-3.5" />}
        trend={trader.winRate >= 50 ? "up" : "down"}
      />
      <StatRow
        label="Total Volume"
        value={`${formatCSPR(trader.totalVolume)} CSPR`}
        icon={<TrendingUp className="w-3.5 h-3.5" />}
      />
      <StatRow
        label="Total PnL"
        value={`${formatCSPR(trader.totalPnL)} CSPR`}
        icon={<Activity className="w-3.5 h-3.5" />}
        trend={BigInt(trader.totalPnL || "0") >= 0n ? "up" : "down"}
      />
      <StatRow
        label="Avg Trade Size"
        value={`${formatCSPR(trader.avgTradeSize)} CSPR`}
        icon={<Activity className="w-3.5 h-3.5" />}
      />
      <StatRow
        label="Max Drawdown"
        value={`${trader.maxDrawdown}%`}
        icon={<Activity className="w-3.5 h-3.5" />}
        trend={trader.maxDrawdown > 30 ? "down" : "neutral"}
      />
      <StatRow
        label="Sharpe Ratio"
        value={trader.sharpeRatio.toFixed(2)}
        icon={<Activity className="w-3.5 h-3.5" />}
        trend={trader.sharpeRatio >= 1 ? "up" : "neutral"}
      />
      <StatRow
        label="Trade Frequency"
        value={`${trader.tradeFrequency}/day`}
        icon={<Activity className="w-3.5 h-3.5" />}
      />
      <StatRow
        label="Risk Management"
        value={`${trader.riskManagementScore}/100`}
        icon={<Shield className="w-3.5 h-3.5" />}
        trend={trader.riskManagementScore >= 70 ? "up" : trader.riskManagementScore >= 40 ? "neutral" : "down"}
      />

      {trader.preferredDexes && trader.preferredDexes.length > 0 && (
        <StatRow
          label="Preferred DEXes"
          value={trader.preferredDexes.join(", ")}
          icon={<Globe className="w-3.5 h-3.5" />}
        />
      )}
    </div>
  );
}

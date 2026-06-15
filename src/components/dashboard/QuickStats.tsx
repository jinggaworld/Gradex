"use client";

import { useWallet } from "@/hooks/useWallet";
import { formatCSPR } from "@/lib/utils";
import { TrendingUp, Users, Wallet, Activity } from "lucide-react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
}

function StatCard({ icon, label, value, subtext, trend }: StatCardProps) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-2 hover:border-brand-500/30 transition-all group">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend === "up"
                ? "text-profit"
                : trend === "down"
                  ? "text-loss"
                  : "text-muted-foreground"
            }`}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold font-mono">{value}</p>
      {subtext && (
        <p className="text-xs text-muted-foreground/60">{subtext}</p>
      )}
    </div>
  );
}

export function QuickStats() {
  const { balance, isConnected } = useWallet();

  const stats = [
    {
      icon: <Wallet className="w-4 h-4 text-brand-500" />,
      label: "Total Invested",
      value: isConnected ? formatCSPR(balance) : "—",
      subtext: "Across all vaults",
      trend: "neutral" as const,
    },
    {
      icon: <TrendingUp className="w-4 h-4 text-profit" />,
      label: "Current Value",
      value: isConnected ? formatCSPR(balance) : "—",
      subtext: "Floating PnL: —",
      trend: "up" as const,
    },
    {
      icon: <Activity className="w-4 h-4 text-yellow-400" />,
      label: "Total PnL",
      value: "—",
      subtext: "All time",
      trend: "neutral" as const,
    },
    {
      icon: <Users className="w-4 h-4 text-brand-500" />,
      label: "Active Positions",
      value: "0",
      subtext: "Copy trades running",
      trend: "neutral" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}

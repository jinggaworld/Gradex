"use client";

import { useState, useEffect, use } from "react";
import { useWallet } from "@/hooks/useWallet";
import { cn, formatCSPR } from "@/lib/utils";
import { SubscribeButton } from "@/components/trader/SubscribeButton";
import {
  BarChart3,
  Users,
  TrendingUp,
  Clock,
  Shield,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function VaultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { isConnected } = useWallet();
  const [vault, setVault] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVault();
  }, [resolvedParams.id]);

  async function fetchVault() {
    try {
      const res = await fetch(`/api/vaults/${resolvedParams.id}`);
      const data = await res.json();
      setVault(data.vault);
    } catch (error) {
      console.error("Failed to fetch vault:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-surface-elevated rounded w-1/3" />
          <div className="h-32 bg-surface-elevated rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-surface-elevated rounded-xl" />
            ))}
          </div>
          <div className="h-48 bg-surface-elevated rounded-xl" />
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center space-y-4">
        <p className="text-muted-foreground">Vault not found</p>
        <Link
          href="/traders"
          className="text-brand-500 hover:underline inline-block text-sm"
        >
          Browse traders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back Navigation */}
      <Link
        href="/traders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Traders
      </Link>

      {/* Vault Header */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{vault.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              by {vault.traderName}
              {vault.traderAddress && (
                <a
                  href={`https://testnet.cspr.live/account/${vault.traderAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-brand-500 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View
                </a>
              )}
            </p>
          </div>
          {isConnected && (
            <SubscribeButton
              traderAddress={vault.traderAddress}
              traderName={vault.traderName}
            />
          )}
        </div>
        {vault.description && (
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
            {vault.description}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Allocated",
            value: `${formatCSPR(vault.totalAllocated)} CSPR`,
            icon: BarChart3,
          },
          {
            label: "Followers",
            value: vault.totalFollowers.toString(),
            icon: Users,
          },
          {
            label: "30d ROI",
            value: `${vault.roi30d >= 0 ? "+" : ""}${(vault.roi30d || 0).toFixed(2)}%`,
            icon: TrendingUp,
            isGreen: vault.roi30d >= 0,
          },
          {
            label: "Fee",
            value: `${((vault.performanceFee || 0) / 100).toFixed(1)}%`,
            icon: Clock,
          },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <stat.icon className="w-3 h-3" />
              {stat.label}
            </div>
            <p
              className={cn(
                "text-lg font-bold font-mono",
                "isGreen" in stat && stat.isGreen !== undefined
                  ? stat.isGreen
                    ? "text-profit"
                    : "text-loss"
                  : "",
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Strategy & Details */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-500" />
          Strategy & Details
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Risk Level</p>
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
                vault.riskLevel === "low" && "bg-profit/10 text-profit",
                vault.riskLevel === "medium" &&
                  "bg-yellow-400/10 text-yellow-400",
                vault.riskLevel === "high" && "bg-loss/10 text-loss",
              )}
            >
              {(vault.riskLevel || "MEDIUM").toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Min Allocation</p>
            <p className="font-mono">{formatCSPR(vault.minAllocation)} CSPR</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Max Allocation</p>
            <p className="font-mono">
              {vault.maxAllocation
                ? `${formatCSPR(vault.maxAllocation)} CSPR`
                : "Unlimited"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Max Drawdown</p>
            <p className="font-mono">{vault.maxDrawdown || "50"}%</p>
          </div>
        </div>
        {vault.strategy && (
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              Strategy Description
            </p>
            <p className="text-sm leading-relaxed">{vault.strategy}</p>
          </div>
        )}
      </div>
    </div>
  );
}

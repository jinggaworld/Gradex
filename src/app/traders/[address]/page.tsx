"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TraderScoreCard } from "@/components/trader/TraderScoreCard";
import { SubscribeButton } from "@/components/trader/SubscribeButton";
import { TraderStats } from "@/components/trader/TraderStats";
import { TradeHistory } from "@/components/trader/TradeHistory";
import { ArrowLeft, ExternalLink, RefreshCw, Shield } from "lucide-react";
import { shortenAddress } from "@/lib/utils";

export default function TraderDetailPage() {
  const params = useParams();
  const address = params.address as string;
  const [trader, setTrader] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    fetchTraderData();
  }, [address]);

  async function fetchTraderData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/traders/${address}`);
      const data = await res.json();
      setTrader(data.trader);
      setScore(data.score);
    } catch (error) {
      console.error("Failed to fetch trader:", error);
    } finally {
      setLoading(false);
    }
  }

  async function triggerScoring() {
    setScoring(true);
    try {
      const res = await fetch("/api/traders/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          displayName: trader?.displayName,
        }),
      });
      const data = await res.json();
      if (data.score) setScore(data.score);
    } catch (error) {
      console.error("Scoring failed:", error);
    } finally {
      setScoring(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-surface-elevated rounded w-1/3" />
          <div className="h-24 bg-surface-elevated rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-surface-elevated rounded-xl" />
            <div className="h-80 bg-surface-elevated rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!trader) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center space-y-4">
        <p className="text-muted-foreground">Trader not found</p>
        <Link
          href="/traders"
          className="text-brand-500 hover:underline mt-2 inline-block"
        >
          Browse all traders
        </Link>
      </div>
    );
  }

  const displayName = trader.displayName || shortenAddress(trader.walletAddress);

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

      {/* Trader Header */}
      <div className="glass-card rounded-xl p-6 flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-2xl shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {trader.bio && (
              <p className="text-sm text-muted-foreground mt-1">{trader.bio}</p>
            )}
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {shortenAddress(trader.walletAddress, 8)}
              <a
                href={`https://testnet.cspr.live/account/${trader.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 text-brand-500 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Explorer
              </a>
            </p>
          </div>
        </div>
        <SubscribeButton
          traderAddress={address}
          traderName={displayName}
          disabled={score?.recommendation === "avoid"}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TraderStats trader={trader} />
          <TradeHistory trades={trader.recentTrades || []} />
        </div>

        <div className="space-y-4">
          {/* Score Card */}
          {score ? (
            <TraderScoreCard
              score={score.overallScore}
              riskLevel={score.riskLevel}
              recommendation={score.recommendation}
              reasoning={score.reasoning}
              redFlags={score.redFlags}
              strengths={score.strengths}
            />
          ) : (
            <div className="glass-card rounded-xl p-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Run AI reputation check to evaluate this trader
              </p>
              <button
                onClick={triggerScoring}
                disabled={scoring}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {scoring ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {scoring ? "Analyzing..." : "Run AI Check"}
              </button>
            </div>
          )}

          {/* Re-score Button */}
          {score && (
            <button
              onClick={triggerScoring}
              disabled={scoring}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg glass-card border border-border hover:bg-surface-elevated text-sm text-muted-foreground transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${scoring ? "animate-spin" : ""}`}
              />
              {scoring ? "Re-analyzing..." : "Refresh Score"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

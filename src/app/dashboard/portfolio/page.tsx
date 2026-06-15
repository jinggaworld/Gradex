"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { PortfolioChart } from "@/components/portfolio/PortfolioChart";
import { PnLDistribution } from "@/components/portfolio/PnLDistribution";
import { Wallet, PieChart } from "lucide-react";
import Link from "next/link";

export default function PortfolioPage() {
  const { isConnected, publicKey } = useWallet();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && publicKey) {
      fetchPortfolio();
    } else {
      setLoading(false);
    }
  }, [isConnected, publicKey]);

  async function fetchPortfolio() {
    try {
      const res = await fetch(`/api/portfolio?follower=${publicKey}`);
      const data = await res.json();
      setPortfolio(data);
    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Wallet className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          Connect Wallet to View Portfolio
        </h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-surface-elevated rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface-elevated rounded-xl" />
          ))}
        </div>
        <div className="h-72 bg-surface-elevated rounded-xl" />
        <div className="h-48 bg-surface-elevated rounded-xl" />
      </div>
    );
  }

  const positions = portfolio?.positions || [];
  const isEmpty = positions.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Portfolio</h1>

      {isEmpty ? (
        <div className="glass-card rounded-xl p-12 text-center space-y-4">
          <PieChart className="w-12 h-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">No Active Positions</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You haven&apos;t subscribed to any traders yet. Start by exploring
            top traders on Casper.
          </p>
          <Link
            href="/traders"
            className="inline-block px-6 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-all"
          >
            Explore Traders
          </Link>
        </div>
      ) : (
        <>
          {/* Portfolio Summary */}
          <PortfolioSummary
            totalInvested={portfolio.totalInvested}
            currentValue={portfolio.currentValue}
            totalPnL={portfolio.totalPnL}
            totalRoyaltiesPaid={portfolio.totalRoyaltiesPaid}
            activePositions={positions.length}
          />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">
                Portfolio Value Over Time
              </h3>
              <PortfolioChart data={portfolio.history} />
            </div>
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">
                PnL Distribution
              </h3>
              <PnLDistribution positions={positions} />
            </div>
          </div>

          {/* Positions Table */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Active Copy Positions</h3>
              <span className="text-xs text-muted-foreground">
                {positions.length} position
                {positions.length !== 1 ? "s" : ""}
              </span>
            </div>
            <PositionsTable
              positions={positions}
              onRefresh={fetchPortfolio}
            />
          </div>
        </>
      )}
    </div>
  );
}

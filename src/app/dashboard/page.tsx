"use client";

import { useWallet } from "@/hooks/useWallet";
import { Wallet, Users, Activity } from "lucide-react";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { CopyPositionsList } from "@/components/dashboard/CopyPositionsList";

export default function DashboardPage() {
  const { isConnected, connect, publicKey } = useWallet();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-brand-500" />
        </div>
        <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
        <p className="text-muted-foreground text-sm max-w-md text-center leading-relaxed">
          Connect your Casper Wallet to view your dashboard, manage copy trades,
          and track your portfolio performance.
        </p>
        <button
          onClick={connect}
          className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all shadow-lg shadow-brand-600/25"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {publicKey?.slice(0, 8)}...
        </p>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Performance Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Portfolio Performance</h3>
          <PerformanceChart />
        </div>
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-brand-600/10 hover:bg-brand-600/20 border border-brand-500/20 transition-all text-sm font-medium">
              <Users className="w-4 h-4 text-brand-500" />
              Find New Traders
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-elevated hover:bg-surface border border-border transition-all text-sm font-medium">
              <Wallet className="w-4 h-4" />
              Deposit to Vault
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-elevated hover:bg-surface border border-border transition-all text-sm font-medium">
              <Activity className="w-4 h-4" />
              View All Trades
            </button>
          </div>
        </div>
      </div>

      {/* Active Copy Positions */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Active Copy Positions</h3>
          <button className="text-xs text-brand-500 hover:text-brand-400 transition-colors font-medium">
            View All
          </button>
        </div>
        <CopyPositionsList />
      </div>
    </div>
  );
}

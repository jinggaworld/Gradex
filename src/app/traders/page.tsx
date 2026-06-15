"use client";

import { useState, useEffect, useCallback } from "react";
import { TraderCard } from "@/components/trader/TraderCard";
import { TraderFilters } from "@/components/trader/TraderFilters";
import { Search, SlidersHorizontal } from "lucide-react";

interface TraderSummary {
  walletAddress: string;
  displayName: string;
  reputationScore: number;
  totalVolume: string;
  winRate: number;
  totalFollowers: number;
  roi30d: number;
  riskLevel: string;
}

export default function TradersPage() {
  const [traders, setTraders] = useState<TraderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "volume" | "followers" | "roi">("score");
  const [riskFilter, setRiskFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const fetchTraders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy });
      if (riskFilter !== "all") params.set("riskLevel", riskFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/traders?${params}`);
      const data = await res.json();
      setTraders(data.traders || []);
    } catch (error) {
      console.error("Failed to fetch traders:", error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, riskFilter, search]);

  useEffect(() => {
    const debounce = setTimeout(fetchTraders, 300);
    return () => clearTimeout(debounce);
  }, [fetchTraders]);

  const filteredTraders = traders.filter(
    (t) => t.reputationScore >= minScore,
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Explore Traders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover top Casper traders verified by AI reputation scoring
        </p>
      </div>

      {/* Search & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or address..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg glass-card border border-border bg-transparent text-sm outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg glass-card border border-border hover:bg-surface-elevated transition-all text-sm shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2.5 rounded-lg glass-card border border-border bg-transparent text-sm outline-none focus:border-brand-500/50 shrink-0"
        >
          <option value="score">AI Score</option>
          <option value="volume">Volume</option>
          <option value="followers">Followers</option>
          <option value="roi">ROI (30d)</option>
        </select>
      </div>

      {/* Active Filters */}
      {showFilters && (
        <TraderFilters
          riskFilter={riskFilter}
          setRiskFilter={setRiskFilter}
          minScore={minScore}
          setMinScore={setMinScore}
        />
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-surface-elevated" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-surface-elevated rounded w-2/3" />
                  <div className="h-3 bg-surface-elevated rounded w-1/3" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-surface-elevated rounded" />
                <div className="h-3 bg-surface-elevated rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTraders.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <p className="text-muted-foreground">No traders found matching your criteria.</p>
          <p className="text-xs text-muted-foreground/60">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTraders.map((trader) => (
            <TraderCard key={trader.walletAddress} trader={trader} />
          ))}
        </div>
      )}
    </div>
  );
}

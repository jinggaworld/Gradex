"use client";

import { useState, useEffect, useRef } from "react";
import { cn, formatCSPR, shortenAddress } from "@/lib/utils";
import {
  Trophy,
  TrendingUp,
  Users,
  Shield,
  Medal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";

interface LeaderboardEntry {
  id: string;
  trader_address: string;
  display_name: string;
  rank: number;
  score: number;
  roi_30d: number;
  roi_7d: number;
  followers_count: number;
  volume_30d: string;
  win_rate: number;
  updated_at: string;
}

type TimeFilter = "all" | "7d" | "30d";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  const supabaseRef = useRef<any>(null);

  function getSupabase() {
    if (!supabaseRef.current) {
      // Lazy-initialize to avoid build-time env var issues
      const { createClient } = require("@/lib/supabase/client");
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }

  useEffect(() => {
    fetchLeaderboard();
    const unsubscribe = subscribeToUpdates();
    return unsubscribe;
  }, [timeFilter]);

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`/api/leaderboard?period=${timeFilter}`);
      const data = await res.json();

      // Store current ranks as previous for animation
      const prev: Record<string, number> = {};
      entries.forEach((e) => {
        prev[e.trader_address] = e.rank;
      });
      setPreviousRanks(prev);

      setEntries(data.entries || []);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }

  function subscribeToUpdates() {
    const supabase = getSupabase();
    const channel = supabase
      .channel("leaderboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaderboard" },
        () => {
          fetchLeaderboard();
        },
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }

  function getRankChange(
    traderAddress: string,
    currentRank: number,
  ): number | null {
    const prev = previousRanks[traderAddress];
    if (prev === undefined) return null;
    return prev - currentRank;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Trader Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top-performing traders ranked by AI composite score
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "7d", "30d"] as TimeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                timeFilter === f
                  ? "bg-brand-600/20 text-brand-500 border border-brand-500/30"
                  : "bg-surface-elevated text-muted-foreground border border-border hover:text-foreground",
              )}
            >
              {f === "all" ? "All Time" : f === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-card/50">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium w-16">
                  Rank
                </th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                  Trader
                </th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                  Score
                </th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                  ROI
                </th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                  Win Rate
                </th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                  Followers
                </th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                  Volume
                </th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={7} className="py-4 px-4">
                        <div className="h-8 bg-surface-elevated rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                : entries.map((entry, index) => {
                    const rankChange = getRankChange(
                      entry.trader_address,
                      entry.rank,
                    );
                    const isTop3 = entry.rank <= 3;

                    return (
                      <tr
                        key={entry.id}
                        className={cn(
                          "border-b border-border/50 transition-colors",
                          isTop3
                            ? "hover:bg-yellow-500/5"
                            : "hover:bg-surface-elevated/50",
                          index < 3 &&
                            "bg-gradient-to-r from-yellow-500/[0.03] to-transparent",
                        )}
                      >
                        {/* Rank */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            {isTop3 ? (
                              <Medal
                                className={cn(
                                  "w-5 h-5",
                                  entry.rank === 1 && "text-yellow-400",
                                  entry.rank === 2 && "text-gray-400",
                                  entry.rank === 3 && "text-amber-600",
                                )}
                              />
                            ) : (
                              <span className="font-mono text-muted-foreground w-5 text-center text-sm">
                                {entry.rank}
                              </span>
                            )}
                            {rankChange !== null && rankChange !== 0 && (
                              <span
                                className={cn(
                                  "flex items-center text-[10px]",
                                  rankChange > 0 ? "text-profit" : "text-loss",
                                )}
                              >
                                {rankChange > 0 ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )}
                                {Math.abs(rankChange)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Trader */}
                        <td className="py-4 px-4">
                          <Link
                            href={`/traders/${entry.trader_address}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-xs group-hover:bg-brand-500/20 transition-colors shrink-0">
                              {entry.display_name
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium group-hover:text-brand-500 transition-colors truncate">
                                {entry.display_name}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {shortenAddress(entry.trader_address)}
                              </p>
                            </div>
                          </Link>
                        </td>

                        {/* Score */}
                        <td className="py-4 px-4 text-right">
                          <span
                            className={cn(
                              "font-bold font-mono",
                              entry.score >= 70
                                ? "text-profit"
                                : entry.score >= 40
                                  ? "text-yellow-400"
                                  : "text-loss",
                            )}
                          >
                            {entry.score.toFixed(1)}
                          </span>
                        </td>

                        {/* ROI */}
                        <td className="py-4 px-4 text-right">
                          <span
                            className={cn(
                              "font-mono font-medium",
                              entry.roi_30d >= 0
                                ? "text-profit"
                                : "text-loss",
                            )}
                          >
                            {entry.roi_30d >= 0 ? "+" : ""}
                            {entry.roi_30d.toFixed(2)}%
                          </span>
                        </td>

                        {/* Win Rate */}
                        <td className="py-4 px-4 text-right font-mono">
                          {entry.win_rate.toFixed(1)}%
                        </td>

                        {/* Followers */}
                        <td className="py-4 px-4 text-right font-mono">
                          {entry.followers_count}
                        </td>

                        {/* Volume */}
                        <td className="py-4 px-4 text-right font-mono text-xs">
                          {formatCSPR(entry.volume_30d)}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <Shield className="w-3 h-3" />
          Updated in real-time via Supabase Realtime
        </span>
        <span>
          {entries.length} traders ranked
          {entries.length > 0 && (
            <>
              {" · "}Last updated:{" "}
              {new Date(entries[0].updated_at).toLocaleTimeString()}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

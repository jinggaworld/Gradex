import { createClient } from "./client";

export interface LeaderboardEntry {
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

export async function getLeaderboard(
  period: "all" | "7d" | "30d" = "all",
  limit = 100
): Promise<LeaderboardEntry[]> {
  const supabase = createClient();

  const orderColumn =
    period === "7d" ? "roi_7d" : period === "30d" ? "roi_30d" : "rank";

  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order(orderColumn, { ascending: orderColumn === "rank" })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch leaderboard:", error);
    return [];
  }

  return (data || []) as LeaderboardEntry[];
}

export function subscribeToLeaderboard(
  callback: (payload: any) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel("leaderboard-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "leaderboard" },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

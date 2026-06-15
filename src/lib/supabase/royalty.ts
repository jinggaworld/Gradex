import { createClient } from "./client";

export interface DbRoyaltyPayment {
  id: string;
  payment_id: number;
  trader_address: string;
  follower_address: string;
  vault_id: string;
  profit_amount: string;
  royalty_amount: string;
  royalty_rate_bps: number;
  transaction_hash: string | null;
  payment_method: "x402" | "onchain";
  paid_at: string;
}

export interface DbTraderPayout {
  id: string;
  trader_address: string;
  total_earned: string;
  total_payments: number;
  avg_royalty_rate: number;
  last_payout_at: string | null;
  updated_at: string;
}

/**
 * Fetch royalty payments for a specific trader.
 */
export async function getTraderRoyalties(
  traderAddress: string,
  options?: { limit?: number; offset?: number },
): Promise<DbRoyaltyPayment[]> {
  const supabase = createClient();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from("royalty_payments")
    .select("*")
    .eq("trader_address", traderAddress)
    .order("paid_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Failed to fetch trader royalties:", error);
    return [];
  }

  return (data || []) as DbRoyaltyPayment[];
}

/**
 * Fetch royalty payments made by a specific follower.
 */
export async function getFollowerRoyalties(
  followerAddress: string,
): Promise<DbRoyaltyPayment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("royalty_payments")
    .select("*")
    .eq("follower_address", followerAddress)
    .order("paid_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch follower royalties:", error);
    return [];
  }

  return (data || []) as DbRoyaltyPayment[];
}

/**
 * Get aggregated royalty stats for a trader.
 */
export async function getTraderRoyaltyStats(
  traderAddress: string,
): Promise<{
  totalRoyaltiesEarned: string;
  totalRoyaltiesPaid: string;
  paymentCount: number;
  averageRoyaltyPerFollower: string;
}> {
  const supabase = createClient();

  const { data: payments, error } = await supabase
    .from("royalty_payments")
    .select("royalty_amount, follower_address")
    .eq("trader_address", traderAddress);

  if (error || !payments) {
    console.error("Failed to fetch royalty stats:", error);
    return {
      totalRoyaltiesEarned: "0",
      totalRoyaltiesPaid: "0",
      paymentCount: 0,
      averageRoyaltyPerFollower: "0",
    };
  }

  const total = payments.reduce(
    (sum, p) => sum + BigInt(p.royalty_amount || "0"),
    0n,
  );

  const uniqueFollowers = new Set(payments.map((p) => p.follower_address)).size;

  return {
    totalRoyaltiesEarned: total.toString(),
    totalRoyaltiesPaid: payments.length.toString(),
    paymentCount: payments.length,
    averageRoyaltyPerFollower:
      uniqueFollowers > 0
        ? (total / BigInt(uniqueFollowers)).toString()
        : "0",
  };
}

/**
 * Get or create a trader's payout record.
 */
export async function getTraderPayout(
  traderAddress: string,
): Promise<DbTraderPayout | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("trader_payouts")
    .select("*")
    .eq("trader_address", traderAddress)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Failed to fetch trader payout:", error);
    return null;
  }

  return data as DbTraderPayout;
}

/**
 * Subscribe to real-time royalty payment updates for a trader.
 */
export function subscribeToRoyalties(
  traderAddress: string,
  callback: (payload: any) => void,
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`royalties-${traderAddress}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "royalty_payments",
        filter: `trader_address=eq.${traderAddress}`,
      },
      callback,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

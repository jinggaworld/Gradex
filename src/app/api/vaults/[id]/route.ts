import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/vaults/[id]
 *
 * Returns vault details including trader info, stats, and strategy.
 * Falls back to mock data if no Supabase connection.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: vaultId } = await params;

  if (!vaultId) {
    return NextResponse.json({ error: "Vault ID is required" }, { status: 400 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: vault, error } = await supabase
        .from("vaults")
        .select(
          `
          *,
          traders:trader_address (display_name)
        `,
        )
        .eq("id", vaultId)
        .single();

      if (!error && vault) {
        return NextResponse.json({
          vault: {
            id: vault.id,
            name: vault.name,
            description: vault.description,
            traderAddress: vault.trader_address,
            traderName: vault.traders?.display_name || vault.trader_address?.slice(0, 8),
            totalAllocated: vault.total_allocated || "0",
            totalFollowers: vault.total_followers || 0,
            minAllocation: vault.min_allocation || "0",
            maxAllocation: vault.max_allocation,
            performanceFee: vault.performance_fee || 0,
            subscriptionFee: vault.subscription_fee || "0",
            riskLevel: vault.risk_level || "medium",
            strategy: vault.strategy,
            roi30d: vault.roi_30d || 0,
            roi7d: vault.roi_7d || 0,
            maxDrawdown: vault.drawdown || 50,
            isActive: vault.is_active,
          },
        });
      }
    }

    // Fallback mock data
    return NextResponse.json({
      vault: {
        id: vaultId,
        name: "Gradex Alpha Vault",
        description: "A carefully managed copy trading vault focused on Casper Network DEX opportunities.",
        traderAddress: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        traderName: "Alpha Trader",
        totalAllocated: "5000000000000",
        totalFollowers: 42,
        minAllocation: "100000000000",
        maxAllocation: "100000000000000",
        performanceFee: 200,
        subscriptionFee: "1000000000",
        riskLevel: "medium",
        strategy: "Focuses on high-liquidity CSPR pairs on Friendly Market DEX. Uses trend-following with strict stop-losses at 5% drawdown per trade.",
        roi30d: 12.5,
        roi7d: 3.2,
        maxDrawdown: 50,
        isActive: true,
      },
    });
  } catch (error) {
    console.error("[Vault API] Error:", error);

    return NextResponse.json({
      vault: {
        id: vaultId,
        name: "Unknown Vault",
        description: null,
        traderAddress: "",
        traderName: "Unknown",
        totalAllocated: "0",
        totalFollowers: 0,
        minAllocation: "0",
        maxAllocation: null,
        performanceFee: 200,
        subscriptionFee: "0",
        riskLevel: "medium",
        strategy: null,
        roi30d: 0,
        roi7d: 0,
        maxDrawdown: 50,
        isActive: false,
      },
    });
  }
}

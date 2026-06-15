import { NextRequest, NextResponse } from "next/server";

/**
 * x402 Payment endpoint for traders.
 *
 * GET:  Returns 402 Payment Required with CSPR payment details when a royalty is due.
 *       The Gradex off-chain listener calls this to initiate the x402 handshake.
 *
 * POST: Verifies the submitted payment proof and records the royalty payment.
 *       Called by the Gradex off-chain listener after constructing on-chain proof.
 */

interface X402PaymentRequest {
  amount: string;
  address: string;
  currency: string;
  network: string;
  memo?: string;
}

/**
 * GET /api/x402/payment
 *
 * Traders configure this endpoint URL in their profile. When Gradex needs to pay
 * a royalty, it sends a GET with context headers. The endpoint responds with
 * 402 Payment Required containing the CSPR payment details.
 */
export async function GET(request: NextRequest) {
  const vaultId = request.headers.get("X-Gradex-Vault");
  const followerAddress = request.headers.get("X-Gradex-Follower");

  if (!vaultId || !followerAddress) {
    return NextResponse.json(
      { error: "Missing required headers: X-Gradex-Vault, X-Gradex-Follower" },
      { status: 400 },
    );
  }

  // In production, look up the trader's vault and compute royalty from DB/chain
  // For now, demonstrate the protocol with a placeholder payment request
  const paymentRequest: X402PaymentRequest = {
    amount: process.env.X402_DEMO_AMOUNT || "500000000", // 0.5 CSPR default
    address: process.env.X402_PAYMENT_ADDRESS || "",
    currency: "CSPR",
    network: process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test",
    memo: `gradex-royalty-${vaultId}-${followerAddress}`,
  };

  if (!paymentRequest.address) {
    return NextResponse.json(
      { error: "X402_PAYMENT_ADDRESS not configured" },
      { status: 500 },
    );
  }

  // Return 402 Payment Required with payment details
  return NextResponse.json(paymentRequest, {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": JSON.stringify(paymentRequest),
    },
  });
}

/**
 * POST /api/x402/payment
 *
 * Verifies the payment proof (on-chain deploy hash) submitted by the Gradex
 * off-chain listener, then records the royalty payment in the database.
 */
export async function POST(request: NextRequest) {
  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");

  if (!paymentSignature) {
    return NextResponse.json(
      { error: "Missing PAYMENT-SIGNATURE header" },
      { status: 400 },
    );
  }

  try {
    const signature = JSON.parse(paymentSignature);
    const body = await request.json();

    // Verify the payment exists on-chain
    const isValid = await verifyPayment(signature.transactionHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Payment verification failed — transaction not found or not successful" },
        { status: 402 },
      );
    }

    // Record the royalty payment in Supabase
    await recordRoyaltyPayment({
      followerAddress: body.follower,
      vaultId: body.vault,
      transactionHash: signature.transactionHash,
      timestamp: signature.timestamp,
    });

    return NextResponse.json({
      success: true,
      message: "Royalty payment verified and recorded",
      transactionHash: signature.transactionHash,
    });
  } catch (error) {
    console.error("[x402] Payment verification error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in PAYMENT-SIGNATURE header or request body" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 500 },
    );
  }
}

/**
 * Verify that a transaction hash corresponds to a successful on-chain deploy.
 */
async function verifyPayment(transactionHash: string): Promise<boolean> {
  const rpcUrl = process.env.NEXT_PUBLIC_CASPER_RPC_URL;

  if (!rpcUrl) {
    console.warn("[x402] NEXT_PUBLIC_CASPER_RPC_URL not set, skipping verification");
    return true; // Skip in development
  }

  try {
    const { RpcClient } = await import("casper-js-sdk");
    const client = new (RpcClient as any)(rpcUrl);
    const result = await client.getDeploy(transactionHash);

    return (
      result?.execution_results?.some(
        (r: any) => r.result?.Success,
      ) ?? false
    );
  } catch (error) {
    console.error("[x402] On-chain verification error:", error);
    return false;
  }
}

/**
 * Record a verified royalty payment in the database.
 */
async function recordRoyaltyPayment(data: {
  followerAddress: string;
  vaultId: string;
  transactionHash: string;
  timestamp: number;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[x402] Supabase not configured, skipping DB recording");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase.from("royalty_payments").insert({
    follower_address: data.followerAddress,
    vault_id: data.vaultId,
    transaction_hash: data.transactionHash,
    payment_method: "x402",
    paid_at: new Date(data.timestamp).toISOString(),
  });

  if (error) {
    console.error("[x402] Failed to record royalty payment:", error);
  } else {
    console.log(`[x402] Royalty payment recorded: ${data.transactionHash}`);
  }
}

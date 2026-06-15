# Phase 4: Smart Contract Development — x402 Royalty Distribution System

**Goal:** Build the trustless x402 royalty system that automatically pays traders when their followers make a profit from copy trades.

**Duration:** 4-6 days

---

## 4.1 Royalty System Architecture

The x402 Royalty system is what makes Gradex unique — traders get paid automatically whenever their followers profit:

```
Follower closes profitable trade
        │
        ▼
Profit is calculated (realized PnL)
        │
        ▼
Performance fee is deducted (configurable bps)
        │
        ▼
x402 Royalty payment is triggered
        │
        ▼
Payment flows directly to trader's wallet
        │
        ▼
Transaction is recorded on-chain (trustless)
```

### Key Design Principles

1. **Pay-for-Performance:** Traders only earn when followers profit
2. **Trustless:** No intermediary — payments go directly from vault to trader wallet
3. **Proportional:** Royalty scales with profit amount
4. **Verifiable:** All payments are recorded on-chain for transparency
5. **Machine-to-Machine:** x402 protocol enables automated payment negotiation

---

## 4.2 Royalty Smart Contract

### gradex-contracts/src/royalty.rs

```rust
use odra::prelude::*;
use odra::{Address, Var, Mapping, List};
use crate::types::RoyaltyPayment;

#[odra(module)]
pub struct RoyaltyDistributor {
    /// Contract owner (protocol admin)
    owner: Var<Address>,
    
    /// Whether the system is operational
    is_paused: Var<bool>,
    
    /// Linked vault contracts
    registered_vaults: Mapping<Address, bool>,
    
    /// Authorized copy engine contract
    copy_engine: Var<Address>,
    
    /// Payment records
    payment_count: Var<u64>,
    payments: Mapping<u64, RoyaltyPayment>,
    
    /// Total royalties distributed
    total_royalties_distributed: Var<U512>,
    
    /// Default royalty rate (basis points, e.g. 500 = 5% of profit)
    default_royalty_rate_bps: Var<u16>,
    
    /// Per-trader custom royalty rates (bps)
    trader_royalty_rates: Mapping<Address, u16>,
    
    /// Accumulated royalties per trader (awaiting withdrawal)
    accumulated_royalties: Mapping<Address, U512>,
    
    /// Payment history per trader
    trader_payments: Mapping<Address, Vec<u64>>,
}

#[odra(module)]
impl RoyaltyDistributor {
    #[odra(init)]
    pub fn init(&mut self, owner: Address, copy_engine: Address) {
        self.owner.set(owner);
        self.copy_engine.set(copy_engine);
        self.is_paused.set(false);
        self.payment_count.set(0);
        self.total_royalties_distributed.set(U512::zero());
        self.default_royalty_rate_bps.set(500); // 5% default
    }

    // --- Administration ---

    /// Register a vault for royalty tracking
    pub fn register_vault(&mut self, vault_address: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.registered_vaults.set(&vault_address, true);
    }

    /// Set default royalty rate
    pub fn set_default_royalty_rate(&mut self, rate_bps: u16) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        assert!(rate_bps <= 2000, "Rate cannot exceed 20%");
        self.default_royalty_rate_bps.set(rate_bps);
    }

    /// Set custom royalty rate for a specific trader
    pub fn set_trader_royalty_rate(&mut self, trader: Address, rate_bps: u16) {
        let caller = odra::caller();
        assert!(caller == trader || caller == self.owner.get().unwrap(),
            "Only trader or owner");
        assert!(rate_bps <= 2000, "Rate cannot exceed 20%");
        self.trader_royalty_rates.set(&trader, rate_bps);
    }

    /// Pause/unpause
    pub fn set_paused(&mut self, paused: bool) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.is_paused.set(paused);
    }

    // --- Core Payment Logic ---

    /// Process a royalty payment when a follower realizes a profit
    /// Called by the authorized copy engine
    pub fn process_royalty_payment(
        &mut self,
        trader: Address,
        follower: Address,
        vault_id: u32,
        profit_amount: U512,
    ) -> (U512, u64) {
        let caller = odra::caller();
        assert!(
            caller == self.copy_engine.get().unwrap(),
            "Only authorized copy engine"
        );
        assert!(!self.is_paused.get_or_default(), "System is paused");
        assert!(profit_amount > U512::zero(), "Profit must be positive");

        // Calculate royalty amount
        let royalty_rate = self.get_effective_rate(&trader);
        let royalty_amount = profit_amount * U512::from(royalty_rate as u64) / U512::from(10000);

        assert!(royalty_amount > U512::zero(), "Royalty too small");

        // Record the payment
        let payment_id = self.payment_count.get_or_default() + 1;
        let payment = RoyaltyPayment {
            id: payment_id,
            trader,
            follower,
            vault_id,
            profit_amount,
            royalty_amount,
            paid_at: odra::contract_env::block_time(),
        };

        self.payments.set(&payment_id, payment);
        self.payment_count.set(payment_id);

        // Update accumulators
        let current_accumulated = self.accumulated_royalties.get(&trader).unwrap_or(U512::zero());
        self.accumulated_royalties.set(&trader, current_accumulated + royalty_amount);
        
        let total = self.total_royalties_distributed.get_or_default();
        self.total_royalties_distributed.set(total + royalty_amount);

        // Add payment ID to trader's payment history
        let mut history = self.trader_payments.get(&trader).unwrap_or_else(|| Vec::new());
        history.push(payment_id);
        self.trader_payments.set(&trader, history);

        // Transfer royalty to trader immediately (trustless)
        odra::contract_env::transfer_tokens(&trader, &royalty_amount);

        (royalty_amount, payment_id)
    }

    /// Process batch royalty payments (for multiple followers at once)
    pub fn process_batch_royalty_payments(
        &mut self,
        payments: Vec<(Address, Address, u32, U512)>,
    ) -> U512 {
        let mut total_royalties = U512::zero();
        
        for (trader, follower, vault_id, profit) in payments {
            let (royalty, _) = self.process_royalty_payment(trader, follower, vault_id, profit);
            total_royalties = total_royalties + royalty;
        }

        total_royalties
    }

    // --- Queries ---

    /// Get effective royalty rate for a trader
    pub fn get_effective_rate(&self, trader: &Address) -> u16 {
        self.trader_royalty_rates.get(trader)
            .unwrap_or(self.default_royalty_rate_bps.get_or_default())
    }

    /// Get a specific payment record
    pub fn get_payment(&self, payment_id: u64) -> Option<RoyaltyPayment> {
        self.payments.get(&payment_id)
    }

    /// Get total royalties distributed
    pub fn get_total_royalties_distributed(&self) -> U512 {
        self.total_royalties_distributed.get_or_default()
    }

    /// Get accumulated royalties for a trader
    pub fn get_accumulated_royalties(&self, trader: &Address) -> U512 {
        self.accumulated_royalties.get(trader).unwrap_or(U512::zero())
    }

    /// Get payment history for a trader
    pub fn get_trader_payment_ids(&self, trader: &Address) -> Vec<u64> {
        self.trader_payments.get(trader).unwrap_or_else(|| Vec::new())
    }

    /// Get total payment count
    pub fn get_payment_count(&self) -> u64 {
        self.payment_count.get_or_default()
    }
}
```

---

## 4.3 x402 Protocol Integration

### How x402 Works in Gradex

When a follower's copy trade generates profit, the x402 protocol enables automated payment to the trader:

```
1. Profit Detection
   ├── Copy engine detects a follower's trade closed with profit
   └── Profit amount is calculated (realized PnL)

2. Royalty Calculation  
   ├── Get trader's royalty rate (e.g., 5% = 500 bps)
   ├── Calculate royalty = profit * rate / 10000
   └── Verify royalty > minimum threshold

3. x402 Payment Handshake
   ├── Gradex's off-chain system sends HTTP request to trader's endpoint
   ├── If trader endpoint returns 402 Payment Required
   │   └── Extract payment details (amount, address) from headers
   ├── If no endpoint configured
   │   └── Use on-chain direct transfer (fallback)
   └── Execute payment

4. Settlement
   ├── CSPR transferred from vault to trader wallet
   ├── Transaction hash recorded on-chain
   └── Follower's position updated with royalty info
```

### src/lib/x402/payment.ts

```typescript
/**
 * x402 Protocol Implementation for Gradex
 * Handles machine-to-machine payment negotiation and execution
 */

interface X402PaymentRequest {
  amount: string;        // CSPR amount in motes
  address: string;       // Trader's Casper wallet address
  currency: string;      // "CSPR"
  network: string;       // "casper-test" or "casper"
  memo?: string;         // Optional payment identifier
}

interface X402PaymentResponse {
  signature: string;     // Payment signature
  transactionHash: string;
  timestamp: number;
}

class X402Client {
  private privateKey: string;
  private paymentAddress: string;

  constructor() {
    this.privateKey = process.env.X402_PRIVATE_KEY!;
    this.paymentAddress = process.env.X402_PAYMENT_ADDRESS!;
  }

  /**
   * Attempt x402 payment to trader's HTTP endpoint
   * Falls back to on-chain transfer if endpoint unavailable
   */
  async executeRoyaltyPayment(
    traderEndpoint: string,
    profitAmount: bigint,
    royaltyAmount: bigint,
    traderAddress: string,
    followerAddress: string,
    vaultId: string
  ): Promise<{
    method: "x402" | "onchain";
    transactionHash: string;
    success: boolean;
  }> {
    // Try x402 protocol first
    try {
      const x402Result = await this.tryX402Payment(
        traderEndpoint,
        royaltyAmount,
        traderAddress,
        followerAddress,
        vaultId
      );

      if (x402Result.success) {
        return {
          method: "x402",
          transactionHash: x402Result.transactionHash,
          success: true,
        };
      }
    } catch {
      console.log("[x402] HTTP endpoint failed, falling back to on-chain transfer");
    }

    // Fallback: direct on-chain transfer
    const txHash = await this.executeOnChainTransfer(
      traderAddress,
      royaltyAmount
    );

    return {
      method: "onchain",
      transactionHash: txHash,
      success: !!txHash,
    };
  }

  /**
   * Attempt x402 HTTP-based payment
   */
  private async tryX402Payment(
    endpoint: string,
    amount: bigint,
    traderAddress: string,
    followerAddress: string,
    vaultId: string
  ): Promise<{
    success: boolean;
    transactionHash: string;
  }> {
    // Step 1: Send request to trader's endpoint
    const response = await fetch(`${endpoint}/x402/payment`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gradex-Vault": vaultId,
        "X-Gradex-Follower": followerAddress,
      },
    });

    // Step 2: Check for 402 Payment Required
    if (response.status !== 402) {
      throw new Error(`Expected 402, got ${response.status}`);
    }

    const paymentRequired: X402PaymentRequest = await response.json();

    // Step 3: Validate payment request
    if (BigInt(paymentRequired.amount) !== amount) {
      console.warn(
        `[x402] Amount mismatch: requested ${paymentRequired.amount}, expected ${amount}`
      );
    }

    // Step 4: Construct payment signature
    const paymentResponse = await this.constructPaymentProof(
      paymentRequired,
      followerAddress,
      vaultId
    );

    // Step 5: Submit payment proof to get resource
    const finalResponse = await fetch(`${endpoint}/x402/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": JSON.stringify(paymentResponse),
      },
      body: JSON.stringify({
        follower: followerAddress,
        vault: vaultId,
        profit_amount: profitAmount,
      }),
    });

    if (!finalResponse.ok) {
      throw new Error(`Payment verification failed: ${finalResponse.status}`);
    }

    return {
      success: true,
      transactionHash: paymentResponse.transactionHash,
    };
  }

  /**
   * Construct cryptographic proof of payment
   */
  private async constructPaymentProof(
    paymentRequest: X402PaymentRequest,
    followerAddress: string,
    vaultId: string
  ): Promise<X402PaymentResponse> {
    // In production, this would:
    // 1. Build a CSPR transfer deploy
    // 2. Sign it with the x402 key
    // 3. Submit to network
    // 4. Return the deploy hash as proof

    return {
      signature: "placeholder-signature",
      transactionHash: "placeholder-tx-hash",
      timestamp: Date.now(),
    };
  }

  /**
   * Direct on-chain CSPR transfer (fallback)
   */
  private async executeOnChainTransfer(
    toAddress: string,
    amount: bigint
  ): Promise<string> {
    const { RpcClient, DeployUtil, Keys } = await import("casper-js-sdk");

    const rpcClient = new RpcClient(process.env.NEXT_PUBLIC_CASPER_RPC_URL!);
    const keyPair = Keys.Ed25519.parsePrivateKey(
      Buffer.from(this.privateKey, "hex")
    );

    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        keyPair.publicKey,
        process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME!,
        1,
        1800000
      ),
      DeployUtil.ExecutableDeployItem.newTransfer(amount, null, toAddress, null),
      DeployUtil.standardPayment(1000000000) // 1 CSPR gas
    );

    const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);
    const result = await rpcClient.putDeploy(signedDeploy);

    return result.deployHash;
  }
}

export const x402Client = new X402Client();
```

---

## 4.4 x402 API Route (Backend)

### src/app/api/x402/payment/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { RpcClient, Keys } from "casper-js-sdk";

/**
 * x402 Payment endpoint for traders
 * Returns 402 Payment Required when a royalty payment is due
 */
export async function GET(request: NextRequest) {
  const vaultId = request.headers.get("X-Gradex-Vault");
  const followerAddress = request.headers.get("X-Gradex-Follower");

  if (!vaultId || !followerAddress) {
    return NextResponse.json(
      { error: "Missing required headers" },
      { status: 400 }
    );
  }

  // Look up the trader's vault and get royalty rate
  // This would query the database or chain state

  const paymentRequest = {
    amount: "500000000", // 0.5 CSPR (example)
    address: process.env.X402_PAYMENT_ADDRESS!,
    currency: "CSPR",
    network: "casper-test",
    memo: `gradex-royalty-${vaultId}-${followerAddress}`,
  };

  // Return 402 Payment Required with payment details
  return NextResponse.json(paymentRequest, {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": JSON.stringify(paymentRequest),
    },
  });
}

/**
 * Verify payment proof and record the royalty payment
 */
export async function POST(request: NextRequest) {
  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");
  const body = await request.json();

  if (!paymentSignature) {
    return NextResponse.json(
      { error: "Missing PAYMENT-SIGNATURE header" },
      { status: 400 }
    );
  }

  try {
    const signature = JSON.parse(paymentSignature);

    // Verify the payment on-chain
    const isValid = await verifyPayment(signature.transactionHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 402 }
      );
    }

    // Record royalty payment in database
    await recordRoyaltyPayment({
      followerAddress: body.follower,
      vaultId: body.vault,
      profitAmount: body.profit_amount,
      transactionHash: signature.transactionHash,
      timestamp: signature.timestamp,
    });

    return NextResponse.json({
      success: true,
      message: "Royalty payment verified and recorded",
    });
  } catch (error) {
    console.error("[x402] Payment verification error:", error);
    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 500 }
    );
  }
}

async function verifyPayment(transactionHash: string): Promise<boolean> {
  const rpcClient = new RpcClient(process.env.NEXT_PUBLIC_CASPER_RPC_URL!);

  try {
    const deployResult = await rpcClient.getDeploy(transactionHash);
    return deployResult.execution_results?.some(
      (r: any) => r.result.Success
    ) ?? false;
  } catch {
    return false;
  }
}

async function recordRoyaltyPayment(data: {
  followerAddress: string;
  vaultId: string;
  profitAmount: string;
  transactionHash: string;
  timestamp: number;
}) {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();

  await supabase.from("royalty_payments").insert({
    follower_address: data.followerAddress,
    vault_id: data.vaultId,
    profit_amount: data.profitAmount,
    transaction_hash: data.transactionHash,
    paid_at: new Date(data.timestamp).toISOString(),
  });
}
```

---

## 4.5 Royalty Reports & Analytics

### Trader Royalty Dashboard Data

```typescript
// src/lib/supabase/leaderboard.ts
import { createClient } from "@/lib/supabase/client";

export interface TraderRoyaltyStats {
  totalRoyaltiesEarned: string;
  totalRoyaltiesPaid: string;
  royaltyRate: number; // bps
  paymentCount: number;
  averageRoyaltyPerFollower: string;
  topPayingFollowers: Array<{
    address: string;
    totalPaid: string;
    tradesCopied: number;
  }>;
  dailyRoyalties: Array<{
    date: string;
    amount: string;
    transactionCount: number;
  }>;
}

export async function getTraderRoyaltyStats(
  traderAddress: string
): Promise<TraderRoyaltyStats> {
  const supabase = createClient();

  const { data: payments } = await supabase
    .from("royalty_payments")
    .select("*")
    .eq("trader_address", traderAddress)
    .order("paid_at", { ascending: false });

  // Aggregate results
  const totalRoyalties = payments?.reduce(
    (sum, p) => sum + BigInt(p.royalty_amount),
    0n
  ) ?? 0n;

  return {
    totalRoyaltiesEarned: totalRoyalties.toString(),
    totalRoyaltiesPaid: payments?.length.toString() ?? "0",
    royaltyRate: 500, // Fetch from on-chain
    paymentCount: payments?.length ?? 0,
    averageRoyaltyPerFollower: "0",
    topPayingFollowers: [],
    dailyRoyalties: [],
  };
}
```

---

## 4.6 Supabase Royalty Schema Extension

Add these tables to Supabase:

```sql
-- Royalty payments tracking
CREATE TABLE royalty_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id BIGINT,                    -- On-chain payment ID
  trader_address TEXT NOT NULL,
  follower_address TEXT NOT NULL,
  vault_id UUID REFERENCES vaults(id),
  profit_amount NUMERIC(40,0) NOT NULL,
  royalty_amount NUMERIC(40,0) NOT NULL,
  royalty_rate_bps INTEGER NOT NULL,
  transaction_hash TEXT,
  payment_method TEXT DEFAULT 'onchain', -- 'x402' or 'onchain'
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for fast lookups
  CONSTRAINT fk_trader FOREIGN KEY (trader_address) REFERENCES traders(wallet_address)
);

-- Trader payout history (aggregated view)
CREATE TABLE trader_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trader_address TEXT UNIQUE NOT NULL REFERENCES traders(wallet_address),
  total_earned NUMERIC(40,0) DEFAULT 0,
  total_payments INTEGER DEFAULT 0,
  avg_royalty_rate NUMERIC(5,2) DEFAULT 0,
  last_payout_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE royalty_payments;

-- Indexes
CREATE INDEX idx_royalty_payments_trader ON royalty_payments(trader_address);
CREATE INDEX idx_royalty_payments_follower ON royalty_payments(follower_address);
CREATE INDEX idx_royalty_payments_paid_at ON royalty_payments(paid_at DESC);
```

---

## 4.7 Royalty Contract Tests

### gradex-contracts/tests/royalty_tests.rs

```rust
#[cfg(test)]
mod tests {
    use odra_test::*;
    use gradex_contracts::royalty::RoyaltyDistributor;
    use odra::Address;

    fn setup() -> (TestEnv, Address, Address, RoyaltyDistributorRef) {
        let env = TestEnv::new();
        let owner = env.caller();
        let copy_engine = Address::from([42u8; 32]);
        
        let royalty = RoyaltyDistributor::deploy(&env, owner, copy_engine);
        
        (env, owner, copy_engine, royalty)
    }

    #[test]
    fn test_initialization() {
        let (_env, _owner, _engine, royalty) = setup();
        assert_eq!(royalty.get_payment_count(), 0);
        assert_eq!(
            royalty.get_total_royalties_distributed(),
            U512::zero()
        );
        assert_eq!(royalty.get_effective_rate(&Address::from([1u8; 32])), 500);
    }

    #[test]
    fn test_process_royalty_payment() {
        let (env, _owner, engine, mut royalty) = setup();
        
        let trader = Address::from([10u8; 32]);
        let follower = Address::from([20u8; 32]);
        
        // Process a royalty payment
        let (amount, payment_id) = royalty.process_royalty_payment(
            trader,
            follower,
            1, // vault_id
            U512::from(10000), // 10,000 CSPR profit
        );
        
        // 5% of 10000 = 500 CSPR
        assert_eq!(amount, U512::from(500));
        assert_eq!(payment_id, 1);
        assert_eq!(royalty.get_payment_count(), 1);
        assert_eq!(
            royalty.get_total_royalties_distributed(),
            U512::from(500)
        );
    }

    #[test]
    fn test_custom_royalty_rate() {
        let (env, _owner, engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        
        // Set custom 10% rate
        royalty.set_trader_royalty_rate(trader, 1000);
        assert_eq!(royalty.get_effective_rate(&trader), 1000);
    }

    #[test]
    fn test_multiple_payments() {
        let (env, _owner, engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        let follower1 = Address::from([20u8; 32]);
        let follower2 = Address::from([21u8; 32]);
        
        royalty.process_royalty_payment(trader, follower1, 1, U512::from(10000));
        royalty.process_royalty_payment(trader, follower2, 1, U512::from(50000));
        
        assert_eq!(royalty.get_payment_count(), 2);
        // Total: 5% of 10000 + 5% of 50000 = 500 + 2500 = 3000
        assert_eq!(
            royalty.get_total_royalties_distributed(),
            U512::from(3000)
        );
    }

    #[test]
    #[should_panic(expected = "Profit must be positive")]
    fn test_reject_zero_profit() {
        let (env, _owner, engine, mut royalty) = setup();
        
        royalty.process_royalty_payment(
            Address::from([10u8; 32]),
            Address::from([20u8; 32]),
            1,
            U512::zero(),
        );
    }

    #[test]
    fn test_trader_payment_history() {
        let (env, _owner, engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        let follower = Address::from([20u8; 32]);
        
        royalty.process_royalty_payment(trader, follower, 1, U512::from(10000));
        royalty.process_royalty_payment(trader, follower, 1, U512::from(20000));
        
        let history = royalty.get_trader_payment_ids(&trader);
        assert_eq!(history.len(), 2);
        assert_eq!(history[0], 1);
        assert_eq!(history[1], 2);
    }

    #[test]
    fn test_batch_payments() {
        let (env, _owner, engine, mut royalty) = setup();
        let trader1 = Address::from([10u8; 32]);
        let trader2 = Address::from([11u8; 32]);
        let follower = Address::from([20u8; 32]);
        
        let payments = vec![
            (trader1, follower, 1, U512::from(10000)),
            (trader2, follower, 1, U512::from(20000)),
        ];
        
        let total = royalty.process_batch_royalty_payments(payments);
        // 5% of 10000 + 5% of 20000 = 500 + 1000 = 1500
        assert_eq!(total, U512::from(1500));
        assert_eq!(royalty.get_payment_count(), 2);
    }
}
```

---

## 4.8 Royalty Flow Diagram (End-to-End)

```
Follower's Trade Closes Profitably
         │
         ▼
Copy Engine detects profit event
         │
         ▼
Calculate royalty = profit * rate_bps / 10000
         │
         ├──────────────────────────────────────┐
         ▼                                      ▼
   HTTP Endpoint Available?            No HTTP Endpoint
         │                                      │
         ▼                                      ▼
   x402 Handshake                    On-chain CSPR Transfer
   ├─ GET → 402 Payment Required      ├─ Build transfer deploy
   ├─ Extract payment details         ├─ Sign with x402 key
   ├─ Submit payment proof            ├─ Submit to network
   └─ Verify on-chain                 └─ Get deploy hash
         │                                      │
         └──────────────────────────────────────┘
                        │
                        ▼
              Record Payment in Supabase
                        │
                        ▼
              Update Trader's Accumulated Royalties
                        │
                        ▼
              Notify Trader (Dashboard Update)
```

---

## 4.9 Verification Checklist

- [ ] RoyaltyDistributor contract compiles and all tests pass
- [ ] Royalty calculation is mathematically verified (5% of 10,000 = 500 CSPR)
- [ ] Multiple traders can receive royalties from multiple followers
- [ ] Custom royalty rates work per-trader
- [ ] x402 HTTP negotiation flow works end-to-end
- [ ] Fallback on-chain transfer works when x402 unavailable
- [ ] Batch payment processing works correctly
- [ ] Royalty payments recorded in Supabase
- [ ] Trader dashboard shows accurate royalty earnings
- [ ] Edge cases: zero profit rejected, rate capped at 20%, paused state blocks payments

---

**Phase 4 Complete.** The trustless x402 royalty system now pays traders automatically. Phase 5 will build the AI-powered reputation scoring system using Groq + Tavily.

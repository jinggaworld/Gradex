use odra::prelude::*;
use odra::Address;

/// Allocation settings a follower sets when subscribing to a trader
#[odra(odra_type)]
pub struct AllocationConfig {
    pub follower: Address,
    pub trader: Address,
    pub allocated_amount: U512,
    pub max_drawdown: U256,
    pub auto_compound: bool,
    pub is_active: bool,
    pub subscribed_at: u64,
}

/// A single copy trade record
#[odra(odra_type)]
pub struct CopyTradeRecord {
    pub id: u64,
    pub follower: Address,
    pub trader: Address,
    pub original_tx_hash: String,
    pub copied_tx_hash: Option<String>,
    pub dex: String,
    pub action: String,
    pub token: String,
    pub token_amount: U512,
    pub cspr_amount: U512,
    pub status: String,
    pub executed_at: Option<u64>,
    pub profit: Option<U512>,
}

/// Royalty payment record
#[odra(odra_type)]
pub struct RoyaltyPayment {
    pub id: u64,
    pub trader: Address,
    pub follower: Address,
    pub vault_id: u32,
    pub profit_amount: U512,
    pub royalty_amount: U512,
    pub paid_at: u64,
}

/// Trader on-chain profile
#[odra(odra_type)]
pub struct TraderProfile {
    pub address: Address,
    pub total_followers: u32,
    pub total_volume: U512,
    pub total_royalties_earned: U512,
    pub performance_fee_bps: u16,
    pub is_registered: bool,
    pub registered_at: u64,
}

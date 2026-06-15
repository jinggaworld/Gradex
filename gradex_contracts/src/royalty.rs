use odra::prelude::*;
use odra::{Address, Var, Mapping, List};
use crate::types::RoyaltyPayment;

/// Royalty Distributor for x402 automated trader payments.
/// Manages trustless royalty distribution when followers profit from copy trades.
/// Supports custom per-trader rates, batch processing, and accumulated payouts.
#[odra(module)]
pub struct RoyaltyDistributor {
    /// Contract owner (protocol admin)
    owner: Var<Address>,

    /// Whether the system is operational
    is_paused: Var<bool>,

    /// Linked vault contracts
    registered_vaults: Mapping<Address, bool>,

    /// Authorized copy engine contract that can trigger payments
    copy_engine: Var<Address>,

    /// Payment records
    payment_count: Var<u64>,
    payments: Mapping<u64, RoyaltyPayment>,

    /// Total royalties distributed across all time
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

    // ═══════════════════════════════════════════════════
    //  ADMINISTRATION
    // ═══════════════════════════════════════════════════

    /// Register a vault for royalty tracking
    pub fn register_vault(&mut self, vault_address: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner can register vaults");
        self.registered_vaults.set(&vault_address, true);
    }

    /// Unregister a vault
    pub fn unregister_vault(&mut self, vault_address: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner can unregister vaults");
        self.registered_vaults.set(&vault_address, false);
    }

    /// Set default royalty rate (in basis points, max 20%)
    pub fn set_default_royalty_rate(&mut self, rate_bps: u16) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        assert!(rate_bps <= 2000, "Rate cannot exceed 20%");
        self.default_royalty_rate_bps.set(rate_bps);
    }

    /// Set custom royalty rate for a specific trader
    pub fn set_trader_royalty_rate(&mut self, trader: Address, rate_bps: u16) {
        let caller = odra::caller();
        assert!(
            caller == trader || caller == self.owner.get().unwrap(),
            "Only trader or owner"
        );
        assert!(rate_bps <= 2000, "Rate cannot exceed 20%");
        self.trader_royalty_rates.set(&trader, rate_bps);
    }

    /// Update the authorized copy engine address
    pub fn set_copy_engine(&mut self, new_engine: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.copy_engine.set(new_engine);
    }

    /// Pause/unpause the royalty system
    pub fn set_paused(&mut self, paused: bool) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.is_paused.set(paused);
    }

    // ═══════════════════════════════════════════════════
    //  CORE PAYMENT LOGIC
    // ═══════════════════════════════════════════════════

    /// Process a royalty payment when a follower realizes a profit.
    /// Called by the authorized copy engine after a profitable copy trade closes.
    ///
    /// Calculates royalty as: `profit_amount * effective_rate_bps / 10000`
    /// Transfers CSPR directly to the trader's wallet (trustless).
    fn process_royalty_payment(
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

        assert!(royalty_amount > U512::zero(), "Royalty too small to process");

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

        // Update accumulated royalties for the trader
        let current_accumulated = self.accumulated_royalties.get(&trader).unwrap_or(U512::zero());
        self.accumulated_royalties.set(&trader, current_accumulated + royalty_amount);

        // Update total distributed
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

    // ═══════════════════════════════════════════════════
    //  PUBLIC ENTRY POINTS (wraps internal for test compatibility)
    // ═══════════════════════════════════════════════════

    /// Public entry point for processing a single royalty payment
    pub fn pay_royalty(
        &mut self,
        trader: Address,
        follower: Address,
        vault_id: u32,
        profit_amount: U512,
    ) -> U512 {
        let (amount, _id) = self.process_royalty_payment(trader, follower, vault_id, profit_amount);
        amount
    }

    /// Process batch royalty payments for multiple followers at once
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

    // ═══════════════════════════════════════════════════
    //  QUERIES
    // ═══════════════════════════════════════════════════

    /// Get effective royalty rate for a trader (custom rate if set, otherwise default)
    pub fn get_effective_rate(&self, trader: &Address) -> u16 {
        self.trader_royalty_rates
            .get(trader)
            .unwrap_or(self.default_royalty_rate_bps.get_or_default())
    }

    /// Get a specific payment record
    pub fn get_payment(&self, payment_id: u64) -> Option<RoyaltyPayment> {
        self.payments.get(&payment_id)
    }

    /// Get total royalties distributed across all time
    pub fn get_total_royalties_distributed(&self) -> U512 {
        self.total_royalties_distributed.get_or_default()
    }

    /// Get accumulated (unwithdrawn) royalties for a trader
    pub fn get_accumulated_royalties(&self, trader: &Address) -> U512 {
        self.accumulated_royalties.get(trader).unwrap_or(U512::zero())
    }

    /// Get payment history IDs for a trader
    pub fn get_trader_payment_ids(&self, trader: &Address) -> Vec<u64> {
        self.trader_payments.get(trader).unwrap_or_else(|| Vec::new())
    }

    /// Get total payment count
    pub fn get_payment_count(&self) -> u64 {
        self.payment_count.get_or_default()
    }

    /// Check if a vault is registered
    pub fn is_vault_registered(&self, vault: &Address) -> bool {
        self.registered_vaults.get(vault).unwrap_or(false)
    }

    /// Check if the system is paused
    pub fn get_is_paused(&self) -> bool {
        self.is_paused.get_or_default()
    }

    /// Get the default royalty rate
    pub fn get_default_royalty_rate(&self) -> u16 {
        self.default_royalty_rate_bps.get_or_default()
    }

    /// Get the authorized copy engine address
    pub fn get_copy_engine(&self) -> Address {
        self.copy_engine.get().unwrap_or_default()
    }

    /// Get custom royalty rate for a specific trader
    pub fn get_trader_royalty_rate(&self, trader: &Address) -> Option<u16> {
        self.trader_royalty_rates.get(trader)
    }
}

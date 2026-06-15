use odra::prelude::*;
use odra::{Address, Var, Mapping, List};
use crate::types::AllocationConfig;

/// Vault state summary for external queries
#[odra(odra_type)]
pub struct VaultContractState {
    pub total_deposits: U512,
    pub total_withdrawals: U512,
    pub total_copied_volume: U512,
    pub follower_count: u32,
    pub trader_share: U512,
    pub performance_fees: U512,
    pub is_paused: bool,
}

/// Copy Vault contract for managing follower deposits and allocations.
/// Followers subscribe with CSPR, the vault tracks proportional allocations,
/// and the copy engine uses these allocations to execute proportional copy trades.
#[odra(module)]
pub struct CopyVault {
    owner: Var<Address>,
    is_paused: Var<bool>,
    vault_name: Var<String>,
    performance_fee_bps: Var<u16>,
    subscription_fee: Var<U512>,
    min_allocation: Var<U512>,
    max_allocation: Var<U512>,
    followers: List<Address>,
    follower_count: Var<u32>,
    allocations: Mapping<Address, AllocationConfig>,
    total_deposits: Var<U512>,
    total_withdrawals: Var<U512>,
    total_copied_volume: Var<U512>,
    total_performance_fees: Var<U512>,
    follower_profits: Mapping<Address, U512>,
    follower_accumulated_losses: Mapping<Address, U512>,
    follower_royalties_paid: Mapping<Address, U512>,
    trade_count: Var<u64>,
}

#[odra(module)]
impl CopyVault {
    #[odra(init)]
    pub fn init(
        &mut self,
        owner: Address,
        name: String,
        performance_fee_bps: u16,
        subscription_fee: U512,
        min_allocation: U512,
        max_allocation: U512,
    ) {
        assert!(performance_fee_bps <= 1000, "Performance fee cannot exceed 10%");
        assert!(min_allocation <= max_allocation, "Min allocation must be <= max allocation");
        assert!(!name.is_empty(), "Vault name cannot be empty");
        self.owner.set(owner);
        self.vault_name.set(name);
        self.performance_fee_bps.set(performance_fee_bps);
        self.subscription_fee.set(subscription_fee);
        self.min_allocation.set(min_allocation);
        self.max_allocation.set(max_allocation);
        self.is_paused.set(false);
        self.follower_count.set(0);
        self.total_deposits.set(U512::zero());
        self.total_withdrawals.set(U512::zero());
        self.total_copied_volume.set(U512::zero());
        self.total_performance_fees.set(U512::zero());
        self.trade_count.set(0);
    }

    /// Follower subscribes to the vault with a CSPR allocation
    pub fn subscribe(&mut self, follower: Address, amount: U512) {
        let caller = odra::caller();
        assert!(!self.is_paused.get_or_default(), "Vault is paused");
        assert!(caller == follower, "Only the follower can subscribe for themselves");
        assert!(!self.allocations.contains_key(&follower), "Already subscribed");

        let min = self.min_allocation.get_or_default();
        let max = self.max_allocation.get_or_default();
        assert!(amount >= min, "Amount below minimum allocation");
        if max > U512::zero() {
            assert!(amount <= max, "Amount exceeds maximum allocation");
        }

        let sub_fee = self.subscription_fee.get_or_default();
        if sub_fee > U512::zero() {
            let owner = self.owner.get().unwrap();
            odra::contract_env::transfer_tokens(&owner, &sub_fee);
        }

        let config = AllocationConfig {
            follower,
            trader: self.owner.get().unwrap(),
            allocated_amount: amount,
            max_drawdown: U256::from(50_00),
            auto_compound: false,
            is_active: true,
            subscribed_at: odra::contract_env::block_time(),
        };

        self.allocations.set(&follower, config);
        self.followers.push_back(follower);
        let count = self.follower_count.get_or_default() + 1;
        self.follower_count.set(count);
        self.total_deposits.set(self.total_deposits.get_or_default() + amount);
    }

    /// Follower unsubscribes and withdraws their principal + net profits
    pub fn unsubscribe(&mut self, follower: Address) {
        let caller = odra::caller();
        assert!(caller == follower, "Only the follower can unsubscribe");

        let config = self.allocations.get(&follower)
            .expect("Not subscribed to this vault");
        assert!(config.is_active, "Already unsubscribed");

        let profit = self.follower_profits.get(&follower).unwrap_or(U512::zero());
        let losses = self.follower_accumulated_losses.get(&follower).unwrap_or(U512::zero());

        // Net return = allocated amount + net profit - accumulated losses
        let net_profit = if profit > losses { profit - losses } else { U512::zero() };
        let total_return = config.allocated_amount + net_profit;

        let mut updated = config;
        updated.is_active = false;
        self.allocations.set(&follower, updated);

        if total_return > U512::zero() {
            odra::contract_env::transfer_tokens(&follower, &total_return);
        }

        self.total_withdrawals.set(self.total_withdrawals.get_or_default() + total_return);
        let count = self.follower_count.get_or_default();
        if count > 0 {
            self.follower_count.set(count - 1);
        }
    }

    /// Record a profit for a follower (called by copy engine after trade closes)
    pub fn record_profit(&mut self, follower: Address, profit_amount: U512) {
        let current_profit = self.follower_profits.get(&follower).unwrap_or(U512::zero());

        let fee_bps = self.performance_fee_bps.get_or_default();
        let fee = profit_amount * U512::from(fee_bps as u64) / U512::from(10000);
        let net_profit = profit_amount - fee;

        self.follower_profits.set(&follower, current_profit + net_profit);
        self.total_performance_fees.set(self.total_performance_fees.get_or_default() + fee);

        if fee > U512::zero() {
            let owner = self.owner.get().unwrap();
            odra::contract_env::transfer_tokens(&owner, &fee);
        }
    }

    /// Record a loss for a follower
    pub fn record_loss(&mut self, follower: Address, loss_amount: U512) {
        let current_losses = self.follower_accumulated_losses.get(&follower).unwrap_or(U512::zero());
        self.follower_accumulated_losses.set(&follower, current_losses + loss_amount);
    }

    /// Update a follower's allocation amount
    pub fn update_allocation(&mut self, follower: Address, new_amount: U512) {
        let caller = odra::caller();
        assert!(caller == follower, "Only follower can update their allocation");

        let mut config = self.allocations.get(&follower)
            .expect("Not subscribed");

        let min = self.min_allocation.get_or_default();
        let max = self.max_allocation.get_or_default();
        assert!(new_amount >= min, "Amount below minimum");
        if max > U512::zero() {
            assert!(new_amount <= max, "Amount above maximum");
        }

        let old_amount = config.allocated_amount;
        config.allocated_amount = new_amount;
        self.allocations.set(&follower, config);

        if new_amount > old_amount {
            let diff = new_amount - old_amount;
            self.total_deposits.set(self.total_deposits.get_or_default() + diff);
        } else {
            let diff = old_amount - new_amount;
            if diff > U512::zero() {
                odra::contract_env::transfer_tokens(&follower, &diff);
                self.total_withdrawals.set(self.total_withdrawals.get_or_default() + diff);
            }
        }
    }

    /// Toggle auto-compound for a follower
    pub fn toggle_auto_compound(&mut self, follower: Address) {
        let caller = odra::caller();
        assert!(caller == follower, "Only follower can toggle");

        let mut config = self.allocations.get(&follower)
            .expect("Not subscribed");

        config.auto_compound = !config.auto_compound;
        self.allocations.set(&follower, config);
    }

    /// Set max drawdown threshold for a follower (in basis points)
    pub fn set_max_drawdown(&mut self, follower: Address, drawdown_bps: U256) {
        let caller = odra::caller();
        assert!(caller == follower, "Only follower can set drawdown");
        assert!(drawdown_bps <= U256::from(10000), "Drawdown cannot exceed 100%");

        let mut config = self.allocations.get(&follower)
            .expect("Not subscribed");

        config.max_drawdown = drawdown_bps;
        self.allocations.set(&follower, config);
    }

    /// Pause/unpause the vault (owner only)
    pub fn set_paused(&mut self, paused: bool) {
        let caller = odra::caller();
        let owner = self.owner.get().unwrap();
        assert!(caller == owner, "Only vault owner can pause/resume");
        self.is_paused.set(paused);
    }

    /// Get vault state summary
    pub fn get_vault_state(&self) -> VaultContractState {
        VaultContractState {
            total_deposits: self.total_deposits.get_or_default(),
            total_withdrawals: self.total_withdrawals.get_or_default(),
            total_copied_volume: self.total_copied_volume.get_or_default(),
            follower_count: self.follower_count.get_or_default(),
            trader_share: self.total_performance_fees.get_or_default(),
            performance_fees: self.total_performance_fees.get_or_default(),
            is_paused: self.is_paused.get_or_default(),
        }
    }

    /// Get a follower's allocation config
    pub fn get_allocation(&self, follower: &Address) -> Option<AllocationConfig> {
        self.allocations.get(follower)
    }

    /// Get follower's gross credited profit (after performance fee deduction, before losses)
    /// Use `get_follower_net_profit` to account for both fees and losses.
    pub fn get_follower_profit(&self, follower: &Address) -> U512 {
        self.follower_profits.get(follower).unwrap_or(U512::zero())
    }

    /// Get follower's net profit (after performance fees AND accumulated losses)
    /// This is the actual profit the follower can withdraw.
    pub fn get_follower_net_profit(&self, follower: &Address) -> U512 {
        let profit = self.follower_profits.get(follower).unwrap_or(U512::zero());
        let losses = self.follower_accumulated_losses.get(follower).unwrap_or(U512::zero());
        if profit > losses { profit - losses } else { U512::zero() }
    }

    /// Get total vault CSPR balance
    pub fn get_vault_balance(&self) -> U512 {
        odra::contract_env::self_balance()
    }

    /// Get number of active followers
    pub fn get_follower_count(&self) -> u32 {
        self.follower_count.get_or_default()
    }

    /// Get total deposits
    pub fn get_total_deposits(&self) -> U512 {
        self.total_deposits.get_or_default()
    }

    /// Get total copied volume
    pub fn get_total_copied_volume(&self) -> U512 {
        self.total_copied_volume.get_or_default()
    }

    /// Get vault owner
    pub fn get_owner(&self) -> Address {
        self.owner.get().unwrap_or_default()
    }

    /// Get vault name
    pub fn get_vault_name(&self) -> String {
        self.vault_name.get_or_default()
    }

    /// Calculate proportional trade amount for a follower
    pub fn calculate_proportion(
        &self,
        follower_allocation: U512,
        total_vault_balance: U512,
        trade_size: U512,
    ) -> U512 {
        if total_vault_balance == U512::zero() {
            return U512::zero();
        }
        follower_allocation * trade_size / total_vault_balance
    }
}

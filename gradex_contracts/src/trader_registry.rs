use odra::prelude::*;
use odra::{Address, Var, Mapping};
use crate::types::TraderProfile;

/// Trader Registry for on-chain trader profiles.
/// Manages registered traders, their stats, and performance fee settings.
#[odra(module)]
pub struct TraderRegistry {
    admin: Var<Address>,
    trader_count: Var<u32>,
    traders: Mapping<Address, TraderProfile>,
    trader_addresses: odra::List<Address>,
}

#[odra(module)]
impl TraderRegistry {
    #[odra(init)]
    pub fn init(&mut self, admin: Address) {
        self.admin.set(admin);
        self.trader_count.set(0);
    }

    /// Register a new trader with a performance fee
    pub fn register_trader(
        &mut self,
        trader_address: Address,
        performance_fee_bps: u16,
    ) {
        let caller = odra::caller();
        assert!(
            caller == trader_address || caller == self.admin.get().unwrap(),
            "Only the trader or admin can register"
        );
        assert!(!self.traders.contains_key(&trader_address), "Already registered");
        assert!(performance_fee_bps <= 1000, "Fee too high (max 10%)");

        let profile = TraderProfile {
            address: trader_address,
            total_followers: 0,
            total_volume: U512::zero(),
            total_royalties_earned: U512::zero(),
            performance_fee_bps,
            is_registered: true,
            registered_at: odra::contract_env::block_time(),
        };

        self.traders.set(&trader_address, profile);
        self.trader_addresses.push_back(trader_address);
        self.trader_count.set(self.trader_count.get_or_default() + 1);
    }

    /// Unregister a trader
    pub fn unregister_trader(&mut self, trader_address: Address) {
        let caller = odra::caller();
        let admin = self.admin.get().unwrap();
        assert!(
            caller == trader_address || caller == admin,
            "Only the trader or admin can unregister"
        );
        assert!(self.traders.contains_key(&trader_address), "Trader not registered");

        let mut profile = self.traders.get(&trader_address).unwrap();
        profile.is_registered = false;
        self.traders.set(&trader_address, profile);

        let count = self.trader_count.get_or_default();
        if count > 0 {
            self.trader_count.set(count - 1);
        }
    }

    /// Get trader profile
    pub fn get_trader(&self, address: &Address) -> Option<TraderProfile> {
        self.traders.get(address)
    }

    /// Update trader volume (called by the copy engine)
    pub fn update_trader_volume(&mut self, address: &Address, volume: U512) {
        let mut profile = self.traders.get(address)
            .expect("Trader not registered");
        profile.total_volume = profile.total_volume + volume;
        self.traders.set(address, profile);
    }

    /// Update follower count for a trader
    pub fn update_follower_count(&mut self, address: &Address, delta: i32) {
        let mut profile = self.traders.get(address)
            .expect("Trader not registered");
        if delta > 0 {
            profile.total_followers += delta as u32;
        } else if delta < 0 {
            let abs_delta = (-delta) as u32;
            if profile.total_followers >= abs_delta {
                profile.total_followers -= abs_delta;
            } else {
                profile.total_followers = 0;
            }
        }
        self.traders.set(address, profile);
    }

    /// Add royalty earnings to a trader
    pub fn add_royalty(&mut self, address: &Address, amount: U512) {
        let mut profile = self.traders.get(address)
            .expect("Trader not registered");
        profile.total_royalties_earned = profile.total_royalties_earned + amount;
        self.traders.set(address, profile);
    }

    /// Update trader's performance fee
    pub fn update_performance_fee(&mut self, address: &Address, new_fee_bps: u16) {
        let caller = odra::caller();
        assert!(
            caller == *address || caller == self.admin.get().unwrap(),
            "Only trader or admin"
        );
        assert!(new_fee_bps <= 1000, "Fee too high (max 10%)");

        let mut profile = self.traders.get(address)
            .expect("Trader not registered");
        profile.performance_fee_bps = new_fee_bps;
        self.traders.set(address, profile);
    }

    /// Check if an address is a registered trader
    pub fn is_registered(&self, address: &Address) -> bool {
        self.traders.contains_key(address)
    }

    /// Get total number of registered traders
    pub fn get_trader_count(&self) -> u32 {
        self.trader_count.get_or_default()
    }

    /// Check if a trader is currently active
    pub fn is_active(&self, address: &Address) -> bool {
        self.traders.get(address)
            .map(|p| p.is_registered)
            .unwrap_or(false)
    }

    /// Get admin address
    pub fn get_admin(&self) -> Address {
        self.admin.get().unwrap_or_default()
    }
}

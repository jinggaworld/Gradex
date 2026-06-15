use odra::prelude::*;
use odra::{Address, Var, Mapping, List};
use crate::types::CopyTradeRecord;

/// Master trade event emitted when a trader executes a trade on a DEX
#[odra(odra_type)]
pub struct MasterTradeEvent {
    pub id: u64,
    pub trader: Address,
    pub dex_address: Address,
    pub dex_name: String,
    pub token_address: Address,
    pub token_amount: U512,
    pub cspr_value: U512,
    pub action: String,
    pub tx_hash: String,
    pub timestamp: u64,
    pub processed: bool,
    pub slippage_bps: u16,
}

/// Copy Engine contract for detecting master trades and executing proportional copies.
/// Acts as the coordination layer between master traders, vaults, and DEX contracts.
/// Includes anti-wash-trade protection, rate limiting, and authorized executor pattern.
#[odra(module)]
pub struct CopyEngine {
    /// Contract owner (protocol admin)
    owner: Var<Address>,

    /// Whether the engine is operational
    is_paused: Var<bool>,

    /// Authorized off-chain executor that submits copy trade deploys
    authorized_executor: Var<Address>,

    /// Registered vault contracts served by this engine
    registered_vaults: Mapping<Address, bool>,
    vault_list: List<Address>,

    /// Registered DEX contracts that can be monitored for trades
    registered_dexes: Mapping<Address, String>, // address -> dex name
    dex_active: Mapping<Address, bool>, // whether a DEX is currently active
    dex_list: List<Address>,

    /// Master trader → their vault address(es)
    trader_vaults: Mapping<Address, Vec<Address>>,

    /// Copy trade tracking
    trade_count: Var<u64>,
    copy_trades: Mapping<u64, CopyTradeRecord>,

    /// Master trade event tracking
    event_count: Var<u64>,
    master_events: Mapping<u64, MasterTradeEvent>,

    /// Per-follower cooldown (block number of last copy)
    last_copy_block: Mapping<Address, u64>,

    /// Minimum trade size to trigger a copy (anti-wash-trade, default 10 CSPR)
    min_trade_size: Var<U512>,

    /// Minimum blocks between copies for same follower (rate limiting)
    min_block_interval: Var<u64>,

    /// Engine fee in basis points (default 50 = 0.5%)
    engine_fee_bps: Var<u16>,

    /// Vault contract address (for calling vault methods)
    vault_contract: Var<Address>,
}

#[odra(module)]
impl CopyEngine {
    #[odra(init)]
    pub fn init(&mut self, owner: Address, authorized_executor: Address) {
        self.owner.set(owner);
        self.authorized_executor.set(authorized_executor);
        self.is_paused.set(false);
        self.trade_count.set(0);
        self.event_count.set(0);
        self.min_trade_size.set(U512::from(10_000_000_000)); // 10 CSPR
        self.min_block_interval.set(1); // 1 block minimum interval
        self.engine_fee_bps.set(50); // 0.5%
    }

    // ═══════════════════════════════════════════════════
    //  ADMINISTRATION
    // ═══════════════════════════════════════════════════

    /// Register a vault contract to be served by this engine
    pub fn register_vault(&mut self, vault_address: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner can register vaults");
        assert!(!self.registered_vaults.contains_key(&vault_address), "Vault already registered");

        self.registered_vaults.set(&vault_address, true);
        self.vault_list.push_back(vault_address);
    }

    /// Unregister a vault
    pub fn unregister_vault(&mut self, vault_address: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner can unregister vaults");
        assert!(self.registered_vaults.contains_key(&vault_address), "Vault not registered");

        self.registered_vaults.set(&vault_address, false);
    }

    /// Register a DEX contract for trade monitoring
    pub fn register_dex(&mut self, dex_address: Address, dex_name: String) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner can register DEXes");
        assert!(!self.registered_dexes.contains_key(&dex_address), "DEX already registered");

        self.registered_dexes.set(&dex_address, dex_name.clone());
        self.dex_active.set(&dex_address, true);
        self.dex_list.push_back(dex_address);
    }

    /// Unregister a DEX
    pub fn unregister_dex(&mut self, dex_address: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner can unregister DEXes");
        assert!(self.registered_dexes.contains_key(&dex_address), "DEX not registered");

        self.dex_active.set(&dex_address, false);
    }

    /// Link a master trader to their copy vault
    pub fn link_trader_to_vault(&mut self, trader: Address, vault: Address) {
        let caller = odra::caller();
        assert!(
            caller == trader || caller == self.owner.get().unwrap(),
            "Only trader or owner can link"
        );
        assert!(
            self.registered_vaults.get(&vault).unwrap_or(false),
            "Vault not registered"
        );

        let mut vaults = self.trader_vaults.get(&trader).unwrap_or_else(|| Vec::new());
        if !vaults.contains(&vault) {
            vaults.push(vault);
            self.trader_vaults.set(&trader, vaults);
        }
    }

    /// Unlink a trader from a vault
    pub fn unlink_trader_from_vault(&mut self, trader: Address, vault: Address) {
        let caller = odra::caller();
        assert!(
            caller == trader || caller == self.owner.get().unwrap(),
            "Only trader or owner can unlink"
        );

        let vaults = self.trader_vaults.get(&trader).unwrap_or_else(|| Vec::new());
        let filtered: Vec<Address> = vaults.into_iter().filter(|v| v != &vault).collect();
        self.trader_vaults.set(&trader, filtered);
    }

    /// Set authorized executor address
    pub fn set_authorized_executor(&mut self, executor: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.authorized_executor.set(executor);
    }

    /// Set minimum trade size (anti-wash-trade protection)
    pub fn set_min_trade_size(&mut self, size: U512) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.min_trade_size.set(size);
    }

    /// Set minimum block interval between copies
    pub fn set_min_block_interval(&mut self, blocks: u64) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.min_block_interval.set(blocks);
    }

    /// Set engine fee
    pub fn set_engine_fee(&mut self, fee_bps: u16) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        assert!(fee_bps <= 500, "Engine fee cannot exceed 5%");
        self.engine_fee_bps.set(fee_bps);
    }

    /// Set the vault contract address for cross-contract calls
    pub fn set_vault_contract(&mut self, vault_address: Address) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.vault_contract.set(vault_address);
    }

    /// Pause/unpause the engine
    pub fn set_paused(&mut self, paused: bool) {
        let caller = odra::caller();
        assert!(caller == self.owner.get().unwrap(), "Only owner");
        self.is_paused.set(paused);
    }

    // ═══════════════════════════════════════════════════
    //  CORE COPY LOGIC
    // ═══════════════════════════════════════════════════

    /// Called by the off-chain executor: record a master trade that should trigger copies.
    /// The executor identifies vaults copying this trader and processes proportional copies.
    pub fn process_master_trade(
        &mut self,
        master_trader: Address,
        dex_address: Address,
        dex_name: String,
        token_address: Address,
        token_amount: U512,
        cspr_value: U512,
        action: String,
        tx_hash: String,
        slippage_bps: u16,
    ) -> u64 {
        let caller = odra::caller();
        assert!(
            caller == self.authorized_executor.get().unwrap(),
            "Only authorized executor"
        );
        assert!(!self.is_paused.get_or_default(), "Engine is paused");
        assert!(
            cspr_value >= self.min_trade_size.get_or_default(),
            "Trade below minimum size (anti-wash-trade)"
        );

        // Verify the DEX is registered
        assert!(
            self.dex_active.get(&dex_address).unwrap_or(false),
            "DEX not registered"
        );

        // Get all vaults for this trader
        let vaults = self.trader_vaults.get(&master_trader)
            .unwrap_or_else(|| Vec::new());
        assert!(!vaults.is_empty(), "No vaults linked for this trader");

        // Create the master trade event record
        let event_id = self.event_count.get_or_default() + 1;
        let event = MasterTradeEvent {
            id: event_id,
            trader: master_trader,
            dex_address,
            dex_name,
            token_address,
            token_amount,
            cspr_value,
            action,
            tx_hash,
            timestamp: odra::contract_env::block_time(),
            processed: true,
            slippage_bps,
        };

        self.master_events.set(&event_id, event);
        self.event_count.set(event_id);

        event_id
    }

    /// Confirm a completed copy trade (called by executor after on-chain execution)
    pub fn confirm_copy_trade(
        &mut self,
        follower: Address,
        trader: Address,
        original_tx_hash: String,
        copied_tx_hash: String,
        dex: String,
        action: String,
        token: String,
        token_amount: U512,
        cspr_amount: U512,
        status: String,
    ) -> u64 {
        let caller = odra::caller();
        assert!(
            caller == self.authorized_executor.get().unwrap(),
            "Only authorized executor"
        );

        // Check rate limiting (anti-spam)
        let current_block = odra::contract_env::block_time();
        let last_copy = self.last_copy_block.get(&follower).unwrap_or(0);
        let min_interval = self.min_block_interval.get_or_default();
        assert!(
            current_block >= last_copy + min_interval,
            "Copy trade rate limited"
        );

        let trade_id = self.trade_count.get_or_default() + 1;
        let record = CopyTradeRecord {
            id: trade_id,
            follower,
            trader,
            original_tx_hash,
            copied_tx_hash: Some(copied_tx_hash),
            dex,
            action,
            token,
            token_amount,
            cspr_amount,
            status,
            executed_at: Some(current_block),
            profit: None,
        };

        self.copy_trades.set(&trade_id, record);
        self.trade_count.set(trade_id);
        self.last_copy_block.set(&follower, current_block);

        trade_id
    }

    /// Report PnL on a completed copy trade (called when trade is closed)
    pub fn report_trade_profit(
        &mut self,
        copy_trade_id: u64,
        profit_amount: U512,
    ) {
        let caller = odra::caller();
        assert!(
            caller == self.authorized_executor.get().unwrap(),
            "Only authorized executor"
        );

        if let Some(mut trade) = self.copy_trades.get(&copy_trade_id) {
            trade.profit = Some(profit_amount);
            self.copy_trades.set(&copy_trade_id, trade);
        }
    }

    /// Batch process multiple master trades (for efficiency)
    pub fn batch_process_master_trades(
        &mut self,
        trades: Vec<(
            Address, Address, String, Address, U512, U512, String, String, u16,
        )>,
    ) -> Vec<u64> {
        let mut event_ids = Vec::new();
        for (trader, dex_addr, dex_name, token_addr, token_amt, cspr_val, action, tx_hash, slippage) in trades {
            let event_id = self.process_master_trade(
                trader, dex_addr, dex_name, token_addr, token_amt, cspr_val, action, tx_hash, slippage,
            );
            event_ids.push(event_id);
        }
        event_ids
    }

    /// Batch confirm multiple copy trades
    pub fn batch_confirm_copy_trades(
        &mut self,
        trades: Vec<(Address, Address, String, String, String, String, String, U512, U512, String)>,
    ) -> Vec<u64> {
        let mut trade_ids = Vec::new();
        for (follower, trader, orig_tx, copy_tx, dex, action, token, token_amt, cspr_amt, status) in trades {
            let trade_id = self.confirm_copy_trade(
                follower, trader, orig_tx, copy_tx, dex, action, token, token_amt, cspr_amt, status,
            );
            trade_ids.push(trade_id);
        }
        trade_ids
    }

    // ═══════════════════════════════════════════════════
    //  QUERIES
    // ═══════════════════════════════════════════════════

    /// Get a copy trade record
    pub fn get_copy_trade(&self, id: u64) -> Option<CopyTradeRecord> {
        self.copy_trades.get(&id)
    }

    /// Get a master trade event
    pub fn get_master_event(&self, id: u64) -> Option<MasterTradeEvent> {
        self.master_events.get(&id)
    }

    /// Get total number of copy trades processed
    pub fn get_copy_trade_count(&self) -> u64 {
        self.trade_count.get_or_default()
    }

    /// Get total number of master trade events
    pub fn get_event_count(&self) -> u64 {
        self.event_count.get_or_default()
    }

    /// Get vaults for a specific trader
    pub fn get_trader_vaults(&self, trader: &Address) -> Vec<Address> {
        self.trader_vaults.get(trader).unwrap_or_else(|| Vec::new())
    }

    /// Check if a DEX is registered
    pub fn is_dex_registered(&self, address: &Address) -> bool {
        self.dex_active.get(address).unwrap_or(false)
    }

    /// Check if a vault is registered
    pub fn is_vault_registered(&self, address: &Address) -> bool {
        self.registered_vaults.get(address).unwrap_or(false)
    }

    /// Get the minimum trade size
    pub fn get_min_trade_size(&self) -> U512 {
        self.min_trade_size.get_or_default()
    }

    /// Get the engine fee
    pub fn get_engine_fee(&self) -> u16 {
        self.engine_fee_bps.get_or_default()
    }

    /// Check if engine is paused
    pub fn get_is_paused(&self) -> bool {
        self.is_paused.get_or_default()
    }

    /// Get authorized executor
    pub fn get_authorized_executor(&self) -> Address {
        self.authorized_executor.get().unwrap_or_default()
    }
}

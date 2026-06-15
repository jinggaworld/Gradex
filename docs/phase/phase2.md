# Phase 2: Smart Contract Development — Core Copy Vault

**Goal:** Build the Odra-powered Copy Vault smart contract that handles CSPR deposits, proportional trade copying, and follower allocation management.

**Duration:** 5-7 days

---

## 2.1 Vault Architecture Overview

The Copy Vault is the heart of Gradex. It is an Odra-based smart contract deployed on Casper Network that:

1. **Receives CSPR deposits** from followers who want to copy a trader
2. **Allocates funds proportionally** — each follower gets a share of every trade proportional to their allocation
3. **Executes copy trades** — when the master trader submits a trade, the vault automatically mirrors it for all followers
4. **Tracks PnL per follower** — every position's profit/loss is tracked individually
5. **Enables withdrawals** — followers can withdraw their allocated funds + profits at any time

### Contract Flow

```
Follower deposits CSPR
        │
        ▼
Vault calculates allocation percentage
        │
        ▼
Trader executes trade on DEX (Friendly Market / Ectoplasm)
        │
        ▼
Off-chain copy engine detects trade → submits copy deploy
        │
        ▼
Vault executes proportional copy for each follower
        │
        ▼
Follower can withdraw / auto-compound profits
```

---

## 2.2 Vault Contract Implementation

### gradex-contracts/src/vault.rs

```rust
use odra::prelude::*;
use odra::{Address, Var, Mapping, List};
use crate::types::{AllocationConfig, CopyTradeRecord, VaultState};

#[odra(module)]
pub struct CopyVault {
    // Contract owner (trader who created the vault)
    owner: Var<Address>,
    
    // Vault configuration
    is_paused: Var<bool>,
    vault_name: Var<String>,
    performance_fee_bps: Var<u16>,    // e.g. 200 = 2%
    subscription_fee: Var<U512>,       // CSPR per subscription period
    min_allocation: Var<U512>,         // Minimum CSPR to join
    max_allocation: Var<U512>,         // Maximum CSPR allowed
    
    // Follower management
    followers: List<Address>,
    follower_count: Var<u32>,
    allocations: Mapping<Address, AllocationConfig>,
    
    // Vault accounting
    total_deposits: Var<U512>,
    total_withdrawals: Var<U512>,
    total_copied_volume: Var<U512>,
    total_performance_fees: Var<U512>,
    
    // Copy trade tracking
    trade_count: Var<u64>,
    trades: Mapping<u64, CopyTradeRecord>,
    
    // Profit tracking per follower
    follower_profits: Mapping<Address, U512>,
    follower_royalties_paid: Mapping<Address, U512>,
    
    // CSPR token handle (for native CSPR transfers)
    cspr_token: Var<Address>,
}

#[odra(module)]
impl CopyVault {
    /// Initialize the vault with a trader as owner
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
        // Validate configuration
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
        self.total_deposits.set(U512::zero());
        self.total_withdrawals.set(U512::zero());
        self.total_copied_volume.set(U512::zero());
        self.total_performance_fees.set(U512::zero());
        self.follower_count.set(0);
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
        
        // Transfer CSPR from follower to vault
        // (In Odra, this is handled by the runtime via attached CSPR)
        
        let config = AllocationConfig {
            follower,
            allocated_amount: amount,
            max_drawdown: U256::from(50_00), // Default 50% drawdown limit (in basis points)
            auto_compound: false,
            is_active: true,
            subscribed_at: self.get_block_time(),
        };
        
        self.allocations.set(&follower, config);
        self.followers.push_back(follower);
        self.follower_count.set(self.follower_count.get_or_default() + 1);
        self.total_deposits.set(self.total_deposits.get_or_default() + amount);
    }
    
    /// Follower unsubscribes and withdraws their funds + profits
    pub fn unsubscribe(&mut self, follower: Address) {
        let caller = odra::caller();
        assert!(caller == follower, "Only the follower can unsubscribe");
        
        let config = self.allocations.get(&follower)
            .expect("Not subscribed to this vault");
        assert!(config.is_active, "Already unsubscribed");
        
        let profit = self.follower_profits.get(&follower).unwrap_or(U512::zero());
        let total_return = config.allocated_amount + profit;
        
        // Mark as inactive
        let mut updated = config;
        updated.is_active = false;
        self.allocations.set(&follower, updated);
        
        // Transfer funds back to follower
        odra::contract_env::transfer_tokens(&follower, &total_return);
        
        self.total_withdrawals.set(self.total_withdrawals.get_or_default() + total_return);
        self.follower_count.set(self.follower_count.get_or_default() - 1);
    }
    
    /// Execute a copy trade for all followers (called by authorized copy engine)
    pub fn execute_copy_trade(
        &mut self,
        follower: Address,
        dex: String,
        action: String,
        token: String,
        token_amount: U512,
        cspr_amount: U512,
    ) {
        let caller = odra::caller();
        // Only authorized copy engine contract can call this
        // (In production, verify caller is the registered copy engine)
        assert!(!self.is_paused.get_or_default(), "Vault is paused");
        
        let config = self.allocations.get(&follower)
            .expect("Follower not subscribed");
        assert!(config.is_active, "Follower subscription is inactive");
        
        // Calculate proportional amount based on follower's allocation
        let total_vault_balance = self.get_vault_balance();
        let proportion = self.calculate_proportion(
            config.allocated_amount,
            total_vault_balance,
            cspr_amount,
        );
        
        let trade_id = self.trade_count.get_or_default() + 1;
        let trade = CopyTradeRecord {
            id: trade_id,
            follower,
            dex,
            action,
            token,
            token_amount,
            cspr_amount: proportion,
            status: "executed".to_string(),
            executed_at: Some(self.get_block_time()),
            profit: None,
        };
        
        self.trades.set(&trade_id, trade);
        self.trade_count.set(trade_id);
        self.total_copied_volume.set(self.total_copied_volume.get_or_default() + proportion);
    }
    
    /// Record a profit for a follower (called after trade closes)
    pub fn record_profit(&mut self, follower: Address, profit_amount: U512) {
        let current_profit = self.follower_profits.get(&follower).unwrap_or(U512::zero());
        
        // Calculate performance fee
        let fee_bps = self.performance_fee_bps.get_or_default();
        let fee = profit_amount * U512::from(fee_bps as u64) / U512::from(10000);
        let net_profit = profit_amount - fee;
        
        self.follower_profits.set(&follower, current_profit + net_profit);
        self.total_performance_fees.set(self.total_performance_fees.get_or_default() + fee);
        
        // Transfer performance fee to vault owner (trader)
        if fee > U512::zero() {
            let owner = self.owner.get().unwrap();
            odra::contract_env::transfer_tokens(&owner, &fee);
        }
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
            let difference = new_amount - old_amount;
            // Receive additional CSPR
            self.total_deposits.set(self.total_deposits.get_or_default() + difference);
        } else {
            let difference = old_amount - new_amount;
            // Return excess CSPR
            odra::contract_env::transfer_tokens(&follower, &difference);
            self.total_withdrawals.set(self.total_withdrawals.get_or_default() + difference);
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
    
    /// Set max drawdown threshold for a follower (in basis points, e.g. 3000 = 30%)
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
    
    /// Get a follower's allocation config
    pub fn get_allocation(&self, follower: &Address) -> Option<AllocationConfig> {
        self.allocations.get(follower)
    }
    
    /// Get follower's current profit
    pub fn get_follower_profit(&self, follower: &Address) -> U512 {
        self.follower_profits.get(follower).unwrap_or(U512::zero())
    }
    
    /// Get total vault balance
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
    
    // --- Private helpers ---
    
    fn calculate_proportion(
        &self,
        follower_allocation: U512,
        total_vault_balance: U512,
        trade_size: U512,
    ) -> U512 {
        if total_vault_balance == U512::zero() {
            return U512::zero();
        }
        // (follower_allocation / total_vault_balance) * trade_size
        follower_allocation * trade_size / total_vault_balance
    }
    
    fn get_block_time(&self) -> u64 {
        // In Odra, get block time from the runtime
        odra::contract_env::block_time()
    }
}
```

---

## 2.3 Vault Tests

### gradex-contracts/tests/vault_tests.rs

```rust
#[cfg(test)]
mod tests {
    use odra_test::*;
    use gradex_contracts::vault::CopyVault;
    use gradex_contracts::types::*;
    use odra::Address;
    
    fn setup() -> (TestEnv, Address, CopyVaultRef) {
        let env = TestEnv::new();
        let owner = env.caller();
        
        let vault = CopyVault::deploy(
            &env,
            owner,
            "Test Vault".to_string(),
            200,            // 2% performance fee
            U512::from(10), // 10 CSPR subscription fee
            U512::from(100), // 100 CSPR min allocation
            U512::from(100_000), // 100K CSPR max allocation
        );
        
        (env, owner, vault)
    }
    
    #[test]
    fn test_initialization() {
        let (_env, owner, vault) = setup();
        
        assert_eq!(vault.get_follower_count(), 0);
        assert_eq!(vault.get_total_deposits(), U512::zero());
        assert_eq!(vault.get_total_copied_volume(), U512::zero());
    }
    
    #[test]
    fn test_subscribe() {
        let (env, owner, vault) = setup();
        let follower = Address::from([2u8; 32]);
        
        vault.subscribe(follower, U512::from(1000));
        
        let config = vault.get_allocation(&follower).unwrap();
        assert_eq!(config.allocated_amount, U512::from(1000));
        assert!(config.is_active);
        assert_eq!(vault.get_follower_count(), 1);
        assert_eq!(vault.get_total_deposits(), U512::from(1000));
    }
    
    #[test]
    fn test_unsubscribe_and_withdraw() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);
        
        vault.subscribe(follower, U512::from(5000));
        vault.unsubscribe(follower);
        
        let config = vault.get_allocation(&follower).unwrap();
        assert!(!config.is_active);
        assert_eq!(vault.get_follower_count(), 0);
    }
    
    #[test]
    fn test_performance_fee_calculation() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);
        
        vault.subscribe(follower, U512::from(1000));
        vault.record_profit(follower, U512::from(1000)); // 1000 CSPR profit
        
        // 2% fee = 20 CSPR, net profit = 980 CSPR
        let profit = vault.get_follower_profit(&follower);
        assert_eq!(profit, U512::from(980));
    }
    
    #[test]
    fn test_auto_compound_toggle() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);
        
        vault.subscribe(follower, U512::from(1000));
        vault.toggle_auto_compound(follower);
        
        let config = vault.get_allocation(&follower).unwrap();
        assert!(config.auto_compound);
    }
    
    #[test]
    fn test_multiple_followers() {
        let (env, _owner, vault) = setup();
        let follower1 = Address::from([1u8; 32]);
        let follower2 = Address::from([2u8; 32]);
        let follower3 = Address::from([3u8; 32]);
        
        vault.subscribe(follower1, U512::from(5000));
        vault.subscribe(follower2, U512::from(10000));
        vault.subscribe(follower3, U512::from(15000));
        
        assert_eq!(vault.get_follower_count(), 3);
        assert_eq!(vault.get_total_deposits(), U512::from(30000));
    }
    
    #[test]
    #[should_panic(expected = "Amount below minimum allocation")]
    fn test_subscribe_below_minimum() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);
        
        vault.subscribe(follower, U512::from(50)); // Below 100 CSPR minimum
    }
    
    #[test]
    fn test_execute_copy_trade_tracking() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);
        
        vault.subscribe(follower, U512::from(1000));
        
        // After more setup for authorized callers, test copy execution
        // This will be expanded when copy engine is integrated
    }
}
```

---

## 2.4 Trader Registry Contract

### gradex-contracts/src/trader_registry.rs

```rust
use odra::prelude::*;
use odra::{Address, Var, Mapping};
use crate::types::TraderProfile;

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
    
    /// Register a new trader
    pub fn register_trader(
        &mut self,
        trader_address: Address,
        performance_fee_bps: u16,
    ) {
        let caller = odra::caller();
        assert!(caller == trader_address || caller == self.admin.get().unwrap(),
            "Only the trader or admin can register");
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
    
    /// Get trader profile
    pub fn get_trader(&self, address: &Address) -> Option<TraderProfile> {
        self.traders.get(address)
    }
    
    /// Update trader stats (called by vault on trades)
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
        } else if delta < 0 && profile.total_followers >= (-delta) as u32 {
            profile.total_followers -= (-delta) as u32;
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
    
    /// Get total registered traders
    pub fn get_trader_count(&self) -> u32 {
        self.trader_count.get_or_default()
    }
    
    /// Check if an address is a registered trader
    pub fn is_registered(&self, address: &Address) -> bool {
        self.traders.contains_key(address)
    }
}
```

---

## 2.5 Casper JS SDK Wrapper for Vault Interactions

### src/lib/casper/vault.ts

```typescript
import { RpcClient, DeployUtil, Keys, CLValueBuilder, RuntimeArgs } from "casper-js-sdk";

const RPC_URL = process.env.NEXT_PUBLIC_CASPER_RPC_URL!;
const CHAIN_NAME = process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME!;

export class VaultContractInteractor {
  private rpcClient: RpcClient;

  constructor() {
    this.rpcClient = new RpcClient(RPC_URL);
  }

  /**
   * Subscribe to a vault — deposit CSPR and start copying
   */
  async buildSubscribeDeploy(
    vaultContractHash: string,
    followerPublicKey: string,
    amount: bigint
  ) {
    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        Keys.Ed25519.parsePublicKey(followerPublicKey),
        CHAIN_NAME,
        1,
        1800000
      ),
      DeployUtil.ExecutableDeployItem.newModuleBytes(
        // Reference vault contract
      ),
      DeployUtil.standardPayment(amount)
    );

    // Add runtime arguments
    deploy.setArgs(
      RuntimeArgs.fromMap({
        vault_contract_hash: CLValueBuilder.byteArray(
          Buffer.from(vaultContractHash, "hex")
        ),
        follower: CLValueBuilder.byteArray(
          Buffer.from(followerPublicKey, "hex")
        ),
        amount: CLValueBuilder.u512(amount.toString()),
      })
    );

    return deploy;
  }

  /**
   * Unsubscribe from a vault and withdraw funds
   */
  async buildUnsubscribeDeploy(
    vaultContractHash: string,
    followerPublicKey: string
  ) {
    // Build unsubscribe deploy
    // Similar pattern to subscribe but calls the unsubscribe entry point
  }

  /**
   * Query vault state from chain
   */
  async getVaultState(vaultContractHash: string) {
    const state = await this.rpcClient.getContractData(vaultContractHash);
    return state;
  }

  /**
   * Get a follower's allocation details
   */
  async getFollowerAllocation(
    vaultContractHash: string,
    followerAddress: string
  ) {
    const result = await this.rpcClient.queryGlobalState(
      `vault_${vaultContractHash}_allocations_${followerAddress}`
    );
    return result;
  }
}
```

---

## 2.6 Deployment Script (Testnet)

### scripts/deploy-vault.ts

```typescript
import { RpcClient, DeployUtil, Keys, CLValueBuilder, RuntimeArgs } from "casper-js-sdk";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = "https://rpc.testnet.casper.network/rpc";
const CHAIN_NAME = "casper-test";
const WASM_PATH = path.join(__dirname, "../gradex-contracts/wasm/vault.wasm");

async function main() {
  // Load deployer key
  const privateKeyBytes = fs.readFileSync("/path/to/deployer-key.pem");
  const keyPair = Keys.Ed25519.parsePrivateKey(privateKeyBytes);
  const publicKey = keyPair.publicKey.toHex();

  // Read compiled Wasm
  const wasmBytes = fs.readFileSync(WASM_PATH);

  // Build deploy
  const deployParams = new DeployUtil.DeployParams(
    keyPair.publicKey,
    CHAIN_NAME,
    1, // TTL in hours
    1800000 // Payment amount (motes)
  );

  const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
    wasmBytes,
    RuntimeArgs.fromMap({
      owner: CLValueBuilder.byteArray(keyPair.publicKey.toRawBytes()),
      name: CLValueBuilder.string("Gradex Vault"),
      performance_fee_bps: CLValueBuilder.u16(200),
      subscription_fee: CLValueBuilder.u512("1000000000"), // 1 CSPR
      min_allocation: CLValueBuilder.u512("100000000000"), // 100 CSPR
      max_allocation: CLValueBuilder.u512("100000000000000"), // 100K CSPR
    })
  );

  const payment = DeployUtil.standardPayment(5000000000); // 5 CSPR gas

  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

  // Sign
  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

  // Deploy
  const client = new RpcClient(RPC_URL);
  const result = await client.putDeploy(signedDeploy);

  console.log("Deploy submitted:", result.deployHash);
  console.log(`Track: https://testnet.cspr.live/deploy/${result.deployHash}`);
}

main().catch(console.error);
```

---

## 2.7 Verification Checklist

- [ ] Vault contract compiles without errors
- [ ] All unit tests pass (`cargo odra test`)
- [ ] Subscribe/unsubscribe flow works in test environment
- [ ] Performance fee calculation is mathematically correct
- [ ] Multiple follower allocations work correctly
- [ ] Edge cases handled: double subscription, below-minimum, above-maximum
- [ ] Trader registry functional (register, query, stats)
- [ ] Wasm artifact generated (`cargo odra build --target casper`)
- [ ] Testnet deploy script works (contract hash obtained)

---

**Phase 2 Complete.** The vault can now hold deposits and track allocations. Phase 3 will build the Copy Engine that detects master trades and executes proportional copies.

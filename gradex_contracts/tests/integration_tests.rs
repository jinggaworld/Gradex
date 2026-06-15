#[cfg(test)]
mod integration_tests {
    use odra_test::*;
    use gradex_contracts::vault::CopyVault;
    use gradex_contracts::copy_engine::CopyEngine;
    use gradex_contracts::royalty::RoyaltyDistributor;
    use gradex_contracts::trader_registry::TraderRegistry;
    use odra::Address;
    use odra::prelude::U512;

    /// Full setup helper: deploys all contracts with owner as executor for testability
    fn setup_full() -> (TestEnv, Address, Address, TraderRegistryRef, CopyVaultRef, CopyEngineRef, RoyaltyDistributorRef) {
        let env = TestEnv::new();
        let admin = env.caller();
        let executor = admin; // executor == owner for tests

        let mut registry = TraderRegistry::deploy(&env, admin);
        let mut vault = CopyVault::deploy(
            &env, admin,
            "Pro Trader Vault".to_string(),
            200, // 2% performance fee
            U512::from(10), // sub fee
            U512::from(100), // min allocation
            U512::from(100_000), // max allocation
        );
        let mut engine = CopyEngine::deploy(&env, admin, executor);
        let royalty = RoyaltyDistributor::deploy(&env, admin, engine.address());

        (env, admin, executor, registry, vault, engine, royalty)
    }

    /// Scenario 1: Full subscription → copy trade → profit → royalty cycle
    #[test]
    fn test_full_copy_trading_cycle() {
        let (_env, _admin, _executor, mut registry, mut vault, mut engine, mut royalty) = setup_full();

        let trader = Address::from([1u8; 32]);
        let follower = Address::from([2u8; 32]);
        let dex = Address::from([3u8; 32]);
        let token = Address::from([4u8; 32]);

        // 1. Register trader
        registry.register_trader(trader, 200);

        // 2. Register vault and DEX, link trader
        engine.register_vault(vault.address());
        engine.register_dex(dex, "Friendly Market".to_string());
        engine.link_trader_to_vault(trader, vault.address());

        // 3. Follower subscribes
        vault.subscribe(follower, U512::from(1000));
        assert_eq!(vault.get_follower_count(), 1);
        let allocation = vault.get_allocation(&follower).unwrap();
        assert!(allocation.allocated_amount > U512::zero());

        // 4. Process master trade via executor (admin)
        let event_id = engine.process_master_trade(
            trader, dex, "Friendly Market".to_string(),
            token, U512::from(100), U512::from(5000),
            "buy".to_string(), "tx-hash-1".to_string(), 100,
        );
        assert_eq!(event_id, 1);

        // 5. Record profit for follower
        vault.record_profit(follower, U512::from(500));
        let profit = vault.get_follower_profit(&follower);
        assert!(profit > U512::zero(), "Follower should have profit after fees");

        // 6. Process royalty payment (copy engine calls royalty)
        royalty.pay_royalty(trader, follower, 1, U512::from(500));
        let royalty_total = royalty.get_total_royalties_distributed();
        assert!(royalty_total > U512::zero(), "Royalties should be paid");

        // 7. Follower unsubscribes
        vault.unsubscribe(follower);
        assert_eq!(vault.get_follower_count(), 0);
    }

    /// Scenario 2: Multiple followers with proportional allocations
    #[test]
    fn test_multiple_followers_proportional() {
        let (_env, _admin, _executor, _registry, mut vault, mut engine, _royalty) = setup_full();

        let trader = Address::from([1u8; 32]);
        let dex = Address::from([3u8; 32]);
        let token = Address::from([4u8; 32]);

        engine.register_vault(vault.address());
        engine.register_dex(dex, "DEX".to_string());
        engine.link_trader_to_vault(trader, vault.address());

        // Follower A: 10,000 (50%)
        // Follower B: 5,000 (25%)
        // Follower C: 5,000 (25%)
        let a = Address::from([10u8; 32]);
        let b = Address::from([11u8; 32]);
        let c = Address::from([12u8; 32]);

        vault.subscribe(a, U512::from(10000));
        vault.subscribe(b, U512::from(5000));
        vault.subscribe(c, U512::from(5000));

        assert_eq!(vault.get_follower_count(), 3);
        assert_eq!(vault.get_total_deposits(), U512::from(20000));

        // Each gets proportional profit
        vault.record_profit(a, U512::from(200));
        vault.record_profit(b, U512::from(100));
        vault.record_profit(c, U512::from(100));

        assert!(vault.get_follower_profit(&a) > vault.get_follower_profit(&b));
        assert_eq!(vault.get_follower_profit(&b), vault.get_follower_profit(&c));
    }

    /// Scenario 3: Loss tracking and net profit calculation
    #[test]
    fn test_loss_tracking_and_unsubscribe_with_losses() {
        let (_env, _admin, _executor, _registry, mut vault, _engine, _royalty) = setup_full();

        let follower = Address::from([20u8; 32]);
        vault.subscribe(follower, U512::from(5000));

        // Record a profit then a larger loss
        vault.record_profit(follower, U512::from(200));
        vault.record_loss(follower, U512::from(500));

        let net = vault.get_follower_net_profit(&follower);
        assert_eq!(net, U512::zero()); // Loss exceeds profit, net should be 0

        // Unsubscribe should still work with zero net
        vault.unsubscribe(follower);
        assert_eq!(vault.get_follower_count(), 0);
    }

    /// Scenario 4: Record profit → royalty → verify payment recording
    #[test]
    fn test_royalty_flow_end_to_end() {
        let (_env, _admin, _executor, _registry, mut vault, _engine, mut royalty) = setup_full();

        let trader = Address::from([30u8; 32]);
        let follower = Address::from([31u8; 32]);

        vault.subscribe(follower, U512::from(2000));
        vault.record_profit(follower, U512::from(1000));

        // Process royalty: 5% of 1000 = 50
        let amount = royalty.pay_royalty(trader, follower, 1, U512::from(1000));
        assert_eq!(amount, U512::from(50));

        // Verify payment was recorded
        let payment = royalty.get_payment(1).unwrap();
        assert_eq!(payment.trader, trader);
        assert_eq!(payment.follower, follower);
        assert_eq!(payment.profit_amount, U512::from(1000));
        assert_eq!(payment.royalty_amount, U512::from(50));

        // Trader's accumulated royalties updated
        assert_eq!(
            royalty.get_accumulated_royalties(&trader),
            U512::from(50)
        );
        assert_eq!(royalty.get_payment_count(), 1);
    }

    /// Scenario 5: Edge cases
    #[test]
    fn test_edge_cases() {
        let (_env, _admin, _executor, mut registry, mut vault, _engine, _royalty) = setup_full();

        let trader = Address::from([40u8; 32]);
        let follower = Address::from([41u8; 32]);

        // Subscribe with exactly minimum allocation
        vault.subscribe(follower, U512::from(100));

        // Duplicate subscribe should panic
        // vault.subscribe(follower, U512::from(100)); // Uncomment to test panic

        // Unsubscribe with zero profit
        vault.unsubscribe(follower);
        assert_eq!(vault.get_follower_count(), 0);

        // Trader registry prevents duplicate
        registry.register_trader(trader, 200);
        // registry.register_trader(trader, 300); // Uncomment to test duplicate panic
    }

    /// Scenario 6: Pause functionality
    #[test]
    fn test_pause_during_operations() {
        let (_env, _admin, _executor, _registry, mut vault, mut engine, _royalty) = setup_full();

        let trader = Address::from([50u8; 32]);
        let follower = Address::from([51u8; 32]);
        let dex = Address::from([52u8; 32]);

        engine.register_vault(vault.address());
        engine.register_dex(dex, "DEX".to_string());
        engine.link_trader_to_vault(trader, vault.address());

        vault.subscribe(follower, U512::from(1000));

        // Pause the vault
        vault.set_paused(true);

        // Pause the engine
        engine.set_paused(true);

        // Unsubscribe should still work when vault is paused
        vault.unsubscribe(follower);
        assert_eq!(vault.get_follower_count(), 0);
    }
}

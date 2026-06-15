#[cfg(test)]
mod tests {
    use odra_test::*;
    use gradex_contracts::copy_engine::CopyEngine;
    use odra::Address;
    use odra::prelude::U512;

    /// Default setup: owner = executor so executor-gated methods work with env.caller()
    fn setup() -> (TestEnv, Address, Address, CopyEngineRef) {
        let env = TestEnv::new();
        let owner = env.caller();
        let executor = owner; // Executor == owner so tests can call executor-gated methods

        let engine = CopyEngine::deploy(&env, owner, executor);

        (env, owner, executor, engine)
    }

    /// Setup where executor is a different address — used for access-control tests
    fn setup_separate_executor() -> (TestEnv, Address, Address, CopyEngineRef) {
        let env = TestEnv::new();
        let owner = env.caller();
        let executor = Address::from([42u8; 32]);

        let engine = CopyEngine::deploy(&env, owner, executor);

        (env, owner, executor, engine)
    }

    #[test]
    fn test_initialization() {
        let (_env, _owner, executor, engine) = setup();
        assert_eq!(engine.get_copy_trade_count(), 0);
        assert_eq!(engine.get_event_count(), 0);
        assert!(!engine.get_is_paused());
        assert_eq!(engine.get_authorized_executor(), executor);
    }

    #[test]
    fn test_register_vault() {
        let (env, owner, _executor, mut engine) = setup();
        let vault = Address::from([10u8; 32]);

        engine.register_vault(vault);
        assert!(engine.is_vault_registered(&vault));
    }

    #[test]
    fn test_unregister_vault() {
        let (env, owner, _executor, mut engine) = setup();
        let vault = Address::from([10u8; 32]);

        engine.register_vault(vault);
        engine.unregister_vault(vault);
        assert!(!engine.is_vault_registered(&vault));
    }

    #[test]
    fn test_register_dex() {
        let (env, owner, _executor, mut engine) = setup();
        let dex = Address::from([20u8; 32]);

        engine.register_dex(dex, "Friendly Market".to_string());
        assert!(engine.is_dex_registered(&dex));
    }

    #[test]
    fn test_unregister_dex() {
        let (env, owner, _executor, mut engine) = setup();
        let dex = Address::from([20u8; 32]);

        engine.register_dex(dex, "Friendly Market".to_string());
        engine.unregister_dex(dex);
        assert!(!engine.is_dex_registered(&dex));
    }

    #[test]
    fn test_link_trader_to_vault() {
        let (env, _owner, _executor, mut engine) = setup();
        let trader = Address::from([30u8; 32]);
        let vault = Address::from([31u8; 32]);

        engine.register_vault(vault);
        engine.link_trader_to_vault(trader, vault);

        let vaults = engine.get_trader_vaults(&trader);
        assert_eq!(vaults.len(), 1);
        assert_eq!(vaults[0], vault);
    }

    #[test]
    fn test_unlink_trader_from_vault() {
        let (env, _owner, _executor, mut engine) = setup();
        let trader = Address::from([30u8; 32]);
        let vault1 = Address::from([31u8; 32]);
        let vault2 = Address::from([32u8; 32]);

        engine.register_vault(vault1);
        engine.register_vault(vault2);
        engine.link_trader_to_vault(trader, vault1);
        engine.link_trader_to_vault(trader, vault2);
        engine.unlink_trader_from_vault(trader, vault1);

        let vaults = engine.get_trader_vaults(&trader);
        assert_eq!(vaults.len(), 1);
        assert_eq!(vaults[0], vault2);
    }

    #[test]
    fn test_process_master_trade() {
        let (env, _owner, _executor, mut engine) = setup();
        let trader = Address::from([30u8; 32]);
        let vault = Address::from([31u8; 32]);
        let dex = Address::from([20u8; 32]);
        let token = Address::from([40u8; 32]);

        engine.register_vault(vault);
        engine.register_dex(dex, "Friendly Market".to_string());
        engine.link_trader_to_vault(trader, vault);

        // Caller is owner which is also executor — no authorization issue
        let event_id = engine.process_master_trade(
            trader,
            dex,
            "Friendly Market".to_string(),
            token,
            U512::from(1000_000_000_000),
            U512::from(50_000_000_000),
            "buy".to_string(),
            "original-tx-hash-123".to_string(),
            100,
        );

        assert_eq!(event_id, 1);
        assert_eq!(engine.get_event_count(), 1);

        let event = engine.get_master_event(event_id).unwrap();
        assert_eq!(event.trader, trader);
        assert_eq!(event.dex_name, "Friendly Market");
        assert!(event.processed);
    }

    #[test]
    #[should_panic(expected = "Only authorized executor")]
    fn test_unauthorized_cannot_process_trade() {
        let (_env, _owner, _executor, mut engine) = setup_separate_executor();
        let trader = Address::from([30u8; 32]);
        let vault = Address::from([31u8; 32]);
        let dex = Address::from([20u8; 32]);
        let token = Address::from([40u8; 32]);

        engine.register_vault(vault);
        engine.register_dex(dex, "DEX".to_string());
        engine.link_trader_to_vault(trader, vault);

        // env.caller() is the deployer (owner), not executor (which is [42u8; 32])
        // This should fail with "Only authorized executor"
        engine.process_master_trade(
            trader, dex, "DEX".to_string(), token,
            U512::from(1000), U512::from(5000),
            "buy".to_string(), "tx".to_string(), 100,
        );
    }

    #[test]
    #[should_panic(expected = "Trade below minimum size")]
    fn test_reject_small_trade() {
        let (env, _owner, executor, mut engine) = setup();
        let trader = Address::from([30u8; 32]);
        let vault = Address::from([31u8; 32]);
        let dex = Address::from([20u8; 32]);
        let token = Address::from([40u8; 32]);

        engine.register_vault(vault);
        engine.register_dex(dex, "DEX".to_string());
        engine.link_trader_to_vault(trader, vault);

        engine.process_master_trade(
            trader, dex, "DEX".to_string(), token,
            U512::from(1), U512::from(1), // Below min trade size
            "buy".to_string(), "tx".to_string(), 100,
        );
    }

    #[test]
    fn test_confirm_copy_trade() {
        let (env, _owner, executor, mut engine) = setup();
        let follower = Address::from([50u8; 32]);
        let trader = Address::from([30u8; 32]);

        let trade_id = engine.confirm_copy_trade(
            follower,
            trader,
            "orig-tx".to_string(),
            "copy-tx-1".to_string(),
            "Friendly Market".to_string(),
            "buy".to_string(),
            "CSPR".to_string(),
            U512::from(100),
            U512::from(500),
            "executed".to_string(),
        );

        assert_eq!(trade_id, 1);
        assert_eq!(engine.get_copy_trade_count(), 1);

        let trade = engine.get_copy_trade(trade_id).unwrap();
        assert_eq!(trade.follower, follower);
        assert_eq!(trade.status, "executed");
    }

    #[test]
    fn test_report_trade_profit() {
        let (env, _owner, executor, mut engine) = setup();
        let follower = Address::from([50u8; 32]);
        let trader = Address::from([30u8; 32]);

        let trade_id = engine.confirm_copy_trade(
            follower, trader,
            "orig-tx".to_string(), "copy-tx-1".to_string(),
            "Friendly Market".to_string(), "buy".to_string(),
            "CSPR".to_string(), U512::from(100), U512::from(500),
            "executed".to_string(),
        );

        engine.report_trade_profit(trade_id, U512::from(50));

        let trade = engine.get_copy_trade(trade_id).unwrap();
        assert_eq!(trade.profit, Some(U512::from(50)));
    }

    #[test]
    fn test_set_min_trade_size() {
        let (env, owner, _executor, mut engine) = setup();

        engine.set_min_trade_size(U512::from(100_000_000_000));
        assert_eq!(engine.get_min_trade_size(), U512::from(100_000_000_000));
    }

    #[test]
    fn test_set_engine_fee() {
        let (env, owner, _executor, mut engine) = setup();

        engine.set_engine_fee(100);
        assert_eq!(engine.get_engine_fee(), 100);
    }

    #[test]
    #[should_panic(expected = "Engine fee cannot exceed 5%")]
    fn test_engine_fee_too_high() {
        let (env, owner, _executor, mut engine) = setup();
        engine.set_engine_fee(1000);
    }

    #[test]
    fn test_pause_and_resume() {
        let (env, owner, _executor, mut engine) = setup();

        engine.set_paused(true);
        assert!(engine.get_is_paused());

        engine.set_paused(false);
        assert!(!engine.get_is_paused());
    }

    #[test]
    fn test_set_authorized_executor() {
        let (env, owner, _executor, mut engine) = setup();
        let new_executor = Address::from([99u8; 32]);

        engine.set_authorized_executor(new_executor);
        assert_eq!(engine.get_authorized_executor(), new_executor);
    }

    #[test]
    fn test_batch_confirm_copy_trades() {
        let (env, _owner, executor, mut engine) = setup();
        let follower1 = Address::from([50u8; 32]);
        let follower2 = Address::from([51u8; 32]);
        let trader = Address::from([30u8; 32]);

        let trades = vec![
            (follower1, trader, "otx1".to_string(), "ctx1".to_string(), "DEX".to_string(), "buy".to_string(), "CSPR".to_string(), U512::from(100), U512::from(500), "executed".to_string()),
            (follower2, trader, "otx2".to_string(), "ctx2".to_string(), "DEX".to_string(), "sell".to_string(), "CSPR".to_string(), U512::from(200), U512::from(1000), "executed".to_string()),
        ];

        let trade_ids = engine.batch_confirm_copy_trades(trades);
        assert_eq!(trade_ids.len(), 2);
        assert_eq!(engine.get_copy_trade_count(), 2);
    }

    #[test]
    fn test_multiple_vaults_for_trader() {
        let (env, _owner, _executor, mut engine) = setup();
        let trader = Address::from([30u8; 32]);
        let v1 = Address::from([31u8; 32]);
        let v2 = Address::from([32u8; 32]);

        engine.register_vault(v1);
        engine.register_vault(v2);
        engine.link_trader_to_vault(trader, v1);
        engine.link_trader_to_vault(trader, v2);

        let vaults = engine.get_trader_vaults(&trader);
        assert_eq!(vaults.len(), 2);
    }

    #[test]
    fn test_trader_can_link_own_vault() {
        let (env, _owner, _executor, mut engine) = setup();
        let trader = Address::from([30u8; 32]);
        let vault = Address::from([31u8; 32]);

        engine.register_vault(vault);
        // trader linking their own vault should work
        engine.link_trader_to_vault(trader, vault);

        let vaults = engine.get_trader_vaults(&trader);
        assert_eq!(vaults.len(), 1);
    }

    #[test]
    fn test_vault_not_registered_is_not_recognized() {
        let (env, _owner, _executor, mut engine) = setup();
        let unregistered = Address::from([99u8; 32]);

        assert!(!engine.is_vault_registered(&unregistered));
    }

    #[test]
    fn test_dex_not_registered_is_not_recognized() {
        let (env, _owner, _executor, mut engine) = setup();
        let unknown_dex = Address::from([88u8; 32]);

        assert!(!engine.is_dex_registered(&unknown_dex));
    }
}

#[cfg(test)]
mod tests {
    use odra_test::*;
    use gradex_contracts::royalty::RoyaltyDistributor;
    use odra::Address;
    use odra::prelude::U512;
    use odra::prelude::U256;

    /// Default setup: copy_engine == owner so engine-gated methods work with env.caller()
    fn setup() -> (TestEnv, Address, Address, RoyaltyDistributorRef) {
        let env = TestEnv::new();
        let owner = env.caller();
        let copy_engine = owner; // Engine == owner for tests

        let royalty = RoyaltyDistributor::deploy(&env, owner, copy_engine);

        (env, owner, copy_engine, royalty)
    }

    /// Setup with separate copy engine address for access control tests
    fn setup_separate_engine() -> (TestEnv, Address, Address, RoyaltyDistributorRef) {
        let env = TestEnv::new();
        let owner = env.caller();
        let copy_engine = Address::from([42u8; 32]); // Separate engine address

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
        assert_eq!(royalty.get_default_royalty_rate(), 500);
        assert!(!royalty.get_is_paused());
    }

    #[test]
    fn test_set_default_royalty_rate() {
        let (_env, _owner, _engine, mut royalty) = setup();

        royalty.set_default_royalty_rate(1000); // 10%
        assert_eq!(royalty.get_default_royalty_rate(), 1000);
    }

    #[test]
    #[should_panic(expected = "Rate cannot exceed 20%")]
    fn test_reject_rate_above_20_percent() {
        let (_env, _owner, _engine, mut royalty) = setup();
        royalty.set_default_royalty_rate(2500); // 25% - should fail
    }

    #[test]
    fn test_set_trader_royalty_rate() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);

        royalty.set_trader_royalty_rate(trader, 1000); // 10%

        let rate = royalty.get_trader_royalty_rate(&trader);
        assert_eq!(rate, Some(1000));
        assert_eq!(royalty.get_effective_rate(&trader), 1000);
    }

    #[test]
    fn test_default_rate_for_unconfigured_trader() {
        let (_env, _owner, _engine, royalty) = setup();
        let unknown = Address::from([99u8; 32]);

        // No custom rate set, should return default (500 = 5%)
        assert_eq!(royalty.get_effective_rate(&unknown), 500);
    }

    #[test]
    fn test_pay_royalty() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        let follower = Address::from([20u8; 32]);

        // Process a royalty payment: 5% of 10000 = 500
        let amount = royalty.pay_royalty(trader, follower, 1, U512::from(10000));

        assert_eq!(amount, U512::from(500));
        assert_eq!(royalty.get_payment_count(), 1);
        assert_eq!(
            royalty.get_total_royalties_distributed(),
            U512::from(500)
        );
    }

    #[test]
    fn test_payment_record() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        let follower = Address::from([20u8; 32]);

        royalty.pay_royalty(trader, follower, 1, U512::from(10000));

        let payment = royalty.get_payment(1).unwrap();
        assert_eq!(payment.trader, trader);
        assert_eq!(payment.follower, follower);
        assert_eq!(payment.vault_id, 1);
        assert_eq!(payment.profit_amount, U512::from(10000));
        assert_eq!(payment.royalty_amount, U512::from(500));
        assert!(payment.paid_at > 0);
    }

    #[test]
    fn test_accumulated_royalties() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        let follower = Address::from([20u8; 32]);

        // First payment: 5% of 10000 = 500
        royalty.pay_royalty(trader, follower, 1, U512::from(10000));
        assert_eq!(
            royalty.get_accumulated_royalties(&trader),
            U512::from(500)
        );

        // Second payment: 5% of 50000 = 2500
        royalty.pay_royalty(trader, follower, 1, U512::from(50000));
        assert_eq!(
            royalty.get_accumulated_royalties(&trader),
            U512::from(3000) // 500 + 2500
        );
    }

    #[test]
    fn test_multiple_traders_accumulate_independently() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader1 = Address::from([10u8; 32]);
        let trader2 = Address::from([11u8; 32]);
        let follower = Address::from([20u8; 32]);

        royalty.pay_royalty(trader1, follower, 1, U512::from(10000)); // 500
        royalty.pay_royalty(trader2, follower, 1, U512::from(20000)); // 1000

        assert_eq!(royalty.get_accumulated_royalties(&trader1), U512::from(500));
        assert_eq!(royalty.get_accumulated_royalties(&trader2), U512::from(1000));
    }

    #[test]
    fn test_trader_payment_history() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        let follower = Address::from([20u8; 32]);

        royalty.pay_royalty(trader, follower, 1, U512::from(10000));
        royalty.pay_royalty(trader, follower, 1, U512::from(20000));

        let history = royalty.get_trader_payment_ids(&trader);
        assert_eq!(history.len(), 2);
        assert_eq!(history[0], 1);
        assert_eq!(history[1], 2);
    }

    #[test]
    fn test_custom_rate_payment() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        let follower = Address::from([20u8; 32]);

        // Set custom 10% rate
        royalty.set_trader_royalty_rate(trader, 1000);

        // 10% of 10000 = 1000
        let amount = royalty.pay_royalty(trader, follower, 1, U512::from(10000));
        assert_eq!(amount, U512::from(1000));
    }

    #[test]
    fn test_register_vault() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let vault = Address::from([30u8; 32]);

        royalty.register_vault(vault);
        assert!(royalty.is_vault_registered(&vault));
    }

    #[test]
    fn test_unregister_vault() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let vault = Address::from([30u8; 32]);

        royalty.register_vault(vault);
        royalty.unregister_vault(vault);
        assert!(!royalty.is_vault_registered(&vault));
    }

    #[test]
    fn test_pause_and_resume() {
        let (_env, _owner, _engine, mut royalty) = setup();

        assert!(!royalty.get_is_paused());
        royalty.set_paused(true);
        assert!(royalty.get_is_paused());
        royalty.set_paused(false);
        assert!(!royalty.get_is_paused());
    }

    #[test]
    fn test_batch_payments() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader1 = Address::from([10u8; 32]);
        let trader2 = Address::from([11u8; 32]);
        let follower = Address::from([20u8; 32]);

        let payments = vec![
            (trader1, follower, 1, U512::from(10000)), // 5% = 500
            (trader2, follower, 1, U512::from(20000)), // 5% = 1000
        ];

        let total = royalty.process_batch_royalty_payments(payments);
        assert_eq!(total, U512::from(1500)); // 500 + 1000
        assert_eq!(royalty.get_payment_count(), 2);
    }

    #[test]
    fn test_set_accumulated_royalties_persist_across_batches() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let trader = Address::from([10u8; 32]);
        let follower = Address::from([20u8; 32]);

        // Single + batch
        royalty.pay_royalty(trader, follower, 1, U512::from(10000)); // 500

        let payments = vec![
            (trader, follower, 1, U512::from(50000)), // 2500
        ];
        royalty.process_batch_royalty_payments(payments);

        assert_eq!(royalty.get_accumulated_royalties(&trader), U512::from(3000));
        assert_eq!(royalty.get_total_royalties_distributed(), U512::from(3000));
    }

    #[test]
    fn test_set_copy_engine() {
        let (_env, _owner, _engine, mut royalty) = setup();
        let new_engine = Address::from([99u8; 32]);

        royalty.set_copy_engine(new_engine);
        assert_eq!(royalty.get_copy_engine(), new_engine);
    }

    // ═══════════════════════════════════════════════════
    //  ACCESS CONTROL TESTS
    // ═══════════════════════════════════════════════════

    #[test]
    #[should_panic(expected = "Only authorized copy engine")]
    fn test_unauthorized_cannot_pay_royalty() {
        let (_env, _owner, _engine, mut royalty) = setup_separate_engine();
        // env.caller() is owner, not the separate copy engine
        // This should fail
        royalty.pay_royalty(
            Address::from([10u8; 32]),
            Address::from([20u8; 32]),
            1,
            U512::from(10000),
        );
    }

    #[test]
    #[should_panic(expected = "Profit must be positive")]
    fn test_reject_zero_profit() {
        let (_env, _owner, _engine, mut royalty) = setup();
        // Processing with zero profit should fail
        royalty.pay_royalty(
            Address::from([10u8; 32]),
            Address::from([20u8; 32]),
            1,
            U512::zero(),
        );
    }

    #[test]
    #[should_panic(expected = "System is paused")]
    fn test_reject_payment_when_paused() {
        let (_env, _owner, _engine, mut royalty) = setup();

        royalty.set_paused(true);

        royalty.pay_royalty(
            Address::from([10u8; 32]),
            Address::from([20u8; 32]),
            1,
            U512::from(10000),
        );
    }

    #[test]
    fn test_no_payment_history_for_new_trader() {
        let (_env, _owner, _engine, royalty) = setup();
        let unknown = Address::from([99u8; 32]);

        let history = royalty.get_trader_payment_ids(&unknown);
        assert!(history.is_empty());
    }
}

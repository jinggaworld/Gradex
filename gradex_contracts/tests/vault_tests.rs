#[cfg(test)]
mod tests {
    use odra_test::*;
    use gradex_contracts::vault::CopyVault;
    use gradex_contracts::types::AllocationConfig;
    use odra::Address;
    use odra::prelude::U512;
    use odra::types::U256;

    fn setup() -> (TestEnv, Address, CopyVaultRef) {
        let env = TestEnv::new();
        let owner = env.caller();

        let vault = CopyVault::deploy(
            &env,
            owner,
            "Test Vault".to_string(),
            200,
            U512::from(10),
            U512::from(100),
            U512::from(100_000),
        );

        (env, owner, vault)
    }

    #[test]
    fn test_initialization() {
        let (_env, owner, vault) = setup();
        assert_eq!(vault.get_follower_count(), 0);
        assert_eq!(vault.get_total_deposits(), U512::zero());
        assert_eq!(vault.get_total_copied_volume(), U512::zero());
        assert_eq!(vault.get_owner(), owner);
        assert_eq!(vault.get_vault_name(), "Test Vault");
    }

    #[test]
    fn test_subscribe() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(1000));

        let config = vault.get_allocation(&follower).unwrap();
        assert_eq!(config.allocated_amount, U512::from(1000));
        assert!(config.is_active);
        assert_eq!(vault.get_follower_count(), 1);
    }

    #[test]
    fn test_unsubscribe() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(5000));
        vault.unsubscribe(follower);

        let config = vault.get_allocation(&follower).unwrap();
        assert!(!config.is_active);
        assert_eq!(vault.get_follower_count(), 0);
    }

    #[test]
    #[should_panic(expected = "Already unsubscribed")]
    fn test_double_unsubscribe() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(5000));
        vault.unsubscribe(follower);
        vault.unsubscribe(follower);
    }

    #[test]
    #[should_panic(expected = "Not subscribed")]
    fn test_unsubscribe_non_follower() {
        let (env, _owner, vault) = setup();
        vault.unsubscribe(Address::from([99u8; 32]));
    }

    #[test]
    fn test_performance_fee() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(1000));
        vault.record_profit(follower, U512::from(1000));

        // 2% of 1000 = 20 fee, net = 980
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
    fn test_set_max_drawdown() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(1000));
        vault.set_max_drawdown(follower, U256::from(3000));

        let config = vault.get_allocation(&follower).unwrap();
        assert_eq!(config.max_drawdown, U256::from(3000));
    }

    #[test]
    fn test_multiple_followers() {
        let (env, _owner, vault) = setup();
        let f1 = Address::from([1u8; 32]);
        let f2 = Address::from([2u8; 32]);
        let f3 = Address::from([3u8; 32]);

        vault.subscribe(f1, U512::from(5000));
        vault.subscribe(f2, U512::from(10000));
        vault.subscribe(f3, U512::from(15000));

        assert_eq!(vault.get_follower_count(), 3);
        assert_eq!(vault.get_total_deposits(), U512::from(30000));
    }

    #[test]
    #[should_panic(expected = "Amount below minimum allocation")]
    fn test_subscribe_below_minimum() {
        let (env, _owner, vault) = setup();
        vault.subscribe(Address::from([2u8; 32]), U512::from(50));
    }

    #[test]
    fn test_update_allocation_increase() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(1000));
        vault.update_allocation(follower, U512::from(2000));

        let config = vault.get_allocation(&follower).unwrap();
        assert_eq!(config.allocated_amount, U512::from(2000));
    }

    #[test]
    fn test_update_allocation_decrease() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(5000));
        vault.update_allocation(follower, U512::from(2000));

        let config = vault.get_allocation(&follower).unwrap();
        assert_eq!(config.allocated_amount, U512::from(2000));
    }

    #[test]
    fn test_record_loss() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(1000));
        vault.record_profit(follower, U512::from(500));
        vault.record_loss(follower, U512::from(200));

        // get_follower_profit returns profit after 2% fee (490)
        let gross_profit = vault.get_follower_profit(&follower);
        assert_eq!(gross_profit, U512::from(490));

        // get_follower_net_profit returns profit after fees AND losses (490 - 200 = 290)
        let net_profit = vault.get_follower_net_profit(&follower);
        assert_eq!(net_profit, U512::from(290));
    }

    #[test]
    fn test_vault_state() {
        let (env, _owner, vault) = setup();
        let follower = Address::from([2u8; 32]);

        vault.subscribe(follower, U512::from(1000));
        let state = vault.get_vault_state();

        assert_eq!(state.total_deposits, U512::from(1000));
        assert_eq!(state.follower_count, 1);
        assert!(!state.is_paused);
    }

    #[test]
    fn test_pause_and_resume() {
        let (env, owner, vault) = setup();

        vault.set_paused(true);
        assert!(vault.get_vault_state().is_paused);

        vault.set_paused(false);
        assert!(!vault.get_vault_state().is_paused);
    }

    #[test]
    #[should_panic(expected = "Only vault owner can pause")]
    fn test_non_owner_cannot_pause() {
        let (env, _owner, vault) = setup();
        // Caller is the test env default, not the owner address
        // The test env default != owner, so this should fail
        vault.set_paused(true);
    }

    #[test]
    fn test_calculate_proportion() {
        let (env, _owner, vault) = setup();

        let proportion = vault.calculate_proportion(
            U512::from(1000),
            U512::from(10000),
            U512::from(5000),
        );
        assert_eq!(proportion, U512::from(500));
    }

    #[test]
    fn test_calculate_proportion_zero_balance() {
        let (env, _owner, vault) = setup();

        let proportion = vault.calculate_proportion(
            U512::from(1000),
            U512::zero(),
            U512::from(5000),
        );
        assert_eq!(proportion, U512::zero());
    }
}

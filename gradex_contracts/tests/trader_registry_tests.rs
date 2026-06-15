#[cfg(test)]
mod tests {
    use odra_test::*;
    use gradex_contracts::trader_registry::TraderRegistry;
    use odra::Address;
    use odra::prelude::U512;

    fn setup() -> (TestEnv, Address, TraderRegistryRef) {
        let env = TestEnv::new();
        let admin = env.caller();
        let registry = TraderRegistry::deploy(&env, admin);
        (env, admin, registry)
    }

    #[test]
    fn test_initialization() {
        let (_env, admin, registry) = setup();
        assert_eq!(registry.get_trader_count(), 0);
        assert_eq!(registry.get_admin(), admin);
    }

    #[test]
    fn test_register_trader() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        registry.register_trader(trader, 200);

        let profile = registry.get_trader(&trader).unwrap();
        assert!(profile.is_registered);
        assert_eq!(profile.performance_fee_bps, 200);
        assert_eq!(profile.total_followers, 0);
        assert_eq!(profile.total_volume, U512::zero());
        assert_eq!(registry.get_trader_count(), 1);
    }

    #[test]
    fn test_unregister_trader() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        registry.register_trader(trader, 200);
        registry.unregister_trader(trader);

        let profile = registry.get_trader(&trader).unwrap();
        assert!(!profile.is_registered);
        assert_eq!(registry.get_trader_count(), 0);
    }

    #[test]
    fn test_is_registered() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        assert!(!registry.is_registered(&trader));
        registry.register_trader(trader, 200);
        assert!(registry.is_registered(&trader));
    }

    #[test]
    fn test_is_active() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        assert!(!registry.is_active(&trader));
        registry.register_trader(trader, 200);
        assert!(registry.is_active(&trader));
        registry.unregister_trader(trader);
        assert!(!registry.is_active(&trader));
    }

    #[test]
    fn test_update_follower_count_increase() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        registry.register_trader(trader, 200);
        registry.update_follower_count(&trader, 5);

        let profile = registry.get_trader(&trader).unwrap();
        assert_eq!(profile.total_followers, 5);
    }

    #[test]
    fn test_update_follower_count_decrease() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        registry.register_trader(trader, 200);
        registry.update_follower_count(&trader, 5);
        registry.update_follower_count(&trader, -3);

        let profile = registry.get_trader(&trader).unwrap();
        assert_eq!(profile.total_followers, 2);
    }

    #[test]
    fn test_update_trader_volume() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        registry.register_trader(trader, 200);
        registry.update_trader_volume(&trader, U512::from(10000));

        let profile = registry.get_trader(&trader).unwrap();
        assert_eq!(profile.total_volume, U512::from(10000));
    }

    #[test]
    fn test_add_royalty() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        registry.register_trader(trader, 200);
        registry.add_royalty(&trader, U512::from(500));

        let profile = registry.get_trader(&trader).unwrap();
        assert_eq!(profile.total_royalties_earned, U512::from(500));
    }

    #[test]
    fn test_update_performance_fee() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        registry.register_trader(trader, 200);
        registry.update_performance_fee(&trader, 500);

        let profile = registry.get_trader(&trader).unwrap();
        assert_eq!(profile.performance_fee_bps, 500);
    }

    #[test]
    fn test_multiple_traders() {
        let (env, _admin, mut registry) = setup();
        let t1 = Address::from([1u8; 32]);
        let t2 = Address::from([2u8; 32]);
        let t3 = Address::from([3u8; 32]);

        registry.register_trader(t1, 100);
        registry.register_trader(t2, 200);
        registry.register_trader(t3, 300);

        assert_eq!(registry.get_trader_count(), 3);
    }

    #[test]
    #[should_panic(expected = "Already registered")]
    fn test_duplicate_registration() {
        let (env, _admin, mut registry) = setup();
        let trader = Address::from([1u8; 32]);

        registry.register_trader(trader, 200);
        registry.register_trader(trader, 300);
    }

    #[test]
    #[should_panic(expected = "Fee too high")]
    fn test_fee_too_high() {
        let (env, _admin, mut registry) = setup();
        registry.register_trader(Address::from([1u8; 32]), 2000);
    }
}

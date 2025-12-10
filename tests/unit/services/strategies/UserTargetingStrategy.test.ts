import { UserTargetingStrategy } from '../../../../src/services/strategies/UserTargetingStrategy';
import { StrategyContext } from '../../../../src/types/strategy';
import { FeatureFlagStrategyConfig } from '../../../../src/types';
import { ValidationError } from '../../../../src/utils/errors';

describe('UserTargetingStrategy', () => {
  let strategy: UserTargetingStrategy;
  let context: StrategyContext;

  beforeEach(() => {
    strategy = new UserTargetingStrategy();
    context = {
      flagId: 'flag-1',
      tenantId: 'tenant-1',
      featureId: 'feature-1',
      env: 'dev',
      userId: 'user-123',
    };
  });

  describe('getType', () => {
    it('should return "user_targeting"', () => {
      expect(strategy.getType()).toBe('user_targeting');
    });
  });

  describe('validate', () => {
    it('should validate correct user targeting config', () => {
      const config: FeatureFlagStrategyConfig = {
        user_targeting: {
          userIds: ['user-1', 'user-2'],
          enabled: true,
        },
      };
      expect(strategy.validate(config)).toBe(true);
    });

    it('should reject config without user_targeting', () => {
      const config: FeatureFlagStrategyConfig = {};
      expect(strategy.validate(config)).toBe(false);
    });

    it('should reject config with invalid userIds', () => {
      const config = {
        user_targeting: {
          userIds: 'not-array',
          enabled: true,
        },
      } as unknown as FeatureFlagStrategyConfig;
      expect(strategy.validate(config)).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('should return enabled=true for targeted user when enabled=true', () => {
      const config: FeatureFlagStrategyConfig = {
        user_targeting: {
          userIds: ['user-123', 'user-456'],
          enabled: true,
        },
      };

      const result = strategy.evaluate(config, context);

      expect(result.enabled).toBe(true);
      expect(result.reason).toContain('in targeting list');
      expect(result.metadata?.targeted).toBe(true);
    });

    it('should return enabled=false for targeted user when enabled=false', () => {
      const config: FeatureFlagStrategyConfig = {
        user_targeting: {
          userIds: ['user-123'],
          enabled: false,
        },
      };

      const result = strategy.evaluate(config, context);

      expect(result.enabled).toBe(false);
      expect(result.metadata?.targeted).toBe(true);
    });

    it('should return opposite for non-targeted user', () => {
      const config: FeatureFlagStrategyConfig = {
        user_targeting: {
          userIds: ['user-999'],
          enabled: true,
        },
      };

      const result = strategy.evaluate(config, context);

      // user-123 is not in list, so should get opposite of enabled (false)
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('not in targeting list');
      expect(result.metadata?.targeted).toBe(false);
    });

    it('should return false when no userId provided', () => {
      const config: FeatureFlagStrategyConfig = {
        user_targeting: {
          userIds: ['user-1'],
          enabled: true,
        },
      };

      const result = strategy.evaluate(config, {
        ...context,
        userId: undefined,
      });

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('User ID required');
      expect(result.metadata?.hasUserId).toBe(false);
    });
  });
});


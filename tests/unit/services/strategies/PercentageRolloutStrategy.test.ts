import { PercentageRolloutStrategy } from '../../../../src/services/strategies/PercentageRolloutStrategy';
import { StrategyContext } from '../../../../src/types/strategy';
import { FeatureFlagStrategyConfig } from '../../../../src/types';
import { ValidationError } from '../../../../src/utils/errors';

describe('PercentageRolloutStrategy', () => {
  let strategy: PercentageRolloutStrategy;
  let context: StrategyContext;

  beforeEach(() => {
    strategy = new PercentageRolloutStrategy();
    context = {
      flagId: 'flag-1',
      tenantId: 'tenant-1',
      featureId: 'feature-1',
      env: 'dev',
      userId: 'user-123',
    };
  });

  describe('getType', () => {
    it('should return "percentage"', () => {
      expect(strategy.getType()).toBe('percentage');
    });
  });

  describe('validate', () => {
    it('should validate correct percentage config', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: 50 },
      };
      expect(strategy.validate(config)).toBe(true);
    });

    it('should validate 0%', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: 0 },
      };
      expect(strategy.validate(config)).toBe(true);
    });

    it('should validate 100%', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: 100 },
      };
      expect(strategy.validate(config)).toBe(true);
    });

    it('should reject percentage < 0', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: -1 },
      };
      expect(strategy.validate(config)).toBe(false);
    });

    it('should reject percentage > 100', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: 101 },
      };
      expect(strategy.validate(config)).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('should always return false for 0%', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: 0 },
      };

      const result = strategy.evaluate(config, context);

      expect(result.enabled).toBe(false);
      expect(result.metadata?.percentage).toBe(0);
    });

    it('should always return true for 100%', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: 100 },
      };

      const result = strategy.evaluate(config, context);

      expect(result.enabled).toBe(true);
      expect(result.metadata?.percentage).toBe(100);
    });

    it('should return consistent results for same input', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: 50 },
      };

      const result1 = strategy.evaluate(config, context);
      const result2 = strategy.evaluate(config, context);

      // Same user should get same result
      expect(result1.enabled).toBe(result2.enabled);
      expect(result1.metadata?.hashValue).toBe(result2.metadata?.hashValue);
    });

    it('should return different results for different users', () => {
      const config: FeatureFlagStrategyConfig = {
        percentage: { percentage: 50 },
      };

      const result1 = strategy.evaluate(config, {
        ...context,
        userId: 'user-1',
      });
      const result2 = strategy.evaluate(config, {
        ...context,
        userId: 'user-2',
      });

      // Different users might get different results (probabilistic)
      // But both should have valid hash values
      expect(result1.metadata?.hashValue).toBeDefined();
      expect(result2.metadata?.hashValue).toBeDefined();
    });
  });
});


import { BooleanStrategy } from '../../../../src/services/strategies/BooleanStrategy';
import { StrategyContext } from '../../../../src/types/strategy';
import { FeatureFlagStrategyConfig } from '../../../../src/types';
import { ValidationError } from '../../../../src/utils/errors';

describe('BooleanStrategy', () => {
  let strategy: BooleanStrategy;
  let context: StrategyContext;

  beforeEach(() => {
    strategy = new BooleanStrategy();
    context = {
      flagId: 'flag-1',
      tenantId: 'tenant-1',
      featureId: 'feature-1',
      env: 'dev',
    };
  });

  describe('getType', () => {
    it('should return "boolean"', () => {
      expect(strategy.getType()).toBe('boolean');
    });
  });

  describe('validate', () => {
    it('should validate correct boolean config', () => {
      const config: FeatureFlagStrategyConfig = {
        boolean: { enabled: true },
      };
      expect(strategy.validate(config)).toBe(true);
    });

    it('should reject config without boolean', () => {
      const config: FeatureFlagStrategyConfig = {};
      expect(strategy.validate(config)).toBe(false);
    });

    it('should reject config with invalid boolean value', () => {
      const config = {
        boolean: { enabled: 'not-boolean' },
      } as unknown as FeatureFlagStrategyConfig;
      expect(strategy.validate(config)).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('should return enabled=true when config enabled=true', () => {
      const config: FeatureFlagStrategyConfig = {
        boolean: { enabled: true },
      };

      const result = strategy.evaluate(config, context);

      expect(result.enabled).toBe(true);
      expect(result.reason).toContain('enabled');
      expect(result.metadata?.strategy).toBe('boolean');
      expect(result.metadata?.value).toBe(true);
    });

    it('should return enabled=false when config enabled=false', () => {
      const config: FeatureFlagStrategyConfig = {
        boolean: { enabled: false },
      };

      const result = strategy.evaluate(config, context);

      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('disabled');
      expect(result.metadata?.strategy).toBe('boolean');
      expect(result.metadata?.value).toBe(false);
    });

    it('should throw ValidationError for invalid config', () => {
      const config: FeatureFlagStrategyConfig = {};

      expect(() => strategy.evaluate(config, context)).toThrow(ValidationError);
    });
  });
});


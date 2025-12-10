import { StrategyEvaluator } from '../../../../src/services/strategies/StrategyEvaluator';
import { FeatureFlag } from '../../../../src/models/FeatureFlag';
import { StrategyContext } from '../../../../src/types/strategy';
import { ValidationError } from '../../../../src/utils/errors';

describe('StrategyEvaluator', () => {
  let evaluator: StrategyEvaluator;
  let context: StrategyContext;

  beforeEach(() => {
    evaluator = new StrategyEvaluator();
    context = {
      flagId: 'flag-1',
      tenantId: 'tenant-1',
      featureId: 'feature-1',
      env: 'dev',
      userId: 'user-123',
    };
  });

  describe('evaluate', () => {
    it('should evaluate boolean strategy', () => {
      const flag: FeatureFlag = {
        id: 'flag-1',
        tenant_id: 'tenant-1',
        feature_id: 'feature-1',
        env: 'dev',
        enabled: true,
        strategy_type: 'boolean',
        strategy_config: {
          boolean: { enabled: true },
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      const evaluation = evaluator.evaluate(flag, context);

      expect(evaluation.strategyType).toBe('boolean');
      expect(evaluation.result.enabled).toBe(true);
      expect(evaluation.evaluatedAt).toBeDefined();
    });

    it('should evaluate percentage strategy', () => {
      const flag: FeatureFlag = {
        id: 'flag-1',
        tenant_id: 'tenant-1',
        feature_id: 'feature-1',
        env: 'dev',
        enabled: true,
        strategy_type: 'percentage',
        strategy_config: {
          percentage: { percentage: 50 },
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      const evaluation = evaluator.evaluate(flag, context);

      expect(evaluation.strategyType).toBe('percentage');
      expect(typeof evaluation.result.enabled).toBe('boolean');
      expect(evaluation.result.metadata?.percentage).toBe(50);
    });

    it('should evaluate user targeting strategy', () => {
      const flag: FeatureFlag = {
        id: 'flag-1',
        tenant_id: 'tenant-1',
        feature_id: 'feature-1',
        env: 'dev',
        enabled: true,
        strategy_type: 'user_targeting',
        strategy_config: {
          user_targeting: {
            userIds: ['user-123'],
            enabled: true,
          },
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      const evaluation = evaluator.evaluate(flag, context);

      expect(evaluation.strategyType).toBe('user_targeting');
      expect(evaluation.result.enabled).toBe(true);
      expect(evaluation.result.metadata?.targeted).toBe(true);
    });

    it('should throw ValidationError for unknown strategy', () => {
      const flag: FeatureFlag = {
        id: 'flag-1',
        tenant_id: 'tenant-1',
        feature_id: 'feature-1',
        env: 'dev',
        enabled: true,
        strategy_type: 'unknown' as any,
        strategy_config: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(() => evaluator.evaluate(flag, context)).toThrow(ValidationError);
    });
  });

  describe('evaluateBatch', () => {
    it('should evaluate multiple flags', () => {
      const flags: FeatureFlag[] = [
        {
          id: 'flag-1',
          tenant_id: 'tenant-1',
          feature_id: 'feature-1',
          env: 'dev',
          enabled: true,
          strategy_type: 'boolean',
          strategy_config: { boolean: { enabled: true } },
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'flag-2',
          tenant_id: 'tenant-1',
          feature_id: 'feature-2',
          env: 'dev',
          enabled: true,
          strategy_type: 'boolean',
          strategy_config: { boolean: { enabled: false } },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const results = evaluator.evaluateBatch(flags, context);

      expect(results.size).toBe(2);
      expect(results.get('flag-1')?.result.enabled).toBe(true);
      expect(results.get('flag-2')?.result.enabled).toBe(false);
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return list of available strategies', () => {
      const strategies = evaluator.getAvailableStrategies();

      expect(strategies).toContain('boolean');
      expect(strategies).toContain('percentage');
      expect(strategies).toContain('user_targeting');
    });
  });
});


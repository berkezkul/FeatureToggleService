import { IStrategy } from './IStrategy';
import { BooleanStrategy } from './BooleanStrategy';
import { PercentageRolloutStrategy } from './PercentageRolloutStrategy';
import { UserTargetingStrategy } from './UserTargetingStrategy';
import { StrategyContext, StrategyEvaluation } from '../../types/strategy';
import { FeatureFlag } from '../../models/FeatureFlag';
import { FeatureFlagStrategyConfig } from '../../types';
import { ValidationError } from '../../utils/errors';
import logger from '../../config/logger';

/**
 * Strategy Evaluator Service
 * 
 * Evaluates feature flags using the appropriate strategy
 * Implements Strategy Pattern for flexible evaluation
 */
export class StrategyEvaluator {
  private strategies: Map<string, IStrategy>;

  constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  /**
   * Register default strategies
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy(new BooleanStrategy());
    this.registerStrategy(new PercentageRolloutStrategy());
    this.registerStrategy(new UserTargetingStrategy());
  }

  /**
   * Register a custom strategy
   */
  registerStrategy(strategy: IStrategy): void {
    this.strategies.set(strategy.getType(), strategy);
    logger.debug('Strategy registered', { type: strategy.getType() });
  }

  /**
   * Evaluate a feature flag using its strategy
   */
  evaluate(
    flag: FeatureFlag,
    context: StrategyContext
  ): StrategyEvaluation {
    const strategy = this.strategies.get(flag.strategy_type);

    if (!strategy) {
      logger.warn('Unknown strategy type', {
        strategyType: flag.strategy_type,
        flagId: flag.id,
      });
      throw new ValidationError(`Unknown strategy type: ${flag.strategy_type}`);
    }

    // Validate strategy configuration
    if (!strategy.validate(flag.strategy_config as FeatureFlagStrategyConfig)) {
      logger.warn('Invalid strategy configuration', {
        strategyType: flag.strategy_type,
        flagId: flag.id,
        config: flag.strategy_config,
      });
      throw new ValidationError(
        `Invalid configuration for strategy: ${flag.strategy_type}`
      );
    }

    // Evaluate using the strategy
    const result = strategy.evaluate(
      flag.strategy_config as FeatureFlagStrategyConfig,
      context
    );

    return {
      strategyType: flag.strategy_type,
      result,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluate multiple flags (batch evaluation)
   */
  evaluateBatch(
    flags: FeatureFlag[],
    context: StrategyContext
  ): Map<string, StrategyEvaluation> {
    const results = new Map<string, StrategyEvaluation>();

    for (const flag of flags) {
      try {
        const evaluation = this.evaluate(flag, context);
        results.set(flag.id, evaluation);
      } catch (error) {
        logger.error('Flag evaluation failed', {
          error,
          flagId: flag.id,
          strategyType: flag.strategy_type,
        });
        // Continue with other flags even if one fails
      }
    }

    return results;
  }

  /**
   * Get available strategy types
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}


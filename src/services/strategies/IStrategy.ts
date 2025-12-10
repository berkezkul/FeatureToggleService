// Strategy interface for Feature Flag evaluation

import { StrategyContext, StrategyResult } from '../../types/strategy';
import { FeatureFlagStrategyConfig } from '../../types';

/**
 * Base interface for all feature flag strategies
 * Implements Strategy Pattern for flexible evaluation logic
 */
export interface IStrategy {
  /**
   * Evaluate if feature flag should be enabled for given context
   */
  evaluate(
    config: FeatureFlagStrategyConfig,
    context: StrategyContext
  ): StrategyResult;

  /**
   * Get strategy type name
   */
  getType(): string;

  /**
   * Validate strategy configuration
   */
  validate(config: FeatureFlagStrategyConfig): boolean;
}


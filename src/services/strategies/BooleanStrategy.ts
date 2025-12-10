import { IStrategy } from './IStrategy';
import { StrategyContext, StrategyResult } from '../../types/strategy';
import { FeatureFlagStrategyConfig } from '../../types';
import { ValidationError } from '../../utils/errors';

/**
 * Boolean Strategy - Simple on/off toggle
 * 
 * Configuration:
 * {
 *   boolean: {
 *     enabled: true | false
 *   }
 * }
 */
export class BooleanStrategy implements IStrategy {
  getType(): string {
    return 'boolean';
  }

  validate(config: FeatureFlagStrategyConfig): boolean {
    if (!config.boolean) {
      return false;
    }

    return typeof config.boolean.enabled === 'boolean';
  }

  evaluate(
    config: FeatureFlagStrategyConfig,
    _context: StrategyContext
  ): StrategyResult {
    if (!this.validate(config)) {
      throw new ValidationError('Invalid boolean strategy configuration');
    }

    const enabled = config.boolean!.enabled;

    return {
      enabled,
      reason: enabled ? 'Feature enabled via boolean strategy' : 'Feature disabled via boolean strategy',
      metadata: {
        strategy: 'boolean',
        value: enabled,
      },
    };
  }
}


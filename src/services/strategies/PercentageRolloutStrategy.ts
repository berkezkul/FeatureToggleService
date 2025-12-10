import { IStrategy } from './IStrategy';
import { StrategyContext, StrategyResult } from '../../types/strategy';
import { FeatureFlagStrategyConfig } from '../../types';
import { ValidationError } from '../../utils/errors';
import { createHash } from 'crypto';

/**
 * Percentage Rollout Strategy - Gradual feature rollout
 * 
 * Uses consistent hashing to ensure same user always gets same result
 * 
 * Configuration:
 * {
 *   percentage: {
 *     percentage: 0-100
 *   }
 * }
 */
export class PercentageRolloutStrategy implements IStrategy {
  getType(): string {
    return 'percentage';
  }

  validate(config: FeatureFlagStrategyConfig): boolean {
    if (!config.percentage) {
      return false;
    }

    const percentage = config.percentage.percentage;
    return (
      typeof percentage === 'number' &&
      percentage >= 0 &&
      percentage <= 100
    );
  }

  evaluate(
    config: FeatureFlagStrategyConfig,
    context: StrategyContext
  ): StrategyResult {
    if (!this.validate(config)) {
      throw new ValidationError('Invalid percentage strategy configuration');
    }

    const percentage = config.percentage!.percentage;

    // If 0%, always disabled
    if (percentage === 0) {
      return {
        enabled: false,
        reason: 'Percentage rollout set to 0%',
        metadata: {
          strategy: 'percentage',
          percentage: 0,
          hashValue: 0,
        },
      };
    }

    // If 100%, always enabled
    if (percentage === 100) {
      return {
        enabled: true,
        reason: 'Percentage rollout set to 100%',
        metadata: {
          strategy: 'percentage',
          percentage: 100,
          hashValue: 100,
        },
      };
    }

    // Use consistent hashing based on flag + user context
    // This ensures same user always gets same result
    const hashInput = `${context.flagId}:${context.userId || context.tenantId}`;
    const hash = createHash('sha256').update(hashInput).digest('hex');
    
    // Convert first 8 hex characters to number (0-4294967295)
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const normalizedValue = (hashValue % 100) + 1; // 1-100

    const enabled = normalizedValue <= percentage;

    return {
      enabled,
      reason: enabled
        ? `User falls within ${percentage}% rollout (hash: ${normalizedValue})`
        : `User falls outside ${percentage}% rollout (hash: ${normalizedValue})`,
      metadata: {
        strategy: 'percentage',
        percentage,
        hashValue: normalizedValue,
        hashInput,
      },
    };
  }
}


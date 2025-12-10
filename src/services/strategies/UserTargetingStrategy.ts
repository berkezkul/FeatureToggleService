import { IStrategy } from './IStrategy';
import { StrategyContext, StrategyResult } from '../../types/strategy';
import { FeatureFlagStrategyConfig } from '../../types';
import { ValidationError } from '../../utils/errors';

/**
 * User Targeting Strategy - Target specific users
 * 
 * Configuration:
 * {
 *   user_targeting: {
 *     userIds: string[],
 *     enabled: boolean
 *   }
 * }
 * 
 * If userId is in the list, returns the enabled value
 * If userId is not in the list, returns the opposite
 */
export class UserTargetingStrategy implements IStrategy {
  getType(): string {
    return 'user_targeting';
  }

  validate(config: FeatureFlagStrategyConfig): boolean {
    if (!config.user_targeting) {
      return false;
    }

    const targeting = config.user_targeting;
    return (
      Array.isArray(targeting.userIds) &&
      typeof targeting.enabled === 'boolean'
    );
  }

  evaluate(
    config: FeatureFlagStrategyConfig,
    context: StrategyContext
  ): StrategyResult {
    if (!this.validate(config)) {
      throw new ValidationError('Invalid user targeting strategy configuration');
    }

    if (!context.userId) {
      // No user ID provided - default to disabled
      return {
        enabled: false,
        reason: 'User ID required for user targeting strategy',
        metadata: {
          strategy: 'user_targeting',
          targeted: false,
          hasUserId: false,
        },
      };
    }

    const targeting = config.user_targeting!;
    const isTargeted = targeting.userIds.includes(context.userId);

    // If user is in the list, return the enabled value
    // If user is not in the list, return the opposite
    const enabled = isTargeted ? targeting.enabled : !targeting.enabled;

    return {
      enabled,
      reason: isTargeted
        ? `User ${context.userId} is in targeting list (${targeting.userIds.length} users)`
        : `User ${context.userId} is not in targeting list (${targeting.userIds.length} users)`,
      metadata: {
        strategy: 'user_targeting',
        targeted: isTargeted,
        userId: context.userId,
        targetListSize: targeting.userIds.length,
        enabledForTargeted: targeting.enabled,
      },
    };
  }
}


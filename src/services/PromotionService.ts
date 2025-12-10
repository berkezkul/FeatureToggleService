import { Knex } from 'knex';
import { FeatureFlagModel, FeatureFlag, FeatureFlagInput } from '../models/FeatureFlag';
import { AuditLogModel, AuditLogInput } from '../models/AuditLog';
import { CacheService } from './CacheService';
import {
  PromotionRequest,
  PromotionResult,
  PromotionConflict,
} from '../types/promotion';
import { Environment } from '../types';
import { ValidationError } from '../utils/errors';

/**
 * Promotion Service
 * 
 * Handles safe promotion of feature flags between environments
 * Supports conflict detection, dry-run mode, and batch operations
 */
export class PromotionService {
  private readonly validPromotions: Map<Environment, Environment[]> = new Map([
    ['dev', ['staging']],
    ['staging', ['prod']],
    ['prod', []], // Prod cannot be promoted from
  ]);

  constructor(
    private cacheService: CacheService,
    private db: Knex
  ) {}

  /**
   * Promote feature flags from source to target environment
   */
  async promote(
    request: PromotionRequest,
    actor?: string
  ): Promise<PromotionResult> {
    // Validate promotion path
    this.validatePromotionPath(request.sourceEnv, request.targetEnv);

    // If dry-run, return preview
    if (request.dryRun) {
      return this.previewPromotion(request);
    }

    // Perform actual promotion
    return this.db.transaction(async (trx) => {
      const featureFlagModelTx = new FeatureFlagModel(trx);
      const auditLogModelTx = new AuditLogModel(trx);

      // Get source flags
      const sourceFlags = await this.getSourceFlags(
        request,
        featureFlagModelTx
      );

      if (sourceFlags.length === 0) {
        return {
          success: true,
          promoted: 0,
          skipped: 0,
          conflicts: [],
          dryRun: false,
          details: [],
        };
      }

      // Detect conflicts
      const conflicts = await this.detectConflicts(
        sourceFlags,
        request,
        featureFlagModelTx
      );

      // Process promotion
      const result = await this.processPromotion(
        sourceFlags,
        conflicts,
        request,
        featureFlagModelTx,
        auditLogModelTx,
        actor
      );

      // Invalidate cache after transaction
      setImmediate(async () => {
        await this.cacheService.invalidateTenantEnv(
          request.tenantId,
          request.targetEnv
        );
      });

      return result;
    });
  }

  /**
   * Preview promotion without making changes (dry-run)
   */
  async previewPromotion(request: PromotionRequest): Promise<PromotionResult> {
    const featureFlagModelTx = new FeatureFlagModel(this.db);
    
    const sourceFlags = await this.getSourceFlags(request, featureFlagModelTx);
    const conflicts = await this.detectConflicts(
      sourceFlags,
      request,
      featureFlagModelTx
    );

    const details: PromotionResult['details'] = [];
    let willPromote = 0;
    let willSkip = 0;

    for (const sourceFlag of sourceFlags) {
      const conflict = conflicts.find((c) => c.featureId === sourceFlag.feature_id);

      if (conflict) {
        willSkip++;
        details.push({
          featureId: sourceFlag.feature_id,
          action: 'conflict',
          reason: `Conflict detected in fields: ${conflict.conflictFields.join(', ')}`,
        });
      } else {
        willPromote++;
        details.push({
          featureId: sourceFlag.feature_id,
          action: 'promoted',
          reason: 'No conflicts, will be promoted',
        });
      }
    }

    return {
      success: true,
      promoted: willPromote,
      skipped: willSkip,
      conflicts,
      dryRun: true,
      details,
    };
  }

  /**
   * Get source flags to promote
   */
  private async getSourceFlags(
    request: PromotionRequest,
    model: FeatureFlagModel
  ): Promise<FeatureFlag[]> {
    if (request.featureIds && request.featureIds.length > 0) {
      // Get specific features
      const flags: FeatureFlag[] = [];
      for (const featureId of request.featureIds) {
        const flag = await model.findByTenantFeatureEnv(
          request.tenantId,
          featureId,
          request.sourceEnv
        );
        if (flag) {
          flags.push(flag);
        }
      }
      return flags;
    }

    // Get all flags for tenant in source environment
    const allFlags = await model.findAll({
      tenant_id: request.tenantId,
      env: request.sourceEnv,
    });

    return allFlags;
  }

  /**
   * Detect conflicts between source and target environments
   */
  private async detectConflicts(
    sourceFlags: FeatureFlag[],
    request: PromotionRequest,
    model: FeatureFlagModel
  ): Promise<PromotionConflict[]> {
    const conflicts: PromotionConflict[] = [];

    for (const sourceFlag of sourceFlags) {
      const targetFlag = await model.findByTenantFeatureEnv(
        request.tenantId,
        sourceFlag.feature_id,
        request.targetEnv
      );

      if (targetFlag) {
        // Check for conflicts
        const conflictFields = this.compareFlags(sourceFlag, targetFlag);

        if (conflictFields.length > 0) {
          conflicts.push({
            featureId: sourceFlag.feature_id,
            sourceValue: {
              enabled: sourceFlag.enabled,
              strategy_type: sourceFlag.strategy_type,
              strategy_config: sourceFlag.strategy_config || undefined,
            },
            targetValue: {
              enabled: targetFlag.enabled,
              strategy_type: targetFlag.strategy_type,
              strategy_config: targetFlag.strategy_config,
            },
            conflictFields,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Compare two flags and return conflicting fields
   */
  private compareFlags(source: FeatureFlag, target: FeatureFlag): string[] {
    const conflicts: string[] = [];

    if (source.enabled !== target.enabled) {
      conflicts.push('enabled');
    }

    if (source.strategy_type !== target.strategy_type) {
      conflicts.push('strategy_type');
    }

    // Deep compare strategy_config
    const sourceConfig = JSON.stringify(source.strategy_config || {});
    const targetConfig = JSON.stringify(target.strategy_config || {});

    if (sourceConfig !== targetConfig) {
      conflicts.push('strategy_config');
    }

    return conflicts;
  }

  /**
   * Process promotion with conflict resolution
   */
  private async processPromotion(
    sourceFlags: FeatureFlag[],
    conflicts: PromotionConflict[],
    request: PromotionRequest,
    featureFlagModelTx: FeatureFlagModel,
    auditLogModelTx: AuditLogModel,
    actor?: string
  ): Promise<PromotionResult> {
    const details: PromotionResult['details'] = [];
    let promoted = 0;
    let skipped = 0;

    const conflictResolution = request.conflictResolution || 'skip';

    for (const sourceFlag of sourceFlags) {
      const conflict = conflicts.find((c) => c.featureId === sourceFlag.feature_id);

      if (conflict) {
        // Handle conflict based on resolution strategy
        if (conflictResolution === 'skip') {
          skipped++;
          details.push({
            featureId: sourceFlag.feature_id,
            action: 'skipped',
            reason: `Conflict detected, skipping (resolution: skip)`,
          });
          continue;
        }

        if (conflictResolution === 'overwrite') {
          // Overwrite target with source
          await this.promoteFlag(
            sourceFlag,
            request.targetEnv,
            featureFlagModelTx,
            auditLogModelTx,
            actor,
            'overwritten'
          );
          promoted++;
          details.push({
            featureId: sourceFlag.feature_id,
            action: 'promoted',
            reason: 'Conflict resolved by overwriting target',
          });
          continue;
        }

        if (conflictResolution === 'merge') {
          // Merge strategy: prefer source for conflicts, keep target for non-conflicts
          const mergedFlag = this.mergeFlags(sourceFlag, conflict);
          await this.promoteFlag(
            mergedFlag,
            request.targetEnv,
            featureFlagModelTx,
            auditLogModelTx,
            actor,
            'merged'
          );
          promoted++;
          details.push({
            featureId: sourceFlag.feature_id,
            action: 'promoted',
            reason: 'Conflict resolved by merging',
          });
          continue;
        }
      } else {
        // No conflict, promote directly
        await this.promoteFlag(
          sourceFlag,
          request.targetEnv,
          featureFlagModelTx,
          auditLogModelTx,
          actor
        );
        promoted++;
        details.push({
          featureId: sourceFlag.feature_id,
          action: 'promoted',
          reason: 'No conflicts, promoted successfully',
        });
      }
    }

    return {
      success: true,
      promoted,
      skipped,
      conflicts,
      dryRun: false,
      details,
    };
  }

  /**
   * Promote a single flag to target environment
   */
  private async promoteFlag(
    sourceFlag: FeatureFlag,
    targetEnv: Environment,
    featureFlagModelTx: FeatureFlagModel,
    auditLogModelTx: AuditLogModel,
    actor?: string,
    promotionType: 'direct' | 'overwritten' | 'merged' = 'direct'
  ): Promise<void> {
    const existing = await featureFlagModelTx.findByTenantFeatureEnv(
      sourceFlag.tenant_id,
      sourceFlag.feature_id,
      targetEnv
    );

    const flagInput: FeatureFlagInput = {
      tenant_id: sourceFlag.tenant_id,
      feature_id: sourceFlag.feature_id,
      env: targetEnv,
      enabled: sourceFlag.enabled,
      strategy_type: sourceFlag.strategy_type,
      strategy_config: sourceFlag.strategy_config || undefined,
    };

    const promotedFlag = await featureFlagModelTx.upsert(flagInput);

    // Create audit log
    const auditLog: AuditLogInput = {
      action: existing ? 'UPDATE' : 'CREATE',
      entity_type: 'feature_flag',
      entity_id: promotedFlag.id,
      actor: actor || 'system',
      old_value: existing ? this.serializeFlag(existing) : undefined,
      new_value: this.serializeFlag(promotedFlag),
      metadata: {
        promotionType,
        sourceEnv: sourceFlag.env,
        targetEnv,
      },
    };

    await auditLogModelTx.create(auditLog);
  }

  /**
   * Merge source and target flags (for merge conflict resolution)
   */
  private mergeFlags(
    source: FeatureFlag,
    conflict: PromotionConflict
  ): FeatureFlag {
    // Start with target flag
    const merged = { ...source };

    // Override conflicting fields with source values
    if (conflict.conflictFields.includes('enabled')) {
      merged.enabled = source.enabled;
    }

    if (conflict.conflictFields.includes('strategy_type')) {
      merged.strategy_type = source.strategy_type;
    }

    if (conflict.conflictFields.includes('strategy_config')) {
      merged.strategy_config = source.strategy_config;
    }

    return merged;
  }

  /**
   * Serialize flag for audit log
   */
  private serializeFlag(flag: FeatureFlag): Record<string, unknown> {
    return {
      id: flag.id,
      tenant_id: flag.tenant_id,
      feature_id: flag.feature_id,
      env: flag.env,
      enabled: flag.enabled,
      strategy_type: flag.strategy_type,
      strategy_config: flag.strategy_config,
    };
  }

  /**
   * Validate promotion path (e.g., dev → staging → prod)
   */
  private validatePromotionPath(
    source: Environment,
    target: Environment
  ): void {
    if (source === target) {
      throw new ValidationError('Source and target environments cannot be the same');
    }

    const validTargets = this.validPromotions.get(source);
    if (!validTargets || !validTargets.includes(target)) {
      throw new ValidationError(
        `Invalid promotion path: ${source} → ${target}. Valid paths: ${Array.from(this.validPromotions.entries())
          .map(([src, tgts]) => `${src} → [${tgts.join(', ')}]`)
          .join(', ')}`
      );
    }
  }
}


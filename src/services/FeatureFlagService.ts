import { Knex } from 'knex';
import { FeatureFlagModel, FeatureFlag, FeatureFlagInput, FeatureFlagQuery } from '../models/FeatureFlag';
import { AuditLogModel, AuditLogInput } from '../models/AuditLog';
import { CacheService } from './CacheService';
import { StrategyEvaluator } from './strategies/StrategyEvaluator';
import { PaginatedResponse, Environment } from '../types';
import { NotFoundError } from '../utils/errors';
import { StrategyContext } from '../types/strategy';
import { metrics, METRIC_NAMES } from '../utils/metrics';
import logger from '../config/logger';

export class FeatureFlagService {
  constructor(
    private featureFlagModel: FeatureFlagModel,
    private cacheService: CacheService,
    private strategyEvaluator: StrategyEvaluator,
    private db: Knex
  ) {}

  async getFeatureFlags(
    query: FeatureFlagQuery,
    context?: StrategyContext
  ): Promise<PaginatedResponse<FeatureFlag & { evaluated?: { enabled: boolean; reason?: string } }>> {
    const startTime = Date.now();
    
    // Track feature flag fetch
    metrics.increment(METRIC_NAMES.FEATURE_FLAG_FETCHES_TOTAL, {
      tenant_id: query.tenant_id || 'unknown',
      env: query.env || 'unknown',
    });
    // Try cache first if tenant and env are provided
    if (query.tenant_id && query.env) {
      const cacheKey = this.cacheService.getFeatureFlagsListKey(
        query.tenant_id,
        query.env,
        query.page,
        query.limit
      );

      const cached = await this.cacheService.get<PaginatedResponse<FeatureFlag>>(cacheKey);
      if (cached.hit && cached.data) {
        logger.debug('Cache hit for feature flags list', {
          key: cacheKey,
          tenantId: query.tenant_id,
          env: query.env,
        });
        
        // Track cache hit
        metrics.increment(METRIC_NAMES.CACHE_HITS_TOTAL, {
          type: 'feature_flags_list',
        });
        
        // Evaluate strategies if context provided
        if (context) {
          return this.evaluateFlags(cached.data, context);
        }
        
        return cached.data;
      }

      // Track cache miss
      metrics.increment(METRIC_NAMES.CACHE_MISSES_TOTAL, {
        type: 'feature_flags_list',
      });
    }

    // Cache miss - fetch from database
    const [flags, total] = await Promise.all([
      this.featureFlagModel.findAll(query),
      this.featureFlagModel.count(query),
    ]);

    const response: PaginatedResponse<FeatureFlag> = {
      data: flags,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
        total,
        totalPages: Math.ceil(total / (query.limit || 10)),
      },
    };

    // Evaluate strategies if context provided
    const evaluatedResponse = context
      ? this.evaluateFlags(response, context)
      : response;

    // Cache the response (without evaluation for reusability)
    if (query.tenant_id && query.env) {
      const cacheKey = this.cacheService.getFeatureFlagsListKey(
        query.tenant_id,
        query.env,
        query.page,
        query.limit
      );
      await this.cacheService.set(cacheKey, response);
      logger.debug('Cached feature flags list', {
        key: cacheKey,
        tenantId: query.tenant_id,
        env: query.env,
      });
    }

    // Track query duration
    const duration = Date.now() - startTime;
    metrics.observe(METRIC_NAMES.DATABASE_QUERY_DURATION_MS, duration, {
      operation: 'getFeatureFlags',
    });

    return evaluatedResponse;
  }

  /**
   * Evaluate flags using their strategies
   */
  private evaluateFlags(
    response: PaginatedResponse<FeatureFlag>,
    context: StrategyContext
  ): PaginatedResponse<FeatureFlag & { evaluated?: { enabled: boolean; reason?: string } }> {
    const evaluatedFlags = response.data.map((flag) => {
      try {
        const evaluation = this.strategyEvaluator.evaluate(flag, {
          ...context,
          flagId: flag.id,
          tenantId: flag.tenant_id,
          featureId: flag.feature_id,
          env: flag.env,
        });

        return {
          ...flag,
          evaluated: {
            enabled: evaluation.result.enabled,
            reason: evaluation.result.reason,
          },
        };
      } catch (error) {
        logger.error('Flag evaluation failed', {
          error,
          flagId: flag.id,
        });
        // Return flag without evaluation on error
        return {
          ...flag,
          evaluated: {
            enabled: flag.enabled, // Fallback to base enabled value
            reason: 'Evaluation failed, using base enabled value',
          },
        };
      }
    });

    return {
      ...response,
      data: evaluatedFlags,
    };
  }

  async getFeatureFlagById(id: string): Promise<FeatureFlag> {
    const flag = await this.featureFlagModel.findById(id);
    if (!flag) {
      throw new NotFoundError('Feature flag', id);
    }

    // Cache individual flag
    const cacheKey = this.cacheService.getFeatureFlagKey(
      flag.tenant_id,
      flag.feature_id,
      flag.env
    );
    await this.cacheService.set(cacheKey, flag);

    return flag;
  }

  async createOrUpdateFeatureFlag(
    data: FeatureFlagInput,
    actor?: string
  ): Promise<FeatureFlag> {
    // Track feature flag update
    metrics.increment(METRIC_NAMES.FEATURE_FLAG_UPDATES_TOTAL, {
      tenant_id: data.tenant_id,
      env: data.env,
    });
    return this.db.transaction(async (trx) => {
      // Create temporary models with transaction
      const featureFlagModelTx = new FeatureFlagModel(trx);
      const auditLogModelTx = new AuditLogModel(trx);

      // Get existing flag for audit log
      const existing = await featureFlagModelTx.findByTenantFeatureEnv(
        data.tenant_id,
        data.feature_id,
        data.env
      );

      const flag = await featureFlagModelTx.upsert(data);

      // Create audit log
      const auditLog: AuditLogInput = {
        action: existing ? 'UPDATE' : 'CREATE',
        entity_type: 'feature_flag',
        entity_id: flag.id,
        actor,
        old_value: existing ? this.serializeFlag(existing) : undefined,
        new_value: this.serializeFlag(flag),
      };

      await auditLogModelTx.create(auditLog);

      // Invalidate cache after transaction commits
      // We'll do this after the transaction to ensure data consistency
      setImmediate(async () => {
        await this.invalidateCacheForFlag(flag.tenant_id, flag.feature_id, flag.env);
      });

      return flag;
    });
  }

  async deleteFeatureFlag(id: string, actor?: string): Promise<void> {
    // Track feature flag delete
    metrics.increment(METRIC_NAMES.FEATURE_FLAG_DELETES_TOTAL);
    return this.db.transaction(async (trx) => {
      // Create temporary models with transaction
      const featureFlagModelTx = new FeatureFlagModel(trx);
      const auditLogModelTx = new AuditLogModel(trx);

      const flag = await featureFlagModelTx.findById(id);
      if (!flag) {
        throw new NotFoundError('Feature flag', id);
      }

      const deleted = await featureFlagModelTx.delete(id);
      if (!deleted) {
        throw new NotFoundError('Feature flag', id);
      }

      // Create audit log
      const auditLog: AuditLogInput = {
        action: 'DELETE',
        entity_type: 'feature_flag',
        entity_id: id,
        actor,
        old_value: this.serializeFlag(flag),
        new_value: undefined,
      };

      await auditLogModelTx.create(auditLog);

      // Invalidate cache after transaction commits
      setImmediate(async () => {
        await this.invalidateCacheForFlag(flag.tenant_id, flag.feature_id, flag.env);
      });
    });
  }

  /**
   * Invalidate cache for a specific feature flag
   */
  private async invalidateCacheForFlag(
    tenantId: string,
    featureId: string,
    env: Environment
  ): Promise<void> {
    try {
      // Invalidate individual flag cache
      await this.cacheService.invalidateFeatureFlag(tenantId, featureId, env);

      // Invalidate list cache for this tenant and env
      await this.cacheService.invalidateTenantEnv(tenantId, env);

      logger.debug('Cache invalidated', {
        tenantId,
        featureId,
        env,
      });
    } catch (error) {
      logger.error('Cache invalidation failed', {
        error,
        tenantId,
        featureId,
        env,
      });
      // Don't throw - cache invalidation is best effort
    }
  }

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
}


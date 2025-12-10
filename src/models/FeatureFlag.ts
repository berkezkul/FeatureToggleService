import { Knex } from 'knex';
import { Environment, FeatureFlagStrategy, FeatureFlagStrategyConfig } from '../types';

export interface FeatureFlag {
  id: string;
  tenant_id: string;
  feature_id: string;
  env: Environment;
  enabled: boolean;
  strategy_type: FeatureFlagStrategy;
  strategy_config: FeatureFlagStrategyConfig | null;
  created_at: Date;
  updated_at: Date;
}

export interface FeatureFlagInput {
  tenant_id: string;
  feature_id: string;
  env: Environment;
  enabled?: boolean;
  strategy_type?: FeatureFlagStrategy;
  strategy_config?: FeatureFlagStrategyConfig;
}

export interface FeatureFlagQuery {
  tenant_id?: string;
  env?: Environment;
  page?: number;
  limit?: number;
}

export class FeatureFlagModel {
  constructor(private db: Knex) {}

  async findAll(query: FeatureFlagQuery = {}): Promise<FeatureFlag[]> {
    let queryBuilder = this.db('feature_flags')
      .select('feature_flags.*')
      .orderBy('feature_flags.created_at', 'desc');

    if (query.tenant_id) {
      queryBuilder = queryBuilder.where('feature_flags.tenant_id', query.tenant_id);
    }

    if (query.env) {
      queryBuilder = queryBuilder.where('feature_flags.env', query.env);
    }

    if (query.page && query.limit) {
      const offset = (query.page - 1) * query.limit;
      queryBuilder = queryBuilder.limit(query.limit).offset(offset);
    }

    return queryBuilder;
  }

  async count(query: FeatureFlagQuery = {}): Promise<number> {
    let queryBuilder = this.db('feature_flags');

    if (query.tenant_id) {
      queryBuilder = queryBuilder.where('tenant_id', query.tenant_id);
    }

    if (query.env) {
      queryBuilder = queryBuilder.where('env', query.env);
    }

    const result = await queryBuilder.count('* as count').first();
    return parseInt(result?.count as string || '0', 10);
  }

  async findById(id: string): Promise<FeatureFlag | undefined> {
    return this.db('feature_flags').where({ id }).first();
  }

  async findByTenantFeatureEnv(
    tenantId: string,
    featureId: string,
    env: Environment
  ): Promise<FeatureFlag | undefined> {
    return this.db('feature_flags')
      .where({
        tenant_id: tenantId,
        feature_id: featureId,
        env,
      })
      .first();
  }

  async create(data: FeatureFlagInput): Promise<FeatureFlag> {
    const [flag] = await this.db('feature_flags')
      .insert({
        ...data,
        enabled: data.enabled ?? false,
        strategy_type: data.strategy_type ?? 'boolean',
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
      })
      .returning('*');
    return flag;
  }

  async update(id: string, data: Partial<FeatureFlagInput>): Promise<FeatureFlag | undefined> {
    const [flag] = await this.db('feature_flags')
      .where({ id })
      .update({
        ...data,
        updated_at: this.db.fn.now(),
      })
      .returning('*');
    return flag;
  }

  async upsert(data: FeatureFlagInput): Promise<FeatureFlag> {
    const existing = await this.findByTenantFeatureEnv(
      data.tenant_id,
      data.feature_id,
      data.env
    );

    if (existing) {
      return (await this.update(existing.id, data)) || existing;
    }

    return this.create(data);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db('feature_flags').where({ id }).del();
    return deleted > 0;
  }
}


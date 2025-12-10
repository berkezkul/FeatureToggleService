// Test helper utilities

import { Knex } from 'knex';
import { knexInstance } from '../../src/config/database';

/**
 * Create a test database transaction that rolls back automatically
 */
export const withTestTransaction = async <T>(
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> => {
  return knexInstance.transaction(async (trx) => {
    try {
      const result = await callback(trx);
      // Rollback instead of commit for tests
      await trx.rollback();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  });
};

/**
 * Wait for a specified amount of time (for async testing)
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Generate test data helpers
 */
export const testData = {
  tenant: (name: string = 'test-tenant') => ({
    name: `test-tenant-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  }),

  feature: (name: string = 'test-feature') => ({
    name: `test-feature-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    description: 'Test feature description',
  }),

  featureFlag: (tenantId: string, featureId: string, env: 'dev' | 'staging' | 'prod' = 'dev') => ({
    tenant_id: tenantId,
    feature_id: featureId,
    env,
    enabled: true,
    strategy_type: 'boolean' as const,
    strategy_config: { boolean: { enabled: true } },
  }),
};

/**
 * Mock request helper
 */
export const createMockRequest = (overrides: Partial<any> = {}) => {
  return {
    method: 'GET',
    path: '/api/v1/features',
    query: {},
    body: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
};

/**
 * Mock response helper
 */
export const createMockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    get: jest.fn(),
    on: jest.fn(),
  };
  return res;
};


import { Knex } from 'knex';
import { knexInstance } from '../src/config/database';

// Test database setup
export const setupTestDatabase = async (): Promise<Knex> => {
  // Run migrations
  await knexInstance.migrate.latest();
  return knexInstance;
};

// Clean up test database
export const teardownTestDatabase = async (): Promise<void> => {
  await knexInstance.migrate.rollback();
  await knexInstance.destroy();
};

// Clean database between tests
export const cleanDatabase = async (): Promise<void> => {
  await knexInstance('audit_logs').del();
  await knexInstance('feature_flags').del();
  await knexInstance('features').del();
  await knexInstance('tenants').del();
};


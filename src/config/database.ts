import { Pool } from 'pg';
import knex, { Knex } from 'knex';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const knexConfig = require('../../knexfile');
import logger from './logger';

const env = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production';

// Knex instance for migrations and queries
export const knexInstance: Knex = knex(knexConfig[env]);

// PostgreSQL Pool for direct queries (if needed)
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'feature_toggle_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  // Connection retry configuration
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Test connection
pool.on('error', (err: Error) => {
  logger.error('Unexpected error on idle PostgreSQL client', {
    error: err.message,
    stack: err.stack,
  });
  // Don't exit in production, let the app handle reconnection
  if (env === 'development') {
    process.exit(-1);
  }
});

// Graceful shutdown
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    await knexInstance.destroy();
    await pool.end();
    logger.info('Database connections closed gracefully');
  } catch (error) {
    logger.error('Error closing database connections', { error });
    throw error;
  }
};

export default pool;


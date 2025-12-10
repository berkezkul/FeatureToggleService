import { Knex } from 'knex';

/**
 * Execute a function within a database transaction
 * Automatically commits on success or rolls back on error
 */
export const withTransaction = async <T>(
  db: Knex,
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> => {
  return db.transaction(async (trx) => {
    try {
      return await callback(trx);
    } catch (error) {
      // Transaction will automatically rollback on error
      throw error;
    }
  });
};


import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('feature_flags', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('feature_id').notNullable().references('id').inTable('features').onDelete('CASCADE');
    table.string('env', 20).notNullable(); // 'dev', 'staging', 'prod'
    table.boolean('enabled').defaultTo(false);
    table.string('strategy_type', 50).notNullable().defaultTo('boolean'); // 'boolean', 'percentage', 'user_targeting'
    table.jsonb('strategy_config').nullable(); // Strategy-specific configuration
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Composite unique constraint: one flag per tenant-feature-env combination
    table.unique(['tenant_id', 'feature_id', 'env']);

    // Composite index for fast reads
    table.index(['tenant_id', 'env']);
    table.index(['feature_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('feature_flags');
}


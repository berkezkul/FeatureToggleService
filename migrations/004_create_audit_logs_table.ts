import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('action', 50).notNullable(); // 'CREATE', 'UPDATE', 'DELETE'
    table.string('entity_type', 50).notNullable(); // 'feature_flag', 'tenant', 'feature'
    table.uuid('entity_id').notNullable();
    table.string('actor').nullable(); // User ID or API key identifier
    table.jsonb('old_value').nullable(); // Previous state
    table.jsonb('new_value').nullable(); // New state
    table.jsonb('metadata').nullable(); // Additional context
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['entity_type', 'entity_id']);
    table.index(['actor']);
    table.index(['created_at']);
    table.index(['action']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('audit_logs');
}


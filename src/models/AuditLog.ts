import { Knex } from 'knex';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  actor: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface AuditLogInput {
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  actor?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  entity_type?: string;
  entity_id?: string;
  actor?: string;
  action?: AuditAction;
  start_date?: Date;
  end_date?: Date;
  page?: number;
  limit?: number;
}

export class AuditLogModel {
  constructor(private db: Knex) {}

  async findAll(query: AuditLogQuery = {}): Promise<AuditLog[]> {
    let queryBuilder = this.db('audit_logs')
      .select('*')
      .orderBy('created_at', 'desc');

    if (query.entity_type) {
      queryBuilder = queryBuilder.where('entity_type', query.entity_type);
    }

    if (query.entity_id) {
      queryBuilder = queryBuilder.where('entity_id', query.entity_id);
    }

    if (query.actor) {
      queryBuilder = queryBuilder.where('actor', query.actor);
    }

    if (query.action) {
      queryBuilder = queryBuilder.where('action', query.action);
    }

    if (query.start_date) {
      queryBuilder = queryBuilder.where('created_at', '>=', query.start_date);
    }

    if (query.end_date) {
      queryBuilder = queryBuilder.where('created_at', '<=', query.end_date);
    }

    if (query.page && query.limit) {
      const offset = (query.page - 1) * query.limit;
      queryBuilder = queryBuilder.limit(query.limit).offset(offset);
    }

    return queryBuilder;
  }

  async count(query: AuditLogQuery = {}): Promise<number> {
    let queryBuilder = this.db('audit_logs');

    if (query.entity_type) {
      queryBuilder = queryBuilder.where('entity_type', query.entity_type);
    }

    if (query.entity_id) {
      queryBuilder = queryBuilder.where('entity_id', query.entity_id);
    }

    if (query.actor) {
      queryBuilder = queryBuilder.where('actor', query.actor);
    }

    if (query.action) {
      queryBuilder = queryBuilder.where('action', query.action);
    }

    if (query.start_date) {
      queryBuilder = queryBuilder.where('created_at', '>=', query.start_date);
    }

    if (query.end_date) {
      queryBuilder = queryBuilder.where('created_at', '<=', query.end_date);
    }

    const result = await queryBuilder.count('* as count').first();
    return parseInt(result?.count as string || '0', 10);
  }

  async findById(id: string): Promise<AuditLog | undefined> {
    return this.db('audit_logs').where({ id }).first();
  }

  async create(data: AuditLogInput): Promise<AuditLog> {
    const [log] = await this.db('audit_logs')
      .insert({
        ...data,
        created_at: this.db.fn.now(),
      })
      .returning('*');
    return log;
  }
}


import { Knex } from 'knex';

export interface Tenant {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface TenantInput {
  name: string;
}

export class TenantModel {
  constructor(private db: Knex) {}

  async findAll(): Promise<Tenant[]> {
    return this.db('tenants').select('*');
  }

  async findById(id: string): Promise<Tenant | undefined> {
    return this.db('tenants').where({ id }).first();
  }

  async findByName(name: string): Promise<Tenant | undefined> {
    return this.db('tenants').where({ name }).first();
  }

  async create(data: TenantInput): Promise<Tenant> {
    const [tenant] = await this.db('tenants')
      .insert({
        ...data,
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
      })
      .returning('*');
    return tenant;
  }

  async update(id: string, data: Partial<TenantInput>): Promise<Tenant | undefined> {
    const [tenant] = await this.db('tenants')
      .where({ id })
      .update({
        ...data,
        updated_at: this.db.fn.now(),
      })
      .returning('*');
    return tenant;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db('tenants').where({ id }).del();
    return deleted > 0;
  }
}


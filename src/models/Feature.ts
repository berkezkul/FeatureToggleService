import { Knex } from 'knex';

export interface Feature {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FeatureInput {
  name: string;
  description?: string;
}

export class FeatureModel {
  constructor(private db: Knex) {}

  async findAll(): Promise<Feature[]> {
    return this.db('features').select('*');
  }

  async findById(id: string): Promise<Feature | undefined> {
    return this.db('features').where({ id }).first();
  }

  async findByName(name: string): Promise<Feature | undefined> {
    return this.db('features').where({ name }).first();
  }

  async create(data: FeatureInput): Promise<Feature> {
    const [feature] = await this.db('features')
      .insert({
        ...data,
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
      })
      .returning('*');
    return feature;
  }

  async update(id: string, data: Partial<FeatureInput>): Promise<Feature | undefined> {
    const [feature] = await this.db('features')
      .where({ id })
      .update({
        ...data,
        updated_at: this.db.fn.now(),
      })
      .returning('*');
    return feature;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db('features').where({ id }).del();
    return deleted > 0;
  }
}


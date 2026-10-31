// Database Service
// ================
// Handles PostgreSQL database connections and queries.
// Uses the pg library following the repository's conventions.

import { Pool, QueryResult } from 'pg';

export interface DatabaseClient {
  query: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
  transaction: (fn: (trx: DatabaseClient) => Promise<any>) => Promise<any>;
}

export class DatabaseService implements DatabaseClient {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    this.pool = new Pool({
      connectionString,
      // For local development without DATABASE_URL, use a default
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }

  /** Execute a SQL query with optional parameters */
  async query(sql: string, params?: any[]): Promise<QueryResult<any>> {
    const client = this.pool.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  /** Execute a transaction */
  async transaction<T>(fn: (trx: DatabaseClient) => Promise<T>): Promise<T> {
    const client = this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn({
        query: (sql: string, params?: any[]) => client.query(sql, params),
      });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Close the pool */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
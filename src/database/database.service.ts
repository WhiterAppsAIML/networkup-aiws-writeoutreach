// Database Service
// ================
// Handles MySQL database connections and queries.
// Uses the mysql2 library following standard conventions.

import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface DatabaseClient {
  query: (sql: string, params?: any[]) => Promise<any>;
  transaction: (fn: (trx: DatabaseClient) => Promise<any>) => Promise<any>;
}

export class DatabaseService implements DatabaseClient {
  private pool: mysql.Pool;

  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'writeoutreach';

    this.pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 60000,
    });
  }

  /** Execute a SQL query with optional parameters */
  async query(sql: string, params?: any[]): Promise<any> {
    const connection = await this.pool.getConnection();
    try {
      // Replace UUID v4 placeholders if no params provided for the first value
      let queryString = sql;
      if (!params) {
        queryString = sql.replace(/\$\{uuid\}/g, uuidv4);
      }
      const [results] = await connection.query(queryString, params);
      return results;
    } finally {
      connection.release();
    }
  }

  /** Execute a transaction */
  async transaction<T>(fn: (trx: DatabaseClient) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await fn({
        query: (sql: string, params?: any[]) => connection.query(sql, params),
      });
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /** Close the pool */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
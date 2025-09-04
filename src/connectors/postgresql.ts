import { Pool, PoolClient } from 'pg';
import { BaseConnector } from './base';
import { TableInfo, FieldInfo } from '../types';

export class PostgreSQLConnector extends BaseConnector {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    this.pool = new Pool({
      host: this.config.host || 'localhost',
      port: this.config.port || 5432,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl,
      max: 10,
    });
    
    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    
    const result = await this.pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    return result.rows.map(row => row.table_name);
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.pool) throw new Error('Not connected');
    
    // Get column information
    const columnsResult = await this.pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    // Get row count
    const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const rowCount = parseInt(countResult.rows[0].count);
    
    const fields: FieldInfo[] = columnsResult.rows.map(col => ({
      name: col.column_name,
      type: this.normalizeFieldType(col.data_type),
      nullable: col.is_nullable === 'YES',
      defaultValue: col.column_default,
    }));
    
    return {
      name: tableName,
      fields,
      rowCount,
    };
  }

  async *streamTableData(tableName: string, batchSize: number = 1000): AsyncIterableIterator<any[]> {
    if (!this.pool) throw new Error('Not connected');
    
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await this.pool.query(
        `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`,
        [batchSize, offset]
      );
      
      if (result.rows.length === 0) {
        hasMore = false;
      } else {
        yield result.rows;
        offset += batchSize;
      }
    }
  }

  async createTable(tableInfo: TableInfo): Promise<void> {
    if (!this.pool) throw new Error('Not connected');
    
    const columns = tableInfo.fields.map(field => {
      let columnDef = `"${field.name}"`;
      
      switch (field.type) {
        case 'integer':
          columnDef += ' INTEGER';
          break;
        case 'string':
          columnDef += ' TEXT';
          break;
        case 'number':
          columnDef += ' NUMERIC(10,2)';
          break;
        case 'date':
          columnDef += ' TIMESTAMP';
          break;
        case 'boolean':
          columnDef += ' BOOLEAN';
          break;
        case 'json':
          columnDef += ' JSONB';
          break;
        case 'binary':
          columnDef += ' BYTEA';
          break;
        default:
          columnDef += ' TEXT';
      }
      
      if (!field.nullable) {
        columnDef += ' NOT NULL';
      }
      
      if (field.defaultValue !== undefined) {
        columnDef += ` DEFAULT ${field.defaultValue}`;
      }
      
      return columnDef;
    }).join(', ');
    
    const createTableQuery = `CREATE TABLE IF NOT EXISTS "${tableInfo.name}" (${columns})`;
    await this.pool.query(createTableQuery);
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    if (!this.pool || data.length === 0) return;
    
    const columns = Object.keys(data[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES (${placeholders})`;
    
    for (const row of data) {
      const values = columns.map(col => row[col]);
      await this.pool.query(query, values);
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error('Not connected');
    
    const result = await this.pool.query(query, params || []);
    return result.rows;
  }
}
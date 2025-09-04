import mysql from 'mysql2/promise';
import { BaseConnector } from './base';
import { TableInfo, FieldInfo } from '../types';

export class MySQLConnector extends BaseConnector {
  private pool: mysql.Pool | null = null;

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl,
      connectionLimit: 10,
    });
    
    // Test connection
    const connection = await this.pool.getConnection();
    connection.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    
    const [rows] = await this.pool.execute(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
      [this.config.database]
    );
    
    return (rows as any[]).map(row => row.TABLE_NAME);
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.pool) throw new Error('Not connected');
    
    // Get column information
    const [columns] = await this.pool.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [this.config.database, tableName]
    );
    
    // Get row count
    const [countResult] = await this.pool.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    const rowCount = (countResult as any[])[0].count;
    
    const fields: FieldInfo[] = (columns as any[]).map(col => ({
      name: col.COLUMN_NAME,
      type: this.normalizeFieldType(col.DATA_TYPE),
      nullable: col.IS_NULLABLE === 'YES',
      defaultValue: col.COLUMN_DEFAULT,
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
      const [rows] = await this.pool.execute(
        `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
        [batchSize, offset]
      );
      
      const batch = rows as any[];
      if (batch.length === 0) {
        hasMore = false;
      } else {
        yield batch;
        offset += batchSize;
      }
    }
  }

  async createTable(tableInfo: TableInfo): Promise<void> {
    if (!this.pool) throw new Error('Not connected');
    
    const columns = tableInfo.fields.map(field => {
      let columnDef = `\`${field.name}\``;
      
      switch (field.type) {
        case 'integer':
          columnDef += ' INT';
          break;
        case 'string':
          columnDef += ' TEXT';
          break;
        case 'number':
          columnDef += ' DECIMAL(10,2)';
          break;
        case 'date':
          columnDef += ' DATETIME';
          break;
        case 'boolean':
          columnDef += ' BOOLEAN';
          break;
        case 'json':
          columnDef += ' JSON';
          break;
        case 'binary':
          columnDef += ' BLOB';
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
    
    const createTableQuery = `CREATE TABLE IF NOT EXISTS \`${tableInfo.name}\` (${columns})`;
    await this.pool.execute(createTableQuery);
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    if (!this.pool || data.length === 0) return;
    
    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${placeholders})`;
    
    const values = data.map(row => columns.map(col => row[col]));
    
    await this.pool.execute(query, values.flat());
  }

  async executeQuery(query: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error('Not connected');
    
    const [result] = await this.pool.execute(query, params || []);
    return result;
  }
}
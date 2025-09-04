import sqlite3 from 'sqlite3';
import { BaseConnector } from './base';
import { TableInfo, FieldInfo } from '../types';

export class SQLiteConnector extends BaseConnector {
  private db: sqlite3.Database | null = null;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dbPath = this.config.file || this.config.database;
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async getTables(): Promise<string[]> {
    if (!this.db) throw new Error('Not connected');
    
    return new Promise((resolve, reject) => {
      this.db!.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => row.name));
          }
        }
      );
    });
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.db) throw new Error('Not connected');
    
    return new Promise((resolve, reject) => {
      // Get column information
      this.db!.all(`PRAGMA table_info(${tableName})`, (err, columns: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Get row count
        this.db!.get(`SELECT COUNT(*) as count FROM "${tableName}"`, (err, countResult: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          const fields: FieldInfo[] = columns.map(col => ({
            name: col.name,
            type: this.normalizeFieldType(col.type),
            nullable: !col.notnull,
            defaultValue: col.dflt_value,
          }));
          
          resolve({
            name: tableName,
            fields,
            rowCount: countResult.count,
          });
        });
      });
    });
  }

  async *streamTableData(tableName: string, batchSize: number = 1000): AsyncIterableIterator<any[]> {
    if (!this.db) throw new Error('Not connected');
    
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const batch = await new Promise<any[]>((resolve, reject) => {
        this.db!.all(
          `SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`,
          [batchSize, offset],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows as any[]);
            }
          }
        );
      });
      
      if (batch.length === 0) {
        hasMore = false;
      } else {
        yield batch;
        offset += batchSize;
      }
    }
  }

  async createTable(tableInfo: TableInfo): Promise<void> {
    if (!this.db) throw new Error('Not connected');
    
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
          columnDef += ' REAL';
          break;
        case 'date':
          columnDef += ' TEXT'; // SQLite doesn't have native date type
          break;
        case 'boolean':
          columnDef += ' INTEGER'; // SQLite uses 0/1 for boolean
          break;
        case 'json':
          columnDef += ' TEXT'; // Store JSON as text in SQLite
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
    
    const createTableQuery = `CREATE TABLE IF NOT EXISTS "${tableInfo.name}" (${columns})`;
    
    return new Promise((resolve, reject) => {
      this.db!.run(createTableQuery, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    if (!this.db || data.length === 0) return;
    
    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES (${placeholders})`;
    
    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(query);
      
      const insertRow = (row: any, index: number) => {
        const values = columns.map(col => row[col]);
        stmt.run(values, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (index === data.length - 1) {
            stmt.finalize((err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          }
        });
      };
      
      data.forEach(insertRow);
    });
  }

  async executeQuery(query: string, params?: any[]): Promise<any> {
    if (!this.db) throw new Error('Not connected');
    
    return new Promise((resolve, reject) => {
      this.db!.all(query, params || [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}
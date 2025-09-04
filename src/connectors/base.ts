import { DatabaseConnector, TableInfo, FieldInfo } from '../types';

export abstract class BaseConnector implements DatabaseConnector {
  protected config: any;
  protected connection: any;

  constructor(config: any) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getTables(): Promise<string[]>;
  abstract getTableInfo(tableName: string): Promise<TableInfo>;
  abstract streamTableData(tableName: string, batchSize?: number): AsyncIterableIterator<any[]>;
  abstract createTable(tableInfo: TableInfo): Promise<void>;
  abstract insertData(tableName: string, data: any[]): Promise<void>;
  abstract executeQuery(query: string, params?: any[]): Promise<any>;

  protected normalizeFieldType(dbType: string): string {
    const type = dbType.toLowerCase();
    
    if (type.includes('int') || type.includes('serial')) return 'integer';
    if (type.includes('varchar') || type.includes('text') || type.includes('char')) return 'string';
    if (type.includes('decimal') || type.includes('numeric') || type.includes('float') || type.includes('double')) return 'number';
    if (type.includes('date') || type.includes('time') || type.includes('timestamp')) return 'date';
    if (type.includes('bool')) return 'boolean';
    if (type.includes('json')) return 'json';
    if (type.includes('blob') || type.includes('bytea')) return 'binary';
    
    return 'string';
  }

  protected buildConnectionString(): string {
    const { type, host, port, database, username, password, file } = this.config;
    
    switch (type) {
      case 'mysql':
        return `mysql://${username}:${password}@${host}:${port}/${database}`;
      case 'postgresql':
        return `postgresql://${username}:${password}@${host}:${port}/${database}`;
      case 'sqlite':
        return file || database;
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }
}
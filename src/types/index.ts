export interface DatabaseConfig {
  type: 'mysql' | 'postgresql' | 'sqlite';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  file?: string; // for SQLite
  ssl?: boolean;
}

export interface TableConfig {
  name: string;
  anonymizeFields?: string[];
  excludeFields?: string[];
  batchSize?: number;
}

export interface DebaserConfig {
  source: DatabaseConfig;
  destination: DatabaseConfig;
  tables: TableConfig[];
  batchSize?: number;
  parallel?: number;
}

export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
}

export interface TableInfo {
  name: string;
  fields: FieldInfo[];
  rowCount?: number;
}

export interface AnonymizationRule {
  fieldName: string;
  method: 'email' | 'name' | 'phone' | 'address' | 'random' | 'hash' | 'null';
  options?: Record<string, any>;
}

export interface DatabaseConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getTables(): Promise<string[]>;
  getTableInfo(tableName: string): Promise<TableInfo>;
  streamTableData(tableName: string, batchSize?: number): AsyncIterableIterator<any[]>;
  createTable(tableInfo: TableInfo): Promise<void>;
  insertData(tableName: string, data: any[]): Promise<void>;
  executeQuery(query: string, params?: any[]): Promise<any>;
}

export interface Anonymizer {
  anonymizeField(fieldName: string, value: any, fieldType: string): any;
  shouldAnonymize(fieldName: string, fieldType: string): boolean;
}

export interface ProgressCallback {
  (table: string, processed: number, total: number): void;
}
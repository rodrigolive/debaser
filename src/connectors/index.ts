import { DatabaseConnector, DatabaseConfig } from '../types';
import { MySQLConnector } from './mysql';
import { PostgreSQLConnector } from './postgresql';
import { SQLiteConnector } from './sqlite';

export function createConnector(config: DatabaseConfig): DatabaseConnector {
  switch (config.type) {
    case 'mysql':
      return new MySQLConnector(config);
    case 'postgresql':
      return new PostgreSQLConnector(config);
    case 'sqlite':
      return new SQLiteConnector(config);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

export { MySQLConnector, PostgreSQLConnector, SQLiteConnector };
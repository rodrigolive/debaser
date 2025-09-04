import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { DebaserConfig, DatabaseConfig } from '../types';

export class ConfigParser {
  static async parseConfig(configPath?: string): Promise<DebaserConfig> {
    if (configPath) {
      return this.parseFromFile(configPath);
    }
    
    // Look for default config files
    const defaultPaths = [
      'debaser.yaml',
      'debaser.yml',
      'debaser.json',
      '.debaser.yaml',
      '.debaser.yml',
      '.debaser.json',
    ];
    
    for (const configFile of defaultPaths) {
      if (fs.existsSync(configFile)) {
        return this.parseFromFile(configFile);
      }
    }
    
    throw new Error('No configuration file found. Please provide a config file or use command line arguments.');
  }

  private static async parseFromFile(configPath: string): Promise<DebaserConfig> {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const content = fs.readFileSync(configPath, 'utf8');
    const ext = path.extname(configPath).toLowerCase();
    
    let config: any;
    
    if (ext === '.json') {
      config = JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      config = yaml.parse(content);
    } else {
      throw new Error(`Unsupported configuration file format: ${ext}`);
    }
    
    return this.validateConfig(config);
  }

  static parseDatabaseUrl(url: string): DatabaseConfig {
    try {
      const parsed = new URL(url);
      
      switch (parsed.protocol) {
        case 'mysql:':
          return {
            type: 'mysql',
            host: parsed.hostname,
            port: parsed.port ? parseInt(parsed.port) : 3306,
            database: parsed.pathname.slice(1), // Remove leading slash
            username: parsed.username,
            password: parsed.password,
            ssl: parsed.searchParams.get('ssl') === 'true',
          };
          
        case 'postgresql:':
        case 'postgres:':
          return {
            type: 'postgresql',
            host: parsed.hostname,
            port: parsed.port ? parseInt(parsed.port) : 5432,
            database: parsed.pathname.slice(1), // Remove leading slash
            username: parsed.username,
            password: parsed.password,
            ssl: parsed.searchParams.get('ssl') === 'true',
          };
          
        case 'sqlite:':
          return {
            type: 'sqlite',
            file: parsed.pathname,
            database: parsed.pathname,
          };
          
        default:
          throw new Error(`Unsupported database protocol: ${parsed.protocol}`);
      }
    } catch (error) {
      // If URL parsing fails, treat as SQLite file path
      return {
        type: 'sqlite',
        file: url,
        database: url,
      };
    }
  }

  private static validateConfig(config: any): DebaserConfig {
    if (!config.source) {
      throw new Error('Configuration must specify a source database');
    }
    
    if (!config.destination) {
      throw new Error('Configuration must specify a destination database');
    }
    
    if (!config.tables || !Array.isArray(config.tables)) {
      throw new Error('Configuration must specify tables to migrate');
    }
    
    return {
      source: this.validateDatabaseConfig(config.source),
      destination: this.validateDatabaseConfig(config.destination),
      tables: config.tables.map((table: any) => ({
        name: table.name,
        anonymizeFields: table.anonymizeFields || [],
        excludeFields: table.excludeFields || [],
        batchSize: table.batchSize || 1000,
      })),
      batchSize: config.batchSize || 1000,
      parallel: config.parallel || 1,
    };
  }

  private static validateDatabaseConfig(dbConfig: any): DatabaseConfig {
    if (typeof dbConfig === 'string') {
      return this.parseDatabaseUrl(dbConfig);
    }
    
    if (!dbConfig.type) {
      throw new Error('Database configuration must specify a type');
    }
    
    if (!['mysql', 'postgresql', 'sqlite'].includes(dbConfig.type)) {
      throw new Error(`Unsupported database type: ${dbConfig.type}`);
    }
    
    if (dbConfig.type === 'sqlite') {
      if (!dbConfig.file && !dbConfig.database) {
        throw new Error('SQLite configuration must specify a file path');
      }
    } else {
      if (!dbConfig.host || !dbConfig.database) {
        throw new Error(`${dbConfig.type} configuration must specify host and database`);
      }
    }
    
    return {
      type: dbConfig.type,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      username: dbConfig.username,
      password: dbConfig.password,
      file: dbConfig.file,
      ssl: dbConfig.ssl,
    };
  }
}
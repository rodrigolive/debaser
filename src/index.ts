import { DebaserConfig, DatabaseConfig, ProgressCallback, FieldInfo } from './types';
import { ConfigParser } from './config';
import { createConnector } from './connectors';
import { DataProcessor } from './streams';

export class Debaser {
  private config: DebaserConfig;
  private sourceConnector: any;
  private destConnector: any;

  constructor(config: DebaserConfig) {
    this.config = config;
  }

  /**
   * Create a Debaser instance from a configuration file
   */
  static async fromConfig(configPath: string): Promise<Debaser> {
    const config = await ConfigParser.parseConfig(configPath);
    return new Debaser(config);
  }

  /**
   * Create a Debaser instance from database URLs
   */
  static fromUrls(
    sourceUrl: string,
    destUrl: string,
    tables: Array<{
      name: string;
      anonymizeFields?: string[];
      excludeFields?: string[];
      batchSize?: number;
    }> = []
  ): Debaser {
    const source = ConfigParser.parseDatabaseUrl(sourceUrl);
    const destination = ConfigParser.parseDatabaseUrl(destUrl);
    
    const config: DebaserConfig = {
      source,
      destination,
      tables,
      batchSize: 1000,
      parallel: 1,
    };
    
    return new Debaser(config);
  }

  /**
   * Initialize connections to source and destination databases
   */
  async connect(): Promise<void> {
    this.sourceConnector = createConnector(this.config.source);
    this.destConnector = createConnector(this.config.destination);
    
    await this.sourceConnector.connect();
    await this.destConnector.connect();
  }

  /**
   * Close connections to databases
   */
  async disconnect(): Promise<void> {
    if (this.sourceConnector) {
      await this.sourceConnector.disconnect();
    }
    if (this.destConnector) {
      await this.destConnector.disconnect();
    }
  }

  /**
   * Get list of tables in the source database
   */
  async getSourceTables(): Promise<string[]> {
    if (!this.sourceConnector) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.sourceConnector.getTables();
  }

  /**
   * Get information about a specific table
   */
  async getTableInfo(tableName: string): Promise<any> {
    if (!this.sourceConnector) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.sourceConnector.getTableInfo(tableName);
  }

  /**
   * Migrate all configured tables
   */
  async migrate(progressCallback?: ProgressCallback): Promise<void> {
    if (!this.sourceConnector || !this.destConnector) {
      throw new Error('Not connected. Call connect() first.');
    }

    const processor = new DataProcessor(
      this.sourceConnector,
      this.destConnector,
      progressCallback
    );

    await processor.processAllTables(this.config.tables);
  }

  /**
   * Migrate a specific table
   */
  async migrateTable(
    tableName: string,
    anonymizeFields: string[] = [],
    excludeFields: string[] = [],
    batchSize?: number,
    progressCallback?: ProgressCallback
  ): Promise<void> {
    if (!this.sourceConnector || !this.destConnector) {
      throw new Error('Not connected. Call connect() first.');
    }

    const processor = new DataProcessor(
      this.sourceConnector,
      this.destConnector,
      progressCallback
    );

    await processor.processTable(
      tableName,
      anonymizeFields,
      excludeFields,
      batchSize || this.config.batchSize
    );
  }

  /**
   * Analyze the source database and suggest anonymization rules
   */
  async analyze(): Promise<{
    tables: Array<{
      name: string;
      rowCount: number;
      sensitiveFields: string[];
      allFields: Array<{ name: string; type: string; nullable: boolean }>;
    }>;
  }> {
    if (!this.sourceConnector) {
      throw new Error('Not connected. Call connect() first.');
    }

    const tables = await this.getSourceTables();
    const analysis = [];

    for (const tableName of tables) {
      const tableInfo = await this.getTableInfo(tableName);
      
      const sensitiveFields = tableInfo.fields
        .filter((field: FieldInfo) => {
          const patterns = [
            /email/i, /mail/i, /name/i, /phone/i, /address/i,
            /password/i, /secret/i, /ssn/i, /credit_card/i
          ];
          return patterns.some(pattern => pattern.test(field.name));
        })
        .map((field: FieldInfo) => field.name);

      analysis.push({
        name: tableName,
        rowCount: tableInfo.rowCount || 0,
        sensitiveFields,
        allFields: tableInfo.fields.map((field: FieldInfo) => ({
          name: field.name,
          type: field.type,
          nullable: field.nullable,
        })),
      });
    }

    return { tables: analysis };
  }
}

// Export types and utilities
export * from './types';
export { ConfigParser } from './config';
export { createConnector } from './connectors';
export { DataProcessor } from './streams';
export { HeuristicAnonymizer } from './anonymizers';
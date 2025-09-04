import { DatabaseConnector, TableInfo, ProgressCallback } from '../types';
import { HeuristicAnonymizer } from '../anonymizers';

export class DataProcessor {
  private sourceConnector: DatabaseConnector;
  private destConnector: DatabaseConnector;
  private anonymizer: HeuristicAnonymizer;
  private progressCallback?: ProgressCallback;

  constructor(
    sourceConnector: DatabaseConnector,
    destConnector: DatabaseConnector,
    progressCallback?: ProgressCallback
  ) {
    this.sourceConnector = sourceConnector;
    this.destConnector = destConnector;
    this.anonymizer = new HeuristicAnonymizer();
    this.progressCallback = progressCallback;
  }

  async processTable(
    tableName: string,
    anonymizeFields: string[] = [],
    excludeFields: string[] = [],
    batchSize: number = 1000
  ): Promise<void> {
    // Get table information from source
    const sourceTableInfo = await this.sourceConnector.getTableInfo(tableName);
    
    // Filter fields based on exclude list
    const filteredFields = sourceTableInfo.fields.filter(
      field => !excludeFields.includes(field.name)
    );
    
    // Create destination table with filtered fields
    const destTableInfo: TableInfo = {
      name: tableName,
      fields: filteredFields,
    };
    
    await this.destConnector.createTable(destTableInfo);
    
    // Process data in batches
    let processedRows = 0;
    const totalRows = sourceTableInfo.rowCount || 0;
    
    for await (const batch of this.sourceConnector.streamTableData(tableName, batchSize)) {
      const processedBatch = batch.map(row => this.processRow(row, filteredFields, anonymizeFields));
      
      await this.destConnector.insertData(tableName, processedBatch);
      
      processedRows += batch.length;
      
      if (this.progressCallback) {
        this.progressCallback(tableName, processedRows, totalRows);
      }
    }
  }

  private processRow(
    row: any,
    fields: any[],
    anonymizeFields: string[]
  ): any {
    const processedRow: any = {};
    
    for (const field of fields) {
      const value = row[field.name];
      
      // Check if field should be anonymized
      const shouldAnonymize = anonymizeFields.includes(field.name) || 
                             this.anonymizer.shouldAnonymize(field.name, field.type);
      
      if (shouldAnonymize) {
        processedRow[field.name] = this.anonymizer.anonymizeField(
          field.name,
          value,
          field.type
        );
      } else {
        processedRow[field.name] = value;
      }
    }
    
    return processedRow;
  }

  async processAllTables(
    tables: Array<{
      name: string;
      anonymizeFields?: string[];
      excludeFields?: string[];
      batchSize?: number;
    }>
  ): Promise<void> {
    for (const table of tables) {
      await this.processTable(
        table.name,
        table.anonymizeFields,
        table.excludeFields,
        table.batchSize
      );
    }
  }
}
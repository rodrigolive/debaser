#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigParser } from './config';
import { createConnector } from './connectors';
import { DataProcessor } from './streams';
import { DebaserConfig } from './types';

const program = new Command();

program
  .name('debaser')
  .description('Database migration tool with data anonymization')
  .version('1.0.0');

program
  .command('migrate')
  .description('Migrate data from source to destination database')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-i, --input <url>', 'Source database URL or file path')
  .option('-o, --output <url>', 'Destination database URL or file path')
  .option('-t, --tables <tables>', 'Comma-separated list of tables to migrate')
  .option('-a, --anonymize <fields>', 'Comma-separated list of fields to anonymize')
  .option('-e, --exclude <fields>', 'Comma-separated list of fields to exclude')
  .option('-b, --batch-size <size>', 'Batch size for processing', '1000')
  .option('--parallel <count>', 'Number of parallel processes', '1')
  .action(async (options) => {
    try {
      await migrateData(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze source database and suggest anonymization rules')
  .option('-i, --input <url>', 'Source database URL or file path')
  .option('-t, --table <table>', 'Table to analyze')
  .action(async (options) => {
    try {
      await analyzeDatabase(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

async function migrateData(options: any): Promise<void> {
  let config: DebaserConfig;
  
  if (options.config) {
    // Load from config file
    config = await ConfigParser.parseConfig(options.config);
  } else if (options.input && options.output) {
    // Build config from command line arguments
    const source = ConfigParser.parseDatabaseUrl(options.input);
    const destination = ConfigParser.parseDatabaseUrl(options.output);
    
    const tables = options.tables 
      ? options.tables.split(',').map((name: string) => ({
          name: name.trim(),
          anonymizeFields: options.anonymize ? options.anonymize.split(',').map((f: string) => f.trim()) : [],
          excludeFields: options.exclude ? options.exclude.split(',').map((f: string) => f.trim()) : [],
          batchSize: parseInt(options.batchSize),
        }))
      : [];
    
    config = {
      source,
      destination,
      tables,
      batchSize: parseInt(options.batchSize),
      parallel: parseInt(options.parallel),
    };
  } else {
    throw new Error('Either --config or both --input and --output must be specified');
  }
  
  console.log(chalk.blue('Starting database migration...'));
  console.log(chalk.gray(`Source: ${config.source.type}://${config.source.host || config.source.file}/${config.source.database}`));
  console.log(chalk.gray(`Destination: ${config.destination.type}://${config.destination.host || config.destination.file}/${config.destination.database}`));
  
  // Create connectors
  const sourceConnector = createConnector(config.source);
  const destConnector = createConnector(config.destination);
  
  try {
    // Connect to databases
    const spinner = ora('Connecting to databases...').start();
    await sourceConnector.connect();
    await destConnector.connect();
    spinner.succeed('Connected to databases');
    
    // Get available tables if not specified
    let tablesToProcess = config.tables;
    if (tablesToProcess.length === 0) {
      spinner.start('Discovering tables...');
      const availableTables = await sourceConnector.getTables();
      tablesToProcess = availableTables.map(name => ({ name }));
      spinner.succeed(`Found ${availableTables.length} tables`);
    }
    
    // Process tables
    const processor = new DataProcessor(
      sourceConnector,
      destConnector,
      (table, processed, total) => {
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
        console.log(chalk.green(`✓ ${table}: ${processed}/${total} (${percentage}%)`));
      }
    );
    
    for (const table of tablesToProcess) {
      const tableSpinner = ora(`Processing table: ${table.name}`).start();
      
      try {
        await processor.processTable(
          table.name,
          table.anonymizeFields,
          table.excludeFields,
          table.batchSize || config.batchSize
        );
        tableSpinner.succeed(`Completed table: ${table.name}`);
      } catch (error) {
        tableSpinner.fail(`Failed table: ${table.name}`);
        throw error;
      }
    }
    
    console.log(chalk.green('✓ Migration completed successfully!'));
    
  } finally {
    await sourceConnector.disconnect();
    await destConnector.disconnect();
  }
}

async function analyzeDatabase(options: any): Promise<void> {
  if (!options.input) {
    throw new Error('--input is required for analysis');
  }
  
  const source = ConfigParser.parseDatabaseUrl(options.input);
  const connector = createConnector(source);
  
  try {
    await connector.connect();
    
    const tables = options.table ? [options.table] : await connector.getTables();
    
    console.log(chalk.blue('Database Analysis Report'));
    console.log(chalk.gray('='.repeat(50)));
    
    for (const tableName of tables) {
      const tableInfo = await connector.getTableInfo(tableName);
      
      console.log(chalk.yellow(`\nTable: ${tableName}`));
      console.log(chalk.gray(`Rows: ${tableInfo.rowCount}`));
      console.log(chalk.gray('Fields:'));
      
      const sensitiveFields = tableInfo.fields.filter(field => {
        const patterns = [
          /email/i, /mail/i, /name/i, /phone/i, /address/i,
          /password/i, /secret/i, /ssn/i, /credit_card/i
        ];
        return patterns.some(pattern => pattern.test(field.name));
      });
      
      tableInfo.fields.forEach(field => {
        const isSensitive = sensitiveFields.includes(field);
        const marker = isSensitive ? chalk.red('🔒') : chalk.green('✓');
        console.log(`  ${marker} ${field.name} (${field.type})`);
      });
      
      if (sensitiveFields.length > 0) {
        console.log(chalk.red(`\n⚠️  ${sensitiveFields.length} potentially sensitive fields detected`));
        console.log(chalk.gray('Consider anonymizing these fields during migration'));
      }
    }
    
  } finally {
    await connector.disconnect();
  }
}

// Handle direct execution
if (require.main === module) {
  program.parse();
}
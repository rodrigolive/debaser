# Debaser

A powerful database migration tool that moves data between different database engines while automatically anonymizing sensitive information. Debaser supports streaming data processing to handle large datasets without memory issues.

[![GitHub](https://img.shields.io/github/license/rodrigolive/debaser)](https://github.com/rodrigolive/debaser/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/rodrigolive/debaser)](https://github.com/rodrigolive/debaser/issues)
[![GitHub stars](https://img.shields.io/github/stars/rodrigolive/debaser)](https://github.com/rodrigolive/debaser)

## Features

- **Multi-Database Support**: Works with MySQL, PostgreSQL, and SQLite
- **Cross-Engine Migration**: Migrate from any supported database to any other
- **Automatic Anonymization**: Uses intelligent heuristics to identify and anonymize sensitive data
- **Streaming Processing**: Handles large datasets without running out of memory
- **Flexible Configuration**: Supports YAML/JSON config files or command-line arguments
- **Dual Interface**: Works as both a CLI tool and a Node.js library
- **Progress Tracking**: Real-time progress reporting during migration

## Installation

```bash
npm install -g debaser
```

Or install locally:

```bash
npm install debaser
```

## Quick Start

### Command Line Usage

Migrate from one database to another:

```bash
# From SQLite to MySQL
debaser migrate -i prod.db -o mysql://user:pass@localhost:3306/testdb

# From MySQL to PostgreSQL
debaser migrate -i mysql://user:pass@localhost:3306/prod -o postgresql://user:pass@localhost:5432/test

# Using a configuration file
debaser migrate -c debaser.yaml
```

### Library Usage

```typescript
import { Debaser } from 'debaser';

// Create instance from URLs
const debaser = Debaser.fromUrls(
  'mysql://user:pass@localhost:3306/source',
  'postgresql://user:pass@localhost:5432/destination',
  [
    { name: 'users', anonymizeFields: ['email', 'name'] },
    { name: 'orders' }
  ]
);

// Connect and migrate
await debaser.connect();
await debaser.migrate((table, processed, total) => {
  console.log(`${table}: ${processed}/${total}`);
});
await debaser.disconnect();
```

## Configuration

### Configuration File Format

Create a `debaser.yaml` or `debaser.json` file:

```yaml
source:
  type: mysql
  host: localhost
  port: 3306
  database: production_db
  username: root
  password: secret

destination:
  type: postgresql
  host: localhost
  port: 5432
  database: test_db
  username: postgres
  password: secret

tables:
  - name: users
    anonymizeFields:
      - email
      - first_name
      - last_name
      - phone
    excludeFields:
      - password_hash
    batchSize: 500

  - name: orders
    anonymizeFields:
      - customer_email
      - shipping_address
    batchSize: 1000

  - name: products
    # No anonymization needed
    batchSize: 2000

batchSize: 1000
parallel: 2
```

### Database URL Formats

- **MySQL**: `mysql://username:password@host:port/database`
- **PostgreSQL**: `postgresql://username:password@host:port/database`
- **SQLite**: `sqlite:///path/to/file.db` or just the file path

## Anonymization

Debaser automatically detects sensitive fields using intelligent heuristics based on field names and data types. It supports various anonymization methods:

### Automatic Detection

Fields matching these patterns are automatically anonymized:
- Email: `email`, `mail`, `e_mail`
- Names: `name`, `first_name`, `last_name`, `username`
- Phone: `phone`, `telephone`, `mobile`, `cell`
- Address: `address`, `street`, `city`, `zip`
- Sensitive: `password`, `secret`, `ssn`, `credit_card`

### Anonymization Methods

- **Email**: `john.doe@example.com` → `jo**@example.com`
- **Names**: `John Doe` → `J*** D**`
- **Phone**: `555-123-4567` → `***-***-4567`
- **Address**: `123 Main Street` → `*** **** Street`
- **Passwords**: `secret123` → `********`
- **Generic**: `sensitive_data` → `s********a`

## CLI Commands

### Migrate

```bash
debaser migrate [options]

Options:
  -c, --config <path>     Configuration file path
  -i, --input <url>       Source database URL or file path
  -o, --output <url>      Destination database URL or file path
  -t, --tables <tables>   Comma-separated list of tables to migrate
  -a, --anonymize <fields> Comma-separated list of fields to anonymize
  -e, --exclude <fields>  Comma-separated list of fields to exclude
  -b, --batch-size <size> Batch size for processing (default: 1000)
  --parallel <count>      Number of parallel processes (default: 1)
```

### Analyze

```bash
debaser analyze [options]

Options:
  -i, --input <url>       Source database URL or file path
  -t, --table <table>     Table to analyze (optional, analyzes all if not specified)
```

## API Reference

### Debaser Class

#### Static Methods

- `Debaser.fromConfig(configPath: string): Promise<Debaser>`
- `Debaser.fromUrls(sourceUrl: string, destUrl: string, tables?: TableConfig[]): Debaser`

#### Instance Methods

- `connect(): Promise<void>` - Connect to source and destination databases
- `disconnect(): Promise<void>` - Close database connections
- `getSourceTables(): Promise<string[]>` - Get list of tables in source database
- `getTableInfo(tableName: string): Promise<TableInfo>` - Get table schema information
- `migrate(progressCallback?: ProgressCallback): Promise<void>` - Migrate all configured tables
- `migrateTable(tableName: string, anonymizeFields?: string[], excludeFields?: string[], batchSize?: number, progressCallback?: ProgressCallback): Promise<void>` - Migrate a specific table
- `analyze(): Promise<AnalysisResult>` - Analyze database and suggest anonymization rules

### Types

```typescript
interface DatabaseConfig {
  type: 'mysql' | 'postgresql' | 'sqlite';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  file?: string; // for SQLite
  ssl?: boolean;
}

interface TableConfig {
  name: string;
  anonymizeFields?: string[];
  excludeFields?: string[];
  batchSize?: number;
}

interface ProgressCallback {
  (table: string, processed: number, total: number): void;
}
```

## Examples

### Basic Migration

```bash
# Migrate all tables from production to test database
debaser migrate -i mysql://root:secret@localhost:3306/prod -o postgresql://postgres:secret@localhost:5432/test
```

### Selective Migration

```bash
# Migrate only specific tables with custom anonymization
debaser migrate \
  -i mysql://root:secret@localhost:3306/prod \
  -o postgresql://postgres:secret@localhost:5432/test \
  -t users,orders \
  -a email,phone,address \
  -e password_hash,internal_notes
```

### Programmatic Usage

```typescript
import { Debaser } from 'debaser';

async function migrateData() {
  const debaser = await Debaser.fromConfig('./debaser.yaml');
  
  await debaser.connect();
  
  // Analyze the source database
  const analysis = await debaser.analyze();
  console.log('Found sensitive fields:', analysis.tables.flatMap(t => t.sensitiveFields));
  
  // Migrate with progress tracking
  await debaser.migrate((table, processed, total) => {
    const percentage = Math.round((processed / total) * 100);
    console.log(`${table}: ${percentage}% complete`);
  });
  
  await debaser.disconnect();
}

migrateData().catch(console.error);
```

## Performance Considerations

- **Batch Size**: Larger batch sizes improve performance but use more memory
- **Parallel Processing**: Use `--parallel` option for multiple tables
- **Streaming**: Data is processed in streams to handle large datasets
- **Memory Usage**: Memory usage is constant regardless of dataset size

## Error Handling

Debaser provides detailed error messages and graceful error handling:

- Connection failures are reported with specific database details
- Table creation errors include SQL statements for debugging
- Data insertion errors show batch information
- Progress is preserved across errors for resumable operations

## Contributing

We welcome contributions to Debaser! Here's how you can help:

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/debaser.git
   cd debaser
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Workflow

1. **Make your changes** following our coding standards
2. **Add tests** for any new functionality
3. **Run the test suite**:
   ```bash
   npm test
   ```
4. **Run linting**:
   ```bash
   npm run lint
   ```
5. **Build the project**:
   ```bash
   npm run build
   ```

### Submitting Changes

1. **Commit your changes** with a clear commit message:
   ```bash
   git commit -m "Add feature: brief description"
   ```
2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
3. **Create a Pull Request** on GitHub with:
   - A clear title and description
   - Reference to any related issues
   - Screenshots or examples if applicable

### Code Standards

- Follow the existing code style and patterns
- Write clear, self-documenting code
- Add JSDoc comments for public APIs
- Ensure all tests pass
- Update documentation as needed

### Types of Contributions

- **Bug fixes**: Report issues and submit fixes
- **New features**: Propose and implement new functionality
- **Documentation**: Improve README, API docs, or examples
- **Tests**: Add test coverage for existing or new code
- **Performance**: Optimize existing functionality

### Questions or Need Help?

- Open an [issue](https://github.com/rodrigolive/debaser/issues) for bugs or feature requests
- Start a [discussion](https://github.com/rodrigolive/debaser/discussions) for questions
- Check existing issues and discussions first

Thank you for contributing to Debaser! 🚀

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

Rodrigo González  
Created by [rodrigolive](https://github.com/rodrigolive)

---

**Repository**: [https://github.com/rodrigolive/debaser](https://github.com/rodrigolive/debaser)  
**Issues**: [https://github.com/rodrigolive/debaser/issues](https://github.com/rodrigolive/debaser/issues)  
**Discussions**: [https://github.com/rodrigolive/debaser/discussions](https://github.com/rodrigolive/debaser/discussions)

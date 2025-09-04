import { ConfigParser } from '../config/parser';

describe('ConfigParser', () => {
  describe('parseDatabaseUrl', () => {
    it('should parse MySQL URLs', () => {
      const config = ConfigParser.parseDatabaseUrl('mysql://user:pass@localhost:3306/dbname');
      expect(config).toEqual({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'dbname',
        username: 'user',
        password: 'pass',
        ssl: false,
      });
    });

    it('should parse PostgreSQL URLs', () => {
      const config = ConfigParser.parseDatabaseUrl('postgresql://user:pass@localhost:5432/dbname');
      expect(config).toEqual({
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'dbname',
        username: 'user',
        password: 'pass',
        ssl: false,
      });
    });

    it('should parse SQLite file paths', () => {
      const config = ConfigParser.parseDatabaseUrl('sqlite:///path/to/database.db');
      expect(config).toEqual({
        type: 'sqlite',
        file: '/path/to/database.db',
        database: '/path/to/database.db',
      });
    });

    it('should treat invalid URLs as SQLite file paths', () => {
      const config = ConfigParser.parseDatabaseUrl('/path/to/database.db');
      expect(config).toEqual({
        type: 'sqlite',
        file: '/path/to/database.db',
        database: '/path/to/database.db',
      });
    });

    it('should handle SSL parameters', () => {
      const config = ConfigParser.parseDatabaseUrl('mysql://user:pass@localhost:3306/dbname?ssl=true');
      expect(config.ssl).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate a complete configuration', () => {
      const config = {
        source: {
          type: 'mysql',
          host: 'localhost',
          database: 'source_db',
          username: 'user',
          password: 'pass',
        },
        destination: {
          type: 'postgresql',
          host: 'localhost',
          database: 'dest_db',
          username: 'user',
          password: 'pass',
        },
        tables: [
          {
            name: 'users',
            anonymizeFields: ['email'],
            excludeFields: ['password'],
          },
        ],
      };

      const result = (ConfigParser as any).validateConfig(config);
      expect(result.source.type).toBe('mysql');
      expect(result.destination.type).toBe('postgresql');
      expect(result.tables).toHaveLength(1);
    });

    it('should throw error for missing source', () => {
      const config = {
        destination: { type: 'mysql', host: 'localhost', database: 'db' },
        tables: [],
      };

      expect(() => {
        (ConfigParser as any).validateConfig(config);
      }).toThrow('Configuration must specify a source database');
    });

    it('should throw error for missing destination', () => {
      const config = {
        source: { type: 'mysql', host: 'localhost', database: 'db' },
        tables: [],
      };

      expect(() => {
        (ConfigParser as any).validateConfig(config);
      }).toThrow('Configuration must specify a destination database');
    });

    it('should throw error for missing tables', () => {
      const config = {
        source: { type: 'mysql', host: 'localhost', database: 'db' },
        destination: { type: 'mysql', host: 'localhost', database: 'db' },
      };

      expect(() => {
        (ConfigParser as any).validateConfig(config);
      }).toThrow('Configuration must specify tables to migrate');
    });
  });
});
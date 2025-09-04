import { HeuristicAnonymizer } from '../anonymizers/heuristic';

describe('HeuristicAnonymizer', () => {
  let anonymizer: HeuristicAnonymizer;

  beforeEach(() => {
    anonymizer = new HeuristicAnonymizer();
  });

  describe('shouldAnonymize', () => {
    it('should identify sensitive field names', () => {
      expect(anonymizer.shouldAnonymize('email', 'string')).toBe(true);
      expect(anonymizer.shouldAnonymize('user_email', 'string')).toBe(true);
      expect(anonymizer.shouldAnonymize('first_name', 'string')).toBe(true);
      expect(anonymizer.shouldAnonymize('phone_number', 'string')).toBe(true);
      expect(anonymizer.shouldAnonymize('home_address', 'string')).toBe(true);
      expect(anonymizer.shouldAnonymize('password', 'string')).toBe(true);
    });

    it('should not anonymize non-sensitive field names', () => {
      expect(anonymizer.shouldAnonymize('id', 'integer')).toBe(false);
      expect(anonymizer.shouldAnonymize('created_at', 'date')).toBe(false);
      expect(anonymizer.shouldAnonymize('status', 'string')).toBe(false);
      expect(anonymizer.shouldAnonymize('amount', 'number')).toBe(false);
    });

    it('should not anonymize non-string fields', () => {
      expect(anonymizer.shouldAnonymize('email', 'integer')).toBe(false);
      expect(anonymizer.shouldAnonymize('name', 'date')).toBe(false);
    });
  });

  describe('anonymizeField', () => {
    it('should anonymize email addresses', () => {
      const result = anonymizer.anonymizeField('email', 'john.doe@example.com', 'string');
      expect(result).toMatch(/^jo\*+@example\.com$/);
    });

    it('should anonymize names', () => {
      const result = anonymizer.anonymizeField('name', 'John Doe', 'string');
      expect(result).toMatch(/^J\*+ D\*+$/);
    });

    it('should anonymize phone numbers', () => {
      const result = anonymizer.anonymizeField('phone', '555-123-4567', 'string');
      expect(result).toBe('***-***-4567');
    });

    it('should anonymize addresses', () => {
      const result = anonymizer.anonymizeField('address', '123 Main Street', 'string');
      expect(result).toMatch(/^\*\*\* \*\*\*\* Street$/);
    });

    it('should anonymize passwords', () => {
      const result = anonymizer.anonymizeField('password', 'secret123', 'string');
      expect(result).toBe('********');
    });

    it('should handle generic anonymization', () => {
      const result = anonymizer.anonymizeField('secret_field', 'sensitive_data', 'string');
      expect(result).toBe('********');
    });

    it('should handle generic anonymization for non-pattern fields', () => {
      const result = anonymizer.anonymizeField('ssn', 'sensitive_data', 'string');
      expect(result).toBe('s************a');
    });

    it('should preserve null and undefined values', () => {
      expect(anonymizer.anonymizeField('email', null, 'string')).toBe(null);
      expect(anonymizer.anonymizeField('email', undefined, 'string')).toBe(undefined);
    });

    it('should not anonymize non-sensitive fields', () => {
      const result = anonymizer.anonymizeField('id', '123', 'string');
      expect(result).toBe('123');
    });
  });
});
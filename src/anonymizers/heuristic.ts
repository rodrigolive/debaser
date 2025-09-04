import { Anonymizer } from '../types';

export class HeuristicAnonymizer implements Anonymizer {
  private sensitivePatterns = [
    // Email patterns
    /email/i,
    /mail/i,
    /e_mail/i,
    
    // Name patterns
    /name/i,
    /first_name/i,
    /last_name/i,
    /full_name/i,
    /username/i,
    /user_name/i,
    
    // Phone patterns
    /phone/i,
    /telephone/i,
    /mobile/i,
    /cell/i,
    
    // Address patterns
    /address/i,
    /street/i,
    /city/i,
    /zip/i,
    /postal/i,
    
    // Personal info
    /ssn/i,
    /social_security/i,
    /passport/i,
    /id_number/i,
    /credit_card/i,
    /card_number/i,
    
    // Other sensitive data
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
  ];

  shouldAnonymize(fieldName: string, fieldType: string): boolean {
    // Check if field name matches sensitive patterns
    const isSensitiveName = this.sensitivePatterns.some(pattern => pattern.test(fieldName));
    
    // Check if it's a string field (most sensitive data is text)
    const isStringField = fieldType === 'string';
    
    return isSensitiveName && isStringField;
  }

  anonymizeField(fieldName: string, value: any, fieldType: string): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (!this.shouldAnonymize(fieldName, fieldType)) {
      return value;
    }

    // Determine anonymization method based on field name
    if (/email/i.test(fieldName)) {
      return this.anonymizeEmail(value);
    } else if (/name/i.test(fieldName)) {
      return this.anonymizeName(value);
    } else if (/phone/i.test(fieldName)) {
      return this.anonymizePhone(value);
    } else if (/address/i.test(fieldName)) {
      return this.anonymizeAddress(value);
    } else if (/password/i.test(fieldName) || /secret/i.test(fieldName)) {
      return this.anonymizePassword(value);
    } else {
      return this.anonymizeGeneric(value);
    }
  }

  private anonymizeEmail(value: string): string {
    const [localPart, domain] = value.split('@');
    if (!domain) return 'anonymous@example.com';
    
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 2) + '*'.repeat(localPart.length - 2)
      : '**';
    
    return `${maskedLocal}@${domain}`;
  }

  private anonymizeName(value: string): string {
    const words = value.split(' ');
    return words.map(word => {
      if (word.length <= 2) return '*'.repeat(word.length);
      return word.substring(0, 1) + '*'.repeat(word.length - 1);
    }).join(' ');
  }

  private anonymizePhone(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 4) return '***-***-****';
    
    const lastFour = digits.slice(-4);
    return `***-***-${lastFour}`;
  }

  private anonymizeAddress(value: string): string {
    const words = value.split(' ');
    if (words.length <= 2) return '*** ***';
    
    return words.map((word, index) => {
      if (index < 2) return '*'.repeat(word.length);
      return word;
    }).join(' ');
  }

  private anonymizePassword(value: string): string {
    return '*'.repeat(8);
  }

  private anonymizeGeneric(value: string): string {
    if (value.length <= 3) return '*'.repeat(value.length);
    
    const start = value.substring(0, 1);
    const end = value.substring(value.length - 1);
    const middle = '*'.repeat(value.length - 2);
    
    return start + middle + end;
  }
}
import type { PIIType, PatternConfidence, CustomPatternDef } from "../types.js";

/**
 * A PII pattern with regex and confidence level
 */
export interface PIIPattern {
  type: PIIType;
  regex: RegExp;
  replacement: string;
  /** Confidence level: high (reliable), medium (some edge cases), low (ambiguous) */
  confidence: PatternConfidence;
}

/**
 * Built-in regex patterns for common PII types.
 * Patterns are ordered with more specific patterns first.
 */
export const BUILTIN_PATTERNS: PIIPattern[] = [
  // Email - high confidence
  {
    type: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "[EMAIL_REDACTED]",
    confidence: "high",
  },

  // SSN - US format with various separators
  {
    type: "ssn",
    regex: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: "[SSN_REDACTED]",
    confidence: "medium", // Could match other 9-digit numbers
  },

  // Credit Card - Visa (starts with 4)
  {
    type: "credit_card",
    regex: /\b4[0-9]{12}(?:[0-9]{3})?\b/g,
    replacement: "[CREDIT_CARD_REDACTED]",
    confidence: "high",
  },
  // Credit Card - Mastercard (starts with 51-55 or 2221-2720)
  {
    type: "credit_card",
    regex: /\b5[1-5][0-9]{14}\b/g,
    replacement: "[CREDIT_CARD_REDACTED]",
    confidence: "high",
  },
  // Credit Card - Amex (starts with 34 or 37)
  {
    type: "credit_card",
    regex: /\b3[47][0-9]{13}\b/g,
    replacement: "[CREDIT_CARD_REDACTED]",
    confidence: "high",
  },
  // Credit Card - Discover (starts with 6011, 65, or 644-649)
  {
    type: "credit_card",
    regex: /\b6(?:011|5[0-9]{2})[0-9]{12}\b/g,
    replacement: "[CREDIT_CARD_REDACTED]",
    confidence: "high",
  },
  // Credit card with separators (4 groups of 4 digits)
  {
    type: "credit_card",
    regex: /\b(?:\d{4}[-\s]){3}\d{4}\b/g,
    replacement: "[CREDIT_CARD_REDACTED]",
    confidence: "medium",
  },

  // Phone - US formats (with optional country code)
  {
    type: "phone",
    regex:
      /\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    replacement: "[PHONE_REDACTED]",
    confidence: "medium", // Many number patterns could match
  },

  // IP Address - IPv4
  {
    type: "ip_address",
    regex:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: "[IP_REDACTED]",
    confidence: "high",
  },
  // IP Address - IPv6 (full format)
  {
    type: "ip_address",
    regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    replacement: "[IP_REDACTED]",
    confidence: "high",
  },

  // Date of Birth - only when DOB/birth/bday keywords appear nearby
  // Pattern 1: Keyword before date (e.g., "DOB: 01/15/1990", "born 1990-01-15")
  {
    type: "date_of_birth",
    regex:
      /(?<=\b(?:DOB|birth(?:day)?|bday|born|d\.?o\.?b\.?)\s*[:\-\s]*)\b(?:(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}|(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01]))\b/gi,
    replacement: "[DOB_REDACTED]",
    confidence: "high",
  },
  // Pattern 2: Date followed by keyword (e.g., "01/15/1990 (birth date)")
  {
    type: "date_of_birth",
    regex:
      /\b(?:(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}|(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01]))\b(?=\s*[,\(\-]?\s*\(?(?:DOB|birth(?:day)?|bday|d\.?o\.?b\.?)\b)/gi,
    replacement: "[DOB_REDACTED]",
    confidence: "high",
  },

  // US Passport - letter followed by 8 digits
  {
    type: "passport",
    regex: /\b[A-Z][0-9]{8}\b/g,
    replacement: "[PASSPORT_REDACTED]",
    confidence: "low", // Many alphanumeric codes match this
  },

  // US Driver's License - varies by state, simplified pattern
  {
    type: "driver_license",
    regex: /\b[A-Z]{1,2}[0-9]{5,8}\b/g,
    replacement: "[DL_REDACTED]",
    confidence: "low", // Very ambiguous pattern
  },
];

/**
 * Get patterns for specified PII types
 */
export function getPatternsForTypes(types: PIIType[]): PIIPattern[] {
  return BUILTIN_PATTERNS.filter((p) => types.includes(p.type));
}

/**
 * Create a custom pattern from user configuration
 */
export function createCustomPattern(
  _name: string,
  patternDef: CustomPatternDef
): PIIPattern {
  return {
    type: "custom",
    regex: new RegExp(patternDef.regex, "g"),
    replacement: patternDef.replacement,
    confidence: "high", // User-defined patterns are trusted
  };
}

/**
 * Clone a pattern with a fresh regex (resets lastIndex)
 */
export function clonePattern(pattern: PIIPattern): PIIPattern {
  return {
    ...pattern,
    regex: new RegExp(pattern.regex.source, pattern.regex.flags),
  };
}

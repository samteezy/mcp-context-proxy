import { describe, it, expect } from "vitest";
import {
  BUILTIN_PATTERNS,
  getPatternsForTypes,
  createCustomPattern,
  clonePattern,
} from "./patterns.js";

describe("getPatternsForTypes", () => {
  it("should return email pattern for 'email' type", () => {
    const patterns = getPatternsForTypes(["email"]);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.every((p) => p.type === "email")).toBe(true);
  });

  it("should return SSN pattern for 'ssn' type", () => {
    const patterns = getPatternsForTypes(["ssn"]);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.every((p) => p.type === "ssn")).toBe(true);
  });

  it("should return phone patterns for 'phone' type", () => {
    const patterns = getPatternsForTypes(["phone"]);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.every((p) => p.type === "phone")).toBe(true);
  });

  it("should return credit card patterns for 'credit_card' type", () => {
    const patterns = getPatternsForTypes(["credit_card"]);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.every((p) => p.type === "credit_card")).toBe(true);
  });

  it("should return IP address patterns for 'ip_address' type", () => {
    const patterns = getPatternsForTypes(["ip_address"]);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.every((p) => p.type === "ip_address")).toBe(true);
  });

  it("should return multiple patterns for array of types", () => {
    const patterns = getPatternsForTypes(["email", "ssn", "phone"]);
    const types = new Set(patterns.map((p) => p.type));
    expect(types.has("email")).toBe(true);
    expect(types.has("ssn")).toBe(true);
    expect(types.has("phone")).toBe(true);
  });

  it("should return empty array for empty input", () => {
    const patterns = getPatternsForTypes([]);
    expect(patterns).toEqual([]);
  });

  it("should return all patterns when all types requested", () => {
    const allTypes = Array.from(
      new Set(BUILTIN_PATTERNS.map((p) => p.type))
    ) as any[];
    const patterns = getPatternsForTypes(allTypes);
    expect(patterns.length).toBe(BUILTIN_PATTERNS.length);
  });
});

describe("createCustomPattern", () => {
  it("should create pattern from regex string and replacement", () => {
    const pattern = createCustomPattern("test", {
      regex: "\\btest\\b",
      replacement: "[TEST]",
    });

    expect(pattern.type).toBe("custom");
    expect(pattern.regex).toBeInstanceOf(RegExp);
    expect(pattern.regex.test("test")).toBe(true);
    expect(pattern.replacement).toBe("[TEST]");
    expect(pattern.confidence).toBe("high");
  });

  it("should handle complex regex patterns", () => {
    const pattern = createCustomPattern("email-custom", {
      regex: "[a-z]+@[a-z]+\\.[a-z]{2,}",
      replacement: "[CUSTOM_EMAIL]",
    });

    expect(pattern.regex.test("test@example.com")).toBe(true);
    expect(pattern.regex.test("not-an-email")).toBe(false);
  });

  it("should set global flag on regex", () => {
    const pattern = createCustomPattern("test", {
      regex: "\\d+",
      replacement: "[NUM]",
    });

    expect(pattern.regex.flags).toContain("g");
  });
});

describe("clonePattern", () => {
  it("should create deep copy of pattern", () => {
    const original = BUILTIN_PATTERNS[0];
    const cloned = clonePattern(original);

    expect(cloned.type).toBe(original.type);
    expect(cloned.replacement).toBe(original.replacement);
    expect(cloned.confidence).toBe(original.confidence);
    expect(cloned.regex.source).toBe(original.regex.source);
    expect(cloned.regex.flags).toBe(original.regex.flags);
  });

  it("should create independent regex instance", () => {
    const original = BUILTIN_PATTERNS.find((p) => p.type === "email")!;
    const cloned = clonePattern(original);

    // Modify original regex state
    original.regex.test("test@example.com");

    // Cloned regex should have independent state
    expect(cloned.regex).not.toBe(original.regex);
  });

  it("should reset lastIndex on regex", () => {
    const emailPattern = BUILTIN_PATTERNS.find((p) => p.type === "email")!;
    // Execute regex to set lastIndex
    emailPattern.regex.test("test@example.com");

    const cloned = clonePattern(emailPattern);
    expect(cloned.regex.lastIndex).toBe(0);
  });
});

describe("PIIPattern matching", () => {
  describe("email pattern", () => {
    const emailPattern = BUILTIN_PATTERNS.find((p) => p.type === "email")!;

    it("should match valid email addresses", () => {
      const emails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "first+last@company.org",
        "admin@test.io",
      ];

      emails.forEach((email) => {
        const pattern = clonePattern(emailPattern);
        expect(pattern.regex.test(email)).toBe(true);
      });
    });

    it("should not match invalid emails", () => {
      const invalid = [
        "not-an-email",
        "@example.com",
        "user@",
        "user @example.com",
        "user@domain",
      ];

      invalid.forEach((text) => {
        const pattern = clonePattern(emailPattern);
        expect(pattern.regex.test(text)).toBe(false);
      });
    });

    it("should have high confidence", () => {
      expect(emailPattern.confidence).toBe("high");
    });
  });

  describe("SSN pattern", () => {
    const ssnPattern = BUILTIN_PATTERNS.find((p) => p.type === "ssn")!;

    it("should match XXX-XX-XXXX format", () => {
      const pattern = clonePattern(ssnPattern);
      expect(pattern.regex.test("123-45-6789")).toBe(true);
    });

    it("should match XXXXXXXXX format", () => {
      const pattern = clonePattern(ssnPattern);
      expect(pattern.regex.test("123456789")).toBe(true);
    });

    it("should match with dots and spaces", () => {
      const formats = ["123.45.6789", "123 45 6789"];
      formats.forEach((ssn) => {
        const pattern = clonePattern(ssnPattern);
        expect(pattern.regex.test(ssn)).toBe(true);
      });
    });

    it("should have medium confidence", () => {
      expect(ssnPattern.confidence).toBe("medium");
    });
  });

  describe("credit card patterns", () => {
    const ccPatterns = BUILTIN_PATTERNS.filter((p) => p.type === "credit_card");

    it("should match Visa cards", () => {
      const visa = "4532015112830366"; // 16 digits starting with 4
      expect(
        ccPatterns.some((p) => clonePattern(p).regex.test(visa))
      ).toBe(true);
    });

    it("should match Mastercard", () => {
      const mastercard = "5425233430109903"; // 16 digits starting with 5
      expect(
        ccPatterns.some((p) => clonePattern(p).regex.test(mastercard))
      ).toBe(true);
    });

    it("should match Amex", () => {
      const amex = "374245455400126"; // 15 digits starting with 34
      expect(
        ccPatterns.some((p) => clonePattern(p).regex.test(amex))
      ).toBe(true);
    });

    it("should match cards with spaces", () => {
      const withSpaces = "4532 0151 1283 0366";
      expect(
        ccPatterns.some((p) => clonePattern(p).regex.test(withSpaces))
      ).toBe(true);
    });

    it("should match cards with dashes", () => {
      const withDashes = "4532-0151-1283-0366";
      expect(
        ccPatterns.some((p) => clonePattern(p).regex.test(withDashes))
      ).toBe(true);
    });

    it("should have high or medium confidence", () => {
      ccPatterns.forEach((p) => {
        expect(["high", "medium"]).toContain(p.confidence);
      });
    });
  });

  describe("phone pattern", () => {
    const phonePattern = BUILTIN_PATTERNS.find((p) => p.type === "phone")!;

    it("should match (XXX) XXX-XXXX format", () => {
      const pattern = clonePattern(phonePattern);
      expect(pattern.regex.test("(555) 123-4567")).toBe(true);
    });

    it("should match XXX-XXX-XXXX format", () => {
      const pattern = clonePattern(phonePattern);
      expect(pattern.regex.test("555-123-4567")).toBe(true);
    });

    it("should match with country code", () => {
      const pattern = clonePattern(phonePattern);
      expect(pattern.regex.test("+1-555-123-4567")).toBe(true);
    });

    it("should match 10 digits with no formatting", () => {
      const pattern = clonePattern(phonePattern);
      expect(pattern.regex.test("5551234567")).toBe(true);
    });

    it("should have medium confidence", () => {
      expect(phonePattern.confidence).toBe("medium");
    });
  });

  describe("IP address patterns", () => {
    const ipPatterns = BUILTIN_PATTERNS.filter((p) => p.type === "ip_address");

    it("should match valid IPv4 addresses", () => {
      const ipv4s = [
        "192.168.1.1",
        "10.0.0.1",
        "172.16.0.1",
        "8.8.8.8",
        "255.255.255.255",
      ];

      ipv4s.forEach((ip) => {
        expect(
          ipPatterns.some((p) => clonePattern(p).regex.test(ip))
        ).toBe(true);
      });
    });

    it("should not match invalid IPv4", () => {
      const invalid = [
        "256.1.1.1", // out of range
        "1.1.1", // incomplete
        "1.1.1.1.1", // too many octets
      ];

      invalid.forEach((ip) => {
        // Should not match any IPv4 pattern
        const matched = ipPatterns.some((p) => {
          const pattern = clonePattern(p);
          return pattern.regex.test(ip) && ip.match(pattern.regex)?.[0] === ip;
        });
        expect(matched).toBe(false);
      });
    });

    it("should match IPv6 addresses", () => {
      const ipv6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
      expect(
        ipPatterns.some((p) => clonePattern(p).regex.test(ipv6))
      ).toBe(true);
    });

    it("should have high confidence", () => {
      ipPatterns.forEach((p) => {
        expect(p.confidence).toBe("high");
      });
    });
  });

  describe("date of birth patterns", () => {
    const dobPatterns = BUILTIN_PATTERNS.filter((p) => p.type === "date_of_birth");

    it("should match date with DOB keyword before", () => {
      const text = "DOB: 01/15/1990";
      expect(
        dobPatterns.some((p) => clonePattern(p).regex.test(text))
      ).toBe(true);
    });

    it("should match date with birth keyword before", () => {
      const text = "birth: 1990-01-15";
      expect(
        dobPatterns.some((p) => clonePattern(p).regex.test(text))
      ).toBe(true);
    });

    it("should match date with keyword after", () => {
      const text = "01/15/1990 (birthday)";
      expect(
        dobPatterns.some((p) => clonePattern(p).regex.test(text))
      ).toBe(true);
    });

    it("should not match dates without context keywords", () => {
      const text = "The date is 01/15/1990"; // No DOB/birth keyword adjacent
      // This might still match depending on lookbehind, but we're testing the pattern design
      const hasMatch = dobPatterns.some((p) => clonePattern(p).regex.test(text));
      // Pattern should require keyword proximity
      expect(hasMatch).toBe(false);
    });

    it("should have high confidence", () => {
      dobPatterns.forEach((p) => {
        expect(p.confidence).toBe("high");
      });
    });
  });

  describe("passport pattern", () => {
    const passportPattern = BUILTIN_PATTERNS.find((p) => p.type === "passport")!;

    it("should match letter followed by 8 digits", () => {
      let pattern = clonePattern(passportPattern);
      expect(pattern.regex.test("A12345678")).toBe(true);

      pattern = clonePattern(passportPattern);
      expect(pattern.regex.test("Z98765432")).toBe(true);
    });

    it("should not match without leading letter", () => {
      const pattern = clonePattern(passportPattern);
      expect(pattern.regex.test("12345678")).toBe(false);
    });

    it("should have low confidence (ambiguous)", () => {
      expect(passportPattern.confidence).toBe("low");
    });
  });

  describe("driver's license pattern", () => {
    const dlPattern = BUILTIN_PATTERNS.find((p) => p.type === "driver_license")!;

    it("should match typical DL format", () => {
      let pattern = clonePattern(dlPattern);
      expect(pattern.regex.test("A12345")).toBe(true);

      pattern = clonePattern(dlPattern);
      expect(pattern.regex.test("AB123456")).toBe(true);
    });

    it("should have low confidence (very ambiguous)", () => {
      expect(dlPattern.confidence).toBe("low");
    });
  });
});

describe("BUILTIN_PATTERNS", () => {
  it("should have patterns for all common PII types", () => {
    const types = new Set(BUILTIN_PATTERNS.map((p) => p.type));
    expect(types.has("email")).toBe(true);
    expect(types.has("ssn")).toBe(true);
    expect(types.has("credit_card")).toBe(true);
    expect(types.has("phone")).toBe(true);
    expect(types.has("ip_address")).toBe(true);
  });

  it("should have all patterns with required fields", () => {
    BUILTIN_PATTERNS.forEach((pattern) => {
      expect(pattern.type).toBeDefined();
      expect(pattern.regex).toBeInstanceOf(RegExp);
      expect(pattern.replacement).toBeDefined();
      expect(pattern.confidence).toBeDefined();
      expect(["low", "medium", "high"]).toContain(pattern.confidence);
    });
  });

  it("should have global flag on all regexes", () => {
    BUILTIN_PATTERNS.forEach((pattern) => {
      expect(pattern.regex.flags).toContain("g");
    });
  });
});

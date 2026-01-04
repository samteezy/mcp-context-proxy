import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMDetector } from "./llm-detector.js";
import type { MaskingLLMConfig, PIIType } from "../types.js";
import { mockGenerateText, resetLlmMocks } from "../test/llm-mocks.js";

// Mock AI SDK for LLM calls
vi.mock("ai", async () => {
  const { mockGenerateText } = await import("../test/llm-mocks.js");

  // Mock streamText to return a promise-like object with .text property
  const mockStreamText = vi.fn((options: any) => ({
    text: mockGenerateText(options).then((r: any) => r.text),
  }));

  return {
    generateText: mockGenerateText,
    streamText: mockStreamText,
  };
});

// Mock OpenAI compatible provider
const mockProvider = vi.fn((model: string) => model);
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => mockProvider,
}));

describe("LLMDetector", () => {
  let config: MaskingLLMConfig;
  let detector: LLMDetector;

  beforeEach(() => {
    resetLlmMocks();
    mockProvider.mockClear();

    config = {
      baseUrl: "http://localhost:8080/v1",
      model: "test-model",
    };

    detector = new LLMDetector(config);
  });

  describe("constructor", () => {
    it("should initialize with config", () => {
      expect(detector).toBeDefined();
    });

    it("should use default apiKey when not provided", () => {
      const detectorWithoutKey = new LLMDetector({
        baseUrl: "http://localhost:8080/v1",
        model: "test-model",
      });

      expect(detectorWithoutKey).toBeDefined();
    });

    it("should use provided apiKey", () => {
      const detectorWithKey = new LLMDetector({
        baseUrl: "http://localhost:8080/v1",
        model: "test-model",
        apiKey: "custom-key",
      });

      expect(detectorWithKey).toBeDefined();
    });
  });

  describe("detectAndMask", () => {
    it("should detect and mask PII successfully", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: true,
          detectedTypes: ["email", "phone"],
          maskedText: "Contact [EMAIL_REDACTED] or [PHONE_REDACTED]",
        }),
      });

      const result = await detector.detectAndMask(
        "Contact john@example.com or 555-1234",
        ["email", "phone"]
      );

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toEqual(["email", "phone"]);
      expect(result.maskedText).toBe("Contact [EMAIL_REDACTED] or [PHONE_REDACTED]");
    });

    it("should return false when no PII detected", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: false,
          detectedTypes: [],
          maskedText: "This is safe text",
        }),
      });

      const result = await detector.detectAndMask(
        "This is safe text",
        ["email", "ssn"]
      );

      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toEqual([]);
      expect(result.maskedText).toBe("This is safe text");
    });

    it("should handle single PII type", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: true,
          detectedTypes: ["ssn"],
          maskedText: "SSN: [SSN_REDACTED]",
        }),
      });

      const result = await detector.detectAndMask(
        "SSN: 123-45-6789",
        ["ssn"]
      );

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toEqual(["ssn"]);
    });

    it("should handle multiple PII types to check", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: true,
          detectedTypes: ["email", "ip_address"],
          maskedText: "Server [EMAIL_REDACTED] at [IP_REDACTED]",
        }),
      });

      const piiTypes: PIIType[] = [
        "email",
        "ssn",
        "phone",
        "credit_card",
        "ip_address",
      ];

      const result = await detector.detectAndMask(
        "Server admin@example.com at 192.168.1.1",
        piiTypes
      );

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain("email");
      expect(result.detectedTypes).toContain("ip_address");
    });

    it("should extract JSON from LLM response with extra text", async () => {
      mockGenerateText.mockResolvedValue({
        text: `Here is the result:
{"hasPII": true, "detectedTypes": ["email"], "maskedText": "[EMAIL_REDACTED]"}
That's all.`,
      });

      const result = await detector.detectAndMask(
        "test@example.com",
        ["email"]
      );

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toEqual(["email"]);
    });

    it("should handle malformed JSON gracefully", async () => {
      mockGenerateText.mockResolvedValue({
        text: "This is not JSON at all",
      });

      const result = await detector.detectAndMask(
        "Some text",
        ["email"]
      );

      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toEqual([]);
      expect(result.maskedText).toBe("Some text");
    });

    it("should handle JSON without required fields", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          someOtherField: "value",
        }),
      });

      const result = await detector.detectAndMask(
        "Some text",
        ["email"]
      );

      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toEqual([]);
      expect(result.maskedText).toBe("Some text");
    });

    it("should handle partial JSON fields", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: true,
          // Missing detectedTypes and maskedText
        }),
      });

      const result = await detector.detectAndMask(
        "test@example.com",
        ["email"]
      );

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toEqual([]);
      expect(result.maskedText).toBe("test@example.com");
    });

    it("should handle LLM errors gracefully", async () => {
      mockGenerateText.mockRejectedValue(new Error("LLM timeout"));

      const result = await detector.detectAndMask(
        "Some text",
        ["email"]
      );

      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toEqual([]);
      expect(result.maskedText).toBe("Some text");
    });

    it("should handle network errors", async () => {
      mockGenerateText.mockRejectedValue(new Error("Network error"));

      const result = await detector.detectAndMask(
        "Contact info",
        ["email", "phone"]
      );

      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toEqual([]);
      expect(result.maskedText).toBe("Contact info");
    });

    it("should handle empty response", async () => {
      mockGenerateText.mockResolvedValue({
        text: "",
      });

      const result = await detector.detectAndMask(
        "Some text",
        ["email"]
      );

      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toEqual([]);
      expect(result.maskedText).toBe("Some text");
    });

    it("should handle empty PII types array", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: false,
          detectedTypes: [],
          maskedText: "Original text",
        }),
      });

      const result = await detector.detectAndMask(
        "Original text",
        []
      );

      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toEqual([]);
    });

    it("should preserve original text on failure", async () => {
      mockGenerateText.mockRejectedValue(new Error("API error"));

      const originalText = "Sensitive data: john@example.com";
      const result = await detector.detectAndMask(
        originalText,
        ["email"]
      );

      expect(result.maskedText).toBe(originalText);
      expect(result.hasPII).toBe(false);
    });

    it("should handle all PII types", async () => {
      const allTypes: PIIType[] = [
        "email",
        "ssn",
        "phone",
        "credit_card",
        "ip_address",
        "date_of_birth",
        "passport",
        "driver_license",
        "custom",
      ];

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: true,
          detectedTypes: allTypes,
          maskedText: "All masked",
        }),
      });

      const result = await detector.detectAndMask(
        "Lots of PII here",
        allTypes
      );

      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toEqual(allTypes);
    });

    it("should pass correct prompt format to LLM", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: false,
          detectedTypes: [],
          maskedText: "test",
        }),
      });

      await detector.detectAndMask("test", ["email", "phone"]);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("<text>"),
        })
      );

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("email, phone"),
        })
      );
    });

    it("should use appropriate maxOutputTokens", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: false,
          detectedTypes: [],
          maskedText: "short",
        }),
      });

      await detector.detectAndMask("short", ["email"]);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 500, // Min of 500 or text.length * 2
        })
      );
    });

    it("should scale maxOutputTokens for longer text", async () => {
      const longText = "a".repeat(1000);

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          hasPII: false,
          detectedTypes: [],
          maskedText: longText,
        }),
      });

      await detector.detectAndMask(longText, ["email"]);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 2000, // text.length * 2
        })
      );
    });
  });
});

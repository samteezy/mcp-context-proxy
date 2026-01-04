/**
 * Shared LLM mocks for testing
 * Used by compressor and masker tests
 */
import { vi } from "vitest";

/**
 * Mock for the generateText function from the 'ai' package
 */
export const mockGenerateText = vi.fn();

/**
 * Setup the AI SDK mock
 * Call this in your test file's vi.mock() call
 */
export function setupAiSdkMock() {
  return {
    generateText: mockGenerateText,
  };
}

/**
 * Reset all LLM mocks
 * Call this in beforeEach() to ensure clean state
 */
export function resetLlmMocks() {
  mockGenerateText.mockReset();
}

/**
 * Helper to mock a successful compression response
 */
export function mockCompressionResponse(compressedText: string) {
  mockGenerateText.mockResolvedValue({ text: compressedText });
}

/**
 * Helper to mock an LLM error
 */
export function mockLlmError(errorMessage: string) {
  mockGenerateText.mockRejectedValue(new Error(errorMessage));
}

/**
 * Helper to mock a PII detection response (YES/NO)
 */
export function mockPiiDetectionResponse(hasPii: boolean) {
  mockGenerateText.mockResolvedValue({
    text: hasPii ? "YES" : "NO"
  });
}

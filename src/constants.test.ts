import { describe, it, expect } from "vitest";
import {
  VERSION,
  CLIENT_NAME,
  CACHE_CLEANUP_INTERVAL_MS,
  SSE_HEARTBEAT_INTERVAL_MS,
  DEFAULT_PORT,
  DEFAULT_HOST,
} from "./constants.js";

describe("constants", () => {
  describe("VERSION", () => {
    it("should be a string", () => {
      expect(typeof VERSION).toBe("string");
    });

    it("should match semantic versioning pattern", () => {
      // Matches X.Y.Z or X.Y.Z-tag
      const semverPattern = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
      expect(VERSION).toMatch(semverPattern);
    });
  });

  describe("CLIENT_NAME", () => {
    it("should be defined", () => {
      expect(CLIENT_NAME).toBeDefined();
    });

    it("should be a string", () => {
      expect(typeof CLIENT_NAME).toBe("string");
    });

    it("should equal 'mcpcp-proxy'", () => {
      expect(CLIENT_NAME).toBe("mcpcp-proxy");
    });
  });

  describe("CACHE_CLEANUP_INTERVAL_MS", () => {
    it("should be a number", () => {
      expect(typeof CACHE_CLEANUP_INTERVAL_MS).toBe("number");
    });

    it("should be positive", () => {
      expect(CACHE_CLEANUP_INTERVAL_MS).toBeGreaterThan(0);
    });

    it("should equal 60000 (1 minute)", () => {
      expect(CACHE_CLEANUP_INTERVAL_MS).toBe(60_000);
    });
  });

  describe("SSE_HEARTBEAT_INTERVAL_MS", () => {
    it("should be a number", () => {
      expect(typeof SSE_HEARTBEAT_INTERVAL_MS).toBe("number");
    });

    it("should be positive", () => {
      expect(SSE_HEARTBEAT_INTERVAL_MS).toBeGreaterThan(0);
    });

    it("should equal 30000 (30 seconds)", () => {
      expect(SSE_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    });
  });

  describe("DEFAULT_PORT", () => {
    it("should be a number", () => {
      expect(typeof DEFAULT_PORT).toBe("number");
    });

    it("should be a valid port number", () => {
      expect(DEFAULT_PORT).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_PORT).toBeLessThanOrEqual(65535);
    });

    it("should equal 3000", () => {
      expect(DEFAULT_PORT).toBe(3000);
    });
  });

  describe("DEFAULT_HOST", () => {
    it("should be a string", () => {
      expect(typeof DEFAULT_HOST).toBe("string");
    });

    it("should equal '0.0.0.0'", () => {
      expect(DEFAULT_HOST).toBe("0.0.0.0");
    });
  });
});

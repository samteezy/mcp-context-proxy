import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RetryTracker } from "./retry-tracker.js";
import type { RetryEscalationConfig } from "../types.js";

describe("RetryTracker", () => {
  let tracker: RetryTracker;

  beforeEach(() => {
    tracker = new RetryTracker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("recordCall", () => {
    it("should record a single call", () => {
      tracker.recordCall("test_tool");
      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(1);
      expect(stats.totalCalls).toBe(1);
    });

    it("should record multiple calls for same tool", () => {
      tracker.recordCall("test_tool");
      tracker.recordCall("test_tool");
      tracker.recordCall("test_tool");
      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(1);
      expect(stats.totalCalls).toBe(3);
    });

    it("should record calls for different tools", () => {
      tracker.recordCall("tool_1");
      tracker.recordCall("tool_2");
      tracker.recordCall("tool_3");
      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(3);
      expect(stats.totalCalls).toBe(3);
    });

    it("should track timestamps for each call", () => {
      const config: RetryEscalationConfig = {
        enabled: true,
        windowSeconds: 60,
        tokenMultiplier: 2,
      };

      // Record first call at t=0
      tracker.recordCall("test_tool");
      expect(tracker.getEscalationMultiplier("test_tool", config)).toBe(1);

      // Record second call at t=1000ms
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      expect(tracker.getEscalationMultiplier("test_tool", config)).toBe(2);
    });
  });

  describe("getEscalationMultiplier", () => {
    const enabledConfig: RetryEscalationConfig = {
      enabled: true,
      windowSeconds: 60,
      tokenMultiplier: 2,
    };

    it("should return 1 for first call", () => {
      tracker.recordCall("test_tool");
      expect(tracker.getEscalationMultiplier("test_tool", enabledConfig)).toBe(1);
    });

    it("should return 2 for second call (default multiplier)", () => {
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      expect(tracker.getEscalationMultiplier("test_tool", enabledConfig)).toBe(2);
    });

    it("should return 3 for third call (linear escalation)", () => {
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      expect(tracker.getEscalationMultiplier("test_tool", enabledConfig)).toBe(3);
    });

    it("should return 4 for fourth call", () => {
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      expect(tracker.getEscalationMultiplier("test_tool", enabledConfig)).toBe(4);
    });

    it("should respect custom tokenMultiplier", () => {
      const customConfig: RetryEscalationConfig = {
        enabled: true,
        windowSeconds: 60,
        tokenMultiplier: 3,
      };

      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      // Linear formula: 1 + (3 - 1) * (2 - 1) = 1 + 2 * 1 = 3
      expect(tracker.getEscalationMultiplier("test_tool", customConfig)).toBe(3);

      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      // Linear formula: 1 + (3 - 1) * (3 - 1) = 1 + 2 * 2 = 5
      expect(tracker.getEscalationMultiplier("test_tool", customConfig)).toBe(5);
    });

    it("should filter calls outside the time window", () => {
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");

      // Advance past the 60-second window
      vi.advanceTimersByTime(61000);

      // Both calls should be filtered out, so next call is first
      tracker.recordCall("test_tool");
      expect(tracker.getEscalationMultiplier("test_tool", enabledConfig)).toBe(1);
    });

    it("should only count calls within the window", () => {
      // Call at t=0
      tracker.recordCall("test_tool");

      // Call at t=30s (within 60s window)
      vi.advanceTimersByTime(30000);
      tracker.recordCall("test_tool");

      // Call at t=50s (within 60s window from t=50s)
      vi.advanceTimersByTime(20000);
      tracker.recordCall("test_tool");

      // At t=50s, all 3 calls are within the 60s window
      expect(tracker.getEscalationMultiplier("test_tool", enabledConfig)).toBe(3);

      // Advance to t=70s - first call at t=0 is now outside 60s window
      vi.advanceTimersByTime(20000);

      // Only 2 calls within window (t=30s and t=50s)
      expect(tracker.getEscalationMultiplier("test_tool", enabledConfig)).toBe(2);
    });

    it("should return 1 when disabled", () => {
      const disabledConfig: RetryEscalationConfig = {
        enabled: false,
        windowSeconds: 60,
        tokenMultiplier: 2,
      };

      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");

      expect(tracker.getEscalationMultiplier("test_tool", disabledConfig)).toBe(1);
    });

    it("should return 1 for never-called tool", () => {
      expect(tracker.getEscalationMultiplier("unknown_tool", enabledConfig)).toBe(1);
    });

    it("should handle different window sizes", () => {
      const shortWindowConfig: RetryEscalationConfig = {
        enabled: true,
        windowSeconds: 5, // 5 second window
        tokenMultiplier: 2,
      };

      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");
      expect(tracker.getEscalationMultiplier("test_tool", shortWindowConfig)).toBe(2);

      // Advance 6 seconds - both calls outside window
      vi.advanceTimersByTime(6000);
      expect(tracker.getEscalationMultiplier("test_tool", shortWindowConfig)).toBe(1);
    });

    it("should clean up expired entries when calculating multiplier", () => {
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("test_tool");

      const stats1 = tracker.getStats();
      expect(stats1.totalCalls).toBe(2);

      // Advance past window
      vi.advanceTimersByTime(61000);

      // This should trigger cleanup of expired entries
      tracker.getEscalationMultiplier("test_tool", enabledConfig);

      const stats2 = tracker.getStats();
      expect(stats2.toolCount).toBe(0); // Tool entry removed since no recent calls
      expect(stats2.totalCalls).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries", () => {
      tracker.recordCall("tool_1");
      tracker.recordCall("tool_2");
      tracker.recordCall("tool_3");

      const stats1 = tracker.getStats();
      expect(stats1.toolCount).toBe(3);

      // Advance past default window (300s)
      vi.advanceTimersByTime(301000);

      tracker.cleanup();

      const stats2 = tracker.getStats();
      expect(stats2.toolCount).toBe(0);
      expect(stats2.totalCalls).toBe(0);
    });

    it("should keep recent entries", () => {
      tracker.recordCall("old_tool");

      vi.advanceTimersByTime(150000); // 150s later

      tracker.recordCall("recent_tool");

      tracker.cleanup(120); // 120s window

      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(1); // Only recent_tool (old_tool expired)
      expect(stats.totalCalls).toBe(1);
    });

    it("should use custom maxWindowSeconds", () => {
      tracker.recordCall("test_tool");

      vi.advanceTimersByTime(150000); // 150s

      // Cleanup with 200s window - should keep
      tracker.cleanup(200);
      expect(tracker.getStats().toolCount).toBe(1);

      // Cleanup with 100s window - should remove
      tracker.cleanup(100);
      expect(tracker.getStats().toolCount).toBe(0);
    });

    it("should handle empty tracker", () => {
      tracker.cleanup();
      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(0);
      expect(stats.totalCalls).toBe(0);
    });

    it("should partially clean up timestamps for tools with mixed ages", () => {
      tracker.recordCall("test_tool"); // t=0
      vi.advanceTimersByTime(50000); // t=50s
      tracker.recordCall("test_tool");
      vi.advanceTimersByTime(50000); // t=100s
      tracker.recordCall("test_tool");

      // At t=100s, we have calls at 0s, 50s, and 100s
      expect(tracker.getStats().totalCalls).toBe(3);

      // Cleanup with 60s window - should keep calls from 40s onward (50s and 100s)
      tracker.cleanup(60);

      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(1); // Tool still tracked
      expect(stats.totalCalls).toBe(2); // Only 2 recent calls
    });

    it("should return count of cleaned entries", () => {
      tracker.recordCall("tool_1");
      tracker.recordCall("tool_2");
      tracker.recordCall("tool_3");

      vi.advanceTimersByTime(301000);

      // Cleanup doesn't return count directly, but we can verify via stats
      const statsBefore = tracker.getStats();
      expect(statsBefore.toolCount).toBe(3);

      tracker.cleanup();

      const statsAfter = tracker.getStats();
      expect(statsAfter.toolCount).toBe(0);
    });
  });

  describe("reset", () => {
    it("should clear all tracking data", () => {
      tracker.recordCall("tool_1");
      tracker.recordCall("tool_2");
      tracker.recordCall("tool_3");

      const statsBefore = tracker.getStats();
      expect(statsBefore.toolCount).toBe(3);
      expect(statsBefore.totalCalls).toBe(3);

      tracker.reset();

      const statsAfter = tracker.getStats();
      expect(statsAfter.toolCount).toBe(0);
      expect(statsAfter.totalCalls).toBe(0);
    });

    it("should allow recording new calls after reset", () => {
      tracker.recordCall("test_tool");
      tracker.reset();

      tracker.recordCall("new_tool");
      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(1);
      expect(stats.totalCalls).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should return accurate counts", () => {
      tracker.recordCall("tool_1");
      tracker.recordCall("tool_1");
      tracker.recordCall("tool_2");

      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(2);
      expect(stats.totalCalls).toBe(3);
    });

    it("should handle empty state", () => {
      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(0);
      expect(stats.totalCalls).toBe(0);
    });

    it("should count all calls across all tools", () => {
      tracker.recordCall("tool_1");
      tracker.recordCall("tool_1");
      tracker.recordCall("tool_2");
      tracker.recordCall("tool_2");
      tracker.recordCall("tool_2");
      tracker.recordCall("tool_3");

      const stats = tracker.getStats();
      expect(stats.toolCount).toBe(3);
      expect(stats.totalCalls).toBe(6);
    });
  });

  describe("integration scenarios", () => {
    it("should handle rapid repeated calls correctly", () => {
      const config: RetryEscalationConfig = {
        enabled: true,
        windowSeconds: 60,
        tokenMultiplier: 2,
      };

      // Simulate 5 rapid calls within 5 seconds
      for (let i = 0; i < 5; i++) {
        tracker.recordCall("test_tool");
        vi.advanceTimersByTime(1000);
      }

      // All 5 calls should be counted
      expect(tracker.getEscalationMultiplier("test_tool", config)).toBe(5);
    });

    it("should handle mixed tool usage", () => {
      const config: RetryEscalationConfig = {
        enabled: true,
        windowSeconds: 60,
        tokenMultiplier: 2,
      };

      tracker.recordCall("tool_a");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("tool_b");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("tool_a");
      vi.advanceTimersByTime(1000);
      tracker.recordCall("tool_b");

      expect(tracker.getEscalationMultiplier("tool_a", config)).toBe(2);
      expect(tracker.getEscalationMultiplier("tool_b", config)).toBe(2);
    });

    it("should handle window boundary conditions", () => {
      const config: RetryEscalationConfig = {
        enabled: true,
        windowSeconds: 60,
        tokenMultiplier: 2,
      };

      tracker.recordCall("test_tool"); // t=0
      vi.advanceTimersByTime(59999); // t=59.999s - just within window
      tracker.recordCall("test_tool");

      expect(tracker.getEscalationMultiplier("test_tool", config)).toBe(2);

      vi.advanceTimersByTime(2); // t=60.001s - first call now outside window

      expect(tracker.getEscalationMultiplier("test_tool", config)).toBe(1);
    });
  });
});

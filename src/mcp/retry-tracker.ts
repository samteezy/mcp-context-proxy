import type { RetryEscalationConfig } from "../types.js";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Tracks tool calls within a sliding window to detect retries
 * and calculate escalation multipliers for compression.
 */
export class RetryTracker {
  /** Tool name -> array of call timestamps (ms) */
  private calls: Map<string, number[]> = new Map();

  /**
   * Record a tool call. Should be called before compression.
   * @param toolName The namespaced tool name
   */
  recordCall(toolName: string): void {
    const now = Date.now();
    const existing = this.calls.get(toolName) || [];
    existing.push(now);
    this.calls.set(toolName, existing);
  }

  /**
   * Get the escalation multiplier for a tool based on recent calls.
   * Uses LINEAR formula: 1 + (tokenMultiplier - 1) * (callCount - 1)
   * - 1st call: 1x
   * - 2nd call: 2x (with default multiplier=2)
   * - 3rd call: 3x
   * - etc.
   *
   * @param toolName The namespaced tool name
   * @param config Retry escalation configuration
   * @returns The multiplier to apply to maxOutputTokens
   */
  getEscalationMultiplier(
    toolName: string,
    config: RetryEscalationConfig
  ): number {
    if (!config.enabled) {
      return 1;
    }

    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const cutoff = now - windowMs;

    const timestamps = this.calls.get(toolName) || [];
    // Filter to only calls within window
    const recentCalls = timestamps.filter((ts) => ts > cutoff);

    // Update stored timestamps to only keep recent ones
    if (recentCalls.length !== timestamps.length) {
      if (recentCalls.length === 0) {
        this.calls.delete(toolName);
      } else {
        this.calls.set(toolName, recentCalls);
      }
    }

    const callCount = recentCalls.length;
    if (callCount <= 1) {
      return 1;
    }

    // Linear formula: 1 + (multiplier - 1) * (count - 1)
    const escalation = 1 + (config.tokenMultiplier - 1) * (callCount - 1);

    logger.debug(
      `Retry escalation for ${toolName}: ${callCount} calls in window, multiplier=${escalation}x`
    );

    return escalation;
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   * @param maxWindowSeconds Maximum window size to consider (use largest configured window)
   */
  cleanup(maxWindowSeconds: number = 300): void {
    const now = Date.now();
    const cutoff = now - maxWindowSeconds * 1000;
    let cleaned = 0;

    for (const [toolName, timestamps] of this.calls.entries()) {
      const recent = timestamps.filter((ts) => ts > cutoff);
      if (recent.length === 0) {
        this.calls.delete(toolName);
        cleaned++;
      } else if (recent.length !== timestamps.length) {
        this.calls.set(toolName, recent);
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired retry tracking entries`);
    }
  }

  /**
   * Reset all tracking data. Used for testing or config reload.
   */
  reset(): void {
    this.calls.clear();
  }

  /**
   * Get current tracking stats for debugging.
   */
  getStats(): { toolCount: number; totalCalls: number } {
    let totalCalls = 0;
    for (const timestamps of this.calls.values()) {
      totalCalls += timestamps.length;
    }
    return { toolCount: this.calls.size, totalCalls };
  }
}

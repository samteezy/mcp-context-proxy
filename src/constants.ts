/**
 * Shared constants for mcp-context-proxy
 */

// Version should match package.json
export const VERSION = "0.2.1";

// MCP client/server identification
export const CLIENT_NAME = "mcpcp-proxy";

// Timing constants (in milliseconds)
export const CACHE_CLEANUP_INTERVAL_MS = 60_000; // 1 minute
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

// Default network settings
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = "0.0.0.0";

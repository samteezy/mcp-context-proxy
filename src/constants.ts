/**
 * Shared constants for mcp-context-proxy
 */
import { createRequire } from "module";

// Read version from package.json (single source of truth)
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
export const VERSION = pkg.version;

// MCP client/server identification
export const CLIENT_NAME = "mcpcp-proxy";

// Timing constants (in milliseconds)
export const CACHE_CLEANUP_INTERVAL_MS = 60_000; // 1 minute
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

// Default network settings
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = "0.0.0.0";

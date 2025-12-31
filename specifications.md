# MCPith - Technical Specification

## Project Overview

**Name:** `mcpith`

**Tagline:** *Get to the core of your context.*

**Purpose:** A transparent MCP proxy that intercepts tool responses from upstream MCP servers and intelligently compresses large responses using a fast external LLM before passing them to resource-constrained local models.

**Problem Statement:** Consumer hardware running local LLM inference is bottlenecked by token processing speed. Large MCP tool responses (file contents, search results, database queries) consume significant context window space and processing time. By offloading compression to a fast hosted model (or smaller local model), we reduce the token burden on the primary inference model.

---

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│                 │   MCP   │                      │   MCP   │                 │
│   MCP Client    │────────▶│       MCPith         │────────▶│   MCP Server    │
│ (Claude Desktop,│◀────────│    (Transparent      │◀────────│  (filesystem,   │
│  Open WebUI,    │         │       Proxy)         │         │   github, etc)  │
│  Cursor, etc)   │         │                      │         │                 │
└─────────────────┘         └──────────┬───────────┘         └─────────────────┘
                                       │
                                       │ Compression requests
                                       ▼
                            ┌──────────────────────┐
                            │  OpenAI-Compatible   │
                            │  Compression Model   │
                            │  (Groq/Together/     │
                            │   Ollama/etc)        │
                            └──────────────────────┘
```

### How It Works

MCPith acts as a **man-in-the-middle MCP proxy**:

1. **Downstream:** Exposes itself as an MCP server to clients (Claude Desktop, Cursor, Open WebUI, etc.)
2. **Upstream:** Connects as an MCP client to one or more actual MCP servers
3. **Transparent:** Forwards all MCP protocol messages (tools, resources, prompts) bidirectionally
4. **Compresses:** Intercepts tool call responses exceeding a token threshold and compresses them via an external LLM before returning to the client

### Component Responsibilities

1. **MCPith (this project)**
   - Implements MCP server interface for downstream clients
   - Implements MCP client interface for upstream servers
   - Proxies tool/resource/prompt discovery transparently
   - Intercepts tool responses exceeding configurable token thresholds
   - Compresses oversized responses via external OpenAI-compatible LLM
   - Caches compressed responses to avoid redundant compression
   - Passes through small responses unchanged

2. **Upstream: Any MCP Server(s)**
   - Standard MCP servers (filesystem, github, memory, etc.)
   - No modifications required
   - Can be stdio, SSE, or Streamable HTTP transport

3. **Downstream: Any MCP Client**
   - Claude Desktop, Cursor, Open WebUI, custom agents
   - Connects to MCPith instead of directly to MCP servers
   - No modifications required

4. **Compression Provider**
   - Any OpenAI-compatible API endpoint
   - Examples: Groq, Together.ai, OpenRouter, local Ollama, vLLM, etc.

---

## Technology Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5.x
- **MCP SDK:** `@modelcontextprotocol/sdk` (official MCP TypeScript SDK)
- **HTTP Client:** Built-in fetch (Node 20+)
- **OpenAI Client:** `openai` npm package (works with any OpenAI-compatible endpoint)
- **Token Counting:** `tiktoken` (for accurate token estimation)
- **Configuration:** Environment variables + optional JSON config file
- **Logging:** `pino` (structured, fast)
- **Testing:** Vitest
- **Build:** tsup (esbuild-based, fast builds)

---

## MCP Transport Support

MCPith supports multiple transport configurations:

### Downstream (MCPith as Server)

| Transport | Description | Use Case |
|-----------|-------------|----------|
| stdio | Standard input/output | Claude Desktop, local clients |
| SSE | Server-Sent Events over HTTP | Web-based clients |
| Streamable HTTP | HTTP with streaming | Modern MCP clients |

### Upstream (MCPith as Client)

| Transport | Description | Use Case |
|-----------|-------------|----------|
| stdio | Spawn and communicate via stdio | Local MCP servers |
| SSE | Connect to SSE endpoint | Remote MCP servers |
| Streamable HTTP | Connect to HTTP endpoint | Remote MCP servers |

---

## Configuration

### Environment Variables

```bash
# Required
COMPRESSION_API_BASE_URL=https://api.groq.com/openai/v1  # OpenAI-compatible endpoint
COMPRESSION_API_KEY=your-api-key                         # API key for compression provider

# Optional - Compression Settings
COMPRESSION_MODEL=llama-3.1-8b-instant           # Model to use for compression
COMPRESSION_THRESHOLD_TOKENS=1500                # Compress responses exceeding this
COMPRESSION_TARGET_TOKENS=500                    # Target size after compression
COMPRESSION_MAX_INPUT_TOKENS=8000                # Max tokens to send to compression model

# Optional - Server Settings  
DOWNSTREAM_TRANSPORT=stdio                       # stdio | sse | streamable-http
PORT=8080                                        # Port for SSE/HTTP transports
HOST=0.0.0.0                                     # Host to bind to
LOG_LEVEL=info                                   # debug, info, warn, error

# Optional - Caching
CACHE_ENABLED=true                               # Enable response caching
CACHE_TTL_SECONDS=3600                           # Cache TTL (1 hour default)
CACHE_MAX_SIZE_MB=100                            # Max cache size in memory

# Optional - Behavior
PASSTHROUGH_ON_ERROR=true                        # Return uncompressed on compression failure
COMPRESSION_TIMEOUT_MS=30000                     # Timeout for compression requests
```

### Config File (`mcpith.config.json`)

```json
{
  "downstream": {
    "transport": "stdio"
  },
  "upstream": {
    "servers": [
      {
        "name": "filesystem",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/documents"]
      },
      {
        "name": "github",
        "transport": "stdio",
        "command": "npx", 
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "${GITHUB_TOKEN}"
        }
      },
      {
        "name": "remote-memory",
        "transport": "sse",
        "url": "http://localhost:8001/sse"
      }
    ]
  },
  "compression": {
    "apiBaseUrl": "https://api.groq.com/openai/v1",
    "apiKey": "${COMPRESSION_API_KEY}",
    "model": "llama-3.1-8b-instant",
    "thresholdTokens": 1500,
    "targetTokens": 500,
    "maxInputTokens": 8000,
    "timeout": 30000,
    "temperature": 0.1
  },
  "cache": {
    "enabled": true,
    "ttlSeconds": 3600,
    "maxSizeMb": 100
  },
  "tools": {
    "exclude": ["some_tool_to_never_compress"],
    "include": null
  }
}
```

### Claude Desktop Integration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcpith": {
      "command": "npx",
      "args": ["-y", "mcpith"],
      "env": {
        "COMPRESSION_API_BASE_URL": "https://api.groq.com/openai/v1",
        "COMPRESSION_API_KEY": "your-key",
        "MCPITH_CONFIG": "/path/to/mcpith.config.json"
      }
    }
  }
}
```

---

## MCP Protocol Handling

### Message Flow

MCPith transparently proxies all MCP protocol messages:

```
Client                    MCPith                    Upstream Server
  │                         │                              │
  │  initialize             │                              │
  │────────────────────────▶│  initialize                  │
  │                         │─────────────────────────────▶│
  │                         │  InitializeResult            │
  │                         │◀─────────────────────────────│
  │  InitializeResult       │                              │
  │  (merged capabilities)  │                              │
  │◀────────────────────────│                              │
  │                         │                              │
  │  tools/list             │                              │
  │────────────────────────▶│  tools/list                  │
  │                         │─────────────────────────────▶│
  │                         │  ToolsListResult             │
  │                         │◀─────────────────────────────│
  │  ToolsListResult        │                              │
  │  (aggregated tools)     │                              │
  │◀────────────────────────│                              │
  │                         │                              │
  │  tools/call             │                              │
  │────────────────────────▶│  tools/call                  │
  │                         │─────────────────────────────▶│
  │                         │  CallToolResult (5000 tokens)│
  │                         │◀─────────────────────────────│
  │                         │                              │
  │                         │  [Compress if > threshold]   │
  │                         │         │                    │
  │                         │         ▼                    │
  │                         │  ┌─────────────────┐         │
  │                         │  │ Compression API │         │
  │                         │  └─────────────────┘         │
  │                         │                              │
  │  CallToolResult         │                              │
  │  (800 tokens)           │                              │
  │◀────────────────────────│                              │
```

### Capability Aggregation

When connecting to multiple upstream servers, MCPith:

1. **Tools:** Aggregates all tools, prefixing with server name if conflicts exist
2. **Resources:** Aggregates all resources with server-prefixed URIs
3. **Prompts:** Aggregates all prompts, prefixing with server name if conflicts exist

```typescript
// Tool naming strategy for conflicts
interface ToolNamingStrategy {
  // If tool "read_file" exists on both "filesystem" and "github" servers:
  // Option 1: Prefix all - "filesystem__read_file", "github__read_file"  
  // Option 2: Prefix conflicts only - "read_file" (first), "github__read_file"
  strategy: 'prefix-all' | 'prefix-conflicts';
  separator: string; // Default: "__"
}
```

### Proxied Message Types

| Category | Message | Handling |
|----------|---------|----------|
| Lifecycle | `initialize` | Merge capabilities from all upstreams |
| Lifecycle | `initialized` | Forward to all upstreams |
| Lifecycle | `ping` | Respond directly |
| Discovery | `tools/list` | Aggregate from all upstreams |
| Discovery | `resources/list` | Aggregate from all upstreams |
| Discovery | `prompts/list` | Aggregate from all upstreams |
| Execution | `tools/call` | Route to correct upstream, **compress response** |
| Execution | `resources/read` | Route to correct upstream, **compress response** |
| Execution | `prompts/get` | Route to correct upstream, passthrough |
| Notifications | `*` | Forward bidirectionally |

---

## Compression Logic

### Decision Flow

```typescript
interface CompressionDecision {
  shouldCompress: boolean;
  reason: 'under-threshold' | 'over-threshold' | 'excluded-tool' | 'binary-content' | 'already-compressed';
  tokenCount: number;
}

function shouldCompress(
  toolName: string,
  response: CallToolResult,
  config: CompressionConfig
): CompressionDecision {
  // 1. Check if tool is excluded
  if (config.excludeTools?.includes(toolName)) {
    return { shouldCompress: false, reason: 'excluded-tool', tokenCount: 0 };
  }

  // 2. Extract text content from response
  const textContent = extractTextContent(response);
  if (!textContent) {
    return { shouldCompress: false, reason: 'binary-content', tokenCount: 0 };
  }

  // 3. Count tokens
  const tokenCount = countTokens(textContent);

  // 4. Compare to threshold
  if (tokenCount <= config.thresholdTokens) {
    return { shouldCompress: false, reason: 'under-threshold', tokenCount };
  }

  return { shouldCompress: true, reason: 'over-threshold', tokenCount };
}

function extractTextContent(result: CallToolResult): string | null {
  // MCP tool results contain content array
  const textParts = result.content
    .filter((c): c is TextContent => c.type === 'text')
    .map(c => c.text);
  
  if (textParts.length === 0) return null;
  return textParts.join('\n');
}
```

### Compression Strategies

```typescript
interface CompressionStrategy {
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

const DEFAULT_STRATEGY: CompressionStrategy = {
  name: 'default',
  systemPrompt: `You are a context compression assistant. Your task is to compress tool output while preserving all essential information needed for an AI assistant to complete its task.

Rules:
1. Preserve all factual data, numbers, IDs, names, and technical details
2. Remove redundant explanations and verbose formatting
3. Convert lengthy prose to concise bullet points where appropriate
4. Maintain the semantic meaning and actionable information
5. If the input is structured data (JSON, code), preserve the structure but summarize verbose parts
6. Never add information that wasn't in the original
7. Aim for maximum information density

Output only the compressed content with no preamble or explanation.`,

  userPromptTemplate: `Compress the following tool output to approximately {{targetTokens}} tokens while preserving all essential information:

<tool_name>{{toolName}}</tool_name>
<tool_output>
{{content}}
</tool_output>`
};

const JSON_STRATEGY: CompressionStrategy = {
  name: 'json',
  systemPrompt: `You are a JSON compression assistant. Compress JSON tool output while preserving structure and essential data.

Rules:
1. Maintain valid JSON structure
2. Remove null/empty fields unless semantically important
3. Truncate long string values, keeping essential parts
4. Preserve all IDs, keys, and reference values
5. Summarize arrays with many similar items: keep first 2-3, add count
6. Never corrupt JSON structure

Output valid JSON only, no markdown fencing or explanation.`,

  userPromptTemplate: `Compress this JSON to ~{{targetTokens}} tokens:

{{content}}`
};

const CODE_STRATEGY: CompressionStrategy = {
  name: 'code',
  systemPrompt: `You are a code compression assistant. Compress code/file content while preserving functionality understanding.

Rules:
1. Keep function/class signatures and docstrings
2. Summarize implementation bodies as brief comments
3. Preserve import statements
4. Keep error handling patterns visible
5. Maintain line number references if present
6. Show structure, not every line

Output the compressed code representation.`,

  userPromptTemplate: `Compress this code to ~{{targetTokens}} tokens, preserving structure and key logic:

\`\`\`
{{content}}
\`\`\``
};

function selectStrategy(content: string, toolName: string): CompressionStrategy {
  // Detect JSON
  const trimmed = content.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return JSON_STRATEGY;
    } catch {}
  }

  // Detect code (heuristics)
  const codeIndicators = [
    /^(import|from|const|let|var|function|class|def|pub fn|async fn)/m,
    /\{\s*\n.*\n\s*\}/s,
    /^\s*(if|for|while|match|switch)\s*[\(\{]/m
  ];
  if (codeIndicators.some(re => re.test(content))) {
    return CODE_STRATEGY;
  }

  return DEFAULT_STRATEGY;
}
```

### Compression Execution

```typescript
async function compressToolResponse(
  toolName: string,
  originalResult: CallToolResult,
  config: CompressionConfig,
  cache: ResponseCache,
  openai: OpenAI
): Promise<CallToolResult> {
  const textContent = extractTextContent(originalResult);
  if (!textContent) return originalResult;

  const originalTokens = countTokens(textContent);

  // Check cache
  const cacheKey = hashContent(textContent, config.targetTokens);
  const cached = await cache.get(cacheKey);
  if (cached) {
    return buildCompressedResult(originalResult, cached.compressed, {
      originalTokens,
      compressedTokens: cached.compressedTokens,
      cached: true
    });
  }

  // Select strategy and compress
  const strategy = selectStrategy(textContent, toolName);
  const userPrompt = strategy.userPromptTemplate
    .replace('{{targetTokens}}', config.targetTokens.toString())
    .replace('{{toolName}}', toolName)
    .replace('{{content}}', truncateForCompression(textContent, config.maxInputTokens));

  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: strategy.systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: config.temperature ?? 0.1,
    max_tokens: Math.ceil(config.targetTokens * 1.5)
  });

  const compressed = response.choices[0]?.message?.content ?? textContent;
  const compressedTokens = countTokens(compressed);

  // Cache result
  await cache.set(cacheKey, { compressed, compressedTokens, strategy: strategy.name });

  return buildCompressedResult(originalResult, compressed, {
    originalTokens,
    compressedTokens,
    cached: false
  });
}

function buildCompressedResult(
  original: CallToolResult,
  compressedText: string,
  meta: { originalTokens: number; compressedTokens: number; cached: boolean }
): CallToolResult {
  // Replace text content with compressed version
  // Preserve any non-text content (images, etc.)
  const newContent = original.content.map(c => {
    if (c.type === 'text') {
      return {
        type: 'text' as const,
        text: `[Compressed from ${meta.originalTokens} to ${meta.compressedTokens} tokens]\n\n${compressedText}`
      };
    }
    return c;
  });

  return {
    ...original,
    content: newContent
  };
}
```

### Token Counting

```typescript
import { encoding_for_model, TiktokenModel } from 'tiktoken';

const encoder = encoding_for_model('gpt-4' as TiktokenModel);

function countTokens(text: string): number {
  try {
    return encoder.encode(text).length;
  } catch {
    // Fallback: rough estimate
    return Math.ceil(text.length / 4);
  }
}

function truncateForCompression(text: string, maxTokens: number): string {
  const tokens = encoder.encode(text);
  if (tokens.length <= maxTokens) return text;

  // Keep first 80% and last 10%
  const keepStart = Math.floor(maxTokens * 0.8);
  const keepEnd = Math.floor(maxTokens * 0.1);

  const startText = encoder.decode(tokens.slice(0, keepStart));
  const endText = encoder.decode(tokens.slice(-keepEnd));

  return `${startText}\n\n[... ${tokens.length - keepStart - keepEnd} tokens truncated ...]\n\n${endText}`;
}
```

---

## Caching Layer

### Cache Interface

```typescript
interface CacheEntry {
  compressed: string;
  compressedTokens: number;
  strategy: string;
  createdAt: number;
}

interface ResponseCache {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, value: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  stats(): Promise<CacheStats>;
}

interface CacheStats {
  entries: number;
  sizeBytes: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}
```

### Cache Key Generation

```typescript
import { createHash } from 'crypto';

function hashContent(content: string, targetTokens: number): string {
  const hash = createHash('sha256');
  hash.update(content);
  hash.update(targetTokens.toString());
  return hash.digest('hex').slice(0, 16);
}
```

---

## Error Handling

### Error Categories

```typescript
enum MCPithErrorCode {
  // Upstream errors
  UPSTREAM_CONNECTION_FAILED = 'UPSTREAM_CONNECTION_FAILED',
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  UPSTREAM_PROTOCOL_ERROR = 'UPSTREAM_PROTOCOL_ERROR',

  // Compression errors
  COMPRESSION_API_ERROR = 'COMPRESSION_API_ERROR',
  COMPRESSION_TIMEOUT = 'COMPRESSION_TIMEOUT',
  COMPRESSION_INVALID_RESPONSE = 'COMPRESSION_INVALID_RESPONSE',

  // Configuration errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  NO_UPSTREAM_SERVERS = 'NO_UPSTREAM_SERVERS',

  // Internal errors
  CACHE_ERROR = 'CACHE_ERROR',
  TOKEN_COUNT_ERROR = 'TOKEN_COUNT_ERROR'
}
```

### Recovery Strategy

```typescript
async function handleCompressionError(
  error: Error,
  originalResult: CallToolResult,
  config: Config,
  logger: Logger
): Promise<CallToolResult> {
  logger.error({ error }, 'Compression failed');

  if (config.passthroughOnError) {
    // Return original uncompressed response
    logger.info('Falling back to uncompressed response');
    return originalResult;
  }

  // Return error in tool result
  return {
    content: [
      {
        type: 'text',
        text: `[MCPith compression error: ${error.message}]\n\n` + 
              extractTextContent(originalResult)
      }
    ],
    isError: true
  };
}
```

---

## Observability

### Metrics (Prometheus format)

```typescript
// Counter metrics
mcpith_requests_total{direction, message_type}  // direction: upstream|downstream
mcpith_compression_total{strategy, cached}
mcpith_compression_errors_total{code}

// Histogram metrics
mcpith_request_duration_seconds{direction, message_type}
mcpith_compression_duration_seconds{strategy}
mcpith_tokens_original{tool}
mcpith_tokens_compressed{tool}

// Gauge metrics
mcpith_cache_size_bytes
mcpith_cache_entries
mcpith_cache_hit_rate
mcpith_upstream_connections{server}
```

### Structured Logging

```typescript
// Startup
logger.info({
  type: 'startup',
  downstreamTransport: 'stdio',
  upstreamServers: ['filesystem', 'github'],
  compressionModel: 'llama-3.1-8b-instant'
});

// Tool call with compression
logger.info({
  type: 'tool_call',
  tool: 'read_file',
  server: 'filesystem',
  originalTokens: 5000,
  compressedTokens: 800,
  compressionRatio: 0.84,
  strategy: 'code',
  cached: false,
  durationMs: 450
});

// Passthrough (under threshold)
logger.debug({
  type: 'tool_call',
  tool: 'get_time',
  server: 'time',
  tokens: 50,
  compressed: false,
  reason: 'under-threshold'
});
```

---

## Project Structure

```
mcpith/
├── src/
│   ├── index.ts                 # Entry point, CLI handling
│   ├── proxy.ts                 # Main proxy orchestration
│   ├── config/
│   │   ├── index.ts             # Config loading and validation
│   │   ├── schema.ts            # Zod schemas for config
│   │   └── defaults.ts          # Default values
│   ├── mcp/
│   │   ├── server.ts            # Downstream MCP server implementation
│   │   ├── client.ts            # Upstream MCP client implementation
│   │   ├── aggregator.ts        # Tool/resource/prompt aggregation
│   │   └── router.ts            # Route requests to correct upstream
│   ├── compression/
│   │   ├── index.ts             # Compression orchestration
│   │   ├── strategies.ts        # Compression strategies
│   │   ├── client.ts            # OpenAI-compatible client wrapper
│   │   └── tokens.ts            # Token counting utilities
│   ├── cache/
│   │   ├── index.ts             # Cache interface
│   │   ├── memory.ts            # In-memory LRU implementation
│   │   └── types.ts             # Cache types
│   ├── metrics/
│   │   ├── index.ts             # Metrics collection
│   │   └── prometheus.ts        # Prometheus exporter
│   └── utils/
│       ├── logger.ts            # Pino logger setup
│       ├── hash.ts              # Hashing utilities
│       └── types.ts             # Shared types
├── tests/
│   ├── unit/
│   │   ├── compression.test.ts
│   │   ├── tokens.test.ts
│   │   ├── aggregator.test.ts
│   │   └── cache.test.ts
│   ├── integration/
│   │   ├── proxy.test.ts
│   │   └── e2e.test.ts
│   └── fixtures/
│       ├── large-json.json
│       ├── code-sample.txt
│       └── tool-responses.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Dependencies

```json
{
  "name": "mcpith",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "mcpith": "./dist/index.js"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.x",
    "openai": "^4.x",
    "tiktoken": "^1.x",
    "lru-cache": "^10.x",
    "pino": "^9.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "tsx": "^4.x",
    "tsup": "^8.x",
    "typescript": "^5.x",
    "vitest": "^2.x",
    "@vitest/coverage-v8": "^2.x",
    "eslint": "^9.x",
    "pino-pretty": "^11.x"
  }
}
```

---

## CLI Interface

```bash
# Basic usage (uses config file or env vars)
mcpith

# Specify config file
mcpith --config ./mcpith.config.json

# Override specific settings
mcpith --threshold 2000 --target 600

# Debug mode
mcpith --log-level debug

# Show help
mcpith --help
```

### CLI Options

| Flag | Env Var | Description |
|------|---------|-------------|
| `--config, -c` | `MCPITH_CONFIG` | Path to config file |
| `--threshold` | `COMPRESSION_THRESHOLD_TOKENS` | Token threshold for compression |
| `--target` | `COMPRESSION_TARGET_TOKENS` | Target tokens after compression |
| `--log-level` | `LOG_LEVEL` | Logging level |
| `--version, -v` | - | Show version |
| `--help, -h` | - | Show help |

---

## Docker Support

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 8080

ENTRYPOINT ["node", "dist/index.js"]
```

### docker-compose.yml (development)

```yaml
version: '3.8'

services:
  mcpith:
    build: .
    ports:
      - "8080:8080"
    environment:
      - COMPRESSION_API_BASE_URL=https://api.groq.com/openai/v1
      - COMPRESSION_API_KEY=${COMPRESSION_API_KEY}
      - COMPRESSION_MODEL=llama-3.1-8b-instant
      - COMPRESSION_THRESHOLD_TOKENS=1500
      - DOWNSTREAM_TRANSPORT=sse
      - LOG_LEVEL=debug
    volumes:
      - ./mcpith.config.json:/app/mcpith.config.json
```

---

## Testing Strategy

### Unit Tests

- Token counting accuracy
- Compression strategy selection  
- Cache key generation
- Config validation
- Tool/resource aggregation logic
- Request routing

### Integration Tests

- Full proxy flow with mock upstream servers
- Compression with mock OpenAI endpoint
- Cache hit/miss scenarios
- Error recovery paths
- Multiple upstream server aggregation

### E2E Tests

- Real MCP servers (mcp-server-time, mcp-server-memory)
- Real compression API (use cheap/fast model)
- Claude Desktop integration test
- Verify response integrity after compression

### Test Fixtures

- Small tool response (50 tokens)
- Medium tool response (500 tokens) 
- Large JSON response (5000 tokens)
- Large code file (3000 tokens)
- Mixed content response (4000 tokens)

---

## Future Enhancements (Out of Scope for v0.1)

1. **Streaming compression:** Compress streaming tool responses incrementally
2. **Adaptive thresholds:** Learn optimal thresholds per tool based on usage
3. **Multiple compression models:** Route to different models based on content type
4. **Response reconstruction:** Store originals, allow fetching uncompressed on demand
5. **Resource compression:** Compress `resources/read` responses (not just tools)
6. **Prompt optimization:** Compress prompt templates
7. **Cluster mode:** Redis-backed cache for multi-instance deployments
8. **Web UI:** Dashboard for monitoring compression stats
9. **MCP Sampling integration:** Use MCP sampling to call back to client's LLM for compression

---

## Success Criteria

1. **Transparent:** All MCP features work through proxy without modification
2. **Compression:** Achieves 60%+ token reduction on large responses
3. **Performance:** < 50ms overhead for passthrough, < 2s for compression
4. **Reliability:** Graceful fallback on compression failures
5. **Compatibility:** Works with Claude Desktop, Cursor, and other MCP clients
6. **Aggregation:** Correctly aggregates tools from multiple upstream servers

---

## Open Questions for Implementation

1. Should we support request body compression (for tools with large inputs)?
2. How should we handle binary content in tool responses (images, files)?
3. Should we add a "compression hint" in the tool result metadata?
4. Should we support custom compression prompts per tool?
5. Should we expose compression stats via a special MCP resource?

---

## Plugin Architecture

MCPith supports a plugin system for extending compression strategies, request/response hooks, cache backends, transports, and metrics exporters via TypeScript/JS modules.

### Plugin Interface

Plugins export a default object implementing `MCPithPlugin`:

```typescript
export interface MCPithPlugin {
  name: string;
  version: string;

  // Extension points (all optional)
  compressionStrategies?: CompressionStrategy[];
  hooks?: PluginHooks;
  cacheBackend?: () => ResponseCache;
  transports?: TransportDefinition[];
  metricsExporter?: () => MetricsExporter;

  // Lifecycle
  initialize?(context: PluginContext): Promise<void>;
  shutdown?(): Promise<void>;
}
```

### Hook System

Middleware-style hooks for intercepting MCP message flow:

```typescript
interface PluginHooks {
  // Tool call lifecycle
  onToolCall?(request: ToolCallRequest, next: NextFn<ToolCallResult>): Promise<ToolCallResult>;
  onToolResult?(result: ToolCallResult, context: ToolContext): Promise<ToolCallResult>;

  // Compression lifecycle
  beforeCompression?(content: string, context: CompressionContext): Promise<string | SkipCompression>;
  afterCompression?(result: CompressionResult): Promise<string>;

  // Connection events
  onUpstreamConnect?(server: UpstreamServerInfo): Promise<void>;
  onUpstreamDisconnect?(server: UpstreamServerInfo): Promise<void>;
}

type NextFn<T> = () => Promise<T>;
type SkipCompression = { skip: true; reason: string };
```

### Plugin Context

Plugins receive utilities and config:

```typescript
interface PluginContext {
  config: Readonly<MCPithConfig>;
  logger: Logger;
  tokenCounter: TokenCounter;
}
```

### Plugin Configuration

```json
{
  "plugins": [
    "./plugins/my-strategy.js",
    "/absolute/path/plugin.js",
    "mcpith-plugin-redis"
  ]
}
```

### Plugin Loading

```typescript
async function loadPlugins(
  paths: string[],
  context: PluginContext
): Promise<LoadedPlugin[]> {
  const plugins: LoadedPlugin[] = [];

  for (const path of paths) {
    const resolved = resolvePluginPath(path);
    const module = await import(resolved);
    const plugin = module.default as MCPithPlugin;

    validatePlugin(plugin);
    await plugin.initialize?.(context);
    plugins.push({ plugin, path: resolved });
  }

  return plugins;
}
```

### Hook Execution Pipeline

```typescript
function createHookPipeline<T>(
  plugins: MCPithPlugin[],
  hookName: keyof PluginHooks
): Pipeline<T> {
  const hooks = plugins
    .map(p => p.hooks?.[hookName])
    .filter(Boolean);

  return async (input, context, coreFn) => {
    // Build chain from end to start
    let chain = coreFn;
    for (const hook of hooks.reverse()) {
      const next = chain;
      chain = () => hook(input, context, next);
    }
    return chain();
  };
}
```

### Plugin Project Structure

```
mcpith/
├── src/
│   ├── plugins/
│   │   ├── types.ts             # Plugin interface definitions
│   │   ├── loader.ts            # Load and validate plugins from paths
│   │   ├── pipeline.ts          # Hook execution pipeline
│   │   ├── context.ts           # PluginContext factory
│   │   └── index.ts             # Public API re-exports
```

### Integration Points

1. **proxy.ts** - Initialize plugin system, run connection hooks
2. **compression/index.ts** - Check plugin strategies first, run compression hooks
3. **cache/index.ts** - Use plugin cache backend if provided
4. **mcp/server.ts** - Run tool call hooks in request handling

### Example Plugin

```typescript
// plugins/sql-compressor.ts
import type { MCPithPlugin } from 'mcpith';

const plugin: MCPithPlugin = {
  name: 'sql-compressor',
  version: '1.0.0',

  compressionStrategies: [{
    name: 'sql-results',
    detect: (content) => content.includes('SELECT') && content.includes('rows'),
    systemPrompt: 'Compress SQL query results, preserving column names and key data...',
    userPromptTemplate: '{{content}}'
  }],

  hooks: {
    beforeCompression: async (content, ctx) => {
      // Skip compression for small results
      if (ctx.tokenCount < 100) {
        return { skip: true, reason: 'too-small' };
      }
      return content;
    }
  }
};

export default plugin;
```

---

## References

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [tiktoken](https://github.com/openai/tiktoken)
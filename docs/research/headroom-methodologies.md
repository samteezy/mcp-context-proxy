# Headroom Methodologies Research

Research into [chopratejas/headroom](https://github.com/chopratejas/headroom) - a Python library that reduces LLM token costs by 50-90% through intelligent context compression.

## Executive Summary

Headroom offers several methodologies that could significantly enhance mcp-context-proxy's compression capabilities. The most impactful are:

1. **SmartCrusher** - Statistical pre-filtering before LLM compression
2. **CCR (Compress-Cache-Retrieve)** - Lossless retrieval of compressed content
3. **Semantic Caching** - Similarity-based cache hits
4. **Relevance Scoring** - BM25/embedding-based item prioritization

## Current State: mcp-context-proxy

Our current approach:
- **LLM-only compression**: All compression delegated to external LLM
- **Strategy detection**: Basic JSON/code/default classification
- **Goal-aware extraction**: Users can specify `_mcpcp_goal` to focus compression
- **Simple caching**: Exact-match key-based cache with TTL

## Headroom Methodologies

### 1. SmartCrusher (Statistical Pre-Compression)

**What it does**: Analyzes JSON arrays statistically before any LLM involvement, reducing tokens by 70-90% through intelligent filtering.

**Key heuristics**:
- **Error preservation**: Items containing "error", "exception", "failed", "critical" are always kept
- **Structural outliers**: Items with rare fields or unique status values
- **Numeric anomalies**: Values > 2 standard deviations from mean
- **Boundary items**: First N and last M items for context
- **Relevance scoring**: Query-matched items via BM25 or embeddings

**Safety mechanism**: "High variability + no importance signal = don't crush" - prevents crushing unique datasets where everything matters.

**Potential for mcp-context-proxy**:
- Could run BEFORE our LLM compression as a pre-filter
- Dramatically reduce tokens sent to compression LLM
- Deterministic, fast, no API latency
- Works especially well with search results, logs, metrics

### 2. CCR (Compress-Cache-Retrieve)

**What it does**: Stores original uncompressed content and injects a retrieval tool so the LLM can request more detail when needed.

**How it works**:
1. Compress content and store original with hash marker
2. Inject marker into compressed output: `[50 items compressed to 5. Retrieve more: hash=abc123]`
3. Inject retrieval tool into LLM's available tools
4. LLM can call retrieval tool with hash + optional query filter

**Potential for mcp-context-proxy**:
- Eliminates fear of over-compression
- LLM self-corrects when it needs more context
- Could implement as an MCP tool exposed to downstream clients
- Pairs well with our existing goal-aware compression

### 3. Relevance Scoring (BM25 + Embeddings)

**What it does**: Scores items in arrays based on relevance to user's query/goal.

**BM25 Implementation highlights**:
- Custom tokenizer recognizes UUIDs, numeric IDs, alphanumeric words
- +0.3 bonus for long-token matches (>=8 chars) - preserves important identifiers
- Standard BM25 formula with configurable k1/b parameters
- Explainable: returns matched terms and reasoning

**Hybrid approach**: Combines BM25 (keyword matching) with embedding similarity (semantic matching) for best results.

**Potential for mcp-context-proxy**:
- Our `_mcpcp_goal` feature already captures user intent
- Could use BM25 to pre-score items BEFORE sending to LLM
- Lightweight, no external dependencies
- Works well with SmartCrusher for combined filtering

### 4. Semantic Caching

**What it does**: Returns cached responses for semantically similar (not just identical) queries.

**Implementation**:
- Compute embeddings for query
- Compare with cached query embeddings via cosine similarity
- Cache hit if similarity > threshold (default 0.95)
- Falls back to exact hash matching first (faster)

**Potential for mcp-context-proxy**:
- Currently we cache exact `toolName:args:goal` matches only
- Semantic cache could hit on similar goals: "find API endpoints" ≈ "what are the API routes"
- Requires embedding model access (could use same compression endpoint)

### 5. CacheAligner (Prefix Stabilization)

**What it does**: Reorganizes prompts to maximize provider-level prompt caching.

**The problem**: Dynamic content (dates, timestamps) at prompt start breaks cache:
```
"You are helpful. Today is January 13, 2026..." // Changes daily = 0% cache hits
```

**The solution**: Move dynamic content to end, keep static prefix stable:
```
"You are helpful. [static instructions...]" + "[dynamic: Today is January 13]"
```

**Potential for mcp-context-proxy**:
- Less directly applicable (we don't control downstream prompts)
- Could apply to our compression prompts sent to LLM
- Minor optimization compared to SmartCrusher/CCR

### 6. RollingWindow (Context Management)

**What it does**: Manages conversation context within token limits by intelligently dropping old content.

**Drop priority** (oldest first):
1. Old tool outputs (as complete units)
2. Old assistant messages
3. Old user messages (last resort)
4. Never: System prompt, recent N turns, active tool call/result pairs

**Key insight**: Tool calls and results must stay paired - dropping one orphans the other.

**Potential for mcp-context-proxy**:
- Not directly applicable (we're a proxy, not conversation manager)
- Could inform future features if we add multi-turn context tracking

## Recommended Implementation Priorities

### High Priority

1. **SmartCrusher-style Pre-filtering**
   - Implement statistical analysis for JSON arrays
   - Apply BEFORE LLM compression
   - Preserve: errors, anomalies, boundary items, query-relevant items
   - Expected impact: 50-70% reduction before LLM even runs

2. **BM25 Relevance Scoring**
   - Use existing `_mcpcp_goal` as query source
   - Pre-score items, keep top N + anomalies
   - No external dependencies, fast, deterministic

### Medium Priority

3. **CCR Retrieval System**
   - Store original content with hash reference
   - Expose retrieval as MCP tool
   - Allow downstream clients to request more detail
   - Requires storage strategy (memory/disk/redis)

4. **Semantic Cache**
   - Requires embedding capability
   - Could reuse compression LLM endpoint if it supports embeddings
   - Meaningful improvement for similar-but-not-identical goals

### Lower Priority

5. **CacheAligner for Compression Prompts**
   - Optimize our compression prompts for provider caching
   - Minor savings compared to other improvements

## Architecture Considerations

### Integration Points

```
Current flow:
Tool Response → Token Count → [if > threshold] → LLM Compression → Cache → Client

Proposed flow:
Tool Response → Token Count → [if > threshold] →
  → SmartCrusher (statistical pre-filter) →
  → BM25 Relevance Scoring (if goal provided) →
  → LLM Compression (reduced input) →
  → CCR Store (original + compressed) →
  → Cache (semantic matching) →
  → Client (with retrieval marker)
```

### New Components Needed

1. `src/compression/smart-crusher.ts` - Statistical pre-filtering
2. `src/compression/relevance.ts` - BM25 scoring implementation
3. `src/ccr/store.ts` - Original content storage
4. `src/ccr/retrieval-tool.ts` - MCP tool for content retrieval
5. `src/cache/semantic.ts` - Embedding-based cache matching

### Configuration Extensions

```typescript
interface CompressionConfig {
  // Existing
  baseUrl: string;
  model: string;
  apiKey?: string;

  // New: SmartCrusher
  smartCrusher?: {
    enabled: boolean;
    keepFirst: number;        // Default: 3
    keepLast: number;         // Default: 2
    anomalyThreshold: number; // Default: 2.0 (std devs)
    maxItemsAfterCrush: number;
  };

  // New: CCR
  ccr?: {
    enabled: boolean;
    storageType: 'memory' | 'disk';
    maxStorageSize: number;
    ttlSeconds: number;
  };

  // New: Semantic Cache
  semanticCache?: {
    enabled: boolean;
    similarityThreshold: number; // Default: 0.95
    embeddingModel?: string;
  };
}
```

## References

- [Headroom GitHub Repository](https://github.com/chopratejas/headroom)
- [BM25 Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)
- [Semantic Similarity Caching](https://www.pinecone.io/learn/semantic-search/)

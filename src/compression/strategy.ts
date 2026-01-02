import type { CompressionStrategy } from "../types.js";

/**
 * Detect the appropriate compression strategy based on content
 */
export function detectStrategy(content: string): CompressionStrategy {
  // Try to parse as JSON - expected to fail for non-JSON content
  try {
    JSON.parse(content);
    return "json";
  } catch {
    // Not valid JSON, continue to check other strategies
  }

  // Check for code-like patterns
  if (isCodeLike(content)) {
    return "code";
  }

  return "default";
}

/**
 * Check if content looks like code
 */
function isCodeLike(content: string): boolean {
  const codePatterns = [
    // Function declarations
    /\bfunction\s+\w+\s*\(/,
    /\bconst\s+\w+\s*=\s*(?:async\s*)?\(/,
    /\bdef\s+\w+\s*\(/,
    /\bclass\s+\w+/,
    // Common syntax
    /\bimport\s+.*\s+from\s+/,
    /\brequire\s*\(/,
    /\bexport\s+(?:default\s+)?(?:function|class|const|let|var)/,
    // Braces and semicolons pattern (multiple occurrences)
    /[{};]\s*\n.*[{};]\s*\n/,
    // Method/property access chains
    /\.\w+\([^)]*\)\.\w+\(/,
    // Arrow functions
    /=>\s*{/,
    // Type annotations (TypeScript)
    /:\s*(?:string|number|boolean|void|any|unknown)\b/,
  ];

  const matchCount = codePatterns.filter((pattern) =>
    pattern.test(content)
  ).length;

  // Consider it code if multiple patterns match
  return matchCount >= 2;
}

/**
 * Get the compression prompt for a given strategy
 *
 * Structure: Content first (in XML tags), instructions last.
 * This leverages recency bias - instructions are fresh when generating.
 *
 * When a goal is provided, prompts are restructured to make the goal
 * the primary focus, with aggressive filtering of irrelevant content.
 */
export function getCompressionPrompt(
  strategy: CompressionStrategy,
  content: string,
  maxTokens?: number,
  goal?: string,
  customInstructions?: string
): string {
  const tokenLimit = maxTokens
    ? `Keep your response under ${maxTokens} tokens.`
    : "Be concise while retaining helpful details.";

  const customInstructionBlock = customInstructions
    ? `\nADDITIONAL INSTRUCTIONS: ${customInstructions}`
    : "";

  // Goal-focused prompts are structured differently
  if (goal) {
    return getGoalFocusedPrompt(strategy, content, goal, tokenLimit, customInstructionBlock);
  }

  // Standard compression prompts (no goal)
  switch (strategy) {
    case "json":
      return `<document type="json">
${content}
</document>

<task>
Compress the JSON above while preserving structure and important values. Remove redundant whitespace, shorten keys if possible, and summarize repeated patterns.${customInstructionBlock}

${tokenLimit}
Output only the compressed JSON, no explanations.
</task>`;

    case "code":
      return `<document type="code">
${content}
</document>

<task>
Summarize the code above while preserving:
- Function/class signatures and parameters
- Key logic and algorithms
- Important comments
- Return types and values

Remove non-critical implementation details.${customInstructionBlock}

${tokenLimit}
Output only the summarized code or pseudocode, no explanations.
</task>`;

    case "default":
    default:
      return `<document>
${content}
</document>

<task>
Summarize the document above while preserving all important information, facts, and data. Remove redundancy and verbose language. ${customInstructionBlock}

${tokenLimit}
Output only the compressed text, no explanations.
</task>`;
  }
}

/**
 * Generate goal-focused extraction prompts
 *
 * These prompts place the goal first and focus on extracting
 * relevant information rather than general compression.
 */
function getGoalFocusedPrompt(
  strategy: CompressionStrategy,
  content: string,
  goal: string,
  tokenLimit: string,
  customInstructionBlock: string
): string {
  const goalBlock = `<goal>
${goal}
</goal>`;

  const relevanceFilter = `CRITICAL: Extract only information that helps achieve the goal above. Completely omit sections, fields, or details that are irrelevant - they waste tokens and distract from the purpose.`;

  switch (strategy) {
    case "json":
      return `${goalBlock}

<document type="json">
${content}
</document>

<task>
Extract JSON data relevant to the goal.

${relevanceFilter}

- Keep structure intact for extracted data
- Remove irrelevant keys/objects entirely
- Summarize repeated patterns if relevant${customInstructionBlock}

${tokenLimit}
Output only the extracted JSON, no explanations.
</task>`;

    case "code":
      return `${goalBlock}

<document type="code">
${content}
</document>

<task>
Extract code relevant to the goal.

${relevanceFilter}

For extracted code, preserve:
- Function/class signatures and parameters
- Key logic and algorithms
- Important comments
- Return types and values

Omit functions, classes, and sections unrelated to the goal.${customInstructionBlock}

${tokenLimit}
Output only the extracted code or summary, no explanations.
</task>`;

    case "default":
    default:
      return `${goalBlock}

<document>
${content}
</document>

<task>
Extract information from the document that serves the goal.

${relevanceFilter}

- Focus on facts, data, and details that help achieve the objective
- Omit tangential information, background, and unrelated sections
- Be direct and actionable${customInstructionBlock}

${tokenLimit}
Output only the extracted information, no explanations.
</task>`;
  }
}

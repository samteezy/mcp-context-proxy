import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { encode } from "gpt-tokenizer";
import type {
  CallToolResult,
  ReadResourceResult,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CompressionConfig,
  CompressionResult,
} from "../types.js";
import { detectStrategy, getCompressionPrompt } from "./strategy.js";
import { getLogger } from "../logger.js";

export class Compressor {
  private config: CompressionConfig;
  private provider: ReturnType<typeof createOpenAICompatible>;

  constructor(config: CompressionConfig) {
    this.config = config;
    this.provider = createOpenAICompatible({
      name: "compression-provider",
      apiKey: config.apiKey || "not-needed",
      baseURL: config.baseUrl,
    });
  }

  /**
   * Count tokens in a string
   */
  countTokens(text: string): number {
    return encode(text).length;
  }

  /**
   * Compress text if it exceeds the token threshold
   */
  async compress(content: string): Promise<CompressionResult> {
    const logger = getLogger();
    const originalTokens = this.countTokens(content);

    // Don't compress if under threshold
    if (originalTokens <= this.config.tokenThreshold) {
      return {
        original: content,
        compressed: content,
        strategy: "default",
        originalTokens,
        compressedTokens: originalTokens,
        wasCompressed: false,
      };
    }

    const strategy = detectStrategy(content);
    logger.debug(
      `Compressing ${originalTokens} tokens using '${strategy}' strategy`
    );

    try {
      const prompt = getCompressionPrompt(
        strategy,
        content,
        this.config.maxOutputTokens
      );

      const { text } = await generateText({
        model: this.provider(this.config.model),
        prompt,
        maxTokens: this.config.maxOutputTokens,
      });

      const compressedTokens = this.countTokens(text);
      const ratio = ((1 - compressedTokens / originalTokens) * 100).toFixed(1);

      logger.info(
        `Compressed ${originalTokens} -> ${compressedTokens} tokens (${ratio}% reduction)`
      );

      return {
        original: content,
        compressed: text,
        strategy,
        originalTokens,
        compressedTokens,
        wasCompressed: true,
      };
    } catch (error) {
      logger.error("Compression failed, returning original:", error);
      return {
        original: content,
        compressed: content,
        strategy,
        originalTokens,
        compressedTokens: originalTokens,
        wasCompressed: false,
      };
    }
  }

  /**
   * Compress a tool result
   */
  async compressToolResult(result: CallToolResult): Promise<CallToolResult> {
    const logger = getLogger();

    // Extract text content
    const textContents = result.content.filter(
      (c): c is TextContent => c.type === "text"
    );

    if (textContents.length === 0) {
      return result;
    }

    // Combine all text for compression check
    const combinedText = textContents.map((c) => c.text).join("\n");
    const tokenCount = this.countTokens(combinedText);

    if (tokenCount <= this.config.tokenThreshold) {
      return result;
    }

    logger.debug(`Tool result has ${tokenCount} tokens, compressing...`);

    // Compress the combined text
    const compressed = await this.compress(combinedText);

    if (!compressed.wasCompressed) {
      return result;
    }

    // Replace text content with compressed version
    const newContent = result.content.map((c) => {
      if (c.type === "text") {
        return {
          type: "text" as const,
          text: compressed.compressed,
        };
      }
      return c;
    });

    // Only keep the first text content (now compressed)
    const seenText = new Set<string>();
    const dedupedContent = newContent.filter((c) => {
      if (c.type === "text") {
        if (seenText.has("text")) return false;
        seenText.add("text");
      }
      return true;
    });

    return {
      ...result,
      content: dedupedContent,
    };
  }

  /**
   * Compress a resource read result
   */
  async compressResourceResult(
    result: ReadResourceResult
  ): Promise<ReadResourceResult> {
    const logger = getLogger();

    const newContents = await Promise.all(
      result.contents.map(async (content) => {
        if ("text" in content && typeof content.text === "string") {
          const tokenCount = this.countTokens(content.text);

          if (tokenCount <= this.config.tokenThreshold) {
            return content;
          }

          logger.debug(`Resource content has ${tokenCount} tokens, compressing...`);
          const compressed = await this.compress(content.text);

          if (!compressed.wasCompressed) {
            return content;
          }

          return {
            ...content,
            text: compressed.compressed,
          };
        }
        return content;
      })
    );

    return {
      ...result,
      contents: newContents,
    };
  }
}

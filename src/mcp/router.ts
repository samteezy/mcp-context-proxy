import type {
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Aggregator } from "./aggregator.js";
import { getLogger } from "../logger.js";

/**
 * Routes requests to the correct upstream server
 */
export class Router {
  private aggregator: Aggregator;

  constructor(aggregator: Aggregator) {
    this.aggregator = aggregator;
  }

  /**
   * Route a tool call to the correct upstream
   */
  async callTool(
    namespacedName: string,
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    const logger = getLogger();
    const routing = this.aggregator.findTool(namespacedName);

    if (!routing) {
      logger.error(`Tool not found: ${namespacedName}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: Tool '${namespacedName}' not found`,
          },
        ],
        isError: true,
      };
    }

    const { client, originalName } = routing;
    logger.debug(
      `Routing tool call '${namespacedName}' to upstream '${client.id}' as '${originalName}'`
    );

    try {
      return await client.callTool(originalName, args);
    } catch (error) {
      logger.error(`Error calling tool '${originalName}' on '${client.id}':`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error calling tool: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Route a resource read to the correct upstream
   */
  async readResource(namespacedUri: string): Promise<ReadResourceResult> {
    const logger = getLogger();
    const routing = this.aggregator.findResource(namespacedUri);

    if (!routing) {
      logger.error(`Resource not found: ${namespacedUri}`);
      throw new Error(`Resource '${namespacedUri}' not found`);
    }

    const { client, originalUri } = routing;
    logger.debug(
      `Routing resource read '${namespacedUri}' to upstream '${client.id}' as '${originalUri}'`
    );

    try {
      return await client.readResource(originalUri);
    } catch (error) {
      logger.error(`Error reading resource '${originalUri}' on '${client.id}':`, error);
      throw error;
    }
  }

  /**
   * Route a prompt get to the correct upstream
   */
  async getPrompt(
    namespacedName: string,
    args?: Record<string, string>
  ): Promise<GetPromptResult> {
    const logger = getLogger();
    const routing = this.aggregator.findPrompt(namespacedName);

    if (!routing) {
      logger.error(`Prompt not found: ${namespacedName}`);
      throw new Error(`Prompt '${namespacedName}' not found`);
    }

    const { client, originalName } = routing;
    logger.debug(
      `Routing prompt get '${namespacedName}' to upstream '${client.id}' as '${originalName}'`
    );

    try {
      return await client.getPrompt(originalName, args);
    } catch (error) {
      logger.error(`Error getting prompt '${originalName}' on '${client.id}':`, error);
      throw error;
    }
  }
}

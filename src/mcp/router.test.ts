import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "./router.js";
import type { Aggregator } from "./aggregator.js";
import type { Masker } from "../masking/index.js";
import type { UpstreamClient } from "./client.js";
import type {
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
} from "@modelcontextprotocol/sdk/types.js";

describe("Router", () => {
  let mockAggregator: Partial<Aggregator>;
  let mockClient: Partial<UpstreamClient>;

  beforeEach(() => {
    // Mock upstream client
    mockClient = {
      id: "test-upstream",
      callTool: vi.fn(),
      readResource: vi.fn(),
      getPrompt: vi.fn(),
    };

    // Mock aggregator
    mockAggregator = {
      findTool: vi.fn(),
      findResource: vi.fn(),
      findPrompt: vi.fn(),
      isToolHidden: vi.fn().mockReturnValue(false),
      getParameterOverrides: vi.fn().mockReturnValue({}),
    };
  });

  describe("callTool", () => {
    describe("goal and bypass extraction", () => {
      it("should extract goal from _mcpcp_goal field", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "value1",
          _mcpcp_goal: "Find specific information",
        });

        expect(result.goal).toBe("Find specific information");
        expect(result.result).toEqual(toolResult);

        // Verify goal was stripped from forwarded args
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "value1",
        });
      });

      it("should extract bypass from _mcpcp_bypass field", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "value1",
          _mcpcp_bypass: true,
        });

        expect(result.bypass).toBe(true);
        expect(result.result).toEqual(toolResult);

        // Verify bypass was stripped from forwarded args
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "value1",
        });
      });

      it("should extract both goal and bypass", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "value1",
          _mcpcp_goal: "Search for X",
          _mcpcp_bypass: true,
        });

        expect(result.goal).toBe("Search for X");
        expect(result.bypass).toBe(true);
        expect(result.result).toEqual(toolResult);

        // Verify both were stripped
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "value1",
        });
      });

      it("should handle missing goal field", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "value1",
        });

        expect(result.goal).toBeUndefined();
        expect(result.bypass).toBe(false);
      });

      it("should handle non-string goal field", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "value1",
          _mcpcp_goal: 123, // non-string
        });

        expect(result.goal).toBeUndefined();

        // Should still strip the field even if invalid
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "value1",
        });
      });

      it("should handle non-boolean bypass field", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "value1",
          _mcpcp_bypass: "yes", // non-boolean
        });

        expect(result.bypass).toBe(false);

        // Should still strip the field
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "value1",
        });
      });
    });

    describe("parameter overrides", () => {
      it("should apply parameter overrides", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockAggregator.getParameterOverrides!).mockReturnValue({
          max_length: 5000,
          format: "json",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        await router.callTool("test__tool", {
          arg1: "value1",
        });

        // Verify overrides were applied
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "value1",
          max_length: 5000,
          format: "json",
        });
      });

      it("should override existing parameter values", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockAggregator.getParameterOverrides!).mockReturnValue({
          max_length: 1000,
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        await router.callTool("test__tool", {
          arg1: "value1",
          max_length: 5000, // Should be overridden
        });

        // Verify override took precedence
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "value1",
          max_length: 1000,
        });
      });

      it("should not modify args when no overrides", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockAggregator.getParameterOverrides!).mockReturnValue({});
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        await router.callTool("test__tool", {
          arg1: "value1",
          arg2: "value2",
        });

        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "value1",
          arg2: "value2",
        });
      });
    });

    describe("PII masking integration", () => {
      it("should apply PII masking when masker is enabled", async () => {
        const mockMasker: Partial<Masker> = {
          isEnabled: vi.fn().mockReturnValue(true),
          maskToolArgs: vi.fn().mockResolvedValue({
            masked: { arg1: "MASKED_VALUE" },
            wasMasked: true,
            maskedFields: [
              {
                path: "arg1",
                originalValue: "sensitive@email.com",
                placeholder: "MASKED_VALUE",
                piiType: "email",
                detectionMethod: "pattern",
              },
            ],
            restorationMap: new Map([["MASKED_VALUE", "sensitive@email.com"]]),
          }),
        };

        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator, mockMasker as Masker);

        const result = await router.callTool("test__tool", {
          arg1: "sensitive@email.com",
        });

        // Verify masking was called
        expect(mockMasker.maskToolArgs).toHaveBeenCalledWith(
          { arg1: "sensitive@email.com" },
          "test__tool"
        );

        // Verify masked args were forwarded
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "MASKED_VALUE",
        });

        // Verify restoration map was returned
        expect(result.restorationMap).toBeDefined();
        expect(result.restorationMap?.get("MASKED_VALUE")).toBe("sensitive@email.com");
      });

      it("should skip masking when masker is disabled", async () => {
        const mockMasker: Partial<Masker> = {
          isEnabled: vi.fn().mockReturnValue(false),
          maskToolArgs: vi.fn(),
        };

        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator, mockMasker as Masker);

        await router.callTool("test__tool", {
          arg1: "sensitive@email.com",
        });

        // Verify masking was NOT called
        expect(mockMasker.maskToolArgs).not.toHaveBeenCalled();

        // Verify original args were forwarded
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "sensitive@email.com",
        });
      });

      it("should skip masking when no masker provided", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "sensitive@email.com",
        });

        // Verify original args were forwarded
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool", {
          arg1: "sensitive@email.com",
        });

        // No restoration map
        expect(result.restorationMap).toBeUndefined();
      });

      it("should not include restoration map when nothing was masked", async () => {
        const mockMasker: Partial<Masker> = {
          isEnabled: vi.fn().mockReturnValue(true),
          maskToolArgs: vi.fn().mockResolvedValue({
            masked: { arg1: "normal-value" },
            wasMasked: false,
            maskedFields: [],
            restorationMap: new Map(),
          }),
        };

        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator, mockMasker as Masker);

        const result = await router.callTool("test__tool", {
          arg1: "normal-value",
        });

        expect(result.restorationMap).toBeUndefined();
      });
    });

    describe("hidden tool rejection", () => {
      it("should reject call to hidden tool", async () => {
        vi.mocked(mockAggregator.isToolHidden!).mockReturnValue(true);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__hidden-tool", {
          arg1: "value1",
        });

        expect(result.result.isError).toBe(true);
        expect(result.result.content).toEqual([
          { type: "text", text: "Error: Tool 'test__hidden-tool' not found" },
        ]);

        // Should not call findTool or attempt to route
        expect(mockAggregator.findTool).not.toHaveBeenCalled();
        expect(mockClient.callTool).not.toHaveBeenCalled();
      });

      it("should preserve goal and bypass in error result for hidden tool", async () => {
        vi.mocked(mockAggregator.isToolHidden!).mockReturnValue(true);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__hidden-tool", {
          arg1: "value1",
          _mcpcp_goal: "Find something",
          _mcpcp_bypass: true,
        });

        expect(result.result.isError).toBe(true);
        expect(result.goal).toBe("Find something");
        expect(result.bypass).toBe(true);
      });

      it("should preserve restoration map in error result for hidden tool", async () => {
        const mockMasker: Partial<Masker> = {
          isEnabled: vi.fn().mockReturnValue(true),
          maskToolArgs: vi.fn().mockResolvedValue({
            masked: { arg1: "MASKED" },
            wasMasked: true,
            maskedFields: [],
            restorationMap: new Map([["MASKED", "original"]]),
          }),
        };

        vi.mocked(mockAggregator.isToolHidden!).mockReturnValue(true);

        const router = new Router(mockAggregator as Aggregator, mockMasker as Masker);

        const result = await router.callTool("test__hidden-tool", {
          arg1: "original",
        });

        expect(result.result.isError).toBe(true);
        expect(result.restorationMap).toBeDefined();
        expect(result.restorationMap?.get("MASKED")).toBe("original");
      });
    });

    describe("tool routing", () => {
      it("should route tool call to correct upstream", async () => {
        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Success from upstream" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool-name",
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("server1__namespaced-tool", {
          arg1: "value1",
        });

        // Verify findTool was called with namespaced name
        expect(mockAggregator.findTool).toHaveBeenCalledWith("server1__namespaced-tool");

        // Verify client was called with original name
        expect(mockClient.callTool).toHaveBeenCalledWith("original-tool-name", {
          arg1: "value1",
        });

        expect(result.result).toEqual(toolResult);
      });

      it("should handle tool not found", async () => {
        vi.mocked(mockAggregator.findTool!).mockReturnValue(null);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("nonexistent__tool", {
          arg1: "value1",
        });

        expect(result.result.isError).toBe(true);
        expect(result.result.content).toEqual([
          { type: "text", text: "Error: Tool 'nonexistent__tool' not found" },
        ]);

        expect(mockClient.callTool).not.toHaveBeenCalled();
      });

      it("should preserve goal/bypass when tool not found", async () => {
        vi.mocked(mockAggregator.findTool!).mockReturnValue(null);

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("nonexistent__tool", {
          _mcpcp_goal: "Search",
          _mcpcp_bypass: true,
        });

        expect(result.result.isError).toBe(true);
        expect(result.goal).toBe("Search");
        expect(result.bypass).toBe(true);
      });
    });

    describe("error handling", () => {
      it("should handle tool call error", async () => {
        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockRejectedValue(
          new Error("Connection timeout")
        );

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "value1",
        });

        expect(result.result.isError).toBe(true);
        expect(result.result.content).toEqual([
          { type: "text", text: "Error calling tool: Connection timeout" },
        ]);
      });

      it("should handle non-Error exceptions", async () => {
        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockRejectedValue("String error");

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          arg1: "value1",
        });

        expect(result.result.isError).toBe(true);
        expect(result.result.content).toEqual([
          { type: "text", text: "Error calling tool: String error" },
        ]);
      });

      it("should preserve goal/bypass in error result", async () => {
        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockRejectedValue(new Error("Failed"));

        const router = new Router(mockAggregator as Aggregator);

        const result = await router.callTool("test__tool", {
          _mcpcp_goal: "Find data",
          _mcpcp_bypass: true,
        });

        expect(result.result.isError).toBe(true);
        expect(result.goal).toBe("Find data");
        expect(result.bypass).toBe(true);
      });

      it("should preserve restoration map in error result", async () => {
        const mockMasker: Partial<Masker> = {
          isEnabled: vi.fn().mockReturnValue(true),
          maskToolArgs: vi.fn().mockResolvedValue({
            masked: { arg1: "MASKED" },
            wasMasked: true,
            maskedFields: [],
            restorationMap: new Map([["MASKED", "original"]]),
          }),
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "original-tool",
        });
        vi.mocked(mockClient.callTool!).mockRejectedValue(new Error("Failed"));

        const router = new Router(mockAggregator as Aggregator, mockMasker as Masker);

        const result = await router.callTool("test__tool", {
          arg1: "original",
        });

        expect(result.result.isError).toBe(true);
        expect(result.restorationMap).toBeDefined();
        expect(result.restorationMap?.get("MASKED")).toBe("original");
      });
    });

    describe("full integration", () => {
      it("should handle complete flow with all features", async () => {
        const mockMasker: Partial<Masker> = {
          isEnabled: vi.fn().mockReturnValue(true),
          maskToolArgs: vi.fn().mockResolvedValue({
            masked: { email: "EMAIL_1", query: "test", max_results: 10 },
            wasMasked: true,
            maskedFields: [],
            restorationMap: new Map([["EMAIL_1", "user@example.com"]]),
          }),
        };

        const toolResult: CallToolResult = {
          content: [{ type: "text", text: "Found user data for EMAIL_1" }],
        };

        vi.mocked(mockAggregator.findTool!).mockReturnValue({
          client: mockClient as UpstreamClient,
          originalName: "search",
        });
        vi.mocked(mockAggregator.getParameterOverrides!).mockReturnValue({
          max_results: 10,
        });
        vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

        const router = new Router(mockAggregator as Aggregator, mockMasker as Masker);

        const result = await router.callTool("db__search-users", {
          email: "user@example.com",
          query: "test",
          _mcpcp_goal: "Find user details",
          _mcpcp_bypass: true,
        });

        // Verify masking was applied (after overrides were applied)
        expect(mockMasker.maskToolArgs).toHaveBeenCalledWith(
          { email: "user@example.com", query: "test", max_results: 10 },
          "db__search-users"
        );

        // Verify final call included overrides and masked values
        expect(mockClient.callTool).toHaveBeenCalledWith("search", {
          email: "EMAIL_1",
          query: "test",
          max_results: 10,
        });

        // Verify result includes all metadata
        expect(result.result).toEqual(toolResult);
        expect(result.goal).toBe("Find user details");
        expect(result.bypass).toBe(true);
        expect(result.restorationMap?.get("EMAIL_1")).toBe("user@example.com");
      });
    });
  });

  describe("readResource", () => {
    it("should route resource read to correct upstream", async () => {
      const resourceResult: ReadResourceResult = {
        contents: [{ uri: "file:///test.txt", text: "Content here" }],
      };

      vi.mocked(mockAggregator.findResource!).mockReturnValue({
        client: mockClient as UpstreamClient,
        originalUri: "file:///test.txt",
      });
      vi.mocked(mockClient.readResource!).mockResolvedValue(resourceResult);

      const router = new Router(mockAggregator as Aggregator);

      const result = await router.readResource("server1://file:///test.txt");

      // Verify findResource was called with namespaced URI
      expect(mockAggregator.findResource).toHaveBeenCalledWith("server1://file:///test.txt");

      // Verify client was called with original URI
      expect(mockClient.readResource).toHaveBeenCalledWith("file:///test.txt");

      expect(result).toEqual(resourceResult);
    });

    it("should throw error when resource not found", async () => {
      vi.mocked(mockAggregator.findResource!).mockReturnValue(null);

      const router = new Router(mockAggregator as Aggregator);

      await expect(router.readResource("server1://nonexistent")).rejects.toThrow(
        "Resource 'server1://nonexistent' not found"
      );

      expect(mockClient.readResource).not.toHaveBeenCalled();
    });

    it("should propagate error from upstream", async () => {
      vi.mocked(mockAggregator.findResource!).mockReturnValue({
        client: mockClient as UpstreamClient,
        originalUri: "file:///test.txt",
      });
      vi.mocked(mockClient.readResource!).mockRejectedValue(
        new Error("File not found")
      );

      const router = new Router(mockAggregator as Aggregator);

      await expect(router.readResource("server1://file:///test.txt")).rejects.toThrow(
        "File not found"
      );
    });
  });

  describe("getPrompt", () => {
    it("should route prompt get to correct upstream", async () => {
      const promptResult: GetPromptResult = {
        description: "Test prompt",
        messages: [
          {
            role: "user",
            content: { type: "text", text: "Hello" },
          },
        ],
      };

      vi.mocked(mockAggregator.findPrompt!).mockReturnValue({
        client: mockClient as UpstreamClient,
        originalName: "greeting",
      });
      vi.mocked(mockClient.getPrompt!).mockResolvedValue(promptResult);

      const router = new Router(mockAggregator as Aggregator);

      const result = await router.getPrompt("server1__greeting-prompt", {
        name: "User",
      });

      // Verify findPrompt was called with namespaced name
      expect(mockAggregator.findPrompt).toHaveBeenCalledWith("server1__greeting-prompt");

      // Verify client was called with original name and args
      expect(mockClient.getPrompt).toHaveBeenCalledWith("greeting", {
        name: "User",
      });

      expect(result).toEqual(promptResult);
    });

    it("should route prompt get without arguments", async () => {
      const promptResult: GetPromptResult = {
        description: "Simple prompt",
        messages: [
          {
            role: "user",
            content: { type: "text", text: "Static message" },
          },
        ],
      };

      vi.mocked(mockAggregator.findPrompt!).mockReturnValue({
        client: mockClient as UpstreamClient,
        originalName: "simple",
      });
      vi.mocked(mockClient.getPrompt!).mockResolvedValue(promptResult);

      const router = new Router(mockAggregator as Aggregator);

      const result = await router.getPrompt("server1__simple");

      expect(mockClient.getPrompt).toHaveBeenCalledWith("simple", undefined);
      expect(result).toEqual(promptResult);
    });

    it("should throw error when prompt not found", async () => {
      vi.mocked(mockAggregator.findPrompt!).mockReturnValue(null);

      const router = new Router(mockAggregator as Aggregator);

      await expect(router.getPrompt("server1__nonexistent")).rejects.toThrow(
        "Prompt 'server1__nonexistent' not found"
      );

      expect(mockClient.getPrompt).not.toHaveBeenCalled();
    });

    it("should propagate error from upstream", async () => {
      vi.mocked(mockAggregator.findPrompt!).mockReturnValue({
        client: mockClient as UpstreamClient,
        originalName: "failing-prompt",
      });
      vi.mocked(mockClient.getPrompt!).mockRejectedValue(
        new Error("Prompt rendering failed")
      );

      const router = new Router(mockAggregator as Aggregator);

      await expect(router.getPrompt("server1__failing-prompt")).rejects.toThrow(
        "Prompt rendering failed"
      );
    });
  });

  describe("setMasker", () => {
    it("should update masker instance", async () => {
      const mockMasker1: Partial<Masker> = {
        isEnabled: vi.fn().mockReturnValue(true),
        maskToolArgs: vi.fn().mockResolvedValue({
          masked: { arg1: "MASKED_1" },
          wasMasked: true,
          maskedFields: [],
          restorationMap: new Map([["MASKED_1", "value1"]]),
        }),
      };

      const mockMasker2: Partial<Masker> = {
        isEnabled: vi.fn().mockReturnValue(true),
        maskToolArgs: vi.fn().mockResolvedValue({
          masked: { arg1: "MASKED_2" },
          wasMasked: true,
          maskedFields: [],
          restorationMap: new Map([["MASKED_2", "value1"]]),
        }),
      };

      const toolResult: CallToolResult = {
        content: [{ type: "text", text: "Success" }],
      };

      vi.mocked(mockAggregator.findTool!).mockReturnValue({
        client: mockClient as UpstreamClient,
        originalName: "test",
      });
      vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

      const router = new Router(mockAggregator as Aggregator, mockMasker1 as Masker);

      // Call with first masker
      await router.callTool("test__tool", { arg1: "value1" });
      expect(mockMasker1.maskToolArgs).toHaveBeenCalled();
      expect(mockMasker2.maskToolArgs).not.toHaveBeenCalled();

      // Update masker
      router.setMasker(mockMasker2 as Masker);

      // Call with second masker
      await router.callTool("test__tool", { arg1: "value1" });
      expect(mockMasker2.maskToolArgs).toHaveBeenCalled();
    });

    it("should remove masker when set to undefined", async () => {
      const mockMasker: Partial<Masker> = {
        isEnabled: vi.fn().mockReturnValue(true),
        maskToolArgs: vi.fn().mockResolvedValue({
          masked: { arg1: "MASKED" },
          wasMasked: true,
          maskedFields: [],
          restorationMap: new Map(),
        }),
      };

      const toolResult: CallToolResult = {
        content: [{ type: "text", text: "Success" }],
      };

      vi.mocked(mockAggregator.findTool!).mockReturnValue({
        client: mockClient as UpstreamClient,
        originalName: "test",
      });
      vi.mocked(mockClient.callTool!).mockResolvedValue(toolResult);

      const router = new Router(mockAggregator as Aggregator, mockMasker as Masker);

      // Remove masker
      router.setMasker(undefined);

      // Call should not use masker
      await router.callTool("test__tool", { arg1: "value1" });
      expect(mockMasker.maskToolArgs).not.toHaveBeenCalled();
    });
  });

  describe("static constants", () => {
    it("should expose GOAL_FIELD constant", () => {
      expect(Router.GOAL_FIELD).toBe("_mcpcp_goal");
    });

    it("should expose BYPASS_FIELD constant", () => {
      expect(Router.BYPASS_FIELD).toBe("_mcpcp_bypass");
    });
  });
});

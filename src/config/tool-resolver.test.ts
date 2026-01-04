import { describe, it, expect } from "vitest";
import { ToolConfigResolver } from "./tool-resolver.js";
import { createTestConfig, createTestCompressionConfig } from "../test/helpers.js";
import type { UpstreamServerConfig } from "../types.js";

describe("ToolConfigResolver - Parameter Hiding and Overrides", () => {
  it("should return empty array when no hideParameters configured", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const hidden = resolver.getHiddenParameters("test__mytool");
    expect(hidden).toEqual([]);
  });

  it("should return configured hidden parameters", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          fetch: {
            hideParameters: ["max_length"],
            parameterOverrides: { max_length: 50000 },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const hidden = resolver.getHiddenParameters("test__fetch");
    expect(hidden).toEqual(["max_length"]);
  });

  it("should return empty object when no overrides configured", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const overrides = resolver.getParameterOverrides("test__mytool");
    expect(overrides).toEqual({});
  });

  it("should return configured parameter overrides", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          fetch: {
            parameterOverrides: { max_length: 50000 },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const overrides = resolver.getParameterOverrides("test__fetch");
    expect(overrides).toEqual({ max_length: 50000 });
  });

  it("should handle multiple hidden parameters", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          api: {
            hideParameters: ["timeout", "retry_count"],
            parameterOverrides: { timeout: 30, retry_count: 3 },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const hidden = resolver.getHiddenParameters("test__api");
    expect(hidden).toEqual(["timeout", "retry_count"]);
  });

  it("should handle complex parameter override values", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          api: {
            parameterOverrides: {
              headers: { "User-Agent": "MCPCP/1.0" },
              exclude_dirs: [".git", "node_modules"],
              timeout: 30,
              enabled: true,
            },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const overrides = resolver.getParameterOverrides("test__api");
    expect(overrides).toEqual({
      headers: { "User-Agent": "MCPCP/1.0" },
      exclude_dirs: [".git", "node_modules"],
      timeout: 30,
      enabled: true,
    });
  });

  it("should return empty array for non-existent tool", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {},
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const hidden = resolver.getHiddenParameters("test__nonexistent");
    expect(hidden).toEqual([]);
  });

  it("should return empty object for non-existent tool", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {},
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const overrides = resolver.getParameterOverrides("test__nonexistent");
    expect(overrides).toEqual({});
  });

  it("should handle multiple upstreams with different configs", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "upstream1",
        name: "Upstream 1",
        transport: "stdio",
        command: "echo",
        tools: {
          fetch: {
            hideParameters: ["max_length"],
            parameterOverrides: { max_length: 50000 },
          },
        },
      },
      {
        id: "upstream2",
        name: "Upstream 2",
        transport: "stdio",
        command: "echo",
        tools: {
          search: {
            hideParameters: ["limit"],
            parameterOverrides: { limit: 100 },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    expect(resolver.getHiddenParameters("upstream1__fetch")).toEqual([
      "max_length",
    ]);
    expect(resolver.getParameterOverrides("upstream1__fetch")).toEqual({
      max_length: 50000,
    });

    expect(resolver.getHiddenParameters("upstream2__search")).toEqual(["limit"]);
    expect(resolver.getParameterOverrides("upstream2__search")).toEqual({
      limit: 100,
    });
  });
});

describe("ToolConfigResolver - Compression Policy Resolution", () => {
  it("should return global default policy when no overrides", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const policy = resolver.resolveCompressionPolicy("test__mytool");
    expect(policy.enabled).toBe(true);
    expect(policy.tokenThreshold).toBe(1000);
  });

  it("should use tool-level compression override", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {
            compression: {
              enabled: false,
              tokenThreshold: 500,
            },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const policy = resolver.resolveCompressionPolicy("test__mytool");
    expect(policy.enabled).toBe(false);
    expect(policy.tokenThreshold).toBe(500);
  });

  it("should merge tool compression with global defaults", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {
            compression: {
              tokenThreshold: 2000, // Override threshold only
            },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const policy = resolver.resolveCompressionPolicy("test__mytool");
    expect(policy.enabled).toBe(true); // From global default
    expect(policy.tokenThreshold).toBe(2000); // From tool override
  });

  it("should handle maxOutputTokens override", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {
            compression: {
              maxOutputTokens: 250,
            },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const policy = resolver.resolveCompressionPolicy("test__mytool");
    expect(policy.maxOutputTokens).toBe(250);
  });

  it("should handle customInstructions", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {
            compression: {
              customInstructions: "Focus on errors",
            },
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const policy = resolver.resolveCompressionPolicy("test__mytool");
    expect(policy.customInstructions).toBe("Focus on errors");
  });
});

describe("ToolConfigResolver - Masking Policy Resolution", () => {
  it("should return default when no masking configured", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const config = createTestConfig({ upstreams });
    // No masking config
    const resolver = new ToolConfigResolver(config);

    const policy = resolver.resolveMaskingPolicy("test__mytool");
    expect(policy.enabled).toBe(false); // Default when no config
  });

  it("should use global masking policy", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const config = createTestConfig({ upstreams });
    config.masking = {
      enabled: true,
      defaultPolicy: {
        enabled: true,
        piiTypes: ["email", "ssn"],
        llmFallback: false,
        llmFallbackThreshold: "low",
      },
    };
    const resolver = new ToolConfigResolver(config);

    const policy = resolver.resolveMaskingPolicy("test__mytool");
    expect(policy.enabled).toBe(true);
    expect(policy.piiTypes).toEqual(["email", "ssn"]);
  });

  it("should use tool-level masking override", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {
            masking: {
              enabled: false,
            },
          },
        },
      },
    ];
    const config = createTestConfig({ upstreams });
    config.masking = {
      enabled: true,
      defaultPolicy: {
        enabled: true,
        piiTypes: ["email"],
        llmFallback: false,
        llmFallbackThreshold: "low",
      },
    };
    const resolver = new ToolConfigResolver(config);

    const policy = resolver.resolveMaskingPolicy("test__mytool");
    expect(policy.enabled).toBe(false);
  });

  it("should merge tool masking with global defaults", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {
            masking: {
              piiTypes: ["phone"], // Override only piiTypes
            },
          },
        },
      },
    ];
    const config = createTestConfig({ upstreams });
    config.masking = {
      enabled: true,
      defaultPolicy: {
        enabled: true,
        piiTypes: ["email", "ssn"],
        llmFallback: true,
        llmFallbackThreshold: "medium",
      },
    };
    const resolver = new ToolConfigResolver(config);

    const policy = resolver.resolveMaskingPolicy("test__mytool");
    expect(policy.enabled).toBe(true); // From global
    expect(policy.piiTypes).toEqual(["phone"]); // From tool override
    expect(policy.llmFallback).toBe(true); // From global
  });
});

describe("ToolConfigResolver - Tool Visibility", () => {
  it("should return false when tool not hidden", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: { hidden: false },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    expect(resolver.isToolHidden("test__mytool")).toBe(false);
  });

  it("should return true when tool is hidden", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          dangerous_tool: { hidden: true },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    expect(resolver.isToolHidden("test__dangerous_tool")).toBe(true);
  });

  it("should return false for non-existent tool", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {},
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    expect(resolver.isToolHidden("test__nonexistent")).toBe(false);
  });
});

describe("ToolConfigResolver - Description Override", () => {
  it("should return undefined when no override", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    expect(resolver.getDescriptionOverride("test__mytool")).toBeUndefined();
  });

  it("should return custom description when configured", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          fetch: {
            overwriteDescription: "Custom fetch description",
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    expect(resolver.getDescriptionOverride("test__fetch")).toBe(
      "Custom fetch description"
    );
  });
});

describe("ToolConfigResolver - Cache TTL (via getToolConfig)", () => {
  it("should return undefined when no cacheTtl configured", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const config = resolver.getToolConfig("test__mytool");
    expect(config?.cacheTtl).toBeUndefined();
  });

  it("should return custom cacheTtl when configured", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {
            cacheTtl: 300,
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const config = resolver.getToolConfig("test__mytool");
    expect(config?.cacheTtl).toBe(300);
  });

  it("should handle cacheTtl of 0 (no caching)", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          realtime_tool: {
            cacheTtl: 0,
          },
        },
      },
    ];
    const resolver = new ToolConfigResolver(createTestConfig({ upstreams }));

    const config = resolver.getToolConfig("test__realtime_tool");
    expect(config?.cacheTtl).toBe(0);
  });
});

describe("ToolConfigResolver - Retry Escalation", () => {
  it("should return retry escalation config from global", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const config = createTestConfig({ upstreams });
    config.compression.retryEscalation = {
      enabled: true,
      windowSeconds: 120,
      tokenMultiplier: 3,
    };
    const resolver = new ToolConfigResolver(config);

    const retryConfig = resolver.getRetryEscalation();
    expect(retryConfig?.enabled).toBe(true);
    expect(retryConfig?.windowSeconds).toBe(120);
    expect(retryConfig?.tokenMultiplier).toBe(3);
  });

  it("should return undefined when not configured", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {},
      },
    ];
    const config = createTestConfig({
      upstreams,
      compression: {
        ...createTestCompressionConfig(),
        retryEscalation: undefined // No retryEscalation config
      }
    });
    const resolver = new ToolConfigResolver(config);

    expect(resolver.getRetryEscalation()).toBeUndefined();
  });
});

describe("ToolConfigResolver - Goal Aware", () => {
  it("should return global goalAware setting by default", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {},
        },
      },
    ];
    const config = createTestConfig({ upstreams });
    config.compression.goalAware = true;
    const resolver = new ToolConfigResolver(config);

    expect(resolver.isGoalAwareEnabled("test__mytool")).toBe(true);
  });

  it("should use tool-level goalAware override", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {
          mytool: {
            compression: {
              goalAware: false,
            },
          },
        },
      },
    ];
    const config = createTestConfig({ upstreams });
    config.compression.goalAware = true;
    const resolver = new ToolConfigResolver(config);

    expect(resolver.isGoalAwareEnabled("test__mytool")).toBe(false);
  });
});

describe("ToolConfigResolver - Bypass Enabled", () => {
  it("should return global bypass setting", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {},
      },
    ];
    const config = createTestConfig({ upstreams });
    config.compression.bypassEnabled = true;
    const resolver = new ToolConfigResolver(config);

    expect(resolver.isBypassEnabled()).toBe(true);
  });

  it("should return false when not configured", () => {
    const upstreams: UpstreamServerConfig[] = [
      {
        id: "test",
        name: "Test",
        transport: "stdio",
        command: "echo",
        tools: {},
      },
    ];
    const config = createTestConfig({ upstreams });
    config.compression.bypassEnabled = false;
    const resolver = new ToolConfigResolver(config);

    expect(resolver.isBypassEnabled()).toBe(false);
  });
});

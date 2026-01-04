import { describe, it, expect } from "vitest";
import { detectStrategy, getCompressionPrompt } from "./strategy.js";

describe("detectStrategy", () => {
  describe("JSON detection", () => {
    it("should detect valid JSON object", () => {
      const content = '{"key": "value", "number": 42}';
      expect(detectStrategy(content)).toBe("json");
    });

    it("should detect valid JSON array", () => {
      const content = '[1, 2, 3, "test"]';
      expect(detectStrategy(content)).toBe("json");
    });

    it("should detect nested JSON", () => {
      const content = '{"user": {"name": "test", "age": 25}, "items": [1, 2, 3]}';
      expect(detectStrategy(content)).toBe("json");
    });

    it("should detect pretty-printed JSON", () => {
      const content = `{
  "key": "value",
  "nested": {
    "data": true
  }
}`;
      expect(detectStrategy(content)).toBe("json");
    });

    it("should return default for malformed JSON", () => {
      const content = '{"key": "value"'; // Missing closing brace
      expect(detectStrategy(content)).toBe("default");
    });

    it("should return default for JSON-like but invalid content", () => {
      const content = '{this is not json}';
      expect(detectStrategy(content)).toBe("default");
    });
  });

  describe("code detection", () => {
    it("should detect JavaScript function declaration", () => {
      const content = `
function testFunction(arg) {
  return arg + 1;
}
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect const arrow function", () => {
      const content = `
const myFunc = (x) => {
  return x * 2;
};
const another = () => {};
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect Python function", () => {
      const content = `
def calculate(x, y):
    return x + y

class MyClass:
    def __init__(self):
        pass
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect class declaration", () => {
      const content = `
class MyClass {
  constructor() {
    this.value = 0;
  }
}
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect ES6 import/export", () => {
      const content = `
import { something } from 'module';
export default function test() {}
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect TypeScript with type annotations", () => {
      const content = `
function add(a: number, b: number): number {
  return a + b;
}
const name: string = "test";
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect code with braces and semicolons", () => {
      const content = `
function process(data) {
  if (condition) {
    doSomething();
  }
  for (let i = 0; i < 10; i++) {
    process(i);
  }
}
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect method chaining", () => {
      const content = `
const fetchData = async () => {
  const result = api
    .getData()
    .then(data => data.process())
    .catch(err => console.error(err));
  return result;
};
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect CommonJS require", () => {
      const content = `
const fs = require('fs');
const path = require('path');
module.exports = { test };
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should detect async functions", () => {
      const content = `
const fetchData = async (url) => {
  const response = await fetch(url);
  return response.json();
};
`;
      expect(detectStrategy(content)).toBe("code");
    });

    it("should require multiple code patterns (not just one)", () => {
      // Just one brace pattern - not enough
      const content = "This is a sentence with a {brace}.";
      expect(detectStrategy(content)).toBe("default");
    });
  });

  describe("default strategy fallback", () => {
    it("should return default for plain text", () => {
      const content = "This is just regular text with no special structure.";
      expect(detectStrategy(content)).toBe("default");
    });

    it("should return default for markdown", () => {
      const content = `# Heading

This is some markdown text with **bold** and *italic*.

- List item 1
- List item 2
`;
      expect(detectStrategy(content)).toBe("default");
    });

    it("should return default for mixed content without code patterns", () => {
      const content = "Some text here. And more text there. No code patterns.";
      expect(detectStrategy(content)).toBe("default");
    });

    it("should return default for empty string", () => {
      expect(detectStrategy("")).toBe("default");
    });
  });
});

describe("getCompressionPrompt", () => {
  describe("JSON strategy", () => {
    it("should generate prompt for JSON without goal", () => {
      const prompt = getCompressionPrompt("json", '{"test": "data"}', 500);

      expect(prompt).toContain('<document type="json">');
      expect(prompt).toContain('{"test": "data"}');
      expect(prompt).toContain("</document>");
      expect(prompt).toContain("Compress the JSON");
      expect(prompt).toContain("preserving structure");
      expect(prompt).toContain("under 500 tokens");
      expect(prompt).toContain("Output only the compressed JSON");
    });

    it("should generate goal-focused prompt for JSON", () => {
      const prompt = getCompressionPrompt(
        "json",
        '{"test": "data"}',
        500,
        "Find user information"
      );

      expect(prompt).toContain('<document type="json">');
      expect(prompt).toContain('<goal>');
      expect(prompt).toContain("Find user information");
      expect(prompt).toContain("</goal>");
      expect(prompt).toContain("Extract JSON data relevant to the goal");
      expect(prompt).toContain("CRITICAL: Extract only information");
      expect(prompt).toContain("Remove irrelevant keys");
    });
  });

  describe("code strategy", () => {
    it("should generate prompt for code without goal", () => {
      const code = "function test() { return 42; }";
      const prompt = getCompressionPrompt("code", code, 500);

      expect(prompt).toContain('<document type="code">');
      expect(prompt).toContain(code);
      expect(prompt).toContain("Summarize the code");
      expect(prompt).toContain("Function/class signatures");
      expect(prompt).toContain("Key logic and algorithms");
      expect(prompt).toContain("under 500 tokens");
      expect(prompt).toContain("Output only the summarized code");
    });

    it("should generate goal-focused prompt for code", () => {
      const code = "function test() { return 42; }";
      const prompt = getCompressionPrompt(
        "code",
        code,
        500,
        "Find authentication functions"
      );

      expect(prompt).toContain('<document type="code">');
      expect(prompt).toContain('<goal>');
      expect(prompt).toContain("Find authentication functions");
      expect(prompt).toContain("Extract code relevant to the goal");
      expect(prompt).toContain("CRITICAL: Extract only information");
      expect(prompt).toContain("Omit functions, classes, and sections unrelated");
    });
  });

  describe("default strategy", () => {
    it("should generate prompt for text without goal", () => {
      const text = "This is some plain text content.";
      const prompt = getCompressionPrompt("default", text, 500);

      expect(prompt).toContain("<document>");
      expect(prompt).toContain(text);
      expect(prompt).toContain("</document>");
      expect(prompt).toContain("Summarize the document");
      expect(prompt).toContain("preserving all important information");
      expect(prompt).toContain("under 500 tokens");
      expect(prompt).toContain("Output only the compressed text");
    });

    it("should generate goal-focused prompt for text", () => {
      const text = "This is some plain text content.";
      const prompt = getCompressionPrompt(
        "default",
        text,
        500,
        "Find pricing information"
      );

      expect(prompt).toContain("<document>");
      expect(prompt).toContain('<goal>');
      expect(prompt).toContain("Find pricing information");
      expect(prompt).toContain("Extract information from the document");
      expect(prompt).toContain("CRITICAL: Extract only information");
      expect(prompt).toContain("Omit tangential information");
    });
  });

  describe("maxTokens handling", () => {
    it("should include token limit when provided", () => {
      const prompt = getCompressionPrompt("default", "test", 250);
      expect(prompt).toContain("under 250 tokens");
    });

    it("should use generic message when maxTokens not provided", () => {
      const prompt = getCompressionPrompt("default", "test");
      expect(prompt).toContain("Be concise while retaining helpful details");
      expect(prompt).not.toContain("under");
      expect(prompt).not.toContain("tokens");
    });
  });

  describe("custom instructions", () => {
    it("should append custom instructions when provided", () => {
      const prompt = getCompressionPrompt(
        "default",
        "test",
        500,
        undefined,
        "Focus on technical details"
      );

      expect(prompt).toContain("ADDITIONAL INSTRUCTIONS:");
      expect(prompt).toContain("Focus on technical details");
    });

    it("should not include custom instructions block when not provided", () => {
      const prompt = getCompressionPrompt("default", "test", 500);
      expect(prompt).not.toContain("ADDITIONAL INSTRUCTIONS");
    });

    it("should include custom instructions in goal-focused prompts", () => {
      const prompt = getCompressionPrompt(
        "json",
        '{"test": "data"}',
        500,
        "Find user data",
        "Preserve timestamps"
      );

      expect(prompt).toContain("ADDITIONAL INSTRUCTIONS:");
      expect(prompt).toContain("Preserve timestamps");
    });
  });

  describe("goal parameter", () => {
    it("should generate different prompts with vs without goal", () => {
      const content = "test content";
      const withoutGoal = getCompressionPrompt("default", content, 500);
      const withGoal = getCompressionPrompt("default", content, 500, "test goal");

      expect(withoutGoal).not.toContain("<goal>");
      expect(withoutGoal).toContain("Summarize the document");

      expect(withGoal).toContain("<goal>");
      expect(withGoal).toContain("Extract information");
      expect(withGoal).toContain("CRITICAL");
    });

    it("should place goal at the end of prompt for recency bias", () => {
      const prompt = getCompressionPrompt(
        "default",
        "test",
        500,
        "Find specific data"
      );

      const goalIndex = prompt.indexOf("<goal>");
      const taskIndex = prompt.indexOf("<task>");

      // Goal should come after task in goal-focused prompts
      expect(goalIndex).toBeGreaterThan(taskIndex);
    });
  });

  describe("prompt structure", () => {
    it("should always have document section first", () => {
      const prompt = getCompressionPrompt("default", "test content", 500);
      expect(prompt.indexOf("<document>")).toBeLessThan(prompt.indexOf("<task>"));
    });

    it("should wrap content in appropriate document tags", () => {
      const jsonPrompt = getCompressionPrompt("json", "{}", 500);
      expect(jsonPrompt).toMatch(/<document type="json">/);

      const codePrompt = getCompressionPrompt("code", "code", 500);
      expect(codePrompt).toMatch(/<document type="code">/);

      const textPrompt = getCompressionPrompt("default", "text", 500);
      expect(textPrompt).toMatch(/<document>(?!.*type=)/); // No type attribute
    });
  });

  describe("edge cases", () => {
    it("should handle empty content", () => {
      const prompt = getCompressionPrompt("default", "", 500);
      expect(prompt).toContain("<document>");
      expect(prompt).toContain("</document>");
    });

    it("should handle very long content", () => {
      const longContent = "a".repeat(100000);
      const prompt = getCompressionPrompt("default", longContent, 500);
      expect(prompt).toContain(longContent);
    });

    it("should handle special characters in content", () => {
      const content = '<script>alert("xss")</script>';
      const prompt = getCompressionPrompt("default", content, 500);
      expect(prompt).toContain(content);
    });

    it("should handle special characters in goal", () => {
      const goal = 'Find items with "quotes" and <tags>';
      const prompt = getCompressionPrompt("default", "test", 500, goal);
      expect(prompt).toContain(goal);
    });

    it("should handle all parameters together", () => {
      const prompt = getCompressionPrompt(
        "code",
        "function test() {}",
        750,
        "Find functions",
        "Keep comments"
      );

      expect(prompt).toContain("function test()");
      expect(prompt).toContain("under 750 tokens");
      expect(prompt).toContain("Find functions");
      expect(prompt).toContain("Keep comments");
    });
  });
});

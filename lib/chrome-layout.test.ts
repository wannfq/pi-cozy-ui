import { describe, expect, it } from "vitest";
import { composeChrome } from "./chrome-layout.js";

describe("composeChrome", () => {
  const baseInput = {
    editorLines: ["──────────", "input text", "──────────"],
    width: 20,
    prefix: "┃  ",
    blankBar: "┃                   ",
    top: "┃                   ",
    status: "┃  status          ",
    branchRow: " ~/foo         main ",
  };

  it("replaces the top border with the blank top line", () => {
    const out = composeChrome(baseInput);
    expect(out[0]).toBe(baseInput.top);
  });

  it("replaces the bottom border with blank bar + status", () => {
    const out = composeChrome(baseInput);
    expect(out[2]).toBe(baseInput.blankBar);
    expect(out[3]).toBe(baseInput.status);
  });

  it("passes through lines after the bottom border unchanged (autocomplete)", () => {
    const input = {
      ...baseInput,
      editorLines: [
        "──────────",
        "input text",
        "──────────",
        "suggestion 1",
        "suggestion 2",
      ],
    };
    const out = composeChrome(input);
    expect(out[4]).toBe("suggestion 1");
    expect(out[5]).toBe("suggestion 2");
  });

  it("prefixes content lines with the bar + inset", () => {
    const out = composeChrome(baseInput);
    expect(out[1]).toBe("┃  input text");
  });

  it("appends blank bar + status + branch row when no border is found", () => {
    const input = {
      ...baseInput,
      editorLines: ["──────────", "input text"],
    };
    const out = composeChrome(input);
    expect(out[out.length - 3]).toBe(input.blankBar);
    expect(out[out.length - 2]).toBe(input.status);
    expect(out[out.length - 1]).toBe(input.branchRow);
  });

  it("truncates content lines to reclaim the prefix width", () => {
    const input = {
      ...baseInput,
      width: 10,
      editorLines: ["──────────", "very long input text", "──────────"],
      blankBar: "┃         ",
      top: "┃         ",
    };
    const out = composeChrome(input);
    expect(out[1].startsWith("┃  ")).toBe(true);
    // Truncation keeps the visible width within the requested width.
    expect(out[1].length).toBeLessThan("┃  very long input text".length);
  });
});

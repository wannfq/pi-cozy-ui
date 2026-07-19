import { describe, expect, it } from "vitest";
import { composeEditorLayout } from "./editor-layout.js";

describe("composeEditorLayout", () => {
	const baseInput = {
		editorLines: ["──────────", "input text", "──────────"],
		width: 20,
		prefix: "┃  ",
		blankBar: "┃                   ",
		status: "┃  status          ",
		footerRow: " ~/foo         main ",
	};

	it("removes the top border so input begins on the first row", () => {
		const out = composeEditorLayout(baseInput);
		expect(out[0]).toBe("┃  input text");
	});

	it("replaces the bottom border with blank bar + status", () => {
		const out = composeEditorLayout(baseInput);
		expect(out[1]).toBe(baseInput.blankBar);
		expect(out[2]).toBe(baseInput.status);
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
		const out = composeEditorLayout(input);
		expect(out[3]).toBe("suggestion 1");
		expect(out[4]).toBe("suggestion 2");
	});

	it("prefixes content lines with the bar + inset", () => {
		const out = composeEditorLayout(baseInput);
		expect(out[0]).toBe("┃  input text");
	});

	it("appends blank bar + status + branch row when no border is found", () => {
		const input = {
			...baseInput,
			editorLines: ["──────────", "input text"],
		};
		const out = composeEditorLayout(input);
		expect(out[out.length - 3]).toBe(input.blankBar);
		expect(out[out.length - 2]).toBe(input.status);
		expect(out[out.length - 1]).toBe(input.footerRow);
	});

	it("truncates content lines to reclaim the prefix width", () => {
		const input = {
			...baseInput,
			width: 10,
			editorLines: ["──────────", "very long input text", "──────────"],
			blankBar: "┃         ",
		};
		const out = composeEditorLayout(input);
		expect(out[1].startsWith("┃  ")).toBe(true);
		// Truncation keeps the visible width within the requested width.
		expect(out[1].length).toBeLessThan("┃  very long input text".length);
	});
});

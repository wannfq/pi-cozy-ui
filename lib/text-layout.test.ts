import { describe, expect, it } from "vitest";
import {
	buildFullWidthRow,
	center,
	formatCost,
	formatCwd,
	isBorderLine,
	statusLine,
	stripAnsi,
} from "./text-layout.js";

describe("statusLine", () => {
	it("places left and right with the minimum gap", () => {
		// Right already starts with a space, so the rendered gap is two spaces.
		expect(
			statusLine("┃  ", "session", " 50%/8k $0.12 model:low ", 35),
		).toBe("┃  session  50%/8k $0.12 model:low ");
	});

	it("trims the right side first when the line is too long", () => {
		// width 15, left 10, right 7. Right shrinks to 4 visible columns first.
		const line = statusLine("", "a".repeat(10), " right ", 15);
		const plain = stripAnsi(line);
		expect(plain.startsWith("a".repeat(10))).toBe(true);
		// The right string starts with a space, so the rendered gap is two spaces.
		expect(plain.endsWith("  rig")).toBe(true);
	});

	it("keeps a gap of at least one column", () => {
		const line = statusLine("", "left", "right", 10);
		expect(line).toBe("left right");
	});
});

describe("formatCwd", () => {
	it("collapses $HOME to ~", () => {
		const original = process.env.HOME;
		process.env.HOME = "/Users/test";
		expect(formatCwd("/Users/test/projects/foo")).toBe("~/projects/foo");
		process.env.HOME = original;
	});

	it("returns the path unchanged when it is not under $HOME", () => {
		const original = process.env.HOME;
		process.env.HOME = "/Users/test";
		expect(formatCwd("/var/log")).toBe("/var/log");
		process.env.HOME = original;
	});

	it("does not blow up when HOME is unset", () => {
		const original = process.env.HOME;
		delete process.env.HOME;
		expect(formatCwd("/var/log")).toBe("/var/log");
		process.env.HOME = original;
	});
});

describe("stripAnsi", () => {
	it("removes SGR sequences", () => {
		expect(stripAnsi("\x1b[31mhello\x1b[0m")).toBe("hello");
	});

	it("removes OSC sequences", () => {
		expect(stripAnsi("\x1b]0;title\x07prompt")).toBe("prompt");
	});
});

describe("isBorderLine", () => {
	it("detects a plain border", () => {
		expect(isBorderLine("─────────")).toBe(true);
	});

	it("detects a border with ANSI styling", () => {
		expect(isBorderLine("\x1b[34m─────────\x1b[0m")).toBe(true);
	});

	it("rejects non-border content", () => {
		expect(isBorderLine("hello world")).toBe(false);
	});

	it("rejects empty strings", () => {
		expect(isBorderLine("")).toBe(false);
	});
});

describe("formatCost", () => {
	it("renders zero dollars as $0", () => {
		expect(formatCost(0)).toBe("$0");
	});

	it("uses four decimals for sub-cent costs", () => {
		expect(formatCost(0.0012)).toBe("$0.0012");
	});

	it("uses two decimals for cent-or-greater costs", () => {
		expect(formatCost(1.2345)).toBe("$1.23");
	});
});

describe("center", () => {
	it("left-pads enough to center a block of the given width", () => {
		// center() performs a left pad by `(width - visibleWidth(text)) / 2`.
		// It is meant to be used with a pre-normalized block, as in the startup header.
		expect(center("hi", 6)).toBe("  hi");
		expect(center("hi", 5)).toBe(" hi");
	});

	it("returns the text unchanged when it already fits exactly", () => {
		expect(center("hi", 2)).toBe("hi");
	});
});

describe("buildFullWidthRow", () => {
	it("aligns left and right at full width", () => {
		expect(buildFullWidthRow("~/foo", "main", 20)).toBe(
			" ~/foo         main ",
		);
	});

	it("keeps a one-column gap without exceeding the requested width", () => {
		const row = buildFullWidthRow("left", "right", 11);
		expect(stripAnsi(row)).toBe(" lef right ");
	});

	it("ignores ANSI bytes when measuring width", () => {
		const row = buildFullWidthRow(
			"\x1b[34m~/foo\x1b[0m",
			"\x1b[32mmain\x1b[0m",
			20,
		);
		// The visual length should be 20 columns: leading space + 5 + gap + 4 + trailing space.
		expect(row.length).toBeGreaterThan(20); // due to ANSI codes
	});

	it("truncates the left item before the right item on narrow terminals", () => {
		const row = buildFullWidthRow("/very/long/path", "main 󰐗 2", 12);
		expect(stripAnsi(row)).toBe(" / main 󰐗 2 ");
	});

	it("does not exceed the requested width on narrow terminals", () => {
		expect(buildFullWidthRow("left", "right", 2)).toBe("  ");
	});
});

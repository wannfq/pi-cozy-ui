import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { isBorderLine } from "./text-layout.js";

/**
 * Editor layout engine for the minimal left-bar input box.
 *
 * This module is pure: given the raw editor lines plus pre-computed layout
 * pieces, it returns the final array of terminal rows. It knows nothing about
 * sessions, VCS, cost tracking, or Pi API events.
 */

export interface EditorLayoutInput {
	/** Raw lines from the parent editor (`super.render(width)`). */
	editorLines: string[];
	/** Terminal width in columns. */
	width: number;
	/** Left-bar prefix including inset (e.g. colored "┃  "). */
	prefix: string;
	/** Blank bar line spanning full width immediately above the status row. */
	blankBar: string;
	/** Status row that replaces the editor's bottom border. */
	status: string;
	/** Bottom row drawn outside the box (cwd + branch). */
	footerRow: string;
	/** Optional colorizer applied to content lines (not borders/dropdown). */
	contentColor?: (text: string) => string;
}

/**
 * Compose the final rendered lines for the minimal editor layout.
 *
 * - Removes the editor's top border so the input begins immediately.
 * - Finds the last border-like line (the bottom border) and replaces it with
 *   `blankBar` followed by `status`.
 * - Passes through any lines after the bottom border unchanged (autocomplete
 *   dropdown).
 * - Prefixes all remaining content lines with `prefix`, reclaiming the prefix
 *   width via ANSI-aware truncation.
 */
export function composeEditorLayout(input: EditorLayoutInput): string[] {
	const {
		editorLines,
		width,
		prefix,
		blankBar,
		status,
		footerRow,
		contentColor,
	} = input;
	const contentCap = Math.max(0, width - visibleWidth(prefix));

	// The bottom border is the last border-like line before any autocomplete
	// dropdown lines (which are non-border).
	let bottomIndex = -1;
	for (let i = 1; i < editorLines.length; i++) {
		if (isBorderLine(editorLines[i])) bottomIndex = i;
	}

	const out: string[] = [];
	for (let i = 0; i < editorLines.length; i++) {
		if (i === 0) continue;
		if (i === bottomIndex) {
			out.push(blankBar);
			out.push(status);
			continue;
		}
		if (bottomIndex !== -1 && i > bottomIndex) {
			// Autocomplete dropdown: do not add the left bar.
			out.push(editorLines[i]);
			continue;
		}
		const coloredLine = contentColor
			? contentColor(truncateToWidth(editorLines[i], contentCap, ""))
			: truncateToWidth(editorLines[i], contentCap, "");
		out.push(prefix + coloredLine);
	}

	// Fallback when the editor did not provide a recognizable bottom border.
	if (bottomIndex === -1) {
		out.push(blankBar);
		out.push(status);
	}

	out.push(footerRow);
	return out;
}

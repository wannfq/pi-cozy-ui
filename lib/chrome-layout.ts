import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { isBorderLine } from "./text-layout.js";

/**
 * Chrome layout engine for the minimal left-bar input box.
 *
 * This module is pure: given the raw editor lines plus pre-computed chrome
 * pieces, it returns the final array of terminal rows. It knows nothing about
 * sessions, VCS, cost tracking, or Pi API events.
 */

export interface ChromeInput {
  /** Raw lines from the parent editor (`super.render(width)`). */
  editorLines: string[];
  /** Terminal width in columns. */
  width: number;
  /** Left-bar prefix including inset (e.g. colored "┃  "). */
  prefix: string;
  /** Blank bar line spanning full width (used above/below the status row). */
  blankBar: string;
  /** Line that replaces the editor's top border. */
  top: string;
  /** Status row that replaces the editor's bottom border. */
  status: string;
  /** Bottom row drawn outside the box (cwd + branch). */
  branchRow: string;
}

/**
 * Compose the final rendered lines for the minimal editor chrome.
 *
 * - Replaces the top border with `top`.
 * - Finds the last border-like line (the bottom border) and replaces it with
 *   `blankBar` followed by `status`.
 * - Passes through any lines after the bottom border unchanged (autocomplete
 *   dropdown).
 * - Prefixes all remaining content lines with `prefix`, reclaiming the prefix
 *   width via ANSI-aware truncation.
 */
export function composeChrome(input: ChromeInput): string[] {
  const { editorLines, width, prefix, blankBar, top, status, branchRow } =
    input;
  const contentCap = Math.max(0, width - visibleWidth(prefix));

  // The bottom border is the last border-like line before any autocomplete
  // dropdown lines (which are non-border).
  let bottomIndex = -1;
  for (let i = 1; i < editorLines.length; i++) {
    if (isBorderLine(editorLines[i])) bottomIndex = i;
  }

  const out: string[] = [];
  for (let i = 0; i < editorLines.length; i++) {
    if (i === 0) {
      out.push(top);
      continue;
    }
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
    out.push(prefix + truncateToWidth(editorLines[i], contentCap, ""));
  }

  // Fallback when the editor did not provide a recognizable bottom border.
  if (bottomIndex === -1) {
    out.push(blankBar);
    out.push(status);
  }

  out.push(branchRow);
  return out;
}

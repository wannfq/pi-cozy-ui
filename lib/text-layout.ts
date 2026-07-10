import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

/** Render a full-width row with a left item, right item, and a gap between them. */
export function buildFullWidthRow(
  left: string,
  right: string,
  width: number,
): string {
  const totalContent = 1 + visibleWidth(left) + visibleWidth(right) + 1;
  const gap = Math.max(1, width - totalContent);
  return " " + left + " ".repeat(gap) + right + " ";
}

/**
 * Pure text-layout helpers shared by the minimal-look extensions.
 *
 * These functions are ANSI-aware where it matters (width calculations use the
 * TUI's `visibleWidth`/`truncateToWidth`) and have no dependency on extension
 * state, making them trivial to unit test.
 */

/** Build a status line filling exactly `width`: prefix + left + gap + right. */
export function statusLine(
  prefix: string,
  left: string,
  right: string,
  width: number,
): string {
  const avail = Math.max(0, width - visibleWidth(prefix));
  let r = right;
  let l = left;
  const minGap = 1;
  while (
    visibleWidth(l) + visibleWidth(r) + minGap > avail &&
    visibleWidth(r) > 0
  ) {
    r = truncateToWidth(r, Math.max(0, visibleWidth(r) - 1), "");
  }
  while (
    visibleWidth(l) + visibleWidth(r) + minGap > avail &&
    visibleWidth(l) > 0
  ) {
    l = truncateToWidth(l, Math.max(0, visibleWidth(l) - 1), "");
  }
  const gap = Math.max(minGap, avail - visibleWidth(l) - visibleWidth(r));
  return `${prefix}${l}${" ".repeat(gap)}${r}`;
}

/** Shorten a cwd path: `$HOME` → `~`. */
export function formatCwd(cwd: string): string {
  const home = process.env.HOME;
  if (home && cwd.startsWith(home)) return `~${cwd.slice(home.length)}`;
  return cwd;
}

/** Strip ANSI/OSC/APC codes so we can classify a raw editor line. */
export function stripAnsi(s: string): string {
  return s.replace(/\x1b\][^\x07]*\x07/g, "").replace(/\x1b[[0-9;]*m/g, "");
}

/** A pi editor border line renders as a run of `─` (with optional indicator). */
export function isBorderLine(line: string): boolean {
  const stripped = stripAnsi(line);
  if (stripped.length === 0) return false;
  const trimmed = stripped.trim();
  if (trimmed.length === 0) return false;
  return [...trimmed].every((c) => c === "─" || c === "━" || c === "═");
}

/** Format a cost in USD: compact representation ($0, $0.0012, $1.23). */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/** Center `text` within `width` columns. */
export function center(text: string, width: number): string {
  const vis = visibleWidth(text);
  if (vis >= width) return text;
  const pad = Math.floor((width - vis) / 2);
  return " ".repeat(pad) + text;
}

import {
	CustomEditor,
	type ExtensionAPI,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Component, EditorTheme, TUI } from "@earendil-works/pi-tui";
import { composeEditorLayout } from "../lib/editor-layout.js";
import { parseGitStatus, type GitStatusCounts } from "../lib/git-status.js";
import {
	buildFullWidthRow,
	formatCost,
	formatCwd,
	statusLine,
} from "../lib/text-layout.js";

/**
 * input-field.ts — a minimal look for pi's input/prompt box.
 *
 * Layout (inspired by opencode's TUI prompt, packages/tui/src/component/prompt):
 *   - A single LEFT vertical bar `┃` down the left side (no top/right/bottom
 *     enclosing border), tinted to the thinking level (pi's indicator).
 *   - Input text inset by 2 spaces.
 *   - A status row below the input INSIDE the bar: `provider model:thinking`
 *     (left) and `${ctx %}/${ctxK} $cost` (right). Provider and separators are
 *     muted; model, thinking, context usage, and cost use theme-aware accents.
 *     Cost is cumulative for the session, tracked via `turn_end` events.
 *   - Bottom row OUTSIDE the box: cwd (left, 1-space pad) and Git branch plus
 *     colored working-tree counts (right), cached and refreshed every 10s.
 *     Non-Git directories render `-`.
 *
 * Implementation notes:
 *   - We must NOT string-slice pi's editor output: lines contain the
 *     CURSOR_MARKER (`\x1b_pi:c\x07`) inside text and ANSI styling everywhere.
 *     Slicing by byte offset corrupts the marker → width overflow + dead input.
 *   - Instead we prefix content lines with `┃  ` (3 visible cols) and reclaim
 *     that room using the ANSI-aware `truncateToWidth(line, width - 3)` which
 *     drops trailing padding spaces and never touches the cursor marker.
 *   - `setEditorComponent`'s { paddingX } option is not reliably honored, so
 *     we treat pi's lines as if they fill the full `width` (no side padding).
 *   - Autocomplete dropdown lines are passed through untouched (no bar).
 *
 * After editing, run `/reload` inside pi to apply changes live.
 */

/** A footer that renders nothing — hides pi's default status footer. */
const emptyFooter: Component = {
	render: () => [],
	invalidate: () => {},
};

const BRANCH_FETCH_INTERVAL = 10_000; // 10s

/** Per-session cost accumulator fed by `turn_end` events. */
export interface SessionMetrics {
	onTurnEnd(event: unknown): void;
	/** Formatted cumulative cost for display (e.g. "$0.12"). */
	readonly costStr: string;
}

/** Create a session-scoped cost accumulator. */
function createMetrics(): SessionMetrics {
	let cost = 0;
	return {
		onTurnEnd(event: unknown) {
			const msg = event as {
				message?: { usage?: { cost?: { total: number } } };
			};
			const total = msg.message?.usage?.cost?.total;
			if (total != null) cost += total;
		},
		get costStr() {
			return formatCost(cost);
		},
	};
}

/** Cached Git branch and working-tree state for the footer. */
export interface GitSnapshot {
	branch: string | null;
	status: GitStatusCounts;
}

/** Async Git tracker, cached and refreshed every 10s. */
export interface GitTracker {
	/** Current Git state, or null if unavailable / outside a Git work tree. */
	readonly snapshot: GitSnapshot | null;
	/** Stop the refresh interval. */
	stop(): void;
}

/** Create and auto-start a Git tracker for the given cwd. */
function createGitTracker(
	exec: ExtensionAPI["exec"],
	cwd: string,
	onChange: () => void,
): GitTracker {
	let cachedSnapshot: GitSnapshot | null = null;
	let inFlight = false;
	const intervalId = setInterval(() => void refresh(), BRANCH_FETCH_INTERVAL);

	function setSnapshot(snapshot: GitSnapshot | null): void {
		cachedSnapshot = snapshot;
		onChange();
	}

	async function refresh(): Promise<void> {
		if (inFlight) return;
		inFlight = true;
		try {
			const statusResult = await exec(
				"git",
				["status", "--porcelain=v1", "-z"],
				{ cwd, timeout: 3000 },
			);
			if (statusResult.code !== 0) {
				setSnapshot(null);
				return;
			}

			const branchResult = await exec(
				"git",
				["branch", "--show-current"],
				{
					cwd,
					timeout: 3000,
				},
			);
			setSnapshot({
				branch:
					branchResult.code === 0
						? branchResult.stdout.trim() || null
						: null,
				status: parseGitStatus(statusResult.stdout),
			});
		} catch {
			setSnapshot(null);
		} finally {
			inFlight = false;
		}
	}

	// Kick off the first fetch immediately.
	void refresh();

	return {
		get snapshot() {
			return cachedSnapshot;
		},
		stop() {
			clearInterval(intervalId);
		},
	};
}

/** Active session state — created on each `session_start`, torn down on the next. */
interface SessionState {
	metrics: SessionMetrics;
	vcs: GitTracker;
}

let session: SessionState | null = null;

export default function (pi: ExtensionAPI) {
	// Track cumulative session cost on each turn_end.
	pi.on("turn_end", (event) => {
		session?.metrics.onTurnEnd(event);
	});

	pi.on("session_start", (_event, ctx) => {
		// Tear down the previous session's Git tracker.
		session?.vcs.stop();

		// Create fresh per-session state.
		const metrics = createMetrics();
		let requestRender = () => {};
		const vcs = createGitTracker(pi.exec, ctx.cwd, () => requestRender());
		session = { metrics, vcs };

		// Hide pi's default footer — its cwd / context-window / model row is now
		// redundant with the status line drawn inside our minimal input box.
		ctx.ui.setFooter(() => emptyFooter);

		class MinimalEditor extends CustomEditor {
			constructor(
				tui: TUI,
				theme: EditorTheme,
				keybindings: KeybindingsManager,
			) {
				super(tui, theme, keybindings, { paddingX: 0 });
			}

			render(width: number): string[] {
				const lines = super.render(width);
				if (lines.length === 0) return lines;

				const thm = ctx.ui.theme;
				const bar = (text: string) => this.borderColor(text);
				const prefix = bar("┃") + " ";
				const blankBar = bar("┃") + " ".repeat(Math.max(0, width - 1));

				const usage = ctx.getContextUsage();
				const contextPercent = usage?.percent;
				const ctxPct =
					typeof contextPercent === "number"
						? `${Math.round(contextPercent)}%`
						: "?";
				const contextWindow =
					usage?.contextWindow ?? ctx.model?.contextWindow;
				const ctxK = contextWindow
					? `${(contextWindow / 1000).toFixed(0)}k`
					: "?";

				const thinking = pi.getThinkingLevel();
				const statusLeft = ctx.model
					? thm.fg("muted", ctx.model.provider) +
						" " +
						thm.fg("accent", ctx.model.id) +
						" " +
						this.borderColor(`${thinking} `)
					: thm.fg("muted", "no model ");
				const statusRight =
					thm.fg("accent", ctxPct) +
					thm.fg("muted", `/${ctxK} `) +
					thm.fg("text", metrics.costStr) +
					" ";

				const cwdStr = thm.fg("text", formatCwd(ctx.cwd));
				const git = vcs.snapshot;
				const gitCount = (
					indicator: string,
					count: number,
					color: "muted" | "warning" | "error",
				) => (count > 0 ? thm.fg(color, `${indicator}${count}`) : null);
				let gitStr = thm.fg("muted", "-");
				if (git) {
					const branch = git.branch ?? "HEAD";
					gitStr = [
						thm.fg(git.branch ? "success" : "muted", branch),
						gitCount("+", git.status.staged, "warning"),
						gitCount("!", git.status.modified, "warning"),
						gitCount("-", git.status.deleted, "warning"),
						gitCount("?", git.status.untracked, "muted"),
						gitCount("R", git.status.renamed, "warning"),
						gitCount("U", git.status.conflicted, "error"),
					]
						.filter((part): part is string => part !== null)
						.join(" ");
				}

				return composeEditorLayout({
					editorLines: lines,
					width,
					prefix,
					blankBar,
					status: statusLine(prefix, statusLeft, statusRight, width),
					footerRow: buildFullWidthRow(cwdStr, gitStr, width),
					contentColor: (text) => thm.fg("thinkingText", text),
				});
			}
		}

		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			requestRender = () => tui.requestRender();
			return new MinimalEditor(tui, theme, keybindings);
		});
	});
}

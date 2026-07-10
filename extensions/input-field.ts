import {
  CustomEditor,
  type ExtensionAPI,
  type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Component, EditorTheme, TUI } from "@earendil-works/pi-tui";
import { composeChrome } from "../lib/chrome-layout.js";
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
 *   - A status row below the input INSIDE the bar: `provider/model:thinking`
 *     (left) and `${ctx %}/${ctxK} $cost` (right), all muted. Cost is
 *     cumulative for the session, tracked via `turn_end` events.
 *   - Bottom row OUTSIDE the box: cwd (left, 1-space pad) and branch name
 *     (right) — auto-detects git or jujutsu, cached and refreshed every 10s.
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
class EmptyFooter implements Component {
  render(): string[] {
    return [];
  }
  invalidate(): void {}
}

const BRANCH_FETCH_INTERVAL = 10_000; // 10s

/** Per-session cost accumulator fed by `turn_end` events. */
class SessionMetrics {
  private cost = 0;

  onTurnEnd(event: unknown) {
    const msg = event as { message?: { usage?: { cost?: { total: number } } } };
    const total = msg.message?.usage?.cost?.total;
    if (total != null) this.cost += total;
  }

  get costStr(): string {
    return formatCost(this.cost);
  }
}

/** Reference to the active session's metrics (updated on each `session_start`). */
let currentMetrics: SessionMetrics | null = null;

/** Adapter that asynchronously fetches the current VCS branch (git or jj). */
class VcsBranchAdapter {
  private cachedBranch: string | null = null;
  private inFlight = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private exec: ExtensionAPI["exec"]) {}

  get branch(): string | null {
    return this.cachedBranch;
  }

  start(cwd: string) {
    void this.refresh(cwd);
    this.intervalId = setInterval(
      () => void this.refresh(cwd),
      BRANCH_FETCH_INTERVAL,
    );
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async refresh(cwd: string): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const gitResult = await this.exec("git", ["branch", "--show-current"], {
        cwd,
        timeout: 3000,
      });
      if (gitResult.code === 0) {
        this.cachedBranch = gitResult.stdout.trim() || null;
        return;
      }
      const jjResult = await this.exec(
        "jj",
        ["log", "-r", "@", "-T", "bookmarks", "--no-graph"],
        { cwd, timeout: 3000 },
      );
      if (jjResult.code === 0) {
        this.cachedBranch = jjResult.stdout.trim() || null;
        return;
      }
      this.cachedBranch = null;
    } catch {
      this.cachedBranch = null;
    } finally {
      this.inFlight = false;
    }
  }
}

/** Reference to the active session's VCS adapter (stopped/replaced on each `session_start`). */
let activeVcs: VcsBranchAdapter | null = null;

export default function (pi: ExtensionAPI) {
  // Track cumulative session cost on each turn_end.
  pi.on("turn_end", (event) => {
    currentMetrics?.onTurnEnd(event);
  });

  pi.on("session_start", (_event, ctx) => {
    // Create fresh per-session state and wire it up.
    const metrics = new SessionMetrics();
    currentMetrics = metrics;

    activeVcs?.stop();
    const vcs = new VcsBranchAdapter(pi.exec);
    activeVcs = vcs;
    vcs.start(ctx.cwd);

    // Hide pi's default footer — its cwd / context-window / model row is now
    // redundant with the status line drawn inside our minimal input box.
    ctx.ui.setFooter(() => new EmptyFooter());

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

        const model = ctx.model
          ? `${ctx.model.provider}/${ctx.model.id}`
          : "no model";
        const usage = ctx.getContextUsage();
        const ctxPct =
          usage?.percent != null ? `${Math.round(usage.percent)}%` : "?";
        const contextWindow =
          usage?.contextWindow ?? ctx.model?.contextWindow;
        const ctxK = contextWindow
          ? `${(contextWindow / 1000).toFixed(0)}k`
          : "?";

        const statusLeft = thm.fg(
          "muted",
          `${model}:${pi.getThinkingLevel()} `,
        );
        const statusRight = thm.fg(
          "muted",
          `${ctxPct}/${ctxK} ${metrics.costStr} `,
        );

        const cwdStr = thm.fg("text", formatCwd(ctx.cwd));
        const branchStr = vcs.branch ? thm.fg("text", vcs.branch) : null;

        return composeChrome({
          editorLines: lines,
          width,
          prefix,
          blankBar,
          top: blankBar,
          status: statusLine(prefix, statusLeft, statusRight, width),
          branchRow: branchStr
            ? buildFullWidthRow(cwdStr, branchStr, width)
            : " " + cwdStr,
        });
      }
    }

    ctx.ui.setEditorComponent(
      (tui, theme, keybindings) => new MinimalEditor(tui, theme, keybindings),
    );
  });
}



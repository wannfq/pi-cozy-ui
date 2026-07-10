import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { visibleWidth } from "@earendil-works/pi-tui";
import { center } from "../lib/text-layout.js";

/**
 * startup-screen.ts — a minimal startup header, inspired by opencode's TUI.
 *
 * Layout:
 *   - 2 blank lines (top padding)
 *   - Centered "pi" ASCII art icon, tinted with the theme accent color
 *   - Centered version string below the icon, muted
 *   - 2 blank lines (bottom padding)
 *
 * Installed via `ctx.ui.setHeader()` — renders above chat at startup.
 * Run `/reload` inside pi to apply changes live.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentPkgPath = join(
  __dirname,
  "..",
  "node_modules",
  "@earendil-works",
  "pi-coding-agent",
  "package.json",
);
const piVersion = JSON.parse(readFileSync(agentPkgPath, "utf-8"))
  .version as string;

const LOGO = ["██████  ", "██  ██  ", "████  ██", "██    ██"];

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setHeader((tui, theme) => new StartupHeader(tui, theme));
  });
}

class StartupHeader implements Component {
  constructor(
    private _tui: TUI,
    private theme: Theme,
  ) {}

  render(width: number): string[] {
    const thm = this.theme;
    const lines: string[] = [];

    lines.push("");
    lines.push("");

    // Build logo lines with version on the right side, bottom-aligned.
    const versionStr = `v${piVersion}`;
    const versionLineIdx = LOGO.length - 1;
    const coloredLines = LOGO.map((row, i) => {
      const logoColored = thm.fg("accent", row);
      if (i === versionLineIdx) {
        return logoColored + " " + thm.fg("muted", versionStr);
      }
      return logoColored;
    });
    // Equalize visible width so centering aligns the logo uniformly.
    const maxVis = Math.max(...coloredLines.map((s) => visibleWidth(s)));
    for (const s of coloredLines) {
      const padded = s + " ".repeat(maxVis - visibleWidth(s));
      lines.push(center(padded, width));
    }

    lines.push("");

    return lines;
  }

  invalidate(): void {}
}

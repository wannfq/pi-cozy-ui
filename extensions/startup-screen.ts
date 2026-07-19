import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { VERSION as piVersion } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { visibleWidth } from "@earendil-works/pi-tui";
import { center } from "../lib/text-layout.js";

/**
 * startup-screen.ts — a minimal startup header, inspired by opencode's TUI.
 *
 * Layout:
 *   - 2 blank lines (top padding)
 *   - Centered "pi" ASCII art icon in the theme tool-title color
 *   - Centered version string below the icon, muted
 *   - 2 blank lines (bottom padding)
 *
 * Installed via `ctx.ui.setHeader()` — renders above chat at startup.
 * Run `/reload` inside pi to apply changes live.
 */

const LOGO = ["██████  ", "██  ██  ", "████  ██", "██    ██"];

/** Create the startup header component that renders the centered "pi" logo. */
function createStartupHeader(theme: Theme): Component {
	return {
		render(width: number): string[] {
			const thm = theme;
			const lines: string[] = [];

			lines.push("");
			lines.push("");

			// Build logo lines with version on the right side, bottom-aligned.
			const versionStr = `v${piVersion}`;
			const versionLineIdx = LOGO.length - 1;
			const coloredLines = LOGO.map((row, i) => {
				const logoColored = thm.fg("toolTitle", row);
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
		},
		invalidate: () => {},
	};
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		ctx.ui.setHeader((_tui, theme) => createStartupHeader(theme));
	});
}

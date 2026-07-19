# Repository Guidelines

## Project Overview

**pi-cozy-ui** is a [Pi](https://github.com/earendil-works/pi) extension that gives Pi a minimal look, inspired by opencode's TUI. It currently ships two deliverables:

1. **Minimal editor module** (`extensions/input-field.ts`) — replaces Pi's default input/prompt box with a left-bar (`┃`) design and an embedded muted status row (cwd · context-window usage · model · thinking level).
2. **Startup screen module** (`extensions/startup-screen.ts`) — replaces Pi's default header with a centered ASCII "pi" icon and version string, padded by 2 blank lines above and below.

Each module is opt-in — users choose whether to enable either or both modules.

## Architecture & Data Flow

```
package.json "pi" manifest
  ├─ extensions[] → Pi loads via jiti (raw .ts, no build)
  │     ├─ extensions/input-field.ts → default export (pi: ExtensionAPI) => void
  │     │     ├─ pi.on("session_start") → ctx.ui.setFooter(empty)
  │     │     └─ ctx.ui.setEditorComponent(MinimalEditor)
  │     └─ extensions/startup-screen.ts → default export (pi: ExtensionAPI) => void
  │           └─ pi.on("session_start") → ctx.ui.setHeader(StartupHeader)

lib/ — pure, testable helper modules shared by the extensions
  ├─ text-layout.ts — ANSI-aware text helpers (center, statusLine, formatCwd, …)
  └─ editor-layout.ts — pure composer for the minimal editor layout
```

- **Extension model:** default-export a factory `(pi: ExtensionAPI) => void`. Pi invokes it on session start. The single hook used is `pi.on("session_start", (event, ctx) => …)`.
- **Editor swap:** `MinimalEditor` subclasses `CustomEditor` (from `@earendil-works/pi-coding-agent`) and overrides `render(width): string[]`. It disables side padding (`paddingX: 0`), prefixes each content line with a colored left bar and a two-space inset, replaces Pi's top border with a blank bar line, and replaces the bottom border with a status row. Autocomplete dropdown lines pass through unmodified (no bar).
- **Footer suppression:** `ctx.ui.setFooter(() => new EmptyFooter())` installs an empty `Component` to hide Pi's built-in status footer, since the status info is embedded into the editor's bottom row.
- **ANSI safety:** content truncation uses `truncateToWidth` / `visibleWidth` from `@earendil-works/pi-tui` to respect ANSI cursor markers and wide chars.
- **Thinking-level bar:** `this.borderColor(text)` delegates to Pi's thinking-level indicator coloring.
- **Startup header:** `StartupHeader` implements `Component` and renders via `ctx.ui.setHeader()`. It draws a centered ASCII wordmark, a muted tagline, and a dim status line (cwd · model). The header is re-rendered on each frame, so model changes are reflected live.

## Key Directories

| Path | Purpose |
| ------ | --------- |
| `extensions/` | Pi extension source (`input-field.ts`, `startup-screen.ts`) |
| `lib/` | Pure helper modules shared by the extensions |
| `package.json` | Pi extension manifest via the `"pi"` field |

## Development Commands

```bash
pnpm install                 # install deps (only needed once / on lockfile change)
pnpm dev                     # run Pi with all modules
pnpm dev:startup             # run Pi with just the startup screen module
pnpm dev:input              # run Pi with just the input field module
pnpm check                   # type-check (tsc --noEmit --strict)
pnpm test                    # run vitest unit tests for lib/ helpers
```

Inside a running Pi session, `/reload` hot-reloads the extension for live iteration.

`pnpm dev` loads all modules.

## Code Conventions & Common Patterns

- **Module style:** ESM, default-export a factory function `(pi: ExtensionAPI) => void`. One module per file under `extensions/`.
- **Naming:** `camelCase` for identifiers and functions; `PascalCase` for classes (`MinimalEditor`, `EmptyFooter`, `StartupHeader`).
- **Styling:** no CSS — all terminal rendering goes through Pi's theme API (`EditorTheme`, `ctx.ui.theme.fg("muted", …)`, `this.borderColor(text)`).
- **TypeScript:** strict mode, `module: esnext`, `moduleResolution: bundler`, `target: es2022`, `skipLibCheck`. No `tsconfig.json` — flags are passed inline in the `check` script.
- **Editor subclass pattern:** extend `CustomEditor`, call `super(tui, theme, keybindings, { paddingX: 0 })`, override `render(width)`. Reuse `super.render(width)` for base content, then post-process lines.
- **Shared helpers** live under `lib/` and are pure (no Pi state, no side effects). `extensions/*.ts` import from `lib/*.js`.

## Important Files

| File | Role |
| ------ | ------ |
| `package.json` | Extension manifest. The `"pi"` field is the Pi loading contract: an `extensions` array + `keywords: ["pi-package"]`. Pins `pnpm@11.1.0`. |
| `extensions/input-field.ts` | Editor module. Default-exported factory; defines `MinimalEditor` (CustomEditor subclass), `EmptyFooter`, `SessionMetrics`, and `VcsBranchAdapter`. |
| `extensions/startup-screen.ts` | Startup screen module. Default-exported factory; defines `StartupHeader` (Component) installed via `ctx.ui.setHeader()`. Renders a centered "pi" ASCII icon and version with padding. |
| `lib/text-layout.ts` | Pure text-layout helpers: `center`, `statusLine`, `formatCwd`, `stripAnsi`, `isBorderLine`, `formatCost`, `buildFullWidthRow`. |
| `lib/editor-layout.ts` | Pure layout composer: `composeEditorLayout()` builds the minimal editor frame from raw editor lines. |
| `pnpm-workspace.yaml` | Minimal workspace config; grants build perms for `@google/genai` and `protobufjs`. |

## Runtime / Tooling Preferences

- **Package manager:** **pnpm** (pinned to `11.1.0` via `packageManager`; lockfile `pnpm-lock.yaml` v9). Do not use npm or yarn.
- **Runtime:** Node **>=22.19.0** (constrained by the `@earendil-works/*` peer deps). Bun is an alternative runtime since Pi's CLI can run via the Bun binary, but Node is the baseline.
- **No build step:** Pi loads `.ts` source directly via **jiti** at runtime. Do not add a bundler or precompile step unless Pi's contract changes.
- **No formatter/linter** is configured (no biome/prettier/eslint). Keep the existing code style when editing.
- **Dev dependencies** are the Pi framework packages themselves (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui` @ `0.80.3`) plus `typescript ^5.6.0` (resolves to `5.9.3`). Import extension APIs and TUI primitives from these two packages.

## Testing & QA

Verification is now two steps:

```bash
pnpm check   # tsc --noEmit --strict on extensions and lib/*.ts
pnpm test    # vitest, runs .test.ts files under lib/
```

`vitest` (added as a dev dependency) runs TypeScript test files without a build step, matching the repo's no-build convention. Good unit-test candidates are the pure helpers in `lib/text-layout.ts` and the pure composer in `lib/editor-layout.ts`.

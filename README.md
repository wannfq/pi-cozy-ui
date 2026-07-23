# pi-cozy-ui

A cozy UI for [pi](https://pi.dev) — a minimal input box, startup screen, and cozy themes.

Inspirations:

- Opencode input box
- Catppucin color pallete

## Install

```bash
pi install npm:pi-cozy-ui
```

Then enable/disable modules in the resource config TUI:

```bash
pi config
```

## Themes

The package includes two Catppuccin-inspired cozy themes that also style the
thinking-level input border:

- `cozy-dark` — a soft Mocha-inspired dark palette
- `cozy-light` — a warm Latte-inspired light palette

Select either theme from `/settings` after installation.

## Recommended settings

For the best experience:

1. Move `pi-cozy-ui` after packages that customize Pi's input or startup screen
   in `pi config`. Placing it last is a good default, but isn't required.
2. Select either `cozy-dark` or `cozy-light` from `/settings`.
3. Enable quiet startup to suppress Pi's default banner; the startup screen
   module replaces it with a cleaner centered header.

```bash
pi config
```

In the config TUI, set `quietStartup` to `true`. Or add it directly to `~/.pi/agent/settings.json`:

```json
{
	"quietStartup": true
}
```

## Preview

![pi-cozy-ui preview](https://raw.githubusercontent.com/wannfq/pi-cozy-ui/main/docs/preview.png)

## Develop

```bash
pnpm install
pnpm dev
# = pi --no-extensions -e ./extensions/input-field.ts -e ./extensions/startup-screen.ts
```

Edit, then type `/reload` inside pi for live updates.

## Layout

| File                           | Purpose                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `extensions/input-field.ts`    | Custom editor: left-bar input box with an embedded muted status row. |
| `extensions/startup-screen.ts` | Startup header: centered ASCII "pi" icon and version.                |
| `lib/text-layout.ts`           | Pure ANSI-aware text helpers used by both extensions.                |
| `lib/editor-layout.ts`         | Pure composer for the minimal editor layout.                         |
| `themes/cozy-dark.json`        | Catppuccin-inspired dark theme.                                      |
| `themes/cozy-light.json`       | Catppuccin-inspired light theme.                                     |

## Test

```bash
pnpm test
```

## Type-check

```bash
pnpm check
```

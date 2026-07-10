# pi-clean-look

A clean look for [pi](https://pi.dev) — a minimal left-bar input box and startup screen.

## Install

```bash
pi install git:github.com/wannfq/pi-clean-look
```

Then enable/disable modules in the resource config TUI:

```bash
pi config
```


## Preview

<picture>
<img alt="pi-clean-look preview" src="docs/preview.svg">
</picture>

<!-- Text fallback for terminals / blocked images -->
<pre>


                                          ██████
                                          ██  ██
                                          ████  ██
                                          ██    ██ v0.80.6


┃
┃
┃
┃ opencode-go/glm-5.2:high                                                              0%/1000k $0
 ~/projects/pi-clean-look                                                                      main
</pre>

## Develop

```bash
pnpm install
pnpm dev
# = pi --no-extensions -e ./extensions/input-field.ts -e ./extensions/startup-screen.ts
```

Edit, then type `/reload` inside pi for live updates.

## Layout

| File | Purpose |
| --- | --- |
| `extensions/input-field.ts` | Custom editor: left-bar input box with an embedded muted status row. |
| `extensions/startup-screen.ts` | Startup header: centered ASCII "pi" icon and version. |
| `lib/text-layout.ts` | Pure ANSI-aware text helpers used by both extensions. |
| `lib/chrome-layout.ts` | Pure composer for the minimal editor chrome. |

## Test

```bash
pnpm test
```

## Type-check

```bash
pnpm check
```

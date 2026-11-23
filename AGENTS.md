# AGENTS.md

Kilo is a `gpuix-svelte` desktop app (Svelte 5 components rendered into a native GPUI window, powered by `sharp` for local batch image compression). It runs on Node.js >= 24 or Bun >= 1.4.

## Documentation

GPUI's elements, styling and events follow their own rules. Fetch `https://gpuix-svelte.stanislav.garden/llms.txt` when working on GPUI primitives or layout behavior.

## Commands

```bash
bun run start        # opens the hot-reloading GPUI window (app.ts)
bun run test         # runs test.ts via gpuix-svelte (domain + platform + GPUI headless hit-testing)
bun run typecheck    # tsc --noEmit and svelte-check --fail-on-warnings
bun run build        # compiles standalone.ts + embedded natives into dist/
bun build.ts --archive  # builds single-file executable, release zip archive, and update fragment
```

## Architecture & Layout

- `app.ts` — dev entry (`render_hot` on `./App.svelte`).
- `standalone.ts` — production entry (`render` on `./App.svelte`) with static literal `app` & `app.update` options for `gpuix-svelte/build`. Keep `app` fields as static string literals (no object spreads inside `render()`'s options).
- `App.svelte` — root 3-pane layout shell, `:root` CSS variable defaults, theme sync, window bounds persistence, global shortcuts, `<Toaster />`.
- `build.ts` — collects target `sharp` + `libvips` binaries (`node_modules/@img/sharp-*`) and fonts, generates transient `.native-assets.ts` / `.standalone-build.ts` to embed them as Bun file assets with a content hash, invokes `gpuix-svelte/build`, and cleans up temporary build files.
- `test.ts` — self-contained verification script using `gpuix-svelte/test` (`check()`, `finish()`, `mount_headless()`, `click_test_id()`). Keep the expected `check` count handed to `finish()` exact.
- `src/core/` — pure Node/Sharp domain engine (`types.ts`, `scan.ts`, `paths.ts`, `compress.ts`). Must have **zero** Svelte or GPUI imports.
- `src/platform/` — OS and runtime adapters (`native-runtime.ts`, `desktop.ts`, `clipboard.ts`, `titlebar.ts`).
- `src/state/` — Svelte 5 runes state modules (`spaces.svelte.ts`, `queue.svelte.ts`, `thumbs.ts`, `actions.ts`).
- `src/ui/` — theme tokens (`theme.ts`), inline SVG icon strings (`icons.ts`), and GPUI-native `.svelte` components (`Sidebar.svelte`, `Panel.svelte`, `Stage.svelte`, `FileRow.svelte`, `AboutDialog.svelte`).
- `assets/icon.png` — application icon packaged by `build.ts`.

## TypeScript & Svelte Rules

- `.ts` files run through Node's and Bun's type stripping without a compiler: no enums, namespaces, or constructor parameter properties; always use `import type` for type-only imports and spell relative imports with `.ts`.
- `gpuix-svelte` bundles its own Svelte build with `svelte/renderer`. Keep `svelte` itself out of `package.json`.
- Only `.svelte` files hot-reload; reactive state stays in `src/state/*.svelte.ts`.
- Style with `<style>` class selectors (`.foo`, `.foo.bar`, `:hover`, `:active`, `:focus-visible`) and `--ui-*` / `--surface-*` tokens declared in `App.svelte`'s `:root` rule.

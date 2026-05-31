# CLAUDE.md

This file gives Claude Code context for working in this repository.

## What this is

`banana-theme` is a **downstream fork of [`vanilla-theme`](../vanilla-theme)**, Pano's reference
SvelteKit theme. It diverges from vanilla on styling, layout, and branding, but the
**plugin-facing API surface** (`PluginAPI.js`, shared form components, lifecycle event names,
view-slot ids) stays near-identical to upstream by design so Pano plugins (auth-guard,
social-login, …) keep working without theme-by-theme branches.

Stack: Svelte 5 + SvelteKit + Vite + Bun + Bootstrap 5 + svelte-i18n. `bun install`, then
`bun run dev` (Vite on `0.0.0.0:3000`) or `bun run dev:ui` (+ `sass --watch`), `bun run build`,
`bun run build:ui`, `bun run lint` / `bun run format`. Reverse-proxied by `pano-web-platform`; see
`../../CLAUDE.md`.

**Note — this fork is free-only:** unlike vanilla/blaze/blocky/frost, its `build` is just
`vite build` with **no `prebuild` license-constant step and no post-build fingerprint**. If banana
ever ships as a premium resource, port vanilla's `scripts/license/` + the `prebuild`/`build` script
wiring over first.

## Fork family

- **Upstream (canonical):** [`vanilla-theme`](../vanilla-theme). When a Pano plugin needs new theme
  API, vanilla gets it first; **this fork must track that change** or the plugin degrades here.
- **Sibling forks:** `blaze-theme`, `blocky-theme`, `frost-theme`.

## When upstream changes — propagate here

When vanilla adds a plugin-facing API helper, component, or lifecycle hook, it must land here too.
The pattern (full version in `../vanilla-theme/CLAUDE.md`):

1. Find the upstream commit/diff in vanilla that touched shared files.
2. `cd ../vanilla-theme && git diff <before>..HEAD -- src/lib/PluginAPI.js src/lib/components/LoginFormBody.svelte > /tmp/sync.patch`
3. `cd ../banana-theme && git apply --3way /tmp/sync.patch`
4. Resolve conflicts using vanilla as the API source of truth — adopt the API, keep banana's style.
5. `bun run build` and smoke-test the affected plugin against this fork.

## Shared vs. fork-specific

- **Shared — keep in sync with vanilla:** `src/lib/PluginAPI.js`; lifecycle event names
  (`theme:login:load`, `theme:register:load`, `theme:view:<id>:load`, …); view-slot ids
  (`login-content`, `register-content`, `login-alt-methods`, `profile-content`,
  `settings-content`, …); form components plugins mount via `panoApi.ui.auth.*.form.get()`.
- **Fork-specific — diverge freely:** everything under `src/styles/`, Bootstrap class choices,
  page chrome/copy in `src/lib/pages/*`, fork-only components/animations, `static/` assets.

## Conventions

- Use Svelte 5 runes; avoid top-level `onDestroy` on plugin-hosted pages — prefer
  `$effect(() => () => cleanup())` for SSR safety. i18n via `svelte-i18n`'s `_` store.
- Releases via **semantic-release** on `alpha`/`beta`/`main` → **conventional commits**.

## Local fork-specific notes

<!-- Add banana-theme specifics here: palette, signature components, design philosophy, fonts. -->

## Context

Discord Share is an Obsidian plugin (`isDesktopOnly: false`, `minAppVersion` 1.4.13). It posts notes, selections, and attachments to Discord webhooks. All outbound traffic is three `fetch()` calls in `src/discord/DiscordManager.ts`: a JSON embed, a multipart embed with a local image, and a multipart attachment.

Testing today is Jest unit tests for `DiscordHelper` and `util/markdown`, with `obsidian` mocked. There are no tests that load the plugin into Obsidian, and CI only runs a release build.

Constraints from the user:
- No webhook URL, real or test, is ever committed.
- The user is fine closing their personal Obsidian while Claude drives a sandboxed instance.
- Work is executed through beads, not `/opsx:apply`.
- One OpenSpec change holds two beads epics: harness first, then `requestUrl` migration.

Obsidian Desktop ships as an "installer" (Electron) plus an "app" JS bundle that self-updates. The same app version can therefore run on different Electron versions.

## Goals / Non-Goals

**Goals:**
- A regression suite that loads the built plugin into real Obsidian and asserts on exactly what would be sent to Discord.
- Coverage of the seams that unit tests can't reach: command wiring, the attachment picker, vault path resolution, the webhook picker, and notices.
- CI on macOS, Windows, and Linux, across `earliest` and `latest` Obsidian, plus mobile emulation.
- A loop in which Claude can rebuild, drive, and inspect the plugin in a sandboxed Obsidian without touching the user's vault.
- Replacing `fetch()` with `requestUrl` with no user-visible behavior change, proven by the suite.

**Non-Goals:**
- Testing on the real Android or iOS apps. Mobile emulation is enough for now.
- Asserting on how Discord renders a message. The live check only proves that Discord accepts the payload.
- Testing the Settings tab UI exhaustively. Settings are injected programmatically, and settings-UI tests can be added later.
- Refactoring plugin code beyond the `requestUrl` migration. Odd spots like the `imageParam[0][0]` unwrapping are left alone unless the migration touches them.
- Replacing Jest. Unit tests stay on Jest, and e2e tests use Mocha under WebdriverIO.

## Decisions

### D1. `wdio-obsidian-service` for the regression suite (not Playwright)
It already solves the Obsidian-specific problems:
- downloading pinned app and installer versions, including `earliest` from `manifest.json`
- sandboxing the config directory and copying the vault
- installing the local plugin (`plugins: ["."]`) and bypassing the trust prompt
- `resetVault()` between tests
- an `emulateMobile` capability
- documented GitHub Actions setup on all three operating systems

*Alternatives:* Playwright via `_electron.launch` or `connectOverCDP`, which has nicer tooling (traces, `route()`) but leaves all the launch, sandbox, and version plumbing to us, with uncertain compatibility with Obsidian's launcher. Playwright was only chosen out of familiarity, so the better-fitting tool wins.

### D2. Mocha for e2e, Jest stays for unit tests
WebdriverIO can't run under Jest. `npm test` stays Jest and a new `npm run test:e2e` runs `wdio run ./wdio.conf.mts`. E2e specs use the `*.e2e.ts` suffix under `test/specs/`, and Jest's `testPathIgnorePatterns` excludes `test/`, so neither runner picks up the other's files. wdio types are scoped with a separate `test/tsconfig.json` so Jest and Mocha globals don't clash in `src/`. `injectGlobals: false` keeps imports explicit.

### D3. Webhook capture server instead of network interception
A small Node HTTP server (`test/support/captureServer.ts`) listens on `127.0.0.1` on an ephemeral port. It:
- records each request: method, path, headers, raw body, and a parsed form of JSON or multipart (parts with filename, content type, size; `payload_json` parsed)
- answers `OPTIONS` preflight with permissive CORS headers, which is needed while the plugin still uses `fetch()`
- can be told to reply with a given status and body, for 413 and error tests

*Why not wdio or CDP network mocking:* `requestUrl` traffic doesn't go through the renderer's network stack the way `fetch()` does, so interception that works today could go blind after epic 2. A real server sees both code paths, which is what lets the same suite verify the migration. It is also reusable by the Claude dev loop, which writes captures to a JSONL file Claude can read.

### D4. Settings injected at runtime; fixture vaults have no `data.json`
Fixture vaults hold notes and attachments only. A test helper sets settings before each test:
```
browser.executeObsidian(({plugins}, url) => {
  plugins.obsidianDiscordShare.settings.discordWebhookURL = [{description: "test", url}];
}, captureUrl)
```
(The exact plugin-handle access path is settled in the spike.)

This keeps webhook URLs out of git entirely, avoids the `.gitignore` rule on `data.json`, and makes multi-webhook and attachment-format variations a one-liner per test. Settings are not persisted (`saveData` isn't called), so tests don't leak state through the sandbox.

### D5. Optional live Discord check gated on an env var
`DISCORD_TEST_WEBHOOK_URL` is read from a gitignored `.env.test` when running locally (via Node's `--env-file` or `dotenv`), or from a repository secret in CI. The live spec is `describe.skip`'d when the variable is unset, and reports as skipped rather than failed. Any string written to logs or failure messages is passed through a redactor that replaces the URL. Webhook URLs contain the token in their path, so a leaked URL is a leaked credential. In CI the live job runs only on `workflow_dispatch` and on tags, never on `pull_request`, because secrets are unavailable to PRs from forks and the job shouldn't post to Discord on every push. `.env.test.example` documents the variable with a placeholder.

### D6. CI matrix
```
os:       ubuntu-latest, windows-latest, macos-latest
versions: earliest/earliest, latest/latest     (appVersion/installerVersion)
extra:    latest + emulateMobile (ubuntu only)
```
Linux needs a virtual display. The sample plugin's workflow uses `xvfb-run` (or the `xvfb` action), and we'll copy that approach. `.obsidian-cache` is cached keyed on the resolved version list, which the sample prints as `obsidian-cache-key`. The build runs once per job (`npm run build`) so the suite tests the same `main.js` that ships. `maxInstances` is lowered in CI to keep runners stable.

### D7. Claude dev loop: `obsidian-launcher watch` + Obsidian CLI
```
terminal A: npm run dev                                    (esbuild watch → main.js)
terminal B: npx obsidian-launcher watch --copy -p . test/vaults/basic
terminal C: capture server in standalone mode → test/.captures/webhooks.jsonl
Claude:     obsidian eval / command id=… / dev:errors / dev:console / dev:screenshot
```
`watch` installs `pjeby/hot-reload`, so rebuilds reload the plugin without restarting Obsidian. The CLI was chosen over a custom CDP client because it already covers commands, eval, console, errors, DOM, and screenshots, and needs no code from us. The loop is documented in `CLAUDE.md`, with npm scripts that start the pieces.

### D8. Vault-path guard before every state-changing CLI call
The Obsidian CLI talks to "the running instance", and if none is running it launches the default Obsidian, which opens the user's real vault. So before any `command`, `eval`, or other state-changing call, Claude runs `obsidian eval code="app.vault.adapter.basePath"`. It continues only if the path is inside the launcher's sandbox copy (a temp directory, not the user's vault). A failed or missing guard means stop and report, never retry against whatever instance answered. This is wrapped in a script (`scripts/obsidian-guard.mjs` or similar) so it's one call, and `CLAUDE.md` tells Claude never to call the CLI without it.

### D9. `requestUrl` migration as a separate epic, blocked by the harness
`requestUrl` isn't subject to CORS and is Obsidian's API for plugin HTTP. It doesn't accept `FormData`, so the two multipart paths build their body by hand:
- a random boundary
- a `payload_json` part, and a `files[0]` part with `filename` and `Content-Type`
- concatenation into an `ArrayBuffer`, sent with `contentType: multipart/form-data; boundary=…`

`throw: false` keeps status handling explicit (the 413 notice) and avoids `requestUrl`'s habit of parsing bodies as JSON. A small encoder lives in `src/util/multipart.ts` with Jest unit tests. The e2e suite is the acceptance gate: it must pass unchanged before and after.

*Alternative:* migrate first, then build tests. Rejected, because it would rewrite the riskiest code without a safety net.

### D10. Execution through beads, not `/opsx:apply`
`tasks.md` is the reviewed breakdown. It is filed once into beads:
- two epics (harness, migration), with the migration epic `blocked-by` the harness epic
- child issues with dependencies, `--spec-id openspec/changes/add-e2e-testing-harness`, and acceptance criteria taken from the spec scenarios

Each `tasks.md` line is then annotated with its bead ID. Work proceeds from `bd ready`. Before `openspec archive`, the checkboxes are ticked to match closed beads.

## Risks / Trade-offs

- **[Sandbox doesn't have the CLI enabled]** The CLI is a per-app setting, and the sandbox starts with fresh config. → The spike checks this first. Fallbacks: enable it by pre-seeding the sandbox config, or pass `-- --remote-debugging-port=9222` to the launcher and drive over CDP with a small script.
- **[CLI connects to the wrong instance]** → D8 guard, and the user closes personal Obsidian. The guard is a hard stop, not a warning.
- **[Obsidian 1.4.13 (`earliest`) behaves differently or can't install the plugin cleanly]** → If `earliest` exposes a real incompatibility, that's a finding to raise, either fixing the plugin or bumping `minAppVersion`, not something to silence. The CLI dev loop runs on `latest` only, since the CLI needs installer 1.12.7 or later.
- **[Flaky UI tests, especially fuzzy-modal selection and notices]** → Prefer `executeObsidianCommand` plus `executeObsidian` for setup, and drive the UI only for the behavior under test. Use wdio waits instead of sleeps, and keep `mocha.retries` at 0 locally so flakiness is visible.
- **[Hand-built multipart is subtly wrong]** (CRLFs, quoting, boundary collisions) → Unit tests for the encoder, the capture server parsing with a real multipart parser, and the optional live check proving Discord accepts it.
- **[Live check leaks the webhook URL]** → Redaction in all output, CI only on manual or tag triggers, and a secret scoped to the repository. If it leaks anyway, regenerate the webhook in Discord.
- **[Windows CI and path assumptions in tests]** → Tests use vault-relative POSIX paths (what Obsidian's vault API uses) and never build filesystem paths with string concatenation.
- **[Beads database is local-only]** (`.beads/` is in `.git/info/exclude`) → Fine for a single-session flow. Check whether `bd` resolves the database from a git worktree before running parallel sessions on independent beads.
- **[CI minutes]** Three operating systems by several versions, each downloading Obsidian. → Cache `.obsidian-cache`, and run the full matrix on `master` and PRs but mobile emulation only on Linux.

## Migration Plan

1. Epic 1 lands first, testing the current `fetch()` code. All non-live specs must pass on all CI matrix entries.
2. Epic 2 replaces the three `fetch()` calls one path at a time (JSON embed → multipart attachment → multipart embed with image). The full suite runs after each.
3. Rollback: epic 2 is isolated in `DiscordManager.ts` plus the new encoder, so reverting those commits restores `fetch()`. The harness itself has no runtime footprint in the shipped plugin.

## Open Questions

- The exact handle for reaching the plugin instance from `executeObsidian` / `eval` (probably `app.plugins.plugins["obsidian-discord-share"]`). Resolved by the spike.
- Whether `obsidian-launcher watch` preserves a pre-placed `.hot-reload` marker or needs one added to the fixture vault. Resolved by the spike.
- Whether to keep the capture server's JSONL output under `test/.captures/` (gitignored) or in a temp directory. This is a small call made during implementation.

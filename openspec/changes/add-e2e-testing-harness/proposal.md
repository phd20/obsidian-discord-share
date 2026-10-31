## Why

The plugin's Jest tests cover pure helpers only. Nothing exercises the code that runs inside Obsidian: commands, the attachment picker, vault path resolution, and the webhook POST. The last two bug fixes (attachment path handling, Windows backslash paths) both lived in those untested seams, and the Windows one could only have been caught on Windows. Claude also has no way to run the plugin and see whether a change works, so every check depends on manual testing in a real vault.

## What Changes

- Add an end-to-end regression suite built on `wdio-obsidian-service`. It runs the real plugin build inside sandboxed Obsidian instances, using committed fixture vaults.
- Add a local webhook capture server. Tests inject its URL into plugin settings at runtime, so no webhook URL (real or test) is ever committed.
- Run the suite in GitHub Actions across macOS, Windows, and Linux, and across Obsidian `earliest` (the manifest `minAppVersion`) and `latest`, plus mobile emulation.
- Add an optional live check against a real Discord webhook. The URL comes from a gitignored `.env.test` locally or a repository secret in CI. The check is skipped when the URL is absent and redacted from all output.
- Add a Claude dev loop: `obsidian-launcher watch` runs a sandboxed, hot-reloading Obsidian on a copy of a fixture vault, and Claude drives it through the Obsidian CLI (`command`, `eval`, `dev:errors`, `dev:console`, `dev:screenshot`). Every state-changing CLI call is preceded by a guard that confirms the target vault is the sandbox. The user's personal Obsidian is closed while the loop runs.
- Migrate the plugin's three `fetch()` calls to Obsidian's `requestUrl`. Multipart bodies for attachments are built by hand because `requestUrl` does not accept `FormData`. This happens only after the regression suite passes on the current `fetch()` code, and it must leave the same suite passing.
- Work is tracked and executed as two beads epics (harness, then migration). The migration epic is blocked by the harness epic. It is not executed with `/opsx:apply`.

## Capabilities

### New Capabilities
- `e2e-test-harness`: the regression suite: fixture vaults, runtime settings injection, the webhook capture server, the CI matrix, and the optional live Discord check with secret handling.
- `agent-dev-loop`: how Claude launches, drives, and inspects a sandboxed Obsidian with the plugin hot-reloaded, including the vault-path guard.
- `discord-webhook-delivery`: what the plugin sends to a Discord webhook (JSON embeds, multipart attachments, embeds with a local image, the webhook picker, error notices), and the requirement that requests are not subject to browser CORS rules.

### Modified Capabilities
<!-- None: openspec/specs/ has no existing specs. -->

## Impact

- **New dev dependencies**: `wdio-obsidian-service`, `wdio-obsidian-reporter`, `@wdio/cli` and related WebdriverIO packages, `mocha`, `@types/mocha`, and `obsidian-launcher` (via the service and `npx`). Jest stays in place for unit tests.
- **New files**: `wdio.conf.mts`, `test/vaults/**`, `test/specs/**/*.e2e.ts`, a capture-server helper, `.env.test.example`, a GitHub Actions test workflow, and a dev-loop section in `CLAUDE.md`.
- **Modified files**: `package.json` (scripts, dev dependencies), `.gitignore` (`.env.test`, `.obsidian-cache/`), and `tsconfig.json` (wdio types, ideally scoped to the e2e folder so Jest and wdio globals don't clash).
- **Plugin code (epic 2)**: `src/discord/DiscordManager.ts` (`shareAttachment`, `shareEmbed`). User-visible behavior does not change.
- **CI**: a new workflow alongside `release.yml`. It needs a cached `.obsidian-cache` and, for the live check, an optional `DISCORD_TEST_WEBHOOK_URL` secret.
- **Developer workflow**: the Obsidian CLI must be available, which needs installer 1.12.7 or later. The personal Obsidian instance must be closed while the Claude dev loop runs.

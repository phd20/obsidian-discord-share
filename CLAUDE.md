# Discord Share: notes for Claude

Obsidian plugin that posts notes, selections and attachments to Discord webhooks. Unit tests: `npm test` (Jest). E2E: `npm run test:e2e` (wdio-obsidian-service). No webhook URL is ever committed: `npm run check:webhooks`.

## Dev loop: drive the plugin in a sandboxed Obsidian

A sandboxed, hot-reloading Obsidian (latest) on a copy of `test/vaults/basic`, plus a capture server standing in for Discord, so nothing reaches Discord. Design: `openspec/changes/archive/2026-10-31-add-e2e-testing-harness` (D7, D8).

**Prerequisites**
- The user's personal Obsidian is closed. The Obsidian CLI talks to one per-user socket (`~/.obsidian-cli.sock`) owned by the Obsidian that started last, so any open instance can answer. `start` refuses if any Obsidian is running and never closes one.
- Installer >= 1.12.7 (the loop uses `-v latest -i latest`; the CLI does not exist in older installers). macOS is tested; Linux and Windows are best-effort.
- Nothing else that launches Obsidian runs while the loop is up (`npm run test:e2e`, another `obsidian-launcher`): a second instance takes the CLI socket and the guard will refuse.

**Commands**
```
npm run devloop:start     # esbuild watch + capture server + launcher watch; records the vault copy; injects settings
npm run devloop:status
npm run devloop:inject    # re-point the plugin at the capture server; run after every plugin reload
npm run devloop:stop      # stops everything it started; check `pgrep -fl Obsidian` is empty afterwards
```
Saving a file under `src/` rebuilds `main.js` and hot-reloads the plugin (a notice appears, ~5s). **Reload resets the in-memory settings**, so run `npm run devloop:inject` after each edit before sharing.

**Calling the CLI: only through the guard**
```
npm run obsidian                       # check only
npm run obsidian -- command id=obsidian-discord-share:discord:share-attachment
npm run obsidian -- eval code='app.vault.adapter.basePath'
npm run obsidian -- dev:errors
npm run obsidian -- dev:screenshot path=$PWD/test/.captures/screenshots/name.png
```
Never run the `obsidian` CLI binary directly and never use `/Applications/Obsidian.app`. The guard reads `app.vault.adapter.basePath` and forwards your call only if it equals the vault copy recorded by `devloop:start`. Command ids: `obsidian-discord-share:discord:share-{attachment,current-note-properties,current-note-content,selection}`. Pick from the attachment picker by clicking the `.prompt .suggestion-item` whose trimmed text is the vault path, e.g. via `eval`. `eval` is synchronous; split waits across calls.

**If the guard refuses (exit 3 or 4): STOP and report to the user. Do not retry, do not try another route** (no direct CLI, no other vault, no launching or closing Obsidian yourself). Exit 3 means the CLI answered from a different vault (personal Obsidian or another sandbox is open); exit 4 means the loop is not running or nothing answered.

**Where things land** (all gitignored under `test/.captures/`)
- `captures.jsonl`: one JSON line per request the plugin sent (parts carry `size` and `sha256`, not bytes; compare with `shasum -a 256` of the vault file). `jq -c . test/.captures/captures.jsonl | tail -n1`. A previous run's file is renamed `captures-<ts>.jsonl`.
- `screenshots/`: pass a path under it to `dev:screenshot`, then read the PNG.
- `dev-loop/*.log`: esbuild, capture-server and launcher output. `dev-loop.json`: state (pids, vault copy).
- Capture server URL: `test/.captures/server-url.txt` (never hard-code it).

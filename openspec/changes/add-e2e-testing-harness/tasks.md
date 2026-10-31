<!--
Execution: this change is executed through beads, not /opsx:apply.
Filed 2026-10-31 as two epics (ods-37d harness, ods-vq3 migration; ods-vq3 blocked-by ods-37d).
One bead per task group (group 4 and 8 split for parallel work); bead IDs are on the headings.
Tick a group's boxes when its bead closes, and all boxes before `openspec archive`.
-->

# Epic 1: E2E testing harness — `ods-37d`

## 1. Spike: sandboxed Obsidian + CLI — `ods-37d.1`

Depends on: none. Gates groups 3, 7.

- [x] 1.1 Launch `npx obsidian-launcher launch --copy -p . test/vaults/basic` on latest, and confirm the plugin loads enabled with no trust prompt
- [x] 1.2 Confirm whether the Obsidian CLI connects to the sandboxed instance (CLI setting enabled or not), and record the fix (pre-seeded config, or a CDP fallback via `--remote-debugging-port`)
- [x] 1.3 Find the plugin handle for runtime settings injection (e.g. `app.plugins.plugins["obsidian-discord-share"]`) and confirm that changing `settings` takes effect without `saveData`
- [x] 1.4 Confirm `obsidian-launcher watch` hot-reloads the plugin on rebuild, and whether the fixture vault needs a `.hot-reload` marker
- [x] 1.5 Confirm `obsidian eval code="app.vault.adapter.basePath"` reports the sandbox copy's path, and see what the CLI does when no instance is running
- [x] 1.6 Write the findings into design.md (open questions resolved, decisions adjusted)

## 2. Fixtures and capture server — `ods-37d.2`

Depends on: none.

- [x] 2.1 Create `test/vaults/basic` with: a note with full `ods-*` frontmatter, a note with `ods-image: [[b.png]]`, a plain-content note, `attachments/b.png` and `img/nested/b.png` with different bytes, and an oversized `big.png` or a generator for it. No `data.json`.
- [x] 2.2 Implement `test/support/captureServer.ts`: bind to `127.0.0.1` on an ephemeral port, record method/path/headers/raw body, parse JSON and multipart (filename, content type, size, parsed `payload_json`), answer CORS preflight, and support a configurable response status/body and a configurable no-CORS mode
- [x] 2.3 Add a standalone mode that appends captures to a gitignored JSONL file (for the dev loop)
- [x] 2.4 Unit-test the capture server's parsing with Jest, using sample JSON and multipart bodies
- [x] 2.5 Add a repository check (script or test) that fails if a Discord webhook URL appears in committed files

## 3. WebdriverIO setup — `ods-37d.3`

Depends on: 1.

- [x] 3.1 Add dev dependencies: `@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`, `wdio-obsidian-service`, `wdio-obsidian-reporter`, `mocha`, `@types/mocha`
- [x] 3.2 Add `wdio.conf.mts`: the `earliest`/`latest` versions from `OBSIDIAN_VERSIONS` (default `earliest/earliest latest/latest`), plus an `emulateMobile` capability, `plugins: ["."]`, `vault: "test/vaults/basic"`, `cacheDir: .obsidian-cache`, `injectGlobals: false`
- [x] 3.3 Add `test/tsconfig.json` with wdio and Mocha types, and exclude `test/` from Jest (`testPathIgnorePatterns`) so neither runner picks up the other's files
- [x] 3.4 Add `npm run test:e2e` (build, then `wdio run ./wdio.conf.mts`), and add `.obsidian-cache/`, `.env.test`, and the captures directory to `.gitignore`
- [x] 3.5 Add `test/support/plugin.ts` helpers: inject settings (webhooks, attachment formats), start/stop/reset the capture server per test, and `resetVault()` in `beforeEach`
- [x] 3.6 Add a smoke spec that asserts the plugin is loaded and its four commands are registered

## 4. E2E specs (current fetch() code) — 4.1/4.3 `ods-37d.4`, 4.2/4.4/4.5 `ods-37d.5`, 4.6/4.7 `ods-37d.6`, 4.8 `ods-37d.7`

Depends on: 2, 3.

- [x] 4.1 Attachment from a nested folder: pick `img/nested/b.png` in the picker, then assert the `files[0]` filename and bytes and the success notice
- [x] 4.2 Share note properties: assert the embed title, numeric color, author/footer/fields mapping, and the success notice
- [x] 4.3 Share note with a local image: assert the multipart body, `files[0]` named `b.png`, and `embeds[0].image.url = attachment://b.png`
- [x] 4.4 Share note content: assert the description has frontmatter, comments, and wikilinks removed
- [x] 4.5 Share selection through the command, and through the editor context menu
- [x] 4.6 Two webhooks configured: the picker appears, and only the chosen webhook path receives the request
- [x] 4.7 Error notices: `413` on an attachment gives the 8MB notice, and `500` on an embed gives a failure notice containing the status
- [x] 4.8 Run the full suite locally on `earliest` and `latest`, and file beads for any real incompatibilities found on `earliest` instead of skipping them

## 5. CI workflow — `ods-37d.8`

Depends on: 4.

- [x] 5.1 Add `.github/workflows/test.yml`: on push to `master` and on `pull_request`, run Jest, then build, then the e2e suite
- [x] 5.2 Matrix: `ubuntu-latest`, `windows-latest`, and `macos-latest` × `earliest`/`latest`, plus `emulateMobile` on Ubuntu only, with Linux under `xvfb-run` (Windows + `earliest` excluded, `ods-acg`)
- [x] 5.3 Cache `.obsidian-cache`, keyed on the resolved Obsidian versions
- [x] 5.4 Set a CI-appropriate `WDIO_MAX_INSTANCES`, and upload wdio logs and screenshots as artifacts on failure
- [x] 5.5 Confirm all matrix jobs pass on a PR (6 jobs; Windows + `earliest` was dropped, see design.md and `ods-acg`)

## 6. Optional live Discord check — `ods-37d.9`

Depends on: 4.

- [x] 6.1 Add `.env.test.example` with a `DISCORD_TEST_WEBHOOK_URL` placeholder, and load `.env.test` for e2e runs when present
- [x] 6.2 Add `test/specs/live.e2e.ts`: send one embed and one attachment to the real webhook, assert 2xx, and skip when the variable is unset
- [x] 6.3 Add a URL redactor applied to logs, reporter output, and failure messages, and test that a failing live spec doesn't print the URL
- [x] 6.4 Add `npm run test:e2e:live`, and a CI job using the `DISCORD_TEST_WEBHOOK_URL` secret on `workflow_dispatch` and tags only (never `pull_request`)

## 7. Claude dev loop — `ods-37d.10`

Depends on: 1, 2.

- [x] 7.1 Add npm scripts that start the dev loop: esbuild watch, `obsidian-launcher watch --copy -p . test/vaults/basic`, and the capture server in standalone mode
- [x] 7.2 Add a guard script that runs the vault-path check, then forwards the CLI call only if the path is the sandbox copy. On failure or no instance, it exits non-zero with a clear message.
- [x] 7.3 Add a dev-loop helper that injects capture-server webhook settings into the running sandbox (through the guard)
- [x] 7.4 Document the loop in `CLAUDE.md`: prerequisites (close personal Obsidian, installer ≥ 1.12.7), the start commands, CLI calls only through the guard, where captures and screenshots land, and stopping when the guard refuses
- [x] 7.5 Dry run: Claude starts the loop, shares a nested attachment, reads the capture, checks `dev:errors`, and takes a screenshot

# Epic 2: requestUrl migration (blocked by Epic 1) — `ods-vq3`

## 8. Replace fetch() with requestUrl — 8.1 `ods-vq3.1`, 8.2 `ods-vq3.2`, 8.3/8.4 `ods-vq3.3`, 8.5–8.7 `ods-vq3.4`

Depends on: epic 1 complete (groups 4 and 5 passing).

- [ ] 8.1 Add `src/util/multipart.ts`: build a `multipart/form-data` `ArrayBuffer` and boundary from a JSON part and file parts, with Jest unit tests (CRLFs, quoting, binary bytes, boundary not in the content)
- [ ] 8.2 Migrate the JSON embed path in `shareEmbed` to `requestUrl` with `throw: false`, and run the full e2e suite
- [ ] 8.3 Migrate `shareAttachment` to `requestUrl` with the multipart encoder, keeping the 413 notice, and run the full e2e suite
- [ ] 8.4 Migrate the embed-with-local-image path to `requestUrl` with the multipart encoder, and run the full e2e suite
- [ ] 8.5 Add an e2e spec for the no-CORS capture-server mode (no CORS headers, `OPTIONS` rejected), and confirm both share types succeed
- [ ] 8.6 Run the live Discord check locally to confirm Discord accepts the hand-built multipart bodies
- [ ] 8.7 Confirm no `fetch(` calls remain in `src/`, and the CI matrix is green

## 9. Close out — `ods-vq3.5`

Depends on: 8.

- [ ] 9.1 Update the README's development section with how to run unit, e2e, and live tests
- [ ] 9.2 Tick every box here from its closed bead, then run `openspec archive add-e2e-testing-harness`

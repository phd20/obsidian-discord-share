# e2e-test-harness Specification

## Purpose
TBD - created by archiving change add-e2e-testing-harness. Update Purpose after archive.
## Requirements
### Requirement: Suite runs the built plugin in sandboxed Obsidian
The e2e suite SHALL load the plugin's production build (`main.js`, `manifest.json`, `styles.css`) into an Obsidian instance with a sandboxed configuration directory and a copy of a committed fixture vault. The suite MUST NOT read from or write to the user's personal Obsidian configuration or vaults.

#### Scenario: Running the suite locally
- **WHEN** a developer runs `npm run test:e2e`
- **THEN** the plugin is built, Obsidian is downloaded to `.obsidian-cache` if needed, and the specs run against a sandboxed instance with the plugin enabled and no trust prompt shown

#### Scenario: Fixture vault is not modified
- **WHEN** a test writes or deletes files in the vault
- **THEN** the committed fixture vault under `test/vaults/` is unchanged after the run

### Requirement: Fixture vaults contain no plugin settings
Fixture vaults SHALL contain only notes, attachments, and the minimum Obsidian config needed to open them. They MUST NOT contain a plugin `data.json` or any webhook URL.

#### Scenario: Committed fixtures are free of webhooks
- **WHEN** the repository is searched for `discord.com/api/webhooks` or `discordapp.com/api/webhooks`
- **THEN** no match is found outside of documentation placeholders

### Requirement: Settings are injected at runtime
Each test SHALL set the plugin settings it needs at runtime, including webhook URLs that point at the capture server. Injected settings MUST NOT be persisted to the vault.

#### Scenario: Single webhook injected
- **WHEN** a test injects one webhook pointing at the capture server and runs a share command
- **THEN** the capture server receives exactly one request, and no `data.json` exists for the plugin in the sandbox vault afterwards

### Requirement: Webhook capture server records outbound requests
The suite SHALL provide a local HTTP capture server, bound to `127.0.0.1` on an ephemeral port, that records every request the plugin sends. It records method, path, headers, raw body, and a parsed body: JSON, or multipart parts with name, filename, content type, size, and parsed `payload_json`. The server MUST answer CORS preflight requests, and MUST let a test choose the response status and body.

#### Scenario: JSON embed captured
- **WHEN** the plugin sends a JSON embed to the capture server
- **THEN** the test can read the recorded request's parsed `embeds[0]`, `username`, and `avatar_url`

#### Scenario: Multipart attachment captured
- **WHEN** the plugin sends an attachment to the capture server
- **THEN** the test can read a `files[0]` part with the original filename and byte size, and the parsed `payload_json`

#### Scenario: Configured error response
- **WHEN** a test configures the server to respond `413` and the plugin sends an attachment
- **THEN** the plugin receives a `413` response

### Requirement: Core sharing flows are covered
The suite SHALL include e2e specs for these flows. Each one asserts on the captured request and on the notice shown to the user:
- sharing an attachment from a nested folder
- sharing a note's properties as an embed
- sharing a note's content
- sharing a selection, from both the command and the editor context menu
- choosing between multiple webhooks
- an oversized-attachment error

#### Scenario: Nested attachment shares the right file
- **WHEN** the vault contains `attachments/b.png` and `img/nested/b.png` with different bytes, and the user picks `img/nested/b.png` in the attachment picker
- **THEN** the captured `files[0]` part has filename `b.png` and the bytes of `img/nested/b.png`

#### Scenario: Multiple webhooks prompt for a choice
- **WHEN** two webhooks are configured and the user runs a share command and picks the second
- **THEN** the request is received only at the second webhook's path

### Requirement: Suite runs in CI across platforms and Obsidian versions
A GitHub Actions workflow SHALL run the suite on pushes to `master` and on pull requests, on macOS, Windows, and Linux. Each runs Obsidian `earliest` (the manifest `minAppVersion`) and `latest`, and Linux also runs a mobile-emulation configuration. Downloaded Obsidian versions SHALL be cached between runs. Known exception: Windows is tested on `latest` only, because Obsidian `earliest` on Windows disconnects its renderer during the embeds spec and was not reproducible (bead `ods-acg`, won't fix).

#### Scenario: Windows regression caught in CI
- **WHEN** a change breaks attachment path resolution only on Windows
- **THEN** the `windows-latest` job fails and the pull request shows a failing check

#### Scenario: Cache reuse
- **WHEN** the workflow runs twice with the same resolved Obsidian versions
- **THEN** the second run restores `.obsidian-cache` instead of downloading Obsidian again

### Requirement: Optional live Discord check
The suite SHALL include a live check that sends one embed and one attachment to a real Discord webhook. The URL comes from `DISCORD_TEST_WEBHOOK_URL`: a gitignored `.env.test` locally, or a repository secret in CI. When the variable is unset the live check MUST be reported as skipped, not failed. The webhook URL MUST be redacted from all test output, logs, and failure messages. In CI the live check MUST NOT run on `pull_request` events.

#### Scenario: No webhook configured
- **WHEN** `DISCORD_TEST_WEBHOOK_URL` is unset and the suite runs
- **THEN** the live specs are reported as skipped and the run succeeds

#### Scenario: Webhook configured locally
- **WHEN** `.env.test` sets `DISCORD_TEST_WEBHOOK_URL` and the developer runs the live check
- **THEN** Discord accepts both requests (2xx) and the URL does not appear in the console output

#### Scenario: Secret files are ignored by git
- **WHEN** a developer creates `.env.test`
- **THEN** `git status` does not list it, and `.env.test.example` with a placeholder value is the only committed env file


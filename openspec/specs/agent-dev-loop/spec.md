# agent-dev-loop Specification

## Purpose
TBD - created by archiving change add-e2e-testing-harness. Update Purpose after archive.
## Requirements
### Requirement: Sandboxed, hot-reloading Obsidian for development
The project SHALL provide npm scripts that start a sandboxed Obsidian (latest version) on a copy of a fixture vault with the local plugin installed. The scripts SHALL rebuild and reload the plugin automatically when source files change.

#### Scenario: Change is picked up without restarting Obsidian
- **WHEN** the dev loop is running and a source file under `src/` is saved
- **THEN** `main.js` is rebuilt and the plugin reloads in the sandboxed Obsidian without a manual restart

#### Scenario: Personal vault untouched
- **WHEN** the dev loop is started
- **THEN** it opens a copy of a fixture vault in a sandboxed configuration directory, and the user's personal Obsidian configuration and vaults are not opened or modified

### Requirement: Claude drives the plugin through the Obsidian CLI
Claude SHALL be able to run plugin commands, evaluate JavaScript against `app`, read console output and errors, and take screenshots of the sandboxed instance using the Obsidian CLI (`command`, `eval`, `dev:console`, `dev:errors`, `dev:screenshot`). The workflow SHALL be documented in `CLAUDE.md`.

#### Scenario: Verifying a share command
- **WHEN** Claude runs the attachment share command through the CLI and picks a file
- **THEN** Claude can read the resulting request from the capture server's JSONL output and any errors from `dev:errors`

#### Scenario: Visual check
- **WHEN** Claude requests a screenshot through the CLI
- **THEN** a PNG of the sandboxed Obsidian window is saved to a path Claude can read

### Requirement: Vault-path guard before state-changing CLI calls
Before any CLI call that can change state or trigger network requests, the dev loop SHALL confirm that the vault of the instance the CLI is connected to is the sandbox copy. If the check fails, or no instance answers, the call MUST NOT be made, and Claude MUST stop and report instead of retrying.

#### Scenario: Personal Obsidian is running
- **WHEN** the CLI is connected to an instance whose vault path is not the sandbox copy
- **THEN** the guard refuses, no command is run, and Claude reports that the personal Obsidian must be closed

#### Scenario: No instance running
- **WHEN** no Obsidian instance is running and Claude attempts a guarded call
- **THEN** the guard fails without launching the default Obsidian and opening the personal vault, or, if the CLI launches one anyway, the guard detects the non-sandbox vault and refuses

### Requirement: Dev-loop webhooks go to the capture server
In the dev loop, plugin settings SHALL point at the local capture server, injected at runtime the same way as in the e2e suite, and captured requests SHALL be appended to a gitignored JSONL file.

#### Scenario: Reading what was sent
- **WHEN** a share command runs in the dev loop
- **THEN** a new line containing the parsed request appears in the capture JSONL file, and nothing is sent to Discord


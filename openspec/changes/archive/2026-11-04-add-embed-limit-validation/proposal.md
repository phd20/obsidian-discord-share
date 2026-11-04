## Why

Sharing a note or selection that breaks one of Discord's embed limits fails with little help. Nothing is checked before sending, so the embed goes out, Discord answers `400 Invalid Form Body`, and the notice shows the raw JSON. The old discord.js builder used to throw before sending (issues #53 and #54); since it was removed the failure is later but no clearer. The attachment path also decides "too large" with `message.includes("413")`, which misfires on any `400` body containing those digits. Issue #39 asks for validation and messages that say what is wrong.

## What Changes

- Add a pure `validateEmbed` check for Discord's embed limits (title, description, fields, field name and value, footer, author name, 25 fields, and the 6000-character total across the embed). It runs inside `shareEmbed` after defaults are merged and before the webhook is chosen, so the user is not prompted for a webhook and then told the share cannot work.
- A violation stops the send and shows a notice naming the field, its size and the limit, for example "Description is 7,412 characters; Discord allows 4,096."
- Parse Discord's webhook error responses into readable text, as a safety net for anything the pre-flight does not know. Real responses name only the index of a rejected embed (`{"embeds": ["0"]}`) for most errors, so this says "Discord rejected the embed" rather than raw JSON; only the 6000 total and the username come with a message. This makes the pre-flight the only source of field-level detail.
- Replace the substring match for `413` with a status check.
- Cover the pre-flight with e2e specs against the capture server (no request is sent), and the safety net with a canned `{"embeds": ["0"]}` response. Use the live spec to settle whether Discord counts UTF-16 units or code points, since a mock that shares our limits table cannot.
- Attachment size is not checked before sending. Discord's limit depends on the server's boost tier, so a hard-coded cap would block files that are valid. The `413` notice stays, but stops quoting a fixed "8MB".
- Out of scope: splitting long content across messages (issue #66), the `iconURL` / `icon_url` payload bug (bead `ods-5bw`, independent), and pre-flight checks for URLs, color range and username length, which Discord also rejects with little detail (follow-up bead).

## Capabilities

### New Capabilities
- `embed-limit-validation`: which Discord limits are checked before an embed is sent, when the check runs, and what the user is told when one is exceeded.

### Modified Capabilities
- `discord-webhook-delivery`: the "Failures are reported to the user" requirement changes. A `400` carrying Discord's field errors is reported in readable form rather than as raw JSON, `413` is recognised by status, not by text in the message, and the `413` notice no longer quotes a fixed size.

## Impact

- Code: `src/discord/DiscordManager.ts` (`shareEmbed`, failure handling in `shareAttachment`), a new validator module and a new response-error parser under `src/discord/` (each with Jest tests).
- Tests: Jest tests for the validator and parser; a new e2e spec for over-limit shares and the safety net (capture server unchanged); `test/specs/live.e2e.ts` gains a counting-unit check.
- Docs: README gets a short section on Discord's limits and the messages.
- No settings, command, or dependency changes. No change for shares that are within the limits.

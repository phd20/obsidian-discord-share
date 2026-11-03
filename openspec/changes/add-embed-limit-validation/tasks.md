## 1. Validator

- [x] 1.1 Add `src/discord/validateEmbed.ts`: a limits table, `measure()` (code points), `Violation` type, and `validateEmbed(embed)` covering title, description, footer text, author name, field count, field name and value, and the 6000 total; tolerates a non-array `fields`
- [x] 1.2 Add `src/discord/validateEmbed.test.ts`: each limit at and one over the boundary, combined total with and without defaults, astral characters, malformed `fields`
- [x] 1.3 Add a formatter that turns violations into the notice text (field, size, limit, thousands separators, at most four lines plus "and N more") with Jest tests
- [x] 1.4 Trim before measuring (`measure()` counts code points of `text.trim()`), and add the nothing-to-share violation (kind `empty`; no title, non-blank description, footer text, author name, fields, thumbnail or image), with wording in `formatViolations`; tests for each, including color-only, URL-only and whitespace-only

## 2. Response errors

- [x] 2.1 Add a `WebhookError` carrying `status` and `text`, and throw it from both non-2xx paths in `DiscordManager` (embed JSON, embed multipart, attachment)
- [x] 2.2 Record real 400 responses from a Discord test webhook as a test fixture, `test/fixtures/discord-webhook-errors.json` (webhook URL never committed; `npm run check:webhooks` stays clean). Finding: Discord returns `{"embeds": ["0"]}` for most embed errors, not a nested `50035` tree
- [x] 2.3 Add `describeDiscordError(status, text)`: reads `{ field: [string, ...] }` bodies (numeric string under `embeds` means "Discord rejected embed N", other strings shown with their field name), keeps the status, falls back to `HTTP <status>: <text>` cut to 300 characters; Jest tests for each recorded response, non-JSON and empty bodies
- [x] 2.4 Decide `413` in `shareAttachment` from `error.status`, and change its notice to "The file is larger than this Discord server accepts."
- [x] 2.5 Parser: bodies with a string `message` show it with the status; code 40005 on embeds adds the byte-size hint; Jest tests from the recorded `embedBytesOver` and `rateLimited` fixtures

## 3. Wire into sharing

- [x] 3.1 In `shareEmbed`, run the validator after the embed is built and before `getWebhookURL`; on violations show the notice (longer duration), `console.log` the full list, and return
- [x] 3.2 Use `describeDiscordError` in the embed failure path

## 4. End-to-end

- [ ] 4.1 New e2e spec: over-limit selection shows the notice and the capture server receives nothing; with two webhooks the picker does not appear
- [ ] 4.2 In the same spec: an at-limit selection is sent; a canned `400` `{"embeds": ["0"]}` response gives the readable notice without raw JSON
- [ ] 4.3 Update the oversized-attachment test in `test/specs/webhooks.e2e.ts` (and the "8MB" comment in `test/support/oversized.ts`) to the new `413` notice text, and add the `400` body containing `413` case
- [ ] 4.4 Add to `test/specs/live.e2e.ts`: a note whose description is 2000 emoji plus 2096 other characters is accepted, and one that is 4096 characters followed by trailing spaces is accepted (the counting questions in `design.md` were resolved by direct probes on 2026-11-02)
- [x] 4.5 Live check whether Discord rejects an embed with no text: it does; recorded in `design.md` decision 7, implemented as task 1.4
- [ ] 4.6 e2e: a frontmatter-only note shared as content sends nothing and the notice says there is nothing to share

## 5. Docs and wrap-up

- [x] 5.1 README: short section on Discord's embed limits and what the notices mean; remove or correct any "8MB" mention
- [ ] 5.2 Run `npm test`, `npm run test:e2e` and `npm run check:webhooks`; confirm with the dev loop that an over-limit share shows the notice and reaches the capture server zero times
- [ ] 5.3 Comment on issue #39 with the outcome and link #66 for splitting

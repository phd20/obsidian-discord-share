## Context

`shareEmbed` in `src/discord/DiscordManager.ts` merges frontmatter or selection params with the default embed settings, builds a Discord-shaped `embed`, asks for a webhook (a picker when several are configured), then POSTs through `requestUrl` with `throw: false`. Any non-2xx becomes `new Error("HTTP <status>: <text>")` and a notice `Failed to share embed to Discord. <message>.`. Nothing is checked before sending, and the only status-specific logic is `error.message.includes("413")` in `shareAttachment`.

Discord's webhook limits that matter here: embed title 256, description 4096, up to 25 fields (name 256, value 1024), footer text 2048, author name 256, and 6000 characters of embed text in total. Issue #39 asks for validation and clearer messages; #53 and #54 were folded into it. Splitting long content is separate (issue #66).

## Goals / Non-Goals

**Goals:**
- Stop a share that cannot succeed before the user is asked for a webhook, and say which field is over and by how much.
- When Discord rejects something we did not predict, show its field errors readably instead of raw JSON.
- Recognise `413` by status.

**Non-Goals:**
- Splitting or truncating content (issue #66).
- Validating URLs, colors, usernames or icon URLs. The `iconURL` / `icon_url` payload bug (`ods-5bw`) is independent; this change neither depends on it nor fixes it.
- A pre-flight attachment size check.
- Fixing malformed `ods-fields` frontmatter. The validator only has to not throw on it.

## Decisions

**1. A pure validator over the final embed.** `validateEmbed(embed): Violation[]` in `src/discord/validateEmbed.ts`, with no `obsidian` import, so Jest covers it like `markdown.ts` and `multipart.ts`. It takes the Discord-shaped embed `shareEmbed` has just built, after defaults are merged, so default footers and fields count toward the 6000 total. A `Violation` carries a field label, the actual size and the limit. Limits live in one constants table. Alternative: validate the raw params earlier. Rejected because it would miss defaults and the combined total.

**2. Call site: after building the embed, before `getWebhookURL`.** A violation shows the notice and returns, so no picker appears for a share that cannot work. This applies to every caller of `shareEmbed` (Properties, Content, Selection, context menu) with no change to them.

**3. One notice, bullet lines.** `Failed to share embed to Discord.` stays as the first line (existing specs and e2e match on that prefix), followed by up to four lines like `Description is 7,412 characters; Discord allows 4,096.` and `and N more` beyond that. The notice stays up longer than the default because the user has to act on it. The full list also goes to `console.log`, like other failures.

**4. Safety net: a typed error and a response parser.** The non-2xx path throws a `WebhookError` with `status` and `text` instead of folding both into a string. `describeDiscordError(status, text)` returns a readable string. Real webhook responses (recorded 2026-11-02, `test/fixtures/discord-webhook-errors.json`) are not the nested `50035` tree: a rejected embed comes back as `{"embeds": ["0"]}` (the index only, for length, count, URL and color errors), the 6000 total as `{"embeds": ["Embed size exceeds maximum size of 6000"]}`, and a bad username as `{"username": ["Must be between 1 and 80 in length."]}`. So the parser reads the shape `{ field: [string, ...] }`: a numeric string under `embeds` becomes "Discord rejected embed N but did not say which part", any other string is shown with its field name ("Username: Must be between 1 and 80 in length."), and the status is kept in the text. Anything else, or unparseable text, falls back to the current `HTTP <status>: <text>` with the text cut to about 300 characters. The nested `50035` form is not parsed: no webhook response observed uses it.

Consequence: Discord gives no detail for most embed errors, so the pre-flight is the only source of field-level messages and its limits table must be complete. URL, color and username checks are not in this change (follow-up bead). `shareAttachment` decides on `error.status === 413`. Alternative: keep matching message text. Rejected: a `400` body containing "413" is misreported today.

**5. The `413` notice stops quoting 8MB.** Discord's upload limit depends on the server's boost tier and has changed over time, so any number is wrong for someone. New text: `Failed to share <filename> to Discord. The file is larger than this Discord server accepts.` The attachment path gets no pre-flight for the same reason.

**6. Counting unit: code points, isolated in one function.** `measure(text)` is the only place length is computed. It counts code points (`[...text].length`). If Discord actually counts UTF-16 units, we under-count astral characters, a request goes out and Discord's `400` is shown by the safety net: wrong in the safe direction. The reverse mistake would block valid shares, which is worse. The live spec decides (see Open Questions), and flipping is a one-line change.

**7. Tests.** Jest for the validator (each limit at and over the boundary, combined total, defaults, astral characters, malformed `fields`) and for the parser (each real recorded response, non-JSON, empty). The e2e spec shares an over-limit selection and asserts the notice and an empty `captures` list (and no webhook picker with two webhooks configured), then makes the capture server answer a canned `{"embeds": ["0"]}` for something the pre-flight allows and asserts the readable notice. No capture-server change: it already supports canned responses, and a mock that imported our own limits table would only agree with the plugin by construction. The live spec is the check against Discord.

## Risks / Trade-offs

- [Discord changes a limit and the pre-flight blocks a share that would work] → Limits are one table, and the issue is visible in the notice; the safety net means a limit that is too loose degrades to a readable `400`, not a silent failure. A too-tight limit has no bypass; accepted, since the limits are long-stable.
- [Our count differs from Discord's: unit or whitespace trimming] → Code points err towards sending; the live spec checks both. Mismatches near a boundary fall to the safety net.
- [The recorded response fixtures drift from what Discord really sends] → They were recorded from a real webhook; re-record if a live check shows a different shape.
- [Opaque Discord errors for URL, color and username remain] → Follow-up bead; the safety net says "Discord rejected the embed" at least, instead of raw JSON.
- [Discord accepts empty field names/values and an empty footer text (observed 204)] → Not validated; adding checks Discord does not require would block valid shares.
- [Notice is long for several violations] → Cap at four lines plus "and N more".

## Open Questions

- Does Discord count code points or UTF-16 units? Live spec: share a description of exactly 4096 astral characters (accepted means code points).
- Does Discord trim leading and trailing whitespace before counting?
- Does Discord reject an embed with no text at all (a note with only frontmatter shares an embed with just a timestamp)? If it does, a "nothing to share" violation may belong here or in a follow-up.

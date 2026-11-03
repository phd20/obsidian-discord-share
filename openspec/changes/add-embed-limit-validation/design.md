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

**6. Counting: code points, trimmed.** `measure(text)` is the only place length is computed. It counts Unicode code points of the trimmed text (`[...text.trim()].length`). Both choices were checked against a real webhook on 2026-11-02: a description of 2000 emoji and 2096 other characters (4096 code points, 6096 UTF-16 units) is accepted and 4097 code points is rejected, and a 4096-character description followed by spaces or newlines is accepted (title and footer trim too). The same trimmed text decides whether a part is present at all.

**7. Nothing-to-share check.** Discord rejects, with the opaque `{"embeds": ["0"]}`, an embed that has none of title, description, footer text, author name, fields, thumbnail or image (color-only, URL-only, whitespace-only description and timestamp-only were all rejected; title-only, footer-only, author-only, fields-only and thumbnail-only were accepted). Sharing the properties of a note whose frontmatter has no `ods-` properties hits this when no defaults are set (the Content command always sets the note's name as the title, so it cannot). `validateEmbed` reports it as a violation of kind `empty` ("Nothing to share: the embed has no title, description, fields, footer, author or image.") so the pre-flight explains it. Image-only was rate-limited during the probe and is treated as valid.

**8. Embed byte cap.** Discord also rejects an embed message above roughly 10 KB of UTF-8 (bisected on 2026-11-02: the largest accepted request body was 10,174 bytes for a CJK-only description, 10,177 was rejected). It answers `413`, code 40005, with one of three messages (`... message.embeds=N`, `... unknown (diagnosis failed)`, `Request entity too large`). This bites well below the character limits for non-Latin text (about 3,380 Chinese characters, about 2,500 emoji) and the live spec hit it. The pre-flight therefore sums the UTF-8 bytes of the trimmed embed text and refuses above 10,000, about 1.7% under the measured edge so nothing Discord accepts is blocked. The JSON around the text also counts toward Discord's cap, so the check is a floor, not a guarantee; a miss is shown by the parser with a hint on any code 40005. Alternative: no pre-check, hint only. Rejected: it leaves non-Latin users with Discord's wording and no field-level detail, which is what the issue complains about. Risk: Discord changes the cap; the number is one constant.

**9. Tests.** Jest for the validator (each limit at and over the boundary, combined total, defaults, astral characters, malformed `fields`) and for the parser (each real recorded response, non-JSON, empty). The e2e spec shares an over-limit selection and asserts the notice and an empty `captures` list (and no webhook picker with two webhooks configured), then makes the capture server answer a canned `{"embeds": ["0"]}` for something the pre-flight allows and asserts the readable notice. No capture-server change: it already supports canned responses, and a mock that imported our own limits table would only agree with the plugin by construction. The live spec is the check against Discord.

## Risks / Trade-offs

- [Discord changes a limit and the pre-flight blocks a share that would work] → Limits are one table, and the issue is visible in the notice; the safety net means a limit that is too loose degrades to a readable `400`, not a silent failure. A too-tight limit has no bypass; accepted, since the limits are long-stable.
- [Our count differs from Discord's] → Code points and trimming were verified against a real webhook; the live spec keeps checking them. Mismatches near a boundary fall to the safety net.
- [The byte cap changes or differs per server] → One constant; the check sits below the measured edge, and a miss is shown with a hint.
- [The recorded response fixtures drift from what Discord really sends] → They were recorded from a real webhook; re-record if a live check shows a different shape.
- [Opaque Discord errors for URL, color and username remain] → Follow-up bead; the safety net says "Discord rejected the embed" at least, instead of raw JSON.
- [Discord accepts empty field names/values and an empty footer text (observed 204)] → Not validated; adding checks Discord does not require would block valid shares.
- [Notice is long for several violations] → Cap at four lines plus "and N more".

## Open Questions

- Resolved 2026-11-02: Discord counts code points, trims before counting, and rejects an embed with no text (see decisions 6 and 7).
- Is the byte cap the same on every server and over time? Measured once, on one webhook.
- Does an image-only embed pass? It was rate-limited during the probe; assumed valid.

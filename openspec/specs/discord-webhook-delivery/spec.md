# discord-webhook-delivery Specification

## Purpose
TBD - created by archiving change add-e2e-testing-harness. Update Purpose after archive.
## Requirements
### Requirement: Embeds are sent as JSON
When an embed has no local image attachment, the plugin SHALL POST to the webhook a JSON body (`Content-Type: application/json`) containing `username`, `avatar_url`, and a single-element `embeds` array. `username` and `avatar_url` SHALL default to "Obsidian Share" and the default avatar URL when no custom values are set.

#### Scenario: Share note properties
- **WHEN** the active note has frontmatter `ods-title: Hello` and `ods-color: "#ff0000"`, and the user runs "Share Current Note to Discord (Properties)"
- **THEN** the webhook receives JSON whose `embeds[0].title` is `Hello` and `embeds[0].color` is `16711680`, and the notice "Successfully shared embed to Discord!" is shown

#### Scenario: Share selection
- **WHEN** the user selects text and runs "Share Selection to Discord"
- **THEN** the webhook receives JSON whose `embeds[0].description` is the selection with Obsidian formatting removed

### Requirement: Attachments are sent as multipart
When sharing an attachment, the plugin SHALL POST a `multipart/form-data` body containing a `files[0]` part with the chosen file's bytes and filename, and a `payload_json` part containing `username` and `avatar_url`. The file SHALL be resolved by its vault-relative path, so files outside the attachments folder are shared correctly on every platform.

#### Scenario: Attachment in a nested folder
- **WHEN** the user picks `img/nested/b.png` in the attachment picker
- **THEN** the webhook receives a `files[0]` part named `b.png` with the bytes of `img/nested/b.png`, and the notice "Successfully shared b.png to Discord!" is shown

### Requirement: Embeds with a local image attach the image
When an embed's image property is a link to a local file (for example `ods-image: [[b.png]]`), the plugin SHALL send a multipart body containing the file as `files[0]` and a `payload_json` whose `embeds[0].image.url` is `attachment://<filename>`. When the image property is a URL, the plugin SHALL send JSON with `embeds[0].image.url` set to that URL.

#### Scenario: Local image property
- **WHEN** the active note has `ods-image: [[b.png]]` and the user shares its properties
- **THEN** the webhook receives a multipart request with `files[0]` named `b.png`, and `payload_json.embeds[0].image.url` equal to `attachment://b.png`

### Requirement: Webhook selection when several are configured
When more than one webhook is configured, the plugin SHALL ask the user to choose one before sending, and SHALL send only to the chosen webhook. With exactly one webhook configured, it SHALL send without prompting.

#### Scenario: Two webhooks configured
- **WHEN** two webhooks are configured and the user shares a selection
- **THEN** a picker listing both webhook descriptions appears, and only the chosen webhook receives the request

### Requirement: Failures are reported to the user
When the webhook responds with a non-2xx status, the plugin SHALL show a failure notice that includes the status. When the response body is a JSON object of field names to lists of messages (for example `{"username": ["Must be between 1 and 80 in length."]}`), the notice SHALL show each message with its field name, not the raw JSON. When the body is a JSON object with a string `message` (for example rate limiting or an oversized request), the notice SHALL show that message with the status. When Discord names only the index of the rejected embed (`{"embeds": ["0"]}`), the notice SHALL say that Discord rejected the embed without saying which part, and SHALL NOT show the raw JSON. A response with status `413` to an attachment SHALL produce the notice "Failed to share <filename> to Discord. The file is larger than this Discord server accepts." The `413` decision SHALL be made from the response status alone, never from text in the response body.

#### Scenario: Oversized attachment
- **WHEN** the webhook responds `413` to an attachment upload of `big.png`
- **THEN** the notice "Failed to share big.png to Discord. The file is larger than this Discord server accepts." is shown

#### Scenario: Server error on embed
- **WHEN** the webhook responds `500` to an embed
- **THEN** a notice starting "Failed to share embed to Discord." and containing `500` is shown

#### Scenario: Discord rejects the embed without saying why
- **WHEN** the webhook responds `400` with the body `{"embeds": ["0"]}`
- **THEN** the notice starts "Failed to share embed to Discord.", says Discord rejected the embed without saying which part, contains `400`, and does not contain the raw JSON braces

#### Scenario: Discord names the rejected field
- **WHEN** the webhook responds `400` with the body `{"username": ["Must be between 1 and 80 in length."]}`
- **THEN** the notice contains "Username" and "Must be between 1 and 80 in length." and `400`, and does not contain the raw JSON braces

#### Scenario: Discord reports the embed is too large in bytes
- **WHEN** the webhook responds `413` to an embed with code `40005` and any of the messages "Message size exceeds maximum allowed. Oversized fields: message.embeds=16414", "... Oversized fields: unknown (diagnosis failed)" or "Request entity too large"
- **THEN** the notice contains Discord's message and `413`, and advises shortening the text because emoji and many non-Latin scripts take several bytes per character

#### Scenario: Rate limited
- **WHEN** the webhook responds `429` with the body `{"message": "You are being rate limited.", "retry_after": 0.3}`
- **THEN** the notice contains "You are being rate limited." and `429`

#### Scenario: Unparseable error body
- **WHEN** the webhook responds `502` with an HTML body
- **THEN** the notice contains `502` and at most the first 300 characters of the body

#### Scenario: A `413` in the body of another error
- **WHEN** the webhook responds `400` to an attachment with a body containing the digits `413`
- **THEN** the "larger than this Discord server accepts" notice is not shown

### Requirement: Requests are not subject to browser CORS rules
The plugin SHALL send webhook requests through Obsidian's `requestUrl` API rather than the renderer's `fetch()`, so that delivery does not depend on the destination's CORS headers. All other requirements in this capability MUST continue to hold.

#### Scenario: Destination without CORS headers
- **WHEN** the capture server is configured to send no CORS headers and to reject `OPTIONS` requests, and the user shares an embed and an attachment
- **THEN** both requests are received and both success notices are shown


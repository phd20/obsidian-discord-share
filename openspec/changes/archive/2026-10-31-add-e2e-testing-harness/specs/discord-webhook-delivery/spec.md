## ADDED Requirements

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
When the webhook responds with a non-2xx status, the plugin SHALL show a failure notice that includes the status. A `413` response to an attachment SHALL produce the notice "Failed to share <filename> to Discord. Attachments must be smaller than 8MB."

#### Scenario: Oversized attachment
- **WHEN** the webhook responds `413` to an attachment upload of `big.png`
- **THEN** the notice "Failed to share big.png to Discord. Attachments must be smaller than 8MB." is shown

#### Scenario: Server error on embed
- **WHEN** the webhook responds `500` to an embed
- **THEN** a notice starting "Failed to share embed to Discord." and containing `500` is shown

### Requirement: Requests are not subject to browser CORS rules
The plugin SHALL send webhook requests through Obsidian's `requestUrl` API rather than the renderer's `fetch()`, so that delivery does not depend on the destination's CORS headers. All other requirements in this capability MUST continue to hold.

#### Scenario: Destination without CORS headers
- **WHEN** the capture server is configured to send no CORS headers and to reject `OPTIONS` requests, and the user shares an embed and an attachment
- **THEN** both requests are received and both success notices are shown

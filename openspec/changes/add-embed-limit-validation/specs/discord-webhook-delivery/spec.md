## MODIFIED Requirements

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

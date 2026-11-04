# embed-limit-validation Specification

## Purpose
Stop an embed that Discord would reject before it is sent, and tell the user which part is too large. Discord often rejects an embed with no detail (`{"embeds": ["0"]}`), so the plugin's own check is the only source of field-level messages. Covers the length, count and total limits, the byte-size cap, empty embeds, and how text is measured. How Discord's own error responses are shown is in `discord-webhook-delivery`.
## Requirements
### Requirement: Embeds are checked against Discord's limits before sending
Before asking for a webhook or sending anything, the plugin SHALL check the embed it is about to share, after settings defaults have been merged, against these limits: title 256 characters, description 4096, footer text 2048, author name 256, at most 25 fields, each field name 256 and value 1024, and 6000 characters in total across title, description, field names and values, footer text and author name. When any limit is exceeded the plugin SHALL NOT send a request and SHALL NOT show the webhook picker. A value exactly at a limit SHALL be accepted. This applies to every embed share: note properties, note content, selection (command and context menu).

#### Scenario: Description over the limit
- **WHEN** the user shares a selection of 5000 characters
- **THEN** no request reaches the webhook and a failure notice is shown

#### Scenario: No webhook prompt for a share that cannot succeed
- **WHEN** two webhooks are configured and the user shares a selection of 5000 characters
- **THEN** the webhook picker does not appear and no request reaches either webhook

#### Scenario: Description exactly at the limit
- **WHEN** the user shares a selection of exactly 4096 characters
- **THEN** the webhook receives the embed and the success notice is shown

#### Scenario: Each part within its limit but the total over 6000
- **WHEN** a note's properties give a 4000-character description and the settings define a default footer and fields that bring the embed's text to 6500 characters
- **THEN** no request is sent and the notice reports the 6000-character total

#### Scenario: Too many fields
- **WHEN** a note's `ods-fields` lists 26 fields
- **THEN** no request is sent and the notice reports the 25-field limit

#### Scenario: Malformed fields do not crash the check
- **WHEN** a note's `ods-fields` is not a list
- **THEN** the check completes without an exception

### Requirement: Violations are reported with the field, its size and the limit
When the embed exceeds a limit, the plugin SHALL show one failure notice that starts with "Failed to share embed to Discord." and then names each exceeded limit with the field, its actual size and the allowed size. The notice SHALL list at most four violations and summarize any others as a count. Counts SHALL be shown with thousands separators.

#### Scenario: One violation
- **WHEN** the user shares a selection of 7412 characters
- **THEN** the notice contains "Description is 7,412 characters; Discord allows 4,096."

#### Scenario: Several violations
- **WHEN** the embed has a 300-character title and a 5000-character description
- **THEN** one notice lists both the title and the description violations

#### Scenario: More than four violations
- **WHEN** six limits are exceeded
- **THEN** the notice lists four and states that two more were found

### Requirement: Defaults count toward the limits
The check SHALL use the embed as it will be sent, including values from the default embed settings, so that a default footer, author or fields contribute to the totals.

#### Scenario: Default footer pushes a note over the total
- **WHEN** the settings define a 2000-character default footer and the shared description is 4096 characters with a 256-character title
- **THEN** the notice reports the 6000-character total

### Requirement: Length is measured in Unicode code points, ignoring surrounding whitespace
The plugin SHALL measure lengths in Unicode code points, so a character outside the Basic Multilingual Plane (such as an emoji) counts once, and SHALL ignore leading and trailing whitespace, as Discord does. A request Discord would accept SHALL NOT be refused because of how the plugin counts.

#### Scenario: Astral characters count once
- **WHEN** the user shares a description of 500 emoji and 3596 other characters (4096 code points, 4596 UTF-16 units)
- **THEN** the webhook receives the embed and the success notice is shown

#### Scenario: Surrounding whitespace is ignored
- **WHEN** the user shares a note's content that is 4096 characters followed by three trailing spaces
- **THEN** the webhook receives the embed and the success notice is shown

### Requirement: Embeds with nothing to show are refused
The plugin SHALL NOT send an embed that has none of: a title, a non-blank description, footer text, an author name, a field, a thumbnail or an image, because Discord rejects it without saying why. The failure notice SHALL start with "Failed to share embed to Discord." and say that there is nothing to share.

#### Scenario: Note with frontmatter but no embed properties
- **WHEN** the user shares the properties of a note whose frontmatter has no `ods-` properties, and no default title, description, footer, author or fields are set in the settings
- **THEN** no request is sent and the notice says there is nothing to share

#### Scenario: Only a color is set
- **WHEN** the embed has a color and a URL but no text
- **THEN** no request is sent and the notice says there is nothing to share

#### Scenario: A default title is enough
- **WHEN** the note's frontmatter has no `ods-` properties but a default embed title is set in the settings
- **THEN** the embed is sent

### Requirement: Embed text is checked against Discord's size cap in bytes
Discord also rejects an embed message above roughly 10 KB of UTF-8. The plugin SHALL refuse to send an embed whose text (title, description, field names and values, footer text and author name, trimmed) is larger than 10,000 UTF-8 bytes, with a violation reported in the same notice as the other limits: "Embed text is <n> bytes; Discord allows about 10,000. Emoji and many non-Latin scripts take 3 to 4 bytes per character." The threshold is deliberately below the measured edge, so no embed Discord accepts is refused.

#### Scenario: Chinese text under the character limit but over the byte cap
- **WHEN** the user shares a selection of 3500 Chinese characters (10,500 bytes)
- **THEN** no request is sent and the notice contains "Embed text is 10,500 bytes"

#### Scenario: Two-byte text up to the character limit
- **WHEN** the user shares a selection of 4096 characters that are each two bytes in UTF-8
- **THEN** the webhook receives the embed

### Requirement: Attachment size is not checked before sending
The plugin SHALL NOT refuse an attachment on size before sending, because Discord's upload limit depends on the server. The decision SHALL come from the webhook's response.

#### Scenario: Large attachment is sent
- **WHEN** the user shares a 12 MB attachment
- **THEN** the plugin sends the request and reports the outcome from the response


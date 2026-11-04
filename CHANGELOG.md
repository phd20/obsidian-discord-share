## 2.7.0
- Check embeds against Discord's limits before sending, and say what is too large, for example "Description is 7,412 characters; Discord allows 4,096." Nothing is sent and the webhook prompt is skipped. Checks title, description, footer, author, fields and the 6000-character total, counting characters the way Discord does (#39, #53, #54)
- Refuse embeds Discord would reject without explanation: ones with no text, and ones over Discord's size cap of roughly 10 KB (Chinese text hits it at about 3,380 characters, emoji-heavy text at about 2,500)
- Show what Discord said when it rejects a share, instead of raw JSON. The "file too large" notice for attachments no longer quotes a fixed 8MB, since the limit depends on the server

## 2.6.2
- Fix sharing an attachment from a folder other than the root attachments folder (the wrong file could be shared, or "File not found" shown), notably on Windows. Thanks to Xymok3 (#62)
- Send webhook requests with Obsidian's `requestUrl` instead of `fetch`, so they are no longer blocked by CORS

## 2.5.2
- Fix the settings migration bug that would prevent fresh installs

## 2.5.1
- Bypass WebhookURLModal if only 1 webhook exists in settings
- Refactors commands to remove WebhookURLModal and centralizes it within the DiscordManager
- Cleaned up some checking conditions on commands

## 2.5.0
- Adds Embed Default Values to the plugin's settings
- Significant refactoring
- Updates the structure of the plugin's settings (with built-in migration support)

## 2.4.1
- Adds Discord "formatting" (removing certain Obsidian characters) to the Share Selection to Discord commands.
- Updates the Webhook calls to Discord to use Obsidian's recommended practices for handling promises.
- Updates Funding link to point at Patreon

## 2.4.0
- Adds the `Share Current Note to Discord (Content)` command
- Upgrades `esbuild`

## 2.0.0
- Removes the `Share Note Title to Discord` command
- Refactors embed sharing code
- Adds the `Share Selection to Discord` command

## 1.2.1
- Fixes an issue where missing `ods-fields` would prevent sharing an embed

## 1.2.0
- Adds the `Share Embed to Discord` command

## 1.1.1
- Fixes an issue with filepaths for attachments on Windows

## 1.1.0
- Requires `DiscordWebhookURL` to be set to show command(s)
- Adds the `Share Note Title to Discord` command
- Adds settings for `Custom Discord Bot Username` and `Custom Discord Bot Avatar`
- Removes the side ribbon icon for `Share Attachment to Discord` command
- Replaces the term `send` with `share` in commands and code
- General code cleanup and minor restructure

## 1.0.1
- Initial release with a few fixes from 1.0.0 testing
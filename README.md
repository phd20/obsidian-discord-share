# Discord Share Plugin

> **Warning**
> This plugin should be considered experimental.

This plugin allows you to share your Obsidian Vault content to Discord using [discord.js](https://discord.js.org/).

## Setup
1. [Install the Plugin](#install-the-plugin)
2. Enable it.
3. Get a Webhook URL from Discord. See [this guide](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks) for more on how to do this.
4. Paste your Discord Webhook URL into the `Discord Webhook URL` setting for this plugin. **You must do this or the plugin will not work.**

### [Install the Plugin](#install-the-plugin)
You have two options for installing the plugin.

1. Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-discord-share/`.
2. Use the Obsidian [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin (recommended).

### Optional Settings
- You can customize the username that appears for the Discord bot by updating the `Custom Discord Bot Username` setting.
- You can customize the avatar that appears for the Discord bot by updating the `Custom Discord Bot Avatar` setting. This requires the URL of an image.
- By default, the plugin will search all files for attachments. You can choose which folder to look for attachments in by updating the `Attachments folder` setting. If you set this, the plugin will only search that folder and all folders within it.
- You can turn on/off image previews in the local image search by adjusting the `Show preview images` setting.
- You can change the number of suggestions to show in the local image search by changing the `Suggestions limit` setting.

## Features

## Share Attachment to Discord

Open the command palette and search for **Share Attachment to Discord**. Click on it or press `return` on your keyboard. This opens a modal to search your local image files. Search for the file you want and click on it or press `return` on your keyboard.

## Share Note Title to Discord

Open the command palette and search for **Share Note Title to Discord**. Click on it or press `return` on your keyboard. **This option will not show in the menu if you don't have a note open.**

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/C0C8XS4N)

# Discord Share Plugin

![Obsidian Discord](https://user-images.githubusercontent.com/33853403/200464422-a66e62ee-08c9-4e75-bdc2-9bd585cef2ab.png)

This plugin allows you to share your Obsidian Vault content to Discord using [discord.js](https://discord.js.org/).

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/C0C8XS4N)

- [Discord Share Plugin](#discord-share-plugin)
  - [Setup](#setup)
    - [Install the Plugin](#install-the-plugin)
    - [Optional Settings](#optional-settings)
  - [Features](#features)
  - [Share Attachment to Discord](#share-attachment-to-discord)
  - [Share Embed to Discord](#share-embed-to-discord)
    - [Example Frontmatter](#example-frontmatter)
  - [Share Selection to Discord](#share-selection-to-discord)

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
- You can customize the default embed color by setting `Embed Color`. If a note specifies an embed color, it will override this setting.

## Features

![discord-share](https://user-images.githubusercontent.com/33853403/200182343-fb077076-2ef4-400b-b651-5f430ff89063.gif)

## [Share Attachment to Discord](#share-attachment-to-discord)

Open the command palette and search for **Share Attachment to Discord**. Click on it or press `return` on your keyboard. This opens a modal to search your local image files. Search for the file you want and click on it or press `return` on your keyboard.

## [Share Embed to Discord](#share-embed-to-discord)

Open the command palette and search for **Share Embed to Discord**. Click on it or press `return` on your keyboard. **This option will not show in the menu if you don't have a note open.**

This feature parses YAML frontmatter for the current note and shares it to Discord in a formatted embed. It's a great way to share prepared information with images and links.

### Example Frontmatter

```
ods-color: '#8D59D7' # If provided, this will override the `Embed Color` setting in the plugin's settings tab. 
ods-title: Discord Share
ods-url: 'https://github.com/phd20/obsidian-discord-share'
ods-author:
  name: PhD20
  iconURL: 'https://avatars.githubusercontent.com/u/33853403'
  url: 'https://github.com/phd20'
ods-description: >-
  This plugin allows you to share your Obsidian Vault content to Discord
ods-thumbnail-url: 'https://avatars.githubusercontent.com/u/65011256'
ods-fields: # You can add or remove fields. 
  - name: Version
    value: 1.2.0
    inline: true
  - name: Install
    value: Ready
    inline: true
  - name: Awesome?
    value: Yes
    inline: true
ods-image: https://user-images.githubusercontent.com/33853403/200464422-a66e62ee-08c9-4e75-bdc2-9bd585cef2ab.png # This can be a URL or a link to an image in your vault: [[image.png]]. NOTE: embeds will not properly attach the image from your vault if it has spaces in the name. Example: [[image name.png]]
ods-footer:
  text: Build using discord.js
  iconURL: 'https://avatars.githubusercontent.com/u/26492485'
```

## [Share Selection to Discord](#share-selection-to-discord)

Open a file editor and select (highlight) any text. You can send this text to Discord in one of two ways:

1. Open the command palette and search for **Share Selection to Discord**. Click on it or press `return` on your keyboard.
2. Right-click on your selection to open the context menu. Choose **Share selection to Discord**.

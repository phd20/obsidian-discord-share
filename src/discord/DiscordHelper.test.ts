import DiscordHelper from './DiscordHelper';
import { TFile } from 'obsidian';
import { DiscordEmbedAuthor, DiscordEmbedColor, DiscordEmbedDescription, DiscordEmbedFields, DiscordEmbedFooter, DiscordEmbedImage, DiscordEmbedThumbnail, DiscordEmbedTitle, DiscordEmbedURL } from './constants';
import { ISettingsOptions } from 'src/Settings';

// Mocking dependencies
const mockPlugin = {
  app: {
    metadataCache: {
      getFileCache: jest.fn(),
    },
    vault: {
      adapter: {
        read: jest.fn(),
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockSettings: ISettingsOptions = {
  discordWebhookURL: [],
	attachmentsFolder: "",
	localSuggestionsLimit: 10,
	showPreviewInLocalModal: true,
	customBotUsername: "",
	customBotAvatarURL: "",
	useNoteTitleForEmbed: false,
	embedPropertyOverrides: {
		embedTitlePropertyOverride: "",
		embedColorPropertyOverride: "",
		embedURLPropertyOverride: "",
		embedAuthorPropertyOverride: "",
		embedDescriptionPropertyOverride: "",
		embedThumbnailPropertyOverride: "",
		embedFieldsPropertyOverride: "",
		embedImagePropertyOverride: "",
		embedFooterPropertyOverride: "",
	},
}

let initSettings: ISettingsOptions = {
  discordWebhookURL: [],
	attachmentsFolder: "",
	localSuggestionsLimit: 10,
	showPreviewInLocalModal: true,
	customBotUsername: "",
	customBotAvatarURL: "",
	useNoteTitleForEmbed: false,
	embedPropertyOverrides: {
		embedTitlePropertyOverride: "",
		embedColorPropertyOverride: "",
		embedURLPropertyOverride: "",
		embedAuthorPropertyOverride: "",
		embedDescriptionPropertyOverride: "",
		embedThumbnailPropertyOverride: "",
		embedFieldsPropertyOverride: "",
		embedImagePropertyOverride: "",
		embedFooterPropertyOverride: "",
	},
}

describe('DiscordHelper', () => {
  let discordHelper: DiscordHelper;

  beforeEach(() => {
    discordHelper = new DiscordHelper(mockPlugin);
    mockSettings = {
      ...initSettings,
      embedPropertyOverrides: {
        ...initSettings.embedPropertyOverrides,
      }
    };
  });

  describe('buildDiscordEmbedParamsFromFile', () => {
    it('returns undefined if no metadata is found', () => {
      const result = discordHelper.buildDiscordEmbedParamsFromFile({} as TFile, mockSettings);
      expect(result).toBeUndefined();
    });

    it('returns undefined if no frontmatter is found', () => {
      mockPlugin.app.metadataCache.getFileCache.mockReturnValueOnce({});
      const result = discordHelper.buildDiscordEmbedParamsFromFile({} as TFile, mockSettings);
      expect(result).toBeUndefined();
    });

    it('builds Discord embed params with default values', () => {
      const mockFile = {
        basename: 'TestFile',
      } as TFile;

      const mockFrontmatter = {
        [DiscordEmbedTitle]: 'defaultTitle',
        [DiscordEmbedColor]: 'defaultColor',
        [DiscordEmbedURL]: 'defaultUrl',
        [DiscordEmbedAuthor]: 'defaultAuthor',
        [DiscordEmbedDescription]: 'defaultDescription',
        [DiscordEmbedThumbnail]: 'defaultThumbnail',
        [DiscordEmbedFields]: 'defaultFields',
        [DiscordEmbedImage]: 'defaultImage',
        [DiscordEmbedFooter]: 'defaultFooter',
      };

      mockPlugin.app.metadataCache.getFileCache.mockReturnValueOnce({
        frontmatter: mockFrontmatter,
      });

      const result = discordHelper.buildDiscordEmbedParamsFromFile(mockFile, mockSettings);

      expect(result).toEqual({
        color: 'defaultColor',
        title: 'defaultTitle',
        url: 'defaultUrl',
        author: 'defaultAuthor',
        description: 'defaultDescription',
        thumbnail: 'defaultThumbnail',
        fields: 'defaultFields',
        image: 'defaultImage',
        footer: 'defaultFooter',
        file: mockFile,
      });
    });

    it('uses the global color setting if none exists in frontmatter', () => {
      const mockFile = {
        basename: 'TestFile',
      } as TFile;

      const mockFrontmatter = {
        [DiscordEmbedTitle]: 'defaultTitle',
      };

      mockPlugin.app.metadataCache.getFileCache.mockReturnValueOnce({
        frontmatter: mockFrontmatter,
      });

      mockSettings.embedPropertyOverrides.embedColorPropertyOverride = "red";

      const result = discordHelper.buildDiscordEmbedParamsFromFile(mockFile, mockSettings);

      expect(result?.color).toBe("red");
    });

    it('uses the frontmatter color setting over the global setting', () => {
      const mockFile = {
        basename: 'TestFile',
      } as TFile;

      const mockFrontmatter = {
        [DiscordEmbedColor]: 'blue',
        [DiscordEmbedTitle]: 'defaultTitle',
      };

      mockPlugin.app.metadataCache.getFileCache.mockReturnValueOnce({
        frontmatter: mockFrontmatter,
      });

      mockSettings.embedPropertyOverrides.embedColorPropertyOverride = "red";

      const result = discordHelper.buildDiscordEmbedParamsFromFile(mockFile, mockSettings);

      expect(result?.color).toBe("blue");
    });

    it('builds Discord embed params with override values', () => {
      const mockFile = {
        basename: 'TestFile',
      } as TFile;

      const mockFrontmatter = {
        [DiscordEmbedTitle]: 'defaultTitle',
        [DiscordEmbedURL]: 'defaultUrl',
        [DiscordEmbedAuthor]: 'defaultAuthor',
        [DiscordEmbedDescription]: 'defaultDescription',
        [DiscordEmbedThumbnail]: 'defaultThumbnail',
        [DiscordEmbedFields]: 'defaultFields',
        [DiscordEmbedImage]: 'defaultImage',
        [DiscordEmbedFooter]: 'defaultFooter',
        "override-title": 'overrideTitle',
        "override-url": 'overrideUrl',
        "override-author": 'overrideAuthor',
        "override-description": 'overrideDescription',
        "override-thumbnail": 'overrideThumbnail',
        "override-fields": 'overrideFields',
        "override-image": 'overrideImage',
        "override-footer": 'overrideFooter'
      };

      mockPlugin.app.metadataCache.getFileCache.mockReturnValueOnce({
        frontmatter: mockFrontmatter,
      });

      mockSettings.embedPropertyOverrides.embedTitlePropertyOverride = "override-title";
      mockSettings.embedPropertyOverrides.embedURLPropertyOverride = "override-url";
      mockSettings.embedPropertyOverrides.embedAuthorPropertyOverride = "override-author";
      mockSettings.embedPropertyOverrides.embedDescriptionPropertyOverride = "override-description";
      mockSettings.embedPropertyOverrides.embedThumbnailPropertyOverride = "override-thumbnail";
      mockSettings.embedPropertyOverrides.embedFieldsPropertyOverride = "override-fields";
      mockSettings.embedPropertyOverrides.embedImagePropertyOverride = "override-image";
      mockSettings.embedPropertyOverrides.embedFooterPropertyOverride = "override-footer";

      const result = discordHelper.buildDiscordEmbedParamsFromFile(mockFile, mockSettings);

      expect(result).toEqual({
        title: 'overrideTitle',
        url: 'overrideUrl',
        author: 'overrideAuthor',
        color: '',
        description: 'overrideDescription',
        thumbnail: 'overrideThumbnail',
        fields: 'overrideFields',
        image: 'overrideImage',
        footer: 'overrideFooter',
        file: mockFile,
      });
    });

    it('uses note title for embed title when configured', () => {
      const mockFile = {
        basename: 'TestFile',
      } as TFile;

      const mockFrontmatter = {
        [DiscordEmbedColor]: 'defaultColor',
        [DiscordEmbedTitle]: 'defaultTitle',
        // ... add other default values
      };

      mockPlugin.app.metadataCache.getFileCache.mockReturnValueOnce({
        frontmatter: mockFrontmatter,
      });

      mockSettings.useNoteTitleForEmbed = true;

      const result = discordHelper.buildDiscordEmbedParamsFromFile(mockFile, mockSettings);

      //expect(result).toBeDefined();
      expect(result?.title).toBe('TestFile');
    });
  });

  describe('formatObsidianContentForDiscord', () => {
    const obsidianMdContent = `
---
title: "Sample Markdown"
date: "2024-06-09"
tags: ["example", "markdown", "frontmatter"]
---

![example-image](images/sample.jpg)

# Heading

This is an example markdown file with frontmatter. It contains various elements like images, headings, and text.

%%
This is a secret, don't want to share it.
%%

## Subheading

Here is some more text under a subheading. It provides additional information about the markdown file.

[[Wiki Link]]

- Bullet point one
- Bullet point two

[[Wiki Link|Alias2]]

The end of the content.
`.trim();

const discordContent = `
![example-image](images/sample.jpg)

# Heading

This is an example markdown file with frontmatter. It contains various elements like images, headings, and text.



## Subheading

Here is some more text under a subheading. It provides additional information about the markdown file.

Wiki Link

- Bullet point one
- Bullet point two

Alias2

The end of the content.
`.trim();

    it('formats Obsidian content for Discord', () => {
      const result = discordHelper.formatObsidianContentForDiscord(obsidianMdContent);
      expect(result).toBe(discordContent);
    })
  });
});

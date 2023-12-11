import DiscordHelper from './DiscordHelper';
import { TFile } from 'obsidian';
import { DiscordEmbedAuthor, DiscordEmbedColor, DiscordEmbedDescription, DiscordEmbedFields, DiscordEmbedFooter, DiscordEmbedImage, DiscordEmbedThumbnail, DiscordEmbedTitle, DiscordEmbedURL } from './constants';

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
let mockSettings = {} as any;

describe('DiscordHelper', () => {
  let discordHelper: DiscordHelper;

  beforeEach(() => {
    discordHelper = new DiscordHelper(mockPlugin);
    mockSettings = {};
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

      mockSettings.embedColor = "red";

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

      mockSettings.embedColor = "red";

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

      mockSettings.embedTitle = "override-title";
      mockSettings.embedURL = "override-url";
      mockSettings.embedAuthor = "override-author";
      mockSettings.embedDescription = "override-description";
      mockSettings.embedThumbnail = "override-thumbnail";
      mockSettings.embedFields = "override-fields";
      mockSettings.embedImage = "override-image";
      mockSettings.embedFooter = "override-footer";

      const result = discordHelper.buildDiscordEmbedParamsFromFile(mockFile, mockSettings);

      expect(result).toEqual({
        title: 'overrideTitle',
        url: 'overrideUrl',
        author: 'overrideAuthor',
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

    // Add more test cases as needed for different scenarios
  });
});

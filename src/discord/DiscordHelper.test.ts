import DiscordHelper from './DiscordHelper';
import { TFile } from 'obsidian';
import { DiscordEmbedColor, DiscordEmbedTitle } from './constants';

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
} as any;

const mockSettings = {} as any;

describe('DiscordHelper', () => {
  let discordHelper: DiscordHelper;

  beforeEach(() => {
    discordHelper = new DiscordHelper(mockPlugin);
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
        [DiscordEmbedColor]: 'defaultColor',
        [DiscordEmbedTitle]: 'defaultTitle',
        // ... add other default values
      };

      mockPlugin.app.metadataCache.getFileCache.mockReturnValueOnce({
        frontmatter: mockFrontmatter,
      });

      const result = discordHelper.buildDiscordEmbedParamsFromFile(mockFile, mockSettings);

      expect(result).toEqual({
        color: 'defaultColor',
        title: 'defaultTitle',
        // ... add other expected values
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

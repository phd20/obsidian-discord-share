export interface DiscordEmbedFrontmatter {
    color: string;
    title: string;
    url: string;
    author: DiscordEmbedAuthorFrontmatter;
    description: string;
    thumbnail: string;
    fields: DiscordEmbedFieldsFrontmatter;
    image: string;
    footer: DiscordEmbedFooterFrontmatter;
}

export interface DiscordEmbedAuthorFrontmatter {
    name: string;
    iconURL: string;
    url: string;
}

export interface DiscordEmbedFieldsFrontmatter {
    name: string;
    value: string;
    inline: boolean;
}

export interface DiscordEmbedFooterFrontmatter {
    text: string;
    iconURL: string;
}
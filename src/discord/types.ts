import { TFile } from "obsidian";

export interface DiscordEmbedParams {
    color: string;
    title: string;
    url: string;
    author: DiscordEmbedAuthorParams;
    description: string;
    thumbnail: string;
    fields: DiscordEmbedFieldsParams;
    image: string;
    footer: DiscordEmbedFooterParams;
    file?: TFile;
}

export interface DiscordEmbedAuthorParams {
    name: string;
    iconURL: string;
    url: string;
}

export interface DiscordEmbedFieldsParams {
    name: string;
    value: string;
    inline: boolean;
}

export interface DiscordEmbedFooterParams {
    text: string;
    iconURL: string;
}
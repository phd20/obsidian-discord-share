import { TFile } from "obsidian";
import { DiscordEmbedAuthorParams, DiscordEmbedFieldsParams, DiscordEmbedFooterParams, DiscordEmbedParams } from "./types";

export class DiscordEmbedParamsBuilder {
    private params: DiscordEmbedParams;

    constructor() {
        this.params = {} as DiscordEmbedParams;
    }

    setColor(color: string) {
        this.params.color = color;
        return this;
    }

    setTitle(title: string) {
        this.params.title = title;
        return this;
    }

    setURL(url: string) {
        this.params.url = url;
        return this;
    }

    setAuthor(author: DiscordEmbedAuthorParams) {
        this.params.author = author;
        return this;
    }

    setDescription(description: string) {
        this.params.description = description;
        return this;
    }

    setThumbnail(thumbnail: string) {
        this.params.thumbnail = thumbnail;
        return this;
    }

    setFields(fields: DiscordEmbedFieldsParams[]) {
        this.params.fields = fields;
        return this;
    }

    setImage(image: string) {
        this.params.image = image;
        return this;
    }

    setFooter(footer: DiscordEmbedFooterParams) {
        this.params.footer = footer;
        return this;
    }

    setFile(file: TFile) {
        this.params.file = file;
        return this;
    }

    build() {
        return this.params;
    }
}
import * as schema from "./database/schema";

export interface i_DlSync {
    userid: number;
    synctype?: string;
    anime?: string;
    epnum: number;
    dltype?: string;
    queuenum?: number;
    xdccdata?: string[];
    torrentdata?: string;
}

export interface i_NyaaResponse {
    id: number;
    title: string;
    link: string;
    file: string;
    category: string;
    size: string;
    uploaded: string;
    seeders: number;
    leechers: number;
    completed: number;
    magnet: string;
    epnum?: number;
    disname?: string | null;
}

export interface i_ProcessedObjV2 {
    alid: number;
    jpname: string;
    enname: string;
    watched: number[];
    notwatched: number[];
    shortname: string | undefined;
    image: string;
    status: "RELEASING" | "NOT_YET_RELEASED" | "FINISHED";
}

interface AbstractMessageEntity {
    type: string;
    offset: number;
    length: number;
}

interface CommonMessageEntity extends AbstractMessageEntity {
    type: "mention" | "hashtag" | "cashtag" | "bot_command" | "url" | "email" | "phone_number" | "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "blockquote" | "expandable_blockquote" | "code";
}

interface PreMessageEntity extends AbstractMessageEntity {
    type: "pre";
    language?: string;
}

interface TextLinkMessageEntity extends AbstractMessageEntity {
    type: "text_link";
    url: string;
}

interface TextMentionMessageEntity extends AbstractMessageEntity {
    type: "text_mention";
    user: {
        id: number;
        is_bot: boolean;
        first_name: string;
        last_name?: string;
        username?: string;
        language_code?: string;
        is_premium?: true;
        added_to_attachment_menu?: true;
    };
}

interface CustomEmojiMessageEntity extends AbstractMessageEntity {
    type: "custom_emoji";
    custom_emoji_id: string;
}

export type MessageEntity =
    CommonMessageEntity
    | CustomEmojiMessageEntity
    | PreMessageEntity
    | TextLinkMessageEntity
    | TextMentionMessageEntity;

export interface DownloadJobData {
    userid: number;
    anime: string;
    episode: number;
    alid: number;
    dltype: 'xdcc' | 'torrent';
    xdcc?: { 
        botname: string; 
        packnum: number; 
        server?: string;
    };
    torrent?: { 
        magnetLink?: string; 
        fileUrl: string;
    };
}

export interface AnimeCheckJobData {
    alid: number;
    episode: number;
    jpname: string;
    enname: string;
    subscribers: number[];
}

export interface NotificationJobData {
    userid: number;
    chatid: bigint;
    message: string;
    anime: string;
    episode: number;
    alid: number;
    imageFileId?: string;
}

export interface ScraperJobData {
    alid: number;
    episode: number;
    jpname: string;
    enname: string;
    optnames: string[];
}

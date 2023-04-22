// telegram bot endpoint

import {
    conversations,
    createConversation,
    type Conversation,
    type ConversationFlavor,
} from "@grammyjs/conversations";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import {
    Bot,
    BotError,
    Context,
    GrammyError,
    HttpError,
    session,
} from "grammy";
import { CheckUpdates, ResObj } from "../api/UpdRelease";

import { authchat, db, updater } from "..";
import { anime_add, animeadd } from "./helpers/anime/anime_add";
import { anime_dllist } from "./helpers/anime/anime_dllist";
import { anime_remove, delanimehelper } from "./helpers/anime/anime_remove";
import { anime_sync } from "./helpers/anime/anime_sync";
import { anime_unwatch, unwatchhelper } from "./helpers/anime/anime_unwatch";
import { callback_dl, callback_dlep } from "./helpers/anime/cb_dl_handle";
import {
    callback_mkwatch,
    callback_mkwatchep,
} from "./helpers/anime/cb_mkwatch_handle";
import {
    back_handle,
    cancel_handle,
    log_command,
} from "./helpers/anime/misc_handles";
import { anime_config } from "./helpers/anime_config";
import { users, config, watchedepanime } from "@prisma/client";
import { i_configuration } from "../interfaces";

export class UpdateHold {
    updateobj: { [userid: string]: ResObj };
    constructor() {
        this.updateobj = {};
    }
    async updater(userid: string) {
        try {
            this.updateobj.[userid] = await CheckUpdates(userid);
        } catch (error) {
            console.error(error);
        }
        return this.updateobj;
    }
}

/**Note to self: yeet this shit and implement redis */
export class cachedDB {
    dbcache: {
        userid: string;
        chatid: number;
        config?: i_configuration;
    }[];
    constructor() {
        this.dbcache = [];
    }
    async getUserID(chatid: number) {
        try {
            const cached = (await this.getAllCachedData(chatid)).userid;
            if (cached == undefined) return cached;
            else {
                const userid = await db.users.findUnique({
                    where: {chatid: chatid},
                    select: { userid: true }
                });
                this.dbcache.push({
                    userid: userid[0].userid,
                    chatid: chatid,
                });
                return userid[0].userid;
            }
        } catch (err) {
            console.error(err);
            return "";
        }
    }
    async getAllCachedData(chatid?: number, userid?: string) {
        try {
            if (chatid != undefined) {
                const data = this.dbcache.filter((o) => o.chatid == chatid);
                if (data.length === 1) return data[0];
                throw new Error("Multiple data for same user in cache");
            }
            if (userid != undefined) {
                const data = this.dbcache.filter((o) => o.userid == userid);
                if (data.length === 1) return data[0];
                throw new Error("Multiple data for same user in cache");
            }
        } catch (err) {
            console.error(err);
            return undefined;
        }
    }
    async getConfig(chatid?: number, userid?: string) {
        try {
            if (userid == undefined && chatid != 0)
            userid = await this.getUserID(chatid);
            if (userid === "") throw new Error("UserID not found.");
            
            const data = await db.config.findUnique({where: { userid: userid }});
            const index = this.dbcache.findIndex((o) => o.userid == userid);
            if (index === -1)
            throw new Error(`No userid found for ${userid}:${chatid}`);
            this.dbcache[index].config = {
                pause_sync: data[0].pause_sync,
                remind_again: data[0].remind_again,
            };
            return this.dbcache[index].config;
        } catch (err) {
            console.error(err);
            return undefined;
        }
    }
}

export const bot = new Bot<Context & ConversationFlavor>(
    `${process.env.BOT_TOKEN}`,
    {
        botInfo: {
            id: 6104968853,
            is_bot: true,
            first_name: "Cunnime_DEV",
            username: "cunnime_dev_bot",
            can_join_groups: false,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
        },
    }
    );
    
    export async function botinit() {
        const throttler = apiThrottler();
        bot.api.config.use(throttler);
        bot.use(session({ initial: () => ({}) }));
        bot.use(conversations());
        bot.catch((err) => {
            const ctx = err.ctx;
            console.error(`Error while handling update ${ctx.update.update_id}:`);
            const e = err.error;
            if (e instanceof GrammyError) {
                console.error("Error in request:", e.description);
            } else if (e instanceof HttpError) {
                console.error("Could not contact Telegram:", e);
            } else if (e instanceof BotError) {
                console.error("Bot error: ", e.error, "caused by", e.cause);
            } else {
                console.error("Unknown error:", e);
            }
        });
        botcommands();
        console.log("*********************");
        console.log("Cunnime has started!");
        console.log("*********************");
    }
    
    export type MyContext = Context & ConversationFlavor;
    export type MyConversation = Conversation<MyContext>;
    export const authchatEval = (ctx: MyContext) => {
        if (ctx.chat.id != authchat) {
            ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
            return false;
        }
        return true;
    };
    export const getUpdaterAnimeIndex = (name: string) =>
    updater.updateobj.map((object) => object.anime).indexOf(name);
    
    function botcommands() {
        bot.use(createConversation(animeadd));
        bot.use(createConversation(delanimehelper));
        bot.use(createConversation(unwatchhelper));
        
        bot.command("start", (ctx) =>
        ctx.reply("Sup boss?", { reply_markup: { remove_keyboard: true } })
        );
        bot.command("help", (ctx) => {
            ctx.reply("Help me onii-chan I'm stuck~");
        });
        bot.command("sync", async (ctx) => await anime_sync(ctx));
        bot.command("addanime", async (ctx) => await anime_add(ctx));
        bot.command("cancel", async (ctx) => await cancel_handle(ctx));
        bot.command("removeanime", async (ctx) => await anime_remove(ctx));
        bot.command("unwatch", async (ctx) => await anime_unwatch(ctx));
        bot.command("dllist", async (ctx) => await anime_dllist(ctx));
        bot.command("config", async (ctx) => await anime_config(ctx));
        bot.command("log", async (ctx) => await log_command(ctx));
        
        bot.callbackQuery(/download/, async (ctx) => await callback_dl(ctx));
        bot.callbackQuery(/dlep_.*/, async (ctx) => await callback_dlep(ctx));
        bot.callbackQuery(/mark_watch/, async (ctx) => await callback_mkwatch(ctx));
        bot.callbackQuery(
            /mkwtch_.*/,
            async (ctx) => await callback_mkwatchep(ctx)
            );
            bot.callbackQuery(/back/, async (ctx) => await back_handle(ctx));
        }
        
// telegram bot endpoint

import { type Conversation, type ConversationFlavor } from "@grammyjs/conversations";
import { Bot, Context, MemorySessionStorage, session, SessionFlavor } from "grammy";
import { initWLMenu } from "./helpers/watchlist/w_menu";
import { RedisAdapter } from "@grammyjs/storage-redis";
import { redis } from "../index";
import { botcommands } from "./handlers/commands";
import { middleware } from "./handlers/middleware";
import { botErrorHandle, initConvos, setCommands } from "./helpers/misc_handles";
import { limit } from "@grammyjs/ratelimiter";

interface SessionData {
    userid: number | undefined;
    config: { pause_airing_updates: boolean | undefined };
    menudata: {
        activemenuopt: number | undefined,
        wlid: number | undefined,
        wlname: string | undefined,
        alid: number | undefined,
        l_page: number | undefined,
        maxpg: number | undefined,
        listmethod: "all" | "towatch" | undefined
    };
}

// Outside context objects (knows all middleware plugins)
export type MyContext = ConversationFlavor<Context> & SessionFlavor<SessionData>;

// Inside context objects (knows all conversation plugins)
export type MyConversationContext = Context;

// Conversation type with both outside and inside context
export type MyConversation = Conversation<MyContext, MyConversationContext>;

export let bot: Bot<MyContext>;

export function botinit() {
    // Initialize bot here, after environment variables are loaded
    bot = new Bot<MyContext>(`${process.env.BOT_TOKEN}`);
    //const throttler = apiThrottler();
    //bot.api.config.use(throttler);
    // Set default parse_mode to HTML for all text messages
    bot.api.config.use((prev, method, payload, signal) => {
        if ('parse_mode' in payload && payload.parse_mode === undefined) {
            payload.parse_mode = 'HTML';
        }
        return prev(method, payload, signal);
    });
    const storage = new RedisAdapter<SessionData>({ instance: redis, ttl: 24 * 60 * 60 });
    // noinspection JSUnusedGlobalSymbols
    bot.use(
        session({
            type: "multi",
            userid: {
                storage: new MemorySessionStorage(60 * 60 * 1000),
                initial: () => undefined
            },
            config: {
                storage: new MemorySessionStorage(60 * 60 * 1000),
                initial: () => ({ pause_airing_updates: undefined })
            },
            menudata: {
                storage: storage,
                initial: () => ({
                    activemenuopt: undefined,
                    wlid: undefined,
                    wlname: undefined,
                    alid: undefined,
                    l_page: undefined,
                    maxpg: undefined,
                    listmethod: undefined
                })
            },
            conversation: {
                getSessionKey: (ctx) => `${ctx.chat?.id}_c`,
                storage: storage
            }
        })
    );
    bot.use(
        limit({
            timeFrame: 30000,
            limit: 20,
            storageClient: "MEMORY_STORE",
            onLimitExceeded: async (ctx) => {
                await ctx.reply("Don't spam the bot!");
            },
            keyGenerator: (ctx) => {
                return ctx.from?.id.toString();
            }
        })
    );
    bot.use(middleware());
    initConvos();
    initWLMenu();
    void setCommands(bot);
    botcommands();
    console.log("*********************");
    console.log("Cunnime has started!");
    console.log("*********************");
    if (process.env.RUN_METHOD === "POLLING") {
        bot.catch((err) => botErrorHandle(err));
        void bot.start();
    }
}


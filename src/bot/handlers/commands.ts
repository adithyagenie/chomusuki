import { registerUser } from "../helpers/user_mgmt";
import {
    animeStartWatch,
    watching_pending_list,
    watchingListCBQ
} from "../helpers/anime/a_watching";
import {
    airingUpdatesList,
    airingUpdatesListCBQ,
    remindMe,
    stopAiringUpdates
} from "../helpers/anime/a_airing_updates";
import { a_Pending } from "../helpers/anime/a_pending";
import { animeSearchStart, search_startWatch_remindMe_cb } from "../helpers/anime/a_search";
import { back_handle, cancel_handle, log_command } from "../helpers/misc_handles";
import {
    anime_unwatch,
    callback_mkwatch,
    callback_mkwatchep
} from "../helpers/anime/a_watch_unwatch_ep";
import { anime_dllist, dl_cbq, dlep_cbq } from "../helpers/anime/a_download";
import { anime_config } from "../helpers/anime_config";
import { bot } from "../bot";

export function botcommands() {
    bot.on("my_chat_member", async (ctx, next) => {
        if (ctx.myChatMember.chat.type === "group" || ctx.myChatMember.chat.type === "supergroup") {
            console.log(`Got added to ${ctx.myChatMember.chat.id}. Exited group.`);
            await ctx.reply("I cannot function in groups yet :/");
            await ctx.leaveChat();
        } else if (ctx.myChatMember.chat.type === "channel" && ctx.myChatMember.chat.id !== -1001869285732) {
            console.log(`Got added to ${ctx.myChatMember.chat.id}. Exited channel.`);
            await ctx.leaveChat();
        } else if (ctx.myChatMember.chat.type === "private") {
            await ctx.reply("Hey! This is a multipurpose anime bot made by @adithyagenie! I'm" +
                " still under development," +
                " you may encounter bugs sometimes :)\nIf you do come across some issues, DM my" +
                " creator!");
            await next();
            return;
        }
    });
    bot.hears(/\/start startwatching_(\d+)/, (ctx) => animeStartWatch(ctx));
    bot.hears(/\/start remindme_(\d+)/, (ctx) => remindMe(ctx));
    bot.hears(
        /\/start stopwatching_(\d+)/,
        async (ctx) => await ctx.conversation.enter("stopWatching")
    );
    bot.hears(/\/start stopremindme_(\d+)/, (ctx) => stopAiringUpdates(ctx));
    bot.hears(/\/start pending_(\d+)/, (ctx) => a_Pending(ctx));
    bot.command("register", async (ctx) => await registerUser(ctx));
    bot.command("deleteaccount", async (ctx) => await ctx.conversation.enter("deleteUser"));
    bot.command("startwatching", (ctx) => animeSearchStart(ctx, "startwatching"));
    bot.command("remindme", (ctx) => animeSearchStart(ctx, "remindme"));
    //bot.hears(/^\/startwatching_(\d+)/, (ctx) => animeStartWatch(ctx));
    //bot.hears(/^\/stopwatching_(\d+)/, async (ctx) => await
    // ctx.conversation.enter("stopWatching")); bot.hears(/^\/remindme_(\d+)/, (ctx) =>
    // remindMe(ctx)); bot.hears(/^\/stopairingupdates_(\d+)/, (ctx) => stopAiringUpdates(ctx));
    bot.command("cancel", async (ctx) => await cancel_handle(ctx));
    bot.hears(/^\/(pending|watching)/, (ctx) => watching_pending_list(ctx));
    bot.command("airingupdates", (ctx) => airingUpdatesList(ctx));
    bot.command("markwatched", async (ctx) => await ctx.conversation.enter("markWatchedRange"));
    bot.command("unwatch", async (ctx) => await anime_unwatch(ctx));
    bot.command("dllist", async (ctx) => await anime_dllist(ctx));
    bot.command("config", async (ctx) => await anime_config(ctx));
    bot.command("log", async (ctx) => await log_command(ctx));

    bot.command("createwl", async (ctx) => await ctx.conversation.enter("createWL"));
    bot.command("deletewl", async (ctx) => await ctx.conversation.enter("deleteWL"));

    bot.callbackQuery(/download/, async (ctx) => await dl_cbq(ctx));
    bot.callbackQuery(/dlep_(\d+)_(\d+)/, async (ctx) => await dlep_cbq(ctx));
    bot.callbackQuery(/mark_watch/, async (ctx) => await callback_mkwatch(ctx));
    bot.callbackQuery(/mkwtch_(\d+)_(\d+)/, async (ctx) => await callback_mkwatchep(ctx));
    bot.callbackQuery(/back/, async (ctx) => await back_handle(ctx));
    bot.callbackQuery(
        /(startwatching|remindme)_(\d+)(_current)?/,
        async (ctx) => await search_startWatch_remindMe_cb(ctx)
    );
    bot.callbackQuery(
        /(watch|pending)_(\d+)(_current)?/,
        async (ctx) => await watchingListCBQ(ctx)
    );
    bot.callbackQuery(/airingupd_(\d+)(_current)?/, async (ctx) => await airingUpdatesListCBQ(ctx));
    bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery("Invalid button?")); //sink
    bot.hears(/\/start (.+)/);
    bot.hears(/^\/start$/, (ctx) => ctx.reply(`Sup boss?`));
    bot.command("help", (ctx) => ctx.reply("Help me onii-chan I'm stuck~"));
    bot.hears(/(.+)/, (ctx) => ctx.reply(`What do you mean by ${ctx.match.toString()}?`));
}
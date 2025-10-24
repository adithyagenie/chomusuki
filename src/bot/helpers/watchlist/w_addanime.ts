import { db } from "../../..";
import { addToWatchlist } from "../../../database/animeDB";
import { MyContext, MyConversation, MyConversationContext } from "../../bot";
import { animeSearchHandler } from "../anime/a_search";
import { getWLName } from "./w_helpers";
import { selfyeet } from "../misc_handles";
import { watchlists } from "../../../database/schema";
import { eq, count } from "drizzle-orm";
import { b, fmt } from "@grammyjs/parse-mode";


/**
 * Conversation for adding anime in watchlist.
 * @param convo - Conversation
 * @param ctx - Context
 */
export async function addWL(convo: MyConversation, ctx: MyConversationContext) {
    const wlid = await convo.external((ctx) => ctx.session.menudata.wlid);
    const itemCount = await convo.external(async () => {
        const result = await db.select({ count: count() })
            .from(watchlists)
            .where(eq(watchlists.watchlistid, wlid));
        return result[0].count;
    });
    if (itemCount === 0) {
        await ctx.reply("Watchlist missing.");
        return;
    }
    // Get watchlist name directly
    const wlname = await convo.external(async (ctx) => {
        if (ctx.session.menudata.wlname !== undefined) return ctx.session.menudata.wlname;
        const result = await db.select({ watchlist_name: watchlists.watchlist_name })
            .from(watchlists)
            .where(eq(watchlists.watchlistid, wlid));
        const name = result[0]?.watchlist_name;
        ctx.session.menudata.wlname = name;
        return name;
    });
    await ctx.reply("Send the name of anime or /done to stop adding.");
    let msgid = 0;
    while (1) {
        const name = await convo.waitUntil((ctx1) =>
            ctx1.hasCallbackQuery(/^addwl_(\d+)_(\d+)(_current)?/) ||
            (ctx1.hasText(/.+/)) && !ctx1.hasCallbackQuery(/.+/));
        if (name.hasCallbackQuery(/addwl_(\d+)_(\d+)(_current)?/)) {
            await searchCB(convo, name);
        } else if (name.message != undefined) {
            if (name.hasCommand("done")) {
                await ctx.reply("Alright wrapping up.");
                try {
                    if (msgid !== 0 && msgid !== undefined)
                        await ctx.api.deleteMessage(ctx.chat?.id, msgid);
                } catch {}
                return;
            } else if (name.message.text.match(/\/start wl_(\d+)/) !== null) {
                convo.log(`Adding ${name.message.text}`);
                await name.deleteMessage();
                const result = await convo.external(() =>
                    addToWatchlist(
                        wlid,
                        parseInt(name.message.text.match(/\/start wl_(\d+)/)[1])
                    )
                );
                if (result === "present") {
                    const todel = await ctx.reply("Anime already added to watchlist.");
                    selfyeet(ctx.chat?.id, todel.message_id, 5000);
                } else if (result === "err") {
                    await ctx.reply(`Error adding to watchlist. Try again after some time.`);
                    return;
                } else if (result === "invalid") {
                    await ctx.reply("Anime not found.");
                } else {
                    const message = fmt`${b}${result}${b} has been added to ${wlname}.\nTo add another, simply send the anime name to search or /done to finish adding.`;
                    const todel = await ctx.reply(message.text, { entities: message.entities });
                    selfyeet(ctx.chat?.id, todel.message_id, 5000);
                }
            } else {
                if (msgid !== undefined && msgid !== 0) {
                    try {
                        await ctx.api.deleteMessage(ctx.chat?.id, msgid);
                    } catch {}
                }
                // Search inline in the conversation
                const searchName = name.message.text;
                if (searchName === "") {
                    await ctx.reply("Please provide a search query!");
                    continue;
                }
                const searchMsgId = (await ctx.reply("Searching...")).message_id;
                const userid = await convo.external((ctx) => ctx.session.userid);
                const searchResult = await convo.external(() =>
                    animeSearchHandler(searchName, "addwl", 1, name.me.username, userid, wlid)
                );
                if (searchResult.msg == undefined || searchResult.keyboard == undefined) {
                    await ctx.api.editMessageText(ctx.from.id, searchMsgId, "Unable to find any results.");
                    msgid = 0;
                } else {
                    if (searchResult.keyboard.inline_keyboard.length == 0)
                        await ctx.api.editMessageText(ctx.from.id, searchMsgId, searchResult.msg, {
                            entities: searchResult.msgEntities
                        });
                    else
                        await ctx.api.editMessageText(ctx.from.id, searchMsgId, searchResult.msg, {
                            entities: searchResult.msgEntities,
                            reply_markup: searchResult.keyboard
                        });
                    msgid = searchMsgId;
                }
            }
        }
    }
}

/**
 * Gives/edits message to give required page of anime search for watchlist adding.
 * @param convo Conversation object
 * @param ctx Context object
 */
async function searchCB(convo: MyConversation, ctx: MyConversationContext) {
    await ctx.answerCallbackQuery("Searching!");
    if (ctx.match[3] === "_current") return;
    const movepg = parseInt(ctx.match[2]);
    const wlid = parseInt(ctx.match[1]);
    const query = [...ctx.msg.text.split("\n")[0].matchAll(/^Search results for '(.+)'$/gi)].map(
        (o) => o[1]
    )[0];
    //console.log(`${command}, ${movepg}, ${query}`);
    const userid = await convo.external((ctx) => ctx.session.userid);
    const { msg, msgEntities, keyboard } = await animeSearchHandler(
        query,
        "addwl",
        movepg,
        ctx.me.username,
        userid,
        wlid
    );
    if (msg == undefined || keyboard == undefined) {
        await ctx.reply("Unable to find any results.");
        return;
    }
    //console.log(`${msg}, ${JSON.stringify(keyboard)}`);
    await ctx.editMessageText(msg, { entities: msgEntities, reply_markup: keyboard });
}


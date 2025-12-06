import { db } from "../../..";
import { addToWatchlist } from "../../../database/animeDB";
import { MyContext, MyConversation } from "../../bot";
import { animeSearchHandler } from "../anime/a_search";
import { getWLName } from "./w_helpers";
import { selfyeet } from "../misc_handles";
import { b, fmt } from "@grammyjs/parse-mode";


/**
 * Conversation for adding anime in watchlist.
 * @param convo - Conversation
 * @param ctx - Context
 */
export async function addWL(convo: MyConversation, ctx: MyContext) {
    const item = await convo.external(() =>
        db.watchlists.count({ where: { watchlistid: convo.session.menudata.wlid } })
    );
    if (item === 0) {
        await ctx.reply("Watchlist missing.");
        return;
    }
    const wlname = await getWLName(convo);
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
                        convo.session.menudata.wlid,
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
                  const replyString = fmt`${b}${result}${b} has been added to ${wlname}.\nTo add another, simply send the anime name to search or /done to finish adding.`
                    const todel = await ctx.reply(replyString.text, { entities: replyString.entities });
                    selfyeet(ctx.chat?.id, todel.message_id, 5000);
                }
            } else {
                if (msgid !== undefined && msgid !== 0) {
                    try {
                        await ctx.api.deleteMessage(ctx.chat?.id, msgid);
                    } catch {}
                }
                msgid = await startSearchWL(convo, ctx, name.message.text, convo.session.menudata.wlid);
            }
        }
    }
}

/**
 * Gives/edits message to give required page of anime search for watchlist adding.
 * @param convo Conversation object
 * @param ctx Context object
 */
async function searchCB(convo: MyConversation, ctx: MyContext) {
    await ctx.answerCallbackQuery("Searching!");
    if (ctx.match[3] === "_current") return;
    const movepg = parseInt(ctx.match[2]);
    const wlid = parseInt(ctx.match[1]);
    const query = [...ctx.msg.text.split("\n")[0].matchAll(/^Search results for '(.+)'$/gi)].map(
        (o) => o[1]
    )[0];
    //console.log(`${command}, ${movepg}, ${query}`);
    const { msg, keyboard } = await animeSearchHandler(
        query,
        "addwl",
        movepg,
        ctx.me.username,
        convo.session.userid,
        wlid
    );
    if (msg == undefined || keyboard == undefined) {
        await ctx.reply("Unable to find any results.");
        return;
    }
    //console.log(`${msg}, ${JSON.stringify(keyboard)}`);
    await ctx.editMessageText(msg, { reply_markup: keyboard, entities: msg.entities });
}

async function startSearchWL(
    convo: MyConversation,
    ctx: MyContext,
    name: string,
    wlid: number
) {
    if (name === "") {
        await ctx.reply("Please provide a search query!");
        return 1;
    }
    const msgid = (await ctx.reply("Searching...")).message_id;
    const { msg, keyboard } = await convo.external(() =>
        animeSearchHandler(name, "addwl", 1, ctx.me.username, convo.session.userid, wlid)
    );
    if (msg == undefined || keyboard == undefined) {
        await ctx.api.editMessageText(ctx.from.id, msgid, "Unable to find any results.");
        return;
    }
    if (keyboard.inline_keyboard.length == 0)
        await ctx.api.editMessageText(ctx.from.id, msgid, msg.text, { entities: msg.entities });
    await ctx.api.editMessageText(ctx.from.id, msgid, msg.text, {
        reply_markup: keyboard,
        entities: msg.entities
    });
    return msgid;
}

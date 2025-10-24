import { InlineKeyboard } from "grammy";
import { db } from "../../..";
import { addWatching, checkAnimeTable, getUserWatchingAiring } from "../../../database/animeDB";
import { MyContext, MyConversation } from "../../bot";
import { getPagination, HTMLMessageToMessage } from "./a_misc_helpers";
import { selfyeet } from "../misc_handles";

/**
 ** Sends the first page of the list of anime the user is currently watching.
 ** Called by /watching or /pending.
 */
export async function watching_pending_list(ctx: MyContext) {
    const userid = ctx.session.userid;
    let res: { msg: string; keyboard: InlineKeyboard } = undefined;
    if (ctx.match[1] != "pending" && ctx.match[1] != "watching") return;
    res = await watchingListHelper(userid, 1, ctx.me.username, ctx.match[1]);
    if (res == undefined) {
        await ctx.reply(`Error fetching ${ctx.match[1]} list.`);
        return;
    }
    if (res.keyboard == undefined || res.keyboard.inline_keyboard.length == 0)
        await ctx.reply(res.msg);
    else await ctx.reply(res.msg, { reply_markup: res.keyboard });
}

/**
 ** Returns message and keyboard for pages of watching list.
 ** Internally called.*/
async function watchingListHelper(
    userid: number,
    offset: number,
    username: string,
    list: "watching" | "pending"
) {
    const { alidlist, animelist, amount } = await getUserWatchingAiring(
        "watchinganime",
        userid,
        10,
        offset
    );
    let msg: string;
    if (amount == 0) {
        msg = `<b>You are currently not watching any anime. Add some with /startwatching to get started.</b>`;
        return { msg: msg, keyboard: undefined };
    } else msg = `<b>Displaying your currently watching list: </b>\n\n`;
    for (let i = 0; i < alidlist.length; i++) {
        msg += `${i + 1}. <b>${animelist[i]}</b>\n`;
        if (list === "watching") {
            msg += `<i>Remove from watching list: <a href="t.me/${username}?start=stopwatching_${alidlist[i]}">Click here!</a></i>\n\n`;
        } else if (list === "pending") {
            msg += `<i>Get episode status: <a href="t.me/${username}?start=pending_${alidlist[i]}">Click here!</a></i>\n\n`;
        }
    }
    const keyboard = getPagination(offset, Math.ceil(amount / 10), "watch");
    return { msg, keyboard };
}

/**The callback from pages of watching. */
export async function watchingListCBQ(ctx: MyContext) {
    await ctx.answerCallbackQuery("Fetching!");
    const movepg = parseInt(ctx.match[2]);
    const list = ctx.match[1];
    if (ctx.match[3] == "_current") return;
    if (list != "watching" && list != "pending") return;
    const { msg, keyboard } = await watchingListHelper(
        ctx.session.userid,
        movepg,
        ctx.me.username,
        list
    );
    try {
        if (ctx.msg.text.trim() !== HTMLMessageToMessage(msg).trim())
            await ctx.editMessageText(msg, { reply_markup: keyboard });
    } catch (e) {
        console.log(e);
    }
}

/**
 ** This function adds anime to the anime table.
 ** Responds to "/startwatching_alid".
 */
export async function animeStartWatch(ctx: MyContext, menu = false) {
    let alid: number;
    if (menu === false) {
        await ctx.deleteMessage();
        alid = parseInt(ctx.match[1]);
    } else
        alid = ctx.session.menudata.alid;
    if (alid == undefined || Number.isNaN(alid)) {
        await ctx.reply("Invalid.");
        return;
    }
    const userid = ctx.session.userid;
    if (menu === false) {
        const old = (
            await db.watchinganime.findUnique({
                where: { userid }
            })
        ).alid;
        if (old.includes(alid)) {
            await ctx.reply(
                `You have already marked <b>${
                    (
                        await db.anime.findUnique({
                            where: { alid },
                            select: { jpname: true }
                        })
                    ).jpname
                }</b> as watching.`
            );
            return;
        }
    }
    const res = await checkAnimeTable(alid);
    if (res == "err") {
        await ctx.reply("Error occured!");
        return;
    }
    if (res == "invalid") {
        await ctx.reply("Cannot find any anime with given alid.");
        return;
    }
    await addWatching(userid, alid);
    if (menu)
        selfyeet(ctx.chat?.id, (await ctx.reply(`Marked ${res.pull.jpname} as watching!`)).message_id, 5000);
    else await ctx.reply(`Marked ${res.pull.jpname} as watching!`);
    if (res.airing)
        await ctx.reply(
            `${res.pull.jpname} is currently airing.` +
            `If you would like to follow its episode releases: ` +
            `<a href="t.me/${ctx.me.username}?start=remindme_${res.pull.alid}">Click here!</a>`
        );
}

/**
 ** Remove an anime from watching list of user.
 ** Called with /stopwatching_alid.
 */
export async function stopWatching(conversation: MyConversation, ctx: MyContext) {
    await ctx.deleteMessage();
    const match = parseInt(ctx.match[1]);
    if (Number.isNaN(match[1])) {
        await ctx.reply("Invalid command.");
        return;
    }
    const _ = (
        await conversation.external(() =>
            db.watchinganime.findUnique({
                where: { userid: ctx.session.userid },
                select: { alid: true }
            })
        )
    ).alid;
    const aniname = await conversation.external(() =>
        db.anime.findUnique({
            where: { alid: match },
            select: { jpname: true }
        })
    );
    if (aniname === null) {
        await ctx.reply("Anime not found ;_;");
        return;
    }
    if (!_.includes(match)) {
        await ctx.reply(`${aniname.jpname} has already been removed from your watching list.`);
        return;
    }
    const msgid = (
        await ctx.reply(`You will lose all the progress in the anime. Proceed?`, {
            reply_markup: new InlineKeyboard().text("Yes.", "y").text("Hell no.", "n")
        })
    ).message_id;
    const cbq = await conversation.waitForCallbackQuery(/[yn]/);
    await cbq.answerCallbackQuery("Processing...");
    if (cbq.callbackQuery.data == "y") {
        await conversation.external(async () => {
            _.splice(
                _.findIndex((o) => o == match),
                1
            );
            await db.watchinganime.update({
                where: { userid: ctx.session.userid },
                data: { alid: _, userid: undefined }
            });
            await db.watchedepanime.delete({
                where: {
                    userid_alid: {
                        userid: ctx.session.userid,
                        alid: match
                    }
                }
            });
        });
        await ctx.api.deleteMessage(ctx.from.id, msgid);
        await ctx.reply(`${aniname.jpname} has been removed from your watching list.`);
        return;
    } else if (cbq.callbackQuery.data == "n") {
        await ctx.api.deleteMessage(ctx.from.id, msgid);
        await ctx.reply(`Alright cancelling deletion.`);
    }
}

import { InlineKeyboard } from "grammy";
import { db } from "../../..";
import { addWatching, checkAnimeTable, getUserWatchingAiring } from "../../../database/animeDB";
import { MyContext, MyConversation, MyConversationContext } from "../../bot";
import { getPagination, HTMLMessageToMessage } from "./a_misc_helpers";
import { selfyeet } from "../misc_handles";
import { watchinganime, anime, watchedepanime } from "../../../database/schema";
import { eq, and } from "drizzle-orm";
import { b, fmt, i as italic, link } from "@grammyjs/parse-mode";

/**
 ** Sends the first page of the list of anime the user is currently watching.
 ** Called by /watching or /pending.
 */
export async function watching_pending_list(ctx: MyContext) {
    const userid = ctx.session.userid;
    let res: { msg: string; msgEntities: any; keyboard: InlineKeyboard } = undefined;
    if (ctx.match[1] != "pending" && ctx.match[1] != "watching") return;
    res = await watchingListHelper(userid, 1, ctx.me.username, ctx.match[1]);
    if (res == undefined) {
        await ctx.reply(`Error fetching ${ctx.match[1]} list.`);
        return;
    }
    if (res.keyboard == undefined || res.keyboard.inline_keyboard.length == 0)
        await ctx.reply(res.msg, { entities: res.msgEntities });
    else await ctx.reply(res.msg, { entities: res.msgEntities, reply_markup: res.keyboard });
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
    if (amount == 0) {
        const message = fmt`${b}You are currently not watching any anime. Add some with /startwatching to get started.${b}`;
        return { msg: message.text, msgEntities: message.entities, keyboard: undefined };
    }
    
    let formattedMsg = fmt`${b}Displaying your currently watching list: ${b}\n\n`;
    for (let i = 0; i < alidlist.length; i++) {
        formattedMsg = fmt`${formattedMsg}${i + 1}. ${b}${animelist[i]}${b}\n`;
        if (list === "watching") {
            const url = `t.me/${username}?start=stopwatching_${alidlist[i]}`;
            formattedMsg = fmt`${formattedMsg}${italic}Remove from watching list: ${link(url)}Click here!${link(url)}${italic}\n\n`;
        } else if (list === "pending") {
            const url = `t.me/${username}?start=pending_${alidlist[i]}`;
            formattedMsg = fmt`${formattedMsg}${italic}Get episode status: ${link(url)}Click here!${link(url)}${italic}\n\n`;
        }
    }
    const keyboard = getPagination(offset, Math.ceil(amount / 10), "watch");
    return { msg: formattedMsg.text, msgEntities: formattedMsg.entities, keyboard };
}

/**The callback from pages of watching. */
export async function watchingListCBQ(ctx: MyContext) {
    await ctx.answerCallbackQuery("Fetching!");
    const movepg = parseInt(ctx.match[2]);
    const list = ctx.match[1];
    if (ctx.match[3] == "_current") return;
    if (list != "watching" && list != "pending") return;
    const { msg, msgEntities, keyboard } = await watchingListHelper(
        ctx.session.userid,
        movepg,
        ctx.me.username,
        list
    );
    try {
        if (ctx.msg.text.trim() !== HTMLMessageToMessage(msg).trim())
            await ctx.editMessageText(msg, { entities: msgEntities, reply_markup: keyboard });
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
        const oldResult = await db.select({ alid: watchinganime.alid })
            .from(watchinganime)
            .where(eq(watchinganime.userid, userid));
        
        const old = oldResult[0]?.alid || [];
        if (old.includes(alid)) {
            const jpnameResult = await db.select({ jpname: anime.jpname })
                .from(anime)
                .where(eq(anime.alid, alid));
            
            const message = fmt`You have already marked ${b}${jpnameResult[0]?.jpname}${b} as watching.`;
            await ctx.reply(message.text, { entities: message.entities });
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
    if (res.airing) {
        const url = `t.me/${ctx.me.username}?start=remindme_${res.pull.alid}`;
        const message = fmt`${res.pull.jpname} is currently airing.If you would like to follow its episode releases: ${link(url)}Click here!${link(url)}`;
        await ctx.reply(message.text, { entities: message.entities });
    }
}

/**
 ** Remove an anime from watching list of user.
 ** Called with /stopwatching_alid.
 */
export async function stopWatching(conversation: MyConversation, ctx: MyConversationContext) {
    await ctx.deleteMessage();
    const match = parseInt(ctx.match[1]);
    if (Number.isNaN(match[1])) {
        await ctx.reply("Invalid command.");
        return;
    }
    const userid = await conversation.external((ctx) => ctx.session.userid);
    const alidResult = await conversation.external(async () => {
        const result = await db.select({ alid: watchinganime.alid })
            .from(watchinganime)
            .where(eq(watchinganime.userid, userid));
        return result[0]?.alid || [];
    });
    const _ = alidResult;
    
    const aniname = await conversation.external(async () => {
        const result = await db.select({ jpname: anime.jpname })
            .from(anime)
            .where(eq(anime.alid, match));
        return result[0];
    });
    
    if (aniname === undefined) {
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
            await db.update(watchinganime)
                .set({ alid: _ })
                .where(eq(watchinganime.userid, userid));
            
            await db.delete(watchedepanime)
                .where(and(
                    eq(watchedepanime.userid, userid),
                    eq(watchedepanime.alid, match)
                ));
        });
        await ctx.api.deleteMessage(ctx.from.id, msgid);
        await ctx.reply(`${aniname.jpname} has been removed from your watching list.`);
        return;
    } else if (cbq.callbackQuery.data == "n") {
        await ctx.api.deleteMessage(ctx.from.id, msgid);
        await ctx.reply(`Alright cancelling deletion.`);
    }
}

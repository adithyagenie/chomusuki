import { db } from "../../..";
import { addAiringFollow, checkAnimeTable, getUserWatchingAiring } from "../../../database/animeDB";
import { MyContext } from "../../bot";
import { getPagination, HTMLMessageToMessage } from "./a_misc_helpers";

/**
 ** Live updates for airing shit.
 ** Responds to "/remindme_alid". */
export async function remindMe(ctx: MyContext) {
    await ctx.deleteMessage();
    const userid = ctx.session.userid;
    const alid = parseInt(ctx.match[1]);
    if (alid == undefined || Number.isNaN(alid)) {
        await ctx.reply("Invalid.");
        return;
    }
    const _ = await checkAnimeTable(alid);
    if (_ == "invalid") {
        await ctx.reply(`Invalid Anilist ID.`);
        return;
    }
    const __ = await db.airingupdates.findMany({
        where: { userid: { has: userid } },
        select: { alid: true }
    });
    let remindme: number[];
    if (__ === null) remindme = [];
    else remindme = __.map((o) => o.alid);
    if (remindme.includes(alid)) {
        await ctx.reply("You are already following updates for this anime!");
        return;
    }
    const res = await addAiringFollow(alid, userid);
    if (res == 0)
        await ctx.reply(
            `You will now recieve updates on <b>${
                (
                    await db.anime.findUnique({
                        where: { alid },
                        select: { jpname: true }
                    })
                ).jpname
            }.</b>`
        );
    else await ctx.reply("Error encountered ;_;");
    return;
}

/**
 ** Sends the first page of the list of anime the user is currently subscribed to.
 ** Called by /airingupdates.
 */
export async function airingUpdatesList(ctx: MyContext) {
    const userid = ctx.session.userid;
    const { msg, keyboard } = await airingUpdatesListHelper(userid, 1, ctx.me.username);
    if (keyboard == undefined || keyboard.inline_keyboard[0].length == 1)
        await ctx.reply(msg);
    else await ctx.reply(msg, { reply_markup: keyboard });
}

/**
 ** Returns message and keyboard for pages of subscribed list.
 ** Internally called.*/
export async function airingUpdatesListHelper(userid: number, offset: number, username: string) {
    const { alidlist, animelist, amount } = await getUserWatchingAiring(
        "airingupdates",
        userid,
        5,
        offset
    );
    let msg: string;
    if (amount == 0) {
        msg = `<b>You have not subscribed to airing updates for any anime. </b>`;
        return { msg: msg, keyboard: undefined };
    } else msg = `<b>Displaying your anime subscriptions: </b>\n\n`;
    for (let i = 0; i < alidlist.length; i++) {
        msg += `${i + 1}. ${
            animelist[i]
        }\n<i>Stop reminding me: <a href="t.me/${username}?start=stopremindme_${
            alidlist[i]
        }">Click here!</a></i>\n\n`;
    }
    const keyboard = getPagination(offset, Math.ceil(amount / 5), "airingupd");
    return { msg, keyboard };
}

/**The callback from pages of /airingupdates. CBQ: airingupd_*/
export async function airingUpdatesListCBQ(ctx: MyContext) {
    await ctx.answerCallbackQuery("Fetching!");
    const movepg = parseInt(ctx.match[1]);
    if (ctx.match[2] == "_current") return;
    const { msg, keyboard } = await airingUpdatesListHelper(
        ctx.session.userid,
        movepg,
        ctx.me.username
    );
    try {
        if (ctx.msg.text.trim() !== HTMLMessageToMessage(msg).trim())
            await ctx.editMessageText(msg, { reply_markup: keyboard });
    } catch (e) {
        console.log(e);
    }
}

/**
 ** Removes anime for airing list.
 ** Called by /stopairingupdates_alid.
 */
export async function stopAiringUpdates(ctx: MyContext) {
    await ctx.deleteMessage();
    const remove = parseInt(ctx.match[1] as string);
    const anideets = await db.anime.findUnique({
        where: { alid: remove },
        select: { jpname: true, status: true }
    });
    if (anideets == undefined || !(anideets.status == "RELEASING" || anideets.status == "NOT_YET_RELEASED")) {
        await ctx.reply(`Invalid anime provided.`);
        return;
    }
    const name = anideets.jpname;
    const userau = await db.airingupdates.findMany({
        where: { userid: { has: ctx.session.userid } }
    });
    let i = -1;
    if (userau !== null) i = userau.map((o) => o.alid).indexOf(remove);
    if (i === -1) {
        await ctx.reply(`You are already not recieving the updates for <b>${name}</b>.`);
        return;
    }
    userau[i].userid.splice(userau[i].userid.indexOf(ctx.session.userid), 1);
    await db.airingupdates.update({
        where: { alid: remove },
        data: userau[i]
    });
    await ctx.reply(`You will no longer recieve updates for <b>${name}</b>.`);
    return;
}

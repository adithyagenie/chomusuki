import { db } from "../../..";
import { addAiringFollow, checkAnimeTable, getUserWatchingAiring } from "../../../database/animeDB";
import { MyContext } from "../../bot";
import { getPagination, HTMLMessageToMessage } from "./a_misc_helpers";
import { airingupdates, anime } from "../../../database/schema";
import { eq, sql } from "drizzle-orm";
import { b, fmt, i as italic, link } from "@grammyjs/parse-mode";

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
    const auResult = await db.select({ alid: airingupdates.alid })
        .from(airingupdates)
        .where(sql`${userid} = ANY(${airingupdates.userid})`);
    
    let remindme: number[];
    if (auResult.length === 0) remindme = [];
    else remindme = auResult.map((o) => o.alid);
    
    if (remindme.includes(alid)) {
        await ctx.reply("You are already following updates for this anime!");
        return;
    }
    const res = await addAiringFollow(alid, userid);
    if (res == 0) {
        const jpnameResult = await db.select({ jpname: anime.jpname })
            .from(anime)
            .where(eq(anime.alid, alid));
        
        const message = fmt`You will now recieve updates on ${b}${jpnameResult[0]?.jpname}.${b}`;
        await ctx.reply(message.text, { entities: message.entities });
    } else {
        await ctx.reply("Error encountered ;_;");
    }
    return;
}

/**
 ** Sends the first page of the list of anime the user is currently subscribed to.
 ** Called by /airingupdates.
 */
export async function airingUpdatesList(ctx: MyContext) {
    const userid = ctx.session.userid;
    const { msg, msgEntities, keyboard } = await airingUpdatesListHelper(userid, 1, ctx.me.username);
    if (keyboard == undefined || keyboard.inline_keyboard[0].length == 1)
        await ctx.reply(msg, { entities: msgEntities });
    else await ctx.reply(msg, { entities: msgEntities, reply_markup: keyboard });
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
    if (amount == 0) {
        const message = fmt`${b}You have not subscribed to airing updates for any anime. ${b}`;
        return { msg: message.text, msgEntities: message.entities, keyboard: undefined };
    }
    
    let formattedMsg = fmt`${b}Displaying your anime subscriptions: ${b}\n\n`;
    for (let i = 0; i < alidlist.length; i++) {
        const url = `t.me/${username}?start=stopremindme_${alidlist[i]}`;
        formattedMsg = fmt`${formattedMsg}${i + 1}. ${animelist[i]}\n${italic}Stop reminding me: ${link(url)}Click here!${link(url)}${italic}\n\n`;
    }
    const keyboard = getPagination(offset, Math.ceil(amount / 5), "airingupd");
    return { msg: formattedMsg.text, msgEntities: formattedMsg.entities, keyboard };
}

/**The callback from pages of /airingupdates. CBQ: airingupd_*/
export async function airingUpdatesListCBQ(ctx: MyContext) {
    await ctx.answerCallbackQuery("Fetching!");
    const movepg = parseInt(ctx.match[1]);
    if (ctx.match[2] == "_current") return;
    const { msg, msgEntities, keyboard } = await airingUpdatesListHelper(
        ctx.session.userid,
        movepg,
        ctx.me.username
    );
    try {
        if (ctx.msg.text.trim() !== HTMLMessageToMessage(msg).trim())
            await ctx.editMessageText(msg, { entities: msgEntities, reply_markup: keyboard });
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
    const anideetsResult = await db.select({ jpname: anime.jpname, status: anime.status })
        .from(anime)
        .where(eq(anime.alid, remove));
    
    const anideets = anideetsResult[0];
    if (anideets == undefined || !(anideets.status == "RELEASING" || anideets.status == "NOT_YET_RELEASED")) {
        await ctx.reply(`Invalid anime provided.`);
        return;
    }
    const name = anideets.jpname;
    const userau = await db.select()
        .from(airingupdates)
        .where(sql`${ctx.session.userid} = ANY(${airingupdates.userid})`);
    
    let i = -1;
    if (userau.length > 0) i = userau.map((o) => o.alid).indexOf(remove);
    if (i === -1) {
        const message = fmt`You are already not recieving the updates for ${b}${name}${b}.`;
        await ctx.reply(message.text, { entities: message.entities });
        return;
    }
    const updatedUserids = [...userau[i].userid];
    updatedUserids.splice(updatedUserids.indexOf(ctx.session.userid), 1);
    
    await db.update(airingupdates)
        .set({ userid: updatedUserids })
        .where(eq(airingupdates.alid, remove));
    
    const message2 = fmt`You will no longer recieve updates for ${b}${name}${b}.`;
    await ctx.reply(message2.text, { entities: message2.entities });
    return;
}

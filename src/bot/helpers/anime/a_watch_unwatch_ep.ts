// Unwatch anime command

import { InlineKeyboard, Keyboard } from "grammy";
import { getDecimal, markWatchedunWatched } from "../../../database/animeDB";
import { MyContext, MyConversation, MyConversationContext } from "../../bot";
import { getPending, getSinglePending } from "../../../api/pending";
import { db } from "../../..";
import { getUpdaterAnimeIndex, makeEpKeyboard, messageToHTMLMessage } from "./a_misc_helpers";
import aniep from "aniep";
import { watchedepanime, anime } from "../../../database/schema";
import { eq, and, sql } from "drizzle-orm";
import { code, fmt, i as italic } from "@grammyjs/parse-mode";

export async function anime_unwatch(ctx: MyContext) {
    await ctx.conversation.enter("unwatchhelper");
}

export async function unwatchhelper(conversation: MyConversation, ctx: MyConversationContext) {
    const userid = await conversation.external((ctx) => ctx.session.userid);
    const updateobj = await conversation.external(() => getPending(userid));
    const keyboard = new Keyboard().resized().persistent().oneTime();
    const animelist = [];
    for (let i = 0; i < updateobj.length; i++) {
        animelist.push(updateobj[i].jpname);
        keyboard.text(`Anime: ${updateobj[i].jpname}`).row();
    }
    await ctx.reply("Select the anime: (/cancel to cancel)", {
        reply_markup: keyboard
    });
    const animename = (await conversation.waitForHears(/Anime: (.+)/)).message.text.slice(7).trim();
    const alid = updateobj.find((o) => o.jpname == animename).alid;
    const eplist: number[] = [];
    const animeindex = await getUpdaterAnimeIndex(animename, updateobj);
    for (let j = 0; j < updateobj[animeindex].watched.length; j++)
        eplist.push(updateobj[animeindex].watched[j]);

    while (true) {
        const newkey = new Keyboard().persistent().resized();
        for (let i = 0; i < eplist.length; i++) newkey.text(`Unwatch episode: ${eplist[i]}`);
        newkey.text("Finish marking");
        await ctx.reply("Choose the episode: ", { reply_markup: newkey });
        const buttonpress = (
            await conversation.waitForHears(/(^Unwatch episode: ([0-9]+)$)|(^Finish marking$)/)
        ).message.text;
        if (buttonpress == "Finish marking") {
            await ctx.reply("Alright finishing up!");
            break;
        }
        const tounwatch = parseInt(buttonpress.slice(17).trim());
        console.log(`Recieved request for unwatch: \nANIME: ${animename}, EP: ${tounwatch}`);
        let watchedAnime: number[] = [];
        watchedAnime = updateobj[animeindex].watched;
        watchedAnime = watchedAnime.filter((o) => o != tounwatch);
        const epArray = getDecimal(watchedAnime);
        const toupdate = {
            userid: userid,
            alid: alid,
            ep: Array.isArray(epArray) ? epArray : [epArray]
        };
        const updres = await markWatchedunWatched(toupdate);
        if (updres == 0) {
            await ctx.reply(`Marked Ep ${tounwatch} of ${animename} as not watched`, {
                reply_markup: { remove_keyboard: true }
            });
        } else {
            await ctx.reply(`Error occured while marking episode as unwatched`, {
                reply_markup: { remove_keyboard: true }
            });
        }
    }
    return;
}

export async function callback_mkwatch(ctx: MyContext) {
    await ctx.answerCallbackQuery("Processing");
    const userid = ctx.session.userid;
    const keyboard = await makeEpKeyboard(ctx.msg.caption, "mkwtch", userid);
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
}

export async function callback_mkwatchep(ctx: MyContext) {
    await ctx.answerCallbackQuery(`Processing...`);
    const userid = ctx.session.userid;
    const alid = parseInt(ctx.match[1]);
    const epnum = parseInt(ctx.match[2]);

    const epResult = await db.select({ ep: watchedepanime.ep })
        .from(watchedepanime)
        .where(and(
            eq(watchedepanime.userid, userid),
            eq(watchedepanime.alid, alid)
        ));
    
    const ep = [...(epResult[0]?.ep || [])];
    ep.push(...getDecimal(epnum));

    const res = await markWatchedunWatched({ userid, alid, ep });
    if (res === 1) {
        await ctx.reply("Failed to add to watched.");
        return;
    }
    
    const jpnameResult = await db.select({ jpname: anime.jpname })
        .from(anime)
        .where(eq(anime.alid, alid));
    
    await ctx.reply(
        `Episode: ${epnum} of ${jpnameResult[0]?.jpname} has been marked as watched!`
    );

    // let oldwatch: { epnum: number; epname: string }[] = [];
    // let toupdateanime: { epnum: number; epname: string };
    // for (let j = 0; j < updateobj[indexnum].watched.length; j++)
    // 	oldwatch.push(updateobj[indexnum].watched[j]);
    // for (let j = 0; j < updateobj[indexnum].notwatched.length; j++) {
    // 	if (updateobj[indexnum].notwatched[j].epnum == epnum)
    // 		toupdateanime = updateobj[indexnum].notwatched[j];
    // }

    // oldwatch.push(toupdateanime);

    // var index =
    // 	updater.updateobj[userid][indexnum].notwatched.indexOf(toupdateanime);
    // if (index !== -1) {
    // 	updater.updateobj[userid][indexnum].notwatched.splice(index, 1);
    // }
    // updater.updateobj[userid][indexnum].watched.push(toupdateanime);
    // oldwatch.sort((a, b) => (a.epnum > b.epnum ? 1 : -1));
    // const updres = await markWatchedunWatched({
    // 	userid: userid,
    // 	alid:
    // 	watched: oldwatch,
    // });
    // if (updres == 0) {

    const newkeyboard = new InlineKeyboard();
    //newkeyboard = newkeyboard.map((o1) => o1.filter((o) => !(o.text == `Episode ${epnum}`)));
    /**TEST THIS PLEASEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE */
    let tt: {
        text: string,
        callback_data: string
    }[] = [].concat(...ctx.msg.reply_markup.inline_keyboard);
    tt = tt.filter((o) => !(o.text == `Episode ${epnum}`));
    for (let i = 0; i < tt.length; i += 2) {
        const bruh: { text: string, callback_data: string } = tt[i];
        const bruh2: { text: string, callback_data: string } = tt[i + 1];
        if (tt[i + 1] === undefined) newkeyboard.add(bruh).row();
        else newkeyboard.add(bruh).add(bruh2).row();
    }
    //newkeyboard.text("Go back", "back");
    const oldformatmsg = messageToHTMLMessage(ctx.msg.caption, ctx.msg.caption_entities);
    const newMsgArray = oldformatmsg.split("\n");
    for (let j = 0; j < newMsgArray.length; j++) {
        if (aniep(newMsgArray[j])) {
            newMsgArray.splice(j, 1);
            break;
        }
    }
    await ctx.api.editMessageCaption(ctx.from.id, ctx.msg.message_id, {
        caption: newMsgArray.join("\n"),
        reply_markup: newkeyboard
    });
}

const consecutiveRanges = (a: number[]) => {
    let length = 1;
    const list: string[] = [];
    if (a.length == 0) return list;
    for (let i = 1; i <= a.length; i++) {
        if (i == a.length || a[i] - a[i - 1] != 1) {
            if (length == 1) list.push(a[i - length].toString());
            else list.push(`${a[i - length]} -> ${a[i - 1]}`);
            length = 1;
        } else length++;
    }
    return list;
};

export async function markWatchedRange(conversation: MyConversation, ctx: MyConversationContext) {
    const genkeyboard = new InlineKeyboard();
    const userid = await conversation.external((ctx) => ctx.session.userid);
    const watching = await conversation.external(async () => {
        const result = await db.execute<{ jpname: string; alid: number }>(
            sql`SELECT a.jpname, a.alid FROM anime a, watchinganime w, unnest(w.alid) s WHERE (a.alid IN (s)) AND (w.userid = ${userid})`
        );
        return result.rows;
    });
    if (watching === null || watching.length === 0) return;
    await conversation.external(() => {
        for (let i = 0; i < watching.length; i += 2) {
            if (watching[i].alid != undefined)
                genkeyboard.text(`${watching[i].jpname}`, `mkwr_${watching[i].alid}`);
            if (watching[i + 1].alid != undefined)
                genkeyboard.text(`${watching[i + 1].jpname}`, `mkwr_${watching[i + 1].alid}`);
            genkeyboard.row();
        }
    });
    const msgid = (
        await ctx.reply("Which anime do you need to modify?", { reply_markup: genkeyboard })
    ).message_id;
    const _ = await conversation.waitForCallbackQuery(/mkwr_(.+)/);
    await _.answerCallbackQuery("Processing...");
    const alid = parseInt(_.match[1]);
    if (Number.isNaN(alid)) return;
    await ctx.api.deleteMessage(ctx.from.id, msgid);
    const aniname = watching.find((o) => o.alid == alid).jpname;
    const data = await conversation.external(() =>
        getSinglePending(userid, null, alid)
    );
    if (data.notwatched.length == 0) {
        await ctx.reply(`You have already marked all the episodes of ${aniname} as watched!`);
        return;
    }
    const possibleRanges = consecutiveRanges(data.notwatched).toString();
    const message1 = fmt`Give the episode range to mark as watched:\n${italic}Possible ranges: ${possibleRanges}.\nPlease give it in the form of ${code}start-end${code}${italic}`;
    await ctx.reply(message1.text, { entities: message1.entities });
    while (true) {
        const range = (await conversation.waitForHears(/^((\d+)|((\d+)-(\d+)))$/)).match;
        if (range[0] == null) {
            const message2 = fmt`Invalid range specified. Please give it in the form of ${code}start-end${code}`;
            await ctx.reply(message2.text, { entities: message2.entities });
            continue;
        }
        const [start, end] = [parseInt(range[1]), parseInt(range[2])];
        if (Number.isNaN(start) || Number.isNaN(end)) {
            await ctx.reply("Please specify numbers in range :/");
            continue;
        }
        if (start > end) {
            await ctx.reply("How can the start be greater than end range?");
            continue;
        }
        const arr = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        if (!arr.every((o) => data.notwatched.includes(o))) {
            await ctx.reply("Given numbers out of range :/");
            continue;
        }
        await conversation.external(async () => {
            const epResult = await db.select({ ep: watchedepanime.ep })
                .from(watchedepanime)
                .where(and(
                    eq(watchedepanime.userid, userid),
                    eq(watchedepanime.alid, alid)
                ));
            
            let id = [...(epResult[0]?.ep || [])];
            id = id.concat(...getDecimal(arr));
            
            await db.update(watchedepanime)
                .set({ ep: id })
                .where(and(
                    eq(watchedepanime.userid, userid),
                    eq(watchedepanime.alid, alid)
                ));
        });
        break;
    }
    await ctx.reply(`Marked selected episodes as watched!`);
    return;
}

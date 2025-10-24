import { db } from "../../..";
import { bot, MyContext } from "../../bot";
import { getNumber, newDL } from "../../../database/animeDB";
import aniep from "aniep";
import { getSinglePending } from "../../../api/pending";
import { getxdcc } from "../../../api/subsplease-xdcc";
import { i_DlSync, i_NyaaResponse } from "../../../interfaces";
import { makeEpKeyboard } from "./a_misc_helpers";
import axios, { AxiosResponse } from "axios";
import { syncupd, anime } from "../../../database/schema";
import { eq } from "drizzle-orm";

/**
 ** Gives all the downloads queued for the user.
 ** Responds to /dllist.
 */
export async function anime_dllist(ctx: MyContext) {
    const userid = ctx.session.userid;
    await ctx.replyWithChatAction("typing");
    const syncupdResult = await db.select({ anime: syncupd.anime, epnum: syncupd.epnum })
        .from(syncupd)
        .where(eq(syncupd.userid, userid));
    
    const pendingdl = syncupdResult.map((o) => {
        return { anime: o.anime, epnum: getNumber(o.epnum) as number };
    });
    if (pendingdl.length == 0) {
        await ctx.reply("No pending downloads!");
    } else {
        const resser: { anime: string; epnum: number[] }[] = [];
        for (let i = 0; i < pendingdl.length; i++) {
            const index = resser.findIndex((o) => o.anime == pendingdl[i].anime);
            if (index == -1)
                resser.push({
                    anime: pendingdl[i].anime,
                    epnum: [pendingdl[i].epnum]
                });
            else {
                resser[index].epnum.push(pendingdl[i].epnum);
                resser[index].epnum.sort();
            }
        }

        let msg = "<code>DOWNLOAD QUEUE:</code>\n\n";
        const msglist: string[] = [];
        for (let i = 0; i < resser.length; i++) {
            const tmpmsg = `<b>${resser[i].anime}</b> - Episode ${resser[i].epnum.join(", ")}\n`;
            if (msg.length + tmpmsg.length > 1024) {
                msglist.push(msg);
                msg = tmpmsg;
            } else msg += tmpmsg;
        }
        if (msglist.length > 0) {
            for (let i = 0; i < msglist.length; i++)
                await bot.api.sendMessage(ctx.from.id, msglist[i]);
        } else
            await bot.api.sendMessage(ctx.from.id, msg);
    }
}

// Handles download Callback query
export async function dl_cbq(ctx: MyContext) {
    await ctx.answerCallbackQuery();
    const userid = ctx.session.userid;
    const keyboard = await makeEpKeyboard(ctx.msg.caption, "dlep", userid);
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
}

// also a download callback handle
export async function dlep_cbq(ctx: MyContext) {
    await ctx.answerCallbackQuery("Download request recieved.");
    const userid = ctx.session.userid;
    const alid = parseInt(ctx.match[1]);
    const epnum = parseInt(ctx.match[2]);
    const pull1Result = await db.select({ optnames: anime.optnames })
        .from(anime)
        .where(eq(anime.alid, alid));
    
    if (pull1Result.length === 0) throw new Error(`Anime not found: ${alid}`);
    const pull1 = pull1Result[0];
    
    const updateobj = await getSinglePending(userid, null, alid);
    const syncupdResult = await db.select()
        .from(syncupd)
        .where(eq(syncupd.userid, userid));
    
    const pendingdl: i_DlSync[] = syncupdResult.map((o) => {
        const i = getNumber(o.epnum) as number;
        return Object.assign({}, o, { epnum: i });
    });
    let flag = false;
    for (let i = 0; i < pendingdl.length; i++) {
        if (pendingdl[i].anime == updateobj.jpname && pendingdl[i].epnum == epnum) {
            flag = true;
            break;
        }
    }
    if (flag == true) {
        await ctx.reply(
            `Episode ${epnum} of ${updateobj.jpname} already queued for download! Use /dllist to view your pending downloads.`
        );
        return;
    }
    try {
        let query = `"${updateobj.jpname}"|"${updateobj.enname}"`;
        if (pull1.optnames !== null) pull1.optnames.forEach((o) => (query += `|"${o}"`));
        query += ` 1080p "- ${String(epnum).padStart(2, "0")}"`;
        console.log(query);

        let res: AxiosResponse<i_NyaaResponse[]>;
        res = await axios.get<i_NyaaResponse[]>(
            `${process.env.NYAA_API_URL}/user/SubsPlease?q=${query}`
        );

        let torrentlink: string;
        if (res.status === 400) {
            console.error(`ERROR DL: "Unable to reach nyaa endpoint."`);
            await ctx.reply("Error occurred ;_;");
        }
        if (res.data.length == 0) {
            res = await axios.get<i_NyaaResponse[]>(
                `${process.env.NYAA_API_URL}/user/Erai-raws?q=${query}`
            );
            if (res.status === 400 || res.data.length == 0) {
                await ctx.reply(
                    `Unable to fetch downloads for ${updateobj.jpname}. Please contact @adithyagenie.`
                );
                return;
            }
        }
        const dl = res.data.filter((o) => {
            o.title = o.title.toLowerCase();
            return (
                aniep(o.title) == epnum &&
                (o.title.includes(updateobj.jpname.toLowerCase()) ||
                    o.title.includes(updateobj.enname.toLowerCase()) ||
                    pull1.optnames.map((p) => p.toLowerCase()).some((q) => o.title.includes(q)))
            );
        });
        console.log(`DL::::: ${dl}`);
        if (dl.length > 1 || dl.length == 0) {
            console.error(`ERROR DL: multiple or no sites nyaa:: ${dl}`);
            await ctx.reply("Error occurred ;_;");
        }
        const xdcclink = await getxdcc(res.data[0].title);
        console.log(`Downloading: ${res.data[0].title}`);
        if (xdcclink !== undefined && xdcclink.packnum != 0) {
            console.log(`startdl triggered @ ${xdcclink.botname}: ${xdcclink.packnum}`);
            const sync_toupd: i_DlSync = {
                userid: userid,
                synctype: "dl",
                anime: updateobj.jpname,
                epnum: epnum,
                dltype: "xdcc",
                xdccdata: [xdcclink.botname, xdcclink.packnum.toFixed()]
            };
            const returncode = await newDL(sync_toupd);
            if (returncode === 0) {
                await ctx.reply(`Episode ${epnum} of ${updateobj.jpname} queued for download!`);
            } else await ctx.reply("Sending DL failed.");
            return;
        } else {
            torrentlink = res.data[0].file;
            console.log(`torrentdl triggered ${torrentlink}`);
            const sync_toupd: i_DlSync = {
                userid: userid,
                synctype: "dl",
                anime: updateobj.jpname,
                epnum: epnum,
                dltype: "torrent",
                torrentdata: torrentlink
            };
            const returncode = await newDL(sync_toupd);
            if (returncode === 0) {
                await ctx.reply(`Episode ${epnum} of ${updateobj.jpname} queued for download!`);
            } else await ctx.reply("Sending DL failed.");
            return;
        }
    } catch (error) {
        console.error(`ERROR DL: ${error}`);
        await ctx.reply("Error occurred ;_;");
    }
}

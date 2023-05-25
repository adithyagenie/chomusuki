import { axios, db } from "../../..";
import { MyContext, bot } from "../../bot";
import { getNumber, newDL } from "../../../database/animeDB";
import aniep from "aniep";
import { getPending } from "../../../api/pending";
import { getxdcc } from "../../../api/subsplease-xdcc";
import { i_DlSync, i_NyaaResponse } from "../../../interfaces";
import { getUpdaterAnimeIndex, makeEpKeyboard } from "./a_misc_helpers";

/**
 ** Gives all the downloads queued for the user.
 ** Responds to /dllist.
 */
export async function anime_dllist(ctx: MyContext) {
	{
		const userid = ctx.session.userid;
		await ctx.replyWithChatAction("typing");
		const pendingdl = (
			await db.syncupd.findMany({
				where: { userid },
				select: { anime: true, epnum: true }
			})
		).map((o) => {
			return { anime: o.anime, epnum: getNumber(o.epnum) as number };
		});
		if (pendingdl.length == 0) {
			ctx.reply("No pending downloads!");
		} else {
			const resser: { anime: string; epnum: number[] }[] = [];
			for (let i = 0; i < pendingdl.length; i++) {
				let index = resser.findIndex((o) => o.anime == pendingdl[i].anime);
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

			var msg: string = "<code>DOWNLOAD QUEUE:</code>\n\n";
			var msglist: string[] = [];
			for (let i = 0; i < resser.length; i++) {
				let tmpmsg = `<b>${resser[i].anime}</b> - Episode ${resser[i].epnum.join(", ")}\n`;
				if (msg.length + tmpmsg.length > 1024) {
					msglist.push(msg);
					msg = tmpmsg;
				} else msg += tmpmsg;
			}
			if (msglist.length > 0) {
				for (let i = 0; i < msglist.length; i++)
					bot.api.sendMessage(ctx.from.id, msglist[i], {
						parse_mode: "HTML"
					});
			} else
				bot.api.sendMessage(ctx.from.id, msg, {
					parse_mode: "HTML"
				});
		}
	}
}

// Handles download Callback query
export async function dl_cbq(ctx: MyContext) {
	ctx.answerCallbackQuery();
	const userid = ctx.session.userid;
	const keyboard = await makeEpKeyboard(ctx.msg.caption, "dlep", userid);
	ctx.editMessageReplyMarkup({ reply_markup: keyboard });
}

// also a download callback handle
export async function dlep_cbq(ctx: MyContext) {
	ctx.answerCallbackQuery("Download request recieved.");
	const userid = ctx.session.userid;
	let epnum = parseInt(ctx.callbackQuery.data.split("_")[1]);
	let updateobj = await getPending(userid);
	let animename = ctx.msg.caption.split("Anime: ")[1].split("\n")[0].trim();
	const i = await getUpdaterAnimeIndex(animename, updateobj);
	const j = updateobj[i].notwatched.indexOf(epnum);

	let pendingdl: i_DlSync[] = (
		await db.syncupd.findMany({
			where: { userid }
		})
	).map((o) => {
		let _ = getNumber(o.epnum) as number;
		return Object.assign(o, { epnum: _ });
	});
	var flag = false;
	for (let i = 0; i < pendingdl.length; i++) {
		if (pendingdl[i].anime == animename && pendingdl[i].epnum == epnum) {
			flag = true;
			break;
		}
	}
	if (flag == true) {
		ctx.reply(
			`*__Episode ${epnum}__* of *__${animename}__* already queued for download! Use /dllist to view your pending downloads.`,
			{ parse_mode: "MarkdownV2" }
		);
		return;
	}
	try {
		const res = await axios.get<i_NyaaResponse[]>(
			`${process.env.NYAA_API_URL}/user/SubsPlease?q="${updateobj[i].jpname}"|"${updateobj[i].enname} 1080p "- 0${epnum}"`
		);
		var xdcclink: { packnum: number; botname: string };
		var torrentlink: string;
		if (res.status != 400) {
			xdcclink = undefined;
			torrentlink = undefined;
		} else {
			const dl = res.data.filter(
				(o) => aniep(o.title) == epnum && o.title.includes(updateobj[i].jpname)
			);
			if (dl.length > 1 || dl.length == 0) throw new Error("multiple or no sites nyaa");
			xdcclink = await getxdcc(res.data[0].title);
			console.log(`Downloading: ${res.data[0].title}`);
		}
		if (xdcclink.packnum != 0) {
			console.log(`startdl triggered @ ${xdcclink.botname}: ${xdcclink.packnum}`);
			let sync_toupd: i_DlSync = {
				userid: userid,
				synctype: "dl",
				anime: animename,
				epnum: epnum,
				dltype: "xdcc",
				xdccdata: [xdcclink.botname, xdcclink.packnum.toFixed()]
			};
			let returncode = await newDL(sync_toupd);
			if (returncode !== 0) ctx.reply("Sending DL failed.");
			else
				ctx.reply(`*__Episode ${epnum}__* of *__${animename}__* queued for download!`, {
					parse_mode: "MarkdownV2"
				});
			return;
		} else {
			torrentlink = res.data[0].file;
			console.log(`torrentdl triggered ${torrentlink}`);
			let sync_toupd: i_DlSync = {
				userid: userid,
				synctype: "dl",
				anime: animename,
				epnum: epnum,
				dltype: "torrent",
				torrentdata: torrentlink
			};
			let returncode = await newDL(sync_toupd);
			if (returncode !== 0) ctx.reply("Sending DL failed.");
			else
				ctx.reply(`*__Episode ${epnum}__* of *__${animename}__* queued for download!`, {
					parse_mode: "MarkdownV2"
				});
			return;
		}
	} catch (error) {
		console.error(`ERROR DL: ${error}`);
	}
}

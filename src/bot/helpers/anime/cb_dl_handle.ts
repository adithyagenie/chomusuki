import aniep from "aniep";
import { axios, db, dbcache, updater } from "../../..";
import { getxdcc } from "../../../api/subsplease-xdcc";
import { getNumber, newDL } from "../../../database/animeDB";
import { i_DlSync, i_NyaaResponse } from "../../../interfaces";
import { MyContext, getUpdaterAnimeIndex } from "../../bot";
import { makeEpKeyboard } from "./EpKeyboard";

// Handles download Callback query
export async function callback_dl(ctx: MyContext) {
	const userid = await dbcache.getUserID(ctx.callbackQuery.message.chat.id);
	const keyboard = await makeEpKeyboard(ctx.callbackQuery.message.caption, "dlep", userid);
	ctx.editMessageReplyMarkup({ reply_markup: keyboard });
	ctx.answerCallbackQuery();
}

// also a download callback handle
export async function callback_dlep(ctx: MyContext) {
	ctx.answerCallbackQuery("Download request recieved.");
	const userid = await dbcache.getUserID(ctx.callbackQuery.message.chat.id);
	let epnum = parseInt(ctx.callbackQuery.data.split("_")[1]);
	let updateobj = await updater.getUpdateObj(userid);
	let animename = ctx.callbackQuery.message.caption.split("Anime: ")[1].split("\n")[0].trim();
	const i = await getUpdaterAnimeIndex(animename, userid);
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

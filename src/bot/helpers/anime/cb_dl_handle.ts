import { updater } from "../../..";
import { getxdcc } from "../../../api/subsplease-xdcc";
import { DLSync, getPendingDL, DlSync } from "../../../database/anime_db";
import { MyContext, getUpdaterAnimeIndex } from "../../bot";
import { makeEpKeyboard } from "./EpKeyboard";

// Handles download Callback query
export async function callback_dl(ctx: MyContext) {
	const keyboard = makeEpKeyboard(ctx, "dlep");
	ctx.editMessageReplyMarkup({ reply_markup: keyboard });
	ctx.answerCallbackQuery();
}

// also a download callback handle
export async function callback_dlep(ctx: MyContext) {
	ctx.answerCallbackQuery("Download request recieved.");
	let epnum = parseInt(ctx.callbackQuery.data.split("_")[1]);
	let updateobj = updater.updateobj;
	let animename = ctx.callbackQuery.message.caption
		.split("Anime: ")[1]
		.split("Episodes:")[0]
		.trim();
	const i = getUpdaterAnimeIndex(animename);
	const j = updater.updateobj[i].notwatched
		.map((object) => object.epnum)
		.indexOf(epnum);

	let pendingdl: DLSync[] = await getPendingDL();
	let queuenum = 0;
	var flag = false;
	if (pendingdl.length != 0)
		queuenum = Math.max(...pendingdl.map((o) => o.queuenum));
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
	let actualnotwatch = updateobj[i].notwatchedepnames[j];

	const xdcclink = await getxdcc(actualnotwatch);
	console.log(`Downloading: ${actualnotwatch}`);

	if (xdcclink.packnum != 0) {
		console.log(
			`startdl triggered @ ${xdcclink.botname}: ${xdcclink.packnum}`
		);
		let sync_toupd: DLSync = {
			queuenum: queuenum + 1,
			synctype: "dl",
			anime: animename,
			epnum: epnum,
			dltype: "xdcc",
			xdccData: {
				botname: xdcclink.botname,
				packnum: xdcclink.packnum,
			},
		};
		let returncode = await DlSync(sync_toupd);
		if (returncode !== true) ctx.reply("Sending DL failed.");
		else
			ctx.reply(
				`*__Episode ${epnum}__* of *__${animename}__* queued for download!`,
				{ parse_mode: "MarkdownV2" }
			);
		return;
	} else {
		let torrentlinks = updateobj[i].torrentlink[j];
		console.log(`torrentdl triggered ${torrentlinks}`);
		let sync_toupd: DLSync = {
			queuenum: queuenum + 1,
			synctype: "dl",
			anime: animename,
			epnum: epnum,
			dltype: "torrent",
			torrentData: { links: torrentlinks },
		};
		let returncode = await DlSync(sync_toupd);
		if (returncode !== true) ctx.reply("Sending DL failed.");
		else
			ctx.reply(
				`*__Episode ${epnum}__* of *__${animename}__* queued for download!`,
				{ parse_mode: "MarkdownV2" }
			);
		return;
	}
}

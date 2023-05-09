import { Prisma } from "@prisma/client";
import { db, dbcache, updater } from "../../..";
import { getDecimal, markWatchedunWatched } from "../../../database/animeDB";
import { MyContext, bot, getUpdaterAnimeIndex } from "../../bot";
import { messageToHTMLMessage } from "../caption_entity_handler";
import { makeEpKeyboard } from "./EpKeyboard";

export async function callback_mkwatch(ctx: MyContext) {
	const userid = await dbcache.getUserID(ctx.callbackQuery.message.chat.id);
	const keyboard = await makeEpKeyboard(ctx.callbackQuery.message.caption, "mkwtch", userid);
	ctx.editMessageReplyMarkup({ reply_markup: keyboard });
	ctx.answerCallbackQuery();
}

export async function callback_mkwatchep(ctx: MyContext) {
	const userid = await dbcache.getUserID(ctx.callbackQuery.message.chat.id);
	const epnum = parseInt(ctx.callbackQuery.data.split("_")[1]);
	let oldmsg = ctx.callbackQuery.message.caption;
	let animename = oldmsg.split("Anime: ")[1].split("\n")[0].trim();

	const alid = (
		await db.anime.findMany({
			where: { jpname: animename },
			select: { alid: true },
			take: 1
		})
	)[0].alid;

	const ep = (
		await db.watchedepanime.findUnique({
			where: {
				userid_alid: {
					userid,
					alid
				}
			},
			select: { ep: true }
		})
	).ep;
	ep.push(getDecimal(epnum) as Prisma.Decimal);

	const res = await markWatchedunWatched({ userid, alid, ep });

	// let oldwatch: { epnum: number; epname: string }[] = [];
	let indexnum = await getUpdaterAnimeIndex(animename, userid);
	(await updater.getUpdateObj(userid))[indexnum];
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
	// 	const newkeyboard = makeEpKeyboard(ctx.callbackQuery.message.caption, "mkwtch", userid);
	// 	const oldformatmsg = messageToHTMLMessage(
	// 		ctx.callbackQuery.message.caption,
	// 		ctx.callbackQuery.message.caption_entities
	// 	);
	// 	var newMsgArray = oldformatmsg.split("\n");
	// 	for (let j = 0; j < newMsgArray.length; j++) {
	// 		if (newMsgArray[j].startsWith(`Episode ${epnum}:`)) {
	// 			newMsgArray.splice(j, 1);
	// 			break;
	// 		}
	// 	}
	// 	const newmsg = newMsgArray.join("\n");
	// 	bot.api.editMessageCaption(
	// 		ctx.callbackQuery.message.chat.id,
	// 		ctx.callbackQuery.message.message_id,
	// 		{
	// 			caption: newmsg,
	// 			parse_mode: "HTML",
	// 			reply_markup: newkeyboard,
	// 		}
	// 	);
	// 	ctx.answerCallbackQuery(`Marked ${epnum} as watched!`);
	// } else {
	// 	await ctx.reply(`Error occured while marking episode as watched.`);
	// 	ctx.answerCallbackQuery(`Error occured.`);
	// }
}

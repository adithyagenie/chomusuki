// Unwatch anime command

import { Keyboard } from "grammy";
import { getDecimal, markWatchedunWatched } from "../../../database/animeDB";
import { MyContext, MyConversation } from "../../bot";
import { Prisma, watchedepanime } from "@prisma/client";
import { getPending } from "../../../api/pending";
import { db } from "../../..";
import { getUpdaterAnimeIndex, makeEpKeyboard } from "./a_misc_helpers";

export async function anime_unwatch(ctx: MyContext) {
	await ctx.conversation.enter("unwatchhelper");
}

export async function unwatchhelper(conversation: MyConversation, ctx: MyContext) {
	const userid = ctx.session.userid;
	let updateobj = await getPending(userid);
	let keyboard = new Keyboard().resized().persistent().oneTime();
	let animelist = [];
	for (let i = 0; i < updateobj.length; i++) {
		animelist.push(updateobj[i].jpname);
		keyboard.text(`Anime: ${updateobj[i].jpname}`).row();
	}
	await ctx.reply("Select the anime: (/cancel to cancel)", {
		reply_markup: keyboard
	});
	const animename = (await conversation.waitForHears(/Anime: (.+)/)).message.text.slice(7).trim();
	const alid = updateobj.find((o) => o.jpname == animename).alid;
	let eplist: number[] = [];
	let animeindex = await getUpdaterAnimeIndex(animename, updateobj);
	for (let j = 0; j < updateobj[animeindex].watched.length; j++)
		eplist.push(updateobj[animeindex].watched[j]);

	while (true) {
		let newkey = new Keyboard().persistent().resized();
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
		const toupdate: watchedepanime = {
			userid: userid,
			alid: alid,
			ep: getDecimal(watchedAnime) as Prisma.Decimal[]
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
	ctx.answerCallbackQuery();
	const userid = ctx.session.userid;
	const updateobj = await getPending(userid);
	const keyboard = await makeEpKeyboard(ctx.callbackQuery.message.caption, "mkwtch", updateobj);
	ctx.editMessageReplyMarkup({ reply_markup: keyboard });
}

export async function callback_mkwatchep(ctx: MyContext) {
	const userid = ctx.session.userid;
	const updateobj = await getPending(userid);
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
	let indexnum = await getUpdaterAnimeIndex(animename, updateobj);
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

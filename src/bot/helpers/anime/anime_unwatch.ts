// Unwatch anime command

import { Keyboard } from "grammy";
import { db, dbcache, updater } from "../../..";
import { markWatchedunWatched } from "../../../database/animeDB";
import {
	MyContext,
	MyConversation,
	authchatEval,
	getUpdaterAnimeIndex,
} from "../../bot";
import { watchedepanime } from "@prisma/client";

export async function anime_unwatch(ctx: MyContext) {
	if (authchatEval(ctx)) await ctx.conversation.enter("unwatchhelper");
}

export async function unwatchhelper(
	conversation: MyConversation,
	ctx: MyContext
) {
	const userid = await dbcache.getUserID(ctx.chat.id);
	let updateobj = updater.updateobj[userid];
	let keyboard = new Keyboard().resized().persistent().oneTime();
	let animelist = [];
	for (let i = 0; i < updateobj.length; i++) {
		animelist.push(updateobj[i].anime);
		keyboard.text(`Anime: ${updateobj[i].anime}`).row();
	}
	await ctx.reply("Select the anime: (/cancel to cancel)", {
		reply_markup: keyboard,
	});
	const animename = (
		await conversation.waitForHears(/Anime: (.+)/)
	).message.text
		.slice(7)
		.trim();
	const alid = updateobj.find((o) => o.anime == animename).alid;
	let eplist: number[] = [];
	let animeindex = getUpdaterAnimeIndex(animename, userid);
	for (let j = 0; j < updateobj[animeindex].watched.length; j++)
		eplist.push(updateobj[animeindex].watched[j].epnum);

	while (true) {
		let newkey = new Keyboard().persistent().resized();
		for (let i = 0; i < eplist.length; i++)
			newkey.text(`Unwatch episode: ${eplist[i]}`);
		newkey.text("Finish marking");
		await ctx.reply("Choose the episode: ", { reply_markup: newkey });
		const buttonpress = (
			await conversation.waitForHears(
				/(^Unwatch episode: ([0-9]+)$)|(^Finish marking$)/
			)
		).message.text;
		if (buttonpress == "Finish marking") {
			await ctx.reply("Alright finishing up!");
			break;
		}
		const tounwatch = parseInt(buttonpress.slice(17).trim());
		console.log(
			`Recieved request for unwatch: \nANIME: ${animename}, EP: ${tounwatch}`
		);
		let watchedAnime: { epnum: number; epname: string }[] = [];
		watchedAnime = updateobj[animeindex].watched;
		watchedAnime = watchedAnime.filter(
			({ epnum, epname }) => epnum != tounwatch
		);
		const toupdate: watchedepanime = {
			userid: userid,
			alid: alid,
			ep: watchedAnime.map((o) => o.epnum),
		};
		const updres = await markWatchedunWatched(toupdate);
		if (updres == 0) {
			await ctx.reply(
				`Marked Ep ${tounwatch} of ${animename} as not watched`,
				{ reply_markup: { remove_keyboard: true } }
			);
			updater.updateobj[userid][animeindex].watched = watchedAnime;
		} else {
			await ctx.reply(
				`Error occured while marking episode as unwatched`,
				{
					reply_markup: { remove_keyboard: true },
				}
			);
		}
	}
	return;
}

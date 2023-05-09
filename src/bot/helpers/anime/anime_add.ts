// Adding anime to subscriptions

import { Prisma, anime } from "@prisma/client";
import { db, dbcache } from "../../..";
import { getAnimeDetails, imageGet, searchAnime } from "../../../api/anilist_api";
import { addAiringFollow, addAnimeNames, addWatching, getDecimal } from "../../../database/animeDB";

import { MyContext, bot, getPagination } from "../../bot";

import { MediaFilterTypes } from "anilist-node";
import aniep from "aniep";

// export async function anime_add(ctx: MyContext) {
// 	if (ctx.chat.id != authchat) {
// 		await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
// 		return;
// 	}
// 	await ctx.conversation.enter("animeadd");
// }
//
// export async function animeadd(conversation: MyConversation, ctx: MyContext) {
// 	let responseobj: anime;
// 	await ctx.reply(
// 		"Please provide data required. Type /cancel at any point to cancel adding.",
// 		{ reply_markup: { remove_keyboard: true } }
// 	);
// 	await ctx.reply(
// 		"What is the exact Japanese name of the anime? (Refer Anilist for name)"
// 	);
// 	const jpanimename = await conversation.form.text();
// 	await ctx.reply(
// 		"What is the exact English name of the anime? (Refer Anilist for name)"
// 	);
// 	const enanimename = await conversation.form.text();
// 	await ctx.reply(
// 		"Any other optional names you would like to provide? (seperated by commas, NIL for nothing)"
// 	);
// 	const optnameres = await conversation.form.text();
// 	let optnames: string[], excnames: string[];
// 	if (optnameres != "NIL") {
// 		optnames = optnameres.split(",");
// 		optnames = optnames.map((x: string) => x.trim());
// 	}
// 	await ctx.reply(
// 		"Any similarly named terms which would interfere with search results? (seperated by commas, NIL for nothing)"
// 	);
// 	const excnameres = await conversation.form.text();
// 	if (excnameres != "NIL") {
// 		excnames = excnameres.split(",");
// 		excnames = excnames.map((x: string) => x.trim());
// 	}
// 	let AlID = 0;
// 	AlID = await getAlId(enanimename, jpanimename);
// 	if (AlID == 0) {
// 		await ctx.reply("Anilist ID for the anime?");
// 		AlID = parseInt(await conversation.form.text());
// 	}

// 	responseobj = {
// 		enname: enanimename,
// 		jpname: jpanimename,
// 		optnames: optnames === undefined ? [] : optnames,
// 		excludenames: excnames === undefined ? [] : excnames,
// 		alid: AlID,
// 	};
// 	const returncode = await addAnimeNames(responseobj);
// 	if (returncode == 0) await ctx.reply("Anime has been added!");
// 	else await ctx.reply("Error occured!");
// 	return;
// }

export async function checkAnimeTable(alid: number) {
	var pull = await db.anime.findUnique({
		where: { alid },
		select: { alid: true, status: true, jpname: true }
	});
	var airing = false;
	if (pull === null) {
		const res = await getAnimeDetails(alid);
		if (res === undefined) {
			return "invalid";
		}
		var release = res.status === "RELEASING";
		var obj: anime = {
			alid: res.id,
			jpname: res.title.romaji,
			enname: res.title.english,
			optnames: undefined,
			excludenames: undefined,
			status: res.status,
			next_ep_num: undefined,
			next_ep_air: undefined,
			last_ep: undefined,
			ep_extras: undefined,
			imglink: await imageGet(res.id)
		};
		if (release) {
			obj.next_ep_air = res.nextAiringEpisode["airingAt"];
			obj.next_ep_air = res.nextAiringEpisode["episode"];
		}
		if (res.airingSchedule.length == 0) {
			const _ = res.streamingEpisodes.map((o) => aniep(o.title) as number).sort();
			obj.last_ep = Math.max(..._);
			obj.ep_extras = getDecimal(_.filter((o) => o % 1 !== 0)) as Prisma.Decimal[];
			if (_.includes(0)) obj.ep_extras.push(getDecimal(0) as Prisma.Decimal);
		} else {
			const _ = res.airingSchedule
				.filter((o) => o.timeUntilAiring <= 0)
				.map((o) => o.episode);
			obj.last_ep = Math.max(..._);
			obj.ep_extras = getDecimal(_.filter((o) => o % 1 !== 0)) as Prisma.Decimal[];
			if (_.includes(0)) obj.ep_extras.push(getDecimal(0) as Prisma.Decimal);
		}
		const add = await addAnimeNames(obj);
		if (add == 1) return "err";
		pull = obj;
	}
	airing = pull.status === "RELEASING";
	return { pull, airing };
}

/**
 ** This function adds anime to the anime table.
 ** Responds to "/startwatching_alid".
 ** Note to self: don't use bot.command, use bot.on(^\/startwatching_(\d+)$)
 */
export async function animeStartWatch(ctx: MyContext) {
	const alid = parseInt(ctx.match[1]);
	if (alid == undefined) {
		await ctx.reply("Invalid.");
		return;
	}
	const userid = await dbcache.getUserID(ctx.chat.id);
	const old = (
		await db.watchinganime.findUnique({
			where: { userid }
		})
	).alid;
	if (old.includes(alid)) {
		await ctx.reply(
			`You have already marked <b>${
				(
					await db.anime.findUnique({
						where: { alid },
						select: { jpname: true }
					})
				).jpname
			}</b> as watching.`,
			{ parse_mode: "HTML" }
		);
		return;
	}
	const res = await checkAnimeTable(alid);
	if (res == "err") {
		await ctx.reply("Error occured!");
		return;
	}
	if (res == "invalid") {
		await ctx.reply("Cannot find any anime with given alid.");
		return;
	}
	await ctx.reply(`Marked ${res.pull.jpname} as watching!`);
	if (res.airing)
		ctx.reply(
			`${res.pull.jpname} is currently airing. If you would like to follow its episode releases: /remindme_${res.pull.alid}`
		);
	await addWatching(userid, alid);
}

/**
 ** Live updates for airing shit.
 ** Responds to "/remindme_alid". */
export async function remindMe(ctx: MyContext) {
	const userid = await dbcache.getUserID(ctx.chat.id);
	const alid = parseInt(ctx.match[1]);
	if (alid == undefined) {
		await ctx.reply("Invalid.");
		return;
	}
	const remindme = await db.airingupdates.findUnique({
		where: { userid }
	});
	if (remindme.alid === undefined) remindme.alid = [];
	if (remindme.alid.includes(alid)) {
		ctx.reply("You are already following updates for this anime!");
		return;
	}
	remindme.alid.push(alid);
	const res = await addAiringFollow(remindme);
	if (res == 0)
		await ctx.reply(
			`You will now recieve updates on <b>${
				(
					await db.anime.findUnique({
						where: { alid },
						select: { jpname: true }
					})
				).jpname
			}.</b>`,
			{ parse_mode: "HTML" }
		);
	else await ctx.reply("Error encountered ;_;");
	return;
}

/**
 ** Universal search starter.
 ** Shows first page alone for search results.
 ** For subsequent pages, animeSearchHandler is called (mostly with callbackQueries).
 ** Call this in bot.command() with appropriate arguments. */
export async function animeSearchStart(ctx: MyContext, command: string) {
	const msgid = (await ctx.reply("Searching...")).message_id;
	const query = ctx.match as string;
	if (query === "" || query === undefined) {
		await ctx.reply("Please provide a search query!");
		return;
	}
	const { msg, keyboard } = await animeSearchHandler(
		query,
		command,
		1,
		await dbcache.getUserID(ctx.chat.id)
	);
	if (msg == undefined || keyboard == undefined) {
		await ctx.reply("Unable to find any results.");
		return;
	}
	await ctx.api.editMessageText(ctx.chat.id, msgid, msg, {
		reply_markup: keyboard,
		parse_mode: "HTML"
	});
	return;
}

/**
 ** Handles the search queries and returns the message and keyboard.
 ** Called interally.*/
export async function animeSearchHandler(
	query: string,
	command: string,
	currentpg: number = 1,
	userid?: number
) {
	let pages = await searchAnime(query, currentpg);
	if (pages === undefined) return { msg: undefined, keyboard: undefined };
	let maxpg: number;
	if (currentpg != 1) maxpg = pages.pageInfo.lastPage > 5 ? 5 : pages.pageInfo.lastPage;
	else {
		let temp = await searchAnime(query, 2);
		if (temp != undefined) maxpg = temp.pageInfo.lastPage > 5 ? 5 : temp.pageInfo.lastPage;
		else maxpg = 1;
	}
	const keyboard = getPagination(currentpg, maxpg, command);
	let msg = `<b>Search results for '${query}</b>'\n\n`;
	for (let i = 0; i < pages.media.length; i++) {
		msg += `<b>${pages.media[i].title.romaji}</b>\n${
			pages.media[i].title.english !== null
				? pages.media[i].title.english
				: pages.media[i].title.userPreferred
		}\n`;
		if (command == "startwatching" && userid !== undefined) {
			let old = await db.watchinganime.findUnique({
				where: { userid }
			});
			if (old.alid === undefined) old.alid = [];
			if (old.alid.includes(pages.media[i].id))
				msg += `<i>Anime already marked as watching!</i>\n\n`;
			else msg += `<i>Start Watching:</i> /startwatching_${pages.media[i].id}\n\n`;
		}
	}
	return { msg, keyboard };
}

/**This function helps manage page scrolling for search results.
Migrate the callbackquery and make this a function later.*/
export async function remindMe_startWatch_cb(ctx: MyContext) {
	const command = ctx.callbackQuery.data.split("_")[0];
	const movepg = parseInt(ctx.callbackQuery.data.split("_")[1]);
	await ctx.answerCallbackQuery("Searching!");
	const query = [
		...ctx.callbackQuery.message.text.split("\n")[0].matchAll(/^Search results for '(.+)'$/gi)
	].map((o) => o[1])[0];
	//console.log(`${command}, ${movepg}, ${query}`);
	const { msg, keyboard } = await animeSearchHandler(
		query,
		command,
		movepg,
		await dbcache.getUserID(ctx.callbackQuery.message.chat.id)
	);
	if (msg == undefined || keyboard == undefined) {
		await ctx.reply("Unable to find any results.");
		return;
	}
	//console.log(`${msg}, ${JSON.stringify(keyboard)}`);
	await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" });
}

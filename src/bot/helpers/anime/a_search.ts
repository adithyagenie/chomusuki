// Adding anime to subscriptions

import { db } from "../../..";
import { searchAnime } from "../../../api/anilist_api";
import { MyContext, getPagination } from "../../bot";

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

/**
 ** Universal search starter.
 ** Shows first page alone for search results.
 ** For subsequent pages, animeSearchHandler is called (mostly with callbackQueries).
 ** Call this in bot.command() with appropriate arguments. */
export async function animeSearchStart(ctx: MyContext, command: string) {
	const query = ctx.match as string;
	if (query === "" || query === undefined) {
		await ctx.reply("Please provide a search query!");
		return;
	}
	const msgid = (await ctx.reply("Searching...")).message_id;
	const { msg, keyboard } = await animeSearchHandler(
		query,
		command,
		1,
		command == "startwatching" ? ctx.session.userid : undefined
	);
	if (msg == undefined || keyboard == undefined) {
		await ctx.api.editMessageText(ctx.from.id, msgid, "Unable to find any results.");
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
		} else msg += "\n";
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
	const { msg, keyboard } = await animeSearchHandler(query, command, movepg, ctx.session.userid);
	if (msg == undefined || keyboard == undefined) {
		await ctx.reply("Unable to find any results.");
		return;
	}
	//console.log(`${msg}, ${JSON.stringify(keyboard)}`);
	await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" });
}

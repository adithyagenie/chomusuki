// Adding anime to subscriptions

import { anime } from "@prisma/client";
import { authchat, dbcache } from "../../..";
import { getAlId, searchAnime } from "../../../api/anilist_api";
import { addAnimeNames } from "../../../database/animeDB";
import { i_AnimeNames } from "../../../interfaces";
import { MyContext, MyConversation, bot } from "../../bot";
import { InlineKeyboard } from "grammy";
import { messageToHTMLMessage } from "../caption_entity_handler";
import { query } from "express";

export async function anime_add(ctx: MyContext) {
	if (ctx.chat.id != authchat) {
		await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
		return;
	}
	await ctx.conversation.enter("animeadd");
}

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

export async function searchHandler(ctx: MyContext) {
	const args = ctx.message.text.split(" ");
	if (args.length < 2) {
		await ctx.reply("Please provide a search query!");
		return;
	}
	const query = args[1];
	const { msg, keyboard } = await animeSearch(query);
	if (msg == undefined || keyboard == undefined) {
		await ctx.reply("Unable to find any results.");
		return;
	}
	await bot.api.sendMessage(ctx.chat.id, msg, { reply_markup: keyboard });
	return;
}

export async function animeSearch(query: string, currentpg: number = 1) {
	let pages = await searchAnime(query, currentpg);
	if (pages === undefined) return undefined;
	const maxpg = pages.pageInfo.lastPage > 5 ? 5 : pages.pageInfo.lastPage;
	const keyboardconstruct = (pagesarr: number[], currentpg: number = 1) => {
		var keyboard = new InlineKeyboard();
		let temp: string[] = [];
		temp = pagesarr.map((o) => o.toFixed());
		temp[currentpg - 1] = `.${pagesarr[currentpg - 1].toFixed()}.`;
		for (let i = 0; i < temp.length; i++)
			keyboard.text(temp[i], `animeSearch_${pagesarr[i]}`);
		return keyboard;
	};
	const keyboard = keyboardconstruct(
		Array.from({ length: maxpg }, (_, i) => i + 1),
		currentpg
	);
	let msg = `<b>Search results for '${query}</b>'\n\n`;
	for (let i = 0; i < pages.media.length; i++) {
		msg += `<b>${pages.media[i].title.romaji}</b>\n<i>${pages.media[i].title.english}\n\n`;
	}
	return { msg, keyboard };
}

bot.callbackQuery(/animeSearch_(.+)/, async (ctx) => {
	await ctx.answerCallbackQuery("Searching!");
	const query = [
		...ctx.callbackQuery.message.text
			.split("\n")[0]
			.matchAll(/^Search results for '(.+)'$/gi),
	].map((o) => o[1])[0];
	const pg = parseInt(ctx.callbackQuery.data.split("_")[1]);
	const { msg, keyboard } = await animeSearch(query, pg);
	await ctx.editMessageText(msg, { reply_markup: keyboard });
});

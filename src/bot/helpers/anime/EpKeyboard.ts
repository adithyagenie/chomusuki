import { InlineKeyboardButton } from "@grammyjs/types";
import { Context, InlineKeyboard } from "grammy";
import { updater } from "../../..";
import { getUpdaterAnimeIndex } from "../../bot";

// Makes keyboard for download and mark watched
export function makeEpKeyboard(
	ctx: Context,
	callback_data_string: string,
	userid: string
) {
	let updateobj = updater.updateobj[userid];
	let animename = ctx.callbackQuery.message.caption
		.split("Anime: ")[1]
		.split("Episodes:")[0]
		.trim();
	let eplist = [];
	const animeindex = getUpdaterAnimeIndex(animename, userid);
	for (let j = 0; j < updateobj[animeindex].notwatched.length; j++)
		eplist.push(updateobj[animeindex].notwatched[j].epnum);

	let keyboard = new InlineKeyboard();
	for (let i = 0; i < eplist.length; i += 2) {
		let bruh: InlineKeyboardButton.CallbackButton = {
			text: `Episode ${eplist[i]}`,
			callback_data: `${callback_data_string}_${eplist[i]}`,
		};
		let bruh2: InlineKeyboardButton.CallbackButton = {
			text: `Episode ${eplist[i + 1]}`,
			callback_data: `${callback_data_string}_${eplist[i + 1]}`,
		};
		if (eplist[i + 1] === undefined) keyboard.add(bruh).row();
		else keyboard.add(bruh).add(bruh2).row();
	}
	keyboard.text("Go back", "back");
	return keyboard;
}

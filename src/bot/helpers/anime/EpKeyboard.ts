import { InlineKeyboardButton } from "@grammyjs/types";
import { InlineKeyboard } from "grammy";
import { updater } from "../../..";
import { getUpdaterAnimeIndex } from "../../bot";

// Makes keyboard for download and mark watched
export async function makeEpKeyboard(
	caption: string,
	callback_data_string: string,
	userid: number
) {
	let updateobj = await updater.getUpdateObj(userid);
	caption = caption.split("Anime: ")[1].split("\n")[0].trim();
	let eplist = [];
	const animeindex = await getUpdaterAnimeIndex(caption, userid);
	console.log(updateobj);
	updateobj[animeindex].notwatched.forEach((o) => eplist.push(o));

	let keyboard = new InlineKeyboard();
	for (let i = 0; i < eplist.length; i += 2) {
		let bruh: InlineKeyboardButton.CallbackButton = {
			text: `Episode ${eplist[i]}`,
			callback_data: `${callback_data_string}_${eplist[i]}`
		};
		let bruh2: InlineKeyboardButton.CallbackButton = {
			text: `Episode ${eplist[i + 1]}`,
			callback_data: `${callback_data_string}_${eplist[i + 1]}`
		};
		if (eplist[i + 1] === undefined) keyboard.add(bruh).row();
		else keyboard.add(bruh).add(bruh2).row();
	}
	keyboard.text("Go back", "back");
	return keyboard;
}

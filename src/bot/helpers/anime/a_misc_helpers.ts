import { InlineKeyboardButton } from "@grammyjs/types";
import { InlineKeyboard } from "grammy";
import { i_ProcessedObjV2 } from "../../../interfaces";
import { authchat } from "../../..";
import { MyContext } from "../../bot";

// Makes keyboard for download and mark watched
export async function makeEpKeyboard(
	caption: string,
	callback_data_string: string,
	updateobj: i_ProcessedObjV2[]
) {
	caption = caption.split("Anime: ")[1].split("\n")[0].trim();
	let eplist = [];
	const animeindex = await getUpdaterAnimeIndex(caption, updateobj);
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

export const authchatEval = (ctx: MyContext) => {
	if (ctx.chat.id != authchat) {
		ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
		return false;
	}
	return true;
};

export const getUpdaterAnimeIndex = async (name: string, pending: i_ProcessedObjV2[]) =>
	pending.map((object) => object.jpname).indexOf(name);

export function getPagination(current: number, maxpage: number, text: string) {
	var keys: InlineKeyboardButton[] = [];
	if (current > 1) keys.push({ text: `«1`, callback_data: `${text}_1` });
	if (current > 2)
		keys.push({
			text: `‹${current - 1}`,
			callback_data: `${text}_${(current - 1).toString()}`
		});
	keys.push({
		text: `-${current}-`,
		callback_data: `${text}_${current.toString()}`
	});
	if (current < maxpage - 1)
		keys.push({
			text: `${current + 1}›`,
			callback_data: `${text}_${(current + 1).toString()}`
		});
	if (current < maxpage)
		keys.push({
			text: `${maxpage}»`,
			callback_data: `${text}_${maxpage.toString()}`
		});

	return new InlineKeyboard().add(...keys);
}

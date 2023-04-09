import { updater } from "../../..";
import { markWatchedunWatched } from "../../../database/db_connect";
import { MyContext, bot, getUpdaterAnimeIndex } from "../../bot";
import { messageToHTMLMessage } from "../caption_entity_handler";
import { makeEpKeyboard } from "./EpKeyboard";

export async function callback_mkwatch(ctx: MyContext) {
	const keyboard = makeEpKeyboard(ctx, "mkwtch");
	ctx.editMessageReplyMarkup({ reply_markup: keyboard });
	ctx.answerCallbackQuery();
}

export async function callback_mkwatchep(ctx: MyContext) {
	let epnum = parseInt(ctx.callbackQuery.data.split("_")[1]);
	let updateobj = updater.updateobj;
	let oldmsg = ctx.callbackQuery.message.caption;
	let animename = oldmsg.split("Anime: ")[1].split("Episodes:")[0].trim();
	let oldwatch: { epnum: number; epname: string }[] = [];
	let indexnum = getUpdaterAnimeIndex(animename);
	let toupdateanime: { epnum: number; epname: string };
	for (let j = 0; j < updateobj[indexnum].watched.length; j++)
		oldwatch.push(updateobj[indexnum].watched[j]);
	for (let j = 0; j < updateobj[indexnum].notwatched.length; j++) {
		if (updateobj[indexnum].notwatched[j].epnum == epnum)
			toupdateanime = updateobj[indexnum].notwatched[j];
	}

	oldwatch.push(toupdateanime);

	var index = updater.updateobj[indexnum].notwatched.indexOf(toupdateanime);
	if (index !== -1) {
		updater.updateobj[indexnum].notwatched.splice(index, 1);
	}
	updater.updateobj[indexnum].watched.push(toupdateanime);
	oldwatch.sort((a, b) => (a.epnum > b.epnum ? 1 : -1));
	const updres = await markWatchedunWatched({
		name: animename,
		watched: oldwatch,
	});
	if (updres == true) {
		const newkeyboard = makeEpKeyboard(ctx, "mkwtch");
		const oldformatmsg = messageToHTMLMessage(
			ctx.callbackQuery.message.caption,
			ctx.callbackQuery.message.caption_entities
		);
		var newMsgArray = oldformatmsg.split("\n");
		for (let j = 0; j < newMsgArray.length; j++) {
			if (newMsgArray[j].startsWith(`Episode ${epnum}:`)) {
				newMsgArray.splice(j, 1);
				break;
			}
		}
		const newmsg = newMsgArray.join("\n");
		bot.api.editMessageCaption(
			ctx.callbackQuery.message.chat.id,
			ctx.callbackQuery.message.message_id,
			{
				caption: newmsg,
				parse_mode: "HTML",
				reply_markup: newkeyboard,
			}
		);
		ctx.answerCallbackQuery(`Marked ${epnum} as watched!`);
	} else {
		await ctx.reply(`Error occured while marking episode as watched.`);
		ctx.answerCallbackQuery(`Error occured.`);
	}
}

import { getWatching } from "../../../database/animeDB";
import { MyContext, getPagination } from "../../bot";

/**
 ** Sends the first page of the list of anime the user is currently watching.
 ** Called by /watching.
 */
export async function watchingList(ctx: MyContext) {
	const userid = ctx.session.userid;
	const { msg, keyboard } = await watchingListHelper(userid, 1);
	if (keyboard == undefined) await ctx.reply(msg, { parse_mode: "HTML" });
	else await ctx.reply(msg, { reply_markup: keyboard, parse_mode: "HTML" });
}

/**
 ** Returns message and keyboard for pages of watching list.
 ** Internally called.*/
export async function watchingListHelper(userid: number, offset: number) {
	const { alidlist, animelist, amount } = await getWatching(userid, 5, offset);
	var msg = "";
	if (amount == 0) {
		msg = `<b> You are currently not watching any anime. Add some with /startwatching to get started.</b>`;
		return { msg: msg, keyboard: undefined };
	} else msg = `<b>Displaying your currently watching list: </b>\n\n`;
	for (let i = 0; i < alidlist.length; i++) {
		msg += `${i + 1}. ${animelist[i]}\n<i>Remove from watching list: /stopwatching_${
			alidlist[i]
		}</i>\n\n`;
	}
	const keyboard = getPagination(offset, amount, "watch");
	return { msg, keyboard };
}

/**The callback from pages of watching. */
export async function watchingListCBQ(ctx: MyContext) {
	const movepg = parseInt(ctx.match[1]);
	await ctx.answerCallbackQuery("Searching!");
	const { msg, keyboard } = await watchingListHelper(ctx.chat.id, movepg);
	try {
		if (
			ctx.callbackQuery.message.text != msg &&
			ctx.callbackQuery.message.reply_markup == keyboard
		)
			await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" });
	} catch (e) {
		console.log(e);
	}
}

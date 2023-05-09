// Removing anime

import { dbcache } from "../../..";
import { getWatching } from "../../../database/animeDB";
import { MyContext, getPagination, bot } from "../../bot";

// export async function anime_remove(ctx: MyContext) {
// 	if (authchatEval(ctx)) await ctx.conversation.enter("delanimehelper");
// }

// export async function delanimehelper(
// 	conversation: MyConversation,
// 	ctx: MyContext
// ) {
// 	const userid = await dbcache.getUserID(ctx.chat.id);
// 	let keyboard = new Keyboard();
// 	const { subscribed, animelist } = await getSubscription(userid);
// 	animelist.forEach((o) => keyboard.text(`Delete: ${o}`).row());

// 	keyboard.resized().persistent().oneTime();

// 	await ctx.reply("Which one to unsubscribe? (/cancel to cancel)", {
// 		reply_markup: keyboard,
// 	});
// 	const todel = (await conversation.waitForHears(/Delete: (.+)/)).message.text
// 		.slice(8)
// 		.trim();
// 	if (!animelist.includes(todel)) {
// 		ctx.reply("mathafucka");
// 		return;
// 	}
// 	let newkeyboard = new Keyboard()
// 		.text("Yes, I'm sure.")
// 		.text("No, cancel it.")
// 		.row()
// 		.resized()
// 		.persistent()
// 		.oneTime();
// 	await ctx.reply(`Removing ${todel}... Are you sure?`, {
// 		reply_markup: newkeyboard,
// 	});
// 	const confirmation = await conversation.waitForHears(
// 		/(Yes, I'm sure\.)|(No, cancel it\.)/
// 	);
// 	if (confirmation.message.text == "Yes, I'm sure.") {
// 		await ctx.reply(`Deleted ${todel}`, {
// 			reply_markup: { remove_keyboard: true },
// 		});
// 		console.log(`Delete request for ${todel} received!`);
// 		delanime(todel);
// 		let i = getUpdaterAnimeIndex(todel);
// 		updater.updateobj.splice(i, 1);
// 		return;
// 	} else if (confirmation.message.text == "No, cancel it.") {
// 		await ctx.reply(`Aight cancelled removal.`, {
// 			reply_markup: { remove_keyboard: true },
// 		});
// 		return;
// 	}
// }

/**
 ** Sends the first page of the list of anime the user is currently watching.
 ** Called by /watching.
 */
export async function watchingList(ctx: MyContext) {
	const { msg, keyboard } = await watchingListHelper(ctx.chat.id, 0);
	await ctx.reply(msg, { reply_markup: keyboard });
}

/**
 ** Returns message and keyboard for pages of watching list.
 ** Internally called.*/
export async function watchingListHelper(chatid: number, offset: number) {
	const userid = await dbcache.getUserID(chatid);
	const { alidlist, animelist, amount } = await getWatching(userid, 5, offset);
	var msg = `<b>Displaying subscriptions of ${userid}: </b>\n\n`;
	for (let i = 0; i < alidlist.length; i++) {
		msg += `${i + 1}. ${animelist[i]}\n<i>Unsubscribe: /unsubscribe_${alidlist[i]}\n\n`;
	}
	const keyboard = getPagination(offset + 1, amount, "subs");
	return { msg, keyboard };
}

/**The callback from pages of watching. */
bot.callbackQuery(/subs_(.+)/, async (ctx) => {
	const movepg = parseInt(ctx.match[1]);
	await ctx.answerCallbackQuery("Searching!");
	const { msg, keyboard } = await watchingListHelper(ctx.chat.id, movepg);
	try {
		await ctx.editMessageText(msg, { reply_markup: keyboard });
	} catch (e) {
		console.log(e);
	}
});

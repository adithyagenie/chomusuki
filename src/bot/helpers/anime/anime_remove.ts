// Removing anime

import { InlineKeyboard } from "grammy";
import { getWatching } from "../../../database/animeDB";
import { MyContext, MyConversation, bot, getPagination } from "../../bot";
import { db } from "../../..";

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

export async function stopWatching(conversation: MyConversation, ctx: MyContext) {
	const match = parseInt(ctx.match[1]);
	if (Number.isNaN(match[1])) {
		await ctx.reply("Invalid command.");
		return;
	}
	const msgid = (
		await ctx.reply(`You will lose all the progress in the anime. Proceed?`, {
			reply_markup: new InlineKeyboard().text("Yes.", "y").text("Hell no.", "n")
		})
	).message_id;
	const cbq = await conversation.waitForCallbackQuery(/y|n/);
	cbq.answerCallbackQuery("Processing...");
	if (cbq.callbackQuery.data == "y") {
		await conversation.external(async () => {
			const _ = (
				await db.watchinganime.findUnique({
					where: { userid: conversation.session.userid },
					select: { alid: true }
				})
			).alid;
			_.splice(
				_.findIndex((o) => o == match),
				1
			);
			await db.watchinganime.update({
				where: { userid: conversation.session.userid },
				data: { alid: _, userid: undefined }
			});
			await db.watchedepanime.delete({
				where: {
					userid_alid: {
						userid: conversation.session.userid,
						alid: match
					}
				}
			});
		});
		await ctx.api.deleteMessage(ctx.from.id, msgid);
		await ctx.reply(
			`${
				(
					await db.anime.findUnique({
						where: { alid: match },
						select: { jpname: true }
					})
				).jpname
			} has been removed from your watching list.`
		);
		return;
	} else if (cbq.callbackQuery.data == "n") {
		await ctx.api.deleteMessage(ctx.from.id, msgid);
		await ctx.reply(`Alright cancelling deletion.`);
	}
}

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

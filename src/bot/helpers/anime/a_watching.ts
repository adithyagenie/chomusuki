import { InlineKeyboard } from "grammy";
import { db } from "../../..";
import { addWatching, checkAnimeTable, getUserWatchingAiring } from "../../../database/animeDB";
import { MyContext, MyConversation } from "../../bot";
import { getPagination } from "./a_misc_helpers";
import { HTMLMessageToMessage } from "./a_misc_helpers";

/**
 ** Sends the first page of the list of anime the user is currently watching.
 ** Called by /watching.
 */
export async function watchingList(ctx: MyContext) {
	const userid = ctx.session.userid;
	const { msg, keyboard } = await watchingListHelper(userid, 1, ctx.me.username);
	if (keyboard == undefined || keyboard.inline_keyboard.length == 0)
		await ctx.reply(msg, { parse_mode: "HTML" });
	else await ctx.reply(msg, { reply_markup: keyboard, parse_mode: "HTML" });
}

/**
 ** Returns message and keyboard for pages of watching list.
 ** Internally called.*/
export async function watchingListHelper(userid: number, offset: number, username: string) {
	const { alidlist, animelist, amount } = await getUserWatchingAiring(
		"watchinganime",
		userid,
		5,
		offset
	);
	var msg = "";
	if (amount == 0) {
		msg = `<b>You are currently not watching any anime. Add some with /startwatching to get started.</b>`;
		return { msg: msg, keyboard: undefined };
	} else msg = `<b>Displaying your currently watching list: </b>\n\n`;
	for (let i = 0; i < alidlist.length; i++) {
		msg += `${i + 1}. ${
			animelist[i]
		}\n<i>Remove from watching list: <a href="t.me/${username}?start=stopwatching_${
			alidlist[i]
		}">Click here!</a></i>\n\n`;
	}
	const keyboard = getPagination(offset, Math.ceil(amount / 5), "watch");
	return { msg, keyboard };
}

/**The callback from pages of watching. */
export async function watchingListCBQ(ctx: MyContext) {
	await ctx.answerCallbackQuery("Fetching!");
	const movepg = parseInt(ctx.match[1]);
	if (ctx.match[2] == "_current") return;
	const { msg, keyboard } = await watchingListHelper(ctx.session.userid, movepg, ctx.me.username);
	try {
		if (ctx.msg.text.trim() !== HTMLMessageToMessage(msg).trim())
			await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" });
	} catch (e) {
		console.log(e);
	}
}

/**
 ** This function adds anime to the anime table.
 ** Responds to "/startwatching_alid".
 */
export async function animeStartWatch(ctx: MyContext) {
	ctx.deleteMessage();
	const alid = parseInt(ctx.match[1]);
	if (alid == undefined || Number.isNaN(alid)) {
		await ctx.reply("Invalid.");
		return;
	}
	const userid = ctx.session.userid;

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
			`${res.pull.jpname} is currently airing. If you would like to follow its episode releases:<a href="t.me/${ctx.me.username}?start=remindme_${res.pull.alid}"> Click here!</a>`,
			{ parse_mode: "HTML" }
		);
	await addWatching(userid, alid);
}

/**
 ** Remove an anime from watching list of user.
 ** Called with /stopwatching_alid.
 */
export async function stopWatching(conversation: MyConversation, ctx: MyContext) {
	ctx.deleteMessage();
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

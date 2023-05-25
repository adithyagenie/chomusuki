/**You need to display the status of the show when /airingupdates. Get it from db else get it from alnilist.
 * Try to display it with search. I have no other way to retrive status with search. All I can think of while writing this is to do seperate 3 queries for finished, airing, not released. But thats kinda stupid as every page requires 3  calls.
 so either we do like 5 queries per page or do 3. but that 5 is like half might go with db but its a hard gamble.
 * If you can think of smth else do it bitch.
 */

import { db } from "../../..";
import { addAiringFollow, getUserWatchingAiring } from "../../../database/animeDB";
import { MyContext } from "../../bot";
import { getPagination } from "./a_misc_helpers";
import { checkAnimeTable } from "../../../database/animeDB";
import { HTMLMessageToMessage } from "./a_misc_helpers";

/**
 ** Live updates for airing shit.
 ** Responds to "/remindme_alid". */
export async function remindMe(ctx: MyContext) {
	ctx.deleteMessage();
	const userid = ctx.session.userid;
	const alid = parseInt(ctx.match[1]);
	if (alid == undefined || Number.isNaN(alid)) {
		await ctx.reply("Invalid.");
		return;
	}
	const _ = await checkAnimeTable(alid);
	if (_ == "invalid") {
		ctx.reply(`Invalid Anilist ID.`);
		return;
	}
	const __ = await db.airingupdates.findMany({
		where: { userid: { has: userid } },
		select: { alid: true }
	});
	let remindme: number[] = [];
	if (__ === null) remindme = [];
	else remindme = __.map((o) => o.alid);
	if (remindme.includes(alid)) {
		ctx.reply("You are already following updates for this anime!");
		return;
	}
	const res = await addAiringFollow(alid, userid);
	if (res == 0)
		await ctx.reply(
			`You will now recieve updates on <b>${
				(
					await db.anime.findUnique({
						where: { alid },
						select: { jpname: true }
					})
				).jpname
			}.</b>`,
			{ parse_mode: "HTML" }
		);
	else await ctx.reply("Error encountered ;_;");
	return;
}

/**
 ** Sends the first page of the list of anime the user is currently subscribed to.
 ** Called by /airingupdates.
 */
export async function airingUpdatesList(ctx: MyContext) {
	const userid = ctx.session.userid;
	const { msg, keyboard } = await airingUpdatesListHelper(userid, 1, ctx.me.username);
	if (keyboard == undefined || keyboard.inline_keyboard[0].length == 1)
		await ctx.reply(msg, { parse_mode: "HTML" });
	else await ctx.reply(msg, { reply_markup: keyboard, parse_mode: "HTML" });
}

/**
 ** Returns message and keyboard for pages of subscribed list.
 ** Internally called.*/
export async function airingUpdatesListHelper(userid: number, offset: number, username: string) {
	const { alidlist, animelist, amount } = await getUserWatchingAiring(
		"airingupdates",
		userid,
		5,
		offset
	);
	var msg = "";
	if (amount == 0) {
		msg = `<b>You have not subscribed to airing updates for any anime. </b>`;
		return { msg: msg, keyboard: undefined };
	} else msg = `<b>Displaying your anime subscriptions: </b>\n\n`;
	for (let i = 0; i < alidlist.length; i++) {
		msg += `${i + 1}. ${
			animelist[i]
		}\n<i>Stop reminding me: <a href="t.me/${username}?start=stopremindme_${
			alidlist[i]
		}">Click here!</a></i>\n\n`;
	}
	const keyboard = getPagination(offset, Math.ceil(amount / 5), "airingupd");
	return { msg, keyboard };
}

/**The callback from pages of /airingupdates. CBQ: airingupd_*/
export async function airingUpdatesListCBQ(ctx: MyContext) {
	await ctx.answerCallbackQuery("Fetching!");
	const movepg = parseInt(ctx.match[1]);
	if (ctx.match[2] == "_current") return;
	const { msg, keyboard } = await airingUpdatesListHelper(
		ctx.session.userid,
		movepg,
		ctx.me.username
	);
	try {
		if (ctx.msg.text.trim() !== HTMLMessageToMessage(msg).trim())
			await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" });
	} catch (e) {
		console.log(e);
	}
}

/**
 ** Removes anime for airing list.
 ** Called by /stopairingupdates_alid.
 */
export async function stopAiringUpdates(ctx: MyContext) {
	ctx.deleteMessage();
	const remove = parseInt(ctx.match[1] as string);
	const _ = await db.anime.findUnique({
		where: { alid: remove },
		select: { jpname: true, status: true }
	});
	if (_ == undefined || !(_.status == "RELEASING" || _.status == "NOT_YET_RELEASED")) {
		ctx.reply(`Invalid anime provided.`);
		return;
	}
	const name = _.jpname;
	let __ = await db.airingupdates.findMany({
		where: { userid: { has: ctx.session.userid } }
	});
	let i = -1;
	if (__ !== null) i = __.map((o) => o.alid).indexOf(remove);
	if (i === -1) {
		ctx.reply(`You are already not recieving the updates for <b>${name}</b>.`, {
			parse_mode: "HTML"
		});
		return;
	}
	__[i].userid.splice(__[i].userid.indexOf(ctx.session.userid), 1);
	await db.airingupdates.update({
		where: { alid: remove },
		data: __[i]
	});
	ctx.reply(`You will no longer recieve updates for <b>${name}</b>.`, { parse_mode: "HTML" });
	return;
}

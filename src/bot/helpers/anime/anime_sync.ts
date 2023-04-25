// Synces anime

import { InlineKeyboard } from "grammy";
import { MyContext, authchatEval, bot } from "../../bot";
import { db, dbcache, updater } from "../../..";
import { remindedepanime } from "@prisma/client";
import { i_configuration } from "../../../interfaces";
import { addReminded } from "../../../database/animeDB";

// Helps in syncing anime, called by /async and by outer functions when needed.
export async function syncresponser(
	chatid: number,
	options: i_configuration,
	croncall: boolean = false,
	remind_again: boolean = options.remind_again
) {
	// if (options.pause_sync == true && croncall == true) return;
	// let chatid = 0;
	// if (ctx === undefined) chatid = authchat;
	// else chatid = ctx.message.chat.id;
	const userid = await dbcache.getUserID(chatid);
	let msgid = (
		await bot.api.sendMessage(chatid, "Syncing anime...", {
			reply_markup: { remove_keyboard: true },
		})
	).message_id;
	await bot.api.sendChatAction(chatid, "typing");
	let updateobj = await updater.updater(userid);
	const actualcount = updateobj.length;
	bot.api.deleteMessage(chatid, msgid);
	const getAlID = updateobj.map((o) => o.alid);
	if (remind_again == false) {
		const oldwatch = await db.remindedepanime.findMany({
			where: {
				userid: userid,
				alid: { in: getAlID },
			},
			select: {
				alid: true,
				ep: true,
			},
		});
		const remindedAlID = oldwatch.map((o) => o.alid);
		if (remindedAlID.length != 0) {
			for (let i = updateobj.length - 1; i >= 0; i--) {
				// let found = oldwatch.find(
				// 	(o) => o.anime == updateobj[userid][i].anime
				// );
				// if (found !== undefined || found.reminded.length !== 0)
				// 	updateobj[i].notwatched = updateobj[i].notwatched.filter(
				// 		(o) => !found.reminded.includes(o.epnum)
				// 	);
				let elem = oldwatch.find((o) => o.alid == updateobj[i].alid);
				updateobj[i].notwatched.filter(
					(o) => !elem.ep.includes(o.epnum)
				);
				if (updateobj[i].notwatched.length === 0)
					updateobj.splice(i, 1);
			}
		}
	}
	const remind_purged_count = updateobj.length;
	let topmsg = "";
	if (actualcount - remind_purged_count > 0) {
		topmsg += ` (Some episodes were omitted, use \"/sync remind\" to include those!)`;
	}
	if (actualcount == 0) {
		if (croncall == false)
			bot.api.sendMessage(chatid, "No new episodes have been released!");
		return;
	} else if (
		remind_purged_count == 0 &&
		actualcount != 0 &&
		croncall == false
	) {
		bot.api.sendMessage(
			chatid,
			"No new episodes have been released!" + topmsg
		);
		return;
	} else if (actualcount > 0 && remind_purged_count > 0) {
		if (croncall)
			bot.api.sendMessage(
				chatid,
				"Automatic syncing completed! New episodes have been released!" +
					topmsg
			);
		else
			bot.api.sendMessage(
				chatid,
				"New episodes have been released!" + topmsg
			);
	}
	for (let i = 0; i < updateobj.length; i++) {
		if (updateobj[i].notwatched.length == 0) continue;
		let [msg, msgheader] = ["", ""];
		let msglist = [];
		let imagelink = updateobj[i]["imagelink"];
		msgheader += `<b><u>Anime:</u></b> ${updateobj[i]["anime"]}\n\n`;
		msgheader += `<b><u>Episodes:</u></b>\n`;
		for (let j = 0; j < updateobj[i]["links"].length; j++) {
			msg += `Episode ${updateobj[i]["notwatched"][j]["epnum"]}: `;
			msg += `<a href = "${updateobj[i]["links"][j]}">${updateobj[i]["notwatched"][j]["epname"]}</a>\n`;
		}
		if (
			msg.length + msgheader.length > 1024 &&
			updateobj[i].shortname !== undefined
		) {
			while (msg.includes(updateobj[i].anime))
				msg = msg.replace(updateobj[i].anime, updateobj[i].shortname);
		}
		if (msg.length + msgheader.length > 1024) {
			let chunk = "";
			let lines = msg.split("\n");
			for (let msgline = 0; msgline < lines.length; msgline++) {
				if ((msgline = 0)) chunk += msgheader;
				if (chunk.length + lines[msgline].length < 1024) {
					chunk += `${lines[msgline]}\n`;
				} else {
					msglist.push(chunk);
					chunk = `${lines[msgline]}\n`;
				}
			}
			msglist.push(chunk);
		} else msg = msgheader + msg;
		let replykeyboard = new InlineKeyboard()
			.text("Mark watched", "mark_watch")
			.text("Download", "download");
		if (msglist.length > 0) {
			bot.api.sendPhoto(chatid, imagelink, {
				caption: msglist[0],
				parse_mode: "HTML",
				reply_markup: replykeyboard,
			});
			for (let msgnum = 1; msgnum < msglist.length; msgnum++)
				bot.api.sendMessage(chatid, msglist[msgnum], {
					parse_mode: "HTML",
				});
		} else
			bot.api.sendPhoto(chatid, imagelink, {
				caption: msg,
				parse_mode: "HTML",
				reply_markup: replykeyboard,
			});
	}
	const promisearray = [];
	for (let i = 0; i < updateobj.length; i++) {
		let obj: remindedepanime = {
			userid: userid,
			alid: updateobj[i].alid,
			ep: updateobj[i].notwatched.map((o) => o.epnum),
		};
		promisearray.push(addReminded(obj));
	}
	await Promise.allSettled(promisearray);
}

export async function anime_sync(ctx: MyContext) {
	if (!authchatEval(ctx)) return;
	const options = await dbcache.getConfig(ctx.chat.id);
	const msg = ctx.message.text.split(" ");
	if (msg.length == 2) {
		if (msg[1] == "remind") {
			await syncresponser(ctx.chat.id, options, false, true);
			return;
		}
	}
	await syncresponser(ctx.chat.id, options, false);
}

//export async function anime_sync_cron()

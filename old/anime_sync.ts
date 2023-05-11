// Synces anime

import { InlineKeyboard } from "grammy";
import { MyContext, authchatEval, bot } from "../src/bot/bot";
import { db, dbcache, updater } from "../src";
import { i_configuration } from "../src/interfaces";

// Helps in syncing anime, called by /async and by outer functions when needed.
export async function syncresponser(
	chatid: number,
	options: i_configuration,
	croncall: boolean = false
) {
	// if (options.pause_sync == true && croncall == true) return;
	// let chatid = 0;
	// if (ctx === undefined) chatid = authchat;
	// else chatid = ctx.message.chat.id;
	const userid = await dbcache.getUserID(chatid);
	if (userid === undefined) return;
	let msgid = (
		await bot.api.sendMessage(chatid, "Syncing anime...", {
			reply_markup: { remove_keyboard: true }
		})
	).message_id;
	await bot.api.sendChatAction(chatid, "typing");
	let updateobj = await updater.updater(userid);
	bot.api.deleteMessage(chatid, msgid);
	if (updateobj.length == 0) {
		if (croncall == false) bot.api.sendMessage(chatid, "No new episodes have been released!");
		return;
	} else if (updateobj.length > 0) {
		if (croncall)
			bot.api.sendMessage(
				chatid,
				"Automatic syncing completed! New episodes have been released!"
			);
		else bot.api.sendMessage(chatid, "New episodes have been released!");
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
		if (msg.length + msgheader.length > 1024 && updateobj[i].shortname !== undefined) {
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
				reply_markup: replykeyboard
			});
			for (let msgnum = 1; msgnum < msglist.length; msgnum++)
				bot.api.sendMessage(chatid, msglist[msgnum], {
					parse_mode: "HTML"
				});
		} else
			bot.api.sendPhoto(chatid, imagelink, {
				caption: msg,
				parse_mode: "HTML",
				reply_markup: replykeyboard
			});
	}
}

export async function anime_sync(ctx: MyContext) {
	if (!authchatEval(ctx)) return;
	const options = await dbcache.getConfig(ctx.chat.id);
	await syncresponser(ctx.chat.id, options, false);
}

//export async function anime_sync_cron()

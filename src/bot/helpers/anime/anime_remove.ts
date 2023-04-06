// Removing anime

import { Keyboard } from "grammy";
import { updater } from "../../..";
import { delanime } from "../../../database/db_connect";
import {
	MyContext,
	MyConversation,
	authchatEval,
	getUpdaterAnimeIndex,
} from "../../../bot/bot";

export async function anime_remove(ctx: MyContext) {
	if (authchatEval(ctx)) await ctx.conversation.enter("delanimehelper");
}

export async function delanimehelper(
	conversation: MyConversation,
	ctx: MyContext
) {
	let updateobj = updater.updateobj;
	let keyboard = new Keyboard();
	let animelist = [];
	for (let i = 0; i < updateobj.length; i++) {
		animelist.push(updateobj[i].anime);
		keyboard.text(`Delete: ${updateobj[i].anime}`).row();
	}

	keyboard.resized().persistent().oneTime();
	await ctx.reply("Which one to remove? (/cancel to cancel)", {
		reply_markup: keyboard,
	});
	const todel = (await conversation.waitForHears(/Delete: (.+)/)).message.text
		.slice(8)
		.trim();
	if (!animelist.includes(todel)) {
		ctx.reply("mathafucka");
		return;
	}
	let newkeyboard = new Keyboard()
		.text("Yes, I'm sure.")
		.text("No, cancel it.")
		.row()
		.resized()
		.persistent()
		.oneTime();
	await ctx.reply(`Removing ${todel}... Are you sure?`, {
		reply_markup: newkeyboard,
	});
	const confirmation = await conversation.waitForHears(
		/(Yes, I'm sure\.)|(No, cancel it\.)/
	);
	if (confirmation.message.text == "Yes, I'm sure.") {
		await ctx.reply(`Deleted ${todel}`, {
			reply_markup: { remove_keyboard: true },
		});
		console.log(`Delete request for ${todel} received!`);
		delanime(updater.client, todel);
		let i = getUpdaterAnimeIndex(todel);
		updater.updateobj.splice(i, 1);
		return;
	} else if (confirmation.message.text == "No, cancel it.") {
		await ctx.reply(`Aight cancelled removal.`, {
			reply_markup: { remove_keyboard: true },
		});
		return;
	}
}

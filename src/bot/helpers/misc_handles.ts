import { InlineKeyboard, InputFile } from "grammy";
import { bot, MyContext } from "../bot";
import { createReadStream } from "fs-extra";
import { conversations, createConversation } from "@grammyjs/conversations";
import { deleteUser, newUser } from "../user_mgmt";
import { markWatchedRange, unwatchhelper } from "./anime/a_watch_unwatch_ep";
import { stopWatching } from "./anime/a_watching";
import { addWL } from "./watchlist/w_add";
import { createWL, deleteWL } from "./watchlist/w_wlmgmt";
import { AnimeEntry } from "anilist-node";

// going back in a menu
export async function back_handle(ctx: MyContext) {
	const backmenu = new InlineKeyboard()
		.text("Mark watched", "mark_watch")
		.text("Download", "download");
	await ctx.editMessageReplyMarkup({ reply_markup: backmenu });
	await ctx.answerCallbackQuery();
}

// Handles cancel calls
export async function cancel_handle(ctx: MyContext) {
	await ctx.conversation.exit();
	await ctx.reply("Cancelling operation...", {
		reply_markup: { remove_keyboard: true }
	});
}

// sends log file
export async function log_command(ctx: MyContext) {
	if (ctx.from.id != parseInt(process.env.AUTHORISED_CHAT)) {
		await ctx.reply("Logs available for admin only! (｡•́︿•̀｡)");
		return;
	}
	const logfile = new InputFile(createReadStream("./log.txt"), "log.txt");
	await ctx.replyWithDocument(logfile);
}

export function initConvos() {
	bot.use(conversations());
	bot.use(createConversation(unwatchhelper));
	bot.use(createConversation(newUser));
	bot.use(createConversation(deleteUser));
	bot.use(createConversation(stopWatching));
	bot.use(createConversation(markWatchedRange));
	bot.use(createConversation(createWL));
	bot.use(createConversation(deleteWL));
	bot.use(createConversation(addWL));
}

export function cacheWiper(reqCache: { query: string; pg: string; response: AnimeEntry }[]) {
	if (reqCache.length < 1000) return reqCache;
	const todelsize = reqCache.length - 1000;
	return reqCache.splice(0, todelsize);
}

export function selfyeet(chatid: number, mid: number, time: number) {
	setTimeout(async () => {
		try {
			await bot.api.deleteMessage(chatid, mid);
		} catch (e) {
			return;
		}
	}, time);
}


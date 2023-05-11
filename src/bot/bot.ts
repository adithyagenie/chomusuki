// telegram bot endpoint

import {
	conversations,
	createConversation,
	type Conversation,
	type ConversationFlavor
} from "@grammyjs/conversations";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { Bot, Context, InlineKeyboard, NextFunction, SessionFlavor, session } from "grammy";

import { authchat, db } from "..";
import { anime_dllist } from "./helpers/anime/anime_dllist";
import { anime_unwatch, unwatchhelper } from "./helpers/anime/anime_unwatch";
import { callback_dl, callback_dlep } from "./helpers/anime/cb_dl_handle";
import { callback_mkwatch, callback_mkwatchep } from "./helpers/anime/cb_mkwatch_handle";
import { back_handle, cancel_handle, log_command } from "./helpers/anime/misc_handles";
import { anime_config } from "./helpers/anime_config";
import { InlineKeyboardButton } from "@grammyjs/types";
import {
	animeSearchStart,
	animeStartWatch,
	remindMe,
	remindMe_startWatch_cb
} from "./helpers/anime/anime_add";
import { animePendingMsgHandler } from "./helpers/anime/anime_pending";
import { deleteUser, newUser } from "./user_mgmt";
import { i_ProcessedObjV2 } from "../interfaces";
import { stopWatching, watchingList, watchingListCBQ } from "./helpers/anime/anime_remove";

interface SessionData {
	userid: number;
	config: { pause_airing_updates: boolean };
}

export type MyContext = Context & ConversationFlavor & SessionFlavor<SessionData>;
export type MyConversation = Conversation<MyContext>;

export const bot = new Bot<MyContext>(`${process.env.BOT_TOKEN}`, {
	botInfo: {
		id: 6104968853,
		is_bot: true,
		first_name: "Cunnime_DEV",
		username: "cunnime_dev_bot",
		can_join_groups: false,
		can_read_all_group_messages: false,
		supports_inline_queries: false
	}
});

export async function botinit() {
	const throttler = apiThrottler();
	bot.api.config.use(throttler);
	bot.use(session({ initial: () => ({ userid: undefined, config: undefined }) }));
	bot.use(conversations());
	botcommands();
	console.log("*********************");
	console.log("Cunnime has started!");
	console.log("*********************");
}

export const authchatEval = (ctx: MyContext) => {
	if (ctx.chat.id != authchat) {
		ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
		return false;
	}
	return true;
};

export const getUpdaterAnimeIndex = async (name: string, pending: i_ProcessedObjV2[]) =>
	pending.map((object) => object.jpname).indexOf(name);

export function getPagination(current: number, maxpage: number, text: string) {
	var keys: InlineKeyboardButton[] = [];
	if (current > 1) keys.push({ text: `«1`, callback_data: `${text}_1` });
	if (current > 2)
		keys.push({
			text: `‹${current - 1}`,
			callback_data: `${text}_${(current - 1).toString()}`
		});
	keys.push({
		text: `-${current}-`,
		callback_data: `${text}_${current.toString()}`
	});
	if (current < maxpage - 1)
		keys.push({
			text: `${current + 1}›`,
			callback_data: `${text}_${(current + 1).toString()}`
		});
	if (current < maxpage)
		keys.push({
			text: `${maxpage}»`,
			callback_data: `${text}_${maxpage.toString()}`
		});

	return new InlineKeyboard().add(...keys);
}

/**
 * Note to self: implement sessions and user not registered.
 */
function botcommands() {
	bot.use(createConversation(unwatchhelper));
	bot.use(createConversation(newUser));
	bot.use(createConversation(deleteUser));
	bot.use(createConversation(stopWatching));
	bot.use(async (ctx: MyContext, next: NextFunction) => {
		console.log(`REQUEST:: ${ctx.from.id}: ${ctx.session.userid}`);
		if (ctx.has(["::bot_command", "callback_query:data"])) {
			console.log(`${ctx.from.id}: ${ctx.session.userid}`);
			if (ctx.session.userid == undefined) {
				const userid = await db.users.findUnique({
					where: { chatid: ctx.from.id },
					select: { userid: true }
				});
				if (userid === null) {
					if (ctx.hasCommand("register")) {
						await next();
						return;
					} else {
						await ctx.reply("New user? Register with /register.");
						return;
					}
				} else if (userid != undefined) {
					if (!ctx.hasCommand("register")) {
						ctx.session.userid = userid.userid;
						console.log("ye boi permit");
						await next();
						return;
					} else {
						ctx.session.userid = userid.userid;
						await ctx.reply("You have already created an account!");
						return;
					}
				}
			} else {
				console.log("permit");
				await next();
				return;
			}
		}
		await next();
		return;
	});
	bot.command("start", (ctx) =>
		ctx.reply("Sup boss?", { reply_markup: { remove_keyboard: true } })
	);
	bot.command("help", (ctx) => {
		ctx.reply("Help me onii-chan I'm stuck~");
	});
	//bot.command("pending", async (ctx) => await anime_sync(ctx));
	bot.command("register", async (ctx) => await ctx.conversation.enter("newUser"));
	bot.command("deleteaccount", async (ctx) => await ctx.conversation.enter("deleteUser"));
	bot.command("pendingv2", (ctx) => animePendingMsgHandler(ctx));
	bot.command("startwatching", (ctx) => animeSearchStart(ctx, "startwatching"));
	bot.hears(/^\/startwatching_(\d+)/, (ctx) => animeStartWatch(ctx));
	bot.hears(/^\/stopwatching_(\d+)/, async (ctx) => await ctx.conversation.enter("stopWatching"));
	bot.hears(/^\/remindme_(\d+)/, (ctx) => remindMe(ctx));
	bot.command("cancel", async (ctx) => await cancel_handle(ctx));
	bot.command("watching", (ctx) => watchingList(ctx));
	//bot.command("removeanime", async ctx => await anime_remove(ctx));
	bot.command("unwatch", async (ctx) => await anime_unwatch(ctx));
	bot.command("dllist", async (ctx) => await anime_dllist(ctx));
	bot.command("config", async (ctx) => await anime_config(ctx));
	bot.command("log", async (ctx) => await log_command(ctx));

	bot.callbackQuery(/download/, async (ctx) => await callback_dl(ctx));
	bot.callbackQuery(/dlep_.*/, async (ctx) => await callback_dlep(ctx));
	bot.callbackQuery(/mark_watch/, async (ctx) => await callback_mkwatch(ctx));
	bot.callbackQuery(/mkwtch_.*/, async (ctx) => await callback_mkwatchep(ctx));
	bot.callbackQuery(/back/, async (ctx) => await back_handle(ctx));
	bot.callbackQuery(
		/(startwatching|remindme)_(.+)/gi,
		async (ctx) => await remindMe_startWatch_cb(ctx)
	);
	bot.callbackQuery(/watch_(.+)/, async (ctx) => await watchingListCBQ(ctx));
}

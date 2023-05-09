// telegram bot endpoint

import {
	conversations,
	createConversation,
	type Conversation,
	type ConversationFlavor
} from "@grammyjs/conversations";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { Bot, BotError, Context, GrammyError, HttpError, InlineKeyboard, session } from "grammy";

import { authchat, db, dbcache, updater } from "..";

import { anime_dllist } from "./helpers/anime/anime_dllist";

import { anime_unwatch, unwatchhelper } from "./helpers/anime/anime_unwatch";
import { callback_dl, callback_dlep } from "./helpers/anime/cb_dl_handle";
import { callback_mkwatch, callback_mkwatchep } from "./helpers/anime/cb_mkwatch_handle";
import { back_handle, cancel_handle, log_command } from "./helpers/anime/misc_handles";
import { anime_config } from "./helpers/anime_config";
import { i_configuration, i_ProcessedObjV2 } from "../interfaces";
import { InlineKeyboardButton } from "@grammyjs/types";
import {
	animeSearchStart,
	animeStartWatch,
	remindMe,
	remindMe_startWatch_cb
} from "./helpers/anime/anime_add";
import { animePendingMsgHandler } from "./helpers/anime/anime_pending";
import { getPending } from "../api/pending";

export class UpdateHold {
	updateobj: { [userid: number]: i_ProcessedObjV2[] };
	constructor() {
		this.updateobj = {};
	}
	async updater(userid: number) {
		try {
			this.updateobj[userid] = await getPending(userid);
		} catch (error) {
			console.error(error);
		}
		return this.updateobj[userid];
	}
	async getUpdateObj(userid: number) {
		if (this.updateobj[userid] === undefined) {
			await this.updater(userid);
			if (this.updateobj[userid].length == 0) {
				this.updateobj[userid] = [];
			} else return undefined;
		}
		console.log(this.updateobj[userid]);
		return this.updateobj[userid];
	}
}

/**Note to self: yeet this shit and implement redis */
export class cachedDB {
	dbcache: {
		userid: number;
		chatid: number;
		config?: i_configuration;
	}[];
	constructor() {
		this.dbcache = [];
	}
	async getUserID(chatid: number) {
		try {
			const cached = await this.getAllCachedData(chatid);
			if (cached !== undefined) return cached.userid;
			else {
				const userid = await db.users.findUnique({
					where: { chatid: chatid },
					select: { userid: true }
				});
				if (userid === null) return 0;
				this.dbcache.push({
					userid: userid.userid,
					chatid: chatid
				});
				console.log(`DB cache updated! User ${userid.userid} added.`);
				return userid.userid;
			}
		} catch (err) {
			console.error(err);
			return undefined;
		}
	}
	async getAllCachedData(chatid?: number, userid?: number) {
		try {
			if (chatid != undefined && userid === undefined) {
				const data = this.dbcache.find((o) => o.chatid == chatid);
				if (data !== undefined) return data;
				return undefined;
				//else if (data.length > 1) throw new Error("Multiple data for same user in cache");
			}
			if (userid != undefined) {
				const data = this.dbcache.find((o) => o.userid == userid);
				if (data !== undefined) return data;
				return undefined;
				//else if (data.length > 1) throw new Error("Multiple data for same user in cache");
			}
		} catch (err) {
			console.error(err);
			return undefined;
		}
	}
	async getConfig(chatid?: number, userid?: number) {
		try {
			if (userid === undefined && chatid != 0) userid = await this.getUserID(chatid);
			if (userid === undefined) throw new Error("UserID not found.");
			const index = this.dbcache.findIndex((o) => o.userid == userid);
			if (this.dbcache[index].config !== undefined) return this.dbcache[index].config;
			const data = await db.config.findUnique({
				where: { userid: userid }
			});

			if (index === -1) throw new Error(`No userid found for ${userid}:${chatid}`);
			this.dbcache[index].config = {
				pause_airing_updates: data.pause_airing_updates
			};
			return data;
		} catch (err) {
			console.error(err);
			return undefined;
		}
	}
}

export const bot = new Bot<Context & ConversationFlavor>(`${process.env.BOT_TOKEN}`, {
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
	bot.use(session({ initial: () => ({}) }));
	bot.use(conversations());
	bot.catch((err) => {
		const ctx = err.ctx;
		console.error(`Error while handling update ${ctx.update.update_id}:`);
		const e = err.error;
		if (e instanceof GrammyError) {
			console.error("Error in request:", e.description);
		} else if (e instanceof HttpError) {
			console.error("Could not contact Telegram:", e);
		} else if (e instanceof BotError) {
			console.error("Bot error: ", e.error, "caused by", e.cause);
		} else {
			console.error("Unknown error:", e);
		}
	});
	botcommands();
	console.log("*********************");
	console.log("Cunnime has started!");
	console.log("*********************");
}

export type MyContext = Context & ConversationFlavor;
export type MyConversation = Conversation<MyContext>;
export const authchatEval = (ctx: MyContext) => {
	if (ctx.chat.id != authchat) {
		ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
		return false;
	}
	return true;
};

export const getUpdaterAnimeIndex = async (name: string, userid: number) =>
	(await updater.getUpdateObj(userid)).map((object) => object.jpname).indexOf(name);

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
	bot.command("start", (ctx) =>
		ctx.reply("Sup boss?", { reply_markup: { remove_keyboard: true } })
	);
	bot.command("help", (ctx) => {
		ctx.reply("Help me onii-chan I'm stuck~");
	});
	//bot.command("pending", async (ctx) => await anime_sync(ctx));
	bot.command("pendingv2", (ctx) => animePendingMsgHandler(ctx));
	bot.command("startwatching", (ctx) => animeSearchStart(ctx, "startwatching"));
	bot.hears(/^\/startwatching_(\d+)/, (ctx) => animeStartWatch(ctx));
	bot.hears(/^\/remindme_(\d+)/, (ctx) => remindMe(ctx));
	bot.command("cancel", async (ctx) => await cancel_handle(ctx));
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
}

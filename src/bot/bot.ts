// telegram bot endpoint

import {
	conversations,
	createConversation,
	type Conversation,
	type ConversationFlavor,
} from "@grammyjs/conversations";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import {
	Bot,
	BotError,
	Context,
	GrammyError,
	HttpError,
	session,
} from "grammy";
import { MongoClient } from "mongodb";
import { CheckUpdates, ResObj } from "../api/UpdRelease";

import { authchat, updater } from "..";
import { configuration } from "../database/anime_db";
import { anime_add, animeadd } from "./helpers/anime/anime_add";
import { anime_dllist } from "./helpers/anime/anime_dllist";
import { anime_remove, delanimehelper } from "./helpers/anime/anime_remove";
import { anime_sync } from "./helpers/anime/anime_sync";
import { anime_unwatch, unwatchhelper } from "./helpers/anime/anime_unwatch";
import { callback_dl, callback_dlep } from "./helpers/anime/cb_dl_handle";
import {
	callback_mkwatch,
	callback_mkwatchep,
} from "./helpers/anime/cb_mkwatch_handle";
import {
	back_handle,
	cancel_handle,
	log_command,
} from "./helpers/anime/misc_handles";
import { anime_config } from "./helpers/anime_config";
import { getUser, getWL } from "../database/watchlist_db";

export class UpdateHold {
	updateobj: ResObj[];
	constructor() {
		this.updateobj = [];
	}
	async updater() {
		try {
			this.updateobj = await CheckUpdates();
		} catch (error) {
			console.error(error);
		}
		return this.updateobj;
	}
}

export const bot = new Bot<Context & ConversationFlavor>(
	`${process.env.BOT_TOKEN}`,
	{
		botInfo: {
			id: 6104968853,
			is_bot: true,
			first_name: "Cunnime_DEV",
			username: "cunnime_dev_bot",
			can_join_groups: false,
			can_read_all_group_messages: false,
			supports_inline_queries: false,
		},
	}
);

export async function botinit(options: configuration) {
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
	botcommands(options);
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
export const getUpdaterAnimeIndex = (name: string) =>
	updater.updateobj.map((object) => object.anime).indexOf(name);

function botcommands(options: configuration) {
	bot.use(createConversation(animeadd));
	bot.use(createConversation(delanimehelper));
	bot.use(createConversation(unwatchhelper));

	bot.command("start", (ctx) =>
		ctx.reply("Sup boss?", { reply_markup: { remove_keyboard: true } })
	);
	bot.command("help", (ctx) => {
		ctx.reply("Help me onii-chan I'm stuck~");
	});
	bot.command("sync", async (ctx) => await anime_sync(ctx, options));
	bot.command("addanime", async (ctx) => await anime_add(ctx));
	bot.command("cancel", async (ctx) => await cancel_handle(ctx));
	bot.command("removeanime", async (ctx) => await anime_remove(ctx));
	bot.command("unwatch", async (ctx) => await anime_unwatch(ctx));
	bot.command("dllist", async (ctx) => await anime_dllist(ctx));
	bot.command("config", async (ctx) => await anime_config(ctx, options));
	bot.command("log", async (ctx) => await log_command(ctx));

	bot.command("watchlist", async (ctx) => {
		const user = await getUser(ctx.chat.id, {
			Username: true,
			watchlists: true,
		});
		const wlList = getWL(user.watchlists[0]);
		const wlListarr = [];
		var nextelem = wlList.next();
		while ((await nextelem).done == false) {
			wlListarr.push((await nextelem).value);
			nextelem = wlList.next();
		}
	});

	bot.callbackQuery(/download/, async (ctx) => await callback_dl(ctx));
	bot.callbackQuery(/dlep_.*/, async (ctx) => await callback_dlep(ctx));
	bot.callbackQuery(/mark_watch/, async (ctx) => await callback_mkwatch(ctx));
	bot.callbackQuery(
		/mkwtch_.*/,
		async (ctx) => await callback_mkwatchep(ctx)
	);
	bot.callbackQuery(/back/, async (ctx) => await back_handle(ctx));
}

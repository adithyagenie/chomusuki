// telegram bot endpoint

import {
	conversations,
	createConversation,
	type Conversation,
	type ConversationFlavor
} from "@grammyjs/conversations";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { Bot, Context, NextFunction, SessionFlavor, session } from "grammy";
import { db } from "..";
import { anime_dllist, dl_cbq, dlep_cbq } from "./helpers/anime/a_download";
import {
	anime_unwatch,
	callback_mkwatch,
	callback_mkwatchep,
	markWatchedRange,
	unwatchhelper
} from "./helpers/anime/a_watch_unwatch_ep";
import { back_handle, cancel_handle, log_command } from "./helpers/anime/misc_handles";
import { anime_config } from "./helpers/anime_config";
import { animeSearchStart, search_startWatch_remindMe_cb } from "./helpers/anime/a_search";
import { animePendingMsgHandler } from "./helpers/anime/a_pending";
import { deleteUser, newUser } from "./user_mgmt";
import { stopWatching } from "./helpers/anime/a_watching";
import {
	airingUpdatesList,
	airingUpdatesListCBQ,
	remindMe,
	stopAiringUpdates
} from "./helpers/anime/a_airing_updates";
import { animeStartWatch } from "./helpers/anime/a_watching";
import { watchingList, watchingListCBQ } from "./helpers/anime/a_watching";

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
	// bot.api.setMyCommands([
	// 	{ command: "register", description: "Create a new user!" },
	// 	{
	// 		command: "startwatching",
	// 		description: "Start watching an anime! Use /startwatching 'search query'."
	// 	},
	// 	{
	// 		command: "remindme",
	// 		description: "Subscribe to updates of an anime! Use /remindme 'search query'."
	// 	},
	// 	{
	// 		command: "watching",
	// 		description: "Get a list of all the anime you are currently watching."
	// 	},
	// 	{
	// 		command: "airingupdates",
	// 		description: "Get a list of all the anime you have subscribed for updates."
	// 	},
	// 	{ command: "markwatched", description: "Mark a range of episodes of anime as watched." },
	// 	{ command: "unwatch", description: "Un-mark an episode of an anime as watched." },
	// 	//{command: "config", description: "Don't worry abt this for now..."}
	// 	{ command: "dllist", description: "Get your queued downloads. Under development." },
	// 	{ command: "cancel", description: "Cancel any currently going operations." },
	// 	{ command: "deleteaccount", description: "Delete your account." }
	// ]);
	botcommands();
	console.log("*********************");
	console.log("Cunnime has started!");
	console.log("*********************");
}

/**
 * Note to self: implement sessions and user not registered.
 */
function botcommands() {
	bot.use(createConversation(unwatchhelper));
	bot.use(createConversation(newUser));
	bot.use(createConversation(deleteUser));
	bot.use(createConversation(stopWatching));
	bot.use(createConversation(markWatchedRange));
	bot.use(async (ctx: MyContext, next: NextFunction) => {
		if (ctx.has(["::bot_command", "callback_query:data"])) {
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
						console.log("processing db check user");
						await next();
						return;
					} else {
						ctx.session.userid = userid.userid;
						await ctx.reply("You have already created an account!");
						return;
					}
				}
			} else {
				console.log("processing");
				await next();
				return;
			}
		}
		await next();
		return;
	});
	bot.hears(/\/start startwatching_(\d+)/, (ctx) => animeStartWatch(ctx));
	bot.hears(/\/start remindme_(\d+)/, (ctx) => remindMe(ctx));
	bot.hears(
		/\/start stopwatching_(\d+)/,
		async (ctx) => await ctx.conversation.enter("stopWatching")
	);
	bot.hears(/\/start stopremindme_(\d+)/, (ctx) => stopAiringUpdates(ctx));

	bot.command("register", async (ctx) => await ctx.conversation.enter("newUser"));
	bot.command("deleteaccount", async (ctx) => await ctx.conversation.enter("deleteUser"));
	bot.command("pending", (ctx) => animePendingMsgHandler(ctx));
	bot.command("startwatching", (ctx) => animeSearchStart(ctx, "startwatching"));
	bot.command("remindme", (ctx) => animeSearchStart(ctx, "remindme"));
	//bot.hears(/^\/startwatching_(\d+)/, (ctx) => animeStartWatch(ctx));
	//bot.hears(/^\/stopwatching_(\d+)/, async (ctx) => await ctx.conversation.enter("stopWatching"));
	//bot.hears(/^\/remindme_(\d+)/, (ctx) => remindMe(ctx));
	//bot.hears(/^\/stopairingupdates_(\d+)/, (ctx) => stopAiringUpdates(ctx));
	bot.command("cancel", async (ctx) => await cancel_handle(ctx));
	bot.command("watching", (ctx) => watchingList(ctx));
	bot.command("airingupdates", (ctx) => airingUpdatesList(ctx));
	bot.command("markwatched", async (ctx) => await ctx.conversation.enter("markWatchedRange"));
	bot.command("unwatch", async (ctx) => await anime_unwatch(ctx));
	bot.command("dllist", async (ctx) => await anime_dllist(ctx));
	bot.command("config", async (ctx) => await anime_config(ctx));
	bot.command("log", async (ctx) => await log_command(ctx));

	bot.callbackQuery(/download/, async (ctx) => await dl_cbq(ctx));
	bot.callbackQuery(/dlep_(\d+)/, async (ctx) => await dlep_cbq(ctx));
	bot.callbackQuery(/mark_watch/, async (ctx) => await callback_mkwatch(ctx));
	bot.callbackQuery(/mkwtch_(\d+)/, async (ctx) => await callback_mkwatchep(ctx));
	bot.callbackQuery(/back/, async (ctx) => await back_handle(ctx));
	bot.callbackQuery(
		/(startwatching|remindme)_(\d+)(_current)?/,
		async (ctx) => await search_startWatch_remindMe_cb(ctx)
	);
	bot.callbackQuery(/watch_(\d+)(_current)?/, async (ctx) => await watchingListCBQ(ctx));
	bot.callbackQuery(/airingupd_(\d+)(_current)?/, async (ctx) => await airingUpdatesListCBQ(ctx));

	bot.command("start", (ctx) => ctx.reply("Sup boss?"));
	bot.command("help", (ctx) => ctx.reply("Help me onii-chan I'm stuck~"));
}

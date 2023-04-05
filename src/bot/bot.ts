// telegram bot endpoint

import {
	Bot,
	BotError,
	Context,
	GrammyError,
	HttpError,
	InlineKeyboard,
	InputFile,
	Keyboard,
} from "grammy";
import { type InlineKeyboardButton } from "@grammyjs/types";
import { CheckUpdates, ResObj } from "../api/UpdRelease";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { getxdcc } from "../api/subsplease-xdcc";
import { MongoClient } from "mongodb";
import {
	type Conversation,
	type ConversationFlavor,
	conversations,
	createConversation,
} from "@grammyjs/conversations";

import { session } from "grammy";
import {
	addAnimeNames,
	AnimeNames,
	markWatchedunWatched,
	delanime,
	DLSync,
	getPendingDL,
	DlSync,
	configuration,
	getSynced,
	addSynced,
	changeconfig,
} from "../database/db_connect";
import { messageToHTMLMessage } from "./caption_entity_handler";
import { createReadStream } from "fs-extra";
import { getAlId } from "../api/anilist_api";

export class UpdateHold {
	updateobj: ResObj[];
	client: MongoClient;
	constructor(client: MongoClient) {
		this.updateobj = [];
		this.client = client;
	}
	async updater() {
		try {
			this.updateobj = await CheckUpdates(this.client);
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

export async function botinit(
	bot: Bot<Context & ConversationFlavor>,
	updater: UpdateHold,
	authchat: number,
	options: configuration
) {
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
	botcommands(bot, updater, authchat, options);
	console.log("*********************");
	console.log("Cunnime has started!");
	console.log("*********************");
}

function botcommands(
	bot: Bot<Context & ConversationFlavor>,
	updater: UpdateHold,
	authchat: number,
	options: configuration
) {
	bot.use(createConversation(animeadd));
	bot.use(createConversation(delanimehelper));
	bot.use(createConversation(unwatchhelper));
	type MyContext = Context & ConversationFlavor;
	type MyConversation = Conversation<MyContext>;
	const getUpdaterAnimeIndex = (name: string) =>
		updater.updateobj.map((object) => object.anime).indexOf(name);

	// Start command
	bot.command("start", (ctx) =>
		ctx.reply("Sup boss?", { reply_markup: { remove_keyboard: true } })
	);

	// Help command
	bot.command("help", (ctx) => {
		ctx.reply("Help me onii-chan I'm stuck~");
	});

	// Synces anime
	bot.command("async", async (ctx) => {
		if (ctx.chat.id != authchat) {
			await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
			return;
		}
		const msg = ctx.message.text.split(" ");
		if (msg.length == 2) {
			if (msg[1] == "remind") {
				await syncresponser(
					bot,
					authchat,
					updater,
					options,
					false,
					ctx,
					true
				);
				return;
			}
		}
		await syncresponser(bot, authchat, updater, options, false, ctx);
	});

	// Add anime command
	bot.command("aadd", async (ctx) => {
		if (ctx.chat.id != authchat) {
			await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
			return;
		}
		await ctx.conversation.enter("animeadd");
	});

	async function animeadd(conversation: MyConversation, ctx: MyContext) {
		let responseobj: AnimeNames;
		await ctx.reply(
			"Please provide data required. Type /cancel at any point to cancel adding.",
			{ reply_markup: { remove_keyboard: true } }
		);
		await ctx.reply(
			"What is the exact Japanese name of the anime? (Refer Anilist for name)"
		);
		const jpanimename = await conversation.form.text();
		await ctx.reply(
			"What is the exact English name of the anime? (Refer Anilist for name)"
		);
		const enanimename = await conversation.form.text();
		await ctx.reply(
			"Any other optional names you would like to provide? (seperated by commas, NIL for nothing)"
		);
		const optnameres = await conversation.form.text();
		let optnames: string[], excnames: string[];
		if (optnameres != "NIL") {
			optnames = optnameres.split(",");
			optnames = optnames.map((x: string) => x.trim());
		}
		await ctx.reply(
			"Any similarly named terms which would interfere with search results? (seperated by commas, NIL for nothing)"
		);
		const excnameres = await conversation.form.text();
		if (excnameres != "NIL") {
			excnames = excnameres.split(",");
			excnames = excnames.map((x: string) => x.trim());
		}
		let AlID = 0;
		AlID = await getAlId(enanimename, jpanimename);
		if (AlID == 0) {
			await ctx.reply("Anilist ID for the anime?");
			AlID = parseInt(await conversation.form.text());
		}
		responseobj = {
			EnName: enanimename,
			JpName: jpanimename,
			OptionalNames: optnames === undefined ? [] : optnames,
			ExcludeNames: excnames === undefined ? [] : excnames,
			AlID: AlID,
		};
		await addAnimeNames(updater.client, responseobj);
		await ctx.reply("Anime has been added!");
		return;
	}

	// Handles cancel calls
	bot.command("cancel", async (ctx) => {
		if (ctx.chat.id != authchat) {
			await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
			return;
		}
		await ctx.conversation.exit();
		await ctx.reply("Cancelling operation...", {
			reply_markup: { remove_keyboard: true },
		});
	});

	// Removing anime
	bot.command("aremove", async (ctx) => {
		if (ctx.chat.id != authchat) {
			await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
			return;
		}
		await ctx.conversation.enter("delanimehelper");
	});

	async function delanimehelper(
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
		const todel = (
			await conversation.waitForHears(/Delete: (.+)/)
		).message.text
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

	// Unwatch anime command
	bot.command("aunwatch", async (ctx) => {
		if (ctx.chat.id != authchat) {
			await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
			return;
		}
		await ctx.conversation.enter("unwatchhelper");
	});

	async function unwatchhelper(conversation: MyConversation, ctx: MyContext) {
		let updateobj = updater.updateobj;
		let keyboard = new Keyboard().resized().persistent().oneTime();
		let animelist = [];
		for (let i = 0; i < updateobj.length; i++) {
			animelist.push(updateobj[i].anime);
			keyboard.text(`Anime: ${updateobj[i].anime}`).row();
		}
		await ctx.reply("Select the anime: (/cancel to cancel)", {
			reply_markup: keyboard,
		});
		const animename = (
			await conversation.waitForHears(/Anime: (.+)/)
		).message.text
			.slice(7)
			.trim();
		let eplist: number[] = [];
		let animeindex = getUpdaterAnimeIndex(animename);
		for (let j = 0; j < updateobj[animeindex].watched.length; j++)
			eplist.push(updateobj[animeindex].watched[j].epnum);

		while (true) {
			let newkey = new Keyboard().persistent().resized();
			for (let i = 0; i < eplist.length; i++)
				newkey.text(`Unwatch episode: ${eplist[i]}`);
			newkey.text("Finish marking");
			await ctx.reply("Choose the episode: ", { reply_markup: newkey });
			const buttonpress = (
				await conversation.waitForHears(
					/(^Unwatch episode: ([0-9]+)$)|(^Finish marking$)/
				)
			).message.text;
			if (buttonpress == "Finish marking") {
				await ctx.reply("Alright finishing up!");
				break;
			}
			const tounwatch = parseInt(buttonpress.slice(17).trim());
			console.log(
				`Recieved request for unwatch: \nANIME: ${animename}, EP: ${tounwatch}`
			);
			let watchedAnime: { epnum: number; epname: string }[] = [];
			watchedAnime = updateobj[animeindex].watched;
			watchedAnime = watchedAnime.filter(
				({ epnum, epname }) => epnum != tounwatch
			);
			const toupdate = { name: animename, watched: watchedAnime };
			const updres = await markWatchedunWatched(updater.client, toupdate);
			if (updres == true) {
				await ctx.reply(
					`Marked Ep ${tounwatch} of ${animename} as not watched`,
					{ reply_markup: { remove_keyboard: true } }
				);
				updater.updateobj[animeindex].watched = watchedAnime;
			} else {
				await ctx.reply(
					`Error occured while marking episode as unwatched`,
					{
						reply_markup: { remove_keyboard: true },
					}
				);
			}
		}
		return;
	}

	bot.command("dllist", async (ctx) => {
		if (ctx.chat.id != authchat) {
			await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
			return;
		}
		await ctx.replyWithChatAction("typing");
		const pendingdl: DLSync[] = await getPendingDL(updater.client);
		if (pendingdl.length == 0) {
			ctx.reply("No pending downloads!");
		} else {
			const resser: { anime: string; epnum: number[] }[] = [];
			for (let i = 0; i < pendingdl.length; i++) {
				let index = resser.findIndex(
					(o) => o.anime == pendingdl[i].anime
				);
				if (index == -1)
					resser.push({
						anime: pendingdl[i].anime,
						epnum: [pendingdl[i].epnum],
					});
				else {
					resser[index].epnum.push(pendingdl[i].epnum);
					resser[index].epnum.sort();
				}
			}

			var msg: string = "<code>DOWNLOAD QUEUE:</code>\n\n";
			var msglist: string[] = [];
			for (let i = 0; i < resser.length; i++) {
				let tmpmsg = `<b><u>${
					resser[i].anime
				}</u></b> - Episode <b>${resser[i].epnum.join(", ")}</b>\n`;
				if (msg.length + tmpmsg.length > 1024) {
					msglist.push(msg);
					msg = tmpmsg;
				} else msg += tmpmsg;
			}
			if (msglist.length > 0) {
				for (let i = 0; i < msglist.length; i++)
					bot.api.sendMessage(ctx.message.chat.id, msglist[i], {
						parse_mode: "HTML",
					});
			} else
				bot.api.sendMessage(ctx.message.chat.id, msg, {
					parse_mode: "HTML",
				});
		}
	});

	bot.command("config", async (ctx) => {
		let argarray = ctx.message.text.split(" ");
		argarray.splice(0, 1);
		console.log(argarray);
		var newconfig = options;
		if (argarray.length > 0) {
			if (argarray[0] == "remind_again") {
				if (argarray[1] == "true" || argarray[1] == "false") {
					newconfig.remind_again = true
						? argarray[1] == "true"
						: argarray[1] == "false";
					await changeconfig(updater.client, newconfig);
					ctx.reply(`Set remind_again to ${newconfig.remind_again}.`);
				} else
					ctx.reply(
						'Invalid value for remind_again. Accepted values: "true/false"'
					);
				return;
			} else if (argarray[0] == "pause_sync") {
				if (argarray[1] == "true" || argarray[1] == "false") {
					newconfig.pause_sync = true
						? argarray[1] == "true"
						: argarray[1] == "false";
					await changeconfig(updater.client, newconfig);
					ctx.reply(`Set pause_sync to ${newconfig.pause_sync}.`);
				} else
					ctx.reply(
						'Invalid value for pause_sync. Accepted values: "true/false"'
					);
				return;
			} else
				ctx.reply(
					'Invalid config option. Accepted config option: "remind_again/pause_sync"'
				);
			return;
		} else
			ctx.reply(
				'Provide a config option. Accepted config option: "remind_again/pause_sync"'
			);
	});

	bot.command("log", async (ctx) => {
		if (ctx.chat.id != authchat) {
			await ctx.reply("Bot not yet available for public use (｡•́︿•̀｡)");
			return;
		}
		const logfile = new InputFile(
			createReadStream("./debug.log"),
			"log.txt"
		);
		ctx.replyWithDocument(logfile);
	});

	// Makes keyboard for download and mark watched
	function makeEpKeyboard(ctx: Context, callback_data_string: string) {
		let updateobj = updater.updateobj;
		let animename = ctx.callbackQuery.message.caption
			.split("Anime: ")[1]
			.split("Episodes:")[0]
			.trim();
		let eplist = [];
		const animeindex = getUpdaterAnimeIndex(animename);
		for (let j = 0; j < updateobj[animeindex].notwatched.length; j++)
			eplist.push(updateobj[animeindex].notwatched[j].epnum);

		let keyboard = new InlineKeyboard();
		for (let i = 0; i < eplist.length; i += 2) {
			let bruh: InlineKeyboardButton.CallbackButton = {
				text: `Episode ${eplist[i]}`,
				callback_data: `${callback_data_string}_${eplist[i]}`,
			};
			let bruh2: InlineKeyboardButton.CallbackButton = {
				text: `Episode ${eplist[i + 1]}`,
				callback_data: `${callback_data_string}_${eplist[i + 1]}`,
			};
			if (eplist[i + 1] === undefined) keyboard.add(bruh).row();
			else keyboard.add(bruh).add(bruh2).row();
		}
		keyboard.text("Go back", "back");
		return keyboard;
	}

	// Handles download Callback query
	bot.callbackQuery(/download/, async (ctx) => {
		const keyboard = makeEpKeyboard(ctx, "dlep");
		ctx.editMessageReplyMarkup({ reply_markup: keyboard });
		ctx.answerCallbackQuery();
	});

	// also a download callback handle
	bot.callbackQuery(/dlep_.*/, async (ctx) => {
		ctx.answerCallbackQuery("Download request recieved.");
		let epnum = parseInt(ctx.callbackQuery.data.split("_")[1]);
		let updateobj = updater.updateobj;
		let animename = ctx.callbackQuery.message.caption
			.split("Anime: ")[1]
			.split("Episodes:")[0]
			.trim();
		const i = getUpdaterAnimeIndex(animename);
		const j = updater.updateobj[i].notwatched
			.map((object) => object.epnum)
			.indexOf(epnum);

		let pendingdl: DLSync[] = await getPendingDL(updater.client);
		let queuenum = 0;
		var flag = false;
		if (pendingdl.length != 0)
			queuenum = Math.max(...pendingdl.map((o) => o.queuenum));
		for (let i = 0; i < pendingdl.length; i++) {
			if (
				pendingdl[i].anime == animename &&
				pendingdl[i].epnum == epnum
			) {
				flag = true;
				break;
			}
		}
		if (flag == true) {
			ctx.reply(
				`*__Episode ${epnum}__* of *__${animename}__* already queued for download! Use /dllist to view your pending downloads.`,
				{ parse_mode: "MarkdownV2" }
			);
			return;
		}
		let actualnotwatch = updateobj[i].notwatchedepnames[j];

		const xdcclink = await getxdcc(actualnotwatch);
		console.log(`Downloading: ${actualnotwatch}`);

		if (xdcclink.packnum != 0) {
			console.log(
				`startdl triggered @ ${xdcclink.botname}: ${xdcclink.packnum}`
			);
			let sync_toupd: DLSync = {
				queuenum: queuenum + 1,
				synctype: "dl",
				anime: animename,
				epnum: epnum,
				dltype: "xdcc",
				xdccData: {
					botname: xdcclink.botname,
					packnum: xdcclink.packnum,
				},
			};
			let returncode = await DlSync(updater.client, sync_toupd);
			if (returncode !== true) ctx.reply("Sending DL failed.");
			else
				ctx.reply(
					`*__Episode ${epnum}__* of *__${animename}__* queued for download!`,
					{ parse_mode: "MarkdownV2" }
				);
			return;
		} else {
			let torrentlinks = updateobj[i].torrentlink[j];
			console.log(`torrentdl triggered ${torrentlinks}`);
			let sync_toupd: DLSync = {
				queuenum: queuenum + 1,
				synctype: "dl",
				anime: animename,
				epnum: epnum,
				dltype: "torrent",
				torrentData: { links: torrentlinks },
			};
			let returncode = await DlSync(updater.client, sync_toupd);
			if (returncode !== true) ctx.reply("Sending DL failed.");
			else
				ctx.reply(
					`*__Episode ${epnum}__* of *__${animename}__* queued for download!`,
					{ parse_mode: "MarkdownV2" }
				);
			return;
		}
	});

	// A markwatch handle
	bot.callbackQuery(/mark_watch/, async (ctx) => {
		const keyboard = makeEpKeyboard(ctx, "mkwtch");
		ctx.editMessageReplyMarkup({ reply_markup: keyboard });
		ctx.answerCallbackQuery();
	});

	// Also a Mark watch callback handle
	bot.callbackQuery(/mkwtch_.*/, async (ctx) => {
		let epnum = parseInt(ctx.callbackQuery.data.split("_")[1]);
		let updateobj = updater.updateobj;
		let oldmsg = ctx.callbackQuery.message.caption;
		let animename = oldmsg.split("Anime: ")[1].split("Episodes:")[0].trim();
		let oldwatch: { epnum: number; epname: string }[] = [];
		let indexnum = getUpdaterAnimeIndex(animename);
		let toupdateanime: { epnum: number; epname: string };
		for (let j = 0; j < updateobj[indexnum].watched.length; j++)
			oldwatch.push(updateobj[indexnum].watched[j]);
		for (let j = 0; j < updateobj[indexnum].notwatched.length; j++) {
			if (updateobj[indexnum].notwatched[j].epnum == epnum)
				toupdateanime = updateobj[indexnum].notwatched[j];
		}

		oldwatch.push(toupdateanime);

		var index =
			updater.updateobj[indexnum].notwatched.indexOf(toupdateanime);
		if (index !== -1) {
			updater.updateobj[indexnum].notwatched.splice(index, 1);
		}
		updater.updateobj[indexnum].watched.push(toupdateanime);
		oldwatch.sort((a, b) => (a.epnum > b.epnum ? 1 : -1));
		const updres = await markWatchedunWatched(updater.client, {
			name: animename,
			watched: oldwatch,
		});
		if (updres == true) {
			const newkeyboard = makeEpKeyboard(ctx, "mkwtch");
			const oldformatmsg = messageToHTMLMessage(
				ctx.callbackQuery.message.caption,
				ctx.callbackQuery.message.caption_entities
			);
			var newMsgArray = oldformatmsg.split("\n");
			for (let j = 0; j < newMsgArray.length; j++) {
				if (newMsgArray[j].startsWith(`Episode ${epnum}:`)) {
					newMsgArray.splice(j, 1);
					break;
				}
			}
			const newmsg = newMsgArray.join("\n");
			bot.api.editMessageCaption(
				ctx.callbackQuery.message.chat.id,
				ctx.callbackQuery.message.message_id,
				{
					caption: newmsg,
					parse_mode: "HTML",
					reply_markup: newkeyboard,
				}
			);
			ctx.answerCallbackQuery(`Marked ${epnum} as watched!`);
		} else {
			await ctx.reply(`Error occured while marking episode as watched.`);
			ctx.answerCallbackQuery(`Error occured.`);
		}
	});

	// Going back in a menu
	bot.callbackQuery(/back/, async (ctx) => {
		let backmenu = new InlineKeyboard()
			.text("Mark watched", "mark_watch")
			.text("Download", "download");
		ctx.editMessageReplyMarkup({ reply_markup: backmenu });
		ctx.answerCallbackQuery();
	});
}

// Helps in syncing anime, called by /async and by outer functions when needed.
export async function syncresponser(
	bot: Bot,
	authchat: number,
	updater: UpdateHold,
	options: configuration,
	croncall: boolean = false,
	ctx: Context | undefined = undefined,
	remind_again: boolean = options.remind_again
) {
	if (options.pause_sync == true && croncall == true) return;
	let chatid = 0;
	if (ctx === undefined) chatid = authchat;
	else chatid = ctx.message.chat.id;
	let msgid = (
		await bot.api.sendMessage(chatid, "Syncing anime...", {
			reply_markup: { remove_keyboard: true },
		})
	).message_id;
	bot.api.sendChatAction(chatid, "typing");
	let updateobj: ResObj[] = await updater.updater();
	const actualcount = updateobj.length;
	bot.api.deleteMessage(chatid, msgid);
	if (remind_again == false) {
		console.log(`Remind again`);
		const oldwatch = await getSynced(updater.client);
		for (let i = updateobj.length - 1; i >= 0; i--) {
			let found = oldwatch.find((o) => o.anime == updateobj[i].anime);
			if (found !== undefined || found.reminded.length !== 0)
				updateobj[i].notwatched = updateobj[i].notwatched.filter(
					(o) => !found.reminded.includes(o.epnum)
				);
			if (updateobj[i].notwatched.length === 0) updateobj.splice(i, 1);
		}
	}
	const remind_purged_count = updateobj.length;
	let topmsg = "";
	if (actualcount - remind_purged_count > 0) {
		topmsg += ` (Some episodes were omitted, use \"/async remind\" to include those!)`;
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
		let obj = {
			anime: updateobj[i].anime,
			reminded: updateobj[i].notwatched.map((o) => o.epnum),
		};
		promisearray.push(addSynced(updater.client, obj));
	}
	await Promise.allSettled(promisearray);
}

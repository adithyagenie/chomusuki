import { db } from "../../..";
import { addToWatchlist } from "../../../database/animeDB";
import { MyContext, MyConversation } from "../../bot";
import { animeSearchHandler } from "../anime/a_search";

//import { makeWLKeyboard } from "./w_helpers";

export async function addWL(convo: MyConversation, ctx: MyContext) {
	// const { wl, wllist, keyboard } = await convo.external(() =>
	// 	makeWLKeyboard(convo.session.userid)
	// );
	// if (keyboard === undefined || wllist.length === 0) {
	// 	await ctx.reply("You currently do not have any watchlists.");
	// 	return;
	// }
	// const msg = (
	// 	await ctx.reply("Which watchlist do you want to add to?", { reply_markup: keyboard })
	// ).message_id;
	// const chosenwl = parseInt((await convo.waitForCallbackQuery(/wl_(\d+)/)).match[1]);
	// if (Number.isNaN(chosenwl)) throw new Error("Invalid callback data");
	// const item = wl.find((o) => o.watchlistid === chosenwl);
	// if (item === undefined) throw new Error("?????");
	const item = await convo.external(() =>
		db.watchlists.findUnique({
			where: { watchlistid: convo.session.temp.wlopt },
			select: { watchlist_name: true, watchlistid: true }
		})
	);
	if (item === null) {
		await ctx.reply("Watchlist missing.");
		return;
	}
	await ctx.reply("Send the name of anime or /done to stop adding.");
	let msgid = 0;
	while (1) {
		const name = await convo.waitFor(["message:text", "callback_query:data"]);
		if (name.hasCallbackQuery(/addwl(\d+)_(\d+)(_current)?/)) {
			await searchCB(convo, name);

		} else if (name.message != undefined) {
			if (name.message.text === "/done") {
				await ctx.reply("Alright wrapping up.");
				return;
			} else if (name.message.text.match(/\/start wl_(\d+)/) !== null) {
				convo.log(`Adding ${name.message.text}`);
				await name.deleteMessage();
				const result = await convo.external(() =>
					addingWL(
						item.watchlistid,
						parseInt(name.message.text.match(/\/start wl_(\d+)/)[1])
					)
				);
				if (result === "present") {
					await ctx.reply("Anime already added to watchlist.");

				} else if (result === "err") {
					await ctx.reply(`Error adding to watchlist. Try again after some time.`);
					return;
				} else if (result === "invalid") {
					await ctx.reply("Anime not found.");

				} else {
					const todel = await ctx.reply(
						`<b>${result}</b> has been added to ${item.watchlist_name}.\nTo add another, simply send the anime name to search or /done to finish adding.`,
						{ parse_mode: "HTML" }
					);
					selfyeet(ctx, todel.message_id);

				}
			} else {
				msgid = await startSearchWL(convo, ctx, name.message.text, item.watchlistid, msgid);
			}
		}
	}
}

const addingWL = (wlid: number, alid: number) => addToWatchlist(wlid, alid);
const selfyeet = (ctx: MyContext, mid: number) =>
	setTimeout(async () => {
		try {
			await ctx.api.deleteMessage(ctx.chat.id, mid);
		} catch (e) {
			return;
		}
	}, 5000);

/** addwl_(\d+)_(\d+)(_current)?*/
async function searchCB(convo: MyConversation, ctx: MyContext) {
	await ctx.answerCallbackQuery("Searching!");
	if (ctx.match[3] === "_current") return;
	const movepg = parseInt(ctx.match[2]);
	const wlid = parseInt(ctx.match[1]);
	const query = [...ctx.msg.text.split("\n")[0].matchAll(/^Search results for '(.+)'$/gi)].map(
		(o) => o[1]
	)[0];
	//console.log(`${command}, ${movepg}, ${query}`);
	const { msg, keyboard } = await animeSearchHandler(
		query,
		"addwl",
		movepg,
		ctx.me.username,
		convo.session.userid,
		wlid
	);
	if (msg == undefined || keyboard == undefined) {
		await ctx.reply("Unable to find any results.");
		return;
	}
	//console.log(`${msg}, ${JSON.stringify(keyboard)}`);
	await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" });
}

async function startSearchWL(
	convo: MyConversation,
	ctx: MyContext,
	name: string,
	wlid: number,
	msgid?: number
) {
	if (name === "") {
		await ctx.reply("Please provide a search query!");
		return 1;
	}
	if (msgid == 0 || msgid == undefined) msgid = (await ctx.reply("Searching...")).message_id;
	else await ctx.api.editMessageText(ctx.from.id, msgid, "Searching...");
	const { msg, keyboard } = await convo.external(() =>
		animeSearchHandler(name, "addwl", 1, ctx.me.username, convo.session.userid, wlid)
	);
	if (msg == undefined || keyboard == undefined) {
		await ctx.api.editMessageText(ctx.from.id, msgid, "Unable to find any results.");
		return;
	}
	if (keyboard.inline_keyboard.length == 0)
		await ctx.api.editMessageText(ctx.from.id, msgid, msg);
	await ctx.api.editMessageText(ctx.from.id, msgid, msg, {
		reply_markup: keyboard,
		parse_mode: "HTML"
	});
	return msgid;
}

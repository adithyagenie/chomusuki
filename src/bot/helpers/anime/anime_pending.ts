import { InlineKeyboard } from "grammy";
import { axios, dbcache } from "../../..";
import { getPending } from "../../../api/pending";
import { MyContext, bot } from "../../bot";
import { Application } from "express";

export async function animePendingMsgHandler(ctx: MyContext) {
	const userid = await dbcache.getUserID(ctx.chat.id);
	try {
		const res = await axios.get("http://localhost:4000/pending", {
			params: { chatid: ctx.chat.id, userid: userid },
			id: "_"
		});
		axios.storage.remove("_");
		if (res.status == 200) {
			return;
		}
		await ctx.reply("Failed.");
	} catch (err) {
		console.error(`Error calling /pending: ${err}`);
	}
}

export async function animePending(chatid: number, userid: number) {
	const res = await getPending(userid);
	var msgs: { imagelink: string; msg: string }[] = [];
	if (res.length == 0) {
		await bot.api.sendMessage(
			chatid,
			"You are currently not watching any anime. Add an anime with /startwatching to get started."
		);
		return;
	}
	for (let i = 0; i < res.length; i++) {
		if (res[i].notwatched.length == 0) continue;
		let [msg, msgheader] = ["", ""];
		let imagelink = res[i].imagelink;
		msgheader += `<b>Anime: ${res[i].jpname}</b>\n<i>(${res[i].enname})</i>\n\n`;
		msgheader += `<b>Pending:</b>\n`;
		for (let j = 0; j < res[i].notwatched.length; j++) {
			if (j < 30) msg += `🔹${res[i].jpname} - ${res[i].notwatched[j]}\n`;
			else {
				msg += "<i>And many more...</i>";
				break;
			}
		}
		if ((msg + msgheader).length > 1024 && res[i].shortname !== undefined) {
			while (msg.includes(res[i].jpname)) msg = msg.replace(res[i].jpname, res[i].shortname);
		}

		//Better logic
		if ((msg + msgheader).length > 4096) {
			console.log("Trying to trim");
			let lines = msg.split("\n");
			msg = lines[0] + "\n";
			for (let j = 1; j < lines.length; j++) {
				if ((msgheader + msg + lines[j]).length + 17 < 1024) msg += `${lines[j]}\n`;
				else {
					msg += "<i>And many more...</i>";
					break;
				}
			}
		}
		msg = msgheader + msg;

		// if (msg.length + msgheader.length > 1024) {
		// 	let chunk = "";
		// 	let lines = msg.split("\n");
		// 	for (let msgline = 0; msgline < lines.length; msgline++) {
		// 		if (msgline == 0) chunk += msgheader;
		// 		if (chunk.length + lines[msgline].length < 1024) {
		// 			chunk += `${lines[msgline]}\n`;
		// 		} else {
		// 			msglist.push(chunk);
		// 			chunk = `${lines[msgline]}\n`;
		// 		}
		// 	}
		// 	msglist.push(chunk);
		// } else msg = msgheader + msg;
		// if (msglist.length > 0) {
		// 	bot.api.sendPhoto(chatid, imagelink, {
		// 		caption: msglist[0],
		// 		parse_mode: "HTML",
		// 		reply_markup: replykeyboard
		// 	});
		// 	for (let msgnum = 1; msgnum < msglist.length; msgnum++)
		// 		bot.api.sendMessage(chatid, msglist[msgnum], {
		// 			parse_mode: "HTML"
		// 		});
		// } else
		msgs.push({ imagelink, msg });
	}
	if (msgs.length == 0) {
		await bot.api.sendMessage(chatid, "You don't have any pending episodes to watch.");
		return;
	}
	msgs.forEach(
		async (o) =>
			await bot.api.sendPhoto(chatid, o.imagelink, {
				caption: o.msg,
				parse_mode: "HTML",
				reply_markup: new InlineKeyboard()
					.text("Mark watched", "mark_watch")
					.text("Download", "download")
			})
	);
}

export function registerPendingHandler(app: Application) {
	app.get("/pending", async (req, res) => {
		if (req.query == undefined) return res.status(400);
		try {
			const chatid = parseInt(req.query.chatid.toString());
			const userid = parseInt(req.query.userid.toString());
			if (Number.isNaN(chatid) || Number.isNaN(userid))
				throw new Error("Incorrect URL params");
			console.log(`${chatid}:${userid} pendingv2`);
			res.status(200).json({ status: 200 });
			await animePending(chatid, userid);
		} catch (error) {
			console.error(`ERROR: /pending: ${error}`);
			return res.status(400).json({ status: 400 });
		}
	});
}

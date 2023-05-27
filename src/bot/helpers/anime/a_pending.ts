import { InlineKeyboard } from "grammy";
import { axios } from "../../..";
import { getSinglePending } from "../../../api/pending";
import { MyContext, bot } from "../../bot";
import { Application } from "express";

export async function a_Pending(ctx: MyContext) {
	ctx.deleteMessage();
	const userid = ctx.session.userid;
	try {
		const res = await axios.get("http://localhost:4000/pending", {
			params: {
				chatid: ctx.from.id,
				userid: userid,
				alid: parseInt(ctx.match[1]),
				is_bot: true
			},
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

/**Replies to /pending. Responds to localhost call. */
async function animePendingBotHandle(chatid: number, userid: number, alid: number) {
	var msgs: { image: string; msg: string }[] = [];
	const res = await getSinglePending(userid, null, alid);
	if (res === undefined) return undefined;
	else if (res === null) return null;
	if (res.notwatched.length === 0) {
		await bot.api.sendMessage(
			chatid,
			"You are already up to date with all episodes of this anime!"
		);
		return;
	}
	let [msg, msgheader] = ["", ""];
	msgheader += `<b>Anime: ${res.jpname}</b>\n<i>(${res.enname})\n`;
	if (res.status == "RELEASING") msgheader += "Currently airing.</i>\n\n";
	else if (res.status == "FINISHED") msgheader += "Finished airing.</i>\n\n";
	else msgheader += "</i>\n\n";
	msgheader += `<b>Pending:</b>\n`;
	for (let j = 0; j < res.notwatched.length; j++) {
		if (j < 30) msg += `🔹${res.jpname} - ${res.notwatched[j]}\n`;
		else {
			msg += "<i>And many more...</i>";
			break;
		}
	}
	if ((msg + msgheader).length > 1024 && res.shortname !== undefined) {
		while (msg.includes(res.jpname)) msg = msg.replace(res.jpname, res.shortname);
	}

	//Better logic
	if ((msg + msgheader).length > 1024) {
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
	await bot.api.sendPhoto(chatid, res.image, {
		caption: msgheader + msg,
		parse_mode: "HTML",
		reply_markup: new InlineKeyboard()
			.text("Mark watched", "mark_watch")
			.text("Download", "download")
	});
	return 0;
}

// export async function animePending(chatid: number, userid: number) {
// 	const res = await getPending(userid);
// 	var msgs: { imagelink: string; msg: string }[] = [];
// 	if (res === undefined || res.length == 0) {
// 		await bot.api.sendMessage(
// 			chatid,
// 			"You are currently not watching any anime. Add an anime with /startwatching to get started."
// 		);
// 		return;
// 	}
// 	for (let i = 0; i < res.length; i++) {
// 		if (res[i].notwatched.length == 0) continue;
// 		let [msg, msgheader] = ["", ""];
// 		let imagelink = res[i].image;
// 		msgheader += `<b>Anime: ${res[i].jpname}</b>\n<i>(${res[i].enname})\n`;
// 		if (res[i].status == "RELEASING") msgheader += "Currently airing.</i>\n\n";
// 		else if (res[i].status == "FINISHED") msgheader += "Finished airing.</i>\n\n";
// 		else msgheader += "</i>\n\n";
// 		msgheader += `<b>Pending:</b>\n`;
// 		for (let j = 0; j < res[i].notwatched.length; j++) {
// 			if (j < 30) msg += `🔹${res[i].jpname} - ${res[i].notwatched[j]}\n`;
// 			else {
// 				msg += "<i>And many more...</i>";
// 				break;
// 			}
// 		}
// 		if ((msg + msgheader).length > 1024 && res[i].shortname !== undefined) {
// 			while (msg.includes(res[i].jpname)) msg = msg.replace(res[i].jpname, res[i].shortname);
// 		}

// 		//Better logic
// 		if ((msg + msgheader).length > 1024) {
// 			console.log("Trying to trim");
// 			let lines = msg.split("\n");
// 			msg = lines[0] + "\n";
// 			for (let j = 1; j < lines.length; j++) {
// 				if ((msgheader + msg + lines[j]).length + 17 < 1024) msg += `${lines[j]}\n`;
// 				else {
// 					msg += "<i>And many more...</i>";
// 					break;
// 				}
// 			}
// 		}
// 		msg = msgheader + msg;

// 		// if (msg.length + msgheader.length > 1024) {
// 		// 	let chunk = "";
// 		// 	let lines = msg.split("\n");
// 		// 	for (let msgline = 0; msgline < lines.length; msgline++) {
// 		// 		if (msgline == 0) chunk += msgheader;
// 		// 		if (chunk.length + lines[msgline].length < 1024) {
// 		// 			chunk += `${lines[msgline]}\n`;
// 		// 		} else {
// 		// 			msglist.push(chunk);
// 		// 			chunk = `${lines[msgline]}\n`;
// 		// 		}
// 		// 	}
// 		// 	msglist.push(chunk);
// 		// } else msg = msgheader + msg;
// 		// if (msglist.length > 0) {
// 		// 	bot.api.sendPhoto(chatid, imagelink, {
// 		// 		caption: msglist[0],
// 		// 		parse_mode: "HTML",
// 		// 		reply_markup: replykeyboard
// 		// 	});
// 		// 	for (let msgnum = 1; msgnum < msglist.length; msgnum++)
// 		// 		bot.api.sendMessage(chatid, msglist[msgnum], {
// 		// 			parse_mode: "HTML"
// 		// 		});
// 		// } else
// 		msgs.push({ imagelink, msg });
// 	}
// 	if (msgs.length == 0) {
// 		await bot.api.sendMessage(chatid, "You don't have any pending episodes to watch.");
// 		return;
// 	}
// 	msgs.forEach(
// 		async (o) =>
// 			await bot.api.sendPhoto(chatid, o.imagelink, {
// 				caption: o.msg,
// 				parse_mode: "HTML",
// 				reply_markup: new InlineKeyboard()
// 					.text("Mark watched", "mark_watch")
// 					.text("Download", "download")
// 			})
// 	);
// }

export function pendingEndpoint(app: Application) {
	app.get("/pending", async (req, res) => {
		if (req.query == undefined) return res.status(400);
		try {
			const chatid = parseInt(req.query.chatid.toString());
			const userid = parseInt(req.query.userid.toString());
			const alid = parseInt(req.query.alid.toString());
			const is_bot = Boolean(req.query.is_bot.toString());
			if (Number.isNaN(userid) || Number.isNaN(alid)) throw new Error("Incorrect URL params");
			//await animePending(chatid, userid);
			if (!is_bot) {
				const res2 = await getSinglePending(userid, null, alid);
				if (res2 === undefined) {
					res.status(400).json([]);
					return;
				} else if (res2 === null) {
					res.status(200).send("UserID is not currently watching specified anime.");
					return;
				}
				res.json(res2).status(200);
				return;
			}
			if (is_bot && chatid === undefined) return null;
			const res2 = await animePendingBotHandle(chatid, userid, alid);
			if (res2) res.status(200).json({ status: 200 });
		} catch (error) {
			console.error(`ERROR: /pending: ${error}`);
			return res.status(400).json({ status: 400 });
		}
	});
}

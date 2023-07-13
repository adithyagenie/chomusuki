import { InlineKeyboard } from "grammy";
import axios from "axios";
import { getSinglePending } from "../../../api/pending";
import { bot, MyContext } from "../../bot";
import { FastifyInstance } from "fastify";


export async function a_Pending(ctx: MyContext) {
    await ctx.deleteMessage();
    const userid = ctx.session.userid;
    try {
        const res = await axios.get("http://localhost:4000/pending", {
            params: {
                chatid: ctx.from.id,
                userid: userid,
                alid: parseInt(ctx.match[1]),
                is_bot: true
            }
        });
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
    await bot.api.sendChatAction(chatid, "typing");
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
        const lines = msg.split("\n");
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
// 			"You are currently not watching any anime. Add an anime with /startwatching to get
// started." ); return; } for (let i = 0; i < res.length; i++) { if (res[i].notwatched.length == 0)
// continue; let [msg, msgheader] = ["", ""]; let imagelink = res[i].image; msgheader += `<b>Anime:
// ${res[i].jpname}</b>\n<i>(${res[i].enname})\n`; if (res[i].status == "RELEASING") msgheader +=
// "Currently airing.</i>\n\n"; else if (res[i].status == "FINISHED") msgheader += "Finished
// airing.</i>\n\n"; else msgheader += "</i>\n\n"; msgheader += `<b>Pending:</b>\n`; for (let j =
// 0; j < res[i].notwatched.length; j++) { if (j < 30) msg += `🔹${res[i].jpname} -
// ${res[i].notwatched[j]}\n`; else { msg += "<i>And many more...</i>"; break; } } if ((msg +
// msgheader).length > 1024 && res[i].shortname !== undefined) { while
// (msg.includes(res[i].jpname)) msg = msg.replace(res[i].jpname, res[i].shortname); }

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

export function pendingEndpoint(server: FastifyInstance) {
    interface customreq {
        chatid: number,
        userid: number,
        alid: number,
        is_bot: boolean
    }

    server.get<{ Querystring: customreq }>("/pending", async (req, res) => {
        if (req.query == undefined) return res.status(400);
        try {
            const chatid = parseInt(req.query.chatid.toString());
            const userid = parseInt(req.query.userid.toString());
            const alid = parseInt(req.query.alid.toString());
            const is_bot = Boolean(req.query.is_bot.toString());
            if (Number.isNaN(userid) || Number.isNaN(alid)) {
                console.error("ERROR: /pending: Incorrect URL params");
                await res.status(400).send({ status: 400, error: "Incorrect URL parameters" });
                return;
            }

            //await animePending(chatid, userid);
            if (!is_bot) {
                const res2 = await getSinglePending(userid, null, alid);
                if (res2 === undefined) {
                    await res.status(400).send([]);
                    return;
                } else if (res2 === null) {
                    return ("UserID is not currently watching specified anime.");
                }
                await res.send(res2);
                return;
            }
            if (is_bot && chatid === undefined) return null;
            const res2 = await animePendingBotHandle(chatid, userid, alid);
            if (res2) await res.send({ status: 200 });
        } catch (error) {
            console.error(`ERROR: /pending: ${error}`);
            await res.status(400).send({ status: 400, error: error });
            return;
        }
    });
}

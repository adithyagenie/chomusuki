import { db } from "../../..";
import { MyContext, bot } from "../../bot";
import { getNumber } from "../../../database/animeDB";

/**
 ** Gives all the downloads queued for the user.
 ** Responds to /dllist.
 */
export async function anime_dllist(ctx: MyContext) {
	{
		const userid = ctx.session.userid;

		await ctx.replyWithChatAction("typing");
		const pendingdl = (
			await db.syncupd.findMany({
				where: { userid },
				select: { anime: true, epnum: true }
			})
		).map((o) => {
			return { anime: o.anime, epnum: getNumber(o.epnum) as number };
		});
		if (pendingdl.length == 0) {
			ctx.reply("No pending downloads!");
		} else {
			const resser: { anime: string; epnum: number[] }[] = [];
			for (let i = 0; i < pendingdl.length; i++) {
				let index = resser.findIndex((o) => o.anime == pendingdl[i].anime);
				if (index == -1)
					resser.push({
						anime: pendingdl[i].anime,
						epnum: [pendingdl[i].epnum]
					});
				else {
					resser[index].epnum.push(pendingdl[i].epnum);
					resser[index].epnum.sort();
				}
			}

			var msg: string = "<code>DOWNLOAD QUEUE:</code>\n\n";
			var msglist: string[] = [];
			for (let i = 0; i < resser.length; i++) {
				let tmpmsg = `<b>${resser[i].anime}</b> - Episode ${resser[i].epnum.join(", ")}\n`;
				if (msg.length + tmpmsg.length > 1024) {
					msglist.push(msg);
					msg = tmpmsg;
				} else msg += tmpmsg;
			}
			if (msglist.length > 0) {
				for (let i = 0; i < msglist.length; i++)
					bot.api.sendMessage(ctx.message.chat.id, msglist[i], {
						parse_mode: "HTML"
					});
			} else
				bot.api.sendMessage(ctx.message.chat.id, msg, {
					parse_mode: "HTML"
				});
		}
	}
}

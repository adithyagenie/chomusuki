import { authchat, updater } from "../../..";
import { DLSync, getPendingDL } from "../../../database/db_connect";
import { MyContext, authchatEval, bot } from "../../bot";

export async function anime_dllist(ctx: MyContext) {
	{
		if (!authchatEval(ctx)) return
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
	}
}

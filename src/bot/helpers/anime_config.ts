import { config } from "@prisma/client";
import { dbcache } from "../..";
import { changeConfig } from "../../database/animeDB";
import { MyContext, authchatEval } from "../bot";

export async function anime_config(ctx: MyContext) {
	if (!authchatEval) return;
	let argarray = ctx.message.text.split(" ");
	argarray.splice(0, 1);
	console.log(argarray);
	const oldconfig = await dbcache.getConfig(ctx.chat.id);
	const userid = await dbcache.getUserID(ctx.chat.id);
	var newconfig: config = {
		userid: userid,
		pause_airing_updates: oldconfig.pause_airing_updates
	};
	if (argarray.length > 0) {
		if (argarray[0] == "pause_airing_updates") {
			if (argarray[1] == "true" || argarray[1] == "false") {
				newconfig.pause_airing_updates = true
					? argarray[1] == "true"
					: argarray[1] == "false";
				await changeConfig(newconfig);
				ctx.reply(`Set pause_sync to ${newconfig.pause_airing_updates}.`);
			} else ctx.reply('Invalid value for pause_sync. Accepted values: "true/false"');
			return;
		} else
			ctx.reply('Invalid config option. Accepted config option: "remind_again/pause_sync"');
		return;
	} else ctx.reply('Provide a config option. Accepted config option: "remind_again/pause_sync"');
}

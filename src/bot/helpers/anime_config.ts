import { updater } from "../..";
import { changeconfig, configuration } from "../../database/db_connect";
import { MyContext, authchatEval } from "../bot";

export async function anime_config(ctx: MyContext, options: configuration) {
    if (!authchatEval) return;
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
}

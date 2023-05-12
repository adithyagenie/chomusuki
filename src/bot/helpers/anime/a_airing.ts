import { db } from "../../..";
import { addAiringFollow } from "../../../database/animeDB";
import { MyContext } from "../../bot";

/**
 ** Live updates for airing shit.
 ** Responds to "/remindme_alid". */
export async function remindMe(ctx: MyContext) {
	const userid = ctx.session.userid;

	const alid = parseInt(ctx.match[1]);
	if (alid == undefined) {
		await ctx.reply("Invalid.");
		return;
	}
	const remindme = await db.airingupdates.findUnique({
		where: { userid }
	});
	if (remindme.alid === undefined) remindme.alid = [];
	if (remindme.alid.includes(alid)) {
		ctx.reply("You are already following updates for this anime!");
		return;
	}
	remindme.alid.push(alid);
	const res = await addAiringFollow(remindme);
	if (res == 0)
		await ctx.reply(
			`You will now recieve updates on <b>${
				(
					await db.anime.findUnique({
						where: { alid },
						select: { jpname: true }
					})
				).jpname
			}.</b>`,
			{ parse_mode: "HTML" }
		);
	else await ctx.reply("Error encountered ;_;");
	return;
}

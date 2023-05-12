import { anime, Prisma } from "@prisma/client";
import aniep from "aniep";
import { db } from "../../..";
import { getAnimeDetails, imageGet } from "../../../api/anilist_api";
import { getDecimal, addAnimeNames, addWatching } from "../../../database/animeDB";
import { MyContext } from "../../bot";

export async function checkAnimeTable(alid: number) {
	var pull = await db.anime.findUnique({
		where: { alid },
		select: { alid: true, status: true, jpname: true }
	});
	var airing = false;
	if (pull === null) {
		const res = await getAnimeDetails(alid);
		if (res === undefined) {
			return "invalid";
		}
		var release = res.status === "RELEASING";
		var obj: anime = {
			alid: res.id,
			jpname: res.title.romaji,
			enname: res.title.english,
			optnames: undefined,
			excludenames: undefined,
			status: res.status,
			next_ep_num: undefined,
			next_ep_air: undefined,
			last_ep: undefined,
			ep_extras: undefined,
			imglink: await imageGet(res.id)
		};
		if (release) {
			obj.next_ep_air = res.nextAiringEpisode["airingAt"];
			obj.next_ep_air = res.nextAiringEpisode["episode"];
		}
		if (res.airingSchedule.length == 0) {
			const _ = res.streamingEpisodes.map((o) => aniep(o.title) as number).sort();
			obj.last_ep = Math.max(..._);
			obj.ep_extras = getDecimal(_.filter((o) => o % 1 !== 0)) as Prisma.Decimal[];
			if (_.includes(0)) obj.ep_extras.push(getDecimal(0) as Prisma.Decimal);
		} else {
			const _ = res.airingSchedule
				.filter((o) => o.timeUntilAiring <= 0)
				.map((o) => o.episode);
			obj.last_ep = Math.max(..._);
			obj.ep_extras = getDecimal(_.filter((o) => o % 1 !== 0)) as Prisma.Decimal[];
			if (_.includes(0)) obj.ep_extras.push(getDecimal(0) as Prisma.Decimal);
		}
		const add = await addAnimeNames(obj);
		if (add == 1) return "err";
		pull = obj;
	}
	airing = pull.status === "RELEASING";
	return { pull, airing };
}

/**
 ** This function adds anime to the anime table.
 ** Responds to "/startwatching_alid".
 ** Note to self: don't use bot.command, use bot.on(^\/startwatching_(\d+)$)
 */
export async function animeStartWatch(ctx: MyContext) {
	const alid = parseInt(ctx.match[1]);
	if (alid == undefined) {
		await ctx.reply("Invalid.");
		return;
	}
	const userid = ctx.session.userid;

	const old = (
		await db.watchinganime.findUnique({
			where: { userid }
		})
	).alid;
	if (old.includes(alid)) {
		await ctx.reply(
			`You have already marked <b>${
				(
					await db.anime.findUnique({
						where: { alid },
						select: { jpname: true }
					})
				).jpname
			}</b> as watching.`,
			{ parse_mode: "HTML" }
		);
		return;
	}
	const res = await checkAnimeTable(alid);
	if (res == "err") {
		await ctx.reply("Error occured!");
		return;
	}
	if (res == "invalid") {
		await ctx.reply("Cannot find any anime with given alid.");
		return;
	}
	await ctx.reply(`Marked ${res.pull.jpname} as watching!`);
	if (res.airing)
		ctx.reply(
			`${res.pull.jpname} is currently airing. If you would like to follow its episode releases: /remindme_${res.pull.alid}`
		);
	await addWatching(userid, alid);
}

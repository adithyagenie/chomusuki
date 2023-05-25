import * as cron from "node-schedule";
import { PrismaClient } from "@prisma/client";
import { bot } from "../bot/bot";
import { checkAnimeTable, getNumber } from "../database/animeDB";
const db = new PrismaClient();

async function cronn(alid: number, aniname: string, next_ep_air: number, next_ep_num: number) {
	console.log(
		`Scheduling job for ${aniname} - ${next_ep_num} at ${new Date(
			next_ep_air * 1000
		).toLocaleString()}`
	);
	if (next_ep_air * 1000 < Date.now()) {
		console.error("Time to schedule in past.");
		return;
	}
	const job = cron.scheduleJob(`${alid}`, new Date(next_ep_air * 1000), async () =>
		airhandle(alid, aniname, next_ep_num)
	);
	if (job !== null) job.on("error", (err) => console.log(err));
}

async function airhandle(alid: number, aniname: string, next_ep_num: number) {
	console.log(`Processing job for ${aniname} - ${next_ep_num}.`);
	const sususers = await db.airingupdates.findUnique({
		where: { alid },
		select: { userid: true }
	});
	const imglink = await db.anime.findUnique({ where: { alid }, select: { fileid: true } });
	if (sususers === null) throw new Error("Unable to find airing ppl");
	const chatid = await db.users.findMany({
		where: { userid: { in: sususers.userid } },
		select: { chatid: true }
	});
	chatid.forEach(
		async (o) =>
			await bot.api.sendPhoto(o.chatid, imglink.fileid, {
				caption: `Episode ${next_ep_num} of <b>${aniname}</b> is airing now.\nDownload links will be available soon.`,
				parse_mode: "HTML"
			})
	);
	cron.scheduleJob(`AL_${alid}`, new Date(Date.now() + 20000), async () => {
		console.log(`checking anilist for updates`);
		const res = await checkAnimeTable(alid, true);
		if (res === "invalid" || res === "err") throw new Error("Can't fetch anime details.");
		if (res.airing === true) {
			cronn(
				alid,
				res.pull.jpname,
				res.pull.next_ep_air,
				getNumber(res.pull.next_ep_num) as number
			);
		}
	});
}

async function reInitCron() {
	console.log("Refreshing all cron!");
	const data = await db.anime.findMany({
		where: {
			next_ep_air: {
				not: null
			},
			status: "RELEASING"
		},
		select: { jpname: true, next_ep_air: true, alid: true, next_ep_num: true }
	});
	const oldtasks = cron.scheduledJobs;
	Object.keys(oldtasks).forEach((i) => {
		if (!(oldtasks[i].name == "main" || oldtasks[i].triggeredJobs() != 0)) oldtasks[i].cancel();
	});
	data.forEach((o) => {
		cronn(o.alid, o.jpname, o.next_ep_air, o.next_ep_num.toNumber());
	});
}

export async function initCron() {
	await db.anime.update({
		where: { alid: 150672 },
		data: { next_ep_air: Math.floor(Date.now() / 1000) + 30 }
	});
	await reInitCron();
	cron.scheduleJob("main", " */2 * * * *", () => reInitCron());
}

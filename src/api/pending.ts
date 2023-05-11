import { anime } from "@prisma/client";
import { GetWatchedList, getNumber } from "../database/animeDB";
import { db } from "..";
import { i_ProcessedObjV2 } from "../interfaces";
import { Decimal } from "@prisma/client/runtime";

/** Returns all yet to watch episodes of user. */
export async function getPending(userid: number) {
	const t = new Date().getTime();
	let alidlist = await db.watchinganime.findUnique({
		where: { userid },
		select: { alid: true }
	});
	if (alidlist === null) return undefined;
	const animelist = db.anime.findMany({
		where: { alid: { in: alidlist.alid } }
	});
	const watchedlist = await GetWatchedList(userid, alidlist.alid);
	const reqQueue = [];
	for (let i = 0; i < alidlist.alid.length; i++) {
		let alid = alidlist.alid[i];
		let watched = watchedlist.find((o) => o.alid == alidlist.alid[i]);
		if (watched === undefined) watched = { alid: alid, ep: [] };
		let animeentry = await animelist;
		reqQueue.push(getPendingInAnime(watched.ep, animeentry[i]));
	}
	const res: i_ProcessedObjV2[] = await Promise.all(reqQueue);
	console.log(`----------RES TOOK :${new Date().getTime() - t} ms----------`);
	return res;
}

/**
 ** Internal function.
 ** Returns the 'res' obj for each watching anime.
 */
async function getPendingInAnime(watchedep: Decimal[], animeentry: anime) {
	var resobj: i_ProcessedObjV2;
	var shortname: string | undefined;
	if (!(animeentry.optnames == null || animeentry.optnames.length == 0)) {
		shortname = animeentry.optnames.reduce((a, b) => (a.length <= b.length ? a : b)); // returns shortest string in optname
		if (animeentry.jpname.length <= shortname.length) {
			shortname = undefined;
		}
	}
	/*Im trying really hard not to query anilist for every anime, the problem being there can be .5 episodes/episode 0. 
	So for now, im planning to put that on an array in db. 
    also, old af anime dont have airing schedule, instead find the streaming thing and use aniep on it.*/
	resobj = {
		alid: animeentry.alid,
		jpname: animeentry.jpname,
		enname: animeentry.enname,
		shortname: shortname,
		watched: getNumber(watchedep) as number[],
		notwatched: [],
		imagelink: animeentry.imglink
	};
	resobj.notwatched = Array.from({ length: animeentry.last_ep }, (_, i) => i + 1)
		.concat(getNumber(animeentry.ep_extras))
		.sort((a, b) => (a > b ? 1 : -1))
		.filter((o) => !resobj.watched.includes(o)); // gets all notwatched ep
	return resobj;
}

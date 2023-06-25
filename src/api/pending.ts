import { anime } from "@prisma/client";
import { getNumber, GetWatchedList } from "../database/animeDB";
import { db } from "..";
import { i_ProcessedObjV2 } from "../interfaces";

//import { writeJSON } from "fs-extra";

/** Returns all yet to watch episodes of user. */
export async function getPending(userid: number) {
	const t = new Date().getTime();
	const alidlist = await db.watchinganime.findUnique({
		where: { userid },
		select: { alid: true }
	});
	if (alidlist === null) return undefined;
	const animelist = await db.anime.findMany({
		where: { alid: { in: alidlist.alid } }
	});
	const watchedlist = await GetWatchedList(userid, alidlist.alid);
	const reqQueue = [];
	for (let i = 0; i < alidlist.alid.length; i++) {
		const alid = alidlist.alid[i];
		let watched = watchedlist.find((o) => o.alid == alidlist.alid[i]);
		if (watched === undefined) watched = { alid: alid, ep: [] };
		const animeentry = animelist.find((o) => o.alid == alidlist.alid[i]);
		reqQueue.push(getPendingInAnime(getNumber(watched.ep) as number[], animeentry));
	}
	const res: i_ProcessedObjV2[] = await Promise.all(reqQueue);
	console.log(`----------RES TOOK :${new Date().getTime() - t} ms----------`);
	//writeJSON("./returnobj3.json", res);
	return res;
}

export async function getSinglePending(userid: number, animename?: string, alid?: number) {
	let animeentry: anime;
	try {
		if (alid == undefined) {
			const _ = await db.anime.findMany({
				where: {
					jpname: animename.trim()
				},
				take: 1
			});
			if (_.length == 0) throw new Error(`Unable to fetch anime with name ${animename}`);
			animeentry = _[0];
		} else {
			animeentry = await db.anime.findUnique({
				where: { alid }
			});
			if (animeentry === null) throw new Error(`No anime found: ${alid}`);
		}
		const watched = await db.watchedepanime.findUnique({
			where: {
				userid_alid: { userid: userid, alid: animeentry.alid }
			},
			select: { ep: true }
		});
		if (watched === null) {
			console.error(`Got null when pulling watched - ${alid}: ${userid}`);
			return null;
		}
		return await getPendingInAnime(getNumber(watched.ep) as number[], animeentry);
	} catch (error) {
		console.error(error);
		return undefined;
	}
}

/**
 ** Internal function.
 ** Returns the 'res' obj for each watching anime.
 */
async function getPendingInAnime(watchedep: number[], animeentry: anime) {
	let shortname: string | undefined;
	if (!(animeentry.optnames == null || animeentry.optnames.length == 0)) {
		shortname = animeentry.optnames.reduce((a, b) => (a.length <= b.length ? a : b)); // returns shortest string in optname
		if (animeentry.jpname.length <= shortname.length) {
			shortname = undefined;
		}
	}
	/*Im trying really hard not to query anilist for every anime, the problem being there can be .5 episodes/episode 0. 
	So for now, im planning to put that on an array in db. 
    also, old af anime dont have airing schedule, instead find the streaming thing and use aniep on it.*/
	const status = animeentry.status;
	if (!(status == "RELEASING" || status == "NOT_YET_RELEASED" || status == "FINISHED")) return;
	const resobj = {
		alid: animeentry.alid,
		jpname: animeentry.jpname,
		enname: animeentry.enname,
		shortname: shortname,
		watched: watchedep,
		notwatched: [],
		image: animeentry.fileid,
		status: status
	};
	resobj.notwatched = Array.from({ length: animeentry.last_ep }, (_, i) => i + 1)
		.concat(getNumber(animeentry.ep_extras))
		.sort((a, b) => (a > b ? 1 : -1))
		.filter((o) => !resobj.watched.includes(o)); // gets all notwatched ep
	return resobj;
}

// async function markCompletedChore(obj: i_ProcessedObjV2[]) {
// 	for (let i = 0; i < obj.length; i++) {
// 		if (obj[i].status == "RELEASING" || obj[i].status == "NOT_YET_RELEASED") continue;
// 		if (obj[i].notwatched.length == 0) {
// 		    await db.completedanime.
// 		}
// 	}
// }

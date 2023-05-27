import { db } from "..";
import * as Prisma from "@prisma/client";
import * as types from "../interfaces";
import aniep from "aniep";
import { getAnimeDetails, imageGet } from "../api/anilist_api";
import { bot } from "../bot/bot";

export async function addAnimeNames(obj: Prisma.anime) {
	try {
		let insertres = await db.anime.upsert({
			where: { alid: obj.alid },
			update: obj,
			create: obj
		});
		await db.airingupdates.upsert({
			where: { alid: obj.alid },
			update: {
				alid: undefined,
				userid: undefined
			},
			create: {
				alid: obj.alid,
				userid: []
			}
		});
		console.log(`POSTGRES: Add anime - Documents inserted: ${insertres.alid}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: addAnimeNames - ${err}`);
		return 1;
	}
}

export async function markWatchedunWatched(obj: Prisma.watchedepanime) {
	try {
		const res = await db.watchedepanime.upsert({
			where: {
				userid_alid: {
					userid: obj.userid,
					alid: obj.alid
				}
			},
			create: obj,
			update: obj
		});
		console.log(
			`POSTGRES: Mark watched/unwatched - Documents upserted: ${res.userid}: ${res.alid}`
		);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: markWatchedunWatched - ${err}`);
		return 1;
	}
}

export async function addWatching(userid: number, alid: number) {
	try {
		const add = await db.watchinganime.update({
			where: { userid: userid },
			data: { alid: { push: alid } }
		});
		await db.watchedepanime.create({
			data: { userid: userid, alid: alid, ep: [] }
		});
		console.log(`POSTGRES: Add subscription - Documents updated: ${add.userid}: ${alid}`);
	} catch (err) {
		console.error(`POSTGRES: addWatching - ${err}`);
	}
}

/**Takes user id and list of alid as parameter and returns the ep status of them for the user */
export async function GetWatchedList(userid: number, alidlist: number[]) {
	return await db.watchedepanime.findMany({
		where: { userid: userid, alid: { in: alidlist } },
		select: { alid: true, ep: true }
	});
}

export async function getUserWatchingAiring(
	table: "watchinganime" | "airingupdates",
	userid: number,
	count?: number,
	offset?: number
) {
	try {
		let alidlist: number[] = [];
		if (table == "airingupdates") {
			let _ = await db.airingupdates.findMany({
				where: { userid: { has: userid } },
				select: { alid: true }
			});
			if (_ === null) alidlist = [];
			else alidlist = _.map((o) => o.alid);
		} else {
			let _ = await db.watchinganime.findUnique({
				where: { userid: userid },
				select: { alid: true }
			});
			if (_ === null) alidlist = [];
			else alidlist = _.alid;
		}
		if (alidlist.length == 0) return { alidlist: [], animelist: [], amount: 0 };
		const amount = alidlist.length;
		if (count !== undefined && offset !== undefined)
			alidlist = alidlist.slice(offset - 1, count + offset - 1);
		const tosort = await db.anime.findMany({
			where: { alid: { in: alidlist } },
			select: { jpname: true, alid: true }
		});
		tosort.sort((a, b) => (alidlist.indexOf(a.alid) > alidlist.indexOf(b.alid) ? 1 : -1));
		const animelist = tosort.map((o) => o.jpname);
		if (alidlist.length !== animelist.length) throw new Error("Unequal fetch for anime: alid");
		console.log(`${alidlist}:: ${animelist}`);
		return { alidlist, animelist, amount };
	} catch (err) {
		console.error(`POSTGRES: get_Watching_Airing - ${err}`);
		return undefined;
	}
}

export async function removeWatching(obj: Prisma.watchinganime) {
	try {
		const del = await db.watchinganime.update({
			where: { userid: obj.userid },
			data: obj
		});
		console.log(`POSTGRES: Unsubscribed anime - Deletion success: ${del.userid}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: removeWatching - ${err}`);
	}
}

export async function addAiringFollow(alid: number, userid: number) {
	try {
		await db.airingupdates.update({
			where: { alid },
			data: { userid: { push: userid } }
		});
		return 0;
	} catch (err) {
		console.error(`POSTGRES: addAiringFollow - ${err}`);
		return 1;
	}
}

export async function newDL(obj: types.i_DlSync) {
	try {
		const res = await db.syncupd.create({
			data: obj
		});
		console.log(`POSTGRES: New download queued - Documents inserted: ${res}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: DlSync - ${err}`);
	}
}

export async function changeConfig(newconfig: Prisma.config) {
	try {
		const res = await db.config.update({
			where: { userid: newconfig.userid },
			data: newconfig
		});
		console.log(`POSTGRES: UPDATE CONFIG: ${res.userid}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: changeConfig - ${err}`);
	}
}

export async function newWatchlist(watchlist_name: string, generated_by: number) {
	try {
		const res = await db.watchlists.create({
			data: {
				watchlist_name,
				generated_by
			}
		});
		console.log(`POSTGRES: Watchlist created - ${res.watchlist_name}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: newWatchlist - ${err}`);
	}
}

export async function addToWatchlist(watchlistid: number, addAlID: number[]) {
	try {
		if (addAlID.length === 1) {
			let res = await db.watchlists.update({
				where: {
					watchlistid: watchlistid
				},
				data: {
					animeid: { push: addAlID[0] },
					status: { push: false }
				}
			});
			console.log(`POSTGRES: Watchlist item added - ${res.watchlistid}`);
		} else {
			let old = await db.watchlists.findUnique({
				where: {
					watchlistid: watchlistid
				},
				select: { animeid: true, status: true }
			});
			let res = await db.watchlists.update({
				where: { watchlistid: watchlistid },
				data: {
					animeid: old.animeid.concat(addAlID),
					status: old.status.concat(Array.from({ length: addAlID.length }, () => false))
				}
			});
			console.log(`POSTGRES: Watchlist items added - ${res.watchlistid}`);
		}
		return 0;
	} catch (err) {
		console.error(`POSTGRES: newWatchlist - ${err}`);
	}
}

export async function markDoneWatchlist(watchlistid: number, AlID: number) {
	try {
		let old = await db.watchlists.findUnique({
			where: { watchlistid: watchlistid }
		});
		const index = old.animeid.indexOf(AlID);
		if (index == -1) throw new Error("Unable to find AlID");
		old.status[index] = true;
		const res = await db.watchlists.update({
			where: {
				watchlistid: watchlistid
			},
			data: {
				status: old.status
			}
		});
		console.log(`POSTGRES: Marking anime as done in watchlist - ${res.watchlistid}:${AlID}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: markDoneWatchlist - ${err}`);
	}
}

export async function removeFromWatchlist(watchlistid: number, AlID: number) {
	try {
		let old = await db.watchlists.findUnique({
			where: { watchlistid: watchlistid }
		});
		const index = old.animeid.indexOf(AlID);
		if (index == -1) throw new Error("Unable to find AlID");
		old.animeid.splice(index, 1);
		old.status.splice(index, 1);
		const res = await db.watchlists.update({
			where: {
				watchlistid: watchlistid
			},
			data: {
				status: old.status
			}
		});
		console.log(`POSTGRES: Removing anime from watchlist - ${res.watchlistid}:${AlID}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: markDoneWatchlist - ${err}`);
	}
}

export async function deleteWatchlist(watchlistid: number) {
	try {
		const res = await db.watchlists.delete({
			where: {
				watchlistid: watchlistid
			}
		});
		console.log(`POSTGRES: Deleting watchlist - ${res.watchlistid}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: deleteWatchlist - ${err}`);
	}
}

export function getNumber(
	data: Prisma.Prisma.Decimal | Prisma.Prisma.Decimal[]
): number | number[] {
	try {
		if (Array.isArray(data)) return data.map((o) => new Prisma.Prisma.Decimal(o).toNumber());
		else if (data instanceof Prisma.Prisma.Decimal)
			return new Prisma.Prisma.Decimal(data).toNumber();
	} catch (e) {
		console.error(e);
	}
}

export function getDecimal(
	data: number | number[]
): Prisma.Prisma.Decimal | Prisma.Prisma.Decimal[] {
	if (Array.isArray(data)) return data.map((o) => new Prisma.Prisma.Decimal(o));
	else if (typeof data == "number") return new Prisma.Prisma.Decimal(data);
}

/** Adds anime details to anime table if not existing.*/
export async function checkAnimeTable(alid: number, updatedata = false) {
	var pull: {
		alid: number;
		jpname: string;
		status: string;
		next_ep_num: Prisma.Prisma.Decimal;
		next_ep_air: number;
	} = null;
	if (updatedata === false)
		pull = await db.anime.findUnique({
			where: { alid },
			select: { alid: true, status: true, jpname: true, next_ep_air: true, next_ep_num: true }
		});
	var airing = false;
	if (pull === null) {
		const res = await getAnimeDetails(alid);
		if (res === undefined) {
			return "invalid";
		}
		var release = res.status === "RELEASING";
		let imglink: string = undefined,
			fileid: string = undefined;
		if (updatedata !== true) {
			imglink = await imageGet(res.id);
			fileid = (await bot.api.sendPhoto(-1001869285732, imglink)).photo[0].file_id;
		}
		var obj: Prisma.anime = {
			alid: res.id,
			jpname: res.title.romaji,
			enname: res.title.english !== null ? res.title.english : res.title.romaji,
			optnames: undefined,
			excludenames: undefined,
			status: res.status,
			next_ep_num: undefined,
			next_ep_air: undefined,
			last_ep: undefined,
			ep_extras: undefined,
			imglink: imglink,
			fileid: fileid
		};
		if (release) {
			obj.next_ep_air = res.nextAiringEpisode["airingAt"];
			obj.next_ep_num = getDecimal(res.nextAiringEpisode["episode"]) as Prisma.Prisma.Decimal;
		}
		if (obj.status === "RELEASING" || obj.status === "FINISHED") {
			let _: number[] = [];
			if (res.airingSchedule.length != 0) {
				_ = res.airingSchedule.filter((o) => o.timeUntilAiring <= 0).map((o) => o.episode);
			} else if (res.airingSchedule.length == 0 && res.streamingEpisodes.length != 0) {
				_ = res.streamingEpisodes.map((o) => aniep(o.title) as number).sort();
			} else if (
				res.airingSchedule.length == 0 &&
				res.streamingEpisodes.length == 0 &&
				res.episodes != null
			) {
				_ = Array.from({ length: res.episodes }, (_, i) => i + 1);
			}
			obj.last_ep = Math.max(..._);
			obj.ep_extras = getDecimal(_.filter((o) => o % 1 !== 0)) as Prisma.Prisma.Decimal[];
			if (_.includes(0)) obj.ep_extras.push(getDecimal(0) as Prisma.Prisma.Decimal);
		}
		const add = await addAnimeNames(obj);
		if (add == 1) return "err";
		pull = obj;
	}
	airing = pull.status === "RELEASING";

	return { pull, airing };
}

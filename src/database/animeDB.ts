import { db } from "..";
import * as Prisma from "@prisma/client";
import * as types from "../interfaces";

export async function addAnimeNames(obj: Prisma.anime) {
	try {
		let insertres = await db.anime.create({
			data: obj
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
	}
}

export async function addWatching(userid: number, alid: number) {
	try {
		const add = await db.watchinganime.update({
			where: { userid: userid },
			data: { alid: { push: alid } }
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

export async function getWatching(userid: number, count?: number, offset?: number) {
	try {
		let alidlist = (
			await db.watchinganime.findUnique({
				where: { userid },
				select: { alid: true }
			})
		).alid;
		const amount = alidlist.length;
		if (count !== undefined && offset !== undefined)
			alidlist = alidlist.slice(offset, count + offset);
		const animelist = (
			await db.anime.findMany({
				where: { alid: { in: alidlist } },
				select: { jpname: true }
			})
		).map((o) => o.jpname);
		if (alidlist.length !== animelist.length) throw new Error("Unequal fetch for anime: alid");
		return { alidlist, animelist, amount };
	} catch (err) {
		console.error(`POSTGRES: getWatching - ${err}`);
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

export async function addAiringFollow(obj: Prisma.airingupdates) {
	try {
		const res = await db.airingupdates.upsert({
			where: { userid: obj.userid },
			update: obj,
			create: obj
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

export async function getConfig(userid: number) {
	try {
		const res = await db.config.findUnique({ where: { userid: userid } });
		if (res.userid !== undefined) return res;
		throw new Error(`Cannot fetch config for user ${userid}`);
	} catch (err) {
		console.error(`POSTGRES: getConfig - ${err}`);
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
	if (Array.isArray(data)) return data.map((o) => new Prisma.Prisma.Decimal(o).toNumber());
	else if (data instanceof Prisma.Prisma.Decimal)
		return new Prisma.Prisma.Decimal(data).toNumber();
}

export function getDecimal(
	data: number | number[]
): Prisma.Prisma.Decimal | Prisma.Prisma.Decimal[] {
	if (Array.isArray(data)) return data.map((o) => new Prisma.Prisma.Decimal(o));
	else if (typeof data == "number") return new Prisma.Prisma.Decimal(data);
}

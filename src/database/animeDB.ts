import { db } from "..";
import * as Prisma from "@prisma/client";
import * as types from "../interfaces";

export async function addAnimeNames(obj: Prisma.anime) {
	try {
		let insertres = await db.anime.create({
			data: obj,
		});
		console.log(
			`POSTGRES: Add anime - Documents inserted: ${insertres.alid}`
		);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: addAnimeNames - ${err}`);
	}
}

export async function markWatchedunWatched(obj: Prisma.watchedepanime) {
	try {
		const res = await db.watchedepanime.upsert({
			where: {
				userid_alid: {
					userid: obj.userid,
					alid: obj.alid,
				},
			},
			create: obj,
			update: obj,
		});
		console.log(
			`POSTGRES: Mark watched/unwatched - Documents upserted: ${res.userid}: ${res.alid}`
		);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: markWatchedunWatched - ${err}`);
	}
}

export async function removesubscription(
	obj: Prisma.subscribedanime,
	userid: string
) {
	try {
		const del = await db.subscribedanime.update({
			where: { userid: userid },
			data: obj,
		});
		console.log(
			`POSTGRES: Unsubscribed anime - Deletion success: ${del.userid}`
		);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: removesubscription - ${err}`);
	}
}

export async function DlSync(obj: types.i_DlSync) {
	try {
		const res = await db.syncupd.create({
			data: obj,
		});
		console.log(
			`POSTGRES: New download queued - Documents inserted: ${res}`
		);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: DlSync - ${err}`);
	}
}

export async function getConfig(userid: string) {
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
			data: newconfig,
		});
		console.log(`POSTGRES: UPDATE CONFIG: ${res.userid}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: changeConfig - ${err}`);
	}
}

export async function addReminded(obj: Prisma.remindedepanime) {
	try {
		const res = await db.remindedepanime.upsert({
			where: { userid_alid: { userid: obj.userid, alid: obj.alid } },
			create: obj,
			update: obj,
		});
		console.log(
			`POSTGRES: Adding reminded anime - Documents updated: ${res.userid}`
		);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: addReminded - ${err}`);
	}
}

export async function newWatchlist(watchlistname: string) {
	try {
		const res = await db.watchlists.create({
			data: {
				watchlistid: "",
				watchlist_name: watchlistname,
			},
		});
		console.log(`POSTGRES: Watchlist created - ${res.watchlist_name}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: newWatchlist - ${err}`);
	}
}

export async function addToWatchlist(watchlistid: string, addAlID: number[]) {
	try {
		if (addAlID.length === 1) {
			let res = await db.watchlists.update({
				where: {
					watchlistid: watchlistid,
				},
				data: {
					animeid: { push: addAlID[0] },
					status: { push: false },
				},
			});
			console.log(`POSTGRES: Watchlist item added - ${res.watchlistid}`);
		} else {
			let old = await db.watchlists.findUnique({
				where: {
					watchlistid: watchlistid,
				},
				select: { animeid: true, status: true },
			});
			let res = await db.watchlists.update({
				where: { watchlistid: watchlistid },
				data: {
					animeid: old.animeid.concat(addAlID),
					status: old.status.concat(
						Array.from({ length: addAlID.length }, () => false)
					),
				},
			});
			console.log(`POSTGRES: Watchlist items added - ${res.watchlistid}`);
		}
		return 0;
	} catch (err) {
		console.error(`POSTGRES: newWatchlist - ${err}`);
	}
}

export async function markDoneWatchlist(watchlistid: string, AlID: number) {
	try {
		let old = await db.watchlists.findUnique({
			where: { watchlistid: watchlistid },
		});
		const index = old.animeid.indexOf(AlID);
		if (index == -1) throw new Error("Unable to find AlID");
		old.status[index] = true;
		const res = await db.watchlists.update({
			where: {
				watchlistid: watchlistid,
			},
			data: {
				status: old.status,
			},
		});
		console.log(
			`POSTGRES: Marking anime as done in watchlist - ${res.watchlistid}:${AlID}`
		);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: markDoneWatchlist - ${err}`);
	}
}

export async function removeFromWatchlist(watchlistid: string, AlID: number) {
	try {
		let old = await db.watchlists.findUnique({
			where: { watchlistid: watchlistid },
		});
		const index = old.animeid.indexOf(AlID);
		if (index == -1) throw new Error("Unable to find AlID");
		old.animeid.splice(index, 1);
		old.status.splice(index, 1);
		const res = await db.watchlists.update({
			where: {
				watchlistid: watchlistid,
			},
			data: {
				status: old.status,
			},
		});
		console.log(
			`POSTGRES: Removing anime from watchlist - ${res.watchlistid}:${AlID}`
		);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: markDoneWatchlist - ${err}`);
	}
}

export async function deleteWatchlist(watchlistid: string) {
	try {
		const res = await db.watchlists.delete({
			where: {
				watchlistid: watchlistid,
			},
		});
		console.log(`POSTGRES: Deleting watchlist - ${res.watchlistid}`);
		return 0;
	} catch (err) {
		console.error(`POSTGRES: deleteWatchlist - ${err}`);
	}
}

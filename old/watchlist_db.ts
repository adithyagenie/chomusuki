import { mongoClient } from "../src";

export interface User {
	ChatID: number;
	Username: string;
	watchlists: string[];
	config: {
		pause_sync: boolean;
		remind_again: boolean;
	};
}

export interface Watchlist {
	wlCode: string;
	wlList: {
		[AlID: number]: string;
	};
}

export interface AnimeWL {
	AlID: number;
	name: string;
	genre: string;
}

/** Gets user details according to opts specified.*/
export async function getUser(
	chatid: number,
	opts: { Username?: boolean; watchlists?: boolean; config?: boolean }
) {
	try {
		const db = mongoClient.db("Watchlist");
		const coll = db.collection<User>("Users");
		const res = await coll.find<User>({ ChatID: chatid }).toArray();
		if (res.length > 1) throw new Error("More than one user found.");
		const user = res[0];
		delete user["_id"];
		console.log(user);
		var returnobj: Partial<User> = {};
		if (opts.Username) returnobj.Username = user.Username;
		if (opts.watchlists) returnobj.watchlists = user.watchlists;
		if (opts.config) returnobj.config = user.config;
		if (!(opts.Username || opts.watchlists || opts.config))
			returnobj = user;
		console.log(returnobj);
		return returnobj;
	} catch (error) {
		console.error(error);
	}
}

/** Gets list of anime in given watchlist code. */
export async function* getWL(wlcode: string) {
	try {
		const db = mongoClient.db("Watchlist");
		const coll = db.collection<Watchlist>("Watchlist");
		const res = await coll.find<Watchlist>({ wlCode: wlcode }).toArray();
		delete res["_id"];
		if (res.length > 1 || res.length < 1)
			throw new Error("Error fetching watchlist");
		//return res[0].wlList
		yield res[0].wlList;
	} catch (error) {
		console.error(error);
	}
}

/** Parses the anime codes in watchlist. */
export async function parseWL(wlList: number[]) {
	try {
		const db = mongoClient.db("Watchlist");
		const coll = db.collection<AnimeWL>("Anime");
		let res = await coll.find<AnimeWL>({}).toArray();
		let asked: { [code: number]: { name: string; genre: string } } = {};
		for (let i = 0; i < res.length; i++) {
			if (wlList.includes(res[i].AlID))
				asked[res[i].AlID] = { name: res[i].name, genre: res[i].genre };
		}
		return asked;
	} catch (error) {
		console.error(error);
	}
}
